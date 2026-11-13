# Wii Channel — AeroBeat home screen comp

## Direction

A bright, soft, white-plastic living-room menu in the spirit of 2006–2010 motion-control consoles: big rounded slabs with real thickness, generous gaps, gentle shadows, calm grey-white light. It borrows what that era got right for pointing from the sofa (huge forgiving targets, one obvious highlight, friendly copy) and pushes it from "sleepy console" to "warm-up room": the playlist of the day is a saturated sky-blue channel that quietly beats at 120 BPM, and the two wrists are colour-coded so the whole interaction reads as a two-handed gesture.

**The one memorable idea: "two hands, one ring".** Each wrist has its own colour (left Sky, right Tangerine). When both wrists land on a target, two thick half-rings — one in each hand's colour — grow up the left and right sides of the target from the bottom and clasp together at the top. The moment they meet is the selection: a white clap burst and a physical pop. It is literally the selection rule drawn as a high-five, and it is readable from across a living room because it is a 16 px coloured stroke wrapping the whole target. Everything else stays quiet white plastic so the ring owns the colour.

## Palette

| Name | Hex | Role |
|---|---|---|
| Cloud | `#F4F7FA` | Wall, the room's light; slabs are a touch whiter (`#F7F9FB`) |
| Mist | `#DDE4EB` | Shelf band; the library slab is a lighter tint (`#E3E9EF`) |
| Pebble | `#667384` | Secondary text (song counts, headings) |
| Slate | `#2E3A48` | Primary text, icon ink |
| Sky | `#1696E0` | Left wrist, hero channel face, left half-ring |
| Tangerine | `#FF8A1E` | Right wrist, right half-ring, song-count chip energy |

Light and shadow give the white plastic its greys; no other greys are introduced.

## Type

**M PLUS Rounded 1c** (OFL), two weights only.
- ExtraBold 800: playlist names and the hero title. Rounded terminals echo the rounded slabs and read friendly, not technical; the heavy weight survives 3 m.
- Medium 500: headings, song counts, instruction line, button words.

Scale (on-screen px at 1600×1000): hero title 88, rec and library names 40–42, song counts 28–34, headings 32, instruction 30, minimum 28. Sentence case everywhere; no eyebrows, no all caps.

## Layout (screen px, 1600×1000)

```
 x:80                              960   1040                     1520
 y:16  Today's playlist
 y:100 +----------------------------------+  (oo) Both hands on   ( = )
       | white bezel                      |       a tile, then hold ( More)
       |  +----------------------------+  |                       130 round
       |  | ((cover))    Silver        |  |                       y:100-230
       |  |  floating    Songs         |  |  +----------------------+ y:330
       |  |  card,       20 songs      |  |  | [lens] Library       |
       |  |  members     by SilverH06  |  |  |   Search, songs and  |
       |  |  fanned                    |  |  |   your own playlists |
       |  +----------------------------+  |  +----------------------+
 y:600 +----------------------------------+  hero 880x500  library 480x270
 y:630 ~~~~~~~~~~~~~~~~~ Mist shelf band begins (wall) ~~~~~~~~~~~~~~~~~~~
 y:650  Picked for you
 y:700 +-------------+    +-------------+    +-------------+
       |[cvr] Linkin |    |[2x2] Mega   |    |[2x2] Game   |   rec-1..3
       |      Park   |    |      Man    |    |      Grumps |   424x250 each
       |  13 songs   |    |  10 songs   |    |  5 songs    |
 y:950 +-------------+    +-------------+    +-------------+
```

Text is left-aligned inside tiles. The hero is the largest object and sits top-left, where reading starts. Smallest gap between targets is 80 px (hero to library); the rec row has 84 px gaps; everything else is 100 px. The hover lift (about 3% bigger on screen) never closes a gap below 60 px.

## Materials and lighting

- Slabs: procedural rounded-rectangle meshes with real depth (16–42 px) and a quarter-round front bevel. Shaded by a small custom vertex-lit plastic shader: a warm key light from the upper left, a cool sky/floor hemisphere, a Blinn highlight weighted toward the bevels, and a faint rim. It is normalised so a face pointing at the camera shows its exact base colour, which keeps the printed faces seamless with the plastic around them.
- Faces: cover art and text are printed into a canvas and placed on the flat front of each slab, alpha-tested rather than blended. Cover colours stay true.
- Hero: a separate thick cover card floats in front of the Sky face, with member covers fanned behind it, so the camera sway produces real parallax.
- Shadows: soft blurred textures on the wall behind each slab. They drift down-right, grow and lighten as a slab lifts, so lift reads as height.
- Wall: the clear colour is Cloud; a Mist shelf band with a white lit lip sits behind the recommended row.

