# Saber halo shadow-pass warning in normal assembly browser gate

## Exact observed failure
After fixing the scored Boxing **test fixture** clock and passing its original 35-case browser matrix, the complete assembly browser chain passed scored Play tests, real GLB footprints, vignette, spawn, short-song and clock checks. It stopped in `scripts/validate-portrait-playfield-browser.js:151`: `portrait unexpected browser noise: warning:Shader [Shader Id 6 (GLSL) ShaderMaterial-aero-saber-halo-left_wrist-ShadowPass_0_0-proc] reads matrix_normal in the shadow pass, where it is the identity. Use getNormalMatrix() of normalCoreVS, which derives it from the model matrix in the shadow pass.` This is a console warning, not a scored judgement failure or a measured Flow corpse regression.

## Expected behavior
The portrait browser oracle intentionally renders Flow saber and Boxing glove **equipment shadows** on the floor (`validate-portrait-playfield-browser.js:129-151`). Real equipment GLBs should cast shadows and the additive visual halo should not generate an erroneous shadow-pass shader warning. Strict unexpected-console rejection must remain active; do not broadly whitelist graphics warnings.

## Execution path
The oracle calls renderer `renderGameplayFrameWithCursorsAndEquipment(...flow...)`; renderer `acquireSaberGlow()` creates a detached cylinder with a `pc.ShaderMaterial` named `aero-saber-halo-left_wrist`. Its vertex shader multiplies `matrix_normal*a_normal` for view-facing additive color (`aerobeat-web-renderer/src/renderer-facade.js:287-305`). PlayCanvas prepares a shadow-pass variant for the halo and warns that `matrix_normal` is identity in that pass. The game code's actual shadow geometry also includes the GLB saber; the warning is tied to the decorative halo's shadow-pass variant, not the fixed-cut corpse mask.

## Most likely root cause
The decorative additive halo participates in shadow casting when its shader is written for forward-lit color. PlayCanvas compiles its unnecessary shadow variant and detects use of an invalid normal matrix there. Setting the halo's mesh instances to **not cast shadows** should prevent creation of the halo shadow-pass shader without changing the GLB saber's own shadow. Need verify property is honored in both renderer tests and the real portrait oracle.

## Alternative hypotheses
- A new Flow corpse shader uses `matrix_normal`: ruled out by the exact warning name `aero-saber-halo-left_wrist`, and the fixed masks only read vertex local X.
- The halo needs its normal for *forward* appearance: true; replacing or removing normal use globally could alter the halo. Restrict the change to shadow participation rather than changing front-pass shading.
- A benign PlayCanvas warning should be whitelisted: it may be cosmetically harmless, but would hide an unnecessary shadow variant and retain an invalid shader binding. A narrow source fix with unchanged strict console gate is preferable if tests confirm no lost real saber shadow.

## Why earlier changes did not help
Previous corrections addressed photosphere diagnostic triangle counts, absent Vite fixture, nose-parallax test observer time, and synthetic Boxing pose-clock lag. None touched the halo render entity. Normal browser tests advanced farther and exposed this independent warning.

## Unknowns and minimal reproduction
The portrait browser script's targeted command `node scripts/validate-portrait-playfield-browser.js` should reproduce the strict warning in the portrait case. It may be nondeterministic under GPU shadow variant reuse. Confirm the halo mesh `castShadow` flag before/after the smallest change; check full GLB saber shadow pixel deltas remain above the original thresholds. Exact driver GPU compilation cost is unknown and unrelated.

## Proposed verification
Run the unchanged portrait browser test before the fix for an exact warning RED; make one source-only halo `meshInstance.castShadow=false` change; rerun the same test to show warning absent **and** native saber/glove GLB shadow deltas still pass. Also run renderer unit/browser gates and scored Flow centerline pixels. Then pin any new renderer commit/tree in all four assembly authority files plus new phone config/manifest script before build.

## Recommended fix
Disable shadow casting only on each decorative halo cylinder mesh instance immediately when its custom additive material is installed. Keep the real equipment GLB and floor receiver untouched. Do not suppress warnings in shared console policy or modify the centerline corpse shader. If the test shows halo is not actually casting and warning remains, investigate PlayCanvas ShaderMaterial shadow compilation before any production edit.

## Debugging record
Problem: Full assembly browser gate stops at unexpected saber halo ShadowPass normal-matrix warning.
Observed symptom: strict portrait browser console oracle fails before later Flow scored tests.
Root cause: likely additive saber halo enters shadow pass with front-pass normal shader.
Evidence: exact shader name `aero-saber-halo-left_wrist-ShadowPass`; renderer ShaderMaterial uses `matrix_normal`; portrait oracle intentionally renders equipment shadows.
Failed approaches: unrelated test fixture corrections passed their states, but never touched halo source.
Corrective action: verify then prevent decorative halo mesh shadow casting while keeping GLB saber shadow.
Verification test: unchanged strict portrait oracle warning RED then GREEN, retained GLB shadow-pixel deltas, renderer unit/browser and scored Flow pixels.
Related files/components: renderer `src/renderer-facade.js:287-305`, assembly `scripts/validate-portrait-playfield-browser.js:129-151`.
Remaining uncertainty: GPU driver compilation timing was not measured and is not inferred from this console fix.

## Verification result
The **unchanged** focused `node scripts/validate-portrait-playfield-browser.js` was RED before the one-line renderer change with the exact `ShaderMaterial-aero-saber-halo-left_wrist-ShadowPass` warning. Renderer revision `9f72a3ea2b890a29c3cb3c42176b97bcd101c282` makes only the decorative halo mesh non-shadow-casting. Full renderer `npm test` and `npm run test:browser` passed. After updating all assembly pins to the pushed renderer, that same strict portrait browser command passed with **no warning whitelist**; actual GLB Flow saber shadow darkened 10,384 pixels and Boxing glove shadow 9,759. The complete assembly browser gate continues separately; do not conflate this focused GREEN with its final result.
