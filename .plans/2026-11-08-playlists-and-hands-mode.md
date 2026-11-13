# Playlist library and hands-mode UI

Status: DESIGN REOPENED 2026-11-12. The visual direction and the UI runtime (DOM, PlayCanvas, or hybrid) are being explored again; see "Revised direction" below. The static prototype in `design/hand-ui/` proved that two-wrist selection works, not that its look or its DOM runtime are final. Playlist data work (slice 1) is unaffected. Owner Pico; assembly repo.

## Revised direction (2026-11-12, from Derrick)

- **Who and how.** Athletes stand in their living room and play with their full body, tracked by webcam. Wrist tracking is the primary menu input; mouse and touch are supported but secondary.
- **First session.** Most people open the URL, enable the camera, stand up, and want to get into the workout of the day or a recommendation quickly. Search, the library and custom playlists are for regular athletes.
- **Interactables per screen are a budget.** Every target costs arm movement and accuracy, so screens hold few of them. Less common options live behind one recurring settings or advanced control, so they still exist somewhere.
- **A shared design language is needed.** Screens and panels need one transition and one recurring set of shapes and behaviours. That language depends on three open choices: the hand interaction itself, whether the UI moves into PlayCanvas, and which flavour of Frutiger Aero (plus any motif paired with it) we pick.
- **Runtime decided: world-space UI in PlayCanvas** (Derrick, 2026-11-12). Screen-space HTML/CSS is quick but wrong for the direction: the same world-space UI can later serve WebXR VR play and a camera-only console without writing the UI twice. DOM remains acceptable only where a later decision says so (for example dense text entry), not as the default.
- **First comp feedback (Y2K early-CG, 2026-11-12).** Strong contender with more iterations. The extra "keep holding" beat after the hold on the hero feels like a reward, keep the idea. Transitions good. Slow first load noticed. Derrick may gather outside opinions before choosing.
- **Style comps running.** Six parallel subagents each build the same home screen in one direction under `design/style-comps/<name>/`, against the shared brief and harness in `design/style-comps/` (commit `a7110ab`). The harness ports the two-wrist rule to world space so comps differ only in look.
- **Style exploration.** Render the same single screen in several directions and compare. Candidate directions from Derrick: 2000s skeuomorphism (Winamp-style physical design, scaled up for wrists); Wii-era big-button design; PS3-era bright bubble worlds (the PSN rubber duck bathtub-in-the-sky game); Dreamcast-era vibrant water and beaches (Sonic Adventure, Mario Sunshine); recent AI-community Frutiger Aero remixes; Y2K early-CG render style (Bejeweled on PSN, trapper-keeper art).
- **Generated maps.** Every BeatSaver song gets bsgen-generated maps for the difficulties its mapper did not include. The UI must mark which maps are official and which are generated. A filter can exclude generated maps; it is on (generated included) by default.
- **First-session flow (agreed 2026-11-12).** URL → Welcome (turn on camera; mouse/touch) → Calibration (athlete T-poses; builds the gameplay grid, which is stored and used both for gameplay and for mapping wrists to menu cursors) → "New to AeroBeat?" when no profile is found (tutorial for Flow and Boxing, or straight to Home) → Home → Playlist preview → Countdown → Song → Between songs → Results.
- **Every playlist opens the same preview screen**, whether it is the playlist of the day, a recommendation or a saved playlist. It confirms the choice, lists the songs, and may let the athlete sample each song (BeatSaver preview clip).
- **Difficulty is a single choice, remembered.** Selecting a difficulty means that difficulty; the game remembers it. Default is Easy. Ordered preference lists and the AI-generated-maps toggle move to settings only if they survive design. This supersedes decision 4's preference-list UI.
- **Guests.** Without a profile the athlete is a guest and sees the playlist of the day plus safe recommendations, with an option to sign in.
- **Pause during play** is a wrist-selectable control in a screen corner (top right proposed). Today's bottom panel (pause, seek, calibration, volume, fullscreen) is useful but not wrist-friendly.
- **Attract/loading screen first (2026-11-12).** Shown while MediaPipe and the first media assets download (instant when cached). Its camera-permission click is the session's one real user gesture, so it also unlocks audio and enters fullscreen. It must handle a denied or missing camera: AeroBeat cannot be played on the web without a webcam (or WebXR), so the screen explains how to fix it.
- **Attract flow agreed (2026-11-12).** Phase 1: tiny first paint, one "Turn on camera" target plus a few poke-able toys, pose model downloading immediately, real progress shown in-scene. Phase 2: live camera feed styled into the scene with a warm-up prompt while pose loads; camera problems and "can't see you" handled here. Phase 3: wrist markers on the athlete's real wrists and a practice two-wrist target that teaches selection, then T-pose. Fast path when cached. Prototype in a neutral style under `design/attract-flow/`, reskinned once a direction is chosen.
- **Corner UI is acceptable during play.** Two-wrist overlap plus hold makes accidental selection unlikely, and Flow/Boxing rarely drive a wrist to a screen edge. Pause goes in a corner with no special exclusion zone. This must be confirmed by early playtests.
- **Corner check result (2026-11-12, `design/corner-check/RESULTS.md`).** Replaying a real Expert Flow recording: zero accidental selections in any corner at 120–180 px with a 520 ms hold; both wrists first met in a corner only at 400–500 px targets. Top-right Pause with the normal hold is supported. Re-run on Boxing and more songs when recordings exist.
- **Four input methods, one UI (2026-11-12).** Every screen works with wrists (webcam), mouse, touch and XR controller pointers, all in the same world-space style. Screens that come before pose tracking (attract, camera picker) look the same as the rest of the game; they just can't rely on wrists yet. Boxing stays mostly in the centre of the grid, so corner UI during play is settled.
- **XR vs webcam routing, no question asked.** Check `navigator.xr.isSessionSupported('immersive-vr')` silently while loading, plus the browser's identity. Standalone headset browser (Quest, Pico, visionOS): attract screen leads with Enter VR, no camera picker or T-pose. Desktop with XR supported (tethered headset): normal webcam flow with a secondary Play in VR target, remembering the last choice. No XR: webcam only. Entering XR always needs one real click. XR calibration is a quick height and reach check, not a T-pose.
- **"Can't see you" prompt.** If the selected camera gives frames but no body appears within a few seconds (virtual camera, black or frozen feed), prompt the athlete to try another camera.
- **Camera selection on the attract screen.** Athletes may have several cameras, including virtual or broken ones (OBS, Oculus); the attract screen must let them choose which camera to use.
- **Server.** Community totals and profiles need a backend; Derrick will connect his AWS environment.
- **Calibrate every session.** The athlete T-poses at the start of each session even if a calibration is stored. It takes a moment and avoids menu and gameplay errors from a stale grid.
- **Effort over score.** Dynamic difficulty is worth losing comparable scores. Direction: lead with an effort measure (calories estimate from wrist and head movement speed and distance), still show score but do not reinforce competition, and replace per-player leaderboards with a cumulative community total per song and playlist ("what we all added together"). Anti-abuse is a later problem.
- **Future idea: dynamic difficulty.** Start from the chosen difficulty, then splice sections of neighbouring difficulties based on in-playlist performance, up to Expert+, to keep the athlete in flow (Supernatural VR did similar with speed and note visibility). bsgen filling every difficulty is what makes this possible. Not scheduled.
- **Later, not now.** Athlete profiles showing progress, possibly connected to fitness apps. Monetization is explicitly out of scope; the core game is free.

