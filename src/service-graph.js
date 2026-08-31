// @ts-check

import { createAeroWebAudioService } from "@aerobeat/web-audio";
import { createAeroContentRuntime } from "@aerobeat/web-content";
import { createAeroWebContentAuthoringService } from "@aerobeat/web-content-authoring";
import { createAeroGameplaySessionCoordinator, createAeroPrototypeProfileRegistry } from "@aerobeat/web-gameplay";
import { createAeroBodyGridService } from "@aerobeat/web-input";
import { createAeroPlayCanvasRenderer } from "@aerobeat/web-renderer";
import { createAeroBeatSaverVendorService } from "@aerobeat/web-vendor-beatsaver";
import { createMediaPipePoseAdapter, mediaPipeDelegates, mediaPipeLiveSourceId } from "@aerobeat/web-vendor-mediapipe";
import { createBrowserVideoMediaFacade } from "@aerobeat/web-video";
import { createLockedProductionCvService } from "./production-cv-service.js";
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
  const poseAdapter = createMediaPipePoseAdapter({
    sourceId: mediaPipeLiveSourceId,
    mirrored: true,
    delegate: mediaPipeDelegates.gpuWebgl,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  const video = createBrowserVideoMediaFacade();
  const audio = createAeroWebAudioService({ initialLeaseActive: false });
  const cv = createLockedProductionCvService({ poseAdapter, submissionCadenceTargetFps: 15 });
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
