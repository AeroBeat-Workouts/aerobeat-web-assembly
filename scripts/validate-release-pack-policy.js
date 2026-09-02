// @ts-check

import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { assertDetachedTarget, normalizeDetachedTarget, verifyArchive } from "./release-pack-policy.js";

const BLOCK_SIZE = 512;
const SCRIPT_PATH = fileURLToPath(new URL("./release-pack-policy.js", import.meta.url));
const temporaryRoot = mkdtempSync(resolve(tmpdir(), "aerobeat-pack-policy-"));
const fixture = resolve(temporaryRoot, "fixture");
const packs = resolve(temporaryRoot, "packs");
mkdirSync(fixture);
mkdirSync(packs);

try {
  writeFileSync(resolve(fixture, "package.json"), `${JSON.stringify({ name: "pack-policy-fixture", version: "1.0.0", private: true, files: ["plain.txt", "tool.sh"] }, null, 2)}\n`);
  writeFileSync(resolve(fixture, "plain.txt"), "plain\n");
  writeFileSync(resolve(fixture, "tool.sh"), "#!/bin/sh\nexit 0\n");
  chmodSync(resolve(fixture, "plain.txt"), 0o644);
  chmodSync(resolve(fixture, "package.json"), 0o644);
  chmodSync(resolve(fixture, "tool.sh"), 0o755);
  git(fixture, ["init", "-q"]);
  git(fixture, ["config", "user.name", "Pack Policy Test"]);
  git(fixture, ["config", "user.email", "pack-policy@example.invalid"]);
  git(fixture, ["add", "."]);
  git(fixture, ["commit", "-qm", "fixture"]);
  const commit = git(fixture, ["rev-parse", "HEAD"]);

  assert.throws(() => normalizeDetachedTarget(fixture, commit), /explicitly detached/u);
  git(fixture, ["checkout", "--detach", "-q"]);
  chmodSync(resolve(fixture, "package.json"), 0o600);
  chmodSync(resolve(fixture, "plain.txt"), 0o600);
  chmodSync(resolve(fixture, "tool.sh"), 0o700);
  assert.throws(() => assertDetachedTarget(fixture, commit), /has mode 0600, expected 0644/u);

  const normalized = normalizeDetachedTarget(fixture, commit);
  assert.equal(normalized.trackedFileCount, 3);
  assert.deepEqual(normalized.modeCounts, { "0644": 2, "0755": 1 });
  assert.equal(statSync(resolve(fixture, "plain.txt")).mode & 0o777, 0o644);
  assert.equal(statSync(resolve(fixture, "tool.sh")).mode & 0o777, 0o755);
  assert.equal(git(fixture, ["status", "--porcelain=v1", "--untracked-files=all"]), "");

  const pack = spawnSync("npm", ["pack", "--json", "--pack-destination", packs], { cwd: fixture, encoding: "utf8" });
  if (pack.status !== 0) throw new Error(`fixture npm pack failed:\n${pack.stderr}`);
  const metadata = JSON.parse(pack.stdout)[0];
  const archive = resolve(packs, metadata.filename);
  const manifest = resolve(temporaryRoot, "manifest.tsv");
  const verified = verifyArchive(fixture, commit, archive, manifest);
  assert.equal(verified.memberCount, 3);
  assert.equal(verified.paxCount, 0);
  assert.deepEqual(verified.modeCounts, { "0644": 2, "0755": 1 });
  assert.equal(readFileSync(manifest, "utf8").split("\n").filter(Boolean).length, 3);

  const canonicalTar = gunzipSync(readFileSync(archive));
  const terminatorOffset = findFirstZeroBlock(canonicalTar);
  assert.equal(canonicalTar.length % BLOCK_SIZE, 0);
  assert.equal(terminatorOffset, canonicalTar.length - 2 * BLOCK_SIZE, "canonical npm fixture must end in exactly two zero blocks");
  assert(canonicalTar.subarray(terminatorOffset).every((byte) => byte === 0));
  const memberBytes = canonicalTar.subarray(0, terminatorOffset);
  const firstMember = canonicalTar.subarray(0, firstMemberEnd(canonicalTar));
  const terminator = Buffer.alloc(2 * BLOCK_SIZE);

  // Canonical end-of-archive framing is mandatory and exact.
  assertTarReject("missing-terminator", canonicalTar.subarray(0, terminatorOffset), /missing canonical two-block/u);
  assertTarReject("one-zero-block", canonicalTar.subarray(0, terminatorOffset + BLOCK_SIZE), /expected two consecutive zero blocks/u);
  assertTarReject("partial-final-block", canonicalTar.subarray(0, canonicalTar.length - 1), /512-byte block framing/u);
  assertTarReject("extra-zero-block", Buffer.concat([canonicalTar, Buffer.alloc(BLOCK_SIZE)]), /extra zero padding/u);
  const trailingNonzeroBlock = Buffer.alloc(BLOCK_SIZE);
  trailingNonzeroBlock[0] = 1;
  assertTarReject("trailing-nonzero", Buffer.concat([canonicalTar, trailingNonzeroBlock]), /Nonzero trailing data/u);
  assertTarReject("duplicate-after-terminator", Buffer.concat([canonicalTar, firstMember, terminator]), /Nonzero trailing data/u);

  // Existing structural protections remain fail closed before the terminator.
  const badChecksum = Buffer.from(canonicalTar);
  badChecksum[0] ^= 1;
  assertTarReject("bad-checksum", badChecksum, /Invalid tar header checksum/u);
  assertTarReject("duplicate-before-end", Buffer.concat([memberBytes, firstMember, terminator]), /Duplicate npm member/u);
  assertTarReject("truncated-member", buildTar([buildMember({ path: "package/plain.txt", mode: 0o644, content: Buffer.from("x"), declaredSize: 2048 })]), /Truncated tar member/u);
  const nonzeroPaddingMember = buildMember({ path: "package/plain.txt", mode: 0o644, content: Buffer.from("x") });
  nonzeroPaddingMember[BLOCK_SIZE + 1] = 1;
  assertTarReject("nonzero-member-padding", buildTar([nonzeroPaddingMember]), /Nonzero tar member padding/u);
  assertTarReject("pax", buildTar([buildMember({ path: "package/pax", mode: 0o644, typeFlag: "x", content: Buffer.from("path=package/plain.txt\n") })]), /PAX member is forbidden/u);
  assertTarReject("unsupported-type", buildTar([buildMember({ path: "package/link", mode: 0o644, typeFlag: "2" })]), /Unsupported npm tar member type/u);

  const wrongMode = Buffer.from(canonicalTar);
  writeTarNumber(wrongMode.subarray(0, BLOCK_SIZE), 100, 8, 0o600);
  writeChecksum(wrongMode.subarray(0, BLOCK_SIZE));
  assertTarReject("wrong-file-mode", wrongMode, /has mode 0600, expected/u);
  const wrongContent = Buffer.from(canonicalTar);
  wrongContent[BLOCK_SIZE] ^= 1;
  assertTarReject("wrong-file-content", wrongContent, /does not match the exact tracked target bytes/u);

  // A safe directory is accepted, but every directory path is constrained first and its mode remains exact 0755.
  const safeDirectory = buildMember({ path: "package/nested/", mode: 0o755, typeFlag: "5" });
  const withSafeDirectory = writeTar("safe-directory", Buffer.concat([safeDirectory, memberBytes, terminator]));
  assert.equal(verifyArchive(fixture, commit, withSafeDirectory, undefined).memberCount, 3);
  assertTarReject("wrong-directory-mode", buildTar([buildMember({ path: "package/nested/", mode: 0o700, typeFlag: "5" })]), /expected 0755/u);

  const unsafePaths = [
    "../escape/",
    "/absolute",
    "\\absolute",
    "package\\ambiguous",
    "package/../escape",
    "package/./dot",
    "package//empty",
    "package/C:/drive",
    "package/",
    "package"
  ];
  for (const [index, path] of unsafePaths.entries()) {
    const typeFlag = index % 4 === 0 ? "5" : index % 4 === 1 ? "x" : index % 4 === 2 ? "2" : "0";
    assertTarReject(`unsafe-path-${index}`, buildTar([buildMember({ path, mode: typeFlag === "5" ? 0o755 : 0o644, typeFlag })]), /Unsafe npm member path/u);
  }
  assertTarReject("unsafe-directory-before-mode", buildTar([buildMember({ path: "../escape/", mode: 0o700, typeFlag: "5" })]), /Unsafe npm member path/u);
  assertTarReject("unsafe-pax-before-type", buildTar([buildMember({ path: "../pax", mode: 0o644, typeFlag: "x" })]), /Unsafe npm member path/u);
  assertTarReject("unsafe-unsupported-before-type", buildTar([buildMember({ path: "../link", mode: 0o644, typeFlag: "2" })]), /Unsafe npm member path/u);

  const malformedNoNul = buildMember({ path: "package/plain.txt", mode: 0o644 });
  malformedNoNul.subarray(0, 100).fill(97);
  writeChecksum(malformedNoNul.subarray(0, BLOCK_SIZE));
  assertTarReject("malformed-name-no-nul", buildTar([malformedNoNul]), /name field.*missing NUL/u);
  const malformedAfterNul = buildMember({ path: "package/plain.txt", mode: 0o644 });
  malformedAfterNul["package/plain.txt".length + 1] = 1;
  writeChecksum(malformedAfterNul.subarray(0, BLOCK_SIZE));
  assertTarReject("malformed-name-post-nul", buildTar([malformedAfterNul]), /name field.*nonzero bytes after NUL/u);
  const malformedUtf8 = buildMember({ path: "package/plain.txt", mode: 0o644 });
  malformedUtf8[0] = 0xff;
  writeChecksum(malformedUtf8.subarray(0, BLOCK_SIZE));
  assertTarReject("malformed-name-utf8", buildTar([malformedUtf8]), /name field.*invalid UTF-8/u);
  assertTarReject("malformed-prefix", buildTar([buildMember({ path: "x", prefix: "package/", mode: 0o644 })]), /Unsafe npm member path/u);

  // The CLI grammar is command-specific and rejects malformed input before filesystem access.
  assertCliPass(["assert", "--target", fixture, "--commit", commit]);
  assertCliPass(["verify", "--target", fixture, "--commit", commit, "--archive", archive]);
  assertCliReject(["assert", "--target", fixture, "--commit", commit, "--__proto__", "x"], /Unknown option --__proto__/u);
  assertCliReject(["assert", "--target", fixture, "--commit", commit, "--constructor", "x"], /Unknown option --constructor/u);
  assertCliReject(["normalize", "--target", fixture, "--commit", commit, "--archive", archive], /Unknown option --archive/u);
  assertCliReject(["assert", "--target", fixture, "--target", fixture, "--commit", commit], /Duplicate option --target/u);
  assertCliReject(["assert", "--target", fixture], /requires --commit/u);
  assertCliReject(["verify", "--target", fixture, "--commit", commit], /requires --archive/u);
  assertCliReject(["assert", "--target"], /Invalid argument sequence/u);
  assertCliReject(["assert", "--target", "--commit", commit], /Invalid argument sequence/u);
  assertCliReject(["assert", `--target=${fixture}`, "--commit", commit], /Invalid argument sequence/u);
  assertCliReject(["assert", "--target", fixture, "--commit", commit, "extra", "value"], /Invalid argument sequence/u);
  assertCliReject(["unknown", "--target", fixture, "--commit", commit], /Usage:/u);
  assertCliReject([], /Usage:/u);

  console.log("Release pack policy self-test passed: canonical npm tar termination, complete trailing-stream rejection, every-type package path safety, strict CLI grammar, Git-index modes, exact member bytes, checksum/truncation/duplicate/PAX/type protections, and manifest identity.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

/** @param {string} label @param {Buffer} tar @param {RegExp} pattern */
function assertTarReject(label, tar, pattern) {
  const archive = writeTar(label, tar);
  assert.throws(() => verifyArchive(fixture, git(fixture, ["rev-parse", "HEAD"]), archive, undefined), pattern, label);
}

/** @param {string} label @param {Buffer} tar */
function writeTar(label, tar) {
  const path = resolve(temporaryRoot, `${label}.tgz`);
  writeFileSync(path, gzipSync(tar));
  return path;
}

/** @param {Buffer[]} members */
function buildTar(members) {
  return Buffer.concat([...members, Buffer.alloc(2 * BLOCK_SIZE)]);
}

/**
 * Build only the narrow ustar member shape needed for adversarial verifier tests.
 * @param {{path:string, prefix?:string, mode:number, typeFlag?:string, content?:Buffer, declaredSize?:number}} options
 */
function buildMember({ path, prefix = "", mode, typeFlag = "0", content = Buffer.alloc(0), declaredSize = content.length }) {
  const header = Buffer.alloc(BLOCK_SIZE);
  writeTarString(header, 0, 100, path);
  writeTarNumber(header, 100, 8, mode);
  writeTarNumber(header, 108, 8, 0);
  writeTarNumber(header, 116, 8, 0);
  writeTarNumber(header, 124, 12, declaredSize);
  writeTarNumber(header, 136, 12, 0);
  header[156] = typeFlag.charCodeAt(0);
  writeTarString(header, 257, 6, "ustar");
  header.write("00", 263, "ascii");
  writeTarString(header, 345, 155, prefix);
  writeChecksum(header);
  const padding = Buffer.alloc(Math.ceil(content.length / BLOCK_SIZE) * BLOCK_SIZE - content.length);
  return Buffer.concat([header, content, padding]);
}

/** @param {Buffer} target @param {number} start @param {number} length @param {string} value */
function writeTarString(target, start, length, value) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length >= length) throw new Error(`Test tar string too long: ${value}`);
  target.fill(0, start, start + length);
  bytes.copy(target, start);
}

