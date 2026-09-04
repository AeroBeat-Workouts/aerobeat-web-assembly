// @ts-check

import { isFlowObstacleGeometry, isFlowObstacleGridMask } from "@aerobeat/web-contracts/flow-obstacle-contracts";

const FEEDBACK_DURATION_MS = 350;
const SYNTHETIC_MISS_COMMIT_OFFSET_MS = 181;
const FLOW_APPROACH_LEAD_MS = 2500;
const FLOW_DIRECTIONS = Object.freeze(["up", "down", "left", "right", "up-left", "up-right", "down-left", "down-right"]);
const FLOW_OMITTED_TYPES = Object.freeze(new Set(["arc", "burst"]));
const BOXING_PUNCH_TYPES = Object.freeze(new Set(["straight_left", "straight_right", "hook_left", "hook_right", "uppercut_left", "uppercut_right"]));

/**
 * Project gameplay-owned real judgements or renderer-local visual Test outcomes.
 * Synthetic records never use the public judgement schema and never leave this module.
 * Flow obstacles are interval presentation truth and never receive synthetic or real feedback.
 * Valid authored Flow bombs are neutral, non-scoring visuals. Arcs and bursts remain explicitly omitted.
 *
 * @param {readonly Record<string, unknown>[]} events
 * @param {Record<string, unknown>} gameplay
 * @param {number} nowMs
 */
export function projectSessionTargets(events, gameplay, nowMs) {
  const session = recordValue(gameplay, "session");
  const visualTest = recordValue(session, "purpose") === "visual_test";
  const selectedVariant = recordValue(gameplay, "selectedVariant");
  const modifierValue = recordValue(selectedVariant, "modifierIds");
  const modifiers = Array.isArray(modifierValue) ? modifierValue : [];
  const judgementsValue = recordValue(gameplay, "judgements");
  const obstacleOutcomesValue = recordValue(gameplay, "obstacleOutcomes");
  const obstacleOutcomes = new Map((visualTest ? [] : Array.isArray(obstacleOutcomesValue) ? obstacleOutcomesValue : []).filter(isRecord).map((entry) => [String(recordValue(entry, "eventId") ?? ""), entry]));
  const judgements = Array.isArray(judgementsValue) ? judgementsValue : [];
  const realJudgements = new Map(judgements.filter((entry) => isRecord(entry) && entry.shadow !== true && (entry.result === "hit" || entry.result === "miss")).map((entry) => [String(entry.eventId), entry]));
  const orderedEvents = events.map((event, sourceIndex) => ({ event, sourceIndex })).sort((left, right) => { const time = finiteNumber(recordValue(left.event, "centerTimestampMs")) - finiteNumber(recordValue(right.event, "centerTimestampMs")); if (time !== 0) return time; const leftId = String(recordValue(left.event, "eventId") ?? ""), rightId = String(recordValue(right.event, "eventId") ?? ""); return leftId < rightId ? -1 : leftId > rightId ? 1 : left.sourceIndex - right.sourceIndex; });
  const targets = [];
  let feedbackIndex = 0;
  for (const { event } of orderedEvents) {
    const beat = authoredBeatFor(event); const type = String(recordValue(beat, "type") ?? "note");
    if (type === "obstacle") {
      if (modifiers.includes("no_obstacles")) continue;
      const target = flowObstacleTarget(event, beat, nowMs, obstacleOutcomes.get(String(recordValue(event, "eventId") ?? "")) ?? null);
      if (target) targets.push(target);
    } else if (type === "bomb") {
      const target = flowBombTarget(event, beat, nowMs);
      if (target) targets.push(target);
    } else if (FLOW_OMITTED_TYPES.has(type)) {
      // Explicitly omitted: current gameplay and renderer have no truthful arc/burst presentation contract.
    } else if (isRenderableFeedbackType(type)) {
      const eventId = String(recordValue(event, "eventId") ?? "");
      const centerMs = finiteNumber(recordValue(event, "centerTimestampMs"));
      const real = visualTest ? null : realJudgements.get(eventId) ?? null;
      const syntheticCommitMs = visualTest ? centerMs + (feedbackIndex % 2 === 0 ? 0 : SYNTHETIC_MISS_COMMIT_OFFSET_MS) : null;
      const commitMs = real ? finiteNumber(real.committedTimelinePositionMs) : syntheticCommitMs;
      const realResult = real?.result;
      const realCommitted = (realResult === "hit" || realResult === "miss") && commitMs !== null && nowMs >= commitMs;
      const result = realCommitted ? realResult : visualTest && commitMs !== null && nowMs >= commitMs ? feedbackIndex % 2 === 0 ? "hit" : "miss" : null;
      const feedbackActive = (result === "hit" || result === "miss") && Number.isFinite(commitMs) && nowMs <= Number(commitMs) + FEEDBACK_DURATION_MS;
      const pendingVisible = result !== "hit" && result !== "miss" && centerMs >= nowMs - 500 && centerMs <= nowMs + FLOW_APPROACH_LEAD_MS;
      if (pendingVisible || feedbackActive) {
        const feedbackProgress = result && Number.isFinite(commitMs) ? clamp01((nowMs - Number(commitMs)) / FEEDBACK_DURATION_MS) : undefined;
        const target = renderFeedbackTarget(event, type, result === "hit" || result === "miss" ? result : "pending", feedbackProgress);
        if (target) targets.push(target);
      }
      feedbackIndex += 1;
    }
    if (targets.length >= 128) break;
  }
  return targets;
}

