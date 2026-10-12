# Real-phone Faint v2 variant profiler: paired-run diagnosis

## Scope and source

Derrick pasted two version-2 exports from private HTTPS 8449 on the same pinned historical assembly, renderer, gameplay, authoring and audio revisions. This record compares **the complete native export with 100 later hits** to the complete off export with 107 later hits. A separately pasted native report ended midway through its first-hit `variantProfile`; do not treat it as the complete native run or merge its samples into these counts. Both complete runs use the same 864×1618 backing, DPR 2.5 and 432×809 viewport, and have zero reported errors. Ignore invalid generation-1/menu and after-export windows and use `eligibleActiveMs`, never `wallElapsedMs`, for cadence. These are separate physical plays, not frame- or note-matched trials, and this historical build is not source-matched to served 8445 or Cookie 0.0.128.

## Exact observed failure

The later native window has 100 scored hits in 56.5921 eligible seconds, 1,759 eligible intervals (~31.08/s), and p95 display interval/full app frame 107.5/96.5 ms. Off has 107 hits in 56.4105 eligible seconds, 2,064 intervals (~36.59/s), and p95 interval/frame 40.5/33.5 ms. Native post-hit renderer-call p95 is 84.5 ms; off is 5.5 ms. Off observes and withholds all 12,300 intended pieces; native renders 8,886 observed pieces. Both have no grouped hits in their later windows. Off still has low overall cadence, so it does not resolve the remaining baseline problem.

Within the later native window, 126 of 1,760 eligible RAFs (~7.16%) observed one or more *new* clipped-material cache entries. On those 126 frames, renderer-call p50/p95 is 84.5/90.5 ms; `manualTickMs` p50/p95 is 78.5/84.5 ms; full-frame p50/p95 is 101.5/114.5 ms. Across 1,222 frames where aftermath was visible but **no** new variant appeared, renderer p50/p95 is 4.5/6.5 ms (max 13.5), tick p50/p95 is 1.5/4.5 ms (max 8.5), and full-frame p50/p95 is 19.5/30.5 ms (max 44.4). The remaining 412 eligible native RAFs are in neither visible-aftermath cohort, so these cohorts do not partition every RAF.

The later native window has 768 new variants, 12,876 cache hits, cache high-water 798, 10 pool creations and 4,538 pool reuses. Synchronous variant lookup takes 519.2 ms in total across 13,644 calls (max 2.9 ms); clipping-block installation 66.4 ms across 768 calls (max 1.6 ms); pool lookup 31.4 ms across 4,548 calls (max 2.6 ms). Clipped appearance totals 840.5 ms across 4,548 calls (max 7.9 ms); scene update p95 is 4.5 ms (max 11.7). By contrast `manualTickMs` p95 is 77.5 ms (max 155.3) across 1,760 RAFs, with 12,128.1 ms total. These wall timers overlap within their parents and include observer overhead: **do not subtract their aggregate p95 or sums to invent CPU phases**. Off records zero on-only pool/variant/clip calls and zero native cohort frames, while still timing scene update p95 1.5 ms and manual tick p95 3.5 ms in its later window. An off first-hit frame nonetheless has tick max 121.3 ms, showing that an occasional generic device hitch is possible; the *sustained severe tail* and strong miss-frame association are what differ.

The complete native first-hit window independently shows 3 hits, 30 new variants, five miss frames versus 28 aftermath/no-new frames. Miss-frame tick p50/p95 is 81.5/144.5 ms, versus 2.5/3.5 ms on aftermath/no-new frames. Off first-hit has 2 hits, 200/200 pieces withheld and zero on-only operations; those short first-hit windows are less closely matched than the later windows.

## Expected behavior and execution path

A scored Test cut should keep gameplay/scoring/feedback and correctly clipped corpse visuals without long stalls. The actual path is scored `runDisplayFrame` → gameplay aftermath creation → visual projection → historical renderer `updateSceneObjects` → pooled corpse entity and clipped-material variant lookup/appearance → renderer `manualTick`. Off filters only aftermath render entities before the renderer; scoring and aftermath construction remain. The v2 wrappers count cache additions and time synchronous renderer methods; `manualTick` includes browser/driver synchronization and is **not GPU timing**. A distinct material-cache entry is not necessarily a distinct compiled shader program.

## Most likely root-cause boundary, alternatives ranked

