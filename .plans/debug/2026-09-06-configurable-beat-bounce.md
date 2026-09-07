# Configurable beat-bounce timing/UI design

**Date:** 2026-09-06  
**Role:** timing/UI design research  
**Beads:** `aerobeat-web-assembly-smt` (this report), discovered from `aerobeat-web-assembly-3dc`  
**Owning repo:** `/home/derrick/.dsh/projects/aerobeat/aerobeat-web-assembly`  
**Active plan:** `.plans/2026-09-02-handcrafted-3d-gameplay-visuals-and-environment.md`  
**Status:** RESEARCH COMPLETE — DEFAULT PROPOSAL READY FOR DERRICK TUNING; IMPLEMENTATION/QA/AUDIT REMAIN OPEN  
**Scope:** report/design only; no production code, test code, asset, release, serving, publication, or physical-review change

## Goal

Define one deterministic, presentation-only rise/fall cue for every note-like hittable beat so it begins about one whole-note interval before its authoritative hit and returns to the success-area center at the authoritative event timestamp. Directional notes/punches, directionless notes/punches, and guards bounce. Bombs, Flow walls, Boxing squat/weave walls/checkpoints, arcs, bursts, safe cells, timing tiles, cursors, feedback glyphs, and track/environment geometry do not.

The design must preserve all gameplay/content truth, compose with the existing X/Y lanes/grid and Z timeline, support tempo changes without local-BPM drift, remain deterministic across display cadence and lifecycle changes, and expose only a small private Visual Test authoring surface with strict local JSON import/export.

## References inspected

- Assembly README and active plan, especially the raw `0.0.41` feedback at active-plan lines 1246–1252.
- Assembly projection: `src/session-render-projection.js:5-11,19-39,53-103,123-171`.
- Assembly caller-time frame composition: `src/index.js:1057-1075`.
- Assembly Visual Test controls and lifecycle: `src/index.js:1085-1259,1307-1379,1916-1959`.
- Assembly environment config authority: `src/environment-asset-catalog.js:12-16,45-103`.
- Renderer README world/timing and cadence contracts: lines 5–25 and 30–48.
- Renderer model: `src/gameplay-scene-model.js:24-42,51-97,107-205`.
- Renderer camera schema: `src/gameplay-camera-pose.js:3-84`.
- UI README ownership/accessibility: lines 5–9, 23–31, and 35–42.
- Contracts README/session/gameplay boundaries: README lines 16–28; `src/session-contracts.js:14-18,58-77,197-222`; `src/gameplay-contracts.js:56-74`.
- Content README event timing: lines 54–79.
- Current content time derivation: `src/package-content.js:321-334`; `src/content-runtime.js:377-391`.
- Gameplay README ownership, lifecycle, clock, and event distinctions: lines 5–9, 46–57, 73–105.

## Current truth and constraints

### Existing world and timing transform

The renderer uses a right-handed PlayCanvas world:

- world `+X` is screen-right under the fixed camera;
- world `+Y` is up;
- camera forward is local/world `−Z` at the canonical zero rotation;
- timeline future is world `−Z`;
- the success plane/center is world `Z = 0`;
- the fixed reviewed camera is position `(0.05, 1, 5)`, zero Euler rotation, vertical FOV `48°`, clips `0.1/80`.

The canonical top-left row-major `4 × 3` grid is:

```text
column X = [-1.5, -0.5, 0.5, 1.5]
row Y    = [ 2.0,  1.0, 0.0]
cell     = row * 4 + column
```

Boxing Lanes uses X `−1.35/+1.35`, Y `1.1`, width `1.7`. Guards are two instances at the same Y/Z with X as the only placement difference.

Absolute timeline projection is already deterministic:

```text
z(t) = −(T_hit − t) * worldUnitsPerMs
worldUnitsPerMs = 0.006 by current default
```

No engine delta participates. Future events are at negative Z, hit the success center at Z `0`, and unresolved/missed events continue toward positive Z. The assembly supplies `t = session.timelinePositionMs`; gameplay derives that value only from the authoritative audio clock during play.

### Existing projection eligibility

Assembly currently projects note-like feedback records only for authored `note`, `guard`, and the six Boxing punch types. It separately projects `bomb`, continuous Flow `obstacle`, and Boxing `squat`/`weave_*` wall records; arcs/bursts are omitted. The new bounce must attach only to the note-like allowlist, not to the broader concept of an event that can influence gameplay.

