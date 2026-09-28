// @ts-check
// Exercise the actual assembly camera methods without constructing the browser service graph.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultGameplayCameraPose, normalizeGameplayCameraPose } from "@aerobeat/web-renderer";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const start = source.indexOf("  loadCameraPoses() {");
const end = source.indexOf("  /** Terminal until a disconnect/reconnect", start);
assert.ok(start !== -1 && end > start, "assembly camera methods must exist");
const methods = source.slice(start, end);
const CameraControls = new Function("defaultGameplayCameraPose", "normalizeGameplayCameraPose", "boxingGameplayRulesetIds", "HTMLElement", "HTMLInputElement", `return class { ${methods} }`)(defaultGameplayCameraPose, normalizeGameplayCameraPose, ["boxing_collider_v1"], class {}, class {});
const originalStorage = globalThis.localStorage;
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
try {
  const controls = new CameraControls();
  controls.cameraPoses = controls.loadCameraPoses();
  controls.shadowRoot = { querySelector: () => null, querySelectorAll: () => [] };
  controls.equipmentModeForSession = () => null;
  controls.graph = null;
  assert.equal(JSON.stringify(controls.cameraPoses.flow), JSON.stringify(defaultGameplayCameraPose), "Flow default must be byte-identical");
  assert.equal(JSON.stringify(controls.cameraPoses.boxing), JSON.stringify(defaultGameplayCameraPose), "Boxing default must be byte-identical");
  const originalBoxing = JSON.stringify(controls.cameraPoses.boxing);
  const adjusted = controls.setCameraPose("flow", { y: 2.25, z: 6.75, xPitch: -12, yYaw: 33 });
  assert.equal(adjusted.position.y, 2.25);
  assert.equal(adjusted.rotationEulerDegrees.zRoll, 0);
  assert.equal(JSON.stringify(controls.cameraPoses.boxing), originalBoxing, "Flow tuning must not modify Boxing");
  const restored = new CameraControls();
  restored.shadowRoot = controls.shadowRoot;
  restored.equipmentModeForSession = controls.equipmentModeForSession;
  restored.cameraPoses = restored.loadCameraPoses();
  assert.deepEqual(restored.cameraPoses.flow, adjusted, "Flow pose restores from localStorage");
  assert.equal(JSON.stringify(restored.cameraPoses.boxing), originalBoxing, "Boxing default survives reload");
  restored.setCameraPose("boxing", { y: 3.5, z: 7, xPitch: 10, yYaw: -18 });
  assert.deepEqual(new CameraControls().loadCameraPoses().boxing.position.y, 3.5);
  assert.throws(() => restored.setCameraPose("flow", { y: 90, z: 6, xPitch: 0, yYaw: 0 }), /bounds/);
  assert.equal(JSON.stringify(new CameraControls().loadCameraPoses().flow), JSON.stringify(adjusted), "invalid edit cannot persist");
  restored.resetCameraPose("flow");
  assert.equal(JSON.stringify(new CameraControls().loadCameraPoses().flow), JSON.stringify(defaultGameplayCameraPose));
  assert.equal(new CameraControls().loadCameraPoses().boxing.position.y, 3.5, "reset leaves other mode intact");
  storage.set("aerobeat.cameraPoses", "{invalid");
  const safe = new CameraControls().loadCameraPoses();
  assert.equal(JSON.stringify(safe.flow), JSON.stringify(defaultGameplayCameraPose));
  assert.equal(JSON.stringify(safe.boxing), JSON.stringify(defaultGameplayCameraPose));
} finally {
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}
console.log("Per-mode camera persistence/default/reset oracle passed.");
