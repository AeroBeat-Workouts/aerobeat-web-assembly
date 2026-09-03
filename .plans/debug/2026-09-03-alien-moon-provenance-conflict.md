# Alien-moon provenance and scope conflict

## Exact Observed Failure

Read-only architecture review inspected the GLB after assembly payload commit `2e84f8818a798d5751c51744afc2919ec4427844` and found embedded glTF metadata:

- author: `Luis Vidal (https://sketchfab.com/Luis_Vidal)`
- title: `Icescape 1 Alien Moon Skybox`
- license: `CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)`
- source: `https://sketchfab.com/3d-models/icescape-1-alien-moon-skybox-bfc9a041814f4112b016904edfaad0c5`
- generator: `Sketchfab-15.77.0`

The approved plan described the local GLB as “already-owned” and prohibited third-party acquisition/redistribution. The new public assembly manifest instead says `ownership: owned-local-source`, `externalPayloadCopied: false`, and records no author/title/license/source. Both `aerobeat-environment-community` and `aerobeat-web-assembly` are public GitHub repositories. The assembly root license is “License pending”; the environment root license is a corrupted CC BY-NC text tracked separately as `aerobeat-template-asset` Bead `oc-n2m`.

## Expected Behavior

No third-party environment may be redistributed contrary to the approved scope. If Derrick deliberately authorizes this existing CC BY 4.0 asset, both public repositories and every assembled/released copy must retain accurate per-asset attribution, source, license URI, and notices without applying an incompatible additional restriction. Otherwise the copied payload must be removed from assembly and replaced with AeroBeat-authored content or omitted.

## Execution Path

1. The plan referenced an existing local GLB and called it owned.
2. Parent verification checked hashes, self-containment, bounds, and transform but did not inspect embedded `asset.extras` before authorizing the copy.
3. Slice `k72.13.1` copied the GLB/config into the public assembly repo and labeled provenance as an owned local source.
4. A concurrent read-only researcher inspected embedded glTF metadata and found explicit third-party author/source/CC BY 4.0 terms.
5. GitHub read-back confirmed both source and destination repositories are public, making this redistribution rather than private-only staging.

## Most Likely Root Cause

The direct root cause is conflating “already present in an AeroBeat-controlled repository” with “authored/owned by AeroBeat.” The embedded metadata is authoritative contrary evidence. The process gap was validating technical self-containment without validating embedded authorship/license metadata before copying to another public repository.

## Alternative Hypotheses

1. **AeroBeat separately acquired ownership from Luis Vidal** — possible but no record was found in repo history, README, manifest, or commit messages. Derrick must confirm if such rights documentation exists.
2. **Embedded metadata is stale after a rights transfer** — possible but unsupported; a transfer record would be required.
3. **CC BY 4.0 alone permits current use** — it permits redistribution with attribution, but does not satisfy the plan's explicit no-third-party scope and the new manifest omits direct attribution.
4. **Metadata retention inside GLB is sufficient attribution** — it may preserve some license data, but the public package’s contradictory “owned-local-source” claim remains inaccurate and consumer-visible notices are absent.

## Why Previous Fixes Failed

The earlier license repair covered only the new gameplay-asset repository’s CC BY-NC legal text. It did not inspect environment GLB metadata. Slice validation asserted `sourceMetadataRetainedInGlb` without parsing that metadata into provenance policy, so it validated the presence of the evidence while reporting the opposite ownership conclusion.

## Unknowns

- Whether Derrick has a separate ownership/license-transfer agreement beyond the embedded CC BY 4.0 grant.
- Whether Derrick intends to permit this specific existing third-party CC BY asset despite the no-third-party clause.
- Whether the asset should instead be replaced by new AeroBeat-authored environment art.

## Minimal Reproduction

Parse the JSON chunk of the copied GLB and print `asset.extras`; compare it with `assets/environments/alien-moon-icescape/1.0.0/manifest.json` fields `source.ownership` and `provenance.externalPayloadCopied`. Query GitHub visibility for both repositories; each returns `PUBLIC`.

## Proposed Verification

Before further environment wiring or release:

1. Obtain Derrick’s explicit choice: authorize CC BY 4.0 use with attribution, provide ownership-transfer evidence, replace with AeroBeat-authored art, or remove the environment.
2. If CC BY use is approved, add exact per-asset author/title/source/license notices to source and assembly, correct the manifest, validate metadata equality, fix conflicting root-license treatment, and independently audit attribution in built/released output.
3. If not approved, remove the copied environment payload from assembly and preserve only the independently valid bomb/atlas cleanup work.

## Recommended Fix

Freeze renderer environment wiring and reopen the payload slice. Create a blocking provenance Bead. Ask Derrick for the explicit scope decision. Do not erase pushed history; add a transparent corrective commit matching the chosen path. Keep the technically valid bomb projection and obsolete-atlas removal regardless of environment choice.

## Debugging Record

Problem: A third-party CC BY 4.0 skybox was treated as AeroBeat-owned and copied to a public assembly repo.
Observed symptom: Embedded author/license/source metadata contradicts the new manifest and approved no-third-party scope.
Root cause: Local custody was mistaken for authorship/ownership; embedded provenance was not checked before copy.
Evidence: GLB `asset.extras`, public GitHub visibility, inaccurate manifest, absent repo-level attribution.
Failed approaches: Hash/self-containment-only validation and inherited root-license assumptions.
Corrective action: Freeze wiring, reopen payload, obtain Derrick’s decision, then attribute correctly or remove/replace.
Verification test: Built/released inventory and notices match the approved ownership/license path; independent legal-provenance audit passes.
Related files/components: Alien-moon GLB, assembly manifest, source/assembly LICENSE/README, `k72.13.1`, renderer partial environment work.
Remaining uncertainty: Existence of separate ownership-transfer evidence and Derrick’s intended exception/alternative.
