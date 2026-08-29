// @ts-check

import { createAeroWebAudioService } from "@aerobeat/web-audio";
import { createAeroContentRuntime } from "@aerobeat/web-content";
import { createAeroWebContentAuthoringService } from "@aerobeat/web-content-authoring";
import { createAeroCameraCvService, getAeroCvPerformancePreset } from "@aerobeat/web-cv";
import { createAeroGameplaySessionCoordinator } from "@aerobeat/web-gameplay";
import { createAeroBodyGridService } from "@aerobeat/web-input";
import { createAeroWebGl2Renderer } from "@aerobeat/web-renderer";
import { createAeroBeatSaverVendorService } from "@aerobeat/web-vendor-beatsaver";
import { createBrowserVideoMediaFacade } from "@aerobeat/web-video";
import { createPoseBackendComposition } from "./pose-backend-registry.js";
export { lockedProductionCvProfile } from "./production-cv-profile.js";

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
  const performancePreset = getAeroCvPerformancePreset("full");
  const composition = createPoseBackendComposition({
    requestedBackendId: "mediapipe", selectedBackendId: "mediapipe",
    requestedProviderId: "gpu-webgl", selectedProviderId: "gpu-webgl",
    requestedMediaPipeTuningId: "standard", selectedMediaPipeTuningId: "standard",
    mediaPipeTuningApplicable: true, warning: undefined
  }, performancePreset);
  const video = createBrowserVideoMediaFacade();
  const audio = createAeroWebAudioService({ initialLeaseActive: false });
  const cv = createAeroCameraCvService({
    poseAdapter: composition.poseAdapter,
    fallbackPoseAdapter: composition.fallbackPoseAdapter,
    requestedBackendId: "mediapipe",
    selectedBackendId: "mediapipe",
    sourceKind: "live-camera",
    sourceId: composition.sourceId,
    mirrored: true,
    useFallbackOnError: false,
    performancePreset,
    submissionCadenceTargetFps: 15
  });
  return Object.freeze({
    instanceId,
    vendor: createAeroBeatSaverVendorService(),
    authoring,
    content,
    video,
    cv,
    input: createAeroBodyGridService({ calibrationIdPrefix: `${instanceId}-calibration` }),
    audio,
    gameplay: createAeroGameplaySessionCoordinator({ instanceId }),
    renderer: createAeroWebGl2Renderer()
  });
}
