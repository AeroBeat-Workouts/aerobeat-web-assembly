// @ts-check

import "@aerobeat/web-style/aero-theme.css";
import { webGameplayIconBundle } from "@aerobeat/branding/web-gameplay-assets";
import {
  conversionRecipeIds,
  elementNames,
  isGameCommand,
  isSafeIframePayload,
  prototypeJudgementDefaults,
  rulesetIds
} from "@aerobeat/web-contracts";
import { canonicalPrototypeProfileJson } from "@aerobeat/web-gameplay";
import { rasterizeBrandingIconAtlas } from "@aerobeat/web-renderer";
import { aeroUiIntentEventName, defineAeroUiElements, snapVisualTestVolume } from "@aerobeat/web-ui";
import { createLiveCameraSourceDescriptor } from "@aerobeat/web-video";
import { appMetadata } from "./release-metadata.js";
import {
  exactGameplayVariant,
  firstUseBoxingRecipeId,
  readBoxingRecipeIntent,
  readGameplayRulesetIntent,
  rendererPresentationForVariant,
  selectedGameplayProfileId
} from "./gameplay-mode-selection.js";
import { createAeroGameIframeBridge } from "./iframe-bridge.js";
import { getAudioMixSnapshot, setAudioMixSnapshot, subscribeAudioMix } from "./audio-mix-coordinator.js";
import { aeroGameMediaLeaseCoordinator, AeroGameMediaLeaseCoordinator } from "./media-lease-coordinator.js";
import { createLockedVideoFrameSource } from "./production-cv-service.js";
import { createAeroDisplayLoop } from "./runtime-cadence.js";
import { createAeroGameServiceGraph, lockedProductionCvProfile } from "./service-graph.js";
import { projectSessionTargets } from "./session-render-projection.js";

export { createAeroGameIframeBridge } from "./iframe-bridge.js";
export { aeroGameMediaLeaseCoordinator, AeroGameMediaLeaseCoordinator } from "./media-lease-coordinator.js";
export { createAeroGameServiceGraph, lockedProductionCvProfile } from "./service-graph.js";

