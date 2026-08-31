# AeroBeat Scrolling Boxing Row Timing Band

**Date:** 2026-08-31  
**Status:** Draft — Awaiting Derrick Approval  
**Owner:** `aerobeat-web-assembly`  
**Parent plan:** `.plans/2026-08-28-embeddable-game-calibration-and-boxing-prototypes.md`  
**Release target:** next web assembly release after `0.0.25`  

---

## Goal

Make the two Row-family Boxing experiments behave as truthful scrolling rhythm lanes: every Boxing cue travels continuously from below the viewport to above it, crosses one semi-transparent success band in the upper quarter, and uses motion through that band—not approach rings—to communicate timing.

Keep Flow, Semantic Cut, and Spatial Cut as 4×3 experiments. Do not select or promote a production Boxing winner.

## REFERENCES

- User physical-test direction, 2026-08-31: Semantic Row and Spatial Row scroll bottom-to-top; show a semi-transparent row sized from the timing window in lane coordinates; remove Row approach rings.
- Clarifications: full early-through-late band; Row-only lane experiment; success band in upper quarter; all Boxing cues scroll; two-hand guards/squat duplicate into both lanes; existing 350 ms judged feedback remains authoritative.
- Existing judgement truth: `aerobeat-web-contracts/src/gameplay-contracts.js` exports inclusive `timingWindowBeforeMs=180` and `timingWindowAfterMs=180`.
- Existing renderer owner: `aerobeat-web-renderer/src/gameplay-plan.js`.
- Existing assembly presentation selection: `aerobeat-web-assembly/src/index.js`.
- Existing assembly target projection: `aerobeat-web-assembly/src/session-render-projection.js`.
- Umbrella Bead: `aerobeat-web-assembly-hc4`.
- Renderer Bead: `aerobeat-web-renderer-sal`.
- Assembly integration Bead: `aerobeat-web-assembly-hc4.1`.
- QA/release/handoff Bead: `aerobeat-web-assembly-hc4.2`.

---

## Approved Product Shape Pending Plan Approval

### Exact presentation mapping

| Product variant | Renderer layout |
|---|---|
| Flow | Existing 4×3 Flow grid, unchanged |
| Semantic Row | New scrolling two-lane Boxing Row |
| Spatial Row | New scrolling two-lane Boxing Row |
| Semantic Cut | 4×3 Boxing grid |
| Spatial Cut | Existing 4×3 Boxing grid, unchanged |

Current runtime selection is ruleset-only, so Semantic Cut incorrectly shares the semantic track and Spatial Row incorrectly shares the spatial grid. This slice makes presentation recipe-aware and corrects both mappings to the product identities above.

### Authoritative row geometry

Use normalized top-left viewport coordinates. For a physically square target with normalized height `h`, judgement center `C`, target/theme approach lead `L`, approved hit-center `yHit=0.25`, and current timeline `t`:

- Target is fully below the viewport at `C-L`.
- Linear upward speed is `v=(1+h/2-yHit)/L` normalized viewport units per millisecond.
- Target top is `yTop(t)=yHit-h/2-v*(t-C)`.
- The target center is exactly at `yHit` at `C`.
- The full valid band begins at `bandTop=yHit-v*timingWindowAfterMs`.
- The band height is `v*(timingWindowBeforeMs+timingWindowAfterMs)`.
- At `C-timingWindowBeforeMs`, the target center touches the band’s lower edge.
- At `C+timingWindowAfterMs`, the target center touches the band’s upper edge.

This derives band size from the real scroll velocity and complete scoring window. The band is not independently resized.

### Visual behavior

- One shared horizontal band spans both lane backgrounds and their gap.
- Initial band alpha is a bounded renderer tuning token, targeted at `0.22` for physical evaluation.
- Existing lane backgrounds remain.
- Old bottom receptor lines disappear in Row.
- Row emits zero approach-ring commands for every pending cue.
- Punches and directional weave cues use their lane.
- Two-hand guards and squat cues render one aspect-preserving copy in each lane.
- All Row cues use their canonical Boxing icon semantics rather than 4×3 hatches.
- Row targets continue moving during real or synthetic hit/miss feedback.
- Existing GREAT, pulse, miss distinction, and common 350 ms feedback removal remain unchanged, even when an early hit fades before reaching the viewport top.
- Gameplay judgement/scoring windows do not change.

---

## Task 1 — Implement reusable renderer Row layout

**Bead:** `aerobeat-web-renderer-sal`  
**Owner:** `aerobeat-web-renderer` coder → independent QA → auditor  

**Work:**

- Add an explicit Row presentation independent of semantic/spatial scoring ruleset.
- Add bounded `rowHitCenterY` and `rowTimingBandAlpha` renderer tuning fields and update deterministic tuning/profile hashes.
- Implement exact linear target motion and shared timing-band geometry from authoritative before/after milliseconds supplied in the frame.
- Preserve physical-square icon sizing at all supported aspects.
- Suppress receptor lines and approach rings only for Row.
- Render all Row Boxing cues as icons; duplicate two-hand guard/squat into both lanes without stretching.
- Keep moving hit/miss/GREAT feedback attached to the target location.
- Regression-lock Flow and 4×3 Boxing command plans.

**Likely files:**

- `aerobeat-web-renderer/src/gameplay-plan.js`
- `aerobeat-web-renderer/src/visual-profiles.js`
- `aerobeat-web-renderer/scripts/validate-renderer-facade.js`
- `aerobeat-web-renderer/scripts/validate-browser-renderer.js`
- renderer README

**Acceptance:**

