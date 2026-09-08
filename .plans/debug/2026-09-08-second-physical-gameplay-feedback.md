# Second physical gameplay feedback diagnosis and successor plan

**Date:** 2026-09-08

**Physical target:** immutable raw `@aerobeat/web-assembly@0.0.45`

**Implementation Beads:** `aerobeat-web-assembly-yhie`, `aerobeat-web-assembly-orz4`, `aerobeat-web-assembly-tu2h`

**Independent QA / audit:** `aerobeat-web-assembly-ypdm`, `aerobeat-web-assembly-wari`

**Physical gate:** `aerobeat-web-assembly-k72.17`

**Disposition:** DIAGNOSIS ONLY; no product, asset, or test source changed and no implementation, build, version, serve, immutable mutation, or PASS is claimed

## Scope and immutable authorities

This report diagnoses Derrick's second physical review of raw `0.0.45`:

1. raise the sky-prelude-height maximum to `50`;
2. make Flow, Boxing Lanes, and Boxing Grid obstacles appear at the same normal distance as beats;
3. remove deeper-red wall bands/sections;
4. add a normal **Game Setup** show/hide control for the Flow/Boxing Grid `4 × 3` body grid while nose/wrist markers remain visible;
5. make wrist markers use the selected song's dynamic left/right colors;
6. rename visible `Beat bounce` wording to `Beats` and `Reset/Load/Save bounce JSON` to `Reset/Load/Save beats JSON`;
7. promote the exact downloaded strict Test presentation JSON to defaults; and
8. keep missed beats continuous through their gray transition rather than disappearing and reappearing.

Immutable evidence remains untouched:

- web release commit/tree: `992d0bb132b69b03ee25d22503b363df2bd5ce3f` / `965f3e968070e352c2f8fd45e2a6077bbd5d3c1c`;
- raw `0.0.45` subtree: `7f956672151127aceb748891ac4861f825cdb699`;
- raw proof SHA-256: `86f5ae56b027452adad0d4d6062560a3d6c0eeb84d44bedf7bf44ba2c56ce57d`;
- renderer commit/tree: `cbf91252d9e1b6b76d3b4dad558e5235338b9b63` / `43bd4ab8f464ac1d795366c59c6c5e79b0412ee0`;
- gameplay asset `0.0.9` source release/audit commits: `6c8f9e09037e880de55af265212533b64e5800ca` / `2f93b563e1363cf61e27d5e0b893b428b76dc569`;
- immutable gameplay raw `0.0.9` tree: `541b693eabc11c716adca84931015213055ebfe8`.

No problem screenshot bytes or attachment were available in this diagnosis. Wall morphology is therefore compared against Derrick's description and the repository's isolated canonical wall renders; the exact physical frame remains an explicit verification item.

## Exact Observed Failure

### Direct physical observations

Derrick reports from raw `0.0.45` that:

- the sky prelude maximum must be `50`;
- obstacles in Boxing Lanes appear at a different spawn distance than beats and Flow/Grid likely share the defect;
- translucent red obstacles contain deeper-red bands or sections;
- the normal setup needs a `4 × 3` grid show/hide control for Flow and Boxing Grid without hiding nose/wrist markers;
- wrists do not visibly follow selected-song dynamic colors;
- the Test labels say `Beat bounce` / `bounce JSON` rather than `Beats` / `beats JSON`;
- the supplied Test presentation configuration should become the default; and
- a missed beat disappears, then immediately reappears gray.

### Read-only minimal reproductions and exact values

#### Strict configuration and defaults

The exact file `/home/derrick/Downloads/aerobeat-test-presentation-config.v1.json` passes the current strict parser unchanged. Its exact constructor-order values are:

```text
bounceLeadBeats                    2
bounceHeightWorldUnits             0.4
bounceApexFraction                 0.4
bounceRiseEasing                   out_quad
bounceFallEasing                   in_quad
normalSpawnDistanceWorldUnits      50
skyMode                             prelude
skyPreludeHeightWorldUnits         24
skyPreludeDurationMs               1000
skyPreludeEasing                   in_out_sine
boxingLaneSeparationWorldUnits     2.7
```

