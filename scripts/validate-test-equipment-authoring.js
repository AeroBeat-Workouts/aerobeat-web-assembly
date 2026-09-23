// @ts-check

import assert from "node:assert/strict";
import { normalizedTestEquipmentPointer, testEquipmentInput, testEquipmentMouseHands } from "../src/test-equipment-authoring.js";

assert.deepEqual(testEquipmentMouseHands, ["off", "left", "right"]);
assert.deepEqual(normalizedTestEquipmentPointer(150, 70, { left: 100, top: 20, width: 200, height: 100 }), { x: 0.25, y: 0.5 }, "CSS client coordinates normalize without DPR/backing-store scaling");
assert.deepEqual(normalizedTestEquipmentPointer(-100, 999, { left: 100, top: 20, width: 200, height: 100 }), { x: 0, y: 1 }, "finite coordinates clamp to the canvas unit box");
for (const invalid of [NaN, Infinity, -Infinity, "100", null, undefined]) assert.equal(normalizedTestEquipmentPointer(invalid, 20, { left: 0, top: 0, width: 100, height: 100 }), null);
for (const bounds of [{ left: 0, top: 0, width: 0, height: 1 }, { left: 0, top: 0, width: 1, height: -1 }, { left: NaN, top: 0, width: 1, height: 1 }, null]) assert.equal(normalizedTestEquipmentPointer(0, 0, bounds), null);

const positions = (input) => input.anchors.map(({ anchor, x, y }) => ({ anchor, x, y }));
assert.deepEqual(positions(testEquipmentInput()), [{ anchor: "left_wrist", x: 0, y: 0.5 }, { anchor: "right_wrist", x: 1, y: 0.5 }], "Off defaults to deterministic anchors");
assert.deepEqual(positions(testEquipmentInput("left", { x: 0.2, y: 0.8 })), [{ anchor: "left_wrist", x: 0.2, y: 0.8 }, { anchor: "right_wrist", x: 1, y: 0.5 }], "left overrides only left wrist");
assert.deepEqual(positions(testEquipmentInput("right", { x: 0.2, y: 0.8 })), [{ anchor: "left_wrist", x: 0, y: 0.5 }, { anchor: "right_wrist", x: 0.2, y: 0.8 }], "right overrides only right wrist");
assert.deepEqual(positions(testEquipmentInput("right", { x: -3, y: 4 })), [{ anchor: "left_wrist", x: 0, y: 0.5 }, { anchor: "right_wrist", x: 0, y: 1 }], "projection defensively clamps finite points");
assert.deepEqual(positions(testEquipmentInput("left", { x: NaN, y: 0.2 })), positions(testEquipmentInput()), "non-finite points cannot override deterministic anchors");
assert.deepEqual(positions(testEquipmentInput("hostile", { x: 0.2, y: 0.8 })), positions(testEquipmentInput()), "unknown hand modes fail closed to Off");
assert(Object.isFrozen(testEquipmentInput("left", { x: 0.2, y: 0.8 }).anchors), "synthetic evidence stays immutable");

console.log("Test equipment authoring pure oracle PASS.");
