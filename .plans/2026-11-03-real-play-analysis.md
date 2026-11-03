# Real-play comparison and reproduced directional-hit regression

Status: targeted fix and cost mitigation pass source and actual locally signed Play checks; deployment/physical acceptance pending. Owner: Pico.
Gameplay fix Bead: `aerobeat-web-assembly-nrrv` (owning source is sibling gameplay repo, which has no Beads database).
Recording/replay feature: `aerobeat-web-assembly-1fnl`.
Parent execution record: `2026-11-01-ab-judgement-download-button.md`.

## Exact observed failure

Derrick reports the authentic pre-spline rebuild feels nearly flawless, while current play misses obvious contacts. The fresh completed Play exports show:

| Build | Hits | Misses | Hit rate |
|---|---:|---:|---:|
| Authentic .149, stamp bb26fd6c889f95b0c482ebaf | 828 | 2 | 99.76% |
| Fresh .153, stamp f2d26b97608cf1dcbee4e712 | 573 | 257 | 69.04% |

All 830 event IDs and beat timestamps match. Both identify BeatSaver 349F2, source hash 3571ed07e3424be6f723ea96c10a8e15df688706, Expert, and the same Flow chart. The exact source ZIP was fetched from its published BeatSaver URL, verified by the vendor map-hash function, and converted with the production authoring code. All reconstructed note IDs and timestamps match the exports.

Flow settings match: scale 1, depth forward 1, depth backward 0, timing window 180 ms, direction enforcement on, tolerance 45 degrees, render scale 1 and note scale 100%. The current build adds an athlete-facing flag, but depth backward is zero. Recorded differences in punch switching, guard replacement/height and Boxing volume belong to Boxing. Do not silently call the entire settings objects equal.

Of the old run's hits, 256 become misses in the new run; one old miss becomes a hit, and one remains a miss. Loss occurs throughout the song, not just at startup or one late section. The two independent .153 runs have 160 missed note IDs in common.

## Pattern in the authored notes

- Upward cuts: old misses 2/346; fresh new misses 176/346 (50.9%). Earlier new run misses 180/346.
- Downward cuts: old misses 0/340; fresh new misses 50/340 (14.7%). Earlier new run misses 30/340.
- Left-hand notes: old misses 0/418; fresh new misses 146/418.
- Right-hand notes: old misses 2/412; fresh new misses 111/412.
- Bottom-row placements 8–11: new misses 247/712 (34.7%). Other rows: 10/118 (8.5%). Row and cut direction correlate, so these are not independent causal tests.

All 257 fresh new misses carry `wrong_direction`, but that diagnostic is a generic fallback for any fresh-input expired directional note. It cannot prove each note failed the direction predicate. These proportions use reconstructed source geometry, not recorded collider/marker trajectories.

## Expected behavior

A wrong-way pass must not score. A subsequent contact moving in the authored direction, inside the existing volume and timing bounds with valid continuous measured evidence, must still be eligible. Rejecting one earlier pass must not permanently hide a later valid pass.

## Execution path

Current `session-coordinator.js` evaluates each Flow event using `sweptSaberContactsFlowTarget`. That sweep returns the earliest geometric contact in the retained history. The coordinator then evaluates `directionSamplesAtContact` around that time. If it fails, the loop continues to the next event, without looking for another geometric contact for this event. On subsequent updates, the same earlier contact can remain earliest until the note expires.

Pre-spline code instead tests the current measured motion after finding geometric contact. This can accept the later correct stroke. That old policy is not itself a desired universal replacement; the proper fix is to pair contact and direction at a qualifying time, not accept arbitrary current motion against old contact.

## Reproduced root cause

Executable fixture: assembly `.tmp/reproduce-direction-reversal.mjs`. It runs the real original 6f5d6a6 and current 20a1697 coordinators on identical valid measured inputs and resolved poses, with 50 ms sample gaps. It is a synthetic movement, not a recording of Derrick.

- Up-note center: 1000 ms. Same scale/depth settings; original 180 ms timing window and 45-degree direction rule.
- Earliest geometric contact: 868.75 ms while moving down; the unchanged upward-direction predicate correctly rejects it.
- Later contact: 1050 ms, inside the same original volume and timing window. The unchanged upward predicate passes at this time.
- Old coordinator: great hit committed at 1050 ms.
- Current coordinator: miss committed at 2050 ms, despite that later valid contact.

This demonstrates a scoring-logic regression independently of slow processing: the fixture advances both coordinators using identical supplied clocks/evidence. It does not prove how many of Derrick's 256 lost hits have this exact movement pattern.

## Alternative hypotheses

