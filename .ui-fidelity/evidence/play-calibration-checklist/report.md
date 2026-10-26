# Approved revision-5 checklist versus connected Play

Overall: **PASS**. This is configured source Play, never signed private/public acceptance.
Reference and real captured with one Chromium on the same host at DPR 1, fonts ready, animation frozen. Scene/camera outside the card/cue union is masked, never the card. Artifacts are written beside this report and regenerate by rerunning `node scripts/validate-play-calibration-fidelity-browser.js`.

## phone-portrait-knee-flicker: PASS

Difference: 42.2673%; regions: 88.
Artifacts: {"reference":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-knee-flicker/reference.png","real":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-knee-flicker/real.png","diff":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-knee-flicker/diff.png","side_by_side":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-knee-flicker/side-by-side.png"}

| Selector | Property | Reference | Real | Tolerance | Pass |
| --- | --- | --- | --- | --- | --- |
| cue | color | rgb(255, 255, 255) | rgb(255, 255, 255) | exact-hex | PASS |
| cue | background-color | rgb(3, 19, 31) | rgb(3, 19, 31) | exact-hex | PASS |
| cue | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| cue | border-radius | 12px | 12px | ±1px | PASS |
| cue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| cue | font-size | 31.2px | 31.2px | ±1px | PASS |
| cue | font-weight | 900 | 900 | exact | PASS |
| cue | width | 142.219px | 142.219px | ±1px | PASS |
| cue | height | 67.9531px | 67.9531px | ±1px | PASS |
| cue | padding-top | 8px | 8px | ±1px | PASS |
| cue | padding-left | 10px | 10px | ±1px | PASS |
| card | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| card | background-color | rgba(3, 19, 31, 0.933) | rgba(3, 19, 31, 0.933) | exact-hex | PASS |
| card | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| card | border-radius | 12px | 12px | ±1px | PASS |
| card | font-family | system-ui, sans-serif | system-ui, sans-serif | family; rendered fallback recorded | PASS |
| card | font-size | 16px | 16px | ±1px | PASS |
| card | font-weight | 400 | 400 | exact | PASS |
| card | width | 358.797px | 358.797px | ±1px | PASS |
| card | height | 445.547px | 445.547px | ±1px | PASS |
| card | padding-top | 12px | 12px | ±1px | PASS |
| card | padding-left | 14px | 14px | ±1px | PASS |
| title | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| title | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | border-radius | 0px | 0px | ±1px | PASS |
| title | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| title | font-size | 17px | 17px | ±1px | PASS |
| title | font-weight | 800 | 800 | exact | PASS |
| title | width | 328.797px | 328.797px | ±1px | PASS |
| title | height | 19.5469px | 19.5469px | ±1px | PASS |
| title | padding-top | 0px | 0px | ±1px | PASS |
| title | padding-left | 0px | 0px | ±1px | PASS |
| mode | color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| mode | border-top-color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | border-radius | 0px | 0px | ±1px | PASS |
| mode | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| mode | font-size | 10px | 10px | ±1px | PASS |
| mode | font-weight | 800 | 800 | exact | PASS |
| mode | width | 328.797px | 328.797px | ±1px | PASS |
| mode | height | 13px | 13px | ±1px | PASS |
| mode | padding-top | 0px | 0px | ±1px | PASS |
| mode | padding-left | 0px | 0px | ±1px | PASS |
| row | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| row | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | border-radius | 0px | 0px | ±1px | PASS |
| row | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| row | font-size | 12px | 12px | ±1px | PASS |
| row | font-weight | 650 | 650 | exact | PASS |
| row | width | 328.797px | 328.797px | ±1px | PASS |
| row | height | 24px | 24px | ±1px | PASS |
| row | padding-top | 0px | 0px | ±1px | PASS |
| row | padding-left | 0px | 0px | ±1px | PASS |
| rowName | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowName | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | border-radius | 0px | 0px | ±1px | PASS |
| rowName | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowName | font-size | 12px | 12px | ±1px | PASS |
| rowName | font-weight | 650 | 650 | exact | PASS |
| rowName | width | 270.5px | 270.5px | ±1px | PASS |
| rowName | height | 14.3906px | 14.3906px | ±1px | PASS |
| rowName | padding-top | 0px | 0px | ±1px | PASS |
| rowName | padding-left | 0px | 0px | ±1px | PASS |
| rowValue | color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowValue | border-top-color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | border-radius | 0px | 0px | ±1px | PASS |
| rowValue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowValue | font-size | 11px | 11px | ±1px | PASS |
| rowValue | font-weight | 800 | 800 | exact | PASS |
| rowValue | width | 26.2969px | 26.2969px | ±1px | PASS |
| rowValue | height | 11px | 11px | ±1px | PASS |
| rowValue | padding-top | 0px | 0px | ±1px | PASS |
| rowValue | padding-left | 0px | 0px | ±1px | PASS |
| hold | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| hold | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | border-radius | 0px | 0px | ±1px | PASS |
| hold | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| hold | font-size | 12px | 12px | ±1px | PASS |
| hold | font-weight | 650 | 650 | exact | PASS |
| hold | width | 328.797px | 328.797px | ±1px | PASS |
| hold | height | 24px | 24px | ±1px | PASS |
| hold | padding-top | 0px | 0px | ±1px | PASS |
| hold | padding-left | 0px | 0px | ±1px | PASS |

Residual deltas:
- [asset] unmasked cue/card pixel region (16,242) 359x446; 36.8104% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta

