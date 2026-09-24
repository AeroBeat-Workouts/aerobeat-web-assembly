// @ts-check
// Assembly-owned equipment identity authority: runtime v3 envelope, legacy
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
}, "runtime identity input is the exact contracts-owned canonical v3 envelope");
assert.equal(sha256(runtimeInput), "56a5643a7360b1718006f9fbebffc5f95467a3d9b63c04c3935bacfc039c93ec", "canonical runtime v3 identity golden");

const legacyInput = equipmentConfigIdentityInput({
  configSchema: EQUIPMENT_CONFIG_SCHEMA,
  configVersion: 2,
  canonicalConfigJson
});
assert.equal(sha256(legacyInput), "a052373a0fd009b62e064310d3fd22c223014f1d8bd0f66103533d1e37016b94", "exact v2 identity golden remains stable");
assert.notEqual(runtimeInput, legacyInput, "v2 and v3 envelopes remain byte-distinct");
assert.notEqual(sha256(runtimeInput), sha256(legacyInput), "v2 and v3 score/config identities remain separated");

for (const configVersion of [1, 4, "3", null]) {
  assert.throws(() => equipmentConfigIdentityInput({
    configSchema: EQUIPMENT_CONFIG_SCHEMA,
    configVersion,
    canonicalConfigJson
  }), /equipment_config_identity_input_invalid/u, `unsupported configVersion ${String(configVersion)} rejects`);
}
const v2Config = JSON.parse(canonicalConfigJson);
v2Config.version = 2;
assert.throws(() => canonicalEquipmentConfigIdentityInput(v2Config), /version must be 3/u, "runtime identity helper rejects noncanonical v2 config objects");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const downloadedV2 = readFileSync(resolve(root, "scripts/fixtures/aerobeat-equipment-config-v2-downloaded.yaml"), "utf8");
const migrated = parseEquipmentConfigYaml(downloadedV2);
assert.equal(migrated.version, EQUIPMENT_CONFIG_VERSION, "strict v2 authoring input migrates before runtime identity");
assert.equal(canonicalEquipmentConfigIdentityInput(migrated), runtimeInput, "migrated v2 fixture locks the canonical runtime v3 identity");

console.log("Equipment config identity v3 envelope, v2 separation, rejection, migration, and goldens passed.");
