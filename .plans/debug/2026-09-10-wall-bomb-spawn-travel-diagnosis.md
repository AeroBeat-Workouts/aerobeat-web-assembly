# Diagnosis: Flow walls and bombs "appear in place" — no spawn-lead travel (bead `aerobeat-web-assembly-q1j3`)

_Date: 2026-09-10 · Source: read-only diagnosis subagent (report verbatim) · Raw under diagnosis: immutable 0.0.49_

## 0. Executive summary

The contract violation is **one line of z-computation** in the scene model, plus its two upstream consequences that make it *look* like an "instant appearance":

1. **Primary defect** — `aerobeat-web-renderer/src/gameplay-scene-model.js:125`: `trajectoryStart` computes a spawn time for obstacles from `target.normalSpawnMs`, but the obstacle branch **completely ignores that gate**, culled only by `futureCullMs = 10_000 ms` ahead. At the canonical 10-second spawn distance (`reactionTimeMs × 0.006 WU/ms`), a wall's head z is ≈ 10 s × 0.006 = **60 world units away** when admitted — far beyond any visible range (~far plane / camera pose). The wall therefore pops into view at a short distance as if spawned *in place*, while notes appear at their visible spawn row and translate down over `approachLeadMs`.
2. **Amplifier A (projection)** — `aerobeat-web-assembly/src/session-render-projection.js:184`: bombs are projected with **no `normalSpawnMs` field**. Notes/guards get one; the renderer's note branch uses it as a hard visibility gate (`gameplay-scene-model.js:157–158`), so notes pop in exactly at the spawn row. Bombs instead pop in at whatever the index admits them (same 10 s horizon).
3. **Amplifier B (index admission)** — `session-render-projection.js:140` (`indexedCandidateEntries`): the point-window query covers up to `maximumPresentationLeadMs` (= the 10 s spawn lead) ahead for notes' bounce start, but `queryIntervalTree(index.intervalTree, nowMs, …)` admits walls **only at the current instant** — i.e., walls enter the candidate set the moment `now ≥ normalSpawnMs` (the 10 s-horizon boundary) rather than being held until they reach the visible window. Combined with #1 this is what makes walls materialize on screen.

Notes are unaffected because their projection carries `normalSpawnMs`/`bounceStartMs`/`skyPreludeStartMs`, which both the projection (`pendingVisible`, line 120) and the scene model (`visibilityStartMs`, lines 156–158) use as a hard admit gate at the spawn row.

## 1. Content projection stage (content + authoring + assembly projection)

### 1a. Package/chart content (clean)
- `aerobeat-web-content/src/package-content.js:344–375` (`validateEvents`) and `378–404` (`validateFlowEvent`): obstacle events validate as `{start, end, type:"obstacle", sourceGeometry, gameplayGeometry, gridMask}` (lines 352–357); bomb events validate as `{start, type:"bomb", placement}` (lines 387–390). Neither clamps or drops spawn travel — authored beats are beat-space intervals and carry no render timeline. No violation here.
- `aerobeat-web-content-authoring/src/converter.js:316` (`buildFlowChartBase`): emits flow obstacles as `{start, end, type:"obstacle", …geometry, gridMask}`, bombs as `{start, type:"bomb", placement}`. `flow-contract.js` is identity-only (no timing logic). Clean.
- `aerobeat-web-content/src/spawn-timing.js:16–28` (`derive`): the pinned BeatSaber HJD algorithm producing `reactionTimeMs` and `jumpDistanceMeters = NJS × reactionTimeMs × 2`. This `reactionTimeMs` is the canonical approach-lead authority (see §1c). No wall/bomb special-casing. Clean.

### 1b. Resolved-event timeline (parity holds)
- Gameplay supply: `aerobeat-web-gameplay/src/session-coordinator.js:1092–1120` (`normalizeEvents`) — every resolved event (note/bomb/obstacle) gets `centerTimestampMs`; obstacles additionally get `intervalStartTimestampMs`/`intervalEndTimestampMs` via `validateFlowInterval` (lines 1204–1219), which enforces `startTimestampMs === centerTimestampMs` and positive duration (line 1213). So **walls do carry the full interval timeline metadata** (`intervalStartMs == beatCenterMs`), same basis as notes. `judgeLiveEvents` (lines 839–856) explicitly exempts obstacles from judgement (line 846) — obstacles are interval presentation truth, not checkpoints. This means the *data* needed for spawn-lead travel exists end-to-end; nothing in gameplay strips it.

