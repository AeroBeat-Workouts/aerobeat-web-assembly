# Dreamcast water — design plan

## Direction

You are standing on a white-sand beach, looking out over a bright turquoise lagoon under a saturated blue sky. The menu is made of things that live there: the playlist of the day is a glass billboard on a floating raft, the three recommendations are channel buoys carrying round porthole signs, the library is a driftwood signpost on the sand, and the recurring `more` control is a lifebuoy hung on a post. Everything bobs gently. The look is late-90s console: bold readable shapes, flat toon-shaded geometry, billboard clouds, chunky outlined type, punchy colour.

**The one memorable idea: hold to fill.** When both wrists are on a target, lagoon water rises inside it, bottom to top, with a white foam line and caustics. A target that is full of water fires. From across the room the athlete reads progress the same way they read a glass being filled. On selection the raft splashes and the camera swoops down toward it, as if diving into the playlist.

## Palette

| Name | Hex | Role |
|---|---|---|
| Lagoon | `#19D3C5` | Shallow water, the fill colour while arming |
| Deep reef | `#0B5FD9` | Far water, sky zenith blend |
| Holiday sky | `#3AA8FF` | Sky body |
| Coral sand | `#FFF4DA` | Beach, glass tint, sign enamel |
| Sunshine | `#FFD23F` | Hover/arming accent, sun, the "today" sticker |
| Buoy coral | `#FF5A4E` | Buoys, lifebuoy segments, splash accents |
| Harbour navy | `#0A2A6B` | Type outlines and ink (a saturated navy, not tinted black) |

## Type

- **Lilita One** (OFL) — display. Playlist names, `Library`, `More`. A heavy rounded slab with a toy-like, late-90s arcade feel. Set white with a thick navy stroke and a hard navy drop shadow, the way that era outlined title text so it survives any background.
- **M PLUS Rounded 1c ExtraBold** (OFL) — secondary lines: song counts, owner, library sub-line. Rounded terminals echo the toy plastic of the buoys. Sentence case throughout.
- Scale on screen (1600×1000): hero title 80 px, rec names 34 px, library 46 px, secondary 26–34 px. Nothing needed at distance is under 28 px except the optional owner credit.

## Layout (1600×1000, screen pixels)

```
y   0 +----------------------------------------------------------------+
      |  sky gradient          billboard clouds       ( sun )          |
  220 |  .-----------------------.   (o)      (o)      (o)            |
      |  | [cover]  Silver      |   rec-1    rec-2    rec-3            |
  282 |==| [ +sun ] Songs       |==  sign     sign     sign  == horizon|
      |  |          20 songs    |    |        |        |               |
      |  '-----------------------'   [buoy]   [buoy]   [buoy] ~waterline 600
  670 |   ===== raft pontoon =====      ~ ripples ~                     |
      |            open lagoon, caustics, sun glitter                  |
  740 |  .-library plank--.                                .-( O )-.     |
      |  | Library        |                                | More  |     |
      |  '-------+--------'  ~~~~ foam line ~~~~           '---+---'     |
 1000 +----white sand beach -----------------------------------+-------+
```

- `hero` x 80–700, y 220–670. `rec-1..3` 220 px wide each at x 780/1060/1340, y 220–620. `library` x 90–420, y 740–965. `more` ~160×190 at x 1400–1560, y 770–965.
- Gaps: hero→rec-1 80 px, recs 60 px apart, hero→library 70 px, rec-3→more 150 px.
- Alignment: objects sit on the water/sand where they physically float or stand, so their bottoms follow perspective. The hero is left and largest; the eye travels left → right along the buoys, and the beach row is quieter.

## Materials and lighting

- All custom shaders (PlayCanvas `ShaderMaterial`), unlit or toon-banded. No PBR, no shadows maps, no post-processing.
- **Water**: one opaque plane. Colour from a depth proxy: wet sand → pale shallows → lagoon → deep reef → horizon haze. Two cheap sine-web caustic layers, a sun-glitter streak from an analytic wave normal, an animated white foam line at the shore.
- **Sky**: a gradient plane with an analytic sun disc and halo; four flat painted billboard clouds drifting slowly.
- **Geometry**: 3-band toon shading with a sky-blue rim light (pontoon floats, buoy bodies, posts).
- **Signs/panels**: canvas textures on quads. The hero is frosted glass (white tint, thick white frame).
- **Wrist markers**: two beach balls with a navy outline, screen-locked on a top layer, spinning slowly. Navy outline + saturated wedges stay visible on sand, sky, water and glass.

## Motion

- One orchestrated entrance: the targets pop up out of the water in sequence (≈0.9 s total).
- Ambient: water, caustics, foam, bobbing, cloud drift. Bobbing is small (≈4 px) so hit areas stay steady.
- **Hover** (one wrist): the target lifts higher out of the water as if buoyant, its frame warms to sunshine yellow with a glint sweeping across, and a sunshine ripple ring appears on the water around its base.
- **Arming** (both wrists): lagoon water fills the target bottom-to-top with a wavy foam line; progress = water level. The ripple ring on the water tightens toward the base at the same time. The two readings agree.
- **Selected**: the target flashes white, a splash of droplets bursts from its waterline with an expanding foam crown. For `hero`, the camera swoops down toward the raft and a lagoon wash rises over the screen: the start of diving into the playlist. Other targets dunk and pop back up.

## Review against the brief and the skill's generic defaults

