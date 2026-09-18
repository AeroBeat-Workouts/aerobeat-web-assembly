// @ts-check
// 0.0.55 W1: the assembly frame's hazardContact normalization must accept BOTH
// `null` and `undefined` for "absent" sinceMs/releasedAtMs. The gameplay session
// snapshot emits `null` for absent fields (aerobeat-web-gameplay
// `session-coordinator.js` — `Object.freeze({ active, sinceMs, releasedAtMs })`
// where the absent ones are `null`), so a normalizer that only accepts
// `undefined` returns `null` for EVERY real shape → the frame field is always
// omitted → the renderer's during-collision state-driven vignette never fires.
//
// 0.0.61 L-B3 (3gb2): the released state RETAINS the episode's entry sinceMs —
// the renderer's contract (aerobeat-web-renderer `gameplay-scene-model.js`,
// `isValidHazardContactActive`) requires it so the release-moment pulse phase
// stays recomputable statelessly from (sinceMs, releasedAtMs, params); a null
// sinceMs zeroes `hazardWallContactReleasedIntensity` and snap-offs the
// vignette at exit. So `active:false` with a finite sinceMs ≥ 0 AND a finite
// releasedAtMs ≥ 0 must now be admitted and passed through frozen.
//
// This oracle exercises the exact `normalizedHazardContactState` source from
// `src/index.js` (a private top-level function) by importing the source text and
// evaluating just that function in a clean scope. The real snapshot shapes
// (active, released-with-sinceMs, released-without-sinceMs, idle) must
// normalize to non-null; genuinely invalid shapes must still return null.
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

  // 2. Released with the episode's entry sinceMs RETAINED (the 0.0.61 L-B3
  // contract shape): admitted and passed through frozen, exact values.
  const releasedRetained = normalizedHazardContactState(Object.freeze({ active: false, sinceMs: 1012.5, releasedAtMs: 1300 }));
  assert.deepEqual(releasedRetained, Object.freeze({ active: false, sinceMs: 1012.5, releasedAtMs: 1300 }), "released WITH sinceMs admitted and passed through frozen, exact values");
  assert.equal(Object.isFrozen(releasedRetained), true, "released-with-sinceMs output is frozen");

  // 2b. Released without sinceMs (legacy/interim shape): still admitted.
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

// ---------- 0.0.61 L-B3: released-with-sinceMs edge cases ----------
{
  // Degenerate-but-valid: entry at t=0.
  const releasedZero = normalizedHazardContactState(Object.freeze({ active: false, sinceMs: 0, releasedAtMs: 500 }));
  assert.deepEqual(releasedZero, Object.freeze({ active: false, sinceMs: 0, releasedAtMs: 500 }), "released with sinceMs:0 admitted (finite, ≥ 0)");
  // Release at exactly the entry tick (zero-duration episode).
  const releasedSame = normalizedHazardContactState(Object.freeze({ active: false, sinceMs: 1300, releasedAtMs: 1300 }));
  assert.deepEqual(releasedSame, Object.freeze({ active: false, sinceMs: 1300, releasedAtMs: 1300 }), "released with releasedAtMs === sinceMs admitted (zero-duration episode)");
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
  // Inactive: sinceMs may be a finite number ≥ 0 only together with a release
  // instant (L-B3) — sinceMs without releasedAtMs is not a valid released state.
  assert.equal(normalizedHazardContactState({ active: false, sinceMs: 1234, releasedAtMs: null }), null, "active:false with sinceMs a number but releasedAtMs=null is invalid (no release instant)");
  assert.equal(normalizedHazardContactState({ active: false, sinceMs: 1234 }), null, "active:false with sinceMs a number and releasedAtMs omitted is invalid");
  // Release cannot precede entry.
  assert.equal(normalizedHazardContactState(Object.freeze({ active: false, sinceMs: 3400, releasedAtMs: 1200 })), null, "active:false with releasedAtMs < sinceMs is invalid");
  // Released sinceMs must be a finite number ≥ 0.
  assert.equal(normalizedHazardContactState(Object.freeze({ active: false, sinceMs: Number.NaN, releasedAtMs: 3400 })), null, "released with sinceMs=NaN is invalid");
  assert.equal(normalizedHazardContactState(Object.freeze({ active: false, sinceMs: -1, releasedAtMs: 3400 })), null, "released with sinceMs<0 is invalid");
  assert.equal(normalizedHazardContactState(Object.freeze({ active: false, sinceMs: "1012.5", releasedAtMs: 1300 })), null, "released with sinceMs non-numeric is invalid");
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
