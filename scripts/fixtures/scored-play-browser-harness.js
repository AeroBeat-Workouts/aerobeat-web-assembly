// @ts-check
// Browser-evaluate fixture for the CONNECTED scored <aero-game> Play lifecycle.
// Usage (inside a Playwright locator.evaluate):
//   const { installScoredPlayHarness } = await import('/scripts/fixtures/scored-play-browser-harness.js');
//   const harness = await installScoredPlayHarness(element, { events: [...] });
//   await harness.selectChart(); await harness.setSetup({ boxingColliderVolume: {...} });
//   await harness.startPlay(); await harness.calibrate();
//   harness.feedPose({ leftWrist: {x:.3,y:.5}, rightWrist: {x:.7,y:.5}, nose:{x:.5,y:.2} });
//   const { pixels, score, frame } = harness.capture();
// Keep the harness in the child realm: never return raw pose or framebuffer through
// an AeroGame public API. Tests may extract bounded assertions via evaluate.

// Export the canonical public-package target projection alongside the real Play
// fixture so browser evaluations never bypass the linked dependency provenance.
export { boxingColliderTargetCenter } from '@aerobeat/web-gameplay';
export { flowSolidBladeRadiusWu, resolveSaberCapsule } from '@aerobeat/web-contracts';
export { equipmentColliderAnchors } from '../../src/equipment-collider-anchors.js';

const HASH = 'a'.repeat(64);
const PACKAGE_ID = 'scored-play-browser-fixture';
const SOURCE_ID = 'scored-play-browser-camera';
const VARIANT_ID = 'scored-play-boxing-collider';
const CHART_ID = 'scored-play-boxing-chart';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const required = (condition, message) => { if (!condition) throw new Error(`Scored Play fixture: ${message}`); };

