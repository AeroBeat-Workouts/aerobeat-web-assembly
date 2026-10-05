// @ts-check
// Reproduction for Derrick's 0.0.85 report: FINISH a song in Flow, switch the
// gameplay variant to Boxing, then press Play/Test. He saw
// "Resolved events must belong to the selected variant and chart" and could not
// change mode. This drives the exact assembly methods against the REAL strict
// gameplay coordinator, with the content mock modelling the real content
// runtime: `selectVariant` re-stamps resolvedEvents from the newly selected
// variant (content-runtime `timelineFor`), while `swapFutureVariant` keeps the
// already-judged/past events beside the new ones.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAeroGameplaySessionCoordinator, defaultFlowColliderSettings } from "@aerobeat/web-gameplay";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
function method(name, nextName) {
  const start = source.indexOf(`  ${name}(`);
  const asyncStart = source.indexOf(`  async ${name}(`);
  const position = start < 0 ? asyncStart : asyncStart < 0 ? start : Math.min(start, asyncStart);
  const end = Math.max(...[source.indexOf(`\n  ${nextName}(`, position), source.indexOf(`\n  async ${nextName}(`, position)].filter((value) => value > position));
  assert(position >= 0 && end > position, `Assembly method ${name} missing`);
  return source.slice(position, end);
}
const configure = method("configureGameplayFromContent", "gameplayContentPurpose");
const selectVariant = method("performSelectVariant", "selectGameplayAxes");
const selectContent = source.slice(source.indexOf("  async performSelectContent("), source.indexOf("\n  async selectVariant(", source.indexOf("  async performSelectContent(")));
const recover = method("recoverFailedContentConfiguration", "gameplayContentPurpose");
const methods = new Function(
  "gameplayRulesetIds",
  "gameplayFlowColliderSettings",
  "gameplayBoxingColliderSettings",
  "VISUAL_TEST_CONTENT_OPTIONS",
  "conversionRecipeIds",
  `return ({${configure},${selectVariant},${selectContent.replace(/\n  async recoverFailedContentConfiguration\(/u, ",\n  async recoverFailedContentConfiguration(")}})`
)(
  { flow: "flow_colliders_v1", boxingCollider: "boxing_collider_v1" },
  () => defaultFlowColliderSettings,
  () => ({}),
  { purpose: "visual_test" },
  []
);

const hash = "a".repeat(64);
const flowVariant = { variantId: "song-flow", chartId: "song-chart", mode: "flow", rulesetId: "flow_colliders_v1", recipeId: null, modifierIds: [], ranked: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash } };
const boxingVariant = { variantId: "song-boxing", chartId: "song-chart", mode: "boxing", rulesetId: "boxing_collider_v1", recipeId: null, modifierIds: [], ranked: true, mapHash: flowVariant.mapHash, scoreIdentityHash: flowVariant.scoreIdentityHash };
/** Stamped exactly like the real content runtime: events carry the SELECTED variant. */
const stamped = (variant) => {
  const boxing = variant.rulesetId === "boxing_collider_v1";
  const authored = boxing
    ? { eventId: `${variant.variantId}-note`, type: "hook_left", hand: "left", placement: 2, requiresDirection: true, direction: "right", spatialTarget: { targetCell: 2 } }
    : { eventId: `${variant.variantId}-note`, type: "note", hand: "left", placement: 0, requiresDirection: false };
  return [{ schema: "aerobeat/resolved_content_event", version: 3, eventId: `${variant.variantId}-note`, variantId: variant.variantId, chartId: variant.chartId, centerTimestampMs: 1000, authoredBeat: authored }];
};

let selected = flowVariant;
let resolved = stamped(flowVariant);
const content = {
  state: "ready", packageId: "song",
  getSnapshot: () => ({ state: "ready", packageId: "song", selectedVariant: selected, resolvedEvents: resolved }),
  async selectVariant(variantId) { selected = variantId === "song-boxing" ? boxingVariant : flowVariant; resolved = stamped(selected); },
  async swapFutureVariant(variantId) {
    // The real future swap keeps judged/past events from the OLD variant and
    // publishes the new ones beside them: an intentionally mixed snapshot.
    const next = variantId === "song-boxing" ? boxingVariant : flowVariant;
    selected = next; resolved = [...stamped(flowVariant), ...stamped(next)];
  }
};


