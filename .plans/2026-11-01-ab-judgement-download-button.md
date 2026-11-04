# A/B judgement capture: "Download Data" button in the menu drawer

Status: LOCAL SIGNED FIX READY FOR PHONE TEST — fresh .149/.153 captures show 828/830 vs 573/830. Signed Play reversal recovers with strict negative controls intact. Cost mitigation reduces the contact-heavy fixture from mean/max 46.07/102.50 ms to 2.73/6.30 ms. Final assembly suite and signed sparse matrix pass. Public builds unchanged. Derrick chose recording/replay first; that approved feature is active, with capture/export already verified in the signed build.

## Current action — 2026-11-03

Owner: Pico. Active source-fix Bead: aerobeat-web-assembly-nrrv (gameplay owner); performance 2bsk; recording feature 1fnl. Rebuild 3g45 is complete. Goal active; maximum rounds: Maximum safe integer.

The first .149 probe build was invalid: it retained the old assembly label but linked current dependencies, including post-spline gameplay 20a1697. Derrick's two captures therefore do not compare pre-spline against post-spline. The original .149 manifest pins gameplay 6f5d6a6, contracts 43ec0a4, input 31c96a3, renderer 94f1a06 and content-authoring 9edce4c.

Current delivery order: Derrick selected “Add recording and replay first” through native question next_delivery. Capture/export and its actual signed download pass. Next acceptance is native Test Load Recording -> real Test replay of that file under the recorded Play rules, with expected markers/equipment/judgements and no live/ranked authority. See `.plans/2026-11-03-human-movement-recording-replay.md` for the active implementation. No more source optimization or review is required for this slice after the agreed checks passed. Fresh .149 stamp bb26fd6c889f95b0c482ebaf and .153 stamp f2d26b97608cf1dcbee4e712 share all 830 event IDs/beat centers and matching Flow settings. Full analysis: `.plans/2026-11-03-real-play-analysis.md`. Do not replace either live artifact without a deployment decision. Overall goal is not complete; physical recovery remains unverified.

Same coder child f2e79c08-0a57-4d34-bd1e-9a04cae662cf completed cost mitigation 669259a under gameplay's owning plan: exact shared anchor arithmetic, anchor-only direction reads, and skipping later direction-rejected geometry only after real contact already suppresses near. Owning full npm test and independent parent exact-anchor/reversal tests pass; same read-only QA qhrv found no likely blocker. Parent reviewed/pushed 669259a, pinned its exact commit/tree and built signed assembly d432abd (59 files, stamp bacd82f632d36f6e18adf25c). Signed reversal/negative controls, final full assembly suite and signed sparse Flow/Boxing OFF/ON matrix passed; measured stress mean/max is 2.73/6.30 ms. Source and built acceptance are complete for this slice; physical testing is pending. No child assembly edits/services/deployments. First fix 011c860 and assembly ed68ea6 already passed signed scoring/sparse tests; their measured slow snapshot is retained as comparison control. Parent owns recording proposal `.plans/2026-11-03-human-movement-recording-replay.md` (Test UI approval needed) and signed integration.

Deferred report: aerobeat-web-assembly-5fgy tracks Derrick's Boxing 100% repeated-punch switch-hand observation; do not fix it during probe work. Historical test compatibility is filed as aerobeat-web-assembly-7edx (P3, safe to defer; no product-scoring change needed). Rebuild Bead 3g45 is closed; physical comparison and the overall goal remain open.

Source retention: current probe assembly commit 33d565d; pre-spline probe commit 6628d21 retained by tag `probe-r149-authentic-20261103`. Deployment docs follow the build commits and do not imply a rebuild of those frozen artifacts.

Diagnostic record: observed .149 probe stamp 480a4d9554943b4bf13ba454 includes gameplay 20a1697 instead of 6f5d6a6. Root cause is shared current node_modules/sibling links during backport. Prior verification checked only the version label/button and missed dependency identity. Corrective action is isolated original-commit dependency worktrees. Remaining uncertainty: the real playability regression is not yet diagnosed.

