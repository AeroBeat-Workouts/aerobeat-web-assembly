# Velocity-based boxing corpse variations — design artifact (I-6)

Status: **DESIGN ONLY — implementation waits on playtest signal.** No code is
shipped by this artifact. Bead: `aerobeat-web-assembly-5y6i` (Lane L-E of the
0.0.63 plan).

Goal (Derrick): the boxing "smack" corpse animation is fine but looks the same
for every hit regardless of how fast the glove came in. Add a **small set of
predefined corpse-path variations keyed to the incoming glove velocity**, so a
hard punch sends the corpse flying differently from a lazy one, and playtesters
can A/B them.

Design principle throughout: **a lookup table, not a physics model.** Every
variation is a plain `{x, y, z}` velocity (WU/s) plus at most a tumble-rate
override, consumed by the EXISTING closed-form `aftermathPose` flight — same
shape as today's `aftermathLaunchVelocities`. No new solver, no new integration.

---

## 1. Velocity signal definition

**What drives the buckets:** the speed of the hitter's wrist measured over a
short rolling window, ending at the hit commit instant.

- **Quantity:** `wristSpeed` = magnitude of the wrist's linear regression slope
  over a `180 ms` window, reported in **WU/s**.
- **Where computed:** `aerobeat-web-input` — `body-grid-service.js`, inside / next
  to the existing `recordWristMotionSamples()` (line ~872) and
  `rollingWristDirection()` (line ~896). It reuses the EXISTING
  `wristMotionHistories` per-hand array (`{timestampMs, x, y}`), which is already
  maintained every frame **only while `scoringValid`** (line ~650) and trimmed to
  `directionHistoryWindowMs = 180 ms` (line ~126). The slope estimator is
  already the pattern `rollingWristDirection` uses (least-squares over the same
  filtered window); `wristSpeed` is just `Math.hypot(dx, dy)` of that slope,
  without the 8-way quantization or the `directionMinimumMagnitude` gate.
- **No new input plumbing to get the raw signal.** We only expose the already
  computed scalar. One bounded optional field is added to the evidence/snapshot
  (see §5), and the assembly reads it at commit.

**Why this unit and why it's rescalable, not hard-coded:**
The wrist history stores shoulder-relative displacement in **athlete-grid cells**
(`* athleteBodyGrid4x3.columns/rows` → 1 cell = ¼ of the calibrated body width).
The renderer world is a different fixed scale: the canonical 4×3 presentation
grid spans 3.0 WU wide (`columnX` = {−1.5,−0.5,0.5,1.5}), i.e. **1 cell ≈ 0.75 WU**.
So a wrist moving one body-width per 180 ms ≈ `4 × 0.75 / 0.18 ≈ 16.7 WU/s`.

**Expected range for a real boxer (180 ms window):**
- Slow deliberate jab: ~4–8 WU/s
- Normal committed punch: ~8–16 WU/s
- Fast / snap hook or uppercut: ~16–32 WU/s

**The cells → WU mapping is a calibration constant** (`≈ 0.75 WU per grid cell`,
derived from the canonical 4×3 presentation grid spanning 3.0 WU over 4
columns), **not** a gameplay number — the thresholds in §2 are what gets tuned
on the playtest. This keeps the signal honest (real body speed) while letting
the buckets be adjusted without touching input code.

> Test-mode caveat: `visual_test` has no real wrist history, so it cannot produce
> a real velocity. Test mode drives the variations by an explicit per-hit bucket
> (see §4), which is exactly what an A/B wants.

---

## 2. Bucketing — 3 velocity buckets

| Bucket | Speed range (WU/s) | Intent |
|---|---|---|
| `soft`  | `s < 8`        | lazy / slow jab — small, gentle pop |
| `medium`| `8 ≤ s < 16`   | normal committed punch — today's look |
| `hard`  | `s ≥ 16`       | snap hook / hard uppercut — flies farther & faster |

3 buckets (not 4) is deliberate: with 3 action families × 3 buckets we get a
compact 9-row table, and it keeps the A/B legible ("slow / normal / fast"). The
thresholds (8 and 16) are the only tunable numbers in the whole design and are
chosen to sit just above/below the middle of the expected real range so an
average punch lands in `medium` and only an obvious effort change crosses a
boundary. They live in config (§4), not code.

