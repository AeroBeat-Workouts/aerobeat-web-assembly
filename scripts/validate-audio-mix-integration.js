// @ts-check

import { readFile, stat } from "node:fs/promises";
import { createServer as createStaticServer } from "node:http";
import { extname, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";

const vite = await createViteServer({ appType:"spa", configFile:"vite.config.js", logLevel:"error", server:{ host:"127.0.0.1", port:0 } });
await vite.listen();
const url = vite.resolvedUrls?.local?.[0];
if (!url) throw new Error("Vite URL unavailable");
const browser = await chromium.launch(); const context = await browser.newContext();
const pageA = await context.newPage(); const pageB = await context.newPage(); const noise = [];
for (const page of [pageA, pageB]) {
  page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${message.type()}:${message.text()}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
}
try {
  await pageA.addInitScript(() => { try { localStorage.removeItem("aerobeat.audio-mix.v1"); } catch {} });
  await pageA.goto(url, { waitUntil:"networkidle" });
  await installTwoTrackedGames(pageA, "a");
  const initial = await pageA.evaluate(() => {
    const games = [...document.querySelectorAll("aero-game")];
    return games.map((game) => ({ log:globalThis.__mixLogs[game.instanceId], graph:game.graph.audio.getMixSnapshot(), transport:structuredClone(game.shadowRoot.querySelector("aero-visual-test-transport").transportSnapshot) }));
  });
  assert(initial.length === 2 && initial.every((entry) => entry.log[0] === "setMix:0.5:0.5" && entry.graph.musicVolume === 0.5 && entry.graph.sfxVolume === 0.5), `fresh graphs did not apply defaults first: ${JSON.stringify(initial)}`);
  assert(initial.every((entry) => JSON.stringify(Object.keys(entry.transport)) === JSON.stringify(["active","playing","currentMs","durationMs","musicVolume","soundVolume"]) && entry.transport.musicVolume === 0.5 && entry.transport.soundVolume === 0.5), `exact six-field defaults missing: ${JSON.stringify(initial)}`);

  const updateA = await pageA.evaluate(() => {
    const games = [...document.querySelectorAll("aero-game")]; const events = []; games[0].addEventListener("aero-game-event", (event) => events.push(event.detail));
    const transport = games[0].shadowRoot.querySelector("aero-visual-test-transport");
    transport.dispatchEvent(new CustomEvent("aero:ui:intent", { bubbles:true, composed:true, detail:Object.freeze({ type:"visual-test-music-volume", payload:Object.freeze({ volume:0.285 }) }) }));
    transport.dispatchEvent(new CustomEvent("aero:ui:intent", { bubbles:true, composed:true, detail:Object.freeze({ type:"visual-test-sound-volume", payload:Object.freeze({ volume:0.725 }) }) }));
    return { stored:localStorage.getItem("aerobeat.audio-mix.v1"), events, games:games.map((game) => ({ mix:game.graph.audio.getMixSnapshot(), transport:structuredClone(game.shadowRoot.querySelector("aero-visual-test-transport").transportSnapshot), log:[...globalThis.__mixLogs[game.instanceId]], publicSnapshot:game.getSnapshot() })) };
  });
  assert(updateA.stored === '{"musicVolume":0.29,"sfxVolume":0.73}', `exact persisted pair mismatch: ${updateA.stored}`);
  assert(updateA.events.length === 0, `volume changes emitted public events: ${JSON.stringify(updateA.events)}`);
  assert(updateA.games.every((entry) => entry.mix.musicVolume === 0.29 && entry.mix.sfxVolume === 0.73 && entry.transport.musicVolume === 0.29 && entry.transport.soundVolume === 0.73), `same-document fanout failed: ${JSON.stringify(updateA.games)}`);
  assert(!/musicVolume|sfxVolume|soundVolume|aerobeat\.audio-mix/iu.test(JSON.stringify(updateA.games.map((entry) => entry.publicSnapshot))), "mix leaked into public game snapshots");

  const hostile = await pageA.evaluate(() => {
    const game = document.querySelector("aero-game"); const before = game.graph.audio.getMixSnapshot(); let getterCalls = 0;
    const transport = game.shadowRoot.querySelector("aero-visual-test-transport");
    const payload = Object.create(null, { volume:{ enumerable:true, get(){ getterCalls += 1; return 0.4; } } });
    transport.dispatchEvent(new CustomEvent("aero:ui:intent", { bubbles:true, composed:true, detail:{ type:"visual-test-music-volume", payload } }));
    transport.dispatchEvent(new CustomEvent("aero:ui:intent", { bubbles:true, composed:true, detail:{ type:"visual-test-music-volume", payload:{ volume:2 } } }));
    transport.dispatchEvent(new CustomEvent("aero:ui:intent", { bubbles:true, composed:true, detail:{ type:"visual-test-music-volume", payload:{ volume:0.4, extra:true } } }));
    return { before, after:game.graph.audio.getMixSnapshot(), getterCalls, stored:localStorage.getItem("aerobeat.audio-mix.v1") };
  });
  assert(hostile.getterCalls === 0 && JSON.stringify(hostile.before) === JSON.stringify(hostile.after) && hostile.stored === updateA.stored, `hostile intent changed mix: ${JSON.stringify(hostile)}`);

  await pageB.goto(url, { waitUntil:"networkidle" });
  await installTwoTrackedGames(pageB, "b");
  const restoredB = await pageB.evaluate(() => [...document.querySelectorAll("aero-game")].map((game) => ({ mix:game.graph.audio.getMixSnapshot(), first:globalThis.__mixLogs[game.instanceId][0] })));
  assert(restoredB.every((entry) => entry.mix.musicVolume === 0.29 && entry.mix.sfxVolume === 0.73 && entry.first === "setMix:0.29:0.73"), `cross-document reload did not restore before playback: ${JSON.stringify(restoredB)}`);

  await pageA.evaluate(() => { globalThis.__storageWrites=0; const original=Storage.prototype.setItem; globalThis.__originalSetItem=original; Storage.prototype.setItem=function(...args){globalThis.__storageWrites+=1;return original.apply(this,args);}; });
  await pageB.evaluate(() => { globalThis.__storageWrites=0; const original=Storage.prototype.setItem; globalThis.__originalSetItem=original; Storage.prototype.setItem=function(...args){globalThis.__storageWrites+=1;return original.apply(this,args);}; });
  await pageA.evaluate(() => { const game=document.querySelector("aero-game"),transport=game.shadowRoot.querySelector("aero-visual-test-transport");transport.dispatchEvent(new CustomEvent("aero:ui:intent",{bubbles:true,composed:true,detail:{type:"visual-test-music-volume",payload:{volume:0.84}}})); });
  await pageB.waitForFunction(() => document.querySelector("aero-game")?.graph.audio.getMixSnapshot().musicVolume === 0.84);
  const crossA = await pageA.evaluate(() => ({ writes:globalThis.__storageWrites, mixes:[...document.querySelectorAll("aero-game")].map((game)=>game.graph.audio.getMixSnapshot()) }));
  const crossB = await pageB.evaluate(() => ({ writes:globalThis.__storageWrites, mixes:[...document.querySelectorAll("aero-game")].map((game)=>game.graph.audio.getMixSnapshot()) }));
  assert(crossA.writes === 1 && crossB.writes === 0 && [...crossA.mixes,...crossB.mixes].every((mix)=>mix.musicVolume===0.84&&mix.sfxVolume===0.73), `cross-document sync/writeback failed: ${JSON.stringify({crossA,crossB})}`);

  const disconnected = await pageA.evaluate(() => { const games=[...document.querySelectorAll("aero-game")],removed=games[1],id=removed.instanceId;globalThis.__removedMixGame=removed;globalThis.__removedMixOldLog=globalThis.__mixLogs[id];removed.remove();return{id,calls:globalThis.__removedMixOldLog.length}; });
  await pageB.evaluate(() => { const game=document.querySelector("aero-game"),transport=game.shadowRoot.querySelector("aero-visual-test-transport");transport.dispatchEvent(new CustomEvent("aero:ui:intent",{bubbles:true,composed:true,detail:{type:"visual-test-sound-volume",payload:{volume:0.16}}})); });
  await pageA.waitForFunction(() => document.querySelector("aero-game")?.graph.audio.getMixSnapshot().sfxVolume === 0.16);
  const disconnectedAfter = await pageA.evaluate(async() => ({ calls:globalThis.__removedMixOldLog.length, subscriberCount:(await import("/src/audio-mix-coordinator.js")).aeroAudioMixCoordinator.subscribers.size, connectedMix:document.querySelector("aero-game").graph.audio.getMixSnapshot(), connectedTransport:structuredClone(document.querySelector("aero-game").shadowRoot.querySelector("aero-visual-test-transport").transportSnapshot) }));
  assert(disconnectedAfter.calls === disconnected.calls && disconnectedAfter.subscriberCount===1 && disconnectedAfter.connectedMix.sfxVolume === 0.16 && disconnectedAfter.connectedTransport.soundVolume === 0.16, `disconnect unsubscribe failed: ${JSON.stringify({disconnected,disconnectedAfter})}`);

  const reconnected = await pageA.evaluate(() => {
    const game=globalThis.__removedMixGame,parent=document.querySelector("aero-game")?.parentElement;
    if (!game || !parent) return null;
    const oldCalls=globalThis.__removedMixOldLog.length;
    parent.append(game);
    return { oldCalls };
  });
  await pageA.waitForFunction(() => document.querySelectorAll("aero-game").length===2&&[...document.querySelectorAll("aero-game")].every((game)=>game.getSnapshot().lifecycle==="connected"));
  const reconnectedAfter = await pageA.evaluate(async(id) => {
    const game=[...document.querySelectorAll("aero-game")].find((entry)=>entry.instanceId===id);
    return game ? { mix:game.graph.audio.getMixSnapshot(), transport:structuredClone(game.shadowRoot.querySelector("aero-visual-test-transport").transportSnapshot), calls:globalThis.__mixLogs[id].length, last:globalThis.__mixLogs[id].at(-1), oldCalls:globalThis.__removedMixOldLog.length, subscriberCount:(await import("/src/audio-mix-coordinator.js")).aeroAudioMixCoordinator.subscribers.size } : null;
  }, disconnected.id);
  assert(reconnected && reconnectedAfter && reconnectedAfter.oldCalls===reconnected.oldCalls && reconnectedAfter.subscriberCount===2 && reconnectedAfter.calls===1 && reconnectedAfter.last==="setMix:0.84:0.16" && reconnectedAfter.mix.musicVolume===0.84 && reconnectedAfter.mix.sfxVolume===0.16 && reconnectedAfter.transport.musicVolume===0.84 && reconnectedAfter.transport.soundVolume===0.16, `reconnect did not create one fresh current-mix subscription: ${JSON.stringify({reconnected,reconnectedAfter})}`);

  await verifyCurrentPopoverMatrix(browser, url, noise);
  await verifyTracked0031Defect(browser, noise);
} finally {
  for (const page of [pageA,pageB]) await page.close().catch(()=>{});
  await browser.close(); await vite.close();
}
if (noise.length) throw new Error(noise.join("\n"));
console.log("Global audio mix persistence, fanout, lifecycle and privacy validation passed.");

async function verifyCurrentPopoverMatrix(browser, sourceUrl, noise) {
  const contexts = [
    ["direct-portrait-dpr1", "direct", 390, 844, 1],
    ["direct-portrait-dpr3", "direct", 390, 844, 3],
    ["direct-landscape-dpr1", "direct", 844, 390, 1],
    ["direct-landscape-dpr3", "direct", 844, 390, 3],
    ["iframe-portrait-dpr1", "iframe", 390, 844, 1],
    ["iframe-portrait-dpr3", "iframe", 390, 844, 3],
    ["iframe-landscape-dpr1", "iframe", 844, 390, 1],
    ["iframe-landscape-dpr3", "iframe", 844, 390, 3]
  ];
  for (const [name, mode, width, height, deviceScaleFactor] of contexts) {
    const context = await browser.newContext({ viewport:{ width, height }, deviceScaleFactor });
    const page = await context.newPage();
    page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`${name}:${message.type()}:${message.text()}`); });
    page.on("pageerror", (error) => noise.push(`${name}:pageerror:${error.message}`));
    try {
      await page.goto(sourceUrl, { waitUntil:"networkidle" });
      let target = page;
      if (mode === "iframe") {
        await page.evaluate((url) => {
          const iframe = document.createElement("iframe");
          iframe.id = "assembly-popover-frame";
          iframe.src = url;
          iframe.style.cssText = "border:0;display:block;width:100vw;height:100vh";
          document.body.replaceChildren(iframe);
        }, sourceUrl);
        const handle = await page.waitForSelector("#assembly-popover-frame");
        const frame = await handle.contentFrame();
        if (!frame) throw new Error(`${name}: iframe unavailable`);
        target = frame;
      }
      await target.waitForFunction(() => { const game=document.querySelector("aero-game"); return typeof game?.getSnapshot === "function" && game.getSnapshot().lifecycle === "connected"; });
      const result = await target.evaluate(() => {
        const game = document.querySelector("aero-game");
        const transport = game?.shadowRoot?.querySelector("aero-visual-test-transport");
        const button = transport?.shadowRoot?.querySelector("button[data-role='volume-toggle']");
        const popover = transport?.shadowRoot?.querySelector(".volume-popover");
        if (!(game instanceof HTMLElement) || !(transport instanceof HTMLElement) || !(button instanceof HTMLButtonElement) || !(popover instanceof HTMLElement)) return null;
        const snapshot = Object.freeze({ active:true, playing:false, currentMs:0, durationMs:10_000, musicVolume:0.29, soundVolume:0.73 });
        const read = () => {
          const rect = popover.getBoundingClientRect();
          return { connected:popover.isConnected, hidden:popover.hidden, display:getComputedStyle(popover).display, geometry:[rect.width, rect.height, popover.getClientRects().length], expanded:button.getAttribute("aria-expanded"), values:[...transport.shadowRoot.querySelectorAll("input[data-role$='-volume']")].map((input) => input.value) };
        };
        const open = () => { if (popover.hidden) button.click(); return read(); };
        const close = () => { if (!popover.hidden) button.click(); };
        transport.setSnapshot(snapshot);
        close();
        const states = { default:read(), opens:[], closures:{} };

        states.opens.push(open()); button.click(); states.closures.button = read();
        states.opens.push(open()); document.querySelector("main")?.dispatchEvent(new PointerEvent("pointerdown", { bubbles:true, composed:true, pointerType:"mouse" })); states.closures.outsidePointer = read();
        states.opens.push(open()); document.querySelector("main")?.dispatchEvent(new MouseEvent("click", { bubbles:true, composed:true })); states.closures.outsideClick = read();
        states.opens.push(open()); document.dispatchEvent(new KeyboardEvent("keydown", { key:"Escape", bubbles:true, composed:true })); states.closures.escape = read();
        states.opens.push(open()); transport.setSnapshot({ ...snapshot, active:false }); states.closures.inactive = read();
        transport.setSnapshot(snapshot); states.closures.reactivated = read();
        states.opens.push(open());
        const parent = game.parentElement;
        game.remove();
        states.closures.detach = read();
        parent?.append(game);
        states.closures.reconnect = read();
        return states;
      });
      assert(result, `${name}: assembly transport unavailable`);
      assertClosed(result.default, `${name}:default`);
      for (const [path, state] of Object.entries(result.closures)) assertClosed(state, `${name}:${path}`);
      for (const [index, state] of result.opens.entries()) {
        assert(state.hidden === false && state.display === "grid" && state.geometry[0] > 0 && state.geometry[1] > 0 && state.geometry[2] > 0 && state.expanded === "true", `${name}:open-${index} did not render as a nonzero grid: ${JSON.stringify(state)}`);
        assert(JSON.stringify(state.values) === JSON.stringify(["0.29", "0.73"]), `${name}:open-${index} changed volume truth: ${JSON.stringify(state)}`);
      }
    } finally {
      await context.close();
    }
  }
}

