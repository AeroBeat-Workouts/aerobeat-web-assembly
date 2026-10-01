# Performance: what has been RULED OUT by measurement (0.0.86/0.0.87 reports)

Derrick reports 'Wario Ware in Beat Saber' nearly freezing the app, 'The Catalyst'
Expert bad, and 'Vandalize' bad in Flow but fine in Boxing.

I could not reproduce a freeze in the JS content/session pipeline. Everything
below was measured against the REAL code with synthetic charts, and every
candidate came back clean. This is the negative result that redirects the search.

## Measured and ruled out

**1. Per-frame projection cost — indexed path is constant.**
`projectSessionTargets` in `aerobeat-web-assembly/src/session-render-projection.js`
uses the session target index when valid.

| notes | indexed | unindexed (fallback) |
|---|---|---|
| 1,000 | 0.039 ms | 1.53 ms |
| 4,000 | 0.012 ms | 5.09 ms |
| 16,000 | 0.014 ms | 21.4 ms |
| 32,000 | 0.010 ms | 42.9 ms |

Indexed cost does not grow with song size. Only the unindexed fallback is fatal.

**2. The index is NOT rebuilt per frame.** Verified the three rebuild triggers in
`rendererFrame` (`src/index.js` ~1699):
- `events !== this.renderEventSource` — the content runtime's internal render
  projection is a frozen closure `() => renderEvents` returning a STABLE
  reference (`aerobeat-web-content/src/content-runtime.js` ~251).
  `renderEvents` is only reassigned on load / select / reprocess (~216, ~327-329).
- `renderPresentationConfig !== this.testPresentationConfig` — only reassigned in
  `commitTestPresentationConfig` (user action, ~2163), not per frame.
- `!Object.is(renderSpawnDistanceWorldUnits, spawnDistanceWorldUnits)` — a number.

So steady-state play reuses the index. For reference, an index BUILD costs
5.9 ms at 4k notes and 44 ms at 32k, so a per-frame rebuild WOULD freeze — but the
triggers say it does not happen.

**3. Gameplay snapshot copying is negligible.** `session-coordinator.js` ~1727
spreads four growing arrays per snapshot: 0.070 ms/frame at 16,000 notes.

**4. Per-frame judgement/outcome Map rebuilds are real but small.**
`session-render-projection.js` ~90-94 rebuilds two Maps from growing
`judgements` / `obstacleOutcomes` each frame: 0.63 ms/frame at 8,000 notes
(linear). Worth optimising eventually; ~4% of a 60 fps budget.

**5. Live target count is small.** With the index in use, live targets per frame
are 14 (1.5 s lead) to 82 (10 s lead) on a dense 8-notes/second chart. The
renderer is never handed thousands of objects.

## Where the freeze therefore is NOT

Everything above is the JS content/session pipeline. If a heavy song still
freezes the tab, the cost is almost certainly OUTSIDE it:
- WebGL / PlayCanvas scene rendering (GPU or draw-call bound, not JS)
- audio decode or a very large audio buffer for a long song
- memory pressure from package size / IndexedDB

`Vandalize` being fine in Boxing but bad in Flow is a useful discriminator: the
two rulesets render different scene content for the same events, which points at
the renderer rather than at the event pipeline measured above.

## Next step

Profile the real app in a browser on a heavy song (Wario Ware is the best case).
Do not re-investigate the JS projection pipeline; it is measured clean.
