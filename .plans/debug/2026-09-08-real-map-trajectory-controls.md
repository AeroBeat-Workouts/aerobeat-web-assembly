# Real-map Visual Test trajectory controls diagnosis

**Date:** 2026-09-08  
**Bead:** `aerobeat-web-assembly-zrmj`  
**Related QA Bead:** `aerobeat-web-assembly-q25l`  
**Disposition:** DIAGNOSED; no product-code change and no fix claim

## Exact Observed Failure

Derrick's direct physical observation is authoritative: after a hard refresh of raw `0.0.44`, Flow Test on the usual DDR map responds to Boxing lane separation, but sky prelude, bounce, and appearance distance do not visibly respond at any setting.

The same failure was reproduced against the already-running immutable raw `0.0.44` at `127.0.0.1:5173` without rebuilding, changing releases, or starting a server. The exact committed `3c9d` Hard fixture was verified as `89,424` bytes with SHA-256 `4db5b3393a389c7bcaba6d7a02aec57c10801bcfd74de91523b8e9cdad859b55`, converted by raw `0.0.44`'s actual browser authoring service and Worker, persisted as downloaded package `ab-songpkg-dance-dance-revolution-ddrmix-5662f64a12c7-hard`, selected through the actual downloaded-library path, and started with a trusted click on the actual `<aero-game>` **Test** action. The resulting session was `paused_manual / visual_test`, unranked, on the exact selected package and Flow chart.

Private child-local instrumentation observed the first real note:

- authored value: `{ start: 21, type: "note", hand: "right", placement: 11, direction: 7 }` after canonical top-left conversion;
- `centerTimestampMs: 8400` from the package's `150 BPM` timing;
- default config reached both assembly and renderer exactly (`bounceLeadBeats: 4`, height `.9`, normal distance `15`, sky off);
- maximum-obvious config also reached both exactly (`bounceLeadBeats: 8`, height `1.5`, apex `.5`, normal distance `72`, sky prelude height `24`, duration `10000`, linear easing);
- nevertheless, under both configs the session index recorded `bounceStartMs: null`, `normalSpawnMs: null`, and `skyPreludeStartMs: null` for every hittable event.

Both configs therefore produced byte-equivalent sampled target/model positions:

| Song ms | Default | Extreme |
|---:|---|---|
| `5899` | absent | absent |
| `5900` | `(x 1.5, y 0, z -15)` | `(x 1.5, y 0, z -15)` |
| `6800` | `(x 1.5, y 0, z -9.6)` | `(x 1.5, y 0, z -9.6)` |
| `7600` | `(x 1.5, y 0, z -4.8)` | `(x 1.5, y 0, z -4.8)` |
| `8400` | `(x 1.5, y 0, z 0)` | `(x 1.5, y 0, z 0)` |

The shadow remained at `y -0.702`. No console/page error occurred, and no trajectory field entered the public snapshot.

Direct observation ends there. The causal explanation below is source-backed diagnosis.

## Expected Behavior

For the same selected downloaded package and actual Test action:

- a valid authored note must receive non-null absolute `bounceStartMs`, `normalSpawnMs`, and `skyPreludeStartMs` from its canonical song timing;
- normal distance must independently change first visibility at world `Z = -normalSpawnDistanceWorldUnits`;
- sky prelude must start elevated and join the normal lane exactly at `normalSpawnMs`;
- bounce must rise and fall during the useful approach and land at authored base Y / world `Z = 0` at `centerTimestampMs`;
- config changes must invalidate/rebuild the private index;
- bombs, obstacles, checkpoints, static surfaces, feedback, environment, cursors, scoring, timing, and public data remain unaffected.

At a later `150 BPM` note with authored beat `50` / center `20000 ms`, a valid mapper produces exact default timestamps `bounceStartMs 18400`, `normalSpawnMs 17500`, `skyPreludeStartMs 17500`; the extreme values produce `bounceStartMs 16800`, `normalSpawnMs 8000`, `skyPreludeStartMs 0`.

## Execution Path