### 1c. Assembly renderable-target projection (where parity breaks for bombs)
File: `aerobeat-web-assembly/src/session-render-projection.js`

- Lead derivation: `index.js:1201,1209` + `gameplay-visual-runtime.js:6,21–34`. Canonical rate `canonicalWorldUnitsPerMs = 0.006`; `spawnDistanceWorldUnits = reactionTimeMs × 0.006`; `normalSpawnLeadMs = spawnDistance/0.006 = reactionTimeMs` — i.e., **the configured approach lead is the full BeatSaber spawn reaction time** (~4 beats ≈ 2–3 s for typical NJS, capped at 10 s by the presentation config bound `normalSpawnDistanceWorldUnits ≤ 72` → 12 s clamp, effectively ≤ 10 s after `limited`). At the raw 0.0.49 default, this lead equals the *full* jump-distance time, not a short visual lead — see Risk R1.
- **Walls**: `flowObstacleTarget` (lines 153–162): sets `normalSpawnMs = max(0, startMs - normalSpawnLeadMs)` (line 158) and gates admission to `[normalSpawnMs, endMs]` (line 158). It emits `normalSpawnMs` on the target (line 161) — good. But that field is dead weight for the scene model (see §3.1) and the admission gate starts at the **far** spawn horizon, not a visible spawn row.
- **Bombs**: `flowBombTarget` (lines 179–185): emits `{…, beatCenterMs:centerMs}` with **no `normalSpawnMs`, no `bounceStartMs`, no `skyPreludeStartMs`** (line 184). Visibility gate is hardcoded `[centerMs − FLOW_APPROACH_LEAD_MS, centerMs + 500]` with `FLOW_APPROACH_LEAD_MS = 2500` (lines 8, 183) — a fixed 2.5 s lead unrelated to the song's actual `reactionTimeMs`. So bombs travel only 2.5 s, while walls (when they finally appear) are computed at the full reaction-lead scale, and notes travel the full `reactionTimeMs`. Three different leads coexist.
- **Notes/guards/punches** (reference behavior): `createSessionTargetIndex` lines 32–41 compute per-event `normalSpawnMs = max(0, centerMs − normalSpawnLeadMs)`, `bounceStartMs` (mapped `authoredStart − bounceLeadBeats`, clamped to `centerMs − 10_000`), `skyPreludeStartMs`. `projectSessionTargets` line 119–120 admits them at `presentationStartMs = skyPreludeStartMs ?? normalSpawnMs ?? bounceStartMs`. These three fields are what the renderer's note branch consumes (§3.1) — bombs lack all three.

**Stage verdict:** content/authoring/gameplay supply are clean. The projection is where (a) bombs lose the spawn-travel metadata entirely, and (b) walls are admitted at the wrong (far) boundary.

## 2. Gameplay supply stage (session-coordinator)

`aerobeat-web-gameplay/src/session-coordinator.js`:
- Targets are **not** time-gated for rendering. `configureContent` (line 160) loads all resolved events; snapshots publish the whole `resolvedEvents` set every frame (`makeSnapshot`, line 967). There is no spawn-lead schedule in gameplay — it is purely authoritative timing/judgement.
- `applyFutureContent` (line 383) merges future events keyed on `centerTimestampMs <= timelinePositionMs` (line 402) — chunked loading, not per-kind culling. Obstacles, bombs, notes all arrive the same way.
- Therefore **walls/bombs are admitted to the renderer on the same schedule as notes**. The "appears in place" effect is not a supply-stage artifact. This stage is exonerated; the difference manifests downstream in projection/scene-model.

## 3. Scene-model stage (the primary defect)

File: `aerobeat-web-renderer/src/gameplay-scene-model.js`

Canonical mapping: `timestampToWorldZ(timestampMs, nowMs, wuMs=0.006)` (lines 43–47): `z = -(t − now)×wuMs`, so future targets sit at **positive z (away)**. Grid goal row at z=0; spawn row at z = lead × 0.006. Tuning: `defaultRendererTuning.futureCullMs = 10_000`, `spentCullMs = 600`, `worldUnitsPerMs = 0.006` (line 38); theme `approachLeadMs = 2500` (line 40, note: unused by the obstacle branch).

