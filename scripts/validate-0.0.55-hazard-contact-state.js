// @ts-check
// 0.0.55 W1: the assembly frame's hazardContact normalization must accept BOTH
// `null` and `undefined` for "absent" sinceMs/releasedAtMs. The gameplay session
// snapshot emits `null` for absent fields (aerobeat-web-gameplay
// `session-coordinator.js` — `Object.freeze({ active, sinceMs, releasedAtMs })`
// where the absent ones are `null`), so a normalizer that only accepts
// `undefined` returns `null` for EVERY real shape → the frame field is always
// omitted → the renderer's during-collision state-driven vignette never fires.
//
// This oracle exercises the exact `normalizedHazardContactState` source from
// `src/index.js` (a private top-level function) by importing the source text and
// evaluating just that function in a clean scope. The three real snapshot shapes
// must normalize to non-null; genuinely invalid shapes must still return null.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Pull the exact `normalizedHazardContactState` function source out of
// src/index.js so we test the shipped implementation, not a copy.
const source = readFileSync("src/index.js", "utf8");
const match = source.match(/function normalizedHazardContactState\([\s\S]*?\n\}/u);
assert.ok(match, "normalizedHazardContactState must be present in src/index.js");
// The function body must be a plain statement (no class / method context).
assert.doesNotMatch(match[0], /^\s+async\s+function/u, "normalizedHazardContactState must be a top-level function");

// Evaluate just that function declaration in a clean scope.
/** @type {(value:unknown)=>unknown} */
const normalizedHazardContactState = new Function(`${match[0]}; return normalizedHazardContactState;`)();

// ---------- The three REAL snapshot shapes (the gameplay coordinator emits `null` for absent) ----------
{
  // 1. Active collision, `releasedAtMs` is `null` (the common "contact active" shape).
  const active = normalizedHazardContactState(Object.freeze({ active: true, sinceMs: 1200, releasedAtMs: null }));
  assert.deepEqual(active, Object.freeze({ active: true, sinceMs: 1200, releasedAtMs: null }), "active:true with releasedAtMs=null normalizes to the non-null frozen state");

  // 2. Released: `sinceMs` is `null`, `releasedAtMs` is a finite number.
  const released = normalizedHazardContactState(Object.freeze({ active: false, sinceMs: null, releasedAtMs: 3400 }));
  assert.deepEqual(released, Object.freeze({ active: false, sinceMs: null, releasedAtMs: 3400 }), "active:false with sinceMs=null and releasedAtMs finite normalizes");

  // 3. Idle: both absent (`null`).
  const idle = normalizedHazardContactState(Object.freeze({ active: false, sinceMs: null, releasedAtMs: null }));
  assert.deepEqual(idle, Object.freeze({ active: false, sinceMs: null, releasedAtMs: null }), "active:false with both absent normalizes");
}

// ---------- `undefined` (legacy shape) still accepted as "absent" ----------
{
  const activeUndefined = normalizedHazardContactState({ active: true, sinceMs: 1200 });
  assert.deepEqual(activeUndefined, Object.freeze({ active: true, sinceMs: 1200, releasedAtMs: null }), "active:true with releasedAtMs omitted (undefined) still normalizes");
  const releasedUndefined = normalizedHazardContactState({ active: false, releasedAtMs: 3400 });
  assert.deepEqual(releasedUndefined, Object.freeze({ active: false, sinceMs: null, releasedAtMs: 3400 }), "active:false with sinceMs omitted (undefined) still normalizes");
}

// ---------- Genuinely invalid shapes still return null ----------
{
  // active:true requires sinceMs to be a finite number ≥ 0.
  assert.equal(normalizedHazardContactState({ active: true, sinceMs: null, releasedAtMs: null }), null, "active:true with sinceMs=null is invalid");
  assert.equal(normalizedHazardContactState({ active: true, sinceMs: -1, releasedAtMs: null }), null, "active:true with sinceMs<0 is invalid");
  assert.equal(normalizedHazardContactState({ active: true, sinceMs: Number.NaN, releasedAtMs: null }), null, "active:true with sinceMs=NaN is invalid");
  assert.equal(normalizedHazardContactState({ active: true, sinceMs: "1200", releasedAtMs: null }), null, "active:true with sinceMs non-numeric is invalid");
  // active:true requires releasedAtMs to be null OR undefined.
  assert.equal(normalizedHazardContactState({ active: true, sinceMs: 1200, releasedAtMs: 3400 }), null, "active:true with releasedAtMs a number is invalid");
  // active:false requires sinceMs to be null OR undefined.
  assert.equal(normalizedHazardContactState({ active: false, sinceMs: 1234, releasedAtMs: null }), null, "active:false with sinceMs a number is invalid");
  // active:false requires releasedAtMs to be null OR a finite number ≥ 0.
  assert.equal(normalizedHazardContactState({ active: false, sinceMs: null, releasedAtMs: -5 }), null, "active:false with releasedAtMs<0 is invalid");
  assert.equal(normalizedHazardContactState({ active: false, sinceMs: null, releasedAtMs: Number.NaN }), null, "active:false with releasedAtMs=NaN is invalid");
  // active must be a boolean.
  assert.equal(normalizedHazardContactState({ active: "yes", sinceMs: null, releasedAtMs: null }), null, "active must be a boolean");
  assert.equal(normalizedHazardContactState({ active: 1, sinceMs: null, releasedAtMs: null }), null, "active=1 (non-boolean) is invalid");
  // Missing active.
  assert.equal(normalizedHazardContactState({ sinceMs: null, releasedAtMs: null }), null, "missing active is invalid");
  // Non-object / null / array.
  assert.equal(normalizedHazardContactState(null), null, "null value is invalid");
  assert.equal(normalizedHazardContactState("nope"), null, "non-object is invalid");
  assert.equal(normalizedHazardContactState([true, 1200, null]), null, "array is invalid");
}

console.log("0.0.55 W1 hazard-contact-state null-tolerance oracle passed.");