## Direction-qualified contact integration — 2026-11-03

- Source fix 011c860 was independently reviewed, source-tested, pushed and pinned. Local signed assembly ed68ea6 contains that gameplay plus the already verified orientation cache. Stamp: `FRIEND-GAME-CPU-0.0.153-475b2b25bd2f2f5dd5d5030c`.
- Actual signed Play check uses native calibration, raw landmark input, production equipment/scoring/renderer and one genuine advance per tick. Original .153 misses the down-then-up reversal at 7050 ms; fixed scores Great at 6050 ms with accepted contact offset +35.4167 ms. Reverse-only and no-contact controls remain plain misses and exactly-once holds. Full assembly npm test and signed sparse Flow/Boxing 1/2 FPS OFF/ON matrix pass.
- Performance risk was measured, not assumed: twelve overlapping up-notes 100 ms apart with fresh 50 ms wrong-way/held poses produced 12 misses in each build. On 48 active ticks, original mean/max advance 1.10/2.50 ms; first fixed candidate 46.07/102.50 ms. Reports `.tmp/direction-stress-{original,fixed}.json`. Retained slow control `.tmp/flow-contact-qualified-011c860` validates through the normal signed loader.
- Cost mitigation 669259a retains exact geometry/anchor math and gates. Parent focused tests, independent read-only review, full assembly suite and signed sparse matrix pass. In the identical 12-note workload, all 12 notes still miss, but mean/p95/max update elapsed falls to 2.73/4.20/6.30 ms across the same 48 active ticks (report `.tmp/direction-stress-optimized.json`). This is materially below the first fixed candidate's 46.07/78.40/102.50 ms, though not identical to original .153's 1.10 ms mean. No phone cadence or real-play recovery is claimed from host fixtures.
- Final signed build d432abd uses gameplay 669259a; stamp `FRIEND-GAME-CPU-0.0.153-bacd82f632d36f6e18adf25c`. The actual Play reversal remains Great at 6050 ms / +35.4167 ms qualified offset; reverse-only and no-contact remain plain misses. Report `.tmp/direction-optimized-browser.json`. The cache still preserves scoring in Flow/Boxing at 1/2 FPS. This is a local candidate, not a released .153 replacement.
- Runner corrections were fixture-only: do not set timingWindowMs through a nonexistent native control; assert its unchanged default instead. Camera-preview x must be inverted into athlete coordinates (actual-anchor assertion caught the omission). At 8050 ms, 8.05 seconds round-trips to 8050.000000000001; the existing fixture now bounds the coordinator by its actual audio clock and compares the requested time within <0.000001 ms. Fresh measured evidence checks remain exact. None changed game timing or admission gates.

## Corrected rebuild evidence

- Isolated layout: `.tmp/authentic149/`, assembly on pre-spline ae07836 plus probe-only changes (6628d21); every package has its own original-commit worktree and isolated local package links.
- All fourteen non-assembly commit/tree/source digests compare equal to original `boxing-r149-ae07836`. The current probe's fourteen dependencies also match original `boxing-r153-6aa7422`.
- Corrected captures read difficulty and provider map ID from content lineage. They preserve the complete run-locked Game Setup, including nested Flow/Boxing/knee volume settings, and expose the active mode's depth/scale at the top level.
- Both signed builds pass `validate-ab-capture-browser.js`: existing fake camera/audio/content fixture, real input/coordinator, real committed judgement and completion, native menu download click, downloaded JSON parsed and compared against judgement truth. Changing next-run scale after completion does not rewrite the finished run's settings. This is export proof, not physical phone playability proof.
- Current `npm test` and 8 focused capture tests pass. Historical `check` passed. Its full unit chain cannot be reported green: (1) clone-provenance test restores today's main renderer rather than the historical clone's initial commit, (2) Vite's shared tooling adds an external client root to the isolated development-server allowlist, (3) shared-hash provenance requires current public main, incompatible with original content-authoring 9edce4c. Remaining historical unit commands passed individually. Missing asset-source links were supplied without product changes. No gate was weakened.
- Live snapshots: `boxing-r149-verified-probe-6628d21` (stamp `FRIEND-GAME-CPU-0.0.149-bb26fd6c889f95b0c482ebaf`) and `boxing-r153-verified-probe-33d565d` (stamp `FRIEND-GAME-CPU-0.0.153-f2d26b97608cf1dcbee4e712`). Specific `-abprobe` systemd units now use these snapshots on the unchanged ports 4212/4216. Public TLS browser checks confirmed exact HTML bytes and entry-JavaScript hashes plus visible disabled idle buttons on 8449/443. Original snapshots remain untouched.

