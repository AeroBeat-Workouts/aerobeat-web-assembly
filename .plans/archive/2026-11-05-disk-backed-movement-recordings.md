# Disk-backed movement recordings without a fixed song-size cutoff

Status: COMPLETE, VERIFIED AND LIVE as0.0.157.

Final result: all milestones complete.134signed AB and135signed reversal/negative/late/nativeTest+recordcost/fullnormal suite PASS.136actual HTTPS matches exact frozenHTML/entryJS/version/controls withoutpageerrors; main157 and149bothservicesactive,149unchanged. Frozen signed source1b3596c, artifact .tmp/cpu-r157-verified-1b3596c, stamp FRIEND-GAME-CPU-0.0.157-7d6449b9c054e651f99a5dd0. Browser-local temporary numeric storage only, no upload/media, boundedRAM, no total-songbyte/tickcutoff; quota/errorshonest. Oldmissingmovementnotfabricated; nextphysicalplaytest isfuturefeedback. No further verification is required for this scope.

Original approval: Derrick accepted the proposal to compact recordings and stream them to local storage, keeping memory bounded instead of truncating songs at48MiB. This explicitly revises the previous memory-only/no-persistence policy for temporary numeric movement data. Owner Pico, assembly current main; baseline public0.0.156. Preserve accepted scoring/tracking and authentic149.

## Verified implementation checkpoint (before publication)

Product and streaming replay are integrated onmain1b3596c; signed0.0.157 build from that exact source is in dist-friend-game. NOTLIVE; public remains156 and authentic149 untouched. New producer has no all-song arrays or48MiB/120000tick caps. New import has no total64MiB cutoff. Complete legacy JSON support is retained, not a second scorer.

Parent134 PASS:40focusedunit tests (see /tmp/aerobeat-disk-clock-unit.log), npmcheck with actualgraph/iframe/leaseconsole, provenance-safe build, then genuine signed DownloadData -> nativeLoadRecording markers/equipment/outcome/pausedseek/resume/restart/Clear/lease/preferences/legacynegative. Actualshortcapture49measuredframes/48realadvances. Parent127 also directlypassed nativebrowserstorage79,869,563logicalbytes/120002ticks,1,051,826pendinghighwater underconfigured2MiB,35,964,051Bdiskbackedgzipfile; focused8MiB record/header,16MiB queue, quota/write/dispose/orphan/other-tab/abort checks PASS. These are deterministic browser fixtures, not a new human playtest.

Current backgroundjob135 runs signed reversal/negative/late replay+recordcost, then FULLnormal npmtest. Collect135 before acting; do not duplicate its work. On green: freeze dist-friend-game as .tmp/cpu-r157-verified-1b3596c, read exact manifeststamp/filecount; update source/retention docs and plan/Beads, commit/push coherent currentmain; update EXISTING aerobeat-r153-abprobe.service4216 to that frozenartifact only; verify mainHTTPS exactHTML/entryJS/version and149unchanged like prior156helper. Current .tmp/verify-published-r156.mjs can be adapted for157. No additional broad audit or storage stress repeat is required after unchangedstore passes. If135fails, inspect specific log (/tmp/aerobeat-r157-reversal.log or-normal.log) and fix only affectedslice.

Workers complete/no active work: storageb1e447f5 cfdde06/a83269a/78a3f1c (l9ejclosed), replay593434ca155e265/8a82605 (pgocpendingparentaccept), nativeteste12a0754170341a (xn3ypendingactualresult), QA84988c49 onepass1djz. Parent4523bb3/77bba3f/1b3596c integrate and correct. No secondreview requested. AllinitialQAfindings addressed: optionalcamera fields omitundefinedatproducer; preparationchecksAbortSignal betweenboundedreads withunitregression; repeatedfinishedexportscachedonceperrun.

Firstsigned failure was actualconfigurationinvalid_row; optionalabsentcameraJSONfields fix77bba3f makesactualcapturecomplete. Later newimport rejected mixedreceipt/frame-start clocks. Diagnostic .plans/disk-recording-clock-debug.md contains exactoriginal evidence and rationale: preserve everyoriginalnumber/order, restoreexistingv1observationclocksemantics ratherthannewunshippedmonotonicobservationgate. Actualticksremainmonotonicchecked. Honestwall-paced15fpsharness eliminatesfutureclockdrift; residual0.5msvaliddifference ispreserved.134genuinenativechecksnowPASS. Originalprivatehumanfileunmodified.

## Approved design and original acceptance