## phone-portrait-holding: PASS

Difference: 43.8429%; regions: 105.
Artifacts: {"reference":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-holding/reference.png","real":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-holding/real.png","diff":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-holding/diff.png","side_by_side":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-holding/side-by-side.png"}

| Selector | Property | Reference | Real | Tolerance | Pass |
| --- | --- | --- | --- | --- | --- |
| cue | color | rgb(255, 255, 255) | rgb(255, 255, 255) | exact-hex | PASS |
| cue | background-color | rgb(3, 19, 31) | rgb(3, 19, 31) | exact-hex | PASS |
| cue | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| cue | border-radius | 12px | 12px | ±1px | PASS |
| cue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| cue | font-size | 31.2px | 31.2px | ±1px | PASS |
| cue | font-weight | 900 | 900 | exact | PASS |
| cue | width | 200.469px | 200.469px | ±1px | PASS |
| cue | height | 67.9531px | 67.9531px | ±1px | PASS |
| cue | padding-top | 8px | 8px | ±1px | PASS |
| cue | padding-left | 10px | 10px | ±1px | PASS |
| card | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| card | background-color | rgba(3, 19, 31, 0.933) | rgba(3, 19, 31, 0.933) | exact-hex | PASS |
| card | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| card | border-radius | 12px | 12px | ±1px | PASS |
| card | font-family | system-ui, sans-serif | system-ui, sans-serif | family; rendered fallback recorded | PASS |
| card | font-size | 16px | 16px | ±1px | PASS |
| card | font-weight | 400 | 400 | exact | PASS |
| card | width | 358.797px | 358.797px | ±1px | PASS |
| card | height | 460.391px | 460.391px | ±1px | PASS |
| card | padding-top | 12px | 12px | ±1px | PASS |
| card | padding-left | 14px | 14px | ±1px | PASS |
| title | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| title | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | border-radius | 0px | 0px | ±1px | PASS |
| title | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| title | font-size | 17px | 17px | ±1px | PASS |
| title | font-weight | 800 | 800 | exact | PASS |
| title | width | 328.797px | 328.797px | ±1px | PASS |
| title | height | 19.5469px | 19.5469px | ±1px | PASS |
| title | padding-top | 0px | 0px | ±1px | PASS |
| title | padding-left | 0px | 0px | ±1px | PASS |
| mode | color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| mode | border-top-color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | border-radius | 0px | 0px | ±1px | PASS |
| mode | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| mode | font-size | 10px | 10px | ±1px | PASS |
| mode | font-weight | 800 | 800 | exact | PASS |
| mode | width | 328.797px | 328.797px | ±1px | PASS |
| mode | height | 13px | 13px | ±1px | PASS |
| mode | padding-top | 0px | 0px | ±1px | PASS |
| mode | padding-left | 0px | 0px | ±1px | PASS |
| row | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| row | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | border-radius | 0px | 0px | ±1px | PASS |
| row | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| row | font-size | 12px | 12px | ±1px | PASS |
| row | font-weight | 650 | 650 | exact | PASS |
| row | width | 328.797px | 328.797px | ±1px | PASS |
| row | height | 24px | 24px | ±1px | PASS |
| row | padding-top | 0px | 0px | ±1px | PASS |
| row | padding-left | 0px | 0px | ±1px | PASS |
| rowName | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowName | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | border-radius | 0px | 0px | ±1px | PASS |
| rowName | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowName | font-size | 12px | 12px | ±1px | PASS |
| rowName | font-weight | 650 | 650 | exact | PASS |
| rowName | width | 270.5px | 270.5px | ±1px | PASS |
| rowName | height | 14.3906px | 14.3906px | ±1px | PASS |
| rowName | padding-top | 0px | 0px | ±1px | PASS |
| rowName | padding-left | 0px | 0px | ±1px | PASS |
| rowValue | color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowValue | border-top-color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | border-radius | 0px | 0px | ±1px | PASS |
| rowValue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowValue | font-size | 11px | 11px | ±1px | PASS |
| rowValue | font-weight | 800 | 800 | exact | PASS |
| rowValue | width | 26.2969px | 26.2969px | ±1px | PASS |
| rowValue | height | 11px | 11px | ±1px | PASS |
| rowValue | padding-top | 0px | 0px | ±1px | PASS |
| rowValue | padding-left | 0px | 0px | ±1px | PASS |
| hold | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| hold | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | border-radius | 0px | 0px | ±1px | PASS |
| hold | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| hold | font-size | 12px | 12px | ±1px | PASS |
| hold | font-weight | 650 | 650 | exact | PASS |
| hold | width | 328.797px | 328.797px | ±1px | PASS |
| hold | height | 24px | 24px | ±1px | PASS |
| hold | padding-top | 0px | 0px | ±1px | PASS |
| hold | padding-left | 0px | 0px | ±1px | PASS |

Residual deltas:
- [asset] unmasked cue/card pixel region (16,242) 359x461; 37.5979% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta

## phone-portrait-countdown: PASS

Difference: 24.6667%; regions: 4.
Artifacts: {"reference":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-countdown/reference.png","real":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-countdown/real.png","diff":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-countdown/diff.png","side_by_side":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-countdown/side-by-side.png"}

