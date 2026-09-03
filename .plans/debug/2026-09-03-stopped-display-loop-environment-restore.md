# Stopped display-loop environment restore is not observed

## Exact Observed Failure

Fresh read-only pre-landing audit reproduced a visible-document renderer context restoration while assembly gameplay rendering was stopped. The renderer replaced and settled a new `environmentLoadPromise`, but assembly never observed that identity:

```json
{
  "before": {"menuOpen":true,"frameTimer":0,"assembly":"ready","status":"","renderer":"ready"},
  "pending": {"identityChanged":true,"assembly":"ready","status":"","renderer":"loading","observedIdentity":false},
  "settled": {"assembly":"ready","status":"","copy":"","renderer":"error","retryDisabled":true,"observedIdentity":false}
}
```

Actual-event reproduction: await the initial environment load; retain a visible document with `menuOpen=true` and `frameTimer=0`; defer the renderer environment owner's fetch; dispatch cancelable `webglcontextlost` and then `webglcontextrestored` on the real renderer canvas; do not invoke any assembly private observer; reject the restore fetch. The failure occurs after the renderer restore promise settles: renderer diagnostics are `error`, while assembly remains `ready`, has blank status copy, and keeps Retry disabled.

Directly observed facts are the real canvas events, changed renderer promise identity, renderer loading/error diagnostics, unchanged assembly state/status, stopped frame loop, and disabled Retry. It is inferred—not directly observed from that output alone—that paused, stopped, and completed sessions fail identically because each can have the same visible `frameTimer=0` condition.

## Expected Behavior

Every renderer-created environment generation must synchronize into private assembly loading/ready/error state even when gameplay display rendering is stopped. A visible context restoration must immediately become loading after renderer event handling has replaced the promise, then settle ready or to exact copy `Environment unavailable. Retry.` with Retry enabled only for current error. Hidden restores must not mutate stale hidden UI and must reconcile on visible resume. Old graph, connection, selection, session, hidden, reconnect, and older promise settlements or events must not affect current UI.

The synchronization must remain private and non-payload-bearing: no public renderer API/event addition, host event, iframe message, snapshot field, storage, telemetry, timer, independent polling loop, renderer source edit, or environment payload exposure.

## Execution Path

1. Assembly connects, attaches the renderer to its stable canvas, and tracks the attach-created environment promise.
2. Initial loading settles ready; menu remains open and `frameTimer` remains `0`.
3. Renderer registered its canvas `webglcontextlost` and `webglcontextrestored` listeners during `attach()`.
4. Actual `webglcontextlost` reaches renderer `onContextLost`, which invalidates the resident environment generation.
5. Actual `webglcontextrestored` reaches renderer `onContextRestored`, which synchronously assigns `environmentLoadPromise = environmentOwner.restore(app)`.
6. Assembly has no canvas restore listener. Its only autonomous promise-identity checks are `runDisplayFrame()` and the visible branch of `applyVisibility()`.
7. Because the document was already visible and `frameTimer=0`, neither path executes.
8. Renderer restore settles error. No assembly settlement was attached to that promise, so assembly remains ready with blank copy and disabled Retry indefinitely.
9. The focused browser validator masks step 6 by explicitly calling `element.observeEnvironmentLoad()` after dispatching restore.

## Most Likely Root Cause

The prior repair correctly made promise settlement generation-safe but placed discovery only in an active gameplay display loop or a visibility transition. Promise identity is the correct private lifecycle token; its production observation coverage is incomplete. A visible stopped-loop renderer context restoration has no assembly-owned notification path.

Evidence: assembly source calls `observeEnvironmentLoad(graph)` from `runDisplayFrame()` and visible `applyVisibility()`, while renderer source replaces the promise synchronously in its canvas context-restored listener. The exact actual-event probe remains desynchronized until an unrelated future display loop or visibility transition. Existing focused tests manually supply the missing call.

## Alternative Hypotheses

1. **Renderer does not replace the promise.** Contradicted by `identityChanged=true` and renderer loading/error transitions.
2. **Assembly settlement guards reject a correctly observed promise.** Contradicted because `observedIdentity=false`; no settlement was registered at all.
3. **Camera-hidden status precedence hides the error.** Contradicted by blank copy rather than the Camera-hidden copy and by assembly state remaining ready.
4. **Retry rendering is stale.** Lower likelihood and downstream only: Retry correctly reflects assembly ready state, but that state is stale because discovery never occurred.
5. **Event listener ordering prevents assembly from reading the new promise.** Relevant to the repair design, not the existing failure. A synchronous assembly listener could run before renderer depending on registration order; a microtask after the restore event dispatch avoids relying on listener order because renderer replacement is synchronous.

## Why Previous Fixes Failed

The prior fix assumed the bounded gameplay display loop was an always-available observation surface. That assumption is false for initial/menu-open, paused, stopped, and completed visible lifecycle states where `frameTimer=0`. Visible-resume reconciliation handles hidden-to-visible changes but not a document that was already visible.

