# 0.0.149 release: local ZIP reimport and honest import failures

Status: shipped and live. Public link serves 0.0.149 from `aerobeat-r149`.

## Reports

1. Derrick imported a ZIP file, then downloaded BeatSaver "Numb", and the download failed with
   `Worker conversion failed`. Deleting every song and force-refreshing made the retry succeed,
   which looked like a local/BeatSaver name collision.
2. Local ZIP songs could not be reimported at all.

## What shipped

- **Conversion worker failures are reported honestly** (content-authoring `f4e8c7a`). One set of
  failure helpers now serves both the adapter and the worker thread: a crash names its site instead
  of collapsing to `Worker conversion failed`, a `DOMException` keeps its own message (it lives on
  the prototype and used to be dropped), a hostile `message` getter cannot throw through the
  reporting path, and a crashed worker is retried once with a fresh worker.
- **Local ZIP songs reimport from cache** (vendor-beatsaver `13ffc00`, content-authoring `f4e8c7a`,
  assembly `a3cef2d`). Local imports record `local` provenance with a stable `local:<archiveSha1>`
  source id. Reimport rebuilds the source from the `Info.dat`, difficulty bytes and audio stored at
  import time, verifies the rebuilt map hash equals the recorded provider version, then replaces the
  same collection in place. No file prompt, no second copy of the archive, and Reimport All covers
  these songs. A song whose cache is incomplete asks for its ZIP file again instead of pretending.
- Version and pins: assembly `0.0.149`, vendor `13ffc00`, authoring `9edce4c`, contracts `43ec0a4`,
  content `4721207`, gameplay `6f5d6a6`.

## The collision question

We could not reproduce a genuine local/BeatSaver collision on desktop: four sequential imports
including two distinct "Numb" songs all succeeded with clean workers and no memory pressure. The
reported failure is consistent with the opaque-crash path, which is what changed: a crashed worker
used to fail the whole import with no explanation and no retry. With the retry and real messages in
place, a recurrence will name the cause instead of leaving us guessing. The acceptance script also
proves the exact reported sequence (local "Numb" then BeatSaver "Numb") now ends with both songs
present.

## Verification

- `npm test` in vendor, content-authoring and assembly (all green; includes the new
  `validate-cached-source-rebuild.js` and `validate-local-reimport-source.js`).
- Shipped bundle, Chromium, local snapshot and public HTTPS: local ZIP import records `local`
  provenance; the shipped Reimport button rewrites that collection from cache with no file chooser
  and no BeatSaver request; the collection id and difficulties are unchanged; a BeatSaver "Numb"
  imports alongside it and both songs coexist.
- Public HTTP: release proof `0.0.149` direct and in a true cross-origin iframe, with a ready
  conversion worker, ready render assets, ready environment, `cpu-wasm` and nonzero framebuffers.

## Rollback

`systemctl --user stop aerobeat-r149`, then
`tailscale funnel --bg --https=443 --yes http://127.0.0.1:4211` (0.0.148 stays active on 4211).

## Known limits

- A Beat Saber v4 map whose audio-data file exceeds the 2 MB cache entry bound cannot rebuild its
  map hash, so its Reimport asks for the ZIP file again. Ordinary v2/v3 maps are unaffected.
- The rebuilt source reports the cached byte totals rather than the original archive size, because
  the archive is deliberately not stored.
