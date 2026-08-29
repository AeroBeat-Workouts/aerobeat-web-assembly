// @ts-check

import "@aerobeat/web-style/aero-theme.css";
import {
  elementNames,
  isGameCommand,
  isSafeIframePayload
} from "@aerobeat/web-contracts";
import { createAeroCvFrameSourceFromVideoSurface } from "@aerobeat/web-cv";
import { aeroUiIntentEventName, defineAeroUiElements } from "@aerobeat/web-ui";
import { createLiveCameraSourceDescriptor } from "@aerobeat/web-video";
import { appMetadata } from "./release-metadata.js";
import { createAeroGameIframeBridge } from "./iframe-bridge.js";
import { aeroGameMediaLeaseCoordinator, AeroGameMediaLeaseCoordinator } from "./media-lease-coordinator.js";
import { createAeroGameServiceGraph, lockedProductionCvProfile } from "./service-graph.js";

export { createAeroGameIframeBridge } from "./iframe-bridge.js";
export { aeroGameMediaLeaseCoordinator, AeroGameMediaLeaseCoordinator } from "./media-lease-coordinator.js";
export { createAeroGameServiceGraph, lockedProductionCvProfile } from "./service-graph.js";

const GAME_EVENT_NAME = "aero-game-event";
let instanceSequence = 0;

defineAeroUiElements();

/** Full-container, reconnectable AeroBeat game root. */
export class AeroGame extends HTMLElement {
  constructor() {
    super();
    this.instanceId = this.getAttribute("instance-id") || `aero-game-${++instanceSequence}`;
    /** Injectable before connection for deterministic integration tests. */
    this.serviceGraphFactory = createAeroGameServiceGraph;
    this.graph = null;
    this.bridge = null;
    this.connectedGeneration = 0;
    this.lifecycle = "disconnected";
    this.eventSequence = 0;
    this.configuration = Object.freeze({});
    this.activeAbort = new AbortController();
    this.resizeObserver = null;
    this.unsubscribe = [];
    this.frameTimer = 0;
    this.latestPoseTimestampMs = -1;
    this.activeCvSource = null;
    this.lastSourceChangeId = -1;
    this.leaseParticipant = null;
    this.unregisterLease = null;
    this.fullscreenPending = false;
    this.fullscreenError = null;
    this.container = containerSnapshot(0, 0, 1, true, false);
    this.lastError = null;
    this.boundVisibility = () => { void this.applyVisibility(); };
    this.boundFullscreen = () => { this.fullscreenPending = false; this.fullscreenError = null; this.measureContainer(); this.publish("fullscreen_changed"); };
    this.boundUiIntent = (event) => this.handleUiIntent(event);
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = template();
  }

  connectedCallback() {
    if (this.lifecycle === "connected") return;
    this.instanceId = this.getAttribute("instance-id") || this.instanceId;
    this.connectedGeneration += 1;
    this.lifecycle = "connected";
    this.activeAbort = new AbortController();
    this.graph = this.serviceGraphFactory({ instanceId: this.instanceId });
    this.attachStableSurfaces();
    this.bindGraph();
    this.bindLease();
    this.bindHostLifecycle();
    this.createBridge();
    this.measureContainer();
    this.renderPresenters();
    this.publish("ready");
  }

  disconnectedCallback() { this.teardown("disconnected"); }

  /** Configure plain host-owned options without starting media. */
  configure(options = {}) {
    this.assertConnected();
    this.configuration = safeData(options, 0, 64);
    const theme = dataValue(this.configuration, "theme");
    if (theme !== undefined) this.setTheme(theme);
    this.publish("capabilities_changed");
    return this.getSnapshot();
  }

  /** Direct-embed-only stream injection; stream never enters snapshots or iframe messages. */
  injectCameraStream(stream, options = {}) {
    this.assertConnected();
    if (!(stream instanceof MediaStream)) throw new TypeError("injectCameraStream requires a MediaStream");
    const source = createLiveCameraSourceDescriptor({ sourceId: boundedString(dataValue(options, "sourceId"), "host-camera"), mirrored: dataValue(options, "mirrored") !== false });
    this.graph.video.injectCameraStream(stream, { source, ownership: "host-owned" });
    this.attachRetainedCamera();
    return this.getSnapshot();
  }