## Motion

- One page-load moment: the six tiles rise out of the wall in reading order with a slight overshoot.
- Ambient (sparing, attention only): the hero's cover card thumps toward the athlete on every beat at 120 BPM and leaves a white rounded-square ripple. The camera sways with the hands for parallax. Nothing else moves on its own. Reduced motion turns both off.
- Hover: magnet. One wrist on a tile → the slab lifts toward the camera on a bouncy spring, leans its touched edge toward the wrist, and a soft halo in that wrist's colour blooms behind it.
- Arming: press. Both wrists → the slab sinks back flat as if pressed by two palms. A faint grey track appears around it, and the two coloured half-rings grow along it from the bottom centre up each side. The leading tip of each is a white bead in that hand's colour.
- Selected: clasp. The beads meet at the top centre, the closed ring holds for a beat, then swells outward and fades. Sparks in both hand colours fly up from the meeting point and the slab pops forward. The instruction line changes to "Opening" plus the name. For the hero, after that beat: the other tiles slide off (recs down, library and More right), a Sky flood spreads across the wall from the hero, the hero channel flies forward and centres, and its four member covers deal out into a row below it. The playlist is opening.

## Wrist markers

Chunky round "pucks": white core, thick Sky (left) or Tangerine (right) band, a Slate ring and an outer white ring, with a soft drop shadow. The white–Slate pair keeps them visible on white plastic, on the Sky face and the Sky flood, and on any cover. Drawn in front of everything, without depth testing.

## Plan review against the brief and the skill

- *First draft* had a brand wordmark top-left and a "Start" CTA pill on the hero. Cut both: the wordmark spent prime top-row space on nothing the athlete acts on, and a pill inside the hero would read as a seventh button. Replaced with plain sentence-case headings ("Today's playlist", "Picked for you") that say what the content is.
- *First draft* hero face was a sky-to-navy gradient. That is the "gradient wash as decoration" default. Changed to a flat Sky face whose only pattern is the beat ripple, which carries meaning (rhythm).
- *First draft* had six equal channel tiles in a 3×2 grid (closest to the Wii Menu). Replaced with one dominant hero plus a row of three, because the brief says the playlist of the day is the most important thing and a first-session athlete should not have to choose.
- *First draft* used one rounded-card style for all six targets — the SaaS card kit. Now each target type has its own form by hierarchy: hero = thick channel box with a bezel and floating cover; recs = slimmer capsules with inset covers; library = grey recessed Mist slab, quieter; more = a round pebble, the reusable design-language piece.
- Wii-literal risk: a grid of identical channel boxes and a clock bar would be a copy. Kept only the spirit (white plastic, bottom shelf with a round corner button) and made the grid asymmetric around one dominant hero.
- "Sleepy" risk: white + grey menus feel like a waiting room. Energy comes from the saturated hero, the two wrist colours, the beat ripple and springy physics — one accent family, not decoration everywhere.
- Avoided tells: no all-caps eyebrow, no middle-dot meta strings, no em-dash labels, no near-black, no monospace, no arrows on text. Font chosen for a reason (rounded terminals match the slab language).
- The instruction line teaches the mechanic with the two wrist colours shown as two overlapping dots, so a first-time athlete learns that colour = hand before they ever see the ring.

## Capture–critique log

All rounds used `node design/style-comps/_shared/capture.mjs wii-channel` from the repository root. From round 3 on, I also captured three extra states the shared script does not cover (one-wrist hover on a rec, arming and selecting `more`, and the hero opening at 1.9 s) with a throwaway Playwright script in `/tmp`. Those images are for review only and are not in the folder.

### Round 1 — exit 0