## Capture interpretation — follow-up while awaiting replay

Only the original two invalid-baseline files were present in Downloads on this check. Their miss counts are .149-labelled: 253 wrong_direction + 3 near_timing; .153: 229 wrong_direction + 2 near_timing. These are not valid pre/post-spline comparison results.

Critically, current gameplay `colliderMissDiagnostics` (session-coordinator.js, lines 1648–1653) emits wrong_direction for any expired directional note with fresh input and authored-direction enforcement, without establishing contact or a failed direction predicate. Therefore the code cannot distinguish no-contact from a true direction rejection. Earlier promises that exported diagnostic codes would directly identify the cause were too strong. Filed aerobeat-web-assembly-cqs7. Do not change live builds mid-replay or weaken direction enforcement based on this label.

The previously omitted content-authoring delta 9edce4c -> 505faf0 changes the per-entry source cache allowance from 2 MiB to 8 MiB plus a moved type comment; it does not alter conversion/judgement algorithms. This observation does not rule out other real-session causes.

## Bounded host performance lead — not a confirmed playability cause

After confirming no corrected captures yet, ran `.tmp/production-pose-ab.mjs` against the authentic isolated .149 judge and current judge. Endpoint poses were generated from the production Flow zone map/default equipment config with explicit shoulder pivots. Exact endpoints bypassed the projector (asserted). Deterministic seed 149153; 12 trajectories × 12 cells per interval; intervals 33/66/100/133 ms; Derrick's depth settings and 180 ms timing window. Initial broader sweep was cancelled for excessive runtime; only the bounded result below is evidence.

- 576 comparisons: old/current hit counts 17/17, 20/20, 22/22, 21/21. No hit flips and no extra hit-volume outcome from athlete-facing rear depth.
- Host cumulative old/new query CPU milliseconds: 262/1196, 192/907, 143/746, 128/740. New path approximately 4.6–5.8× old in this fixture. These are sequential, unbalanced, host-only microbench timings and must not be generalized to phone FPS or causal hit-rate loss.
- Production orientation callback executed on interior nodes (162476 calls including depth-setting control queries). Unlike earlier invalid tests, measured histories were not pre-overwritten with arbitrary rotation.

Next independent executable check while waiting for replay: compare actual signed browser frame costs on the same existing deterministic input/content fixture, alternating old/new and controlling frame/sample counts. Distinguish judgement-path work from renderer work where available. Do not change production scoring or claim performance is the cause unless this translates into the affected runtime.

## Signed-browser performance diagnosis (2bsk, in progress)

**Observed:** the same signed-runtime fixture produced ABBA mean real coordinator `advance` times 8.48 ms (.149) vs 42.98 ms (.153), over two 55-frame runs each. Whole-frame means 10.33 vs 45.57 ms; maximum frames 28.7 vs 159.8 ms. This uses actual input/coordinator/renderer and test camera/audio/content boundaries, not a natural camera cadence or phone run. Twelve notes at 100 ms spacing, 66 ms song-clock steps, bottom-right wrists away from top-left targets; all four runs commit the same twelve misses.