/** Install before selecting the chart; only boundary services are replaced. */
export async function installScoredPlayHarness(element, { events, songDurationMs = 120000, mode = 'boxing' } = {}) {
  required(element?.tagName?.toLowerCase() === 'aero-game' && element.isConnected && element.graph, 'connected <aero-game> required');
  required(mode === 'boxing' || mode === 'flow', 'only scored Boxing or Flow mode supported');
  required(Array.isArray(events) && events.length > 0 && events.every(event => event?.schema === 'aerobeat/resolved_content_event' && event.version === 3 && typeof event.eventId === 'string' && Number.isFinite(event.centerTimestampMs)), 'nonempty resolved events required');
  required(Number.isFinite(songDurationMs) && songDurationMs > Math.max(...events.map(event => event.centerTimestampMs)) + 1500, 'audio duration must cover every scored event');
  const variantId = mode === 'flow' ? 'scored-play-flow-collider' : VARIANT_ID;
  const chartId = mode === 'flow' ? 'scored-play-flow-chart' : CHART_ID;
  const variant = Object.freeze({ variantId, chartId, mode, rulesetId: mode === 'flow' ? 'flow_colliders_v1' : 'boxing_collider_v1', recipeId: null, modifierIds: [], ranked: true, localOnly: false, mapHash: { schema: 'aerobeat/content_hash', version: 1, algorithm: 'sha256', value: HASH }, scoreIdentityHash: { schema: 'aerobeat/content_hash', version: 1, algorithm: 'sha256', value: HASH }, provenance: { baseVariantId: variantId } });
  const chart = Object.freeze(events.map(event => Object.freeze({ ...event, variantId, chartId })));
  const originalFactory = element.serviceGraphFactory;
  required(typeof originalFactory === 'function', 'production service graph factory missing');
  element.remove();
  element.serviceGraphFactory = options => {
    const graph = originalFactory(options);
    required(graph?.gameplay && graph?.renderer && graph?.input, 'factory did not provide real gameplay, renderer and calibrated input');
    const state = { pose: null, stream: null, cvRunning: false, cameraRequests: 0, cvStarts: 0, audioState: 'stopped', audioPositionMs: 0, durationMs: songDurationMs, audioSource: null, selectedVariant: null };
    const snapshot = () => ({ state: state.selectedVariant ? 'ready' : 'idle', packageId: state.selectedVariant ? PACKAGE_ID : null, selectedVariant: state.selectedVariant, variants: state.selectedVariant ? [variant] : [], resolvedEvents: state.selectedVariant ? chart : [], song: state.selectedVariant ? { name: 'Representative downloaded scored fixture', audio: { filePath: 'song.ogg' } } : null, background: null, lineage: null });
    const content = {
      getSnapshot: snapshot, subscribe: () => () => {}, setPlaybackState() {}, readAsset(path) { required(path === 'song.ogg', 'unexpected audio asset path'); return new Uint8Array([1, 2, 3]); },
      async loadPersistenceHandle(handle) { required(handle?.packageId === PACKAGE_ID, 'wrong persisted package'); state.selectedVariant = variant; },
      async selectVariant(id) { required(id === variantId, 'wrong selected scored variant'); state.selectedVariant = variant; },
      async swapFutureVariant(id) { return this.selectVariant(id); }, destroy() {}
    };
    const summary = Object.freeze({ key: PACKAGE_ID, packageId: PACKAGE_ID, packageHash: `sha256:${HASH}`, songName: 'Representative downloaded scored fixture', difficulty: 'Expert', createdAtMs: 1, assetCount: 1, sourceCacheCount: 0 });
    const authoring = { getSnapshot: () => ({ state: 'idle', progress: 0 }), subscribe: () => () => {}, async listPackages() { return [summary]; }, async estimateStorage() { return { usageBytes: 0, quotaBytes: 1024 }; }, async loadPackage(handle) { required(handle?.packageId === PACKAGE_ID, 'wrong downloaded package handle'); return { handle, package: {} }; }, cancel() {}, destroy() {} };
    const video = {
      getRetainedCameraStream: () => state.stream,
      async requestCamera() { state.cameraRequests++; const track = document.createElement('canvas').captureStream(1).getVideoTracks()[0]; required(track?.readyState === 'live', 'live fake camera track unavailable'); state.stream = new MediaStream([track]); return { status: 'granted', message: 'ok' }; },
      attachCameraStream: () => ({ sourceKind: 'live-camera', sourceId: SOURCE_ID, mirrored: true, currentTimeSeconds: 0, intrinsicWidth: 640, intrinsicHeight: 480, sourceAspectRatio: 4 / 3, sourceChangeId: 1 }),
      async play() {}, pause() {}, activateLease() {}, pauseForLease() {}, releaseLease({ releaseStream } = {}) { if (releaseStream) { state.stream?.getTracks().forEach(track => track.stop()); state.stream = null; } },
      describeStatus: () => ({ state: 'ready', sourceChangeId: 1 }), describeSurface: () => ({ sourceId: SOURCE_ID, mirrored: true, sourceChangeId: 1, sourceAspectRatio: 4 / 3 }), setDocumentHidden() {}, destroy() { state.stream?.getTracks().forEach(track => track.stop()); state.stream = null; }
    };
    const cv = { get running() { return state.cvRunning; }, async start() { state.cvStarts++; state.cvRunning = true; }, async stop() { state.cvRunning = false; }, async dispose() { state.cvRunning = false; }, getLatestPoseFrame: () => state.cvRunning ? state.pose : null, getStatus: () => ({ lifecycleState: state.cvRunning ? 'running' : 'stopped', running: state.cvRunning }) };
    // Deterministic device transport: only an explicit strictly forward seekSong
    // advances playing song time. Real context time and gameplay display clocks
    // still advance normally; the production coordinator alone judges samples.
    const position = () => state.audioPositionMs;
    const audio = {
      getSource: () => state.audioSource, async load(source) { required(source?.id === `${PACKAGE_ID}:audio` && source.arrayBuffer?.byteLength === 3, 'selected downloaded audio was not loaded'); state.audioSource = { id: source.id, durationSeconds: state.durationMs / 1000 }; state.audioState = 'ready'; },
      ensureMinimumDurationSeconds(seconds) { required(Number.isFinite(seconds) && seconds > 0, 'invalid scoring audio minimum'); state.durationMs = Math.max(state.durationMs, seconds * 1000); return state.durationMs / 1000; },
      getMixSnapshot: () => ({ musicVolume: .5, sfxVolume: .5 }), setMix() {}, async activateLease() {}, async releaseLease() {}, async pauseForLease() { await this.pause(); },
      async play() { required(state.audioSource, 'playing without selected audio'); state.audioState = 'playing'; },
      async pause() { state.audioState = 'paused'; }, async seek(seconds) { required(Number.isFinite(seconds) && seconds >= 0 && seconds * 1000 <= state.durationMs, 'invalid audio seek'); state.audioPositionMs = seconds * 1000; },
      async stop() { state.audioState = 'stopped'; state.audioPositionMs = 0; }, async setDocumentHidden(hidden) { if (hidden) await this.pause(); }, async destroy() {},
      getStatus: () => ({ state: state.audioState, autoplayState: 'allowed', durationSeconds: state.durationMs / 1000, positionSeconds: position() / 1000 }),
      getClockSnapshot: () => ({ contextTimeSeconds: performance.now() / 1000, positionSeconds: position() / 1000, durationSeconds: state.durationMs / 1000, progress: position() / state.durationMs, playing: state.audioState === 'playing' })
    };
    // No public pose field: this private closure is returned only to the child-local harness.
    element.__scoredPlayFixtureState = state;
    return Object.freeze({ ...graph, content, authoring, video, cv, audio });
  };
  const parent = document.querySelector('main');
  required(parent, 'product host <main> missing');
  parent.append(element);
  await element.lifecycleIntentTail;
  const graph = element.graph;
  required(graph?.gameplay && graph?.renderer && graph.input && element.__scoredPlayFixtureState, 'production graph failed to reconnect');
  const state = element.__scoredPlayFixtureState;
  delete element.__scoredPlayFixtureState;
  const originalGraph = graph;
  const active = () => required(element.isConnected && element.graph === originalGraph && element.graph.gameplay === graph.gameplay && element.graph.renderer === graph.renderer, 'connected production graph changed');
  const feedPose = ({ leftWrist = { x: .05, y: .58 }, rightWrist = { x: .95, y: .58 }, nose = { x: .5, y: .2 }, tPose = false, confidence = .99, timestampMs: requestedTimestampMs, render = true } = {}) => {
    active();
    for (const point of [leftWrist, rightWrist, nose]) required(Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1, 'pose landmarks must be normalized');
    const y = tPose ? .4 : .58;
    const points = { nose, left_shoulder: { x: .35, y: .4 }, right_shoulder: { x: .65, y: .4 }, left_elbow: { x: .2, y }, right_elbow: { x: .8, y }, left_wrist: tPose ? { x: .05, y: .4 } : leftWrist, right_wrist: tPose ? { x: .95, y: .4 } : rightWrist, left_hip: { x: .43, y: .68 }, right_hip: { x: .57, y: .68 } };
    const timestampMs = Number.isFinite(requestedTimestampMs) ? requestedTimestampMs : Math.max(performance.now(), (state.pose?.timestampMs ?? -Infinity) + 1, Number(element.latestPoseTimestampMs ?? -Infinity) + 1);
    required(timestampMs > (state.pose?.timestampMs ?? -Infinity) && timestampMs > Number(element.latestPoseTimestampMs ?? -Infinity), 'measured pose clock must advance strictly');
    state.pose = { sourceId: SOURCE_ID, timestampMs, mirrored: true, landmarks: Object.entries(points).map(([name, position]) => ({ name, ...position, confidence })) };
    if (render) {
      element.runDisplayFrame();
      required(element.latestPoseTimestampMs === timestampMs && !element.lastError, `fresh measured frame was not consumed cleanly: ${JSON.stringify({ expectedTimestampMs: timestampMs, consumedTimestampMs: element.latestPoseTimestampMs, cvTimestampMs: graph.cv.getLatestPoseFrame()?.timestampMs, wallNowMs: performance.now(), calibration: graph.input.getSnapshot().calibration.state, evidenceTimestampMs: graph.input.getSnapshot().latestEvidence?.measurementTimestampMs, lastError: element.lastError ? { message: element.lastError.message, stack: element.lastError.stack } : null })}`);
    } else {
      // Same measured input seam as runDisplayFrame, before GLB projection; the
      // next real display consumes this CV frame and advances gameplay itself.
      required(!element.menuOpen && state.cvRunning && element.lastCameraIdentity, 'measured calibration requires active camera identity and closed menu');
      graph.input.processPoseSample(state.pose, { sourceAspectRatio: 4 / 3, sourceChangeId: element.lastCameraIdentity });
      required(graph.input.getSnapshot().tracking.timestampMs === timestampMs, 'measured calibration sample was not accepted by native input');
    }
    return { input: graph.input.getSnapshot(), session: graph.gameplay.getSnapshot().session };
  };
  const selectChart = async () => {
    active();
    await element.refreshLibrary();
    if (element.pendingLibrarySelection) await element.pendingLibrarySelection;
    await element.lifecycleIntentTail;
    required(element.libraryView.selectedPackageId === PACKAGE_ID && graph.content.getSnapshot().packageId === PACKAGE_ID && state.audioSource?.id === `${PACKAGE_ID}:audio`, 'downloaded scored package/audio was not selected through library');
    element.setMenuOpen(true);
    element.renderPresenters();
    const selector = element.shadowRoot.querySelector("aero-prototype-selector[scope='gameplay']");
    const radio = selector?.shadowRoot?.querySelector(`input[data-intent='gameplay-mode-select'][value='${variant.rulesetId}']`);
    if (radio instanceof HTMLInputElement && !radio.disabled) { radio.click(); await element.lifecycleIntentTail; }
    else required(mode === 'flow' && graph.content.getSnapshot().selectedVariant?.rulesetId === variant.rulesetId, 'scored gameplay mode native radio missing');
    required(graph.content.getSnapshot().selectedVariant?.variantId === variantId, 'scored variant selection did not commit');
    return graph.content.getSnapshot();
  };
  const setSetup = async changes => {
    active(); required(changes && typeof changes === 'object', 'setup changes object required');
    element.setMenuOpen(true);
    element.renderPresenters();
    const { aeroGameSetupStorageKey, defaultAeroGameSetupSnapshot } = await import('/src/game-setup-coordinator.js');
    const before = element.desiredGameSetup;
    const beforeStored = localStorage.getItem(aeroGameSetupStorageKey);
    const controlTrace = [];
    for (const [key, value] of Object.entries(changes)) {
      const volume = key === 'boxingColliderVolume' || key === 'flowColliderVolume';
      const fields = volume ? value : { [key]: value };
      required(fields && typeof fields === 'object', `invalid Game Setup field ${key}`);
      for (const [name, desired] of Object.entries(fields)) {
        const selector = volume ? `input[data-collider-volume-field='${name}']` : `[data-game-setup-field='${name}']`;
        const input = element.shadowRoot.querySelector(selector);
        required(input instanceof HTMLInputElement || input instanceof HTMLSelectElement, `native Game Setup control ${key}.${name} missing`);
        const previous = input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input.value;
        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
          required(typeof desired === 'boolean', `checkbox ${name} requires boolean`);
          if (input.checked !== desired) input.click();
        } else { input.focus(); input.value = String(desired); input.dispatchEvent(new Event('change', { bubbles: true })); input.blur(); }
        await element.lifecycleIntentTail;
        controlTrace.push({ field: `${key}.${name}`, previous, requested: desired, event: input instanceof HTMLInputElement && input.type === 'checkbox' && previous === desired ? 'no-op' : 'native-change' });
      }
    }
    const afterStored = localStorage.getItem(aeroGameSetupStorageKey);
    const desired = element.desiredGameSetup;
    const unchanged = JSON.stringify(desired) === JSON.stringify(before);
    // A pristine first-run default is intentionally not written by the
    // coordinator's no-op path. Native change events carrying the *same* value
    // also return early; they do not imply a persisted mutation. An absent
    // record is permitted ONLY for exact fresh defaults with no state change.
    if (afterStored === null) required(beforeStored === null && unchanged && JSON.stringify(before) === JSON.stringify(defaultAeroGameSetupSnapshot) && controlTrace.every(row => row.event === 'no-op' || String(row.previous) === String(row.requested)), `changed Game Setup was not persisted: ${JSON.stringify({ savedNull: true, freshDefault: JSON.stringify(before) === JSON.stringify(defaultAeroGameSetupSnapshot), unchanged, controlTrace })}`);
    else {
      const parsed = JSON.parse(afterStored);
      required(JSON.stringify(parsed) === JSON.stringify(desired), `persisted Game Setup differs from coordinator: ${JSON.stringify(Object.keys(desired).filter(key => JSON.stringify(parsed?.[key]) !== JSON.stringify(desired[key])).map(key => ({ key, persisted: parsed?.[key], current: desired[key] })))}`);
    }
    for (const [key, value] of Object.entries(changes)) {
      const expected = key === 'boxingColliderVolume' || key === 'flowColliderVolume' ? value : { [key]: value };
      for (const [field, actual] of Object.entries(expected)) required(Object.is((key === 'boxingColliderVolume' || key === 'flowColliderVolume' ? desired[key] : desired)[field], actual), `persisted ${key}.${field} differs from native input`);
    }
    return desired;
  };
  let playStarts = 0;
  const startPlay = async () => {
    active(); required(graph.content.getSnapshot().selectedVariant?.variantId === variantId, 'select the downloaded scored chart first');
    const previousRequests = state.cameraRequests, previousCvStarts = state.cvStarts, retainedBefore = graph.video.getRetainedCameraStream();
    await element.startSession('play', { requireDownloaded: true });
    element.stopFrameLoop();
    element.setMenuOpen(false, { freshSession: true });
    required(!element.menuOpen, 'fresh scored Play must close the setup menu');
    const snapshot = graph.gameplay.getSnapshot(), retainedAfter = graph.video.getRetainedCameraStream();
    const cameraAcquired = state.cameraRequests - previousRequests;
    required(snapshot.session.purpose === 'play' && element.sessionStartRequested && state.cvStarts === previousCvStarts + 1 && state.cvRunning && retainedAfter?.getVideoTracks()[0]?.readyState === 'live' && (retainedBefore ? cameraAcquired === 0 && retainedAfter === retainedBefore : cameraAcquired === 1) && (playStarts > 0 || previousRequests === 0 && previousCvStarts === 0 && cameraAcquired === 1), `scored Play camera/CV lifecycle not active: ${JSON.stringify({ playStarts, previousRequests, cameraRequests: state.cameraRequests, previousCvStarts, cvStarts: state.cvStarts, retainedBefore: Boolean(retainedBefore), retainedSame: retainedAfter === retainedBefore, track: retainedAfter?.getVideoTracks()[0]?.readyState ?? null })}`);
    playStarts++;
    required(JSON.stringify(element.leaseSnapshotForGameplay().resources) === JSON.stringify(['camera', 'audio']), 'scored Play must own camera+audio lease');
    required(element.activeSessionSetup && !element.lastError, 'run-locked Game Setup missing');
    return snapshot;
  };
  const calibrate = async () => {
    active(); required(element.sessionStartRequested && !element.menuOpen && state.cvRunning, 'Start scored Play with active CV and closed setup menu before calibration');
    const deadline = performance.now() + 14000;
    // One real display establishes the camera identity exactly as production
    // does before the faster measured input-only calibration samples begin.
    feedPose({ tPose: true });
    const failure = phase => {
      const input = graph.input.getSnapshot(), gameplay = graph.gameplay.getSnapshot();
      throw new Error(`Scored Play fixture: ${phase}: ${JSON.stringify({ session: gameplay.session.state, purpose: gameplay.session.purpose, countdown: gameplay.countdown?.value ?? null, calibration: input.calibration.state, readiness: input.calibration.readiness, holdProgressMs: input.calibration.holdProgressMs, calibrationId: input.calibration.calibrationId, trackingPaused: input.tracking.gameplayPaused, evidence: input.latestEvidence?.provenance ?? null, cv: graph.cv.getStatus().lifecycleState, audio: graph.audio.getStatus().state, menuOpen: element.menuOpen, lastError: element.lastError?.message ?? null })}`);
    };
    // The product-shell matrix holds a *measured* T-pose through the 2s input
    // gate, then releases it and lets the real 3/2/1 wall-clock countdown dwell.
    // Render/input cadence varies greatly with software WebGL: CV samples use a
    // monotonic ~15fps measurement clock bounded by real wall time so a slow
    // render never invents a >=750ms no-frame tracking-loss window.
    let measurementMs = Math.max(performance.now(), Number(element.latestPoseTimestampMs ?? 0) + 1);
    const sampled = (tPose, render = true) => {
      const before = state.pose;
      // Explicit 15fps measurement cadence: real performance.now() is still
      // used by the display/coordinator for countdown, but a slow GLB render
      // must not masquerade as lost camera frames in the measured input seam.
      measurementMs = Math.max(performance.now(), measurementMs + 1000 / 15, Number(element.latestPoseTimestampMs ?? 0) + 1);
      feedPose({ tPose, timestampMs: measurementMs, render });
      required(state.pose !== before && graph.input.getSnapshot().tracking.allRequiredAnchorsVisible, 'calibration measured upper-body sample unavailable');
    };
    // Rendering is not required for the input service's real 2000ms measured
    // hold. It remains required for session readiness, countdown and scoring.
    while (performance.now() < deadline && !graph.input.getSnapshot().calibration.calibrationId) { sampled(true, false); await wait(35); }
    if (!graph.input.getSnapshot().calibration.calibrationId) failure('T-pose calibration did not commit');
    sampled(false);
    while (performance.now() < deadline && graph.gameplay.getSnapshot().session.state !== 'playing') { sampled(false); await wait(35); }
    if (graph.gameplay.getSnapshot().session.state !== 'playing') failure('release/countdown did not enter scored Play');
    await element.audioSyncTail;
    sampled(false);
    const input = graph.input.getSnapshot(), session = graph.gameplay.getSnapshot().session;
    if (!(input.calibration.state === 'calibrated' && input.latestEvidence?.provenance === 'measured' && session.purpose === 'play' && session.state === 'playing' && state.audioState === 'playing')) failure('measured Play and audio not ready');
    return { input, session };
  };
  const seekSong = async (songMs, pose = {}) => {
    active(); required(Number.isFinite(songMs) && songMs >= 0 && songMs < state.durationMs, 'song time outside loaded audio');
    required(graph.gameplay.getSnapshot().session.state === 'playing' && state.audioState === 'playing', 'seek only in active Play');
    const before = graph.gameplay.getSnapshot().session.timelinePositionMs;
    required(songMs > state.audioPositionMs && songMs >= before, 'scored Play clock must advance strictly without rewinding gameplay');
    // Move only the loaded audio device clock, never the gameplay coordinator.
    // The optional pose is consumed by that SAME time-advancing display frame;
    // omitting it preserves the original Boxing fixture's default wrists.
    state.audioPositionMs = songMs;
    const result = feedPose(pose);
    const after = result.session.timelinePositionMs;
    required(after >= before && after <= songMs && graph.audio.getClockSnapshot().positionSeconds * 1000 === songMs && result.input.latestEvidence?.provenance === 'measured' && result.input.latestEvidence.measurementTimestampMs === state.pose.timestampMs, 'scored Play did not consume a fresh measured frame on the requested audio clock');
    return result;
  };
  const capture = () => {
    active(); required(graph.renderer.describe().gameplayAssets?.state === 'ready', 'pinned GLB assets not ready');
    const canvas = element.shadowRoot.querySelector("canvas[data-role='renderer']");
    required(canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0, 'active Play framebuffer missing');
    const before = graph.gameplay.getSnapshot(), renderer = graph.renderer;
    const previousFrameCount = renderer.describe().frameCount;
    required(typeof renderer.manualTick === 'function', 'production PlayCanvas manualTick unavailable');
    // Repaint the already-staged production scene immediately before copying
    // its browser canvas; preserveDrawingBuffer=false invalidates late GL reads.
    // This calls no gameplay/input/clock/configuration code.
    renderer.manualTick();
    const offscreen = new OffscreenCanvas(canvas.width, canvas.height), context = offscreen.getContext('2d', { willReadFrequently: true });
    required(context, 'framebuffer readback unavailable');
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const gameplay = graph.gameplay.getSnapshot(), scene = renderer.describe();
    required(scene.frameCount === previousFrameCount && gameplay === before, 'framebuffer repaint mutated gameplay or production render frame');
    required(scene.state === 'running' && !scene.errorMessage, `production renderer failed before Play pixel capture: ${JSON.stringify({ state: scene.state, errorMessage: scene.errorMessage })}`);
    required(gameplay.session.purpose === 'play' && !element.lastError && scene.frameCount > 0, 'scored Play framebuffer not advancing cleanly');
    required(Array.isArray(gameplay.scorePartitions) && Array.isArray(gameplay.judgements), 'private gameplay score/judgement snapshot unavailable');
    let opaque = 0, nonblack = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 255) opaque++;
      if (pixels[index] || pixels[index + 1] || pixels[index + 2]) nonblack++;
    }
    required(opaque === canvas.width * canvas.height && nonblack > 0, `scored Play framebuffer is blank/transparent: ${JSON.stringify({ opaque, nonblack, width: canvas.width, height: canvas.height, frameCount: scene.frameCount })}`);
    return { width: canvas.width, height: canvas.height, pixels, frame: element.rendererFrame(), score: gameplay.scorePartitions, judgements: gameplay.judgements, session: gameplay.session, renderer: scene };
  };
  const assertGlovePixels = () => {
    active();
    const renderer = graph.renderer, frame = element.rendererFrame(), equipment = element.currentEquipmentPoses;
    required(graph.gameplay.getSnapshot().session.state === 'playing' && frame.presentation === 'boxing_collider' && Array.isArray(equipment) && equipment.length === 2, 'known glove pixel control needs measured bilateral scored Boxing Play');
    const beforeEnvironment = renderer.describe().environment?.visible;
    required(typeof beforeEnvironment === 'boolean', 'renderer environment visibility unavailable');
    const beforeBackground = renderer.background;
    const cursorOptions = { grid: { x: 0, y: 0, width: 1, height: 1 } }, equipmentOptions = { grid: { columns: 4, rows: 3 } };
    const draw = poses => { renderer.renderGameplayFrameWithCursorsAndEquipment(frame, [], cursorOptions, poses, equipmentOptions); return capture(); };
    try {
      renderer.setEnvironmentVisible(false);
      renderer.setBackgroundProjection({ kind: 'solid', colors: ['#071426'], angleDeg: 180 });
      const withGloves = draw(equipment);
      required(renderer.describe().equipment?.instanceCount === 2 && renderer.describe().equipment?.assetMode === 'glb', 'known glove control did not render two pinned GLBs');
      const withoutGloves = draw([]);
      let changed = 0, strongest = 0, colored = 0;
      for (let index = 0; index < withGloves.pixels.length; index += 4) {
        const delta = Math.abs(withGloves.pixels[index] - withoutGloves.pixels[index]) + Math.abs(withGloves.pixels[index + 1] - withoutGloves.pixels[index + 1]) + Math.abs(withGloves.pixels[index + 2] - withoutGloves.pixels[index + 2]);
        if (delta >= 24) changed++;
        if (delta > strongest) strongest = delta;
        if (withGloves.pixels[index + 2] > withGloves.pixels[index + 1] + 30 || withGloves.pixels[index + 1] > withGloves.pixels[index + 2] + 30) colored++;
      }
      required(changed >= 100 && strongest >= 48 && colored >= 100, `known pinned glove GLBs are not visible in framebuffer: ${JSON.stringify({ changed, strongest, colored, frameCount: renderer.describe().frameCount })}`);
      return { changed, strongest, colored, width: withGloves.width, height: withGloves.height };
    } finally {
      renderer.setBackgroundProjection(beforeBackground);
      renderer.setEnvironmentVisible(beforeEnvironment);
      renderer.renderGameplayFrameWithCursorsAndEquipment(frame, [], cursorOptions, equipment, equipmentOptions);
    }
  };
  return Object.freeze({ element, graph, selectChart, setSetup, startPlay, calibrate, feedPose, seekSong, capture, assertGlovePixels, async waitForAssets() { active(); const deadline = performance.now() + 15000; while (performance.now() < deadline) { if (graph.renderer.describe().gameplayAssets?.state === 'ready' && graph.renderer.describe().environment?.state === 'ready') return graph.renderer.describe(); await wait(25); } throw new Error('Scored Play fixture: pinned GLB/environment assets unavailable'); }, dispose() { active(); element.remove(); } });
}
