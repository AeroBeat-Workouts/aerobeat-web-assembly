// @ts-check

/** @typedef {Readonly<{musicVolume:number,sfxVolume:number}>} AeroAudioMixSnapshot */
/** @typedef {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} AudioMixStorage */
/** @typedef {{key?:string|null,newValue?:string|null,storageArea?:unknown}} AudioMixStorageEvent */
/** @typedef {{addEventListener?:(type:string,listener:(event:AudioMixStorageEvent)=>void)=>void,removeEventListener?:(type:string,listener:(event:AudioMixStorageEvent)=>void)=>void}} AudioMixEventTarget */

export const aeroAudioMixStorageKey = "aerobeat.audio-mix.v1";
export const defaultAeroAudioMixSnapshot = Object.freeze({ musicVolume: 0.5, sfxVolume: 0.5 });

export class AeroAudioMixCoordinator {
  /**
   * @param {{storageFactory?:()=>AudioMixStorage|null|undefined,eventTarget?:AudioMixEventTarget|null}} [options]
   */
  constructor(options = {}) {
    this.storageFactory = options.storageFactory ?? browserStorage;
    this.eventTarget = options.eventTarget === undefined ? browserEventTarget() : options.eventTarget;
    /** @type {AudioMixStorage|null} */
    this.storage = this.acquireStorage();
    /** @type {AeroAudioMixSnapshot} */
    this.current = this.readStoredSnapshot();
    /** @type {Set<(snapshot:AeroAudioMixSnapshot)=>void>} */
    this.subscribers = new Set();
    this.storageListener = (event) => this.handleStorageEvent(event);
    try { this.eventTarget?.addEventListener?.("storage", this.storageListener); } catch { /* persistence synchronization is optional */ }
  }

  /** @returns {AeroAudioMixSnapshot} */
  getSnapshot() { return freezeSnapshot(this.current.musicVolume, this.current.sfxVolume); }

  /** @param {unknown} value @returns {AeroAudioMixSnapshot} */
  setSnapshot(value) {
    const normalized = normalizeAudioMix(value);
    if (!normalized) throw new TypeError("Audio mix must be an exact bounded plain-data record");
    return this.applySnapshot(normalized, true);
  }

  /**
   * Subscribes atomically to the current in-memory truth. The callback receives
   * one immediate snapshot and then changed snapshots until unsubscribe.
   * @param {(snapshot:AeroAudioMixSnapshot)=>void} callback
   * @param {boolean} [emitCurrent]
   */
  subscribe(callback, emitCurrent = true) {
    if (typeof callback !== "function") throw new TypeError("Audio mix subscriber must be a function");
    this.subscribers.add(callback);
    if (emitCurrent) try { callback(this.getSnapshot()); } catch { /* one subscriber cannot break the coordinator */ }
    let active = true;
    return () => { if (!active) return; active = false; this.subscribers.delete(callback); };
  }

  destroy() {
    try { this.eventTarget?.removeEventListener?.("storage", this.storageListener); } catch { /* best-effort listener cleanup */ }
    this.subscribers.clear();
  }

  /** @returns {AudioMixStorage|null} */
  acquireStorage() {
    try {
      const storage = this.storageFactory();
      return storage && typeof storage.getItem === "function" && typeof storage.setItem === "function" ? storage : null;
    } catch { return null; }
  }

  /** @returns {AeroAudioMixSnapshot} */
  readStoredSnapshot() {
    if (!this.storage) return defaultAeroAudioMixSnapshot;
    try {
      const serialized = this.storage.getItem(aeroAudioMixStorageKey);
      if (serialized === null) return defaultAeroAudioMixSnapshot;
      return normalizeSerializedMix(serialized) ?? defaultAeroAudioMixSnapshot;
    } catch { return defaultAeroAudioMixSnapshot; }
  }

  /** @param {AudioMixStorageEvent} event */
  handleStorageEvent(event) {
    if (!event || event.key !== aeroAudioMixStorageKey) return;
    if (event.storageArea != null && this.storage != null && event.storageArea !== this.storage) return;
    const normalized = event.newValue === null ? defaultAeroAudioMixSnapshot : normalizeSerializedMix(event.newValue);
    this.applySnapshot(normalized ?? defaultAeroAudioMixSnapshot, false);
  }

  /** @param {AeroAudioMixSnapshot} snapshot @param {boolean} persist @returns {AeroAudioMixSnapshot} */
  applySnapshot(snapshot, persist) {
    if (sameMix(this.current, snapshot)) return this.getSnapshot();
    this.current = freezeSnapshot(snapshot.musicVolume, snapshot.sfxVolume);
    if (persist && this.storage) {
      try { this.storage.setItem(aeroAudioMixStorageKey, JSON.stringify({ musicVolume: this.current.musicVolume, sfxVolume: this.current.sfxVolume })); } catch { /* in-memory mix remains authoritative */ }
    }
    for (const callback of [...this.subscribers]) {
      try { callback(this.getSnapshot()); } catch { /* isolate subscriber failures */ }
    }
    return this.getSnapshot();
  }
}

/** @param {unknown} value @returns {AeroAudioMixSnapshot|null} */
export function normalizeAudioMix(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || !keys.includes("musicVolume") || !keys.includes("sfxVolume") || keys.some((key) => typeof key !== "string")) return null;
  const musicDescriptor = Object.getOwnPropertyDescriptor(value, "musicVolume");
  const sfxDescriptor = Object.getOwnPropertyDescriptor(value, "sfxVolume");
  if (!isEnumerableDataDescriptor(musicDescriptor) || !isEnumerableDataDescriptor(sfxDescriptor)) return null;
  const musicVolume = musicDescriptor.value;
  const sfxVolume = sfxDescriptor.value;
  if (!isBoundedVolume(musicVolume) || !isBoundedVolume(sfxVolume)) return null;
  return freezeSnapshot(musicVolume, sfxVolume);
}

/** @param {string} serialized @returns {AeroAudioMixSnapshot|null} */
function normalizeSerializedMix(serialized) {
  try { return normalizeAudioMix(JSON.parse(serialized)); } catch { return null; }
}

/** @param {PropertyDescriptor|undefined} descriptor */
function isEnumerableDataDescriptor(descriptor) { return Boolean(descriptor && descriptor.enumerable && "value" in descriptor); }
/** @param {unknown} value */
function isBoundedVolume(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1; }
/** @param {AeroAudioMixSnapshot} left @param {AeroAudioMixSnapshot} right */
function sameMix(left, right) { return left.musicVolume === right.musicVolume && left.sfxVolume === right.sfxVolume; }
/** @param {number} musicVolume @param {number} sfxVolume @returns {AeroAudioMixSnapshot} */
function freezeSnapshot(musicVolume, sfxVolume) { return Object.freeze({ musicVolume, sfxVolume }); }
/** @returns {AudioMixStorage|null|undefined} */
function browserStorage() { return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage; }
/** @returns {AudioMixEventTarget|null} */
function browserEventTarget() { return typeof globalThis.addEventListener === "function" ? globalThis : null; }

export const aeroAudioMixCoordinator = new AeroAudioMixCoordinator();
export const getAudioMixSnapshot = () => aeroAudioMixCoordinator.getSnapshot();
/** @param {unknown} value */
export const setAudioMixSnapshot = (value) => aeroAudioMixCoordinator.setSnapshot(value);
/** @param {(snapshot:AeroAudioMixSnapshot)=>void} callback @param {boolean} [emitCurrent] */
export const subscribeAudioMix = (callback, emitCurrent) => aeroAudioMixCoordinator.subscribe(callback, emitCurrent);
