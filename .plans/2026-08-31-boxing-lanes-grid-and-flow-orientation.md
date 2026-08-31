# AeroBeat Boxing Lanes, Boxing Grid, and Flow Orientation

**Date:** 2026-08-31
**Status:** Approved — Execution In Progress
**Owner:** `aerobeat-web-assembly`
**Parent plan:** `.plans/2026-08-28-embeddable-game-calibration-and-boxing-prototypes.md`
**Release target:** next web assembly release after `0.0.25`

---

## Goal

Make the product expose three understandable gameplay modes:

1. **Flow** — the existing 4×3 Beat Saber-derived grid.
2. **Boxing Lanes** — gesture/action-based Boxing scoring with bottom-to-top scrolling lanes.
3. **Boxing Grid** — spatial 4×3 athlete-grid Boxing scoring.

Keep the two conversion experiments as a separate **Conversion** choice rather than mixing recipe jargon into gameplay names. First repair the newly reproduced Beat Saber-to-Flow vertical row inversion so Flow and Boxing can be physically compared against trustworthy source placement.

Do not select or promote a production Boxing gameplay or conversion winner.

## REFERENCES

- Derrick physical report, 2026-08-31: BeatSaver map `3C9D`, Standard Easy, shows bottom/top rows reversed in AeroBeat Flow versus ArcViewer.
- Exact source: BeatSaver `3C9D`, version hash `5662f64a12c76a3dd11a5f6ee22611608cd06760`, Standard Easy (`Easy.dat`).
- Reproduction: first note at beat `21`, source `(x=3,y=0)`, currently emits AeroBeat cell `3` (top row) but canonical top-left body-grid truth requires cell `11` (bottom row).
- AeroBeat coordinate contract: `aerobeat-web-contracts/src/coordinate-spaces.js` defines top-left row-major cells.
- Web source normalization: `aerobeat-web-content-authoring/src/beatmap.js` retains Beat Saber bottom-left source cells; Flow emission in `src/converter.js` currently forwards them without the required vertical transform.
- Godot parity path: `aerobeat-tool-content-authoring/src/services/importers/beatsaver_stage_conversion_service.gd` has the same Flow behavior.
- Existing Boxing defaults include a common `360 ms` minimum punch spacing and reach/guard/obstacle checks.
- User-approved lane behavior: full early-through-late band; upper-quarter success center; all Boxing cues scroll; two-hand guard/squat duplicate into both lanes; existing 350 ms feedback remains authoritative.
- Umbrella Bead: `aerobeat-web-assembly-hc4`.
- Web Flow orientation Bead: `aerobeat-web-content-authoring-5bs`.
- Godot parity Bead: `aerobeat-tool-content-authoring-4l8`.
- Simplified product UI Bead: `aerobeat-web-ui-5tz`.
- Renderer Bead: `aerobeat-web-renderer-sal`.
- Assembly integration Bead: `aerobeat-web-assembly-hc4.1`.
- QA/release/handoff Bead: `aerobeat-web-assembly-hc4.2`.

---

## Product Model

### Gameplay selector

The main **Gameplay** control has exactly three choices:

- `Flow`
- `Boxing Lanes`
- `Boxing Grid`

Internal ruleset identities remain durable:

- `Flow` → `flow_grid_v1`
- `Boxing Lanes` → `boxing_semantic_track_v1`
- `Boxing Grid` → `boxing_spatial_grid_v1`

“Semantic” means the player performs the correct Boxing action/hand gesture. It does not require contacting one exact 4×3 cell. “Spatial” means the action must also satisfy the generated athlete-grid target.

### Separate Conversion selector

When a Boxing mode is selected, show a separate experimental **Conversion** control:

- `Balanced Height` → internal `row_family_balanced_height_v1`
- `Source Height` → internal `cut_family_source_height_v1`

The conversion recipes are not gameplay layouts:

