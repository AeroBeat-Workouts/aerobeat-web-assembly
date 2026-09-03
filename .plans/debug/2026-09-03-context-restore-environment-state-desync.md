# Context restore environment state desynchronization

## Exact Observed Failure

Independent audit forced renderer context restoration and made the restored environment load settle in error. Renderer diagnostics reported error, while assembly retained ready state, blank status, and disabled Retry:

```json
{"assemblyState":"ready","rendererState":"error","status":"","retryDisabled":true}
```

Focused controls tests had manually forced both renderer and assembly state, so they did not exercise the autonomous renderer restore promise path.

## Expected Behavior

Whenever the renderer starts a fresh environment load—including WebGL context restore—the assembly controls must track that exact promise/generation. It must show loading while pending, settle to ready or `Environment unavailable. Retry.` for the current graph/connection/selection, enable Retry only on current error, and reject stale restore settlements after graph, connection, selection, session, visibility, or later-generation changes.

## Execution Path

1. Assembly attaches/selects/retries an environment and calls `trackEnvironmentLoad(id)`, capturing `renderer.environmentLoadPromise`.
2. WebGL context loss calls renderer `environmentOwner.handleContextLost()`.
3. Browser dispatches context restore.
4. Renderer facade `onContextRestored` autonomously calls `environmentOwner.restore(app)` and replaces `renderer.environmentLoadPromise`.
5. Assembly receives no notification and does not invoke `trackEnvironmentLoad` for this new promise.
6. Restored load settles error in renderer diagnostics.
7. Assembly's private `environmentLoadState` remains ready and status remains blank, so Retry remains disabled.

## Most Likely Root Cause

The renderer exposes only a mutable promise slot, and assembly samples it only after assembly-initiated attach/select/Retry operations. Context restoration originates inside renderer event handlers, creating a new generation without an assembly-observable lifecycle signal or polling hook.

## Alternative Hypotheses

1. Assembly status render failed: contradicted by manually forcing both states in focused tests.
2. Renderer restore did not update diagnostics: contradicted by rendererState error.
3. Selection changed during restore: independent probe retained the selected environment.
4. Camera mode hid status: probe showed blank status and disabled Retry due stale assembly state, not Camera copy.

## Why Previous Fixes Failed

Prior repairs added generation-safe `trackEnvironmentLoad` and settlement guards for assembly-initiated loads. Focused browser coverage mocked context-restore outcomes by mutating both renderer and assembly private state, masking the missing renderer-to-assembly synchronization path. No executable test drove a real renderer context-restored event with a new promise.

## Unknowns Resolved

- The existing private mutable `renderer.environmentLoadPromise` identity is sufficient. Assembly observes it once per already-bounded visible display frame and once on visible resume; no renderer edit, public callback/event, payload, timer, or independent polling loop is required.
- Context loss alone retains the last assembly state. Context restoration replaces the promise; the next bounded observation moves assembly to loading and disables Retry. A restore that occurs while the document is hidden is not rendered while hidden and is reconciled from the current promise/diagnostics on visible resume.

## Minimal Reproduction

Attach assembly with a selected photosphere, force renderer WebGL context loss and restoration, make `environmentOwner.restore()` settle error, then inspect renderer diagnostics and assembly environment status/Retry. Current result is renderer error versus assembly ready.

## Proposed Verification

Add an executable direct and genuine cross-origin iframe test that drives the real renderer context-lost/restored lifecycle, observes a new environment promise/generation, and verifies loading then ready/error UI. Include stale restore completion after selection, graph, connection, hidden, reconnect, and newer Retry generations; no stale result may mutate the current instance.

## Recommended Fix

Provide a narrow generic way for assembly to detect each new renderer environment load promise/generation, including autonomous context restore, then route it through the existing guarded settlement path. Do not expose environment IDs/configs/payloads through public snapshots, events, messages, telemetry, or storage. Replace the focused test's manual dual-state mutation with a real restore-driven adversarial path while retaining existing privacy and lifecycle checks.

## Implementation Evidence

The repair records the observed promise identity and selected ID before attaching one guarded settlement. Assembly-initiated attach, selection, and Retry use the same tracker, so the next display observation deduplicates rather than adding a second generation. Settlement requires the same graph, connected lifecycle/generation, session generation, selected ID, observed promise identity, and assembly load generation. Hidden/session-stale settlements request later reconciliation instead of mutating current UI. Camera-background hiding remains a rendering precedence only: internal ready/error truth updates while the visible copy stays `Environment hidden by Camera background.`

The focused browser validator now dispatches the renderer canvas's actual `webglcontextlost` and `webglcontextrestored` events in direct and genuine cross-origin iframe documents. Deferred owner fetches prove restore loading → error, exact Retry gating, Retry → ready, promise-identity deduplication, selection/clear/newer-generation rejection, Camera-hidden precedence, hidden restore visible-resume reconciliation, and hidden disconnect/reconnect new-graph rejection. It no longer overrides renderer diagnostics or manually mutates assembly load state.

## Debugging Record

```text
Problem: Renderer context restore starts an environment generation assembly never tracks.
Observed symptom: assembly ready/blank/Retry disabled while renderer reports environment error.
Root cause: trackEnvironmentLoad samples only assembly-initiated promise replacements; renderer onContextRestored replaces the promise autonomously.
Evidence: renderer-facade onContextRestored assignment, assembly track call sites, and independent browser probe.
Failed approaches: Focused test manually forced renderer and assembly states together, masking missing propagation.
Corrective action: Add private generic renderer-load generation observation and route restore promises through guarded assembly settlement.
Verification test: Real context-lost/restored direct+cross-origin iframe success/error/stale matrices; focused/full browser, npm test, build, privacy checks.
Related files/components: renderer src/renderer-facade.js; assembly src/index.js; environment controls browser validator.
Remaining uncertainty: None for the synchronization seam; full-suite cadence remains a separate host-sensitive validation concern.
```