---

## 3. Variation set — 9 rows, table-shaped like `aftermathLaunchVelocities`

For each **(action family × velocity bucket)** a predefined launch spec. `x`
magnitude for `hook` is still signed by the hand at runtime (left +X, right −X),
exactly like today's hook handling in `aftermathLaunchVelocity()` (line ~487).
`velocity` is WU/s; `tumbleRadPerS` is a per-row override (falls back to
`aftermathSettledTumbleRadPerS` when `null`). `settle` differs by **duration
only** — it falls off the same screen via the existing
`offscreenCrossingMs` (line ~500); a faster launch simply crosses sooner, so we
tune by velocity, not by inventing a new settle.

| # | family | bucket | x | y | z | tumbleRadPerS | note |
|---|--------|--------|---|---|----|---|------|
| 1 | straight | soft   | 0.0 | 0.5 | -3.0 | null  | gentle drift back |
| 2 | straight | medium | 0.0 | 0.5 | -4.0 | null  | **today's straight (default)** |
| 3 | straight | hard   | 0.0 | 0.9 | -6.0 | 5.4   | sharp snap-back |
| 4 | hook     | soft   | 0.9 | 0.3 | -2.5 | null  | soft lateral |
| 5 | hook     | medium | 1.2 | 0.3 | -3.0 | null  | **today's hook (default)** |
| 6 | hook     | hard   | 2.0 | 0.5 | -4.5 | 5.4   | big lateral shove |
| 7 | uppercut | soft   | 0.0 | 1.8 | -2.0 | null  | gentle rise |
| 8 | uppercut | medium | 0.0 | 2.2 | -2.5 | null  | **today's uppercut (default)** |
| 9 | uppercut | hard   | 0.0 | 3.4 | -3.5 | 5.4   | high fast pop |

Why 3×3 rather than a reduced matrix: the variation is only meaningful *relative
to* the action's existing signature — a "soft hook" should still read as a hook,
a "hard straight" as a straight. Collapsing families would lose the action
identity the playtester is reacting to. `guard` (bonk) and `flow` are **out of
scope** — Derrick's ask is the boxing punches.

`tumbleRadPerS = 5.4` on the `hard` rows = `3 × 1.8` (the effective in-flight
tumble is `aftermathSettledTumbleRadPerS × 2.5` ≈ 4.0 today, so a hard hit spins
~1.5× faster — clearly "hit harder" without looking frantic). Keep the default
`null` on soft/medium so the baseline look is byte-identical to 0.0.62.

**Back-compat anchor:** rows 2/5/8 (the `medium` rows) equal the current
`aftermathLaunchVelocities` straight/hook/uppercut exactly, so a "no variation"
fallback that maps every hit to `medium` reproduces today's animation precisely.

---

## 4. Selection + A/B plan

**Selection at hit commit — deterministic, no per-hit randomness.**
The variation is a pure function of `(mode, bucket)` via the 9-row table above.
Given the same punch type and the same measured speed, the same row is chosen
every time — so playtesters can compare apples to apples. No seeded jitter is
added (the existing per-`targetId` `seed` already de-syncs the tumble *phase*
between simultaneous corpses, which is enough variety within a chosen row).

Optional later refinement (not in v1): a seeded `bucket ± 0.25` nudge so
back-to-back identical punches don't look frame-identical. Keep OFF by default;
it is a config flag, not logic.

**A/B mechanism — one knob, three legs.**
Add a config field `corpseVariationMode` (0.0.63 equipment-config system, Lane
L-C / `376l`) with values:

- `off`  → every punch uses the `medium` row = today's animation. **Baseline.**
- `on`   → bucket comes from the live `wristSpeed` at commit.
- `force_soft` / `force_medium` / `force_hard` → force a single bucket on every
  punch (this is how Test mode / `visual_test`, which has no real wrist history,
  exercises a leg deterministically).

Playtest A/B: playtesters run the same boxing song three times — `off`, `on`,
and a `force_*` pass — and rate "do the hits feel different / proportional to
how hard I punched?" The URL / Test-mode panel carries `corpseVariationMode`
(+ optional threshold overrides) so each leg is one toggle, reusing the 0.0.63
equipment-config surface Derrick already approved for the glove-rotation work.

---