- **Idle:** the direction landed: white plastic slabs, a Sky hero, soft shadows, friendly rounded type. Problems: the library slab rendered a dull blue-grey and the rec slabs were grey too, so the screen looked damp rather than bright. PlayCanvas's lit material was darkening the white plastic, and the canvas-printed faces did not match the lit plastic around them.
- **Arming:** broken. The shot showed the hero already mid-opening with no ring. Instrumenting the capture showed the cause: under SwiftShader each frame took about 120 ms, so the 520 ms hold had already finished before the 280 ms wait plus a 1 s screenshot. On a laptop GPU it would be fine, but the brief asks that it not be heavy.
- **Selected:** the hero flies forward and members deal out, but the confirmation itself (the clasp) was never seen. Members went off the bottom edge.
- **Changes:** profiled each layer under SwiftShader. Replaced the lit StandardMaterial with a small vertex-lit plastic shader; replaced the full-screen blended wall texture with the clear colour plus an opaque shelf band; made shadows and halos hollow frames (their centres are always hidden behind a slab); hid halos when not hovered; turned off MSAA. Frame time went from about 120 ms to about 27 ms. Delayed the hero opening by 0.32 s so the clasp reads first. Gave the wrist pucks an outer white ring.

### Round 2 — exit 0

- **Idle:** much cleaner, but rec slabs still read light grey against the printed faces (two different whites, a visible seam). The member fan behind the cover was too tall and peeked above the bezel. The "Today's playlist" heading sat a little tight to the hero.
- **Arming:** works and reads from across the room. Blue and orange half-rings wrap the whole hero, beads near the top. It looks like a two-handed gesture, which is the idea. Flaw: the shot actually caught the moment just after the clasp, because frames were still slow during arming.
- **Selected:** the hero opening was still sliding off the top of the frame; the member row clipped at the bottom. The instruction text "Opening Silver Songs" overflowed into the More button.
- **Changes:** normalised the plastic shader so a camera-facing face equals its base colour, and printed each face's background inside the bevel line, so faces and plastic match. Switched faces, covers and members to an alpha-tested opaque material (no blending) and dropped texture anisotropy. Frame time is now about 20 ms, the same as the bare smoke test. Re-laid the top band (hero 880×500 at y 100, library 480×270, heading moved up). Re-framed the opening so the hero lands centred with the member row fully in frame. Shortened the selection text to two lines ("Opening" / name). Made the beat visible: the cover card thumps on each beat as well as rippling.

### Round 3 — exit 0

- **Idle:** this is the comp. Bright, soft and friendly, with obvious depth. The hero is clearly the thing to do. The rec row and the quieter Mist library read as a clear hierarchy. The More pebble reads as a reusable piece.
- **Arming (hero):** the rings and beads are big enough to read at 3 m. But the half-completed state does not show how far is left; you only see the coloured part.
- **Hover (extra shot):** the slab lifts and leans toward the wrist, and the halo takes the colour of the touching hand (the right wrist gave a Tangerine glow), which teaches colour = hand. But the hollow halo frame showed a hard pale rectangle edge where the leaning slab no longer covered it.
- **Arming `more` (extra shot):** the ring wraps the pebble nicely. The two pucks almost cover the More icon, which is expected at 130 px.
- **Selected (hero):** the opening reads as "the playlist is opening": Sky flood, centred channel, member covers dealt into a row.
- **Changes:** added a faint grey full-length track under the half-rings, so arming shows progress against the whole loop. Made the halo a full quad again (it only renders while hovered, so the cost is small). Moved the instruction line slightly left, away from More.

### Round 4 — exit 0

- **Arming:** the track sits under the coloured rings. It is subtle at mid-hold on the hero, but clearly visible on smaller targets.
- **Hover:** the halo edge artefact is gone. The tilt now reads as a physical lean.
- **Selected `more` (extra shot):** the clasp vanished too fast; at 500 ms after arming began there was nothing left to see. Since the non-hero targets have no next screen, the clasp is the whole confirmation and has to linger.
- **Changes:** the closed ring now holds at full strength for 0.3 s before it swells and fades (0.8 s total). The clap sparks are bigger (28 px) and live longer (0.85 s). Removed the debug hook and some dead code.

### Round 5 (final) — exit 0

- **Idle / arming / selected:** stable. The `more` selection now shows the swelling two-colour ring and sparks next to "Opening / more options". The hero selection keeps a few fading sparks over the opening.
- **Left as is:** see weakest points in the report. The biggest are the busy, saturated cover art competing with the comp's own colour, and the half-ring reading as one ring at a glance (the "two hands" idea needs motion to land).
