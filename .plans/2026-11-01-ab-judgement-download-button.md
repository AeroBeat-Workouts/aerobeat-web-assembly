# A/B judgement capture: "Download Data" button in the menu drawer

Status: APPROVED — rebuild correction in progress (Derrick authorized authentic pre-spline rebuild).

## Current action — 2026-11-03

Owner: Pico. Bead: aerobeat-web-assembly-3g45. Goal remains active; maximum rounds: Maximum safe integer.

The first .149 probe build was invalid: it retained the old assembly label but linked current dependencies, including post-spline gameplay 20a1697. Derrick's two captures therefore do not compare pre-spline against post-spline. The original .149 manifest pins gameplay 6f5d6a6, contracts 43ec0a4, input 31c96a3, renderer 94f1a06 and content-authoring 9edce4c.

Next acceptance check: build in an isolated sibling-repository layout with all fourteen dependencies at the original manifest commits; compare every non-assembly commit/tree/source digest to the original manifest. No scoring changes. Repair missing difficulty and nested collider options; exercise an actual completed-run browser download before deployment. Keep current build gates unchanged. Document corrected services and commits after serving existing routes.

Deferred report: aerobeat-web-assembly-5fgy tracks Derrick's Boxing 100% repeated-punch switch-hand observation; do not fix it during probe work.

Diagnostic record: observed .149 probe stamp 480a4d9554943b4bf13ba454 includes gameplay 20a1697 instead of 6f5d6a6. Root cause is shared current node_modules/sibling links during backport. Prior verification checked only the version label/button and missed dependency identity. Corrective action is isolated original-commit dependency worktrees. Remaining uncertainty: the real playability regression is not yet diagnosed.

## Goal

Give Derrick a one-press way to export what the game judged during a song, so the `.149`
vs `.153` hit-rate question can be settled from real sessions instead of synthetic tests.

Today that requires pasting a script into the DevTools console. That is friction on a
handheld, and it has already gone wrong once (a probe on a page whose service had died).
A button removes the console step entirely.

## What Derrick asked for

- A **Download Data** button at the top of the menu drawer, beside the version label.
- It becomes pressable only once data exists and is ready.
- Pressing it downloads a file to the Downloads folder.
- The file records: build version, song name, song id, difficulty, and every option
  selected for the run, alongside the per-note judgement records.
- Shipped on **both** builds (`.149` pre-spline and `.153` current), served at the
  existing public links.

## Sequence this must be added to

This button is an observation instrument for a specific comparison. It is not a general
product feature. Two rules follow:

1. **Remove it after the comparison.** Leaving a data-export control in a public game
   build is scope creep and a small privacy surface (it captures the player's own session).
2. **It must not change gameplay.** It reads the existing gameplay snapshot; it never
   writes to session state, never alters scoring, never touches timing.

If it turns out useful beyond this comparison, that is a separate proposal.

## Design

### Placement

The drawer header is a single line in `src/index.js`:

```html
<div data-role="drawer-surface" class="drawer-surface">
  <p class="drawer-version" data-role="app-version"></p>
  <aero-session-actions class="start-action"></aero-session-actions>
```

The button is added immediately after the version paragraph, inside a small flex row so it
sits inline with the version number. It uses the existing drawer button styling; no new
visual language is introduced.

### Enabled state

The button is `disabled` until the session has at least one judgement **and** the run has
finished (session state `completed`), so a partial mid-song export cannot be mistaken for a
complete one. Before that it reads `Download Data` and is visibly disabled. Once ready its
label becomes `Download Data (N notes)` where N is the judgement count, so Derrick can see
it captured something before pressing.

### Payload

One JSON file, downloaded as `aerobeat-ab-<version>-<songId>-<difficulty>.json`:

```json
{
  "schema": "aerobeat/judgement-capture",
  "version": 1,
  "capturedAt": "<ISO timestamp>",
  "build": { "version": "0.0.153", "buildStamp": "...", "cacheBust": "..." },
  "song": { "name": "...", "id": "...", "difficulty": "...", "chartId": "...", "packageId": "..." },
  "mode": { "rulesetId": "flow", "purpose": "play", "ranked": false },
  "options": { "colliderScale": 1, "colliderDepthForward": 1,
               "colliderDepthBackward": 1, "colliderDepthBackwardAthleteFacing": true,
               "timingWindowMs": 150, "directionToleranceDegrees": 45,
               "<other run options verbatim>": "..." },
  "summary": { "total": 0, "byResult": {}, "sampleCount": 0, "meanSampleGapMs": 0 },
  "judgements": [ { "eventId": "...", "result": "...", "tier": "...",
                    "diagnostics": [], "timingOffsetMs": 0,
                    "beatCenterTimestampMs": 0, "committedTimelinePositionMs": 0 } ]
}
```

Options are copied from the snapshot's collider settings and game setup verbatim, so the two
runs can be proven to have used identical settings — that is the whole point.

### Implementation surface

- `src/ab-judgement-capture.js` (new): builds the payload from a gameplay snapshot plus
  game-setup/collider settings. Pure function, no DOM, no download.
- `src/index.js`: render the button, wire its enabled state to the snapshot, and perform
  the download via a Blob + object URL.
- One focused source test for the payload builder (schema, options echo, judgement mapping).
- One browser check that the button is disabled before a run and downloads valid JSON after.

### Serving

Both builds need the button, and each is currently a frozen signed snapshot:

- `.153`: rebuild from assembly source at `6aa7422` + this change, new snapshot
  `.tmp/boxing-ab-<commit>`, served on 4216 via `aerobeat-r153`, public 443.
- `.149`: this is harder. `.149` is a signed snapshot built from assembly `ae07836`, and
  rebuilding it means repinning the old dependency set. I will rebuild it from the `.149`
  pins **plus** this change, producing a new snapshot with the same gameplay code as
  `.149`. Its version string stays `0.0.149` so capture files self-identify, and I will
  record the exact source identity in the README so the provenance is unambiguous.

If rebuilding `.149` proves to disturb its gameplay pins in any way I cannot verify, I stop
and report rather than serving a build I cannot vouch for.

## Acceptance

1. Both public links serve their expected version with the button present at the drawer top.
2. Button is disabled with no data; becomes pressable after a completed run.
3. Pressing it downloads a JSON file whose `build.version`, `song.id`, `song.difficulty` and
   `options` match what Derrick selected, and whose `judgements` match the in-game results.
4. Gameplay is unchanged: existing signed regressions still pass on both builds.
5. Derrick plays one song per build and presses the button; I diff the two files.

## Non-goals

- No automatic upload, no network call, no telemetry. The file lands in Downloads only.
- No change to scoring, colliders, timing, or difficulty.
- No new developer-facing settings screen.
- The button is temporary; a removal Bead is filed alongside this plan.

## Risks

- `.149` rebuild is the main risk: repinning an old snapshot can silently shift a
  dependency. Mitigated by verifying version strings and running that build's existing
  signed checks before serving.
- The button adds one control to a shipped UI. Kept to the drawer header and existing
  styles so it cannot obscure gameplay.