This explicit allowlist resolves the apparent squat/weave ambiguity: those are mode-specific gameplay checkpoints, but their current presentation is obstacle/wall geometry. They remain non-bouncing under Derrick's “never bombs/obstacles” boundary.

### Current tempo limitation

Current content code reads only `song.timing.tempoSegments[0].bpm` and computes all event times as `beat * 60_000 / bpm`. Later tempo segments and `anchorMs` are not consulted. The current authoring path emits one segment at beat zero, anchor zero, and no stops, so present packages are constant-tempo.

The bounce implementation must not create a second, more advanced time interpretation that disagrees with `centerTimestampMs`. Tempo-map support must first be centralized in content timing authority and used both for authoritative event timestamp derivation and bounce lead derivation. Until that lands, current single-segment packages use the exact existing formula.

## Recommended behavior

### Semantic eligibility

Bounce exactly when renderer target kind is one of:

```text
flow note (directional or directionless)
boxing punch (directional or any-direction)
guard (both canonical shield instances as one visual beat)
```

Never bounce:

```text
bomb
Flow continuous obstacle
Boxing squat/weave wall/checkpoint presentation
arc or burst
safe/blocked cells, timing tiles, track, shadows, athlete cursors,
Great/Miss feedback, environment, or camera
```

Use an allowlist, not “everything except bomb/obstacle,” so newly added event types fail static until deliberately classified.

### Beat-to-time authority

Let `F(b)` be the content-owned canonical conversion from authored beat coordinate `b` to authoritative song timeline milliseconds. `F` must include the package timing anchor and every accepted tempo/stop segment under one validated policy. For a map without stops and ordered tempo segments `(s_i, bpm_i)`:

```text
F(b) = anchorMs + Σ_i [60_000 / bpm_i] *
       max(0, min(b, s_(i+1)) − s_i)
```

with the final segment extending to `b`. Stops, if supported by the accepted content schema, add their exact cumulative timeline durations inside the same helper; assembly must not infer their shape independently.

For a target whose authored hit beat is `B`, configured lead is `L` beat units, and authoritative hit time is `H = centerTimestampMs`:

```text
rawStart = F(max(0, B − L))
S        = max(0, H − 10_000, rawStart)
D        = H − S
```

The `10_000 ms` ceiling matches the current bounded future-cull policy and prevents pathological very-low-BPM content from retaining an unbounded number of visual targets. It affects only when the optional bounce begins; the hit landing remains exact. If `rawStart < H − 10_000`, the private Test status may say `Lead limited to 10 s for this tempo`; this degradation must not enter public telemetry.

Before enabling bounce for an event, content/assembly must verify the same mapper reproduces its authoritative timestamp:

```text
abs(F(B) − H) <= 0.001 ms
```

A mismatch disables bounce for that event and retains the current straight Z presentation; it must never rewrite `H`. This is a fail-safe against timing-authority drift, not permission to keep duplicate implementations.

`L = 4` means four authored Beat Saber/BPM beat units. It is colloquially one whole note in 4/4, but it deliberately does not reinterpret lead by time-signature numerator/denominator.

### Rise/fall formula

Let:

```text
q = clamp((t − S) / D, 0, 1)
a = apexFraction
h = heightWorldUnits
```

If `D <= 0`, `t < S`, or `t >= H`, vertical offset is exactly zero. Otherwise:

```text
if q <= a:
  u = q / a
  offsetY = h * E_rise(u)
else:
  u = (q − a) / (1 − a)
  offsetY = h * (1 − E_fall(u))
```

All easing functions map exact `[0,1] → [0,1]`:

```text
linear(u)      = u
in_quad(u)     = u²
out_quad(u)    = 1 − (1 − u)²
in_out_sine(u) = (1 − cos(πu)) / 2
```

Default `out_quad` rise plus `in_quad` fall gives a quick launch, zero slope on both sides of the apex, then a decisive landing. Exact endpoint branches, rather than relying only on floating-point easing evaluation, guarantee:

```text
offsetY(S) = 0
offsetY(S + aD) = h
offsetY(H) = 0
```

### Composition with existing transforms

For every eligible instance:

```text
x_final = x_lane_or_cell
y_final = y_lane_or_cell + offsetY(t)
z_final = −(H − t) * worldUnitsPerMs
rotation/scale/material = existing values unchanged
```

This is additive `+Y` translation only. It does not rotate the arrow differently, alter guard pairing, scale models, distort wall interval Z, move lane/grid/timing surfaces, or change the success plane. Both guard shields receive the identical offset from the same event calculation, retaining same Y/Z and X-only placement difference.

Shadows remain directly below on the track/floor at their existing Y. Their X/Z follows the target as today, but they do not rise; the increasing separation is a useful depth cue and remains presentation-only.

At authoritative `t = H`, the model is exactly at its base lane/grid X/Y and `Z = 0`: the success-area center. Hit removal, miss continuation, white success tint, and Great/Miss feedback keep their current independent timing. Resolved targets do not restart or continue the approach bounce.

### Absolute-time sampling and frame interpolation

Do not accumulate velocity, phase, spring state, random state, or frame deltas. Every display opportunity recomputes the model from the caller's absolute song timeline. No temporal smoothing between frames is permitted because it would introduce history, seek lag, and cadence-dependent landing.

A browser may not present a frame at exactly `H`; the mathematical model still has the exact endpoint. The first sampled frame after `H` uses zero offset and existing resolved/spent behavior. High-refresh and low-refresh clients therefore sample the same trajectory at the same song times.

## Default proposal and bounded controls

Add one compact `Beat bounce` fieldset inside the existing assembly-owned top-left Visual Test authoring body. It is not a new `aerobeat-web-ui` presenter and does not modify the bottom transport's exact six-scalar contract.

| Parameter | JSON key | Unit/type | Min | Max | UI step/options | Proposed default |
|---|---|---:|---:|---:|---|---:|
| Lead | `leadBeats` | authored BPM beat units | `0.25` | `8` | `0.25` | `4` |
| Height | `heightWorldUnits` | PlayCanvas world units | `0` | `1.5` | `0.05` | `0.9` |
| Apex | `apexFraction` | fraction of lead duration | `0.15` | `0.85` | `0.05` | `0.4` |
| Rise easing | `riseEasing` | enum | — | — | `linear`, `in_quad`, `out_quad`, `in_out_sine` | `out_quad` |
| Fall easing | `fallEasing` | enum | — | — | same | `in_quad` |

`heightWorldUnits = 0` is the deliberate disable path; an extra Enabled checkbox is unnecessary. The `1.5` maximum is bounded relative to the one-unit cell pitch while leaving room for deliberate camera experiments. The default `0.9` is visible but remains below one full grid row.

UI inputs should use native labeled number/select controls with visible units (`beats`, `world units`, `%`). Apex displays `40%` but stores `0.4`. Every control has an explicit accessible name, `aria-describedby` text for units/range, keyboard operation, visible focus, and at least `44 × 44 CSS px` interactive height. Input applies only after parsing the complete candidate through the same normalizer used by JSON import; invalid intermediate text does not mutate the last valid config.

Actions:

1. `Reset bounce` — restore the five defaults atomically.
2. `Load bounce JSON` — trusted child-local `.json,application/json` picker.
3. `Save bounce JSON` — deterministic local download.

Keep camera Reset/Load/Export semantically separate. Use `Load/Save` wording to match environment config. One bounded live `<output role="status">` announces `Bounce updated`, `Bounce reset`, `Bounce config loaded`, `Bounce config saved`, the 10-second safety limitation, or one generic invalid-file error without echoing file content.

### UI enablement and lifecycle

The existing panel can stay visible for an active Visual Test, but bounce authoring needs a separate capability from camera movement:

- camera controls keep the current connected + visible + menu-closed + `playing` gate;
- bounce controls are enabled when connected, document-visible, menu-closed, purpose is `visual_test`, and state is `playing`, `paused_manual`, or `completed`;
- this allows pause/edit/seek and terminal edit/backward-seek iteration without weakening camera capture rules;
- menu open or document hidden disables controls and cancels an outstanding picker ownership token;
- values remain live across pause, seek, natural completion, exact-end replay, Test restart, Play/Test transitions, package/difficulty/gameplay selection, and context restoration within the same connected service graph;
- disconnect/destroy invalidates pending reads, releases input, drops the config, and reconnect starts from defaults;
- separate `<aero-game>` elements never share values.