1. The Test presentation DOM inputs emit `input` and `change`; assembly `handleInteractionInput()` calls `applyTestPresentationControls()`.
2. `createTestPresentationConfig()` constructs the renderer-branded strict value. `commitTestPresentationConfig()` sends the same branded identity to `renderer.setTestPresentationConfig()`, stores it in `game.testPresentationConfig`, nulls `renderPresentationConfig`, and rerenders controls.
3. The exact `3c9d` bytes travel through browser authoring conversion, IndexedDB persistence, downloaded-library refresh/selection, content package load, and Flow variant selection.
4. Content validates the package timing by adapting canonical null-prototype package records to ordinary records in `package-content.js::readTimingMapper()`. Its private `loadedBeatToTimelineMs` is valid and creates resolved events; the first note's authored beat `21` and center `8400 ms` agree exactly.
5. Content's private render projection returns a stable event-array identity. Config changes correctly force assembly index replacement because `renderPresentationConfig !== testPresentationConfig`.
6. Assembly `rendererFrame()` does **not** use content's already-validated private mapper. It calls strict `createAuthoredBeatToTimelineMs(content.song.timing)` on the public snapshot's canonical package timing record.
7. Canonical package cloning intentionally uses `Object.create(null)` for records. Instrumentation observed `Object.getPrototypeOf(content.song.timing) !== Object.prototype`, and the same is true for tempo/time-signature segment records. Arrays are ordinary exact frozen arrays.
8. The contracts mapper requires every timing record and segment to have exact `Object.prototype`. It throws `TypeError: Invalid authored song timing`. Assembly catches that error silently and leaves `mapBeatToTimelineMs = null`.
9. `createSessionTargetIndex()` receives no mapper. Its trajectory derivation conditional does not run, leaving all three timestamps null. `timingMismatchCount` remains `0`, because this counter increments only when an available mapper disagrees or throws per event; mapper creation failure is not counted.
10. `projectSessionTargets()` sees null trajectory fields. Its fallback `presentationStartMs` is null, so visibility falls back to the legacy fixed `FLOW_APPROACH_LEAD_MS = 2500`, producing first visibility at `8400 - 2500 = 5900 ms` / `Z = -15` regardless of configured distance or sky.
11. Renderer receives the correct branded config but `hasTrajectory === false`. It intentionally gates both `testPresentationBounceOffsetY()` and `testPresentationSkyOffsetY()` on `hasTrajectory`, so both offsets remain zero. The unchanged canonical Z projection still advances from `-15` to `0`.
12. Boxing lane separation works because renderer `boxingLanes(presentationConfig)` consumes `boxingLaneSeparationWorldUnits` directly from the branded config. It does not depend on authored timing or trajectory timestamps.

## Most Likely Root Cause

**Confirmed root cause:** assembly revalidates the content snapshot's canonical null-prototype timing record directly with an API that intentionally accepts only exact ordinary objects. The resulting caught `Invalid authored song timing` removes the mapper before index construction. This is a representation-boundary mismatch, not a beat/center numerical mismatch.

Evidence:

- actual raw real-package values: authored beat `21`, center `8400 ms`, exact `150 BPM` timing;
- timing and segment prototypes are null, while their exact keys/data descriptors and arrays are otherwise valid;
- a null-prototype timing record passed to the same mutable contracts mapper rejects with exact message `Invalid authored song timing`;
- adapting the same scalar/array values to ordinary records immediately yields exact non-null default/extreme trajectory timestamps;
- every real index entry has all three trajectory fields null while `timingMismatchCount` misleadingly remains zero;
- default and extreme configs reach renderer unchanged but produce identical first visibility, Y, and Z samples;
- relevant assembly `src/index.js` / `src/session-render-projection.js` are unchanged between release commit `d581aace7a508057d0351532a01066036bf777c9` and mutable `HEAD`; renderer/content mutable `HEAD`s exactly equal raw `0.0.44` pins `258c9407213e703318578cf7d474658112c99036` and `de4917a3c7630b6666b64eeb7e60c1b98a486cc7`.

## Alternative Hypotheses

Ranked by likelihood after testing:

1. **Null-prototype timing representation mismatch — confirmed.** It alone explains mapper absence, null timestamps, legacy visibility, zero offsets, and working separation.
2. **Stale/incorrect package timing shape — rejected numerically, causal only representationally.** Timing values are exact (`anchor 0`, one `150 BPM` segment, no stops, standard `4/4`), content used them successfully, and authored start/center agree. Only prototype shape conflicts with the second strict mapper call.
3. **Timing mismatch — rejected.** `21 × 60000 / 150 = 8400`; adapted mapper agrees. This is not tempo, stop, anchor, unit, or center drift.
4. **Event-array identity churn — rejected.** Two consecutive private projection reads returned the same array identity; `renderEventIndex.events` is that exact array.
5. **Index not replaced after UI change — rejected.** `commitTestPresentationConfig()` nulls the config sentinel, and the extreme pass rebuilt an index with the extreme config. It still lacked a mapper.
6. **UI value/change or branded config failure — rejected.** Actual input/change handling committed exact default and extreme values; assembly and renderer held matching branded configs and status reported `Test presentation updated.`
7. **Projection fallback/culling defect as the initiating cause — rejected, but it exposes the symptom.** Fallback behaves as coded: fixed `2500 ms` visibility and straight Y. It is downstream of missing timestamps.
8. **Units/distance conversion error — rejected.** `.006 world units/ms` correctly maps `15 → 2500 ms` and `72 → 12000 ms`; adapted-mapper timestamp tests produce the expected values.
9. **Authored event type/eligibility mismatch — rejected.** Real events are exact `type: "note"`; the first and all other notes increment `feedbackIndex` and are renderable.
10. **Renderer trajectory math failure — rejected for this failure class.** Renderer never receives trajectory timestamps. Its direct config path works for lane separation and its model correctly gates time-based offsets on complete trajectory metadata.

## Why Previous Fixes Failed

The raw `0.0.43` diagnosis and source repair proved trajectory math with synthetic ordinary-object events/timing and direct renderer/model samples. The subsequent `0.0.44` gates converted exact `3c9d` bytes only for obstacle pixels/AABBs, while trajectory tests used synthetic events or fixture installation paths whose timing records were ordinary objects. They therefore never crossed the exact canonical downloaded-package snapshot representation used by the real Test action.

The prior implementation also treated content validation and assembly remapping as equivalent. Content already knew canonical package records require adaptation before the strict contracts mapper; assembly independently repeated mapping against the exposed null-prototype record and swallowed the rejection. Security, branding, lifecycle, endpoint, and pixel tests passed because they did not assert non-null child-local trajectory timestamps after actual conversion, persistence, downloaded selection, and Test.

## Unknowns

- Derrick's final preferred physical defaults remain unknown and are not inferred here.
- Whether the eventual fix should expose content's already-validated mapper through a new private symbol or adapt timing records once in assembly is a design choice. The smallest patch is assembly-local adaptation; the cleaner single-authority design is a private content mapper seam.
- Direct/iframe/mobile post-fix behavior is not tested because this task explicitly forbids implementation and fix claims.

## Minimal Reproduction

1. Keep immutable raw `0.0.44` served unchanged and hard-refresh a fresh browser context.
2. Verify exact fixture `flow-obstacle-3c9d-hard-v1.dat`: `89,424` bytes, SHA-256 `4db5b3393a389c7bcaba6d7a02aec57c10801bcfd74de91523b8e9cdad859b55`.
3. Through the raw app's actual browser authoring service/Worker, convert Hard at `150 BPM` with source `3C9D` / version `5662f64a12c76a3dd11a5f6ee22611608cd06760`; persist it, refresh the downloaded library, and select package `ab-songpkg-dance-dance-revolution-ddrmix-5662f64a12c7-hard`.
4. Click the actual `<aero-game>` Test button, then pause through the actual Visual Test transport.
5. Change the real Test presentation fields through their input/change path from defaults to bounce `8 / 1.5 / 50%`, distance `72`, sky `prelude / 24 / 10000 / linear`.
6. Only in child-local test instrumentation, inspect `content.song.timing`, private projected events, `renderEventIndex`, `rendererFrame().targets`, and renderer model objects.
7. Observe exact first note beat/center `21 / 8400`, null-prototype timing/segments, all three index timestamps null, target absent at `5899`, visible at fixed `5900` and `Z -15`, `Y 0` throughout, and identical default/extreme samples.

