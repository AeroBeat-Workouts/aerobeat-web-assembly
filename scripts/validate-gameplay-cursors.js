// @ts-check

import { createServer as createHttpServer } from "node:http";
import { cameraPreviewToAthlete } from "@aerobeat/web-contracts";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const parentServer = createHttpServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://parent.invalid");
  const width = Number(url.searchParams.get("width")) || 390; const height = Number(url.searchParams.get("height")) || 844;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(`<!doctype html><style>html,body{margin:0}iframe{border:0;display:block;width:${width}px;height:${height}px}</style><iframe id="game" allow="camera; fullscreen; autoplay" src="${childUrl}"></iframe>`);
});
await new Promise((resolve) => parentServer.listen(0, "127.0.0.1", resolve));
const address = parentServer.address();
if (!address || typeof address === "string") throw new Error("Parent server unavailable");
const parentUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch();
const contexts = [
  { kind:"direct",width:390,height:844,dpr:1 }, { kind:"direct",width:390,height:844,dpr:3 },
  { kind:"direct",width:844,height:390,dpr:1 }, { kind:"direct",width:844,height:390,dpr:3 },
  { kind:"iframe",width:390,height:844,dpr:1 }, { kind:"iframe",width:390,height:844,dpr:3 },
  { kind:"iframe",width:844,height:390,dpr:1 }, { kind:"iframe",width:844,height:390,dpr:3 }
];
const evidence = [];
try {
  for (const context of contexts) evidence.push(await runContext(context));
  console.log(`Gameplay cursor integration passed: ${evidence.map((item) => `${item.kind}:${item.width}x${item.height}@${item.dpr}`).join(", ")}`);
} finally {
  await browser.close(); await vite.close(); await new Promise((resolve) => parentServer.close(resolve));
}

