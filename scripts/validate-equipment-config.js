// @ts-check
// 0.0.63 L-C (bead 376l, child C1): unit oracle for the Test-mode equipment
// config foundation (plan 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-
// successor.md, L-C design). Plain node, no browser. Covers:
//
//   1. round-trip: defaults -> serialize -> parse -> deep-equal
//   2. canonical key order of serialized YAML
//   3. defaults-merge: a partial YAML fills every gap from defaults
//   4. rejection: unknown key, wrong type, bad ease type, NaN-ish token,
//      unparseable YAML (array, tab indent, bare word, duplicate key)
//   5. center zone: rotationDeg null allowed, numeric allowed, "" rejected
//   6. result objects are deep-frozen
//   7. scripts/bake-equipment-config.js --dry-run prints the resulting
//      config JSON (run as a subprocess) and refuses invalid input

import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EQUIPMENT_EASE_TYPES,
  GLOVE_STATE_KEYS,
  PER_HAND_KEYS,
  SABER_ZONE_KEYS,
  parseEquipmentConfigYaml,
  serializeEquipmentConfigYaml,
  validateEquipmentConfig
} from "../src/equipment-config.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(resolve(tmpdir(), "aerobeat-equip-config-"));
try {
  // --- fixture YAMLs (canonical key order) ---

  const defaultsYaml = `flow:
  perHand:
    left:
      scale: 1
      rotationZDeg: 0
    right:
      scale: 1
      rotationZDeg: 0
  saber:
    zones:
      edgeTop:
        rotationDeg: 90
      edgeBottom:
        rotationDeg: 270
      edgeLeft:
        rotationDeg: 180
      edgeRight:
        rotationDeg: 0
      center:
        rotationDeg: null
    ease:
      type: linear
      durationMs: 100
    blendRadius: 0.15
boxing:
  perHand:
    left:
      scale: 1
      rotationZDeg: 0
    right:
      scale: 1
      rotationZDeg: 0
  glove:
    states:
      straight:
        rotationZDeg: 0
      uppercut:
        rotationZDeg: -35
      hookL:
        rotationZDeg: 60
      hookR:
        rotationZDeg: -60
      guard:
        rotationZDeg: -70
    ease:
      type: easeOut
      durationMs: 100
    upcomingBeatWindowMs: 500
`;

  const partialYaml = `boxing:
  glove:
    states:
      guard:
        rotationZDeg: -80
  perHand:
    left:
      scale: 1.2
`;

  const customYaml = `flow:
  saber:
    ease:
      type: "easeInOut"
      durationMs: 150
    blendRadius: 0.2
boxing:
  glove:
    states:
      guard:
        rotationZDeg: -75
`;

  // --- 1. round-trip: defaults -> serialize -> parse -> deep-equal ---
  assert.deepEqual(
    parseEquipmentConfigYaml(defaultsYaml),
    equipmentConfigDefaults,
    "round-trip: parsed defaults YAML must deep-equal equipmentConfigDefaults"
  );
  assert.equal(
    serializeEquipmentConfigYaml(equipmentConfigDefaults),
    defaultsYaml,
    "round-trip: serialize(defaults) must reproduce the canonical YAML exactly"
  );
  const reparse = parseEquipmentConfigYaml(serializeEquipmentConfigYaml(equipmentConfigDefaults));
  assert.deepEqual(reparse, equipmentConfigDefaults, "round-trip: serialize -> parse -> deep-equal");

  // --- 2. canonical key order (stable output) ---
  const orderChecks = [
    ["flow:", "  perHand:", "  saber:", "    zones:", "    ease:", "    blendRadius:", "boxing:", "  glove:", "    states:", "    upcomingBeatWindowMs:"],
  ];
  for (const order of orderChecks) {
    let last = -1;
    for (const token of order) {
      const idx = defaultsYaml.indexOf(token);
      assert.ok(idx > last, `canonical order violated before ${token}`);
      last = idx;
    }
    assert.deepEqual(SABER_ZONE_KEYS, ["edgeTop", "edgeBottom", "edgeLeft", "edgeRight", "center"], "saber zone key order");
    assert.deepEqual(GLOVE_STATE_KEYS, Object.keys(validateEquipmentConfig(equipmentConfigDefaults).boxing.glove.states), "glove state keys derive from validated config order");
    assert.deepEqual(PER_HAND_KEYS, ["left", "right"], "per-hand key order");
    assert.deepEqual([...EQUIPMENT_EASE_TYPES], ["linear", "easeIn", "easeOut", "easeInOut"], "ease type list");
  }
  // Serialize twice — byte-identical (deterministic).
  assert.equal(serializeEquipmentConfigYaml(equipmentConfigDefaults), serializeEquipmentConfigYaml(reparse), "serialization is deterministic");

  // --- 3. defaults-merge: partial YAML fills every gap ---
  const partial = parseEquipmentConfigYaml(partialYaml);
  assert.equal(partial["boxing"]["glove"]["states"]["guard"]["rotationZDeg"], -80, "partial: provided value wins");
  assert.equal(partial["boxing"]["perHand"]["left"]["scale"], 1.2, "partial: provided float scale wins");
  assert.equal(partial["boxing"]["perHand"]["left"]["rotationZDeg"], 0, "partial: gap filled from defaults");
  assert.equal(partial["boxing"]["perHand"]["right"]["scale"], 1, "partial: gap filled from defaults");
  assert.equal(partial["boxing"]["glove"]["states"]["uppercut"]["rotationZDeg"], -35, "partial: gap filled from defaults");
  assert.equal(partial["flow"]["saber"]["zones"]["edgeTop"]["rotationDeg"], 90, "partial: untouched mode filled from defaults");
  assert.equal(partial["flow"]["saber"]["ease"]["type"], "linear", "partial: untouched ease filled from defaults");
  // The same partial via the object path must yield an identical result.
  assert.deepEqual(
    partial,
    validateEquipmentConfig({ boxing: { glove: { states: { guard: { rotationZDeg: -80 } } }, perHand: { left: { scale: 1.2 } } } }),
    "partial: YAML path and object path agree"
  );
  // validateEquipmentConfig({}) is exactly the defaults.
  assert.deepEqual(validateEquipmentConfig({}), equipmentConfigDefaults, "validate({}) fills everything from defaults");

  // Custom values (quoted string ease type, float, negative int) parse and merge.
  const custom = parseEquipmentConfigYaml(customYaml);
  assert.equal(custom["flow"]["saber"]["ease"]["type"], "easeInOut", "custom: quoted ease type accepted");
  assert.equal(custom["flow"]["saber"]["ease"]["durationMs"], 150, "custom: ease duration accepted");
  assert.equal(custom["flow"]["saber"]["blendRadius"], 0.2, "custom: float blendRadius accepted");
  assert.equal(custom["boxing"]["glove"]["states"]["guard"]["rotationZDeg"], -75, "custom: negative angle accepted");

  // --- 4. rejection cases (each must THROW with a clear message) ---
  assert.throws(
    () => parseEquipmentConfigYaml(defaultsYaml + "tennis:\n  serve:\n    speed: 100\n"),
    /equipment config: unknown top-level key "tennis"/u,
    "unknown top-level key rejected"
  );
  assert.throws(
    () => parseEquipmentConfigYaml("flow:\n  saber:\n    power: 42\n"),
    /equipment config: unknown key "power" under \(root\)\.flow\.saber/u,
    "unknown nested key rejected"
  );
  assert.throws(
    () => parseEquipmentConfigYaml("flow:\n  saber:\n    blendRadius: fast\n"),
    /blendRadius must be a finite number/u,
    "wrong type (non-numeric leaf) rejected"
  );
  assert.throws(
    () => parseEquipmentConfigYaml("flow:\n  saber:\n    ease:\n      type: smooth\n"),
    /ease\.type must be one of linear \| easeIn \| easeOut \| easeInOut/u,
    "bad ease type rejected"
  );
  assert.throws(
    () => parseEquipmentConfigYaml("flow:\n  saber:\n    blendRadius: NaN\n"),
    /blendRadius must be a finite number/u,
    "NaN rejected (not a finite number)"
  );
  assert.throws(
    () => parseEquipmentConfigYaml("flow:\n  saber:\n    blendRadius: Infinity\n"),
    /blendRadius must be a finite number/u,
    "Infinity rejected (not a finite number)"
  );
  assert.throws(() => parseEquipmentConfigYaml("flow: [1, 2]\n"), /flow \(array\/map\) syntax/u, "array rejected (unparseable YAML for this subset)");
  assert.throws(() => parseEquipmentConfigYaml("flow:\n  - edgeTop\n  - edgeBottom\n"), /array entry/u, "block array rejected (unparseable YAML for this subset)");
  assert.throws(() => parseEquipmentConfigYaml("flow:\n\tperHand:\n"), /tab indentation/u, "tab indentation rejected");
  assert.throws(() => parseEquipmentConfigYaml("flow: just a bare word"), /unsupported YAML scalar/u, "bare multi-word value rejected");
  assert.throws(() => parseEquipmentConfigYaml("flow:\n  saber: 0.2\n  saber:\n    blendRadius: 0.2\n"), /duplicate YAML key "saber"/u, "duplicate key rejected");
  assert.throws(() => parseEquipmentConfigYaml("flow:\n  saber:\n    blendRadius: 0.15 extra\n"), /unsupported YAML scalar/u, "trailing junk after scalar rejected");
  // Object-level rejection (validateEquipmentConfig direct).
  assert.throws(() => validateEquipmentConfig({ flow: { saber: { ease: { type: "bouncy", durationMs: 100 } } } }), /ease\.type must be one of/u, "bad ease type rejected via object path");
  assert.throws(() => validateEquipmentConfig(null), /equipment config must be an object/u, "null rejected");
  assert.throws(() => validateEquipmentConfig([1, 2]), /equipment config must be an object/u, "array rejected via object path");
  assert.throws(() => validateEquipmentConfig({ flow: { nope: 1 } }), /equipment config: unknown key "nope" under \(root\)\.flow/u, "unknown nested key rejected via object path");

  // --- 5. center zone: rotationDeg null allowed, numeric allowed ---
  assert.equal(parseEquipmentConfigYaml("flow:\n  saber:\n    zones:\n      center:\n        rotationDeg: null\n")["flow"]["saber"]["zones"]["center"]["rotationDeg"], null, "center null (neutral) allowed");
  assert.equal(parseEquipmentConfigYaml("flow:\n  saber:\n    zones:\n      center:\n        rotationDeg: 45\n")["flow"]["saber"]["zones"]["center"]["rotationDeg"], 45, "center numeric override allowed");
  assert.throws(() => parseEquipmentConfigYaml("flow:\n  saber:\n    zones:\n      center:\n        rotationDeg: \"neutral\"\n"), /center\.rotationDeg/u, "center non-null string rejected");

  // --- 6. result is deep-frozen ---
  const frozen = parseEquipmentConfigYaml(defaultsYaml);
  assert.throws(() => { frozen["flow"]["saber"]["blendRadius"] = 9; }, /TypeError/u, "top-level result is frozen");
  assert.throws(() => { frozen["boxing"]["glove"]["states"]["guard"]["rotationZDeg"] = 0; }, /TypeError/u, "deep result is frozen");

  // --- 7. bake CLI --dry-run prints correct JSON and refuses bad input ---
  const writeFixture = (name, text) => {
    const p = resolve(tmp, name);
    writeFileSync(p, text, "utf8");
    return p;
  };
  const defaultsPath = writeFixture("defaults.yaml", serializeEquipmentConfigYaml(equipmentConfigDefaults));
  const dryRun = execSync(
    `node "${resolve(root, "scripts/bake-equipment-config.js")}" "${defaultsPath}" --dry-run`,
    { encoding: "utf8", cwd: root, stdio: ["ignore", "pipe", "pipe"] }
  );
  assert.deepEqual(JSON.parse(dryRun), equipmentConfigDefaults, "bake --dry-run prints the parsed config JSON (stdout is valid JSON)");
  const badPath = writeFixture("bad.yaml", "flow:\n  saber:\n    blendRadius: fast\n");
  assert.throws(
    () => execFileSync(process.execPath, [resolve(root, "scripts/bake-equipment-config.js"), badPath, "--dry-run"], { encoding: "utf8", cwd: root, stdio: "pipe" }),
    /blendRadius must be a finite number/u,
    "bake --dry-run refuses invalid YAML with a clear message"
  );
  const noArgs = (() => {
    try {
      execFileSync(process.execPath, [resolve(root, "scripts/bake-equipment-config.js")], { encoding: "utf8", cwd: root, stdio: "pipe" });
      return null;
    } catch (err) {
      return /** @type {Error & { status: number }} */ (err);
    }
  })();
  assert.ok(noArgs && noArgs.status === 2, "bake with no arguments exits with usage (status 2)");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log("Equipment config foundation (parse/serialize/validate + bake dry-run) validation passed.");
