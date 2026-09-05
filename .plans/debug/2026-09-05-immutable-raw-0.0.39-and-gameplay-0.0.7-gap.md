# Debugging record — immutable raw 0.0.39 and gameplay 0.0.7 gap

## Exact Observed Failure

Independent QA comment `01a0736c-3f25-7099-a250-33ef68fe4b2f` on Bead `aerobeat-web-assembly-9tf` reports two directly confirmed coverage gaps:

1. Assembly `scripts/validate-immutable-raw-snapshot.js` enumerates 14 releases from fixed baseline `f54d5ff94e831a6ac23fc05b489e1137aadffcdd`, ends at `0.0.38`, and therefore never checks tracked raw `0.0.39`. `scripts/validate-immutable-raw-mutations.js` probes only `0.0.37` and `0.0.38`.
2. Gameplay `tools/validate.py` hard-baselines `release/raw` and `review` only through `0.0.6`. Its normal validation checks the current `0.0.7` payload semantically and against self-authored inventory/review metadata, but does not bind the complete raw and review filesystem inventories to immutable external constants. `tools/test_subprocess_contract.py` mutates marker winding, but has no one-byte complete-tree mutation probe for raw or review `0.0.7`.

Exact current Git identities were independently observed:

- assembly `release/raw/0.0.39`: tree `799c9b346f1e1bffc96bf8e0cd01d8edd5e33928`, 41 tracked mode-`100644` files, 27,979,912 bytes, proof SHA-256 `a7687d39d0447b65f786c4de947d2c645a010e078cd976690cc2f8998415417d`, complete-manifest aggregate `d700c4d055c2a5d11e52c6fb59e1cb7b270bec8cb4b1f4a949821ea912dab59d`, source fingerprint `84cbbaa7445a24095dccc21af2c5f504840d136891798577739696101e1a879a` over 201 inputs.
- gameplay `release/raw/0.0.7`: Git tree `846c41297230b5077ab1119880b729cc120e1098`, 17 tracked mode-`100644` files, 49,515 bytes, complete tree digest `d7ed901aaff35295d25a1d79ca5caa243c3ade848b1a2dc22d664f4d1f3b8f28`, inventory SHA-256 `ba3f40ad3b178da9845a74c89d3a89115d13fa5bd86b291bf41031df70eabbf4`, proof SHA-256 `ebeb42ffaa351bcdbd7ae8120b62762d16d8957acd8a4b1286b324ffa5e6cfdb`.
- gameplay `review/0.0.7`: Git tree `8ca78c143d78743ff1dfce1b9fcadc5755a02530`, 28 tracked mode-`100644` files, 26,231,461 bytes, complete tree digest `91135c131745d17ca03a0a9e257c6adc747d65b96c9b9a7e3d5a4d1feacbc5dd`, hashes metadata SHA-256 `51d7864846e281e6f8492963270ba4d5423b148876515f3e60c45752036ae2a6`.

## Expected Behavior

The normal assembly unit gate must cover every frozen raw release through exact `0.0.39`. The gameplay validator must independently hard-anchor complete raw and review `0.0.7` inventories and bytes, not trust metadata inside the trees being checked. Both validators must read current tracked/worktree bytes without writing, and dedicated disposable-copy one-byte probes must prove rejection while leaving canonical payloads and Git trees unchanged. Existing assembly `0.0.35–0.0.38` and gameplay raw/review `0.0.1–0.0.6` anchors must remain intact.

## Execution Path

- Assembly: `npm test` → `test:unit` → `validate-immutable-raw-snapshot.js` → enumerate `${BASELINE}:release/raw` → compare baseline tree, HEAD tree, filesystem inventory, and bytes. Since the selected baseline predates `0.0.39`, that release cannot enter the loop. The mutation script similarly iterates a literal two-version list.
- Gameplay: `python3 tools/validate.py --root . --release 0.0.7` → iterate `PREDECESSOR_TREES` only through `0.0.6` → validate current `0.0.7` content against its own inventory/proof/review records and semantic constants. A coordinated one-byte change plus internal metadata change is outside an external complete-tree anchor; review has no complete immutable external anchor at all.

## Most Likely Root Cause

Both append-only immutable authorities were not advanced when their newest payloads became frozen. This is a coverage/versioning omission, not evidence that the payload bytes are already corrupt. The exact Git trees, aggregate digests, inventories, proof hashes, and clean upstream states match the recorded release evidence.

## Alternative Hypotheses

1. **Semantic validation is sufficient for gameplay 0.0.7.** Contradicted: semantic checks cannot prove every review PNG and metadata byte remains exact, and self-referential inventory/hash metadata is not an external immutable authority.
2. **Git cleanliness alone protects immutable payloads.** Contradicted: a validator must fail closed against dirty tracked-byte mutation before commit, which Git tree identity by itself does not detect.
3. **Filesystem permission bits are the immutable mode authority.** Contradicted: clean checkouts may materialize `0644/0755`, while finalized local payloads may be `0444/0555`. The portable tracked authority is exact Git mode `100644`; the worktree check need only reject an executable-bit drift.

