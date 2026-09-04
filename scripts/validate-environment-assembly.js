// @ts-check

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { build } from "vite";
import { listReleaseFingerprintInputs } from "./release-fingerprint.js";
import {
  defaultEnvironmentAssetId,
  environmentArtifactComparisonIds,
  environmentAssetCatalog,
  environmentAssetClassifications,
  environmentAssetFiles,
  normalizeEnvironmentConfig,
  normalizeEnvironmentTransform,
  serializeEnvironmentConfig
} from "../src/environment-asset-catalog.js";

const root = process.cwd();
const source = readFileSync("src/index.js", "utf8");
const catalogSource = readFileSync("src/environment-asset-catalog.js", "utf8");
const readme = readFileSync("README.md", "utf8");
const controlsBrowserSource = readFileSync("scripts/validate-environment-controls-browser.js", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const expectedPaths = environmentAssetFiles.map((entry) => entry.path).sort();
const expectedGameplayPaths = [
  "assets/gameplay/0.0.5/any-note/circle-v1.glb",
  "assets/gameplay/0.0.5/athlete-marker/sphere-v1.glb",
  "assets/gameplay/0.0.5/bomb/urchin-v1.glb",
  "assets/gameplay/0.0.5/directional-arrow/outline-v1.glb",
  "assets/gameplay/0.0.5/guard/shield-v1.glb",
  "assets/gameplay/0.0.5/inventory.v1.json",
  "assets/gameplay/0.0.5/manifests/any-note/circle-v1.v1.json",
  "assets/gameplay/0.0.5/manifests/athlete-marker/sphere-v1.v1.json",
  "assets/gameplay/0.0.5/manifests/bomb/urchin-v1.v1.json",
  "assets/gameplay/0.0.5/manifests/directional-arrow/outline-v1.v1.json",
  "assets/gameplay/0.0.5/manifests/guard/shield-v1.v1.json",
  "assets/gameplay/0.0.5/manifests/track/blue-glass-v1.v1.json",
  "assets/gameplay/0.0.5/manifests/wall/red-glass-v1.v1.json",
  "assets/gameplay/0.0.5/proof.v1.json",
  "assets/gameplay/0.0.5/sets/default-v1.json",
  "assets/gameplay/0.0.5/track/blue-glass-v1.glb",
  "assets/gameplay/0.0.5/wall/red-glass-v1.glb"
];
const ids = environmentAssetCatalog.map((entry) => entry.descriptor.id);
const rendererRoot = resolve(root, "../aerobeat-web-renderer");
const rendererCommit = "4153e963ce840b50b8f95e2be0679ed88ab8dded";
assert.equal(git(rendererRoot, ["rev-parse", "HEAD"]), rendererCommit, "linked renderer commit drifted");
assert.equal(git(rendererRoot, ["rev-parse", "HEAD^{tree}"]), "e77db3502dcfc39e7bd146df149dbab090b5178b", "linked renderer tree drifted");
assert.equal(git(rendererRoot, ["status", "--porcelain", "--untracked-files=no"]), "", "linked renderer tracked files are dirty");
assert.equal(git(rendererRoot, ["rev-parse", "HEAD:assets/gameplay/0.0.5"]), "000653eace4b93f3c5d2eef11bd5c8255008b3de", "linked gameplay raw tree drifted");
assert.deepEqual(git(rendererRoot, ["ls-tree", "-r", "--name-only", "HEAD", "assets/gameplay/0.0.5"]).split("\n"), expectedGameplayPaths, "linked gameplay member inventory drifted");
for (const path of expectedGameplayPaths) assert.deepEqual(readFileSync(path), readFileSync(resolve(rendererRoot, path)), `assembly gameplay runtime member drifted: ${path}`);
const rendererGameplaySource = readFileSync(resolve(rendererRoot, "src/gameplay-assets.js"), "utf8");
assert.match(rendererGameplaySource, /gameplayAssetSourceCommit="2bd4712f00dd65a758aa064d0e709131f8af8c64"/u);
assert.match(rendererGameplaySource, /gameplayAssetInventorySha256="4984cca24b8121bc6657153304726f1f7ef05d878ca5220f3c3e2b6f2457a102"/u);
assert.match(rendererGameplaySource, /gameplayAssetProofSha256="4aac2274a9803a05e9ff533c02958cf1c5def66e0af1bf2fae3cc4479319f350"/u);
const wallManifest = JSON.parse(readFileSync("assets/gameplay/0.0.5/manifests/wall/red-glass-v1.v1.json", "utf8"));
assert.deepEqual(wallManifest.geometry.dimensions, [0.94, 0.94, 1], "packaged moving wall must match the visible square-cell footprint");
assert.deepEqual(wallManifest.materials.contract.unit_cell_footprint, [0.94, 0.94]);
assert.deepEqual(wallManifest.materials.contract.cell_pitch, [1, 1]);
assert.deepEqual(wallManifest.materials.contract.adjacent_gap, [0.06, 0.06]);
assert.deepEqual(wallManifest.materials.contract.xy_scale_authoritative, [1, 1]);
assert.equal(wallManifest.materials.contract.z_scale_authoritative, true);

assert.equal(environmentAssetCatalog.length, 8);
assert.equal(environmentAssetFiles.length, 24);
assert.equal(new Set(ids).size, 8);
assert.equal(defaultEnvironmentAssetId, "alpine-river-valley-photosphere");
assert.equal(ids.at(-1), defaultEnvironmentAssetId, "default identity must not reorder the source catalog");
assert.match(catalogSource, /const defaultConfig = normalizeEnvironmentConfig\(packagedConfigs\[index\], id\)/u);
assert.doesNotMatch(catalogSource, /normalizeEnvironmentTransform\(\{ position:\{x:0,y:0,z:0\}/u, "catalog must not synthesize identity defaults");
assert.deepEqual(environmentAssetFiles.map(({ path }) => path).filter((path) => path.endsWith(".jpg")).length, 8);
assert.equal(expectedPaths.filter((path) => path.endsWith(".config.json")).length, 8);
assert.equal(expectedPaths.filter((path) => path.endsWith("/manifest.json")).length, 8);
for (const entry of environmentAssetCatalog) {
  assert(Object.isFrozen(entry) && Object.isFrozen(entry.descriptor) && Object.isFrozen(entry.descriptor.dimensions) && Object.isFrozen(entry.descriptor.centerForward) && Object.isFrozen(entry.descriptor.worldUp) && Object.isFrozen(entry.defaultConfig) && Object.isFrozen(entry.defaultConfig.transform) && Object.isFrozen(entry.defaultConfig.transform.position) && Object.isFrozen(entry.defaultConfig.transform.rotationDegrees) && Object.isFrozen(entry.files));
  assert.deepEqual(Object.keys(entry), ["label", "descriptor", "defaultConfig", "files"]);
  assert.deepEqual(Object.keys(entry.descriptor), ["id", "url", "mimeType", "bytes", "sha256", "projection", "dimensions", "centerForward", "worldUp"]);
  assert.equal(new URL(entry.descriptor.url).protocol, "file:");
  assert.match(new URL(entry.descriptor.url).pathname, new RegExp(`/assets/environments/${entry.descriptor.id}/1\\.0\\.0/${entry.descriptor.id}\\.jpg$`, "u"));
  for (const file of entry.files) { assert(Object.isFrozen(file)); assert.match(file.path, new RegExp(`^assets/environments/${entry.descriptor.id}/1\\.0\\.0/(?:${entry.descriptor.id}\\.(?:jpg|config\\.json)|manifest\\.json)$`, "u")); const bytes = readFileSync(file.path); assert.equal(bytes.byteLength, file.bytes); assert.equal(hash(bytes), file.sha256); }
  const configFile = entry.files.find(({ path }) => path.endsWith(".config.json")); const manifestFile = entry.files.find(({ path }) => path.endsWith("/manifest.json")); assert(configFile && manifestFile);
  const packagedConfig = JSON.parse(readFileSync(configFile.path, "utf8")); const manifest = JSON.parse(readFileSync(manifestFile.path, "utf8"));
  assert.deepEqual(entry.defaultConfig, normalizeEnvironmentConfig(packagedConfig, entry.descriptor.id), `packaged config is not runtime authority for ${entry.descriptor.id}`);
  assert.equal(manifest.id ?? manifest.asset_id, entry.descriptor.id);
  if (manifest.config) { assert.equal(manifest.config.sha256, configFile.sha256); assert.equal(manifest.config.bytes, configFile.bytes); }
  else assert.equal(entry.descriptor.id, "luminious-ice-cave-photosphere", "only the protected original manifest may use its legacy schema");
}
assert.equal(new Set(environmentAssetCatalog.map((entry) => entry.descriptor.url)).size, 8);
assert.equal(new Set(environmentAssetFiles.map(({ path }) => path)).size, 24);
assert.equal(new Set(environmentAssetFiles.map(({ sha256 }) => sha256)).size, 24);
assert.equal(Object.values(packageJson.exports).some((path) => String(path).includes("environment-asset-catalog")), false);
assert.equal(new Set(environmentAssetFiles.map(({ path, sha256 }) => `${path}\0${sha256}`)).size, 24);

const base = environmentAssetCatalog.find(({ descriptor }) => descriptor.id === defaultEnvironmentAssetId)?.defaultConfig; assert(base);
const artifact = serializeEnvironmentConfig(base);
assert.equal(artifact.filename, `${defaultEnvironmentAssetId}.environment-config.v1.json`);
assert.equal(artifact.mimeType, "application/json");
assert.equal(artifact.text.endsWith("\n"), true);
assert.deepEqual([...artifact.bytes], [...new TextEncoder().encode(artifact.text)]);
assert.deepEqual(normalizeEnvironmentConfig(JSON.parse(artifact.text), defaultEnvironmentAssetId), base);
assert.deepEqual(normalizeEnvironmentTransform({ position:{ x:-0, y:0, z:0 }, rotationDegrees:{ xPitch:0, yYaw:180, zRoll:-180 }, scale:4 }).position, { x:0, y:0, z:0 });
for (const invalid of [
  { ...base, extra:true },
  { ...base, version:2 },
  { ...base, id:ids[1] },
  { ...base, projection:"gaussian-splat" },
  { ...base, transform:{ ...base.transform, scale:Number.NaN } },
  { ...base, transform:{ ...base.transform, scale:0.24 } },
  { ...base, transform:{ ...base.transform, position:{ x:30, y:0, z:0 }, scale:1 } },
  { ...base, transform:{ ...base.transform, rotationDegrees:{ ...base.transform.rotationDegrees, yYaw:181 } } }
]) assert.throws(() => normalizeEnvironmentConfig(invalid, defaultEnvironmentAssetId));
for (const hostileId of ["../escape", "Unknown", "unknown-environment", "", "a".repeat(97)]) {
  assert.throws(() => normalizeEnvironmentConfig({ ...base, id:hostileId }, hostileId), /id/u);
  assert.throws(() => normalizeEnvironmentConfig(base, hostileId), /id/u);
  assert.throws(() => serializeEnvironmentConfig({ ...base, id:hostileId }), /id/u);
}
const accessor = { schema:base.schema, version:1, projection:base.projection, transform:base.transform }; Object.defineProperty(accessor, "id", { enumerable:true, get(){ throw new Error("accessor ran"); } });
assert.throws(() => normalizeEnvironmentConfig(accessor, defaultEnvironmentAssetId), /own data/u);
assert.throws(() => serializeEnvironmentConfig(accessor), /own data/u);
assert.throws(() => normalizeEnvironmentConfig(new Proxy(base, {}), defaultEnvironmentAssetId), /proxies/u);
assert.throws(() => normalizeEnvironmentConfig({ ...base, transform:new Proxy(base.transform, {}) }, defaultEnvironmentAssetId), /proxies/u);
assert.throws(() => normalizeEnvironmentTransform(new Proxy(base.transform, {})), /proxies/u);
assert.throws(() => normalizeEnvironmentTransform({ ...base.transform, position:new Proxy(base.transform.position, {}) }), /proxies/u);
let nestedGetterCalls = 0; const accessorPosition = { y:0, z:0 }; Object.defineProperty(accessorPosition, "x", { enumerable:true, get(){ nestedGetterCalls += 1; return 0; } });
assert.throws(() => normalizeEnvironmentConfig({ ...base, transform:{ ...base.transform, position:accessorPosition } }, defaultEnvironmentAssetId), /own data/u); assert.equal(nestedGetterCalls, 0);
const cloneDescriptor = Object.getOwnPropertyDescriptor(globalThis, "structuredClone"); assert(cloneDescriptor); try { Object.defineProperty(globalThis, "structuredClone", { ...cloneDescriptor, value:undefined }); assert.throws(() => normalizeEnvironmentConfig(base, defaultEnvironmentAssetId), /unavailable/u); } finally { Object.defineProperty(globalThis, "structuredClone", cloneDescriptor); }

const surfaceWiring = source.slice(source.indexOf("  attachStableSurfaces()"), source.indexOf("  bindGraph()"));
assert(surfaceWiring.indexOf("setEnvironmentTransform(config.transform)") < surfaceWiring.indexOf("setEnvironmentAsset(entry.descriptor)"));
assert(surfaceWiring.indexOf("setEnvironmentAsset(entry.descriptor)") < surfaceWiring.indexOf("renderer.attach(this.canvasElement())"));
assert.match(surfaceWiring, /renderer\.attach\(this\.canvasElement\(\)\); this\.trackEnvironmentLoad\(entry\.descriptor\.id\)/u);
const displayLifecycle = source.slice(source.indexOf("  startFrameLoop()"), source.indexOf("  stopFrameLoop()"));
assert.match(displayLifecycle, /this\.observeEnvironmentLoad\(graph\)/u, "bounded display lifecycle must observe renderer-created environment promises");
const environmentTracking = source.slice(source.indexOf("  resetEnvironmentLoadObservation()"), source.indexOf("  selectEnvironment(id)"));
for (const guard of ["this.graph !== graph", "this.lifecycle !== \"connected\"", "this.connectedGeneration !== connectionGeneration", "this.environmentLoadGeneration !== generation", "this.selectedEnvironmentId !== id", "this.environmentObservedLoadPromise !== pending", "this.environmentObservedLoadId !== id"]) assert.equal(environmentTracking.includes(guard), true, `environment settlement guard missing: ${guard}`);
assert.match(environmentTracking, /document\.hidden \|\| this\.sessionGeneration !== sessionGeneration/u);
assert.match(environmentTracking, /pending === this\.environmentObservedLoadPromise && id === this\.environmentObservedLoadId/u, "promise identity deduplication missing");
assert.equal(source.match(/addEventListener\("webglcontextrestored", this\.boundEnvironmentContextRestored\)/gu)?.length, 1, "context-restored listener must attach exactly once per bind lifecycle");
assert.equal(source.match(/removeEventListener\("webglcontextrestored", this\.boundEnvironmentContextRestored\)/gu)?.length, 1, "context-restored listener must detach exactly once per teardown lifecycle");
const restoreNotification = source.slice(source.indexOf("  handleEnvironmentContextRestored(event)"), source.indexOf("  resetEnvironmentLoadObservation()"));
assert.match(restoreNotification, /queueMicrotask/u);
assert.match(restoreNotification, /!this\.isCurrent\(connectionGeneration, graph\)/u);
assert.match(restoreNotification, /document\.hidden\) \{ this\.environmentLoadNeedsReconcile = true; return; \}/u);
assert.match(restoreNotification, /this\.observeEnvironmentLoad\(graph\)/u);
assert.doesNotMatch(controlsBrowserSource, /\.observeEnvironmentLoad\(/u, "browser coverage must not manually supply the production restore notification");
assert.match(controlsBrowserSource, /frameTimer:0/u);
assert.equal(environmentAssetCatalog.filter((entry) => entry.label.includes("comparison with source artifacts")).length, 0, "catalog labels must remain exact source labels");
assert.deepEqual(environmentArtifactComparisonIds, ["snow-mountain-with-lake-photosphere", "igloo-toon-photosphere"]);
assert.deepEqual(environmentAssetClassifications, ["strong", "strong-comparison", "comparison-with-artifacts", "strong-comparison", "comparison-with-artifacts", "strong-comparison", "strong-comparison", "strong-comparison"]);
assert.equal(environmentAssetClassifications[ids.indexOf(defaultEnvironmentAssetId)], "strong-comparison", "default identity must not alter classification");
assert.match(source, /environmentArtifactComparisonIds\.includes\(entry\.descriptor\.id\) \? `\$\{entry\.label\} — comparison with source artifacts`/u);
for (const axis of ["x", "y", "z"]) assert.match(source, new RegExp(`data-environment-field="position-${axis}"[^>]*type="number"[^>]*min="-30"[^>]*max="30"`, "u"));
assert.match(source, /Sphere radius scale/u);
for (const field of ["position-x", "position-y", "position-z", "pitch", "yaw", "roll", "scale"]) {
  assert.match(source, new RegExp(`id="environment-${field}"[^>]+aria-describedby="environment-${field}-value"`, "u"));
  assert.match(source, new RegExp(`id="environment-${field}-value" class="environment-value"><output for="environment-${field}" data-environment-output="${field}"`, "u"));
}
assert.match(source, /class="environment-value"/u); assert.match(source, /white-space:nowrap/u); assert.match(source, /aria-label=" degrees">°/u);
assert.doesNotMatch(`${source}\n${readme}`, /At centered position, sphere radius scale does not change angular view or zoom\.|Environment transform applied\./u);
assert.match(source, /this\.graph\.renderer\.setEnvironmentTransform\(config\.transform\); this\.environmentConfigs\.set\(entry\.descriptor\.id, config\); this\.environmentStatus = ""; this\.renderEnvironmentControls\(\);/u, "live transforms must apply atomically, clear stale success, and project normalized input/output immediately");
assert.match(source, /this\.selectedEnvironmentId = defaultEnvironmentAssetId/u);
const playLifecycle = source.slice(source.indexOf("  async startSession("), source.indexOf("  setTheme(", source.indexOf("  async startSession("))); assert.doesNotMatch(playLifecycle, /selectedEnvironmentId\s*=|environmentConfigs\s*=/u, "Play must retain the connection-local environment selection/configs");
assert.match(source, /this\.environmentConfigs = new Map\(environmentAssetCatalog\.map\(\(entry\) => \[entry\.descriptor\.id, entry\.defaultConfig\]\)\)/u);
assert.match(source, /aria-controls="visual-test-authoring-body"/u);
assert.match(source, /if \(this\.environmentControlsCollapsed\) this\.releaseDebugCameraControls\(\)/u);
assert.match(source, /event\.isTrusted\) this\.openEnvironmentConfigPicker\(event\)/u);
assert.match(source, /event\.isTrusted\) this\.exportEnvironmentConfig\(event\)/u);
assert.match(source, /if \(!event\?\.isTrusted/u);
assert.match(source, /if \(!event\.isTrusted\) \{ input\.value = ""; this\.environmentPickerRequest = null; return; \}/u);
const snapshotBody = source.slice(source.indexOf("  getSnapshot()"), source.indexOf("  /** Terminal until", source.indexOf("  getSnapshot()")));
assert.doesNotMatch(snapshotBody, /selectedEnvironmentId|environmentConfigs|environmentAssetCatalog|environmentStatus/u);
const rendererTelemetryBody = source.slice(source.indexOf("function rendererTelemetry("), source.indexOf("function cadenceTelemetry("));
assert.doesNotMatch(rendererTelemetryBody, /environment|sha256|bytes|url/u);

const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding:"utf8", maxBuffer:16 * 1024 * 1024 }));
const packedPaths = packed[0].files.map((file) => file.path);
assert.deepEqual(packedPaths.filter((path) => path.startsWith("assets/environments/")).sort(), expectedPaths, "npm package environment inventory drifted");
assert.deepEqual(packedPaths.filter((path) => path.startsWith("assets/gameplay/")).sort(), expectedGameplayPaths, "npm package gameplay 0.0.5 inventory drifted");
const forbiddenPackageRoots = [".beads/", ".github/", ".plans/", ".tmp/", "demo/", "dist/", "docs/", "fixtures/", "release/", "test/"];
assert.equal(packedPaths.some((path) => forbiddenPackageRoots.some((prefix) => path.startsWith(prefix)) || /(?:\.ply$|\.blend$|\.png$|\.ya?ml$)/iu.test(path)), false, "npm package contains forbidden evidence/source/release payload");
assert.equal(packedPaths.every((path) => ["assets/environments/", "assets/gameplay/0.0.5/", "scripts/", "src/"].some((prefix) => path.startsWith(prefix)) || ["index.html", "vite.config.js", "README.md", "LICENSE.md", "package.json"].includes(path)), true, "npm package escaped exact runtime/tooling roots");
const fingerprintEnvironment = listReleaseFingerprintInputs(root).map((path) => relative(root, path)).filter((path) => path.startsWith("assets/environments/")).sort();
assert.deepEqual(fingerprintEnvironment, expectedPaths);
assert.equal(expectedPaths.some((path) => /(?:\.ply$|(?:^|\/)(?:pos|neg)_[xyz]\.png$|\.ya?ml$)/iu.test(path)), false);