// --- real play-session plumbing: calibration countdown then tracked evidence ---
const anchor = (name, measured, sx, sy) => ({ schema: "aerobeat/body_grid_anchor_snapshot", version: 1, anchor: name, calibrationId: "cal-1", measurementTimestampMs: measured, valid: true, confidence: 1, rawX: 0.5, rawY: 0.5, x: (sx + 0.5) / 4, y: (2.5 - sy) / 3, cell: 5, subcell: 20 });
const evidence = (frameId, measured) => ({
  schema: "aerobeat/gameplay_evidence_snapshot", version: 1, calibrationId: "cal-1",
  measuredSourceFrameId: frameId, measurementTimestampMs: measured, provenance: "measured",
  activeBoxingActions: [],
  anchors: [anchor("nose", measured, 3, 2), anchor("left_shoulder", measured, 0, 0), anchor("right_shoulder", measured, 3, 0), anchor("left_elbow", measured, 0, 0), anchor("right_elbow", measured, 3, 0), anchor("left_wrist", measured, -0.4, 1), anchor("right_wrist", measured, 3.4, 1)],
  entries: []
});
const cameraInput = (measured, latest) => ({
  sourceIdentity: "camera-a",
  calibration: { calibrationId: "cal-1", readiness: "countdown" },
  tracking: { gameplayPaused: false, freshCalibrationRequired: false },
  countdownFrozen: false, latestEvidence: latest, straightQualifications: []
});
const songClock = (positionMs, playing, durationSec = 2) => ({
  contextTimeSeconds: positionMs / 1000, positionSeconds: positionMs / 1000,
  durationSeconds: durationSec, progress: durationSec === 0 ? 0 : Math.min(1, positionMs / 1000 / durationSec), playing
});
/** Drive calibration countdown to "playing" the way the real input pipeline does. */
function startPlaying(session) {
  session.advance({ timestampMs: 0, clock: songClock(0, false), input: cameraInput(0, null) });
  session.requestStart(0, { schema: "aerobeat/gameplay_session_start", version: 1, purpose: "play" });
  let step = 0;
  while (step < 200 && session.getSnapshot().session.state !== "playing") {
    step += 1;
    session.advance({ timestampMs: step, clock: songClock(0, false), input: cameraInput(step, evidence(`f${step}`, step)) });
  }
  assert.equal(session.getSnapshot().session.state, "playing", `setup: run must reach playing (stuck in ${session.getSnapshot().session.state})`);
}

const gameplay = createAeroGameplaySessionCoordinator({ sessionId: "mode-switch-oracle", countdownStepMs: 1 });
const trace = [];
const originalConfigure = gameplay.configureContent;
const gameplayGraph = {
  getSnapshot: () => gameplay.getSnapshot(),
  configureContent(configuration, options) {
    trace.push({ selectedVariant: configuration.selectedVariant, resolvedEvents: configuration.resolvedEvents, options });
    return originalConfigure({ packageId: configuration.packageId, selectedVariant: configuration.selectedVariant, resolvedEvents: configuration.resolvedEvents, ...(configuration.flowColliderSettings === undefined ? {} : { flowColliderSettings: configuration.flowColliderSettings }) }, options);
  },
  stop: gameplay.stop
};
const graph = { content, gameplay: gameplayGraph, audio: { pause: async () => {} }, cv: { stop: async () => {} }, profiles: { getActive: () => ({}) } };
const assembly = {
  graph, desiredGameSetup: {}, activeSessionSetup: null, sessionStartRequested: false, activeSessionAction: "", sessionGeneration: 0, menuTransitionGeneration: 0, menuOpen: true, menuDisposition: "none", lifecycle: "connected", lastError: null,
  gameplayContentPurpose() { return this.sessionStartRequested && this.activeSessionAction === "test" ? "visual_test" : "play"; },
  stopFrameLoop() {}, applyGameSetup() {}, isLifecycleIntentOwner() { return true; },
  syncContentPlayback() {}, publish() {}, getSnapshot() { return gameplay.getSnapshot(); },
  handleError(error) { this.lastError = { code: error.code ?? "assembly_error", message: error.message }; },
  ...methods
};
const owner = { graph };