Changes apply to the next caller-owned render frame. They do not seek, pause, resume, restart, configure gameplay, alter audio, or emit a gameplay/UI intent.

## Strict local JSON contract

### Schema v1

```json
{
  "schema": "aerobeat/beat_bounce_config",
  "version": 1,
  "leadBeats": 4,
  "heightWorldUnits": 0.9,
  "apexFraction": 0.4,
  "riseEasing": "out_quad",
  "fallEasing": "in_quad"
}
```

Artifact identity:

```text
filename: aerobeat-beat-bounce-config.v1.json
MIME:     application/json
encoding: UTF-8
format:   fixed key order, JSON.stringify(..., null, 2), LF, trailing LF
limit:    16 KiB before and after read
```

The exported file is intentionally easy for Derrick to edit and return. Imported valid values may be any finite number within the schema bounds, not only UI-step lattice points; normalized output canonicalizes numbers to at most six decimal places and converts negative zero to zero. UI interaction follows its stated step.

### Validation and atomicity

The one normalizer used by defaults, UI changes, direct renderer calls, and JSON import must:

1. reject unavailable/failed `structuredClone` proxy preflight for direct object callers;
2. require root prototype exactly `Object.prototype` (not arrays, class instances, null/custom prototypes, proxies, maps, dates, typed arrays, blobs, or files);
3. require exactly the seven listed own enumerable data keys using `Reflect.ownKeys` and property descriptors;
4. reject symbols, accessors, hidden fields, missing fields, unknown fields, and prototype-pollution names such as `__proto__`, `prototype`, or `constructor` (these are unknown even when JSON creates them as own data);
5. require exact schema/version and exact easing enums;
6. require primitive number types that are finite and in range; reject numeric strings, `NaN`, infinities, and out-of-range values;
7. canonicalize only after all validation succeeds, deep-freeze the new record, and swap one config reference atomically.

`JSON.parse` already rejects JavaScript `NaN` tokens, but the direct normalizer must still reject non-finite numeric values. Load uses fatal UTF-8 decoding. Any read, decode, parse, identity, key, prototype, descriptor, enum, or range failure leaves both assembly and renderer on the byte/value-identical prior config. Do not partially apply valid fields.

Picker ownership must bind connection generation, session generation, graph identity, and the exact Visual Test authoring state. Check ownership before read, after read, after parse/normalize, and before apply. Reset the hidden input value before every picker open. Export and picker open require trusted child-local activation. Object URLs are revoked in `finally`.

### Privacy boundary

Bounce tuning is per-instance, in-memory, local authoring state. It must never appear in:

- `getSnapshot()`;
- `aero-game-event` records;
- iframe messages/commands;
- telemetry or `renderer.describe()`;
- score partitions, judgements, obstacle outcomes, content packages, package export, prototype profile bundles, history, ranking, or persistence;
- local/session storage, IndexedDB, cookies, URL, route, logs, upload, network requests, analytics, or crash payloads.

The only egress is Derrick's trusted local Save action. The only ingress is the trusted local picker. Tests may inspect private deterministic scene-model output and the downloaded artifact bytes, but production public surfaces remain value-free.

## Worked examples

### Constant 120 BPM

For `B = 32`, `L = 4`, BPM `120`, anchor `0`:

```text
H = 32 * 500 = 16,000 ms
S = 28 * 500 = 14,000 ms
D = 2,000 ms
apex time = 14,000 + 0.4 * 2,000 = 14,800 ms
```

With `h = 0.9`:

- at `14,000 ms`: offset `0`, Z `−12`;
- at `14,800 ms`: offset `0.9`, Z `−7.2`;
- at `15,500 ms`: `q=.75`, fall `u=.583333`, offset `0.9*(1-u²)=0.59375`, Z `−3`;
- at `16,000 ms`: offset `0`, Z `0` exactly.

A top-row cell at base `(x,2)` therefore rises to Y `2.9`; a Boxing Lane target rises from Y `1.1` to `2.0`. X and Z retain their existing meanings.

### Crossing a tempo change

Suppose BPM is `120` from beat `0`, changes to `180` at beat `16`, and the hit is beat `18` with lead `4`:

```text
F(14) = 7,000 ms
F(16) = 8,000 ms
F(18) = 8,666.666667 ms
D     = F(18) − F(14) = 1,666.666667 ms
```