- **Balanced Height** derives punch family from the source Beat Saber row, then redistributes generated target heights to balance the workout while respecting uppercut constraints.
- **Source Height** derives punch family primarily from source cut direction and keeps the source note height where feasible, including the existing bottom-uppercut promotion rule.
- Both recipes run the same spacing/reach safety pipeline: punch candidates inside the common minimum spacing are rejected, guard windows are reserved, unreachable/blocked targets are rejected or relocated under the active profile, and obstacle coexistence is enforced.
- The current `360 ms` minimum punch spacing is the primary mechanism that reduces overly rapid Boxing actions. The recipe choice changes action/height derivation, not whether the safety optimizer runs.

This keeps all four Boxing recipe×ruleset candidates available without presenting five confusing combined mode names and without choosing a winner.

### Boxing Lanes visual behavior

Only `Boxing Lanes` uses scrolling lanes. Both conversion recipes share this visual layout because layout follows gameplay ruleset, not conversion recipe.

- Every Boxing cue travels continuously from below the viewport to above it.
- One shared semi-transparent success band spans both lane backgrounds and their gap.
- The target center crosses the success center in the upper quarter (`yHit=0.25`) at its authored center timestamp.
- The band represents the complete inclusive gameplay window (`-180 ms` through `+180 ms` at current authoritative defaults).
- Band size is mathematically derived from scroll speed and the timing window.
- Lane backgrounds remain; old receptor lines and every approach ring disappear in Boxing Lanes.
- Punch and directional weave cues use their lane.
- Two-hand guard and squat cues render one aspect-preserving copy in each lane.
- Existing GREAT/pulse/miss and common 350 ms judged-feedback lifetime remain unchanged while cues continue moving.

### Boxing Grid and Flow

- `Boxing Grid` remains the existing 4×3 spatial athlete-grid experiment for either conversion recipe.
- `Flow` remains the existing 4×3 Beat Saber-derived grid and retains its Flow approach rings.
- Neither mode becomes lane-based.

---

## Authoritative Lane Geometry

Use normalized top-left viewport coordinates. For a physically square target with normalized height `h`, judgement center `C`, target/theme approach lead `L`, approved success center `yHit=0.25`, and current timeline `t`:

- Target is fully below the viewport at `C-L`.
- Linear upward speed: `v=(1+h/2-yHit)/L`.
- Target top: `yTop(t)=yHit-h/2-v*(t-C)`.
- Band top: `bandTop=yHit-v*timingWindowAfterMs`.
- Band height: `v*(timingWindowBeforeMs+timingWindowAfterMs)`.
- At `C-timingWindowBeforeMs`, target center touches the lower band edge.
- At `C+timingWindowAfterMs`, target center touches the upper band edge.

The band cannot be independently resized without lying about gameplay timing. Initial semi-transparent alpha is a bounded renderer token targeted at `0.22` for physical evaluation.

---

## Task 0 — Repair Flow source-row orientation

**Status:** Complete and audited. Web commits `7401f82`, `343aacb`, `9a4fa1f` plus audit-ledger commit `1de7ca2` passed QA/audit; Godot parity `c0d8968` passed QA/audit. All six Task 0 implementation/QA/audit Beads are closed.

**Implementation Beads:** `aerobeat-web-content-authoring-5bs`, `aerobeat-tool-content-authoring-4l8`
**Web QA/Audit:** `aerobeat-web-content-authoring-t6k`, `aerobeat-web-content-authoring-lnm`
**Godot QA/Audit:** `aerobeat-tool-content-authoring-32m`, `aerobeat-tool-content-authoring-buk`
**Owners:** web authoring coder → Godot parity coder → independent QA → auditor

**Work:**

- Keep normalized Beat Saber source summaries explicit about their bottom-left source coordinate convention.
- Transform source cells exactly once when emitting canonical top-left AeroBeat Flow beats.
- Correct notes, bombs, arc heads/tails, chain/burst heads/tails, and obstacle cell coverage.
- Do not double-flip Boxing conversion, which already uses explicit top-left conversion helpers.
- Update deterministic web/Godot golden outputs and package hashes.
- Add exact `3C9D` Standard Easy evidence comparing source coordinates, canonical placements, and actual generated Flow package output.
- Define truthful stale-package handling so an existing downloaded package authored by the inverted converter cannot silently remain selected after the fix; require replacement/reimport where needed.

**Acceptance:**