**Path:** signed element -> existing scored-Play fixture -> real calibrated input -> one actual gameplay.advance per measured frame -> Flow candidate loop -> swept resolver -> production orientation projector. A test-owned factory wrapper times the genuine advance exactly once; it does not replace judgments or the algorithm. Renderer/rest-of-frame time is much smaller than the observed increase in advance time.

**Cause of a demonstrated portion:** repeated identical reconstruction projections inside the same advance. Current-only profile made 60870 projector requests over 55 updates, with 33257 distinct complete pose/context pairs per-update and 27613 exact repeats. Projector body consumed 1370.5 ms of 2315.2 ms advance time (59%). This is evidence of redundant work, not yet a complete explanation of physical missed beats.

**Controlled experiment:** test-only per-advance cache keyed by full serialized pose/context, cleared at each advance, reused those 27613 duplicate requests. Actual signed current advance mean fell from 42.09 to 27.52 ms; whole-frame mean 29.60 ms, max 85 ms. Same twelve committed event/result records. Sampled cached returns were recomputed and compared for exact value equality. This is a promising partial improvement only: misses-only workload does not prove hit/direction parity, cache reuse does not remove all new work, and production files/live services have not changed.

**Alternatives/unknowns:** some extra cost is required by approved spline/reprojection semantics; source observation cannot determine how this maps to real camera scheduling, device FPS or Derrick's perceived tracking. The original macrobenchmark had no projector profiling wrapper; instrumentation adds its own overhead to the second profile. Need hit, near, reversed-direction, changing config/pivot, reset/seek and stale-evidence parity before any production optimization. Do not disable projection or widen volumes to lower CPU.

**Proposed minimal fix if review supports it:** reuse exact identical pure projection results only inside one synchronous scoring advance, always clear afterward (including exceptions), retain all pose/return validation and sample schedules. Keep both public comparison builds frozen while making/verifying any local candidate. This falls under the existing confirmed-difference investigation, not authorization to silently replace the A/B baselines.

**Independent QA completed:** child 84988c49-8fd3-403f-860c-80cc71435cae (role QA, launch verified) reviewed Bead 6zof read-only. It independently verified all 59 hashes in both snapshots, original dependency pins, byte-identical fixture source, one real advance per frame and report arithmetic. Supports attempting a scoped optimization, not phone-causality or scoring-parity claims. Important qualifications: timings are synchronous performance.now elapsed durations, not isolated thread CPU; pose timestamps follow wall time even with identical song clocks/coordinates; profiler/stringify adds overhead; all outcomes are misses, and equality currently compares event/result only. Current scratch script is cached current-only and overwrites its output; it cannot reproduce original ABBA without restoring its earlier mode. Null old summary in that report means absent run, not zero cost.

QA recommends smaller assembly-owned **orientation-only** reuse by exact hand and x/y within one scoring advance, capturing config/current shoulder pivots after equipment resolution. Rebuild each return through createResolvedEquipmentPose to preserve anchor/z, scale and all identity fields; keep Boxing identity, endpoint bypasses and gameplay validation unchanged. No rounded keys, cross-frame caching, global revision/hash/LRU infrastructure or arbitrary trusted-callback memoization. Next executable work: implement this local candidate, test full judgements in existing 1/2 FPS signed Flow/Boxing hit/exactly-once fixtures plus per-frame pivot/config invalidation, then measure balanced same-current cache OFF/ON without profiler serialization overhead. Do not replace either live comparison build. Parent owns integration/closure.

Existing reports: `.tmp/signed-frame-cost-baseline.json`, `.tmp/signed-frame-projection-profile.json`, `.tmp/signed-frame-cost-report.json` (cache experiment); script `.tmp/measure-signed-frames.mjs` currently runs the cached experiment. No production source change yet.

## Local orientation-cache candidate — implementation/testing

