// @ts-check
// Focused source-method oracle: run the exact assembly content selection/configure
// methods against the real strict gameplay coordinator without Vite release pins.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAeroGameplaySessionCoordinator, defaultFlowColliderSettings } from "@aerobeat/web-gameplay";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
function method(name, nextName) {
  const start = source.indexOf(`  ${name}(`);
  const asyncStart = source.indexOf(`  async ${name}(`);
  const position = start < 0 ? asyncStart : asyncStart < 0 ? start : Math.min(start, asyncStart);
  const end = source.indexOf(`\n  ${nextName}(`, position);
  assert(position >= 0 && end > position, `Assembly method ${name} missing`);
  return source.slice(position, end);
}
// Preserve exact method bodies rather than hand-mirroring implementation logic.
const configure = method("configureGameplayFromContent", "gameplayContentPurpose");
const select = source.slice(source.indexOf("  async performSelectContent("), source.indexOf("\n  async selectVariant(", source.indexOf("  async performSelectContent(")));
assert.match(select, /recoverFailedContentConfiguration/u);
const methods = new Function("gameplayRulesetIds", "gameplayFlowColliderSettings", "gameplayBoxingColliderSettings", "VISUAL_TEST_CONTENT_OPTIONS", `return ({${configure},${select.replace(/\n  async recoverFailedContentConfiguration\(/u, ",\n  async recoverFailedContentConfiguration(")}})`)(
  { flow: "flow_colliders_v1", boxingCollider: "boxing_collider_v1" }, () => defaultFlowColliderSettings, () => ({}), { purpose: "visual_test" }
);
const hash = "a".repeat(64);
const variant = (song) => ({ variantId: `${song}-flow`, chartId: `${song}-chart`, mode: "flow", rulesetId: "flow_colliders_v1", recipeId: null, modifierIds: [], ranked: true, mapHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash }, scoreIdentityHash: { schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: hash } });
const event = (song) => ({ schema: "aerobeat/resolved_content_event", version: 3, eventId: `${song}-note`, variantId: `${song}-flow`, chartId: `${song}-chart`, centerTimestampMs: 1000, authoredBeat: { eventId: `${song}-note`, type: "note", hand: "left", placement: 0, requiresDirection: false } });
const ready = (song) => ({ state: "ready", packageId: song, selectedVariant: variant(song), resolvedEvents: [event(song)] });
const gameplay = createAeroGameplaySessionCoordinator({ sessionId: "song-swap-oracle" });
let content = ready("song-a");
const trace = [];
const originalConfigure = gameplay.configureContent;
const gameplayGraph = { getSnapshot: () => gameplay.getSnapshot(), configureContent(configuration, options) { trace.push({ packageId: configuration.packageId, selectedVariant: configuration.selectedVariant, resolvedEvents: configuration.resolvedEvents, options }); return originalConfigure({ packageId: configuration.packageId, selectedVariant: configuration.selectedVariant, resolvedEvents: configuration.resolvedEvents, ...(configuration.flowColliderSettings === undefined ? {} : { flowColliderSettings: configuration.flowColliderSettings }) }, options); }, stop: gameplay.stop };
const graph = { gameplay: gameplayGraph, content: { getSnapshot: () => content, async loadPersistenceHandle(handle) { content = ready(handle.packageId); } }, authoring: { async loadPackage(handle) { return { handle, package: {} }; } }, audio: { async pause() {} }, cv: { async stop() {} }, profiles: { getActive: () => ({}) } };
const assembly = Object.assign(methods, {
  graph, desiredGameSetup: {}, activeSessionSetup: null, sessionStartRequested: false, activeSessionAction: "", sessionGeneration: 0, menuTransitionGeneration: 0, menuOpen: true, menuDisposition: "none", lifecycle: "connected", lastError: null,
  gameplayContentPurpose() { return this.sessionStartRequested && this.activeSessionAction === "test" ? "visual_test" : "play"; },
  stopFrameLoop() { this.stoppedLoops = (this.stoppedLoops ?? 0) + 1; },
  applyGameSetup() {}, isLifecycleIntentOwner() { return true; },
  contentLoadOptions() { return {}; }, async loadSelectedAudio() {}, synchronizeConverterProvenance() {},
  syncContentPlayback() {}, publish() {}, getSnapshot() { return gameplay.getSnapshot(); },
  handleError(error) { this.lastError = { code: error.code ?? "assembly_error", message: error.message }; }
});
const owner = { graph };
const selectSong = (song) => assembly.performSelectContent({ kind: "persistence", handle: { packageId: song } }, owner);

try {
  // A running Visual Test must be retired at the B selection boundary.
  assembly.configureGameplayFromContent(false, "visual_test");
  gameplay.requestStart(0, { schema: "aerobeat/gameplay_session_start", version: 1, purpose: "visual_test" });
  assert.equal(gameplay.getSnapshot().session.state, "playing");
  assembly.sessionStartRequested = true; assembly.activeSessionAction = "test";
  await selectSong("song-b");
  assert.equal(gameplay.getSnapshot().session.packageId, "song-b");
  assert.equal(gameplay.getSnapshot().session.state, "calibrating", "song B must not preserve song A's live Test state");
  assert.equal(assembly.sessionStartRequested, false);
  assert.equal(assembly.activeSessionAction, "");
  assert.equal(assembly.menuOpen, true);
  assert.equal(trace.at(-1).resolvedEvents.length, 1);
  assert(trace.at(-1).resolvedEvents.every((entry) => entry.variantId === "song-b-flow" && entry.chartId === "song-b-chart"));
  // Press Test B; its fresh configuration binds only B events.
  assembly.configureGameplayFromContent(false, "visual_test", true);
  gameplay.requestStart(performance.now(), { schema: "aerobeat/gameplay_session_start", version: 1, purpose: "visual_test" });
  assert.equal(gameplay.getSnapshot().session.state, "playing");
  await selectSong("song-a");
  assert.equal(gameplay.getSnapshot().session.packageId, "song-a");
  assert.equal(gameplay.getSnapshot().session.state, "calibrating");
  assert(trace.at(-1).resolvedEvents.every((entry) => entry.variantId === "song-a-flow"));
  // Start/Play also binds the selected song instead of the previous Test mode.
  assembly.configureGameplayFromContent(false, "play", true);
  assert.equal(gameplay.getSnapshot().session.purpose, "play");
  assert.equal(gameplay.getSnapshot().session.packageId, "song-a");
  // Force a strict validation failure after B's content commits; retry with a
  // clean selected B snapshot without a page refresh or gameplay check change.
  const selected = graph.content;
  graph.content = { ...selected, async loadPersistenceHandle(handle) { content = { ...ready(handle.packageId), resolvedEvents: [event("song-a")] }; } };
  await assert.rejects(selectSong("song-b"), (error) => error.code === "event_variant_mismatch");
  assert.equal(assembly.lastError?.code, "event_variant_mismatch");
  assert.equal(assembly.menuOpen, true);
  assert.equal(assembly.sessionStartRequested, false);
  graph.content = selected;
  content = ready("song-b");
  // The next Test can configure already-selected B even before a reselection.
  assembly.configureGameplayFromContent(false, "visual_test", true);
  await selectSong("song-b");
  assembly.configureGameplayFromContent(false, "visual_test", true);
  assert.equal(gameplay.getSnapshot().session.packageId, "song-b");
  assert(trace.at(-1).resolvedEvents.every((entry) => entry.variantId === "song-b-flow"));
  console.log("Song A→B→A Test/Play, strict B-only events, configuration failure and retry passed.");
} finally { gameplay.destroy(); }