| Selector | Property | Reference | Real | Tolerance | Pass |
| --- | --- | --- | --- | --- | --- |
| cue | color | rgb(255, 255, 255) | rgb(255, 255, 255) | exact-hex | PASS |
| cue | background-color | rgb(3, 19, 31) | rgb(3, 19, 31) | exact-hex | PASS |
| cue | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| cue | border-radius | 12px | 12px | ±1px | PASS |
| cue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| cue | font-size | 31.2px | 31.2px | ±1px | PASS |
| cue | font-weight | 900 | 900 | exact | PASS |
| cue | width | 39.3594px | 39.3594px | ±1px | PASS |
| cue | height | 49.2031px | 49.2031px | ±1px | PASS |
| cue | padding-top | 8px | 8px | ±1px | PASS |
| cue | padding-left | 10px | 10px | ±1px | PASS |

Residual deltas:
- None.

## phone-portrait-flow: PASS

Difference: 38.9201%; regions: 91.
Artifacts: {"reference":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-flow/reference.png","real":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-flow/real.png","diff":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-flow/diff.png","side_by_side":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-flow/side-by-side.png"}

| Selector | Property | Reference | Real | Tolerance | Pass |
| --- | --- | --- | --- | --- | --- |
| cue | color | rgb(255, 255, 255) | rgb(255, 255, 255) | exact-hex | PASS |
| cue | background-color | rgb(3, 19, 31) | rgb(3, 19, 31) | exact-hex | PASS |
| cue | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| cue | border-radius | 12px | 12px | ±1px | PASS |
| cue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| cue | font-size | 31.2px | 31.2px | ±1px | PASS |
| cue | font-weight | 900 | 900 | exact | PASS |
| cue | width | 200.469px | 200.469px | ±1px | PASS |
| cue | height | 67.9531px | 67.9531px | ±1px | PASS |
| cue | padding-top | 8px | 8px | ±1px | PASS |
| cue | padding-left | 10px | 10px | ±1px | PASS |
| card | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| card | background-color | rgba(3, 19, 31, 0.933) | rgba(3, 19, 31, 0.933) | exact-hex | PASS |
| card | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| card | border-radius | 12px | 12px | ±1px | PASS |
| card | font-family | system-ui, sans-serif | system-ui, sans-serif | family; rendered fallback recorded | PASS |
| card | font-size | 16px | 16px | ±1px | PASS |
| card | font-weight | 400 | 400 | exact | PASS |
| card | width | 358.797px | 358.797px | ±1px | PASS |
| card | height | 406.391px | 406.391px | ±1px | PASS |
| card | padding-top | 12px | 12px | ±1px | PASS |
| card | padding-left | 14px | 14px | ±1px | PASS |
| title | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| title | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | border-radius | 0px | 0px | ±1px | PASS |
| title | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| title | font-size | 17px | 17px | ±1px | PASS |
| title | font-weight | 800 | 800 | exact | PASS |
| title | width | 328.797px | 328.797px | ±1px | PASS |
| title | height | 19.5469px | 19.5469px | ±1px | PASS |
| title | padding-top | 0px | 0px | ±1px | PASS |
| title | padding-left | 0px | 0px | ±1px | PASS |
| mode | color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| mode | border-top-color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | border-radius | 0px | 0px | ±1px | PASS |
| mode | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| mode | font-size | 10px | 10px | ±1px | PASS |
| mode | font-weight | 800 | 800 | exact | PASS |
| mode | width | 328.797px | 328.797px | ±1px | PASS |
| mode | height | 13px | 13px | ±1px | PASS |
| mode | padding-top | 0px | 0px | ±1px | PASS |
| mode | padding-left | 0px | 0px | ±1px | PASS |
| row | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| row | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | border-radius | 0px | 0px | ±1px | PASS |
| row | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| row | font-size | 12px | 12px | ±1px | PASS |
| row | font-weight | 650 | 650 | exact | PASS |
| row | width | 328.797px | 328.797px | ±1px | PASS |
| row | height | 24px | 24px | ±1px | PASS |
| row | padding-top | 0px | 0px | ±1px | PASS |
| row | padding-left | 0px | 0px | ±1px | PASS |
| rowName | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowName | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | border-radius | 0px | 0px | ±1px | PASS |
| rowName | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowName | font-size | 12px | 12px | ±1px | PASS |
| rowName | font-weight | 650 | 650 | exact | PASS |
| rowName | width | 270.5px | 270.5px | ±1px | PASS |
| rowName | height | 14.3906px | 14.3906px | ±1px | PASS |
| rowName | padding-top | 0px | 0px | ±1px | PASS |
| rowName | padding-left | 0px | 0px | ±1px | PASS |
| rowValue | color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowValue | border-top-color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | border-radius | 0px | 0px | ±1px | PASS |
| rowValue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowValue | font-size | 11px | 11px | ±1px | PASS |
| rowValue | font-weight | 800 | 800 | exact | PASS |
| rowValue | width | 26.2969px | 26.2969px | ±1px | PASS |
| rowValue | height | 11px | 11px | ±1px | PASS |
| rowValue | padding-top | 0px | 0px | ±1px | PASS |
| rowValue | padding-left | 0px | 0px | ±1px | PASS |
| hold | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| hold | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | border-radius | 0px | 0px | ±1px | PASS |
| hold | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| hold | font-size | 12px | 12px | ±1px | PASS |
| hold | font-weight | 650 | 650 | exact | PASS |
| hold | width | 328.797px | 328.797px | ±1px | PASS |
| hold | height | 24px | 24px | ±1px | PASS |
| hold | padding-top | 0px | 0px | ±1px | PASS |
| hold | padding-left | 0px | 0px | ±1px | PASS |

