# Diagnosis: Mid-Song Tracking-Loss (Bead `aerobeat-web-assembly-tm4m`)

Date: 2026-09-11 · Source: read-only static diagnosis subagent (all paths relative to `/home/derrick/.dsh/projects/aerobeat/`).
Symptom (Derrick true playtest): tracking continually lost mid-song, T-pose re-entry sometimes multiple times per song (Barra-Desktop, Logitech webcam, good lighting with shadows).

## 1. The tracking-lost detection + recovery flow

**Where "lost" is decided: the body-grid input service, not the CV layer.** CV (MediaPipe) never says "tracking lost" — it emits pose frames; no pose → a frame with fewer than 7 landmarks (`aerobeat-web-vendor-mediapipe/src/mediapipe-worker.js:126-147`; `production-cv-service.js:112` still counts it as a fresh frame with empty `landmarks`).

The decision happens in `aerobeat-web-input/src/body-grid-service.js`:
- **Per-frame anchor check** — `:323`: all **7** anchors (nose, both shoulders, both elbows, both wrists) must individually clear `requiredConfidence = 0.5` (`aerobeat-web-contracts/src/body-grid-contracts.js:154`). One missing/low-confidence wrist → `allRequiredAnchorsVisible = false`. A pure AND over 7 landmarks — the single most fragile point.
- **Loss window** — `:327-334`: once false, `lossStartedAt` latches and `lossDurationMs` accumulates each arriving measured frame; at `lossDurationMs >= trackingLossPauseMs` (**500 ms**, `body-grid-contracts.js:157`) it calls `triggerTrackingPause()` (`:268-273`) → `trackingPaused=true`, `freshCalibrationRequired=true`.
- **Gap-based loss** — two more 500 ms triggers: `:302-306` (next measured sample ≥500 ms after previous) and `advanceTime()` `:705-720` (assembly ticks every display frame with no fresh pose, `aerobeat-web-assembly/src/index.js:1129`, gated to ~15 Hz).

Effective rule: **"any one of the 7 landmarks below 0.5 visibility, sustained 500 ms of measured time, OR no measurable sample for 500 ms → hard pause."** No grace beyond 500 ms, no decay, no N-of-M smoothing, no auto-resume.

**Recovery requires a full T-pose hold, always.** `freshCalibrationRequired` is sticky until a new calibration completes. `updateCalibration()` (`:348-411`) accepts only `qualified = allRequiredAnchorsVisible && qualifiesTPose(landmarks)` (`:349`); `qualifiesTPose` (`:893-916`) demands all 6 limb landmarks, wrists/elbows within `0.35 × shoulderWidth` of the shoulder line, elbow angles ≥ 130°. The hold must persist continuously for **`holdDurationMs = 4000` ms** (any non-T frame resets the hold), then **`cooldownDurationMs = 4000` ms** before gameplay re-counts down. **NO partial re-acquisition exists anywhere** (searched input+gameplay tree). `session-coordinator.js:550-571`: while playing, `!safetyReady || freshCalibrationRequired` → `paused_tracking`; leaving requires a completed fresh T-pose calibration; `resume()` rejects unless `!freshCalibrationRequired` (`:288-293`).

**UX between lost and recovered:** `AeroTrackingPause` presenter (`aerobeat-web-ui/src/elements/aero-product-presenters.js:459-488`) — full-screen alertdialog, focus-trapped Recalibrate button, hard modal. While waiting: `readiness=paused_tracking`, `calibrationState=tracking_lost`, geometry dimmed. After T-pose: `state=cooldown` → 3-2-1 at **1000 ms/step** (`session-coordinator.js:555,594-602,1045`) with audio frozen.

**Total worst-case re-entry cost per event: ≥ ~8.3 s** (4 s hold + 4 s cooldown + ~3 s countdown) plus notice/strike time — repeated multiple times per song.

## 2. MediaPipe configuration (pinned)

Wiring: `aerobeat-web-assembly/src/service-graph.js:16-25` (locked production pose adapter, worker, cpuWasm) → `createLockedProductionCvService({submissionCadenceTargetFps: 15})` (`:41`; ceiling enforced `production-cv-service.js:13-14`). Declared profile: `production-cv-profile.js:4-19` (immutable).

