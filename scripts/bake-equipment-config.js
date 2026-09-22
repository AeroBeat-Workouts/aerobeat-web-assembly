// @ts-check
// AeroBeat 0.0.63, child C1 of bead 376l (plan
// 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-successor.md, L-C design).
//
// CLI: bake a finalized Test-mode equipment-config YAML into the build-default
// source file `src/equipment-config-defaults.js`, preserving the file header
// comment (including the JSDoc for the export) and regenerating the
// `equipmentConfigDefaults` object literal in the canonical schema key order.
//
//   node scripts/bake-equipment-config.js <file.yaml> [--dry-run]
//
// --dry-run prints the resulting config JSON and exits without writing.
// Otherwise the defaults file is rewritten in place.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEquipmentConfigYaml } from "../src/equipment-config.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Usage string for this CLI.
 *
 * @returns {string} - Help text.
 */
function usage() {
  return "Usage: node scripts/bake-equipment-config.js <file.yaml> [--dry-run]";
}

/**
 * Format a leaf value as a JS literal.
 *
 * @param {unknown} value - A leaf (number, string, null, or boolean).
 * @returns {string} - The JS literal text.
 */
function formatLeaf(value) {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`bake-equipment-config: non-finite number in config`);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  throw new Error(`bake-equipment-config: unsupported leaf type ${typeof value}`);
}

/**
 * Render a plain config subtree as an `Object.freeze({ ... })` literal with
 * nested freezes, using 2-space indentation per level. Objects with a single
 * leaf are rendered on one line to match the hand-written defaults file.
 *
 * @param {unknown} value - A subtree of the validated config.
 * @param {number} indent - Indentation level for this object's braces (2 spaces per level).
 * @returns {string} - The formatted `Object.freeze({ ... })` text.
 */
function renderFrozenObject(value, indent) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("bake-equipment-config: expected an object subtree");
  }
  const obj = /** @type {{ [key: string]: unknown }} */ (value);
  const pad = "  ".repeat(indent);
  const innerPad = "  ".repeat(indent + 1);
  const entries = Object.entries(obj);
  if (entries.length === 0) return "Object.freeze({})";
  // Single-leaf objects stay compact: `Object.freeze({ k: v })`.
  if (entries.length === 1 && (entries[0][1] === null || typeof entries[0][1] !== "object")) {
    const [key, child] = entries[0];
    const formattedKey = /^[A-Za-z_][A-Za-z0-9_]*$/u.test(key) ? key : JSON.stringify(key);
    return `Object.freeze({ ${formattedKey}: ${formatLeaf(child)} })`;
  }
  const lines = entries.map(([key, child]) => {
    const formattedKey = /^[A-Za-z_][A-Za-z0-9_]*$/u.test(key) ? key : JSON.stringify(key);
    const childText =
      child !== null && typeof child === "object"
        ? renderFrozenObject(child, indent + 1)
        : formatLeaf(child);
    return `${innerPad}${formattedKey}: ${childText}`;
  });
  return `Object.freeze({\n${lines.join(",\n")}\n${pad}})`;
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const positional = argv.filter((a) => a !== "--dry-run");
if (positional.length !== 1) {
  console.error(usage());
  process.exit(2);
}
const yamlPath = resolve(process.cwd(), positional[0]);
let yamlText;
try {
  yamlText = readFileSync(yamlPath, "utf8");
} catch (err) {
  console.error(`bake-equipment-config: cannot read ${yamlPath}: ${err.message}`);
  process.exit(1);
}

let config;
try {
  config = parseEquipmentConfigYaml(yamlText);
} catch (err) {
  console.error(`bake-equipment-config: ${err.message}`);
  process.exit(1);
}

const configJson = JSON.stringify(config, null, 2);
console.log(configJson);

if (dryRun) {
  console.error("bake-equipment-config: --dry-run (no file written)");
  process.exit(0);
}

const defaultsPath = resolve(repoRoot, "src", "equipment-config-defaults.js");
let existing;
try {
  existing = readFileSync(defaultsPath, "utf8");
} catch (err) {
  console.error(`bake-equipment-config: cannot read ${defaultsPath}: ${err.message}`);
  process.exit(1);
}

// Preserve everything before the `equipmentConfigDefaults` export (the file
// header comment and the JSDoc block for the constant).
const exportMarker = "export const equipmentConfigDefaults";
const exportIndex = existing.indexOf(exportMarker);
if (exportIndex === -1) {
  console.error("bake-equipment-config: could not locate the equipmentConfigDefaults export in the defaults file");
  process.exit(1);
}
const header = existing.slice(0, exportIndex).replace(/\s+$/u, "");

const objectLiteral = renderFrozenObject(config, 1);
const newContent = `${header}\n${exportMarker} = ${objectLiteral};\n`;
writeFileSync(defaultsPath, newContent, "utf8");
console.error(`bake-equipment-config: wrote ${defaultsPath}`);
process.exit(0);
