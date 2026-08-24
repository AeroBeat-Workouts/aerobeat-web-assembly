# AeroBeat Live Camera Derived Values

**Date:** 2026-08-24  
**Status:** In Progress  
**Last Updated:** 2026-08-24 11:25 EDT  
**Blocked Reason:** None  
**Agent:** cookie

---

## Goal

Make AeroBeat visibly consume the granted mobile camera stream and update live camera-derived values after calibration starts.

---

## Overview

Derrick confirmed the visible build proof changed, so the phone is seeing the latest route, but camera behavior is still wrong: after accepting camera permission, the Android camera indicator appears only briefly and the visible values do not change.

The previous completed slice intentionally retained a permission stream and swapped replay labels to a live checkpoint source. This slice needs to attach the stream to an actual video consumer, sample frames continuously, expose changing live frame/sample status, and feed changing camera-derived pose/input values into the existing public UI panels. Full MoveNet model inference can remain a future vendor slice, but this app must no longer look like static dummy/replay data after permission is granted.

---

## REFERENCES

| ID | Description | Path |
| --- | --- | --- |
| `REF-01` | Derrick's Android Chrome observation: version changed, camera indicator appears briefly, values do not change | Conversation 2026-08-24 |
| `REF-02` | Previous live permission-stream checkpoint and explicit deferred full inference scope | `.plans/archive/2026-08-24-live-camera-calibration-state.md` |
| `REF-03` | Current assembly camera and pose-flow wiring | `src/index.js` |
| `REF-04` | Browser validation of calibration, stream lifecycle, and visible metadata | `scripts/validate-playwright-console-noise.js` |

---

## Tasks

### Task 1: Implement Live Frame Sampling

**Bead ID:** `oc-3t1`  
**SubAgent:** `primary`  
**Role:** `coder`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** Claim bead `oc-3t1` with `bd update oc-3t1 --claim --json`. Read this repo's README before touching code. Implement the live camera-derived values slice in `aerobeat-web-assembly`: after calibration permission is granted, attach the stream to a video element, keep it playing, sample frames on a recurring animation loop, update visible Camera status with changing frame/sample counters, and feed changing camera-derived normalized pose/input values through the existing pose-flow panels. Do not claim full MoveNet inference unless the real model is actually wired; label the source honestly as a live camera frame sampler. Update Playwright validation to prove multiple live samples are emitted, values change over time, the track is not stopped before teardown, teardown releases it, and there are no console/page errors. Bump the patch version for phone proof, run `npm test` and `npm run build`, commit and push. Report changed files, validation output, and commit SHA.

**Folders Created/Deleted/Modified:**
- `.plans/`

**Files Created/Deleted/Modified:**
- `.plans/2026-08-24-live-camera-derived-values.md`
- `src/index.js`
- `scripts/validate-playwright-console-noise.js`
- `README.md`
- `docs/secure-context.md`
- `package.json`
- `package-lock.json`

**Status:** ✅ Complete

**Results:** Coder implemented a retained hidden video consumer, recurring animation-frame sampling, visible frame/sample counters, and `aero.camera.live.frame-sampler` pose/input proof values derived from sampled video frames rather than claiming MoveNet inference. Playwright validation now uses a real canvas-backed `MediaStream`, proves multiple changing samples, verifies the camera track remains live before teardown, verifies teardown stops it once, and fails on console/page noise. Version bumped to `0.0.3`; `npm test` and `npm run build` passed.

### Task 2: QA Live Camera Sampling

**Bead ID:** `oc-3t1`  
**SubAgent:** `primary`  
**Role:** `qa`  
**References:** `REF-01`, `REF-03`, `REF-04`  
**Prompt:** After coder handoff, verify bead `oc-3t1` without changing implementation unless asked. Read this repo's README first. Run relevant validation and use Playwright or the highest-fidelity available browser check to confirm the calibration path keeps a granted stream consumed by video, emits multiple changing camera-derived samples, updates visible status over time, keeps the track live before teardown, and releases it on teardown. Report exact evidence and any warnings/errors. Do not close the bead.

**Status:** ⏳ Pending

**Results:** Pending.

### Task 3: Audit Live Camera Sampling

**Bead ID:** `oc-3t1`  
**SubAgent:** `primary`  
**Role:** `auditor`  
**References:** `REF-01`, `REF-02`, `REF-03`, `REF-04`  
**Prompt:** After QA handoff, independently audit bead `oc-3t1`. Read this repo's README first. Check the diff, docs, tests, and validation evidence against the plan and bead acceptance criteria. Close `oc-3t1` only if the implementation truthfully delivers changing live camera-derived values, validation is clean, Git is pushed, and the visible UI does not imply full MoveNet inference unless that is actually implemented. If it fails, leave the bead open and report exact gaps.

**Status:** ⏳ Pending

**Results:** Pending.

---

## Final Results

**Status:** Pending

**What We Built:** Pending.

**Reference Check:** Pending.

**Commits:** Pending.

**Lessons Learned:** Pending.