## Why Previous Fixes Failed

The earlier assembly repair correctly advanced coverage from `0.0.36` through `0.0.38` and added disposable probes for `0.0.37/0.0.38`, but the same append-only update was not repeated after `0.0.39`. Gameplay release validation focused on the marker successor's semantic correctness, reproducibility, and inward-winding adversarial mutation; it did not add external complete-tree constants or raw/review byte-mutation probes.

## Unknowns

No material root-cause unknown remains. Implementation must retain portability across finalized and fresh-checkout permission masks and avoid relying on writable canonical frozen files.

## Minimal Reproduction

1. Run the current assembly immutable validator: it passes and reports 14 releases ending at `0.0.38` although raw `0.0.39` exists.
2. Inspect gameplay `PREDECESSOR_TREES`: it ends at raw/review `0.0.6` although raw/review `0.0.7` exist.
3. Observe that no normal gameplay adversarial test copies and one-byte-mutates either complete `0.0.7` tree.

## Proposed Verification

Advance the assembly baseline to public ancestor `2dbe2b7adb505c44ca979a27958f8b3c5a8cf2e9`, bind 15 releases through exact `0.0.39`, and add it to the disposable one-byte mutation loop. Add gameplay immutable constants for exact raw/review Git trees, tracked inventories/modes, total bytes, complete digests, and key inventory/proof/hash digests. Validate current bytes read-only. In a temporary copied fixture, mutate one byte in raw and one byte in review separately; require nonzero validation with the expected immutable mismatch. Before and after all gates, verify the five requested assembly trees and fourteen gameplay raw/review trees are unchanged.

## Recommended Fix

Make only append-only validator/test changes. Do not regenerate, rewrite, chmod, delete, or otherwise mutate frozen payloads. Keep every existing predecessor constant. Add external exact constants and copied-mutation subprocess probes, then run asset validation/reproducibility/subprocess adversarial plus assembly immutable/unit/release-policy/dry-pack tests.

## Debugging Record

```text
Problem: Latest frozen assembly raw and gameplay raw/review payloads are outside complete immutable external anchors.
Observed symptom: Assembly stops at 0.0.38; gameplay hard-baselines stop at 0.0.6; latest one-byte tree probes are absent.
Root cause: Append-only immutable validator authorities were not advanced when assembly 0.0.39 and gameplay 0.0.7 froze.
Evidence: Exact current Git trees/inventories/digests match release evidence, while literal baselines and mutation lists omit them.
Failed approaches: Prior assembly repair advanced only through 0.0.38; gameplay semantic/reproducibility/winding tests do not externally anchor every latest raw/review byte.
Corrective action: Append exact tree/inventory/mode/byte/digest constants and disposable copied one-byte probes.
Verification test: Canonical guards pass; raw/review copied mutations fail closed; full requested gates pass; all frozen Git object trees remain exact.
Related files/components: assembly immutable snapshot/mutation scripts; gameplay validate.py and subprocess adversarial tests; active plan; Beads feb/9tf.
Remaining uncertainty: None material.
```

## Fallback coder reconciliation (2026-09-05)

- Preserved and reviewed the failed child’s safe append-only assembly edits. The baseline correctly advances to raw `0.0.39` introduction commit `2dbe2b7adb505c44ca979a27958f8b3c5a8cf2e9`, retains all 15 discovered releases, and extends the disposable detached-worktree proof-byte probe through `0.0.39`.
- Strengthened that partial assembly snapshot further: every entry now binds exact baseline/HEAD blob identity, tracked mode `100644`, non-executable worktree materialization, complete filesystem inventory, bytes, proof digest, source fingerprint, path-ordered aggregate, and the documented globally sorted complete-manifest aggregate. The exact `0.0.39` aggregate is `d700c4d055c2a5d11e52c6fb59e1cb7b270bec8cb4b1f4a949821ea912dab59d`.
- The asset partial had correct raw/review `0.0.7` constants and a useful helper but never invoked it and had no mutation proof. Canonical validation now invokes it for exact Git tree, tracked inventory/modes, filesystem inventory, bytes, complete tree digest, and key metadata hashes. The adversarial suite copies each complete current tree to a temporary directory, flips one byte, and requires the external digest authority to reject both copies.
- First full asset reproduction exposed an integration defect in the partial approach: temporary generated roots are not Git repositories (`fatal: not a git repository`). After adding an explicit internal generated-fixture mode, a second reproduction correctly exposed that review PNG container bytes are intentionally outside the deterministic rebuild contract even though the canonical review is immutable (`generated review digest 3be7ff80… != canonical 91135c13…`). The final design keeps exact raw `0.0.7` digest enforcement in generated fixtures, keeps semantic/hash review validation there, and applies exact Git tree/review byte anchoring only to the canonical checkout. Normal user-facing validation cannot silently skip either canonical anchor.
- No frozen release or review payload was generated, rewritten, deleted, chmodded, or otherwise mutated. All adversarial writes occur only in disposable worktrees/copies.