  async start() {
    this.assertConnected();
    const generation = this.connectedGeneration;
    await aeroGameMediaLeaseCoordinator.request(this.leaseParticipant);
    if (!this.isCurrent(generation)) return this.getSnapshot();
    if (!this.graph.video.getRetainedCameraStream()) {
      const result = await this.graph.video.requestCamera(createLiveCameraSourceDescriptor({ sourceId: "aero.mediapipe.live", mirrored: true }), { signal: this.activeAbort.signal });
      if (!this.isCurrent(generation)) return this.getSnapshot();
      if (result.status !== "granted") throw new Error(result.message);
    }
    this.attachRetainedCamera();
    await this.startCv();
    try { this.graph.gameplay.requestStart(performance.now()); } catch { /* content/calibration may still be pending */ }
    try { await this.graph.audio.play(); } catch { /* autoplay truth is exposed in status */ }
    this.startFrameLoop();
    this.publish("session_changed");
    return this.getSnapshot();
  }

  async pause(reason = "manual") {
    this.assertConnected();
    await Promise.allSettled([this.graph.audio.pause(), this.graph.cv.stop()]);
    this.graph.video.pause(this.videoElement());
    try { this.graph.gameplay.pause(performance.now(), boundedString(reason, "manual")); } catch { /* not configured */ }
    this.stopFrameLoop();
    this.publish("session_changed");
    return this.getSnapshot();
  }

  async resume() {
    this.assertConnected();
    await aeroGameMediaLeaseCoordinator.request(this.leaseParticipant);
    if (document.hidden) return this.getSnapshot();
    await this.startCv();
    try { this.graph.gameplay.resume(performance.now()); } catch { /* not configured */ }
    try { await this.graph.audio.play(); } catch { /* autoplay remains explicit */ }
    this.startFrameLoop();
    this.publish("session_changed");
    return this.getSnapshot();
  }

  async stop() {
    this.assertConnected();
    this.stopFrameLoop();
    await Promise.allSettled([this.graph.audio.stop(), this.graph.cv.stop()]);
    this.graph.video.pause(this.videoElement());
    try { this.graph.gameplay.stop(performance.now()); } catch { /* not configured */ }
    await aeroGameMediaLeaseCoordinator.release(this.leaseParticipant);
    this.publish("session_changed");
    return this.getSnapshot();
  }

  reset() {
    this.assertConnected();
    this.graph.input.resetCalibration("explicit_reset");
    try { this.graph.gameplay.reset(performance.now()); } catch { /* not configured */ }
    this.publish("calibration_changed");
    return this.getSnapshot();
  }

  /** @param {unknown} source */
  async selectContent(source) {
    this.assertConnected();
    const normalized = safeData(source, 0, 64);
    const kind = dataValue(normalized, "kind");
    if (kind === "persistence") await this.graph.content.loadPersistenceHandle(dataValue(normalized, "handle"), this.contentLoadOptions());
    else if (kind === "external") await this.graph.content.loadExternalPackage(boundedString(dataValue(normalized, "url"), ""), this.contentLoadOptions());
    else if (kind === "direct") await this.graph.content.loadPackage(dataValue(normalized, "package"), this.contentLoadOptions());
    else throw new TypeError("Unsupported content source kind");
    await this.loadSelectedAudio();
    this.configureGameplayFromContent();
    this.publish("content_changed");
    return this.getSnapshot();
  }

  async selectVariant(variantId, modifierIds = []) {
    this.assertConnected();
    await this.graph.content.selectVariant(boundedString(variantId, ""), { modifierIds: stringList(modifierIds, 16) });
    this.configureGameplayFromContent();
    this.publish("content_changed");
    return this.getSnapshot();
  }

  async browseBeatSaver(query = {}) {
    this.assertConnected();
    const results = await this.graph.vendor.searchMaps(safeData(query, 0, 32), { signal: this.activeAbort.signal });
    this.emitGameEvent("beatsaver_results", { resultCount: results.maps.length, maps: results.maps.slice(0, 50).map((map) => ({ mapId: map.mapId, name: map.name, versionCount: map.versions.length })) });
    return results;
  }

  async importBeatSaver(map, versionIdentifier, authoringOptions) {
    this.assertConnected();
    const acquired = await this.graph.vendor.acquireVersion(safeData(map, 0, 64), typeof versionIdentifier === "string" ? versionIdentifier : undefined, { signal: this.activeAbort.signal, onProgress: (progress) => this.emitGameEvent("import_changed", { phase: progress.phase, loadedBytes: progress.loadedBytes, totalBytes: progress.totalBytes ?? null }) });
    return this.convertAcquired(acquired, authoringOptions);
  }

  async importLocalZip(input, authoringOptions) {
    this.assertConnected();
    if (!(input instanceof Blob || input instanceof ArrayBuffer || input instanceof Uint8Array)) throw new TypeError("Local import requires Blob, ArrayBuffer, or Uint8Array");
    const acquired = await this.graph.vendor.importLocalArchive(input, { signal: this.activeAbort.signal });
    return this.convertAcquired(acquired, authoringOptions);
  }

