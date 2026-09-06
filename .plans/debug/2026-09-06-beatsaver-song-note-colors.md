# BeatSaver song-defined note color research

**Date:** 2026-09-06
**Role:** RESEARCH
**Beads:** `aerobeat-web-assembly-2ey` (research, intentionally left open), `aerobeat-web-assembly-3dc` (umbrella)
**Disposition:** Source/schema research complete; no runtime, test, asset, release, serving, or physical-review change is authorized by this report.

## Decision summary

AeroBeat should treat note color as an optional, difficulty-scoped, presentation-only pair. The only archive-authored inputs eligible for dynamic note fill are:

1. the selected difficulty's active official Info color scheme (`saberAColor` / `saberBColor`); or
2. when no official scheme actively overrides notes, the selected difficulty custom-data pair (`_colorLeft` / `_colorRight` for legacy Info, `colorLeft` / `colorRight` for v4 Info).

Both sides must pass one strict, atomic sanitizer. Never mix a valid side with a fallback side. Missing, partial, non-finite, out-of-range, non-opaque, malformed, or otherwise invalid song data resolves to the fixed AeroBeat left/right defaults. Do not clamp, gamma-correct, infer 0–255 values, repair alpha, or derive a palette from cover art, BeatSaver metadata, environment lighting, Chroma flags, or map names.

Dynamic colors apply only to Flow `note` beats, for both directional (`requiresDirection: true`) and any-direction (`requiresDirection: false`) notes. Their white stroke remains asset-owned and unchanged. Flow bombs, obstacles, arcs, bursts/chains, all generated Boxing beats (including guards), athlete markers, receptors, timing bands, feedback, and environment assets remain on their existing fixed/purpose-owned colors.

Resolve schema-specific source authority while inspecting `Info.dat`; bind the sanitized pair and private provenance into the authored one-difficulty package; resolve the effective song-or-AeroBeat fallback once in content runtime; pass only the effective fill token through the private content→renderer projection. The renderer must not parse source metadata or choose precedence.

## Authority and references

The strongest sources inspected were:

