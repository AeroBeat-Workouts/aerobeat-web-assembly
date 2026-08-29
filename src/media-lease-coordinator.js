// @ts-check

/** @typedef {{instanceId:string,pauseForLease:()=>void|Promise<void>,activateLease:()=>void|Promise<void>,releaseLease:()=>void|Promise<void>}} AeroGameMediaLeaseParticipant */
/** @typedef {{source:AeroGameMediaLeaseParticipant,instanceId:string,pauseForLease:()=>void|Promise<void>,activateLease:()=>void|Promise<void>,releaseLease:()=>void|Promise<void>}} RegisteredParticipant */

/**
 * Process-wide policy coordinator. Browser resources remain owned by per-game
 * audio/video services; transfer only pauses the previous participant.
 */
export class AeroGameMediaLeaseCoordinator {
  constructor() {
    /** @type {Map<string,RegisteredParticipant>} */ this.participants = new Map();
    /** @type {WeakMap<object,RegisteredParticipant>} */ this.registrations = new WeakMap();
    /** @type {RegisteredParticipant|null} */ this.owner = null;
    /** @type {RegisteredParticipant|null} */ this.candidate = null;
    this.generation = 0;
    this.transferring = false;
    /** @type {RegisteredParticipant|null} */ this.callbackParticipant = null;
    /** @type {WeakSet<RegisteredParticipant>} */ this.releasedDuringTransfer = new WeakSet();
    /** @type {Promise<unknown>} */ this.operationQueue = Promise.resolve();
  }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  register(participant) {
    const registered = normalizeParticipant(participant);
    if (this.participants.has(registered.instanceId) || this.registrations.has(participant)) throw new Error(`Lease participant ID is already registered: ${registered.instanceId}`);
    this.participants.set(registered.instanceId, registered);
    this.registrations.set(participant, registered);
    let active = true;
    return () => { if (!active) return; active = false; void this.unregister(participant).catch(() => {}); };
  }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  async request(participant) {
    this.assertNotReentrant(participant); this.requireRegistration(participant);
    return this.enqueue(async () => {
      const registered = this.requireRegistration(participant);
      if (this.owner === registered && !this.transferring) return this.snapshot();
      const token = ++this.generation; const previous = this.owner ?? this.candidate; let previousPaused = false;
      this.owner = null; this.candidate = registered; this.transferring = true;
      try {
        if (previous && previous !== registered) { await this.invoke(previous, previous.pauseForLease); previousPaused = true; }
        if (this.participants.get(registered.instanceId) !== registered) {
          const recoverable = previous && this.participants.get(previous.instanceId) === previous ? previous : null;
          if (previousPaused && recoverable) await this.invoke(recoverable, recoverable.activateLease);
          this.owner = recoverable; this.candidate = null; this.transferring = false; return this.snapshot();
        }
        await this.invoke(registered, registered.activateLease);
        if (this.participants.get(registered.instanceId) !== registered) {
          try { await this.invoke(registered, registered.releaseLease); } catch { /* unregister still completes */ } finally { this.releasedDuringTransfer.add(registered); }
          const recoverable = previous && this.participants.get(previous.instanceId) === previous ? previous : null;
          if (previousPaused && recoverable) await this.invoke(recoverable, recoverable.activateLease).catch(() => {});
          this.owner = recoverable; this.candidate = null; this.transferring = false; return this.snapshot();
        }
        this.owner = registered; this.candidate = null; this.transferring = false;
        return this.snapshot();
      } catch (error) {
        if (this.generation === token) {
          const recoverable = previous && this.participants.get(previous.instanceId) === previous ? previous : null;
          if (previousPaused && recoverable) await this.invoke(recoverable, recoverable.activateLease).catch(() => {});
          this.candidate = null; this.transferring = false; this.owner = recoverable;
        }
        throw error;
      }
    });
  }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  async release(participant) {
    this.assertNotReentrant(participant);
    return this.enqueue(async () => {
      const registered = this.registrations.get(participant);
      if (!registered || (this.owner !== registered && this.candidate !== registered)) return this.snapshot();
      const token = ++this.generation;
      this.owner = null; this.candidate = registered; this.transferring = true;
      try { await this.invoke(registered, registered.releaseLease); }
      finally { if (this.generation === token) { this.candidate = null; this.transferring = false; } }
      return this.snapshot();
    });
  }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  async unregister(participant) {
    const registered = this.registrations.get(participant);
    if (!registered) return this.snapshot();
    this.registrations.delete(participant); this.participants.delete(registered.instanceId);
    return this.enqueue(async () => {
      const token = ++this.generation;
      if (this.owner === registered) this.owner = null;
      if (!this.candidate || this.candidate === registered) this.candidate = registered;
      this.transferring = true;
      try { if (this.releasedDuringTransfer.has(registered)) this.releasedDuringTransfer.delete(registered); else await this.invoke(registered, registered.releaseLease); }
      finally { if (this.generation === token) { if (this.candidate === registered) this.candidate = null; this.transferring = false; } }
      return this.snapshot();
    });
  }

  snapshot() {
    return Object.freeze({ schema: "aerobeat/media_lease_snapshot", version: 1, ownerInstanceId: this.owner?.instanceId ?? null, generation: this.generation, state: this.transferring ? "transferring" : this.owner ? "owned" : "idle", resources: Object.freeze(["camera", "audio"]) });
  }

  getParticipantCount() { return this.participants.size; }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  requireRegistration(participant) {
    const registered = this.registrations.get(participant);
    if (!registered || this.participants.get(registered.instanceId) !== registered) throw new Error("Lease participant is not registered");
    return registered;
  }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  assertNotReentrant(participant) { if (this.callbackParticipant?.source === participant) throw new Error("Lease participant callbacks cannot reenter the coordinator"); }
  /** @template T @param {()=>Promise<T>} operation @returns {Promise<T>} */
  enqueue(operation) { const queued = this.operationQueue.then(operation, operation); this.operationQueue = queued.catch(() => {}); return queued; }
  /** @param {RegisteredParticipant} participant @param {()=>void|Promise<void>} callback */
  async invoke(participant, callback) { this.callbackParticipant = participant; try { await callback(); } finally { if (this.callbackParticipant === participant) this.callbackParticipant = null; } }
}

/** @param {AeroGameMediaLeaseParticipant} participant @returns {RegisteredParticipant} */
function normalizeParticipant(participant) {
  if (!participant || typeof participant !== "object" || Object.getPrototypeOf(participant) !== Object.prototype) throw new TypeError("Lease participant must be a plain record");
  const instanceId = dataProperty(participant, "instanceId");
  if (typeof instanceId !== "string" || instanceId.length === 0 || instanceId.length > 256) throw new TypeError("Lease participant requires a bounded instanceId");
  const pauseForLease = dataProperty(participant, "pauseForLease");
  const activateLease = dataProperty(participant, "activateLease");
  const releaseLease = dataProperty(participant, "releaseLease");
  if (typeof pauseForLease !== "function" || typeof activateLease !== "function" || typeof releaseLease !== "function") throw new TypeError("Lease participant operations must be own enumerable functions");
  return Object.freeze({ source: participant, instanceId, pauseForLease, activateLease, releaseLease });
}

/** @param {object} value @param {string} key */
function dataProperty(value, key) { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && descriptor.enumerable && "value" in descriptor ? descriptor.value : undefined; }

/** One coordinator for the browser process, not one per component. */
export const aeroGameMediaLeaseCoordinator = new AeroGameMediaLeaseCoordinator();
