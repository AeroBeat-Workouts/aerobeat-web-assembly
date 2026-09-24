// @ts-check
// Strict canonical equipment configuration v3, deterministic full v2 -> v3
// migration, and boundary-only migration for wholly legacy unversioned Z-only YAML.

import { equipmentConfigDefaults } from "./equipment-config-defaults.js";
import { parseYamlSubset, serializeYamlSubset } from "./equipment-config-yaml.js";

export const EQUIPMENT_CONFIG_SCHEMA = "aerobeat/equipment_config";
export const EQUIPMENT_CONFIG_VERSION = 3;
export const EQUIPMENT_CONFIG_LEGACY_VERSION = 2;
export const EQUIPMENT_EASE_TYPES = Object.freeze(["linear", "easeIn", "easeOut", "easeInOut"]);
export const SABER_ZONE_KEYS = Object.freeze(["edgeTop", "edgeBottom", "edgeLeft", "edgeRight"]);
export const GLOVE_STATE_KEYS = Object.freeze(Object.keys(equipmentConfigDefaults.boxing.glove.states));
export const PER_HAND_KEYS = Object.freeze(["left", "right"]);
export const EQUIPMENT_MODE_KEYS = Object.freeze(["flow", "boxing"]);
export const EQUIPMENT_SCALE_MIN = 0.1;
export const EQUIPMENT_SCALE_MAX = 4;

const V2_SABER_ZONE_KEYS = Object.freeze([...SABER_ZONE_KEYS, "center"]);
const LEGACY_KEYS = new Set(["rotationZDeg", "rotationDeg"]);
const STRUCTURED_ROTATION_KEYS = new Set(["rotationEulerDeg", "headingDeg", "localRotationEulerDeg"]);

function record(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`equipment config: ${path} must be an object`);
  return /** @type {Record<string, unknown>} */ (value);
}

function exactKeys(value, expected, path) {
  const keys = Object.keys(value);
  for (const key of keys) if (!expected.includes(key)) throw new Error(`equipment config: unknown key "${key}" under ${path} (allowed: ${expected.join(", ")})`);
  for (const key of expected) if (!Object.hasOwn(value, key)) throw new Error(`equipment config: missing required key "${key}" under ${path}`);
}

function finite(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`equipment config: ${path} must be a finite number`);
  return value;
}

/** Canonicalize finite degrees to [-180, 180), including 180 -> -180. */
export function canonicalEquipmentAngleDeg(value, path = "angle") {
  const n = finite(value, path);
  const canonical = ((n + 180) % 360 + 360) % 360 - 180;
  return Object.is(canonical, -0) ? 0 : canonical;
}

function euler(value, path) {
  const source = record(value, path);
  exactKeys(source, ["x", "y", "z"], path);
  return Object.freeze({
    x: canonicalEquipmentAngleDeg(source.x, `${path}.x`),
    y: canonicalEquipmentAngleDeg(source.y, `${path}.y`),
    z: canonicalEquipmentAngleDeg(source.z, `${path}.z`)
  });
}

function scale(value, path) {
  const n = finite(value, path);
  if (n < EQUIPMENT_SCALE_MIN || n > EQUIPMENT_SCALE_MAX) throw new Error(`equipment config: ${path} must be in [${EQUIPMENT_SCALE_MIN}, ${EQUIPMENT_SCALE_MAX}]`);
  return n;
}

function ease(value, path) {
  const source = record(value, path);
  exactKeys(source, ["type", "durationMs"], path);
  if (typeof source.type !== "string" || !EQUIPMENT_EASE_TYPES.some((type) => type === source.type)) throw new Error(`equipment config: ${path}.type must be one of ${EQUIPMENT_EASE_TYPES.join(" | ")}`);
  return Object.freeze({ type: source.type, durationMs: finite(source.durationMs, `${path}.durationMs`) });
}

function parsePerHand(value, path) {
  const hands = record(value, path); exactKeys(hands, PER_HAND_KEYS, path);
  const out = {};
  for (const hand of PER_HAND_KEYS) {
    const handValue = record(hands[hand], `${path}.${hand}`);
    exactKeys(handValue, ["scale", "rotationEulerDeg"], `${path}.${hand}`);
    out[hand] = Object.freeze({ scale: scale(handValue.scale, `${path}.${hand}.scale`), rotationEulerDeg: euler(handValue.rotationEulerDeg, `${path}.${hand}.rotationEulerDeg`) });
  }
  return Object.freeze(out);
}