Condition where failure does not occur: adapt the same timing scalar/array data into exact ordinary objects before calling the strict mapper. A beat-50 event then derives the non-null default/extreme timestamps listed under Expected Behavior.

## Proposed Verification

Before accepting any code fix, add one regression that performs the complete real path in direct, genuine cross-origin iframe, and mobile viewports:

1. exact immutable `3c9d` bytes → actual browser Worker conversion;
2. IndexedDB downloaded-package persistence/reload;
3. actual library selection and trusted Test action;
4. actual input/change updates for default and extreme configs;
5. child-local assertions that authored start maps to center, `timingMapperUnavailableCount` (or equivalent explicit diagnostic) is zero, all eligible note/guard/punch timestamps are finite, and the index retains exact event identity;
6. seek just before/at sky start, normal boundary, bounce start/apex, and hit; assert expected visibility, nonzero/different Y, exact configured `Z` boundary, continuous sky join, and exact landing;
7. assert default/extreme framebuffers differ materially for sky/bounce/distance while lane separation still changes Lanes geometry;
8. assert bombs/walls/checkpoints/static surfaces and public snapshots/events/messages/privacy/lifecycle remain unchanged.

The test must fail against raw/source `0.0.44` specifically because all three timestamps are null. Synthetic direct event injection is insufficient.

## Recommended Fix

Smallest fix: in assembly `rendererFrame()`, adapt the already-trusted content timing snapshot into exact ordinary timing/segment records before calling `createAuthoredBeatToTimelineMs`, using the same field allowlist and semantics as content's `readTimingMapper()`. Do not relax `isAuthoredSongTiming()`, accept null-prototype arbitrary inputs globally, suppress renderer checks, or fabricate event timestamps.

Cleaner follow-up if preferred: expose content's already-validated snapshotted mapper through a non-enumerable private content→assembly symbol and consume it directly, eliminating duplicate validation/mapping authority. Keep it absent from public snapshots/events/messages.

Also add an explicit private diagnostic for mapper-construction failure; `timingMismatchCount: 0` currently looks healthy when no mapper exists.

Regression risk is concentrated at strict data-shape/security boundaries, tempo/stop mapping, event-index invalidation, seek/restart, and privacy. The real-package direct/iframe/mobile regression above is required.

## Debugging Record

```text
Problem: Raw 0.0.44 real downloaded maps ignore sky prelude, bounce, and normal appearance distance while lane separation works.
Observed symptom: Exact 3c9d first note stays absent until 5900 ms, then travels straight at Y 0 from Z -15 to 0 under both default and extreme configs; index trajectory timestamps are all null.
Root cause: Assembly passes canonical null-prototype content snapshot timing directly to the strict ordinary-object authored timing mapper, catches `Invalid authored song timing`, and builds the index without a mapper.
Evidence: Exact real conversion/persistence/selection/Test; beat 21 == 8400 ms at 150 BPM; null timing/segment prototypes; stable event identity; config reaches renderer; adapted ordinary timing derives exact timestamps; raw and mutable relevant sources match.
Failed approaches: Synthetic ordinary-object trajectory tests and exact-3c9d obstacle-only browser pixels never crossed canonical downloaded timing shape through the actual Test action.
Corrective action: Adapt trusted timing to exact ordinary records in assembly, or consume content's validated mapper through a private symbol; add explicit mapper-unavailable diagnostics.
Verification test: Exact 3c9d Worker conversion → IndexedDB downloaded selection → trusted Test → real control input/change → private timestamp/model/framebuffer assertions across direct/iframe/mobile.
Related files/components: assembly src/index.js rendererFrame; src/session-render-projection.js; content runtime/package-content/runtime-data; contracts authored-timing; renderer gameplay-scene-model/test-presentation-config.
Remaining uncertainty: Assembly-local adapter versus private validated-mapper seam; Derrick's final physical tuning defaults.
```