async function runContext(context) {
  const browserContext = await browser.newContext({ viewport: context.kind === "direct" ? { width:context.width,height:context.height } : { width:context.width + 24,height:context.height + 24 }, deviceScaleFactor:context.dpr });
  const page = await browserContext.newPage(); const noise = [];
  page.on("console", (message) => { if (["warning","error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
  let game;
  if (context.kind === "direct") { await page.goto(childUrl, { waitUntil:"networkidle" }); game = page.locator("aero-game"); }
  else { await page.goto(`${parentUrl}?width=${context.width}&height=${context.height}`, { waitUntil:"networkidle" }); game = page.frameLocator("#game").locator("aero-game"); }
  await game.waitFor();
  const athleteLeftWrist = cameraPreviewToAthlete({ x: 0.1, y: 0.47 });
  const result = await game.evaluate((element, athleteLeftWrist) => {
    const originalGraph = element.graph; const renderer = originalGraph.renderer; const originalFrame = renderer.renderGameplayFrame.bind(renderer); const originalCursors = renderer.renderGameplayCursors.bind(renderer);
    const calls = []; let lastPlan = null; let latestCursorCall = null;
    renderer.renderGameplayFrame = (frame) => { calls.push("gameplay"); const value = originalFrame(frame); lastPlan = value.plan; return value; };
    renderer.renderGameplayCursors = (cursors, options) => { calls.push("cursors"); latestCursorCall = { cursors:structuredClone(cursors), options:structuredClone(options) }; return originalCursors(cursors, options); };
    const cursorInput = (overrides = {}) => ({
      tracking:{ gameplayPaused:false,freshCalibrationRequired:false,allRequiredAnchorsVisible:true }, retainedGeometryDimmed:false,countdownFrozen:false,
      anchors:[
        { anchor:"nose",valid:true,x:.17,y:.23,confidence:.99 },
        { anchor:"left_wrist",valid:true,x:athleteLeftWrist.x,y:athleteLeftWrist.y,confidence:.98 },
        { anchor:"right_wrist",valid:true,x:.53,y:.71,confidence:.97 }
      ], ...overrides
    });
    const referenceCursors = cursorInput().anchors.map((anchor) => ({ role:anchor.anchor,x:anchor.x,y:anchor.y,confidence:anchor.confidence }));
    let input = cursorInput(); let session = { state:"playing",timelinePositionMs:0 };
    const content = { state:"ready",packageId:"cursor-fixture",selectedVariant:{ variantId:"cursor-flow",mode:"flow",rulesetId:"flow_grid_v1" },resolvedEvents:[] };
    const graph = { ...originalGraph, content:{ getSnapshot:()=>content }, gameplay:{ getSnapshot:()=>({ session }) }, input:{ getSnapshot:()=>input }, renderer };
    element.graph = graph; element.menuOpen = false;
    const render = (background, environment) => {
      element.environmentMode = environment; renderer.setBackgroundProjection({ kind:"solid",colors:[background],angleDeg:0 }); calls.length = 0; latestCursorCall = null; element.renderGameplay(graph);
      const gl = renderer.gl; const grid = lastPlan.grid; const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4); gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      const sample = (xCss, yCss) => { const x = Math.max(0,Math.min(gl.drawingBufferWidth - 1,Math.round(xCss * gl.drawingBufferWidth / renderer.widthCssPx))); const y = Math.max(0,Math.min(gl.drawingBufferHeight - 1,Math.round((renderer.heightCssPx - yCss) * gl.drawingBufferHeight / renderer.heightCssPx))); const index=(y*gl.drawingBufferWidth+x)*4; return [...pixels.slice(index,index+4)]; };
      const inspect = (cursor) => { const x=(grid.x+cursor.x*grid.width)*renderer.widthCssPx; const y=(grid.y+cursor.y*grid.height)*renderer.heightCssPx; return { role:cursor.role,x,y,center:sample(x,y),white:sample(x+5.5,y),black:sample(x+8,y),outside:sample(x+12,y) }; };
      const points = latestCursorCall.cursors.map(inspect); const probes = referenceCursors.map(inspect);
      return { order:[...calls],call:latestCursorCall,grid:structuredClone(grid),points,probes,environment,background,effectiveDpr:renderer.devicePixelRatio };
    };
    const dark = render("#071426","aero"); const light = render("#f5f5f5","camera");
    input = cursorInput({ tracking:{ gameplayPaused:true,freshCalibrationRequired:true,allRequiredAnchorsVisible:false },retainedGeometryDimmed:true,countdownFrozen:true });
    const stale = render("#071426","aero");
    input = cursorInput(); input.anchors[1] = { anchor:"left_wrist",valid:true,x:.9,y:.47,confidence:.2 }; const lowConfidence = render("#071426","aero");
    input = cursorInput(); element.menuOpen = true; const menu = render("#071426","aero");
    element.menuOpen = false; session = { state:"calibrating",timelinePositionMs:0 }; const calibrating = render("#071426","aero");
    session = { state:"countdown",timelinePositionMs:0 }; const countdown = render("#071426","aero");
    renderer.renderGameplayFrame = originalFrame; renderer.renderGameplayCursors = originalCursors; element.graph = originalGraph;
    const snapshotText = JSON.stringify(element.getSnapshot());
    return { dark,light,stale,lowConfidence,menu,calibrating,countdown,snapshotHasCursorPayload:/gameplayCursors|cursorRecords|cursorPixels/u.test(snapshotText),canvas:{ width:renderer.widthCssPx,height:renderer.heightCssPx },devicePixelRatio };
  }, athleteLeftWrist);
  const label = `${context.kind}:${context.width}x${context.height}@${context.dpr}`;
  for (const frame of [result.dark,result.light,result.countdown]) {
    assert(JSON.stringify(frame.order) === JSON.stringify(["gameplay","cursors"]), `${label} draw order must be gameplay then cursors: ${JSON.stringify(frame.order)}`);
    assert(frame.call.cursors.length === 3 && JSON.stringify(frame.call.cursors.map((cursor) => cursor.role)) === JSON.stringify(["nose","left_wrist","right_wrist"]), `${label} canonical cursor roles missing: ${JSON.stringify(frame.call)}`);
    assert(frame.call.cursors.every((cursor) => JSON.stringify(Object.keys(cursor).sort()) === JSON.stringify(["confidence","role","x","y"])), `${label} cursors must be exact bounded records: ${JSON.stringify(frame.call.cursors)}`);
    assert(JSON.stringify(frame.call.options.grid) === JSON.stringify(frame.grid) && frame.call.options.minConfidence === .5 && frame.call.options.sizeCssPx === 18, `${label} cursor options must use exact returned plan grid: ${JSON.stringify(frame.call.options)}`);
    assert(frame.call.cursors[1].x === .9 && frame.points[1].x > result.canvas.width / 2, `${label} camera x=.1 projected athlete x=.9 must remain on athlete-right without second mirror: ${JSON.stringify(frame.points[1])}`);
    for (const point of frame.points) {
      assert(isRoleColor(point.center), `${label} ${frame.environment} ${point.role} center must be role-colored at mapped centroid: ${JSON.stringify(point)}`);
      assert(point.white[0] >= 235 && point.white[1] >= 235 && point.white[2] >= 235 && point.white[3] === 255, `${label} ${frame.environment} ${point.role} needs white contrast ring: ${JSON.stringify(point)}`);
      assert(point.black[0] <= 80 && point.black[1] <= 80 && point.black[2] <= 80 && point.black[3] >= 220, `${label} ${frame.environment} ${point.role} needs black contrast ring: ${JSON.stringify(point)}`);
    }
  }
  assert(result.dark.call.cursors.map((cursor) => JSON.stringify(cursor)).join("|") === result.light.call.cursors.map((cursor) => JSON.stringify(cursor)).join("|"), `${label} Aero/Camera cursor coordinates must match`);
  assert(result.stale.call.cursors.length === 0 && result.menu.call.cursors.length === 0 && result.calibrating.call.cursors.length === 0, `${label} stale/menu/calibrating frames must redraw no cursors`);
  for (const frame of [result.stale,result.menu,result.calibrating]) assert(frame.probes.every((probe) => !isRoleColor(probe.center)), `${label} cleared frame must retain no prior cursor pixels: ${JSON.stringify(frame.probes)}`);
  assert(result.lowConfidence.call.cursors.length === 2 && !result.lowConfidence.call.cursors.some((cursor) => cursor.role === "left_wrist") && !isRoleColor(result.lowConfidence.probes[1].center), `${label} low-confidence cursor and pixels must be omitted: ${JSON.stringify(result.lowConfidence)}`);
  assert(result.countdown.call.cursors.length === 3, `${label} countdown must retain current calibrated gameplay cursors`);
  assert(!result.snapshotHasCursorPayload, `${label} cursor drawing must add no public cursor/media payload`);
  assert(result.dark.effectiveDpr === Math.min(context.dpr,2) && result.light.effectiveDpr === Math.min(context.dpr,2), `${label} renderer must preserve truthful DPR cap: ${JSON.stringify(result)}`);
  assert(noise.length === 0, `${label} emitted console noise: ${noise.join(" | ")}`);
  await browserContext.close(); return context;
}

function isRoleColor(color) { const [r,g,b,a] = color; return a === 255 && Math.max(r,g,b) >= 120 && Math.max(r,g,b) - Math.min(r,g,b) >= 35; }
function assert(value, message) { if (!value) throw new Error(message); }