function validateVersion(value, version, zoneKeys) {
  const root = record(value, "(root)");
  exactKeys(root, ["schema", "version", "flow", "boxing"], "(root)");
  if (root.schema !== EQUIPMENT_CONFIG_SCHEMA) throw new Error(`equipment config: schema must be ${EQUIPMENT_CONFIG_SCHEMA}`);
  if (root.version !== version) throw new Error(`equipment config: version must be ${version}`);

  const flow = record(root.flow, "(root).flow"); exactKeys(flow, ["perHand", "saber"], "(root).flow");
  const saber = record(flow.saber, "(root).flow.saber"); exactKeys(saber, ["zones", "ease", "blendRadius"], "(root).flow.saber");
  const zones = record(saber.zones, "(root).flow.saber.zones"); exactKeys(zones, zoneKeys, "(root).flow.saber.zones");
  const zoneOut = {};
  for (const key of zoneKeys) {
    const zone = record(zones[key], `(root).flow.saber.zones.${key}`);
    exactKeys(zone, ["headingDeg", "localRotationEulerDeg"], `(root).flow.saber.zones.${key}`);
    if (zone.headingDeg === null && key !== "center") throw new Error(`equipment config: ${key}.headingDeg must be a finite number`);
    zoneOut[key] = Object.freeze({
      headingDeg: zone.headingDeg === null ? null : canonicalEquipmentAngleDeg(zone.headingDeg, `(root).flow.saber.zones.${key}.headingDeg`),
      localRotationEulerDeg: euler(zone.localRotationEulerDeg, `(root).flow.saber.zones.${key}.localRotationEulerDeg`)
    });
  }

  const boxing = record(root.boxing, "(root).boxing"); exactKeys(boxing, ["perHand", "glove"], "(root).boxing");
  const glove = record(boxing.glove, "(root).boxing.glove"); exactKeys(glove, ["states", "ease", "upcomingBeatWindowMs"], "(root).boxing.glove");
  const states = record(glove.states, "(root).boxing.glove.states"); exactKeys(states, GLOVE_STATE_KEYS, "(root).boxing.glove.states");
  const stateOut = {};
  for (const key of GLOVE_STATE_KEYS) {
    const state = record(states[key], `(root).boxing.glove.states.${key}`);
    exactKeys(state, ["rotationEulerDeg"], `(root).boxing.glove.states.${key}`);
    stateOut[key] = Object.freeze({ rotationEulerDeg: euler(state.rotationEulerDeg, `(root).boxing.glove.states.${key}.rotationEulerDeg`) });
  }

  const blendRadius = finite(saber.blendRadius, "(root).flow.saber.blendRadius");
  if (version === EQUIPMENT_CONFIG_VERSION && (blendRadius <= 0 || blendRadius > 0.5)) throw new Error("equipment config: (root).flow.saber.blendRadius must be in (0, 0.5]");

  return Object.freeze({
    schema: EQUIPMENT_CONFIG_SCHEMA,
    version,
    flow: Object.freeze({
      perHand: parsePerHand(flow.perHand, "(root).flow.perHand"),
      saber: Object.freeze({ zones: Object.freeze(zoneOut), ease: ease(saber.ease, "(root).flow.saber.ease"), blendRadius })
    }),
    boxing: Object.freeze({
      perHand: parsePerHand(boxing.perHand, "(root).boxing.perHand"),
      glove: Object.freeze({ states: Object.freeze(stateOut), ease: ease(glove.ease, "(root).boxing.glove.ease"), upcomingBeatWindowMs: finite(glove.upcomingBeatWindowMs, "(root).boxing.glove.upcomingBeatWindowMs") })
    })
  });
}

/** Validate and canonicalize one complete v3 runtime record. */
export function validateEquipmentConfig(value) {
  return validateVersion(value, EQUIPMENT_CONFIG_VERSION, SABER_ZONE_KEYS);
}

