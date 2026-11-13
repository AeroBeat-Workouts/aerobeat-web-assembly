# Assets — dreamcast-water

## Fonts (SIL Open Font License 1.1)

| File | Family | Source | Licence |
|---|---|---|---|
| `fonts/LilitaOne-Regular.ttf` | Lilita One, by Juan Montoreano | https://github.com/google/fonts/tree/main/ofl/lilitaone | OFL 1.1, text in `fonts/OFL-LilitaOne.txt` |
| `fonts/MPLUSRounded1c-ExtraBold.ttf` | M PLUS Rounded 1c ExtraBold, by Coji Morishita / M+ Fonts Project | https://github.com/google/fonts/tree/main/ofl/mplusrounded1c | OFL 1.1 (per the folder's METADATA.pb), text in `fonts/OFL-MPLUSRounded1c.txt` |

Both are loaded with `FontFace` before any sign texture is drawn.

## Everything else

- No downloaded images, models, HDRIs or textures.
- Sky, sun, clouds, islands: drawn procedurally into a canvas once at startup.
- Water caustics and sparkles: a tileable 256×256 Voronoi texture generated in JavaScript at startup.
- Raft, buoys, posts, lifebuoy: PlayCanvas primitive geometry with a custom toon shader.
- Playlist covers: the shared BeatSaver covers, loaded via `coverUrl()` from `_shared/content.mjs`.
- No characters, logos or music from Sonic Adventure, Super Mario Sunshine or any other game. (The Silver cover art is the shared playlist cover, used as given.)