Residual deltas:
- [asset] unmasked cue/card pixel region (16,242) 359x407; 32.7448% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta

## phone-portrait-boxing-knees-off: PASS

Difference: 37.33%; regions: 84.
Artifacts: {"reference":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-boxing-knees-off/reference.png","real":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-boxing-knees-off/real.png","diff":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-boxing-knees-off/diff.png","side_by_side":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-portrait-boxing-knees-off/side-by-side.png"}

| Selector | Property | Reference | Real | Tolerance | Pass |
| --- | --- | --- | --- | --- | --- |
| cue | color | rgb(255, 255, 255) | rgb(255, 255, 255) | exact-hex | PASS |
| cue | background-color | rgb(3, 19, 31) | rgb(3, 19, 31) | exact-hex | PASS |
| cue | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| cue | border-radius | 12px | 12px | ±1px | PASS |
| cue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| cue | font-size | 31.2px | 31.2px | ±1px | PASS |
| cue | font-weight | 900 | 900 | exact | PASS |
| cue | width | 142.219px | 142.219px | ±1px | PASS |
| cue | height | 67.9531px | 67.9531px | ±1px | PASS |
| cue | padding-top | 8px | 8px | ±1px | PASS |
| cue | padding-left | 10px | 10px | ±1px | PASS |
| card | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| card | background-color | rgba(3, 19, 31, 0.933) | rgba(3, 19, 31, 0.933) | exact-hex | PASS |
| card | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| card | border-radius | 12px | 12px | ±1px | PASS |
| card | font-family | system-ui, sans-serif | system-ui, sans-serif | family; rendered fallback recorded | PASS |
| card | font-size | 16px | 16px | ±1px | PASS |
| card | font-weight | 400 | 400 | exact | PASS |
| card | width | 358.797px | 358.797px | ±1px | PASS |
| card | height | 406.391px | 406.391px | ±1px | PASS |
| card | padding-top | 12px | 12px | ±1px | PASS |
| card | padding-left | 14px | 14px | ±1px | PASS |
| title | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| title | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | border-radius | 0px | 0px | ±1px | PASS |
| title | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| title | font-size | 17px | 17px | ±1px | PASS |
| title | font-weight | 800 | 800 | exact | PASS |
| title | width | 328.797px | 328.797px | ±1px | PASS |
| title | height | 19.5469px | 19.5469px | ±1px | PASS |
| title | padding-top | 0px | 0px | ±1px | PASS |
| title | padding-left | 0px | 0px | ±1px | PASS |
| mode | color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| mode | border-top-color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | border-radius | 0px | 0px | ±1px | PASS |
| mode | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| mode | font-size | 10px | 10px | ±1px | PASS |
| mode | font-weight | 800 | 800 | exact | PASS |
| mode | width | 328.797px | 328.797px | ±1px | PASS |
| mode | height | 13px | 13px | ±1px | PASS |
| mode | padding-top | 0px | 0px | ±1px | PASS |
| mode | padding-left | 0px | 0px | ±1px | PASS |
| row | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| row | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | border-radius | 0px | 0px | ±1px | PASS |
| row | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| row | font-size | 12px | 12px | ±1px | PASS |
| row | font-weight | 650 | 650 | exact | PASS |
| row | width | 328.797px | 328.797px | ±1px | PASS |
| row | height | 24px | 24px | ±1px | PASS |
| row | padding-top | 0px | 0px | ±1px | PASS |
| row | padding-left | 0px | 0px | ±1px | PASS |
| rowName | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowName | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | border-radius | 0px | 0px | ±1px | PASS |
| rowName | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowName | font-size | 12px | 12px | ±1px | PASS |
| rowName | font-weight | 650 | 650 | exact | PASS |
| rowName | width | 270.5px | 270.5px | ±1px | PASS |
| rowName | height | 14.3906px | 14.3906px | ±1px | PASS |
| rowName | padding-top | 0px | 0px | ±1px | PASS |
| rowName | padding-left | 0px | 0px | ±1px | PASS |
| rowValue | color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowValue | border-top-color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | border-radius | 0px | 0px | ±1px | PASS |
| rowValue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowValue | font-size | 11px | 11px | ±1px | PASS |
| rowValue | font-weight | 800 | 800 | exact | PASS |
| rowValue | width | 26.2969px | 26.2969px | ±1px | PASS |
| rowValue | height | 11px | 11px | ±1px | PASS |
| rowValue | padding-top | 0px | 0px | ±1px | PASS |
| rowValue | padding-left | 0px | 0px | ±1px | PASS |
| hold | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| hold | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | border-radius | 0px | 0px | ±1px | PASS |
| hold | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| hold | font-size | 12px | 12px | ±1px | PASS |
| hold | font-weight | 650 | 650 | exact | PASS |
| hold | width | 328.797px | 328.797px | ±1px | PASS |
| hold | height | 24px | 24px | ±1px | PASS |
| hold | padding-top | 0px | 0px | ±1px | PASS |
| hold | padding-left | 0px | 0px | ±1px | PASS |

Residual deltas:
- [asset] unmasked cue/card pixel region (16,242) 359x407; 31.3417% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta

## desktop-knee-flicker: PASS

Difference: 45.3819%; regions: 74.
Artifacts: {"reference":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-knee-flicker/reference.png","real":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-knee-flicker/real.png","diff":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-knee-flicker/diff.png","side_by_side":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-knee-flicker/side-by-side.png"}