const GAME_EVENT_NAME = "aero-game-event";
const AERO_BACKGROUND_PROJECTION = Object.freeze({ kind: "linear-gradient", colors: Object.freeze(["#071426", "#153b5d"]), angleDeg: 180 });
const CAMERA_BACKGROUND_PROJECTION = Object.freeze({ kind: "solid", colors: Object.freeze(["#00000000"]), angleDeg: 180 });
const PLAY_START_REQUEST = Object.freeze({ schema: "aerobeat/gameplay_session_start", version: 1, purpose: "play" });
const VISUAL_TEST_START_REQUEST = Object.freeze({ schema: "aerobeat/gameplay_session_start", version: 1, purpose: "visual_test" });
const FLOW_REIMPORT_MESSAGE = "This downloaded song uses the legacy Flow orientation. Reimport it to play.";
const MAXIMUM_VISUAL_TEST_DURATION_MS = 86_400_000;
const GAMEPLAY_CURSOR_GRID = Object.freeze({ x:0, y:0, width:1, height:1 });
const DEBUG_CAMERA_MOVEMENT_INTENTS = Object.freeze(["forward", "back", "left", "right", "up", "down"]);
const DEBUG_CAMERA_SPEED_MODES = Object.freeze(["normal", "boost"]);
const DEBUG_CAMERA_CAPTURE_MODES = Object.freeze(["none", "pointer", "fallback", "touch"]);
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
    this.frameLoop = null;
    this.visibilityGeneration = 0;
    this.audioSyncPending = false;
    this.latestPoseTimestampMs = -1;
    this.lastFreshPoseAtMs = -Infinity;
    this.lastInputAdvanceAtMs = -Infinity;
    this.lastContentSyncAtMs = -Infinity;
    this.cadenceStartedAtMs = 0;
    this.cadenceLatestFrameAtMs = 0;
    this.displayFrameCount = 0;
    this.freshPoseConsumptionCount = 0;
    this.inputAdvanceCount = 0;
    this.presenterCommitCount = 0;
    this.runtimeUiCommitCount = 0;
    this.runtimeUiSignature = "";
    this.contentPresenterSignature = "";
    this.activeCvSource = null;
    this.lastCameraIdentity = "";
    this.browsedMaps = new Map();
    this.beatSaverView = emptyBeatSaverView();
    this.libraryView = Object.freeze({ collections: Object.freeze([]), selectedCollectionId: null, selectedPackageId: null, storage: null });
    this.librarySelectionGeneration = 0;
    this.librarySelectionTail = Promise.resolve(null);
    this.desiredLibrarySelection = null;
    this.lastBoxingRecipeId = firstUseBoxingRecipeId;
    this.leaseParticipant = null;
    this.unregisterLease = null;
    this.fullscreenPending = false;
    this.fullscreenError = null;
    this.container = containerSnapshot(0, 0, 1, true, false);
    this.lastError = null;
    this.menuOpen = false;
    this.menuPauseArmed = false;
    this.menuStarting = false;
    this.sessionStartRequested = false;
    this.sessionGeneration = 0;
    this.pendingSessionAction = "";
    this.activeSessionAction = "";
    this.transportIntentTail = Promise.resolve();
    this.desiredTransportSeekMs = null;
    this.transportSeekQueued = false;
    this.iconAtlasGeneration = 0;
    this.iconAtlasAbort = null;
    this.environmentMode = "aero";
    this.cameraCompositeMode = null;
    this.musicPrerequisite = "";
    this.pendingLibrarySelection = null;
    this.menuFocusRestore = null;
    this.previewView = emptyPreviewView();
    this.previewGeneration = 0;
    this.previewTimer = 0;
    this.previewObjectUrl = null;
    this.previewListeners = null;
    /** @type {Map<number, string>} */
    this.debugCameraControlPointers = new Map();
    this.debugCameraSpeedMode = "normal";
    this.debugCameraUiSignature = "";
    this.boundVisibility = () => { if (document.hidden) this.releaseDebugCameraControls(); void this.applyVisibility(); };
    this.boundFullscreen = () => { this.fullscreenPending = false; this.fullscreenError = null; this.measureContainer(); this.publish("fullscreen_changed"); };
    this.boundUiIntent = (event) => this.handleUiIntent(event);
    this.boundLocalZip = (event) => { void this.handleLocalZip(event); };
    this.boundInteractionClick = (event) => { void this.handleInteractionClick(event); };
    this.boundInteractionKeydown = (event) => this.handleInteractionKeydown(event);
    this.boundDebugCameraPointerDown = (event) => this.handleDebugCameraPointerDown(event);
    this.boundDebugCameraPointerRelease = (event) => this.handleDebugCameraPointerRelease(event);
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = template();
    this.localZipPicker = document.createElement("input"); this.localZipPicker.type = "file"; this.localZipPicker.accept = ".zip,application/zip"; this.localZipPicker.hidden = true; root.prepend(this.localZipPicker);
  }

  connectedCallback() {
    if (this.lifecycle === "connected") return;
    this.instanceId = this.getAttribute("instance-id") || this.instanceId;
    this.connectedGeneration += 1;
    this.lifecycle = "connected";
    this.activeAbort = new AbortController(); this.audioSyncPending = false;
    this.latestPoseTimestampMs = -1; this.lastFreshPoseAtMs = -Infinity; this.lastInputAdvanceAtMs = -Infinity; this.lastContentSyncAtMs = -Infinity; this.runtimeUiSignature = ""; this.contentPresenterSignature = "";
    this.menuOpen = true; this.menuPauseArmed = false; this.menuStarting = false; this.sessionStartRequested = false; this.sessionGeneration += 1; this.pendingSessionAction = ""; this.activeSessionAction = ""; this.transportIntentTail = Promise.resolve(); this.desiredTransportSeekMs = null; this.transportSeekQueued = false; this.iconAtlasGeneration += 1; this.iconAtlasAbort?.abort(); this.iconAtlasAbort = null; this.environmentMode = "aero"; this.cameraCompositeMode = null; this.musicPrerequisite = ""; this.pendingLibrarySelection = null; this.menuFocusRestore = null; this.debugCameraControlPointers.clear(); this.debugCameraSpeedMode = "normal"; this.debugCameraUiSignature = "";
    this.stopPreview({ render: false });
    this.browsedMaps.clear(); this.beatSaverView = emptyBeatSaverView(); this.libraryView = Object.freeze({ collections: Object.freeze([]), selectedCollectionId: null, selectedPackageId: null, storage: null });
    this.librarySelectionGeneration += 1; this.librarySelectionTail = Promise.resolve(null); this.desiredLibrarySelection = null;
    try {
      this.graph = this.serviceGraphFactory({ instanceId: this.instanceId });
      const graph = this.graph; const generation = this.connectedGeneration;
      graph.audio.setMix(getAudioMixSnapshot());
      this.unsubscribe.push(subscribeAudioMix((mix) => { if (!this.isCurrent(generation, graph)) return; graph.audio.setMix(mix); this.renderVisualTestTransport(); }, false));
      this.attachStableSurfaces();
      this.beginIconAtlasInitialization();
      this.bindGraph();
      this.bindLease();
      this.bindHostLifecycle();
      this.createBridge();
      this.measureContainer();
      this.renderPresenters();
      queueMicrotask(() => { if (this.isConnected && this.menuOpen) this.menuButtonElement()?.focus(); });
      this.publish("ready");
      void this.refreshLibrary(this.connectedGeneration);
    } catch (error) {
      this.handleError(error);
      this.teardown("error");
    }
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

  async start() { return this.startSession("play", { requireDownloaded: false }); }

  /** Start or restart one exact purpose from song time zero. @param {"play"|"visual_test"} purpose @param {{requireDownloaded?:boolean}} [options] */
  async startSession(purpose, options = {}) {
    this.assertConnected();
    if (purpose !== "play" && purpose !== "visual_test") throw new TypeError("Session purpose is invalid");
    this.stopPreview();
    const connectionGeneration = this.connectedGeneration; const graph = this.graph; const participant = this.leaseParticipant; const previousTransportTail = this.transportIntentTail;
    const sessionGeneration = ++this.sessionGeneration; const action = purpose === "visual_test" ? "test" : "start";
    this.desiredTransportSeekMs = null; this.transportSeekQueued = false; this.transportIntentTail = Promise.resolve(); this.audioSyncPending = false;
    this.sessionStartRequested = false; this.activeSessionAction = ""; this.pendingSessionAction = action; this.menuStarting = true; this.lastError = null; this.musicPrerequisite = ""; this.renderPresenters();
    try {
      await previousTransportTail;
      if (!this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) return this.getSnapshot();
      if (this.pendingLibrarySelection) await this.pendingLibrarySelection;
      if (!this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) return this.getSnapshot();
      if (options.requireDownloaded === true && !this.downloadedPlayable()) throw new Error("Download Music first.");
      const contentPlayable = playableContent(graph.content.getSnapshot());
      this.stopFrameLoop();
      await Promise.allSettled([graph.audio.stop(), graph.cv.stop()]);
      if (!this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) return this.getSnapshot();
      graph.video.pause(this.videoElement());
      if (typeof graph.audio.seek === "function") await graph.audio.seek(0);
      if (!this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) return this.getSnapshot();
      if (contentPlayable) this.configureGameplayFromContent(false);
      this.restartIconAtlasIfPending();
      const resources = purpose === "visual_test" ? Object.freeze(["audio"]) : Object.freeze(["camera", "audio"]);
      await aeroGameMediaLeaseCoordinator.requestResources(participant, resources);
      if (!this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) return this.getSnapshot();
      graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
      if (purpose === "play") {
        if (!graph.video.getRetainedCameraStream()) {
          const result = await graph.video.requestCamera(createLiveCameraSourceDescriptor({ sourceId: "aero.mediapipe.live", mirrored: true }), { signal: this.activeAbort.signal });
          if (!this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) return this.getSnapshot();
          if (result.status !== "granted") throw new Error(result.message);
        }
        this.attachRetainedCamera();
        await graph.video.play(this.videoElement());
        if (!this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) return this.getSnapshot();
        await this.startCv();
      } else {
        graph.video.pause(this.videoElement());
        this.activeCvSource = null;
      }
      if (!this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) return this.getSnapshot();
      graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
      this.sessionStartRequested = true; this.activeSessionAction = action;
      graph.gameplay.requestStart(performance.now(), purpose === "visual_test" ? VISUAL_TEST_START_REQUEST : PLAY_START_REQUEST);
      this.syncAudioForGameplay(); this.startFrameLoop(); this.syncContentPlayback();
      this.publish("session_changed");
      return this.getSnapshot();
    } finally {
      if (this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) { this.pendingSessionAction = ""; this.menuStarting = false; this.renderPresenters(); }
    }
  }

  async pause(reason = "manual") {
    this.assertConnected();
    const generation = this.connectedGeneration; const graph = this.graph;
    this.stopFrameLoop();
    await Promise.allSettled([graph.audio.pause(), graph.cv.stop()]);
    if (!this.isCurrent(generation, graph)) return this.getSnapshot();
    graph.video.pause(this.videoElement());
    try { graph.gameplay.pause(performance.now(), boundedString(reason, "manual")); this.synchronizePausedClock(graph); } catch { /* not configured */ }
    this.syncContentPlayback(); this.publish("session_changed");
    return this.getSnapshot();
  }

  async resume() {
    this.assertConnected();
    const generation = this.connectedGeneration; const graph = this.graph; const participant = this.leaseParticipant;
    const visualTest = graph.gameplay.getSnapshot().session.purpose === "visual_test";
    await aeroGameMediaLeaseCoordinator.requestResources(participant, visualTest ? Object.freeze(["audio"]) : Object.freeze(["camera", "audio"]));
    if (!this.isCurrent(generation, graph) || document.hidden) return this.getSnapshot();
    graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
    if (!visualTest) {
      if (graph.video.getRetainedCameraStream()) { this.attachRetainedCamera(); await graph.video.play(this.videoElement()); }
      if (!this.isCurrent(generation, graph)) return this.getSnapshot();
      await this.startCv();
      if (!this.isCurrent(generation, graph)) return this.getSnapshot();
    }
    try { graph.gameplay.resume(performance.now()); } catch { /* not configured */ }
    this.syncAudioForGameplay(); this.startFrameLoop(); this.syncContentPlayback(); this.publish("session_changed");
    return this.getSnapshot();
  }

  /** Serialize one current Visual Test transport operation without leaking rejection state into later intents. @param {()=>Promise<void>} operation @param {number} connectionGeneration @param {number} sessionGeneration @param {ReturnType<typeof createAeroGameServiceGraph>} graph */
  enqueueTransportOperation(operation, connectionGeneration, sessionGeneration, graph) {
    this.transportIntentTail = this.transportIntentTail.then(operation, operation).catch((error) => { if (this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) this.handleError(error); });
  }

  enqueueVisualTestPause() {
    const connectionGeneration = this.connectedGeneration; const sessionGeneration = this.sessionGeneration; const graph = this.graph;
    if (!graph || !this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
    this.enqueueTransportOperation(async () => { await this.pauseVisualTestTransport(connectionGeneration, sessionGeneration, graph); }, connectionGeneration, sessionGeneration, graph);
  }

  enqueueVisualTestPlay() {
    const connectionGeneration = this.connectedGeneration; const sessionGeneration = this.sessionGeneration; const graph = this.graph;
    if (!graph || !this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
    this.enqueueTransportOperation(async () => { await this.resumeVisualTestTransport(connectionGeneration, sessionGeneration, graph); }, connectionGeneration, sessionGeneration, graph);
  }

  /** @param {unknown} value */
  enqueueVisualTestSeek(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return;
    const connectionGeneration = this.connectedGeneration; const sessionGeneration = this.sessionGeneration; const graph = this.graph;
    if (!graph || !this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
    this.desiredTransportSeekMs = value;
    if (this.transportSeekQueued) return;
    this.transportSeekQueued = true;
    this.enqueueTransportOperation(async () => {
      try { await this.drainVisualTestSeeks(connectionGeneration, sessionGeneration, graph); }
      finally { if (this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) this.transportSeekQueued = false; }
    }, connectionGeneration, sessionGeneration, graph);
  }

  /** @param {number} connectionGeneration @param {number} sessionGeneration @param {ReturnType<typeof createAeroGameServiceGraph>} graph */
  async pauseVisualTestTransport(connectionGeneration, sessionGeneration, graph) {
    if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
    this.stopFrameLoop();
    await graph.audio.pause();
    if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
    await graph.cv.stop();
    if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
    graph.video.pause(this.videoElement());
    const session = graph.gameplay.getSnapshot().session;
    if (session.state !== "paused_manual") { try { graph.gameplay.pause(Math.max(performance.now(), Number(session.timestampMs ?? 0)), "visual_test_transport"); } catch { /* current session may already be paused */ } }
    if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
    this.synchronizePausedClock(graph); this.syncContentPlayback(); this.renderGameplay(graph); this.renderVisualTestTransport(); this.publish("session_changed");
  }

  /** @param {number} connectionGeneration @param {number} sessionGeneration @param {ReturnType<typeof createAeroGameServiceGraph>} graph */
  async resumeVisualTestTransport(connectionGeneration, sessionGeneration, graph) {
    if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph) || document.hidden) return;
    await aeroGameMediaLeaseCoordinator.requestResources(this.leaseParticipant, Object.freeze(["audio"]));
    if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph) || document.hidden) return;
    graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
    try { graph.gameplay.resume(Math.max(performance.now(), Number(graph.gameplay.getSnapshot().session.timestampMs ?? 0))); } catch { /* unconfigured or already playing */ }
    if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
    this.audioSyncPending = true;
    try {
      await graph.audio.play();
    } catch (error) {
      if (this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) {
        try { graph.gameplay.pause(Math.max(performance.now(), Number(graph.gameplay.getSnapshot().session.timestampMs ?? 0)), "visual_test_transport_audio_failed"); this.synchronizePausedClock(graph); } catch { /* current session may already be paused */ }
      }
      throw error;
    } finally {
      if (this.isSessionCurrent(sessionGeneration, connectionGeneration, graph)) this.audioSyncPending = false;
    }
    if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
    this.startFrameLoop(); this.syncContentPlayback(); this.renderVisualTestTransport(); this.publish("session_changed");
  }

  /** @param {number} connectionGeneration @param {number} sessionGeneration @param {ReturnType<typeof createAeroGameServiceGraph>} graph */
  async drainVisualTestSeeks(connectionGeneration, sessionGeneration, graph) {
    while (this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph) && this.desiredTransportSeekMs !== null) {
      const desiredMs = this.desiredTransportSeekMs; this.desiredTransportSeekMs = null;
      const session = graph.gameplay.getSnapshot().session;
      if (session.state !== "paused_manual" || graph.audio.getStatus().state === "playing") await this.pauseVisualTestTransport(connectionGeneration, sessionGeneration, graph);
      if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
      const seekMs = Math.min(this.visualTestDurationMs(graph), Math.max(0, Math.round(desiredMs)));
      await graph.audio.seek(seekMs / 1000);
      if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
      this.synchronizePausedClock(graph);
      if (!this.isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph)) return;
      this.syncContentPlayback(); this.renderGameplay(graph); this.renderVisualTestTransport();
    }
  }

  async stop() {
    this.assertConnected();
    const generation = this.connectedGeneration; const graph = this.graph; const participant = this.leaseParticipant; const previousTransportTail = this.transportIntentTail;
    this.sessionStartRequested = false; this.activeSessionAction = ""; this.pendingSessionAction = ""; this.sessionGeneration += 1; this.desiredTransportSeekMs = null; this.transportSeekQueued = false; this.transportIntentTail = Promise.resolve(); this.audioSyncPending = false;
    this.stopFrameLoop();
    await previousTransportTail;
    if (!this.isCurrent(generation, graph)) return this.getSnapshot();
    await Promise.allSettled([graph.audio.stop(), graph.cv.stop()]);
    if (!this.isCurrent(generation, graph)) return this.getSnapshot();
    graph.video.pause(this.videoElement());
    try { graph.gameplay.stop(performance.now()); } catch { /* not configured */ }
    await aeroGameMediaLeaseCoordinator.release(participant);
    if (!this.isCurrent(generation, graph)) return this.getSnapshot();
    graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot()); this.syncContentPlayback(); this.publish("session_changed");
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
    this.invalidatePendingSessionStart(); this.stopPreview();
    const generation = this.connectedGeneration; const graph = this.graph;
    const normalized = contentSource(source); const kind = normalized.kind;
    let profilePackage = kind === "direct" ? packageFromEnvelope(normalized.package) : null;
    try {
      if (kind === "persistence") { const loaded = await graph.authoring.loadPackage(normalized.handle); profilePackage = loaded.package; await graph.content.loadPersistenceHandle(normalized.handle, this.contentLoadOptions()); }
      else if (kind === "external") await graph.content.loadExternalPackage(normalized.url, this.contentLoadOptions());
      else if (kind === "direct") await graph.content.loadPackage(normalized.package, this.contentLoadOptions());
      else throw new TypeError("Unsupported content source kind");
    } catch (error) { if (!this.isCurrent(generation, graph)) return this.getSnapshot(); throw error; }
    if (!this.isCurrent(generation, graph)) return this.getSnapshot();
    try { await this.loadSelectedAudio(graph); } catch (error) { if (!this.isCurrent(generation, graph)) return this.getSnapshot(); throw error; }
    if (!this.isCurrent(generation, graph)) return this.getSnapshot();
    if (profilePackage) this.synchronizeConverterProvenance(profilePackage);
    this.configureGameplayFromContent(false); this.syncContentPlayback();
    this.publish("content_changed");
    return this.getSnapshot();
  }

  async selectVariant(variantId, modifierIds = []) {
    this.assertConnected(); this.invalidatePendingSessionStart();
    const generation = this.connectedGeneration; const graph = this.graph;
    this.syncContentPlayback();
    const gameplay = graph.gameplay.getSnapshot();
    const configured = gameplay.session?.packageId === graph.content.getSnapshot().packageId;
    const futureOnly = configured && ["calibrating", "paused_manual", "paused_tracking"].includes(gameplay.session.state);
    try {
      if (futureOnly) await graph.content.swapFutureVariant(boundedString(variantId, ""), { modifierIds: stringList(modifierIds, 16) });
      else await graph.content.selectVariant(boundedString(variantId, ""), { modifierIds: stringList(modifierIds, 16) });
    } catch (error) { if (!this.isCurrent(generation, graph)) return this.getSnapshot(); throw error; }
    if (!this.isCurrent(generation, graph)) return this.getSnapshot();
    const selectedRecipeId = graph.content.getSnapshot().selectedVariant?.recipeId;
    if (conversionRecipeIds.includes(selectedRecipeId)) this.lastBoxingRecipeId = selectedRecipeId;
    this.configureGameplayFromContent(futureOnly); this.syncContentPlayback();
    this.publish("content_changed");
    return this.getSnapshot();
  }

  /** Resolve independent bounded gameplay axes to one exact authored variant. */
  async selectGameplayAxes(rulesetId, recipeId = this.lastBoxingRecipeId) {
    this.assertConnected();
    if (!rulesetIds.includes(rulesetId)) throw new TypeError("Gameplay ruleset intent is invalid");
    if (rulesetId !== rulesetIds[0] && !conversionRecipeIds.includes(recipeId)) throw new TypeError("Boxing conversion intent is invalid");
    const target = exactGameplayVariant(this.graph.content.getSnapshot().variants, rulesetId, recipeId);
    if (!target?.variantId) throw new Error("Selected gameplay variant is unavailable");
    if (rulesetId !== rulesetIds[0]) this.lastBoxingRecipeId = recipeId;
    return this.selectVariant(target.variantId);
  }

  /** Select one registered experimental profile by bounded ID. */
  selectPrototypeProfile(profileId) {
    this.assertConnected(); this.invalidatePendingSessionStart();
    const id = boundedProfileIdentifier(profileId);
    const before = this.graph.profiles.getSnapshot();
    const target = before.profiles.find((profile) => profile.profileId === id);
    if (!target) throw new Error("Prototype profile is not registered");
    const sessionState = profileSessionState(this.graph.gameplay.getSnapshot());
    const selected = this.graph.profiles.select(id, { sessionState });
    if (selected.identity.class === "between_run_ruleset") this.applyActiveScoringProfile();
    this.publish("profiles_changed");
    return this.getSnapshot();
  }

  /** Atomically import one direct-host profile bundle. Bundles never cross iframe messaging. */
  importPrototypeProfiles(bundle) {
    this.assertConnected(); this.invalidatePendingSessionStart();
    const before = this.graph.profiles.getSnapshot();
    this.graph.profiles.importProfiles(bundle, { sessionState: profileSessionState(this.graph.gameplay.getSnapshot()) });
    const after = this.graph.profiles.getSnapshot();
    if (before.active.scoring.identity.contentHash !== after.active.scoring.identity.contentHash) this.applyActiveScoringProfile();
    this.publish("profiles_changed");
    return this.getSnapshot();
  }

  /** Export an immutable direct-host bundle. Callers keep it outside snapshots and iframe traffic. */
  exportPrototypeProfiles() { this.assertConnected(); return this.graph.profiles.exportProfiles(); }

  resetPrototypeProfiles() {
    this.assertConnected(); this.invalidatePendingSessionStart();
    const state = profileSessionState(this.graph.gameplay.getSnapshot());
    if (!["idle", "calibrating", "paused_manual", "paused_tracking", "completed", "stopped"].includes(state)) throw new Error("Profile reset requires an idle, paused, or between-run session");
    const appliedHash = this.graph.profiles.getSnapshot().appliedConverterHash;
    this.graph.profiles.reset();
    this.restoreAppliedConverterSelection(appliedHash);
    this.applyActiveScoringProfile(); this.publish("profiles_changed");
    return this.getSnapshot();
  }

  async browseBeatSaver(query = {}) {
    this.assertConnected();
    this.stopPreview();
    const generation = this.connectedGeneration; const graph = this.graph; const normalized = safeData(query, 0, 32);
    const latest = dataValue(normalized, "latest") === true; const vendorQuery = Object.freeze(Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== "latest")));
    this.beatSaverView = Object.freeze({ ...this.beatSaverView, state: "loading", query: boundedString(dataValue(normalized, "text"), ""), errorMessage: "" }); this.renderPresenters();
    try {
      const results = latest ? await graph.vendor.listLatestMaps(vendorQuery, { signal: this.activeAbort.signal }) : await graph.vendor.searchMaps(vendorQuery, { signal: this.activeAbort.signal });
      if (!this.isCurrent(generation, graph)) return results;
      const previousMapId = this.beatSaverView.selectedMap?.mapId;
      const compatibleMaps = Object.freeze(results.maps.filter((map) => playableVersions(map).length > 0).slice(0, 20));
      this.browsedMaps.clear(); for (const map of compatibleMaps) this.browsedMaps.set(map.mapId.toUpperCase(), map);
      const summaries = Object.freeze(compatibleMaps.map(mapSummary));
      this.beatSaverView = Object.freeze({ ...emptyBeatSaverView(), state: summaries.length ? "ready" : "empty", query: boundedString(dataValue(normalized, "text"), ""), results: summaries });
      const deterministicSelection = summaries.find((summary) => summary.mapId === previousMapId) ?? summaries[0];
      if (deterministicSelection) this.selectBrowsedMap(deterministicSelection.mapId); else this.renderPresenters();
      this.emitGameEvent("beatsaver_results", { resultCount: summaries.length, maps: summaries });
      return Object.freeze({ ...results, maps: compatibleMaps });
    } catch (error) {
      if (!this.isCurrent(generation, graph)) return null;
      this.beatSaverView = Object.freeze({ ...this.beatSaverView, state: "error", errorMessage: errorMessage(error) }); this.renderPresenters();
      throw error;
    }
  }

  async browseLatestBeatSaver(options = {}) { return this.browseBeatSaver({ ...safeData(options, 0, 32), latest: true }); }

  async importBeatSaver(map, versionIdentifier, authoringOptions) {
    this.assertConnected();
    this.stopPreview();
    const generation = this.connectedGeneration; const graph = this.graph;
    let acquired;
    try { acquired = await graph.vendor.acquireVersion(safeData(map, 0, 64), typeof versionIdentifier === "string" ? versionIdentifier : undefined, { signal: this.activeAbort.signal, onProgress: (progress) => { if (this.isCurrent(generation, graph)) this.emitGameEvent("import_changed", { phase: progress.phase, loadedBytes: progress.loadedBytes, totalBytes: progress.totalBytes ?? null }); } }); }
    catch (error) { if (!this.isCurrent(generation, graph)) return null; throw error; }
    if (!this.isCurrent(generation, graph)) return null;
    return this.convertAcquired(acquired, authoringOptions);
  }

  async importBeatSaverById(mapId, versionIdentifier, authoringOptions, requireBrowsed = false) {
    this.assertConnected();
    const generation = this.connectedGeneration; const graph = this.graph; const safeMapId = boundedIdentifier(mapId, "BeatSaver map ID");
    let map = this.browsedMaps.get(safeMapId.toUpperCase());
    if (!map && requireBrowsed) throw new Error("Iframe import must reference a child-browsed BeatSaver map");
    if (!map) { try { map = await graph.vendor.getMapById(safeMapId, { signal: this.activeAbort.signal }); } catch (error) { if (!this.isCurrent(generation, graph)) return null; throw error; } }
    if (!this.isCurrent(generation, graph)) return null;
    return this.importBeatSaver(map, versionIdentifier, authoringOptions);
  }

  async importLocalZip(input, authoringOptions) {
    this.assertConnected();
    this.stopPreview();
    if (!(input instanceof Blob || input instanceof ArrayBuffer || input instanceof Uint8Array)) throw new TypeError("Local import requires Blob, ArrayBuffer, or Uint8Array");
    const generation = this.connectedGeneration; const graph = this.graph;
    let acquired;
    try { acquired = await graph.vendor.importLocalArchive(input, { signal: this.activeAbort.signal }); }
    catch (error) { if (!this.isCurrent(generation, graph)) return null; throw error; }
    if (!this.isCurrent(generation, graph)) return null;
    return this.convertAcquired(acquired, authoringOptions);
  }

  cancelImport() { this.assertConnected(); return this.graph.authoring.cancel(); }
  async deletePackage(handle) { this.assertConnected(); this.stopPreview(); const generation = this.connectedGeneration; const graph = this.graph; const deleted = await graph.authoring.deletePackage(safeData(handle, 0, 16)); if (this.isCurrent(generation, graph)) { this.desiredLibrarySelection = null; await this.refreshLibrary(generation); if (this.isCurrent(generation, graph)) this.publish("content_changed"); } return deleted; }
  async deleteLibraryCollection(collectionIdValue) { this.assertConnected(); this.stopPreview(); const generation = this.connectedGeneration; const graph = this.graph; const collectionId = boundedString(collectionIdValue, ""); if (!collectionId) throw new Error("Downloaded song is unavailable"); this.librarySelectionGeneration += 1; this.desiredLibrarySelection = null; const legacyTarget = this.libraryView.collections.find((entry) => entry.collectionId === collectionId)?.difficulties[0]; const deleted = typeof graph.authoring.deleteCollection === "function" ? await graph.authoring.deleteCollection(collectionId) : legacyTarget ? await graph.authoring.deletePackage({ key: legacyTarget.packageKey, packageId: legacyTarget.packageId }) : false; if (this.isCurrent(generation, graph)) { await this.refreshLibrary(generation); if (this.isCurrent(generation, graph)) this.publish("content_changed"); } return deleted; }

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
      case "start": return command.payload === null ? this.start() : this.startSession(dataValue(payload, "purpose") === "visual_test" ? "visual_test" : "play", { requireDownloaded: false });
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
      case "import_beatsaver": return this.importBeatSaverById(dataValue(payload, "mapId"), dataValue(payload, "versionHash"), { difficulty: dataValue(payload, "difficultyId"), sourceId: dataValue(payload, "mapId"), modifiers: dataValue(payload, "modifierIds") ?? [] }, true);
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
      interaction: { menuOpen: this.menuOpen, menuPauseArmed: this.menuPauseArmed, menuStarting: this.menuStarting },
      iframe: this.bridge?.getSnapshot() ?? { schema: "aerobeat/iframe_bridge_snapshot", version: 1, framed: false, connected: false, parentOrigin: null },
      lease: aeroGameMediaLeaseCoordinator.snapshot(), cvProfile: lockedProductionCvProfile,
      services: graph ? {
        vendor: graph.vendor.snapshot(), authoring: graph.authoring.getSnapshot(), content: contentTelemetry(graph.content.getSnapshot()),
        video: graph.video.describeStatus(), cv: graph.cv.getStatus(), input: graph.input.getSnapshot(), audio: graph.audio.getStatus(),
        profiles: profileTelemetry(graph.profiles.getSnapshot()), gameplay: gameplayTelemetry(graph.gameplay.getSnapshot()), renderer: rendererTelemetry(graph.renderer.describe()), cadence: this.cadenceSnapshot()
      } : null,
      error: this.lastError
    }, 0, 2048);
  }

  /** Terminal until a disconnect/reconnect creates a fresh graph. */
  destroy() { this.teardown("destroyed"); return this.getSnapshot(); }

  attachStableSurfaces() {
    this.graph.renderer.attach(this.canvasElement()); this.graph.renderer.clear({ color: [0, 0, 0, 0] });
    const video = this.videoElement();
    video.muted = true; video.playsInline = true;
  }

  beginIconAtlasInitialization() {
    const graph = this.graph; if (!graph || typeof graph.renderer.uploadIconAtlas !== "function") return;
    this.iconAtlasAbort?.abort();
    const abort = new AbortController(); this.iconAtlasAbort = abort;
    const atlasGeneration = ++this.iconAtlasGeneration; const connectionGeneration = this.connectedGeneration;
    const onConnectionAbort = () => abort.abort(); this.activeAbort.signal.addEventListener("abort", onConnectionAbort, { once: true });
    void rasterizeBrandingIconAtlas(webGameplayIconBundle.manifest, {
      signal: abort.signal,
      resolveUrl: (asset) => {
        const url = webGameplayIconBundle.iconUrls[asset.id];
        if (typeof url !== "string" || url.length > 4096) throw new Error("Canonical gameplay icon URL is unavailable");
        return url;
      }
    }).then((atlas) => {
      if (!this.isCurrent(connectionGeneration, graph) || atlasGeneration !== this.iconAtlasGeneration || abort.signal.aborted) return;
      graph.renderer.uploadIconAtlas(atlas); this.renderRuntimePresentation();
    }).catch((error) => {
      if (abort.signal.aborted || !this.isCurrent(connectionGeneration, graph) || atlasGeneration !== this.iconAtlasGeneration) return;
      graph.renderer.uploadIconAtlas(null); this.renderRuntimePresentation();
    }).finally(() => { this.activeAbort.signal.removeEventListener("abort", onConnectionAbort); if (this.iconAtlasAbort === abort) this.iconAtlasAbort = null; });
  }

  restartIconAtlasIfPending() {
    if (!this.graph || this.graph.renderer.describe().iconAtlasReady === true) return;
    this.beginIconAtlasInitialization();
  }

  bindGraph() {
    if (typeof this.graph.input.subscribe === "function") this.unsubscribe.push(this.graph.input.subscribe(() => { this.renderRuntimePresentation(); this.emitGameEvent("calibration_changed", { snapshot: this.snapshotForType("calibration_changed") }); }));
    if (typeof this.graph.content.subscribe === "function") this.unsubscribe.push(this.graph.content.subscribe((snapshot) => {
      const signature = contentPresenterDataSignature(snapshot); const presenterDataChanged = signature !== this.contentPresenterSignature; this.contentPresenterSignature = signature;
      if (this.menuOpen && presenterDataChanged) this.renderPresenters(); else this.renderRuntimePresentation();
      this.emitGameEvent("content_changed", { snapshot: this.snapshotForType("content_changed") });
    }));
    if (typeof this.graph.authoring.subscribe === "function") this.unsubscribe.push(this.graph.authoring.subscribe(() => { if (this.menuOpen) this.renderPresenters(); else this.renderRuntimePresentation(); this.emitGameEvent("import_changed", { snapshot: this.snapshotForType("import_changed") }); }));
    this.unsubscribe.push(this.graph.profiles.subscribe(() => { this.applyActiveVisualProfile(); if (this.menuOpen) this.renderPresenters(); else this.renderRuntimePresentation(); this.emitGameEvent("profiles_changed", { snapshot: profileTelemetry(this.graph.profiles.getSnapshot()) }); }));
  }

  bindLease() {
    const graph = this.graph; const generation = this.connectedGeneration;
    const participant = {
      instanceId: this.instanceId,
      pauseForLease: async () => { if (!this.isCurrent(generation, graph)) return; this.stopFrameLoop(); await Promise.allSettled([graph.audio.pauseForLease(), graph.cv.stop()]); if (!this.isCurrent(generation, graph)) return; graph.video.pauseForLease(); graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot()); try { graph.gameplay.pause(performance.now(), "media_lease_transferred"); this.synchronizePausedClock(graph); } catch { /* not configured */ } this.syncContentPlayback(); },
      activateLease: async (context) => { if (!this.isCurrent(generation, graph)) return; if (context?.resources.includes("camera")) graph.video.activateLease(); else graph.video.releaseLease({ releaseStream: false }); await graph.audio.activateLease(); },
      releaseLease: async () => { graph.video.releaseLease({ releaseStream: false }); await graph.audio.releaseLease(); }
    };
    this.leaseParticipant = participant;
    this.unregisterLease = aeroGameMediaLeaseCoordinator.register(participant);
  }

  bindHostLifecycle() {
    document.addEventListener("visibilitychange", this.boundVisibility);
    document.addEventListener("fullscreenchange", this.boundFullscreen);
    this.shadowRoot?.addEventListener(aeroUiIntentEventName, this.boundUiIntent);
    this.shadowRoot?.addEventListener("click", this.boundInteractionClick);
    this.shadowRoot?.addEventListener("keydown", this.boundInteractionKeydown);
    this.shadowRoot?.addEventListener("pointerdown", this.boundDebugCameraPointerDown);
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.shadowRoot?.addEventListener(type, this.boundDebugCameraPointerRelease);
    this.shadowRoot?.addEventListener("pointerleave", this.boundDebugCameraPointerRelease, true);
    this.localZipInput().addEventListener("change", this.boundLocalZip);
    this.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.measureContainer()) : null;
    this.resizeObserver?.observe(this);
    globalThis.addEventListener("resize", this.boundFullscreen);
  }

  createBridge() {
    if (globalThis.parent === globalThis) return;
    const expectedOrigin = this.getAttribute("parent-origin") || referrerOrigin();
    if (!expectedOrigin) return;
    this.bridge = createAeroGameIframeBridge({ parentWindow: globalThis.parent, instanceId: this.instanceId, expectedOrigin, onConnect: () => this.emitGameEvent("ready", { snapshot: this.getSnapshot() }), onCommand: (command) => { Promise.resolve(this.executeCommand(command)).catch((error) => this.handleError(error)); }, onError: (error) => this.handleError(error) });
  }

  async convertAcquired(acquired, options) {
    const generation = this.connectedGeneration; const graph = this.graph;
    const raw = options === undefined ? Object.freeze({}) : safeData(options, 0, 32);
    const converter = graph.profiles.getActive("converter_regeneration");
    let result;
    try { result = await graph.authoring.convertAllStandardAndPersist(acquired.source, {
      sourceProvider: "beatsaver",
      sourceId: boundedString(dataValue(raw, "sourceId"), boundedString(acquired.map?.mapId, "local")),
      sourceVersionHash: acquired.sourceHash,
      modifiers: stringList(dataValue(raw, "modifiers") ?? [], 5), includeAudio: true,
      converterProfile: converter.profile,
      signal: this.activeAbort.signal
    }); } catch (error) { if (!this.isCurrent(generation, graph)) return null; throw error; }
    if (!this.isCurrent(generation, graph)) return null;
    const defaultLoaded = await graph.authoring.loadPackage(result.defaultPackage.handle);
    if (!this.isCurrent(generation, graph)) return null;
    if (!packageCarriesConverterProfile(defaultLoaded.package, converter.profile)) throw new Error("Authored package converter provenance is incomplete");
    graph.profiles.select(converter.profile.profileId, { sessionState: profileSessionState(graph.gameplay.getSnapshot()), regeneratedPackageProfileHash: converter.profile.contentHash });
    this.emitGameEvent("import_changed", { collectionId: result.collection.collectionId, packageCount: result.packages.length });
    await this.refreshLibrary(generation, { preferredCollectionId: result.collection.collectionId, preferredPackageId: result.defaultPackage.packageId });
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

  async loadSelectedAudio(graph = this.graph) {
    const content = graph.content.getSnapshot();
    const audio = content.song?.audio;
    if (!audio || typeof audio.filePath !== "string") return;
    const bytes = graph.content.readAsset(audio.filePath);
    const hash = typeof audio.contentHash === "string" ? audio.contentHash.replace(/^sha256:/u, "") : "";
    await graph.audio.load({ id: `${content.packageId}:audio`, kind: "array-buffer", label: content.song?.name ?? "AeroBeat song", arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), contentType: "application/octet-stream", ...(hash ? { expectedHash: { algorithm: "SHA-256", value: hash } } : {}) }, { signal: this.activeAbort.signal });
  }

  configureGameplayFromContent(futureOnly) {
    const content = this.graph.content.getSnapshot();
    if (content.state !== "ready" || !content.selectedVariant) return;
    const scoring = this.graph.profiles.getActive("between_run_ruleset");
    const configuration = { packageId: content.packageId, selectedVariant: content.selectedVariant, resolvedEvents: content.resolvedEvents, profileIdentity: scoring.identity, scoringSettings: scoring.settings };
    if (futureOnly) this.graph.gameplay.applyFutureContent(configuration);
    else this.graph.gameplay.configureContent(configuration);
  }

  applyActiveVisualProfile() {
    if (!this.graph) return;
    const visual = this.graph.profiles.getActive("live_visual");
    this.graph.renderer.importTuning({ identity: visual.identity, settings: visual.settings });
  }

  setEnvironmentMode(mode) {
    if (mode !== "aero" && mode !== "camera") throw new TypeError("Environment choice is invalid");
    this.environmentMode = mode;
    this.renderInteractionShell(); this.syncCameraPresentation();
  }

  cameraPreviewForced() {
    if (!this.graph || !this.sessionStartRequested || this.menuOpen) return false;
    const gameplay = this.graph.gameplay.getSnapshot(); const state = gameplay.session.state;
    if (gameplay.session.purpose === "visual_test") return false;
    return (state === "calibrating" && !gameplay.safety.ready) || state === "paused_tracking" || gameplay.safety.freshCalibrationRequired === true;
  }

  syncCameraPresentation() {
    if (!this.graph) return;
    const retained = Boolean(this.graph.video.getRetainedCameraStream());
    const visible = !document.hidden && retained && (this.environmentMode === "camera" || this.cameraPreviewForced());
    const video = this.videoElement(); video.dataset.previewVisible = visible ? "true" : "false"; video.setAttribute("aria-hidden", "true");
    const compositeMode = visible ? "camera" : "aero";
    if (this.cameraCompositeMode !== compositeMode) { this.graph.renderer.setBackgroundProjection(visible ? CAMERA_BACKGROUND_PROJECTION : AERO_BACKGROUND_PROJECTION); this.cameraCompositeMode = compositeMode; }
  }

  applyActiveScoringProfile() {
    if (!this.graph) return;
    const content = this.graph.content.getSnapshot();
    if (content.state !== "ready" || !content.selectedVariant) return;
    const session = this.graph.gameplay.getSnapshot().session;
    const configured = session.packageId === content.packageId;
    const futureOnly = configured && ["calibrating", "paused_manual", "paused_tracking"].includes(session.state);
    this.configureGameplayFromContent(futureOnly);
  }

  synchronizeConverterProvenance(packageValue) {
    const profile = converterProfileFromPackage(packageValue);
    if (!profile || !packageCarriesConverterProfile(packageValue, profile)) return;
    const snapshot = this.graph.profiles.getSnapshot();
    const applied = snapshot.profiles.find((entry) => entry.class === "converter_regeneration" && entry.contentHash === profile.contentHash);
    if (!applied) return;
    const desiredId = snapshot.active.converter.profile.profileId;
    this.graph.profiles.select(applied.profileId, { regeneratedPackageProfileHash: applied.contentHash });
    if (desiredId !== applied.profileId) this.graph.profiles.select(desiredId);
  }

  restoreAppliedConverterSelection(appliedHash) {
    const content = this.graph.content.getSnapshot();
    const profile = dataValue(content.lineage, "converterProfile");
    if (!profile || dataValue(profile, "contentHash") !== appliedHash) return;
    const snapshot = this.graph.profiles.getSnapshot(); const desiredId = snapshot.active.converter.profile.profileId;
    const applied = snapshot.profiles.find((entry) => entry.class === "converter_regeneration" && entry.contentHash === appliedHash);
    if (!applied) return;
    this.graph.profiles.select(applied.profileId, { regeneratedPackageProfileHash: appliedHash });
    if (desiredId !== applied.profileId) this.graph.profiles.select(desiredId);
  }

  syncContentPlayback() {
    if (!this.graph || this.graph.content.getSnapshot().state !== "ready") return;
    const gameplay = this.graph.gameplay.getSnapshot(); const session = gameplay.session;
    const state = session.state === "playing" ? "running" : session.state === "completed" || session.state === "destroyed" ? "stopped" : session.packageId ? "paused" : "idle";
    this.graph.content.setPlaybackState({ state, positionMs: session.timelinePositionMs, judgedEventIds: gameplay.judgedEventIds, activeEventIds: gameplay.activeEventIds });
  }

  synchronizePausedClock(graph = this.graph) {
    if (!graph) return;
    graph.gameplay.synchronizePausedClock({ timestampMs: Math.max(performance.now(), graph.gameplay.getSnapshot().session.timestampMs), clock: graph.audio.getClockSnapshot() });
  }

  syncAudioForGameplay() {
    const generation = this.connectedGeneration; const graph = this.graph;
    if (!graph || this.audioSyncPending || document.hidden) return;
    const session = graph.gameplay.getSnapshot().session; const shouldPlay = session.state === "playing"; const isPlaying = graph.audio.getStatus().state === "playing";
    const freezeAtGameplayTimeline = ["calibrating", "paused_tracking", "countdown"].includes(session.state);
    const clockAligned = audioClockAlignedWithGameplay(session, graph.audio.getClockSnapshot());
    if (shouldPlay === isPlaying && (!freezeAtGameplayTimeline || clockAligned)) return;
    this.audioSyncPending = true;
    const operation = shouldPlay
      ? graph.audio.play()
      : this.pauseAudioForGameplay(graph, session, freezeAtGameplayTimeline);
    void operation.then(() => {
      if (!this.isCurrent(generation, graph) || shouldPlay || freezeAtGameplayTimeline) return;
      if (graph.gameplay.getSnapshot().session.state === "paused_manual") this.synchronizePausedClock(graph);
    }).catch((error) => { if (this.isCurrent(generation, graph)) this.handleError(error); }).finally(() => { if (this.isCurrent(generation, graph)) this.audioSyncPending = false; });
  }

  async pauseAudioForGameplay(graph, session, freezeAtGameplayTimeline) {
    if (graph.audio.getStatus().state === "playing") await graph.audio.pause();
    if (!freezeAtGameplayTimeline || !this.isCurrent(this.connectedGeneration, graph)) return;
    const clock = graph.audio.getClockSnapshot();
    if (audioClockAlignedWithGameplay(session, clock)) return;
    if (typeof graph.audio.seek !== "function") throw new Error("Audio service cannot align a frozen gameplay countdown");
    await graph.audio.seek(Number(session.timelinePositionMs ?? 0) / 1000);
  }

  attachRetainedCamera() {
    const surface = this.graph.video.attachCameraStream(this.videoElement());
    this.updateCameraIdentity(surface);
    this.activeCvSource = createLockedVideoFrameSource(this.videoElement(), surface);
  }

  updateCameraIdentity(surface) {
    const aspect = Number.isFinite(surface.sourceAspectRatio) ? Number(surface.sourceAspectRatio).toFixed(8) : "unknown";
    const identity = `${surface.sourceChangeId}|${surface.sourceId}|${surface.mirrored === true}|${aspect}`;
    if (identity === this.lastCameraIdentity) return;
    this.lastCameraIdentity = identity; this.graph.input.resetCalibration("media_source_changed");
  }

  async startCv() { if (this.graph?.gameplay.getSnapshot().session.purpose !== "visual_test" && this.activeCvSource && !document.hidden) await this.graph.cv.start(this.activeCvSource); }

  startFrameLoop() {
    this.stopFrameLoop();
    const generation = this.connectedGeneration; const graph = this.graph;
    this.cadenceStartedAtMs = performance.now(); this.cadenceLatestFrameAtMs = 0; this.displayFrameCount = 0; this.freshPoseConsumptionCount = 0; this.inputAdvanceCount = 0;
    const loop = createAeroDisplayLoop({ callback: () => { if (!this.isCurrent(generation, graph) || document.hidden) { if (this.frameLoop === loop) this.stopFrameLoop(); else loop.stop(); return; } this.runDisplayFrame(graph); } });
    this.frameLoop = loop; this.frameTimer = 1; loop.start();
  }

  runDisplayFrame(graph = this.graph) {
    if (!graph) return;
    try {
      const frameNow = performance.now();
      const visualTest = graph.gameplay.getSnapshot().session.purpose === "visual_test";
      if (!visualTest) {
        const surface = graph.video.describeSurface(this.videoElement()); this.updateCameraIdentity(surface);
        const frame = graph.cv.getLatestPoseFrame();
        if (frame && frame.timestampMs !== this.latestPoseTimestampMs) {
          this.latestPoseTimestampMs = frame.timestampMs; this.lastFreshPoseAtMs = frameNow; this.lastInputAdvanceAtMs = frameNow; this.freshPoseConsumptionCount += 1;
          if (!this.menuOpen) graph.input.processPoseSample(frame, { sourceAspectRatio: surface.sourceAspectRatio, sourceChangeId: this.lastCameraIdentity });
        } else if (!this.menuOpen && frameNow - this.lastFreshPoseAtMs >= 100 && frameNow - this.lastInputAdvanceAtMs >= 1000 / 15) {
          this.lastInputAdvanceAtMs = frameNow; this.inputAdvanceCount += 1; graph.input.advanceTime(frameNow);
        }
      }
      try {
        const beforeAdvance = graph.gameplay.getSnapshot().session; const audioClock = graph.audio.getClockSnapshot();
        const awaitingAudioStart = beforeAdvance.state === "playing" && this.audioSyncPending && graph.audio.getStatus().state !== "playing";
        const awaitingAudioFreeze = ["calibrating", "paused_tracking", "countdown"].includes(beforeAdvance.state) && (this.audioSyncPending || !audioClockAlignedWithGameplay(beforeAdvance, audioClock));
        if (!awaitingAudioStart && !awaitingAudioFreeze) {
          graph.gameplay.advance({ timestampMs: frameNow, clock: audioClock, ...(visualTest ? {} : { input: graph.input.getSnapshot() }), lease: this.leaseSnapshotForGameplay() });
          if (!visualTest && this.sessionStartRequested && graph.gameplay.getSnapshot().session.state === "calibrating" && graph.gameplay.getSnapshot().safety.ready) graph.gameplay.requestStart(frameNow);
        }
        this.syncAudioForGameplay();
        if (frameNow - this.lastContentSyncAtMs >= 1000 / 15) { this.lastContentSyncAtMs = frameNow; this.syncContentPlayback(); }
      } catch { /* unconfigured session */ }
      this.syncCameraPresentation(); this.renderGameplay(graph); this.syncDebugCameraControlState(); this.renderVisualTestTransport();
      this.displayFrameCount += 1; this.cadenceLatestFrameAtMs = frameNow;
      if (this.container.devicePixelRatio !== currentDpr()) this.measureContainer();
      this.renderRuntimePresentation();
    } catch (error) { this.handleError(error); }
  }

  stopFrameLoop() { const loop = this.frameLoop; this.frameLoop = null; this.frameTimer = 0; loop?.stop(); }

  async applyVisibility() {
    if (!this.graph) return;
    const generation = this.connectedGeneration; const visibilityGeneration = ++this.visibilityGeneration; const graph = this.graph; const hidden = document.hidden;
    graph.video.setDocumentHidden(hidden);
    await graph.audio.setDocumentHidden(hidden);
    if (!this.isCurrent(generation, graph) || visibilityGeneration !== this.visibilityGeneration) return;
    if (hidden) {
      this.stopPreview();
      this.stopFrameLoop(); await graph.cv.stop();
      if (!this.isCurrent(generation, graph) || visibilityGeneration !== this.visibilityGeneration) return;
      try { graph.gameplay.pause(Math.max(performance.now(), graph.gameplay.getSnapshot().session.timestampMs), "document_hidden"); this.synchronizePausedClock(graph); } catch { /* unconfigured */ }
    } else if (aeroGameMediaLeaseCoordinator.snapshot().ownerInstanceId === this.instanceId) {
      graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
      const visualTest = graph.gameplay.getSnapshot().session.purpose === "visual_test";
      if (!visualTest && graph.video.getRetainedCameraStream()) { this.attachRetainedCamera(); await graph.video.play(this.videoElement()); }
      if (!this.isCurrent(generation, graph) || visibilityGeneration !== this.visibilityGeneration) return;
      if (!visualTest) await this.startCv();
      if (!this.isCurrent(generation, graph) || visibilityGeneration !== this.visibilityGeneration) return;
      try { graph.gameplay.resume(performance.now()); } catch { /* content or calibration may still be pending */ }
      this.syncAudioForGameplay(); this.startFrameLoop();
    }
    this.syncContentPlayback(); this.measureContainer(); this.publish("session_changed");
  }

  measureContainer() {
    if (!this.isConnected) return;
    const style = getComputedStyle(this); const horizontalPadding = cssPixels(style.paddingLeft) + cssPixels(style.paddingRight); const verticalPadding = cssPixels(style.paddingTop) + cssPixels(style.paddingBottom);
    const width = Math.max(0, this.clientWidth - horizontalPadding); const height = Math.max(0, this.clientHeight - verticalPadding); const dpr = currentDpr();
    this.container = containerSnapshot(width, height, dpr, !document.hidden, document.fullscreenElement === this);
    this.graph?.renderer.resize({ widthCssPx: width, heightCssPx: height, devicePixelRatio: dpr });
    this.renderPresenters();
  }

  rendererFrame() {
    const content = this.graph.content.getSnapshot(); const gameplay = this.graph.gameplay.getSnapshot(); const session = gameplay.session;
    const selected = content.selectedVariant; const nowMs = Number(session.timelinePositionMs ?? 0);
    const presentation = rendererPresentationForVariant(selected);
    const events = Array.isArray(content.resolvedEvents) ? content.resolvedEvents : [];
    const targets = projectSessionTargets(events, gameplay, nowMs);
    const blockedCells = presentation === "boxing_spatial_grid" ? Object.freeze([...new Set(targets.filter((target) => target.kind === "obstacle").flatMap((target) => target.cells).filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < 12))]) : undefined;
    return {
      presentation, nowMs, targets, blockedCells,
      timingWindowBeforeMs: prototypeJudgementDefaults.timingWindowBeforeMs,
      timingWindowAfterMs: prototypeJudgementDefaults.timingWindowAfterMs,
      countdown: null, overlay: "none", calibrationDim: 0
    };
  }

  renderGameplay(graph = this.graph) {
    if (!graph) return null;
    const result = graph.renderer.renderGameplayFrame(this.rendererFrame());
    if (typeof graph.renderer.renderGameplayCursors !== "function") return result;
    const cursors = gameplayCursorRecords(this.menuOpen, graph.gameplay.getSnapshot().session, graph.input.getSnapshot());
    graph.renderer.renderGameplayCursors(cursors, { grid: GAMEPLAY_CURSOR_GRID, minConfidence: 0.5, sizeCssPx: 18 });
    return result;
  }

  /** @param {ReturnType<typeof createAeroGameServiceGraph>} [graph] */
  visualTestDurationMs(graph = this.graph) {
    if (!graph) return 0;
    const seconds = Number(graph.audio.getStatus().durationSeconds);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.min(MAXIMUM_VISUAL_TEST_DURATION_MS, Math.round(seconds * 1000)) : 0;
  }

  visualTestTransportSnapshot() {
    const graph = this.graph;
    if (!graph) return Object.freeze({ active:false, playing:false, currentMs:0, durationMs:0, musicVolume:0.5, soundVolume:0.5 });
    const session = graph.gameplay.getSnapshot().session; const durationMs = this.visualTestDurationMs(graph); const mix = graph.audio.getMixSnapshot();
    const active = this.sessionStartRequested && this.activeSessionAction === "test" && session.purpose === "visual_test";
    const timelineMs = Number(session.timelinePositionMs);
    const currentMs = active && Number.isFinite(timelineMs) ? Math.min(durationMs, Math.max(0, Math.round(timelineMs))) : 0;
    const playing = active && session.state === "playing" && graph.audio.getStatus().state === "playing" && this.frameTimer !== 0;
    return Object.freeze({ active, playing, currentMs, durationMs, musicVolume:mix.musicVolume, soundVolume:mix.sfxVolume });
  }

  renderVisualTestTransport() { setPresenter(this, "aero-visual-test-transport", this.visualTestTransportSnapshot()); }

  debugCameraSnapshot() {
    const session = this.graph?.gameplay.getSnapshot().session;
    const visualTest = Boolean(this.graph && this.sessionStartRequested && this.activeSessionAction === "test" && session?.purpose === "visual_test");
    const visible = visualTest;
    const enabled = visible && !this.menuOpen && this.lifecycle === "connected" && !document.hidden && session?.state === "playing";
    return Object.freeze({ visible, enabled });
  }

  syncDebugCameraPresentation() {
    if (!this.graph) return;
    const snapshot = this.debugCameraSnapshot();
    const renderer = this.graph.renderer;
    const before = typeof renderer.describe === "function" ? renderer.describe() : null;
    if (before?.debugCameraEnabled === true && !snapshot.enabled) this.releaseDebugCameraControls();
    if (typeof renderer.setDebugCameraEnabled === "function") renderer.setDebugCameraEnabled(snapshot.enabled);
    if (snapshot.enabled && typeof renderer.setDebugCameraSpeedMode === "function") renderer.setDebugCameraSpeedMode(this.debugCameraSpeedMode);
    const panel = this.shadowRoot?.querySelector("[data-role='debug-camera-controls']");
    if (panel instanceof HTMLElement) { panel.hidden = !snapshot.visible; panel.setAttribute("aria-hidden", snapshot.visible ? "false" : "true"); }
    this.syncDebugCameraControlState(snapshot);
  }

  /** @param {{visible:boolean,enabled:boolean}} [snapshot] */
  syncDebugCameraControlState(snapshot = this.debugCameraSnapshot()) {
    const renderer = this.graph?.renderer;
    const raw = renderer && typeof renderer.describe === "function" ? renderer.describe() : {};
    const captureMode = DEBUG_CAMERA_CAPTURE_MODES.includes(raw.debugCaptureMode) ? raw.debugCaptureMode : "none";
    const speedMode = DEBUG_CAMERA_SPEED_MODES.includes(raw.debugCameraSpeedMode) ? raw.debugCameraSpeedMode : this.debugCameraSpeedMode;
    const activeIntentCount = Number.isInteger(raw.debugActiveIntentCount) ? Math.min(DEBUG_CAMERA_MOVEMENT_INTENTS.length, Math.max(0, raw.debugActiveIntentCount)) : 0;
    const boostActive = raw.debugCameraBoostActive === true;
    this.debugCameraSpeedMode = speedMode;
    const pressedIntents = new Set(this.debugCameraControlPointers.values());
    const signature = JSON.stringify([snapshot.visible, snapshot.enabled, captureMode, speedMode, boostActive, activeIntentCount, [...pressedIntents].sort()]);
    if (signature === this.debugCameraUiSignature) return;
    this.debugCameraUiSignature = signature;
    const panel = this.shadowRoot?.querySelector("[data-role='debug-camera-controls']");
    if (panel instanceof HTMLElement) { panel.dataset.captureMode = captureMode; panel.dataset.speedMode = speedMode; panel.dataset.activeIntentCount = String(activeIntentCount); }
    for (const button of this.shadowRoot?.querySelectorAll("button[data-debug-camera-intent]") ?? []) {
      if (!(button instanceof HTMLButtonElement)) continue;
      const pressed = pressedIntents.has(button.dataset.debugCameraIntent ?? "");
      button.disabled = !snapshot.enabled; button.setAttribute("aria-pressed", pressed ? "true" : "false"); button.dataset.active = pressed ? "true" : "false";
    }
    const speed = this.shadowRoot?.querySelector("button[data-action='debug-camera-speed']");
    if (speed instanceof HTMLButtonElement) {
      const boost = speedMode === "boost"; speed.disabled = !snapshot.enabled; speed.setAttribute("aria-pressed", boost ? "true" : "false"); speed.setAttribute("aria-label", `Camera movement speed ${boost ? "Boost" : "Normal"}. Activate ${boost ? "Normal" : "Boost"}.`);
      const symbol = speed.querySelector("[data-role='debug-camera-speed-symbol']"); if (symbol instanceof HTMLElement) symbol.textContent = boost ? "B" : "N";
    }
    const reset = this.shadowRoot?.querySelector("button[data-action='debug-camera-reset']");
    if (reset instanceof HTMLButtonElement) reset.disabled = !snapshot.enabled;
    const state = this.shadowRoot?.querySelector("[data-role='debug-camera-state']");
    if (state instanceof HTMLOutputElement) {
      const captured = captureMode !== "none"; const effectiveSpeed = boostActive ? "Boost" : "Normal";
      state.textContent = `${captured ? "●" : "○"} · ${effectiveSpeed}`;
      state.setAttribute("aria-label", `Camera look ${captured ? `captured by ${captureMode}` : "not captured"}; movement speed ${effectiveSpeed}; ${activeIntentCount} active movement ${activeIntentCount === 1 ? "intent" : "intents"}.`);
    }
  }

  /** @param {Event} event */
  handleDebugCameraPointerDown(event) {
    if (!(event instanceof PointerEvent) || !this.graph || !this.debugCameraSnapshot().enabled) return;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const button = path.find((entry) => entry instanceof HTMLButtonElement && entry.dataset.debugCameraIntent);
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    const intent = button.dataset.debugCameraIntent ?? "";
    if (!DEBUG_CAMERA_MOVEMENT_INTENTS.includes(intent) || typeof this.graph.renderer.setDebugCameraMovementIntent !== "function") return;
    event.preventDefault(); event.stopPropagation();
    this.releaseDebugCameraPointer(event.pointerId);
    this.debugCameraControlPointers.set(event.pointerId, intent);
    try { button.setPointerCapture(event.pointerId); } catch { /* synthetic events and detached controls cannot capture */ }
    this.graph.renderer.setDebugCameraMovementIntent(intent, true);
    this.debugCameraUiSignature = ""; this.syncDebugCameraControlState();
  }

  /** @param {Event} event */
  handleDebugCameraPointerRelease(event) {
    if (!(event instanceof PointerEvent) || !this.debugCameraControlPointers.has(event.pointerId)) return;
    event.preventDefault(); event.stopPropagation();
    this.releaseDebugCameraPointer(event.pointerId);
  }

  /** @param {number} pointerId */
  releaseDebugCameraPointer(pointerId) {
    const intent = this.debugCameraControlPointers.get(pointerId); if (!intent) return;
    this.debugCameraControlPointers.delete(pointerId);
    if (![...this.debugCameraControlPointers.values()].includes(intent) && typeof this.graph?.renderer.setDebugCameraMovementIntent === "function") this.graph.renderer.setDebugCameraMovementIntent(intent, false);
    this.debugCameraUiSignature = ""; this.syncDebugCameraControlState();
  }

  releaseDebugCameraControls() {
    const intents = new Set(this.debugCameraControlPointers.values()); this.debugCameraControlPointers.clear();
    if (typeof this.graph?.renderer.setDebugCameraMovementIntent === "function") for (const intent of intents) this.graph.renderer.setDebugCameraMovementIntent(intent, false);
    this.debugCameraUiSignature = ""; this.syncDebugCameraControlState();
  }

  toggleDebugCameraSpeed() {
    if (!this.graph || !this.debugCameraSnapshot().enabled || typeof this.graph.renderer.setDebugCameraSpeedMode !== "function") return;
    this.debugCameraSpeedMode = this.debugCameraSpeedMode === "boost" ? "normal" : "boost";
    this.graph.renderer.setDebugCameraSpeedMode(this.debugCameraSpeedMode);
    this.debugCameraUiSignature = ""; this.syncDebugCameraControlState();
  }

  resetDebugCamera() {
    if (!this.graph || !this.debugCameraSnapshot().enabled || typeof this.graph.renderer.resetDebugCamera !== "function") return;
    this.releaseDebugCameraControls(); this.graph.renderer.resetDebugCamera();
    this.publish("session_changed");
  }

  /** @param {number} connectionGeneration @param {number} sessionGeneration @param {ReturnType<typeof createAeroGameServiceGraph>|null} graph */
  isVisualTestTransportCurrent(connectionGeneration, sessionGeneration, graph) {
    return Boolean(graph && this.isSessionCurrent(sessionGeneration, connectionGeneration, graph) && this.sessionStartRequested && this.activeSessionAction === "test" && graph.gameplay.getSnapshot().session.purpose === "visual_test");
  }

  renderPresenters() {
    if (!this.graph) return;
    this.renderInteractionShell(); this.syncCameraPresentation(); this.syncDebugCameraPresentation();
    const content = this.graph.content.getSnapshot();
    const gameplay = this.graph.gameplay.getSnapshot();
    const input = this.graph.input.getSnapshot();
    const session = gameplay.session;
    setPresenter(this, "aero-calibration-badge", input.calibration);
    setPresenter(this, "aero-tracking-pause", { active: false });
    setPresenter(this, "aero-resume-countdown", { active: false });
    const selectorSnapshot = profilePresenterSnapshot(this.graph.profiles.getSnapshot(), content.selectedVariant, session.state);
    setPresenter(this, "aero-prototype-selector[scope='gameplay']", selectorSnapshot);
    setPresenter(this, "aero-prototype-selector[scope='visuals']", selectorSnapshot);
    setPresenter(this, "aero-content-import-progress", this.graph.authoring.getSnapshot());
    setPresenter(this, "aero-content-library", { ...this.libraryView, selectedPackageId: this.libraryView.selectedPackageId, preview: this.previewView });
    setPresenter(this, "aero-beatsaver-browser", { ...this.beatSaverView, preview: this.previewView });
    setPresenter(this, "aero-background-environment", content.background ?? { kind: "css-fallback" });
    setPresenter(this, "aero-fullscreen-button", this.fullscreenSnapshot());
    setPresenter(this, "aero-session-actions", this.sessionActionsSnapshot());
    this.renderVisualTestTransport();
    this.presenterCommitCount += 12;
    this.runtimeUiSignature = ""; this.renderRuntimePresentation();
  }

  renderRuntimePresentation() {
    if (!this.graph) return;
    this.syncCameraPresentation();
    const content = this.graph.content.getSnapshot(); const gameplay = this.graph.gameplay.getSnapshot(); const input = this.graph.input.getSnapshot(); const session = gameplay.session;
    const runtimeMessage = runtimeStatus(content, session, input);
    const cueMessage = transientCue(this.menuOpen, this.sessionStartRequested, session, gameplay, input);
    const action = actionableRuntimeMessage(this.lastError, this.capabilities().limitations);
    const signature = JSON.stringify([runtimeMessage, cueMessage, action, this.musicPrerequisite]);
    if (signature === this.runtimeUiSignature) return;
    this.runtimeUiSignature = signature; this.runtimeUiCommitCount += 1;
    const status = this.shadowRoot?.querySelector("[data-role='status']");
    if (status && status.textContent !== runtimeMessage) status.textContent = runtimeMessage;
    const cue = this.shadowRoot?.querySelector("[data-role='transient-cue']");
    if (cue instanceof HTMLElement) { if (cue.textContent !== cueMessage) cue.textContent = cueMessage; cue.hidden = cueMessage === ""; }
    const infoAction = this.shadowRoot?.querySelector("[data-role='info-action']");
    if (infoAction instanceof HTMLElement) { if (infoAction.textContent !== action) infoAction.textContent = action; infoAction.hidden = action === ""; }
    const prerequisite = this.shadowRoot?.querySelector("[data-role='music-prerequisite']");
    if (prerequisite instanceof HTMLElement) { if (prerequisite.textContent !== this.musicPrerequisite) prerequisite.textContent = this.musicPrerequisite; prerequisite.hidden = this.musicPrerequisite === ""; }
  }

  renderInteractionShell() {
    const button = this.menuButtonElement(); const drawer = this.drawerElement();
    const backdrop = this.shadowRoot?.querySelector("[data-role='menu-backdrop']");
    if (button) { button.setAttribute("aria-expanded", this.menuOpen ? "true" : "false"); button.setAttribute("aria-label", this.menuOpen ? "Close configuration menu" : "Open configuration menu"); button.dataset.menuState = this.menuOpen ? "open" : "closed"; }
    for (const input of this.shadowRoot?.querySelectorAll("input[data-action='environment-select']") ?? []) if (input instanceof HTMLInputElement) input.checked = input.value === this.environmentMode;
    if (drawer) { drawer.hidden = !this.menuOpen; drawer.setAttribute("aria-hidden", this.menuOpen ? "false" : "true"); }
    if (backdrop instanceof HTMLElement) backdrop.hidden = !this.menuOpen;
    for (const presenter of this.shadowRoot?.querySelectorAll("[data-role='drawer'] aero-prototype-selector,[data-role='drawer'] aero-beatsaver-browser,[data-role='drawer'] aero-content-import-progress,[data-role='drawer'] aero-content-library,[data-role='drawer'] aero-capabilities-panel,[data-role='drawer'] aero-error-panel,[data-role='drawer'] aero-fullscreen-button") ?? []) presenter.toggleAttribute("compact", this.menuOpen);
    setPresenter(this, "aero-session-actions", this.sessionActionsSnapshot());
  }

  selectBrowsedMap(mapId) {
    this.stopPreview();
    const map = this.browsedMaps.get(boundedIdentifier(mapId, "BeatSaver map ID").toUpperCase());
    if (!map) throw new Error("Selected BeatSaver map is unavailable");
    const versions = playableVersions(map); const version = versions[0];
    if (!version) throw new Error("Selected BeatSaver map has no playable Standard difficulty");
    const summary = mapSummary(map); const difficulties = standardDifficulties(version);
    this.beatSaverView = Object.freeze({ ...this.beatSaverView, selectedMap: summary, versions: summary.versions, selectedVersionHash: version.hash, difficulties, selectedDifficulty: difficulties[0] });
    this.renderPresenters(); return summary;
  }

  selectBrowsedVersion(versionHash) {
    this.stopPreview();
    const mapId = this.beatSaverView.selectedMap?.mapId; const map = typeof mapId === "string" ? this.browsedMaps.get(mapId.toUpperCase()) : null;
    if (!map) throw new Error("Select a BeatSaver map first");
    const version = playableVersions(map).find((entry) => entry.hash === versionHash);
    if (!version) throw new Error("Selected BeatSaver version has no playable Standard difficulty");
    const difficulties = standardDifficulties(version);
    this.beatSaverView = Object.freeze({ ...this.beatSaverView, selectedVersionHash: version.hash, difficulties, selectedDifficulty: difficulties[0] }); this.renderPresenters();
  }

  async selectLibraryPackage(target, selectionGeneration) {
    this.assertConnected(); const generation = this.connectedGeneration; const graph = this.graph;
    if (selectionGeneration !== this.librarySelectionGeneration) return null;
    const before = graph.content.getSnapshot();
    const retainedRulesetId = rulesetIds.includes(before.selectedVariant?.rulesetId) ? before.selectedVariant.rulesetId : rulesetIds[0];
    const retainedRecipeId = conversionRecipeIds.includes(before.selectedVariant?.recipeId) ? before.selectedVariant.recipeId : this.lastBoxingRecipeId;
    if (conversionRecipeIds.includes(retainedRecipeId)) this.lastBoxingRecipeId = retainedRecipeId;
    const modifierIds = stringList(before.selectedVariant?.modifierIds ?? [], 16);
    let loaded;
    try { loaded = await graph.authoring.loadPackage({ key: target.packageKey, packageId: target.packageId }); }
    catch (error) {
      if (!this.isCurrent(generation, graph) || selectionGeneration !== this.librarySelectionGeneration) return null;
      if (isFlowOrientationReimportError(error)) return this.clearStaleLibrarySelection(selectionGeneration, error);
      throw error;
    }
    if (!this.isCurrent(generation, graph) || selectionGeneration !== this.librarySelectionGeneration) return null;
    try { await this.selectContent({ kind: "persistence", handle: loaded.handle }); }
    catch (error) {
      if (!this.isCurrent(generation, graph) || selectionGeneration !== this.librarySelectionGeneration) return null;
      if (isFlowOrientationReimportError(error)) return this.clearStaleLibrarySelection(selectionGeneration, error);
      throw error;
    }
    if (!this.isCurrent(generation, graph) || selectionGeneration !== this.librarySelectionGeneration) return null;
    const content = graph.content.getSnapshot();
    const equivalent = retainedRulesetId === rulesetIds[0]
      ? content.variants.find((variant) => variant.rulesetId === rulesetIds[0])
      : content.variants.find((variant) => variant.rulesetId === retainedRulesetId && variant.recipeId === retainedRecipeId);
    const fallback = content.variants.find((variant) => variant.rulesetId === rulesetIds[0]) ?? content.variants[0];
    const selected = equivalent ?? fallback;
    if (selected?.variantId && (content.selectedVariant?.variantId !== selected.variantId || modifierIds.length > 0)) await this.selectVariant(selected.variantId, modifierIds);
    if (!this.isCurrent(generation, graph) || selectionGeneration !== this.librarySelectionGeneration) return null;
    if (this.lastError?.code === "flow_orientation_reimport_required") { this.lastError = null; this.renderPresenters(); }
    return Object.freeze({ collectionId: target.collectionId, packageId: target.packageId, generation: selectionGeneration });
  }

  async clearStaleLibrarySelection(selectionGeneration, error) {
    if (selectionGeneration !== this.librarySelectionGeneration) return null;
    const generation = this.connectedGeneration;
    this.librarySelectionGeneration += 1;
    this.desiredLibrarySelection = null;
    this.stopPreview({ render: false });
    this.libraryView = Object.freeze({ ...this.libraryView, selectedCollectionId: null, selectedPackageId: null });
    this.lastError = Object.freeze({ code: "flow_orientation_reimport_required", message: FLOW_REIMPORT_MESSAGE });
    this.emitGameEvent("error", this.lastError);
    await this.refreshLibrary(generation, { autoSelect: false });
    if (this.isCurrent(generation)) this.renderPresenters();
    return null;
  }

  requestLibrarySelection(collectionIdValue, packageIdValue) {
    this.assertConnected(); this.invalidatePendingSessionStart();
    const target = librarySelectionTarget(this.libraryView.collections, collectionIdValue, packageIdValue);
    if (!target) return Promise.reject(new Error("Downloaded difficulty is unavailable"));
    const selectionGeneration = ++this.librarySelectionGeneration;
    this.desiredLibrarySelection = Object.freeze({ collectionId: target.collectionId, packageId: target.packageId, generation: selectionGeneration });
    const activatedCollections = activateLibraryCollection(this.libraryView.collections, target.collectionId, target.packageId);
    this.libraryView = Object.freeze({ ...this.libraryView, selectedCollectionId: target.collectionId, selectedPackageId: target.packageId, collections: activatedCollections, songs: publicLibrarySongs(activatedCollections) });
    this.stopPreview(); this.renderPresenters();
    const selection = this.librarySelectionTail.catch(() => null).then(() => this.selectLibraryPackage(target, selectionGeneration));
    this.librarySelectionTail = selection;
    this.pendingLibrarySelection = selection;
    selection.catch((error) => { if (selectionGeneration === this.librarySelectionGeneration) this.handleError(error); }).finally(() => { if (this.pendingLibrarySelection === selection) { this.pendingLibrarySelection = null; this.renderPresenters(); } });
    return selection;
  }

  async refreshLibrary(generation = this.connectedGeneration, preferences = {}) {
    const graph = this.graph; if (!graph) return;
    const autoSelect = dataValue(preferences, "autoSelect") !== false;
    const collectionsRequest = typeof graph.authoring.listCollections === "function" ? graph.authoring.listCollections() : Promise.resolve(null);
    const [listedPackages, listedCollectionsValue, storage] = await Promise.all([graph.authoring.listPackages(), collectionsRequest, graph.authoring.estimateStorage()]);
    if (!this.isCurrent(generation, graph)) return;
    const packages = productLibraryPackages(listedPackages); const listedCollections = listedCollectionsValue ?? legacyLibraryCollections(packages);
    const requestedPackageId = autoSelect ? boundedString(preferences.preferredPackageId, this.desiredLibrarySelection?.packageId ?? this.libraryView.selectedPackageId ?? "") : "";
    const requestedCollectionId = autoSelect ? boundedString(preferences.preferredCollectionId, this.desiredLibrarySelection?.collectionId ?? this.libraryView.selectedCollectionId ?? "") : "";
    const collections = productLibraryCollections(listedCollections, requestedCollectionId, requestedPackageId);
    const selectedCollection = autoSelect ? collections.find((entry) => entry.collectionId === requestedCollectionId) ?? collections.find((entry) => entry.difficulties.some((difficulty) => difficulty.packageId === requestedPackageId)) ?? collections[0] ?? null : null;
    const selectedPackageId = selectedCollection?.difficulties.some((entry) => entry.packageId === requestedPackageId) ? requestedPackageId : selectedCollection?.activePackageId ?? null;
    this.libraryView = Object.freeze({ packages, collections, songs: publicLibrarySongs(collections), selectedCollectionId: selectedCollection?.collectionId ?? null, selectedPackageId, usedBytes: storage.usageBytes, quotaBytes: storage.quotaBytes, storage }); this.renderPresenters();
    if (!autoSelect || !selectedCollection || !selectedPackageId) return;
    const current = graph.content.getSnapshot();
    if (current.packageId === selectedPackageId) return;
    return this.requestLibrarySelection(selectedCollection.collectionId, selectedPackageId);
  }

  async exportLibraryPackage(target) {
    this.assertConnected(); const generation = this.connectedGeneration; const graph = this.graph;
    const exported = await graph.authoring.exportPackage({ key: target.packageKey, packageId: target.packageId });
    if (!this.isCurrent(generation, graph)) return null;
    const url = URL.createObjectURL(new Blob([exported.bytes], { type: exported.mediaType }));
    try { const anchor = document.createElement("a"); anchor.href = url; anchor.download = exported.fileName; anchor.hidden = true; this.shadowRoot?.append(anchor); anchor.click(); anchor.remove(); }
    finally { URL.revokeObjectURL(url); }
    return Object.freeze({ fileName: exported.fileName, byteLength: exported.byteLength });
  }

  async toggleBeatSaverPreview(mapIdValue, versionHashValue) {
    this.assertConnected();
    const mapId = boundedIdentifier(mapIdValue, "BeatSaver map ID"); const versionHash = boundedIdentifier(versionHashValue, "BeatSaver version hash");
    const target = Object.freeze({ mapId, versionHash, packageId: "" });
    if (activePreview(this.previewView, target)) { this.stopPreview(); return; }
    const selectedMapId = this.beatSaverView.selectedMap?.mapId;
    if (selectedMapId !== mapId || this.beatSaverView.selectedVersionHash !== versionHash) throw new Error("Select this song version before previewing it");
    const map = this.browsedMaps.get(mapId.toUpperCase()); const version = playableVersions(map).find((entry) => entry.hash === versionHash);
    const rawUrl = version?.previewUrl;
    if (typeof rawUrl !== "string" || rawUrl.length > 2048) throw new Error("Preview is unavailable for this song");
    let url; try { url = new URL(rawUrl); } catch { throw new Error("Preview is unavailable for this song"); }
    if (url.protocol !== "https:") throw new Error("Preview is unavailable for this song");
    await this.startPreview(url.href, target, 0);
  }

  async toggleLibraryPreview(packageIdValue) {
    this.assertConnected();
    const packageId = boundedString(packageIdValue, "");
    const collectionId = this.libraryView.selectedCollectionId;
    const selectionTarget = librarySelectionTarget(this.libraryView.collections, collectionId, packageId);
    if (!selectionTarget || this.libraryView.selectedPackageId !== packageId) throw new Error("Select this downloaded song before previewing it");
    const target = Object.freeze({ mapId: "", versionHash: "", packageId });
    if (activePreview(this.previewView, target)) { this.stopPreview(); return; }
    const desired = this.desiredLibrarySelection;
    if (!desired || desired.collectionId !== selectionTarget.collectionId || desired.packageId !== packageId || this.graph.content.getSnapshot().packageId !== packageId) await this.requestLibrarySelection(selectionTarget.collectionId, packageId);
    const exactGeneration = this.librarySelectionGeneration;
    if (this.pendingLibrarySelection) await this.pendingLibrarySelection;
    if (exactGeneration !== this.librarySelectionGeneration || this.desiredLibrarySelection?.packageId !== packageId || this.graph.content.getSnapshot().packageId !== packageId) return;
    this.stopPreview({ render: false });
    const token = this.previewGeneration;
    this.setPreviewView("loading", target, "");
    try {
      const content = this.graph.content.getSnapshot(); const audio = content.song?.audio;
      if (!audio || typeof audio.filePath !== "string") throw new Error("Downloaded song is still loading");
      const bytes = this.graph.content.readAsset(audio.filePath); const mimeType = previewMimeType(audio.filePath);
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      if (token !== this.previewGeneration || exactGeneration !== this.librarySelectionGeneration) { URL.revokeObjectURL(objectUrl); return; }
      this.previewObjectUrl = objectUrl;
      await this.playPreview(objectUrl, target, token, 10_000);
    } catch (error) { if (token === this.previewGeneration) this.failPreview(token, target, error); }
  }

  async startPreview(sourceUrl, target, maximumMs) {
    this.stopPreview({ render: false });
    const token = this.previewGeneration;
    this.setPreviewView("loading", target, "");
    try { await this.playPreview(sourceUrl, target, token, maximumMs); }
    catch (error) { if (token === this.previewGeneration) this.failPreview(token, target, error); }
  }

  async playPreview(sourceUrl, target, token, maximumMs) {
    const audio = this.previewAudioElement();
    const playing = () => { if (token === this.previewGeneration) this.setPreviewView("playing", target, ""); };
    const ended = () => { if (token === this.previewGeneration) this.finishPreview(token, target, "ended"); };
    const failed = () => { if (token === this.previewGeneration) this.failPreview(token, target, new Error("Preview playback failed")); };
    this.previewListeners = Object.freeze({ playing, ended, failed });
    audio.addEventListener("playing", playing); audio.addEventListener("ended", ended); audio.addEventListener("error", failed);
    audio.preload = "auto"; audio.src = sourceUrl; audio.currentTime = 0; audio.load();
    await Promise.resolve(audio.play());
    if (token !== this.previewGeneration) return;
    if (this.previewView.state === "loading") this.setPreviewView("playing", target, "");
    if (maximumMs > 0) this.previewTimer = globalThis.setTimeout(() => { if (token === this.previewGeneration) this.finishPreview(token, target, "ended"); }, maximumMs);
  }

  finishPreview(token, target, state) {
    if (token !== this.previewGeneration) return;
    this.cleanupPreviewMedia();
    this.previewGeneration += 1;
    this.previewView = previewView(state, target, "");
    this.renderPresenters();
  }

  failPreview(token, target, _error) {
    if (token !== this.previewGeneration) return;
    this.cleanupPreviewMedia();
    this.previewGeneration += 1;
    this.previewView = previewView("error", target, "Preview unavailable. Try again.");
    this.renderPresenters();
  }

  stopPreview(options = {}) {
    this.previewGeneration += 1;
    this.cleanupPreviewMedia();
    this.previewView = emptyPreviewView();
    if (options.render !== false && this.lifecycle === "connected") this.renderPresenters();
  }

  cleanupPreviewMedia() {
    if (this.previewTimer) globalThis.clearTimeout(this.previewTimer); this.previewTimer = 0;
    const audio = this.shadowRoot?.querySelector("audio[data-role='preview']");
    if (audio instanceof HTMLAudioElement) {
      const listeners = this.previewListeners;
      if (listeners) { audio.removeEventListener("playing", listeners.playing); audio.removeEventListener("ended", listeners.ended); audio.removeEventListener("error", listeners.failed); }
      try { audio.pause(); } catch { /* best-effort private preview cleanup */ }
      audio.removeAttribute("src");
      try { audio.load(); } catch { /* detached media may reject load */ }
    }
    this.previewListeners = null;
    const objectUrl = this.previewObjectUrl; this.previewObjectUrl = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }

  setPreviewView(state, target, errorMessage) { this.previewView = previewView(state, target, errorMessage); this.renderPresenters(); }
  previewAudioElement() { const value = this.shadowRoot?.querySelector("audio[data-role='preview']"); if (!(value instanceof HTMLAudioElement)) throw new Error("Preview audio surface missing"); return value; }

  async handleLocalZip(event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
    const file = input.files[0]; input.value = "";
    const options = { difficulty: this.beatSaverView.selectedDifficulty || "Expert", sourceId: file.name.replace(/\.zip$/iu, "").slice(0, 256) || "local" };
    try { await this.importLocalZip(file, options); } catch (error) { this.handleError(error); }
  }

  async handleInteractionClick(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const action = path.find((entry) => entry instanceof HTMLElement && entry.dataset?.action)?.dataset?.action;
    if (action === "menu-toggle") this.setMenuOpen(!this.menuOpen);
    else if (action === "menu-close" || action === "menu-backdrop") this.setMenuOpen(false);
    else if (action === "debug-camera-reset") this.resetDebugCamera();
    else if (action === "debug-camera-speed") this.toggleDebugCameraSpeed();
    else if (action === "environment-select") { const input = path.find((entry) => entry instanceof HTMLInputElement && entry.dataset.action === "environment-select"); if (input instanceof HTMLInputElement && input.checked) this.setEnvironmentMode(input.value); }
  }

  handleInteractionKeydown(event) {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "Escape" && this.menuOpen) { event.preventDefault(); this.setMenuOpen(false); return; }
    if (event.key !== "Tab" || !this.menuOpen) return;
    const drawer = this.shadowRoot?.querySelector("[data-role='drawer']"); const menuButton = this.menuButtonElement();
    if (!(drawer instanceof HTMLElement) || !menuButton) return;
    const focusable = [menuButton, ...deepFocusable(drawer)];
    const first = focusable[0]; const last = focusable[focusable.length - 1]; const active = deepActiveElement(this.shadowRoot);
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }

  setMenuOpen(open, options = {}) {
    if (!this.graph || this.menuOpen === open) return;
    const graph = this.graph; const visualTest = graph.gameplay.getSnapshot().session.purpose === "visual_test";
    if (open) {
      this.menuFocusRestore = this.menuButtonElement();
      this.menuOpen = true; this.menuPauseArmed = true;
      const now = Math.max(performance.now(), Number(graph.gameplay.getSnapshot().session.timestampMs ?? 0));
      if (!visualTest) graph.input.resetCalibration("menu_open");
      try { graph.gameplay.pause(now, "configuration_menu"); this.synchronizePausedClock(graph); } catch { /* unconfigured */ }
      void Promise.allSettled([graph.audio.pause(), graph.cv.stop()]).then(() => { if (this.graph !== graph) return; try { this.synchronizePausedClock(graph); } catch { /* unconfigured */ } });
    } else {
      this.stopPreview();
      this.menuOpen = false; this.menuPauseArmed = true;
      if (options.freshSession !== true) {
        if (visualTest) { if (graph.gameplay.getSnapshot().session.state === "paused_manual") void this.resumeVisualTestFromMenu(graph); }
        else { graph.input.resetCalibration("menu_closed_recalibration_required"); void this.startCv().catch((error) => this.handleError(error)); }
      }
    }
    this.renderPresenters(); this.publish("session_changed");
    queueMicrotask(() => requestAnimationFrame(() => {
      if (!this.isConnected) return;
      if (this.menuOpen) this.menuButtonElement()?.focus();
      else (this.menuFocusRestore?.isConnected ? this.menuFocusRestore : this.menuButtonElement())?.focus();
    }));
  }

  async resumeVisualTestFromMenu(graph) {
    const generation = this.connectedGeneration;
    try {
      graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
      graph.gameplay.resume(Math.max(performance.now(), Number(graph.gameplay.getSnapshot().session.timestampMs ?? 0)));
      if (!this.isCurrent(generation, graph) || this.menuOpen) return;
      this.syncAudioForGameplay(); this.startFrameLoop(); this.syncContentPlayback(); this.publish("session_changed");
    } catch (error) { if (this.isCurrent(generation, graph)) this.handleError(error); }
  }

  async startFromMenu(purpose) {
    if (!this.graph || this.menuStarting) return;
    const graph = this.graph; const generation = this.connectedGeneration;
    try {
      if (this.pendingLibrarySelection) await this.pendingLibrarySelection;
      if (!this.isCurrent(generation, graph)) return;
      if (!this.downloadedPlayable()) {
        this.musicPrerequisite = "Download Music first.";
        this.menuOpen = true; this.renderPresenters(); this.focusMusicSection();
        return;
      }
      await this.startSession(purpose, { requireDownloaded: true });
      const expectedAction = purpose === "visual_test" ? "test" : "start";
      if (!this.isCurrent(generation, graph) || !this.sessionStartRequested || this.activeSessionAction !== expectedAction) return;
      this.menuPauseArmed = true;
      this.setMenuOpen(false, { freshSession: true });
    } catch (error) { if (this.isCurrent(generation, graph)) { this.handleError(error); this.menuOpen = true; this.renderPresenters(); } }
  }

  async ensurePlayableMusicSelection() {
    if (!this.graph) return false;
    let content = this.graph.content.getSnapshot();
    if (playableContent(content)) { this.configureGameplayFromContent(false); return true; }
    const firstVariant = content.state === "ready" && content.packageId ? content.variants?.[0] : null;
    if (firstVariant?.variantId) {
      await this.selectVariant(firstVariant.variantId);
      content = this.graph?.content.getSnapshot();
      if (playableContent(content)) { this.configureGameplayFromContent(false); return true; }
    }
    return false;
  }

  downloadedPlayable() {
    if (!this.graph || this.pendingLibrarySelection) return false;
    const packageId = this.libraryView.selectedPackageId;
    const target = librarySelectionTarget(this.libraryView.collections, this.libraryView.selectedCollectionId, packageId);
    return Boolean(target && packageId && this.graph.content.getSnapshot().packageId === packageId && playableContent(this.graph.content.getSnapshot()));
  }

  sessionActionsSnapshot() { return Object.freeze({ downloadedPlayable: this.downloadedPlayable(), activeAction: this.activeSessionAction, pendingAction: this.pendingSessionAction }); }
  invalidatePendingSessionStart() { if (!this.pendingSessionAction && !this.menuStarting) return false; this.sessionGeneration += 1; this.sessionStartRequested = false; this.activeSessionAction = ""; this.pendingSessionAction = ""; this.menuStarting = false; this.stopFrameLoop(); this.renderPresenters(); return true; }
  isSessionCurrent(sessionGeneration, connectionGeneration, graph) { return this.sessionGeneration === sessionGeneration && this.isCurrent(connectionGeneration, graph); }

  focusMusicSection() {
    queueMicrotask(() => requestAnimationFrame(() => {
      const section = this.shadowRoot?.querySelector("[data-section='music']");
      if (section instanceof HTMLElement) section.focus();
    }));
  }

  drawerElement() { const value = this.shadowRoot?.querySelector("[data-role='drawer']"); return value instanceof HTMLElement ? value : null; }
  menuButtonElement() { const value = this.shadowRoot?.querySelector("[data-role='menu-button']"); return value instanceof HTMLButtonElement ? value : null; }

  handleUiIntent(event) {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!detail || typeof detail.type !== "string") return;
    if (detail.type === "session-start") void this.startFromMenu("play");
    else if (detail.type === "session-test") void this.startFromMenu("visual_test");
    else if (detail.type === "visual-test-music-volume" || detail.type === "visual-test-sound-volume") {
      const volume = readVisualTestVolumeIntent(detail.payload); if (volume === null) return;
      const current = getAudioMixSnapshot();
      setAudioMixSnapshot(detail.type === "visual-test-music-volume" ? { musicVolume:volume, sfxVolume:current.sfxVolume } : { musicVolume:current.musicVolume, sfxVolume:volume });
    }
    else if (detail.type === "fullscreen-request") void this.enterFullscreen().catch((error) => this.handleError(error));
    else if (detail.type === "fullscreen-exit") void this.exitFullscreen().catch((error) => this.handleError(error));
    else if (detail.type === "beatsaver-search") void this.browseBeatSaver({ text: dataValue(detail.payload, "query") ?? "" }).catch((error) => this.handleError(error));
    else if (detail.type === "beatsaver-latest") void this.browseLatestBeatSaver().catch((error) => this.handleError(error));
    else if (detail.type === "beatsaver-select-map") { try { this.selectBrowsedMap(dataValue(detail.payload, "mapId")); } catch (error) { this.handleError(error); } }
    else if (detail.type === "beatsaver-version-select") { try { this.selectBrowsedVersion(dataValue(detail.payload, "versionHash")); } catch (error) { this.handleError(error); } }
    else if (detail.type === "beatsaver-difficulty-select") { const difficulty = dataValue(detail.payload, "difficultyId"); if (typeof difficulty === "string" && this.beatSaverView.difficulties.includes(difficulty)) { this.stopPreview(); this.beatSaverView = Object.freeze({ ...this.beatSaverView, selectedDifficulty: difficulty }); this.renderPresenters(); } }
    else if (detail.type === "beatsaver-preview-toggle") void this.toggleBeatSaverPreview(dataValue(detail.payload, "mapId"), dataValue(detail.payload, "versionHash")).catch((error) => this.handleError(error));
    else if (detail.type === "beatsaver-import") void this.importBeatSaverById(dataValue(detail.payload, "mapId"), dataValue(detail.payload, "versionHash"), { difficulty: dataValue(detail.payload, "difficultyId"), sourceId: dataValue(detail.payload, "mapId") }).catch((error) => this.handleError(error));
    else if (detail.type === "local-zip-request") { this.stopPreview(); this.localZipInput().click(); }
    else if (detail.type === "content-import-cancel") this.cancelImport();
    else if (detail.type === "library-select") { const collectionId = dataValue(detail.payload, "collectionId"); const collection = this.libraryView.collections.find((entry) => entry.collectionId === collectionId); if (collection) void this.requestLibrarySelection(collection.collectionId, collection.activePackageId); }
    else if (detail.type === "library-difficulty-select") { const collectionId = dataValue(detail.payload, "collectionId"); const packageId = dataValue(detail.payload, "packageId"); void this.requestLibrarySelection(collectionId, packageId); }
    else if (detail.type === "library-preview-toggle") void this.toggleLibraryPreview(dataValue(detail.payload, "packageId")).catch((error) => this.handleError(error));
    else if (detail.type === "library-export") { const target = libraryPackageTarget(this.libraryView.collections, dataValue(detail.payload, "packageId")); if (target) void this.exportLibraryPackage(target).catch((error) => this.handleError(error)); }
    else if (detail.type === "library-delete") void this.deleteLibraryCollection(dataValue(detail.payload, "collectionId")).catch((error) => this.handleError(error));
    else if (detail.type === "gameplay-mode-select") {
      try { const rulesetId = readGameplayRulesetIntent(detail.payload); void this.selectGameplayAxes(rulesetId).catch((error) => this.handleError(error)); }
      catch (error) { this.handleError(error); }
    }
    else if (detail.type === "boxing-conversion-select") {
      try {
        const recipeId = readBoxingRecipeIntent(detail.payload); this.lastBoxingRecipeId = recipeId;
        const selectedRuleset = this.graph.content.getSnapshot().selectedVariant?.rulesetId;
        if (selectedRuleset !== rulesetIds[0] && rulesetIds.includes(selectedRuleset)) void this.selectGameplayAxes(selectedRuleset, recipeId).catch((error) => this.handleError(error));
      } catch (error) { this.handleError(error); }
    }
    else if (detail.type === "prototype-profile-select") { try { this.selectProfileFromIntent(detail.payload); } catch (error) { this.handleError(error); } }
    else if (detail.type === "tuning-import-request") this.emitGameEvent("profile_bundle_import_requested", {});
    else if (detail.type === "tuning-export") { try { const bundle = this.exportPrototypeProfiles(); this.emitGameEvent("profile_bundle_exported", { bundleVersion: bundle.bundleVersion, bundleHash: bundle.bundleHash, profileCount: bundle.profiles.length }); } catch (error) { this.handleError(error); } }
    else if (detail.type === "tuning-reset") { try { this.resetPrototypeProfiles(); } catch (error) { this.handleError(error); } }
    else if (detail.type === "visual-test-pause") this.enqueueVisualTestPause();
    else if (detail.type === "visual-test-play") this.enqueueVisualTestPlay();
    else if (detail.type === "visual-test-seek") this.enqueueVisualTestSeek(dataValue(detail.payload, "milliseconds"));
    else if (detail.type === "calibration-reset") this.reset();
  }

  selectProfileFromIntent(payload) {
    const profileId = dataValue(payload, "profileId"); const profileVersion = dataValue(payload, "profileVersion"); const contentHash = dataValue(payload, "contentHash"); const profileClass = dataValue(payload, "profileClass");
    if (![profileId, profileVersion, contentHash, profileClass].every((value) => typeof value === "string")) throw new TypeError("Profile selection intent is invalid");
    const profile = this.graph.profiles.getSnapshot().profiles.find((entry) => entry.profileId === profileId);
    if (!profile || profile.profileVersion !== profileVersion || profile.contentHash !== contentHash || profile.class !== profileClass) throw new TypeError("Profile selection intent does not match the host registry");
    return this.selectPrototypeProfile(profileId);
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
    if (type === "profiles_changed") return snapshot.services?.profiles ?? null;
    if (type === "fullscreen_changed") return snapshot.fullscreen;
    return snapshot;
  }

  handleError(error) {
    this.lastError = Object.freeze({ code: errorCode(error, "assembly_error"), message: errorMessage(error) });
    if (this.lifecycle === "connected") this.emitGameEvent("error", this.lastError);
    this.renderPresenters();
  }

  leaseSnapshotForGameplay() { return aeroGameMediaLeaseCoordinator.snapshot(); }

  cadenceSnapshot() {
    const elapsedMs = this.displayFrameCount > 1 && this.cadenceLatestFrameAtMs > this.cadenceStartedAtMs ? this.cadenceLatestFrameAtMs - this.cadenceStartedAtMs : 0;
    const displayRateFps = elapsedMs > 0 ? Math.round(((this.displayFrameCount - 1) * 10000) / elapsedMs) / 10 : null;
    return Object.freeze({ schema: "aerobeat/runtime_cadence", version: 1, active: this.frameTimer !== 0, displayFrameCount: this.displayFrameCount, displayRateFps, freshPoseConsumptionCount: this.freshPoseConsumptionCount, inputAdvanceCount: this.inputAdvanceCount, presenterCommitCount: this.presenterCommitCount, runtimeUiCommitCount: this.runtimeUiCommitCount });
  }

  capabilities() {
    const playcanvas = Boolean(this.graph?.renderer.getCapabilities().playcanvas);
    const camera = Boolean(navigator.mediaDevices?.getUserMedia);
    const fullscreen = typeof this.requestFullscreen === "function";
    const limitations = [];
    if (!camera) limitations.push("camera_unavailable"); if (!fullscreen) limitations.push("fullscreen_unavailable"); if (!playcanvas) limitations.push("playcanvas_unavailable");
    return Object.freeze({ schema: "aerobeat/game_capabilities", version: 1, secureContext: globalThis.isSecureContext, camera, fullscreen, autoplay: true, playcanvas, indexedDb: typeof indexedDB !== "undefined", worker: typeof Worker !== "undefined", directBeatSaverCors: true, localZipImport: typeof Blob !== "undefined", limitations: Object.freeze(limitations) });
  }

  fullscreenSnapshot() { return Object.freeze({ schema: "aerobeat/fullscreen_snapshot", version: 1, supported: typeof this.requestFullscreen === "function", active: document.fullscreenElement === this, requestPending: this.fullscreenPending, errorCode: this.fullscreenError }); }

  teardown(finalState) {
    if (this.lifecycle !== "connected") { this.lifecycle = finalState; return; }
    this.stopPreview({ render: false });
    this.connectedGeneration += 1; this.visibilityGeneration += 1; this.sessionGeneration += 1; this.desiredTransportSeekMs = null; this.transportSeekQueued = false; this.transportIntentTail = Promise.resolve(); this.iconAtlasGeneration += 1; this.iconAtlasAbort?.abort(); this.iconAtlasAbort = null; this.lifecycle = finalState; this.activeAbort.abort(); this.stopFrameLoop();
    this.resizeObserver?.disconnect(); this.resizeObserver = null;
    document.removeEventListener("visibilitychange", this.boundVisibility); document.removeEventListener("fullscreenchange", this.boundFullscreen); globalThis.removeEventListener("resize", this.boundFullscreen);
    this.shadowRoot?.removeEventListener(aeroUiIntentEventName, this.boundUiIntent); this.shadowRoot?.removeEventListener("click", this.boundInteractionClick); this.shadowRoot?.removeEventListener("keydown", this.boundInteractionKeydown); this.shadowRoot?.removeEventListener("pointerdown", this.boundDebugCameraPointerDown); for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.shadowRoot?.removeEventListener(type, this.boundDebugCameraPointerRelease); this.shadowRoot?.removeEventListener("pointerleave", this.boundDebugCameraPointerRelease, true); this.localZipInput().removeEventListener("change", this.boundLocalZip);
    this.releaseDebugCameraControls();
    for (const stop of this.unsubscribe.splice(0)) { try { stop(); } catch { /* isolated */ } }
    if (finalState === "destroyed") this.emitGameEvent("destroyed", { instanceId: this.instanceId });
    this.bridge?.destroy(); this.bridge = null;
    this.unregisterLease?.(); this.unregisterLease = null;
    const graph = this.graph; this.graph = null;
    if (graph) {
      try { graph.content.destroy(); } catch { /* idempotent */ } try { graph.authoring.destroy(); } catch { /* idempotent */ }
      try { graph.input.destroy(); } catch { /* idempotent */ } try { graph.profiles.destroy(); } catch { /* idempotent */ } try { graph.gameplay.destroy(); } catch { /* idempotent */ }
      try { graph.renderer.setDebugCameraEnabled(false); } catch { /* idempotent */ } try { graph.renderer.destroy(); } catch { /* idempotent */ } try { graph.video.destroy(); } catch { /* idempotent */ }
      void graph.cv.dispose().catch(() => {}); void graph.audio.destroy().catch(() => {});
    }
    this.activeCvSource = null; this.lastCameraIdentity = ""; this.leaseParticipant = null; this.cameraCompositeMode = null; this.videoElement().dataset.previewVisible = "false";
  }

  assertConnected() { if (this.lifecycle !== "connected" || !this.graph) throw new Error("aero-game is not connected"); }
  isCurrent(generation, graph = this.graph) { return this.lifecycle === "connected" && this.graph === graph && this.connectedGeneration === generation; }
  canvasElement() { const value = this.shadowRoot?.querySelector("canvas[data-role='renderer']"); if (!(value instanceof HTMLCanvasElement)) throw new Error("Renderer surface missing"); return value; }
  videoElement() { const value = this.shadowRoot?.querySelector("video[data-role='media']"); if (!(value instanceof HTMLVideoElement)) throw new Error("Media surface missing"); return value; }
  localZipInput() { return this.localZipPicker; }
}

