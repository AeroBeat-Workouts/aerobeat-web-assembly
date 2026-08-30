// @ts-check

const FEEDBACK_DURATION_MS = 350;
const SYNTHETIC_MISS_COMMIT_OFFSET_MS = 181;
const FLOW_DIRECTIONS = Object.freeze(["up", "down", "left", "right", "up-left", "up-right", "down-left", "down-right"]);

/**
 * Project gameplay-owned real judgements or renderer-local visual Test outcomes.
 * Synthetic records never use the public judgement schema and never leave this module.
 *
 * @param {readonly Record<string, unknown>[]} events
 * @param {Record<string, unknown>} gameplay
 * @param {number} nowMs
 */
export function projectSessionTargets(events, gameplay, nowMs) {
  const session = recordValue(gameplay, "session");
  const visualTest = recordValue(session, "purpose") === "visual_test";
  const judgementsValue = recordValue(gameplay, "judgements");
  const judgements = Array.isArray(judgementsValue) ? judgementsValue : [];
  const realJudgements = new Map(judgements.filter((entry) => isRecord(entry) && entry.shadow !== true && (entry.result === "hit" || entry.result === "miss")).map((entry) => [String(entry.eventId), entry]));
  return events.flatMap((event, index) => {
    const eventId = String(recordValue(event, "eventId") ?? "");
    const centerMs = finiteNumber(recordValue(event, "centerTimestampMs"));
    const real = visualTest ? null : realJudgements.get(eventId) ?? null;
    const syntheticCommitMs = visualTest ? centerMs + (index % 2 === 0 ? 0 : SYNTHETIC_MISS_COMMIT_OFFSET_MS) : null;
    const commitMs = real ? finiteNumber(real.committedTimelinePositionMs) : syntheticCommitMs;
    const realResult = real?.result;
    const result = realResult === "hit" || realResult === "miss" ? realResult : visualTest && commitMs !== null && nowMs >= commitMs ? index % 2 === 0 ? "hit" : "miss" : null;
    const feedbackActive = (result === "hit" || result === "miss") && Number.isFinite(commitMs) && nowMs <= Number(commitMs) + FEEDBACK_DURATION_MS;
    const pendingVisible = result !== "hit" && result !== "miss" && centerMs >= nowMs - 500 && centerMs <= nowMs + 2500;
    if (!pendingVisible && !feedbackActive) return [];
    const feedbackProgress = result && Number.isFinite(commitMs) ? clamp01((nowMs - Number(commitMs)) / FEEDBACK_DURATION_MS) : undefined;
    return [renderTarget(event, result === "hit" || result === "miss" ? result : "pending", feedbackProgress)];
  }).slice(0, 128);
}

/** @param {Record<string, unknown>} event @param {"pending"|"hit"|"miss"} judgement @param {number|undefined} feedbackProgress */
function renderTarget(event, judgement = "pending", feedbackProgress) {
  const authoredBeat = recordValue(event, "authoredBeat"); const beat = isRecord(authoredBeat) ? authoredBeat : {}; const type = String(recordValue(beat, "type") ?? "note");
  const eventId = String(recordValue(event, "eventId") ?? ""); const beatCenterMs = finiteNumber(recordValue(event, "centerTimestampMs"));
  const feedback = { judgement, ...(Number.isFinite(feedbackProgress) ? { feedbackProgress: clamp01(Number(feedbackProgress)) } : {}) };
  if (type === "note") return { id: eventId, kind: "flow", hand: recordValue(beat, "hand") === "right" ? "right" : "left", family: "flow", cell: Number.isInteger(recordValue(beat, "placement")) ? Number(recordValue(beat, "placement")) : null, cells: [], lane: null, beatCenterMs, direction: flowDirection(recordValue(beat, "direction")), ...feedback };
  if (type === "guard") { const crossed = recordValue(beat, "modifier") === "crossed_guard"; const guardTarget = recordValue(beat, "guardTarget"); return { id: eventId, kind: "guard", hand: "both", family: crossed ? "crossed_guard" : "guard", cell: null, cells: isRecord(guardTarget) ? [recordValue(guardTarget, "leftCell"), recordValue(guardTarget, "rightCell")].filter(Number.isInteger) : [], lane: null, beatCenterMs, ...feedback }; }
  if (type === "squat" || type.startsWith("weave")) { const blockedCells = recordValue(beat, "blockedCells"); return { id: eventId, kind: "obstacle", hand: "neutral", family: type === "squat" ? "squat" : "weave", cell: null, cells: Array.isArray(blockedCells) ? blockedCells : [], lane: null, beatCenterMs, ...feedback }; }
  const hand = type.endsWith("right") ? "right" : "left"; const family = type.startsWith("hook") ? "hook" : type.startsWith("uppercut") ? "uppercut" : "straight"; const spatialTarget = recordValue(beat, "spatialTarget");
  return { id: eventId, kind: "punch", hand, family, cell: isRecord(spatialTarget) && Number.isInteger(recordValue(spatialTarget, "targetCell")) ? Number(recordValue(spatialTarget, "targetCell")) : null, cells: [], lane: hand, beatCenterMs, direction: isRecord(spatialTarget) ? recordValue(spatialTarget, "entryDirection") ?? null : null, ...feedback };
}

/** @param {unknown} value */
function flowDirection(value) { if (Number.isInteger(value) && Number(value) >= 0 && Number(value) < FLOW_DIRECTIONS.length) return FLOW_DIRECTIONS[Number(value)] ?? null; return typeof value === "string" && FLOW_DIRECTIONS.includes(value) ? value : null; }
/** @param {unknown} value */
function finiteNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
/** @param {unknown} value @param {string} key */
function recordValue(value, key) { return isRecord(value) ? value[key] : undefined; }
/** @param {number} value */
function clamp01(value) { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }
