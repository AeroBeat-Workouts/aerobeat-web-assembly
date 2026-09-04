# BeatSaver explicit metadata version fallback

**Role:** focused debugging diagnostician for `aerobeat-web-assembly-b9e`  
**Vendor candidate:** `a654d91934186d4ea2c00923c9d8d0700d29737b` / tree `f1f4448732f851c7cd64392ae0372ebe0d909eb9`  
**Disposition:** confirmed defect; no product or test code changed

## Exact Observed Failure

The public `inspectBeatSaverArchive()` accepted a structurally valid synthetic v4 archive after its exact `Info.dat.version` was changed from `4.0.0` to unsupported `5.0.0`:

```json
{"accepted":true,"sourceFormatMajor":4,"declared":"5.0.0"}
```

A focused reproduction additionally proved the same archive reaches both public service paths:

```json
{"inspector":4,"download":4,"local":4,"sourceHash":"7100a5402073eacd5882c80e57f184593975beeb"}
```

The failure occurs in `src/archive.js:243-245` and `src/archive.js:361-368`: `buildSourceManifest()` converts a declaration to an optional string, and `detectFormatMajor()` falls from an unsupported or malformed declaration into shape heuristics.

Directly observed matrix on candidate `a654d919`:

| Info shape / declaration | Current result |
|---|---|
| canonical explicit v2 `_version: "2.1.0"` | accept major 2 |
| canonical explicit v3 `version: "3.0.0"` | accept major 3 |
| canonical explicit v4 `version: "4.0.0"` | accept major 4 |
| version absent, canonical v2/v3/v4 shape | accept inferred 2/3/4 |
| v4 shape, `version: "5.0.0"` | **accept 4** |
| v4 shape, `version: "1.0.0"` | **accept 4** |
| v2 shape, `_version: "1.0.0"` or `"5.0.0"` | **accept 2** |
| explicit `null`, boolean, number, object, array, empty/whitespace, or `"garbage"` | **accept by shape** |
| `"3garbage"`, `"3.0.0junk"`, `"3."`, or `"3"` | **accept 3** |
| `"03.0.0"`, `"+4.0.0"`, or `"2e1.0.0"` | **accept 3/4/2** |
| `version:"4.0.0", _version:"2.1.0"` | **accept 4; conflict ignored** |
| `version:"2.1.0", _version:"4.0.0"` | **accept 2; conflict ignored** |
| `version:"5.0.0", _version:"2.1.0"` | **accept 2; unsupported declaration masked** |
| `version:"4.0.0", _version:"5.0.0"` | **accept 4; unsupported declaration ignored** |

Accessor/inheritance/proxy observations must be interpreted after the real JSON boundary:

- The public API receives ZIP bytes, not a metadata object. `parseJson()` uses native `JSON.parse()` and `requireRecord()`; the resulting `Info.dat` object is an ordinary object with own data properties.
- An inherited `version` is omitted by `JSON.stringify()` and reaches the inspector as genuinely absent, so the v4 shape heuristic accepts it as v4.
- An enumerable own accessor or a proxy-provided `version` is executed by the caller's `JSON.stringify()` before archive construction; the inspector receives the resulting own data property. When it serializes `5.0.0`, current inspection wrongly accepts it as v4 for the same ordinary declaration bug.
- JSON text containing an own `"__proto__"` object does not mutate the parsed object's prototype. A nested `__proto__.version` remains non-declarative and the version is genuinely absent.
- Consequently, there is no reachable inherited/accessor/proxy object inside `detectFormatMajor()` through the public archive API. Tests should lock this serialization/parse reality instead of pretending hostile JavaScript object identity crosses ZIP/JSON parsing.

Facts above are direct runtime observations. The intended post-fix outcomes below are recommendations derived from repository policy.

## Expected Behavior

The vendor README has stated since the initial implementation commit `938c6f55` that archive inspection rejects “unsupported metadata versions.” The public manifest contract admits only source majors `2 | 3 | 4`. Bead `b9e` further requires explicit unsupported or nonconforming versions to reject before heuristics while preserving documented versionless legacy compatibility.

Required distinction:

