# Bubble Sky — design plan

## Direction

A bright, saturated bathtub-in-the-sky world in the spirit of early PS3 / PSN tech demos: a deep cerulean sky, a floor of cloud that doubles as bath foam, and every control is a real soap bubble. Playlists float inside bubbles with their covers sealed inside, clear in the middle and iridescent only at the rim, so the art stays readable from the couch. The single memorable idea: **the athlete's wrists are bubble wands**, and holding a bubble with both wands inflates it until it pops and carries you into the playlist.

## Palette

| Name | Hex | Role |
|---|---|---|
| Cerulean Sky | `#1A86F0` | Upper sky, the dominant field of colour |
| Horizon Haze | `#B8F0FF` | Lower sky and distance haze behind the clouds |
| Rubber Duck | `#FFD21F` | Wands, arming beads, the song-count pill: the one warm accent |
| Bubblegum | `#FF5FB0` | Film iridescence peak and arming rim heat |
| Tub Navy | `#0D2C78` | Text outlines, wand outlines, small type; a named deep blue, never a near-black |
| Cloud Foam | `#FFFFFF` | Clouds, text fill, highlights |

## Type

One family: **Sniglet** (OFL, 2008), a soft round display face with chunky counters that looks like it was squeezed from a tube. It matches the era and the material.

- ExtraBold 76 px: hero playlist name, white fill with a thick Tub Navy stroke, like a toy-box logo.
- ExtraBold 38 px: recommended playlist names and the library title, same white and navy treatment.
- ExtraBold 34 px: the song-count pill, navy on Rubber Duck.
- Regular 30 px: one supporting line under the library title, navy.

Sentence case everywhere. No eyebrow labels, no dotted meta strings.

## Layout (1600 x 1000)

Left-weighted: one huge hero bubble on the left third, three smaller bubbles drifting up a loose diagonal on the right, the soap bar resting low on the right, the more-bubble in the top-right corner.

```
+----------------------------------------------------------------+
|                                                    ( ooo )     |  more: 120 px bubble with
|                         ( rec-1 )                              |        three duck-yellow dots
|        .-----------.     Linkin Park                           |
|      /   ________   \                 ( rec-2 )               |
|     |   | cover  |   |                 Mega Man                |
|     |   |________|   |                                         |
|      \  hero bubble /   ( rec-3 )                              |
|        '----------'     Game Grumps        ______________       |
|        Silver Songs                      ( Your library )      |  soap bar
|         [20 songs]                        '--------------'      |
|  ~~~~~~~ cloud foam ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  |
+----------------------------------------------------------------+
```

Target rectangles (px, before bob/hover): hero bubble 440 px plus title, recs 196 px bubbles plus name, library 340 x 190 soap bar, more 124 px bubble. Final measured rectangles are in the log below. Every pair keeps at least 60 px clear, including labels. Hero text is centred under its bubble; recommended labels centre under theirs.

## Materials and lighting

- **Bubble film**: a custom GLSL shader. Thin-film iridescence approximated with a cosine palette driven by view angle (fresnel) and a slowly swirling thickness field; alpha is near zero in the middle and rises steeply at the rim, so the cover inside is not washed out. Two specular terms: a hard sun spot and a soft window-shaped highlight from the reflection vector. Front faces only, no depth write. One sphere per bubble, cheap enough for SwiftShader.
- **Covers**: an opaque circular disc mesh, unlit (emissive), sitting just behind the bubble centre. Covers with no art show their four member covers as a 2 x 2 mosaic inside the circle.
- **Clouds**: clusters of lit white spheres with a sky-blue ambient, so their undersides go periwinkle.
- **Soap bar**: a flattened lilac capsule, glossy StandardMaterial.
- **Sky**: a far gradient plane with a soft sun glow in the upper middle.
- **Light**: one warm directional sun from upper left, sky-blue ambient.

## Motion

- One entrance: bubbles are blown in, scaling up from nothing with a soft overshoot, hero first, then the recs, library and more (under one second).
- Idle life: each bubble bobs slowly and wobbles (squash and stretch on two axes, out of phase), film colours swirl. A few small background bubbles drift upward behind everything.
- Nothing else moves unless the athlete acts.

## States

- **Hover** (one wrist): the bubble lifts toward the camera, wobbles harder and its rim brightens. The hero also shows a small Rubber Duck tag: "Hold with both hands".
- **Arming** (both wrists): the bubble swells up to 12 %, the film swirl speeds up and heats toward Bubblegum, and a ring of duck-yellow beads around the bubble inflates one bead at a time, clockwise from the top. Half a ring is half the hold. Readable from across the room because the beads are solid, saturated and outside the cover.
- **Selected**: the completed bead ring bursts outward. For the hero, the bubble does not pop: it lifts off and carries the athlete to the middle of the sky, growing, its film swirling fast, while every other target pops in a ripple running outward from it (film flash, droplet spray, contents tumble away) and the playlist's first songs spill out in their own small bubbles. That is the start of entering the playlist. Recs, library and more on their own pop and re-form. (Revised in round 3; the first build flew the bare cover at the camera.)
- **Wrist markers**: two bubble wands, a duck-yellow loop with a navy outline and a shimmering film inside, drawn closest to the camera so nothing passes in front of them.

