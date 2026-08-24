# AeroBeat Live Camera Calibration State

**Date:** 2026-08-24  
**Status:** In Progress  
**Last Updated:** 2026-08-24 10:15 America/New_York  
**Blocked Reason:** None  
**Agent:** cookie

---

## Goal

Make the AeroBeat calibration button truthfully switch from replay-only proving data to a sustained live-camera checkpoint after mobile camera permission is accepted.

---

## Overview

Derrick's physical Android Chrome test confirmed that the previous fix successfully opens the browser camera permission prompt. After choosing to allow camera access for the session, the Android camera indicator appears briefly and disappears, while the AeroBeat UI continues to look like replay/dummy content.

The current assembly code explains that behavior: it requests permission, reports granted, then immediately stops every granted media track. The runtime pose-flow panel is also intentionally driven by one deterministic replay frame, and the calibration screen has declarative replay sample attributes. This plan wires the accepted stream into a live-running shell state and updates the visible pose/input panels through public package APIs so the page makes the live/replay boundary clear.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Derrick's Android Chrome observation: permission prompt appears, camera indicator disappears shortly, UI still appears dummy/replay | Conversation 2026-08-24 |
| `REF-02` | Current assembly camera permission and replay checkpoint wiring | `src/index.js` |
| `REF-03` | Browser validation of calibration click and getUserMedia behavior | `scripts/validate-playwright-console-noise.js` |
| `REF-04` | Secure-context and checkpoint documentation | `README.md`, `docs/secure-context.md` |

---

## Tasks

### Task 1: Sustain Live Camera Calibration State

**Bead ID:** `oc-wks`  
**SubAgent:** `primary` (for `coder` workflow role)  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Claim bead `oc-wks` with `bd update oc-wks --status in_progress --json`. Read this repo's README before touching code. Fix AeroBeat calibration so accepting camera permission keeps the live camera stream active for the page lifetime instead of stopping tracks immediately, updates visible Camera status with a running live stream state, and refreshes the runtime/calibration pose-flow UI through public `@aerobeat/web-cv` and `@aerobeat/web-input` APIs with a live-camera source after permission is granted. Update `scripts/validate-playwright-console-noise.js` so it proves the granted stream tracks are not stopped immediately and the UI no longer remains replay-only after calibration. Update README/docs copy so it accurately describes live-camera checkpoint behavior and replay fallback. Run `npm test` and `npm run build`. Commit and push unless blocked. Report changed files, validation output, and commit SHA.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-08-24-live-camera-calibration-state.md`
- `src/index.js`
- `scripts/validate-playwright-console-noise.js`
- `README.md`
- `docs/secure-context.md`

**Status:** ✅ Complete

**Results:** Implemented the live-camera checkpoint in `src/index.js`: granted streams are retained on the app instance instead of stopped immediately, Camera status now reports `Camera permission: granted - live stream running (...)`, and `disconnectedCallback()` releases tracks on page teardown. After permission grant, both the app runtime pose-flow panel and calibration screen pose-flow panel are refreshed through public `@aerobeat/web-cv` replay-frame and `@aerobeat/web-input` draft-event APIs with the live checkpoint source `aero.camera.live.permission-stream`. Updated `scripts/validate-playwright-console-noise.js` to stub a granted live video track, prove it is not stopped after calibration, verify both visible pose-flow panels switch away from replay to the live source, and prove teardown stops the track. Updated `README.md` and `docs/secure-context.md` to describe initial replay fallback, live checkpoint behavior, and deferred full MoveNet live inference. Validation passed: `npm test` and `npm run build`. Commit: `272cff6`.

### Task 2: Verify Live Camera Calibration State

**Bead ID:** `oc-wks`  
**SubAgent:** `primary` (for `qa` workflow role)  
**Role:** `qa`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** After coder handoff, verify bead `oc-wks` without changing implementation unless asked. Read this repo's README first. Run relevant validation, inspect the app behavior through Playwright or the highest-fidelity available browser check, and confirm the calibration path keeps a granted camera stream running and visibly switches from replay-only to live-camera state. Report exact evidence and any warnings/errors. Do not close the bead.

**Folders Created/Deleted/Modified:**
- None expected.

**Files Created/Deleted/Modified:**
- None expected.

**Status:** ⏳ Pending

**Results:** Pending.

### Task 3: Audit Live Camera Calibration State

**Bead ID:** `oc-wks`  
**SubAgent:** `primary` (for `auditor` workflow role)  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** After QA handoff, independently audit bead `oc-wks`. Read this repo's README first. Check the diff, docs, tests, and validation evidence against the plan and bead acceptance criteria. Close `oc-wks` only if the implementation is complete, validation is clean, and the visible UI is truthful about live vs replay state. If it fails, leave the bead open and report exact gaps.

**Folders Created/Deleted/Modified:**
- None expected.

**Files Created/Deleted/Modified:**
- None expected.

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** Pending  

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:**
- `272cff6` - Keep calibration camera stream live

**Lessons Learned:** Pending.
