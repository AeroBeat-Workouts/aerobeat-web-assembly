// @ts-check
// AeroBeat 0.0.63, child C1 of bead 376l (plan
// 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-successor.md, L-C design).
//
// Test-mode equipment CONFIG foundation (D2 confirmed): a single per-mode
// config — per-hand base transform (scale / rotationZDeg), glove beat-state
// angles + ease + upcoming-beat window (boxing), saber zone angles + ease +
// distance blend radius (flow) — shared by the assembly (runtime defaults +
// Test-mode export) and the bake script (finalized YAML → build defaults).
//
// YAML is parsed/serialized with the strict minimal subset in
// `./equipment-config-yaml.js` (no yaml dependency is declared in this repo).
// Validation is fail-closed: unknown keys, wrong types, bad ease types, and
// non-finite numbers all THROW with a clear message; missing keys are filled
// from `equipmentConfigDefaults`.

import { equipmentConfigDefaults } from "./equipment-config-defaults.js";
import { parseYamlSubset, serializeYamlSubset } from "./equipment-config-yaml.js";

/**
 * Allowed easing types for glove/saber angle transitions (D3/D4 addenda).
 *
 * @type {ReadonlyArray<"linear" | "easeIn" | "easeOut" | "easeInOut">}
 */
export const EQUIPMENT_EASE_TYPES = Object.freeze(["linear", "easeIn", "easeOut", "easeInOut"]);

/**
 * Saber grid zone keys (I-8, child C4 consumes these). `center` is the
 * neutral zone: `rotationDeg: null` keeps the motion-derived direction.
 *
 * @type {ReadonlyArray<"edgeTop" | "edgeBottom" | "edgeLeft" | "edgeRight" | "center">}
 */
export const SABER_ZONE_KEYS = Object.freeze(["edgeTop", "edgeBottom", "edgeLeft", "edgeRight", "center"]);

/**
 * Glove beat-state keys (I-7, child C3 consumes these).
 *
 * @type {ReadonlyArray<"straight" | "upercut" | "hookL" | "hookR" | "guard">}
 */
export const GLOVE_STATE_KEYS = Object.freeze(["straight", "upercut", "hookL", "hookR", "guard"]);

/**
 * Per-hand keys shared by both modes.
 *
 * @type {ReadonlyArray<"left" | "right">>}
 */
export const PER_HAND_KEYS = Object.freeze(["left", "right"]);

/**
 * Canonical top-level mode keys, in serialization order.
 *
 * @type {ReadonlyArray<"flow" | "boxing">}
 */
export const EQUIPMENT_MODE_KEYS = Object.freeze(["flow", "boxing"]);

/**
 * Validate `value` against the equipment-config schema and return a deep
 * frozen, defaults-merged copy. Missing keys are filled from
 * `equipmentConfigDefaults`; present keys are checked for exact type and
 * (for enums) allowed values. Unknown keys at ANY level throw, as do wrong
 * types, non-finite numbers, and ease types outside `EQUIPMENT_EASE_TYPES`.
 *
 * @param {unknown} value - Candidate config (plain object tree; typically the
 *   result of `parseEquipmentConfigYaml`'s YAML step or a partial object).
 * @returns {Readonly<{
 *   flow: Readonly<{
 *     perHand: Readonly<{ left: Readonly<{ scale: number, rotationZDeg: number }>, right: Readonly<{ scale: number, rotationZDeg: number }> }>,
 *     saber: Readonly<{
 *       zones: Readonly<{
 *         edgeTop: Readonly<{ rotationDeg: number }>,
 *         edgeBottom: Readonly<{ rotationDeg: number }>,
 *         edgeLeft: Readonly<{ rotationDeg: number }>,
 *         edgeRight: Readonly<{ rotationDeg: number }>,
 *         center: Readonly<{ rotationDeg: number | null }>
 *       }>,
 *       ease: Readonly<{ type: "linear" | "easeIn" | "easeOut" | "easeInOut", durationMs: number }>,
 *       blendRadius: number
 *     }>
 *   }>,
 *   boxing: Readonly<{
 *     perHand: Readonly<{ left: Readonly<{ scale: number, rotationZDeg: number }>, right: Readonly<{ scale: number, rotationZDeg: number }> }>,
 *     glove: Readonly<{
 *       states: Readonly<{
 *         straight: Readonly<{ rotationZDeg: number }>,
 *         uppercut: Readonly<{ rotationZDeg: number }>,
 *         hookL: Readonly<{ rotationZDeg: number }>,
 *         hookR: Readonly<{ rotationZDeg: number }>,
 *         guard: Readonly<{ rotationZDeg: number }>
 *       }>,
 *       ease: Readonly<{ type: "linear" | "easeIn" | "easeOut" | "easeInOut", durationMs: number }>,
 *       upcomingBeatWindowMs: number
 *     }>
 *   }
 * }>} - Frozen validated config, complete (no missing keys).
 * @throws {Error} When any key is unknown or any present value has a wrong
 *   type, is non-finite, or (for ease.type) is not an allowed ease type.
 */