/** @param {Buffer} target @param {number} start @param {number} length @param {number} value */
function writeTarNumber(target, start, length, value) {
  const text = value.toString(8).padStart(length - 1, "0");
  if (text.length >= length) throw new Error(`Test tar number too large: ${value}`);
  target.fill(0, start, start + length);
  target.write(text, start, "ascii");
}

/** @param {Buffer} header */
function writeChecksum(header) {
  header.fill(32, 148, 156);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const text = checksum.toString(8).padStart(6, "0");
  header.write(text, 148, "ascii");
  header[154] = 0;
  header[155] = 32;
}

/** @param {Buffer} tar */
function findFirstZeroBlock(tar) {
  for (let offset = 0; offset + BLOCK_SIZE <= tar.length; offset += BLOCK_SIZE) {
    if (tar.subarray(offset, offset + BLOCK_SIZE).every((byte) => byte === 0)) return offset;
  }
  throw new Error("Test archive has no zero block");
}

/** @param {Buffer} tar */
function firstMemberEnd(tar) {
  const sizeText = tar.subarray(124, 136).toString("ascii").replace(/\0.*$/u, "").trim();
  const size = Number.parseInt(sizeText || "0", 8);
  return BLOCK_SIZE + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
}

/** @param {string[]} args */
function assertCliPass(args) {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, `CLI should pass: ${args.join(" ")}\n${result.stderr}`);
}

/** @param {string[]} args @param {RegExp} pattern */
function assertCliReject(args, pattern) {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: "utf8" });
  assert.notEqual(result.status, 0, `CLI should reject: ${args.join(" ")}`);
  assert.match(result.stderr, pattern);
}

/** @param {string} root @param {string[]} args */
function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
