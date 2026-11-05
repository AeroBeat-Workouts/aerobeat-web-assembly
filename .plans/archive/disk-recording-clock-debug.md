# Native capture clock diagnosis

## Exact observed failure
Signed157 source77bba3f captures and exports successfully, but native Test rejects `Play movement capture: observations wall timestamps roll backwards` (AB script line161). Saved original short download `/tmp/aerobeat-r157-real-capture.jsonl.gz` has50observations/48actualadvances. First observation3633.1667ms, next2657.9ms; corresponding input measurements3633.1667/3699.8333ms. A later3699.8333ms metadata observation precedes2810.8ms subscription observation. These are measured fixture timestamps versus actual performance.now receipts, not corrupt gzip rows.

## Expected behavior
The genuine browser test must use honest monotonic wall/measurement clocks while exercising actual Play capture and Test. Preserve original recorded values/order and importer validation; do not clamp or sort observations to manufacture acceptance.

## Execution path
scored-play-browser-harness.calibrate sampled() advances its measurement timestamp by66.67ms but loops every35ms. runDisplayFrame bounds advanceTimestamp by the future pose timestamp. Lazy recording first observes that advance context. Next real input subscription is stamped performance.now, nearly1second earlier. JSONL preserves both numbers; streamed importer rejects the backwards observation clock.

## Most likely root cause
The native harness comment says measurement clock is bounded by real wall time, but Math.max(now,previous+66.67) with35ms waits drives it into the future. This directly explains both exact inversions. The authentic human155 recording has7063observations and ZERO wall rollbacks, supporting fixture-specific clock drift.

## Alternatives
Storage reordering is contradicted by sequential row indexes, same input/model references and exact codec roundtrips. Product clock mismatch remains possible at submillisecond boundaries; honest wall-paced fixture will distinguish it. Admission must not be loosened merely because the old reader accepted this fixture.

## Previous fixes
Optional undefined camera fields were a separate invalid_row failure. Omitting those absent optional producer fields restored actual completed persistence/export; this new error occurs later at Test file admission. Node source/unit data never drove calibration faster than wall time. Saving originally at end of native script lost failed-flow data; moving optional capture copy immediately after download preserved the genuine evidence.

## Unknowns
Will honest wall-paced sampling remove all inversions, including submillisecond receipt/advance edges? Same signed native check answers this without product timestamp normalization.

## Minimal reproduction / verification
Run AEROBEAT_AB_SIGNED_DIR=dist-friend-game AEROBEAT_AB_TEST_REPLAY=1 AEROBEAT_AB_CAPTURE_OUTPUT=/tmp/aerobeat-r157-real-capture.jsonl.gz node scripts/validate-ab-capture-browser.js. Inspect short original file through the test-only download inspector. Correct calibration sampler to wait for real15fps cadence and timestamp each published sample at actualperformance.now. Require the same native reader/markers/outcome/seek/restart assertions to pass, or inspect any remaining inversion.

## Recommended fix
Make only the fixture calibration sampler asynchronous and wall-paced. Keep actual2smeasuredhold, actual3/2/1countdown and15fps measurement cadence; remove artificial future increments. Await sampled() throughout this helper. Other consumers retain same API because calibrate alreadyasync. No scoring/CV/productclock or importergate changes. Then run native AB and existing reversal pipeline.

## Debugging record
Problem: native streamed Test rejects the genuine fixture's captured observation clock.
Observed symptom: approximately1second wall-clock inversions in first calibration/countdown observations.
Root cause: harness advances66.67ms per35msrealwait; product captures those fixture-future advances alongside real input receipt times.
Evidence: exact original50row download, fixture lines226-243, authentic7063-observation human capture haszero rollbacks.
Failed approaches: no product clock fixes attempted; optional camera fix solved earlier distinct error.
Corrective action: honest real15fps calibration fixture, preserve capture/import numbers.
Verification test: same signed native AB workflow, then reversal/negative/late checks.
Related files/components: scripts/fixtures/scored-play-browser-harness.js; nativeAB runner; production recorder/subscription and stream reader.
Remaining uncertainty: resolved below by the wall-paced capture.

## Wall-paced result and corrected interpretation

The fixture fix removed the ~1second invented future timestamps, but a legitimate0.5ms inversion remains: input subscription observation3715.7ms followed by actual tick/model-context observation3715.2ms. This is receipt time versus display-frame start time from the same actual advance, not storage reordering. The prior v1 reader did NOT impose monotonic observation wall time; the new stream reader added that gate. It rejects valid existing producer semantics. Do not rewrite any captured number or sort rows. Remove only this newly introduced, unshipped observation-monotonic requirement; keep finite timestamps, exact row order, references, completeness and monotonic actual tick checks. This restores baseline admission rather than weakening an existing shipped guard. Add a regression for this exact receipt/frame-start distinction, then the genuine native Test must prove identical outcomes and original samples. The wall-paced harness correction remains useful because it makes the test's physical-time claim honest.