- Beat `21` `(x=3,y=0)` emits cell `11`, not cell `3`; all first Easy notes match ArcViewer top/bottom rows.
- Source `y=0/1/2` maps canonical bottom/middle/top for v2, v3, and v4.
- Notes, bombs, arcs, chains/bursts, and obstacles all transform once.
- Web and Godot outputs regain deterministic semantic parity.
- Boxing rows/cells remain correctly oriented.
- Existing authored-package replacement/invalidation is proven in browser persistence/library flow.
- Owner tests, exact live fixture, QA, audit, commit, and push pass.

## Task 1 — Present three modes plus separate conversion choice

**Status:** Complete and audited. Implementation/follow-ups (`57d0fc8`, `8827728`, `8c3a6fc`, `ae07326`) passed latest-HEAD QA and final audit; implementation, QA, and audit Beads are closed without selecting a winner.

**Implementation Bead:** `aerobeat-web-ui-5tz`
**QA/Audit:** `aerobeat-web-ui-0wx`, `aerobeat-web-ui-zq5`
**Owner:** `aerobeat-web-ui` coder → independent QA → auditor

**Work:**

- Replace combined `Semantic Row`, `Spatial Row`, `Semantic Cut`, and `Spatial Cut` product labels with exactly `Flow`, `Boxing Lanes`, and `Boxing Grid` mode radios.
- Add a separate Boxing-only `Conversion` radio group for `Balanced Height` and `Source Height`.
- Emit bounded scalar mode/conversion intents; do not emit package/profile objects.
- Preserve native radio semantics, focus trapping, four drawer sections, compact mobile fit, and selected exact package truth.

**Acceptance:**

- Exactly three Gameplay choices use the approved names.
- Conversion appears for Boxing, not Flow, and exposes exactly two understandable labels.
- No old Row/Cut combined gameplay labels remain in product UI or acceptance text.
- Mode plus conversion resolves one exact existing variant without duplicate labels or implicit winner selection.
- Unit/browser direct+iframe portrait/landscape tests, QA, audit, commit, and push pass.

## Task 2 — Implement reusable Boxing Lanes renderer

**Status:** Complete and audited. Implementation/corrections (`e8764f5`, `5966528`, `16a0678`) passed renewed QA and final audit after the Grid weave regression was fixed; implementation, QA, and audit Beads are closed.

**Implementation Bead:** `aerobeat-web-renderer-sal`
**QA/Audit:** `aerobeat-web-renderer-4bq`, `aerobeat-web-renderer-dn8`
**Owner:** `aerobeat-web-renderer` coder → independent QA → auditor

**Work:**

- Add an explicit scrolling lane presentation for the semantic ruleset.
- Add bounded `laneHitCenterY` and `laneTimingBandAlpha` renderer tuning fields and update deterministic tuning/profile hashes.
- Consume authoritative before/after milliseconds supplied in the frame.
- Implement exact linear motion and shared band geometry.
- Preserve physical-square icon sizing at every supported aspect.
- Suppress old receptor lines and approach rings only in Boxing Lanes.
- Render all lane cues with canonical Boxing icons; duplicate guard/squat into both lanes without stretching.
- Keep moving hit/miss/GREAT feedback attached to cue position.
- Regression-lock Flow and Boxing Grid plans.

**Acceptance:**

- Exact early/center/late band-edge equations pass, including an asymmetric-window fixture.
- Equal timeline deltas produce equal upward deltas; below/above clipping is correct.
- One shared band, two lane backgrounds, zero old receptor lines, and zero lane rings.
- Portrait/landscape DPR1/3 pixels prove band bounds, semi-transparency, centroids, icons, and no ring pixels.
- Guard/squat duplicate exactly once per lane; punch/weave placement is deterministic.
- Existing 350 ms feedback remains attached to moving cues.
- Flow and Boxing Grid command plans remain unchanged.
- Tests, browser tests, pack, QA, audit, commit, and push pass.

## Task 3 — Integrate mode×conversion selection and lane truth

**Status:** Complete and independently audited at implementation `82570f7` / evidence baseline `3d660f8`; `aerobeat-web-assembly-hc4.1` closed.