  cancelImport() { this.assertConnected(); return this.graph.authoring.cancel(); }
  async deletePackage(handle) { this.assertConnected(); const deleted = await this.graph.authoring.deletePackage(safeData(handle, 0, 16)); this.publish("content_changed"); return deleted; }

  setTheme(theme) {
    this.assertConnected();
    const normalized = safeData(theme, 0, 32);
    this.configuration = Object.freeze({ ...this.configuration, hostTheme: normalized });
    this.graph.renderer.setTheme(normalized);
    this.renderPresenters();
    this.publish("capabilities_changed");
    return this.getSnapshot();
  }

  async enterFullscreen() {
    this.assertConnected();
    if (!this.requestFullscreen) throw new Error("Fullscreen is unavailable");
    this.fullscreenPending = true; this.fullscreenError = null; this.renderPresenters();
    try { await this.requestFullscreen(); }
    catch (error) { this.fullscreenPending = false; this.fullscreenError = errorCode(error, "fullscreen_request_failed"); this.publish("fullscreen_changed"); throw error; }
    return this.getSnapshot();
  }

  async exitFullscreen() {
    this.assertConnected();
    if (document.fullscreenElement !== this || !document.exitFullscreen) return this.getSnapshot();
    this.fullscreenPending = true; this.renderPresenters();
    try { await document.exitFullscreen(); }
    catch (error) { this.fullscreenPending = false; this.fullscreenError = errorCode(error, "fullscreen_exit_failed"); throw error; }
    return this.getSnapshot();
  }

  /** Execute one validated public host command. */
  executeCommand(command) {
    this.assertConnected();
    if (!isGameCommand(command) || !isSafeIframePayload(command.payload)) throw new TypeError("Invalid game command");
    const payload = command.payload ?? {};
    switch (command.type) {
      case "configure": return this.configure(payload);
      case "start": return this.start();
      case "pause": return this.pause("host_command");
      case "resume": return this.resume();
      case "stop": return this.stop();
      case "reset_calibration": return this.reset();
      case "request_fullscreen": throw new Error("Fullscreen commands require a child user gesture");
      case "select_content": return this.selectContent(payload);
      case "select_variant": return this.selectVariant(boundedString(dataValue(payload, "variantId"), ""), dataValue(payload, "modifierIds") ?? []);
      case "browse_beatsaver": return this.browseBeatSaver(payload);
      case "cancel_import": return this.cancelImport();
      case "delete_package": return this.deletePackage(dataValue(payload, "handle"));
      case "set_theme": return this.setTheme(dataValue(payload, "theme"));
      case "destroy": return this.destroy();
      case "import_beatsaver": throw new Error("Iframe import requires child-side selected map state");
      case "import_local_zip": throw new Error("Raw local archives cannot cross iframe commands");
      default: throw new Error("Unsupported command");
    }
  }

  getSnapshot() {
    const graph = this.graph;
    return safeData({
      schema: "aerobeat/game_snapshot", version: 1, instanceId: this.instanceId,
      app: { version: appMetadata.packageVersion, buildStamp: appMetadata.buildStamp, cacheBust: appMetadata.cacheBust },
      lifecycle: this.lifecycle, generation: this.connectedGeneration, container: this.container,
      capabilities: this.capabilities(), fullscreen: this.fullscreenSnapshot(),
      iframe: this.bridge?.getSnapshot() ?? { schema: "aerobeat/iframe_bridge_snapshot", version: 1, framed: false, connected: false, parentOrigin: null },
      lease: aeroGameMediaLeaseCoordinator.snapshot(), cvProfile: lockedProductionCvProfile,
      services: graph ? {
        vendor: graph.vendor.snapshot(), authoring: graph.authoring.getSnapshot(), content: contentTelemetry(graph.content.getSnapshot()),
        video: graph.video.describeStatus(), cv: graph.cv.getStatus(), input: graph.input.getSnapshot(), audio: graph.audio.getStatus(),
        gameplay: graph.gameplay.getSnapshot(), renderer: graph.renderer.describe()
      } : null,
      error: this.lastError
    }, 0, 128);
  }

  /** Terminal until a disconnect/reconnect creates a fresh graph. */
  destroy() { this.teardown("destroyed"); return this.getSnapshot(); }

  attachStableSurfaces() {
    this.graph.renderer.attach(this.canvasElement());
    const video = this.videoElement();
    video.muted = true; video.playsInline = true;
  }

  bindGraph() {
    for (const [service, type] of [[this.graph.input, "calibration_changed"], [this.graph.content, "content_changed"], [this.graph.authoring, "import_changed"]]) {
      if (typeof service.subscribe === "function") this.unsubscribe.push(service.subscribe(() => { this.renderPresenters(); this.emitGameEvent(type, { snapshot: this.snapshotForType(type) }); }));
    }
  }