The prior focused test dispatched actual renderer context events but immediately invoked `observeEnvironmentLoad()` itself. That test proved guarded tracking and settlement after discovery, not production discovery. It therefore treated the missing notification as test setup and concealed the root defect.

## Unknowns

- Whether the assembly listener is registered before or after renderer listeners in every attach/reconnect path. The fix must not depend on this ordering.
- Whether a queued restore microtask can run after disconnect/reconnect. It can, so it must capture and verify graph plus connected generation before observing.
- Whether hidden restore events should queue any state mutation. Requirement says no: hidden handling should only mark reconciliation need, with current promise observed on visible resume.
- Whether repeated restore events can queue duplicate microtasks. Promise-identity deduplication must make repeated observation harmless, while listener lifecycle must remain exactly once per connected canvas.

## Minimal Reproduction

1. Load `<aero-game>` and await its initial renderer environment promise.
2. Confirm `document.hidden === false`, `menuOpen === true`, `frameTimer === 0`, and assembly state is ready.
3. Replace only `renderer.environmentOwner.fetchFn` with a deferred promise.
4. Dispatch `webglcontextlost` and `webglcontextrestored` on `game.canvasElement()`.
5. Do not call `observeEnvironmentLoad()` and do not start gameplay.
6. Reject the deferred fetch and await the renderer promise.
7. Observe renderer error versus assembly ready/blank/Retry-disabled.

The failure does not occur if the test manually calls the private observer, if an active display frame runs after restore, or if a visibility transition invokes visible reconciliation.

## Proposed Verification

First add a direct and genuine cross-origin iframe regression that holds `frameTimer=0`, dispatches the actual canvas context events, never invokes `observeEnvironmentLoad()` from test code, and uses a deferred owner fetch. Assert automatic assembly loading before settlement, then ready or exact error copy/error-only Retry after settlement. This distinguishes missing notification from settlement-guard defects.

Then exercise a queued old-canvas restore event followed by disconnect/reconnect, hidden restore followed by visible resume, repeated restore events, selection/newer-promise replacement, and listener attach/remove counts. No stale event or settlement may mutate the current graph. Existing hostile config, privacy, accessibility, layout, package, and non-cadence browser gates must remain unchanged.

## Recommended Fix

Add one assembly-owned private `webglcontextrestored` listener to the stable renderer canvas for each connected lifecycle. The listener captures the current graph and connected generation, then queues one microtask. In that microtask, require the same graph, generation, connected lifecycle, and canvas. If hidden, set only the private reconciliation flag; otherwise call the existing promise-identity observer. The microtask ensures renderer's synchronous listener has replaced `environmentLoadPromise` regardless of listener registration order.

Register and remove the exact same listener once with the existing host lifecycle binding/teardown. Keep the display-loop observation as harmless deduplicated defense, and retain visible-resume reconciliation. Do not add timers, public events, renderer changes, messages, payloads, telemetry, snapshots, or storage.

## Implementation Evidence

Assembly now binds one private `webglcontextrestored` listener to its stable canvas during each connected host-lifecycle bind and removes that same bound function during teardown. The handler captures graph, connection generation, and canvas, then waits one microtask before checking currentness. Visible current restores enter the existing identity-deduplicated tracker; hidden restores set only the reconciliation flag and are observed by the existing visible-resume path. A queued old-graph handler returns before touching the reconnected graph.

Focused direct and genuine cross-origin iframe tests retain `frameTimer=0`, dispatch the actual canvas context events, and contain no call to `observeEnvironmentLoad()`. They prove automatic generation increment/loading, renderer-promise identity capture, exact error copy and Retry gating, Retry/restore ready, clear/selection/newer-generation stale rejection, Camera-hidden precedence, hidden reconciliation, and queued restore followed by disconnect/reconnect. Static validation requires exactly one add/remove call site, the microtask/current/hidden guards, and absence of manual observer calls in browser coverage.

Fresh focused browser, assembly environment/package validator, `npm test`, production build, environment sync check, release-pack policy, privacy/noise checks, and all non-cadence browser suites pass. Known externally blocked qv7/product-shell cadence was intentionally not rerun.

## Debugging Record

```text
Problem: Visible renderer context restore is not observed when the gameplay display loop is stopped.
Observed symptom: Renderer promise changes loading→error while assembly stays ready/blank and Retry disabled at frameTimer=0.
Root cause: Promise discovery exists only in runDisplayFrame or a visibility transition; no stopped-loop production notification exists.
Evidence: Exact actual canvas event probe, observedIdentity=false, source call sites, and focused test manual observer calls.
Failed approaches: Bounded display-loop observation plus visible-resume alone; tests manually invoking the missing observer.
Corrective action: Lifecycle-exact assembly canvas restore listener that defers observation to a guarded microtask.
Verification test: Direct and real cross-origin iframe actual context loss/restore with frameTimer=0 and no private observer call, plus hidden/reconnect/stale listener tests.
Related files/components: assembly src/index.js; scripts/validate-environment-controls-browser.js; renderer src/renderer-facade.js (read-only reference).
Remaining uncertainty: Exact listener registration order is intentionally neutralized by microtask ordering and current graph/generation guards.
```