1. Direction/contact sequencing is now a demonstrated defect and a strong candidate for the upward-cut bias. Need real trajectories to quantify its contribution.
2. Extra scoring work is independently demonstrated in signed browser fixtures: old mean advance about 8.5 ms vs new about 43 ms. Local orientation reuse cuts a same-candidate OFF/ON workload from 45.63 to 21.68 ms without changing tested scoring. This is a partial performance fix, not evidence that all physical misses were caused by CPU cost.
3. Calibration, camera mapping and the actual equipment rotation configuration can still contribute. Neither export contains those histories/configuration. Matching the recorded Game Setup is not proof of identical physical calibration or movement.
4. A uniform clock/deadline failure is not established: fresh new misses finalize a median 5.33 ms after the existing 1000 ms late deadline, maximum 21.33 ms. These are judgement times, not measured frame or camera latency, so they do not exclude intermittent sampling stalls.

## Why previous approaches failed

- The first .149 probe used current linked dependencies and was not a pre-spline baseline. Corrected manifests now verify the authentic old source.
- Earlier geometry/direction probes used simple or monotonic movements. They did not test a wrong-way first contact followed by a valid reversal at the same note.
- A flawed earlier harness pre-overwrote measured orientations; that claim was retracted. This reproduction does not do that.
- Judgement-only exports cannot reconstruct movement or calibration, and generic `wrong_direction` labels are insufficient to establish direction rejection.

## Unknowns

The actual human pose streams, calibration transforms, camera dimensions/mirroring, confidence/visibility and equipment configuration were not recorded. Therefore the exports cannot be replayed as Derrick's movement. The recording/replay feature should capture these rather than invent fixtures from hit counts.

## Minimal reproduction and proposed verification

Move through the target downward first, then return through it upward while the up-note is still valid. Maintain unique measured frames and 50 ms continuity. Verify a later qualifying contact exists under the unchanged geometry and direction predicate. The current coordinator must fail before the fix and hit afterward.

Add reverse-only and no-contact controls that remain misses; verify near-miss precedence, exact timing endpoints, unchanged minimum travel/tolerance, exactly-once scoring and history reset boundaries. Use the existing production coordinator and a built assembly fixture, not only a detached geometry helper.

## Recommended fix

Choose the earliest sample where BOTH geometric contact and authored direction qualify. Keep the existing sample schedule, volume, windows, predicate, continuity/provenance rules and consumption rules. Do not simply disable direction enforcement or go back to checking unrelated current motion.

In parallel, keep Download Data as requested and plan numeric movement/calibration recording plus explicit Test-only replay. No camera video or audio recording/upload is needed. The replay must remain non-ranked and cannot claim live-camera provenance. New replay UI requires a scoped approved plan before implementation.

## Implemented and built verification

Gameplay 011c860 repairs contact selection. Its dense rejected-contact workload exposed extra work, addressed in 669259a by sharing exact anchor interpolation and skipping full equipment work only after direction already rules out a later sample. All incoming evidence/equipment admission and actual geometry checks for accepted hits remain unchanged.

Parent independently reran anchor parity and coordinator reversal controls. Owning full tests, independent read-only review, full assembly tests and signed Flow/Boxing 1/2 FPS OFF/ON matrix pass. Signed assembly d432abd (stamp `FRIEND-GAME-CPU-0.0.153-bacd82f632d36f6e18adf25c`) runs real calibration, raw landmark input, equipment projection, scoring and rendering:

- Original .153: reversal misses at 7050 ms. Fixed: Great at 6050 ms, accepted contact +35.4167 ms.
- Reverse-only and no-contact both remain plain misses; exactly one judgement per note.
- Twelve overlapping wrong-way notes all remain misses. On 48 active ticks, first fix mean/p95/max advance elapsed 46.07/78.40/102.50 ms; final candidate 2.73/4.20/6.30 ms. Original .153 mean was 1.10 ms in this workload. These are host-fixture elapsed times, not phone FPS or proof of every physical miss's cause.

Commands live in `scripts/validate-flow-direction-reversal-browser.js`, requiring `AEROBEAT_DIRECTION_SIGNED_DIR`; `AEROBEAT_DIRECTION_STRESS_NOTE_COUNT=12` selects the cost workload. Reports under `.tmp/direction-*-browser.json` and `.tmp/direction-stress-*.json`. Public comparison snapshots remain unchanged. Next is a deployment/recording-order decision and physical acceptance, not another speculative optimization pass.

## Debugging record

Problem: post-spline real-play hit loss.
Observed symptom: 828/830 old hits versus 573/830 fresh new hits, matching recorded Flow settings; upward cuts disproportionately affected.
Root cause: demonstrated earliest-contact masking of a later valid directional pass; contribution to all physical misses not quantified.
Evidence: source-verified chart analysis and identical-input real-coordinator reversal fixture.
Failed approaches: invalid initial baseline, monotonic-only direction probes, generic miss diagnostics.
Corrective action: search for jointly qualified contact without weakening gates; preserve local performance fix as a separate improvement.
Verification test: reversal recovers; reverse-only/no-contact controls reject; built scoring parity and resets remain valid.
Related components: gameplay session coordinator, swept Flow collision, assembly recording/export, input calibration.
Remaining uncertainty: real human movement/calibration replay is not yet available.
