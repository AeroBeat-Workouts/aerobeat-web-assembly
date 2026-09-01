# Post-session menu stability repair

## Exact observed failure

On the unchanged source baseline, the new Chromium held-pointer reproduction opened the drawer after a completed Visual Test, started playback-only publication every 8 ms, and physically held the Song B native radio for 140 ms. Before pointerdown could reach the captured node, the node had already been detached:

- `playbackPublishCount: 19`
- `presenterCommitDelta: 228`
- `pointerDown: false`, `pointerUp: false`
- `isConnectedAfterHold: false`, `currentIsOriginalAfterHold: false`
- no `library-select` intent
- selected package remained `song-a-easy`
- drawer `scrollTop` was `607`

The exact failing command was `node scripts/validate-mobile-gameplay-menu.js`; the assertion named completed Visual Test song/difficulty/Gameplay/Conversion stability.

## Expected behavior

Playback synchronization may publish only truthful bounded changes. Playback-only updates may update runtime/transport truth but must not reconstruct menu presenters. Exact equivalent presenter snapshots must preserve native control identity and focus. A genuinely selected song, difficulty, Gameplay mode, or Conversion may then commit its necessary state while preserving drawer position through the held pointerdown → pointerup → change transaction.

## Execution path and root cause

1. The display loop calls `AeroGame.syncContentPlayback()` at the bounded content cadence.
2. `AeroContentRuntime.setPlaybackState()` previously rebuilt and published a ready snapshot even when state, position, judged IDs, and active IDs were unchanged.
3. Assembly's content subscription treated every publication as menu-presenter data and called `renderPresenters()` while the drawer was open.
4. Every presenter accepted equivalent data and rebuilt its shadow subtree with `innerHTML`.
5. The held native target was detached before the physical pointer transaction completed, so no live composed `change`/intent reached assembly. Repeated focus restoration also disturbed the user's scroll anchor.

This was not a disabled-state, stale-generation, input-device, or iframe-schema defect.

## Corrective action

- Content compares exact playback state/position and set-equivalent bounded judged/active IDs before publishing.
- Assembly signatures content data with only `playback` omitted and routes playback-only publications to runtime presentation, not full menu presenters.
- UI presenters narrow first and skip rendering when the resulting immutable data is structurally equivalent. The compact library preserves optimistic state on an equivalent host snapshot.
- The browser regression records publication count, presenter commits before pointerup/change, drawer scroll, native identity/connectivity at pointerdown/up/change, composed intent, and final package/ruleset/recipe after completed Visual Test and completed Play.

No periodic `scrollTop` setter, truthful-update suppression, public snapshot/event/iframe expansion, or broad presenter rewrite was added.

## Verification contract

The repaired test requires, for Song, Difficulty, Gameplay, and Conversion after both completed session types:

- physical pointerdown, 140 ms dwell, and pointerup;
- the same connected native control at pointerdown, pointerup, and change;
- unchanged drawer `scrollTop` through change;
- zero full presenter commits before pointerup/change despite multiple playback publications;
- one matching bounded UI intent;
- exact final `song-b-hard`, `boxing_semantic_track_v1`, and `cut_family_source_height_v1` truth.

The wider product-shell matrix remains responsible for direct/real-cross-origin iframe, portrait/landscape, DPR 1/3, pointer capability, lifecycle, privacy, and console-noise coverage.
