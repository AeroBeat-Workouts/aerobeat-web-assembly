// @ts-check

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRepository = resolve(root, "../aerobeat-environment-community");
const sourceCommit = "543686003c36eb0ddface684925b373260d8f1d9";
const sourceRelative = ".testbed/assets/images/luminious-ice-cave-photosphere";
const sourceRoot = resolve(sourceRepository, sourceRelative);
const payloadRoot = resolve(root, "assets/environments/luminious-ice-cave-photosphere/1.0.0");
const JPEG_FILE = "luminious-ice-cave-photosphere.jpg";
const CONFIG_FILE = "luminious-ice-cave-photosphere.config.yaml";
const MANIFEST_FILE = "manifest.json";
const INVENTORY = Object.freeze([CONFIG_FILE, JPEG_FILE, MANIFEST_FILE].sort());
const EXPECTED = Object.freeze({
  [JPEG_FILE]: Object.freeze({ bytes: 2210289, sha256: "ff142b3ce3d3509ab3cfafcfc6a8cc2d3b0ff737852072d3a7aea8075478eed5" }),
  [CONFIG_FILE]: Object.freeze({ bytes: 216, sha256: "d415e7de8cdc9c78cfc2d3261b9f50a0d9cb626fe8e368bec43de2c8e686fb42" }),
  [MANIFEST_FILE]: Object.freeze({ bytes: 4869, sha256: "524c7a5623dfbafb65590a9b3b78dc894d4341165d564ac267d470f03acf7e80" })
});
const EXPECTED_CONFIG = "media:\n  projection: equirectangular\n  fit_mode: cover\n  color_space: srgb\nphotosphere:\n  orientation_degrees:\n    yaw: 0.0\n    pitch: 0.0\n    roll: 0.0\n  center_forward: [0.0, 0.0, -1.0]\n  world_up: [0.0, 1.0, 0.0]\n";
const FORBIDDEN_METADATA = Object.freeze(["/home/", "\\home\\", ["luis", "vidal"].join(" "), ["sketch", "fab"].join(""), ["bfc9a041814f4112", "b016904edfaad0c5"].join(""), ["alien", "moon", "icescape"].join("-")]);
const mode = process.argv[2] ?? "verify";
if (!new Set(["sync", "verify"]).has(mode) || process.argv.length > 3) throw new Error("Usage: node scripts/sync-environment-assets.js [sync|verify]");

verifySourceRepository();
verifyDirectory(sourceRoot, "source", true);
execFileSync("python3", [resolve(sourceRepository, ".testbed/tools/photosphere/validate_photosphere.py"), "--repo-root", sourceRepository], { stdio: "pipe", maxBuffer: 4 * 1024 * 1024 });
if (mode === "sync") {
  mkdirSync(payloadRoot, { recursive: true });
  for (const name of INVENTORY) copyFileSync(resolve(sourceRoot, name), resolve(payloadRoot, name));
}
verifyDirectory(payloadRoot, "payload");
console.log(`Owned photosphere environment ${mode} passed: source ${sourceCommit}, exact 3-file inventory, JPEG/config/manifest contracts and seam thresholds.`);

function verifySourceRepository() {
  assert.equal(git(["rev-parse", "HEAD"]), sourceCommit, "environment source repository HEAD drifted");
  assert.equal(git(["status", "--porcelain", "--untracked-files=no"]), "", "environment source repository tracked files are dirty");
  const tree = git(["ls-tree", "-r", "--name-only", sourceCommit, "--", sourceRelative]).split("\n").filter(Boolean).map((path) => relative(sourceRelative, path)).sort();
  assert.deepEqual(tree, INVENTORY, "environment source commit inventory drifted");
}

