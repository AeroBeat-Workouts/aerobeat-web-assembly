// @ts-check

import { createAeroWebAudioService } from "@aerobeat/web-audio";
import { createAeroContentRuntime } from "@aerobeat/web-content";
import { createAeroWebContentAuthoringService } from "@aerobeat/web-content-authoring";
import { createAeroGameplaySessionCoordinator, createAeroPrototypeProfileRegistry } from "@aerobeat/web-gameplay";
import { createAeroBodyGridService } from "@aerobeat/web-input";
import { createAeroPlayCanvasRenderer } from "@aerobeat/web-renderer";
import { createAeroBeatSaverVendorService } from "@aerobeat/web-vendor-beatsaver";
import { createMediaPipeWorkerPoseAdapter, mediaPipeDelegates, mediaPipeLiveSourceId } from "@aerobeat/web-vendor-mediapipe";
import { createBrowserVideoMediaFacade } from "@aerobeat/web-video";
import { createLockedProductionCvService } from "./production-cv-service.js";
import { createPrivateGameplayCvService } from "./private-gameplay-cv.js";
import { lockedProductionCvProfile } from "./production-cv-profile.js";
export { lockedProductionCvProfile };

/**
 * Exact production adapter factory; exported only for screenshot-free acceptance
 * inspection. tm4m: the three threshold values are read straight from the locked
 * declared production CV profile (detection 0.4 / presence 0.5 / tracking 0.3)
 * so the wiring can never drift from the declared values.
 */
export function createLockedProductionPoseAdapter() {
  return createMediaPipeWorkerPoseAdapter({
    sourceId: mediaPipeLiveSourceId,
    mirrored: true,
    delegate: mediaPipeDelegates.cpuWasm,
    minPoseDetectionConfidence: lockedProductionCvProfile.minPoseDetectionConfidence,
    minPosePresenceConfidence: lockedProductionCvProfile.minPosePresenceConfidence,
    minTrackingConfidence: lockedProductionCvProfile.minTrackingConfidence
  });
}

/** @typedef {ReturnType<typeof createAeroGameServiceGraph>} AeroGameServiceGraph */

/** Create a complete, isolated service graph for one connected game instance. */
export function createAeroGameServiceGraph(options = {}) {
  const instanceId = typeof options.instanceId === "string" ? options.instanceId : "aero-game";
  const authoring = createAeroWebContentAuthoringService({ useBrowserWorker: true, useIndexedDb: true });
  const content = createAeroContentRuntime({ persistenceResolver: {
    loadPackage: (handle) => authoring.loadPackage(handle),
    readAsset: (handle, path) => authoring.readAsset(handle, path),
    exportPackage: (handle) => authoring.exportPackage(handle)
  }});
  const candidate = typeof __AEROBEAT_PRIVATE_GAMEPLAY_CV_MODE__ !== "undefined" && __AEROBEAT_PRIVATE_GAMEPLAY_CV_MODE__ === "gpu-after-result";
  const video = createBrowserVideoMediaFacade();
  const audio = createAeroWebAudioService({ initialLeaseActive: false });
  // Only the separately built candidate diagnostic page can force a real fresh
  // CPU Worker for browser QA. The ordinary game page and phone run cannot.
  const qaGpuInitFailure = candidate && typeof globalThis.location?.pathname === "string" &&
    globalThis.location.pathname.endsWith("/phone-play-cv-test.html") &&
    new URLSearchParams(globalThis.location.search).get("preview") === "1" &&
    new URLSearchParams(globalThis.location.search).get("forceGpuInitFail") === "1";
  const cv = candidate
    ? createPrivateGameplayCvService({ qaGpuInitFailure })
    : createLockedProductionCvService({ poseAdapter: createLockedProductionPoseAdapter(), submissionCadenceTargetFps: 15 });
  return Object.freeze({
    instanceId,
    vendor: createAeroBeatSaverVendorService(),
    authoring,
    content,
    video,
    cv,
    input: createAeroBodyGridService({ calibrationIdPrefix: `${instanceId}-calibration` }),
    audio,
    profiles: createAeroPrototypeProfileRegistry(),
    gameplay: createAeroGameplaySessionCoordinator({ instanceId }),
    renderer: createAeroPlayCanvasRenderer()
  });
}