**Bead:** `aerobeat-web-assembly-hc4.1`
**Prerequisites:** audited Tasks 0–2
**Owner:** `aerobeat-web-assembly` coder → independent QA → auditor

**Work:**

- Resolve the independent mode and conversion scalar choices to the exact existing variant ID.
- Keep Flow independent of Boxing conversion choice.
- Route both conversion recipes under `Boxing Lanes` to scrolling lanes.
- Route both conversion recipes under `Boxing Grid` to the 4×3 grid.
- Supply authoritative contract judgement-window values to renderer frames without duplicating scoring truth.
- Preserve punch/weave lane identity and canonical squat/weave icon semantics for lanes while retaining Grid blocked-cell guidance.
- Ensure corrected Flow packages replace stale inverted output in the downloaded collection flow.
- Preserve Start/Test/menu/restart, leases, privacy, cadence, cursors, Preview, atlas, and host compatibility.

**Acceptance:**

- Exact selector matrix proves three gameplay labels × two Boxing conversion choices resolve the intended four Boxing variants plus Flow.
- Both Boxing Lanes conversions scroll; both Boxing Grid conversions stay 4×3.
- Semantic versus spatial scoring truth remains unchanged.
- Corrected `3C9D` Easy Flow cells match the source viewer after actual online download/persistence/selection.
- Test remains audio-only, hit-first, unscored, and camera/CV/input/cursor-free.
- Direct and iframe portrait/landscape DPR1/3 exercise all modes and both conversions.
- Tests, browser/live gates, QA, audit, commit, and push pass.

**Owner evidence (2026-08-31):**

- Assembly consumes exact own `{rulesetId}` / `{recipeId}` intents, resolves only existing variants, retains the last valid Boxing conversion across Flow, and uses Balanced Height only for first use.
- Semantic frames route to `boxing_lanes` with contract-owned `prototypeJudgementDefaults` before/after timing; spatial frames route to `boxing_spatial_grid`; Flow remains `flow` without lane timing fields.
- Projection tests lock punch/weave lane direction, neutral guard/squat duplication, exact Grid blocked cells, and the unchanged `350 ms` feedback lifetime.
- Browser coverage locks the mode×conversion matrix, `selectedProfileId`, scalar accessor/object rejection, stale list/export/delete preservation, one bounded `flow_orientation_reimport_required` refresh with no auto-select loop, and corrected reimport selection.
- Owner gates passed: `npm run check`, `npm test`, focused standard-library browser integration, full `npm run test:browser` across direct/iframe portrait/landscape DPR1/3, and `npm pack --dry-run` (82 files, 301.4 kB packed, 1.1 MB unpacked).
- Independent QA passed at exact clean/upstream `3d660f8`: full `npm run test:browser`, a five-variant direct/same-origin iframe Cartesian matrix at portrait/landscape DPR1/3, stale-package preservation/no-retry recovery, and two byte-identical dry-pack manifests (`2740f076b27967669e19aa612b98a7e1677d8ff7b0a0de6364f59ee4102004c3`; 82 files; 301391 packed bytes; 1072089 unpacked bytes).
- QA's actual online assembly path downloaded BeatSaver `3C9D` exact hash `5662f64a12c76a3dd11a5f6ee22611608cd06760`, authored/persisted all five Standard Easy variants, explicitly selected Flow, proved beat `21` source `(x=3,y=0)` → persisted cell `11` and first twelve placements `[11,8,10,9,11,8,11,8,10,9,11,8]`, then deleted its ephemeral collection without committing archive/audio bytes.
- Final independent audit reran `npm run check`, the focused selection/projection tests, the stale-library browser test, two dry packs, and a fresh live assembly/IndexedDB reproduction of the exact `3C9D` hash/placements. Source review confirmed own scalar intent privacy, exact variant resolution and conversion retention, semantic-lane versus spatial-grid routing, contract-owned timing windows, exact `350 ms` projection feedback, no legacy gameplay selector path, non-destructive stale behavior, compatibility coverage, and no Boxing winner language. Existing `dev:tailscale` PID `2972964` remained running and returned HTTP 200.

