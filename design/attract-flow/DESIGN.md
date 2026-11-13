# Attract / loading flow: design plan

The look is a deliberate placeholder that will be reskinned. The decisions that matter are the flow, the timing and the interactions. The style only has to be calm, readable from 3 m, and get out of the way of the one thing that is personal: the athlete's own camera picture.

## Direction

A quiet, dark-slate room with soft rounded panels. Nothing glows or bubbles. The one memorable moment is the camera picture: in phase 2 it sits in a framed "mirror"; when tracking becomes ready the mirror grows to fill the whole screen, and the athlete's wrists light up on top of their own body. That is where the boldness goes. Everything else stays plain.

Why dark: living rooms vary from bright to dim, a dark screen does not glare at the athlete, and the camera picture and the two wrist colours read best against it. The skill warns against "near-black plus one acid accent". This palette is a blue-grey slate (not tinted black), uses two quiet accents that each carry meaning (left and right wrist), and keeps paper-white as the action colour.

## Palette

| Name | Hex | Role |
|---|---|---|
| Basalt | `#22272D` | Background |
| Slate | `#343B44` | Quiet panels, toy bodies |
| Ridge | `#4A535E` | Strokes, progress track |
| Fog | `#B8C1CB` | Secondary text |
| Paper | `#F3F5F7` | Primary text, the primary action fill |
| Signal | `#6CC3D5` | Progress, left wrist, "working" |
| Ember | `#F2B36B` | Right wrist, problems that need attention |

Problems use Ember, never red: a blocked camera is a thing to fix, not an alarm.

## Type

One family: **Atkinson Hyperlegible Next** (OFL), chosen because it was designed for legibility at a distance and for low vision, which is exactly the 2–3 m living-room case. Bold for actions and headings, regular for explanations. Sentence case everywhere, no all-caps labels.

Scale at 1600×1000: 64 headline, 56–60 primary action, 40–44 prompts, 32 body, 28 minimum for anything that must be read from the room.

## Layout

```
Phase 1 (before the click)
+--------------------------------------------------------------+
| AeroBeat                                       [Play in VR]* |
|                                                              |
|              Play with your whole body                       |
|   AeroBeat uses your webcam to follow your moves...          |
|                                                              |
|   (pad)        [ (cam)  Turn on camera ]          o o o      |
|                                                    o o       |
|              Then stand 2 to 3 metres back                   |
|                                                              |
|   Downloading the body tracker: 6.4 of 18.0 MB               |
|   [=========-----------------------------------]             |
+--------------------------------------------------------------+
  * only when desktop WebXR is available

Phase 2 (camera on, tracker loading)       Phase 3 (tracker ready)
+---------------------------------+        +---------------------------------+
| AeroBeat        [Switch camera] |        | full-bleed mirrored camera,     |
|   +-------------------------+   |        | dimmed                          |
|   |   mirrored camera       |   |        |   [ Raise both hands here ]     |
|   |   (framed "mirror")     |   |        |        o  wrist   o             |
|   +-------------------------+   |        |                                 |
|  While we get ready: roll your  |        | [Put both hands on the button   |
|  shoulders, reach up high       |        |  and hold]                      |
|  [====== loading ======-----]   |        +---------------------------------+
+---------------------------------+
```

Centre-aligned throughout: the athlete stands in front of the middle of the screen.

## Materials and motion

- Panels are one SDF shader: rounded rectangle, soft shadow, optional stroke, and an outer ring whose lit arc is the arming progress (clockwise from 12 o'clock).
- Text is drawn into canvas textures on quads.
- The camera picture is a video texture through a shader: mirrored, cover-fitted, partly desaturated, shadows lifted toward slate, a light vignette, rounded corners.
- Motion only answers something: toys answer pokes, buttons lift on hover, the mirror grows when tracking is ready, the practice target confirms when selected.

## States

- Hover: the button lifts slightly and gains a Paper stroke.
- Arming: the outer ring fills in Signal. Visible from the room because it is 10 px thick and outside the button.
- Selected: the button fills Signal and shows a check, then the next state appears.

## Review against the brief and the skill

- First idea was a light grey "studio" background. Changed to dark slate: a light screen washes out the camera picture and glares in a dim room.
- First idea put the loading bar inside the main button. Moved it out: the button must stay a clean, single target, and progress must keep running after the button is gone (phase 2).
- Removed a "Step 1 / 2 / 3" stepper I sketched for the flow: the athlete does not need to know there are phases, and numbered markers would be decoration.
- No eyebrow labels, no middle-dot meta strings, no arrows appended to button text.

## Capture and critique log

See the bottom of `README.md`.
