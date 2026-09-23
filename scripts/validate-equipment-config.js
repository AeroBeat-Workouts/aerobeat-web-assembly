// @ts-check
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  EQUIPMENT_CONFIG_SCHEMA, EQUIPMENT_CONFIG_VERSION, EQUIPMENT_SCALE_MAX,
  EQUIPMENT_SCALE_MIN, canonicalEquipmentAngleDeg, parseEquipmentConfigYaml,
  serializeEquipmentConfigYaml, validateEquipmentConfig
} from "../src/equipment-config.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";

const canonical = validateEquipmentConfig(equipmentConfigDefaults);
assert.equal(canonical.schema, EQUIPMENT_CONFIG_SCHEMA);
assert.equal(canonical.version, EQUIPMENT_CONFIG_VERSION);
assert.equal(canonical.flow.perHand.left.scale, 2);
assert.equal(canonical.flow.perHand.right.scale, 2);
assert.equal(canonical.boxing.perHand.left.scale, 0.75);
assert.equal(canonical.boxing.perHand.right.scale, 0.75);
assert.equal(Object.isFrozen(canonical.boxing.glove.states.guard.rotationEulerDeg), true);

const yaml = serializeEquipmentConfigYaml(canonical);
assert.equal(yaml, serializeEquipmentConfigYaml(canonical), "v2 serialization is byte deterministic");
assert.deepEqual(parseEquipmentConfigYaml(yaml), canonical, "canonical v2 round trips exactly");
assert.match(yaml, /^schema: "aerobeat\/equipment_config"\nversion: 2\nflow:/u);
for (const alias of ["rotationZDeg", "rotationDeg"]) assert.equal(yaml.includes(alias), false, `canonical export omits ${alias}`);

const legacy = `flow:\n  perHand:\n    left:\n      scale: 1.25\n      rotationZDeg: 370\n  saber:\n    zones:\n      edgeBottom:\n        rotationDeg: 270\nboxing:\n  glove:\n    states:\n      guard:\n        rotationZDeg: -190\n`;
const migrated = parseEquipmentConfigYaml(legacy);
assert.equal(migrated.schema, EQUIPMENT_CONFIG_SCHEMA);
assert.equal(migrated.version, 2);
assert.deepEqual(migrated.flow.perHand.left.rotationEulerDeg, { x:0, y:0, z:10 });
assert.equal(migrated.flow.saber.zones.edgeBottom.headingDeg, -90);
assert.deepEqual(migrated.boxing.glove.states.guard.rotationEulerDeg, { x:0, y:0, z:170 });
assert.equal(migrated.flow.perHand.right.scale, 2, "legacy gaps fill from new defaults");
assert.equal(migrated.boxing.perHand.left.scale, 0.75, "legacy gaps fill from new defaults");
assert.equal(serializeEquipmentConfigYaml(migrated).includes("rotationZDeg"), false);

assert.throws(() => parseEquipmentConfigYaml(`schema: "aerobeat/equipment_config"\nversion: 2\nflow:\n  perHand:\n    left:\n      rotationZDeg: 3\n`), /mixed legacy\/v2/u);
const mixed = yaml.replace("rotationEulerDeg:\n        x: 0", "rotationZDeg: 1\n      rotationEulerDeg:\n        x: 0");
assert.throws(() => parseEquipmentConfigYaml(mixed), /mixed legacy\/v2/u);
assert.throws(() => validateEquipmentConfig({}), /missing required key/u, "runtime validator rejects partial/unversioned records");
assert.throws(() => validateEquipmentConfig({ ...structuredClone(canonical), version: 1 }), /version must be 2/u);

for (const value of [EQUIPMENT_SCALE_MIN, EQUIPMENT_SCALE_MAX]) {
  const candidate = structuredClone(canonical); candidate.flow.perHand.left.scale = value;
  assert.equal(validateEquipmentConfig(candidate).flow.perHand.left.scale, value);
}
for (const value of [0.099, 4.001]) {
  const candidate = structuredClone(canonical); candidate.flow.perHand.left.scale = value;
  assert.throws(() => validateEquipmentConfig(candidate), /must be in \[0.1, 4\]/u);
}
assert.equal(canonicalEquipmentAngleDeg(180), -180);
assert.equal(canonicalEquipmentAngleDeg(540), -180);
assert.equal(canonicalEquipmentAngleDeg(-181), 179);
const angles = structuredClone(canonical);
angles.flow.perHand.left.rotationEulerDeg = { x: 181, y: -181, z: 540 };
angles.flow.saber.zones.edgeTop.headingDeg = 450;
const normalized = validateEquipmentConfig(angles);
assert.deepEqual(normalized.flow.perHand.left.rotationEulerDeg, { x:-179, y:179, z:-180 });
assert.equal(normalized.flow.saber.zones.edgeTop.headingDeg, 90);

const missingAxis = structuredClone(canonical);
delete missingAxis.boxing.glove.states.guard.rotationEulerDeg.y;
assert.throws(() => validateEquipmentConfig(missingAxis), /missing required key "y"/u);
const scalarAlias = structuredClone(canonical);
scalarAlias.boxing.glove.states.guard.rotationZDeg = -70;
assert.throws(() => validateEquipmentConfig(scalarAlias), /unknown key "rotationZDeg"/u);

const temp = mkdtempSync(resolve(tmpdir(), "aerobeat-equipment-v2-"));
try {
  const file = resolve(temp, "legacy.yaml"); writeFileSync(file, legacy, "utf8");
  const output = execFileSync(process.execPath, [resolve("scripts/bake-equipment-config.js"), file, "--dry-run"], { cwd:resolve("."), encoding:"utf8" });
  assert.deepEqual(JSON.parse(output), migrated, "bake boundary performs the same one-time migration");
} finally { rmSync(temp, { recursive:true, force:true }); }

console.log("Equipment config v2 validation passed.");