## Outcome

AeroBeat gains a Playlist concept beside the existing Library, plus a wrist-driven UI input mode. Playlists can be imported from BeatSaver or built locally, played as a continuous session with a two-cover next-song choice, and filtered by an athlete's difficulty preferences. Hands mode lets either wrist hover a DOM element and both wrists select it.

## Decisions from Derrick

1. BeatSaver import uses the paginated `/api/playlists/id/{id}/{page}` endpoint, not `.bplist`, so memory stays bounded. Same bounded-memory discipline as the recording work.
2. Songs and playlists show cover art thumbnails. A playlist renders as a Vista-era folder icon with its member thumbnails visible inside it.
3. Import is membership-first: names and metadata land immediately, thumbnails lazy-load as the list scrolls. "Download all" is an explicit action, never automatic.
4. Difficulty is an ordered preference list per athlete (for example Expert, then Hard). It acts as a filter over song data views, and songs with no acceptable difficulty are skipped. The same difficulty filter applies to BeatSaver search results.
5. Playlist membership is a snapshot. Refresh is optional and rewrites the snapshot.
6. Playlists support shuffle.
7. End of a song in a playlist: the score rises from 0 to the earned score at top center, then two album covers appear with artist and song name beneath. Choosing one plays it. Mouse click or wrist click selects. With no input, one is auto-selected on a visible countdown.
8. Search and other text inputs get a microphone button for hands-mode compatibility. An on-screen keyboard popup is a later addition.
9. ~~UI stays in the DOM.~~ Replaced 2026-11-12: menus are world-space UI in PlayCanvas. Still settled: each wrist independently activates hover, and both wrists over the same element are required to select.
10. Camera runs while the menu is open. The current UI is mouse/touch-sized, so hands mode needs real visual design iteration before it can feel good.
11. A recommended playlist appears on the home page, rotating daily from playlists we prebuild or generate, later themed to movie, game and holiday releases.

