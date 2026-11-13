# Aero Remix: "Air Unit"

## Direction

Frutiger Aero, moved off the desktop and onto the body. The twist is **Aero as performance gear**: the glossy aqua glass of 2007 rebuilt from the materials of the athlete's own kit — clear pressurised air units, gel pods, white EVA foam midsoles, perforated knit, reflective piping and a lacing dial. It is rendered like a contemporary 3D sneaker product shot: a pale studio cyclorama, a softbox reflected in every glass surface, real shadows, caustic light thrown through the gel.

**The single memorable idea:** every target is a clear pod in a foam midsole, and holding it with both hands *pumps pressure into it*. Aqua gel rises inside the pod as the hold completes and the pod swells; selection is a heel-strike — the pod compresses, rebounds and flashes volt.

### Why this twist suits a standing full-body fitness game

- The athlete is standing in a living room wearing exactly these materials: trainers with visible air units, gel insoles, mesh tops, reflective trim. The screen speaks the language of the kit they just put on, which is the most direct "you are about to exercise" cue there is.
- Frutiger Aero's founding promise was optimism about technology and nature in harmony. Performance gear is where that promise actually landed in daily life: Shox pillars, Air Max bubbles and Gel inserts (2000–2010) are the same visual era. Current revival writing explicitly lists Nike/adidas athleisure and glossy technical fabrics as Aero-adjacent (see sources).
- Pressure and effort are a natural metaphor for a two-handed hold: pushing into a cushioned pod is a physical action, so the arming state explains itself from across the room as a liquid level, not a thin ring.
- It differentiates from the other comps in this set (bubbles in sky, water, Wii channel): no sky, no sea, no floating bubbles. Aqua lives *inside* objects as gel.

### Grounding in current revival work (research summary)

- "Neo-Aero" / Frutiger Aero revival (early 2020s on) pushes hyper-real glass and liquid skeuomorphism rendered with modern 3D tools, exaggerated lens flares, chrome, glass transparency — applied to album art, merch and branding rather than OS chrome.
- Apple's 2025 Liquid Glass sparked "Vista done well" comparisons and r/FrutigerAero pairing glassy home screens with Vista wallpapers; critics flagged contrast and legibility. Lesson taken: glass must sit over an opaque, high-contrast printed layer, never text on glass over busy imagery.
- Sub-aesthetics (Dark Aero, Frutiger Eco, Technozen, Four Colors) show the community remixes Aero by swapping its *subject* while keeping its *materials*. This comp swaps the subject to sportswear.
- 2000s performance footwear (Shox, Vomero, Air Max visible units) is cited as proto-Aero retro-futurism; athleisure is named as Aero fashion's marker.

## Palette

| Name | Hex | Role |
|---|---|---|
| Midsole White | `#F3F7F5` | EVA foam trays, the printed surfaces |
| Studio Mist | `#D8ECF0` | studio wall behind the pods |
| Pool Gel | `#16AEE0` | pod tint, rising gel, caustic light |
| Volt | `#D2F31A` | reflective piping when lit, wrist cores, selection flash |
| Lane Navy | `#0D2E58` | all type, wrist outline |
| Reflective Silver | `#AEBCC3` | idle piping, dial knurling |

Volt is a sportswear colour, not decoration: it appears only where something is responding to the athlete (hover piping, wrists, selection).

## Type

One family: **Signika** (OFL, Google Fonts). A humanist sans originally designed for wayfinding, it sits in the Frutiger lineage (open apertures, legible at distance) without being Frutiger itself, which keeps the Aero DNA honest. Weights: 700 for playlist names, 600 for the wordmark, 400 for counts and helper copy. Sentence case everywhere, no tracking tricks, no caps labels.

Scale on screen (px at 1600×1000): wordmark 60, hero name 76, rec names 44, counts and helper copy 30–34.

## Layout (1600×1000, left aligned, two columns)

```
 x: 80                          890  960                       1530
  AeroBeat (printed wordmark)                              ( more )  y 30-160 dial
  +-----------------------------------+  +---------------------------+ y 230
  | [cover   ]  Silver Songs          |  | [cv] Linkin Park          | rec-1
  | [ 380 sq ]  20 songs              |  |      13 songs             | y 420
  | [        ]  Playlist of the day   |  +---------------------------+
  |        HERO tall air unit         |  +---------------------------+ y 490
  +-----------------------------------+  | [cv] Mega Man             | rec-2
  y 690                                   +---------------------------+ y 680
  +--------------+                        +---------------------------+ y 750
  | Your library |  Hold both hands on    | [cv] Game Grumps          | rec-3
  | search, lists|  a playlist to start   +---------------------------+ y 940
  +--------------+ y 950
```

