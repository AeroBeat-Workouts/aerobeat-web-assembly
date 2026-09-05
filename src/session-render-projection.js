// @ts-check

import { isObstacleGameplayGeometry, isObstacleGridMask, isObstacleSourceGeometry } from "@aerobeat/web-contracts/obstacle-contracts";

const FEEDBACK_DURATION_MS = 350;
const SYNTHETIC_MISS_COMMIT_OFFSET_MS = 181;
const FLOW_APPROACH_LEAD_MS = 2500;
const FLOW_DIRECTIONS = Object.freeze(["up", "down", "left", "right", "up-left", "up-right", "down-left", "down-right"]);
const FLOW_OMITTED_TYPES = Object.freeze(new Set(["arc", "burst"]));
const BOXING_PUNCH_TYPES = Object.freeze(new Set(["straight_left", "straight_right", "hook_left", "hook_right", "uppercut_left", "uppercut_right"]));
const INDEXED_FEEDBACK_LOOKBACK_MS = FEEDBACK_DURATION_MS + SYNTHETIC_MISS_COMMIT_OFFSET_MS;
const sessionTargetIndexIdentity = Symbol("aerobeat.sessionTargetIndex");

/**
 * Pre-sort immutable resolved events and build a point-query interval tree once per content identity.
 * The index stays inside the assembly service graph and is never placed in snapshots or events.
 * @param {readonly Record<string, unknown>[]} events
 */
export function createSessionTargetIndex(events) {
  if (!Array.isArray(events)) throw new TypeError("Resolved events must be an array");
  let feedbackIndex = 0;
  const orderedEntries = events.map((event, sourceIndex) => ({ event, sourceIndex })).sort(compareEventEntries).map((entry, orderedIndex) => {
    const type = String(recordValue(authoredBeatFor(entry.event), "type") ?? "note");
    const indexed = Object.freeze({ ...entry, orderedIndex, centerTimestampMs:finiteNumber(recordValue(entry.event, "centerTimestampMs")), feedbackIndex:isRenderableFeedbackType(type) ? feedbackIndex++ : -1 });
    return indexed;
  });
  const intervals = [];
  const eventIndices = new Map();
  for (const entry of orderedEntries) {
    const eventId = String(recordValue(entry.event, "eventId") ?? "");
    const positions = eventIndices.get(eventId) ?? [];
    positions.push(entry.orderedIndex); eventIndices.set(eventId, positions);
    const type = String(recordValue(authoredBeatFor(entry.event), "type") ?? "note");
    if (type !== "obstacle" && type !== "squat" && type !== "weave_left" && type !== "weave_right") continue;
    const startMs = optionalFiniteNumber(recordValue(entry.event, "intervalStartTimestampMs"));
    const endMs = optionalFiniteNumber(recordValue(entry.event, "intervalEndTimestampMs"));
    if (startMs !== null && endMs !== null && endMs > startMs) intervals.push(Object.freeze({ start:startMs-FLOW_APPROACH_LEAD_MS, end:endMs, orderedIndex:entry.orderedIndex }));
  }
  return Object.freeze({ [sessionTargetIndexIdentity]:true, events, orderedEntries:Object.freeze(orderedEntries), eventIndices, intervalTree:buildIntervalTree(intervals) });
}

/**
 * Project gameplay-owned real judgements or renderer-local visual Test outcomes.
 * Synthetic records never use the public judgement schema and never leave this module.
 * Flow obstacles are interval presentation truth and never receive synthetic or real feedback.
 * Valid authored Flow bombs are neutral, non-scoring visuals. Arcs and bursts remain explicitly omitted.
 *
 * @param {readonly Record<string, unknown>[]} events
 * @param {Record<string, unknown>} gameplay
 * @param {number} nowMs
 * @param {ReturnType<typeof createSessionTargetIndex>} [index]
 */
export function projectSessionTargets(events, gameplay, nowMs, index) {
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
  const orderedEntries = validSessionTargetIndex(index, events) ? indexedCandidateEntries(index, nowMs, realJudgements) : createOrderedEntries(events);
  const targets = [];
  let fallbackFeedbackIndex = 0;
  for (const entry of orderedEntries) {
    const { event } = entry;
    const feedbackIndex = Number.isInteger(entry.feedbackIndex) && entry.feedbackIndex >= 0 ? entry.feedbackIndex : fallbackFeedbackIndex;
    const beat = authoredBeatFor(event); const type = String(recordValue(beat, "type") ?? "note");
    if (type === "obstacle") {
      if (modifiers.includes("no_obstacles")) continue;
      const target = flowObstacleTarget(event, beat, nowMs, obstacleOutcomes.get(String(recordValue(event, "eventId") ?? "")) ?? null);
      if (target) targets.push(target);
    } else if (type === "squat" || type === "weave_left" || type === "weave_right") {
      const target = boxingObstacleTarget(event, beat, type, nowMs);
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
      fallbackFeedbackIndex += 1;
    }
    if (targets.length >= 128) break;
  }
  return targets;
}

