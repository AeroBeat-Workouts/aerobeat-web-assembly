// @ts-check

import assert from "node:assert/strict";
import { testEquipmentInput, testEquipmentMouseHands } from "../src/test-equipment-authoring.js";

assert.deepEqual(testEquipmentMouseHands, ["off", "left", "right"]);

const positions = (input) => input.anchors.map(({ anchor, x, y }) => ({ anchor, x, y }));
assert.deepEqual(positions(testEquipmentInput()), [{ anchor: "left_wrist", x: 0, y: 0.5 }, { anchor: "right_wrist", x: 1, y: 0.5 }], "Off defaults to deterministic anchors");
assert.deepEqual(positions(testEquipmentInput("left", { x: 0.2, y: 0.8 })), [{ anchor: "left_wrist", x: 0.2, y: 0.8 }, { anchor: "right_wrist", x: 1, y: 0.5 }], "left overrides only left wrist");
assert.deepEqual(positions(testEquipmentInput("right", { x: 0.2, y: 0.8 })), [{ anchor: "left_wrist", x: 0, y: 0.5 }, { anchor: "right_wrist", x: 0.2, y: 0.8 }], "right overrides only right wrist");
assert.deepEqual(positions(testEquipmentInput("right", { x: -3, y: 4 })), [{ anchor: "left_wrist", x: 0, y: 0.5 }, { anchor: "right_wrist", x: 0, y: 1 }], "projection defensively clamps finite points");
assert.deepEqual(positions(testEquipmentInput("left", { x: NaN, y: 0.2 })), positions(testEquipmentInput()), "non-finite points cannot override deterministic anchors");
assert.deepEqual(positions(testEquipmentInput("hostile", { x: 0.2, y: 0.8 })), positions(testEquipmentInput()), "unknown hand modes fail closed to Off");
assert(Object.isFrozen(testEquipmentInput("left", { x: 0.2, y: 0.8 }).anchors), "synthetic evidence stays immutable");

console.log("Test equipment authoring pure oracle PASS.");
