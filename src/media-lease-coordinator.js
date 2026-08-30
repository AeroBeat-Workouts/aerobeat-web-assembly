// @ts-check

/** @typedef {{participantId:string,token:symbol,resources:readonly ("camera"|"audio")[]}} AeroGameLeaseCallbackContext */
/** @typedef {{instanceId:string,pauseForLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>,activateLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>,releaseLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>}} AeroGameMediaLeaseParticipant */
/** @typedef {{source:AeroGameMediaLeaseParticipant,instanceId:string,pauseForLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>,activateLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>,releaseLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>}} RegisteredParticipant */

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
    /** @type {readonly ("camera"|"audio")[]} */ this.ownerResources = Object.freeze([]);
    /** @type {readonly ("camera"|"audio")[]} */ this.candidateResources = Object.freeze([]);
    this.generation = 0;
    this.transferring = false;
    /** @type {RegisteredParticipant|null} */ this.callbackParticipant = null;
    /** @type {AeroGameLeaseCallbackContext|null} */ this.callbackContext = null;
    /** @type {WeakSet<RegisteredParticipant>} */ this.releasedDuringTransfer = new WeakSet();
    /** @type {WeakSet<RegisteredParticipant>} */ this.activatedParticipants = new WeakSet();
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

  /** Preserve the legacy full camera+audio request. @param {AeroGameMediaLeaseParticipant} participant @param {AeroGameLeaseCallbackContext} [callbackContext] */
  async request(participant, callbackContext) { return this.requestResources(participant, Object.freeze(["camera", "audio"]), callbackContext); }

  /** Request an exact bounded resource set for Play or visual Test. @param {AeroGameMediaLeaseParticipant} participant @param {unknown} resourcesValue @param {AeroGameLeaseCallbackContext} [callbackContext] */
  async requestResources(participant, resourcesValue, callbackContext) {
    this.assertNotReentrant(participant, callbackContext); this.requireRegistration(participant);
    const requestedResources = normalizeResources(resourcesValue);
    return this.enqueue(async () => {
      const registered = this.requireRegistration(participant);
      if (this.owner === registered && !this.transferring && sameResources(this.ownerResources, requestedResources)) return this.snapshot();
      const token = ++this.generation; const previous = this.owner ?? this.candidate; const previousResources = this.owner === previous ? this.ownerResources : this.candidateResources; let previousPaused = false; let activationAttempted = false;
      this.owner = null; this.ownerResources = Object.freeze([]); this.candidate = registered; this.candidateResources = requestedResources; this.transferring = true;
      try {
        if (previous) { await this.invoke(previous, previous.pauseForLease, previousResources); previousPaused = true; }
        if (this.participants.get(registered.instanceId) !== registered) {
          const recoverable = previousPaused ? await this.reactivateIfRegistered(previous, previousResources).catch(() => null) : null;
          this.owner = recoverable; this.ownerResources = recoverable ? previousResources : Object.freeze([]); this.candidate = null; this.candidateResources = Object.freeze([]); this.transferring = false; return this.snapshot();
        }
        activationAttempted = true; await this.invoke(registered, registered.activateLease, requestedResources); this.activatedParticipants.add(registered);
        if (this.participants.get(registered.instanceId) !== registered) {
          try { await this.invoke(registered, registered.releaseLease, requestedResources); } catch { /* unregister still completes */ } finally { this.activatedParticipants.delete(registered); this.releasedDuringTransfer.add(registered); }
          const recoverable = previousPaused ? await this.reactivateIfRegistered(previous, previousResources).catch(() => null) : null;
          this.owner = recoverable; this.ownerResources = recoverable ? previousResources : Object.freeze([]); this.candidate = null; this.candidateResources = Object.freeze([]); this.transferring = false; return this.snapshot();
        }
        this.owner = registered; this.ownerResources = requestedResources; this.candidate = null; this.candidateResources = Object.freeze([]); this.transferring = false;
        return this.snapshot();
      } catch (error) {
        if (this.generation === token) {
          if (activationAttempted) { try { await this.invoke(registered, registered.releaseLease, requestedResources); } catch { /* preserve activation failure */ } finally { this.activatedParticipants.delete(registered); if (this.participants.get(registered.instanceId) !== registered) this.releasedDuringTransfer.add(registered); } }
          const recoverable = previousPaused ? await this.reactivateIfRegistered(previous, previousResources).catch(() => null) : previous && this.participants.get(previous.instanceId) === previous ? previous : null;
          this.candidate = null; this.candidateResources = Object.freeze([]); this.transferring = false; this.owner = recoverable; this.ownerResources = recoverable ? previousResources : Object.freeze([]);
        }
        throw error;
      }
    });
  }

  /** @param {AeroGameMediaLeaseParticipant} participant @param {AeroGameLeaseCallbackContext} [callbackContext] */
  async release(participant, callbackContext) {
    this.assertNotReentrant(participant, callbackContext);
    return this.enqueue(async () => {
      const registered = this.registrations.get(participant);
      if (!registered || (this.owner !== registered && this.candidate !== registered)) return this.snapshot();
      const token = ++this.generation; const wasOwner = this.owner === registered; const resources = wasOwner ? this.ownerResources : this.candidateResources;
      this.owner = null; this.ownerResources = Object.freeze([]); this.candidate = registered; this.candidateResources = resources; this.transferring = true;
      try { await this.invoke(registered, registered.releaseLease, resources); }
      catch (error) {
        if (this.generation === token) { this.owner = wasOwner && this.participants.get(registered.instanceId) === registered ? registered : null; this.ownerResources = this.owner ? resources : Object.freeze([]); this.candidate = null; this.candidateResources = Object.freeze([]); this.transferring = false; }
        throw error;
      }
      this.activatedParticipants.delete(registered);
      if (this.generation === token) { this.candidate = null; this.candidateResources = Object.freeze([]); this.transferring = false; }
      return this.snapshot();
    });
  }

  /** @param {AeroGameMediaLeaseParticipant} participant @param {AeroGameLeaseCallbackContext} [callbackContext] */
  async unregister(participant, callbackContext) {
    this.assertNotReentrant(participant, callbackContext);
    const registered = this.registrations.get(participant);
    if (!registered) return this.snapshot();
    this.registrations.delete(participant); this.participants.delete(registered.instanceId);
    return this.enqueue(async () => {
      const token = ++this.generation; const resources = this.owner === registered ? this.ownerResources : this.candidate === registered ? this.candidateResources : Object.freeze([]);
      if (this.owner === registered) { this.owner = null; this.ownerResources = Object.freeze([]); }
      if (!this.candidate || this.candidate === registered) { this.candidate = registered; this.candidateResources = resources; }
      this.transferring = true;
      try { if (this.releasedDuringTransfer.has(registered)) this.releasedDuringTransfer.delete(registered); else if (this.activatedParticipants.has(registered)) await this.invoke(registered, registered.releaseLease, resources); }
      finally { this.activatedParticipants.delete(registered); if (this.generation === token) { if (this.candidate === registered) { this.candidate = null; this.candidateResources = Object.freeze([]); } this.transferring = false; } }
      return this.snapshot();
    });
  }

  snapshot() {
    const resources = this.transferring ? this.candidateResources : this.owner ? this.ownerResources : Object.freeze([]);
    return Object.freeze({ schema: "aerobeat/media_lease_snapshot", version: 1, ownerInstanceId: this.owner?.instanceId ?? null, generation: this.generation, state: this.transferring ? "transferring" : this.owner ? "owned" : "idle", resources });
  }

  getParticipantCount() { return this.participants.size; }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  requireRegistration(participant) {
    const registered = this.registrations.get(participant);
    if (!registered || this.participants.get(registered.instanceId) !== registered) throw new Error("Lease participant is not registered");
    return registered;
  }

  /** @param {RegisteredParticipant|null} participant @param {readonly ("camera"|"audio")[]} resources @returns {Promise<RegisteredParticipant|null>} */
  async reactivateIfRegistered(participant, resources) { if (!participant || this.participants.get(participant.instanceId) !== participant) return null; await this.invoke(participant, participant.activateLease, resources); this.activatedParticipants.add(participant); return this.participants.get(participant.instanceId) === participant ? participant : null; }
  /** @param {AeroGameMediaLeaseParticipant} participant @param {AeroGameLeaseCallbackContext} [callbackContext] */
  assertNotReentrant(_participant, callbackContext) { if (callbackContext && this.callbackContext === callbackContext) throw new Error("Lease participant callbacks cannot reenter the coordinator"); }
  /** @template T @param {()=>Promise<T>} operation @returns {Promise<T>} */
  enqueue(operation) { const queued = this.operationQueue.then(operation, operation); this.operationQueue = queued.catch(() => {}); return queued; }
  /** @param {RegisteredParticipant} participant @param {(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>} callback @param {readonly ("camera"|"audio")[]} resources */
  async invoke(participant, callback, resources) { const context = Object.freeze({ participantId: participant.instanceId, token: Symbol(participant.instanceId), resources }); this.callbackParticipant = participant; this.callbackContext = context; try { await callback(context); } finally { if (this.callbackContext === context) { this.callbackParticipant = null; this.callbackContext = null; } } }
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
/** @param {unknown} value @returns {readonly ("camera"|"audio")[]} */
function normalizeResources(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < 1 || value.length > 2) throw new TypeError("Lease resources must be a bounded array");
  const resources = Array.from({ length: value.length }, (_, index) => { const descriptor = Object.getOwnPropertyDescriptor(value, String(index)); if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypeError("Lease resources must contain data properties"); return descriptor.value; });
  if (resources.some((entry) => entry !== "camera" && entry !== "audio") || new Set(resources).size !== resources.length || !resources.includes("audio")) throw new TypeError("Lease resources are invalid");
  return Object.freeze([...(resources.includes("camera") ? ["camera"] : []), "audio"]);
}
/** @param {readonly string[]} left @param {readonly string[]} right */
function sameResources(left, right) { return left.length === right.length && left.every((entry, index) => entry === right[index]); }

/** One coordinator for the browser process, not one per component. */
export const aeroGameMediaLeaseCoordinator = new AeroGameMediaLeaseCoordinator();
