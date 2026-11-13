# Pose latency and update rate in one real AeroBeat run

Source: `aerobeat-ab-0.0.155-…-Expert.json`, a play capture from build 0.0.155 (`FRIEND-GAME-CPU`, MediaPipe on CPU/WASM in a worker). The song is *Undefeatable*, Expert Flow. All numbers come from `extract.mjs`, and the raw output is in `latency.json`.

## Results (whole playing section, 2,661 poses)

| What | Median | p90 | Notes |
|---|---|---|---|
| **Pose latency**: inference start to first rendered frame that uses the pose | **42.7 ms** | **44.3 ms** | min 35.5, p99 49.5, max 61.3 |
| **Pose update rate** | **14.7 Hz** (68.0 ms gap) | gap p90 70.3 ms | p10 gap 62.6 ms, max 84.7 ms, no gaps over 100 ms |
| Display frame rate | 144.9 Hz (6.9 ms) | 7.1 ms | so about 10 rendered frames show each pose |
| **Age of the pose on screen** at any rendered frame (latency plus hold) | 71.7 ms | 99.0 ms | mean 72.1 ms |

The 45 s excerpt in `frames.json` (song 1:16 to 2:01) has the same numbers: 42.8 ms median and 44.3 ms p90 latency, with a 66.7 ms median gap.

All 2,661 playing poses had `provenance: "measured"`. None were frozen or predicted, and the anchors never went invalid. The latency is steady across the run: each 30 s slice has a median between 42.2 and 42.9 ms.

## Method

I read the recorder and the frame loop that produced the file before relying on any field: `src/play-movement-recording.js`, `src/index.js` `runDisplayFrame()` and `src/production-cv-service.js`. I also checked the minified r155 bundle in `.tmp/cpu-r155-verified-*` for the same source wiring.

- `movement.ticks` has one row per display frame (`requestAnimationFrame`). `tick.timestampMs` is `max(performance.now() at the start of the frame, the evidence measurement time, …)`. For every playing tick it was later than the measurement time, so the `max()` never changed it.
- `tick.inputIndex` points to the body-grid snapshot in `movement.inputs` that gameplay used on that frame. A snapshot changes only when a new pose arrives. On every tick where `inputIndex` changed, `equipmentIndex` changed too (2,660 of 2,660), so the rendered equipment steps at exactly this rate.
- `input.anchors[].measurementTimestampMs` is the same for every anchor in a snapshot. It also equals `input.timestampMs` and the matching `rawPoses[].timestampMs`, offset by exactly 6 indexes all the way through. In this build the value is `performance.now()` read when the 15 fps `setInterval` hands the current `<video>` frame to MediaPipe (`createLockedVideoFrameSource`: `getTimestampMs: () => performance.now()`). It is on the same clock as the ticks.
- **Latency** = `tickTs(first tick whose inputIndex is k) − anchors(k).measurementTimestampMs`, for each calibrated snapshot `k` during the `playing` state.
- **Rate** = the median gap between successive measurement timestamps. It is cross-checked against the pose count over the duration (14.9 Hz).
- **Age on screen** = for every playing tick, `tickTs − measurementTimestampMs` of the pose it displays.

## Limits: what this does NOT measure

1. **Camera-to-browser time is missing, and that is the big one.** The timestamp is taken when inference *starts*, not when the camera captured the frame. Sensor exposure, USB transfer, decode and delivery to the `<video>` element come before that and are invisible here. On a typical webcam this is often around 30–100 ms. The `setInterval` poll also takes whatever video frame is current, which can already be up to one camera frame old (about 33 ms at 30 fps). Treat **42.7 ms as a lower bound on motion-to-render latency**. Real motion-to-photon latency is probably well over 100 ms median once you add the hold time below.
2. **Frame start is not photons.** `tick.timestampMs` is the time the rAF callback started. GPU work, compositing and display scan-out add roughly 1–3 frames (7–20 ms at 144 Hz), which is not measured.
3. **Holding adds more delay.** Because the game draws the newest pose step-wise, the pose on screen is on average 72 ms old (p90 99 ms) even before the missing camera time.
4. **This is one run on one machine.** It used a CPU/WASM worker build at a 15 fps cadence cap with a 144 Hz display. A GPU delegate, a slower laptop or another camera will give different numbers.
5. **The recording is truncated.** The file hit its 50 MB cap (`status: truncated`, `reason: recording_limit`). Movement covers song time 0 to 2:58.3. 259 of the 830 judgements fall after that and have no pose data. The excerpt was chosen inside the covered part.
6. **Song-time mapping is approximate.** Song time for a pose comes from `renderTimelineMs` on the frame where it first appeared, minus its latency. The renderer clock runs about 0–11 ms behind the audio clock, so beat-relative timing in the replay is good only to about ±10 ms.
