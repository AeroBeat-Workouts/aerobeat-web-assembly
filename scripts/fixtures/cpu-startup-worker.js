// @ts-check
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
    // Buffer mode must await all bytes before task creation; stream mode passes
    // the supported reader after headers, without a second model fetch.
    const modelPromise = mode === 'buffer' ? loadModel() : null;
    if (modelPromise) modelPromise.catch(() => {});
    let modelReader, modelIntegrity;
    if (mode === 'stream') {
      marks.modelStart = stamp();
      const response = await fetch(modelUrl, { cache: 'no-store' });
      marks.modelHeaders = stamp();
      if (!response.ok || !response.body) throw Error(`model GET failed: ${response.status}`);
      const source = response.body.getReader();
      const chunks = []; let received = 0;
      let resolveIntegrity, rejectIntegrity;
      modelIntegrity = new Promise((resolve, reject) => { resolveIntegrity = resolve; rejectIntegrity = reject; });
      modelIntegrity.catch(() => {});
      // A real ReadableStreamDefaultReader from a progress-wrapping stream.
      // The library consumes this reader; integrity is established only at EOF.
      const observed = new ReadableStream({
        async pull(controller) {
          try {
            const result = await source.read();
            if (result.done) {
              if (received !== expectedModelBytes) throw Error(`decoded model length ${received} != ${expectedModelBytes}`);
              const bytes = new Uint8Array(received); let offset = 0;
              for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
              const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
              if (hash !== expectedModelHash) throw Error(`model SHA mismatch: ${hash}`);
              marks.modelVerified = stamp();
              resolveIntegrity({ received, hash });
              controller.close();
              return;
            }
            received += result.value.byteLength;
            if (received > expectedModelBytes) throw Error('decoded model length exceeded signed size');
            chunks.push(result.value);
            self.postMessage({ type: 'progress', received, total: expectedModelBytes });
            controller.enqueue(result.value);
          } catch (error) { rejectIntegrity(error); controller.error(error); }
        },
        cancel(reason) { rejectIntegrity(Error(`model reader canceled: ${String(reason)}`)); return source.cancel(reason); }
      }, { highWaterMark: 0 });
      modelReader = observed.getReader();
    }
    marks.resolverStart = stamp();
    const files = await Vision.FilesetResolver.forVisionTasks(`${origin}/assets/mediapipe/wasm`);
    marks.resolverDone = stamp();
    const baseOptions = mode === 'stream'
      ? { modelAssetBuffer: modelReader, delegate: 'CPU' }
      : mode === 'buffer'
        ? { modelAssetBuffer: await modelPromise, delegate: 'CPU' }
        : { modelAssetPath: modelUrl, delegate: 'CPU' };
    const options = { baseOptions, runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: false, minPoseDetectionConfidence: .4, minPosePresenceConfidence: .5, minTrackingConfidence: .3 };
    marks.createStart = stamp();
    const pose = await Vision.PoseLandmarker.createFromOptions(files, options);
    marks.createDone = stamp();
    if (modelIntegrity) {
      const integrity = await Promise.race([modelIntegrity, new Promise((_, reject) => setTimeout(() => reject(Error('model reader not drained after task creation')), 1000))]);
      if (integrity.received !== expectedModelBytes || integrity.hash !== expectedModelHash) throw Error('stream model verification failed');
    }
    pose.close();
    self.postMessage({ type: 'done', marks, integrityTiming: mode === 'stream' ? 'after-consumption; not pre-load verification' : mode === 'buffer' ? 'before-task-creation' : 'signed server bytes' });
  } catch (error) {
    self.postMessage({ type: 'error', marks, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
  }
};