Gaps are 70 px nominal so the pods' depth and hover lift never eat into the 60 px minimum.

Form hierarchy instead of one card style:
- `hero` — a big stadium-cornered air unit, deep and glossy.
- `rec-1..3` — fully rounded lozenge pods (pill ends), medium depth.
- `library` — a low, frosted, flatter tray: same foam, almost no pressure. Quieter by being less inflated.
- `more` — a circular lacing dial (BOA-style): knurled silver rim, gel centre, three printed dots. A recurring piece of gear, like the dial on a shoe.

## Materials and lighting

(As built. The first plan used PlayCanvas StandardMaterial, an env atlas and shadow maps. Round 1 showed that ran at 3 fps under SwiftShader. It was rebuilt with custom shaders; see the log.)

- **One analytic photo studio** shared by every shader: navy floor, aqua wall at the horizon, a ring of softbox windows above, one big key softbox upper left. Each glass air unit reflects it through its real curved normals, so the classic Aero gloss band is a reflection that bends around the dome, not a painted white stripe. Fresnel makes the rims bright and the faces clear.
- **Air units**: real domed geometry (rounded-rect pillows) in a transparent glass shader: faint aqua body, Fresnel reflection, tight key specular.
- **Gel**: computed in the same dome shader. A flat liquid surface at the fill level carries a waving meniscus, animated caustic shading inside, and a field of air bubbles that rise faster while the unit is being pumped. Every pod holds a little resting gel, so the language is legible before anyone touches anything.
- **Foam trays**: deep rounded-edge slabs with the cover and type printed onto the flat face (opaque, high contrast). Wrap lighting, contact occlusion toward the back, satin sheen on the rounded edge.
- **Piping and lacing dial**: a metal shader reflecting the same studio. The piping is retroreflective trim that lights volt.
- **Contact shadows**: blurred shadow cards on the wall, offset away from the key and softened as a pod lifts. As a pod fills with gel its shadow turns into an aqua caustic, like light through a gel insole.
- Pods are yawed a few degrees toward the centre (left column 6–7°, right column −8°). Their depth and the wall shadows then read as objects standing in a room, not flat cards.

## Motion

One orchestrated moment: on load the pods pressurise in sequence (hero first), swelling from flat. Everything else is still. Responses only to the athlete.

## States

- **Hover** — pod lifts toward the camera, piping switches from silver to glowing volt.
- **Arming** — gel rises from the bottom of the pod in step with progress and the pod inflates; at the top the gel touches the glass. The level is visible across the room on every target, including the dial (dial also turns).
- **Selected** — heel-strike: the air unit compresses, rebounds and overshoots while the gel flashes white-hot and a volt ripple spreads across the wall from the pod's outline. The gel then drains back to rest. For `hero`, the other five targets drop away into the wall and the wall floods pool blue. The hero swings square to the athlete and comes forward, and four member-map covers rise out from under it as foam chips: the start of the playlist screen.
- **Wrists** — a volt ring with a navy outer ring and glass core, floating in front of everything so it reads on white foam, aqua glass and the mist backdrop.

## Plan review against the brief and the skill

- *Generic default check:* the first instinct was a sky gradient with floating glass bubbles and white rounded cards — the nostalgia recreation, and also the bubble-sky sibling's ground. Replaced with a studio product-shot setting and gel-inside-objects.
- *One card style everywhere* (SaaS tell): replaced with four distinct forms (air unit, lozenge, flat tray, dial) sharing a material language.
- *Eyebrow labels / caps / meta strings:* removed the "PLAYLIST OF THE DAY" eyebrow; the hero says it in sentence case beneath the count. Counts are plain ("13 songs"), no `A · B` strings, no arrows.
- *Acid green on near black:* volt is used on a light scene and only for response states, with a sportswear reason.
- *Legibility (Liquid Glass critique):* type is printed on opaque foam beneath the glass, navy on white.
- *Brief:* six targets with exact names, three states, wrists in scene, all in world space, 60 px gaps, text ≥28 px. A helper line ("Hold both hands on a playlist to start") is printed, not a target.

