# Diagnosis: Two Song Import Failures (Bead `aerobeat-web-assembly-jci7`)

Date: 2026-09-11 · Source: read-only diagnosis subagent (both reproduced against real BeatSaver chart bytes using the actual authoring service code).

## Song #1: "sonic frontiers infinite" → `flow_obstacle_limit_exceeded`

### Reproduction
- **Chart:** `[Sonic Mixtape] Tyler Smyth, Andy Bane - Infinite (Sonic Forces OST)` — BeatSaver map `304ea` (v2/v3 format, 140 BPM, 261s)
- **Reproduced by:** `parseBeatMapDifficulty(bytes, 'v3')` + `convertDifficulty(summary, options)` on the real chart bytes
- **Exact error:** `Error: flow_obstacle_limit_exceeded` (thrown as a bare `Error`, not an `AuthoringParseError`)
- **Failing step:** Conversion — `obstaclesFor()` inside `converter.js`, called from `generateEvents()` before any chart is built

### Throw site
`aerobeat-web-content-authoring/src/converter.js:266`:
```js
function obstaclesFor(obstacles, bpm) {
  if (obstacles.length > maximumObstaclesPerChart) throw new Error("flow_obstacle_limit_exceeded");
```

### Root cause
- **Limit constant:** `maximumObstaclesPerChart = 128` in `aerobeat-web-contracts/src/obstacle-contracts.js:6`
- **Chart's actual count:** 137 obstacles in Hard (109 Expert, 111 ExpertPlus). Hard exceeds 128 by 9.
- **What the limit counts:** total obstacle entries in the source beatmap (not per-second, not interval cells). Checked at four sites:
  - `converter.js:266` (conversion entry, throws early)
  - `validator.js:73` (post-construction validation, issues `flow_obstacle_limit_exceeded`)
  - `package-content.js:375` (content package loading, throws)
  - `session-coordinator.js:1118` (gameplay runtime, throws `event_obstacle_limit_exceeded`)
- **Is the chart pathological?** No. 137 obstacles over 261 seconds ≈ 0.53/second — a normal DDR-style rhythm chart.
- **Is the limit justified?** The 128 cap appears to be an arbitrary initial bound; no documented performance/memory rationale. Obstacles are static geometry records; 137 is trivially small. The entire stack must move together (four call sites).

### Fix spec
**Raise the limit to 512.** Real BeatSaver charts go up to ~1000+ obstacles ("Jeh Jeh Rocket" Sonic chart has 1042), but the vast majority stay under 300; 512 accommodates dense DDR-style charts while guarding pathological inputs. One constant, all four call sites import it. **Alternative (rejected):** dynamic per-song-length limit (`ceil(durationSec * 4)`) — more principled but requires plumbing song duration through conversion entry points that don't have it before the obstacle check. Not worth the complexity for v1.

**Oracle assertions:** (1) a chart with exactly 512 obstacles converts; (2) 513 throws `flow_obstacle_limit_exceeded`; (3) the existing 128-obstacle boundary test in `validate-content-runtime.js:466` updates to 512.

## Song #2: "HUNTR/X Golden" → `Required finite obstacle field i is invalid`

### Reproduction
- **Chart:** `HUNTR/X | Golden` — BeatSaver map `4cfaa` (v4 format, 123 BPM, 193s)
- **Reproduced by:** `parseBeatMapDifficulty(bytes, 'v4')` on the real chart bytes
- **Exact error:** `AuthoringParseError: Required finite obstacle field i is invalid`, code `obstacle_index_invalid`
- **Failing step:** Parsing — `normalizeV4()` in `beatmap.js`, at the very first obstacle. All five difficulties fail identically.

### Throw site
`aerobeat-web-content-authoring/src/beatmap.js:205` (inside `requiredFinite()`), called from `normalizeIndexedObstacle()` at line 153:
```js
const index = requiredInteger(value, ["i"], "obstacle_index_invalid");
```

### Root cause
**Our validation is over-strict.** The chart is legitimate v4 Beat Saber format. The Beat Saber v4 spec allows two optional fields to be omitted from `obstaclesData` entries:
1. **`i` (metadata index) on an obstacle entry defaults to 0** when absent. This chart has exactly 3 such obstacles per difficulty (Easy: indices 0, 49, 89). The first (array index 0) is `{"b": 5.0}` with no `i` field.
2. **`x` and `y` on `obstaclesData` entries default to 0** when absent. Of the 45 `obstaclesData` entries in Easy, 30 are missing `x` and/or `y`.

The current code calls `requiredInteger(value, ["i"], ...)` which uses `requiredFinite()` — it **throws if the key is absent from the record**. Wrong semantics for a field with a default. The same bug pattern exists for `x`, `y` in `normalizeIndexedObstacle()` lines 162-163.

### Offending data excerpt (Easy, first obstacle)
```json
// obstacles[0] — missing "i", should default to 0
{"b": 5.0}
// obstaclesData[0] — complete
{"x": 3, "y": 2, "d": 3.0, "w": 1, "h": 1}
// obstaclesData[1] — missing "x" and "y", both should default to 0
{"d": 4.0, "w": 1, "h": 1}
```

### Fix spec
Change `normalizeIndexedObstacle()` in `beatmap.js` to optional-with-default semantics for the v4 indexed fields:
1. **`i` on the obstacle entry:** `const index = value["i"] !== undefined ? requiredInteger(value, ["i"], "obstacle_index_invalid") : 0;` (the existing range check at line 154 remains correct)
2. **`x`/`y` on `obstaclesData`:** `const x = metadata["x"] !== undefined ? requiredInteger(metadata, ["x"], "obstacle_geometry_invalid") : 0;` (same for `y`)
3. **`d`, `w`, `h`** stay required (no v4 default).
4. Verify `normalizeV2Obstacle` / `normalizeInlineObstacle` are unaffected (they are — v2/v3 field sets differ and all their fields are required).

**Oracle assertions:** (1) a v4 beatmap with obstacle `{"b": 5.0}` (no `i`) + matching `obstaclesData[0]` parses, `sourceIndex` 0; (2) `obstaclesData` entry `{"d": 4.0, "w": 1, "h": 1}` parses with x=0, y=0; (3) HUNTR/X Golden ExpertPlus (140 obstacles) parses successfully; (4) a v4 obstacle entry missing `i`-semantics but referencing an out-of-range index still throws `obstacle_index_invalid`.

## Summary

| Song | Error | Step | Root Cause | Severity | Fix |
|---|---|---|---|---|---|
| Sonic Frontiers Infinite (`304ea`) | `flow_obstacle_limit_exceeded` | Conversion | 128-obstacle cap < chart's 137 | Medium — blocks valid dense charts | Raise `maximumObstaclesPerChart` to 512 in `obstacle-contracts.js:6` |
| HUNTR/X Golden (`4cfaa`) | `Required finite obstacle field i is invalid` | Parse | v4 `i`/`x`/`y` are optional-with-default-0 per Beat Saber spec; parser requires them | High — blocks ALL HUNTR/X Golden difficulties | Default-0 semantics for `i`, `x`, `y` in `normalizeIndexedObstacle()` at `beatmap.js:153,162-163` |

**Interaction note:** HUNTR/X Golden ExpertPlus has 140 obstacles — it would ALSO exceed the 128 limit after the parse fix. Raising the limit to 512 (fix #1) is a prerequisite for the HUNTR/X Golden EP import to fully succeed.
