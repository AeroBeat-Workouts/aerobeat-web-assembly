// @ts-check
// Node-only normal-browser-gate regression: a genuinely persisted, signed legacy
// guard package must remain manageable but cannot become playable or be rewritten.
// No ZIP, copyrighted audio, camera data, or browser service is needed.
import assert from "node:assert/strict";
import {
  authoringPersistenceNamespace,
  canonicalJson,
  createAeroWebContentAuthoringService,
  createMemoryPersistenceAdapter,
  inspectAuthoredPackageExport,
  prefixedSha256
} from "@aerobeat/web-content-authoring";
import { createAeroContentRuntime, validateRuntimePackage } from "@aerobeat/web-content";

const map = new TextEncoder().encode(JSON.stringify({
  version: "3.3.0",
  colorNotes: [
    { b: 2, x: 1, y: 1, c: 0, d: 0 },
    { b: 2, x: 2, y: 1, c: 1, d: 0 },
    { b: 4, x: 1, y: 1, c: 0, d: 0 }
  ],
  bombNotes: [], obstacles: [], sliders: [], burstSliders: []
}));
const entries = new Map([["info.dat", new TextEncoder().encode("{}")], ["hard.dat", map]]);
const source = {
  manifest: {
    schemaId: "aerobeat.beatsaver-source-manifest.v2", infoFormatMajor: 2, infoFormat: "v2", infoVersion: "2.1.0",
    infoPath: "Info.dat", hashInputPaths: ["Hard.dat"], songName: "Synthetic Guard Regression",
    songSubName: "", songAuthorName: "", levelAuthorName: "", audioPath: "", coverPath: "",
    bpm: 120, previewStartSeconds: 0, previewDurationSeconds: 0,
    difficulties: [{ characteristic: "Standard", difficulty: "Hard", difficultyRank: 5,
      path: "Hard.dat", beatMapFormatMajor: 3, beatMapFormat: "v3", beatMapVersion: "3.3.0",
      notePalette: null, noteJumpMovementSpeed: 10, noteJumpStartBeatOffset: 0 }],
    entries: [], archiveBytes: 0, expandedBytes: 0
  },
  listEntryPaths() { return ["Info.dat", "Hard.dat"]; },
  readEntry(path) { return Uint8Array.from(entries.get(path.toLowerCase())); }
};
const persistence = createMemoryPersistenceAdapter();
const authoring = createAeroWebContentAuthoringService({ persistence });
const runtime = createAeroContentRuntime({ persistenceResolver: authoring });
try {
  const imported = await authoring.convertAndPersist({ source }, {
    difficulty: "Hard", sourceId: "synthetic-guard", sourceVersionHash: "local-test",
    includeAudio: false, cacheSourceEntries: true
  });
  const current = await authoring.loadPackage(imported.handle);
  const currentBoxing = current.package.charts.find((chart) => chart.mode === "boxing");
  const currentGuard = currentBoxing?.beats.find((beat) => beat.type === "guard");
  assert.ok(currentGuard, "real conversion must author a paired guard before the legacy record is constructed");
  assert.ok(currentGuard.guardTarget.leftCell % 4 <= 1 && currentGuard.guardTarget.rightCell % 4 >= 2,
    "conversion control is a same-side guard");
  const signedLegacy = structuredClone(current.package);
  const boxing = signedLegacy.charts.find((chart) => chart.mode === "boxing");
  const guard = boxing.beats.find((beat) => beat.eventId === currentGuard.eventId);
  const originalCells = [guard.guardTarget.leftCell, guard.guardTarget.rightCell];
  guard.guardTarget.leftCell = originalCells[1];
  guard.guardTarget.rightCell = originalCells[0];
  guard.guardTarget.crossed = true;
  guard.modifier = "crossed_guard";
  boxing.prototype.modifiers = [...new Set([...boxing.prototype.modifiers, "crossed_guard"])].sort();
  boxing.prototype.contentHash = await prefixedSha256(canonicalJson({
    beats: boxing.beats, sourceHash: boxing.prototype.sourceHash, rulesetId: boxing.prototype.rulesetId
  }));
  const legacyHash = await prefixedSha256(canonicalJson(signedLegacy));
  assert.notEqual(legacyHash, `sha256:${current.handle.packageHash.value}`, "legacy and current bytes have distinct identities");
  const key = "signed-legacy-guard-hard";
  await persistence.put({ key, package: signedLegacy, packageHash: legacyHash,
    assets: [], sourceCache: [], createdAtMs: 1, schemaVersion: persistence.schemaVersion, writeToken: key });
  const listed = await authoring.listPackages();
  assert.ok(listed.some((item) => item.key === key && item.packageHash === legacyHash), "historical signed package remains listed");
  const legacyHandle = { schema: "aerobeat/persistence_handle", version: 1,
    storage: "memory", namespace: authoringPersistenceNamespace, key, packageId: signedLegacy.packageId, packageHash: {
    schema: "aerobeat/content_hash", version: 1, algorithm: "sha256", value: legacyHash.slice(7)
  } };
  await assert.rejects(() => authoring.loadPackage(legacyHandle),
    (error) => error?.code === "crossed_guard_reimport_required",
    "authoring persistence blocks stale guard playback without changing its signed record");
  const exported = await authoring.exportPackage(legacyHandle);
  const inspected = await inspectAuthoredPackageExport(exported.bytes);
  assert.equal(inspected.packageHash, legacyHash, "export preserves the original signed package hash");
  assert.equal(inspected.packageId, signedLegacy.packageId);
  assert.deepEqual(inspected.assets, [], "neither ZIP nor audio is exported in this synthetic fixture");
  const metadataLength = new DataView(exported.bytes.buffer, exported.bytes.byteOffset).getUint32(8, true);
  const exportedMetadata = JSON.parse(new TextDecoder().decode(exported.bytes.subarray(12, 12 + metadataLength)));
  assert.deepEqual(exportedMetadata.package, signedLegacy, "export preserves historical bytes instead of silently rewriting guard roles");
  assert.equal(await prefixedSha256(canonicalJson(exportedMetadata.package)), legacyHash);
  await assert.rejects(() => validateRuntimePackage(signedLegacy, { declaredPackageHash: `sha256:${"f".repeat(64)}` }),
    (error) => error?.code === "package_hash_mismatch", "a false signature fails hash verification before crossing diagnosis");
  await assert.rejects(() => runtime.loadPersistenceHandle(legacyHandle),
    (error) => error?.code === "crossed_guard_reimport_required" && /reimport/i.test(error.message),
    "the real authoring export/persistence resolver path must reject this signed historic guard for playback");
  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.state, "error");
  assert.equal(snapshot.error?.code, "crossed_guard_reimport_required");
  assert.equal(snapshot.selectedVariant, null);
  assert.deepEqual(snapshot.resolvedEvents, []);
  assert.equal(snapshot.packageId, null);
  assert.doesNotMatch(JSON.stringify(snapshot), /(?:audioBytes|zipBytes|cameraFrame|crossed_guard.*leftCell)/u,
    "public error snapshot must not contain raw media or authored guard geometry");
  const after = await persistence.getForExport(key);
  assert.equal(after?.packageHash, legacyHash, "failed playback never changes the stored package signature");
  assert.equal(await prefixedSha256(canonicalJson(after.package)), legacyHash,
    "failed playback never changes the canonical package bytes");
  assert.deepEqual(after.package, signedLegacy, "failed playback never edits historic chart content");
  assert.equal(await authoring.deletePackage(legacyHandle), true, "rejected package remains deletable");
  assert.equal((await authoring.listPackages()).some((item) => item.key === key), false);
  assert.equal((await authoring.listPackages()).some((item) => item.key === imported.handle.key), true,
    "deleting stale content preserves the newly-authored control package");
  console.log("Signed legacy guard persisted package: hash verified, unchanged export/list, playback reimport refusal, safe delete PASS");
} finally {
  runtime.destroy();
  authoring.destroy();
  persistence.destroy();
}