1. **Explicit declaration present:** either own JSON key `version` or `_version` is a declaration. Every present declaration must be a conforming supported version. Unsupported major, malformed string, wrong type, empty value, or conflict must fail closed with public code `unsupported`. Shape must not rehabilitate it.
2. **Declaration absent:** only when neither own key exists may the existing legacy shape heuristic infer v2, v3, or v4. If no recognized shape exists, reject as missing/unsupported.

The current vendor README does not spell out versionless inference; that compatibility is explicit in `b9e` and has existed in source since `938c6f55`. It should be documented when fixed so code, tests, and policy agree.

## Execution Path

```text
inspectBeatSaverArchive(input)
→ readInput() snapshots Blob/ArrayBuffer/Uint8Array
→ parseCentralDirectory() validates bounded ZIP structure
→ inflateArchiveEntry() validates actual size and CRC
→ locate exactly one Info.dat
→ parseJson()
   → fatal UTF-8 decode
   → JSON.parse()
   → requireRecord() requires ordinary/null-prototype record
→ buildSourceManifest(info, ...)
   → optionalString(info.version) || optionalString(info._version)
      - wrong type and empty string collapse to ""
      - nonempty `version` masks `_version`
   → detectFormatMajor(versionText, info)
      → Number.parseInt(first dot-separated token, 10)
      → exact numeric 2/3/4 returns immediately even with malformed suffixes
      → otherwise `_version` or `_difficultyBeatmapSets` presence infers v2
      → otherwise `song`, `audio`, or `difficultyBeatmaps` presence infers v4
      → otherwise `version` or `difficultyBeatmapSets` presence infers v3
→ branch-specific hash-input construction
   → major 4 requires AudioData and preserves duplicate ordered references
   → major 2/3 uses legacy deduplicated reference sequence
→ difficulty/audio/path normalization
→ frozen source manifest
→ service acquireVersion/importLocalArchive use this same inspector
```

The interaction has two separate admission defects:

- `optionalString()` destroys the distinction between absent and present-but-invalid declarations.
- `detectFormatMajor()` treats failed explicit parsing as permission to infer from shape. Its permissive `parseInt` also accepts numeric prefixes rather than a complete version token.

A declared supported major currently controls downstream hash semantics even when the surrounding keys resemble another generation. This diagnosis does **not** recommend adding broad shape-versus-major rejection: doing so exceeds `b9e` and risks rejecting hybrid legacy archives.

## Most Likely Root Cause

**Confirmed root cause:** explicit declaration validation and absent-version compatibility were combined into one fallback routine.

Evidence:

1. `buildSourceManifest()` reads values, not own-key presence, through `optionalString()`.
2. `optionalString()` maps every non-string to `""`.
3. `detectFormatMajor()` only returns/throws after permissive `parseInt`; failed parsing proceeds directly to shape inference.
4. The v4 indicators on a v4 archive therefore convert explicit v1/v5/malformed declarations into accepted major 4. `_difficultyBeatmapSets` does the same for v2.
5. Both service import paths call the public inspector, so the defect propagates unchanged.
6. `git blame` and `git log -G` show this detector has been unchanged since initial implementation `938c6f55`; the hashing candidate did not introduce it.
7. README policy has always promised unsupported-version rejection, but tests only assert successful canonical v2/v3/v4 fixtures and never exercise declaration admission.

## Alternative Hypotheses

Ranked by likelihood:

1. **Declaration/heuristic conflation — confirmed.** It explains every reproduced unsupported, wrong-type, malformed-prefix, and conflict row.
2. **`Number.parseInt()` alone — contributing, not sufficient.** Replacing it with strict parsing would reject prefix garbage only if failed parsing also stops. Without separating presence, strict parse failure would still fall into shape heuristics.
3. **`optionalString()` alone — contributing, not sufficient.** Preserving wrong types would help, but unsupported well-formed strings such as `5.0.0` would still fall through unless explicit declarations stop inference.
4. **Hash migration regression — contradicted.** The relevant detector and tests are byte-historical from `938c6f55`; candidate `a654d919` changed hashing seams, not version detection.
5. **ZIP parser or provider DTO corruption — contradicted.** The mutated Info JSON passes bounded ZIP/UTF-8/CRC parsing exactly; the wrong decision is made after parsing and before manifest hash-path construction.
6. **Prototype/accessor/proxy bypass — unreachable at the public boundary.** Native JSON parsing creates ordinary own data properties. Serialization can generate a declaration value, but object identity/behavior does not survive.
7. **Shape inference should be deleted entirely — inconsistent with assigned compatibility requirement.** It would close the defect but overreject intentionally retained versionless legacy archives.