Using only hit-local `180 BPM` would incorrectly choose `1,333.333 ms`. The canonical piecewise mapper avoids that drift and still lands at the already authoritative `8,666.666667 ms` event timestamp.

### Seek/late sample

If the renderer first sees the target halfway through its bounce, it evaluates the exact halfway position immediately; it does not replay takeoff. Seeking from `15,500` back to `14,800` in the example immediately restores the apex. Seeking past `16,000` yields zero approach offset and existing resolved/spent behavior.

## Architecture boundaries

### `aerobeat-web-content`

- Own the sole validated `F(beat)` implementation.
- Refactor current event timestamp derivation to use it.
- Validate ordered tempo segments, anchor, and any accepted stop-segment shape transactionally.
- Export the pure timing mapper through the package root if assembly needs it; do not expose bounce settings or renderer concepts.
- Preserve authoritative `centerTimestampMs`/interval timestamps and authored bytes.

### `aerobeat-web-assembly`

- Own per-connection default/current config, top-left Test controls, picker/download lifecycle, strict file-size/fatal-decode/current-generation checks, and privacy.
- Compute or request each eligible event's private `bounceStartMs` from authored beat plus content timing authority.
- Keep the existing note/guard/punch allowlist and pass `bounceStartMs` only on private render-target records.
- Expand indexed candidate selection from fixed `2,500 ms` to each target's bounded bounce interval without exceeding the existing 128-target cap.
- Never alter content, gameplay configuration, transport, session generation, scoring, or public presentation records when tuning changes.

### `aerobeat-web-renderer`

- Own strict config normalization/canonical serialization helpers if the renderer setter is authoritative; assembly may re-export/use that authority rather than duplicate it.
- Add a private visual setter that validates fully before atomic replacement.
- Apply the pure offset formula only in note/guard/punch target construction, after base lane/cell placement and independently of Z.
- Keep renderer manual cadence, culling bounds, camera, tint/removal/feedback, walls, bombs, and shadows otherwise unchanged.
- Do not report raw config values from `describe()` or diagnostics.

### `aerobeat-web-ui` and `aerobeat-web-contracts`

- No change required. The controls are assembly-owned Test authoring UI.
- Do not widen `aero-visual-test-transport`, public host commands/snapshots, session purpose, judgement, or iframe schemas.

### `aerobeat-web-gameplay`

- No change required.
- It remains sole lifecycle/judgement/scoring authority and never receives bounce config or coordinates.

## Implementation plan

1. **Central timing authority (content)**
   - Add table-driven pure tests for constant BPM, segment boundary, cross-segment backward lead, anchor, stop behavior if supported, malformed order/duplicates/non-finite values, song-start truncation, and 24-hour bounds.
   - Refactor resolved-event timestamp creation through the same mapper.
   - Demonstrate byte/order-equivalent timestamps for all current one-segment fixtures.

2. **Pure bounce model (renderer)**
   - Add strict v1 normalizer/serializer/default/bounds and easing functions.
   - Extend private render-target data with validated `bounceStartMs`.
   - Add Y only for eligible icons/guard pairs; preserve base X/Z, rotation, scale, shadow floor Y, and every exclusion.
   - Keep exact endpoint branches and absolute-time evaluation.

3. **Projection and private ownership (assembly)**
   - Retain timing context privately with the resolved-event index and derive bounded starts once per event/config identity.
   - Update candidate lookup for the maximum actual bounded start, not a blind global 2.5-second window.
   - Add per-instance config state and an atomic renderer apply seam with lifecycle/current-generation invalidation.

4. **Top-left Test authoring UI (assembly)**
   - Add the five native controls, separate bounce Reset/Load/Save, status output, and safe-area/scroll-aware styling.
   - Preserve all existing camera/environment controls and the 44px/focus/non-overlap contract.
   - Use separate authoring enablement so paused/terminal bounce tuning does not enable camera movement.

5. **Privacy/lifecycle/browser QA**
   - Run the matrices below in real Chromium direct and cross-origin iframe embeddings.
   - Independently audit exact public snapshot/event/message/storage/network absence and unchanged gameplay truth.

6. **Derrick lock-in loop**
   - Deliver the default v1 JSON.
   - Derrick tests, exports, edits if desired, and returns the v1 file.
   - Validate/import the returned file without migration or silent coercion.
   - Record explicit approved values in the active plan before any immutable successor/release work. A returned file is tuning evidence, not by itself release or physical approval.