| Selector | Property | Reference | Real | Tolerance | Pass |
| --- | --- | --- | --- | --- | --- |
| cue | color | rgb(255, 255, 255) | rgb(255, 255, 255) | exact-hex | PASS |
| cue | background-color | rgb(3, 19, 31) | rgb(3, 19, 31) | exact-hex | PASS |
| cue | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| cue | border-radius | 12px | 12px | ±1px | PASS |
| cue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| cue | font-size | 52px | 52px | ±1px | PASS |
| cue | font-weight | 900 | 900 | exact | PASS |
| cue | width | 189.578px | 189.578px | ±1px | PASS |
| cue | height | 88.75px | 88.75px | ±1px | PASS |
| cue | padding-top | 8px | 8px | ±1px | PASS |
| cue | padding-left | 10px | 10px | ±1px | PASS |
| card | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| card | background-color | rgba(3, 19, 31, 0.933) | rgba(3, 19, 31, 0.933) | exact-hex | PASS |
| card | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| card | border-radius | 12px | 12px | ±1px | PASS |
| card | font-family | system-ui, sans-serif | system-ui, sans-serif | family; rendered fallback recorded | PASS |
| card | font-size | 16px | 16px | ±1px | PASS |
| card | font-weight | 400 | 400 | exact | PASS |
| card | width | 420px | 420px | ±1px | PASS |
| card | height | 445.547px | 445.547px | ±1px | PASS |
| card | padding-top | 12px | 12px | ±1px | PASS |
| card | padding-left | 14px | 14px | ±1px | PASS |
| title | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| title | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | border-radius | 0px | 0px | ±1px | PASS |
| title | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| title | font-size | 17px | 17px | ±1px | PASS |
| title | font-weight | 800 | 800 | exact | PASS |
| title | width | 390px | 390px | ±1px | PASS |
| title | height | 19.5469px | 19.5469px | ±1px | PASS |
| title | padding-top | 0px | 0px | ±1px | PASS |
| title | padding-left | 0px | 0px | ±1px | PASS |
| mode | color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| mode | border-top-color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | border-radius | 0px | 0px | ±1px | PASS |
| mode | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| mode | font-size | 10px | 10px | ±1px | PASS |
| mode | font-weight | 800 | 800 | exact | PASS |
| mode | width | 390px | 390px | ±1px | PASS |
| mode | height | 13px | 13px | ±1px | PASS |
| mode | padding-top | 0px | 0px | ±1px | PASS |
| mode | padding-left | 0px | 0px | ±1px | PASS |
| row | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| row | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | border-radius | 0px | 0px | ±1px | PASS |
| row | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| row | font-size | 12px | 12px | ±1px | PASS |
| row | font-weight | 650 | 650 | exact | PASS |
| row | width | 390px | 390px | ±1px | PASS |
| row | height | 24px | 24px | ±1px | PASS |
| row | padding-top | 0px | 0px | ±1px | PASS |
| row | padding-left | 0px | 0px | ±1px | PASS |
| rowName | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowName | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | border-radius | 0px | 0px | ±1px | PASS |
| rowName | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowName | font-size | 12px | 12px | ±1px | PASS |
| rowName | font-weight | 650 | 650 | exact | PASS |
| rowName | width | 331.703px | 331.703px | ±1px | PASS |
| rowName | height | 14.3906px | 14.3906px | ±1px | PASS |
| rowName | padding-top | 0px | 0px | ±1px | PASS |
| rowName | padding-left | 0px | 0px | ±1px | PASS |
| rowValue | color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowValue | border-top-color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | border-radius | 0px | 0px | ±1px | PASS |
| rowValue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowValue | font-size | 11px | 11px | ±1px | PASS |
| rowValue | font-weight | 800 | 800 | exact | PASS |
| rowValue | width | 26.2969px | 26.2969px | ±1px | PASS |
| rowValue | height | 11px | 11px | ±1px | PASS |
| rowValue | padding-top | 0px | 0px | ±1px | PASS |
| rowValue | padding-left | 0px | 0px | ±1px | PASS |
| hold | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| hold | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | border-radius | 0px | 0px | ±1px | PASS |
| hold | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| hold | font-size | 12px | 12px | ±1px | PASS |
| hold | font-weight | 650 | 650 | exact | PASS |
| hold | width | 390px | 390px | ±1px | PASS |
| hold | height | 24px | 24px | ±1px | PASS |
| hold | padding-top | 0px | 0px | ±1px | PASS |
| hold | padding-left | 0px | 0px | ±1px | PASS |

Residual deltas:
- [asset] unmasked cue/card pixel region (510,399) 420x311; 41.1662% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta

## desktop-holding: PASS

Difference: 44.9063%; regions: 79.
Artifacts: {"reference":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-holding/reference.png","real":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-holding/real.png","diff":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-holding/diff.png","side_by_side":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-holding/side-by-side.png"}

