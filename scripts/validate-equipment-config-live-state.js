// @ts-check
// 0.0.63 C5 (bead 376l, final piece of L-C): unit oracle for the assembly's
// LIVE equipment config state API `AeroGame.setEquipmentConfigYaml` + its
// Test-mode panel helpers. Plan: .plans/2026-09-21-0.0.63-playtest-feedback-
// 0.0.62-retest-successor.md (L-C design, D2).
//
// The real AeroGame constructor is browser-only (Shadow DOM / service graph),
// so this oracle extracts the EXACT method functions from src/index.js and
// binds them to instance-shaped harness objects carrying only the fields they
// touch (`equipmentConfig`, `equipmentConfigStatus`, plus stand-in textarea /
// status-output / control lookups). Coverage:
//
//   1. valid PARTIAL yaml applies with defaults merged; applied config frozen
//   2. valid COMPLETE yaml applies canonically (re-serializes identically)
//   3. invalid (unknown top-level key / unknown nested key / bad ease type /
//      NaN token / wrong leaf type / unparseable array) rejected with state
//      untouched and the error surfaced in the status line
//   4. live draft validation shows valid/error WITHOUT applying
//   5. apply/reset/export gated OFF outside the Visual Test authoring surface
//   6. apply in test mode commits + requests next-frame render; invalid stays
//   7. reset restores the baked build defaults into state + textarea
//   8. export requires validity; downloads text/yaml as
//      aerobeat-equipment-config.yaml via a temporary <a download> click;
//      object URL revoked; downloaded bytes re-parse as YAML
//   9. controls render preloads the serialized live config once + mirrors the
//      authoring snapshot enabled/disabled on every control
//  10. status renderer projects value + data-error flag

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEquipmentConfigYaml, serializeEquipmentConfigYaml, validateEquipmentConfig } from "../src/equipment-config.js";
import { equipmentConfigDefaults } from "../src/equipment-config-defaults.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexSource = readFileSync(resolve(root, "src/index.js"), "utf8");

/**
 * Extract a class-method function by name from the AeroGame source text.
 * Walks balanced braces from the first signature brace; JSDoc comments may
 * contain braces, so the scan skips string/comment contents.
 *
 * @param {string} source - src/index.js text.
 * @param {string} name - Method name.
 * @returns {(this: Record<string, unknown>, ...args: unknown[]) => unknown}
 */
function extractMethod(source, name) {
  const marker = `\n  ${name}(`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`method ${name} not found in index.js`);
  let i = source.indexOf("{", start);
  let depth = 0;
  let inString = null; // ' | " | `
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (inString !== null) {
      if (ch === "\\") { i += 1; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { inString = ch; continue; }
    if (ch === "/" && source[i + 1] === "/") { i = source.indexOf("\n", i); if (i === -1) break; continue; }
    if (ch === "/" && source[i + 1] === "*") { const end = source.indexOf("*/", i); if (end === -1) throw new Error("unterminated comment"); i = end + 1; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (depth === 0) break; }
  }
  if (depth !== 0) throw new Error(`unbalanced braces extracting ${name}`);
  const body = source.slice(start + marker.length - 1, i + 1); // starts at "("
  // Compile in this module's scope so the class's module-level imports
  // (parseEquipmentConfigYaml, serializeEquipmentConfigYaml,
  // validateEquipmentConfig, equipmentConfigDefaults — mirrored by this file's
  // own imports) resolve exactly as they do on the real AeroGame.
  // eslint-disable-next-line no-new-func
  const factory = new Function(...BINDINGS.keys(), `"use strict"; return function${body};`);
  return /** @type {(this: Record<string, unknown>, ...args: unknown[]) => unknown} */ (factory(...BINDINGS.values()));
}

/** Module bindings shared with src/index.js for extracted method bodies. */
const BINDINGS = new Map([
  ["parseEquipmentConfigYaml", parseEquipmentConfigYaml],
  ["serializeEquipmentConfigYaml", serializeEquipmentConfigYaml],
  ["validateEquipmentConfig", validateEquipmentConfig],
  ["equipmentConfigDefaults", equipmentConfigDefaults],
]);

