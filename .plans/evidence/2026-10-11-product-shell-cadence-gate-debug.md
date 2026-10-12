# Product-shell headless browser cadence gate after restoring 4858 ZIP

## Exact observed failure
The *remainder* of the normal assembly browser chain passed mobile menu, music preview, standard batch library, stale IndexedDB and obstacle privacy, then `scripts/validate-product-shell-matrix.js:227` threw: `direct:390x844@1 gameplay renderer must follow sustained display cadence`. Its captured `cadenceBefore.displayFrameCount=111`, after `165` (54 rendered frames during a requested 2,100 ms wait); `displayRateFps=23.7`, `renderCount=54`, while test requires at least 60 frames and at least 30 reported FPS at DPR1. The same evidence says 54 distinct audio timeline positions, 54 nonempty equipment calls, 30 produced poses at 11.68 FPS, correct `playing` Flow session and advancing audio. These are *browser software-rendering fixture observations*, not physical mobile FPS measurements. Full log `/tmp/aerobeat-assembly-browser-remainder-after-4858.log:1-17`.

## Expected behavior
A sustained native Flow Play session should draw the game/equipment on normal display cadence rather than waiting for the ~15fps synthetic pose producer. The unchanged browser oracle explicitly asks for >=60 display frames in 2.1s, display rate >=30 FPS, and successful advancing audio/equipment/feedback in a 390×844 DPR1 direct page.

## Execution path
The matrix script opens its own browser and mocked camera producer, enters normal Play via calibrated countdown, establishes `continuousPose=true`, clears test capture arrays, reads `element.cadenceSnapshot()`, waits 2,100 ms, then reads native cadence plus renderer wrapper calls and tests the configured minimum at line 227. All earlier scorer/browser gates that were previously blocked by missing 4858 ZIP had advanced normally. This failure is inside the headless app page's sustained Play draw cadence, not during fixture loading or Flow centerline corpse creation; scored note hits/aftereffects are not the measured interval.

## Most likely root cause (hypothesis; unconfirmed)
The Playwright SwiftShader/headless browser is rendering the full high-resolution Aero environment/equipment below the test's 30fps software-rendering budget under current host load/thermal state. The log shows repeated game+equipment renders and continuously distinct audio positions rather than a gameplay state stall; `displayRateFps=23.7` and 54 renders indicate *partial* draw throughput. Host snapshot after failure had load average 5.22 over several minutes on a shared desktop, but no simultaneous browser job was evident. Need a targeted baseline/controlled measurement before calling this environmental rather than a product regression.

## Alternative hypotheses, ranked
1. Normal browser GPU/CPU contention or thermal budget: plausible; SwiftShader high software-GPU load was observed in earlier assembly browser stages and the single 2.1s sample just missed minimum by 6 frames. Check repeat isolated sample with current load and GPU/browser process profile.
2. New renderer halo or centerline regression: low likelihood for this idle pre-hit interval because halo now casts *fewer* shadows and centerline masks apply only to aftermath notes, but not ruled out until the same source test under controlled conditions or an isolated old-renderer comparison.
3. Fixture pose-clock mismatch: low likelihood; unlike prior Boxing failure, this sample produced 30 poses and consumed 27, rendered every audio timeline, and no stale-pose/production error was reported. Inspect `lastError` and timestamps in full failure object if needed.
4. Product display scheduling tied to pose cadence: evidence contradicts a hard 15fps lock (54 renders vs 30 produced poses), but 23.7 could reflect partial starvation. Inspect `src/index.js` RAF setup if isolated repeat also fails.

## Why previous fixes did not resolve it
Photosphere/Vite/nose freshness/Boxing synthetic clock/saber halo changes addressed unrelated tests earlier in the gate. Restoring the missing real 4858 ZIP allowed this later normal shell test to run for the first time in this campaign. No fix has been attempted for shell cadence yet.

## Unknowns
Whether the failure repeats when this named script runs alone after the host settles, whether a known clean baseline source has the same cadence on this exact machine, and whether real GPU hardware or SwiftShader is active. Resolve by one targeted *unchanged* run with captured host process load and JSON cadence, not by relaxing thresholds or retrying until lucky.

## Minimal reproduction
Run `node scripts/validate-product-shell-matrix.js` in the current assembly source on the 390×844 DPR1 direct case; expected failure after the countdown when the 2.1s sustained Play sample collects fewer than 60 frames and `displayRateFps<30`. This has been observed once in the remainder chain, not yet independently reproduced.

## Proposed verification
Run the unchanged focused script once in isolation with no other browser jobs. If it remains RED, inspect the timing profile and renderer source at RAF boundary, then compare against the latest pre-centerline renderer in a disposable assembly fixture without altering the canonical build or removing the test. If it passes only at quiet host load, document resource sensitivity and still run one complete normal browser gate before claiming GREEN; never weaken the production cadence requirement solely to get a pass.

## Recommended fix (conditional)
No code change yet. Diagnose whether a repeatable production draw regression exists; if yes, optimize the actual draw/scheduler path with a same-script RED/GREEN and preserved visual frames. If only fixture timing noise under SwiftShader is shown, keep the threshold and record environment conditions; ask Derrick for a decision only if the full gate repeatedly cannot execute on this machine.

## Debugging record
Problem: headless product-shell sustained native Play 30fps gate misses in current host run.
Observed symptom: 54 draws in 2.1s, reported 23.7 FPS versus >=60/30 thresholds.
Root cause: unconfirmed; software renderer/host budget leading hypothesis, production cadence regression still possible.
Evidence: advancing audio, 54 distinct rendering timestamps, 30 produced poses, 54 equipment calls, no hit/aftermath in interval.
Failed approaches: no fix attempted; prior unrelated corrections exposed this later gate.
Corrective action: isolated unchanged repeat and controlled profiling before production or test edit.
Verification test: focused `node scripts/validate-product-shell-matrix.js`, then full normal browser suite.
Related files/components: assembly `scripts/validate-product-shell-matrix.js:217-232`, `src/index.js` RAF/render cadence, PlayCanvas SwiftShader.
Remaining uncertainty: baseline older renderer throughput and whether the full product-shell matrix can pass reliably on this host's software GPU.

## Focused unchanged reproduction
`node scripts/validate-product-shell-matrix.js` in isolation (log `/tmp/aerobeat-product-shell-cadence-focused.log`) **passed** the original 390×844 DPR1 sustained-cadence state and three following cross-mode camera-control states. It then failed a **different** 390×844 DPR3 later-clock freshness condition: gameplay 4,455.5 ms, transport 4,456 ms, audio 4,602.5 ms; an audio-to-last-gameplay-frame gap of 147 ms exceeds the unchanged 100-ms Play cadence rule. The two states both indicate intermittent draw starvation under SwiftShader; neither is linked to an actual corpse hit or mobile FPS. During the isolated run Chromium's headless SwiftShader GPU process used ~807% CPU across cores. This evidence strengthens the headless software-GPU budget hypothesis but does not prove no product performance regression. Do not relax the strict thresholds or call the complete normal gate GREEN.
