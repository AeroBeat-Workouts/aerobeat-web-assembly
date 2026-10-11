# Real Faint phone slowdown: paired native/corpse-off debug record

## Exact observed failure

Derrick reports a real-phone full-song Test slowdown when slicing Faint Expert Flow beats and seeing corpses. In the pasted eligible generation-2 native run, the later 112-hit interval rate is ~30.49/s; p95 display interval 106.5 ms, whole app frame 94.5 ms and hit-linked renderer-facade call 83.5 ms. The separate corpse-off run has 175 later hits, rate ~34.49/s, and corresponding p95 42.5/35.5/5.5 ms. The two empty off generation-1 windows and one empty native generation-1 window have no eligible samples and are excluded. These are phone measurements, not host-fixture FPS or GPU timing.

## Expected behavior

A scored Test cut should present smoothly; hiding *only* corpse render entities should leave gameplay judging/model construction/feedback unchanged while eliminating corpse drawing. The diagnostic's off report indeed counts all intended pieces as withheld; score/hits persist.

## Execution path

Real touch/saber → full Test display frame and gameplay score → aftermath and feedback projection → recorder observes `aftermath` objects → off-only filter omits those objects before renderer `updateSceneObjects` → renderer facade constructs scene model, stages pools/materials and ticks PlayCanvas. Historical renderer `src/renderer-facade.js:588–598,695–737,787–815` shows corpse-only entity pool acquisition, clipped appearance updates and lazily cloned cut-plane material variants. `rendererCallMs` times the outer facade invocation, including possible browser/driver synchronization; it does not isolate those operations.

## Most likely root cause boundary

The *severe tail* depends substantially on delivering aftermath visuals to the renderer in this historical build. Off still judges more hits and observes/withholds every intended half, while later hit-linked renderer-call p95 falls from 83.5 to 5.5 ms and first-hit p95 from 77.5 to 8.5 ms. Exact substage and GPU/CPU cause are **not established**. Off still runs ~34.5 eligible intervals/s and thus does not explain the entire sustained 30–40-FPS regime or earlier >100 miss-swing rate.

## Alternative hypotheses, ranked

1. **Clipped corpse material variants / updates or entity staging:** source constructs key including cut-plane position and direction; repeated variant creation or material dirtying is plausible, but no cache/miss or per-stage timing was exported.
2. **Actual GPU draw/fragment work or driver synchronization:** visible corpse geometry/clip shaders exist only on, but the timer is main-thread wall time, not GPU duration.
3. **Run order, section or heat/cache differences:** native was 60.6 eligible seconds/112 hits/one grouped frame; off 85.6 seconds/175 hits/no grouped frame. Same source/geometry and higher off hit count weigh against absent-work explanation, but runs are not aligned by note.
4. **Other hit/scoring/feedback work:** off preserves it; its ~34.5/s cadence shows remaining cost or unrelated scene/device ceiling, but it cannot by itself explain the large on-only renderer tail.

## Why prior approaches were insufficient

Earlier synthetic committed-hit and shadow-off reports produced an initial burst but stayed near 60 FPS; they did not play the real chart with scored touch/corpse geometry. The first real native report reproduced the issue but could not isolate corpse visuals. The actual off ablation now narrows that boundary; it does not reveal the exact renderer operation.

## Unknowns

Matched song-time/quality/thermal state, whether grouped cuts were hit in off, material-variant cache misses/count, entity acquisition counts and stage durations, GPU timestamps/driver stalls, and whether this historical build reproduces the same mechanism on served 8445. Aggregate histograms do not pair each native frame with its off counterpart.

## Minimal reproduction

Open private 8449 historical Test with the imported Faint chart, Automatic Feedback OFF, visible hand and CV idle. Slice actual notes with corpses on; export native JSON. Hide corpse visuals, replay comparable section and export off JSON. Compare only valid similar-geometry scored windows. Non-hitting motion and host synthetic workload are insufficient substitutes.

## Proposed verification

Repeat grouped cuts in reverse-order off→on over the same chart section and quality, recording heat/charge state. In a separate disposable historical diagnostic, collect bounded scene-update substage wall time, new/reused corpse entities, material-variant cache misses/count and optional supported GPU timer in scored display frames. If the on-only slow frames align with cache misses/material staging while off preserves scoring, target that code; if scene staging is cheap but GPU time spikes, target draw/shader complexity. A visual QA gate must preserve correctly clipped gray halves, scoring, feedback, saber, target and sky.

## Recommended fix

**No speculative production fix yet.** The smallest safe change is first to identify which on-only renderer operation dominates; then cache/parameterize the offending material work or reduce draw cost as measurements dictate. Avoid deleting corpse behavior, scoring or production Play/CV. Re-test real phone, native/off and grouped visual fidelity on the same pinned historical build before considering any source-matched production port.

## Debugging record

```text
Problem: Real-song scored Flow cuts cause sustained low cadence and large stalls.
Observed symptom: Native later p95 interval106.5ms/full-frame94.5ms/hit renderer83.5ms; off 42.5/35.5/5.5ms, yet off ~34.5 intervals/s.
Root cause: Severe tail strongly associated with corpse visual renderer delivery; exact GPU/material/entity substage unproven.
Evidence: Same pins/geometry, off withholds18902/18902 observed halves while judging175 hits; native withholds0/10096 while judging112.
Failed approaches: No-hit shadow workload and synthetic hits missed real full-song scored/cut workload; native-only recorder had no corpse-off control.
Corrective action: Do not optimize blindly; add scoped corpse-renderer substage/cache/GPU probes and consider reverse-order matched grouped-section replication.
Verification test: On/off scored phone windows with aligned quality/hit groups plus bounded new-variant/entity/draw timing; red/green visible corpse pixel check.
Related files/components: detached historical renderer src/renderer-facade.js, game aftermath projection and scene filter, Test recorder and Faint fixture.
Remaining uncertainty: actual material cache/compile, GPU time, device heat/song section, other sustained baseline costs, served8445 source parity.
```