Implemented in `src/spline-equipment-projection.js` and `src/index.js`: a fresh hand/x/y orientation map is created after current equipment/shoulder resolution, used only during one synchronous `advance`, then discarded in `finally`. Boxing remains identity; each Flow return still calls `createResolvedEquipmentPose`. No gameplay package or public A/B snapshot was modified.

The first exact-pose unit comparison exposed one-ULP quaternion drift from caching an already pose-normalized orientation and normalizing it again. Fixed the implementation, not the assertion: cache the quaternion before the existing pose normalization, preserving the original arithmetic/validation order. Expanded existing normal-gate projection tests now deep-compare full returned poses across both hands, repeated coordinates, z/scale changes, asymmetric configuration, next-frame pivots/config, and cached-return rejection of invalid scale.

Expanded existing spline browser test runs Flow/Boxing × 1/2 FPS × cache OFF/ON using the same implementation. Source-browser matrix passed: exact scoring/contact/timing/diagnostic fields match (only independent device wall-clock evidenceTimestampMs is excluded), exactly-once hits and independent held-frame rendering remain valid, and the per-advance projector is null after each update. A dev-watcher ELOOP initially came from exposing a pre-existing branding self-link through the temporary historical asset-source link; removed only our temporary link, leaving the unrelated branding repo untouched.

Candidate commit `309b5a6` passed full current `npm test`, exact helper tests and the signed Flow/Boxing × 1/2 FPS × OFF/ON parity matrix. Every scoring/contact/timing/diagnostic field matched (only independent device wall-clock evidence time excluded), and exactly-once/held-frame checks passed. Strengthened the runner afterward to prove nonzero new-projector invocation when ON; rerun on the same signed candidate passed (Flow 9 calls at 2 FPS, 20 at 1 FPS; OFF zero). This prevents an older artifact from passing cache tests vacuously.

Signed candidate retained at `.tmp/flow-orientation-cache-309b5a6`, stamp `FRIEND-GAME-CPU-0.0.153-62bb382731f93dbb2dfa3934`; no live unit was changed. Reproducible diagnostic command: `AEROBEAT_SPLINE_SIGNED_DIR=<candidate> AEROBEAT_SPLINE_COST_OUTPUT=<new-report> node scripts/measure-spline-projection-frame-cost.js`. Balanced same-candidate OFF/ON/ON/OFF update elapsed means: OFF 44.31 and 46.95 ms, ON 21.82 and 21.55 ms. Aggregates 45.63 -> 21.68 ms (about 52% less update time); whole-frame means 48.47 -> 23.68 ms, maxima 190.7 -> 69.0 ms. All twelve miss judgements match across runs, including scoring/timing/diagnostics. Raw report: `.tmp/orientation-cache-balanced-cost.json`. These are elapsed timings in host fixtures, not phone FPS; the remaining gap to .149 is not eliminated or fully explained.

Same QA child reviewed implementation read-only under Bead kdsq: no likely in-scope blocker; confirmed current config is deep-frozen, pivot scalar capture occurs after equipment resolution, original quaternion math/validation order is intact, each returned Flow pose is validated and Boxing/endpoint behavior is unchanged. Focused unit independently passed. Normal cleanup has runtime assertions; exception cleanup is guaranteed by the inspected finally but not separately fault-injected. Browser parity uses Test center; moving Play pivot/config changes are covered by helper unit and source wiring, not physical evidence.

Next: obtain corrected physical-play exports to relate the demonstrated runtime overhead to Derrick's reported playability. Only the earlier two invalid-baseline captures remain in Downloads on repeated checks across goal rounds 8–11. Do not silently replace either public A/B baseline with the local optimization; deployment/rollback and physical acceptance remain human decisions.