## Task 4 — Integrated QA, deterministic release, and physical handoff

**Status:** Owner release lane complete at `0.0.26`; `aerobeat-web-assembly-hc4.2` remains in progress for independent QA/audit, followed by final audit Bead `.3`.

**QA/Release Bead:** `aerobeat-web-assembly-hc4.2`
**Final Audit Bead:** `aerobeat-web-assembly-hc4.3`
**Depends on:** audited Tasks 0–3
**Owner:** assembly coordination

**Work:**

- Run independent owner and integrated QA/audit.
- Compare corrected `3C9D` Easy Flow output to source positions before comparing gameplay modes.
- Verify real/synthetic feedback while Boxing Lanes cues move.
- Re-run shell/privacy/cadence/countdown/cursor/Preview/direct/iframe matrices.
- Build the deterministic next release after `0.0.25`; compare two raw releases and two dry packs.
- Update plans, README, Beads, and focused phone handoff.
- Keep the existing `dev:tailscale` server running.

**Acceptance:**

- All owner and assembly gates pass.
- Exact live source proof establishes correct Flow row orientation.
- Pixel evidence proves lane motion, truthful band geometry, no rings, canonical cues, and 4×3 Flow/Grid non-regression.
- Mode and Conversion controls remain understandable and bounded.
- Release/pack reproduce byte-for-byte; Git and Dolt state are pushed.
- Derrick receives a physical checklist; automated evidence does not claim a human pass.
- No production Boxing gameplay or conversion winner is selected.

**Owner release evidence (2026-08-31):**

- Canonical `npm run version:patch` advanced `package.json`, `package-lock.json`, and the HTML release marker from `0.0.25` to `0.0.26`; the raw proof is tracked at `release/raw/0.0.26/` under the established release layout.
- Two independent `npm run build-release` rounds were byte-identical across 13 files. Source fingerprint is `cacac1e520eb1f619a3c694a01e7d7b6d1a51516bd05c1b1bf0556e387bafbc9`; recursive file-manifest SHA-256 is `831f513a19a63b10a4ab2d3194fa06a51895533c9f95ea912636b7c434239647`; proof SHA-256 is `69969cd8b0ca8e3a5e99b26c6eeb93643c90fe59af05ea7b62aab8f717f54a85`; artifact bytes before proof are `3669249`.
- Owner `npm run check`, `npm test`, `npm run test:browser`, and `npm run build` passed. Browser coverage includes five variants, exact three-mode/two-conversion shell behavior, lane motion/shared truthful band/no-rings/canonical cues, moving `350 ms` feedback, Flow/Grid 4×3, stale preservation/reimport, direct/iframe portrait/landscape DPR1/3, Preview, privacy, cadence, countdown, compositor, and cursors.
- Runtime source and validation scripts are byte-identical to independently audited Task 3 baseline `3d660f8`; raw `0.0.26` assets contain the corrected stale marker plus semantic-lane/spatial-grid identities. This truthfully binds Task 3's two actual online `3C9D` authoring/IndexedDB reproductions—exact hash `5662f64a12c76a3dd11a5f6ee22611608cd06760`, beat `21` `(x=3,y=0)` → selected Flow cell `11`, first twelve `[11,8,10,9,11,8,11,8,10,9,11,8]`—to the released runtime without another source change.
- Repeated owner npm dry-pack rounds were byte-identical before final ledger recording; a final pair is rerun after all packed plan/docs/Bead evidence is frozen. The focused phone handoff leaves every physical observation Pending, compares Flow, both Boxing Lanes conversions, and both Boxing Grid conversions, and explicitly makes no human-pass or production-winner claim.
- Existing `dev:tailscale` PID `2972964` was neither stopped nor restarted and the secure route returned HTTP 200.

---

## Required Validation Matrix

### Flow orientation

- `3C9D` Standard Easy source and generated Flow event lists match x/y placement exactly after coordinate-space conversion.
- v2/v3/v4 notes, bombs, arcs, chains, and obstacles preserve top/middle/bottom truth.
- Renderer cell `0` remains top-left and cell `11` remains bottom-right.
- Previously downloaded inverted output cannot masquerade as corrected content.

