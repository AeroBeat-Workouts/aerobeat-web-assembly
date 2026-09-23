// @ts-check
// 0.0.64 P1: source-contract oracle for the grouped, live equipment controls.
// The high-fidelity behavior (real controls, explicit render, preview records,
// responsive direct/iframe geometry, Reset, Export and privacy) is exercised by
// validate-equipment-config-panel-browser.js and validate-product-shell-matrix.js.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEquipmentConfigYaml, serializeEquipmentConfigYaml, validateEquipmentConfig } from "../src/equipment-config.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/index.js"), "utf8");

const expectedStaticPaths = Object.freeze([
  "flow.perHand.left.scale", "flow.perHand.right.scale", "flow.saber.ease.type",
  "flow.saber.ease.durationMs", "flow.saber.blendRadius", "boxing.perHand.left.scale",
  "boxing.perHand.right.scale", "boxing.glove.ease.type", "boxing.glove.ease.durationMs",
  "boxing.glove.upcomingBeatWindowMs"
]);

// Raw-YAML editing and its staged Apply path must be removed, not hidden.
for (const legacy of ["setEquipmentConfigYaml(", "validateEquipmentConfigDraft(", "equipmentConfigTextarea(", "equipment-config-apply", "Equipment YAML", "Apply config"]) {
  assert.equal(source.includes(legacy), false, `legacy equipment authoring path must be absent: ${legacy}`);
}
assert.equal(/<textarea\b[^>]*data-equipment-config-field/iu.test(source), false, "equipment authoring must not contain a textarea");

// The grouped native controls generate independent XYZ controls for every base,
// Flow zone-local, and Boxing state rotation, alongside each zone heading.
for (const path of expectedStaticPaths) assert.equal(source.split(`path:"${path}"`).length - 1, 1, `one static control descriptor required for ${path}`);
for (const token of [
  'xyzControls("flow.perHand.left.rotationEulerDeg"', 'xyzControls("flow.perHand.right.rotationEulerDeg"',
  'path:`flow.saber.zones.${zone}.headingDeg`', 'xyzControls(`flow.saber.zones.${zone}.localRotationEulerDeg`',
  'xyzControls("boxing.perHand.left.rotationEulerDeg"', 'xyzControls("boxing.perHand.right.rotationEulerDeg"',
  'xyzControls(`boxing.glove.states.${state}.rotationEulerDeg`'
]) assert(source.includes(token), `missing generated XYZ/heading controls: ${token}`);
for (const group of ["Flow · hand transforms", "Flow · saber zones", "Boxing · hand transforms", "Boxing · glove states"]) assert(source.includes(`label:"${group}"`), `missing group ${group}`);

// Accepted control edits validate atomically, reset easing trackers so the
// edited orientation is visible immediately, refresh controls, and explicitly
// render even when the display loop is stopped.
const commitStart = source.indexOf("\n  async commitEquipmentConfig(");
const applyStart = source.indexOf("\n  applyEquipmentConfigControl(");
const resetStart = source.indexOf("\n  resetEquipmentConfig(");
const exportStart = source.indexOf("\n  exportEquipmentConfig(");
const controlsStart = source.indexOf("\n  renderEquipmentConfigControls(");
assert(commitStart > 0 && applyStart > commitStart && resetStart > applyStart && exportStart > resetStart && controlsStart > exportStart, "live equipment methods must exist in canonical order");
const commitBody=source.slice(commitStart,applyStart),applyBody = source.slice(applyStart, resetStart);
assert(applyBody.includes("equipmentConfigCandidate(this.equipmentConfig, path, value)"), "field edit must validate a complete candidate");
assert(commitBody.includes("await this.equipmentIdentityFor(candidate)")&&commitBody.includes("this.equipmentConfig = candidate; this.equipmentConfigIdentity = identity"),"config and strict SHA-256 identity commit atomically after the async boundary");
assert(commitBody.includes("this.gloveRotationTracker.reset()") && commitBody.includes("this.saberDirectionTracker.reset()"), "field edit must reset live orientation easing");
assert(commitBody.includes('await this.startSession("visual_test"')&&commitBody.includes("this.renderEquipmentConfigControls()") && commitBody.includes("this.renderGameplay()"), "field edit restarts scoring and refreshes the rendered frame");

const resetBody = source.slice(resetStart, exportStart);
assert(resetBody.includes("validateEquipmentConfig(equipmentConfigDefaults)"), "Reset must restore validated build defaults");
assert(resetBody.includes('this.commitEquipmentConfig(validateEquipmentConfig(equipmentConfigDefaults), "Reset to build defaults.")'), "Reset must use the same atomic identity/restart path");

const exportBody = source.slice(exportStart, controlsStart);
assert(exportBody.includes("serializeEquipmentConfigYaml(this.equipmentConfig)"), "Export must serialize live validated state, not draft text");
assert(exportBody.includes("aerobeat-equipment-config.yaml") && exportBody.includes("text/yaml"), "Export filename and MIME must remain deterministic");
assert(exportBody.includes("event?.isTrusted") && exportBody.includes("URL.revokeObjectURL"), "Export remains trusted-local and revokes its URL");