- *Generic first draft I would have produced*: six identical rounded glass cards floating over a water background, an all-caps "PLAYLIST OF THE DAY" eyebrow above the hero, a circular progress ring on every card. **Changed**: each target is a different object from the place (raft billboard, buoys, driftwood sign, lifebuoy), so hierarchy comes from object type and size, not one card style. Progress is water level, not a ring.
- *Eyebrow label*: replaced by a sunshine "Today's pick" sticker slapped on the cover corner in sentence case — it's information (why this is the hero), it lives on the object.
- *Meta strings*: no `A · B · C`. Hero secondary line is just "20 songs".
- *Fonts*: rejected the default sans; Lilita One + M PLUS Rounded chosen for the toy/arcade era read.
- *Palette*: not cream/terracotta, not black + acid accent. Saturated blues and turquoise with sunshine and coral, which is the reference era's palette.
- *Boldness in one place*: the water fill is the bold idea. The beach row (library, more) is deliberately muted: driftwood and a small lifebuoy.
- *Brief checks*: exactly six targets with the required names; all ≥180 px short side except `more` (≥120); ≥60 px gaps; text ≥28 px; no HTML UI; covers via `coverUrl()`; wrist markers from `hands.onState`.

## Changes from plan made while building

- The library sign grew to 340×186 and its sub-line breaks over two lines ("Search and / your playlists") to keep 30 px type inside a sign that reads as driftwood, not a banner.
- Recommendation names wider than the sign break onto two lines instead of shrinking below 32 px.
- Each target registers only its readable face (sign, lifebuoy) as the hit entity. The raft, buoys and posts are scenery beside it. Otherwise their 3D depth inflated the projected hit rectangles and broke the 60 px gaps.
- Sky and caustics are baked into textures at startup (see round 2).

## Capture–critique log

Every round used `node design/style-comps/_shared/capture.mjs dreamcast-water` from the repository root, and every run exited 0.

### Round 1

*Critique.* The direction landed: punchy sky, turquoise lagoon, white sand, toon buoys. But the **arming shot showed the post-select flash**, not a half-full sign, so the main idea was invisible. Measuring showed why. SwiftShader took 40–70 ms per frame and queued frames, so a Playwright screenshot reached the browser about 850 ms after arming began, which is past HOLD_MS (520). Other problems:
- The hero raft spilled off the left edge.
- Hit rectangles were much wider than the signs (rec-3's ran past the screen edge). Targets were rotated to face the pitched camera, which made their AABBs deep.
- A half-cut cloud sat at the top edge.
- The sun rays had hard ends.

*Changes.*
- Replaced the per-pixel sine caustics and the analytic sky with baked textures: a Voronoi caustic/sparkle texture and a canvas sky.
- Cropped the sky quad to the strip above the horizon.
- On software renderers only (detected via `WEBGL_debug_renderer_info`), MSAA is off and rendering is paced to 18 fps, so frames no longer queue. A frame-stamp probe confirmed the arming screenshot now lands about 400 ms into the hold instead of 850 ms.
- Targets stand upright in world space.

### Round 2

*Critique.* Arming now reads well. Water fills the hero sign about halfway, with a white foam line and caustics. The sun ring on the water confirms which target is armed. The hero is fully on screen. Selected was weak, though: the raft just sat there with faint, nearly invisible droplets. The dive had not started by the time the shot was taken. Other problems:
- Recommended signs crowded each other (rec-2 to rec-3 hit gap measured 11 px), still caused by the buoy depth.
- Clouds were clipped by the cropped sky.

*Changes.*
- Droplets are now solid toon drops (white body, lagoon shade, reef keyline) and bigger. There are more of them and they spray toward the camera.
- The camera push starts immediately, and a lagoon wash rises up the screen from about 0.1 s.
- Clouds moved into the visible band.
- Recommendations re-spaced.

### Round 3

*Critique.* Selected is now a real moment. The camera dives toward the raft, droplets fly, and a caustic-lit lagoon wave sweeps up over the bottom of the screen. Remaining problems:
- Hit rectangles still came from the buoy meshes (min gap 11 px).
- "Game Grumps" auto-shrank to about 26 px and its first letter clipped on the tilted sign.
- Under water, the hero's subtitle lost too much contrast.

I also checked hover and arming on the other targets with a private probe (not the shared script): rec-1 hover lifts the sign, warms its frame to sunshine and puts a sun ripple ring around the buoy. Library arming fills the driftwood sign with water. `more` hover lifts the lifebuoy and draws a sun ring on the sand.

*Changes.*
- Hit entity = readable face only. Measured gaps are now 63 px or more.
- Two-line names at 34 px.
- The fill tint is lighter (42% water over the content instead of 62%).
- Gentler sway.

### Round 4

*Critique.* Layout is clean. All six rectangles are at least 180 px on the short side (`more` is 159×183), gaps are at least 63 px, and display text is 30–92 px. The two-line rec names fit, but the song count crowded the second line.

*Changes.*
- Rec signs are taller (324 px). The song count sits at the bottom in reef blue, so the name and the count read as two separate levels.
- Added `prefers-reduced-motion`: no bobbing and no camera dive. The water fill and the wash still play, because they are feedback to the athlete's own action.

### Round 5 (final)

*Critique.*
- **Idle:** reads as a place first and a menu second, which is the brief. The hero is clearly dominant, the buoys form a rhythm, and the beach row is quiet.
- **Arming:** the hero is about 45% full of water, with a foam line clearly visible from across the room.
- **Selected:** the camera mid-dive into the hero, a splash, and the lagoon wash covering the lower half.

What I would still change is in the report's weak points. No further structural changes.
