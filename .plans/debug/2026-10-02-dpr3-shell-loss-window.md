# DPR3 browser shell tracking-freeze timing

**Bead:** `aerobeat-web-assembly-kgnj`, discovered from intentional menu-close cue oracle `8ivr`. Source-only; no raw/live change.

## Exact observed failure

Full `node scripts/validate-product-shell-matrix.js` reached `iframe:390x844@3` and failed at line 247, before the changed cue assertion. An independent focused DPR3 run failed identically. The fixture demands three unfrozen low-confidence snapshots and a fourth frozen; actual flags were `[false,true,true,true]`. All four frames kept gameplay `playing`, audio `playing` with no extra play call, same calibration ID and anchor coordinates, frozen evidence, nose cursor and two wrist equipment poses. The first three snapshot audio-timeline advances were +509, +489 and +475ms despite requested sample timestamps only 250ms apart.

## Expected behavior

Input's real 750ms consecutive tracking-loss decision must freeze calibrated anchors once the elapsed *measured/no-frame loss clock* reaches threshold; no early freeze before that threshold. The shell test must not assume an exact array index when browser rendering and no-frame ticks can advance the clock between requested poses.

## Execution path, root hypothesis and alternatives

`pushPose` changes the synthetic CV pose and sleeps at least 80ms. The assembly display loop reads new poses through `input.processPoseSample()` and advances missing-frame time with `input.advanceTime(performance.now())`. The input service increments loss on low-confidence anchors and no-frame ticks; when sufficient consecutive misses and >=750ms elapsed, it freezes the last measured anchors without pausing gameplay/audio. At DPR3, expensive rendering/Playwright work can take ~500ms between test snapshots, so the test's nominal four×250ms assumption is unsupported. Leading hypothesis is a stale exact-index fixture oracle. An actual early latch below 750ms or a source-ID mismatch is less likely but not ruled out by the current log; inspect scalar `input.tracking.lossDurationMs`, input timestamp, latest pose timestamp, fresh-pose/no-frame counts at each row to distinguish. The cue fix only changed a later menu-close assertion and cannot directly cause this earlier failure.

## Prior attempts, unknowns and verification

There was no product change for this failure. The previously successful full suite predates the new cue oracle but shares the same timing-sensitive loss row. An isolated rerun reproduces the row failure, so it cannot be dismissed as a one-off Playwright protocol hiccup. Before changing the oracle, report loss duration and no-frame ticks per row. A strict replacement may require the first row before >=750ms to be unfrozen, a later row at/after >=750ms to be frozen, monotonic latch, and unchanged session/audio/anchors/rendering. Never loosen the product input loss threshold or allow a freeze below its actual clock.

## Debugging record

```text
Problem: DPR3 shell expects loss freeze at fixed fourth synthetic pose.
Observed symptom: frozen flags [false,true,true,true] at line247; full and focused iframe:390x844@3 fail.
Root cause: likely stale index oracle under real elapsed no-frame/rendering time; not yet confirmed without lossDurationMs scalars.
Evidence: snapshot audio timeline moves ~475–509ms per row, Play/audio/anchors and calibration ID retained.
Failed approaches: rerunning unchanged focused DPR3 reproduces; cue change affects only later line270.
Corrective action: instrument scalar loss clock; if threshold respected, assert threshold/latch not fixed row; preserve safety gates.
Verification test: focused DPR3 plus full direct/iframe matrix and assembly browser suite.
Related files/components: scripts/validate-product-shell-matrix.js, src/index.js runDisplayFrame, input body-grid-service.js.
Remaining uncertainty: exact lossDurationMs at first frozen row and extent of no-frame ticks.
```
