// @ts-check
// Regression for Derrick's report: after a page refresh, switching the
// gameplay mode to Boxing and pressing Test left the debug camera in the Flow
// position/rotation instead of the Boxing pose.
//
// Root cause: the renderer initializes the debug camera to the production pose
// of its last rendered presentation (`this.activeGameplayCameraMode`). On a
// fresh page load that field is `null`, so the debug camera falls back to the
// shared Flow default. The assembly now re-applies the active mode's camera
// pose at the debug-camera enable edge (`syncDebugCameraPresentation`), so the
// first Test-mode frame renders from the correct mode pose.
//
// This drives the REAL assembly `syncDebugCameraPresentation` +
// `debugCameraSnapshot` methods against a mock renderer that records the
// `setGameplayCameraPose` calls, asserting the enable edge pushes the
// mode-specific pose.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultGameplayCameraPose } from "@aerobeat/web-renderer";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

/** Extract one class method's full source, including its braces. */
function methodBody(name) {
  const start = source.indexOf(`  ${name}(`);
  assert(start >= 0, `Assembly method ${name} missing`);
  const open = source.indexOf("{", start);
  assert(open > start, `Assembly method ${name} has no opening brace`);
  // Walk to the matching closing brace, accounting for nesting.
  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (depth === 0) { close = i; break; } }
  }
  assert(close > open, `Assembly method ${name} has no matching closing brace`);
  return source.slice(open, close + 1);
}

// Boxing default: height 2, depth 5, pitch -5, yaw 0 (distinct from Flow).
const boxingPose = {
  ...defaultGameplayCameraPose,
  position: { ...defaultGameplayCameraPose.position, y: 2 },
  rotationEulerDegrees: { ...defaultGameplayCameraPose.rotationEulerDegrees, xPitch: -5 }
};

// Build a minimal harness class from the REAL assembly method bodies. Every
// other dependency is stubbed so the test isolates the enable-edge behavior.
// Use string concatenation (not a template literal) because the method bodies
// contain template literals with `${...}` that must NOT be interpolated here.
const harnessSource = [
  "return class {",
  "  constructor(options) {",
  "    this.graph = options.graph;",
  "    this.menuOpen = options.menuOpen;",
  "    this.lifecycle = options.lifecycle;",
  "    this.sessionStartRequested = options.sessionStartRequested;",
  "    this.activeSessionAction = options.activeSessionAction;",
  "    this.testEquipmentMouseHand = options.testEquipmentMouseHand;",
  "    this.cameraPoses = options.cameraPoses;",
  "    this.cameraControlMode = options.cameraControlMode;",
  "    this.debugCameraSpeedMode = options.debugCameraSpeedMode;",
  "    this.testEquipmentAuthoringEnabled = false;",
  "    this.shadowRoot = { querySelector: () => null, querySelectorAll: () => [] };",
  "  }",
  "  debugCameraSnapshot() " + methodBody("debugCameraSnapshot"),
  "  syncDebugCameraPresentation() " + methodBody("syncDebugCameraPresentation"),
  "  // Stubs for sibling methods the real syncDebugCameraPresentation reaches.",
  "  renderEnvironmentControls() {}",
  "  testPresentationAuthoringSnapshot() { return { enabled: false }; }",
  "  invalidateTestPresentationPicker() {}",
  "  renderTestPresentationControls() {}",
  "  renderEquipmentConfigControls() {}",
  "  syncDebugCameraControlState() {}",
  "}"
].join("\n");
// The real methods reference browser globals (`document`, `HTMLElement`);
// stub them for Node. The stubs must persist for the whole test run, so they
// are restored in the finally at the end of the script.
const originalDocument = globalThis.document;
const originalHTMLElement = globalThis.HTMLElement;
globalThis.document = { hidden: false };
globalThis.HTMLElement = class HTMLElement {};
const HarnessClass = new Function(harnessSource)();

/** @param {boolean} initialDebugEnabled */
function makeRenderer(initialDebugEnabled) {
  const calls = [];
  return {
    calls,
    describe: () => Object.freeze({ debugCameraEnabled: initialDebugEnabled }),
    setDebugCameraAuthoringInputEnabled: () => {},
    setDebugCameraEnabled: () => {},
    setDebugCameraSpeedMode: () => {},
    setGameplayCameraPose: (mode, pose) => { calls.push({ mode, pose }); }
  };
}

function makeInstance({ renderer, menuOpen, cameraControlMode }) {
  return new HarnessClass({
    graph: { renderer, gameplay: { getSnapshot: () => ({ session: { purpose: "visual_test", state: "playing" } }) } },
    menuOpen,
    lifecycle: "connected",
    sessionStartRequested: true,
    activeSessionAction: "test",
    testEquipmentMouseHand: "off",
    cameraPoses: { flow: defaultGameplayCameraPose, boxing: boxingPose },
    cameraControlMode,
    debugCameraSpeedMode: "normal"
  });
}

try {
  // Case 1: fresh page load (renderer debug camera not yet enabled), mode =
  // Boxing. Enabling the debug camera must push the Boxing pose so the first
  // Test-mode frame renders from the Boxing camera, not the Flow default.
  {
    const renderer = makeRenderer(false);
    makeInstance({ renderer, menuOpen: false, cameraControlMode: () => "boxing" }).syncDebugCameraPresentation();
    assert.equal(renderer.calls.length, 1, "enable edge must push exactly one pose");
    assert.equal(renderer.calls[0].mode, "boxing", "enable edge must push the active mode (boxing)");
    assert.equal(renderer.calls[0].pose.position.y, 2, "boxing pose must have height 2");
    assert.equal(renderer.calls[0].pose.rotationEulerDegrees.xPitch, -5, "boxing pose must have pitch -5");
  }

  // Case 2: debug camera already enabled (steady state). No redundant pose push.
  {
    const renderer = makeRenderer(true);
    makeInstance({ renderer, menuOpen: false, cameraControlMode: () => "boxing" }).syncDebugCameraPresentation();
    assert.equal(renderer.calls.length, 0, "steady state must not re-push the pose");
  }

  // Case 3: menu open (debug camera not enabled). No pose push.
  {
    const renderer = makeRenderer(false);
    makeInstance({ renderer, menuOpen: true, cameraControlMode: () => "boxing" }).syncDebugCameraPresentation();
    assert.equal(renderer.calls.length, 0, "menu-open state must not push the pose");
  }

  // Case 4: Flow mode. Enable edge pushes the Flow pose.
  {
    const renderer = makeRenderer(false);
    makeInstance({ renderer, menuOpen: false, cameraControlMode: () => "flow" }).syncDebugCameraPresentation();
    assert.equal(renderer.calls.length, 1, "enable edge must push exactly one pose");
    assert.equal(renderer.calls[0].mode, "flow", "enable edge must push the active mode (flow)");
  }

  console.log("Debug camera mode-initialization oracle passed.");
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalHTMLElement === undefined) delete globalThis.HTMLElement;
  else globalThis.HTMLElement = originalHTMLElement;
}