/** @param {readonly Record<string, unknown>[]} events */
function createOrderedEntries(events) { return events.map((event, sourceIndex) => ({ event, sourceIndex })).sort(compareEventEntries); }
/** @param {{event:Record<string,unknown>,sourceIndex:number}} left @param {{event:Record<string,unknown>,sourceIndex:number}} right */
function compareEventEntries(left, right) { const time=finiteNumber(recordValue(left.event,"centerTimestampMs"))-finiteNumber(recordValue(right.event,"centerTimestampMs"));if(time!==0)return time;const leftId=String(recordValue(left.event,"eventId")??""),rightId=String(recordValue(right.event,"eventId")??"");return leftId<rightId?-1:leftId>rightId?1:left.sourceIndex-right.sourceIndex; }
/** @param {unknown} candidate @param {readonly Record<string, unknown>[]} events */
function validSessionTargetIndex(candidate,events){return isRecord(candidate)&&candidate[sessionTargetIndexIdentity]===true&&candidate.events===events&&Array.isArray(candidate.orderedEntries)&&candidate.eventIndices instanceof Map;}
/** @param {ReturnType<typeof createSessionTargetIndex>} index @param {number} nowMs @param {Map<string,Record<string,unknown>>} realJudgements */
function indexedCandidateEntries(index,nowMs,realJudgements){const entries=index.orderedEntries,positions=new Set(),start=lowerBound(entries,nowMs-INDEXED_FEEDBACK_LOOKBACK_MS),end=upperBound(entries,nowMs+FLOW_APPROACH_LEAD_MS);for(let position=start;position<end;position+=1)positions.add(position);queryIntervalTree(index.intervalTree,nowMs,positions);for(const [eventId,judgement] of realJudgements){const commitMs=optionalFiniteNumber(recordValue(judgement,"committedTimelinePositionMs"));if(commitMs===null||nowMs<commitMs||nowMs>commitMs+FEEDBACK_DURATION_MS)continue;for(const position of index.eventIndices.get(eventId)??[])positions.add(position);}return [...positions].sort((left,right)=>left-right).map(position=>entries[position]);}
/** @param {readonly {centerTimestampMs:number}[]} entries @param {number} value */
function lowerBound(entries,value){let low=0,high=entries.length;while(low<high){const middle=(low+high)>>>1;if(entries[middle].centerTimestampMs<value)low=middle+1;else high=middle;}return low;}
/** @param {readonly {centerTimestampMs:number}[]} entries @param {number} value */
function upperBound(entries,value){let low=0,high=entries.length;while(low<high){const middle=(low+high)>>>1;if(entries[middle].centerTimestampMs<=value)low=middle+1;else high=middle;}return low;}
/** @param {readonly {start:number,end:number,orderedIndex:number}[]} intervals */
function buildIntervalTree(intervals){if(intervals.length===0)return null;const centers=intervals.map(interval=>(interval.start+interval.end)/2).sort((left,right)=>left-right),center=centers[centers.length>>>1],left=[],right=[],overlap=[];for(const interval of intervals){if(interval.end<center)left.push(interval);else if(interval.start>center)right.push(interval);else overlap.push(interval);}return Object.freeze({center,byStart:Object.freeze([...overlap].sort((a,b)=>a.start-b.start)),byEnd:Object.freeze([...overlap].sort((a,b)=>b.end-a.end)),left:buildIntervalTree(left),right:buildIntervalTree(right)});}
/** @param {ReturnType<typeof buildIntervalTree>} tree @param {number} point @param {Set<number>} positions */
function queryIntervalTree(tree,point,positions){if(!tree)return;if(point<tree.center){for(const interval of tree.byStart){if(interval.start>point)break;if(interval.end>=point)positions.add(interval.orderedIndex);}queryIntervalTree(tree.left,point,positions);return;}if(point>tree.center){for(const interval of tree.byEnd){if(interval.end<point)break;if(interval.start<=point)positions.add(interval.orderedIndex);}queryIntervalTree(tree.right,point,positions);return;}for(const interval of tree.byStart)positions.add(interval.orderedIndex);}

