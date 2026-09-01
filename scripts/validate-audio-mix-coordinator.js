// @ts-check

import assert from "node:assert/strict";
import { AeroAudioMixCoordinator, aeroAudioMixStorageKey, defaultAeroAudioMixSnapshot, normalizeAudioMix } from "../src/audio-mix-coordinator.js";

assert.deepEqual(defaultAeroAudioMixSnapshot, { musicVolume: 0.5, sfxVolume: 0.5 });
assert.equal(Object.isFrozen(defaultAeroAudioMixSnapshot), true);
assert.equal(normalizeAudioMix(null), null);
assert.equal(normalizeAudioMix([]), null);
assert.equal(normalizeAudioMix(Object.create({ musicVolume: 0.2, sfxVolume: 0.8 })), null);
assert.equal(normalizeAudioMix(new (class Mix { constructor() { this.musicVolume = 0.2; this.sfxVolume = 0.8; } })()), null);
for (const invalid of [
  { musicVolume: 0.2 },
  { musicVolume: 0.2, sfxVolume: 0.8, extra: true },
  { musicVolume: -0.01, sfxVolume: 0.5 },
  { musicVolume: 1.01, sfxVolume: 0.5 },
  { musicVolume: Number.NaN, sfxVolume: 0.5 },
  { musicVolume: 0.5, sfxVolume: Number.POSITIVE_INFINITY },
  { musicVolume: "0.5", sfxVolume: 0.5 }
]) assert.equal(normalizeAudioMix(invalid), null);

const nullPrototype = Object.assign(Object.create(null), { musicVolume: 0, sfxVolume: 1 });
const normalizedNullPrototype = normalizeAudioMix(nullPrototype);
assert.deepEqual(normalizedNullPrototype, { musicVolume: 0, sfxVolume: 1 });
assert.equal(Object.getPrototypeOf(normalizedNullPrototype), Object.prototype);
assert.equal(Object.isFrozen(normalizedNullPrototype), true);

let getterCalls = 0;
const hostile = Object.create(null, {
  musicVolume: { enumerable: true, get() { getterCalls += 1; return 0.2; } },
  sfxVolume: { enumerable: true, value: 0.8 }
});
assert.equal(normalizeAudioMix(hostile), null);
assert.equal(getterCalls, 0);
const nonEnumerable = Object.create(null, {
  musicVolume: { enumerable: false, value: 0.2 },
  sfxVolume: { enumerable: true, value: 0.8 }
});
assert.equal(normalizeAudioMix(nonEnumerable), null);
const symbolRecord = { musicVolume: 0.2, sfxVolume: 0.8 };
Object.defineProperty(symbolRecord, Symbol("extra"), { enumerable: true, value: true });
assert.equal(normalizeAudioMix(symbolRecord), null);

const storage = createStorage();
const events = createEventTarget();
const coordinator = new AeroAudioMixCoordinator({ storageFactory: () => storage, eventTarget: events });
assert.deepEqual(coordinator.getSnapshot(), { musicVolume: 0.5, sfxVolume: 0.5 });
assert.equal(Object.isFrozen(coordinator.getSnapshot()), true);
assert.equal(events.listenerCount(), 1);

/** @type {Array<readonly [string,number,number]>} */
const notifications = [];
const unsubscribeA = coordinator.subscribe((mix) => notifications.push(["a", mix.musicVolume, mix.sfxVolume]));
const unsubscribeThrowing = coordinator.subscribe(() => { throw new Error("isolated"); });
const unsubscribeB = coordinator.subscribe((mix) => notifications.push(["b", mix.musicVolume, mix.sfxVolume]));
assert.deepEqual(notifications, [["a", 0.5, 0.5], ["b", 0.5, 0.5]]);

const updated = coordinator.setSnapshot({ musicVolume: 0.29, sfxVolume: 0.73 });
assert.deepEqual(updated, { musicVolume: 0.29, sfxVolume: 0.73 });
assert.equal(storage.setCalls.length, 1);
assert.deepEqual(storage.setCalls[0], [aeroAudioMixStorageKey, '{"musicVolume":0.29,"sfxVolume":0.73}']);
assert.deepEqual(JSON.parse(storage.values.get(aeroAudioMixStorageKey) ?? "null"), { musicVolume: 0.29, sfxVolume: 0.73 });
assert.deepEqual(Reflect.ownKeys(JSON.parse(storage.values.get(aeroAudioMixStorageKey) ?? "null")), ["musicVolume", "sfxVolume"]);
assert.deepEqual(notifications.slice(-2), [["a", 0.29, 0.73], ["b", 0.29, 0.73]]);
coordinator.setSnapshot({ musicVolume: 0.29, sfxVolume: 0.73 });
assert.equal(storage.setCalls.length, 1);
assert.equal(notifications.length, 4);