## Why Previous Fixes Failed

No version-admission fix has been attempted. The current candidate's shared-hash migration is unrelated and therefore could not affect this detector.

The defect survived because:

- canonical v2/v3/v4 positive fixtures all carry valid declarations;
- the 24 malicious archive cases focus on ZIP structure/path/CRC/limits and stable `archive` errors, not metadata-version admission;
- service, browser, real-archive, hash-golden, and pack gates reuse valid metadata;
- existing tests never distinguish key absence from invalid key value;
- self-consistent fixture generation proves supported paths but cannot reveal an untested policy branch.

This is a coverage gap, not evidence that the earlier hash repair treated this symptom.

## Unknowns

- Repository evidence does not define a formal grammar beyond examples such as `2.0.0`, `2.1.0`, `2.6.0`, `3.0.0`, `3.3.0`, and `4.0.0`. The narrow recommendation below uses exactly three dot-separated ASCII numeric components and supported major token `2`, `3`, or `4`. A broader production archive corpus would resolve whether legitimate two-component or decorated versions exist.
- The current tree contains no explicit versionless fixture despite the durable `b9e` requirement and original source heuristic. The exact real archive(s) motivating this compatibility are not identified.
- Duplicate identical JSON keys are collapsed last-wins by `JSON.parse()` and cannot be detected after parsing. `b9e` asks about the two distinct keys, not duplicate lexical keys; duplicate-key rejection would require a different parser and is outside the minimal fix.
- It is not specified whether both declarations with the same major but different minor/patch values should reject. To minimize compatibility risk, the recommendation accepts them when both are individually conforming and resolve to the same supported major, while rejecting cross-major conflict.

## Minimal Reproduction

1. Generate the repository's deterministic v4 ZIP using `createSyntheticBeatSaverZip(4)`.
2. Inflate only for fixture mutation, parse `Info.dat`, and set `info.version = "5.0.0"`.
3. Re-encode Info and regenerate a valid ZIP.
4. Call public `inspectBeatSaverArchive(bytes)`.
5. Observe successful `manifest.sourceFormatMajor === 4` instead of an `unsupported` error.

Controls:

- unchanged explicit `4.0.0` passes as major 4;
- deleting the `version` key passes as major 4 by intended legacy shape compatibility;
- setting version to `5.0.0`, `1.0.0`, `null`, `5`, `{}`, `[]`, `"garbage"`, or prefix-parse strings currently also passes, but must reject after repair.

## Proposed Verification

Add a table-driven public-inspector suite before changing code and show it fails on the current candidate. Then apply the minimal fix and require:

### Must accept

- canonical explicit v2 `_version`, v3 `version`, and v4 `version`;
- supported majors supplied under either declaration key, preserving current tolerant key aliasing;
- both keys when both are conforming and resolve to the same supported major;
- truly absent declaration on canonical v2, v3, and v4 shapes;
- the existing exact v2/v3/v4 locked provider/archive hashes and real 4858/3D44B paths unchanged.

### Must reject with code `unsupported` before shape inference

- explicit `1.0.0` and `5.0.0` under each key on each representative shape;
- null, boolean, number, object, array, empty, whitespace, and arbitrary text;
- partial/prefix values including `3`, `3.`, `3garbage`, `3.0.0junk`, `03.0.0`, `+4.0.0`, and `2e1.0.0`;
- both-key cross-major conflicts;
- one valid declaration plus one unsupported or malformed declaration, regardless of key order.

### JSON-boundary hostile-object reality

- public archive containing own `__proto__` but no own declaration follows the absent-version path without prototype mutation;
- an accessor/proxy serialized to `5.0.0` is rejected as an ordinary own data declaration after parsing;
- an inherited property omitted during serialization remains absent and exercises only the documented versionless heuristic.

### Path propagation