/** @param {Record<string, unknown>} event @param {Record<string, unknown>} beat @param {number} nowMs @param {Record<string, unknown>|null} outcome */
function flowObstacleTarget(event, beat, nowMs, outcome) {
  const startMs = optionalFiniteNumber(recordValue(event, "intervalStartTimestampMs"));
  const endMs = optionalFiniteNumber(recordValue(event, "intervalEndTimestampMs"));
  const gridMask = recordValue(beat, "gridMask"); const geometry = recordValue(beat, "geometry");
  if (startMs === null || endMs === null || endMs <= startMs || !isFlowObstacleGeometry(geometry) || !isFlowObstacleGridMask(gridMask, geometry)) return null;
  if (nowMs < startMs - FLOW_APPROACH_LEAD_MS || nowMs > endMs) return null;
  const firstContactMs = outcome?.result === "contact" ? optionalFiniteNumber(recordValue(outcome, "firstContactTimelinePositionMs")) : null;
  const contactPulseProgress = firstContactMs !== null && nowMs >= firstContactMs && nowMs <= firstContactMs + FEEDBACK_DURATION_MS ? clamp01((nowMs - firstContactMs) / FEEDBACK_DURATION_MS) : undefined;
  return { id:String(recordValue(event, "eventId") ?? ""), kind:"obstacle", hand:"neutral", family:"obstacle", cell:null, cells:[...gridMask], geometry, lane:null, beatCenterMs:startMs, intervalStartMs:startMs, intervalEndMs:endMs, ...(contactPulseProgress === undefined ? {} : { contactPulseProgress }) };
}

/** @param {Record<string, unknown>} event @param {Record<string, unknown>} beat @param {number} nowMs */
function flowBombTarget(event, beat, nowMs) {
  const centerMs = optionalFiniteNumber(recordValue(event, "centerTimestampMs"));
  const placement = recordValue(beat, "placement");
  if (centerMs === null || !Number.isInteger(placement) || Number(placement) < 0 || Number(placement) > 11) return null;
  if (nowMs < centerMs - FLOW_APPROACH_LEAD_MS || nowMs > centerMs + 500) return null;
  return { id:String(recordValue(event, "eventId") ?? ""), kind:"bomb", hand:"neutral", family:"bomb", cell:Number(placement), cells:[], lane:null, beatCenterMs:centerMs };
}

/** @param {Record<string, unknown>} event @param {string} type @param {"pending"|"hit"|"miss"} judgement @param {number|undefined} feedbackProgress */
function renderFeedbackTarget(event, type, judgement = "pending", feedbackProgress) {
  const beat = authoredBeatFor(event);
  const eventId = String(recordValue(event, "eventId") ?? ""); const beatCenterMs = finiteNumber(recordValue(event, "centerTimestampMs"));
  const feedback = { judgement, ...(Number.isFinite(feedbackProgress) ? { feedbackProgress: clamp01(Number(feedbackProgress)) } : {}) };
  if (type === "note") return { id: eventId, kind: "flow", hand: recordValue(beat, "hand") === "right" ? "right" : "left", family: "flow", cell: Number.isInteger(recordValue(beat, "placement")) ? Number(recordValue(beat, "placement")) : null, cells: [], lane: null, beatCenterMs, direction: flowDirection(recordValue(beat, "direction")), ...feedback };
  if (type === "guard") { const crossed = recordValue(beat, "modifier") === "crossed_guard"; const guardTarget = recordValue(beat, "guardTarget"); return { id: eventId, kind: "guard", hand: "both", family: crossed ? "crossed_guard" : "guard", cell: null, cells: isRecord(guardTarget) ? [recordValue(guardTarget, "leftCell"), recordValue(guardTarget, "rightCell")].filter(Number.isInteger) : [], lane: null, beatCenterMs, ...feedback }; }
  if (type === "squat" || type.startsWith("weave")) { const blockedCells = recordValue(beat, "blockedCells"); const weaveHand = type === "weave_left" ? "left" : type === "weave_right" ? "right" : null; return { id: eventId, kind: "obstacle", hand: weaveHand ?? "neutral", family: type === "squat" ? "squat" : "weave", cell: null, cells: Array.isArray(blockedCells) ? blockedCells : [], lane: weaveHand, beatCenterMs, ...feedback }; }
  if (!BOXING_PUNCH_TYPES.has(type)) return null;
  const hand = type.endsWith("right") ? "right" : "left"; const family = type.startsWith("hook") ? "hook" : type.startsWith("uppercut") ? "uppercut" : "straight"; const spatialTarget = recordValue(beat, "spatialTarget");
  return { id: eventId, kind: "punch", hand, family, cell: isRecord(spatialTarget) && Number.isInteger(recordValue(spatialTarget, "targetCell")) ? Number(recordValue(spatialTarget, "targetCell")) : null, cells: [], lane: hand, beatCenterMs, direction: isRecord(spatialTarget) ? recordValue(spatialTarget, "entryDirection") ?? null : null, ...feedback };
}

/** @param {string} type */
function isRenderableFeedbackType(type) { return type === "note" || type === "guard" || type === "squat" || type.startsWith("weave") || BOXING_PUNCH_TYPES.has(type); }
/** @param {Record<string, unknown>} event */
function authoredBeatFor(event) { const value = recordValue(event, "authoredBeat"); return isRecord(value) ? value : {}; }
/** @param {unknown} value */
function flowDirection(value) { if (Number.isInteger(value) && Number(value) >= 0 && Number(value) < FLOW_DIRECTIONS.length) return FLOW_DIRECTIONS[Number(value)] ?? null; return typeof value === "string" && FLOW_DIRECTIONS.includes(value) ? value : null; }
/** @param {unknown} value */
function finiteNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
/** @param {unknown} value */
function optionalFiniteNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
/** @param {unknown} value @param {string} key */
function recordValue(value, key) { return isRecord(value) ? value[key] : undefined; }
/** @param {number} value */
function clamp01(value) { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }
