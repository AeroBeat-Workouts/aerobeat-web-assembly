# Test-to-Play Equipment Parity and Latest Flow Defaults

> **STATUS (2026-09-25): ACTIVE — Derrick directly authorized immediate execution. Diagnosis precedes code changes. Raw 0.0.69 and its active service remain immutable/unchanged.**

## Goal

Bake Derrick's latest strict v4 equipment YAML as the canonical source defaults and repair the live equipment path so the exact in-memory Test-authored config and wrist-driven Flow/Boxing poses are used in Play.

## User-observed failure

- Latest source: `/home/derrick/Downloads/aerobeat-equipment-config.yaml`, modified `2026-09-25 10:11:20 -0400`, 1,535 bytes, SHA-256 `25c487b1b20d31b146b01029e05f7624e1fc54b69feb51a9297596fbd8b9a066`.
- Derrick reports that equipment changes made in Visual Test appear not to carry into Play; in Flow, sabers did not respond as wrists/markers moved.
- Expected: one canonical in-memory equipment config and identity remain authoritative across Test→Play, and each live Play frame derives visible and hit-bearing equipment from the current measured wrist anchors.

## Scope and invariants

- Migrate/bake the downloaded strict v4 document without hand-transcribing values.
- Do not persist private authoring state or equipment config to storage, snapshots, events, messages, telemetry, packages, or network.
- Preserve the exact same frozen resolved pose objects at the gameplay/renderer boundary.
- Flow remains cadence-independent and position-authoritative; Boxing keeps its fixed-endpoint state easing.
- Preserve tracking safety, calibrated freeze, off-grid position truth, and config identity semantics.
- Do not mutate or rebuild `release/raw/0.0.69`; do not bump/package/publish/switch the active service without a separate Derrick instruction.

## Beads and roles

- Umbrella: `aerobeat-web-assembly-ammq` — claimed by orchestrator.
- Coder/diagnosis: `aerobeat-web-assembly-zukg` — claimed; diagnose and repair.
- QA: `aerobeat-web-assembly-8k54` — independent verification after implementation.
- Auditor: `aerobeat-web-assembly-vr15` — final diff/evidence audit.

## Diagnostic report

### Exact Observed Failure

Direct observation from Derrick: after authoring equipment values in Test and entering Play, Flow sabers did not respond with wrist/marker movement. No browser exception or stack trace was supplied. Source inspection directly observes that Test and Play both retain `this.equipmentConfig`, but the Flow orientation path treats them differently.

### Expected Behavior

The validated config and its SHA-256 identity must survive a Test→Play action within the same connected element. In Play, each display frame must derive each saber's spatial anchor and square-radial orientation from the same current private input snapshot before one resolved pose array is sent to gameplay and renderer.

### Execution Path

1. Visual Test controls queue `commitEquipmentConfig(candidate)`.
2. That assigns `this.equipmentConfig` and `this.equipmentConfigIdentity`; Play startup does not reset either.
3. `runDisplayFrame()` obtains `graph.input.getSnapshot()` for Play and passes it as `poseInput` to `resolveEquipmentPoses()`.
4. `resolveEquipmentPoses()` passes `poseInput` to `gameplayEquipmentRecords()` for spatial anchors.
5. However, for Flow orientation it calls `computeFlowQuaternionTargets(graph, visualTest ? poseInput : null)`.
6. In Play, `computeFlowQuaternionTargets()` therefore ignores the current private input and attempts `graph.gameplay.getSnapshot().anchors`.
7. Gameplay's public/privacy-bounded snapshot has no raw anchor array, so both hands take static edge fallback positions.
8. The resulting spatial anchor may move while the orientation target remains fixed, contradicting position-authoritative Flow behavior and the Test path.

### Most Likely Root Cause

The Play-only `null` override at `src/index.js` in `resolveEquipmentPoses()` disconnects Flow orientation from the current measured input. This is a normal-use acceptance violation and the leading cause because it deterministically forces static fallback orientation for every Play frame while Test receives live/synthetic anchors.

### Alternative Hypotheses

1. **Config reset during action switch — contradicted/high confidence rejected.** `startSession()` calls `ensureEquipmentConfigIdentity()` and never resets `this.equipmentConfig`; reset occurs only on connection teardown/destroy.
2. **Equipment suppressed by safety/freeze — plausible only under degraded tracking.** `gameplayEquipmentRecords()` intentionally omits poses for paused/fresh-calibration states and freezes retained anchors during calibrated confidence loss. This cannot explain a healthy session where markers visibly move.
3. **Renderer owns a separate stale pose — contradicted.** `runDisplayFrame()` passes the same `frameEquipmentPoses` array into gameplay advance and render.
4. **Spatial anchors are stale because `latestEvidence` is stale — lower likelihood.** The input service publishes current measured evidence and explicit frozen evidence. A targeted Play oracle must still prove position changes across distinct measured frames.

### Why Previous Fixes Failed

The 0.0.69 fix removed stateful Flow orientation cadence history and correctly made orientation a stateless position field, but existing tests concentrated on Visual Test pointer input and pure pose records. They did not assert that real Play input is forwarded into the Flow target computation. The fix addressed cadence divergence while leaving a Play/Test input-source split.

### Unknowns

- Whether Derrick observed fixed orientation only or both fixed orientation and position; a deterministic browser/runtime oracle will measure both separately.
- Whether Boxing already tracks correctly in Play; it shares spatial pose resolution but not the broken Flow target call. QA must prove both modes.
- Whether any Play browser oracle currently exercises two distinct measured wrist frames through the assembly display path; initial search suggests it does not.

### Minimal Reproduction

1. Connect one game and load a Flow variant.
2. Author a non-default config in Visual Test and retain its identity.
3. Start Play with a ready calibrated input snapshot.
4. Feed two valid measured frames with distinct left/right wrist positions.
5. Run display frames and capture the shared equipment array.
6. Current behavior: pose anchors may change, but Flow target orientations correspond to the static `{left:(0,.5), right:(1,.5)}` fallbacks rather than each measured wrist position.

### Proposed Verification

Add a targeted Play-mode oracle that stubs two valid measured input snapshots, captures gameplay and renderer equipment arrays, and asserts:

- the authored config identity is unchanged across Test→Play;
- both arrays are the exact same frozen objects;
- anchors change with measured wrists, including off-grid positions;
- Flow orientation equals `squareRadialSaberTarget()` for each current measured wrist, not the static fallback;
- Boxing anchors change and use the same authored config identity;
- safety/frozen/no-input behavior remains fail-closed.

### Recommended Fix

Pass the already-selected private `poseInput` into `computeFlowQuaternionTargets()` for both Test and Play. Keep all pose/config data inside the existing private graph and preserve the same final pose contract. Bake the downloaded YAML with the repository's strict bake script, then update focused defaults/oracles.

### Debugging Record

```text
Problem: Test-authored equipment appeared not to carry into Play; Flow sabers did not follow wrists.
Observed symptom: Physical 0.0.69 Play test showed nonresponsive Flow sabers while wrist markers moved.
Root cause: Play Flow orientation discarded the current private input and read privacy-bounded gameplay snapshot anchors, forcing static edge fallbacks.
Evidence: resolveEquipmentPoses passes null to computeFlowQuaternionTargets in Play; gameplay snapshot exposes no raw anchors; Test passes poseInput.
Failed approaches: 0.0.69 stateless cadence repair covered Visual Test/pure field behavior but had no real Play-input forwarding oracle.
Corrective action: Forward current poseInput for Flow in both purposes; bake latest strict v4 defaults.
Verification test: Test→Play assembly oracle with two measured wrist frames, config identity parity, exact shared pose objects, Flow quaternion and Boxing anchor assertions.
Related files/components: src/index.js, src/equipment-config-defaults.js, scripts/bake-equipment-config.js, equipment panel/pose oracles, input/gameplay privacy boundary.
Remaining uncertainty: Physical report may include a separate spatial-anchor symptom; targeted oracle and QA will distinguish it.
```

## Execution tasks

