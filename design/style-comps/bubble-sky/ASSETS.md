# Bubble Sky — assets

| Asset | File | Source | Licence |
|---|---|---|---|
| Sniglet ExtraBold | `fonts/Sniglet-ExtraBold.ttf` | Google Fonts repo, https://github.com/google/fonts/tree/main/ofl/sniglet (Haley Fiege, Brenda Gallo, Pablo Impallari) | SIL Open Font License 1.1, copy in `fonts/OFL.txt` |
| Sniglet Regular | `fonts/Sniglet-Regular.ttf` | same | SIL Open Font License 1.1 |
| Playlist covers | loaded at runtime via `coverUrl()` | `_shared/content.mjs` (BeatSaver playlists) | as provided by the brief |

Everything else is procedural: sphere, torus, capsule and disc meshes built in code; custom GLSL for the soap film, clouds, sky gradient and unlit labels; text drawn into canvas textures. No downloaded textures, HDRIs or models.