- run representative unsupported and absent rows through `inspectBeatSaverArchive`, `acquireVersion`, and `importLocalArchive`;
- browser secure and genuine insecure HTTP tests should include at least explicit v5 rejection plus versionless acceptance so native/fallback hashing cannot obscure parser policy;
- rerun `npm test`, `npm run test:browser`, dry pack, downstream authoring/assembly matrices required by `i4u.1.2`, and exact hash golden/tamper cases.

This verification distinguishes strict declaration admission from deleting legacy inference or merely tightening `parseInt`.

## Recommended Fix

Change only metadata-major admission in `src/archive.js`; do not change ZIP parsing, hash sequencing, provider comparison, DTO normalization, downstream schemas, or byte limits.

Recommended logic:

1. Use `Object.hasOwn(info, "version")` and `Object.hasOwn(info, "_version")` to classify declarations before reading values.
2. For every present declaration, require a string matching a complete bounded grammar equivalent to `^(2|3|4)\.[0-9]+\.[0-9]+$`.
3. Reject any present malformed/unsupported declaration immediately with stable code `unsupported` and a bounded non-echoing message such as `Beat Saber metadata version declaration is unsupported or malformed`.
4. If both keys exist, validate both. Accept only if both resolve to the same major; reject different majors or any invalid member. This prevents one explicit unsupported declaration from being masked by the other.
5. Only when neither own key exists, run the existing shape heuristic in its current precedence: `_difficultyBeatmapSets` → 2; `song`/`audio`/`difficultyBeatmaps` → 4; `difficultyBeatmapSets` → 3; otherwise throw the existing missing-version `unsupported` error.
6. Use own-key checks for heuristic markers as defense in depth, although native `JSON.parse()` already yields own data properties.
7. Preserve current acceptance of hybrid supported-key aliases and do not add broad declared-major-versus-shape coherence rejection in this Bead.

Conceptually:

```text
declarations = own(version), own(_version)
if declarations exist:
  validate every complete value as supported x.y.z
  require one unique major
  return that major
else:
  infer only from own structural markers
```

This is the smallest fix that addresses the causal distinction. Tightening `parseInt` alone is insufficient; deleting heuristics is overbroad.

Regression risk is concentrated in noncanonical explicit version strings and dual-key conflicts, which are exactly the fail-closed target. The local real/synthetic corpus inspected here uses conforming triplets (`2.0.0`, `2.1.0`, `2.6.0`, `3.0.0`, `3.3.0`, `4.0.0`) and therefore is not rejected by the recommendation. Truly versionless shape compatibility remains intact.

## Debugging Record

```text
Problem: Explicit unsupported or malformed Beat Saber Info.dat versions are accepted through legacy shape inference.
Observed symptom: Public inspectBeatSaverArchive accepts v4-shaped version "5.0.0" as sourceFormatMajor 4; acquireVersion and importLocalArchive also succeed.
Root cause: buildSourceManifest collapses invalid values through optionalString, then detectFormatMajor uses permissive parseInt and falls from failed explicit parsing into absent-version shape heuristics.
Evidence: Full public-inspector matrix reproduces v1/v5/wrong-type/malformed-prefix acceptance, ignored dual-key conflicts, supported 2/3/4 and versionless inference; git blame shows unchanged logic since 938c6f55 while README promises unsupported-version rejection.
Failed approaches: No version fix attempted; shared-hash migration is unrelated. Existing positive/hash/archive-security/browser tests never distinguish declaration presence from invalid value.
Corrective action: Validate every own version/_version declaration completely and fail closed; reconcile dual keys; run shape inference only when both declarations are absent.
Verification test: Table-driven public inspector plus download/local/browser rows for supported, unsupported, malformed, dual-key, JSON-boundary, and truly absent declarations; preserve exact legacy hashes and versionless shapes.
Related files/components: vendor src/archive.js buildSourceManifest/detectFormatMajor/parseJson; scripts/validate-archive-security.js, fixture-helpers.js, validate-vendor-service.js, validate-browser-smoke.js; README archive policy; assembly i4u.1.2/b9e gates.
Remaining uncertainty: Formal accepted version grammar beyond repository triplet corpus; provenance of required real versionless archives; same-major dual-key minor/patch policy; duplicate lexical JSON keys outside b9e.
```
