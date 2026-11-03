// @ts-check
/**
 * Build the A/B judgement-capture payload from live gameplay and content
 * snapshots.
 *
 * This exists to compare two AeroBeat builds on the same song. It records what
 * the game judged, together with enough identity (build version, song, chart,
 * difficulty, run options) to prove both captures came from the same setup.
 *
 * Pure function: no DOM, no download, no session mutation. The caller renders
 * the file. Nothing here reads or writes scoring state.
 */

/** @typedef {Readonly<Record<string, unknown>>} DataRecord */

/**
 * Snapshot fields we copy verbatim. Copying rather than re-deriving means the
 * captured options are the ones the run actually used, not what this module
 * thinks they should have been.
 */
const optionKeys = Object.freeze([
  "colliderRadius",
  "enforceAuthoredDirection",
  "directionToleranceDegrees",
  "timingWindowMs",
  "colliderVisible",
  "colliderScale",
  "colliderDepthForward",
  "colliderDepthBackward",
  "colliderDepthBackwardAthleteFacing",
  "wristBombColliderScale",
  "topRowReachWU",
  "bottomRowReachWU",
  "guardCountMode"
]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {string} key
 */
function field(value, key) {
  return isRecord(value) ? value[key] : undefined;
}

/**
 * Collapse a judgement record to the fields that can explain a hit-rate
 * difference. Diagnostic codes are the important part: they say *why* a note
 * was judged the way it was, which is what separates a timing miss from a
 * direction miss from a near miss.
 * @param {unknown} judgement
 * @returns {DataRecord | null}
 */
function captureJudgement(judgement) {
  if (!isRecord(judgement)) return null;
  const eventId = field(judgement, "eventId");
  if (typeof eventId !== "string" || eventId.length === 0) return null;
  const diagnostics = field(judgement, "diagnostics");
  /** @type {DataRecord} */
  const out = {
    eventId,
    result: field(judgement, "result") ?? null,
    tier: field(judgement, "tier") ?? null
  };
  // Copy the optional numbers only when they are actually numbers, so a null
  // stays visibly null rather than becoming 0 and looking like a real reading.
  for (const key of ["timingOffsetMs", "beatCenterTimestampMs", "committedTimelinePositionMs"]) {
    const value = field(judgement, key);
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  if (Array.isArray(diagnostics)) out.diagnostics = Object.freeze(diagnostics.map(String));
  return Object.freeze(out);
}

/**
 * Read the symmetric settings block the game already exposes for the collider
 * volume, keeping only the option keys above.
 * @param {DataRecord} colliderSettings
 * @returns {DataRecord}
 */
function captureOptions(colliderSettings) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of optionKeys) {
    const value = field(colliderSettings, key);
    if (value !== undefined && (typeof value === "number" || typeof value === "boolean" || typeof value === "string")) out[key] = value;
  }
  return Object.freeze(out);
}

/**
 * Build the capture payload.
 *
 * Every argument may be null or partial. Missing identity becomes `null`
 * rather than being invented, so an incomplete capture is visibly incomplete
 * instead of looking authoritative.
 *
 * @param {{
 *   build?: {version?:unknown, buildStamp?:unknown} | null,
 *   gameplay?: DataRecord | null,
 *   content?: DataRecord | null,
 *   colliderSettings?: DataRecord | null,
 *   capturedAtMs?: number
 * }} input
 * @returns {DataRecord}
 */
export function buildAbJudgementCapture(input) {
  const gameplay = isRecord(input.gameplay) ? input.gameplay : null;
  const content = isRecord(input.content) ? input.content : null;
  const build = isRecord(input.build) ? input.build : null;
  const variant = field(content, "selectedVariant");
  const song = field(content, "song");
  const session = field(gameplay, "session");
  const judgementsIn = field(gameplay, "judgements");
  const judgements = Array.isArray(judgementsIn)
    ? judgementsIn.map(captureJudgement).filter((entry) => entry !== null)
    : [];
  /** @type {Record<string, number>} */
  const byResult = {};
  for (const judgement of judgements) {
    const result = typeof judgement.result === "string" ? judgement.result : "unknown";
    byResult[result] = (byResult[result] ?? 0) + 1;
  }
  const capturedAtMs = typeof input.capturedAtMs === "number" && Number.isFinite(input.capturedAtMs) ? input.capturedAtMs : Date.now();
  return Object.freeze({
    schema: "aerobeat/ab_judgement_capture",
    version: 1,
    capturedAt: new Date(capturedAtMs).toISOString(),
    build: Object.freeze({
      version: typeof field(build, "version") === "string" ? field(build, "version") : null,
      buildStamp: typeof field(build, "buildStamp") === "string" ? field(build, "buildStamp") : null
    }),
    song: Object.freeze({
      name: field(song, "songName") ?? field(song, "name") ?? null,
      id: field(content, "packageId") ?? field(song, "id") ?? null,
      difficulty: field(variant, "difficulty") ?? null,
      characteristic: field(variant, "characteristic") ?? null,
      chartId: field(gameplay, "chartId") ?? field(variant, "chartId") ?? null,
      rulesetId: field(gameplay, "rulesetId") ?? field(variant, "rulesetId") ?? null,
      variantId: field(variant, "variantId") ?? null
    }),
    run: Object.freeze({
      purpose: field(session, "purpose") ?? null,
      state: field(session, "state") ?? null,
      ranked: field(session, "ranked") ?? null,
      sessionId: field(session, "sessionId") ?? null
    }),
    options: captureOptions(isRecord(input.colliderSettings) ? input.colliderSettings : Object.freeze({})),
    summary: Object.freeze({
      totalJudgements: judgements.length,
      byResult: Object.freeze(byResult)
    }),
    judgements: Object.freeze(judgements)
  });
}

/**
 * A capture is ready when a run has finished and produced judgements. A
 * mid-song export would be indistinguishable from a complete one, which is
 * exactly the mistake this guard prevents.
 * @param {DataRecord | null} gameplay
 * @returns {{ready:boolean, count:number, reason:string}}
 */
export function abCaptureReadiness(gameplay) {
  const session = field(gameplay, "session");
  const state = field(session, "state");
  const judgements = field(gameplay, "judgements");
  const count = Array.isArray(judgements) ? judgements.length : 0;
  if (count === 0) return { ready: false, count: 0, reason: "no judgements yet" };
  if (state !== "completed") return { ready: false, count, reason: `run is ${String(state)}` };
  return { ready: true, count, reason: "ready" };
}

/**
 * File name that identifies the run without opening the file.
 * @param {DataRecord} capture
 * @param {string} extension
 */
export function abCaptureFilename(capture, extension) {
  const build = field(capture, "build");
  const song = field(capture, "song");
  const safe = (value, fallback) => {
    const text = typeof value === "string" ? value.trim() : "";
    // Drop traversal segments entirely. Replacing characters alone would leave
    // ".." intact and let a crafted id walk out of the download directory.
    const cleaned = text
      .split(/[/\\]+/u)
      .filter((segment) => segment !== ".." && segment !== ".")
      .join("-")
      .replace(/[^A-Za-z0-9._-]+/gu, "-")
      .replace(/\.{2,}/gu, "-")
      .replace(/^[.-]+|[.-]+$/gu, "")
      .slice(0, 48);
    return cleaned.length > 0 ? cleaned : fallback;
  };
  const version = safe(field(build, "version"), "unknown-version");
  const id = safe(field(song, "id"), "unknown-song");
  const difficulty = safe(field(song, "difficulty"), "unknown-difficulty");
  return `aerobeat-ab-${version}-${id}-${difficulty}.${extension}`;
}