| Selector | Property | Reference | Real | Tolerance | Pass |
| --- | --- | --- | --- | --- | --- |
| cue | color | rgb(255, 255, 255) | rgb(255, 255, 255) | exact-hex | PASS |
| cue | background-color | rgb(3, 19, 31) | rgb(3, 19, 31) | exact-hex | PASS |
| cue | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| cue | border-radius | 12px | 12px | ±1px | PASS |
| cue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| cue | font-size | 52px | 52px | ±1px | PASS |
| cue | font-weight | 900 | 900 | exact | PASS |
| cue | width | 319.562px | 319.562px | ±1px | PASS |
| cue | height | 88.75px | 88.75px | ±1px | PASS |
| cue | padding-top | 8px | 8px | ±1px | PASS |
| cue | padding-left | 10px | 10px | ±1px | PASS |
| card | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| card | background-color | rgba(3, 19, 31, 0.933) | rgba(3, 19, 31, 0.933) | exact-hex | PASS |
| card | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| card | border-radius | 12px | 12px | ±1px | PASS |
| card | font-family | system-ui, sans-serif | system-ui, sans-serif | family; rendered fallback recorded | PASS |
| card | font-size | 16px | 16px | ±1px | PASS |
| card | font-weight | 400 | 400 | exact | PASS |
| card | width | 420px | 420px | ±1px | PASS |
| card | height | 460.391px | 460.391px | ±1px | PASS |
| card | padding-top | 12px | 12px | ±1px | PASS |
| card | padding-left | 14px | 14px | ±1px | PASS |
| title | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| title | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | border-radius | 0px | 0px | ±1px | PASS |
| title | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| title | font-size | 17px | 17px | ±1px | PASS |
| title | font-weight | 800 | 800 | exact | PASS |
| title | width | 390px | 390px | ±1px | PASS |
| title | height | 19.5469px | 19.5469px | ±1px | PASS |
| title | padding-top | 0px | 0px | ±1px | PASS |
| title | padding-left | 0px | 0px | ±1px | PASS |
| mode | color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| mode | border-top-color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | border-radius | 0px | 0px | ±1px | PASS |
| mode | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| mode | font-size | 10px | 10px | ±1px | PASS |
| mode | font-weight | 800 | 800 | exact | PASS |
| mode | width | 390px | 390px | ±1px | PASS |
| mode | height | 13px | 13px | ±1px | PASS |
| mode | padding-top | 0px | 0px | ±1px | PASS |
| mode | padding-left | 0px | 0px | ±1px | PASS |
| row | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| row | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | border-radius | 0px | 0px | ±1px | PASS |
| row | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| row | font-size | 12px | 12px | ±1px | PASS |
| row | font-weight | 650 | 650 | exact | PASS |
| row | width | 390px | 390px | ±1px | PASS |
| row | height | 24px | 24px | ±1px | PASS |
| row | padding-top | 0px | 0px | ±1px | PASS |
| row | padding-left | 0px | 0px | ±1px | PASS |
| rowName | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowName | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | border-radius | 0px | 0px | ±1px | PASS |
| rowName | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowName | font-size | 12px | 12px | ±1px | PASS |
| rowName | font-weight | 650 | 650 | exact | PASS |
| rowName | width | 331.703px | 331.703px | ±1px | PASS |
| rowName | height | 14.3906px | 14.3906px | ±1px | PASS |
| rowName | padding-top | 0px | 0px | ±1px | PASS |
| rowName | padding-left | 0px | 0px | ±1px | PASS |
| rowValue | color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowValue | border-top-color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | border-radius | 0px | 0px | ±1px | PASS |
| rowValue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowValue | font-size | 11px | 11px | ±1px | PASS |
| rowValue | font-weight | 800 | 800 | exact | PASS |
| rowValue | width | 26.2969px | 26.2969px | ±1px | PASS |
| rowValue | height | 11px | 11px | ±1px | PASS |
| rowValue | padding-top | 0px | 0px | ±1px | PASS |
| rowValue | padding-left | 0px | 0px | ±1px | PASS |
| hold | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| hold | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | border-radius | 0px | 0px | ±1px | PASS |
| hold | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| hold | font-size | 12px | 12px | ±1px | PASS |
| hold | font-weight | 650 | 650 | exact | PASS |
| hold | width | 390px | 390px | ±1px | PASS |
| hold | height | 24px | 24px | ±1px | PASS |
| hold | padding-top | 0px | 0px | ±1px | PASS |
| hold | padding-left | 0px | 0px | ±1px | PASS |

Residual deltas:
- [asset] unmasked cue/card pixel region (510,399) 420x326; 40.4795% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta

## desktop-countdown: PASS

Difference: 10.9524%; regions: 2.
Artifacts: {"reference":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-countdown/reference.png","real":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-countdown/real.png","diff":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-countdown/diff.png","side_by_side":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/desktop-countdown/side-by-side.png"}

| Selector | Property | Reference | Real | Tolerance | Pass |
| --- | --- | --- | --- | --- | --- |
| cue | color | rgb(255, 255, 255) | rgb(255, 255, 255) | exact-hex | PASS |
| cue | background-color | rgb(3, 19, 31) | rgb(3, 19, 31) | exact-hex | PASS |
| cue | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| cue | border-radius | 12px | 12px | ±1px | PASS |
| cue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| cue | font-size | 52px | 52px | ±1px | PASS |
| cue | font-weight | 900 | 900 | exact | PASS |
| cue | width | 50.9219px | 50.9219px | ±1px | PASS |
| cue | height | 70px | 70px | ±1px | PASS |
| cue | padding-top | 8px | 8px | ±1px | PASS |
| cue | padding-left | 10px | 10px | ±1px | PASS |

Residual deltas:
- None.

## phone-landscape-knee-flicker: PASS

Difference: 20.7665%; regions: 81.
Artifacts: {"reference":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-landscape-knee-flicker/reference.png","real":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-landscape-knee-flicker/real.png","diff":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-landscape-knee-flicker/diff.png","side_by_side":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-landscape-knee-flicker/side-by-side.png"}