Current source/raw defaults are instead `4 / 0.9 / 0.4 / out_quad / in_quad / 15 / off / 4 / 1200 / in_out_sine / 2.7`. Current sky-prelude-height bounds are `[0,24]`. The request is to raise only that maximum to `50`; the supplied default value remains exactly `24`.

#### Beat/obstacle normal-distance mismatch

At `worldUnitsPerMs = 0.006`:

- promoted beat distance `50` means `8,333.333333333334 ms` of normal approach;
- the obstacle path is hard-coded to `2,500 ms`, which is `15` world units.

A read-only projection probe for an obstacle starting at `10,000 ms` remains absent at `7,499.999 ms` and first appears at `7,500 ms`. A beat using the promoted `50`-unit default begins its normal approach at approximately `1,666.666667 ms`. The mismatch is therefore exact: `5,833.333333333334 ms` and `35` world units. The same assembly obstacle projector feeds Flow, Boxing Grid, and Boxing Lanes.

#### Miss discontinuity

For an event centered at `1,000 ms` with a real miss committed at `1,181 ms`, the read-only source probe produced:

```text
999       flow-1 pending
1000      flow-1 pending
1001      flow-1 absent
1100      flow-1 absent
1180      flow-1 absent
1181      flow-1 miss
1182      flow-1 miss
```

For the second synthetic Test event centered at `2,000 ms`, it is present/pending through `2,000`, absent at every integer millisecond `2,001…2,180`, and reappears gray/missed at `2,181`.

The exact Test gap is the open interval `(centerMs, centerMs + 181)`: `181 ms` in continuous timeline terms and `180` absent integer samples. Real Play commits an expiry miss on the first gameplay advance strictly greater than `centerMs + 180`; its exact per-event gap is `committedTimelinePositionMs - beatCenterTimestampMs`, always greater than `180 ms` for expiry misses and display-cadence dependent. At ideal `60 Hz`, center-to-gray is generally about `180…196.7 ms`.

#### Wall structure

Immutable `release/raw/0.0.9/wall/red-glass-v1.glb` is `3,692` bytes, SHA-256 `1227bfbb7d5379b33f1468c1a0d7fffad07c9390654b54033f079ba602a84a37`, and byte-identical across gameplay releases `0.0.5…0.0.9`. It contains one mesh with two primitives:

- `mat/red_glass`: closed box, `12` triangles, alpha `0.24`;
- `mat/red_edge`: twelve square-prism cage members, `96` triangles, alpha `0.82`.

Both use `BLEND`, back-face culling, depth test on, depth write off, and are not double-sided. Total geometry is `108` triangles with bounds `[-0.47,-0.47,-0.5]…[0.47,0.47,0.5]`. The cage is `0.036` units thick (`±0.47` versus `±0.434` in X/Y and `±0.5` versus `±0.464` in Z). Body plus one edge layer has approximate combined alpha coverage `1-(1-.24)(1-.82)=0.8632`; edge intersections are stronger. Canonical isolated review renders already show these rails.

## Expected Behavior

- `skyPreludeHeightWorldUnits` accepts the closed interval `[0,50]`; values above `50` reject atomically.
- Renderer and assembly defaults serialize byte-for-value equal to the supplied strict JSON; Reset and fresh connection/renderer state use that exact default without copying the Downloads file into the package.
- Notes, punches, guards, and obstacles share the same configured normal appearance boundary. Obstacles do not acquire sky or bounce motion.
- The ordinary product drawer exposes **Game Setup**, with one strict boolean grid preference for Flow and Boxing Grid. Boxing Lanes has no `4 × 3` grid. Hiding the grid does not hide notes, walls, track, timing rows, nose, or wrists.
- Left/right wrist marker fills equal the current package's validated effective note palette; nose remains fixed yellow and structural white/charcoal marker materials remain unchanged.
- The visible Test labels say `Beats`, `Reset beats`, `Load beats JSON`, and `Save beats JSON`. Internal schema, `bounce*` JSON keys, filename, and v1 parser remain unchanged.
- A miss transitions continuously from the same pending target ID/model position into gray at authoritative commit, continues past world `Z=0`, and expires once at `350 ms` after commit. Hit removal remains `80 ms`.
- One continuous wall reads as a uniform translucent red obstacle with a legible silhouette but without strong internal/perimeter dark sections at supported dimensions, angles, and DPRs.
- Raw web `0.0.45`, gameplay asset `0.0.9`, and every predecessor remain immutable comparison evidence.

