# Hand-UI iteration prototype

Two static screens for arguing about the couch UI before any of it becomes product code. Nothing here imports game code, starts a song, or touches the camera.

## Viewing it

Open `index.html` directly in a browser. No build, no server, no dependencies.

- `index.html` — the couch home: playlist of the day on the left, three recommended playlists in the centre, search across the top, library on the right.
- `playlist.html?p=<label>` — the confirmation screen reached by choosing any playlist.
- `preview-home.png`, `preview-playlist.png` — 1600x1000 captures of the current state, for quick reference without opening anything.

## Trying the hand interaction without a camera

Press **Hands preview** in the top-right corner. Two wrist discs follow the mouse, spaced apart the way two real hands would be.

Everything the pointer or keyboard could act on is a hand target: buttons, links, the search field, the Back pill, the Hands preview toggle itself. There is no list to maintain — the set is derived from the DOM, so a new control works with wrists the moment it exists.

- Move so **one** disc touches a target: it highlights. That is aiming, and it is free.
- Move so **both** discs touch the **same** target: a white ring fills over roughly half a second, then it activates. That is committing.
- After it activates, both discs must leave that target before it can fire again.

A wrist counts as being on a target when its disc *overlaps* the target at all, not when the wrist centre is inside it. So you can activate from anywhere over a button, including 4 px inside its edge, and the pair does not need to straddle the middle.

If the two discs overlap two neighbouring buttons at once, nothing activates. Selection asks which single target both wrists touch, so a disc sitting across a boundary cannot split the vote.

That timing and the required grip are the knobs most worth reacting to. The ring fill is 520 ms (`HOLD_MS`), the wrist spacing is 48 px (`WRIST_SPREAD`), and each disc is 56 px across (`WRIST_DIAMETER`), all in `assets/app.js`.

Mouse clicks work normally throughout, which is also how the real thing must behave.

## Data

`assets/data.js` was generated from `api.beatsaver.com` and holds four playlists with real cover art.

- **Playlist of the day**: "Silver Songs", a real BeatSaver Sonic playlist.
- **Linkin Park**: a real BeatSaver playlist with its own cover.
- **Mega Man** and **Game Grumps**: no usable community playlist existed, so these stand in for AeroBeat-authored playlists, assembled from real BeatSaver-published maps. They show the folder-with-thumbnails treatment because they have no cover of their own.

That gap is itself a finding: BeatSaver playlist search matched Sonic and Linkin Park cleanly but returned unrelated results for Mega Man and Game Grumps, which supports the case for authoring our own highlighted playlists.

## What is deliberately unfinished

- The library screen is a stub; selecting it shows a toast.
- The microphone button appears only because Chromium reports speech support. It does not record anything.
- Search does nothing, and there is no song list on the confirmation screen yet.
- No end-of-song two-cover chooser, no countdown, no scoring.

## Where the knobs live

- `assets/styles.css` — the whole visual language. Bubble radii, glass, folder construction, target sizes.
- `assets/app.js` — `HOLD_MS`, `WRIST_SPREAD`, and the two-wrist state machine.
- `assets/data.js` — regenerable; delete it and rerun the fetch if the playlists should change.

Everything here is disposable by design. Expect to rewrite it.