### 3.1 Note/guard/punch path (correct reference)
Lines 152–163:
- `normalSpawnMs` fallback = `beatCenterMs − normalSpawnDistanceWorldUnits/wuMs` (line 156), `skyStartMs = normalSpawnMs − skyPreludeDurationMs`, `visibilityStartMs = skyMode==="prelude" ? skyStartMs : normalSpawnMs` (line 157).
- **Hard gate**: `if (bounceEligible && hasTrajectory && state!=="hit" && state!=="miss" && nowMs < visibilityStartMs) return {objects:[],feedback:[]}` (line 158). → A note is invisible until `now` reaches its spawn-row time. From then it is placed at `movingZ = timestampToWorldZ(beatCenterMs, nowMs, wuMs)` (line 163) and translates down at exactly 0.006 WU/ms. **This is the top-row→bottom-row contract, working.**

### 3.2 Obstacle (wall) path (violation)
Lines 122–150:
- `interval = {startMs:intervalStartMs, endMs:intervalEndMs}` (line 123).
- **`trajectoryStart` computation (line 125):** `continuousObstacle && Number.isFinite(target.normalSpawnMs) ? Number(target.normalSpawnMs) : (bounce-start path or null)`. Walls have `normalSpawnMs` from projection, so `trajectoryStart = normalSpawnMs` (the far horizon).
- **Admission gate (line 126):** `if (frame.nowMs > latest || (trajectoryStart===null ? interval.startMs−frame.nowMs > futureCullMs : frame.nowMs < trajectoryStart)) return culled`. For walls this reduces to `nowMs ≥ normalSpawnMs` (i.e., **10 s-ahead horizon**) — *not* a visible spawn row. Nothing re-culls once inside.
- **Z/depth (lines 132–149):** `z0 = ts2z(interval.startMs, nowMs)`, `z1 = ts2z(interval.endMs, nowMs)`, `center=(z0+z1)/2`, `depth=|z1−z0|`; wall box centered at z-center with z-scale=depth (line 148), shadow at same center (line 149). So the wall **is** modeled as one continuous column spanning its interval, translating as a rigid body at 0.006 WU/ms. The geometry is correct — the *entry point* is wrong: the wall is already 60+ world units out when first drawn.

**Root cause, precisely:** line 126 admits the wall at `normalSpawnMs` = full reaction-time lead; there is no second "visible spawn row" gate equivalent to the note branch's line 158. Result: the wall's leading edge crosses into the camera's visible z-range mid-interval, perceived as "materializing in place." The `obstacleHeight` tuning (line 38, value 3.9) is actually *unused* in the flow obstacle path (scale.y comes from `gameplayGeometry.height`, line 147) — a red herring, not the cause.

### 3.3 Bomb path (violation via missing metadata)
Bombs take the non-obstacle branch (they are not `continuousObstacle`, line 122):
- Line 153–155 validations pass (fields absent, optional).
- Line 156: `hasTrajectory=false` (no bounce/sky fields) → the line 158 hard gate never fires for bombs.
- Line 163: `movingZ = timestampToWorldZ(centerMs, nowMs, 0.006)` — so **the bomb's z does translate correctly at 0.006 WU/ms**; the issue is purely *when* it appears. Its visibility is controlled solely by the projection's fixed `[center−2500, center+500]` window (§1c) — again a fixed 2.5 s lead, inconsistent with notes/walls using the song-derived `reactionTimeMs`, and with no alignment to the visible spawn row. Cull line 126 for bombs: `latest = centerMs + 180 + 600`, `trajectoryStart=null` → admitted when `centerMs − now ≤ futureCullMs(10s)`; so a bomb can be present (but gated out by projection until center−2500). Net: bombs pop in 2.5 s before center regardless of the real spawn lead.

### 3.4 Guidance/other kind-specific branches
- `assetForTarget` (line 239): bomb → `ASSET.bomb`; else arrow/circle. Walls use `ASSET.wall` in the obstacle branch (line 148). No z-affecting logic.
- `targetRole` (line 264): obstacle/bomb → role `"obstacle"` (color tint only). No appearance-on-entry change.
- `futureCullMs` window `[beforeMs,afterMs]` timing zone (lines 60–68) is the hit-judgement band only; it does not gate obstacle visibility.

