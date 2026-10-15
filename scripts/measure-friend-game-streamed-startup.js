// @ts-check
// TEST ONLY: matched local signed CPU control/candidate with incremental model bytes.
// Not a phone, public-relay, wire-bandwidth or physical-pose benchmark.
// Usage: node scripts/measure-friend-game-streamed-startup.js control
//        node scripts/measure-friend-game-streamed-startup.js .tmp/friend-game-cpu-stream-candidate-64d6990
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { loadSignedSnapshot, handlerForSnapshot } from './serve-friend-game.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const selection = process.argv[2];
assert.equal(process.argv.length, 3, 'exactly one argument: control or .tmp/<safe-direct-child>');
assert(selection === 'control' || /^\.tmp\/[a-zA-Z0-9][a-zA-Z0-9_-]*$/u.test(selection), 'only control or safe direct .tmp child allowed');
const directory = selection === 'control' ? resolve(root, 'dist-friend-game') : resolve(root, selection);
if (selection !== 'control') {
  assert.equal(realpathSync(resolve(root, '.tmp')), resolve(root, '.tmp'), '.tmp must be a real directory');
  assert(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink() && realpathSync(directory) === directory, 'candidate must be a real direct-child directory');
}
const snapshot = loadSignedSnapshot(directory);
const manifestBytes = readFileSync(join(directory, 'friend-game-bundle-manifest.json'));
const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');
const model = '/assets/mediapipe/pose_landmarker_lite.task';
const wasm = '/assets/mediapipe/wasm/vision_wasm_internal.wasm';
const assets = [model, wasm];
for (const path of assets) {
  const entry = snapshot.manifest.assets.filter(item => `/${item.path}` === path);
  assert.equal(entry.length, 1, `unique signed ${path}`);
  const bytes = snapshot.bytes.get(path);
  assert(bytes && bytes.length === entry[0].bytes, `verified signed bytes ${path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry[0].sha256, `verified signed hash ${path}`);
}
const baseHandler = handlerForSnapshot(snapshot);
const events = [];
const zero = performance.now();
const clock = () => Math.round(performance.now() - zero);
const schedule = Object.freeze({ modelChunks: 8, modelIntervalMs: 500, wasmDelayMs: 3000 });
const counts = { [model]: 0, [wasm]: 0 };
const workerTrace = process.env.AEROBEAT_STARTUP_TRACE_WORKER === '1';
assert(!process.env.AEROBEAT_STARTUP_TRACE_WORKER || workerTrace, 'Worker trace must be 1 or unset');
const debugMode = process.env.AEROBEAT_STARTUP_DEBUG_EOF;
const debugEof = debugMode === '1' || debugMode === '2';
assert(!debugMode || debugEof, 'EOF debugger must be 1, 2 or unset');
assert(!debugEof || workerTrace, 'EOF debugger requires Worker CDP trace');
// Zero-based signed source lines; these are cause-only breakpoints, not timings.
const fullEofBreakpoints = new Map([
  [69, ['loaded', 'self.postMessage({ type: "loaded", actualDelegate: options.delegate });']],
  [203, ['upstreamEofBranch', 'if (result.done) {']],
  [211, ['shaCompare', 'if (hash !== options.modelSha256.toLowerCase())']],
  [213, ['verifiedPost', 'verified: true']],
  [214, ['observedClose', 'controller.close();']],
  [215, ['integritySettled', 'settled = true;']],
  [216, ['integrityResolve', 'resolveIntegrity();']],
  [236, ['observedCancel', 'fail(reason ?? new Error("Model reader canceled"));']]
]);
const eofBreakpoints = debugMode === '2'
  ? new Map([...fullEofBreakpoints].filter(([line]) => [69, 203, 236].includes(line)))
  : fullEofBreakpoints;
const workerPath = debugEof ? snapshot.manifest.assets.filter(item => /^assets\/mediapipe-worker-[\w-]+\.js$/u.test(item.path)) : [];
let signedWorkerUrl;
if (debugEof) {
  assert.equal(workerPath.length, 1, 'exactly one signed MediaPipe Worker required');
  const asset = workerPath[0], bytes = snapshot.bytes.get(`/${asset.path}`);
  assert(bytes && bytes.length === asset.bytes, 'signed Worker byte length required');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, 'signed Worker digest required');
  const lines = bytes.toString('utf8').split('\n');
  assert.equal(lines.length, 403, 'exact unminified Worker source lines required (402 plus final newline)');
  for (const [line, [, anchor]] of fullEofBreakpoints) assert(lines[line].includes(anchor), `signed Worker line ${line + 1} changed`);
  signedWorkerUrl = `http://127.0.0.1:4201/${asset.path}`;
}
let chrome = null, rawWs = null, profile = null, cdpOrigin = null;
const workerEvents = [], targetSessions = new Map(), ids = new Map(), attaching = new Set();
const debugScripts = new Map(), breakpointIds = new Map(), pendingDebug = new Map(), earlyResolved = new Map();
const debugFailures = [];
const pauseTimers = new Set();
let debugMessageId = 1000, pauseCount = 0;
const maxDebugPauses = 96;
const sendDebug = (send, method, params, sessionId, meta) => {
  const id = ++debugMessageId;
  pendingDebug.set(id, { sessionId, method, meta });
  send(id, method, params, sessionId);
};
let active = 0;
const server = createServer((request, response) => {
  const path = request.url?.split('?', 1)[0];
  if (!assets.includes(path) || !['GET', 'HEAD'].includes(request.method) || request.url !== path) return baseHandler(request, response);
  // Delegate all signed CSP/MIME/no-store/HEAD/404 policy to the production
  // snapshot handler; it returns immediately for HEAD. GET uses the exact same
  // signed bytes and headers, but test-only deterministic transfer timing.
  if (request.method === 'HEAD') return baseHandler(request, response);
  counts[path]++;
  const item = { path, ordinal: counts[path], requestMs: clock(), headersMs: null, finishMs: null, chunks: [] };
  events.push(item);
  active++;
  const data = snapshot.bytes.get(path);
  const mime = path === wasm ? 'application/wasm' : 'application/octet-stream';
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', snapshot.manifest.responsePolicy.assetCsp);
  response.setHeader('Content-Type', mime);
  response.setHeader('Content-Length', data.length);
  const finish = () => { item.finishMs = clock(); active--; };
  response.once('finish', finish);
  response.once('close', () => { if (item.finishMs === null) { item.abortedMs = clock(); active--; } });
  if (path === model) {
    // flushHeaders makes the supported stream reader observable while WASM loads.
    item.headersMs = clock(); response.flushHeaders();
    void (async () => {
      const chunkSize = Math.ceil(data.length / schedule.modelChunks);
      for (let i = 0; i < schedule.modelChunks; i++) {
        await delay(schedule.modelIntervalMs);
        if (response.destroyed) break;
        const start = i * chunkSize, end = Math.min(data.length, start + chunkSize);
        if (start >= end) break;
        response.write(data.subarray(start, end));
        item.chunks.push({ atMs: clock(), bytes: end - start });
      }
      if (!response.destroyed) response.end();
    })().catch(error => response.destroy(error));
  } else {
    void delay(schedule.wasmDelayMs).then(() => {
      if (response.destroyed) return;
      item.headersMs = clock(); response.end(data);
    }).catch(error => response.destroy(error));
  }
});

await new Promise((done, reject) => server.once('error', reject).listen(4201, '127.0.0.1', done));
const url = 'http://127.0.0.1:4201/';
try {
  // Negative and HEAD parity: no sidecar, signed CSP/MIME and same length as GET.
  for (const path of assets) {
    const head = await fetch(new URL(path, url), { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(snapshot.bytes.get(path).length));
    assert.equal(head.headers.get('content-type'), path === wasm ? 'application/wasm' : 'application/octet-stream');
    assert.equal(head.headers.get('cache-control'), 'no-store');
    assert.equal(head.headers.get('content-security-policy'), snapshot.manifest.responsePolicy.assetCsp);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
  }
  for (const path of ['/friend-game-bundle-manifest.json', '/src/index.js', '/phone-play-cv-test.html']) assert.equal((await fetch(new URL(path, url))).status, 404);
  assert(!process.env.AEROBEAT_STARTUP_TRACE || process.env.AEROBEAT_STARTUP_TRACE === '1', 'trace must be 1 or unset');
  if (workerTrace) {
    profile = mkdtempSync(join(tmpdir(), 'aerobeat-worker-cdp-'));
    chrome = spawn(chromium.executablePath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', 'about:blank'],
    { stdio: 'ignore' });
    const portFile = join(profile, 'DevToolsActivePort');
    let portText;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { portText = readFileSync(portFile, 'utf8'); break; } catch { await delay(25); }
      if (chrome.exitCode !== null) throw Error(`owned Chromium exited ${chrome.exitCode} before CDP port`);
    }
    const [port, wsPath] = portText?.trim().split('\n') ?? [];
    assert(/^\d{2,5}$/u.test(port ?? '') && /^\/devtools\/browser\/[a-z0-9-]+$/iu.test(wsPath ?? ''), 'bounded Chromium DevToolsActivePort unavailable');
    cdpOrigin = `http://127.0.0.1:${port}`;
    rawWs = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
    await Promise.race([new Promise((done, reject) => { rawWs.addEventListener('open', done, { once: true }); rawWs.addEventListener('error', reject, { once: true }); }), delay(3000).then(() => { throw Error('raw loopback CDP handshake timeout'); })]);
    const send = (id, method, params = {}, sessionId) => rawWs.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    rawWs.addEventListener('message', event => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      const pending = pendingDebug.get(payload.id);
      if (pending) {
        pendingDebug.delete(payload.id);
        if (payload.error) debugFailures.push({ method: pending.method, error: payload.error.message });
        if (pending.method === 'Debugger.enable' && !payload.error) {
          for (const [line, [boundary]] of eofBreakpoints) {
            sendDebug(send, 'Debugger.setBreakpointByUrl', {
              lineNumber: line, url: signedWorkerUrl, columnNumber: 0,
              ...(debugMode === '2' && boundary === 'upstreamEofBranch' ? { condition: 'result.done === true' } : {})
            }, pending.sessionId, { line, boundary });
          }
        }
        if (pending.method === 'Debugger.setBreakpointByUrl' && !payload.error) {
          const locations = [...(payload.result?.locations ?? [])];
          // An unresolved URL breakpoint may bind later; confirm the resolved script
          // and exact location with Debugger.breakpointResolved before trusting it.
          const key = `${pending.sessionId}:${payload.result.breakpointId}`;
          breakpointIds.set(key, { ...pending.meta, sessionId: pending.sessionId });
          for (const location of earlyResolved.get(key) ?? []) locations.push(location);
          earlyResolved.delete(key);
          for (const location of locations) {
            const script = debugScripts.get(`${pending.sessionId}:${location.scriptId}`);
            if (script !== signedWorkerUrl || location?.lineNumber !== pending.meta.line) debugFailures.push({ method: pending.method, error: 'breakpoint resolved outside signed Worker/expected line' });
            else workerEvents.push({ event: 'breakpointBound', nodeMs: clock(), sessionId: pending.sessionId, boundary: pending.meta.boundary, line: pending.meta.line });
          }
        }
        if (pending.method === 'Debugger.evaluateOnCallFrame') {
          if (pending.meta?.timer) { clearTimeout(pending.meta.timer); pauseTimers.delete(pending.meta.timer); }
          if (pending.meta?.timedOut) return;
          const value = payload.result?.result?.value;
          if (payload.error || payload.result?.exceptionDetails || !value || typeof value !== 'object') debugFailures.push({ method: pending.method, error: 'scalar frame evaluation failed' });
          else if (pending.meta.event) pending.meta.event.scalars = value;
          sendDebug(send, 'Debugger.resume', {}, pending.sessionId);
        }
      }
      if ((payload.id === 1 || payload.id === 2 || payload.id >= 11 && payload.id < 100) && payload.error) workerEvents.push({ event: 'protocolError', id: payload.id, error: payload.error.message });
      if (payload.method === 'Target.targetInfoChanged') {
        const info = payload.params?.targetInfo;
        if (info?.type === 'worker') {
          if (info.url.startsWith(url) && /mediapipe-worker/iu.test(info.url) && !attaching.has(info.targetId)) {
            attaching.add(info.targetId);
            send(10 + attaching.size, 'Target.attachToTarget', { targetId: info.targetId, flatten: true });
          }
        }
      }
      if (payload.method === 'Target.attachedToTarget') {
        const info = payload.params?.targetInfo;
        if (info?.type !== 'worker' || !info.url.startsWith(url) || !/mediapipe-worker/iu.test(info.url)) return;
        const sessionId = payload.params.sessionId;
        if (debugEof && info.url !== signedWorkerUrl) { debugFailures.push({ method: 'Target.attachedToTarget', error: 'CDP target is not the exact signed Worker' }); return; }
        targetSessions.set(sessionId, info.url); ids.set(sessionId, new Set());
        workerEvents.push({ event: 'targetAttached', nodeMs: clock(), sessionId, url: info.url });
        send(100 + targetSessions.size, 'Network.enable', {}, sessionId);
        if (debugEof) sendDebug(send, 'Debugger.enable', {}, sessionId);
      } else if (payload.method === 'Target.detachedFromTarget') {
        const sessionId = payload.params?.sessionId;
        if (targetSessions.has(sessionId)) workerEvents.push({ event: 'targetDetached', nodeMs: clock(), sessionId });
      } else if (targetSessions.has(payload.sessionId)) {
        const data = payload.params, sessionId = payload.sessionId, tracked = ids.get(sessionId);
        if (debugEof && payload.method === 'Debugger.scriptParsed') {
          debugScripts.set(`${sessionId}:${data.scriptId}`, data.url);
          if (data.url === signedWorkerUrl) workerEvents.push({ event: 'signedScriptParsed', nodeMs: clock(), sessionId });
          return;
        }
        if (debugEof && payload.method === 'Debugger.breakpointResolved') {
          const key = `${sessionId}:${data.breakpointId}`, expected = breakpointIds.get(key), location = data.location;
          if (!expected) {
            const pending = earlyResolved.get(key) ?? [];
            if (pending.length >= 1) debugFailures.push({ method: 'Debugger.breakpointResolved', error: 'duplicate unresolved breakpoint event' });
            else { pending.push(location); earlyResolved.set(key, pending); }
          } else if (expected.sessionId !== sessionId || debugScripts.get(`${sessionId}:${location?.scriptId}`) !== signedWorkerUrl || location?.lineNumber !== expected.line) {
            debugFailures.push({ method: 'Debugger.breakpointResolved', error: 'unexpected script or line' });
          } else workerEvents.push({ event: 'breakpointBound', nodeMs: clock(), sessionId, boundary: expected.boundary, line: expected.line });
          return;
        }
        if (debugEof && payload.method === 'Debugger.paused') {
          const top = data.callFrames?.[0], location = top?.location;
          const matches = (data.hitBreakpoints ?? []).map(id => breakpointIds.get(`${sessionId}:${id}`));
          const expected = matches.find(item => item?.sessionId === sessionId && item.line === location?.lineNumber);
          const valid = expected && debugScripts.get(`${sessionId}:${location?.scriptId}`) === signedWorkerUrl;
          pauseCount++;
          if (!valid || pauseCount > maxDebugPauses) debugFailures.push({ method: 'Debugger.paused', error: valid ? 'bounded pause limit exceeded' : 'unexpected script, line or breakpoint' });
          if (valid && pauseCount <= maxDebugPauses && workerEvents.length < 256) {
            const item = { event: 'paused', nodeMs: clock(), sessionId, boundary: expected.boundary, line: expected.line, modelRequestIds: [...tracked] };
            workerEvents.push(item);
            // Pure scalar lexical reads only: no stream operations, JSON serialization
            // or object capture. EOF entry may be a non-EOF chunk; report result.done.
            const expression = expected.boundary === 'upstreamEofBranch'
              ? '({done: result.done === true, receivedBytes})'
              : expected.boundary === 'observedCancel'
                ? '({reasonType: typeof reason})'
                : ['shaCompare', 'verifiedPost', 'observedClose', 'integritySettled', 'integrityResolve'].includes(expected.boundary)
                  ? '({receivedBytes, settled})' : '({loaded: true})';
            const meta = { event: item, timer: undefined, timedOut: false };
            meta.timer = setTimeout(() => {
              pauseTimers.delete(meta.timer);
              meta.timedOut = true;
              debugFailures.push({ method: 'Debugger.evaluateOnCallFrame', error: 'paused Worker exceeded 2s; forced resume' });
              sendDebug(send, 'Debugger.resume', {}, sessionId);
            }, 2000);
            pauseTimers.add(meta.timer);
            sendDebug(send, 'Debugger.evaluateOnCallFrame', { callFrameId: top.callFrameId, expression, returnByValue: true, silent: true, throwOnSideEffect: true }, sessionId, meta);
          } else sendDebug(send, 'Debugger.resume', {}, sessionId);
          return;
        }
        if (payload.method === 'Network.requestWillBeSent' && data?.request?.url === `${url}${model.slice(1)}`) tracked.add(data.requestId);
        if (!tracked.has(data?.requestId)) return;
        const eventName = payload.method.split('.')[1];
        if (!['requestWillBeSent', 'responseReceived', 'loadingFinished', 'loadingFailed'].includes(eventName)) return;
        workerEvents.push({ event: eventName, nodeMs: clock(), sessionId, requestId: data.requestId,
          timestamp: data.timestamp, url: data.request?.url ?? data.response?.url,
          status: data.response?.status, encodedDataLength: data.encodedDataLength,
          errorText: data.errorText, canceled: data.canceled, blockedReason: data.blockedReason });
      }
    });
    send(1, 'Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
    send(2, 'Target.setDiscoverTargets', { discover: true });
    await delay(100);
  }
  const childEnv = { ...process.env, AEROBEAT_FRIEND_GAME_QA_URL: url };
  delete childEnv.AEROBEAT_STARTUP_SHAPE;
  delete childEnv.AEROBEAT_FRIEND_GAME_QA_SNAPSHOT_DIR;
  if (selection !== 'control') childEnv.AEROBEAT_FRIEND_GAME_QA_SNAPSHOT_DIR = selection;
  if (process.env.AEROBEAT_STARTUP_TRACE === '1') childEnv.AEROBEAT_STARTUP_TRACE = '1';
  else delete childEnv.AEROBEAT_STARTUP_TRACE;
  if (workerTrace) { childEnv.AEROBEAT_STARTUP_TRACE_WORKER = '1'; childEnv.AEROBEAT_STARTUP_CDP_URL = cdpOrigin; }
  else { delete childEnv.AEROBEAT_STARTUP_TRACE_WORKER; delete childEnv.AEROBEAT_STARTUP_CDP_URL; }
  delete childEnv.AEROBEAT_STARTUP_DEBUG_EOF;
  const child = spawn(process.execPath, [fileURLToPath(new URL('./measure-friend-game-startup.js', import.meta.url))], {
    cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '', errors = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => { output += text; if (output.length > 512_000) child.kill(); });
  child.stderr.on('data', text => { errors += text; if (errors.length > 32_000) child.kill(); });
  let childTimeout;
  const exit = await Promise.race([
    new Promise((done, reject) => { child.once('error', reject); child.once('close', (code, signal) => done({ code, signal })); }),
    ...(debugEof ? [new Promise((_, reject) => { childTimeout = setTimeout(() => {
      child.kill('SIGKILL'); reject(Error('EOF debugger child exceeded 120s'));
    }, 120_000); })] : [])
  ]).finally(() => { if (childTimeout) clearTimeout(childTimeout); });
  if (process.env.AEROBEAT_STARTUP_TRACE === '1' && errors) console.error(errors.slice(-24_000));
  if (exit.code !== 0) {
    const diagnosis = { selection, signedManifestSha256: manifestSha256, serverEvents: events, workerEvents, ...(debugEof ? { debugFailures } : {}),
      child: { exitCode: exit.code, signal: exit.signal, stderr: errors.slice(-4000), stdoutTail: output.slice(-1000) } };
    console.error(JSON.stringify(diagnosis, null, 2));
  }
  assert.equal(exit.code, 0, 'signed browser runner failed; diagnostics printed without relaxing its assertions');
  const browser = JSON.parse(output);
  if (workerTrace) assert(workerEvents.some(item => item.event === 'requestWillBeSent'), `Worker CDP model request was not captured; trace inconclusive: ${JSON.stringify(workerEvents)}`);
  if (debugEof) {
    assert.deepEqual(debugFailures, [], 'signed Worker debugger events must bind cleanly');
    assert.equal(pendingDebug.size, 0, 'all signed Worker debugger protocol replies required');
    assert.equal(earlyResolved.size, 0, 'all early breakpoint resolutions must match signed Worker');
    assert.equal(targetSessions.size, 2, 'exactly two signed Worker debugger sessions required');
    assert.equal(workerEvents.filter(item => item.event === 'signedScriptParsed').length, 2, 'signed Worker script parsed in both pages');
    for (const sessionId of targetSessions.keys()) {
      const eventsForSession = workerEvents.filter(item => item.sessionId === sessionId);
      for (const [line, [boundary]] of eofBreakpoints) {
        assert(eventsForSession.some(item => item.event === 'breakpointBound' && item.line === line), `signed ${boundary} breakpoint not bound`);
      }
      const requiredBoundaries = debugMode === '2' ? ['upstreamEofBranch', 'loaded']
        : ['upstreamEofBranch', 'shaCompare', 'verifiedPost', 'observedClose', 'integritySettled', 'integrityResolve', 'loaded'];
      for (const boundary of requiredBoundaries) {
        assert(eventsForSession.some(item => item.event === 'paused' && item.boundary === boundary &&
          (boundary !== 'upstreamEofBranch' || item.scalars?.done === true)), `signed ${boundary} boundary not captured`);
      }
      if (debugMode === '2') {
        const eofPauses = eventsForSession.filter(item => item.event === 'paused' && item.boundary === 'upstreamEofBranch');
        assert(eofPauses.every(item => item.scalars?.done === true),
          `conditional EOF breakpoint paused before EOF: ${JSON.stringify(eofPauses.slice(0, 8))}`);
      }
    }
  }
  assert.equal(browser.signed.manifestSha256, manifestSha256, 'browser used this exact signed snapshot');
  assert.equal(browser.signed.origin, 'http://127.0.0.1:4201');
  assert.equal(browser.results.length, 2, 'first page and second new page in same context');
  for (const path of assets) assert.equal(counts[path], 2, `${path}: one logical GET per browser page`);
  assert(events.every(item => item.finishMs !== null && item.abortedMs === undefined), 'all signed responses finished');
  assert(events.filter(item => item.path === model).every(item => item.chunks.length === schedule.modelChunks && item.chunks.reduce((total, chunk) => total + chunk.bytes, 0) === snapshot.bytes.get(model).length), 'eight model chunks preserve signed bytes');
  console.log(JSON.stringify({ selection, signedManifestSha256: manifestSha256, schedule, counts, serverEvents: events, ...(workerTrace ? { workerEvents } : {}),
    ...(debugEof ? { debuggerMode: debugMode, debuggerCaveat: 'Cause-only pause/resume instrumentation changes Worker timing; no speed conclusion from this run.' } : {}),
    browser: { signed: browser.signed, results: browser.results.map(result => ({ mode: result.mode,
      nodeClockFromClickObservationMs: result.nodeClockFromClickObservationMs,
      browserClockFromTrustedClickMs: result.browserClockFromTrustedClickMs,
      totalRequests: result.totalRequests, workerAssetCounts: Object.fromEntries(assets.map(path => [path, result.workerAssets[`GET ${path}`]?.count ?? 0])),
      endState: result.endState, caveat: result.caveat })) },
    caveat: 'One Node clock measures signed HTTP request/header/finish windows; browser runner uses its own Node observations and separate browser click clock. Synthetic T-pose is not physical tracking. Uncompressed decoded-byte local schedule is not public relay/Brotli or phone throughput.' }, null, 2));
} finally {
  for (const timer of pauseTimers) clearTimeout(timer);
  rawWs?.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    const exited = await Promise.race([new Promise(done => chrome.once('exit', () => done(true))), delay(1500).then(() => false)]);
    if (!exited && chrome.exitCode === null) chrome.kill('SIGKILL');
    if (chrome.exitCode === null) await Promise.race([new Promise(done => chrome.once('exit', done)), delay(1500)]);
  }
  if (profile) {
    for (let attempt = 0; attempt < 20; attempt++) {
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 }); break; }
      catch (error) { if (attempt === 19) throw error; await delay(100); }
    }
  }
  server.closeAllConnections();
  await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
  assert.equal(active, 0, 'no unfinished asset responses');
}