| Selector | Property | Reference | Real | Tolerance | Pass |
| --- | --- | --- | --- | --- | --- |
| cue | color | rgb(255, 255, 255) | rgb(255, 255, 255) | exact-hex | PASS |
| cue | background-color | rgb(3, 19, 31) | rgb(3, 19, 31) | exact-hex | PASS |
| cue | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| cue | border-radius | 12px | 12px | ±1px | PASS |
| cue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| cue | font-size | 30px | 30px | ±1px | PASS |
| cue | font-weight | 900 | 900 | exact | PASS |
| cue | width | 142.219px | 142.219px | ±1px | PASS |
| cue | height | 66.75px | 66.75px | ±1px | PASS |
| cue | padding-top | 8px | 8px | ±1px | PASS |
| cue | padding-left | 10px | 10px | ±1px | PASS |
| card | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| card | background-color | rgba(3, 19, 31, 0.933) | rgba(3, 19, 31, 0.933) | exact-hex | PASS |
| card | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| card | border-radius | 12px | 12px | ±1px | PASS |
| card | font-family | system-ui, sans-serif | system-ui, sans-serif | family; rendered fallback recorded | PASS |
| card | font-size | 16px | 16px | ±1px | PASS |
| card | font-weight | 400 | 400 | exact | PASS |
| card | width | 440px | 440px | ±1px | PASS |
| card | height | 274.094px | 274.094px | ±1px | PASS |
| card | padding-top | 3px | 3px | ±1px | PASS |
| card | padding-left | 11px | 11px | ±1px | PASS |
| title | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| title | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | border-radius | 0px | 0px | ±1px | PASS |
| title | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| title | font-size | 14px | 14px | ±1px | PASS |
| title | font-weight | 800 | 800 | exact | PASS |
| title | width | 416px | 416px | ±1px | PASS |
| title | height | 16.0938px | 16.0938px | ±1px | PASS |
| title | padding-top | 0px | 0px | ±1px | PASS |
| title | padding-left | 0px | 0px | ±1px | PASS |
| mode | color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| mode | border-top-color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | border-radius | 0px | 0px | ±1px | PASS |
| mode | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| mode | font-size | 10px | 10px | ±1px | PASS |
| mode | font-weight | 800 | 800 | exact | PASS |
| mode | width | 416px | 416px | ±1px | PASS |
| mode | height | 13px | 13px | ±1px | PASS |
| mode | padding-top | 0px | 0px | ±1px | PASS |
| mode | padding-left | 0px | 0px | ±1px | PASS |
| row | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| row | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | border-radius | 0px | 0px | ±1px | PASS |
| row | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| row | font-size | 12px | 12px | ±1px | PASS |
| row | font-weight | 650 | 650 | exact | PASS |
| row | width | 416px | 416px | ±1px | PASS |
| row | height | 16px | 16px | ±1px | PASS |
| row | padding-top | 0px | 0px | ±1px | PASS |
| row | padding-left | 0px | 0px | ±1px | PASS |
| rowName | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowName | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | border-radius | 0px | 0px | ±1px | PASS |
| rowName | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowName | font-size | 12px | 12px | ±1px | PASS |
| rowName | font-weight | 650 | 650 | exact | PASS |
| rowName | width | 361.703px | 361.703px | ±1px | PASS |
| rowName | height | 14.3906px | 14.3906px | ±1px | PASS |
| rowName | padding-top | 0px | 0px | ±1px | PASS |
| rowName | padding-left | 0px | 0px | ±1px | PASS |
| rowValue | color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowValue | border-top-color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | border-radius | 0px | 0px | ±1px | PASS |
| rowValue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowValue | font-size | 11px | 11px | ±1px | PASS |
| rowValue | font-weight | 800 | 800 | exact | PASS |
| rowValue | width | 26.2969px | 26.2969px | ±1px | PASS |
| rowValue | height | 11px | 11px | ±1px | PASS |
| rowValue | padding-top | 0px | 0px | ±1px | PASS |
| rowValue | padding-left | 0px | 0px | ±1px | PASS |
| hold | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| hold | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | border-radius | 0px | 0px | ±1px | PASS |
| hold | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| hold | font-size | 12px | 12px | ±1px | PASS |
| hold | font-weight | 650 | 650 | exact | PASS |
| hold | width | 416px | 416px | ±1px | PASS |
| hold | height | 16px | 16px | ±1px | PASS |
| hold | padding-top | 0px | 0px | ±1px | PASS |
| hold | padding-left | 0px | 0px | ±1px | PASS |

Residual deltas:
- [asset] unmasked cue/card pixel region (394,172) 440x194; 14.3933% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta
- [asset] unmasked cue/card pixel region (405,113) 74x11; 0.45% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta
- [asset] unmasked cue/card pixel region (482,113) 62x11; 0.36% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta
- [asset] unmasked cue/card pixel region (394,178) 14x40; 0.3123% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta

## phone-landscape-flow: PASS

