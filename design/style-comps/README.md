# AeroBeat home-screen style comps

Six versions of the same home screen, each in a different visual direction, built so Derrick can compare them side by side and pick a direction for AeroBeat's design language. These are disposable explorations, not product code.

## The product

AeroBeat is a fitness rhythm game played **standing up in a living room, using the whole body**. A webcam tracks the athlete's pose. In menus, the athlete's two **wrists** are the pointer. Mouse and touch also work, but wrists come first.

The typical first session: open the URL, allow the camera, stand back from the screen, and get into today's workout or a recommended playlist within a few seconds. Search, the library and custom playlists exist for regular athletes and are secondary.

The athlete stands roughly 2–3 m from a laptop or TV. They are about to exercise, so the screen should feel energising and welcoming, not like a dashboard.

## How selection works (already decided)

- Each wrist is a disc. A wrist is "on" a target when its disc overlaps the target at all.
- One wrist on a target **hovers** it.
- **Both wrists** on the same target **arm** it; after about half a second it **selects**.
- After selecting, both wrists must leave the target before it can fire again.

This is implemented once in `_shared/hands.mjs`. Every comp uses it **unchanged**, so comps differ only in how they look and feel.

## The screen every comp builds

One home screen, rendered entirely in a **PlayCanvas world-space scene**. No HTML or CSS interface at all: every label, button and panel is a 3D object in the scene (text is drawn into a canvas texture on a plane, or by another in-scene method). This is deliberate: the game is heading for world-space UI so the same UI can later work in WebXR and on other devices.

Exactly six targets, no more. Interactables are a budget because every one costs arm movement and accuracy.

| Target name (register with exactly this) | What it is |
|---|---|
| `hero` | **Playlist of the day.** The most important thing on screen. Shows its cover, its name, and its song count. |
| `rec-1`, `rec-2`, `rec-3` | Three recommended playlists, from `content.recommended`. Name and cover (or member covers if it has none). |
| `library` | Entry to the athlete's library, search and custom playlists. Secondary; quieter than the others. |
| `more` | The one recurring control for settings and less common options. Smallest acceptable target; it will appear on every screen in the finished game, so treat it as a piece of the design language. |

Content comes from `_shared/content.mjs` (real BeatSaver playlists and cover images). Use it as given so every comp shows identical content. Resolve image paths with `coverUrl()`.

### Required states

Every target needs three visible states, designed in the comp's own style:

1. **Hover** — one wrist on it.
2. **Arming** — both wrists on it, with progress from 0 to 1 shown clearly (the comp's own equivalent of a filling ring). The athlete must be able to see the hold completing from across the room.
3. **Selected** — a clear confirmation moment. For `hero`, show the beginning of a transition into the playlist (the next screen does not exist yet; a convincing start is enough).

The comp also draws **two wrist markers** in its own style, positioned from `hands.onState(state => state.wrists)` (screen pixels; project them into the scene, for example with `camera.screenToWorld` at a chosen depth). They must stay visible against every part of the screen.

### Sizes and spacing

- Design for a 1600×1000 viewport seen from 2–3 m away.
- Every target's on-screen rectangle at least 180 px on its short side; `more` may go down to 120 px.
- At least 60 px of empty space between targets, so a wrist disc cannot easily overlap two at once.
- Text you need to read at a distance: at least about 28 px tall on screen.

## Shared files (read-only — do not edit anything in `_shared/`)

- `_shared/playcanvas.min.mjs` — PlayCanvas 2.21.4, the same version the game renderer uses. MIT licence in `_shared/PLAYCANVAS-LICENSE`.
- `_shared/hands.mjs` — two-wrist selection. Read its header. `createHands(app, cameraEntity)`, then `hands.register(name, entity, { onHover, onArm, onSelect, inset })`. `inset` shrinks the hit area inside the visual bounds (useful for glows and halos).
- `_shared/content.mjs` — home-screen content and `coverUrl()`.
- `_shared/capture.mjs` — the screenshot script. Do not write your own.
- `_shared/frontend-design-SKILL.md` — Anthropic's frontend-design skill (Apache 2.0). Its process applies here even though the medium is 3D.
- `_smoke/index.html` — a minimal working example of the setup: app, camera, `createHands`, a registered `hero`, a texture from `coverUrl()`. Start from its structure.

## Process

Follow the frontend-design skill's process:

1. **Plan first.** Before writing scene code, write `DESIGN.md` in your comp folder: the direction in a few sentences, a palette of 4–6 named hex colours, type choices and roles, an ASCII layout sketch, materials and lighting, the motion idea, and how hover / arming / selected look. Then review the plan against this brief and against the skill's list of generic AI-design defaults; record what you changed and why.
2. **Build** `index.html` in your comp folder. Signal readiness by setting `window.__compReady = true` once covers and fonts have loaded and the scene is presentable.
3. **Capture and critique.** Run, from the repository root:

   ```
   node design/style-comps/_shared/capture.mjs <your-folder>
   ```

   It must exit 0. It writes `shot-idle.png`, `shot-arming.png` and `shot-selected.png` into your folder. Look at all three images, critique them honestly against the brief and the skill, fix the biggest problems, and capture again. Do at least three capture–critique rounds. Log each round's critique and changes at the bottom of `DESIGN.md`.

## Rules

- Commit to your direction. A timid comp teaches us nothing. "Spend your boldness in one place."
- Avoid the generated-page tells the skill lists, especially: all-caps eyebrow labels, `A · B · C` meta strings, `WORD — fragment` labels, one identical card style on everything, default font families used without a reason.
- Fonts: you may download an OFL-licensed font into your comp folder and load it with `FontFace` before drawing text. Record its source and licence in `ASSETS.md`.
- Other assets: prefer procedural geometry, materials and shaders. You may download CC0 assets (for example Poly Haven HDRIs or textures); record source and licence in `ASSETS.md`. No copyrighted game art, logos or characters other than the playlist covers provided.
- Performance: it should run smoothly on an ordinary laptop GPU. Screenshots are taken with software rendering (SwiftShader), so avoid effects so heavy that a frame takes seconds.
- Work only inside your own comp folder. Do not run `git add`, `git commit` or any other git command that changes the repository; the coordinator integrates.

## What to report back

- Files you created.
- The final capture command's result (exit code and the target list it printed).
- Three sentences describing the direction and its single memorable idea.
- The comp's weakest points, honestly.