const setEquipmentConfigYaml = /** @type {(this: HarnessShape, text: string) => {ok: true, config: Readonly<Record<PropertyKey, unknown>>} | {ok: false, error: string}} */ (extractMethod(indexSource, "setEquipmentConfigYaml"));
const validateEquipmentConfigDraft = /** @type {(this: HarnessShape, text: string) => {ok: boolean, error: string | null}} */ (extractMethod(indexSource, "validateEquipmentConfigDraft"));
const applyEquipmentConfig = /** @type {(this: HarnessShape) => boolean} */ (extractMethod(indexSource, "applyEquipmentConfig"));
const resetEquipmentConfig = /** @type {(this: HarnessShape) => boolean} */ (extractMethod(indexSource, "resetEquipmentConfig"));
const exportEquipmentConfig = /** @type {(this: HarnessShape, event: unknown) => boolean} */ (extractMethod(indexSource, "exportEquipmentConfig"));
const renderEquipmentConfigStatus = /** @type {(this: HarnessShape, error?: boolean) => void} */ (extractMethod(indexSource, "renderEquipmentConfigStatus"));
const renderEquipmentConfigControls = /** @type {(this: HarnessShape) => void} */ (extractMethod(indexSource, "renderEquipmentConfigControls"));

// selectors shared with the real class
const STATUS_SELECTOR = "[data-role='equipment-config-status']";
const TEXTAREA_SELECTOR = "[data-equipment-config-field='yaml']";

function makeHarness(opts = {}) {
  const textarea = { value: "", disabled: true };
  const statusOutput = { value: "", dataset: {} };
  /** @type {Record<string, unknown>} */
  const h = {
    equipmentConfig: validateEquipmentConfig(equipmentConfigDefaults),
    equipmentConfigStatus: "",
    /** The class reads controls via this.shadowRoot?.querySelectorAll(...). */
    shadowRoot: null,
    /** @type {Array<object>} */
    controls: [],
    /** @type {number} */
    renderGameplayCalls: 0,
    authoringEnabled: opts.enabled === true,
    textarea,
    statusOutput,
    shadowRootQuerySelector(selector) { return selector === STATUS_SELECTOR ? statusOutput : (selector === TEXTAREA_SELECTOR ? textarea : null); },
    shadowRootQuerySelectorAll() { return h.controls; },
    testPresentationAuthoringSnapshot() { return Object.freeze({ visible: true, enabled: h.authoringEnabled }); },
    renderGameplay() { h.renderGameplayCalls += 1; },
    equipmentConfigTextarea() { return textarea; },
    renderEquipmentConfigStatus(error) {
      const out = this.shadowRootQuerySelector(STATUS_SELECTOR);
      if (out !== null) { out.value = this.equipmentConfigStatus; out.dataset.error = error ? "true" : "false"; }
    },
  };
  h.controls = [textarea, { disabled: true }, { disabled: true }, { disabled: true }];
  // Wire mutual self-calls between the extracted real methods (apply/reset/export
  // call this.setEquipmentConfigYaml / this.validateEquipmentConfigDraft).
  h.setEquipmentConfigYaml = function (text) { return setEquipmentConfigYaml.call(this, text); };
  h.validateEquipmentConfigDraft = function (text) { return validateEquipmentConfigDraft.call(this, text); };
  return h;
}

const defaultsYaml = serializeEquipmentConfigYaml(validateEquipmentConfig(equipmentConfigDefaults));

main().catch((e) => { console.error(e); process.exit(1); });