/** @param {Record<string, unknown>} event @param {Record<string, unknown>} beat @param {number} nowMs @param {Record<string, unknown>|null} outcome */
function flowObstacleTarget(event, beat, nowMs, outcome) {
  const startMs = optionalFiniteNumber(recordValue(event, "intervalStartTimestampMs"));
  const endMs = optionalFiniteNumber(recordValue(event, "intervalEndTimestampMs"));
  const gridMask = recordValue(beat, "gridMask"); const sourceGeometry = recordValue(beat, "sourceGeometry"); const gameplayGeometry = recordValue(beat, "gameplayGeometry");
  if (startMs === null || endMs === null || endMs <= startMs || !isObstacleSourceGeometry(sourceGeometry) || !isObstacleGameplayGeometry(gameplayGeometry) || !isObstacleGridMask(gridMask, gameplayGeometry)) return null;
  if (nowMs < startMs - FLOW_APPROACH_LEAD_MS || nowMs > endMs) return null;
  const firstContactMs = outcome?.result === "contact" ? optionalFiniteNumber(recordValue(outcome, "firstContactTimelinePositionMs")) : null;
  const contactPulseProgress = firstContactMs !== null && nowMs >= firstContactMs && nowMs <= firstContactMs + FEEDBACK_DURATION_MS ? clamp01((nowMs - firstContactMs) / FEEDBACK_DURATION_MS) : undefined;
  return { id:String(recordValue(event, "eventId") ?? ""), kind:"obstacle", hand:"neutral", family:"obstacle", cell:null, cells:[...gridMask], sourceGeometry, gameplayGeometry, lane:null, beatCenterMs:startMs, intervalStartMs:startMs, intervalEndMs:endMs, ...(contactPulseProgress === undefined ? {} : { contactPulseProgress }) };
}

/** @param {Record<string, unknown>} event @param {Record<string, unknown>} beat @param {string} type @param {number} nowMs */
function boxingObstacleTarget(event, beat, type, nowMs) {
  const startMs = optionalFiniteNumber(recordValue(event, "intervalStartTimestampMs"));
  const endMs = optionalFiniteNumber(recordValue(event, "intervalEndTimestampMs"));
  const gridMask = recordValue(beat, "gridMask"); const blockedCells = recordValue(beat, "blockedCells"); const sourceGeometry = recordValue(beat, "sourceGeometry"); const gameplayGeometry = recordValue(beat, "gameplayGeometry");
  if (startMs === null || endMs === null || endMs <= startMs || !isObstacleSourceGeometry(sourceGeometry) || !isObstacleGameplayGeometry(gameplayGeometry) || !isObstacleGridMask(gridMask, gameplayGeometry) || !sameCells(blockedCells, gridMask)) return null;
  if (nowMs < startMs - FLOW_APPROACH_LEAD_MS || nowMs > endMs) return null;
  const weaveHand = type === "weave_left" ? "left" : type === "weave_right" ? "right" : null;
  return { id:String(recordValue(event, "eventId") ?? ""), kind:"obstacle", hand:weaveHand ?? "neutral", family:type === "squat" ? "squat" : "weave", cell:null, cells:[...gridMask], sourceGeometry, gameplayGeometry, lane:weaveHand, beatCenterMs:startMs, intervalStartMs:startMs, intervalEndMs:endMs };
}

/** @param {unknown} left @param {unknown} right */
function sameCells(left, right) { return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((cell, index) => Number.isInteger(cell) && cell === right[index]); }

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
  if (!BOXING_PUNCH_TYPES.has(type)) return null;
  const hand = type.endsWith("right") ? "right" : "left"; const family = type.startsWith("hook") ? "hook" : type.startsWith("uppercut") ? "uppercut" : "straight"; const spatialTarget = recordValue(beat, "spatialTarget");
  return { id: eventId, kind: "punch", hand, family, cell: isRecord(spatialTarget) && Number.isInteger(recordValue(spatialTarget, "targetCell")) ? Number(recordValue(spatialTarget, "targetCell")) : null, cells: [], lane: hand, beatCenterMs, direction: isRecord(spatialTarget) ? recordValue(spatialTarget, "entryDirection") ?? null : null, ...feedback };
}

/** @param {string} type */
function isRenderableFeedbackType(type) { return type === "note" || type === "guard" || BOXING_PUNCH_TYPES.has(type); }
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