### Product naming and conversion

- Main Gameplay control: exactly Flow, Boxing Lanes, Boxing Grid.
- Boxing-only Conversion control: exactly Balanced Height, Source Height.
- Tests name gameplay layout separately from conversion recipe.
- Both recipes retain the shared optimizer and remain experimental.

### Boxing Lanes geometry

- Starts fully below, moves monotonically upward, crosses the upper-quarter band, and exits above.
- Motion is authoritative-timeline-derived and linear.
- Band height equals velocity × complete 360 ms window at current defaults.
- No lane cue emits an approach ring or old receptor line.
- All cue semantics and moving feedback pass portrait/landscape DPR1/3.

### Non-regression

- Flow remains corrected 4×3 with its selected icons and rings.
- Boxing Grid remains 4×3 for both conversions.
- Gameplay timing/scoring does not change.
- Start/Test/menu/restart, audio/camera leases, Preview, privacy, cadence, countdown, and cursors remain green.
- No Boxing winner.

---

## Debugging Record — Flow Row Inversion

```text
Problem: BeatSaver Flow vertical placement is inverted in AeroBeat.
Observed symptom: In map 3C9D Standard Easy, ArcViewer/source bottom-row notes render on AeroBeat's top row and vice versa.
Root cause: Beat Saber y is bottom-origin; source summaries encode cell=y*4+x, but Flow emitters forward that raw source cell into AeroBeat's top-left row-major contract/rendering without transforming y. Boxing paths explicitly transform through topLeftRow/topLeftCell, so they do not share the same omission.
Evidence: Beat 21 source (x=3,y=0) is raw cell 3 but canonical AeroBeat cell 11. The first twelve Easy notes are y=0 and currently map to top-row cells 0..3 instead of bottom-row 8..11. Web and Godot Flow emitters both forward raw source cells. AeroBeat coordinate contracts and renderer are explicitly top-left.
Failed approaches: Existing synthetic/golden tests reproduced current converter output and therefore codified the inversion instead of comparing against an external source-view orientation oracle.
Corrective action: Transform source cells exactly once at Flow emission for every cell-bearing beat type; preserve explicit source coordinates for Boxing conversion; regenerate web/Godot goldens and stale package identity/output.
Verification test: Exact 3C9D Easy source-to-package comparison plus v2/v3/v4 synthetic top/middle/bottom fixtures across notes, bombs, arcs, chains, and obstacles; web/Godot parity; actual persisted/downloaded replacement proof.
Related files/components: web beatmap.js/converter.js/goldens; Godot BeatSaver stage conversion/goldens; assembly live import/persistence selection.
Resolution: IndexedDB v4 non-destructively marks legacy package/collection records stale, preserves packages/assets/collections/source caches for listing/export/deletion, rejects gameplay loads with `flow_orientation_reimport_required`, and allows corrected same-key reimport to replace stale records with safe asset GC.
```

---

## Risks and Mitigations

- **Golden tests preserve a wrong coordinate convention:** add `3C9D` as an external orientation oracle and assert canonical contract cells directly.
- **Double-flipping Boxing:** keep source summary convention explicit and change Flow emission only; regression-lock Boxing cells.
- **Confusing recipe and gameplay axes:** separate Mode and Conversion controls and test each independently.
- **Large truthful timing band:** keep size tied to velocity/window; expose only bounded alpha/location/speed authority for later physical tuning.
- **Stale local package:** bind corrected output identity and prove downloaded collection replacement before handoff.
- **Feedback lifetime versus travel:** preserve approved 350 ms feedback; do not extend scoring/retention to force exit.
- **Accidental winner selection:** keep both gameplay modes and both conversion recipes experimental and leaderless.

---

## Approval Record

Derrick approved this revised plan on 2026-08-31. Execution is authorized for Flow orientation repair first, simplified UI and Boxing Lanes renderer in parallel where independent, then assembly integration, independent QA/audit, deterministic release, and physical handoff while keeping the secure server running and preserving the no-winner boundary.

**Active DSH goal:** `goal-b0f1fb3d-be6b-4543-a4f9-769c8a479a66`
