# Vite filesystem allowlist diagnosis

## Exact Observed Failure

Fact: `vite.config.js` configures `server.fs.allow` as `fileURLToPath(new URL("..", import.meta.url))`, which is `/home/derrick/.dsh/projects/aerobeat`. With `strict` omitted from the local object, Vite's default behavior is relied on rather than the required explicit `strict: true` policy.

That one parent root contains assembly, every linked dependency, unrelated sibling repositories, shared plans, Beads data, and other project files. A Vite `/@fs/` request under that parent is therefore allowed by the configured filesystem boundary even when the target has no ownership relationship to assembly.

Audit evidence: s1q comment `01a073f1-adc6-792d-95f9-d1d0c8e7a017` and blocker `aerobeat-web-assembly-9ha` identify this exact parent-root exposure.

## Expected Behavior

Development Vite must retain `server.fs.strict: true` and allow only:

- the assembly package root;
- exact package roots owned by `file:` dependency declarations whose package identity matches the dependency key;
- approved pinned asset directories already within those owned roots (assembly environments and renderer gameplay `0.0.7`).

Normal source-linked module loading, module Worker loading, direct and genuine iframe browser behavior, environment images, gameplay GLBs, builds, and tests must continue. Unapproved sibling repositories, the parent AeroBeat root, and outside files must return HTTP 403 through `/@fs/`. Production asset URLs and bytes must not change and no asset may be copied.

## Execution Path

1. Assembly declares fourteen local `file:../aerobeat-web-*` dependencies in `package.json`.
2. Vite resolves symlinked package imports to their real sibling package source paths (`preserveSymlinks: false`).
3. Files outside Vite's app root require explicit `server.fs.allow` ownership.
4. Current config solves that by allowing the common parent directory instead of enumerating owned dependency roots.
5. Vite's `/@fs/` middleware checks whether requested paths fall under any allowed root.
6. Because every sibling and parent-owned file falls under the common parent, unrelated paths pass the filesystem boundary.

## Most Likely Root Cause

The allowlist was based on filesystem topology (“all linked repos share this parent”) rather than package ownership (“these exact `file:` dependencies are required”). It optimized for convenience and avoided maintaining an explicit set, but broadened authority beyond the import graph.

Evidence: resolving each `file:` dependency produces an exact package root whose `package.json.name` matches the dependency key. No runtime import requires the parent root itself. Assembly environment assets are inside assembly; pinned gameplay GLBs are inside the linked renderer root.

## Alternative Hypotheses

1. **Vite needs the parent as a workspace root (low likelihood).** Explicit package roots are supported by `server.fs.allow`; root search is unnecessary when ownership is enumerated.
2. **Only imported files are served despite broad allow (ruled out for the policy).** `/@fs/` is an explicit file-serving route; import reachability is not the authorization boundary.
3. **A short hardcoded package list is sufficient (medium likelihood but weaker).** It would work now, but can silently drift from package ownership. Deriving roots from exact `file:` declarations and verifying package-name ownership is bounded and fail-closed.
4. **Only `src/` subdirectories should be allowed (possible but risky).** Node package export resolution and package metadata, worker entries, and pinned asset directories can require files outside `src/`. Exact package roots are the minimum stable ownership boundary; adversarial tests ensure the parent and unrelated siblings remain denied.

## Why Previous Fixes Failed

No assembly source fix was attempted. A separate UI repair used a narrow two-root allowlist, but that config does not govern assembly. Existing browser/build tests prove required paths load; they do not attempt forbidden `/@fs/` requests, so broad authority remained invisible.

## Unknowns

- Whether every declared local dependency is loaded in the production browser graph or some exist only for generic/development routes. The package declarations remain assembly-owned and source-linked; a server test should probe every derived root while browser/build gates prove the actual graph.
- Whether Vite returns exactly 403 versus another denial status for every malformed path encoding. Use canonical absolute `/@fs/` URLs and require 403 for ordinary sibling/parent/outside files.

## Minimal Reproduction

1. Start the normal assembly Vite development server.
2. Request `/@fs//home/derrick/.dsh/projects/aerobeat/<unapproved-sibling>/package.json` or `/@fs//home/derrick/.dsh/projects/aerobeat/.plans/...`.
3. The target is under the configured parent allow root and is not rejected by the filesystem allowlist.

A truly outside path such as `/etc/hosts` may already be denied, demonstrating that strict middleware exists but the chosen root is too broad.

## Proposed Verification

Export/derive the exact allow roots from package ownership and add a programmatic Vite-server regression that:

- asserts `strict === true`;
- asserts the parent root is absent;
- asserts every root is the assembly root or a verified exact `file:` dependency package root;
- fetches assembly source, every required linked package entry/package file, one environment asset, and one pinned renderer gameplay GLB successfully;
- fetches an unapproved sibling file, a parent-level plan/file, and `/etc/hosts` via canonical `/@fs/` URLs and receives 403.

Then run the full direct/genuine-iframe browser matrix, environment/gameplay asset tests, q7g, and normal build.

## Recommended Fix

Create a small fail-closed helper in `vite.config.js` that reads assembly `package.json`, selects only `file:` dependencies, resolves each relative target, verifies each target's `package.json.name` equals the dependency key, and returns a deduplicated frozen list containing assembly plus those exact roots. Set `server.fs = { strict: true, allow: exactRoots }`. Keep the approved asset paths inside their owning roots and retain their existing hash checks and production URLs.

Potential regressions: omitting a transitive source-linked package, Vite prebundling behavior, Worker module resolution, or accidental OS-dependent path comparison. Full browser/build and canonicalized adversarial server tests cover those risks.

## Debugging Record

```text
Problem: Vite development filesystem authority covers the full AeroBeat parent checkout.
Observed symptom: server.fs.allow contains only /home/derrick/.dsh/projects/aerobeat.
Root cause: Allow roots were chosen by common-parent topology instead of exact package ownership.
Evidence: Fourteen exact file: dependencies resolve to matching package roots; assembly/renderer assets live under owned roots; no import requires parent authority.
Failed approaches: Existing browser/build tests checked availability only; UI's separate narrow config did not affect assembly.
Corrective action: Derive verified exact file-dependency roots plus assembly root; set strict:true; add positive and adversarial server checks.
Verification test: Required package/module/environment/GLB URLs succeed; sibling, parent, and outside /@fs/ URLs return 403; full direct/iframe/browser/build gates pass.
Related files/components: vite.config.js, package.json, scripts Vite/browser validators, linked @aerobeat packages, assembly environment assets, renderer gameplay/0.0.7.
Remaining uncertainty: Whether any transitive package escapes direct declared ownership; build/browser tests will expose omissions.
```
