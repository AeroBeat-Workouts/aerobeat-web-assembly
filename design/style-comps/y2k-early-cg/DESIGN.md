# Y2K early-CG — "Bryce afternoon"

## What the era actually looked like (research notes)

- **Corridor Crew, "Can Modern VFX Artists use 90s Software?"** — pro artists got one day in **Bryce 2** to make a 90s render; the winner went onto a **Trapper Keeper**. Their takeaway: the look comes from the raw ray tracer, low fog, chrome and fractal terrain, and it is almost impossible to fake in modern renderers without going back to the source.
- **Why it looked that way** ("Lost Aesthetic of Silicon Dreams" summary, Blender Artists critique thread): few hundred polygon primitives; no global illumination, so objects float, untethered; reflections are **zero-roughness mirror** (soft reflections were too expensive); specular highlights are a separate hard dot, not part of the reflection; the famous **white band at the horizon is low fog**, not the sky; checker floors, chrome globes, pillars, "bad" airbrushed clouds.
- **Trapper Keeper Designer Series (1988–95)** — airbrushed chrome geometric shapes, orbs, colour-rich landscapes, floating primitives; FuturoCity (1996–99) added CG cityscapes. Lineage: Memphis colour, mall/roller-rink chrome and gradients. Classic **chrome lettering**: navy sky at the top of each letter, a hard white horizon line, warm earth below.
- **KPT (Kai's Power Tools)** — LensFlare presets (glow, halo, anamorphic streak, ghost rings) and **Spheroid Designer**: the chrome/marble sphere that defined the decade. Bryce itself started as KPT Bryce.
- **Bejeweled 2 on PSN (2009)** — the calm, slightly uncanny **planetary backdrops** came from MojoWorld renders; glossy faceted gems over them; tracker music by Skaven ("Beyond the Network"), relaxed rather than hype. That's the emotional target: beautiful, calm, a bit too perfect.

So the comp is specific: **a daytime Bryce scene** (not a night-time synthwave grid), hard mirror chrome built from primitives (tubes, spheres, capsules, a torus), a horizon fog band, a pale ringed planet low in the sky, and KPT-style lens flare saved for the one big moment.

## Direction

The home screen is a single late-90s ray-traced still that you can reach into. Today's playlist is a chrome tube frame with sphere joints holding a glass slab, floating in front of an airbrushed cobalt sky; three recommended playlists are cover "cabochons" set in gem-tinted chrome bezels hovering over a pool-blue checker floor that fades into haze. The single memorable idea: **every hold is a ring of faceted gems igniting one by one, and completing it on today's playlist fires a full KPT lens flare as the slab flies at you** — the demo-reel moment, used once.

## Palette

| Name | Hex | Role |
|---|---|---|
| Bryce Cobalt | `#1E2C9E` | sky zenith, ink for outlines and text shadows |
| Periwinkle Air | `#8FA6FF` | mid sky, glass tint |
| Horizon Haze | `#FFE4D8` | fog, horizon band, chrome's white line |
| Pool Tile | `#0E5D8C` / `#1C82B4` | checker floor pair (low contrast on purpose) |
| Chrome White | `#F5F8FF` | text, chrome highlights |
| Topaz Flare | `#FFB21E` | the one warm accent: igniting gems, flare core |

Gem tints for the three recommendation bezels (identity, not decoration): ruby `#F0325C`, emerald `#19C98A`, amethyst `#A65BFF`.

## Type

- **Michroma** (OFL) — wide, rounded-square geometric display face of the "tech" late 90s. Used only for the hero title, filled with airbrushed chrome gradient and a cobalt outline: the era's chrome lettering.
- **Jost** (OFL, variable) — clean geometric sans with a slightly Futura-ish 90s flavour, for every other label in white with a cobalt halo so it reads over sky and checker. Sentence case everywhere. No all-caps labels.

Scale (screen px): hero title ~66, rec names 38, secondary 30–36.

## Layout (1600×1000, z=0 plane, horizon at y=500)

```
 y=40  ┌o──────────────────────────────o┐    ( ═══ Your library ═══ )   (( ●●● ))
       │  ┌─────────────┐  Silver       │       capsule 320x190          orb + ring
       │  │   cover     │  Songs        │
       │  │  400x400    │  20 songs     │              . pale ringed planet
       │  │             │  Hold both    │           ✦ sun glint
       │  └─────────────┘  hands here   │
 y=510 └o──────────────────────────────o┘
 ~~~~~~~~~~~~~~~~ haze / horizon fog ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 y=600     ◎ ruby bezel          ◎ emerald bezel        ◎ amethyst bezel
           Linkin Park           Mega Man               Game Grumps
           13 songs              10 songs               5 songs
 ▓░▓░▓░▓░ checker floor receding to the haze ░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░
```

Hero left-aligned text inside the slab; recommendations centre-aligned under their discs. Hero dominates (≈790×470), recs ≈280 wide, library quiet (plain chrome, no colour), `more` is the Spheroid orb — the reusable design-language piece.

## Materials and lighting

- One procedural **chrome sphere map** (canvas): cobalt sky top, hard white horizon line, pool-blue floor below, two soft "studio window" blobs. Every chrome object uses it at full reflectivity with zero roughness — the hard-mirror look — plus a separate hard specular dot from a key light.
- Glass slab: translucent cobalt with the same reflection at low strength.
- Gems: low-poly octahedra (sphere with 2 latitude bands) so facets read.
- Lighting: one warm key from upper right (the sun), cool ambient. No shadows — objects float, as they did.
- Fog: linear, haze colour, floor only; the sky is an unlit airbrushed canvas with soft cirrus and the ringed planet.

## Motion

Calm by default: a slow bob on the recommendation discs and orb, nothing else idles. Hover lifts a target toward the athlete and shows its ring of unlit glass gems plus a four-point glint. Arming ignites the gems clockwise in Topaz, each with a halo. Selection: all gems flash white; on the hero, a KPT lens flare (glow, star rays, anamorphic streak, rainbow ghost rings) bursts from the cover, the slab flies toward the camera, the other targets sink into the fog and the playlist's member covers fan out behind it like jewel cases. Other targets get a small flash only.

## States

- **Hover**: grows in place toward the athlete (lift compensated so it never slides), a ring of pale crystal gems appears set into the frame or bezel, plus a four-point glint at one corner.
- **Arming**: gems light clockwise in Topaz, count = progress × ring size, each with an additive halo, so the filling circle reads at 3 m. On the hero, a full ring holds for a 0.35 s charge beat ("Keep holding") before firing.
- **Selected**: flash + (hero only) flare and fly-in transition with member covers fanning out.
- **Wrist markers**: four-point white sparkle with a cobalt ring and dark outline — readable on haze, sky and chrome.

## Plan review against the brief and the skill

- *First instinct was neon magenta grid at sunset on near-black.* That is the generic "retro" default (and the skill's near-black + single acid accent tell). Changed to a **daytime** Bryce sky with checker floor and fog, which is what the actual references show.
- *Hero and recs as identical chrome cards* would be the SaaS-card kit. Changed: hero is a tube-and-sphere frame (primitive construction), recs are round bezels, library is a capsule, more is a sphere — four distinct primitives, one material language.
- *Lens flares everywhere* is the cliché of the era. Restricted the big flare to the hero selection; one faint sun glint sits in the sky.
- *A label above every target* ("Recommended", "Playlist of the day" eyebrows) removed. The hero's count line carries its meaning ("20 songs"), plus a plain instruction for the first session.
- *High-contrast checker* fought the rec names; switched to a low-contrast pool-blue pair with fog.
- Chrome lettering only on the hero title: the boldness lives in one place.

## Sources consulted (for understanding only; nothing downloaded)

- Corridor Crew, "Can Modern VFX Artists use 90s Software?" — https://www.youtube.com/watch?v=lxxC7oQbmJw
- Fstoppers, "Pro 3D Artists vs. Bryce 2: The '90s Challenge" — https://fstoppers.com/video-editing/90s-cgi-render-challenge-pro-3d-artists-vs-bryce-2-902817
- LGR, "Bryce 3D: Making Surreal Trapper Keeper/DnB Art on Windows 95" — https://www.youtube.com/watch?v=EGIwcPA1_34
- Blender Artists critique thread, "Attempt at 1990s-style scenery" (fog horizon, zero-roughness reflections, separate highlights) — https://blenderartists.org/t/attempt-at-1990s-style-scenery-thoughts/1638729
- Trapper Keeper history (Designer Series 1988–95, FuturoCity 1996–99) — https://en.wikipedia.org/wiki/Trapper_Keeper
- HNBP, "Trapper Keeper!" — https://hownow.brownpau.com/archives/2013/10/trapper-keeper
- Smith House, "Design Inspiration: Trapper Keepers & Caboodles" — https://smithhouse.co/blog/design-inspiration-trapper-keepers-caboodles-late-80s-90s
- Bejeweled 2 (MojoWorld planetary backdrops, Skaven's music, PSN release) — https://en.wikipedia.org/wiki/Bejeweled_2 and https://bejeweled.wiki.gg/wiki/Bejeweled_2
- Bejeweled 3 gallery and artist portfolio (later hand-painted direction, used only to see where the series went next) — https://bejeweled.wiki.gg/wiki/Bejeweled_3/Gallery , https://misaelarmendariz.artstation.com/projects/w9xng

## Capture–critique log

All rounds used `node design/style-comps/_shared/capture.mjs y2k-early-cg` from the repo root. Every run exited 0 and listed all six targets. Between rounds I also used a throwaway probe in `/tmp` (not in the repo) to check frame rate, hover screenshots, and the exact mid-hold frame for targets other than the hero.

**Round 1.** The idle shot had the right world: cobalt sky, a fog band at the horizon, a pool checker floor, a ringed planet. Problems:
1. *The arming shot already showed selection.* The scene ran at about 8 fps in SwiftShader (smoke test: 57). Each screenshot also took around a second, so the hold had finished by the time the frame was saved. I profiled it: anisotropic filtering at 8×, two directional lights on a sky-sized plane, and the transparent glass slab were the main costs. Fixes: anisotropy 1, opaque front-to-back sorting, the sky cropped to only the visible part above the floor, no mipmaps on large single-use textures, unlit chrome (the reflection *is* the look, which is true to the era: separate highlight, mirror reflection), and an opaque airbrushed "fake glass" slab like period renders used. Result: 8 → 26 fps.
2. *The hit areas were far bigger than what you see.* `hands.mjs` measures the 3D bounding box, so spheres, tori and the orb's gems pushed `more` out to 288 px wide. That nearly touched `library`, with a gap well under 60 px. Fix: each registered entity now holds only an invisible flat plane matching the designed footprint, and the visuals live in a sibling. Measured gaps now: library to more 75 px; hero to library 67 px; hero to the recommendations about 70 px; between recommendations 240 px.
3. Hero text crowded the frame, and the CTA nearly touched the bottom tube. I moved and resized the frame and cover.

**Round 2.** Hit areas and gaps were now correct. Problems: the idle gem ring was dark cobalt and disappeared against the cobalt slab and sky, so hover barely read. The wrist marker spin turned the plane edge-on, making it look like a thin sliver. In the selected shot, the hero flew off to the left and was clipped by the screen edge. Fixes: pale crystal idle gems; the hero now flies to the centre and stops fully on screen; the "Raise both hands here to start" prompt switches to "Opening your playlist".

**Round 3.** The arming shot still caught the ring complete, because the hold is 520 ms and SwiftShader screenshots are slow. Instead of faking progress, I gave the hero a deliberate **charge beat**: at 100% the full topaz ring holds for 0.35 s, spinning faster, while the prompt says "Keep holding". Then the flare fires. That fits the demo-reel idea (wind-up, then the hit) and makes the full ring readable. The lens flare's source had sat on the athlete's wrist markers, over the cover art. It now rides the frame's top-right chrome sphere, so the flare comes from a "light source" in the scene. Member covers arrive faster, so the selected frame shows the playlist's songs fanned out on the floor.

**Round 4.** Fixed the spin axis bug: sparkles, flare rays and wrist markers now rotate inside a pivot, about the view axis, so they never turn edge-on. Wrist markers became ink–white–ink rings with a dark centre, readable on haze, sky, chrome and the checker floor.

**Round 5.** Hover and mid-hold frames for `rec-1`, `library` and `more`: the recommendation gem ring overlapped the playlist name, and the `more` ring ran off the right edge of the screen and over its label. Lifting a target toward the camera also made off-centre targets slide outward (perspective). Fixes: recommendation gems now sit *in* the chrome bezel, like a jewelled watch face. `more` gets a jewelled belt on its silhouette. The label moved down. The lift now compensates x/y so a target grows in place, and lift is smaller overall (calmer).

**Round 6 (final).** Secondary targets' halos were nearly as loud as the hero's, which spent the boldness everywhere. Gem halos are smaller on rec/library/more, and only the hero keeps the big glow and the flare. Final capture exit 0.

### Remaining honest weaknesses
- The showy moment, the lens flare, is only partly visible in `shot-selected.png`. Because SwiftShader saves slowly, that frame lands after the flare's peak, as it settles. The full burst is visible live.
- In SwiftShader it runs at about 25 fps. It should be smooth on a real laptop GPU, but I have not measured one.
- The chrome is one shared sphere map, and it is unlit. It reads as chrome, but not as glossy as a true ray-traced render, and all the chrome objects reflect the same "room".
- The hero cover's own rainbow art competes with the chrome title. Another playlist cover could look calmer or busier; the frame does not adapt to the cover.
- `library` is quiet by design. At 3 m its subtitle (28 px) is at the minimum size.