/** Define the public root without an aerobeat-app alias. */
export function defineAeroGame() { if (!customElements.get(elementNames.game)) customElements.define(elementNames.game, AeroGame); }
defineAeroGame();

function template() { return `<style>
:host{box-sizing:border-box;display:block;inline-size:100%;block-size:100%;min-inline-size:0;min-block-size:0;overflow:hidden;contain:layout paint style;color:var(--aero-color-ink,#eaf9ff);background:#06141f;font-family:var(--aero-font-family,system-ui,sans-serif)}
*,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}.game{position:relative;inline-size:100%;block-size:100%;overflow:hidden}.environment,.media,.renderer{position:absolute;inset:0;inline-size:100%;block-size:100%}.environment{z-index:0}.media{z-index:1;object-fit:cover;transform:scaleX(-1);opacity:0;visibility:hidden}.media[data-preview-visible="true"]{opacity:1;visibility:visible}.renderer{z-index:2}.hud{position:absolute;z-index:10;inset:0;pointer-events:none}.hud>*{pointer-events:auto}.status{position:absolute;z-index:24;inset-inline-start:max(8px,env(safe-area-inset-left));inset-block-end:max(8px,env(safe-area-inset-bottom));max-inline-size:calc(100% - 72px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(0,0,0,.72);border-radius:999px;padding:7px 11px;font:700 12px system-ui}.menu-button{min-inline-size:44px;min-block-size:44px;border:1px solid rgba(255,255,255,.34);border-radius:12px;background:rgba(3,19,31,.92);color:inherit;font:700 16px system-ui;touch-action:manipulation}.start-action{display:block}.menu-button{position:absolute;z-index:60;inset-inline-end:max(8px,env(safe-area-inset-right));inset-block-start:max(8px,env(safe-area-inset-top));inline-size:48px;block-size:48px;background:#03131f;color:#fff;font-size:0}.menu-icon{display:block;inline-size:24px;block-size:20px;position:absolute;inset:0;margin:auto}.menu-icon::before,.menu-icon::after,.menu-icon-line{background:#fff;border-radius:999px;content:"";display:block;inline-size:24px;block-size:4px;position:absolute;inset-inline-start:0;transform-origin:center}.menu-icon::before{inset-block-start:0}.menu-icon-line{inset-block-start:8px}.menu-icon::after{inset-block-start:16px}.menu-button[data-menu-state="open"] .menu-icon::before{inset-block-start:8px;transform:rotate(45deg)}.menu-button[data-menu-state="open"] .menu-icon::after{inset-block-start:8px;transform:rotate(-45deg)}.menu-button[data-menu-state="open"] .menu-icon-line{opacity:0}.backdrop{position:absolute;z-index:30;inset:0;border:0;background:rgba(0,8,15,.58)}.drawer{position:absolute;z-index:50;inset-block:0;inset-inline-end:0;inline-size:min(420px,calc(100% - 24px));overflow:auto;overscroll-behavior:contain;background:transparent;padding:max(68px,calc(env(safe-area-inset-top) + 60px)) max(12px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) 12px}.drawer-surface{--aero-color-ink:#08202c;--aero-color-focus:#00677f;background:#f3f8fa;border:1px solid #9bb8c5;border-radius:16px;box-shadow:-12px 0 32px rgba(0,0,0,.42);color:#08202c;display:grid;gap:10px;padding:14px}.start-action{inline-size:100%;margin:0;background:#00566b;border-color:#00566b;color:#fff}.drawer-content{display:grid;gap:8px}.drawer-content>*{min-inline-size:0}@media(min-width:800px){.drawer{inline-size:min(400px,42%)}.menu-button{inset-inline-end:12px;inset-block-start:12px}}
.drawer-section{display:grid;gap:8px;border-block-start:1px solid rgba(8,32,44,.22);padding-block-start:12px}.drawer-section:first-child{border-block-start:0;padding-block-start:0}.drawer-section>h2{margin:0;font:800 18px system-ui}.environment-choice{border:0;display:grid;gap:4px;margin:0;min-inline-size:0;padding:0}.environment-choice legend{font:700 13px system-ui;padding:0}.environment-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.environment-option{align-items:center;border:1px solid rgba(8,32,44,.28);border-radius:10px;display:flex;font:700 14px system-ui;gap:8px;min-block-size:42px;padding:6px 9px}.environment-option:has(input:checked){background:#d5f3fb;border-color:#00677f}.environment-option input{accent-color:#00677f;block-size:20px;inline-size:20px;margin:0}.drawer-section:focus{outline:2px solid var(--aero-color-focus,#72dcff);outline-offset:3px}.drawer-action{margin:0;padding:9px 11px;border-radius:10px;background:#fff0cf;color:#4a3000;font-weight:700}.hud-presenter{display:none!important}.transient-cue{position:absolute;z-index:25;inset-inline:0;inset-block-start:18%;margin:auto;inline-size:max-content;max-inline-size:calc(100% - 32px);background:#03131f;border:1px solid rgba(255,255,255,.34);border-radius:12px;color:#fff;font:900 clamp(24px,8vw,52px)/1 system-ui;padding:8px 10px;text-align:center;text-shadow:0 2px 8px #000}.status{position:absolute!important;block-size:1px!important;inline-size:1px!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;overflow:hidden!important;white-space:nowrap!important;margin:-1px!important;padding:0!important;border:0!important;background:transparent!important}.debug-camera-controls{position:absolute;z-index:26;inset-inline-start:max(8px,env(safe-area-inset-left));inset-block-start:max(8px,env(safe-area-inset-top));inline-size:220px;max-inline-size:calc(100% - max(72px,calc(env(safe-area-inset-right) + 64px)));display:grid;gap:4px;border:1px solid rgba(255,255,255,.34);border-radius:12px;background:rgba(3,19,31,.88);padding:6px;color:#fff;pointer-events:auto}.debug-camera-grid{display:grid;grid-template-columns:repeat(4,minmax(44px,1fr));gap:4px}.debug-camera-grid button{display:grid;place-items:center;min-inline-size:44px;min-block-size:44px;border:1px solid rgba(255,255,255,.34);border-radius:9px;background:#0d2a3b;color:#fff;font:900 16px/1 system-ui;touch-action:none;user-select:none;-webkit-user-select:none}.debug-camera-grid button:focus-visible{outline:3px solid var(--aero-color-focus,#72dcff);outline-offset:1px}.debug-camera-grid button[aria-pressed="true"],.debug-camera-grid button[data-active="true"]{background:#08728a;border-color:#9ff1ff}.debug-camera-grid button:disabled{opacity:.46}.debug-camera-controls output{display:block;min-block-size:20px;text-align:center;color:#d9f8ff;font:800 12px/20px system-ui;white-space:nowrap}.debug-camera-controls[data-capture-mode="pointer"] output,.debug-camera-controls[data-capture-mode="fallback"] output,.debug-camera-controls[data-capture-mode="touch"] output{color:#9ff1ff}@media(max-height:300px){.debug-camera-controls{padding:4px}.debug-camera-grid{gap:2px}.debug-camera-grid button{min-block-size:44px}}
</style><div class="game"><aero-background-environment class="environment"></aero-background-environment><video data-role="media" class="media"></video><audio data-role="preview" preload="none" hidden></audio><canvas data-role="renderer" class="renderer"></canvas><div class="hud"><aero-calibration-badge class="hud-presenter" aria-hidden="true"></aero-calibration-badge><aero-tracking-pause class="hud-presenter" aria-hidden="true"></aero-tracking-pause><aero-resume-countdown class="hud-presenter" aria-hidden="true"></aero-resume-countdown><div data-role="transient-cue" class="transient-cue" role="status" aria-live="polite" hidden></div></div><aero-visual-test-transport data-role="visual-test-transport"></aero-visual-test-transport><aside data-role="debug-camera-controls" class="debug-camera-controls" role="group" aria-label="Visual Test camera controls" aria-describedby="debug-camera-state" aria-hidden="true" hidden><div class="debug-camera-grid" role="group" aria-label="Camera movement"><button data-action="debug-camera-move" data-debug-camera-intent="forward" type="button" aria-label="Move camera forward" aria-keyshortcuts="W" aria-pressed="false"><span aria-hidden="true">F</span></button><button data-action="debug-camera-move" data-debug-camera-intent="back" type="button" aria-label="Move camera back" aria-keyshortcuts="S" aria-pressed="false"><span aria-hidden="true">B</span></button><button data-action="debug-camera-move" data-debug-camera-intent="up" type="button" aria-label="Move camera up" aria-keyshortcuts="E" aria-pressed="false"><span aria-hidden="true">U</span></button><button data-action="debug-camera-speed" type="button" aria-label="Camera movement speed Normal. Activate Boost." aria-pressed="false"><span data-role="debug-camera-speed-symbol" aria-hidden="true">N</span></button><button data-action="debug-camera-move" data-debug-camera-intent="left" type="button" aria-label="Move camera left" aria-keyshortcuts="A" aria-pressed="false"><span aria-hidden="true">L</span></button><button data-action="debug-camera-move" data-debug-camera-intent="right" type="button" aria-label="Move camera right" aria-keyshortcuts="D" aria-pressed="false"><span aria-hidden="true">R</span></button><button data-action="debug-camera-move" data-debug-camera-intent="down" type="button" aria-label="Move camera down" aria-keyshortcuts="Q" aria-pressed="false"><span aria-hidden="true">D</span></button><button data-action="debug-camera-reset" type="button" aria-label="Reset camera"><span aria-hidden="true">↺</span></button></div><output id="debug-camera-state" data-role="debug-camera-state" aria-live="polite" aria-label="Camera look not captured; movement speed Normal; 0 active movement intents.">○ · Normal</output></aside><span data-role="status" class="status" aria-live="polite">Connecting…</span><button data-role="menu-button" data-action="menu-toggle" data-menu-state="closed" class="menu-button" type="button" aria-label="Open configuration menu" aria-controls="aero-game-drawer" aria-expanded="false"><span class="menu-icon" aria-hidden="true"><span class="menu-icon-line"></span></span></button><button data-role="menu-backdrop" data-action="menu-backdrop" class="backdrop" type="button" aria-label="Close configuration menu" hidden></button><section id="aero-game-drawer" data-role="drawer" class="drawer" role="dialog" aria-modal="true" aria-label="Game configuration" tabindex="-1" hidden><div data-role="drawer-surface" class="drawer-surface"><aero-session-actions class="start-action"></aero-session-actions><div class="drawer-content"><section class="drawer-section" data-section="gameplay" aria-labelledby="drawer-gameplay-heading"><h2 id="drawer-gameplay-heading">Gameplay</h2><aero-prototype-selector compact scope="gameplay"></aero-prototype-selector></section><section class="drawer-section" data-section="visuals" aria-labelledby="drawer-visuals-heading"><h2 id="drawer-visuals-heading">Visuals</h2><aero-prototype-selector compact scope="visuals"></aero-prototype-selector><fieldset class="environment-choice"><legend>Environment</legend><div class="environment-options" role="radiogroup" aria-label="Environment"><label class="environment-option"><input data-action="environment-select" type="radio" name="environment" value="aero" checked> <span>Aero</span></label><label class="environment-option"><input data-action="environment-select" type="radio" name="environment" value="camera"> <span>Camera</span></label></div></fieldset></section><section class="drawer-section" data-section="music" aria-labelledby="drawer-music-heading" tabindex="-1"><h2 id="drawer-music-heading">Music</h2><p data-role="music-prerequisite" class="drawer-action" role="alert" hidden></p><aero-beatsaver-browser compact></aero-beatsaver-browser><aero-content-import-progress compact></aero-content-import-progress><aero-content-library compact></aero-content-library></section><section class="drawer-section" data-section="info" aria-labelledby="drawer-info-heading"><h2 id="drawer-info-heading">Info</h2><p data-role="info-action" class="drawer-action" role="alert" hidden></p><aero-fullscreen-button compact></aero-fullscreen-button></section></div></div></section></div>`; }