## Execution Path

### Test presentation configuration

1. Assembly's Test-only DOM inputs dispatch `input`/`change`.
2. `AeroGame.applyTestPresentationControls()` reads eleven primitives.
3. Renderer `createTestPresentationConfig()` bounds and brands the record.
4. `commitTestPresentationConfig()` sets the renderer config, assembly config identity, index invalidation sentinel, and Test-only UI.
5. `rendererFrame()` converts normal distance to lead milliseconds and rebuilds the session target index.
6. `projectSessionTargets()` projects private trajectory fields.
7. Renderer `buildGameplaySceneModel()` applies normal visibility, sky, bounce, and Lanes separation.

Authoritative paths:

- renderer `src/test-presentation-config.js`;
- assembly `src/index.js::applyTestPresentationControls`, `commitTestPresentationConfig`, `resetTestPresentation`, load/save handlers, and `rendererFrame`;
- assembly `src/session-render-projection.js`;
- renderer `src/gameplay-scene-model.js`.

### Obstacle appearance

1. `rendererFrame()` computes configured lead only for `createSessionTargetIndex()` hittable trajectories.
2. `createSessionTargetIndex()` separately indexes obstacle intervals from `startMs - FLOW_APPROACH_LEAD_MS`.
3. `flowObstacleTarget()` and `boxingObstacleTarget()` independently reject frames before the same fixed `2,500 ms` lead.
4. Renderer receives one continuous obstacle record and computes exact interval endpoint Z values.
5. Flow/Grid create one scaled wall over the normalized rectangle; Lanes create one weave wall or two squat lane walls.

The mismatch is introduced before renderer geometry; changing only renderer culling cannot align first projection.

### Miss transition

1. Gameplay commits a real expiry miss only when timeline position is strictly greater than `center + timingWindowAfterMs` (`180 ms`). Test deliberately uses synthetic miss commit `center + 181`.
2. Before commit, `projectSessionTargets()` computes no miss result.
3. Its unresolved `pendingVisible` branch additionally requires `nowMs <= centerMs`, so the target is omitted immediately after center.
4. Renderer receives no target, clears/disables every pooled scene entity for that frame, and cannot preserve pixels.
5. At commit, assembly emits the same event ID with `judgement:"miss"` and progress zero.
6. Renderer reconstructs model ID `${eventId}:0`, overrides fill with `#7c828c`, computes continuing time-derived Z, and re-enables a pooled GLB entity.
7. The model string ID is stable, but runtime pool allocation is asset-index based rather than target-ID-owned; continuity is broken by absence/disable, not by a new gameplay event.

### Song palette and wrists

1. Content validates the authored package palette and creates one private effective palette (`song` or deterministic AeroBeat fallback).
2. Its private render projection writes exact left/right `appearanceColor` only onto eligible Flow notes and Boxing punches.
3. Assembly forwards those per-target private colors.
4. Renderer colors dynamic note fill from `appearanceColor`.
5. Marker staging is separate and colors left/right wrists from `renderer.theme.leftHandColor/rightHandColor`; nose is fixed `#f4c20d`.
6. Assembly calls renderer `setTheme()` only from host `configure({theme})`, direct `setTheme()`, or iframe `set_theme`.
7. Although content resolves and snapshots default/playlist/song/athlete/host theme precedence, assembly never applies `content.theme` after content selection.
8. BeatSaver song note colors are the private effective palette, not necessarily `content.theme`, so applying only `content.theme` still does not guarantee wrist/note equality.

### Grid and marker layers

