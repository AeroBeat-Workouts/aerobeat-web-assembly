// @ts-check
// Assembly-owned equipment identity authority: runtime v4 envelope, prior-version
// separation, rejection boundaries, and deterministic migration behavior.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { equipmentConfigIdentityInput } from "@aerobeat/web-contracts";
import {
  EQUIPMENT_CONFIG_SCHEMA,
  EQUIPMENT_CONFIG_VERSION,
  canonicalEquipmentConfigIdentityInput,
  canonicalEquipmentConfigJson,
  parseEquipmentConfigYaml
} from "../src/equipment-config.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonicalConfigJson = canonicalEquipmentConfigJson(equipmentConfigDefaults);
const runtimeInput = canonicalEquipmentConfigIdentityInput(equipmentConfigDefaults);
const runtimeEnvelope = JSON.parse(runtimeInput);

assert.deepEqual(runtimeEnvelope, {
  schema: "aerobeat/equipment_config_identity_input",
  version: 1,
  configSchema: EQUIPMENT_CONFIG_SCHEMA,
  configVersion: EQUIPMENT_CONFIG_VERSION,
  geometryIdentities: ["aerobeat/saber_capsule_v1", "aerobeat/glove_obb_v1"],
  canonicalConfigJson
}, "runtime identity input is the exact contracts-owned canonical v4 envelope");
assert.equal(sha256(runtimeInput), "3f0a26049f027ef012b47d570611f626d42e8787af57eab320aac293d91565f5", "canonical runtime v4 identity golden");

const v2Input = equipmentConfigIdentityInput({ configSchema: EQUIPMENT_CONFIG_SCHEMA, configVersion: 2, canonicalConfigJson });
const v3Input = equipmentConfigIdentityInput({ configSchema: EQUIPMENT_CONFIG_SCHEMA, configVersion: 3, canonicalConfigJson });
assert.equal(sha256(v2Input), "f1c8305b1beee44110b3b93393af446260cbfd73b445feb0cb14cb5d9fd4405e", "exact v2 envelope golden for current visible values");
assert.equal(sha256(v3Input), "2284d82734ccb454625820db28351acd502e0c8b1ccaa09c888e6072b9f90b9c", "exact v3 envelope golden for current visible values");
assert.equal(new Set([v2Input, v3Input, runtimeInput]).size, 3, "v2/v3/v4 envelopes remain byte-distinct");
assert.equal(new Set([sha256(v2Input), sha256(v3Input), sha256(runtimeInput)]).size, 3, "v2/v3/v4 score/config identities remain separated");

for (const configVersion of [1, 5, "4", null]) {
  assert.throws(() => equipmentConfigIdentityInput({
    configSchema: EQUIPMENT_CONFIG_SCHEMA,
    configVersion,
    canonicalConfigJson
  }), /equipment_config_identity_input_invalid/u, `unsupported configVersion ${String(configVersion)} rejects`);
}
for (const version of [2, 3]) {
  const oldConfig = JSON.parse(canonicalConfigJson); oldConfig.version = version;
  assert.throws(() => canonicalEquipmentConfigIdentityInput(oldConfig), /version must be 4/u, `runtime identity helper rejects noncanonical v${version} config objects`);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const downloadedV3 = readFileSync(resolve(root, "scripts/fixtures/aerobeat-equipment-config-v3-downloaded.yaml"), "utf8");
const migrated = parseEquipmentConfigYaml(downloadedV3);
assert.equal(migrated.version, EQUIPMENT_CONFIG_VERSION, "strict v3 authoring input migrates before runtime identity");
assert.equal(canonicalEquipmentConfigIdentityInput(migrated), runtimeInput, "migrated v3 fixture locks the canonical runtime v4 identity");

console.log("Equipment config identity v4 envelope, v2/v3 separation, rejection, migration, and goldens passed.");