/** @param {AeroGame} host @param {string} selector @param {unknown} snapshot */
function setPresenter(host, selector, snapshot) { const element = host.shadowRoot?.querySelector(selector); if (element && typeof element.setSnapshot === "function") element.setSnapshot(snapshot && typeof snapshot === "object" ? snapshot : {}); }
function containerSnapshot(widthCssPx, heightCssPx, devicePixelRatio, visible, fullscreen) { return Object.freeze({ schema: "aerobeat/container_snapshot", version: 1, widthCssPx, heightCssPx, devicePixelRatio, visible, fullscreen }); }
function referrerOrigin() { try { return document.referrer ? new URL(document.referrer).origin : ""; } catch { return ""; } }
function dataValue(record, key) { if (!record || typeof record !== "object") return undefined; const descriptor = Object.getOwnPropertyDescriptor(record, key); return descriptor && "value" in descriptor && descriptor.enumerable ? descriptor.value : undefined; }
function readVisualTestVolumeIntent(value) { if (!value || typeof value !== "object" || Array.isArray(value)) return null; const prototype = Object.getPrototypeOf(value); if (prototype !== Object.prototype && prototype !== null) return null; const keys = Reflect.ownKeys(value); if (keys.length !== 1 || keys[0] !== "volume") return null; const descriptor = Object.getOwnPropertyDescriptor(value, "volume"); if (!descriptor || !descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "number" || !Number.isFinite(descriptor.value) || descriptor.value < 0 || descriptor.value > 1) return null; return snapVisualTestVolume(descriptor.value); }
function contentSource(value) { if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("Content source must be a plain record"); const keys = Reflect.ownKeys(value); if (keys.some((key) => typeof key !== "string" || !["kind", "package", "url", "handle"].includes(key))) throw new TypeError("Content source contains unknown fields"); const kind = dataValue(value, "kind"); if (kind === "direct") return Object.freeze({ kind, package: dataValue(value, "package") }); if (kind === "external") return Object.freeze({ kind, url: boundedString(dataValue(value, "url"), "") }); if (kind === "persistence") return Object.freeze({ kind, handle: safeData(dataValue(value, "handle"), 0, 32) }); throw new TypeError("Unsupported content source kind"); }
function boundedString(value, fallback) { return typeof value === "string" && value.length > 0 && value.length <= 1024 ? value : fallback; }
function boundedIdentifier(value, label) { if (typeof value !== "string" || !/^[0-9a-zA-Z_-]{1,256}$/u.test(value)) throw new TypeError(`${label} is invalid`); return value; }
function boundedProfileIdentifier(value) { if (typeof value !== "string" || value.length < 1 || value.length > 256) throw new TypeError("Prototype profile ID is invalid"); return value; }
function stringList(value, maximum) { if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) throw new TypeError("Expected bounded string array"); const keys = Reflect.ownKeys(value); if (keys.length !== value.length + 1 || keys.some((key) => key !== "length" && (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw new TypeError("String arrays cannot contain extra fields"); return Object.freeze(Array.from({ length: value.length }, (_, index) => { const descriptor = Object.getOwnPropertyDescriptor(value, String(index)); if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || typeof descriptor.value !== "string" || descriptor.value.length > 256) throw new TypeError("Invalid string entry"); return descriptor.value; })); }
function errorCode(error, fallback) { const code = ownDataValue(error, "code"); return typeof code === "string" && code.length <= 128 ? code : fallback; }
function errorMessage(error) { const message = ownDataValue(error, "message"); return typeof message === "string" ? message.slice(0, 2048) : "AeroBeat operation failed"; }
function ownDataValue(record, key) { if (!record || typeof record !== "object") return undefined; const descriptor = Object.getOwnPropertyDescriptor(record, key); return descriptor && "value" in descriptor ? descriptor.value : undefined; }
function contentTelemetry(snapshot) { const result = {}; for (const key of Object.keys(snapshot)) if (key !== "resolvedEvents") result[key] = snapshot[key]; result.resolvedEventCount = Array.isArray(snapshot.resolvedEvents) ? snapshot.resolvedEvents.length : 0; return Object.freeze(result); }
function gameplayTelemetry(snapshot) { return Object.freeze({ schema: snapshot.schema, version: snapshot.version, serviceId: snapshot.serviceId, generation: snapshot.generation, session: snapshot.session, countdown: snapshot.countdown, safety: snapshot.safety, lease: snapshot.lease, selectedVariant: snapshot.selectedVariant, profileIdentity: snapshot.profileIdentity, activeEventIds: snapshot.activeEventIds.slice(0, 128), judgedEventCount: snapshot.judgedEventIds.length, latestJudgement: snapshot.judgements.at(-1) ?? null, latestShadowJudgement: snapshot.shadowJudgements.at(-1) ?? null, scorePartitions: snapshot.scorePartitions, error: snapshot.error }); }
function emptyBeatSaverView() { return Object.freeze({ state: "idle", query: "", results: Object.freeze([]), selectedMap: null, versions: Object.freeze([]), difficulties: Object.freeze([]), selectedVersionHash: "", selectedDifficulty: "", errorMessage: "" }); }
function emptyPreviewView() { return previewView("idle", { mapId: "", versionHash: "", packageId: "" }, ""); }
function previewView(state, target, errorMessage) { const safeState = ["idle", "loading", "playing", "ended", "error"].includes(state) ? state : "idle"; return Object.freeze({ state: safeState, mapId: boundedString(target?.mapId, "").slice(0, 256), versionHash: boundedString(target?.versionHash, "").slice(0, 256), packageId: boundedString(target?.packageId, "").slice(0, 1024), errorMessage: boundedString(errorMessage, "").slice(0, 256) }); }
function activePreview(view, target) { return (view.state === "loading" || view.state === "playing") && view.mapId === target.mapId && view.versionHash === target.versionHash && view.packageId === target.packageId; }
function previewMimeType(path) { const extension = String(path).split(".").at(-1)?.toLowerCase() ?? ""; return Object.freeze({ egg: "audio/ogg", ogg: "audio/ogg", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", webm: "audio/webm" })[extension] ?? "application/octet-stream"; }
function playableContent(content) { return content?.state === "ready" && typeof content.packageId === "string" && content.packageId.length > 0 && typeof content.selectedVariant?.variantId === "string" && content.selectedVariant.variantId.length > 0; }
function runtimeStatus(content, session, input) {
  if (!playableContent(content)) return "Choose a song in Music.";
  if (session.state === "playing") return session.purpose === "visual_test" ? "Visual Test in progress." : "Workout in progress.";
  if (session.state === "countdown") return "Get ready.";
  if (session.state === "paused_tracking") return "Recalibrate to continue.";
  if (input.calibration?.state === "holding") return "Hold the T-pose.";
  if (session.state === "calibrating") return "T-pose calibration ready.";
  return "Ready to calibrate.";
}
function transientCue(menuOpen, sessionStartRequested, session, gameplay, input) {
  if (menuOpen || !sessionStartRequested || session.purpose === "visual_test") return "";
  if (session.state === "paused_tracking") return "Tracking lost";
  if (Number.isFinite(gameplay.countdown?.value)) return String(gameplay.countdown.value);
  if (input.calibration?.state === "cooldown") return "Release";
  if (session.state !== "calibrating") return "";
  if (input.calibration?.state === "holding") return "Hold T-pose";
  return "T-pose";
}
function actionableRuntimeMessage(error, limitations) {
  if (error?.message) return boundedString(error.message, "AeroBeat needs attention.");
  if (limitations.includes("camera_unavailable")) return "Camera access is unavailable in this browser.";
  if (limitations.includes("playcanvas_unavailable")) return "PlayCanvas rendering is unavailable; try a current browser.";
  if (limitations.includes("fullscreen_unavailable")) return "Fullscreen is unavailable here.";
  return "";
}
/** Content playback/events/assets are runtime truth, not drawer-presenter data. @param {unknown} snapshot */
function contentPresenterDataSignature(snapshot) {
  return JSON.stringify([dataValue(snapshot, "state"), dataValue(snapshot, "generation"), dataValue(snapshot, "packageId"), dataValue(snapshot, "selectedVariant"), dataValue(snapshot, "background")]);
}
function mapSummary(map) { const versions = playableVersions(map); return Object.freeze({ mapId: map.mapId, name: map.mapName || map.songName, songAuthorName: map.songAuthorName, levelAuthorName: map.levelAuthorName, versionCount: versions.length, versions: Object.freeze(versions.slice(0, 8).map((version, index) => Object.freeze({ versionHash: version.hash, label: String(index + 1) }))) }); }
function standardDifficulties(version) { return Object.freeze((version?.difficulties ?? []).filter((entry) => entry.characteristic === "Standard").map((entry) => entry.difficulty).filter((entry, index, all) => all.indexOf(entry) === index)); }
function playableVersions(map) { return Object.freeze((map?.versions ?? []).filter((version) => standardDifficulties(version).length > 0)); }
function productLibraryPackages(packages) {
  const byId = new Map();
  for (const summary of packages) { const id = typeof summary?.packageId === "string" ? summary.packageId : ""; if (!id) continue; const prior = byId.get(id); if (!prior || Number(summary.createdAtMs ?? 0) >= Number(prior.createdAtMs ?? 0)) byId.set(id, summary); }
  return Object.freeze([...byId.values()].sort((left, right) => Number(right.createdAtMs ?? 0) - Number(left.createdAtMs ?? 0) || String(left.songName ?? "").localeCompare(String(right.songName ?? "")) || String(left.difficulty ?? "").localeCompare(String(right.difficulty ?? "")) || String(left.packageId ?? "").localeCompare(String(right.packageId ?? ""))));
}
function legacyLibraryCollections(packages) { return Object.freeze(packages.map((entry) => Object.freeze({ collectionId: `legacy:${boundedString(entry?.key, boundedString(entry?.packageId, ""))}`, songName: boundedString(entry?.songName, "Downloaded song"), packages: Object.freeze([Object.freeze({ packageKey: boundedString(entry?.key, ""), packageId: boundedString(entry?.packageId, ""), difficultyId: boundedString(entry?.difficulty, "Downloaded"), difficultyLabel: boundedString(entry?.difficulty, "Downloaded") })]) }))); }
function productLibraryCollections(collections, selectedCollectionId, selectedPackageId) {
  const normalized = [];
  for (const collection of Array.isArray(collections) ? collections : []) {
    const collectionId = boundedString(collection?.collectionId, ""); const songName = boundedString(collection?.songName, "Downloaded song");
    const difficulties = [];
    for (const entry of Array.isArray(collection?.packages) ? collection.packages : []) {
      const packageKey = boundedString(entry?.packageKey, ""), packageId = boundedString(entry?.packageId, ""), difficultyId = boundedString(entry?.difficultyId, ""), label = boundedString(entry?.difficultyLabel, difficultyId);
      if (packageKey && packageId && difficultyId && label) difficulties.push(Object.freeze({ packageKey, packageId, difficultyId, label }));
    }
    if (!collectionId || difficulties.length === 0) continue;
    const retained = collectionId === selectedCollectionId && difficulties.some((entry) => entry.packageId === selectedPackageId) ? selectedPackageId : difficulties[0].packageId;
    normalized.push(Object.freeze({ collectionId, songName, activePackageId: retained, difficulties: Object.freeze(difficulties) }));
  }
  return Object.freeze(normalized);
}
function publicLibrarySongs(collections) { return Object.freeze(collections.map((collection) => Object.freeze({ collectionId: collection.collectionId, songName: collection.songName, activePackageId: collection.activePackageId, difficulties: Object.freeze(collection.difficulties.map((entry) => Object.freeze({ difficultyId: entry.difficultyId, label: entry.label, packageId: entry.packageId }))) }))); }
function librarySelectionTarget(collections, collectionIdValue, packageIdValue) {
  const collectionId = boundedString(collectionIdValue, ""), packageId = boundedString(packageIdValue, "");
  const collection = collections.find((entry) => entry.collectionId === collectionId);
  const difficulty = collection?.difficulties.find((entry) => entry.packageId === packageId);
  return collection && difficulty ? Object.freeze({ collectionId, packageId, packageKey: difficulty.packageKey, difficultyId: difficulty.difficultyId }) : null;
}
function libraryPackageTarget(collections, packageIdValue) {
  const packageId = boundedString(packageIdValue, "");
  for (const collection of collections) { const difficulty = collection.difficulties.find((entry) => entry.packageId === packageId); if (difficulty) return Object.freeze({ collectionId: collection.collectionId, packageId, packageKey: difficulty.packageKey, difficultyId: difficulty.difficultyId }); }
  return null;
}
function activateLibraryCollection(collections, collectionId, packageId) { return Object.freeze(collections.map((collection) => collection.collectionId === collectionId && collection.difficulties.some((entry) => entry.packageId === packageId) ? Object.freeze({ ...collection, activePackageId: packageId }) : collection)); }
function currentDpr() { return Number.isFinite(globalThis.devicePixelRatio) && globalThis.devicePixelRatio > 0 ? globalThis.devicePixelRatio : 1; }
function audioClockAlignedWithGameplay(session, clock) { return clock?.playing === false && Number(clock.positionSeconds) * 1000 === Number(session?.timelinePositionMs ?? 0); }
function cssPixels(value) { const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : 0; }
function gameplayCursorRecords(menuOpen, session, input) {
  if (menuOpen || session?.purpose === "visual_test" || !["countdown", "playing"].includes(String(session?.state ?? ""))) return Object.freeze([]);
  const tracking = input?.tracking;
  if (!tracking || tracking.gameplayPaused === true || tracking.freshCalibrationRequired === true || tracking.allRequiredAnchorsVisible !== true || input?.retainedGeometryDimmed === true || input?.countdownFrozen === true) return Object.freeze([]);
  const roles = ["nose", "left_wrist", "right_wrist"];
  const byRole = new Map((Array.isArray(input?.anchors) ? input.anchors : []).map((anchor) => [anchor?.anchor, anchor]));
  return Object.freeze(roles.flatMap((role) => {
    const anchor = byRole.get(role);
    if (anchor?.valid !== true || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || !Number.isFinite(anchor.confidence) || anchor.confidence < 0.5) return [];
    return [Object.freeze({ role, x: anchor.x, y: anchor.y, confidence: anchor.confidence })];
  }));
}
function profileSessionState(gameplay) { const countdown = dataValue(gameplay, "countdown"); const session = dataValue(gameplay, "session"); if (dataValue(countdown, "value") !== null && dataValue(countdown, "value") !== undefined) return "countdown"; return typeof dataValue(session, "state") === "string" ? dataValue(session, "state") : "idle"; }
function profilePresentationId(variant) { return selectedGameplayProfileId(variant); }
function isFlowOrientationReimportError(error) { return ownDataValue(error, "code") === "flow_orientation_reimport_required"; }
function tuningIdentity(profile, regenerationRequired) { return Object.freeze({ schema: "aerobeat/prototype_tuning_identity", version: 1, profileId: profile.profileId, profileVersion: profile.profileVersion, contentHash: profile.contentHash, class: profile.class, regenerationRequired }); }
function profileTelemetry(snapshot) { return Object.freeze({ schema: snapshot.schema, version: snapshot.version, generation: snapshot.generation, destroyed: snapshot.destroyed, bundleVersion: snapshot.bundleVersion, profileCount: snapshot.profiles.length, active: Object.freeze({ visual: snapshot.active.visual.identity, scoring: snapshot.active.scoring.identity, converter: snapshot.active.converter.identity }), appliedConverterHash: snapshot.appliedConverterHash, pendingConverterHash: snapshot.pendingConverterHash, regenerationRequired: snapshot.regenerationRequired, experimental: true }); }
function rendererTelemetry(snapshot) { return Object.freeze({ serviceId: dataValue(snapshot, "serviceId"), engine: dataValue(snapshot, "engine"), state: dataValue(snapshot, "state"), supported: dataValue(snapshot, "supported"), attached: dataValue(snapshot, "attached"), contextLost: dataValue(snapshot, "contextLost"), widthCssPx: dataValue(snapshot, "widthCssPx"), heightCssPx: dataValue(snapshot, "heightCssPx"), devicePixelRatio: dataValue(snapshot, "devicePixelRatio"), manualRendering: dataValue(snapshot, "manualRendering") === true, debugCameraEnabled: dataValue(snapshot, "debugCameraEnabled") === true, pointerLockActive: dataValue(snapshot, "pointerLockActive") === true, visualProfileIdentity: dataValue(snapshot, "visualProfileIdentity"), iconAtlasReady: dataValue(snapshot, "iconAtlasReady") === true, iconAtlasError: boundedString(dataValue(snapshot, "iconAtlasError"), "") || null, tuningRequiresRegeneration: false, experimental: true, errorMessage: dataValue(snapshot, "errorMessage") }); }
function profilePresenterSnapshot(snapshot, selectedVariant, sessionState) {
  const classes = ["live_visual", "between_run_ruleset", "converter_regeneration"].map((profileClass) => {
    const key = profileClass === "live_visual" ? "visual" : profileClass === "between_run_ruleset" ? "scoring" : "converter";
    const active = snapshot.active[key];
    const profiles = Object.freeze(snapshot.profiles.filter((profile) => profile.class === profileClass).map((profile) => tuningIdentity(profile, profileClass === "converter_regeneration" && profile.contentHash !== snapshot.appliedConverterHash)));
    if (profileClass !== "converter_regeneration") return Object.freeze({ class: profileClass, active: active.identity, profiles, experimental: true });
    return Object.freeze({ class: profileClass, active: active.identity, profiles, experimental: true, selectedContentHash: active.identity.contentHash, appliedContentHash: snapshot.appliedConverterHash, pendingContentHash: snapshot.pendingConverterHash, regenerationRequired: snapshot.regenerationRequired });
  });
  return Object.freeze({ selectedProfileId: selectedVariant ? profilePresentationId(selectedVariant) : "flow", sessionState: String(sessionState ?? "idle"), profileClasses: Object.freeze(classes) });
}
function packageFromEnvelope(envelope) { const value = dataValue(envelope, "package"); return value && typeof value === "object" ? value : null; }
function converterProfileFromPackage(packageValue) { const source = dataValue(packageValue, "source"); const profile = dataValue(source, "converterProfile"); return profile && typeof profile === "object" ? profile : null; }
function packageCarriesConverterProfile(packageValue, profile) {
  try {
    const expected = canonicalPrototypeProfileJson(profile); const source = dataValue(packageValue, "source"); const trace = dataValue(packageValue, "conversionTrace");
    if (canonicalPrototypeProfileJson(dataValue(source, "converterProfile")) !== expected || canonicalPrototypeProfileJson(dataValue(trace, "converterProfile")) !== expected) return false;
    const boxing = dataValue(trace, "boxing"); const flow = dataValue(trace, "flow"); const charts = dataValue(packageValue, "charts");
    if (!Array.isArray(boxing) || boxing.length !== 4 || boxing.some((entry) => canonicalPrototypeProfileJson(dataValue(entry, "converterProfile")) !== expected)) return false;
    if (!Array.isArray(flow) || flow.some((entry) => dataValue(entry, "converterProfile") !== undefined)) return false;
    const boxingCharts = Array.isArray(charts) ? charts.filter((chart) => dataValue(chart, "mode") === "boxing") : [];
    return boxingCharts.length === 4 && boxingCharts.every((chart) => canonicalPrototypeProfileJson(dataValue(dataValue(chart, "prototype"), "converterProfile")) === expected);
  } catch { return false; }
}
/** Return keyboard-focusable controls in composed tree order, including open presenter roots. @param {Element | ShadowRoot} root @returns {HTMLElement[]} */
function deepFocusable(root) {
  const controls = [];
  for (const element of root.querySelectorAll("*")) {
    if (!(element instanceof HTMLElement) || element.hidden) continue;
    if (element.matches("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])")) controls.push(element);
    if (element.shadowRoot) controls.push(...deepFocusable(element.shadowRoot));
  }
  return controls;
}
/** Resolve the innermost focused element across open shadow roots. @param {ShadowRoot | null} root @returns {Element | null} */
function deepActiveElement(root) { let active = root?.activeElement ?? null; while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement; return active; }
/** Descriptor-safe bounded clone for public snapshots/commands. */
function safeData(value, depth, maximumItems) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError("Non-finite public data"); return Object.is(value, -0) ? 0 : value; }
  if (depth >= 12) throw new TypeError("Public data exceeds depth limit");
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || value.length > maximumItems) throw new TypeError("Invalid public array");
    const keys = Reflect.ownKeys(value); if (keys.length !== value.length + 1 || keys.some((key) => key !== "length" && (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw new TypeError("Public arrays cannot contain extra fields");
    return Object.freeze(Array.from({ length: value.length }, (_, index) => { const descriptor = Object.getOwnPropertyDescriptor(value, String(index)); if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new TypeError("Sparse or accessor array"); return safeData(descriptor.value, depth + 1, maximumItems); }));
  }
  if (!value || typeof value !== "object" || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) { const prototype = value && typeof value === "object" ? Object.getPrototypeOf(value) : null; const constructor = prototype ? Object.getOwnPropertyDescriptor(prototype, "constructor") : null; const name = constructor && "value" in constructor && typeof constructor.value?.name === "string" ? constructor.value.name : typeof value; throw new TypeError(`Public data must be plain serializable data (${name})`); }
  const keys = Reflect.ownKeys(value); if (keys.length > maximumItems || keys.some((key) => typeof key !== "string")) throw new TypeError("Public record exceeds limits");
  const result = {};
  for (const key of keys) { if (key.length > 256) throw new TypeError("Public key exceeds limit"); const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new TypeError("Public accessors are forbidden"); if (descriptor.value !== undefined) Object.defineProperty(result, key, { value: safeData(descriptor.value, depth + 1, maximumItems), enumerable: true, writable: true, configurable: true }); }
  return Object.freeze(result);
}