// 1. Play the Flow song to completion.
assembly.configureGameplayFromContent(false, "play");
assembly.sessionStartRequested = true; assembly.activeSessionAction = "play";
startPlaying(gameplay);
gameplay.advance({ timestampMs: 400, clock: songClock(2000, false) });
assert.equal(gameplay.getSnapshot().session.state, "completed", "setup: Flow run must reach completed");

// 2. Switch to Boxing at the completed boundary.
await assembly.performSelectVariant("song-boxing", [], owner);
assert.equal(content.getSnapshot().selectedVariant.variantId, "song-boxing", "content committed the Boxing variant");

// 3. Press Play on the new mode.
assembly.sessionStartRequested = true; assembly.activeSessionAction = "play";
let failure = null;
try { assembly.configureGameplayFromContent(false, "play"); } catch (error) { failure = error; }
assert.equal(failure, null, `Play after finishing in Flow and switching to Boxing must not hard-lock (got ${failure?.code ?? ""})`);
assert.notEqual(assembly.lastError?.code, "event_variant_mismatch");

// 4. Same sequence again on the Test path, on a FRESH coordinator (a spent
// coordinator rejects a rolled-back timestamp, which is not the bug under test).
const gameplay2 = createAeroGameplaySessionCoordinator({ sessionId: "mode-switch-oracle-2", countdownStepMs: 1 });
const trace2 = [];
const originalConfigure2 = gameplay2.configureContent;
graph.gameplay = {
  getSnapshot: () => gameplay2.getSnapshot(),
  configureContent(configuration, options) {
    trace2.push({ selectedVariant: configuration.selectedVariant, resolvedEvents: configuration.resolvedEvents, options });
    return originalConfigure2({ packageId: configuration.packageId, selectedVariant: configuration.selectedVariant, resolvedEvents: configuration.resolvedEvents, ...(configuration.flowColliderSettings === undefined ? {} : { flowColliderSettings: configuration.flowColliderSettings }) }, options);
  },
  stop: gameplay2.stop
};
selected = flowVariant; resolved = stamped(flowVariant);
assembly.configureGameplayFromContent(false, "visual_test");
gameplay2.requestStart(0, { schema: "aerobeat/gameplay_session_start", version: 1, purpose: "visual_test" });
gameplay2.advance({ timestampMs: 400, clock: songClock(2000, false) });
assert.equal(gameplay2.getSnapshot().session.state, "completed");
await assembly.performSelectVariant("song-boxing", [], owner);
assembly.sessionStartRequested = true; assembly.activeSessionAction = "test";
failure = null;
try { assembly.configureGameplayFromContent(false, "visual_test"); } catch (error) { failure = error; }
assert.equal(failure, null, `Test after finishing in Flow and switching to Boxing must not hard-lock (got ${failure?.code ?? ""})`);

// 5. THE LIKELY TRIGGER: the song finished but the pause menu is open, so the
// session is paused_manual with sessionStartRequested set. That is exactly when
// performSelectVariant takes the future-only path (content.swapFutureVariant),
// which deliberately publishes a MIXED snapshot of old-variant and new-variant
// events. configureGameplayFromContent must filter that mixed set down to the
// newly selected variant before gameplay's strict validator sees it.
const gameplay3 = createAeroGameplaySessionCoordinator({ sessionId: "mode-switch-oracle-3", countdownStepMs: 1 });
const trace3 = [];
const originalConfigure3 = gameplay3.configureContent;
graph.gameplay = {
  getSnapshot: () => gameplay3.getSnapshot(),
  configureContent(configuration, options) {
    trace3.push({ selectedVariant: configuration.selectedVariant, resolvedEvents: configuration.resolvedEvents, options });
    return originalConfigure3({ packageId: configuration.packageId, selectedVariant: configuration.selectedVariant, resolvedEvents: configuration.resolvedEvents, ...(configuration.flowColliderSettings === undefined ? {} : { flowColliderSettings: configuration.flowColliderSettings }) }, options);
  },
  stop: gameplay3.stop
};
selected = flowVariant; resolved = stamped(flowVariant);
assembly.configureGameplayFromContent(false, "play");
assembly.sessionStartRequested = true; assembly.activeSessionAction = "play";
startPlaying(gameplay3);
gameplay3.pause(500, "menu");
assert.equal(gameplay3.getSnapshot().session.state, "paused_manual", "setup: pause menu holds the run");
await assembly.performSelectVariant("song-boxing", [], owner);
assembly.sessionStartRequested = true; assembly.activeSessionAction = "play";
let pausedFailure = null;
try { assembly.configureGameplayFromContent(false, "play"); } catch (error) { pausedFailure = error; }
assert.equal(pausedFailure, null, `Paused Flow -> Boxing switch -> Play must not hard-lock (got ${pausedFailure?.code ?? ""})`);
assert(trace3.at(-1).resolvedEvents.length > 0, "the filtered configuration must still carry the new variant's events");
assert(trace3.at(-1).resolvedEvents.every((entry) => entry.variantId === "song-boxing"), "only the newly selected variant's events may reach the strict validator");

