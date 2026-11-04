# Keep calibration waiting out of the full-song recording budget

Status: APPROVED for immediate repair by Derrick, Bead cqg1. Owner Pico.
Current live0.0.155 is accepted for performance/tracking; do not change scoring or tracking. Preserve authentic149. Publish a distinctly versioned successor after the affected signed flow passes, under Derrick's standing request to update live after fixes.

## Current decision and next acceptance

Measure the actual file before changing format or budget. That measurement is complete: recording began about4m52s before the song, retaining41902 calibration advances,4355 input snapshots and4351 raw poses. Pre-play calibration costs about19MiB. Song-only through178.28s costs about28MiB. Full capture hits48MiB and Test correctly rejects its truncated status. Inputs, not the two chart configuration rows, dominate bytes. The optional iomn chart-dedup proposal is not a demonstrated sufficient fix.

Next: inspect actual recorder start ownership. Smallest proposed fix is to begin the per-run recorder at the first ready countdown/playing boundary, recording the then-current complete input/calibration model/settings and every subsequent actual observation/advance, including in-run pause/recalibration. Do not spend the run's budget while waiting for first calibration. If source inspection contradicts this approach, report evidence before broadening to compaction. Keep48MiB and all existing truncation/freshness/replay gates; do not reconstruct missing human data or mark the old incomplete file complete.

## Diagnosis

Observed file: personal Downloads0.0.155 Undefeatable Expert, source349F2/hash3571ed07e3424be6f723ea96c10a8e15df688706; full830 judgements825hits. Movement stopped at178.2827s with recording_limit,50323248 estimated bytes of50331648. Production reader rejects incomplete recording.
Execution: Play request starts capture -> calibration waiting continues to consume live observations/advances -> capture budget exhausted before the song ends. Expected: useful complete song movement with original calibration, without pre-start waiting consuming the song allocation. Root cause candidate is confirmed storage in pre-play phase; exact caller ownership is next. Alternatives: repeated charts only0.8MB, equipment0.66MB; neither explains50MB. No previous repair attempted. Unknown: exact full-song post-start footprint and lifecycle placement; source + measured stress/native flow will resolve it.

## Milestones

1. Claim cqg1; diagnose actual bytes/phase counts and lifecycle. Done measurements, inspect source next.
2. Small recorder-lifecycle correction in assembly; focused tests for long initial calibration waiting, initial marker/model/settings snapshot, all post-start updates, pause/recalibration/restart/stop, unchanged gameplay. Keep old file validation and exact numbers.
3. Capacity regression at actual measured frame/render rates for a full Undefeatable-length run after a long pre-calibration wait. A generated continuation is synthetic, never claimed recovered human data. Then genuine signed Download Data -> native Test Load Recording exercises the changed start boundary with original markers/outcomes and existing controls. Run current normal/replay suite, no new proof layers.
4. One bounded review if warranted, docs/Beads/commit/push; build/sign/freeze next patch, update only existing main4216service and confirm actual HTTPS bytes/version. Preserve149 and prior snapshots. No camera/video/audio storage, uploads, persisted personal data, schema redesign or new UI is authorized.

## Tracking and reference

Bead cqg1, related optional iomn. Source owner assembly only. Private capture remains local/uncommitted; source docs contain aggregates only. Goal goal-8af7e61b-6d00-4d80-a823-f16c34f427a4, cap Maximum safe integer. Direct coder e12a0754-e9ca-4f40-a38f-ce895b42568d verified running, owns index.js + focused source lifecycle unit tests only; parent owns capacity/native scripts, docs/version/build/publication.

Capacity result106: actual measured playing-prefix profiles with explicitly synthetic repeated/rebased continuation270s,142.34 advances/s,4028 measured frames ->38432 ticks,46005984 estimated bytes of50331648, complete. This is storage evidence, not recovered human movement or scoring acceptance. Script validate-full-song-recording-capacity.js reads a local file named by environment; raw samples remain uncommitted. Exact initial-ready snapshot and lazy start are implemented by coder; focused29 and npmcheck passed before final simplification rerun. Parent native capture check now publishes256 genuine pre-calibration input samples and asserts no recorder allocation, then retains the existing complete real Download/Load Recording checks. No mockup/UI addition applies. README documentation must explain the changed recording boundary, retained limits and that an already-truncated file cannot be repaired.