async function verifyTracked0031Defect(browser, noise) {
  const root = resolve("release", "raw", "0.0.31");
  const mime = Object.freeze({ ".css":"text/css", ".html":"text/html", ".js":"text/javascript", ".json":"application/json", ".map":"application/json", ".svg":"image/svg+xml" });
  const server = createStaticServer(async(request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      const filePath = resolve(root, pathname === "/" ? "index.html" : `.${pathname}`);
      if (!filePath.startsWith(`${root}/`) && filePath !== resolve(root, "index.html")) throw new Error("outside release root");
      if (!(await stat(filePath)).isFile()) throw new Error("not a file");
      response.setHeader("content-type", mime[extname(filePath)] ?? "application/octet-stream");
      response.end(await readFile(filePath));
    } catch {
      response.statusCode = 404;
      response.end("not found");
    }
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Historical release server unavailable");
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:3 });
  page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().includes("GL Driver Message")) noise.push(`raw-0.0.31:${message.type()}:${message.text()}`); });
  page.on("pageerror", (error) => noise.push(`raw-0.0.31:pageerror:${error.message}`));
  try {
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil:"networkidle" });
    const result = await page.evaluate(() => {
      const transport = document.querySelector("aero-game")?.shadowRoot?.querySelector("aero-visual-test-transport");
      transport?.setSnapshot({ active:true, playing:false, currentMs:0, durationMs:10_000, musicVolume:0.5, soundVolume:0.5 });
      const button = transport?.shadowRoot?.querySelector("button[data-role='volume-toggle']");
      const popover = transport?.shadowRoot?.querySelector(".volume-popover");
      if (!(button instanceof HTMLButtonElement) || !(popover instanceof HTMLElement)) return null;
      const read = () => { const rect=popover.getBoundingClientRect(); return { hidden:popover.hidden, display:getComputedStyle(popover).display, geometry:[rect.width, rect.height, popover.getClientRects().length] }; };
      const closed = read(); button.click(); const open = read(); button.click(); const reclosed = read();
      return { closed, open, reclosed };
    });
    assert(result && result.closed.hidden && result.reclosed.hidden, `Tracked raw 0.0.31 did not expose the expected logical closed state: ${JSON.stringify(result)}`);
    for (const [path, state] of Object.entries({ default:result.closed, button:result.reclosed })) assert(state.display === "grid" && state.geometry[0] > 0 && state.geometry[1] > 0 && state.geometry[2] > 0, `Tracked raw 0.0.31 no longer reproduces always-painted defect at ${path}: ${JSON.stringify(state)}`);
    assert(result.open.hidden === false && result.open.display === "grid" && result.open.geometry.every((value) => value > 0), `Tracked raw 0.0.31 open state was not rendered: ${JSON.stringify(result.open)}`);
  } finally {
    await page.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

function assertClosed(state, label) {
  const computedDisplayIsClosed = state.connected ? state.display === "none" : state.display === "";
  assert(state.hidden === true && computedDisplayIsClosed && state.geometry.every((value) => value === 0) && state.expanded === "false", `${label} popover remained physically rendered: ${JSON.stringify(state)}`);
}

async function installTwoTrackedGames(page, prefix) {
  await page.locator("aero-game").waitFor();
  await page.evaluate((prefix) => {
    const seed=document.querySelector("aero-game"),factory=seed.serviceGraphFactory,parent=seed.parentElement;seed.remove();globalThis.__mixLogs={};
    for(let index=0;index<2;index+=1){const game=document.createElement("aero-game");game.setAttribute("instance-id",`${prefix}-${index}`);game.serviceGraphFactory=(options)=>{const graph=factory(options),log=globalThis.__mixLogs[options.instanceId]=[],source=graph.audio;const audio=Object.freeze({...source,setMix(value){log.push(`setMix:${value.musicVolume}:${value.sfxVolume}`);return source.setMix(value)},async load(...args){log.push("load");return source.load(...args)},async play(...args){log.push("play");return source.play(...args)}});return Object.freeze({...graph,audio});};parent.append(game);}
  }, prefix);
  await page.waitForFunction(() => document.querySelectorAll("aero-game").length === 2 && [...document.querySelectorAll("aero-game")].every((game)=>game.getSnapshot().lifecycle === "connected"));
}
function assert(value, message) { if (!value) throw new Error(message); }
