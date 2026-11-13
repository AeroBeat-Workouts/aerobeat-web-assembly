# Equipment replay test

Five held-equipment shapes driven at the same time by **real recorded webcam pose data** from one Expert Flow run of *Undefeatable* (build 0.0.155). The goal is to choose equipment by looking at how each shape behaves under real latency and jitter. This is a design exploration, not product code.

## Run it

Serve the `design/` folder over HTTP (ES modules need it), then open `equipment-replay/index.html`:

```
cd design && python3 -m http.server 8000      # then http://127.0.0.1:8000/equipment-replay/
```

The page loops a 45 s excerpt (song 1:16 to 2:01, 167 notes, the busiest stretch the recording fully covers). The layout is a 3×2 grid: saber, short baton, glove, whip, hand orb, and an info panel. Every stage shows the game's 4×3 note grid, which is the athlete's calibration box, as seen from the front.

| Key | Action |
|---|---|
| `S` / `M` | Switch between **raw** (step-wise at the real 14.7 Hz pose rate, as the game draws it) and **smoothed** (linear interpolation between the last two poses, which adds one pose interval of delay). The orange or cyan badge on every stage shows the mode. |
| `G` | Show or hide the red "hindsight" ring and line: where the wrist really was at this moment, without pipeline latency. |
| `T` | Trail length: 250, 500 or 1000 ms. |
| `Z` | 0.25× slow motion. |
| `Space`, `,` `.`, `R` | Pause, step one frame while paused, restart. |

URL options: `?mode=smooth&t=<songMs>&pause=1&speed=0.25&ghost=0&trail=1000`.

How to read a stage: the white squares on a trail are the real pose samples, so the gaps between squares are the 68 ms holds. The coloured trail is the path of the tip. The faint grey skeleton is the pose the game had. A note square closes onto its cell at the beat, and a white ring marks the recorded hit time.

## Files

- `extract.mjs` reads the 50 MB capture and writes `frames.json` (139 KB: 702 poses, 172 notes) and `latency.json`.
- `LATENCY.md` gives the measured latency and update rate, the method, and the limits.
- `index.html` is the PlayCanvas 2.21.4 replay scene (`../style-comps/_shared/playcanvas.min.mjs`). It sets `window.__compReady`.
- `capture.mjs` runs Playwright and writes `stills/still-<n>-<raw|smooth>.png` (the same 4 busy instants in both modes) and `video-raw.webm` / `video-smooth.webm` (18 s of the same stretch).

## Mapping notes

- Positions are in judge space, the same space the game scores in: `x = 4·ax − 0.5`, `y = 2.5 − 3·ay` from calibrated `athlete_top_left` anchors. One unit is one note cell.
- Forearm direction is the elbow→wrist vector. Saber length is 1.3 cells, about the athlete's median shoulder→wrist distance in this run (upper arm 0.69 + forearm 0.64). The baton is one third of that.
- The whip is a 12-link Verlet chain, 1.2 cells long, with a stiff first link along the forearm and light gravity. It runs at a fixed 240 Hz substep, so its look does not depend on frame rate.
- Raw mode draws the newest pose that had *arrived* (first-rendered time `ta`). The hindsight ring interpolates on *measurement* time (`tm = ta − latency`), so the red line is the 43 ms pipeline delay plus the hold. It does not include the unmeasured camera delay; see `LATENCY.md`.
