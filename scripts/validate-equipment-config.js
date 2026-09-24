// @ts-check
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  EQUIPMENT_CONFIG_SCHEMA, EQUIPMENT_CONFIG_VERSION, EQUIPMENT_SCALE_MAX,
  EQUIPMENT_SCALE_MIN, canonicalEquipmentAngleDeg, migrateEquipmentConfigV2,
  parseEquipmentConfigYaml, serializeEquipmentConfigYaml, validateEquipmentConfig
} from "../src/equipment-config.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";
import { parseYamlSubset } from "../src/equipment-config-yaml.js";

const canonical = validateEquipmentConfig(equipmentConfigDefaults);
assert.equal(canonical.schema, EQUIPMENT_CONFIG_SCHEMA);
assert.equal(canonical.version, EQUIPMENT_CONFIG_VERSION);
assert.deepEqual(Object.keys(canonical.flow.saber.zones), ["edgeTop", "edgeBottom", "edgeLeft", "edgeRight"]);
assert.deepEqual(canonical.boxing.perHand.left.rotationEulerDeg, { x:0, y:0, z:45 });
assert.deepEqual(canonical.boxing.perHand.right.rotationEulerDeg, { x:0, y:0, z:45 });
assert.deepEqual(canonical.boxing.glove.states.uppercut.rotationEulerDeg, { x:0, y:45, z:0 });
assert.deepEqual(canonical.boxing.glove.states.hookL.rotationEulerDeg, { x:45, y:0, z:0 });
assert.deepEqual(canonical.boxing.glove.states.hookR.rotationEulerDeg, { x:45, y:0, z:0 });

const yaml = serializeEquipmentConfigYaml(canonical);
assert.equal(yaml, serializeEquipmentConfigYaml(canonical), "v3 serialization is byte deterministic");
assert.deepEqual(parseEquipmentConfigYaml(yaml), canonical, "canonical v3 round trips exactly");
assert.match(yaml, /^schema: "aerobeat\/equipment_config"\nversion: 3\nflow:/u);
assert.equal(yaml.includes("center:"), false, "canonical v3 export has no authored center");
for (const alias of ["rotationZDeg", "rotationDeg"]) assert.equal(yaml.includes(alias), false, `canonical export omits ${alias}`);

const fixturePath = resolve("scripts/fixtures/aerobeat-equipment-config-v2-downloaded.yaml");
const fixtureText = readFileSync(fixturePath, "utf8");
const parsedV2 = parseEquipmentConfigYaml(fixtureText);
assert.deepEqual(parsedV2, canonical, "downloaded v2 fixture migrates exactly to baked v3 defaults");
const rawV2 = parseYamlSubset(fixtureText);
assert.deepEqual(migrateEquipmentConfigV2(rawV2), canonical, "direct full-v2 migration matches parser migration");
assert.equal(Object.hasOwn(rawV2.flow.saber.zones, "center"), true, "migration does not mutate its v2 input");
const changedCenter = structuredClone(rawV2);
changedCenter.flow.saber.zones.center.headingDeg = 123;
changedCenter.flow.saber.zones.center.localRotationEulerDeg = { x:12, y:34, z:56 };
assert.deepEqual(migrateEquipmentConfigV2(changedCenter), canonical, "all authored v2 center values are deterministically deleted");
const incompleteV2 = structuredClone(rawV2); delete incompleteV2.flow.saber.zones.center;
assert.throws(() => migrateEquipmentConfigV2(incompleteV2), /missing required key "center"/u, "v2 migration accepts only a complete strict v2 record");

const withCenter = structuredClone(canonical);
withCenter.flow.saber.zones.center = { headingDeg:null, localRotationEulerDeg:{ x:0,y:0,z:0 } };
assert.throws(() => validateEquipmentConfig(withCenter), /unknown key "center"/u, "strict v3 rejects authored center");
assert.throws(() => validateEquipmentConfig({ ...structuredClone(canonical), version:2 }), /version must be 3/u, "runtime accepts canonical v3 only");
assert.throws(() => validateEquipmentConfig({}), /missing required key/u);
for (const invalidRadius of [0, -0.1, 0.5001]) {
  const candidate = structuredClone(canonical); candidate.flow.saber.blendRadius = invalidRadius;
  assert.throws(() => validateEquipmentConfig(candidate), /blendRadius must be in \(0, 0\.5\]/u);
}

const legacy = `flow:\n  perHand:\n    left:\n      scale: 1.25\n      rotationZDeg: 370\n  saber:\n    zones:\n      edgeBottom:\n        rotationDeg: 270\n      center:\n        rotationDeg: 45\nboxing:\n  glove:\n    states:\n      guard:\n        rotationZDeg: -190\n`;
const migrated = parseEquipmentConfigYaml(legacy);
assert.equal(migrated.version, 3);
assert.deepEqual(migrated.flow.perHand.left.rotationEulerDeg, { x:0, y:0, z:10 });
assert.equal(migrated.flow.saber.zones.edgeBottom.headingDeg, -90);
assert.deepEqual(migrated.boxing.glove.states.guard.rotationEulerDeg, { x:0, y:0, z:170 });
assert.equal(Object.hasOwn(migrated.flow.saber.zones, "center"), false, "legacy center is validated then deleted");
assert.equal(migrated.flow.perHand.right.scale, 2, "legacy gaps fill from baked defaults");
assert.deepEqual(migrated.boxing.perHand.left.rotationEulerDeg, { x:0,y:0,z:45 }, "legacy gaps use downloaded defaults");
assert.throws(() => parseEquipmentConfigYaml(`schema: "aerobeat/equipment_config"\nversion: 2\nflow:\n  perHand:\n    left:\n      rotationZDeg: 3\n`), /mixed legacy\/versioned/u);
assert.throws(() => parseEquipmentConfigYaml(yaml.replace("rotationEulerDeg:\n        x: 0", "rotationZDeg: 1\n      rotationEulerDeg:\n        x: 0")), /mixed legacy\/versioned/u);
assert.throws(() => parseEquipmentConfigYaml("flow:\n  saber:\n    zones:\n      center:\n        rotationDeg: nope\n"), /finite number/u);

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
angles.flow.perHand.left.rotationEulerDeg = { x:181, y:-181, z:540 };
angles.flow.saber.zones.edgeTop.headingDeg = 450;
const normalized = validateEquipmentConfig(angles);
assert.deepEqual(normalized.flow.perHand.left.rotationEulerDeg, { x:-179, y:179, z:-180 });
assert.equal(normalized.flow.saber.zones.edgeTop.headingDeg, 90);

const temp = mkdtempSync(resolve(tmpdir(), "aerobeat-equipment-v3-"));
try {
  const file = resolve(temp, "legacy.yaml"); writeFileSync(file, legacy, "utf8");
  const output = execFileSync(process.execPath, [resolve("scripts/bake-equipment-config.js"), file, "--dry-run"], { cwd:resolve("."), encoding:"utf8" });
  assert.deepEqual(JSON.parse(output), migrated, "bake boundary performs the same strict legacy migration");
  const bad = spawnSync(process.execPath, [resolve("scripts/bake-equipment-config.js"), fixturePath, "extra"], { cwd:resolve("."), encoding:"utf8" });
  assert.notEqual(bad.status, 0, "bake CLI keeps an exact argument boundary");
} finally { rmSync(temp, { recursive:true, force:true }); }

console.log("Equipment config v3 validation passed.");