1. `buildGameplaySceneModel()` always calls `addPresentationFloor()`.
2. Flow and Boxing Grid receive twelve neutral `cell-*` objects; Boxing Lanes returns early and receives none.
3. Timing tiles, track, target walls/icons, and feedback are separate scene objects.
4. Assembly then calls `renderGameplayFrameWithCursors()`.
5. Renderer updates the gameplay scene first and independently stages marker entities afterward at `z=.45` with opaque/depth-writing marker materials.

A model-level floor gate therefore need not affect markers.

### Wall asset and transparent runtime

1. Asset `wall/red-glass-v1` deliberately supplies a translucent body plus high-opacity edge cage.
2. Renderer clones both imported materials, retains alpha blending/back culling/depth-test/depth-write-off, and draws edge after body.
3. Each ordinary Flow/Grid obstacle produces one wall instance, so per-cell wall overlap is not present.
4. Lanes produces one weave instance or two separated squat instances.
5. Distinct simultaneously overlapping obstacle events can still alpha-stack; long interpenetrating volumes are center-Z sorted and have no per-triangle sorting.
6. Stable cage-aligned dark bands nevertheless exist in the asset alone and precede those runtime alternatives.

## Most Likely Root Cause

### Confirmed: miss projection ends pending visibility too early

The assembly conflates hit-center crossing with the end of unresolved visibility. `pendingVisible` stops at `centerMs`, while both Test and real expiry-miss authority commit after the `180 ms` late window. That exact causal gap removes the target from the renderer, which explains disappearance and reappearance without requiring a renderer pooling defect.

### Confirmed: obstacles retain legacy fixed `15`-unit appearance

Obstacle indexing and both obstacle projector branches retain `FLOW_APPROACH_LEAD_MS = 2500`, independent of Test presentation normal distance. At `.006`, that is exactly `15` units. Promoting beat defaults to `50` makes the discrepancy visible across all three presentations.

### Confirmed: wall bands are authored high-opacity geometry

The primary morphology is the intentional `0.82`-alpha twelve-member cage over a `0.24`-alpha closed body. Generator comments, validator assertions, GLB structure, material values, and isolated canonical renders all agree. Backfaces, sorting, and multi-cell overlap are not required to produce the reported bands.

### Confirmed: renderer markers consume theme, but assembly does not wire content truth

Wrist markers already consume renderer theme tokens exactly. Assembly does not apply content's resolved theme after content load. More importantly, the selected-song dynamic note colors reside in a private effective palette rather than necessarily in that theme snapshot. A dedicated private palette wire is required for exact wrist/note equality.

### Confirmed: no Game Setup grid preference exists

The renderer always emits the Flow/Grid twelve-cell floor, assembly has no frame flag or setup preference, and the product UI has no control. Cursors are already a separate stage and can remain visible.

## Alternative Hypotheses

### Wall morphology, ranked

1. **Authored high-opacity edge cage — very high confidence.** It reproduces in the isolated asset and is enforced by source/validation.
2. **Intended body/edge alpha overlap — contributing mechanism.** Coplanar/overlapping coverage makes the intended rails very strong, especially at corners.
3. **Overlapping distinct obstacle events — possible but unproven.** The renderer does not merge coincident event volumes. It would produce whole rectangular/interval overlap regions, not necessarily perimeter rails.
4. **Long-volume transparency sorting — possible secondary artifact.** Center-Z and primitive-level ordering cannot sort every triangle of interpenetrating transparent volumes. Expected symptoms are camera-sensitive or triangular/flickering regions.
5. **Backface failure — unlikely.** Asset/importer contracts retain back culling. A failure would darken broad faces rather than consistently trace the cage.
6. **Per-cell overlap — contradicted.** Flow/Grid create one scaled wall per event, not one wall per mask cell. Lanes' two squat walls are spatially separated.

### Miss behavior

- Renderer miss-gray lifetime failure is contradicted: once a miss target is supplied, renderer keeps it visible for `350 ms` and advances its Z continuously.
- Entity-ID replacement is not the initiating cause: model string ID is the same before/after. The frame has no target at all during the gap.
- Judgement timing is correct by current contract: both real and Test commit after the `180 ms` late window. Visibility—not scoring—is wrong.

