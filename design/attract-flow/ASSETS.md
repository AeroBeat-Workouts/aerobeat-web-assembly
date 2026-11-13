# Assets

| File | Source | Licence |
|---|---|---|
| `fonts/AtkinsonHyperlegibleNext-var-latin.woff2` | Google Fonts, Atkinson Hyperlegible Next (Braille Institute), latin subset, variable weight (`fonts.gstatic.com/s/atkinsonhyperlegiblenext/v7/…`) | SIL Open Font License 1.1 |
| `vendor/mediapipe/vision_bundle.mjs.txt` | `@mediapipe/tasks-vision@1.0.1` `vision_bundle.mjs`, copied from `aerobeat-web-vendor-mediapipe/node_modules` (byte-identical, renamed so Vite serves it untouched) | Apache-2.0 |
| `vendor/mediapipe/vision_wasm_internal.js.txt` | same package, `wasm/vision_wasm_internal.js` (byte-identical, renamed) | Apache-2.0 |
| `vendor/mediapipe/vision_wasm_internal.wasm` | same package, `wasm/vision_wasm_internal.wasm` (SIMD build) | Apache-2.0 |
| `vendor/mediapipe/tasks-vision-package.json` | the package's `package.json`, kept for provenance | Apache-2.0 |
| `vendor/mediapipe/pose_landmarker_lite.task` | Official Pose Landmarker Lite float16 v1, SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`, 5,777,746 bytes (matches `aerobeat-web-vendor-mediapipe/docs/decisions/0001`). Copied from an existing local AeroBeat build output. | Google MediaPipe model; the vendor decision says to review the model card/terms before redistribution. Fine for a local design prototype; do not publish this folder as-is. |

Not stored here: the person video used as a fake camera. `verify/make-fixtures.sh` builds it in `/tmp` from `aerobeat-input-camera-tracking/.testbed/assets/fixtures/…/flow_swing_lr6->lr12_repeat_04_take_01.mp4` (an AeroBeat test recording).

PlayCanvas and the two-wrist rule are used from `../style-comps/_shared/` without copying or changing them.
