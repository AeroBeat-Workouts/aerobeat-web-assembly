// @ts-check
// A real connected component emits the bounded content_changed event. The
// scored-song Play oracle separately checks the natural 97+ judged-ID trigger.
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { handlerForSnapshot, loadSignedSnapshot } from "./serve-friend-game.js";

const signedDirectory = process.env.AEROBEAT_ARRAY_SIGNED_DIR;
const vite = signedDirectory ? null : await createViteServer({ logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false } });
let gameServer, parent, browser;
try {
  let url;
  if (vite) { await vite.listen(); url = vite.resolvedUrls?.local?.[0]; }
  else {
    const snapshot = loadSignedSnapshot(path.resolve(signedDirectory));
    gameServer = createHttpServer(handlerForSnapshot(snapshot));
    await new Promise(resolve => gameServer.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${gameServer.address().port}/`;
  }
  assert.ok(url);
  parent = createHttpServer((_request, response) => { response.setHeader("content-type", "text/html; charset=utf-8"); response.end(`<!doctype html><iframe src="${url}" style="width:390px;height:844px"></iframe>`); });
  await new Promise(resolve => parent.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch();
  for (const embedding of ["direct", "iframe"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(embedding === "direct" ? url : `http://localhost:${parent.address().port}/`, { waitUntil: "networkidle" });
      const frame = embedding === "direct" ? page : page.frames().find(item => item !== page.mainFrame());
      assert.ok(frame);
      const game = frame.locator("aero-game"); await game.waitFor();
      const result = await game.evaluate(element => {
        const original = element.getSnapshot.bind(element), events = [];
        element.addEventListener("aero-game-event", event => { if (event.detail.type === "content_changed") events.push(event.detail); });
        try {
          const baseline = original();
          if (baseline.lifecycle !== "connected" || !baseline.services?.content?.playback) throw Error("Connected content snapshot unavailable");
          const emit = count => {
            const ids = Object.freeze(Array.from({ length: count }, (_, index) => `event-${index}`));
            const content = Object.freeze({ ...baseline.services.content, playback: Object.freeze({ ...baseline.services.content.playback, judgedEventIds: ids, activeEventIds: Object.freeze([]) }) });
            // Test-owned public snapshot stimulus. Do not mutate the song,
            // private input/scoring state, or the production serializer.
            element.getSnapshot = () => Object.freeze({ ...baseline, services: Object.freeze({ ...baseline.services, content }) });
            const event = element.publish("content_changed");
            return { rawCount: element.getSnapshot().services.content.playback.judgedEventIds.length, emitted: events.at(-1)?.payload?.snapshot?.playback, result: event };
          };
          const within = emit(96), overflow = emit(101);
          return {
            within: { raw: within.rawCount, judged: within.emitted?.judgedEventIds?.length, countPresent: Object.hasOwn(within.emitted ?? {}, "judgedEventCount") },
            overflow: { raw: overflow.rawCount, judged: overflow.emitted?.judgedEventIds?.length, judgedCount: overflow.emitted?.judgedEventCount, activeCount: overflow.emitted?.activeEventCount, firstId: overflow.emitted?.judgedEventIds?.[0], lastId: overflow.emitted?.judgedEventIds?.at(-1) },
            eventCount: events.length
          };
        } finally { element.getSnapshot = original; }
      });
      assert.deepEqual(result.within, { raw: 96, judged: 96, countPresent: false });
      assert.deepEqual(result.overflow, { raw: 101, judged: 96, judgedCount: 101, activeCount: 0, firstId: "event-0", lastId: "event-95" });
      assert.equal(result.eventCount, 2);
      assert.deepEqual(errors, [], `${embedding}: no page errors`);
      console.log(`${embedding}: bounded content_changed after 101 IDs: PASS`);
    } finally { await context.close(); }
  }
} finally {
  await browser?.close();
  if (parent) await new Promise(resolve => parent.close(resolve));
  if (gameServer) await new Promise(resolve => gameServer.close(resolve));
  await vite?.close();
}
