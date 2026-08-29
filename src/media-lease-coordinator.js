// @ts-check

/** @typedef {{instanceId:string,pauseForLease:()=>void|Promise<void>,activateLease:()=>void|Promise<void>,releaseLease:()=>void|Promise<void>}} AeroGameMediaLeaseParticipant */

/**
 * Process-wide policy coordinator. Browser resources remain owned by per-game
 * audio/video services; transfer only pauses the previous participant.
 */
export class AeroGameMediaLeaseCoordinator {
  constructor() {
    /** @type {Map<string,AeroGameMediaLeaseParticipant>} */
    this.participants = new Map();
    /** @type {AeroGameMediaLeaseParticipant|null} */
    this.owner = null;
    this.generation = 0;
    this.transferring = false;
  }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  register(participant) {
    if (!participant || typeof participant.instanceId !== "string" || participant.instanceId.length === 0 || participant.instanceId.length > 256) throw new TypeError("Lease participant requires a bounded instanceId");
    for (const operation of ["pauseForLease", "activateLease", "releaseLease"]) if (typeof participant[operation] !== "function") throw new TypeError(`Lease participant ${operation} must be a function`);
    this.participants.set(participant.instanceId, participant);
    return () => { void this.unregister(participant); };
  }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  async request(participant) {
    if (this.participants.get(participant.instanceId) !== participant) throw new Error("Lease participant is not registered");
    if (this.owner === participant) return this.snapshot();
    const token = ++this.generation;
    const previous = this.owner;
    this.owner = null; this.transferring = true;
    if (previous) await previous.pauseForLease();
    if (token !== this.generation || this.participants.get(participant.instanceId) !== participant) { this.transferring = false; return this.snapshot(); }
    this.owner = participant;
    try {
      await participant.activateLease();
    } catch (error) {
      if (this.owner === participant) this.owner = null;
      this.transferring = false;
      throw error;
    }
    this.transferring = false;
    return this.snapshot();
  }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  async release(participant) {
    if (this.owner !== participant) return this.snapshot();
    ++this.generation;
    this.owner = null; this.transferring = false;
    await participant.releaseLease();
    return this.snapshot();
  }

  /** @param {AeroGameMediaLeaseParticipant} participant */
  async unregister(participant) {
    if (this.participants.get(participant.instanceId) !== participant) return this.snapshot();
    this.participants.delete(participant.instanceId);
    if (this.owner === participant) await this.release(participant);
    return this.snapshot();
  }

  snapshot() {
    return Object.freeze({ schema: "aerobeat/media_lease_snapshot", version: 1, ownerInstanceId: this.owner?.instanceId ?? null, generation: this.generation, state: this.transferring ? "transferring" : this.owner ? "owned" : "idle", resources: Object.freeze(["camera", "audio"]) });
  }

  getParticipantCount() { return this.participants.size; }
}

/** One coordinator for the browser process, not one per component. */
export const aeroGameMediaLeaseCoordinator = new AeroGameMediaLeaseCoordinator();