/** @param {string} directory @param {string} label @param {boolean} [allowIgnoredImportCache] */
function verifyDirectory(directory, label, allowIgnoredImportCache = false) {
  const inventory = readdirSync(directory).filter((name) => !(allowIgnoredImportCache && name.endsWith(".import"))).sort();
  assert.deepEqual(inventory, INVENTORY, `${label} environment inventory contains missing or extra preserved files`);
  for (const name of INVENTORY) verifyFile(resolve(directory, name), EXPECTED[name], `${label} ${name}`);
  assert.equal(readFileSync(resolve(directory, CONFIG_FILE), "utf8"), EXPECTED_CONFIG, `${label} config bytes drifted`);
  const manifestText = readFileSync(resolve(directory, MANIFEST_FILE), "utf8");
  const manifest = JSON.parse(manifestText);
  const normalizedMetadata = `${manifestText}\n${readFileSync(resolve(directory, CONFIG_FILE), "utf8")}`.toLowerCase();
  assert.equal(FORBIDDEN_METADATA.some((token) => normalizedMetadata.includes(token)), false, `${label} metadata contains an absolute path or rejected third-party identity`);
  assert.deepEqual(manifest.output, {
    path: `${sourceRelative}/${JPEG_FILE}`, dimensions: [4096, 2048], mode: "RGB", encoding: "JPEG", color_space: "sRGB",
    jpeg: { quality: 92, subsampling: 0, optimize: false, progressive: false }, sha256: EXPECTED[JPEG_FILE].sha256, bytes: EXPECTED[JPEG_FILE].bytes,
    orientation: { yaw_degrees: 0, pitch_degrees: 0, roll_degrees: 0, center_forward: [0, 0, -1] }
  }, `${label} output contract drifted`);
  assert.deepEqual(manifest.validation.continuity_thresholds, { seam_mean_rgb_delta: 5, seam_p95_rgb_delta: 16, pole_top_channel_spread: 3, pole_bottom_channel_spread: 3 }, `${label} seam/pole thresholds drifted`);
  assert.deepEqual({ path: manifest.source.path, sha256: manifest.source.sha256, bytes: manifest.source.bytes, point_count: manifest.source.point_count }, {
    path: ".testbed/assets/splats/luminious-ice-cave/luminious-ice-cave.compressed.ply", sha256: "a5732239888a0c6967d85693b504248733dbd48e7981cf39a348c32badc3c56a", bytes: 55619663, point_count: 2200000
  }, `${label} purchased source chain drifted`);
  assert.equal(manifest.rights.control, "This selected splat and this photosphere derivative are commercially controlled by AeroBeat.");
  assert.equal(manifest.rights.attribution_required, false);
  assert.match(manifest.rights.derrick_statement, /commercially without attribution/u);
  assert.match(manifest.rights.scope_limit, /does not claim public sublicensing rights/u);
  verifyJpeg(readFileSync(resolve(directory, JPEG_FILE)));
}

/** @param {string} path @param {{bytes:number,sha256:string}} expected @param {string} label */
function verifyFile(path, expected, label) {
  const bytes = readFileSync(path);
  assert.equal(bytes.byteLength, expected.bytes, `${label} byte length drifted`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256, `${label} SHA-256 drifted`);
}

/** @param {Buffer} bytes */
function verifyJpeg(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, "photosphere JPEG SOI is missing");
  let offset = 2; let frame = null;
  while (offset + 4 <= bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset); assert(length >= 2 && offset + length <= bytes.length, "photosphere JPEG segment is malformed");
    if (marker === 0xe1 || marker === 0xe2 || marker === 0xfe) throw new Error("photosphere JPEG contains forbidden EXIF/ICC/comment metadata");
    if (marker >= 0xc0 && marker <= 0xcf && !new Set([0xc4, 0xc8, 0xcc]).has(marker)) frame = { marker, precision: bytes[offset + 2], height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5), components: bytes[offset + 7] };
    offset += length;
  }
  assert.deepEqual(frame, { marker: 0xc0, precision: 8, height: 2048, width: 4096, components: 3 }, "photosphere must be baseline 8-bit 4096x2048 three-component RGB JPEG");
}

/** @param {string[]} arguments_ */
function git(arguments_) { return execFileSync("git", ["-C", sourceRepository, ...arguments_], { encoding: "utf8", maxBuffer: 1024 * 1024 }).trim(); }
