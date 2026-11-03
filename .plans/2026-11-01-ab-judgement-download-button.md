# A/B judgement capture: "Download Data" button in the menu drawer

Status: CORRECTED PROBES LIVE — waiting for valid physical-play captures. Overall playability investigation remains active.

## Current action — 2026-11-03

Owner: Pico. Bead: aerobeat-web-assembly-3g45. Goal remains active; maximum rounds: Maximum safe integer.

The first .149 probe build was invalid: it retained the old assembly label but linked current dependencies, including post-spline gameplay 20a1697. Derrick's two captures therefore do not compare pre-spline against post-spline. The original .149 manifest pins gameplay 6f5d6a6, contracts 43ec0a4, input 31c96a3, renderer 94f1a06 and content-authoring 9edce4c.

Next acceptance check: Derrick refreshes both existing pages, plays the same song/difficulty and exports both completed runs. Compare new files identified by corrected stamps below. Do not interpret old captures as a pre/post-spline comparison. Dependency isolation, metadata repair, signed download checks and public deployment verification are complete. No scoring changes.

Deferred report: aerobeat-web-assembly-5fgy tracks Derrick's Boxing 100% repeated-punch switch-hand observation; do not fix it during probe work. Historical test compatibility is filed as aerobeat-web-assembly-7edx (P3, safe to defer; no product-scoring change needed). Rebuild Bead 3g45 is closed; physical comparison and the overall goal remain open.

Source retention: current probe assembly commit 33d565d; pre-spline probe commit 6628d21 retained by tag `probe-r149-authentic-20261103`. Deployment docs follow the build commits and do not imply a rebuild of those frozen artifacts.

Diagnostic record: observed .149 probe stamp 480a4d9554943b4bf13ba454 includes gameplay 20a1697 instead of 6f5d6a6. Root cause is shared current node_modules/sibling links during backport. Prior verification checked only the version label/button and missed dependency identity. Corrective action is isolated original-commit dependency worktrees. Remaining uncertainty: the real playability regression is not yet diagnosed.

## Corrected rebuild evidence

- Isolated layout: `.tmp/authentic149/`, assembly on pre-spline ae07836 plus probe-only changes (6628d21); every package has its own original-commit worktree and isolated local package links.
- All fourteen non-assembly commit/tree/source digests compare equal to original `boxing-r149-ae07836`. The current probe's fourteen dependencies also match original `boxing-r153-6aa7422`.
- Corrected captures read difficulty and provider map ID from content lineage. They preserve the complete run-locked Game Setup, including nested Flow/Boxing/knee volume settings, and expose the active mode's depth/scale at the top level.
- Both signed builds pass `validate-ab-capture-browser.js`: existing fake camera/audio/content fixture, real input/coordinator, real committed judgement and completion, native menu download click, downloaded JSON parsed and compared against judgement truth. Changing next-run scale after completion does not rewrite the finished run's settings. This is export proof, not physical phone playability proof.
- Current `npm test` and 8 focused capture tests pass. Historical `check` passed. Its full unit chain cannot be reported green: (1) clone-provenance test restores today's main renderer rather than the historical clone's initial commit, (2) Vite's shared tooling adds an external client root to the isolated development-server allowlist, (3) shared-hash provenance requires current public main, incompatible with original content-authoring 9edce4c. Remaining historical unit commands passed individually. Missing asset-source links were supplied without product changes. No gate was weakened.
- Live snapshots: `boxing-r149-verified-probe-6628d21` (stamp `FRIEND-GAME-CPU-0.0.149-bb26fd6c889f95b0c482ebaf`) and `boxing-r153-verified-probe-33d565d` (stamp `FRIEND-GAME-CPU-0.0.153-f2d26b97608cf1dcbee4e712`). Specific `-abprobe` systemd units now use these snapshots on the unchanged ports 4212/4216. Public TLS browser checks confirmed exact HTML bytes and entry-JavaScript hashes plus visible disabled idle buttons on 8449/443. Original snapshots remain untouched.

## Capture interpretation — follow-up while awaiting replay

Only the original two invalid-baseline files were present in Downloads on this check. Their miss counts are .149-labelled: 253 wrong_direction + 3 near_timing; .153: 229 wrong_direction + 2 near_timing. These are not valid pre/post-spline comparison results.

Critically, current gameplay `colliderMissDiagnostics` (session-coordinator.js, lines 1648–1653) emits wrong_direction for any expired directional note with fresh input and authored-direction enforcement, without establishing contact or a failed direction predicate. Therefore the code cannot distinguish no-contact from a true direction rejection. Earlier promises that exported diagnostic codes would directly identify the cause were too strong. Filed aerobeat-web-assembly-cqs7. Do not change live builds mid-replay or weaken direction enforcement based on this label.

The previously omitted content-authoring delta 9edce4c -> 505faf0 changes the per-entry source cache allowance from 2 MiB to 8 MiB plus a moved type comment; it does not alter conversion/judgement algorithms. This observation does not rule out other real-session causes.

## Diagnostic report — incorrect pre-spline baseline

**Observed failure:** Derrick reported both probe versions felt similarly bad. The .149 capture identifies stamp `480a4d9554943b4bf13ba454`; its build manifest pins post-spline gameplay 20a1697, not original 6f5d6a6.

**Expected:** old assembly plus observation-only UI, with all original dependency identities preserved.

**Execution path:** backport assembly -> shared current node_modules/sibling repositories -> Vite alias resolution -> signed current gameplay dependencies -> old package-version label. The build gate correctly recorded the inputs; the operator compared only the label and button, not the recorded dependency pins.

**Root cause:** incorrect dependency isolation in the earlier backport. This explains why that build was not a valid pre-spline baseline; it does not establish the root cause of the reported playability regression.

**Alternatives:** settings, tracking cadence, user motion, cached content and collision logic remain candidates for the playability report. They cannot explain the demonstrated wrong dependency pins. No claim that the .149 probe and .153 probe were behaviorally identical: the older assembly wiring still differed.

**Why prior checks failed:** a green version label, visible button and helper-unit test cannot verify dependency identity. Earlier button tests also attempted writes into frozen service objects and supplied fake shapes that omitted real nested settings and content lineage.

**Unknowns/minimal reproduction:** the physical regression remains unresolved. Repeat one same-song run per corrected build after refreshing both pages, then export. Do not use the earlier two files to decide rollback.

**Verification/fix:** exact manifest comparison across all fourteen dependencies plus a built native-download test using real coordinator outcomes. Only repair build isolation and observational capture fields; do not alter scoring.

Problem: invalid A/B baseline. Observed symptom: rebuilt .149 uses new gameplay. Root cause: shared current dependency links. Evidence: original and rebuilt manifests. Failed approach: version-label-only acceptance. Corrective action: isolated original-commit worktrees. Verification: all dependency identities equal; actual downloaded payload matches real committed outcome. Remaining uncertainty: physical playability regression.

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