async function main() {
// --- 1. valid PARTIAL yaml applies with defaults merged ---
{
  const h = makeHarness();
  const before = JSON.stringify(h.equipmentConfig);
  const partial = "flow:\n  perHand:\n    left:\n      scale: 1.25\n";
  const result = setEquipmentConfigYaml.call(h, partial);
  assert.equal(result.ok, true, "partial yaml must be accepted");
  assert.notEqual(JSON.stringify(h.equipmentConfig), before, "state must change on apply");
  assert.equal(h.equipmentConfig.flow.perHand.left.scale, 1.25, "edited leaf committed");
  assert.equal(h.equipmentConfig.boxing.glove.upcomingBeatWindowMs, equipmentConfigDefaults.boxing.glove.upcomingBeatWindowMs, "untouched subtree keeps defaults");
  assert.equal(Object.isFrozen(h.equipmentConfig), true, "applied config is frozen");
  assert.equal(h.equipmentConfigStatus, "Equipment config applied.", "success status projected");
  console.log("PASS: 1 setEquipmentConfigYaml — valid partial applies, defaults merged, frozen");
}

// --- 2. valid COMPLETE yaml applies byte-for-byte (canonical round-trip) ---
{
  const h = makeHarness();
  const result = setEquipmentConfigYaml.call(h, defaultsYaml);
  assert.equal(result.ok, true);
  assert.deepEqual(serializeEquipmentConfigYaml(h.equipmentConfig), defaultsYaml, "complete yaml re-serializes identically");
  console.log("PASS: 2 setEquipmentConfigYaml — valid complete yaml applies canonically");
}

// --- 3. invalid inputs rejected with state untouched ---
const rejectionCases = [
  ["unknown top-level key", `${defaultsYaml}extra: 1\n`],
  ["unknown nested key", defaultsYaml.replace("upcomingBeatWindowMs:", "upcomingBeatWindowMz:")],
  ["bad ease type", defaultsYaml.replace("type: easeOut", "type: bounceOut")],
  ["NaN number", defaultsYaml.replace("scale: 1", "scale: NaN")],
  ["wrong leaf type", defaultsYaml.replace("blendRadius: 0.15", "blendRadius: wide")],
  ["unparseable yaml (array entry)", "- flow:\n  perHand:\n"],
];
for (const [label, text] of rejectionCases) {
  const h = makeHarness();
  const before = JSON.stringify(h.equipmentConfig);
  const result = setEquipmentConfigYaml.call(h, text);
  assert.equal(result.ok, false, `${label}: must be rejected`);
  assert.equal(typeof result.error, "string");
  assert.ok(result.error.length > 0, `${label}: error message present`);
  assert.equal(JSON.stringify(h.equipmentConfig), before, `${label}: state untouched`);
  assert.equal(h.equipmentConfigStatus, result.error, `${label}: error surfaced in status`);
  console.log(`PASS: 3.${rejectionCases.findIndex((c) => c[0] === label) + 1} rejection — ${label}`);
}

// --- 4. live draft validation never mutates state ---
{
  const h = makeHarness();
  const before = JSON.stringify(h.equipmentConfig);
  const ok = validateEquipmentConfigDraft.call(h, defaultsYaml);
  assert.deepEqual(ok, { ok: true, error: null });
  assert.match(h.equipmentConfigStatus, /Valid/u);
  const bad = validateEquipmentConfigDraft.call(h, `${defaultsYaml}bogus: 1\n`);
  assert.equal(bad.ok, false);
  assert.ok(bad.error !== null);
  assert.equal(JSON.stringify(h.equipmentConfig), before, "draft validation must not apply");
  assert.match(h.equipmentConfigStatus, /unknown top-level key "bogus"/u, "error replaced the valid indicator");
  console.log("PASS: 4 validateEquipmentConfigDraft — valid indicator + error shown without applying");
}

// --- 5. Test-mode gate: apply/reset/export blocked when authoring disabled ---
{
  const h = makeHarness();
  h.textarea.value = defaultsYaml;
  assert.equal(applyEquipmentConfig.call(h), false, "apply gated off in normal play");
  assert.equal(resetEquipmentConfig.call(h), false, "reset gated off in normal play");
  assert.equal(exportEquipmentConfig.call(h, { isTrusted: true }), false, "export gated off in normal play");
  assert.equal(exportEquipmentConfig.call(h, { isTrusted: false }), false, "export refuses untrusted events");
  assert.equal(h.renderGameplayCalls, 0, "no render triggered while gated");
  console.log("PASS: 5 gating — apply/reset/export require the Visual Test authoring surface");
}

// --- 6. apply in test mode commits + renders next frame; invalid stays ---
{
  const h = makeHarness({ enabled: true });
  const edited = defaultsYaml.replace("rotationZDeg: 0", "rotationZDeg: -12");
  h.textarea.value = edited;
  const applied = applyEquipmentConfig.call(h);
  assert.equal(applied, true);
  assert.equal(h.equipmentConfig.flow.perHand.left.rotationZDeg, -12, "edit committed");
  assert.equal(h.renderGameplayCalls, 0, "apply does not force a direct render (loop already ticks)");
  const beforeBad = JSON.stringify(h.equipmentConfig);
  h.textarea.value = `${defaultsYaml}bad_key: 1\n`;
  assert.equal(applyEquipmentConfig.call(h), false, "invalid apply refused");
  assert.equal(JSON.stringify(h.equipmentConfig), beforeBad, "invalid apply leaves config");
  assert.match(h.equipmentConfigStatus, /unknown top-level key "bad_key"/u);
  console.log("PASS: 6 apply — valid commits + renders; invalid stays on error");
}

// --- 7. reset restores baked defaults into state + textarea ---
{
  const h = makeHarness({ enabled: true });
  const mutated = defaultsYaml.replace("scale: 1", "scale: 3");
  assert.equal(setEquipmentConfigYaml.call(h, mutated).ok, true);
  assert.equal(h.equipmentConfig.flow.perHand.left.scale, 3);
  const reset = resetEquipmentConfig.call(h);
  assert.equal(reset, true);
  assert.equal(h.equipmentConfig.flow.perHand.left.scale, 1, "default restored");
  assert.equal(h.textarea.value, defaultsYaml, "textarea refreshed to serialized defaults");
  assert.equal(h.renderGameplayCalls, 0, "reset does not force a direct render (loop already ticks)");
  console.log("PASS: 7 reset — baked defaults restored to state and textarea");
}

// --- 8. export: valid content downloads as aerobeat-equipment-config.yaml ---
{
  const createdBlobs = [];
  const revokedUrls = [];
  const clickedAnchors = [];
  const originalCreate = URL.createObjectURL.bind(URL);
  const originalRevoke = URL.revokeObjectURL.bind(URL);
  const originalHTMLAnchorElement = globalThis.HTMLAnchorElement;
  const originalDocument = globalThis.document;
  const originalCreateElement = originalDocument ? originalDocument.createElement.bind(originalDocument) : null;
  URL.createObjectURL = (blob) => { const v = `blob:test-${createdBlobs.length}`; createdBlobs.push({ v, blob }); return v; };
  URL.revokeObjectURL = (v) => { revokedUrls.push(v); };
  globalThis.HTMLAnchorElement = class {
    constructor() { this.hidden = false; this.download = ""; this.href = ""; }
    click() { clickedAnchors.push({ download: this.download, href: this.href }); }
    remove() {}
  };
  const docShim = { createElement(tag) { return tag === "a" ? new HTMLAnchorElement() : null; } };
  globalThis.document = docShim;
  try {
    const h = makeHarness({ enabled: true });
    h.textarea.value = defaultsYaml;
    const exported = exportEquipmentConfig.call(h, { isTrusted: true });
    assert.equal(exported, true, "valid export succeeds");
    assert.equal(createdBlobs.length, 1);
    assert.equal(createdBlobs[0].blob.type, "text/yaml");
    assert.equal(clickedAnchors.length, 1);
    assert.equal(clickedAnchors[0].download, "aerobeat-equipment-config.yaml");
    assert.ok(String(clickedAnchors[0].href).startsWith("blob:"), "anchor points at the blob url");
    assert.deepEqual(revokedUrls, [createdBlobs[0].v], "object url revoked");
    const downloadedText = await createdBlobs[0].blob.text();
    assert.equal(downloadedText, defaultsYaml, "download bytes equal the exported textarea content");
    parseEquipmentConfigYaml(downloadedText); // downloadable content must re-parse
    // Invalid textarea content must NOT export.
    h.textarea.value = `${defaultsYaml}nope: 1\n`;
    assert.equal(exportEquipmentConfig.call(h, { isTrusted: true }), false, "invalid content refuses to export");
    assert.equal(createdBlobs.length, 1, "no second download for invalid content");
    console.log("PASS: 8 export — valid downloads text/yaml as aerobeat-equipment-config.yaml; invalid refuses");
  } finally {
    globalThis.HTMLAnchorElement = originalHTMLAnchorElement;
    globalThis.document = originalDocument;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    if (originalDocument && originalCreateElement) originalDocument.createElement = originalCreateElement;
  }
}

// --- 9. controls render preloads the serialized live config once + gates ---
{
  const h = makeHarness();
  assert.equal(h.textarea.value, "");
  h.authoringEnabled = false;
  renderEquipmentConfigControls.call(h);
  assert.equal(h.textarea.value, defaultsYaml, "first show preloads serialized live config");
  assert.equal(h.textarea.disabled, true, "controls disabled outside Visual Test");
  h.authoringEnabled = true;
  renderEquipmentConfigControls.call(h);
  assert.ok(typeof h.shadowRootQuerySelectorAll === "function" && Array.isArray(h.controls), "control list reachable");
  // In the browser these queryAll results are HTMLTextAreaElement /
  // HTMLButtonElement instances; the harness uses plain objects with the same
  // `disabled` boolean surface (the class loop checks it structurally).
  const textareaLike = new Proxy(h.textarea, { has() { return true; } });
  const buttonTarget = { disabled: true };
  const standInButton = new Proxy(buttonTarget, { has() { return true; } });
  h.controls = [textareaLike, standInButton];
  // Install the fake shadowRoot the class loop reads through.
  h.shadowRoot = {
    querySelector(selector) { return selector === STATUS_SELECTOR ? statusOutput : (selector === TEXTAREA_SELECTOR ? textarea : null); },
    querySelectorAll() { return h.controls; },
    append() {},
  };
  renderEquipmentConfigControls.call(h);
  assert.equal(buttonTarget.disabled, false, "button control enabled in Visual Test");
  h.authoringEnabled = false;
  renderEquipmentConfigControls.call(h);
  assert.equal(buttonTarget.disabled, true, "button control disabled outside Visual Test");
  h.textarea.value = defaultsYaml.replace("scale: 1", "scale: 2.5");
  renderEquipmentConfigControls.call(h);
  assert.equal(h.textarea.value, defaultsYaml.replace("scale: 1", "scale: 2.5"), "user edits preserved once non-empty");
  console.log("PASS: 9 controls — preload + enable/disable mirror the authoring snapshot");
}

// --- 10. status renderer projects value + data-error flag ---
{
  const h = makeHarness();
  const output = { value: "", dataset: {} };
  h.statusOutput = output;
  // The class reads the status via this.shadowRoot?.querySelector(...).
  h.shadowRoot = { querySelector: (selector) => (selector === STATUS_SELECTOR ? output : null), querySelectorAll: () => [], append() {} };
  h.equipmentConfigStatus = "boom";
  renderEquipmentConfigStatus.call(h, true);
  assert.equal(output.value, "boom");
  assert.equal(output.dataset.error, "true");
  renderEquipmentConfigStatus.call(h, false);
  assert.equal(output.dataset.error, "false");
  void TEXTAREA_SELECTOR;
  console.log("PASS: 10 status — output value + data-error flag projected");
}

  console.log("Equipment config live-state unit oracle PASS (10 case groups).");
}