  bindLease() {
    const participant = {
      instanceId: this.instanceId,
      pauseForLease: async () => { if (!this.graph) return; this.stopFrameLoop(); await Promise.allSettled([this.graph.audio.pauseForLease(), this.graph.cv.stop()]); this.graph.video.pauseForLease(); try { this.graph.gameplay.pause(performance.now(), "media_lease_transferred"); } catch { /* not configured */ } },
      activateLease: async () => { if (!this.graph) return; this.graph.video.activateLease(); await this.graph.audio.activateLease(); },
      releaseLease: async () => { if (!this.graph) return; this.graph.video.releaseLease({ releaseStream: false }); await this.graph.audio.releaseLease(); }
    };
    this.leaseParticipant = participant;
    this.unregisterLease = aeroGameMediaLeaseCoordinator.register(participant);
  }

  bindHostLifecycle() {
    document.addEventListener("visibilitychange", this.boundVisibility);
    document.addEventListener("fullscreenchange", this.boundFullscreen);
    this.shadowRoot?.addEventListener(aeroUiIntentEventName, this.boundUiIntent);
    this.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.measureContainer()) : null;
    this.resizeObserver?.observe(this);
    globalThis.addEventListener("resize", this.boundFullscreen);
  }

  createBridge() {
    if (globalThis.parent === globalThis) return;
    const expectedOrigin = this.getAttribute("parent-origin") || referrerOrigin();
    if (!expectedOrigin) return;
    this.bridge = createAeroGameIframeBridge({ parentWindow: globalThis.parent, instanceId: this.instanceId, expectedOrigin, onCommand: (command) => { Promise.resolve(this.executeCommand(command)).catch((error) => this.handleError(error)); }, onError: (error) => this.handleError(error) });
  }

  async convertAcquired(acquired, options) {
    const raw = safeData(options, 0, 32);
    const result = await this.graph.authoring.convertAndPersist(acquired.source, {
      difficulty: boundedString(dataValue(raw, "difficulty"), "Expert"), sourceProvider: "beatsaver",
      sourceId: boundedString(dataValue(raw, "sourceId"), boundedString(acquired.map?.mapId, "local")),
      sourceVersionHash: acquired.sourceHash,
      modifiers: stringList(dataValue(raw, "modifiers") ?? [], 5), includeAudio: dataValue(raw, "includeAudio") !== false,
      signal: this.activeAbort.signal
    });
    this.emitGameEvent("import_changed", { snapshot: result.job });
    await this.selectContent({ kind: "persistence", handle: result.handle });
    return result;
  }

  contentLoadOptions() {
    return {
      defaultTheme: dataValue(this.configuration, "defaultTheme"), playlistTheme: dataValue(this.configuration, "playlistTheme"),
      athleteTheme: dataValue(this.configuration, "athleteTheme"), hostTheme: dataValue(this.configuration, "hostTheme") ?? dataValue(this.configuration, "theme"),
      defaultBackground: dataValue(this.configuration, "defaultBackground"), playlistBackground: dataValue(this.configuration, "playlistBackground"),
      athleteBackground: dataValue(this.configuration, "athleteBackground"), hostBackground: dataValue(this.configuration, "hostBackground")
    };
  }

  async loadSelectedAudio() {
    const content = this.graph.content.getSnapshot();
    const audio = content.song?.audio;
    if (!audio || typeof audio.filePath !== "string") return;
    const bytes = this.graph.content.readAsset(audio.filePath);
    const hash = typeof audio.contentHash === "string" ? audio.contentHash.replace(/^sha256:/u, "") : "";
    await this.graph.audio.load({ id: `${content.packageId}:audio`, kind: "array-buffer", label: content.song?.name ?? "AeroBeat song", arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), contentType: "application/octet-stream", ...(hash ? { expectedHash: { algorithm: "SHA-256", value: hash } } : {}) }, { signal: this.activeAbort.signal });
  }

  configureGameplayFromContent() {
    const content = this.graph.content.getSnapshot();
    if (content.state !== "ready" || !content.selectedVariant) return;
    this.graph.gameplay.configureContent({ packageId: content.packageId, selectedVariant: content.selectedVariant, resolvedEvents: content.resolvedEvents, profileIdentity: { schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: "assembly-default", profileVersion: "1", contentHash: "0000000000000000000000000000000000000000000000000000000000000000", class: "between_run_ruleset", regenerationRequired: false } });
  }

  attachRetainedCamera() {
    const surface = this.graph.video.attachCameraStream(this.videoElement());
    if (surface.sourceChangeId !== this.lastSourceChangeId) {
      this.lastSourceChangeId = surface.sourceChangeId;
      this.graph.input.resetCalibration("media_source_changed");
    }
    this.activeCvSource = createAeroCvFrameSourceFromVideoSurface(this.videoElement(), surface);
  }

  async startCv() { if (this.activeCvSource && !document.hidden) await this.graph.cv.start(this.activeCvSource); }

  startFrameLoop() {
    this.stopFrameLoop();
    const generation = this.connectedGeneration;
    this.frameTimer = globalThis.setInterval(() => {
      if (!this.isCurrent(generation) || document.hidden) return;
      try {
        const frame = this.graph.cv.getLatestPoseFrame();
        if (frame && frame.timestampMs !== this.latestPoseTimestampMs) {
          this.latestPoseTimestampMs = frame.timestampMs;
          this.graph.input.processPoseSample(frame, { sourceAspectRatio: this.graph.video.describeSurface(this.videoElement()).sourceAspectRatio, sourceChangeId: String(this.graph.video.describeStatus().sourceChangeId) });
        } else this.graph.input.advanceTime(performance.now());
        try { this.graph.gameplay.advance({ timestampMs: performance.now(), clock: this.graph.audio.getClockSnapshot(), input: this.graph.input.getSnapshot(), lease: this.leaseSnapshotForGameplay() }); } catch { /* unconfigured session */ }
        this.graph.renderer.renderGameplayFrame(this.rendererFrame());
        this.renderPresenters();
      } catch (error) { this.handleError(error); }
    }, 67);
  }

  stopFrameLoop() { if (this.frameTimer) globalThis.clearInterval(this.frameTimer); this.frameTimer = 0; }

  async applyVisibility() {
    if (!this.graph) return;
    const hidden = document.hidden;
    this.graph.video.setDocumentHidden(hidden);
    await this.graph.audio.setDocumentHidden(hidden);
    if (hidden) {
      this.stopFrameLoop(); await this.graph.cv.stop();
      try { this.graph.gameplay.pause(performance.now(), "document_hidden"); } catch { /* unconfigured */ }
    } else if (aeroGameMediaLeaseCoordinator.snapshot().ownerInstanceId === this.instanceId) {
      await this.startCv(); this.startFrameLoop();
    }
    this.measureContainer(); this.publish("session_changed");
  }

  measureContainer() {
    if (!this.isConnected) return;
    const rect = this.getBoundingClientRect();
    const dpr = Number.isFinite(globalThis.devicePixelRatio) && globalThis.devicePixelRatio > 0 ? globalThis.devicePixelRatio : 1;
    this.container = containerSnapshot(Math.max(0, rect.width), Math.max(0, rect.height), dpr, !document.hidden, document.fullscreenElement === this);
    this.graph?.renderer.resize({ widthCssPx: this.container.widthCssPx, heightCssPx: this.container.heightCssPx, devicePixelRatio: dpr });
    this.renderPresenters();
  }

  rendererFrame() {
    const content = this.graph.content.getSnapshot(); const gameplay = this.graph.gameplay.getSnapshot();
    const selected = content.selectedVariant; const nowMs = Number(gameplay.timelinePositionMs ?? 0);
    const ruleset = String(selected?.rulesetId ?? "");
    const presentation = selected?.mode === "flow" ? "flow" : ruleset.includes("semantic") ? "boxing_semantic_track" : "boxing_spatial_grid";
    const targets = (content.resolvedEvents ?? []).filter((event) => event.centerTimestampMs >= nowMs - 500 && event.centerTimestampMs <= nowMs + 2500).slice(0, 128).map(renderTarget);
    const state = String(gameplay.state ?? "idle");
    const overlay = state === "paused_tracking" ? "tracking_lost" : state === "calibrating" ? "calibrating" : state.startsWith("paused") ? "paused" : "none";
    return { presentation, nowMs, targets, countdown: gameplay.countdown?.value ?? null, overlay, calibrationDim: this.graph.input.getSnapshot().retainedGeometryDimmed ? 0.5 : 0 };
  }

  renderPresenters() {
    if (!this.graph) return;
    const content = this.graph.content.getSnapshot();
    const gameplay = this.graph.gameplay.getSnapshot();
    const input = this.graph.input.getSnapshot();
    setPresenter(this, "aero-calibration-badge", input.calibration);
    setPresenter(this, "aero-tracking-pause", { active: gameplay.state === "paused_tracking", reason: gameplay.pauseReason, calibration: input.calibration });
    setPresenter(this, "aero-resume-countdown", gameplay.countdown ?? {});
    setPresenter(this, "aero-prototype-selector", { variants: content.variants, selectedVariantId: content.selectedVariant?.variantId ?? null, disabled: gameplay.state === "playing" });
    setPresenter(this, "aero-content-import-progress", this.graph.authoring.getSnapshot());
    setPresenter(this, "aero-content-library", { packages: [], selectedPackageId: content.packageId });
    setPresenter(this, "aero-beatsaver-browser", { state: this.graph.vendor.snapshot().phase, maps: [] });
    setPresenter(this, "aero-background-environment", content.background ?? { kind: "css-fallback" });
    setPresenter(this, "aero-fullscreen-button", this.fullscreenSnapshot());
    setPresenter(this, "aero-capabilities-panel", { ...this.capabilities(), storage: null });
    setPresenter(this, "aero-error-panel", this.lastError ? { active: true, ...this.lastError } : { active: false });
    const status = this.shadowRoot?.querySelector("[data-role='status']");
    if (status) status.textContent = `${content.state} · ${gameplay.state} · ${Math.round(this.container.widthCssPx)}×${Math.round(this.container.heightCssPx)}`;
  }

  handleUiIntent(event) {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!detail || typeof detail.type !== "string") return;
    if (detail.type === "fullscreen-request") void this.enterFullscreen().catch((error) => this.handleError(error));
    else if (detail.type === "fullscreen-exit") void this.exitFullscreen().catch((error) => this.handleError(error));
    else if (detail.type === "beatsaver-search") void this.browseBeatSaver({ text: detail.payload?.query ?? "" }).catch((error) => this.handleError(error));
    else if (detail.type === "import-cancel") this.cancelImport();
    else if (detail.type === "prototype-select") void this.selectVariant(detail.payload?.profileId ?? "").catch((error) => this.handleError(error));
    else if (detail.type === "calibration-reset") this.reset();
  }

  publish(type) { this.renderPresenters(); this.emitGameEvent(type, { snapshot: this.snapshotForType(type) }); }

  emitGameEvent(type, payload) {
    const event = Object.freeze({ schema: "aerobeat/game_event", version: 1, eventId: `${this.instanceId}-${++this.eventSequence}`, type, timestampMs: Math.max(0, performance.now()), payload: safeData(payload, 0, 96) });
    this.dispatchEvent(new CustomEvent(GAME_EVENT_NAME, { bubbles: true, composed: true, detail: event }));
    this.bridge?.sendEvent(event);
    return event;
  }

  snapshotForType(type) {
    const snapshot = this.getSnapshot();
    if (type === "content_changed") return snapshot.services?.content ?? null;
    if (type === "import_changed") return snapshot.services?.authoring ?? null;
    if (type === "calibration_changed" || type === "tracking_changed") return snapshot.services?.input ?? null;
    if (type === "session_changed" || type === "score_changed") return snapshot.services?.gameplay ?? null;
    if (type === "fullscreen_changed") return snapshot.fullscreen;
    return snapshot;
  }

  handleError(error) {
    this.lastError = Object.freeze({ code: errorCode(error, "assembly_error"), message: errorMessage(error) });
    if (this.lifecycle === "connected") this.emitGameEvent("error", this.lastError);
    this.renderPresenters();
  }

  leaseSnapshotForGameplay() { return aeroGameMediaLeaseCoordinator.snapshot(); }

  capabilities() {
    const webgl2 = Boolean(this.graph?.renderer.getCapabilities().webgl2);
    const camera = Boolean(navigator.mediaDevices?.getUserMedia);
    const fullscreen = typeof this.requestFullscreen === "function";
    const limitations = [];
    if (!camera) limitations.push("camera_unavailable"); if (!fullscreen) limitations.push("fullscreen_unavailable"); if (!webgl2) limitations.push("webgl2_unavailable");
    return Object.freeze({ schema: "aerobeat/game_capabilities", version: 1, secureContext: globalThis.isSecureContext, camera, fullscreen, autoplay: true, webgl2, indexedDb: typeof indexedDB !== "undefined", worker: typeof Worker !== "undefined", directBeatSaverCors: true, localZipImport: typeof Blob !== "undefined", limitations: Object.freeze(limitations) });
  }

  fullscreenSnapshot() { return Object.freeze({ schema: "aerobeat/fullscreen_snapshot", version: 1, supported: typeof this.requestFullscreen === "function", active: document.fullscreenElement === this, requestPending: this.fullscreenPending, errorCode: this.fullscreenError }); }

  teardown(finalState) {
    if (this.lifecycle !== "connected") { this.lifecycle = finalState; return; }
    this.connectedGeneration += 1; this.lifecycle = finalState; this.activeAbort.abort(); this.stopFrameLoop();
    this.resizeObserver?.disconnect(); this.resizeObserver = null;
    document.removeEventListener("visibilitychange", this.boundVisibility); document.removeEventListener("fullscreenchange", this.boundFullscreen); globalThis.removeEventListener("resize", this.boundFullscreen);
    this.shadowRoot?.removeEventListener(aeroUiIntentEventName, this.boundUiIntent);
    for (const stop of this.unsubscribe.splice(0)) { try { stop(); } catch { /* isolated */ } }
    this.bridge?.destroy(); this.bridge = null;
    this.unregisterLease?.(); this.unregisterLease = null;
    const graph = this.graph; this.graph = null;
    if (graph) {
      try { graph.content.destroy(); } catch { /* idempotent */ } try { graph.authoring.destroy(); } catch { /* idempotent */ }
      try { graph.input.destroy(); } catch { /* idempotent */ } try { graph.gameplay.destroy(); } catch { /* idempotent */ }
      try { graph.renderer.destroy(); } catch { /* idempotent */ } try { graph.video.destroy(); } catch { /* idempotent */ }
      void graph.cv.dispose().catch(() => {}); void graph.audio.destroy().catch(() => {});
    }
    this.activeCvSource = null; this.leaseParticipant = null;
    if (finalState === "destroyed") this.emitGameEvent("destroyed", { instanceId: this.instanceId });
  }

  assertConnected() { if (this.lifecycle !== "connected" || !this.graph) throw new Error("aero-game is not connected"); }
  isCurrent(generation) { return this.lifecycle === "connected" && this.graph && this.connectedGeneration === generation; }
  canvasElement() { const value = this.shadowRoot?.querySelector("canvas[data-role='renderer']"); if (!(value instanceof HTMLCanvasElement)) throw new Error("Renderer surface missing"); return value; }
  videoElement() { const value = this.shadowRoot?.querySelector("video[data-role='media']"); if (!(value instanceof HTMLVideoElement)) throw new Error("Media surface missing"); return value; }
}