**Debugging record:** Problem: extra signed-runtime scoring cost. Observed symptom: repeatable ~5× advance cost in fixture. Root cause demonstrated in part: duplicate pure projection work. Evidence: callback count/time and cache-removal experiment. Failed approaches: prior geometry-only harnesses measured outcomes, not runtime cost. Corrective action: evaluate tightly scoped synchronous reuse with parity tests. Verification remaining: hit/safety parity and actual built candidate speed. Uncertainty: physical-play causality and remaining nonduplicate cost.

## Diagnostic report — incorrect pre-spline baseline

**Observed failure:** Derrick reported both probe versions felt similarly bad. The .149 capture identifies stamp `480a4d9554943b4bf13ba454`; its build manifest pins post-spline gameplay 20a1697, not original 6f5d6a6.

**Expected:** old assembly plus observation-only UI, with all original dependency identities preserved.

**Execution path:** backport assembly -> shared current node_modules/sibling repositories -> Vite alias resolution -> signed current gameplay dependencies -> old package-version label. The build gate correctly recorded the inputs; the operator compared only the label and button, not the recorded dependency pins.

**Root cause:** incorrect dependency isolation in the earlier backport. This explains why that build was not a valid pre-spline baseline; it does not establish the root cause of the reported playability regression.

**Alternatives:** settings, tracking cadence, user motion, cached content and collision logic remain candidates for the playability report. They cannot explain the demonstrated wrong dependency pins. No claim that the .149 probe and .153 probe were behaviorally identical: the older assembly wiring still differed.

**Why prior checks failed:** a green version label, visible button and helper-unit test cannot verify dependency identity. Earlier button tests also attempted writes into frozen service objects and supplied fake shapes that omitted real nested settings and content lineage.

**Unknowns/minimal reproduction:** the physical regression remains unresolved. Repeat one same-song run per corrected build after refreshing both pages, then export. Do not use the earlier two files to decide rollback.

**Verification/fix:** exact manifest comparison across all fourteen dependencies plus a built native-download test using real coordinator outcomes. Only repair build isolation and observational capture fields; do not alter scoring.

Problem: invalid A/B baseline. Observed symptom: rebuilt .149 uses new gameplay. Root cause: shared current dependency links. Evidence: original and rebuilt manifests. Failed approach: version-label-only acceptance. Corrective action: isolated original-commit worktrees. Verification: all dependency identities equal; actual downloaded payload matches real committed outcome. Remaining uncertainty: physical playability regression.

## Goal

Give Derrick a one-press way to export what the game judged during a song, so the `.149`
vs `.153` hit-rate question can be settled from real sessions instead of synthetic tests.

Today that requires pasting a script into the DevTools console. That is friction on a
handheld, and it has already gone wrong once (a probe on a page whose service had died).
A button removes the console step entirely.

## What Derrick asked for

- A **Download Data** button at the top of the menu drawer, beside the version label.
- It becomes pressable only once data exists and is ready.
- Pressing it downloads a file to the Downloads folder.
- The file records: build version, song name, song id, difficulty, and every option
  selected for the run, alongside the per-note judgement records.
- Shipped on **both** builds (`.149` pre-spline and `.153` current), served at the
  existing public links.

## Sequence this must be added to

Derrick explicitly requested keeping Download Data and extending it into a human-movement recording/replay tool on 2026-11-03. That supersedes the original temporary-button/removal proposal. Feature Bead: 1fnl.

The recorder must remain observational: it must not alter live scoring, timestamps or evidence. Movement/calibration records stay in the locally downloaded file; no automatic upload or video/audio capture is proposed. Replay is an explicit Test-only input source, not live/ranked evidence. The replay UI and data path need a scoped execution plan.

## Design

### Placement

The drawer header is a single line in `src/index.js`:

```html
<div data-role="drawer-surface" class="drawer-surface">
  <p class="drawer-version" data-role="app-version"></p>
  <aero-session-actions class="start-action"></aero-session-actions>
```

The button is added immediately after the version paragraph, inside a small flex row so it
sits inline with the version number. It uses the existing drawer button styling; no new
visual language is introduced.

### Enabled state

