// @ts-check

import assert from "node:assert/strict";
import { scoringClockMinimumDurationSeconds } from "../src/scoring-clock-minimum.js";

const variant = (variantId, rulesetId) => ({ variantId, chartId: `${variantId}-chart`, rulesetId });
const event = (selected, id, time, type, checkpoint) => ({ eventId: id, variantId: selected.variantId, chartId: selected.chartId, centerTimestampMs: time, authoredBeat: { type }, ...(checkpoint === undefined ? {} : { checkpoint }) });
const flow = variant("flow", "flow_colliders_v1");
const boxing = variant("boxing", "boxing_collider_v1");
const settings = { timingWindowMs: 180, colliderDepthBackward: 3 };
const events = [event(flow, "short-tail-note", 950, "note"), event(flow, "late-bomb", 3000, "bomb"), event(boxing, "boxing-punch", 1200, "hook_left"), event(boxing, "boxing-guard", 1800, "guard", { timingWindowMs: 500 })];
assert.equal(scoringClockMinimumDurationSeconds(events, flow, settings), 2.35, "last scored Flow note clears at +1000ms then receives 400ms feedback (not later bombs or mixed chart)");
assert.equal(scoringClockMinimumDurationSeconds(events, boxing, settings), 2.7, "Boxing guard checkpoint may outrun punch deadline");
assert.equal(scoringClockMinimumDurationSeconds([event(boxing, "punch", 1200, "straight_left")], boxing, settings), 2.6);
assert.equal(scoringClockMinimumDurationSeconds([event(flow, "late", 950, "note")], flow, { timingWindowMs: 300, colliderDepthBackward: 4 }), 2.55, "configured +1200ms deadline wins over +1000ms clearance");
assert.equal(scoringClockMinimumDurationSeconds([event(boxing, "other", 1400, "hook_left")], flow, settings), undefined, "unselected charts cannot create an artificial extension");
console.log("scoring clock minimum: selected short-tail Flow, Boxing, mixed variants, later configured deadline PASS");