## Slices

**Slice 1 - playlist data and library (buildable now).** Playlist record type, BeatSaver paginated import of membership, local playlist creation from the library, snapshot refresh, scope selector between Library and playlists, cover thumbnails with lazy loading and a bounded cache, difficulty preference list and shared song filter. No camera, no playback changes.

**Slice 2 - continuous playlist play.** Playlist queue honoring order or shuffle, per-song difficulty resolution from the preference list, skip songs with no acceptable difficulty, prefetch the next candidate during play, end-of-song score rise and two-cover choice with countdown auto-select, mouse and touch only.

**Slice 3 - hands mode.** Blocked on Derrick's visual design. Wrist-to-DOM pointer layer, independent hover per wrist, two-wrist select, camera lifecycle while the menu is open, opt-in toggle, mouse and touch preserved as fallback.

**Slice 4 - recommended home playlist.** Needs its own curation decision: who authors the playlists, where they are stored, and how daily rotation is delivered.

## Open questions (with my recommendation)

Two-cover semantics. My recommendation: draw two candidates from the remaining pool, honoring playlist order when shuffle is off and drawing randomly when it is on. The chosen song plays and leaves the pool; the other returns to the pool rather than being discarded. Needs confirmation.

Countdown length. Five seconds may be tight for an athlete who is out of breath and must raise both wrists into frame after a song. I recommend starting at 8 seconds or making it a preference. The countdown is a fallback, not a decision.

Difficulty resolution. I read the preference list as resolving per song: use the first preference the song offers, and skip the song if it offers none. That means one playlist can play different difficulties song to song. Confirm this is intended rather than one fixed difficulty for the whole run.

Microphone scope. Browser speech recognition is Chromium-centric, network-dependent for most languages, and adds a third permission surface beside camera and storage. I recommend deferring it past slice 2 so it does not block playlist delivery.

## Non-goals

No change to scoring, judgement, recording or Test replay. Playlists sequence songs; each song remains one normal session with its own unchanged scoring identity. No upload of athlete data. No live playlist sync. No monetization.

## Risks

Cover art storage grows with library size; needs a bounded cache with eviction, not unbounded caching.

A playlist referencing maps the athlete does not own is the normal case, not an error. The UI must show unowned entries honestly and offer explicit download.

Hands mode adds a camera-on-while-browsing lifecycle. Battery, model load time (a few seconds before the first usable pose) and privacy all need explicit UX, and the mode must be opt-in with mouse and touch always available.