assert.throws(() => coordinator.setSnapshot(hostile), TypeError);
assert.equal(getterCalls, 0);
assert.deepEqual(coordinator.getSnapshot(), { musicVolume: 0.29, sfxVolume: 0.73 });

unsubscribeA(); unsubscribeA(); unsubscribeThrowing();
coordinator.setSnapshot({ musicVolume: 0.31, sfxVolume: 0.69 });
assert.deepEqual(notifications.slice(-1), [["b", 0.31, 0.69]]);
unsubscribeB(); unsubscribeB();

const writesBeforeStorageEvents = storage.setCalls.length;
events.dispatch({ key: "other", newValue: '{"musicVolume":0.1,"sfxVolume":0.9}', storageArea: storage });
assert.deepEqual(coordinator.getSnapshot(), { musicVolume: 0.31, sfxVolume: 0.69 });
events.dispatch({ key: aeroAudioMixStorageKey, newValue: '{"musicVolume":0.4,"sfxVolume":0.6}', storageArea: {} });
assert.deepEqual(coordinator.getSnapshot(), { musicVolume: 0.31, sfxVolume: 0.69 });
events.dispatch({ key: aeroAudioMixStorageKey, newValue: '{"musicVolume":0.4,"sfxVolume":0.6}', storageArea: storage });
assert.deepEqual(coordinator.getSnapshot(), { musicVolume: 0.4, sfxVolume: 0.6 });
events.dispatch({ key: aeroAudioMixStorageKey, newValue: "corrupt", storageArea: storage });
assert.deepEqual(coordinator.getSnapshot(), { musicVolume: 0.5, sfxVolume: 0.5 });
events.dispatch({ key: aeroAudioMixStorageKey, newValue: null, storageArea: storage });
assert.deepEqual(coordinator.getSnapshot(), { musicVolume: 0.5, sfxVolume: 0.5 });
assert.equal(storage.setCalls.length, writesBeforeStorageEvents);
coordinator.destroy();
assert.equal(events.listenerCount(), 0);

const persisted = createStorage([[aeroAudioMixStorageKey, '{"musicVolume":0.12,"sfxVolume":0.88}']]);
const restored = new AeroAudioMixCoordinator({ storageFactory: () => persisted, eventTarget: null });
assert.deepEqual(restored.getSnapshot(), { musicVolume: 0.12, sfxVolume: 0.88 });
restored.destroy();
for (const serialized of ["{", "null", "[]", '{"musicVolume":0.2,"sfxVolume":0.8,"extra":1}', '{"musicVolume":-1,"sfxVolume":0.8}']) {
  const corrupt = createStorage([[aeroAudioMixStorageKey, serialized]]);
  const fallback = new AeroAudioMixCoordinator({ storageFactory: () => corrupt, eventTarget: null });
  assert.deepEqual(fallback.getSnapshot(), { musicVolume: 0.5, sfxVolume: 0.5 });
  fallback.destroy();
}

const readDenied = new AeroAudioMixCoordinator({ storageFactory: () => ({ getItem() { throw new Error("denied"); }, setItem() {} }), eventTarget: null });
assert.deepEqual(readDenied.getSnapshot(), { musicVolume: 0.5, sfxVolume: 0.5 });
readDenied.destroy();
const acquisitionDenied = new AeroAudioMixCoordinator({ storageFactory: () => { throw new Error("denied"); }, eventTarget: null });
assert.deepEqual(acquisitionDenied.getSnapshot(), { musicVolume: 0.5, sfxVolume: 0.5 });
acquisitionDenied.destroy();
let deniedNotifications = 0;
const writeDenied = new AeroAudioMixCoordinator({ storageFactory: () => ({ getItem: () => null, setItem() { throw new Error("denied"); } }), eventTarget: null });
writeDenied.subscribe(() => { deniedNotifications += 1; });
assert.deepEqual(writeDenied.setSnapshot({ musicVolume: 0.22, sfxVolume: 0.78 }), { musicVolume: 0.22, sfxVolume: 0.78 });
assert.equal(deniedNotifications, 2);
writeDenied.destroy();

console.log("Audio mix coordinator validation passed.");

/** @param {readonly (readonly [string,string])[]} [entries] */
function createStorage(entries = []) {
  const values = new Map(entries);
  /** @type {Array<readonly [string,string]>} */ const setCalls = [];
  return { values, setCalls, getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { setCalls.push([key, value]); values.set(key, value); } };
}
function createEventTarget() {
  /** @type {Set<(event:{key?:string|null,newValue?:string|null,storageArea?:unknown})=>void>} */ const listeners = new Set();
  return {
    addEventListener(type, listener) { if (type === "storage") listeners.add(listener); },
    removeEventListener(type, listener) { if (type === "storage") listeners.delete(listener); },
    dispatch(event) { for (const listener of [...listeners]) listener(event); },
    listenerCount() { return listeners.size; }
  };
}