// 6. THE PLAYING-STATE GAP: the run is actively playing (content playbackState
// is "running"), so selectVariant would throw variant_swap_running and the
// content snapshot would never re-stamp for the new ruleset. The fix stops the
// run cleanly first, then selects the variant so resolvedEvents carry the new
// mode's events. Assert that after the switch the content snapshot and the
// gameplay configuration both carry the NEW variant's events.
const gameplay4 = createAeroGameplaySessionCoordinator({ sessionId: "mode-switch-oracle-4", countdownStepMs: 1 });
const trace4 = [];
const originalConfigure4 = gameplay4.configureContent;
graph.gameplay = {
  getSnapshot: () => gameplay4.getSnapshot(),
  configureContent(configuration, options) {
    trace4.push({ selectedVariant: configuration.selectedVariant, resolvedEvents: configuration.resolvedEvents, options });
    return originalConfigure4({ packageId: configuration.packageId, selectedVariant: configuration.selectedVariant, resolvedEvents: configuration.resolvedEvents, ...(configuration.flowColliderSettings === undefined ? {} : { flowColliderSettings: configuration.flowColliderSettings }) }, options);
  },
  stop: gameplay4.stop
};
selected = flowVariant; resolved = stamped(flowVariant);
assembly.sessionStartRequested = false; assembly.activeSessionAction = "";
assembly.menuDisposition = "terminal"; assembly.menuOpen = true;
assembly.configureGameplayFromContent(false, "play");
assembly.sessionStartRequested = true; assembly.activeSessionAction = "play";
startPlaying(gameplay4);
assert.equal(gameplay4.getSnapshot().session.state, "playing", "setup: run must be actively playing");

// Switch modes while the run is playing.
let playingSwitchError = null;
try { await assembly.performSelectVariant("song-boxing", [], owner); } catch (error) { playingSwitchError = error; }
assert.equal(playingSwitchError, null, `Mode switch while playing must not throw (got ${playingSwitchError?.code ?? ""}: ${playingSwitchError?.message ?? ""})`);

// The content snapshot must now carry the NEW variant's events.
const snapAfterSwitch = content.getSnapshot();
assert.equal(snapAfterSwitch.selectedVariant.variantId, "song-boxing", "content committed the Boxing variant after mid-play switch");
assert(snapAfterSwitch.resolvedEvents.every((entry) => entry.variantId === "song-boxing"), "content resolvedEvents must all belong to the new Boxing variant, not the old Flow variant");

// The run must be stopped (no longer playing) so a fresh start is possible.
assert.notEqual(gameplay4.getSnapshot().session.state, "playing", "the run must be stopped after the mid-play mode switch");

// The last configuration pushed to gameplay must carry only the new variant's events.
const lastConfig = trace4.at(-1);
assert(lastConfig, "a configureContent call must have been made after the mid-play switch");
assert.equal(lastConfig.selectedVariant.variantId, "song-boxing", "gameplay must be bound to the Boxing variant");
assert(lastConfig.resolvedEvents.length > 0, "the gameplay configuration must carry the new variant's events");
assert(lastConfig.resolvedEvents.every((entry) => entry.variantId === "song-boxing"), "gameplay events must all belong to the new Boxing variant");

console.log("Completed, paused, and playing Flow -> Boxing switch all configure without event_variant_mismatch.");
gameplay.destroy();