Difference: 19.2872%; regions: 87.
Artifacts: {"reference":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-landscape-flow/reference.png","real":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-landscape-flow/real.png","diff":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-landscape-flow/diff.png","side_by_side":"/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly/.ui-fidelity/evidence/play-calibration-checklist/phone-landscape-flow/side-by-side.png"}

| Selector | Property | Reference | Real | Tolerance | Pass |
| --- | --- | --- | --- | --- | --- |
| cue | color | rgb(255, 255, 255) | rgb(255, 255, 255) | exact-hex | PASS |
| cue | background-color | rgb(3, 19, 31) | rgb(3, 19, 31) | exact-hex | PASS |
| cue | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| cue | border-radius | 12px | 12px | ±1px | PASS |
| cue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| cue | font-size | 30px | 30px | ±1px | PASS |
| cue | font-weight | 900 | 900 | exact | PASS |
| cue | width | 193.672px | 193.672px | ±1px | PASS |
| cue | height | 66.75px | 66.75px | ±1px | PASS |
| cue | padding-top | 8px | 8px | ±1px | PASS |
| cue | padding-left | 10px | 10px | ±1px | PASS |
| card | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| card | background-color | rgba(3, 19, 31, 0.933) | rgba(3, 19, 31, 0.933) | exact-hex | PASS |
| card | border-top-color | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.34) | exact-hex | PASS |
| card | border-radius | 12px | 12px | ±1px | PASS |
| card | font-family | system-ui, sans-serif | system-ui, sans-serif | family; rendered fallback recorded | PASS |
| card | font-size | 16px | 16px | ±1px | PASS |
| card | font-weight | 400 | 400 | exact | PASS |
| card | width | 440px | 440px | ±1px | PASS |
| card | height | 255.594px | 255.594px | ±1px | PASS |
| card | padding-top | 3px | 3px | ±1px | PASS |
| card | padding-left | 11px | 11px | ±1px | PASS |
| title | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| title | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| title | border-radius | 0px | 0px | ±1px | PASS |
| title | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| title | font-size | 14px | 14px | ±1px | PASS |
| title | font-weight | 800 | 800 | exact | PASS |
| title | width | 416px | 416px | ±1px | PASS |
| title | height | 16.0938px | 16.0938px | ±1px | PASS |
| title | padding-top | 0px | 0px | ±1px | PASS |
| title | padding-left | 0px | 0px | ±1px | PASS |
| mode | color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| mode | border-top-color | rgb(135, 226, 240) | rgb(135, 226, 240) | exact-hex | PASS |
| mode | border-radius | 0px | 0px | ±1px | PASS |
| mode | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| mode | font-size | 10px | 10px | ±1px | PASS |
| mode | font-weight | 800 | 800 | exact | PASS |
| mode | width | 416px | 416px | ±1px | PASS |
| mode | height | 13px | 13px | ±1px | PASS |
| mode | padding-top | 0px | 0px | ±1px | PASS |
| mode | padding-left | 0px | 0px | ±1px | PASS |
| row | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| row | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| row | border-radius | 0px | 0px | ±1px | PASS |
| row | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| row | font-size | 12px | 12px | ±1px | PASS |
| row | font-weight | 650 | 650 | exact | PASS |
| row | width | 416px | 416px | ±1px | PASS |
| row | height | 16px | 16px | ±1px | PASS |
| row | padding-top | 0px | 0px | ±1px | PASS |
| row | padding-left | 0px | 0px | ±1px | PASS |
| rowName | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowName | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| rowName | border-radius | 0px | 0px | ±1px | PASS |
| rowName | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowName | font-size | 12px | 12px | ±1px | PASS |
| rowName | font-weight | 650 | 650 | exact | PASS |
| rowName | width | 361.703px | 361.703px | ±1px | PASS |
| rowName | height | 14.3906px | 14.3906px | ±1px | PASS |
| rowName | padding-top | 0px | 0px | ±1px | PASS |
| rowName | padding-left | 0px | 0px | ±1px | PASS |
| rowValue | color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| rowValue | border-top-color | rgb(154, 240, 208) | rgb(154, 240, 208) | exact-hex | PASS |
| rowValue | border-radius | 0px | 0px | ±1px | PASS |
| rowValue | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| rowValue | font-size | 11px | 11px | ±1px | PASS |
| rowValue | font-weight | 800 | 800 | exact | PASS |
| rowValue | width | 26.2969px | 26.2969px | ±1px | PASS |
| rowValue | height | 11px | 11px | ±1px | PASS |
| rowValue | padding-top | 0px | 0px | ±1px | PASS |
| rowValue | padding-left | 0px | 0px | ±1px | PASS |
| hold | color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | background-color | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | exact-hex | PASS |
| hold | border-top-color | rgb(234, 249, 255) | rgb(234, 249, 255) | exact-hex | PASS |
| hold | border-radius | 0px | 0px | ±1px | PASS |
| hold | font-family | system-ui | system-ui | family; rendered fallback recorded | PASS |
| hold | font-size | 12px | 12px | ±1px | PASS |
| hold | font-weight | 650 | 650 | exact | PASS |
| hold | width | 416px | 416px | ±1px | PASS |
| hold | height | 16px | 16px | ±1px | PASS |
| hold | padding-top | 0px | 0px | ±1px | PASS |
| hold | padding-left | 0px | 0px | ±1px | PASS |

Residual deltas:
- [asset] unmasked cue/card pixel region (394,201) 200x146; 12.2789% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta
- [asset] unmasked cue/card pixel region (405,113) 74x11; 0.4682% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta
- [asset] unmasked cue/card pixel region (482,113) 62x11; 0.3746% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta
- [asset] unmasked cue/card pixel region (232,72) 65x22; 0.3538% of compared pixels; raw region alone does not prove UI hierarchy drift; native scene through alpha is a separate asset delta