### Task 1 — Diagnose and pin regression (`zukg`)
- [x] Trace Test authoring through Play start.
- [x] Record the diagnostic report before source edits.
- [x] Add a focused failing Play-mode regression oracle.

**Result (2026-09-25):** Added a source-bound regression assertion around `resolveEquipmentPoses()` that requires both Test and Play Flow orientation to pass the selected private `poseInput` into `computeFlowQuaternionTargets()`. Before the fix it failed exactly with `AssertionError: Test and Play Flow orientation must consume the current private pose input` at `scripts/validate-equipment-config-live-state.js:64`.

### Task 2 — Bake latest defaults and repair Play input (`zukg`)
- [x] Preserve the downloaded YAML byte-for-byte as a provenance fixture.
- [x] Run the strict bake path and inspect the canonical defaults diff.
- [x] Make the smallest Play Flow input-source fix.
- [x] Run focused unit/browser tests and commit/push.

**Result (2026-09-25):** Preserved the 1,535-byte download as `scripts/fixtures/aerobeat-equipment-config-2026-09-25.yaml`; source and fixture both hash to `25c487b1b20d31b146b01029e05f7624e1fc54b69feb51a9297596fbd8b9a066` and `cmp` reports byte identity. Ran `node scripts/bake-equipment-config.js` on that fixture, updated exact defaults/export/identity expectations, and changed the Play Flow call to forward `poseInput` without adding any public or persistence surface. Focused config, identity, live-state, frozen-pose, Boxing orientation, square-radial Flow orientation, and equipment-panel browser validations pass. `release/raw/0.0.69` remains the exact tree `59367ea923b7a6773f624e7e2f0673dcce3ddb5e`.

**Runtime-gate follow-up (2026-09-25):** Extended `scripts/validate-equipment-config-panel-browser.js` to drive the real connected component's `runDisplayFrame()` in Play purpose through two distinct measured frames for both wrists in Flow and Boxing. The oracle starts from a live Test-authored config, proves the exact in-memory config identity remains unchanged, independently computes each expected square-radial Flow quaternion and rejects both static fallback endpoints, proves Boxing and Flow anchors follow both measured frames including off-grid coordinates, and verifies the exact same deeply frozen pose array and objects reach gameplay and renderer on every frame. It also checks that measured wrists/config remain absent from public snapshots and storage. `npm run test:equipment-config-panel` passes with the explicit runtime-gate line `PASS: Play Flow/Boxing two-frame measured wrists, identity parity, exact frozen shared poses, and non-fallback quaternions`.

### Task 3 — Independent QA (`8k54`)
- [x] Verify exact downloaded values/default reset/export.
- [x] Verify Test→Play config identity and live Flow/Boxing wrist motion.
- [x] Run relevant regression suites and report triaged findings.

**Result (2026-09-25):** Independent QA child `da8e03d1-6dcc-4b5f-a952-351072104f98` returned **GO** on pushed commit `948d9a8d714d7de66ba6fabb4f5a734c95ac3750`, with no likely risk, stale documentation, or unlikely bug in scope. Fixture/default/config identity and the real two-frame Play-purpose Flow/Boxing oracle passed. Focused suites, `npm test`, and a complete `npm run test:browser` rerun passed; the first foreground browser run was harness-killed at its 600-second cap rather than failing an assertion, and the uncapped rerun exited 0. Raw `0.0.69` remained exact and the checkout remained clean.

### Task 4 — Independent audit and wrap (`vr15`)
- [ ] Audit diagnosis, diff, provenance, privacy, tests, Beads, commits, and push.
- [ ] Fix likely risks; file non-blocking stale/unlikely findings.
- [ ] Finalize plan, close completed Beads, and verify clean upstream.

## Validation

- Focused defaults/config/pose/orientation tests.
- New Play-mode assembly oracle with at least two measured frames per hand.
- `npm run test:equipment-config-panel`.
- Relevant unit suite and complete browser suite before wrap.
- Raw `0.0.69` tree remains `59367ea923b7a6773f624e7e2f0673dcce3ddb5e`.
