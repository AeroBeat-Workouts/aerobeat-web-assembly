# Skeuo hardware — design plan

## Direction

AeroBeat as a mid-2000s piece of home audio hardware: a brushed-aluminium faceplate with a chrome-ringed disc deck, glossy jelly keys, a knurled chrome knob and an amber vacuum-fluorescent display (VFD). The athlete stands in front of it like a hi-fi stack in a living room.

The era's interfaces were dense and mouse-sized. This comp keeps the *materials and physics* of that era and throws away the *density*. Every one of the six controls is one large physical object with real travel; all the fine Winamp-style detail (screws, silkscreen, dark LED segments, a grille) lives on the faceplate where it is never a target.

**The one memorable idea:** the playlist of the day is a giant disc deck. The cover art is printed on a disc under a domed glass lid, and the whole deck is one enormous push button. Holding both hands on it presses it in while a ring of 36 amber LEDs around the chrome bezel fills like a power meter. When it fires, the lid lifts away and the disc spins up and rises out of the deck toward the athlete while the rest of the device dims.

> Plan below is the original plan, updated where the build changed it (marked *final:*). The capture–critique log at the bottom records why.

## Palette

| Name | Hex | Role |
|---|---|---|
| Anodised Silver | `#C3C8CF` | Faceplate, library drawer, knob (as metal albedo) |
| Smoked Graphite | `#262B33` | Glossy plastic housings: disc deck, VFD bezels |
| Gumdrop Aqua | `#1F86FF` | Jelly keys for the three recommendations (late-Aqua blue). *final:* rendered as deep blue plastic `#06204F` with internal glow rising to aqua at the bottom edge |
| Filament Amber | `#FFA826` | VFD text, LED meters, arming progress, wrist cores |
| Lamp Black | `#07090C` | Unlit LED segments, VFD glass, recesses (a true near-black for glass, not a page background) |
| Studio Room | `#15181D` | The dark room around the device. *final:* a flat clear colour; the gradient wall was dropped for frame cost |

Amber is the only "signal" colour. Aqua is the only "plastic" colour. Everything else is metal, glass and black.

## Type

- **Saira Semi Condensed** Bold / SemiBold (OFL): silkscreen printing on metal and plastic, the wordmark, key names. Engineered, slightly squared, reads like equipment lettering, sentence case.
- **Doto** (OFL, variable dot-matrix): everything shown on a display — the VFD guidance line, the hero's playlist name and song count. The dot grid is the era signal; it is only used where a real device would have a display.
- Scale (on-screen px): hero name 64, VFD line 40, key names 36, song counts 30, library 64 / 30, More legend 40. Nothing readable is below 28.

## Layout (1600 × 1000)

```
 +--------------------------------------------------------------------------------+
 | o  [AeroBeat badge]   [ VFD: Both hands on a control to press it    ]  More (@) o|  y 40-175
 |                                                                                  |
 |  +----------------------------+   +--------+  +--------+  +--------+            |
 |  |   .------------------.     |   | cover  |  | cover  |  | cover  |            |  y 240-580
 |  |  / ::::LED RING:::::  \    |   |        |  |        |  |        |            |
 |  | |  (  disc + cover  )  |   |   | ▯▯▯▯▯▯ |  | ▯▯▯▯▯▯ |  | ▯▯▯▯▯▯ |            |
 |  | |  (   under glass  )  |   |   | name   |  | name   |  | name   |            |
 |  |  \                    /    |   +--------+  +--------+  +--------+            |
 |  |   '------------------'     |                                                 |
 |  |  [ Silver Songs          ] |   +-------------------------------------------+ |
 |  |  [ 20 songs, picked today] |   |  Library                       [====]      | |  y 650-860
 |  +----------------------------+   +-------------------------------------------+ |
 | o                                                                              o |
 +--------------------------------------------------------------------------------+
   hero x 60-690 y 226-944        keys x 758-1530, 206 wide, 77 gaps, y 244-622
                                  library x 760-1532 y 694-944     more knob at (1448,110) r 60
```

Left-heavy asymmetric layout: the deck is the dominant mass on the left; the right column is a disciplined grid. *final, measured with `targetsOnScreen()` (hit rectangles include perspective growth of raised parts):* hero 652 × 741, keys 212–227 × 389, library 785 × 257, more 132 × 128; smallest gap between any two targets 64 px.

## Materials and lighting