const controlsBody = source.slice(controlsStart, source.indexOf("\n}\n\nfunction environmentAssetOptions", controlsStart));
assert(controlsBody.includes("[data-equipment-config-field]"), "control renderer must synchronize grouped fields");
assert(controlsBody.includes("[data-equipment-preview-toggle='true']"), "control renderer must synchronize default-off preview toggle");
assert(controlsBody.includes("control.disabled = !enabled"), "controls must remain Test-authoring gated");

// Preview evidence is renderer-only and the public shell must not publish it.
assert(source.includes("testEquipmentInput(this.testEquipmentMouseHand, this.testEquipmentPointerPosition)"), "private per-frame deterministic Test preview evidence required");
assert(source.includes("visualTest && !this.testEquipmentVisible"), "Test preview must default/gate off");
assert(source.includes("this.testAutomaticFeedbackEnabled = true") && source.includes("this.testEquipmentMouseHand = \"off\"") && source.includes("this.testEquipmentPointerPosition = null"), "private authoring defaults must be explicit");
assert(source.includes("projectSessionTargets(events, gameplay, nowMs, this.renderEventIndex, timingWindowMs, this.testAutomaticFeedbackEnabled)"), "one private feedback flag must gate target projection");
assert(source.includes("aftermathSaberWristHistory, this.testAutomaticFeedbackEnabled)"), "the same private feedback flag must gate aftermath projection");
assert(source.includes("this.canvasElement().addEventListener(\"pointermove\", this.boundTestEquipmentPointerMove)"), "direct canvas pointermove ownership required");
assert(source.includes("event.pointerType !== \"mouse\"") && source.includes("this.graph?.renderer.projectDebugEquipmentAnchor(event.clientX, event.clientY)") && source.includes("point === null || !Object.isFrozen(point)"), "pointer handling must use the renderer camera projection seam and latch only a frozen non-null result");
assert.equal(source.includes("normalizedTestEquipmentPointer"), false, "obsolete whole-canvas normalization path must be removed");
const pointerBody = source.slice(source.indexOf("\n  handleTestEquipmentPointerMove("), source.indexOf("\n  setTestEquipmentVisible(", source.indexOf("\n  handleTestEquipmentPointerMove(")));
assert.equal(pointerBody.includes("pointerleave"), false, "pointer movement handler must not clear latched position on leave");
assert(source.includes("setDebugCameraAuthoringInputEnabled(hand === \"off\")"), "hand selection must own renderer camera input gate");
assert(source.includes("const cameraControlEnabled = snapshot.enabled && this.testEquipmentMouseHand === \"off\""), "camera-specific controls must disable while a hand is selected");
const resetAuthoringStart = source.indexOf("\n  resetTestEquipmentAuthoringState(");
const resetAuthoringEnd = source.indexOf("\n  setTestAutomaticFeedbackEnabled(", resetAuthoringStart);
const resetAuthoringBody = source.slice(resetAuthoringStart, resetAuthoringEnd);
assert(resetAuthoringBody.includes("this.testAutomaticFeedbackEnabled = true") && resetAuthoringBody.includes("this.testEquipmentMouseHand = \"off\"") && resetAuthoringBody.includes("this.testEquipmentPointerPosition = null") && resetAuthoringBody.includes("setDebugCameraAuthoringInputEnabled(true)"), "one reset helper must restore every private default and camera ownership");
assert(source.includes("if (action === \"test\") { this.testEquipmentVisible = false; this.resetTestEquipmentAuthoringState({ render:false }); }") && source.includes("if (document.hidden) { this.resetTestEquipmentAuthoringState({ render:false });") && (source.match(/this\.resetTestEquipmentAuthoringState\(\{ render:false \}\);/gu) ?? []).length >= 5, "fresh Test, hidden, terminal, stop/reset, and teardown boundaries must reset private authoring state");
for (const token of ["Automatic GREAT/MISS feedback", "Mouse-controlled hand", "data-equipment-mouse-hand=\"off\"", "data-equipment-mouse-hand=\"left\"", "data-equipment-mouse-hand=\"right\""]) assert(source.includes(token), `missing accessible private authoring control: ${token}`);
for (const key of ["testEquipmentVisible:", "testAutomaticFeedbackEnabled:", "testEquipmentMouseHand:", "testEquipmentPointerPosition:"]) assert.equal(source.includes(key), false, `${key} must not enter public records`);

// Deterministic YAML is still an export/bake artifact and round-trips exactly.
const defaults = validateEquipmentConfig(equipmentConfigDefaults);
const yaml = serializeEquipmentConfigYaml(defaults);
assert.deepEqual(parseEquipmentConfigYaml(yaml), defaults, "live defaults must round-trip through deterministic export YAML");
assert.equal(Object.isFrozen(defaults), true, "validated live config remains deeply frozen");

console.log("Equipment config grouped live-state source oracle PASS.");