Deliver the same Download Data -> Test Load Recording workflow with bounded working memory during capture, export, import and replay. Use browser-local temporary storage and lossless encoding/compression, not reduced sampling/precision. Prefer existing browser primitives and one chunk store over custom storage/custody frameworks. No upload, camera video/images, audio, ranked replay authority or new visible developer UI.

Next passing check: real Chromium stores more than48MiB of logical movement through a bounded queue, exports a portable file without materializing the whole recording, streams it back for Test, and cleans up temporary data. Confirm available storage/stream primitives before locking implementation. A record log with versioned header/rows/footer is acceptable if it simplifies streaming; legacy complete JSON captures remain readable, and old incomplete captures remain rejected. Do not retain two competing production recording modes or silently fall back to the old cutoff.

Recording starts at the initial ready countdown, as fixed in156. Keep exact raw/calibrated markers, model/settings changes, clocks, equipment endpoints and every actual observation/advance. Store repeated metadata once and/or use native lossless compression rather than a new lossy codec. Disk quota, unavailable storage, write errors and sustained backpressure must produce an honest error while gameplay continues unchanged. "No fixed song-size cutoff" does not mean infinite disk space or an unbounded in-memory queue.

## Scope and execution

1. Inspect current recorder/export/reader/playback contracts; create linked Beads and a concrete shared chunk-store interface. Prove browser storage/export streaming early, not a long architecture review.
2. Replace all-in-memory producer tables with a compact disk-backed journal and bounded write queue. Make completion wait for pending writes before export, without blocking scoring. Integrate local temporary cleanup at replacement/disconnect/Clear and stale data cleanup that does not delete another active tab's recording. Cleanup is required by this new persistence policy, not an excuse for a generic custody framework.
3. Stream file import into the same bounded local store; adapt Test iteration/seek/restart to asynchronous bounded reads/caches, not a giant JSON.parse, full arrays or ever-growing per-frame Maps. Preserve matching-content validation, fresh Test namespaces/audio-only lease and local settings isolation. Keep complete legacy JSON input support through its existing bounded path, but use one replay/scoring implementation.
4. Parent integrates lifecycle/buttons and uses actual signed capture/download/native Load Recording early. Test beyond old48MiB/64MiB and old120000tick count, exact markers/numbers/settings/outcomes; quota/write/abort/cleanup and no new network requests. Existing short replay/control and accepted scoring regressions stay green. One focused QA pass for this privacy/lifecycle change; no recursive audits.
5. Document numeric data retention/cleanup, file compatibility and disk-space failures. Commit/push coherent source and tests. Version/sign/freeze the successor, update only existing main4216 service, verify actual public HTTPS version/bytes and149 unchanged. No repair of missing data in old truncated files.

## First signed integration diagnosis

Storage browser checks pass79.9MB logical/120002ticks, exact compressed export and bounded queue, quota/dispose/orphan/other-tab/abort paths. Parent37 focused tests and npmcheck pass. First signed157 build4523bb3 fails native capture after real completion: capture_error/invalid_row, zero ticks. Added diagnostic shows inputs1/models1/configurations0, while actual input/model/gameplay configuration have no invalid scalar fields. The configuration producer explicitly copies optional camera fields absent on some surfaces; new store rejects undefined properties whereas old JSON serialization omitted them. Smallest correction is to omit undefined OPTIONAL camera descriptor properties at that producer boundary. Keep strict finite values/row gates unchanged. Confirm by the same signed check, not by relaxing the failure assertion.

QA1djz also found prepareRecordedTest scans lacked AbortSignal after parse; thread the existing signal through that validation loop and ensure finally disposes cancelled imports. Nonblocking repeated-export disk copies can be avoided by retaining a single finished export per run. No new audit/security framework is required.

## Gate review / limits

The old48MiB capture and total64MiB JSON-file admission limits must not constrain the new streamed transport; replacing these limits is directly approved by this request. Retain bounded per-record parsing, structural validation, existing safety/provenance gates and truthful completion/error status. Bound working chunks/caches, not total song length. Any extra gate needs a concrete observed failure or requirement. Do not change physics, CV, authored timing/direction, song libraries or preferences.

## Owners and references

Assembly owns this slice. Prior repair cqg1 is closed; optional iomn is related but was not sufficient for the original failure. New umbrella/child Beads and verified worker IDs follow after assignment. DSH goal cap Maximum safe integer. Private human captures stay local/uncommitted. Source docs must distinguish synthetic long-capacity fixtures, genuine built flows and future physical feedback.

No mockup/UI redesign applies. Authorized public outcome: latest tested game remains available at the existing main link after this improvement.