## 5. Implementation notes (NOT implemented — boundary: waits on playtest signal)

What would change if approved, and the contract/back-compat notes:

**Renderer (`aerobeat-web-renderer/src/gameplay-scene-model.js`):**
- Extend `AeroAftermathLaunchVelocities` / `aftermathLaunchVelocities()` into a
  2-level lookup `{ straight: {soft,medium,hard}, hook: {...}, uppercut: {...} }`,
  keeping `guardBonk`/`flowNote` flat. Bump `defaultRendererTuning`
  `version`/`hash` (currently `5` / `visual-playcanvas-v5`).
- Add an OPTIONAL `aftermathVelocityBucket?: "soft"|"medium"|"hard"` to
  `AeroAftermathEntry`; `aftermathLaunchVelocity()` reads it (default `medium`
  when absent → current behavior preserved). Add `tumbleRadPerS?` as an optional
  per-entry override used by `aftermathPose` (default → tuning).
- **Critical validator change:** `isValidAftermathList` (line ~705) uses an
  EXACT allowed-key allowlist; both new optional keys must be added to that list
  or every entry is rejected.
- **Cap note:** the 7-beat FIFO + eviction fade is **assembly-owned**
  (`gameplay-frame-effects.js`, `AFTERMATH_LIVE_CAP = 7`) and is *count* based —
  a variation only changes each entry's numbers, not how many entries exist, so
  it **cannot break the cap**. (Renderer also enforces ≤8 as a hard ceiling;
  unaffected.)

**Assembly (`aerobeat-web-assembly/src/gameplay-frame-effects.js` + `index.js`):**
- `projectAftermathEntries` / `aftermathMappingForEvent` already emit
  `family/hand/mode/hitCommitMs/spawn/seed` per hit. Add `velocityBucket` to
  punch entries.
- In `index.js` `rendererFrame()`, resolve the bucket:
  - `visual_test` → read `corpseVariationMode` (`force_*` or `medium`).
  - `play` → `off` ⇒ `medium`; `on` ⇒ `bucketize(wristSpeed(hand), thresholds)`.
- `wristSpeed(hand)` comes from a new optional bounded snapshot/evidence field
  `{hand: {speed}}` exposed by the input service (computed from
  `wristMotionHistories`, §1) — a **presentation-only, optional** field so
  absent/legacy snapshots simply default to `medium` (no behavior change).

**Oracle / pixel evidence required at implementation time:**
1. **Deterministic unit oracle:** for each of the 9 (mode, bucket) cells, assert
   `aftermathPose` closed-form position at T+100/200/400 ms against the table —
   proves the table lookup and that `medium` rows equal the old launch values
   byte-for-byte (regression guard).
2. **Back-compat pixel sweep:** a real-pixel oracle (pattern:
   `validate-0.0.59-boxing-spawn-pixels.js`) with `corpseVariationMode: "off"`
   must produce frames identical to the 0.0.62 baseline (proves the `medium`
   default changed nothing).
3. **Differentiation pixels:** `force_soft` vs `force_hard` on the same song —
   screen trajectories of the corpse must visibly differ (farther + faster +
   more spin for hard), with a small per-pair metric so "they look different" is
   evidenced, not asserted.
4. **Cap regression:** a burst of ≥8 hits still evicts the oldest and fades it
   (7 live), confirming the new fields didn't perturb the FIFO.

**Explicit boundary:** this artifact stops at the table + contract sketch. No
edits to `aerobeat-web-renderer`, `aerobeat-web-input`, `aerobeat-web-assembly`,
or `aerobeat-web-contracts` are made until Derrick gives the go signal from
playtest feedback.

---

## 6. Open questions for Derrick (≤3)

1. **Bucket count:** is 3 (soft/medium/hard) the right granularity, or would
   playtesters want a 4th (e.g. split `medium` into a "hardish" tier) for finer
   punch-proportionality feedback?
2. **Hard-hit ceiling:** do you want a cap on the `hard` trajectory so a
   max-effort punch can't fling the corpse fully off-screen / out of the visible
   track, or is "more over the top" desirable as the reward for a hard hit?
3. **Jitter:** keep the A/B legs 100% deterministic per (mode, bucket) — or is a
   small seeded within-row jitter wanted so repeated identical punches don't
   look frame-identical to casual viewers?