export function validateEquipmentConfig(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("equipment config must be an object (top-level map)");
  }
  const defaults = equipmentConfigDefaults;
  const record = /** @type {{ [key: string]: unknown }} */ (value);
  const allowedTop = ["flow", "boxing"];
  for (const key of Object.keys(record)) {
    if (!allowedTop.includes(key)) throw new Error(`equipment config: unknown top-level key "${key}" (allowed: ${allowedTop.join(", ")})`);
  }

  /**
   * Deep-merge `source` (partial) over `target` (defaults) and type-check
   * every leaf against `checkLeaf`; unknown keys at any nested level throw.
   *
   * @param {{ [key: string]: unknown }} target - Defaults subtree (canonical shape).
   * @param {{ [key: string]: unknown } | undefined} source - User subtree (may be absent).
   * @param {(leafValue: unknown, path: string, kind: string) => void} checkLeaf - Leaf type checker.
   * @returns {{ [key: string]: unknown }} - Merged plain (unfrozen) subtree.
   */
  function mergeChecked(target, source, path, checkLeaf) {
    const out = {};
    for (const key of Object.keys(target)) {
      const childDefaults = /** @type {unknown} */ (target[key]);
      const childPath = `${path}.${key}`;
      const present = source !== undefined && typeof source === "object" && key in source;
      const childSource = present ? /** @type {unknown} */ (source[key]) : undefined;
      if (childDefaults !== null && typeof childDefaults === "object" && !Array.isArray(childDefaults)) {
        if (childSource !== undefined && (childSource === null || typeof childSource !== "object" || Array.isArray(childSource))) {
          throw new Error(`equipment config: ${childPath} must be an object`);
        }
        out[key] = mergeChecked(/** @type {{ [key: string]: unknown }} */ (childDefaults), childSource, childPath, checkLeaf);
      } else {
        if (childSource === undefined) {
          out[key] = childDefaults;
        } else {
          checkLeaf(childSource, childPath);
          out[key] = childSource;
        }
      }
    }
    if (source !== undefined && typeof source === "object" && !Array.isArray(source)) {
      for (const key of Object.keys(source)) {
        if (!(key in target)) throw new Error(`equipment config: unknown key "${key}" under ${path} (allowed: ${Object.keys(target).join(", ")})`);
      }
    }
    return out;
  }

  /**
   * Type-check a finite number leaf.
   *
   * @param {unknown} leafValue - Candidate leaf value.
   * @param {string} path - Dotted key path for error messages.
   */
  function checkFiniteNumber(leafValue, path) {
    if (typeof leafValue !== "number" || !Number.isFinite(leafValue)) {
      throw new Error(`equipment config: ${path} must be a finite number (got ${describe(leafValue)})`);
    }
  }

  /**
   * Type-check a rotation angle leaf that MAY be null (the saber `center`
   * zone: null = neutral, keep motion-derived direction).
   *
   * @param {unknown} leafValue - Candidate leaf value.
   * @param {string} path - Dotted key path for error messages.
   */
  function checkAngleOrNeutral(leafValue, path) {
    if (leafValue === null) return;
    checkFiniteNumber(leafValue, path);
  }

  /**
   * Type-check an ease block leaf (`type` or `durationMs`).
   *
   * @param {unknown} leafValue - Candidate leaf value.
   * @param {string} path - Dotted key path for error messages.
   */
  function checkEaseLeaf(leafValue, path) {
    if (path.endsWith(".type")) {
      if (typeof leafValue !== "string" || !EQUIPMENT_EASE_TYPES.includes(/** @type {"linear" | "easeIn" | "easeOut" | "easeInOut"} */ (leafValue))) {
        throw new Error(`equipment config: ${path} must be one of ${EQUIPMENT_EASE_TYPES.join(" | ")} (got ${describe(leafValue)})`);
      }
    } else {
      checkFiniteNumber(leafValue, path);
    }
  }

  /**
   * Render a short human description of an invalid leaf for error messages.
   *
   * @param {unknown} leafValue - The offending value.
   * @returns {string} - Type/value summary.
   */
  function describe(leafValue) {
    if (leafValue === null) return "null";
    return `${typeof leafValue} ${JSON.stringify(leafValue)}`;
  }

  const merged = mergeChecked(defaults, record, "(root)", (leafValue, path) => {
    if (path.includes(".ease.")) checkEaseLeaf(leafValue, path);
    else if (path.endsWith(".rotationDeg") && /saber\.zones/u.test(path)) checkAngleOrNeutral(leafValue, path);
    else checkFiniteNumber(leafValue, path);
  });
  return freezeDeep(merged);
}