1. **High confidence association, mechanism not proved:** first use or submission of a *new clipped corpse material* occurs on the same RAFs as severe `manualTick` and full-frame stalls. The same window has many fast frames with visible old corpse materials, and off scores similar hits while removing all corpse render work. This places the dominant observed stall beyond the cheap synchronous `sliceVariantMaterial`/clip-block/pool lookup itself, plausibly at first draw, state upload, shader/program preparation or driver synchronization during `manualTick`. It does **not** prove shader compilation, GPU duration, or which exact call caused the stall.
2. **Possible correlated hit-only work:** new variants and another renderer operation could both occur on scored cuts; the aggregates have no per-hit causal intervention. Off removes all corpse rendering, not solely variant creation, and runs/thermal state are not note-matched.
3. **Unlikely as the dominant severe stall:** entity-pool creation (10 creations versus 4,538 reuses) or synchronous key lookup/clipping installation (individual max 2.9/1.6 ms) cannot by themselves explain miss-frame ~80–90-ms median renderer/tick time. Appearance/scene staging costs several milliseconds on miss frames but their observed maxima are 7.9/11.7 ms, not the whole severe tail.
4. **Independent baseline costs:** off still runs ~36.59 eligible intervals/s, and occasional off first-hit tick max 121.3 ms indicates unrelated scheduling/driver/scene events remain possible.

## Why previous approaches were insufficient

No production pooling fix has been attempted. Earlier no-hit/shadow and synthetic hit workloads did not reproduce the real full-song slowdown. The v1 native/off ablation implicated corpse *delivery* but lacked variant and stage probes. V2 removes that ambiguity about synchronous lookup versus tick and provides same-frame conditional cohorts, but an observational cache miss is not a causal ablation of first-use draw/compile. Earlier v1 first-hit intervals also included the preceding pre-hit interval; this v2 recorder fixes that attribution.

## Unknowns and minimal reproduction

Unknown: exact browser/driver operation inside `manualTick`, actual GPU duration, whether one compiled program is shared among all unique material entries, phone heat/run-order effects, and parity with served 8445/release source. The smallest observed reproduction is actual scored Faint Test play on this pinned build with corpses visible: later miss-bearing RAFs show high tick/renderer timings; same-run aftermath/no-new RAFs are fast, while a separate off play still scores comparable hits and withholds all pieces.

## Proposed discriminating verification before any fix

On the **detached historical Test only**, build one narrowly controlled diagnostic A/B that preserves gameplay and cut parameters but separates creation of a new clipped material from its first visible draw (for example, instantiate the material on the hit frame and defer that corpse's first draw by one RAF). If the stall follows first draw rather than material creation, prioritize GPU-program/state upload or browser-driver synchronization; if it remains on the creation frame with no draw, inspect synchronous staging. This still cannot identify *shader compilation* without supported GPU/browser tracing or a separate shader-program prewarm control. Compare actual scored same-section, alternating-order phone runs with unchanged pixels in normal mode, same geometry, matched hit count and thermal/quality notes. Do not blindly pool entities or deploy an optimization to production. Preserve existing off and native visual/score QA and add a bug-specific negative control for whichever diagnostic knob is chosen.

## Recommended action

Treat per-hit variant **first-use rendering** as the leading optimization candidate, not variant-map lookup or entity-pool growth. Authorize a small isolated historical diagnostic A/B or supported GPU trace before selecting a material/shader strategy. Keep the off-mode ~36.6/s baseline as a separate investigation. No production code or source-matched release change is justified by these aggregates alone.

## Debugging record

```text
Problem: Real scored Faint cuts produce a severe native renderer tail and ~31 eligible display intervals/s.
Observed symptom: Native later miss frames renderer p50/p95 84.5/90.5ms, tick 78.5/84.5ms; visible aftermath/no-new frames renderer 4.5/6.5ms, tick 1.5/4.5ms; off scores107 hits with 12300/12300 pieces withheld and later tick p95 3.5ms.
Root cause boundary: Severe stalls are tightly associated with introducing new clipped corpse materials and occur predominantly during renderer manualTick; exact GPU/driver/shader mechanism remains unproved.
Evidence: Complete v2 native/off reports, common source pins and geometry, 126 miss frames vs1222 visible no-new frames, synchronous lookup max2.9ms, pool-created10/reused4538, off on-only work zero.
Failed approaches: No production fixes; synthetic/no-hit workload missed real Faint behavior and v1 ablation could not separate renderer stages.
Corrective action: Test creation-versus-first-draw separately in a historical-only A/B; do not optimize by guesswork.
Verification test: Same-section physical scored A/B with preserved geometry/scoring/normal-mode pixels, a bug-specific gate and if available GPU/browser trace.
Related files/components: faint-hit-diagnostic.js, pinned renderer-facade.js corpse variant/cache/entity methods and manualTick, Test scene aftermath filter.
Remaining uncertainty: Shader program reuse/compilation, GPU duration, run-order/thermal state, independent off-mode baseline cost, 8445/release source parity.
```