/** Define the public root without an aerobeat-app alias. */
export function defineAeroGame() { if (!customElements.get(elementNames.game)) customElements.define(elementNames.game, AeroGame); }
defineAeroGame();

function template() { return `<style>
:host{box-sizing:border-box;display:block;inline-size:100%;block-size:100%;min-inline-size:0;min-block-size:0;overflow:hidden;contain:layout paint style;color:var(--aero-color-ink,#eaf9ff);background:#06141f;font-family:var(--aero-font-family,system-ui,sans-serif)}
*,*::before,*::after{box-sizing:border-box}.game{position:relative;inline-size:100%;block-size:100%;overflow:hidden}.environment,.media,.renderer{position:absolute;inset:0;inline-size:100%;block-size:100%}.media{object-fit:cover;transform:scaleX(-1);opacity:.42}.renderer{z-index:2}.ui{position:absolute;z-index:3;inset:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,28%);grid-template-rows:auto 1fr auto;gap:8px;padding:8px;pointer-events:none}.ui>*{pointer-events:auto}.browser{grid-column:2;grid-row:1/3;overflow:auto}.hud{grid-column:1;grid-row:1;display:flex;gap:8px;flex-wrap:wrap}.footer{grid-column:1/-1;grid-row:3;display:flex;gap:8px;align-items:end;justify-content:space-between}.status{background:rgba(0,0,0,.68);border-radius:999px;padding:6px 10px;font:700 12px system-ui}.visually-optional{max-block-size:34vh;overflow:auto}@media(max-width:700px){.ui{grid-template-columns:1fr}.browser{grid-column:1;grid-row:2;max-block-size:30vh}.footer{grid-column:1}}
</style><div class="game"><aero-background-environment class="environment"></aero-background-environment><video data-role="media" class="media"></video><canvas data-role="renderer" class="renderer"></canvas><div class="ui"><div class="hud"><aero-calibration-badge></aero-calibration-badge><aero-tracking-pause></aero-tracking-pause><aero-resume-countdown></aero-resume-countdown><aero-prototype-selector></aero-prototype-selector></div><section class="browser visually-optional"><aero-beatsaver-browser></aero-beatsaver-browser><aero-content-import-progress></aero-content-import-progress><aero-content-library></aero-content-library><aero-capabilities-panel></aero-capabilities-panel><aero-error-panel></aero-error-panel></section><div class="footer"><span data-role="status" class="status" aria-live="polite">Connecting…</span><aero-fullscreen-button></aero-fullscreen-button></div></div></div>`; }