## Real-browser QA matrix

### Deterministic model/trajectory oracle

For each eligible type (Flow directional, Flow directionless, Boxing directional punch, Boxing any punch, standard guard, crossed guard) and excluded type (bomb, Flow wall, squat, weave, arc, burst):

- sample exact `S−ε`, `S`, rise midpoint, apex, fall midpoint, `H−ε`, `H`, `H+ε`;
- assert eligible Y against independently coded formulas to `1e−6` world units;
- assert X/Z/rotation/scale/material/event IDs are byte/value-identical to bounce-disabled output except intended Y;
- assert `z(H)=0`, `offsetY(H)=0`, and both guard instances have identical Y/Z;
- assert excluded scene objects are byte/value-identical at every sample;
- run 30/60/90/120/144 Hz sampled timelines and irregular dropped-frame schedules; equal song times must produce equal model values;
- cover constant BPM, exact tempo boundary, lead crossing one/multiple changes, anchor, supported stops, song-start truncation, and 10-second safety limiting.

### Actual PlayCanvas pixel/visual oracle

Use production GLBs and actual PlayCanvas in real Chromium:

```text
embedding: direct, genuine cross-origin iframe
presentation: Flow, Boxing Lanes, Boxing Grid
viewport: 390×844 portrait, 844×390 landscape, desktop 1440×900
requested DPR: 1, 3 (assert renderer cap)
background: representative bright Aero, dark Aero, retained mirrored Camera
camera: canonical fixed pose, reviewed debug pose
config: default, zero height, max height, early apex, late apex,
        each rise/fall easing
```

Capture raw framebuffer screenshots at start/rise/apex/fall/landing. Assert non-background target pixels, unchanged grid/lane/track/wall/bomb pixels for exclusion rows, visible target silhouette/white stroke, stable handed colors, and exact landing centroid at the prior no-bounce success-center centroid within one physical pixel. Use per-object projected centroid/GLB-root world diagnostics rather than screenshot appearance alone for depth truth.

Readability acceptance:

- no eligible apex clips at canonical camera for the default config in any required viewport;
- no overlap with top-right menu or top-left control panel at landing; temporary distant-path overlap is documented rather than moving gameplay coordinates;
- track/timing rows remain legible and stationary;
- dual guards remain recognizable as a synchronized pair;
- white success tint and stroke remain distinguishable through landing;
- reduced-motion preference does not silently change gameplay presentation timing unless Derrick separately requests that product policy.

### UI/schema/privacy oracle

- Keyboard, mouse, touch, and screen-reader names for every control/action; 44px targets, visible focus, correct units/ranges, collapse retention, and portrait/landscape no-overlap.
- Deterministic export bytes/name/MIME/key order/LF; import the export and reproduce values exactly.
- Accept exactly 16 KiB; reject 16 KiB + 1, malformed/fatal UTF-8, malformed JSON, wrong schema/version, missing/extra/symbol/accessor/hidden/prototype keys, arrays/classes/proxies/null prototypes, numeric strings, `NaN`/infinity direct calls, out-of-range numbers, and unknown easing.
- For every rejection, compare pre/post config, renderer model, control values, and exported bytes for atomic identity.
- Search public snapshot, composed events, iframe traffic, renderer telemetry, storage, IndexedDB, URL/history, console, fetch/XHR/WebSocket, and package/profile exports for schema name, filename, keys, and sentinel values; require zero leakage/network/storage writes.
- Multi-instance test: import different sentinel configs into two elements, render distinct paths, disconnect one, and prove no cross-instance mutation.

### Lifecycle oracle

Run default and imported configs through:

- playing → manual pause → tune → backward seek → remain paused → explicit Play;
- rapid/coalesced scrubs across pre-start, apex, and post-hit times;
- hidden/visible transition; assert frozen authoritative time means frozen bounce;
- menu open/close active pause versus terminal close; no implicit resume;
- natural completion → tune while terminal → backward seek to `paused_manual` → play;
- exact-duration Play causing a fresh zero-time Visual Test generation;
- Test restart, Test→Start, Start→Test, gameplay/difficulty/song/conversion changes, and the repaired serialized lifecycle intent drain;
- WebGL context loss/restore;
- picker pending during pause, menu open, hidden, package change, restart, disconnect, destroy, and reconnect; every stale completion must be discarded;
- reconnect default reset and separate-element isolation;
- zero extra camera/CV/media-lease acquisition, zero judgement/score/obstacle mutation, and zero unexpected console/page/WebGL noise.

