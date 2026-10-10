// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoringClockMinimumDurationSeconds } from "../src/scoring-clock-minimum.js";
import { defaultAeroGameSetupSnapshot } from "../src/game-setup-coordinator.js";
import { gameplayFlowColliderSettings, gameplayBoxingColliderSettings } from "../src/gameplay-visual-runtime.js";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const method = (name, next) => {
  const position = source.indexOf(`  ${name}(`) >= 0 ? source.indexOf(`  ${name}(`) : source.indexOf(`  async ${name}(`);
  const end = source.indexOf(`\n  ${next}(`, position) >= 0 ? source.indexOf(`\n  ${next}(`, position) : source.indexOf(`\n  async ${next}(`, position);
  assert(position >= 0 && end > position, `${name} production method found`);
  return source.slice(position, end);
};
const methods = new Function("gameplayRulesetIds", "gameplayFlowColliderSettings", "gameplayBoxingColliderSettings", "scoringClockMinimumDurationSeconds", "conversionRecipeIds", `return ({${method("selectedScoringClockMinimum", "extendSelectedScoringClock")},${method("extendSelectedScoringClock", "configureGameplayFromContent")},${method("performSelectVariant", "selectGameplayAxes")}})`)(
  { flow: "flow_colliders_v1", boxingCollider: "boxing_collider_v1" }, gameplayFlowColliderSettings, gameplayBoxingColliderSettings, scoringClockMinimumDurationSeconds, []
);
const flow = { variantId: "flow", chartId: "flow-chart", rulesetId: "flow_colliders_v1" };
const boxing = { variantId: "boxing", chartId: "boxing-chart", rulesetId: "boxing_collider_v1" };
const note = (variant, time, type) => ({ variantId: variant.variantId, chartId: variant.chartId, centerTimestampMs: time, authoredBeat: { type } });
let selected = flow;
let events = [note(flow, 500, "note")];
let state = "playing";
let positionSeconds = 0;
let durationSeconds = 1.9;
let loads = 0;
let extensions = 0;
let configurations = 0;
const graph = {
  content: {
    getSnapshot: () => ({ state: "ready", packageId: "song", selectedVariant: selected, resolvedEvents: events }),
    async selectVariant(id) { selected = id === "boxing" ? boxing : flow; events = [note(selected, selected === boxing ? 1500 : 500, selected === boxing ? "hook_left" : "note")]; }
  },
  gameplay: { getSnapshot: () => ({ session: { state, packageId: "song" } }) },
  audio: {
    getSource: () => ({ id: "song:audio" }),
    getStatus: () => ({ state: positionSeconds >= durationSeconds ? "stopped" : "playing", positionSeconds, durationSeconds }),
    ensureMinimumDurationSeconds(seconds) {
      if (positionSeconds >= durationSeconds) throw new Error("naturally ended clock cannot extend");
      extensions++;
      durationSeconds = Math.max(durationSeconds, seconds);
    }
  }
};
const game = {
  ...methods, graph, desiredGameSetup: defaultAeroGameSetupSnapshot, activeSessionSetup: defaultAeroGameSetupSnapshot, sessionStartRequested: true,
  isLifecycleIntentOwner: () => true, syncContentPlayback() {}, configureGameplayFromContent() { this.extendSelectedScoringClock(); configurations++; },
  async loadSelectedAudio() { loads++; durationSeconds = this.selectedScoringClockMinimum(graph.content.getSnapshot(), this.desiredGameSetup); positionSeconds = 0; },
  lastError: null, publish() {}, getSnapshot: () => ({}), recoverFailedContentConfiguration() { throw new Error("variant selection must not recover from a scoring-tail error"); }
};
const owner = { graph };
await game.performSelectVariant("boxing", [], owner);
assert.equal(loads, 0, "active variant switch never reloads music");
assert.equal(extensions, 1, "active variant switch extends the current audio clock");
assert.equal(durationSeconds, 2.9);
positionSeconds = durationSeconds;
state = "completed";
await game.performSelectVariant("flow", [], owner);
assert.equal(loads, 0, "terminal selection with sufficient duration needs no reload");
await game.performSelectVariant("boxing", [], owner);
assert.equal(loads, 0, "same deadline after completion never attempts invalid extension");
// A genuinely later-ending variant requires a new encoded load after natural end.
graph.content.selectVariant = async (id) => { selected = id === "boxing" ? boxing : flow; events = [note(selected, 3100, selected === boxing ? "hook_left" : "note")]; };
await game.performSelectVariant("boxing", [], owner);
assert.equal(loads, 1, "completed selection reloads music before attempting to extend its ended clock");
assert.equal(durationSeconds, 4.5);
assert.equal(configurations, 4);
// Authoring setup change before a new run extends the decoded song in place.
const longerSetup = { ...defaultAeroGameSetupSnapshot, timingWindowMs: 300, boxingColliderVolume: { ...defaultAeroGameSetupSnapshot.boxingColliderVolume, colliderDepthBackward: 4 } };
game.extendSelectedScoringClock(longerSetup);
assert.equal(loads, 1);
assert.equal(durationSeconds, 4.7);
console.log("scoring clock lifecycle: active switch extends, completed later variant reloads, setup extends PASS");