- [BSMG Info.dat format](https://bsmg.wiki/mapping/map-format/info.html), fetched 2026-09-06, local byte SHA-256 `69c92c1249dfdffd6072afc5d67d6b4175462fa666d4060ff60be5ead8e9d20e`.
- [BeatSaber-JSMap](https://github.com/KivalEvan/BeatSaber-JSMap), inspected at commit `a18a0fb425c4c21d40cd29b8a8f70bdb835420ff`; its v2/v4 declaration schemas distinguish Info 2.1 object colors from Info 4.x hex colors and make v4.0.1 `overrideNotes` explicit.
- [SongCore](https://github.com/Kylemc1413/SongCore), inspected at commit `77e6fedd74ae8f63177e414bedfabfedb966845e`; its legacy parser/runtime establishes official-scheme-before-difficulty-custom-data behavior and documents normalized 0–1 custom-data channels.
- [BeatSaver API Swagger](https://api.beatsaver.com/docs/), fetched from its Swagger JSON on 2026-09-06, local byte SHA-256 `b34244272e86dd549016620d3b2d06f28139577b554d2ed94a2dc3ae9dd5339b`.
- Current AeroBeat vendor/content-authoring/content/contracts/renderer source and existing synthetic/real fixtures, at the clean `main` tips present when this research began.

Important terminology correction: there is no official `Info.dat` 3.x family. Beatmap/difficulty files have a v3 family, but public v3 maps normally retain legacy Info `2.1.0`. Therefore color resolution must track **Info format** separately from **difficulty beatmap format**. Treating one `sourceFormatMajor` as both is not an authoritative model.

## Schema matrix

| Content family | Selected difficulty locator | Official note-color authority | Difficulty custom-data compatibility authority | Activation and precedence | Color encoding |
|---|---|---|---|---|---|
| Info `2.0.0` + beatmap v2 | `_difficultyBeatmapSets[]` → exact characteristic/difficulty → `_difficultyBeatmaps[]` | None in Info 2.0 | `_customData._colorLeft`, `_customData._colorRight` | Custom pair is the only song-note candidate | Own plain RGB or RGBA object; channels are normalized sRGB numbers |
| Info `2.1.0` + beatmap v2 | Same legacy set path | `_colorSchemes[idx].colorScheme.saberAColor` and `.saberBColor`, selected by `_beatmapColorSchemeIdx` | `_customData._colorLeft`, `_customData._colorRight` | A valid in-range scheme with `useOverride === true` is authoritative and suppresses custom data. Otherwise custom data is eligible. | Official scheme requires RGBA objects in the 2.1 schema; custom data commonly supplies RGB and may supply `a` |
| Info `2.1.0` + beatmap v3 | Same legacy set path; referenced difficulty file declares `version: "3.x.y"` | Exactly the same Info 2.1 authority as above | Exactly the same legacy underscore custom fields as above | Info precedence is unchanged by the difficulty file changing to v3 | Same normalized object encoding as legacy Info |
| Info `4.0.0` + beatmap v4 | Flat `difficultyBeatmaps[]`, exact `characteristic`/`difficulty` | `colorSchemes[idx].saberAColor` and `.saberBColor`, selected by `beatmapColorSchemeIdx` | `customData.colorLeft`, `customData.colorRight` | For 4.0.0, a present in-range scheme is an implicit note override. If no in-range scheme exists, custom data is eligible. | Official scheme uses exactly eight hex digits `RRGGBBAA`; custom data uses normalized RGB/RGBA objects |
| Info `4.0.1+` + beatmap v4 | Same flat path | Same flat scheme fields | Same camelCase custom fields | A present in-range scheme is authoritative only when `overrideNotes === true`; `overrideLights` is irrelevant. Otherwise custom data is eligible. | Same as 4.0.0 |

### Fields that are not note-color authority

- `environmentColor0`, `environmentColor1`, boost/white variants, `_envColor*`/`envColor*`, and `obstaclesColor`/`_obstacleColor` do not define note colors.
- BeatSaver `diffs[].chroma` is a capability/mod flag, not a color value.
- BeatSaver `diffs[].environment` is a display/environment identity, not note RGB.
- `environmentNames` / `_environmentNames`, `environmentNameIdx` / `_environmentNameIdx`, and legacy `_environmentName` select an environment. They do not place that environment's default RGB values in the archive.
- Cover images, preview media, tags, names, and mapper descriptions are never color sources.

## Exact precedence algorithm

For one exact Standard difficulty:

1. Parse the declared Info version independently from the referenced difficulty file version. Reject unsupported or conflicting declarations under the existing archive policy.
2. Locate the exact difficulty entry used for conversion. Palette selection is per difficulty, never map-global by convenience.
3. If the Info family supports official color schemes, inspect the difficulty's scheme index:
   - the index must be a finite integer;
   - `-1`, omission, a negative value other than the documented sentinel, or an out-of-range value does not select an official scheme;
   - Info 2.1 activates the selected scheme only for exact `useOverride === true`;
   - Info 4.0.0 treats a selected scheme as implicitly overriding notes;
   - Info 4.0.1+ activates note override only for exact `overrideNotes === true`; `overrideLights` never activates note colors.
4. If an official scheme actively overrides notes, sanitize `saberAColor` and `saberBColor` as one atomic pair:
   - if both are valid, use them and stop;
   - if either is invalid, fail this song palette closed to AeroBeat defaults. Do **not** unmask lower-priority compatibility data beneath a declared active official override.
5. If no official scheme actively overrides notes (including omitted, `-1`, dangling/out-of-range, or explicit override false), sanitize the selected difficulty's exact custom-data pair:
   - legacy Info: `_colorLeft` + `_colorRight`;
   - v4 Info: `colorLeft` + `colorRight`;
   - if both are valid, use them;
   - if either is absent or invalid, use AeroBeat defaults for both.
6. Do not inspect a different difficulty, characteristic, version, or archive entry for replacement values.

This matches SongCore's important compatibility behavior: an in-range `useOverride:true` official scheme wins; absent/out-of-range/inactive scheme selection leaves difficulty custom colors eligible. AeroBeat adds stricter atomic validation and fail-closed handling instead of inheriting permissive/HDR runtime behavior.

## `colorSchemeIdx`, environment defaults, and fallback decision

Beat Saber uses `-1`/no selected override to inherit the selected environment's default scheme. Those default RGB values are game/environment data, not archive-authored values. BeatSaver API responses likewise do not supply the environment scheme's RGB values.

For this Bead's explicit rule—only valid **song-provided** values may dynamically recolor notes—AeroBeat must not silently import or approximate Beat Saber's built-in environment palette table. Therefore:

- a valid active archive color scheme or valid difficulty custom pair yields `source: song`;
- `-1`, inactive override, missing/dangling scheme, or invalid song pair yields the fixed AeroBeat defaults;
- the selected environment may continue to affect environment presentation through its own policy, but never changes Flow note fill as an implicit side effect;
- a future exact, licensed/versioned Beat Saber environment-default registry would be a separate policy Bead. It must not be smuggled into this implementation as a fallback table.

This decision is deterministic across hosts and does not pretend externally defined environment defaults are authored bytes.

## Strict sanitizer

### Accepted legacy/custom object form

Accept only an own, plain, enumerable object with exactly either keys `{r,g,b}` or `{r,g,b,a}`:

- every channel must be a JavaScript `number`, finite, and in inclusive `[0,1]`;
- reject numeric strings, booleans, `null`, arrays, class instances, accessors, inherited fields, sparse/hidden fields, `NaN`, infinities, and negative/greater-than-one values;
- normalize `-0` to `0`;
- omitted alpha becomes `1`;
- present alpha must equal exactly `1`; translucent gameplay fills are rejected rather than repaired;
- do not clamp or scale 0–255/HDR-looking channels;
- both left and right must validate atomically.

### Accepted v4 official hex form

Accept only an own string matching `/^[0-9A-Fa-f]{8}$/u`:

- interpret bytes as `RRGGBBAA` in sRGB order;
- alpha must be `FF`; reject translucent values rather than compositing or repairing;
- canonicalize to uppercase `#RRGGBB` plus normalized sRGB channels `byte / 255` and alpha `1`;
- reject six-digit, prefixed (`#`, `0x`), whitespace-padded, non-ASCII, and malformed strings.

### Gamma/color-space rule

Source RGB and hex channels are sRGB-encoded display values. Canonical package color is an opaque sRGB token (`#RRGGBB`) with optional normalized channel tuple for validation/debugging. Do not apply a gamma transform during archive inspection, authoring, hashing, content resolution, event creation, or CSS-token creation. If PlayCanvas material APIs require linear values, the renderer performs exactly one documented sRGB→linear conversion at the final material boundary; it must not multiply already-linear values or depend on browser color parsing. Test primaries, mid-gray, and white to catch double conversion.

### Deterministic fallback

Use the existing renderer defaults exactly:

- left: `#2693FF` (canonicalized from current `#2693ff`);
- right: `#39C96B` (canonicalized from current `#39c96b`).

Fallback is pair-atomic and must carry a bounded internal reason enum such as `missing`, `inactive_scheme`, `invalid_index`, `invalid_pair`, or `unsupported_source_shape`. It must never carry song title, artist, mapper, description, archive path text, or raw payload bytes into public state.

## BeatSaver API verification

Live credential-free GETs on 2026-09-06 inspected exact API detail responses for public IDs `4858`, `3D44B`, and `53F26`.

Observed API surfaces:

- top-level metadata contains BPM/duration and display attribution fields;
- each version contains hashes/URLs/state and `diffs`;
- sampled `diffs` keys include characteristic, difficulty, counts, NJS/NPS, environment, `chroma`, `me`, `ne`, `cinema`, and parity/statistics fields;
- none of the sampled map, version, metadata, or diff records exposes `colorSchemes`, a color-scheme index, `saberAColor`, `saberBColor`, `colorLeft`, or `colorRight`;
- sampled version records did not expose `environmentNames` either.

The checked Swagger model likewise has no authoritative left/right RGB pair. Therefore the BeatSaver API can identify and acquire a version, but **the API is not note-color authority**. Exact values exist only inside archive `Info.dat` (including its difficulty custom data). AeroBeat's current `normalizeMap()` correctly has no color value to preserve, but archive inspection currently discards the values after reading Info.

## Public-map samples and exact hashes

No song title, artist, mapper name, description, audio byte, cover byte, or raw map payload is reproduced here. IDs and integrity hashes are sufficient to make the schema evidence reproducible.

### Cached legacy-v2 example: `4858`

- Provider version SHA-1: `431ffaa53a1e45ffab6c81a895e456f6aad1e038`
- Cached archive bytes: `7,552,654`
- Archive SHA-256: `4273f0305518aa79ae4a7b58ccb07e86704ba50dbe679d0f0e29c52cb7b6beed`
- `info.dat` SHA-256: `278548f453c0249a42a2c0bb3c3f5e1c726eedb63012aa931d9f90d22ef728a2`
- Info declaration: `2.0.0`; no `_colorSchemes`; three Standard difficulties carry `_customData._colorLeft/_colorRight`.
- Exact sampled pair on all three: left `{r:1.5,g:0,b:0}`, right `{r:0,g:0,b:1.5}`.
- Oracle: both channels exceed normalized range, so the pair is invalid and must resolve to AeroBeat defaults. This intentionally differs from permissive HDR-capable mod behavior.
- Difficulty SHA-256 values: Hard `46a2affb4b69c2bb0d0a5e146c33504bb154b88dfcf63fd56f3a3a1a8e79e5d4`; Expert `7a14673fcba05362c6a64f72a484d6057c8a67fe2bc1fc4b29198bd18b173c8e`; ExpertPlus `97335aff6d6dfe469776b6ef43b54798c29b03c133d32e147b90541d1ead6373`.

### Cached v3-difficulty example: `3D44B`

- Provider version SHA-1: `2549825187cfdf7fb2352e33a614ff3ea6d3317d`
- Cached archive bytes: `6,008,509`
- Archive SHA-256: `21e9c5c3aafab87d61273010ba40eff584d54ed9d574d5a6c220ea66e0bb6c7b`
- `Info.dat` SHA-256: `23cab9f0e6c2711bc7549ea14c28d7a55d0aef50d46d3f4fa6e3deaaa597cdb0`
- Info declaration: `2.1.0`; referenced Standard difficulties declare beatmap `3.3.0`. This is the concrete proof that Info family and difficulty family are separate.
- `_colorSchemes` is empty while `_beatmapColorSchemeIdx` is `0`; SongCore-compatible behavior therefore leaves difficulty custom data eligible.
- Exact custom pair: left `{r:1,g:0.493,b:0.078}`, right `{r:0,g:0.501,b:1}`. Both pass the strict normalized opaque-RGB sanitizer.
- Difficulty SHA-256 values: Hard `7dace72e6fc51a62016399937c5a54581d6208e7104a3cbf2fa8c7e15cd24812`; ExpertPlus `0ff189c84b8a2741493d08cd0b3349595daab75cff6a2a08daa73762d0743eec`.

### Safely fetched v4 example: `53F26`

- Provider version SHA-1: `addd9d6f8e7340ad6f5633947136d8475a7a99b5`
- Transient archive bytes: `1,447,416`
- Archive SHA-256: `493ac268c129b63cfdd7e0d3aaf8f22d266ded4f65471b38be78ec6863698819`
- `Info.dat` SHA-256: `26f9b85fe63b5d7e2c2878ba6f56379cf3f5e6dd30591288f925354ece569469`
- Info declaration: `4.0.1`; referenced Standard difficulty declares beatmap `4.1.0`.
- `colorSchemes` is empty while Standard `beatmapColorSchemeIdx` is `0`; `customData.colorLeft/colorRight` is therefore eligible.
- Exact custom pair: left `{r:1,g:1,b:1}`, right `{r:0.288,g:0.288,b:0.288}`. Both pass normalized opaque RGB validation. White stroke remains white even where the fill is also white; no contrast-driven recoloring is allowed.
- Standard difficulty SHA-256: `5db4e508ac9fa238e1127b0ff1f08338a037ffa7e5e9f57671878b048c2ff10f`.

The sanitized extraction summary generated outside the repository had SHA-256 `3885c6ff4b9d994685d22d9bad57fcaf8130031aa30ab7d69a414b303bbce91e`. No fetched archive or third-party content was added to Git.

## Current AeroBeat pipeline gap

The complete current path loses color authority before authoring:

1. `aerobeat-web-vendor-beatsaver/src/archive.js` parses Info and locates exact Standard difficulty records, but `buildSourceManifest()` retains only characteristic/difficulty/path/rank/NJS/offset plus song/audio/archive fields. It does not retain Info family separately from difficulty family, scheme index, active scheme, difficulty custom data, a sanitized palette, or palette provenance.
2. `aerobeat-web-vendor-beatsaver/src/normalize.js` narrows API DTOs to map/version/diff statistics. That is correct because the provider API does not expose RGB authority.
3. `aerobeat-web-content-authoring/src/source-material.js` creates an exact Worker manifest without note colors and currently labels `sourceBeatmapVersion` from `manifest.sourceFormatMajor`, conflating Info and difficulty format.
4. Worker protocol exact-key validation has no palette field.
5. `converter.js` emits Flow note beats with hand/direction/placement only. Package `source`, Flow chart, conversion trace, and package hash contain no palette/provenance binding.
6. `aerobeat-web-contracts` has no note-palette schema and `resolved_content_event` has no bounded appearance field.
7. `aerobeat-web-content` validates/loads the package and creates resolved events without an effective palette.
8. `aerobeat-web-renderer` chooses every left/right target from global fixed `theme.leftHandColor/rightHandColor`; it has no per-content palette input. The same theme colors also serve athlete markers, so mutating the global renderer theme would incorrectly recolor non-note visuals.

## Options considered

### Option A — recolor the global renderer theme at song load

Rejected. It is the smallest patch but incorrectly recolors athlete markers and any other role using the theme, obscures provenance, makes fallback/selection lifecycle race-prone, and bypasses package integrity.

### Option B — assembly parses cached/raw Info and passes colors directly to renderer

Rejected. Assembly does not own ZIP/schema parsing or content conversion; raw source bytes may not survive; local/remote/imported paths could diverge; and provenance would not be bound into package hashes.

### Option C — pass colors through generic `presentationSuggestion.theme`

Rejected. Current theme precedence allows playlist/athlete/host override and applies tokens globally. Song-authored note identity is narrower than a theme and must not recolor guards, bombs, obstacles, markers, or receptors.

### Option D — explicit palette contract from archive inspection through package/runtime event projection

**Selected.** The vendor resolves schema-specific archive authority, authoring revalidates and binds it, content resolves the effective pair once, and renderer applies an event-local fill. This preserves boundaries, supports local ZIP and BeatSaver acquisition identically, and makes forbidden visual classes testable.

## Proposed package/chart/event contract

Names below are implementation-plan recommendations, not runtime edits made by this Bead.

### Provider-neutral source manifest

Add one difficulty-scoped optional record to each manifest difficulty:

```js
notePalette: null | {
  schema: "aerobeat/source_note_palette",
  version: 1,
  left: "#RRGGBB",
  right: "#RRGGBB",
  colorSpace: "srgb",
  alpha: 1,
  provenance: {
    kind: "info_color_scheme" | "difficulty_custom_data",
    infoFormat: "v2" | "v4",
    infoHash: "sha256:<64 hex>",
    difficultyHash: "sha256:<64 hex>",
    fieldSet: "v2_scheme" | "v2_custom" | "v4_scheme" | "v4_custom",
    schemeIndex: number | null
  }
}
```

Also split `infoFormatMajor` from each difficulty's `beatmapFormatMajor`/exact declared version. Do not place raw custom data, song attribution, archive bytes, or environment tables in this record.

### Authored package and Flow chart

- Add immutable package `notePalette` with the sanitized song pair and provenance, or `null` when no valid song pair exists.
- Bind it into package canonical bytes/hash and semantic parity projection.
- Give the one Flow chart a palette reference/hash (not a copied mutable object) so chart/package disagreement fails validation.
- Do not attach the palette to Boxing charts; their generated guards/punches remain fixed.
- Do not include presentation palette in score identity or judgement/scoring hashes. It is visual integrity, not ruleset identity.
- Persistence/export naturally carries it through package bytes; no new source ZIP caching is required.

### Content runtime effective palette

After package validation, resolve exactly once:

```js
{
  schema: "aerobeat/effective_note_palette",
  version: 1,
  left: "#RRGGBB",
  right: "#RRGGBB",
  colorSpace: "srgb",
  source: "song" | "aerobeat_default",
  paletteHash: "sha256:<64 hex>"
}
```

Keep full source provenance private to package validation/diagnostics. Public content snapshots may expose at most `source` and `paletteHash` if product telemetry genuinely needs them; default is to expose neither.

### Resolved chart event / renderer seam

For private renderer projection only, add an opaque fill token to resolved events when and only when:

- `authoredBeat.type === "note"`;
- hand is exact `left` or `right`;
- `requiresDirection` is either true or false.

No appearance field is added for bomb, obstacle, arc, burst, Boxing guard/punch/squat/weave, timing, marker, receptor, feedback, or environment events. Do not put palette provenance, source IDs, Info paths, API DTOs, or names into public `aero-game-event`, iframe messages, persistence handles, telemetry, history, or score records.

Renderer consumes the private event-local `appearanceColor` for the tintable fill material only. White/charcoal structural materials and white stroke remain asset-owned; miss-gray and hit-white feedback retain their existing temporary state precedence.

## Test oracle

### Synthetic schema/precedence matrix

1. Info 2.0 valid `_colorLeft/_colorRight` → exact song pair.
2. Info 2.1 active in-range `useOverride:true` scheme plus conflicting valid custom pair → scheme pair wins.
3. Info 2.1 active scheme with one invalid side plus valid custom pair → AeroBeat fallback; custom pair remains suppressed.
4. Info 2.1 `useOverride:false`, `-1`, absent index, empty list, and dangling index → valid custom pair wins.
5. Beatmap v3 under Info 2.1 → legacy Info rules, while manifest records beatmap major 3 independently.
6. Info 4.0.0 selected scheme → implicit note override wins.
7. Info 4.0.1 selected `overrideNotes:true` scheme → scheme wins; `overrideLights` does not matter.
8. Info 4.0.1 selected `overrideNotes:false` scheme → valid camelCase custom pair wins.
9. Every no-valid-pair row → exact `#2693FF/#39C96B` pair.
10. Different Standard difficulties with different colors → one-difficulty packages preserve distinct pairs; collection switching is latest-wins and never leaks the prior difficulty's palette.

### Sanitizer rejection matrix

Reject atomically: missing side; extra/missing object keys; string/boolean/null channels; array/class/accessor/inherited values; negative, above-one, `NaN`, infinities, `-Infinity`; alpha absent is accepted as 1 but any present alpha other than 1 rejects; six-digit/prefixed/spaced/non-hex v4 strings; v4 alpha not `FF`; non-integer/negative-other-than-`-1`/oversized indexes. Assert no accessor executes.

Gamma oracle: exact `#FF0000`, `#00FF00`, `#0000FF`, `#808080`, and `#FFFFFF` survive package/event tokens unchanged; renderer material observation proves one conversion only and catches double-gamma.

### Exact public-map rows

- `4858` must produce AeroBeat fallback because `1.5` channels are rejected, with all exact hashes above unchanged.
- `3D44B` must identify Info v2.1 + beatmap v3.3 independently and accept the valid difficulty custom pair despite dangling scheme index.
- `53F26` must identify Info v4.0.1 + beatmap v4.1 independently and accept the valid camelCase difficulty pair despite an empty scheme list.
- Mocked API DTOs with arbitrary color-looking extra keys must not become authority; only inspected archive bytes can do so.

### Visual and privacy oracle

Across direct/iframe, secure/insecure non-camera, Flow/Test/Play, and difficulty switches:

- directional and any-direction Flow note fill matches the effective left/right pair;
- their white stroke remains byte/material-role stable;
- guards, bombs, obstacles, arcs/bursts, markers, receptors, timing bands, shadows, and environment remain byte/pixel-equivalent to fixed-color baselines except existing hit/miss effects;
- no raw/sanitized source provenance, song/source detail, Info path, provider DTO, or archive/custom-data object appears in snapshots, DOM, events, iframe messages, telemetry, persistence handles, history, or score records;
- no archive/API fetch occurs in renderer or gameplay;
- disconnect/reconnect, cancellation, stale Worker result, package deletion, and rapid difficulty switching cannot retain a previous palette.

## Implementation boundaries and follow-up ownership

This research Bead made no implementation. A subsequent approved plan should split work by owner:

1. **Vendor/contracts:** exact Info-vs-beatmap format fields, palette sanitizer/resolver, provider-neutral manifest shape, synthetic precedence fixtures, and API-does-not-provide-colors proof.
2. **Content authoring:** independent revalidation, Worker protocol, package/Flow palette binding, hashes/parity, multi-difficulty persistence/export, and exact real-map oracle.
3. **Content/contracts:** package validation, effective fallback pair, private resolved-event appearance contract, future-swap/package-generation safety, and public privacy boundaries.
4. **Renderer/gameplay/assembly:** event-local note fill only; unchanged white stroke and fixed forbidden classes; lifecycle wiring and direct/iframe privacy/visual matrix.
5. **QA/audit:** exact fixture hashes, gamma/material inspection, pixel/class exclusions, package tamper rejection, no raw artifact commit, and final physical review only after implementation audit.

Do not use the current global theme mutation as an interim compatibility path. Do not add third-party archives/assets to Git. Do not build or serve a successor release until `3dc` has an approved implementation plan and its parallel asset/bounce research is consolidated.

## Debugging record

```text
Problem: AeroBeat cannot apply authoritative song-defined left/right note colors because the archive-to-renderer pipeline drops all color fields.
Observed symptom: Vendor parses Info but omits palette data; authored packages/events have no palette; renderer always uses global #2693ff/#39c96b role colors.
Root cause: The source manifest and package/event contracts were designed before song-note color support and conflate Info family with difficulty beatmap family.
Evidence: Current vendor buildSourceManifest fields, exact Worker manifest/package/event shapes, renderer roleColor(), API field inspection, schema sources, and three exact public-map samples/hashes.
Failed approaches: No runtime fix was attempted. Global theme mutation, assembly parsing, and generic presentationSuggestion were evaluated and rejected as boundary/privacy/scope violations.
Corrective action: Add a strict difficulty-scoped source palette contract, bind it through package integrity, resolve fallback in content runtime, and project event-local fill only for Flow note beats.
Verification test: Synthetic precedence/sanitizer/gamma matrix; exact 4858/3D44B/53F26 hash rows; cross-context visual/privacy/lifecycle matrix; coder→QA→audit before physical review.
Related files/components: web-vendor-beatsaver archive manifest; web-contracts BeatSaver/content shapes; web-content-authoring source/Worker/converter/validator/persistence; web-content package/runtime; web-renderer scene/facade; web-assembly lifecycle tests.
Remaining uncertainty: A future product may intentionally adopt a versioned Beat Saber environment-default palette registry, but that is outside this song-provided-only requirement and must not affect the selected fallback.
```