| Setting | Value | Source |
|---|---|---|
| Model | Pose Landmarker **Lite** float16 `/1/` (5.78 MB, sha256 pinned) | `production-cv-profile.js:7` |
| Runtime | `@mediapipe/tasks-vision@1.0.1` (worker classic bundle via CDN) | `:9` |
| Delegate | **cpu-wasm** (CPU delegate in dedicated worker) | `service-graph.js:20` |
| minPoseDetectionConfidence | **0.5** | `production-cv-profile.js:11` |
| minPosePresenceConfidence | **0.5** | `:12` |
| minTrackingConfidence | **0.5** | `:13` |
| numPoses / runningMode | 1 / VIDEO (sync `detectForVideo`) | worker `:30-31` |
| Segmentation masks | off | worker `:32` |
| Input size | **whatever the camera negotiates, unresized** (`resizePath:"none"`) | `:15-16`; worker infers on native `videoWidth×videoHeight` |
| Camera constraints | `{audio:false, video:{facingMode:"user"}}` — **no width/height/fps requested** | `aerobeat-web-video/src/source-descriptors.js:94-97` |
| CV cadence | 15 fps via `setInterval(ceil(1000/15))`, one-in-flight, else drop | `production-cv-service.js:49,92-100` |

Note: "640×480@30" is NOT configured — it's observed device negotiation only. The app never requests resolution/frame rate.