**Stage verdict:** the single code location that violates the travel contract for walls is **`gameplay-scene-model.js:125–126`** (admit-at-far-horizon, no visible-spawn gate), with the wall/column geometry at lines 132–149 otherwise correct. Bombs violate parity via **missing spawn metadata** originating in projection (with the scene-model bomb branch at lines 152–163 lacking a visibility gate of its own).

## 4. Renderer cull/appearance stage (renderer-facade)

File: `aerobeat-web-renderer/src/renderer-facade.js`:
- `renderGameplayScene` (line 107): calls `buildGameplaySceneModel(...)` and applies `updateSceneObjects(model.objects,…)` — it renders **exactly** the scene model's objects at their computed z/scale. No additional z remapping, no per-kind fade-in at window entry.
- `updateSceneObjects` (lines 234–240): position/scale come verbatim from `object.position`/`object.scale` (line 238). Wall tint/emissive is applied via `applyAssetAppearance` (line 238, assetId `wall/red-glass-v1`) but alpha stays 1 unless contact pulse; there is **no opacity ramp at spawn**. `spent` state dims to 0.42 (line 259 `updateMaterial`) only after interval end.
- Confirmed: the facade does **nothing** to mask the defect — it faithfully draws wherever the scene model puts the wall. If the scene model fixes the z/admission, the facade needs no change (verify: `object.intervalStartMs/intervalEndMs` are passed through for sorting only).

**Stage verdict:** clean; no appearance-stage contribution. The fix should live in projection + scene model, not the facade.

## 5. Root cause (final, consolidated)

**Where walls/bombs violate "top-row → bottom-row at canonical WU/ms":**

| Kind | Violation location | Why it appears in place |
|---|---|---|
| Wall (obstacle) | `gameplay-scene-model.js:125–126` (primary); admission fed by `session-render-projection.js:158,161` and index `:140` (`queryIntervalTree`) | Admitted at `normalSpawnMs = startMs − reactionTimeMs` (≈10 s horizon → z≈60 WU, off-screen). No visible-spawn-row gate equivalent to the note branch's `:158`. Column geometry (`:132–149`) is otherwise a correct rigid translator. |
| Bomb | `session-render-projection.js:184` (no `normalSpawnMs`/`bounceStartMs`/`skyPreludeStartMs`); consumed (absent) at `gameplay-scene-model.js:156–158,163` | Fixed 2.5 s lead (`FLOW_APPROACH_LEAD_MS:8,183`) independent of song `reactionTimeMs`; scene-model bomb branch has no visibility gate. Z translation itself is correct (`:163`), so the bomb travels only a short fixed lead then is gone. |

**Why notes are unaffected:** notes/guards/punches carry `normalSpawnMs`+`bounceStartMs`+`skyPreludeStartMs` (`session-render-projection.js:32–41,191`), and the scene-model note branch uses them as a hard pre-spawn invisibility gate (`gameplay-scene-model.js:156–158`) before placing at `movingZ` (`:163`). That gate is exactly the top-row spawn contract; walls and bombs bypass it.

## 6. Proposed fix (minimal, per stage — no changes made)

**Invariant to preserve:** a wall spanning authored beats N..M must render as **one continuous full-column geometry** whose head/tail each move at 0.006 WU/ms, appearing at the *visible* spawn row and disappearing after `intervalEndMs`. Bombs remain single-beat, traveling identically to a note at the same cell.