- Exact early/center/late band-edge equations pass, including an asymmetric-window fixture.
- Equal timeline deltas produce equal upward movement; below/above clipping is correct.
- One shared semi-transparent band, two lane backgrounds, zero Row receptor lines, and zero Row rings.
- Portrait/landscape DPR1/3 framebuffer pixels prove band extent, icon centroids, canonical icons, and no ring pixels.
- Guard/squat duplicate exactly once per lane; weave/punch lane placement is deterministic.
- GREAT/pulse and miss behavior stays attached to the moving target.
- Flow and both Cut 4×3 snapshots remain unchanged except intentional recipe-routing fixtures outside the renderer.
- Tests, browser tests, pack, QA, audit, commit, and push pass.

## Task 2 — Integrate recipe-aware presentation and Row cue semantics

**Bead:** `aerobeat-web-assembly-hc4.1`  
**Prerequisite:** audited renderer Bead `aerobeat-web-renderer-sal`  
**Owner:** `aerobeat-web-assembly` coder → independent QA → auditor  

**Work:**

- Select layout from exact recipe identity rather than ruleset alone.
- Route both Row recipes to the scrolling Row presentation.
- Route Flow and both Cut recipes to their 4×3 presentations.
- Supply authoritative contract judgement-window milliseconds to the renderer frame without duplicating scoring truth.
- Preserve punch/weave lane identity and expose canonical squat/weave icons for Row while keeping Cut blocked-cell guidance unchanged.
- Keep all existing Play/Test generation, camera, scoring, privacy, cadence, cursor, Preview, atlas, and host compatibility behavior.

**Likely files:**

- `aerobeat-web-assembly/src/index.js`
- `aerobeat-web-assembly/src/session-render-projection.js`
- assembly focused validators and browser matrices
- assembly README

**Acceptance:**

- Exact five-variant assertion proves Flow 4×3, both Rows scrolling lanes, and both Cuts 4×3.
- Semantic versus spatial scoring identities remain unchanged while sharing Row visual layout.
- Every Row cue receives deterministic canonical icon/lane/two-hand semantics.
- Existing judgement boundaries remain inclusive at `-180`, center, `+180`; miss commits after the late edge.
- Test remains audio-only, hit-first, unscored, and camera/CV/input/cursor-free.
- Direct and real iframe portrait/landscape DPR1/3 exercise both Rows and regression-check all 4×3 variants.
- Tests, browser/live gates, QA, audit, commit, and push pass.

## Task 3 — Integrated QA, deterministic release, and physical handoff

**Bead:** `aerobeat-web-assembly-hc4.2`  
**Depends on:** `aerobeat-web-assembly-hc4.1` and audited renderer Bead `aerobeat-web-renderer-sal`  
**Owner:** assembly coordination  

**Work:**

- Run independent owner and integrated QA/audit.
- Verify real and synthetic feedback while Row targets move.
- Re-run full shell/privacy/cadence/countdown/cursor/Preview/direct/iframe matrices.
- Build the deterministic next assembly release after `0.0.25`; compare two raw releases and two dry packs.
- Update active/parent plans, README, Beads, and a focused phone handoff.
- Keep the existing `dev:tailscale` server running.

**Acceptance:**

- All owner and assembly gates pass.
- Pixel evidence proves Row motion, band geometry/alpha, clipping, no rings, canonical cue icons, and 4×3 non-regression.
- Release and pack reproduce byte-for-byte with exact evidence.
- Git and Dolt states are pushed; implementation/release Beads close only after independent audit.
- Derrick receives a physical test checklist; automated evidence does not claim a human pass.
- No production Boxing winner is selected or promoted.

---

## Required Validation Matrix

### Row geometry

- Both Row variants start fully below, move monotonically upward, cross the upper-quarter success band, and exit fully above.
- Motion is timeline-derived and linear, not frame-count-derived or eased.
- Band pixel height equals scroll velocity × 360 ms at current authoritative defaults.
- Early and late band edges map to exact inclusive gameplay boundaries.
- Resize, DPR, context loss, reconnect, pause, and Test resume preserve geometry.

### Cue semantics

- Punch and weave cues select the correct lane and canonical icon.
- Guard and squat produce two aspect-preserving lane copies.
- No Row cue falls back to a 4×3 hatch.
- No Row target emits an approach ring or old receptor line.
- Judged cues continue moving while existing GREAT/pulse/fade semantics run.

### Non-regression

- Flow remains 4×3 with selected directional/directionless assets and rings.
- Semantic Cut and Spatial Cut remain 4×3 Boxing experiments.
- Gameplay timing/scoring contracts do not change.
- Start/Test/menu/restart, audio/camera leases, Preview, privacy, cadence, countdown, and cursors remain green.
- No production Boxing winner.

---

## Risks and Mitigations

- **Large truthful band on phones:** keep size mathematically tied to velocity/window; expose only speed authority and bounded alpha/location tokens, then physically evaluate.
- **Recipe/ruleset conflation:** add an exact five-variant mapping test before changing renderer presentation.
- **Obstacle semantic loss:** explicitly project Row squat/weave icons while retaining Cut blocked-cell hatches.
- **Stretched two-hand icons:** duplicate one square icon per lane rather than spanning/stretching one mask.
- **Feedback lifetime versus viewport travel:** preserve deterministic 350 ms feedback as approved; do not extend scoring or retention to force offscreen travel.
- **Frame-rate drift:** derive position only from authoritative timeline and center timestamp.
- **Accidental winner selection:** keep all Boxing options experimental and leaderless throughout UI, docs, release, and handoff.

---

## Approval Gate

Implementation starts only after Derrick approves this plan shape. Approval authorizes the linked renderer → assembly → QA → audit → deterministic release workflow while keeping the existing secure server running and preserving the no-Boxing-winner boundary.
