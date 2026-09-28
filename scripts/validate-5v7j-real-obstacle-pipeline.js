// @ts-check
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inspectBeatSaverArchive } from "@aerobeat/web-vendor-beatsaver";
import { createAeroWebContentAuthoringService, validateAuthoredPackage } from "@aerobeat/web-content-authoring";
import { createAeroContentRuntime } from "@aerobeat/web-content";
import { createAeroGameplaySessionCoordinator } from "@aerobeat/web-gameplay";
import { projectSessionTargets } from "../src/session-render-projection.js";

// Optional real archives are transient. Supply AEROBEAT_5V7J_UNSHATTER_ZIP and
// AEROBEAT_5V7J_GOLDEN_ZIP to replay the exact downloaded BeatSaver versions.
const maps = [
  { id: "468dd", name: "Unshatter", hash: "dbbf28a2ee3893e14be55483428bc965fd85e476", difficulty: "ExpertPlus", obstacleCount: 110, environment: "AEROBEAT_5V7J_UNSHATTER_ZIP" },
  { id: "48088", name: "Golden", hash: "a7922d874d944d2b16ccabf65e04c3eb0f40ae06", difficulty: "Expert", obstacleCount: 5, environment: "AEROBEAT_5V7J_GOLDEN_ZIP" },
  { id: "48088", name: "Golden", hash: "a7922d874d944d2b16ccabf65e04c3eb0f40ae06", difficulty: "ExpertPlus", obstacleCount: 89, environment: "AEROBEAT_5V7J_GOLDEN_ZIP" }
];
const sources = new Map();
for (const map of maps) {
  let source = sources.get(map.id);
  if (!source) {
    const fixture = process.env[map.environment];
    const archive = fixture ? new Uint8Array(await readFile(fixture)) : await download(`https://cdn.beatsaver.com/${map.hash}.zip`);
    source = await inspectBeatSaverArchive(archive);
    sources.set(map.id, source);
  }
  const authoring = createAeroWebContentAuthoringService({ now: () => 1 });
  const runtime = createAeroContentRuntime({ persistenceResolver: authoring });
  const gameplay = createAeroGameplaySessionCoordinator({ sessionId: `5v7j-${map.id}-${map.difficulty}` });
  try {
    const authored = await authoring.convertAndPersist({ source }, { difficulty: map.difficulty, sourceProvider: "beatsaver", sourceId: map.id, sourceVersionHash: map.hash, includeAudio: true });
    const validation = await validateAuthoredPackage(authored.package);
    assert.equal(validation.valid, true, `${map.name} authoring package validates`);
    const authoredObstacles = authored.package.charts.find((chart) => chart.mode === "flow").beats.filter((beat) => beat.type === "obstacle");
    assert.equal(authoredObstacles.length, map.obstacleCount, `${map.name} ${map.difficulty}: side decorations omitted, in-grid obstacles retained`);
    await runtime.loadPersistenceHandle(authored.handle);
    const snapshot = runtime.getSnapshot();
    assert.equal(snapshot.state, "ready", `${map.name} ${map.difficulty} loads from durable authoring handle`);
    const flow = snapshot.variants.find((variant) => variant.mode === "flow");
    assert.ok(flow);
    await runtime.selectVariant(flow.variantId);
    for (const mode of ["flow", "boxing"]) {
      if (mode === "boxing") {
        const boxing = runtime.getSnapshot().variants.find((variant) => variant.mode === "boxing");
        assert.ok(boxing);
        await runtime.selectVariant(boxing.variantId);
      }
      const current = runtime.getSnapshot();
      assert.doesNotThrow(() => gameplay.configureContent({ packageId: current.packageId, selectedVariant: current.selectedVariant, resolvedEvents: current.resolvedEvents }), `${map.name} ${map.difficulty} configures ${mode} gameplay`);
      assert.equal(gameplay.requestStart(0, { schema: "aerobeat/gameplay_session_start", version: 1, purpose: "visual_test" }).accepted, true);
      assert.equal(gameplay.getSnapshot().session.state, "playing");
      if (mode === "flow" && authoredObstacles.length > 0) {
        const event = current.resolvedEvents.find((candidate) => candidate.authoredBeat?.type === "obstacle");
        assert.ok(event);
        const projected = projectSessionTargets([event], gameplay.getSnapshot(), event.intervalStartTimestampMs);
        assert.equal(projected[0]?.kind, "obstacle", `${map.name} ${map.difficulty}: obstacle reaches renderer projection`);
      }
    }
    console.log(`${map.name} ${map.difficulty}: ${authoredObstacles.length} obstacles; archive→authoring→persistence→content→Flow/Boxing gameplay→render projection passed`);
  } finally { gameplay.destroy(); runtime.destroy(); authoring.destroy(); }
}

/** @param {string} url */
async function download(url) {
  const response = await fetch(url, { headers: { "User-Agent": "BeatSaber/1.0", Referer: "https://beatsaver.com/" } });
  if (!response.ok) throw new Error(`BeatSaver ZIP request failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