### Wrist colors

- Marker GLB tinting failure is contradicted: `mat/tint_base` receives renderer theme colors and structural materials remain fixed.
- Applying content's resolved theme alone is incomplete because package note palette and theme suggestion are separate authorities.
- Deriving palette from only currently visible targets is unsafe: one hand may be absent and frame-local target sets change over time.

## Why Previous Fixes Failed

- Earlier real-map trajectory work correctly fixed note sky/bounce/distance mapping, but obstacles remained on their older independent `2,500 ms` path. Existing defaults were also `15` units, masking the split until the physical config selected `50`.
- The miss unit test claims “real miss remains pending” at `1,180 ms` by reading result index `[0]` without checking `eventId`. At that instant the intended event is absent and `[0]` is the later pending event. The test therefore passed on the wrong entity. Test assertions jump from center directly to synthetic commit and never sample `+1…+180`.
- Wall tests and asset validators treated the strong edge cage as required behavior: exact `0.24/0.82` opacities and `12/96` triangles are asserted. Runtime cannot make that authored morphology uniform without overriding the asset contract.
- Renderer tests prove marker theme consumption and note appearance color independently, but no assembly integration check requires selected-song palette to reach wrist markers.
- Existing Test configuration privacy correctly keeps JSON memory-only and Test-only. It was never intended to provide a normal product Game Setup preference, so adding a grid toggle there would be the wrong scope.

## Unknowns

1. The original physical screenshot, exact camera pose, viewport, DPR, obstacle IDs, intervals, and material dump were not available. These are required to exclude coincident-target or sorting artifacts in that exact frame, although they do not change the isolated asset result.
2. Product intent must confirm whether “hide `4 × 3` grid” means only the twelve neutral floor cells (recommended) or also any future safe/blocked cell overlays. Timing rows are not the `4 × 3` floor and should remain unless Derrick says otherwise.
3. Persistence was not explicitly scoped by a pre-existing Game Setup contract. This plan recommends a strict same-origin preference, matching audio-mix behavior, because “Game Setup” implies a durable product setting rather than Test-session authoring state.
4. Theme-versus-palette precedence for non-BeatSaver packages needs an explicit test matrix. Recommended rule: wrist colors follow validated effective note palette; content-resolved theme continues to own the other renderer tokens.
5. Exact visual parameters for wall `0.0.10` need a review board and Derrick approval. “Uniform” must still retain sufficient silhouette contrast.

## Minimal Reproduction

### Configuration bound/default

1. Import renderer `test-presentation-config.js` at raw `0.0.45` authority.
2. Observe bounds `skyPreludeHeightWorldUnits:[0,24]` and old default tuple.
3. Parse the supplied file; observe exact strict acceptance and values above.
4. Construct a config with sky height `50`; current code rejects it as out of bounds.

### Spawn mismatch

1. Use one eligible beat and one valid normalized obstacle with the same `10,000 ms` start/hit.
2. Set normal distance to `50`, sky off for boundary clarity.
3. Observe beat normal boundary at `1,666.666667 ms / Z=-50`.
4. Observe obstacle absent at `7,499.999` and first present at `7,500 / front Z=-15`.
5. Repeat renderer presentation as Flow, Boxing Grid, and Boxing Lanes; assembly projection boundary remains unchanged.

### Miss gap

1. Use events `flow-1@1000` and `flow-2@2000` with a real `flow-1` miss committed at `1181`.
2. Project at `1000`, `1001`, `1180`, and `1181`.
3. Check specifically by `eventId`, not array index.
4. Observe `flow-1`: pending, absent, absent, miss.
5. In Visual Test, sample the miss-designated second event at `2000`, `2001`, `2180`, `2181`; observe the same boundary.

### Wall bands

1. Render immutable wall `0.0.9` alone at the canonical review pose.
2. Observe high-opacity perimeter rails without any runtime event overlap.
3. Hide only `mat/red_edge` in a disposable inspection scene; stable rails disappear.
4. Restore it and compare one target versus all frame targets to isolate any additional overlap.

### Grid and wrist colors