**Which settings make it fragile (mapped to Derrick's conditions):**
- **Fast limb motion / mid-song swings (dominant):** Lite at ≤15 fps on unresized native frames; fast sweeps move many cm between CV samples; 30 fps auto-exposure shutter (~33 ms) motion-blurs exactly the fastest frames → wrist visibility dips below 0.5. One of seven failing for 500 ms kills the session.
- **Partial occlusion** (arms crossing torso, guard): visibility drops on self-occluded wrists; one of seven gates the AND.
- **Lighting shifts / shadows:** Lite is the least robust of the three official task sizes; shadows depress multiple landmark visibilities at once → instant 500 ms trip. No lighting normalization anywhere in the pipeline.
- **Sustained absence of full-body view** (ducking/swinging low): no "partial body is fine, keep playing" state.
- **minTrackingConfidence 0.5 (hold):** middling — too strict to hold through blur/shadow blips (tracker gives up → full re-acquire at the same 0.5), not loose enough to be safe. Detection and tracking share one value with no split.
- **cpu-wasm at full resolution:** inference latency (ABCCBA `poseAgeP95` ≈ 85–105 ms) — the system chases itself during fast moves.

## 3. Processing cadence and stale-pose windows

Three clocks, no interpolation: camera 30 fps (device-default) / CV ≤15 fps / render+advance 60 fps (`runtime-cadence.js:39-61`, `index.js:1109-1130`).
- Pose age: ~66 ms inference interval + measured worker round-trip ⇒ scored frames typically **~70–170 ms old**; gaps double when an estimate takes >66 ms (the 15 fps timer skips — `droppedFrameCount += 1`).
- **Can "lost" fire on a single dropped frame? No — but close.** The 500 ms window needs ≥3 consecutive failed samples at 15 fps, BUT each sample independently fails the 7-way AND (even though MediaPipe's internal tracker is still alive and would recover next frame) — so **five scattered bad frames within a second trip the pause** without ever being a continuous absence. The design amplifies isolated blips into pauses much faster than true absence needs.
- **Freshness gates compound it:** scoring evidence usable only if `age ≤ checkpointFreshnessMs = 150` (`gameplay-contracts.js:395`, enforced `session-coordinator.js:862-863,886-887`); when an estimate slips past ~66 ms, the next score attempt sees age >150 ms and **misses a hit even with perfect pose** (`getFreshEvidence` null, `body-grid-service.js:733-739`). `straightContinuityGapMs = 150` (`:397`, used `body-grid-service.js:1035`) means a 2-tick hitch breaks semantic continuity of a held punch. These are the "I was hitting but got misses right before the pause" sensation.

## 4. Fragility ranking vs Derrick's conditions
1. **AND-over-7 @ 0.5 with no temporal smoothing** (`body-grid-service.js:323`) — highest-frequency trigger.
2. **500 ms is short relative to natural motion cycles** — a crouch+swipe spans 0.5–1.5 s; the window trips mid-combo.
3. **Hard pause ⇒ mandatory 4 s T-pose + 4 s cooldown + 3 s countdown** — makes each miss expensive; no partial recovery exists.
4. **Lite @ 15 fps CPU-WASM on native-res frames** — weakest robustness tier at the lowest practical rate.
5. **No camera-side control** — unconstrained capture: no short-exposure hint, no exposure floor, no fixed 640×480.
6. **Stale-pose + 150 ms freshness gates** — misses immediately preceding pauses, reinforcing the "it stopped working" experience.

## 5. Recommendations (ranked)

| # | Item | Effort | Impact | Risk | Tier |
|---|---|---|---|---|---|
| **A** | **Temporal hysteresis on the loss decision**: require M consecutive failed samples (e.g. 3-of-4 / ≥700 ms) to declare pause; a passing sample resets the accumulator (reset path already exists at `:325-326`). Optionally raise `trackingLossPauseMs` 500→750-1000. | S (one constant + small counter) | **High** — cuts false-loss frequency dramatically | Low | **Next successor** |
| **B** | **Partial-landmark auto-recovery**: a "recovery pose" (e.g. 4 key landmarks — nose + 2 shoulders + 1 wrist — stable ≥300 ms at ≥0.5) clears `freshCalibrationRequired` *without* re-calibrating bounds; return via 2-step/direct resume; full T-pose only for source-change/invalidation. Relaxes `updateCalibration`'s qualified gate for the recovery case + a coordinator path from `paused_tracking` without a new calibrationId. | M (new contract flag + coordinator branch + presenter copy) | **Very High** — removes the 8+ s wall; preserves calibration geometry | Medium (weaker pose could mask a broken camera — mitigate: still require the full 7-anchor AND for continued *scoring*, `mapMeasuredAnchors` already gates it `:419`) | **Follow-on slice** (highest perceived value) |
| **C** | **Split confidence thresholds & relax tracking hold**: `minTrackingConfidence` 0.5→**0.3**, `minPoseDetectionConfidence` 0.5→**0.4**, presence 0.5 kept. One-line per site in `service-graph.js:21-23` (declared in `production-cv-profile.js`). | XS | Medium-High — fewer tracker drops; biggest win on shadows/lighting | Low-Medium (slightly worse positions while degraded; bounded by the 0.5 input-layer gate) | **Next successor** (trivial, do with A) |
| **D** | **Recovery UX softening**: T-hold 4 s→2 s, cooldown 4 s→2 s (`body-grid-contracts.js:155-156`); pause overlay says *what* is missing (which wrist/shoulder dipped — data already in the snapshot's `anchors[]`). With B in place, T-pose becomes the rare fallback. | S | Medium — halves re-entry cost | Low | Next successor (fold into B/A) |
| **E** | **Camera-side constraints**: request `width 640, height 480, frameRate {ideal:30}` explicitly (pins the documented profile, removes device variance) + document lighting/exposure guidance. Optional future: `advanced` constraints (exposureTime/ISO) where supported. | S (constraints object + docs line) | Medium — predictable latency, less blur on average devices | Low (some webcams negotiate oddly; keep `facingMode:user`, treat as ideal) | Next successor or defer (test per-device) |
| **F** | **Dual-model architecture**: cheap high-rate tracker (MoveNet lite @30 fps or BlazePose tiny) for hold/continuity + Lite-float16 @15 fps for calibration-grade accuracy; blend/switch on confidence. Scaffolding exists (MoveNet vendored; cv package performance presets incl. resize lanes). | L | High ceiling — decouples "is a person there" from "where exactly are the wrists" | High — two runtimes in workers, dual calibration identity, large regression surface; contradicts the locked-single-route philosophy in `production-cv-profile.js` | **Direction-level — research Bead, don't schedule** |
| **(G)** | Model upgrade Lite→Full at 640×480 CPU-WASM: likely can't meet 15 fps on desktop WASM at native res; only viable with GPU-WebGL delegate (device-dependent per vendor doc). | L | ? | High | Defer; subsumed by F |

**Next successor (one slice, ~one Bead chain):** **A + C + D** — hysteresis/longer window, tracking-threshold split, shorter T-pose/cooldown + informative overlay. Contained in `web-input` + `web-gameplay` + `web-contracts` constants + UI copy; verifiable deterministically (body-grid service is fully deterministic given timestamped samples — fixture "5 scattered bad frames within 1 s" and assert no pause).
**Follow-on slice:** **B** — partial-landmark auto-recovery (highest perceived value).
**Deferred / direction-level:** **F** dual-model (research Bead), **E** camera constraints (piggyback on any camera-touching bead), G model upgrade (only via F/GPU).

## Key file:line map
- Loss decision: `aerobeat-web-input/src/body-grid-service.js:323` (7-way AND), `:327-334` (500 ms clock), `:302-306` & `:705-720` (gap variants), `:268-273` (pause trigger), `:252-265` (invalidate + `freshCalibrationRequired`)
- Recovery gate: `body-grid-service.js:348-411` (T-hold logic), `:893-916` (`qualifiesTPose`), `:940-969` (geometry from averaged T)
- Constants: `aerobeat-web-contracts/src/body-grid-contracts.js:153-160` (confidence 0.5, hold 4000, cooldown 4000, loss 500, ratio 0.35, angle 130); `gameplay-contracts.js:392-399` (freshness 150, straight qual 100, gap 150)
- Coordinator: `aerobeat-web-gameplay/src/session-coordinator.js:550-571` (enforceSafety/enterTrackingPause), `:594-626` (3-2-1 @1000 ms, `:1045` default), `:288-295` (resume reject)
- HUD: `aerobeat-web-ui/src/elements/aero-product-presenters.js:459-499` (pause overlay + countdown)
- Config: `aerobeat-web-assembly/src/production-cv-profile.js:4-19`, `src/service-graph.js:16-25,41`, `src/production-cv-service.js:13-14,49,92-116,123-134,148`
- Vendor: `aerobeat-web-vendor-mediapipe/src/mediapipe-worker.js:20-77,110-147`, `mediapipe-adapter.js:13-22,106-108`, `mediapipe-worker-adapter.js:17,92-94,138`, `docs/decisions/0001-mediapipe-runtime-and-model.md`
- Cadence bridge: `aerobeat-web-assembly/src/index.js:1109-1149` (60 fps loop, fresh-pose dedup, advanceTime throttle), `src/runtime-cadence.js:39-61`
- Camera: `aerobeat-web-video/src/source-descriptors.js:94-111` (unconstrained getUserMedia)

## 6. Owner decision (Derrick, 2026-09-11) — scope change to the loss decision

> "We can introduce smoothing, that should help blips in tracking loss. We only really care if the head and wrists lose tracking."

Consequences for the implementation lane (refines rec A; C/D/B stand as written):
- **Loss decision set narrows to 3 anchors:** nose (head), left wrist, right wrist. The current 7-anchor AND (`body-grid-service.js:323`) is the single most fragile point (§4.1); shoulders and elbows stop triggering tracking-loss. They remain calibration/geometry inputs as today — only the *loss gate* changes.
- **Temporal smoothing/hysteresis on that 3-anchor decision** (rec A: M-of-N consecutive-samples + longer sustained window, passing sample resets the accumulator) — the explicit mechanism Derrick asked for ("smoothing … should help blips").
- **Scoring gate:** whether the 7-way AND used for scoring evidence (`mapMeasuredAnchors`, `:419`) also narrows, or only the loss gate, is a coder-lane detail to settle with oracles — the product decision above is about *when tracking is declared lost*, not about per-hit evidence requirements.
- The T-pose re-entry cost chain (4 s hold + 4 s cooldown + 3 s countdown) and its reduction (rec D) remain as scoped; rec B (partial-landmark auto-recovery without recalibration) remains the follow-on slice with the highest perceived value.
