# Playlist library and hands-mode UI

Status: DESIGN AGREED IN PRINCIPLE; slice 1 not yet approved to execute. Derrick is designing the hands-mode visual language; playlists are buildable now. Owner Pico; assembly repo.

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
9. UI stays in the DOM. A cursor layer maps wrist landmarks onto DOM elements. Each wrist independently activates hover; both wrists on the same element are required to select.
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

No change to scoring, judgement, recording or Test replay. Playlists sequence songs; each song remains one normal session with its own unchanged scoring identity. No upload of athlete data. No live playlist sync. No engine-rendered UI while the DOM path proves out the interaction.

## Risks

Cover art storage grows with library size; needs a bounded cache with eviction, not unbounded caching.

A playlist referencing maps the athlete does not own is the normal case, not an error. The UI must show unowned entries honestly and offer explicit download.

Hands mode adds a camera-on-while-browsing lifecycle. Battery, model load time (a few seconds before the first usable pose) and privacy all need explicit UX, and the mode must be opt-in with mouse and touch always available.