## Capture–critique log

All captures ran `node design/style-comps/_shared/capture.mjs aero-remix` from the repository root. Each exited 0 with all six targets on screen.

### Round 1 (first build: StandardMaterial, env atlas, shadow map, MSAA)

Critique:
- Every printed surface was upside down. The canvas textures ran top-down but the quad UVs ran bottom-up.
- The glass domes were essentially invisible. The env reflections were too faint at 16% opacity and the clear coat added nothing visible, so the air unit idea did not read at all.
- Drop shadows from the directional light were heavy and smeared.
- **The arming screenshot already showed the post-select state.** A frame took ~430 ms under SwiftShader, so the picture lagged the hand logic by a whole HOLD_MS. A profile showed shadows, clear coat, env reflections and the lit backdrop each costing 50–130 ms a frame.

Changes: flipped the UVs. Printed the face straight onto the foam (no extra quad). Dropped clear coat and shadow maps. Made the backdrop unlit. Reached ~130 ms a frame, still too slow and still inverted on the trays.

### Round 2 (rewrite: custom shaders)

Critique of the intermediate captures: the tray print was still upside down (the planar UVs had their own v flip), the wall shadow cards cut off in hard rectangles, and the gel at 62% opacity hid the playlist name. The selected state turned the whole hero green. Hero members laid under the hero were registered as part of its hit area.

Changes: replaced every StandardMaterial with five small GLSL ShaderMaterials (tray, dome+gel, wall, shadow, metal) sharing one analytic studio function. That gave ~38 ms a frame with MSAA, and the arming capture finally landed mid-hold (~450 ms into the 520 ms hold). Corrected the v flip. Gave the shadow mask enough padding to fade to zero. Gel became more transparent with a volt meniscus. Selection flashes white instead of volt-green. The tracklist chips moved out of the hero's entity tree so `hands` measures only the hero.

### Round 3

Critique: idle now reads as glossy pods with type printed under glass and a little resting gel. But the screen was still flat and front-on, like rounded cards with a gloss sticker. The 3D depth was invisible. Arming worked (bubbles, rising gel, volt meniscus, wall caustic), but a fully filled hero hid the title. The selected tracklist covers were bare squares. `more` sat 55 px from rec-1, under the 60 px minimum.

Changes: deeper midsoles (hero 0.5, rec 0.4 world units). Yawed each pod a few degrees toward the centre so sidewalls and real perspective show. Re-spaced to satisfy all gaps (measured: smallest 63 px). Lowered gel opacity over the print (30%). Added rising bubbles and caustic shading to the gel. Tracklist covers became foam chips with a moulded window. Gel drains back after the select flash. Tried pitching pods 12° to show the soles. That washed the domes white and blurred the type, so it was reverted.

### Round 4 (final)

Critique: the opened hero came forward far enough to sit in front of the wrist markers, which then rendered behind its glass (brief: wrists must stay visible against everything). The hero also kept its yaw while it opened, so the playlist read skewed. Probed states the capture script does not show: hover (rec-2: lift plus volt piping and rim, clearly visible), arming `more` and `library`. In the probe `more` was clipped at the top edge with only ~4 px of margin.

Changes: wrist markers moved to 7 units from the camera, well in front of everything including the opened hero. The hero un-yaws as it opens. `more` shrank to 120 px world size (on screen 146×139 with its lift halo, above the 120 px minimum) and moved down. Removed a SwiftShader frame-pacing workaround once frames were cheap enough not to need it (A/B timed, no benefit). The final capture is the one in the folder.

### Round 5 (timing polish)

Critique: in the round-4 capture the hero opened the instant selection fired, so the heel strike was never seen. Repeated captures also showed that the moment `shot-arming.png` actually captures varies under SwiftShader. A screenshot request waits ~150–300 ms for a frame, so the 280 ms "mid-hold" shot sometimes lands just after the 520 ms hold completes. A frame-time probe confirmed this is the capture's own latency, not comp lag.

Changes: the playlist now opens 0.2 s after selection (`STRIKE_BEAT`), so the strike always plays first: unit compresses, gel flashes, volt ripple spreads across the wall. Whichever side of the 520 ms threshold the arming shot lands on, it shows the hold state. That is the gel high in the unit with a volt meniscus, bubbles, the wall caustic and lit volt piping, or at most the first frames of the strike. Final capture exit 0.