- Procedural studio environment (equirect canvas → `EnvLighting` atlas): dark zenith, a bright softbox band at 25–55° elevation, mid-grey horizon, warm dark floor. Curved bevels therefore get the classic chrome look for free — bright top edge, dark bottom edge — from real reflections, not painted gradients.
- One warm key directional light. *final:* no shadow map and no spot light (SwiftShader frame cost); raised parts cast soft contact-shadow cards that slide and fade as the part travels.
- *final:* large flat faces a real device shows as near-constant colour (faceplate front, deck face, display glass, drawer face, badge plate) are painted once into unlit canvas textures with the falloff, sheen and engraving baked in. Every curved surface stays live PBR so the highlights are real.
- Faceplate: metalness, procedural horizontal brushed streaks (gloss + albedo), anisotropy.
- Chrome: metalness 1, gloss 0.92 (bezels, knob, hub).
- Jelly: pillowed (domed) key mesh, clearcoat 1, high gloss; inner emissive gradient brightest at the bottom edge, like light pooling inside gel.
- Glass dome: shallow ellipsoid cap, low opacity, reflections not faded by opacity — the softbox band shows as a crescent.
- VFD: black glass slab with clearcoat; text is an additive emissive plane in amber.
- All rounded shapes come from one procedural "rounded slab with quarter-round bevel" mesh, so every edge catches light.

## Motion

- One orchestrated power-on: the LED ring sweeps once around the deck and the VFD lights, like a self-test.
- All motion is driven by wall-clock time, so a slow renderer still animates at real speed.
- Everything else moves only in answer to the athlete: travel, spin, LEDs.

## States

| Target | Hover (one wrist) | Arming (both, 0→1) | Selected |
|---|---|---|---|
| `hero` deck | Deck lifts toward you, disc begins to spin, LED ring glows dim | Whole deck presses in; LED ring fills clockwise from 12 o'clock; the top display reads "Hold for Silver Songs" with a 12-segment bar | Ring flashes, the lid lifts away, the disc spins up and rises toward the camera in a ring of amber light, the rest of the device dims, the camera pushes in, the display reads "Loading Silver Songs" with a loading bar |
| `rec-1..3` jelly keys | Key pops forward, inner glow brightens | Key travels in; 8-segment LED meter on the key fills | Key latches down (stays in, like a tape-deck key), meter solid, display reads "Opening Mega Man" |
| `library` drawer | Silkscreen backlights | Drawer slides out toward you; LED strip fills left→right | Drawer fully out, strip solid |
| `more` knob | LED arc dots glow dim | Pointer turns from 7 to 5 o'clock, lighting the arc of 11 dots | Pointer at the end stop, all dots lit, display reads "Opening more options" |

Wrist markers: *final:* glowing orange glass beads in polished chrome bezels with a soft dark halo, floating in front of the device — readable on silver, blue, black and cover art. Diameter matches the 56 px wrist disc. (The first version, amber core + black ring + white rim, read as cartoon eyes.)

## Review against the brief and the generic defaults

- First pass had all three recommended keys in iMac flavours (Bondi, Tangerine, Grape). Changed to one aqua: three colours fought the deck for attention, and "spend boldness in one place" says the deck is the loud thing.
- First pass put a "Playlist of the day" silkscreen eyebrow above the deck. Removed: it is the generic eyebrow tell. The meaning moved into the display copy itself ("20 songs, picked for today").
- First pass used teal-green VFD text on black. That is uncomfortably close to the "near-black + acid green" default; amber VFD is equally period-correct (car stereos, hi-fi decks) and warmer for a workout.
- Avoided: all-caps labels (all copy is sentence case), middle-dot meta strings, em-dash labels, monospace data labels (Doto only where a real display would be), arrows on buttons, identical cards (deck, jelly keys, drawer and knob are four different objects with different materials).
- The fine hardware detail is kept but never interactive, so the target count stays at six.

## Capture–critique log

(rounds appended below)

### Round 1 — first build

Capture: exit 0, six targets on screen.

What worked: it reads instantly as a physical device. The chrome bezel and glass dome over the disc, the amber VFDs and the LED ring are the strongest parts. The Doto display type carries the era without labels.

Problems, biggest first:
1. **The arming shot is not an arming shot.** Under SwiftShader a frame took ~250–500 ms and a screenshot ~4 s, so by the time the "arming" frame was taken the hero had already fired (it shows the transition), and the "selected" frame shows the transition already timed out. Instrumented with a timestamp on the VFD: the frame in the arming shot was rendered after selection. Also, PlayCanvas clamps `dt` to 0.1 s, so every `dt`-driven animation ran at a fraction of real speed on the slow renderer.
2. **Everything is the same mid grey.** The low softbox sat directly behind the viewer, so every flat front face (faceplate, VFD glass, graphite deck) reflected it. Glass and plastic look washed out instead of deep and glossy, and there is no light falloff across the device. Not energising.
3. Unlit LED segments read as brown dirt rather than dark glass.
4. The library drawer's two vertical chrome handles read as a **pause icon**. Its sub-line (grey on silver) is low contrast.
5. The More knob cap blows out to white; it looks like a blank button.
6. The jelly keys are flat slabs with a bevel, not jelly: no pillowed top, no Aqua-style gloss.
7. The wrist markers (yellow core, black ring, white rim) read as a pair of cartoon eyes.