/** @param {AeroGame} host @param {string} selector @param {unknown} snapshot */
function setPresenter(host, selector, snapshot) { const element = host.shadowRoot?.querySelector(selector); if (element && typeof element.setSnapshot === "function") element.setSnapshot(snapshot && typeof snapshot === "object" ? snapshot : {}); }
function containerSnapshot(widthCssPx, heightCssPx, devicePixelRatio, visible, fullscreen) { return Object.freeze({ schema: "aerobeat/container_snapshot", version: 1, widthCssPx, heightCssPx, devicePixelRatio, visible, fullscreen }); }
function referrerOrigin() { try { return document.referrer ? new URL(document.referrer).origin : ""; } catch { return ""; } }
function dataValue(record, key) { if (!record || typeof record !== "object") return undefined; const descriptor = Object.getOwnPropertyDescriptor(record, key); return descriptor && "value" in descriptor && descriptor.enumerable ? descriptor.value : undefined; }
function boundedString(value, fallback) { return typeof value === "string" && value.length > 0 && value.length <= 1024 ? value : fallback; }
function stringList(value, maximum) { if (!Array.isArray(value) || value.length > maximum) throw new TypeError("Expected bounded string array"); return Object.freeze(value.map((entry) => { if (typeof entry !== "string" || entry.length > 256) throw new TypeError("Invalid string entry"); return entry; })); }
function errorCode(error, fallback) { const code = dataValue(error, "code"); return typeof code === "string" && code.length <= 128 ? code : fallback; }
function errorMessage(error) { const message = dataValue(error, "message"); return typeof message === "string" && message.length <= 2048 ? message : "AeroBeat operation failed"; }
function contentTelemetry(snapshot) { return { ...snapshot, resolvedEvents: undefined, resolvedEventCount: Array.isArray(snapshot.resolvedEvents) ? snapshot.resolvedEvents.length : 0 }; }
function renderTarget(event) {
  const beat = event.authoredBeat ?? {}; const type = String(beat.type ?? "note");
  if (type === "note") return { id: event.eventId, kind: "flow", hand: beat.hand === "right" ? "right" : "left", family: "flow", cell: Number.isInteger(beat.placement) ? beat.placement : null, cells: [], lane: null, beatCenterMs: event.centerTimestampMs, direction: flowDirection(beat.direction) };
  if (type === "guard") { const crossed = beat.modifier === "crossed_guard"; return { id: event.eventId, kind: "guard", hand: "both", family: crossed ? "crossed_guard" : "guard", cell: null, cells: [beat.guardTarget?.leftCell, beat.guardTarget?.rightCell].filter(Number.isInteger), lane: null, beatCenterMs: event.centerTimestampMs }; }
  if (type === "squat" || type.startsWith("weave")) return { id: event.eventId, kind: "obstacle", hand: "neutral", family: type === "squat" ? "squat" : "weave", cell: null, cells: Array.isArray(beat.blockedCells) ? beat.blockedCells : [], lane: null, beatCenterMs: event.centerTimestampMs };
  const hand = type.endsWith("right") ? "right" : "left"; const family = type.startsWith("hook") ? "hook" : type.startsWith("uppercut") ? "uppercut" : "straight";
  return { id: event.eventId, kind: "punch", hand, family, cell: Number.isInteger(beat.spatialTarget?.targetCell) ? beat.spatialTarget.targetCell : null, cells: [], lane: hand, beatCenterMs: event.centerTimestampMs, direction: beat.spatialTarget?.entryDirection ?? null };
}
function flowDirection(value) { return value === 0 || value === "up" ? "up" : value === 1 || value === "right" ? "right" : value === 2 || value === "down" ? "down" : value === 3 || value === "left" ? "left" : null; }
/** Descriptor-safe bounded clone for public snapshots/commands. */
function safeData(value, depth, maximumItems) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError("Non-finite public data"); return Object.is(value, -0) ? 0 : value; }
  if (depth >= 12) throw new TypeError("Public data exceeds depth limit");
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || value.length > maximumItems) throw new TypeError("Invalid public array");
    return Object.freeze(value.map((_, index) => { const descriptor = Object.getOwnPropertyDescriptor(value, String(index)); if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new TypeError("Sparse or accessor array"); return safeData(descriptor.value, depth + 1, maximumItems); }));
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("Public data must be plain serializable data");
  const keys = Reflect.ownKeys(value); if (keys.length > maximumItems || keys.some((key) => typeof key !== "string")) throw new TypeError("Public record exceeds limits");
  const result = {};
  for (const key of keys) { if (key.length > 256) throw new TypeError("Public key exceeds limit"); const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new TypeError("Public accessors are forbidden"); if (descriptor.value !== undefined) result[key] = safeData(descriptor.value, depth + 1, maximumItems); }
  return Object.freeze(result);
}