### Fix 1 — Scene model: give obstacles the same visible-spawn gate as notes (primary)
`aerobeat-web-renderer/src/gameplay-scene-model.js`, obstacle branch (lines 122–151):
- Keep `interval` and the existing `latest` spend-cull (line 124).
- Compute a **visible spawn lead** identical to the note branch: reuse `presentationConfig.normalSpawnDistanceWorldUnits / tuning.worldUnitsPerMs` to derive `wallSpawnRowMs = interval.startMs − normalSpawnLeadMs` (mirroring line 156's fallback math, but anchored to `interval.startMs`). Add a hard gate: if `state !== "hit" && state !== "miss" && frame.nowMs < wallSpawnRowMs` → return empty (mirror of line 158).
- Keep the rigid column at `z0/z1/center/depth` (lines 132–149) unchanged so the full interval still translates as one body. Optionally extend the tail cull so the wall disappears once `interval.endMs` has fully crossed the goal row (already handled by `latest` line 124).
- Do **not** touch `futureCullMs` semantics for notes; only tighten the obstacle entry boundary.

### Fix 2 — Projection: emit bomb spawn metadata and align the lead to the song authority
`aerobeat-web-assembly/src/session-render-projection.js`:
- `flowBombTarget` (lines 179–185): add `normalSpawnMs = max(0, centerMs − normalSpawnLeadMs)` (pass `normalSpawnLeadMs` in, same as `flowObstacleTarget` line 158) and stop using the hardcoded `FLOW_APPROACH_LEAD_MS` for admission; use `normalSpawnMs`/`centerMs+timingWindowAfterMs` (or the existing 500 ms post-window) as the visibility window.
- Route the bomb target through the same scene-model visibility gate by ensuring it carries `normalSpawnMs` (Fix 1's gate should also apply to bombs, or the bomb branch gains the analogous gate at `gameplay-scene-model.js:156–158` using `normalSpawnMs`).
- Single source of truth for the lead: use the song-derived `normalSpawnLeadMs` (from `reactionTimeMs`) for **all** of note/guard/punch/bomb/obstacle, replacing `FLOW_APPROACH_LEAD_MS = 2500` usage.

### Fix 3 — Index admission (consistency, low-risk)
`session-render-projection.js:140` (`indexedCandidateEntries`): the point-window upper bound already uses `maximumPresentationLeadMs` (= spawn lead) for notes. Ensure walls/bombs are not admitted earlier than their visible `wallSpawnRowMs`/`normalSpawnMs`. Simplest: leave index as-is (it admits at the far horizon) and let Fix 1/Fix 2 gates do the holding — the index just controls which candidates the projector walks; the final gate in the scene model is authoritative. (If profiling shows the 10 s candidate walk is heavy, clamp the obstacle interval-tree query to `now − (endMs−startMs margin)`, but that is optimization, not correctness.)

### What must NOT change
- `obstacleInterval` semantics and the wall/shadow dual-object output (`gameplay-scene-model.js:141–150`) — full-column geometry stays one body.
- Gameplay `intervalStartTimestampMs/intervalEndTimestampMs` (single source of truth, already correct).
- Renderer facade rendering of `model.objects` (already faithful).

## 7. Oracle plan (exact assertions)

Add/extend these in `aerobeat-web-assembly/scripts/validate-session-render-projection.js` (already imports `buildGameplaySceneModel` from `@aerobeat/web-renderer`) plus a focused renderer script. Let `WU = 0.006`, `LEAD = normalSpawnLeadMs` (song `reactionTimeMs`), and define wall interval `[S,E]`, bomb center `C`.

**A. Wall travels as one continuous column at canonical rate (new)**
For a wall with `S=10000, E=12000` (2 s span):
1. For sampled `nowMs` in `[S−LEAD, E+LEAD]` step ~16 ms: find the wall object in `buildGameplaySceneModel({presentation:"flow", nowMs, targets:[wallTarget]}, …)`; assert `obj.id.endsWith(":wall")`, `obj.position.z === ((ts2z(S,now)+ts2z(E,now))/2)` and `obj.scale.z === Math.abs(ts2z(E,now)−ts2z(S,now))` (rigid body). Equivalently assert `(position.z − centerPrev)/(dtMs) === 0.006` between consecutive frames.
2. Assert wall **absent** for `nowMs < S − LEAD` and present at `nowMs = S − LEAD` (visible spawn row entry), i.e., `culledTargetIds` contains the wall id strictly before `S−LEAD`.
3. Assert the **head** z equals `(nowMs − S) × 0.006` magnitude and tail equals `(nowMs − E) × 0.006` — i.e., `ts2z` parity at both ends (the "wall z position equals (nowMs − beatCenterMs)*WU" property, generalized to interval endpoints since a wall has no single center).

**B. Wall visible-from-spawn-lead (new, regression guard for the "appears in place" bug)**
Assert `buildGameplaySceneModel(...,nowMs=S−LEAD−1).culledTargetIds.includes(wallId)` and `...nowMs=S−LEAD...objects.some(o=>o.targetId===wallId)`. This directly fails on the current code (which admits at `normalSpawnMs` = the far horizon, i.e., the wall would already be present well before `S−LEAD` — the oracle catches the early pop-in).

**C. Bomb travel parity with notes (new)**
Create a bomb at `C` and a note at the same `C`/cell. Assert:
1. Both share the same `normalSpawnMs = C − LEAD`.
2. For sampled `nowMs`, bomb icon `position.z === noteIcon.position.z === (nowMs − C)×0.006` (within epsilon) whenever both visible.
3. Both enter visibility at the same `nowMs = C − LEAD` (both culled before, both present at/after), and both exit within the same post-center window. Currently this fails because the bomb's lead is the fixed 2500 ms and lacks `normalSpawnMs`.

**D. Existing assertions to keep (do not regress)**
- `validate-session-render-projection.js:53–61`: obstacle enters at exact approach boundary and leaves right after `intervalEndMs`. After Fix 1 these boundaries move to the *visible* spawn row; update the expected boundary from `centerTimestampMs−2500` to `intervalStartTimestampMs−LEAD` (visible row) and keep the "leaves immediately after exact end."
- `:67–69`: long obstacle publishes exact `[start,end]` interval — retain (full-column invariant).
- `:78–90`: bomb feedback-free/placement/ordering — retain; add the new parity checks alongside.

**E. Optional cross-cutting validator**
In `aerobeat-web-renderer/scripts/validate-grid-target-layering.js` (already exercises obstacle layering) add: a wall at sampled times yields monotonic decreasing `position.z` at exactly `0.006·Δt`, proving constant-velocity travel independent of projection timing.

## 8. Risks / unknowns

- **R1 — Which lead is "canonical"?** The product contract says "canonical constant world-units-per-ms motion." The *rate* (0.006) is unambiguous and shared. The *lead length* currently derives from `reactionTimeMs` (full BeatSaber spawn reaction) for notes, but a fixed 2500 ms for bombs. Derrick's observation ("notes drop from spawn row") implies the *note* behavior is the reference. **Decision recorded (parent, 2026-09-10):** match notes' existing `reactionTimeMs`-based visible-spawn lead for walls and bombs — do not shrink notes to a uniform 2500 ms.
- **R2 — Far-plane clipping:** the claim that a 10 s-horizon wall is "off-screen" rests on z≈60 WU exceeding the visible frustum; exact farClip/fOV unverified statically. The symptom confirms it visually; oracle B proves the admission boundary independent of the camera, so the fix is valid regardless. Verify farClip during implementation.
- **R3 — Multi-beat wall entry:** the entire column translates rigidly (head enters at `S−LEAD`, tail trails at `E`). Contract "extends down as one continuous column" supports rigid. Low risk.
- **R4 — Interaction with `no_obstacles` / `obstacle_visual_only` modifiers:** `projectSessionTargets` already suppresses walls under `no_obstacles` (`:97`). Fix 1's gate must not resurrect or hide walls incorrectly under those modifiers — assert in oracle D that modifier-suppressed walls stay absent. (Note: `obstacle_visual_only` is removed in the same successor by Bead `id8w`.)
- **R5 — `futureCullMs=10s` vs lead>10s:** edge case (very slow BPM/high NJS); document, don't block.
- **R6 — `obstacleHeight` tuning is dead in flow path:** `defaultRendererTuning.obstacleHeight=3.9` is not used (flow walls scale from `gameplayGeometry.height`). Not the cause; filed as follow-up Bead (stale config).
- **R7 — No engine run performed:** all claims are static file:line traces; the oracle plan (especially B and C) is the empirical gate to confirm the root cause on raw 0.0.49 before/during the fix.

## Parent disposition

- Report persisted; `q1j3` fix surface is `aerobeat-web-renderer/src/gameplay-scene-model.js:122–151` (+ bomb-branch gate) and `aerobeat-web-assembly/src/session-render-projection.js:153–185`. Implementation lands in the Wave 2 coder lane together with `id8w`/`tenl`/`er3m` (same repos, avoids conflicts with the Wave 1 `8tz4` lane).
- R1 decision: walls/bombs match notes' song-derived `reactionTimeMs` visible-spawn lead.
- R6 follow-up Bead filed (stale `obstacleHeight` config key).