### Gameplay non-mutation oracle

Run deterministic gameplay replays with bounce default, zero, maximum, and imported sentinel configurations. Require exact identity for:

- session state/purpose/generation/timeline;
- all hit/miss/ignored judgements and `committedTimelinePositionMs`;
- score partitions, combo, obstacle outcomes, active/judged event IDs;
- audio clock, seek/pause/restart ordering, media lease, calibration/input evidence;
- resolved event arrays, authored beat objects, package/chart hashes, variants/modifiers, and public event/snapshot bytes.

Only private scene-model Y and private authoring state may differ.

## Acceptance criteria for implementation

- Every note/guard/punch cue uses the pure beat-relative rise/fall and is at base X/Y plus Z `0` at its authoritative timestamp.
- Bombs and every obstacle/checkpoint/wall presentation remain static in Y.
- Tempo changes use one content-owned mapper; no local-hit-BPM approximation or duplicate timestamp authority exists.
- Pause/seek/restart/late frames are analytic and history-free.
- The five bounded defaults and strict v1 JSON round-trip atomically through accessible top-left Test controls.
- Tuning remains local/private and cannot affect gameplay or public contracts.
- Real Chromium trajectory, pixel, UI, privacy, lifecycle, and gameplay-equivalence matrices pass independently.
- Derrick returns/approves exact v1 values before lock-in. The `smt` and `3dc` Beads remain open after this report.

## Non-goals / explicit prohibitions

No production or test implementation in this research slice. No asset edit, easing animation asset, physics/spring simulation, randomization, score/collision/timing rewrite, public tuning API, host/iframe command, storage, telemetry, upload, release build, raw mutation, serving change, tag, publication, or physical claim.

## Implementation evidence — CODER PASS (2026-09-07)

- Renderer commits `37f0679`, `54a5ae0`, and `6a0606e` implement the strict deeply frozen v1 normalizer/serializer, atomic private setter/reset, analytic endpoint-exact offset, allowlisted Flow/punch/guard +Y composition, static shadows/exclusions, actual PlayCanvas pixel samples, and no diagnostic exposure. Final renderer identity after the exact 40-file pack-oracle correction is commit `b4e69b5fa44002b5bc7d16e0c112d25e536d7229`, tree `88a59103344b6dde1dacb249688931aea7925b77`.
- Assembly uses the already-landed canonical content mapper against authored `start`, requires `abs(mappedHit-centerTimestampMs) <= 0.001`, derives start through tempo/anchor/stops with song-start truncation and a 10-second cap, and retains mismatch targets on the straight static approach. Indexed lookup covers the bounded interval without exceeding 128 targets.
- The top-left Visual Test body now owns separate camera and bounce enablement, five labeled bounded controls, Reset/Load/Save, deterministic filename/MIME/key-order/LF/trailing-LF bytes, fatal UTF-8 and exact 16-KiB admission, trusted child-local activation, atomic normalization, URL cleanup, bounded status, 44px/focus/internal-scroll/safe-area behavior, and connection/session/graph/purpose/lifecycle picker ownership. State is per connected instance, memory-only, reset on disconnect/destroy, and omitted from snapshots/events/messages/storage/packages/telemetry/network.
- Focused renderer model/type and actual PlayCanvas pixel tests passed. Renderer Chromium suite and final full `npm test` passed after the concurrent gameplay-asset release landed cleanly; exact dry pack contains 40 files including the new boundary and unchanged 17 gameplay members.
- Assembly focused projection, strict controls direct/genuine-iframe matrix, standalone mobile, all-eight product-shell/24-camera matrix, full `npm test`, production build, raw immutability/mutation, privacy/provenance fingerprint, release-target/pack-policy, and 121-file dry pack passed. The first aggregate browser run stopped in the known host-sensitive mobile fixture with a transient undefined audit pose owner; the unchanged standalone mobile suite immediately passed and the complete shell matrix passed without timing relaxation.
- This is coder evidence only. No raw successor, asset successor, tag, publication, serving change, or physical approval was created; `lmgt` remains open for independent QA/audit.
