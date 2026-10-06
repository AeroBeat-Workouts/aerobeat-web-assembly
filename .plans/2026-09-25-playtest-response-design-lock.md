# AeroBeat Playtest Response — Design Lock + Execution Plan

> **STATUS (2026-09-25): Design locked with Derrick. Ready to create Beads + start Batch 1. Awaiting green light.**
> Source: Derrick's 18-item playtest report on raw 0.0.73. The mid-game T-pose pause (#18) is already confirmed fixed.

## Context

Derrick playtested 0.0.73 (Boxing + Flow) and reported 18 items: bugs, features, and design questions. We discussed each; the design is now locked below. This plan turns that into executable batches.

**Locked scope rule (Derrick):** there is no BeatSaver song we refuse to support. When a song fails, we fix our converter to support it — other BeatSaver clients (e.g. Beat Bat) already play these.

---

## Locked design decisions

### Colliders (Flow + Boxing) — replaces the fixed good/bad timing windows
The hittable region becomes a **collider volume** around the equipment. A beat is hittable while it's inside that volume; once it's behind you it's a miss. Controls (per mode):

| Control | Flow name | Boxing name | Meaning |
|---------|-----------|-------------|---------|
| Visible | `saber collider visible` | `glove collider visible` | Draw the collider volume (toggle) |
| Scale | `saber collider scale` | `glove collider scale` | Overall width/height of the volume |
| Depth + | `saber collider depth +` | `glove collider depth +` | Extend the face **forward** (away from you) → hit beats farther out |
| Depth − | `saber collider depth −` | `glove collider depth −` | Extend the face **backward** (toward you) → hit beats behind the equipment visual (webcam-delay compensation) |

- Depth is a multiplier: **1 = no extension** (default), **2 = 2× default**.
- Both `depth +` and `depth −` are independently settable.
- Settable in the pre-play menu; Derrick tunes, then we lock in defaults.

### "Visible = hittable" + miss feedback
- The **bad** timing area is removed. A beat is hittable while visible (inside the collider volume).
- Once a beat is truly behind you (out of view), it's a **miss**.
- **Miss messages** no longer spawn at the beat (which is behind you). They spawn at **two fixed 3D world-space spots** — one left-hand, one right-hand — in front of the player at chest height.
- These miss spots are **3D world-space** elements, so they are **not** affected by UI scale.

### UI scale (DOM only)
- A manual `ui scale` setting (e.g. 1.0× / 1.25× / 1.5× / 2.0×), persisted.
- Scales **DOM elements only**: menus, panels, score/HUD text.
- Does **NOT** scale 3D world-space elements (beats, markers, sabers, great/miss messages).
- Implement via a single CSS scale factor (root font-size + CSS custom properties), decoupled from physical screen size.
- Build 3–4 presets so Derrick can test (glasses off, standing at distance) and decide if "large is the default."

### Camera (per mode)
- Separate camera pose for **Flow** and **Boxing** (currently one shared pose: position `(0.05, 1, 5)`, rotation `(0,0,0)`, FOV 48).
- Expose **height (y), depth (z), pitch (tilt-down), yaw (pan)** as gameplay settings, numeric inputs + live preview.
- Derrick tunes per mode, then we lock in the new defaults.
- Do the camera reposition first; the "beats drop to chest-height as they approach" trajectory change is a later, larger step only if needed.

### Difficulty tags
- Colored circles, right of each song: **green**=Easy, **orange**=Medium/Normal, **red**=Hard, **deep red**=Expert, **black**=ExpertPlus.
- One shared difficulty-tag component, used in **both** the downloads list and the downloaded list.
- Pre-download source: BeatSaver API `GET /api/maps/id/{mapId}` → `versions[].diffs[].difficulty` (exact difficulties available without downloading).

### Conversion support (never refuse a song)
- **Obstacles out of bounds** (`content-authoring/beatmap.js:204`): our converter hard-rejects geometry outside a 4-wide × 5-tall grid. Fix: correctly interpret the Beat Saber coordinate space, and **clip to the grid** for genuinely out-of-range geometry (song loads, obstacle visible in-bounds).
- **Flow interval** (`gameplay/session-coordinator.js:1855`): a flow interval must start at center + positive duration. Fix the conversion mapping (center = start, positive duration); drop only genuinely zero-length bursts.
- Action: download + inspect **Unshatter**, **Golden**, **Rumi/Jinu – Free** to find the exact offending data, then fix.

---

## Batches

### Batch 1 — Bugs (gameplay-critical, no design ambiguity)
| Bead | Item | Fix |
|------|------|-----|
| B1.1 | #10/#12 | Boxing tracking-loss must **not** pause gameplay (same F4 anchor-freeze / no-pause treatment Flow got). Markers freeze, beats continue, music continues. |
| B1.2 | #2 | Song ends at **track end**, not the instant the last beat passes. |
| B1.3 | #3 | Obstacles culled early — fix the runtime cull window (likely shared root with B1.2). |
| B1.4 | #7 | Persist the gameplay mode (Boxing/Flow) across song/difficulty selection. |
| B1.5 | #9/#16 | Conversion: obstacle clip-to-grid (Unshatter, Golden load). |
| B1.6 | #15 | Conversion: flow interval mapping fix (Rumi/Jinu loads). |

### Batch 2 — Tuning + core feel
| Bead | Item | Scope |
|------|------|-------|
| B2.1 | #13/#1 | Collider visible + scale + depth(+/-) for Flow and Boxing; pre-play controls. |
| B2.2 | #4 (design) | Remove bad-timing area; visible=hittable; miss messages at two fixed 3D spots. |
| B2.3 | #5 | Per-mode camera (height/depth/pitch/yaw) + live preview; lock new defaults. |
| B2.4 | #6 | UI scale (DOM) setting + 3–4 presets for legibility testing. |

### Batch 3 — Content/UX features
| Bead | Item | Scope |
|------|------|-------|
| B3.1 | #8 | Difficulty tags (colored circles) in downloads + downloaded lists (API-sourced). |
| B3.2 | #4 | Boxing `any` beats optional opposite-lane (boolean, **default ON**); same option for uppercuts. Hooks stay opposite (no change). |
| B3.3 | #11 | Guard spacing slider (0–2, 1=default, 0=dead-center); guard hit spawns **two** corpses; guard target color = hand color. |
| B3.4 | #17 | Force-calibrate button in pause/gameplay menu (calibrate on demand; auto-cal at start only if never calibrated; keep grid across songs). |

---

## Verification
- Unit suites per repo (content-authoring, gameplay, input, renderer, assembly) green before each raw.
- Conversion: the three previously-failing songs (Unshatter, Golden, Rumi/Jinu) load and play.
- Physical playtest of each batch by Derrick before we lock defaults (camera, colliders, UI scale).

## Risks / notes
- **B2.2 (visible=hittable)** is the biggest behavioral change — it replaces the fixed good/bad windows with a spatial collider model. It interacts directly with B2.1 (collider depth). Do them together.
- **B1.1** touches the safety/pause path in the gameplay coordinator — must not regress the Flow no-pause behavior or the mid-game T-pose gate (0.0.73).
- Pre-existing unrelated failure: `aerobeat-web-input/scripts/validate-eight-way-flow-direction.js` (`equipment_poses_invalid`) — fails independent of this work; track separately.
- Camera/collider/UI-scale defaults are **tuning** — ship with sensible defaults, then Derrick locks the real values after physical playtest.