1. Build a Flow or Boxing Grid frame with no safe/blocked arrays; count twelve `cell-*` objects. Build Lanes; count zero.
2. Stage calibrated nose/left/right cursors; observe they are separate marker entities and remain independent of floor objects.
3. Load a package with non-default effective left/right note colors without host `set_theme`.
4. Observe notes use private `appearanceColor` while wrists remain renderer default `#2693ff/#39c96b` (rendered at `0.68×` tint intensity).

## Proposed Verification

### Root-cause discriminators before implementation acceptance

- Miss: assert the exact same event ID and model object ID at center, `+1`, `+180`, and `+181`; no frame may omit it. This distinguishes projection repair from pool manipulation.
- Spawn: assert obstacle front boundary equals configured `-normalSpawnDistanceWorldUnits` in Flow/Grid/Lanes. A renderer-only cull adjustment that leaves assembly omission will fail.
- Wall: identical-pose wall-alone, edge-hidden, one-target, and all-target captures plus material/target dump distinguish asset cage, event overlap, and sorting.
- Palette: use a song whose left/right colors differ from defaults and from host theme. Assert note and corresponding wrist fills share exact validated palette values while nose/structure/guards/walls remain fixed.
- Grid: model and framebuffer assertions must show no neutral `cell-*` objects/pixels while marker role count, positions, scales, and pixels remain exact.

### Required QA matrix

- Direct and genuine cross-origin iframe.
- Desktop landscape and mobile portrait, DPR `1` and `3` where supported by the existing bounded matrix.
- Flow, Boxing Lanes, and Boxing Grid.
- Visual Test and calibrated real Play for miss continuity and marker color.
- Pause, seek backward/forward, completion, mode switch, content switch, disconnect/reconnect, hidden/visible, and separate element instances.
- Storage available, malformed stored value, storage denied/throwing, and cross-document storage event for Game Setup.
- Public snapshots, events, iframe messages, telemetry, package bytes/hashes, scoring, and Test JSON remain free of grid preference and effective palette.
- Immutable web `0.0.45`, asset `0.0.9`, and all predecessors hash-identical before/after.

No implementation may claim PASS from synthetic-only tests or from array-position assertions that omit event identity.

## Recommended Fix

### 1. Presentation bounds/defaults and labels

Renderer owns the strict config schema and defaults:

- raise only `skyPreludeHeightWorldUnits` upper bound `24 → 50`;
- replace `defaultTestPresentationConfig` with the exact supplied tuple;
- retain schema v1, key names, deterministic filename, 16 KiB bound, fatal UTF-8, branding, and atomic parser behavior.

Assembly owns visible Test UI wording:

- `Beat bounce` → `Beats`;
- `Reset bounce` → `Reset beats`;
- `Load bounce JSON` → `Load beats JSON`;
- `Save bounce JSON` → `Save beats JSON`.

Do not package, copy, fetch, or persist the Downloads file. Source constants become authority.

### 2. Obstacle distance parity

Thread the already computed private `normalSpawnLeadMs` into obstacle interval indexing and both Flow/Boxing obstacle projection gates. Derive it from the same branded config and `.006` world-units/ms authority used for beats. Keep obstacles excluded from sky, bounce, judgement text, and note palette.

Do not merely enlarge renderer future culling: the assembly currently omits the obstacle before `2,500 ms`.

### 3. Continuous misses

Use the authoritative late window when deciding unresolved visibility. Keep the same target projected as pending through `center + timingWindowAfterMs` inclusive; on the first advance strictly after it, gameplay/Test supplies the miss in the same frame. For the current contract this is pending through `+180`, miss at `+181` in Test. Keep hit commit/removal and miss `350 ms` expiry unchanged.

Prefer passing the exact timing window into projection over introducing another unrelated `180` constant. Fix the existing false-positive test by selecting/asserting `eventId` at every boundary.

### 4. Game Setup grid preference

Add an assembly-owned exact boolean preference, recommended shape `{showGameplayGrid:boolean}`, default `true`, in a versioned same-origin coordinator patterned after audio mix. Recommended scope:

- one origin-wide product preference shared by connected game instances and tabs;
- strict exact-key JSON and boolean validation;
- malformed/unavailable/throwing storage falls back to `true` without breaking in-memory state;
- storage events synchronize other documents;
- retained across content/mode/session/reconnect; Lanes retains the preference but has no floor to draw;
- absent from content/package IndexedDB, Test JSON, renderer diagnostics, public snapshots/events, iframe messages, telemetry, and scoring.

Expose it in the ordinary drawer under **Game Setup**, not Visual Test. Add a strict private frame boolean and gate the twelve neutral floor cells only. Keep timing tiles, track, targets, walls, feedback, and separately staged markers. Retain safe/blocked overlays unless Derrick explicitly includes them in “grid.”

### 5. Song theme and effective wrist palette

Apply content's resolved theme to renderer after every successful content load/change so existing theme precedence is no longer dead at the assembly boundary. Separately expose the exact current-generation validated effective note palette through a private, non-enumerable, non-writable, non-configurable content-to-assembly seam analogous to the timing mapper, or an equivalently strict private service method. It must be unavailable when idle/loading/stale/destroyed and absent from public serialization.

Assembly should provide that palette to renderer's private marker staging state. Renderer keeps nose fixed yellow and uses palette left/right for wrist `mat/tint_base`; structural white/charcoal remain fixed. Do not infer palette from only currently visible targets, fabricate a public theme, or expose palette provenance.

### 6. Uniform wall via immutable gameplay asset `0.0.10`

The visual complaint targets deliberate asset morphology, so the durable fix belongs in `aerobeat-asset-gameplay`, not an assembly material override. Create a new immutable `0.0.10` only after review approval; never edit `0.0.9`.

The candidate should:

- remove or materially reduce the separate `0.82` cage, or redesign silhouette geometry so it does not alpha-stack into strong rails/sections;
- retain one uniformly readable translucent red continuous volume with back culling, depth test on, and intentional transparency ordering;
- explicitly authorize the consumer's continuous rectangular X/Y scaling plus interval Z scaling, or replace that consumer contract with another approved continuous-wall geometry contract;
- include isolated, multi-cell-size, Flow/Grid/Lanes, oblique-camera, bright/dark environment, DPR, and overlap review evidence;
- include adversarial checks for edge/body alpha drift, duplicate/coplanar coverage, culling, winding, depth-write, and predecessor immutability.

Renderer then pins exact audited `0.0.10` and updates its local asset inventory/provenance. A runtime-only suppression of `mat/red_edge` would silently contradict immutable `0.0.9` and is not recommended.

## Concrete implementation / QA / release plan

### Task A — asset design and approval (`tu2h`, asset-gameplay owner)

1. Capture the original physical frame and exact runtime obstacle/material dump.
2. Author disposable wall `0.0.10` candidates and review boards; no canonical raw target yet.
3. Select a uniform silhouette treatment and resolve the continuous X/Y scaling contract explicitly.
4. Obtain Derrick visual approval.
5. Run deterministic isolated generation, asset validation, adversarial morphology checks, Blender smoke, and two-build byte comparison.
6. Separately authorize and create immutable gameplay raw/review `0.0.10`; independent audit before renderer pin.

### Task B — content/renderer private visual truth (`yhie`, content + renderer successors)

1. Add current-generation private effective-palette access without public leakage.
2. Apply resolved content theme and exact effective palette through assembly to renderer.
3. Raise sky max and promote exact defaults.
4. Add strict frame-level grid visibility and marker-independence tests.
5. Pin independently audited asset `0.0.10` and validate uniform wall materials/pixels.

### Task C — assembly behavior and product setup (`yhie` + `orz4`, assembly owner)

1. Add strict Game Setup preference coordinator and ordinary drawer control.
2. Thread configured normal lead into every obstacle projector/index path.
3. Extend unresolved event visibility through the authoritative late window.
4. Rename visible Test labels only.
5. Add exact identity/boundary, setup persistence, palette, and real-map regressions.
6. Preserve all lifecycle, privacy, scoring, package, iframe, and Test-only authoring boundaries.

### Task D — independent QA (`ypdm`)