The button is `disabled` until the session has at least one judgement **and** the run has
finished (session state `completed`), so a partial mid-song export cannot be mistaken for a
complete one. Before that it reads `Download Data` and is visibly disabled. Once ready its
label becomes `Download Data (N notes)` where N is the judgement count, so Derrick can see
it captured something before pressing.

### Payload

One JSON file, downloaded as `aerobeat-ab-<version>-<songId>-<difficulty>.json`:

```json
{
  "schema": "aerobeat/judgement-capture",
  "version": 1,
  "capturedAt": "<ISO timestamp>",
  "build": { "version": "0.0.153", "buildStamp": "...", "cacheBust": "..." },
  "song": { "name": "...", "id": "...", "difficulty": "...", "chartId": "...", "packageId": "..." },
  "mode": { "rulesetId": "flow", "purpose": "play", "ranked": false },
  "options": { "colliderScale": 1, "colliderDepthForward": 1,
               "colliderDepthBackward": 1, "colliderDepthBackwardAthleteFacing": true,
               "timingWindowMs": 150, "directionToleranceDegrees": 45,
               "<other run options verbatim>": "..." },
  "summary": { "total": 0, "byResult": {}, "sampleCount": 0, "meanSampleGapMs": 0 },
  "judgements": [ { "eventId": "...", "result": "...", "tier": "...",
                    "diagnostics": [], "timingOffsetMs": 0,
                    "beatCenterTimestampMs": 0, "committedTimelinePositionMs": 0 } ]
}
```

Options are copied from the snapshot's collider settings and game setup verbatim, so the two
runs can be proven to have used identical settings — that is the whole point.

### Implementation surface

- `src/ab-judgement-capture.js` (new): builds the payload from a gameplay snapshot plus
  game-setup/collider settings. Pure function, no DOM, no download.
- `src/index.js`: render the button, wire its enabled state to the snapshot, and perform
  the download via a Blob + object URL.
- One focused source test for the payload builder (schema, options echo, judgement mapping).
- One browser check that the button is disabled before a run and downloads valid JSON after.

### Serving

Both builds need the button, and each is currently a frozen signed snapshot:

- `.153`: rebuild from assembly source at `6aa7422` + this change, new snapshot
  `.tmp/boxing-ab-<commit>`, served on 4216 via `aerobeat-r153`, public 443.
- `.149`: this is harder. `.149` is a signed snapshot built from assembly `ae07836`, and
  rebuilding it means repinning the old dependency set. I will rebuild it from the `.149`
  pins **plus** this change, producing a new snapshot with the same gameplay code as
  `.149`. Its version string stays `0.0.149` so capture files self-identify, and I will
  record the exact source identity in the README so the provenance is unambiguous.

If rebuilding `.149` proves to disturb its gameplay pins in any way I cannot verify, I stop
and report rather than serving a build I cannot vouch for.

## Acceptance

1. Both public links serve their expected version with the button present at the drawer top.
2. Button is disabled with no data; becomes pressable after a completed run.
3. Pressing it downloads a JSON file whose `build.version`, `song.id`, `song.difficulty` and
   `options` match what Derrick selected, and whose `judgements` match the in-game results.
4. Gameplay is unchanged: existing signed regressions still pass on both builds.
5. Derrick plays one song per build and presses the button; I diff the two files.

## Non-goals

- No automatic upload, no network call, no telemetry. The file lands in Downloads only.
- No change to scoring, colliders, timing, or difficulty.
- No new developer-facing settings screen.
- Superseded: the original temporary-button removal requirement. Derrick now wants the button retained and expanded under feature Bead 1fnl.

## Risks

- `.149` rebuild is the main risk: repinning an old snapshot can silently shift a
  dependency. Mitigated by verifying version strings and running that build's existing
  signed checks before serving.
- The button adds one control to a shipped UI. Kept to the drawer header and existing
  styles so it cannot obscure gameplay.