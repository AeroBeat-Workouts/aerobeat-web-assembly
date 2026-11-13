# Assets: aero-remix

| Asset | File | Source | Licence |
|---|---|---|---|
| Signika (variable, weights 300–700) | `Signika.ttf` | Google Fonts repository, `ofl/signika/Signika[GRAD,wght].ttf` (https://github.com/google/fonts/tree/main/ofl/signika) | SIL Open Font License 1.1, full text in `Signika-OFL.txt` |
| Playlist covers | from `_shared/content.mjs` via `coverUrl()` | provided by the brief | as provided; not redistributed here |

Everything else is procedural: all geometry (foam trays, air units, piping, lacing dial, wrist markers) is built in code, and every surface uses a small custom GLSL shader in `index.html`. That includes the analytic photo-studio reflections, gel, bubbles, wall caustics and the ripple. No textures, HDRIs or models were downloaded.

Research images seen during web search (Reddit, Aesthetics Wiki, design blogs) were viewed only for understanding and none were saved or copied.