1. Verify exact repo commits/trees and predecessor hashes.
2. Run unit/contract/browser gates in each owning repo.
3. Exercise exact real map through Worker → IndexedDB → downloaded selection → Test and calibrated Play.
4. Run direct/iframe desktop/mobile matrix with boundary model assertions and framebuffer evidence.
5. Compare wall-alone/edge-disabled/one-target/all-target morphology at exact physical pose.
6. Report evidence without closing implementation work unless every acceptance condition is met.

### Task E — final audit and immutable successors (`wari`)

1. Audit plan, Beads, diffs, private/public boundaries, validation, and pushed authorities.
2. Audit immutable asset `0.0.10` reproduction and renderer inventory pin.
3. Authorize at most one append-only web successor, expected next semantic patch `0.0.46`, only from the exact audited pushed source identity.
4. Independently reproduce/audit raw web successor before any serving change.
5. Securely serve only after release audit; return to `k72.17` for Derrick physical review.
6. No tag, GitHub Release, npm publication, public route, or physical PASS without separate authorization.

## Recommended ownership and successors

| Concern | Primary owner | Required successor/dependency |
|---|---|---|
| Test bounds/defaults and scene flags | `aerobeat-web-renderer` | renderer source commit, then assembly pin |
| UI labels, setup preference, obstacle lead, miss continuity, theme wiring | `aerobeat-web-assembly` | assembly source commit |
| Effective song palette authority | `aerobeat-web-content` | private generation-bound seam, then assembly pin |
| Uniform wall morphology | `aerobeat-asset-gameplay` | immutable raw/review `0.0.10`, independent audit |
| Wall import/material/model integration | `aerobeat-web-renderer` | exact asset `0.0.10` pin |
| Cross-mode physical-equivalent QA | `ypdm` independent QA | after `yhie`, `orz4`, `tu2h` |
| Final source/release audit | `wari` independent auditor | after `ypdm`; expected web raw `0.0.46` only if authorized |
| Final physical authority | Derrick / `k72.17` | after audited secure successor serving |

## Debugging Record

```text
Problem: Raw 0.0.45 second physical review found tuning, spawn, wall morphology, setup-grid, wrist-color, wording/default, and miss-continuity defects.
Observed symptom: Obstacles remain at 15 units while configured beats use 50; wall has deep-red rails/sections; Flow/Grid floor cannot hide; wrists retain renderer theme/default colors; labels/defaults are stale; misses vanish for >180 ms before gray.
Root cause: Independent legacy obstacle 2500 ms gates; deliberately authored 0.82-alpha twelve-edge cage over 0.24 body; no product grid preference; assembly does not wire content theme/effective palette; stale visible labels/default tuple; unresolved projection ends at center before late-window miss commit.
Evidence: Exact source/raw constants; strict Downloads JSON parse; read-only obstacle and miss probes; GLB two-primitive/108-triangle/material parse; isolated canonical wall renders; marker/theme and content palette call paths.
Failed approaches: Existing defaults masked obstacle split; miss test read array [0] without event ID and passed on the next event; wall validators required the unwanted cage; tests covered note palette and marker theme separately; Test-only authoring was never a product setup surface.
Corrective action: Thread configured normal lead; keep pending identity through +180 then miss; add strict private Game Setup grid preference; wire resolved theme plus private effective palette; raise bound/promote exact defaults/rename labels; create audited immutable wall 0.0.10 and pin it.
Verification test: Exact event-ID boundary samples, Flow/Lanes/Grid spawn front at configured -50, direct/iframe/mobile grid-off markers, selected-song wrist/note color equality, strict storage/privacy, and physical-pose wall A/B morphology.
Related files/components: assembly index/session-render-projection/setup coordinator; content runtime/package-content private palette; renderer test config/gameplay model/facade/assets; gameplay session coordinator; asset wall GLB/manifest/generator/validator/review.
Remaining uncertainty: Exact physical screenshot/frame target overlap/sorting evidence; whether grid hide includes future safe/blocked overlays; final 0.0.10 silhouette/alpha approved by Derrick.
```