/**
 * Parse YAML text into a validated, defaults-merged, frozen equipment config.
 * The YAML must be in the strict supported subset (nested maps + scalars only;
 * see `equipment-config-yaml.js`); unparseable input or schema violations
 * throw with a clear message.
 *
 * @param {string} text - Full YAML document text (export format from Test mode).
 * @returns {Readonly<{
 *   flow: Readonly<{
 *     perHand: Readonly<{ left: Readonly<{ scale: number, rotationZDeg: number }>, right: Readonly<{ scale: number, rotationZDeg: number }> }>,
 *     saber: Readonly<{
 *       zones: Readonly<{
 *         edgeTop: Readonly<{ rotationDeg: number }>,
 *         edgeBottom: Readonly<{ rotationDeg: number }>,
 *         edgeLeft: Readonly<{ rotationDeg: number }>,
 *         edgeRight: Readonly<{ rotationDeg: number }>,
 *         center: Readonly<{ rotationDeg: number | null }>
 *       }>,
 *       ease: Readonly<{ type: "linear" | "easeIn" | "easeOut" | "easeInOut", durationMs: number }>,
 *       blendRadius: number
 *     }>
 *   }>,
 *   boxing: Readonly<{
 *     perHand: Readonly<{ left: Readonly<{ scale: number, rotationZDeg: number }>, right: Readonly<{ scale: number, rotationZDeg: number }> }>,
 *     glove: Readonly<{
 *       states: Readonly<{
 *         straight: Readonly<{ rotationZDeg: number }>,
 *         uppercut: Readonly<{ rotationZDeg: number }>,
 *         hookL: Readonly<{ rotationZDeg: number }>,
 *         hookR: Readonly<{ rotationZDeg: number }>,
 *         guard: Readonly<{ rotationZDeg: number }>
 *       }>,
 *       ease: Readonly<{ type: "linear" | "easeIn" | "easeOut" | "easeInOut", durationMs: number }>,
 *       upcomingBeatWindowMs: number
 *     }>
 *   }
 * }>} - Frozen validated config (identical in shape to `validateEquipmentConfig`'s return).
 * @throws {Error} On unparseable YAML, unknown keys, wrong types, or bad ease types.
 */
export function parseEquipmentConfigYaml(text) {
  return validateEquipmentConfig(parseYamlSubset(text));
}

/**
 * Serialize a (validated or plain) equipment config to canonical YAML text
 * with stable schema key order. The input is re-validated first so the
 * output always reflects a complete, type-correct config — passing a partial
 * object serializes its defaults-merged form.
 *
 * @param {unknown} config - Config object (plain or frozen; re-validated internally).
 * @returns {string} - Canonical YAML text (stable key order, trailing newline).
 * @throws {Error} When `config` fails schema validation.
 */
export function serializeEquipmentConfigYaml(config) {
  const validated = validateEquipmentConfig(config);
  return serializeYamlSubsetInSchemaOrder(validated);
}

/**
 * Serialize a validated config in the canonical schema key order (mode
 * order `flow, boxing`, then per-hand `left, right`, then each block's
 * schema order). The defaults object is already in this order, so walking
 * the defaults skeleton and copying values from `validated` yields a
 * deterministic document.
 *
 * @param {{ [key: string]: unknown }} validated - Frozen validated config.
 * @returns {string} - Canonical YAML text.
 */
function serializeYamlSubsetInSchemaOrder(validated) {
  /**
   * Copy a subtree following `defaultsShape` key order.
   *
   * @param {{ [key: string]: unknown }} defaultsShape - Defaults subtree (canonical order).
   * @param {{ [key: string]: unknown }} source - Validated subtree.
   * @returns {{ [key: string]: unknown }} - Insertion-ordered plain subtree.
   */
  function reorder(defaultsShape, source) {
    const out = {};
    for (const key of Object.keys(defaultsShape)) {
      const childDefaults = /** @type {unknown} */ (defaultsShape[key]);
      const childSource = /** @type {unknown} */ (source[key]);
      if (childDefaults !== null && typeof childDefaults === "object" && !Array.isArray(childDefaults)) {
        out[key] = reorder(/** @type {{ [key: string]: unknown }} */ (childDefaults), /** @type {{ [key: string]: unknown }} */ (childSource));
      } else {
        out[key] = childSource;
      }
    }
    return out;
  }

  return serializeYamlSubset(reorder(equipmentConfigDefaults, /** @type {{ [key: string]: unknown }} */ (validated)));
}

/**
 * Deep-freeze a plain object tree.
 *
 * @param {{ [key: string]: unknown }} value - Plain (unfrozen) object tree.
 * @returns {Readonly<{ [key: string]: unknown }>} - Deep-frozen copy (same object identity at the root).
 */
function freezeDeep(value) {
  for (const key of Object.keys(value)) {
    const child = /** @type {unknown} */ (value[key]);
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      freezeDeep(/** @type {{ [key: string]: unknown }} */ (child));
    }
  }
  return Object.freeze(value);
}