const result = await build({ logLevel:"silent", build:{ write:false } });
const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.output);
const builtText = outputs.filter((entry) => entry.type === "chunk" || typeof entry.source === "string").map((entry) => entry.type === "chunk" ? entry.code : String(entry.source)).join("\n");
assert.doesNotMatch(builtText, /At centered position, sphere radius scale does not change angular view or zoom\.|Environment transform applied\./u, "removed environment copy leaked into build output");
const builtEnvironment = outputs.filter((entry) => entry.type === "asset" && entry.fileName.startsWith("assets/environments/")).map((entry) => ({ path:entry.fileName, bytes:Buffer.from(entry.source) })).sort((left, right) => left.path.localeCompare(right.path));
assert.deepEqual(builtEnvironment.map(({ path }) => path), expectedPaths);
for (const built of builtEnvironment) { const expected = environmentAssetFiles.find(({ path }) => path === built.path); assert(expected); assert.equal(built.bytes.byteLength, expected.bytes); assert.equal(hash(built.bytes), expected.sha256); }
console.log(`Environment catalog/config/UI privacy and exact 24-file environment + ${expectedGameplayPaths.length}-file gameplay 0.0.5 npm package inventories, fingerprint, and Vite inventory passed (${packedPaths.length} packed files).`);

/** @param {Uint8Array} bytes */
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
/** @param {string} repository @param {string[]} arguments_ */
function git(repository, arguments_) { return execFileSync("git", ["-C", repository, ...arguments_], { encoding:"utf8", maxBuffer:1024 * 1024 }).trim(); }