/** Deterministically migrate one complete strict v2 record, deleting authored center. */
export function migrateEquipmentConfigV2(value) {
  const v2 = validateVersion(value, EQUIPMENT_CONFIG_LEGACY_VERSION, V2_SABER_ZONE_KEYS);
  const migrated = structuredClone(v2);
  migrated.version = EQUIPMENT_CONFIG_VERSION;
  delete migrated.flow.saber.zones.center;
  return validateEquipmentConfig(migrated);
}

function walkKeys(value, visit) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return;
  for (const [key, child] of Object.entries(value)) { visit(key); walkKeys(child, visit); }
}

function hasAnyKey(value, keys) {
  let found = false;
  walkKeys(value, (key) => { if (keys.has(key)) found = true; });
  return found;
}

function cloneDefaults() { return structuredClone(equipmentConfigDefaults); }

function overlayLegacy(target, source, path = "(root)") {
  const src = record(source, path);
  const allowed = path === "(root)" ? ["flow", "boxing"]
    : path.endsWith(".flow") ? ["perHand", "saber"]
    : path.endsWith(".boxing") ? ["perHand", "glove"]
    : path.endsWith(".perHand") ? PER_HAND_KEYS
    : /\.perHand\.(left|right)$/u.test(path) ? ["scale", "rotationZDeg"]
    : path.endsWith(".saber") ? ["zones", "ease", "blendRadius"]
    : path.endsWith(".zones") ? V2_SABER_ZONE_KEYS
    : /\.zones\.[^.]+$/u.test(path) ? ["rotationDeg"]
    : path.endsWith(".glove") ? ["states", "ease", "upcomingBeatWindowMs"]
    : path.endsWith(".states") ? GLOVE_STATE_KEYS
    : /\.states\.[^.]+$/u.test(path) ? ["rotationZDeg"]
    : path.endsWith(".ease") ? ["type", "durationMs"] : [];
  for (const key of Object.keys(src)) if (!allowed.includes(key)) throw new Error(`equipment config: unknown key "${key}" under ${path} (allowed: ${allowed.join(", ")})`);
  for (const [key, child] of Object.entries(src)) {
    const childPath = `${path}.${key}`;
    if (path.endsWith(".zones") && key === "center") {
      const center = record(child, childPath); exactKeys(center, ["rotationDeg"], childPath);
      canonicalEquipmentAngleDeg(center.rotationDeg, `${childPath}.rotationDeg`);
      continue;
    }
    if (child !== null && typeof child === "object" && !Array.isArray(child)) { overlayLegacy(target[key], child, childPath); continue; }
    if (key === "rotationZDeg") target.rotationEulerDeg = { x: 0, y: 0, z: child };
    else if (key === "rotationDeg") target.headingDeg = child;
    else target[key] = child;
  }
}

/** Parse canonical v3 YAML, fully migrate strict v2, or migrate wholly legacy unversioned YAML. */
export function parseEquipmentConfigYaml(text) {
  const parsed = parseYamlSubset(text);
  const root = record(parsed, "(root)");
  const legacy = hasAnyKey(root, LEGACY_KEYS);
  const structured = hasAnyKey(root, STRUCTURED_ROTATION_KEYS);
  const versioned = Object.hasOwn(root, "schema") || Object.hasOwn(root, "version");
  if (legacy && (structured || versioned)) throw new Error("equipment config: mixed legacy/versioned document is not allowed");
  if (versioned || structured) {
    if (root.schema === EQUIPMENT_CONFIG_SCHEMA && root.version === EQUIPMENT_CONFIG_LEGACY_VERSION) return migrateEquipmentConfigV2(root);
    return validateEquipmentConfig(root);
  }
  const migrated = cloneDefaults();
  overlayLegacy(migrated, root);
  return validateEquipmentConfig(migrated);
}

/** Canonical JSON bytes used only as the contracts-owned identity input payload. */
export function canonicalEquipmentConfigJson(config) {
  const canonical = (value) => {
    if (value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number") return JSON.stringify(Object.is(value, -0) ? 0 : value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  };
  return canonical(validateEquipmentConfig(config));
}

/** Serialize one complete canonical v3 record in deterministic schema order. */
export function serializeEquipmentConfigYaml(config) {
  return serializeYamlSubset(validateEquipmentConfig(config));
}