Changes for round 2:
- Performance: one directional light without clustered lighting; soft drop-shadow cards (offset by each part's height, so they move as parts travel) instead of a shadow map; the faceplate front — the largest, flat, static surface — is baked into an unlit texture (brushed streaks, key-light falloff, anisotropic sheen band); printed labels are unlit. Adaptive frame pacing leaves idle gaps between frames on a slow renderer so input and screenshots are not starved.
- All motion is driven by wall-clock time, not `dt`; the hero transition holds while both wrists stay on it.
- Studio environment re-lit: dim horizon fill, strong overhead strips and an upper-left key softbox, so flat glass and plastic reflect a dark room and bevels carry the highlights.
- Jelly keys get a pillowed (domed) front mesh; LEDs off are smoked dark glass; one horizontal pull handle on the drawer; darker knob cap with spun-metal rings; wrist markers become glowing amber beads in a chrome bezel with a soft dark halo, no white sclera.

### Round 2 — performance and material rewrite

Capture: exit 0, six targets. Frame cost under SwiftShader fell from ~500 ms to ~40 ms per frame (27 fps in the probe), and the arming shot now catches the hold mid-way.

What worked: the dark glossy glass and graphite finally read as deep materials against the brushed faceplate; the deck, the VFD and the badge feel like objects. The VFD progress bar plus the LED ring make arming legible from across a room.

Problems, biggest first:
1. Additive glows were painted with alpha; additive blending ignores alpha, so every LED halo rendered as a solid amber square around the LED, and the disc glow in the selected shot filled half the screen with a hard-edged orange disc.
2. The cover inlays on the jelly keys are pierced by a blue rectangle: the pillowed key dome rises through the flat cover. The inlays must sit on top of the dome.
3. Unlit LEDs are still brown, and the hero ring's printed track reads as a brown band.
4. The drawer pull is still a vertical pill; the knob's dot ring collides with the corner screw and the top edge.
5. Wrist beads are pale peach: the emissive colour washes out to cream under tone mapping.

Changes for round 3: halo textures painted as RGB on black; inlays and meter windows raised above the dome; darker smoked LEDs with clearcoat; dark groove for the ring track; horizontal pull; knob smaller and lower; saturated orange bead with a stronger dark halo; low bar light moved down so the domed keys catch it.

### Round 3 — first honest look at all three states

Capture: exit 0, six targets. Arming shot shows the ring about 80 % filled clockwise from 12 o'clock, both VFDs agree, the deck is pressed in.

What worked: this is now clearly a piece of hardware. The arming state is readable from across the room (36 big LEDs plus a 12-segment bar). Selected shows the disc lifting out of the deck toward the athlete with the rest of the device dimmed.

Problems, biggest first:
1. **Spacing rule fails on the measured hit rectangles.** Measured with `targetsOnScreen()`: rec-2/rec-3 41 px, rec-1/rec-2 53 px, rec-3/more 26 px. Two causes: perspective magnifies anything that sits proud of the faceplate (the dome alone is 0.5 units deep), and the `more` knob's mesh bounding box is rotated 135°, inflating its rect to 184 × 176.
2. The additive glows are now invisible: the gradient falls off inside the part that covers it.
3. The opened lid sits edge-on across the rising disc as a dark smudge.
4. The dim overlay also dims the "Loading Silver Songs" display, which is the confirmation text.
5. The jelly keys are domed but still read as flat blue: no visible gloss highlight.
6. In the selected frame the disc may not have risen yet; the rise used ease-in-out, so the capture can land on the slow start.

Changes for round 4: narrower lens (20° at 15 units instead of 30° at 10) so depth inflates rects less; keys 210 wide with 71 px gaps, keys lowered; the knob body stays still and only its pointer rotates; shallower dome; broader glow gradients and a ring-shaped disc glow; lid lifts away and disappears; a copy of the guide display floats above the dim layer; brighter low bar light for the jelly gloss; front-loaded ease-out rise with the camera pushing toward the disc.

### Round 4 — spacing fixed, transition lands

Capture: exit 0, six targets. Measured hit rectangles: every pair of targets is now ≥ 64 px apart (smallest: rec-2/rec-3 64, hero/rec-1 67); `more` is 132 × 128; keys 212–227 × 389; library 785 × 257; hero 652 × 741.

What worked: the selected frame finally tells a story. The lid is gone, the disc has risen toward the camera inside an amber ring of light, the rest of the device has dimmed, the camera has pushed in, and "Loading Silver Songs" with a progress bar stays bright above the dim layer. The arming frame is unambiguous: the ring is nearly full, the VFD bar agrees, the deck is pressed in.

Problems, biggest first:
1. The jelly keys still read as flat blue plastic. The cover art covers the top of the dome where the overhead lights would reflect, and the visible lower half of the dome faces the dark floor of the studio.
2. The More knob's dot ring touches the top edge of the faceplate.
3. Moving the drawer pull to the vertical centre crowded the sub-line; it looked better at the bottom right beside the LED strip.

Changes for round 5: a warm floor-bounce band and a brighter, narrower bar light in the studio environment, so the lower half of each dome picks up a caustic glow and the top edge a crisp highlight (the Aqua jelly look, from real reflections); less self-glow on the keys so the reflections carry them; knob moved down with a tighter dot ring; pull back at the bottom right.

### Round 5 — jelly attempt

Capture: exit 0, six targets.

Critique: the floor bounce brightened the lower half of the keys, but it reads as pastel, not as gel. It also lifted the dark LED glass and the faceplate bevels, so the whole device lost contrast. The keys still lack the one thing that makes Aqua jelly read: a crisp white specular highlight across the top. That area is covered by the cover inlay, so the highlight has nowhere to land.

Changes for round 6: put a clear glass lens (a shallow pillowed slab, the same material as the hero's dome) over each cover inlay, so the bar light and overhead strip reflect as a crisp highlight across the artwork, echoing the deck's glass lid; floor bounce halved; key plastic a deeper, more saturated blue.

### Round 6 — jelly that reads, plus a check of the other targets' states

Capture: exit 0, six targets.

The glass lenses alone did little; what made the keys read as gel was light scattering inside the plastic: the key body is now dark blue with an internal glow pooled at its bottom edge (an emissive gradient), while the clearcoat carries the studio reflections and the lens over each cover adds a highlight. Hover and arming brighten the internal glow, so the key visibly "lights up" from inside as it is pressed.

Because the capture script only exercises `hero`, I also drove `rec-2`, `library` and `more` with the same simulated wrists in a scratch script outside the comp folder. Findings:
- rec-2 arming: key pressed in, inner glow brighter, its 8-LED meter filling left to right, guide display reads "Hold for Mega Man" with a bar. Selected: key latches down, meter solid, display reads "Opening Mega Man". Works.
- library arming: the drawer slides out toward the athlete and its 16-LED strip fills. Works.
- more arming: the pointer sweeps from 7 to 5 o'clock and the 11-dot arc lights in step. Works, but the wrist markers' dark halo covers most of the small knob.
- Lit LEDs render pale cream rather than amber: tone mapping desaturates the strong emissive.

Changes: lit LEDs bypass tone mapping at a moderate intensity so they stay amber; the wrist halo is smaller and lighter so it separates the beads from silver without hiding the knob.

### Round 7 — final pass

Capture: exit 0, six targets: hero, rec-1, rec-2, rec-3, library, more.

What works now:
- Idle: one coherent object. Brushed faceplate, chrome badge and screws, a glossy graphite deck with a chrome-ringed disc under glass, three gel keys, a brushed drawer, a knurled knob. Amber is the only signal colour and only appears where a real device would emit light.
- Arming: the LED ring around the deck fills clockwise and glows properly amber now that lit LEDs bypass tone mapping; the guide display's 12-segment bar repeats the progress at the top of the screen; the deck is visibly pressed in.
- Selected: the lid lifts away, the disc rises out of the deck in a ring of amber light, the rest of the device dims, the camera pushes in, and "Loading Silver Songs" stays lit with a loading bar.

Last change ("remove one accessory"): the glass lenses over the key covers are gone. On a square cover the pillowed lens creased along its diagonals and read as an envelope fold; the inner gel glow already does the work.

### Known weak points

- The `hero` cover art has its own baked-in text, which shows through the disc as visual noise.
- `rec-1..3` share one key style. This is deliberate: they are one kind of control. Hierarchy comes from the deck, the drawer and the knob being different objects.
- The jelly gel effect is subtle. It reads as glossy blue plastic more than translucent candy.
- Under SwiftShader the scene renders at roughly 4–30 fps depending on host load. Frame pacing keeps input responsive, but the capture's arming frame can land anywhere from about 60 % to 95 % of the hold.
- Only `hero` is exercised by the shared capture. The other targets' states were checked once with a scratch script and are not part of the capture images.
