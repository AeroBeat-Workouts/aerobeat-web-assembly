// TEST-ONLY classic Worker; never used by any signed/product build.
self.onmessage = async ({ data }) => {
  const { mode, origin, expectedModelHash, expectedModelBytes } = data;
  const stamp = () => performance.now();
  const marks = { start: stamp() };
  const modelUrl = `${origin}/assets/mediapipe/pose_landmarker_lite.task`;
  try {
    importScripts(`${origin}/assets/mediapipe/vision_bundle.js`);
    marks.visionImported = stamp();
    const loadModel = async () => {
      marks.modelStart = stamp();
      const response = await fetch(modelUrl, { cache: 'no-store' });
      if (!response.ok || !response.body) throw Error(`model GET failed: ${response.status}`);
      const chunks = []; let received = 0;
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > expectedModelBytes) throw Error('decoded model length exceeded signed size');
        chunks.push(value);
        self.postMessage({ type: 'progress', received, total: expectedModelBytes });
      }
      if (received !== expectedModelBytes) throw Error(`decoded model length ${received} != ${expectedModelBytes}`);
      const bytes = new Uint8Array(received); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
      if (hash !== expectedModelHash) throw Error(`model SHA mismatch: ${hash}`);
      marks.modelVerified = stamp();
      return bytes;
    };
    // Candidate issues exactly one model GET before the resolver has completed.
    const modelPromise = mode === 'buffer' ? loadModel() : null;
    // Avoid unhandled rejection while WASM is resolving; still propagate at await.
    if (modelPromise) modelPromise.catch(() => {});
    marks.resolverStart = stamp();
    const files = await Vision.FilesetResolver.forVisionTasks(`${origin}/assets/mediapipe/wasm`);
    marks.resolverDone = stamp();
    const options = { baseOptions: mode === 'buffer' ? { modelAssetBuffer: await modelPromise, delegate: 'CPU' } : { modelAssetPath: modelUrl, delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: false, minPoseDetectionConfidence: .4, minPosePresenceConfidence: .5, minTrackingConfidence: .3 };
    marks.createStart = stamp();
    const pose = await Vision.PoseLandmarker.createFromOptions(files, options);
    marks.createDone = stamp();
    pose.close();
    self.postMessage({ type: 'done', marks });
  } catch (error) {
    self.postMessage({ type: 'error', marks, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
  }
};
