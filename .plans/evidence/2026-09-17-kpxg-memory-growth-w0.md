# kpxg — long-song (~15 min) memory growth: W0 diagnosis

Bead: `kpxg` (carried from 0.0.60 playtest intake) · Plan: `aerobeat-web-assembly/.plans/2026-09-17-0.0.61-playtest-intake-successor.md` (L-E lane)
Date: 2026-09-18 · Mode: read-only diagnosis + measurement. No source modified, no commits.

## TL;DR — ranked suspects

| # | Suspect | Verdict | Growth rate (measured / static) | Location |
|---|---------|---------|--------------------------------|----------|
| 1 | **Flow-wall outcome re-finalization spam** — every expired `flow_colliders_v1` wall is re-finalized **every tick** and pushes a *new* `flow_hazard_outcome` into the persistent `hazardOutcomes` array | **UNBOUNDED, quadratic** (measured) | **62.5 new entries/s per expired wall** (1/tick @16 ms). Quadratic in song time. Measured 1.30M entries at 610 s → **≈2.8M entries ≈ 300 MB+ at 15 min** for a 100-wall chart | `aerobeat-web-gameplay/src/session-coordinator.js:681` (filter) vs `:899-901` (push) — flow walls finalize into `hazardOutcomes`, but the exclusion filter checks `obstacleOutcomes` |
| 2 | **Per-tick snapshot republish churn** — `publish()` → `makeSnapshot()` deep-copies all persistent arrays, and `finalizeColliderEvents` sorts `hazardOutcomes` **every tick** | **UNBOUNDED, compounds #1** (measured + static) | Per-tick O(n) copy + O(n log n) sort over the #1 array, 62.5×/s. At n≈2.8M: ~2.8M-element copy + full sort **per frame** → the dominant late-song CPU/GC load (and likely the frame drops) | `session-coordinator.js:1031` (per-tick sort), `:1318-1340` (`publish`/`makeSnapshot`, `[...hazardOutcomes]` at :1336, `judgedEventIds` sort at :1335) |
| 3 | **Judgement records + `judgedIds`** (the owner's hint: "persistent, cleared only on full session reset") | **Bounded-by-chart, linear** (measured) | **3.333/s** (= synthetic note rate 1/300 ms) → ~3,000 entries ≈ **0.72 MiB** retained over 15 min. Real, but ~400× smaller than #1 at 15 min | `session-coordinator.js:117-140` (state decls), cleared only in `clearRunTruth` (reset) |

Everything else investigated is **bounded** (static, file:line below): aftermath/asset pools and slice-variant material cache, hazard contact retained events, guidance/target groups, obstacle outcome arrays (boxing path — the correct one), audio buffers, CV histories.

## Suspect #1 — flow-wall `hazardOutcomes` re-finalization (the leak)

### Mechanism (all in `aerobeat-web-gameplay/src/session-coordinator.js`, verified at HEAD `ccc9d5a` and the L-F2 tree)

1. Per tick while playing, `evaluateFlowObstacles()` (L679) builds the work list:
   ```js
   // L681
   const obstacles = events.filter((event) =>
     event.type === "obstacle" &&
     !obstacleOutcomes.some((outcome) => outcome.eventId === event.eventId));
   ```
2. For each obstacle whose `intervalEndTimestampMs` has passed, `finalizeObstacles` (L893) pushes an outcome. **For the flow ruleset the outcome goes to `hazardOutcomes`**, not `obstacleOutcomes`:
   ```js
   // L899-901
   if (variant?.rulesetId === FLOW_COLLIDER_RULESET) {
     const outcome = Object.freeze({ ..., kind: "wall", result: ..., ... });
     hazardOutcomes.push(outcome);
   }
   ```
   (L903 also deletes the per-obstacle state, so the wall looks "never seen" again next tick.)
3. The exclusion at L681 therefore **never matches flow walls** (they only ever appear in `hazardOutcomes`), so the same wall is re-finalized — with a **brand-new outcome object** — on **every subsequent tick** for the rest of the session.

### Growth rate (measured)

Per tick: `rate = (1000/TICK_MS) × (number of walls expired so far)` entries/s → the array grows **quadratically** in song time (walls expire roughly linearly over the song).

Measured (Node sim, real coordinator, 100 walls spread over 904 s, 16 ms ticks, `--expose-gc`, gc() before each sample):

| t (song s) | hazardOutcomes | judgements | Node heap (MB) |
|---|---|---|---|
| 10 | 188 | 20 | 6.7 |
| 100 | 33,450 | 320 | 11.1 |
| 200 | 137,312 | 653 | 22.8 |
| 610 | **1,299,778** | 2,020 | **159** |

- Instantaneous rate at 610 s ≈ 62.5/s × 68 expired walls ≈ 4,250 entries/s; mean over 10–610 s ≈ 2,130 entries/s.
- Fit: `hazardOutcomes(t) ≈ 62.5 × 0.1124 × t²/2 ≈ 3.5·t²` (100 walls / 890 s). At **t = 904 s → ≈ 2.8M entries**.
- Node heap ≈ 110 MB of the 159 MB at 610 s is the array itself (≈ 85–110 B/entry frozen record) → **≈ 300 MB+ at 15 min** in a real browser process (plus per-tick snapshot copies — see #2).
- The boxing path is **correct**: `evaluateBoxingObstacles` (L776-792) pushes to `obstacleOutcomes` (the array the filter checks) → each boxing obstacle finalizes exactly once. The leak is flow-mode-specific — consistent with the physical symptom appearing on Warioware-style flow songs.
- `obstacleOutcomes` stays 0 in the flow sim (flow uses `hazardOutcomes`); bombs in flow correctly land in `hazardOutcomes` with `kind:"bomb"` and ARE excluded (L1018-1022 checks `hazardOutcomes.some(kind==="bomb")`) — only **walls** are un-excluded.

### Secondary effects (measured/static)

- **Completion counting inflates**: L380 `hazardOutcomes.filter(kind === "bomb")` — bombs only, so completion isn't corrupted by wall spam, but the `.filter` itself is O(n) per tick over the spam.
- **Telemetry churn**: `publicFlowCollidersSummary` (assembly `src/index.js:2352`) and `gameplayTelemetry` (`:2345`) scan the full arrays per telemetry poll.
- **CPU**: the quadratic array makes every per-tick `filter`/`sort`/copy O(n). Evidence: the Node sim (16 ms ticks, real code) took **600 s of wall clock to reach 610 s of song time** — the coordinator itself is ~1× real time or slower late-song purely from this churn; in a browser at a true 60 fps frame budget, a ~10–20 ms-per-tick sort of a multi-million-entry array late-song is a direct frame-drop source on top of memory pressure.

### Recommended fix (FIX NOW, repo `aerobeat-web-gameplay`)

Small, targeted, in `session-coordinator.js`:

- **Option A (minimal, preferred):** in `finalizeObstacles` (L893-907), for the flow-ruleset branch, record the finalized wall id the same way the boxing path does — i.e. change the L681 exclusion to also check `hazardOutcomes` for `kind === "wall"` outcomes with the same `eventId`:
  ```js
  // L681 (and the analogous boxing L778 if unified)
  const obstacles = events.filter((event) => event.type === "obstacle" &&
    !obstacleOutcomes.some((o) => o.eventId === event.eventId) &&
    !(variant?.rulesetId === FLOW_COLLIDER_RULESET &&
      hazardOutcomes.some((o) => o.kind === "wall" && o.eventId === event.eventId)));
  ```
  (Note: `hazardOutcomes` is kept sorted by `committedTimelinePositionMs` — a plain `.some` is O(n); for a clean fix add a `finalizedObstacleIds` Set alongside `judgedIds` (L123) and check that — O(1), and it also serves the L1018-1022 bomb exclusion pattern. Set cleared in `clearRunTruth`.)
- **Option B (structural):** move flow wall outcomes to `obstacleOutcomes` (schema allows an obstacle outcome record) so the existing filter works; touches more contract surface (`flow_hazard_outcome` consumers in assembly `projectHazardContactEvents` read `hazardOutcomes` for `kind:"wall"` — `gameplay-frame-effects.js:351-363` — so Option A is lower-risk).
- **Do not** "fix" by trimming `hazardOutcomes`: the array is read per frame by the assembly; the spam is the bug.

Expected effect: `hazardOutcomes` becomes **bounded by (walls + bombs)** per song; the per-tick sort/copy cost drops from O(n²)-cumulative to O(chart size) once; 15-min projection goes from ≈300 MB to a few KB.

## Suspect #2 — per-tick snapshot republish + sort churn

- `advance()` calls `publish(null)` on **every tick** (`session-coordinator.js:389`).
- `publish` → `makeSnapshot` (L1318-1340) rebuilds the snapshot object **and deep-copies every persistent array**: `judgements: [...judgements]`, `shadowJudgements: [...]`, `obstacleOutcomes: [...]`, `hazardOutcomes: [...]` (L1336), plus `judgedEventIds: [...judgedIds].sort(...)` (L1337). The returned snapshot is cached and reused until the next publish, so no *retained* duplication — but at 62.5 publishes/s each tick allocates a full copy of every array.
- `finalizeColliderEvents` (L1018) runs `hazardOutcomes.sort(...)` (L1031) **every tick** even when nothing was pushed.
- Growth: per-tick transient churn proportional to array size → **compounds #1 quadratically**. Measured proxy: Node wall-clock ≈ song-time late in the sim (churn dominates).
- Verdict: **file-follow-up** (part of the #1 fix, or a separate small change): skip the sort when no outcome was pushed this tick, and make `makeSnapshot` copy-on-publish only when a dirty flag is set (the assembly reads the cached snapshot per frame anyway, so per-tick copies are pure waste when state didn't change). Not a memory *retention* bug by itself — it is the CPU/GC amplifier.

## Suspect #3 — judgement records (owner's hint, confirmed but minor)

- `judgements` (L117), `judgedIds` Set (L123), `shadowJudgements` — pushed on every judged note, cleared only by `clearRunTruth` (session reset / content reconfigure).
- Measured: exactly note-rate growth, **3.333/s** (1 per 300 ms synthetic note). Over 15 min ≈ 3,000 records ≈ **0.72 MiB** (≈250 B/entry with frozen copies + Set entries + snapshot copies).
- Verdict: **bounded by chart, linear, minor.** Recommendation: **file-follow-up** (optional trim of `shadowJudgements` after commit, or cap the array post-completion) — not worth a fix-now at 15-minute song lengths; revisit only if charts grow an order of magnitude denser.

## Bounded suspects (static analysis, file:line) — all verified by code

| Item | Verdict | Evidence |
|---|---|---|
| **Aftermath entity pool + asset-pool generations** (task item b) | **Bounded** (high-water mark, not per-hit) | `aerobeat-web-renderer/src/renderer-facade.js`: pools `assetPools`/`aftermathAssetPools` are Maps keyed by assetId (L49); per-frame pool index = **concurrent count** for that assetId (L133 `renderGameplayScene` retains `lastModel`; L326 assigns `index` from per-frame `assetCounts`/`aftermathCounts` ordinals → `acquireAssetEntity`/`acquireAftermathAssetEntity` L330/L332 grow the pool only past the high-water mark); `assetPoolGeneration` is re-synced **only** when loader generation changes (L323 → `destroyInstantiatedPools()`); `materialUidCounter` grows only inside `cloneAssetMaterials` (L556, one uid per render component of a *new pool entity*); `sliceVariantMaterials` keyed `${sliceSign}:${assetPoolGeneration}:${materialUid}` (L488-490, via `applyAftermathAppearance` L412) — lazily cloned, one entry per pool-entity material part per slice sign, destroyed with the pool (L567). Dense Warioware songs can raise the *one-time* high-water mark, then it plateaus. Diagnostics exposed via `describe()` (L587: `pooledEntityCount`, `activeEntityCount`, `gameplayAssets` generation, `sceneVisuals`). |
| **Hazard contact retained events** (task item c) | **Bounded per frame** | `aerobeat-web-assembly/src/gameplay-frame-effects.js`: `HAZARD_CONTACT_MAX_EVENTS = 32` (L32), `HAZARD_CONTACT_RETENTION_MS = 150+600+200 = 950 ms` (L34); per-frame derivation at L347/L360 filters by retention then caps with `slice(0, 32)` (L367). The *source* array (`hazardOutcomes`) is unbounded via #1, but the derived retained list is hard-capped at 32. |
| **Guidance / target group identities** (task item d) | **Bounded** | `aerobeat-web-assembly/src/session-render-projection.js`: guidance cap 512 (L12); `createSessionTargetIndex` built **once per content identity**, not per frame (assembly `src/index.js:1269-1273`). Obstacle outcome arrays: boxing `obstacleOutcomes` bounded by obstacle count (one outcome each, L778-792); flow `hazardOutcomes` — **unbounded via #1** (row above). Feedback event joins: derived per frame from bounded inputs. |
| **Per-frame allocated objects** (task item e) | **Transient (GC-able), not retained** | `rendererFrame()` (assembly `src/index.js:1261-1300`) builds fresh projection/target/aftermath arrays each frame; renderer `lastModel` holds only the latest model; nothing accumulates per frame except the coordinator arrays in #1-#3. The per-tick snapshot copies (#2) are the one per-tick allocation that *scales* with retained state. |
| **Audio per-lease buffers** (task item f) | **Bounded** | `aerobeat-web-audio/src/audio-service.js:741-806`: single `playbackNode` (one `AudioBufferSourceNode`) + one decoded buffer per lease; node is stopped and disconnected on seek/stop before replacement. |
| **CV frame histories** (task item f) | **Bounded** | `aerobeat-web-input/src/body-grid-service.js`: `evidenceHistory` capped 120 (L740-742); wrist motion histories windowed 180 ms, capped 64 (L883-885). |

## Measurement

### What was measured (MEASURED, not static)

Node-side simulation of the **real** `createAeroGameplaySessionCoordinator` (the component that owns every suspect accumulator), driven at the real 16 ms tick cadence through a synthetic ~15-minute `flow_colliders_v1` play session (3000 notes @ 300 ms + 100 walls, safetyReady + owned audio lease, frozen countdown clock — the exact production start path). `node --expose-gc`, `gc()` before each 10 s sample. Rates are per second of *song time*, so they transfer to a real 60 fps play session.

- **Run (partial, timeout-limited):** `t=610 s` reached with 600 s wall clock — itself evidence of the per-tick churn (#2). Data table above.
- **Run (completed, 300 s trim):** clean completed run to t=300 s, `hazardOutcomes=936,900`, `heapUsed=119 MB` — consistent with the same quadratic (the trim packed the 100 walls into 300 s, so rates are ~3× faster per wall-expiry).
- **Fitted rates:** `judgements` = 3.333/s (linear = note rate); `hazardOutcomes` = 62.5/s × (expired walls) → quadratic, ≈ 2.8M entries at 904 s for a 100-wall chart.
- Caveats: (1) the re-finalization happens on *every* tick regardless of input validity (the no-sample path at L691 also calls `finalizeObstacles`), so subsampled/null-input ticks exercise the identical mechanism as real play; (2) Node heap numbers include V8/sampler noise — shape check only, browser `performance.memory` will differ in absolute value but not in the quadratic shape; (3) real Warioware songs may be denser than 1 note/300 ms — same linear character for judgements, and *worse* quadratic for walls (rate ∝ wall count).

### What was static-only

Renderer pools / slice-variant material cache / `materialUidCounter` / `assetPoolGeneration` (high-water-mark model read from `renderer-facade.js`), hazard-contact retention (derived-list caps), guidance caps, audio single-buffer/single-node, CV history caps. A browser-side `performance.memory` run was **not** captured to completion (the in-page harness was launched and verified computing but stopped at ~25 min; a real physical-CV 15-min play session was out of scope for this lane); the Node coordinator harness below is the delivered measurement, plus the ready-to-run browser harness for post-fix verification.

### Ready-to-run harnesses (scratch, untracked — orchestrator commits)

1. **Node coordinator harness (the one that produced the data):**
   `aerobeat-web-assembly/.plans/evidence/measure-kpxg-coordinator.js`
   ```
   cd /home/derrick/.dsh/projects/aerobeat/aerobeat-web-gameplay
   KPXG_INPUT_EVERY=32 timeout 590 node --expose-gc \
     ../aerobeat-web-assembly/.plans/evidence/measure-kpxg-coordinator.js
   ```
   Knobs: `KPXG_INPUT_EVERY` (input cadence; default 4). Full 904 s run needs >20 min wall clock late-song because of the bug's own per-tick cost — the 610 s partial + 300 s completed runs already establish the quadratic.
2. **Browser in-page harness (ready-to-run; launched, stopped at ~25 min to unblock delivery):**
   `aerobeat-web-assembly/.plans/evidence/measure-kpxg-browser-memory.mjs`
   Vite + genuine cross-origin iframe (same pattern as `scripts/validate-0.0.59-flow-corpse-color-pixels.js`); drives a real `flow_colliders_v1` session and samples `performance.memory.usedJSHeapSize` + coordinator accumulator lengths + renderer `describe()` pool counters every 30 s. Run with a 15-min authored flow chart to confirm the quadratic in-page (and to re-run after the fix to confirm the plateau). During this lane it was launched headless and verified actively computing (Chromium renderer ~103% CPU — the same quadratic coordinator cost that slows the Node sim), then stopped because the full 904 s run needs ~15–25 min wall clock and the Node harness is the authoritative measurement. Re-run it whenever convenient (especially post-fix).
   **Note:** the repo `vite.config.js` currently refuses to start while sibling-lane worktrees (renderer) are dirty (release-fingerprint check) — the harness therefore uses a minimal inline Vite config; the orchestrator may prefer to run it once the tree settles.

## Per-suspect recommendations

| Suspect | Disposition | Fix / follow-up |
|---|---|---|
| 1. Flow-wall `hazardOutcomes` re-finalization | **FIX NOW** — `aerobeat-web-gameplay` | Track finalized flow-wall ids (Set next to `judgedIds`, cleared in `clearRunTruth`) and exclude in the L681 filter; ~10-line patch, contract-safe (outcomes schema unchanged). File a bead in `aerobeat-web-gameplay` referencing this evidence. |
| 2. Per-tick snapshot copy + unconditional sort | **Fix-now (cheap, same PR)** or file-follow-up | Dirty-flag on `publish`; skip `hazardOutcomes.sort` when nothing pushed this tick. |
| 3. `judgements`/`judgedIds` persistence | **File follow-up** (ignore for now) | 0.72 MiB at 15 min; revisit if chart density grows ~10×. |
| Renderer pools / material cache | **Ignore** | High-water-mark by design; plateaus. |
| Hazard contact retained events | **Ignore** | Hard-capped 32 / 950 ms per frame. |
| Guidance / target groups | **Ignore** | Cap 512; index built once per content identity. |
| Audio / CV histories | **Ignore** | Single buffer/node; caps 120 / 64. |

## Environment caveats

- `aerobeat-web-gameplay` working tree carried **in-flight L-F2 (saber/glove) uncommitted changes** during this run (now committed as `97e928a`); all cited line numbers verified against both `ccc9d5a` and the final tree — the leak code is identical in both.
- `aerobeat-web-assembly` had pre-existing dirty L-B files (`.beads/interactions.jsonl`, plan md, `scripts/release-fingerprint.js`) — untouched.
- All scratch artifacts live under `aerobeat-web-assembly/.plans/evidence/` and are **untracked/uncommitted** (orchestrator commits evidence).