## Review against the brief and the skill's generic defaults

- First pass put text inside the bubbles over the covers. Changed: text moves under each bubble so covers stay clean and the film never sits over type.
- First pass used the same bubble for every target including library. Changed: library is a soap bar (quieter, different silhouette, on-theme: where bubbles come from) so not every target is one identical card; more is a small bubble holding an ellipsis of three duck-yellow dots, a reusable glyph for every future screen.
- Considered a generic arming ring (a thin progress arc). Changed to inflating beads, which belong to this world and read at distance.
- Considered a near-black navy for text. Changed to a clearly blue Tub Navy, avoiding the "tinted near-black" tell.
- Checked against the default list: no cream background, no acid accent on black, no hairline broadsheet, no identical rounded card kit, no all-caps eyebrows, no dot-joined meta strings, no em-dash labels, no monospace data labels, no arrows on buttons. The font is chosen for the subject, not a default.
- Wrist wands are drawn in front of everything (including the flying hero cover) to satisfy "visible against every part of the screen".

## Capture–critique log

### Round 1

Critique:
- Wrong scale: the near camera (fov 24, z 18) made perspective swell every hit rectangle; six target pairs were closer than 60 px.
- Performance was unacceptable: 5 fps under SwiftShader. Profiling by disabling groups showed the lit StandardMaterial clouds (40-band spheres, fog) and MSAA dominated.
- The idle composition worked: saturated sky, foam floor, readable covers inside clean bubble centres. The film read as a real bubble at the rim only, which is the intent.
- Arming beads were readable but the white "empty" beads looked like dust.
- Selected: the bare cover flying at the camera filled the screen with one image and read as a glitch, not as entering a playlist.

Changes:
- Camera moved to fov 13 at z 34 (almost orthographic), targets re-spaced. All gaps now at least 60 px.
- Clouds rewritten as a tiny custom wrapped-light shader (sky-blue shadow side, warm lit side); antialias off; fog removed. 5 fps to about 45 fps in the capture browser.
- Added a crescent highlight to the film for a stronger glass read.

### Round 2

Critique:
- Idle is close to the brief: one clear hero, three recs on a loose diagonal, quiet soap-bar library, more-bubble in the corner.
- The library label sat behind the capsule's curved front and was clipped ("Your li").
- A far cloud sat directly behind the more-bubble and flattened it.
- Arming beads overlapped "Silver Songs" at the bottom of the ring.
- The capture's "arming" frame was landing after selection. Frame logging showed the page runs about 35 fps, so the mid-hold screenshot is taken late; separately the first draw of the bead and droplet shaders stalled software rendering, which pushed the hold past the screenshot.
- Selected still read as a hard cut.

Changes:
- Hero selection redesigned as "the bubble carries you in": hero floats to centre and grows, others pop in a ripple, four song bubbles spill out with member covers.
- Pre-warm pass draws every effect material once before `__compReady`, so no shader compiles mid-hold.
- Empty beads became small clear bubbles; the completed ring bursts outward on select.

### Round 3

Critique:
- Arming frame now shows the ring three-quarters full and the bubble swelling with hot film; readable from across a room.
- Selected frame shows the hero centred with its name and count, the other targets gone and four song bubbles arriving. It now reads as a transition, not a glitch.
- The pop flash ring was a thin full-screen white circle that looked like a stray outline.
- Library label still clipped; bead ring still touches the hero title at full swell.

Changes:
- Flash ring shortened to 0.24 s and kept close to the bubble; soap gets an oval ring.
- Library label moved in front of the capsule; capsule tilted so its top face catches light.
- Hero title nudges down as the bubble swells.
- Distant clouds moved and hazed so they never sit behind a target.

### Round 4 (final)

Critique:
- All three shots now meet the brief. Covers stay legible in every state, text is outlined and large, the wands read on sky, cloud and cover.
- Remaining issues are listed in the report as weak points: the beads still graze "Silver Songs" at the very end of the hold, the rec rectangles are tall because each label is part of its target, and the song bubbles in the transition show what the content gives us (three of the four Silver Songs member covers are near-identical Sonic art).

Measured on the final build: hero 575 x 645 px, recs about 270 to 324 x 263 px, library 352 x 193 px, more 131 x 124 px; smallest gap between targets 60 px or more; about 43 fps in the SwiftShader capture browser.

