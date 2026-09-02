// @ts-check

import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync, gunzipSync } from "node:zlib";
import { assertDetachedTarget, normalizeDetachedTarget, verifyArchive } from "./release-pack-policy.js";

const BLOCK_SIZE = 512;
const SCRIPT_PATH = fileURLToPath(new URL("./release-pack-policy.js", import.meta.url));
const temporaryRoot = mkdtempSync(resolve(tmpdir(), "aerobeat-pack-policy-"));
const fixture = resolve(temporaryRoot, "fixture");
const packs = resolve(temporaryRoot, "packs");
const exactWidthName = "a".repeat(92);
const longestPrefixDirectory = "p".repeat(146);
let fixtureMetadataPath = "";
let fixtureArchive = "";
mkdirSync(fixture);
mkdirSync(packs);

try {
  mkdirSync(resolve(fixture, "nested"));
  mkdirSync(resolve(fixture, longestPrefixDirectory));
  const lifecycleMarker = resolve(temporaryRoot, "lifecycle-ran.txt");
  const packageJson = {
    name: "pack-policy-fixture",
    version: "1.0.0",
    private: true,
    bin: { fixture: "tool.sh" },
    scripts: { prepack: `node -e "require('fs').writeFileSync(${JSON.stringify(lifecycleMarker)}, 'ran')"` },
    files: ["plain.txt", "empty.txt", "tool.sh", "nested/deeper.txt", exactWidthName, `${longestPrefixDirectory}/leaf.txt`]
  };
  writeFileSync(resolve(fixture, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(resolve(fixture, "plain.txt"), "plain\n");
  writeFileSync(resolve(fixture, "empty.txt"), "");
  writeFileSync(resolve(fixture, "tool.sh"), "#!/bin/sh\nexit 0\n");
  writeFileSync(resolve(fixture, "nested/deeper.txt"), "nested\n");
  writeFileSync(resolve(fixture, exactWidthName), "width\n");
  writeFileSync(resolve(fixture, longestPrefixDirectory, "leaf.txt"), "prefix\n");
  for (const path of ["package.json", "plain.txt", "empty.txt", "tool.sh", "nested/deeper.txt", exactWidthName, `${longestPrefixDirectory}/leaf.txt`]) chmodSync(resolve(fixture, path), path === "tool.sh" ? 0o755 : 0o644);
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
  assert.equal(normalized.trackedFileCount, 7);
  assert.deepEqual(normalized.modeCounts, { "0644": 6, "0755": 1 });
  assert.equal(statSync(resolve(fixture, "plain.txt")).mode & 0o777, 0o644);
  assert.equal(statSync(resolve(fixture, "tool.sh")).mode & 0o777, 0o755);
  assert.equal(git(fixture, ["status", "--porcelain=v1", "--untracked-files=all"]), "");

  const pack = spawnSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", packs], { cwd: fixture, encoding: "utf8" });
  if (pack.status !== 0) throw new Error(`fixture npm pack failed:\n${pack.stderr}`);
  fixtureMetadataPath = resolve(temporaryRoot, "pack-metadata.json");
  writeFileSync(fixtureMetadataPath, pack.stdout);
  const metadataDocument = JSON.parse(pack.stdout);
  const metadata = metadataDocument[0];
  fixtureArchive = resolve(packs, metadata.filename);
  const manifest = resolve(temporaryRoot, "manifest.tsv");
  const verified = verifyArchive(fixture, commit, fixtureArchive, manifest);
  assert.equal(verified.derivedMetadataSha256, sha256(Buffer.from(pack.stdout)));
  assert.equal(existsSync(lifecycleMarker), false, "pack and internal dry-pack derivation must not run lifecycle scripts");
  assert.equal(verified.memberCount, 7);
  assert.equal(verified.paxCount, 0);
  assert.deepEqual(verified.modeCounts, { "0644": 6, "0755": 1 });
  assert.equal(metadata.files.find((file) => file.path === "tool.sh").mode, 0o755, "npm bin must be modeled as executable");
  assert.equal(readFileSync(manifest, "utf8").split("\n").filter(Boolean).length, 7);

  const canonicalArchive = readFileSync(fixtureArchive);
  const canonicalTar = gunzipSync(canonicalArchive);
  const headers = readMemberHeaders(canonicalTar);
  assert.equal(headers.length, 7);
  assert(headers.some(({ path }) => path === `package/${exactWidthName}`));
  assert(headers.some(({ path }) => path === `package/${longestPrefixDirectory}/leaf.txt`));
  assert.equal(findFirstZeroBlock(canonicalTar), canonicalTar.length - 2 * BLOCK_SIZE);
  assert(canonicalTar.subarray(canonicalTar.length - 2 * BLOCK_SIZE).every((byte) => byte === 0));

  // One-byte mutations of every meaningful or reserved USTAR field must fail.
  const fieldOffsets = [0, 100, 108, 116, 124, 136, 148, 156, 157, 257, 263, 265, 297, 329, 337, 345, 476, 488, 500];
  for (const offset of fieldOffsets) {
    const mutated = mutateFirstHeader(canonicalTar, (header) => {
      header[offset] ^= 1;
      if (offset < 148 || offset >= 156) writeCanonicalChecksum(header);
    });
    assertTarReject(`header-field-${offset}`, mutated, /Non-canonical|Malformed|extra member|Unsafe npm member/u);
  }

  // Numeric fields accept no partial octal, alternate termination, sign, 8/9, base-256, or overflow shape.
  const numericFields = [
    ["mode", 100, 8], ["uid", 108, 8], ["gid", 116, 8], ["size", 124, 12],
    ["mtime", 136, 12], ["checksum", 148, 8], ["devmajor", 329, 8], ["devminor", 337, 8]
  ];
  const malformedNumericValues = [
    (length) => Buffer.from(`${"0".repeat(length - 2)}8\0`, "ascii"),
    (length) => Buffer.from(`${"0".repeat(length - 2)}9\0`, "ascii"),
    (length) => Buffer.from(`-${"0".repeat(length - 2)}\0`, "ascii"),
    (length) => Buffer.from(`${"0".repeat(Math.max(0, length - 5))} \0XYZ`, "ascii").subarray(0, length),
    (length) => { const value = Buffer.alloc(length); value[0] = 0x80; return value; },
    (length) => Buffer.from("7".repeat(length), "ascii")
  ];
  for (const [label, start, length] of numericFields) {
    for (const [index, makeValue] of malformedNumericValues.entries()) {
      const mutated = mutateFirstHeader(canonicalTar, (header) => {
        const value = makeValue(length);
        header.fill(0, start, start + length);
        value.copy(header, start, 0, Math.min(value.length, length));
        if (label !== "checksum") writeCanonicalChecksum(header);
      });
      assertTarReject(`numeric-${label}-${index}`, mutated, /Non-canonical npm USTAR header|Malformed tar/u);
    }
  }

  // Membership is exact and bound to internally derived npm metadata.
  const firstMember = canonicalTar.subarray(0, firstMemberEnd(canonicalTar));
  const terminator = Buffer.alloc(2 * BLOCK_SIZE);
  assertTarReject("empty-package", terminator, /subset/u);
  assertTarReject("subset-package", Buffer.concat([firstMember, terminator]), /subset|does not match internally derived npm metadata/u);
  assertTarReject("extra-package", Buffer.concat([canonicalTar.subarray(0, -2 * BLOCK_SIZE), firstMember, terminator]), /Duplicate|extra member|exactly two zero blocks/u);
  const memberChunks = readMemberChunks(canonicalTar);
  [memberChunks[0], memberChunks[1]] = [memberChunks[1], memberChunks[0]];
  assertTarReject("reordered-package", Buffer.concat([...memberChunks, terminator]), /SHA-1|SHA-512|Non-canonical|metadata/u, false);

  // Exact framing and prior cf1 path/type/padding protections remain closed.
  assertTarReject("missing-terminator", canonicalTar.subarray(0, -2 * BLOCK_SIZE), /two-block terminator|subset/u);
  assertTarReject("one-zero-block", canonicalTar.subarray(0, -BLOCK_SIZE), /two-block terminator|exact EOF|Truncated tar member/u);
  assertTarReject("partial-final-block", canonicalTar.subarray(0, -1), /512-byte framing|two zero blocks/u);
  assertTarReject("extra-zero-block", Buffer.concat([canonicalTar, Buffer.alloc(BLOCK_SIZE)]), /exact EOF|two zero blocks/u);
  const nonzeroPadding = mutateTarMemberPadding(canonicalTar);
  assertTarReject("nonzero-padding", nonzeroPadding, /Nonzero tar member padding/u);
  for (const unsafePath of ["../escape", "/absolute", "package\\ambiguous", "package/../escape", "package/./dot", "package//empty", "package/C:/drive", "package/"]) {
    const mutated = replaceFirstHeaderPath(canonicalTar, unsafePath);
    assertTarReject(`unsafe-${sha256(Buffer.from(unsafePath)).slice(0, 8)}`, mutated, /Unsafe npm member path|Non-canonical/u);
  }
  for (const [label, type] of [["nul-type", 0], ["directory", 53], ["symlink", 50], ["pax", 120]]) {
    const mutated = mutateFirstHeader(canonicalTar, (header) => { header[156] = type; writeCanonicalChecksum(header); });
    assertTarReject(label, mutated, /Non-canonical npm USTAR header/u);
  }

  // Package authority is derived internally. Caller-authored metadata is not accepted.
  const firstChunk = readMemberChunks(canonicalTar)[0];
  const selfAuthoredSubset = encodeCanonicalGzip(Buffer.concat([firstChunk, Buffer.alloc(2 * BLOCK_SIZE)]));
  assertArchiveReject("self-authored-one-file-subset", selfAuthoredSubset, /subset|inventory/u);
  assertTarReject("joint-empty-pair", Buffer.alloc(2 * BLOCK_SIZE), /subset|inventory/u);
  const reorderedPair = readMemberChunks(canonicalTar);
  [reorderedPair[0], reorderedPair[1]] = [reorderedPair[1], reorderedPair[0]];
  assertTarReject("joint-reordered-pair", Buffer.concat([...reorderedPair, Buffer.alloc(2 * BLOCK_SIZE)]), /Non-canonical|inventory|extra member|Archive byte length|SHA-1/u);
  const selfAuthoredMetadataPath = resolve(temporaryRoot, "self-authored-metadata.json");
  const selfAuthoredDocument = JSON.parse(readFileSync(fixtureMetadataPath, "utf8"));
  selfAuthoredDocument[0].files = [selfAuthoredDocument[0].files[0]];
  selfAuthoredDocument[0].entryCount = 1;
  selfAuthoredDocument[0].unpackedSize = selfAuthoredDocument[0].files[0].size;
  refreshArchiveMetadata(selfAuthoredDocument[0], selfAuthoredSubset);
  writeFileSync(selfAuthoredMetadataPath, `${JSON.stringify(selfAuthoredDocument, null, 2)}\n`);
  assertCliReject(["verify", "--target", fixture, "--commit", commit, "--archive", resolve(temporaryRoot, "case-self-authored-one-file-subset", "pack-policy-fixture-1.0.0.tgz"), "--metadata", selfAuthoredMetadataPath], /Unknown option --metadata/u);

  const hostileBin = resolve(temporaryRoot, "hostile-bin");
  mkdirSync(hostileBin);
  const hostileNpmMarker = resolve(temporaryRoot, "hostile-npm-ran.txt");
  writeFileSync(resolve(hostileBin, "npm"), `#!/bin/sh\necho ran > ${JSON.stringify(hostileNpmMarker)}\nexit 99\n`, { mode: 0o755 });
  const oldPath = process.env.PATH;
  const oldTmp = process.env.TMPDIR;
  const oldIgnoreScripts = process.env.npm_config_ignore_scripts;
  process.env.PATH = `${hostileBin}:${oldPath ?? ""}`;
  process.env.TMPDIR = fixture;
  process.env.npm_config_ignore_scripts = "false";
  try { verifyArchive(fixture, commit, fixtureArchive, undefined); }
  finally {
    if (oldPath === undefined) delete process.env.PATH; else process.env.PATH = oldPath;
    if (oldTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = oldTmp;
    if (oldIgnoreScripts === undefined) delete process.env.npm_config_ignore_scripts; else process.env.npm_config_ignore_scripts = oldIgnoreScripts;
  }
  assert.equal(existsSync(hostileNpmMarker), false, "PATH npm substitution must not execute");
  assert.equal(existsSync(lifecycleMarker), false, "hostile environment must not enable lifecycle scripts");
  assert.equal(git(fixture, ["status", "--porcelain=v1", "--untracked-files=all"]), "");

  // Pinned-runtime failures and noisy/malformed npm output fail closed.
  assertCopiedPolicyReject("node-version-mismatch", { nodeVersion: "v0.0.0" }, /requires Node v0\.0\.0/u);
  assertCopiedPolicyReject("npm-version-mismatch", { npmBody: "process.stdout.write('0.0.0\\n')" }, /requires npm 10\.9\.8/u);
  assertCopiedPolicyReject("npm-command-failure", { npmBody: fakeNpmBody("process.stderr.write('failure\\n'); process.exit(7)") }, /failed with exit 7/u);
  assertCopiedPolicyReject("npm-signal", { npmBody: fakeNpmBody("process.kill(process.pid, 'SIGTERM')") }, /failed with exit 143|terminated by signal/u);
  assertCopiedPolicyReject("npm-max-buffer", { npmBody: fakeNpmBody("process.stdout.write('x'.repeat(17 * 1024 * 1024))") }, /ENOBUFS|exceeded|maxBuffer/u);
  assertCopiedPolicyReject("npm-stderr-noise", { npmBody: fakeNpmBody("process.stderr.write('noise\\n'); process.stdout.write('[]\\n')") }, /unexpected stderr noise/u);
  assertCopiedPolicyReject("npm-stdout-noise", { npmBody: fakeNpmBody("process.stdout.write('noise\\n[]\\n')") }, /valid JSON without stdout noise/u);
  assertCopiedPolicyReject("npm-empty-json", { npmBody: fakeNpmBody("process.stdout.write('[]\\n')") }, /one-record JSON array/u);
  assertCopiedPolicyReject("npm-extra-json-record", { npmBody: fakeNpmBody("process.stdout.write('[{},{}]\\n')") }, /one-record JSON array/u);
  assertCopiedPolicyReject("timeout-missing", { missingTimeout: true }, /Pinned GNU timeout is unavailable/u);
  assertCopiedPolicyReject("timeout-identity", { timeoutBody: "#!/bin/sh\necho not-gnu-timeout\n" }, /identity mismatch/u);
  assertCopiedPolicyReject("timeout-failure", { timeoutBody: "#!/bin/sh\nexit 9\n" }, /identity check failed with exit 9/u);
  assertCopiedPolicyReject("timeout-wrapper-failure", {
    timeoutBody: "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo 'timeout (GNU coreutils) 9.4'; exit 0; fi\nexit 70\n"
  }, /npm version check failed with exit 70/u);

  assertCopiedPolicyTimeout("version-hang", "version", false, /npm version check timed out after 0\.25s/u);
  assertCopiedPolicyTimeout("dry-pack-hang", "dry-pack", false, /internal npm dry-pack derivation timed out after 0\.25s/u);
  assertCopiedPolicyTimeout("dry-pack-descendant", "dry-pack", true, /internal npm dry-pack derivation timed out after 0\.25s/u);
  assertCopiedPolicyTimeout("dry-pack-term-resistant", "dry-pack", true, /internal npm dry-pack derivation timed out after 0\.25s/u, true);

  assert.throws(() => verifyArchive(fixture, commit, resolve(fixture, "plain.txt"), undefined), /archive must be outside/u);
  assert.throws(() => verifyArchive(fixture, commit, fixtureArchive, resolve(fixture, "manifest.tsv")), /manifest must be outside/u);
  const manifestAlias = resolve(temporaryRoot, "manifest-alias.tsv");
  symlinkSync(resolve(fixture, "plain.txt"), manifestAlias);
  assert.throws(() => verifyArchive(fixture, commit, fixtureArchive, manifestAlias), /manifest must be outside/u);

  // Canonical gzip is one member with exact header, deflate boundary, trailer and EOF.
  const gzipMutations = [
    ["gzip-magic", (buffer) => { buffer[0] ^= 1; }, /gzip header/u],
    ["gzip-method", (buffer) => { buffer[2] = 0; }, /gzip header/u],
    ["gzip-mtime", (buffer) => { buffer[4] = 1; }, /gzip header/u],
    ["gzip-flags", (buffer) => { buffer[3] = 8; }, /gzip header/u],
    ["gzip-xfl", (buffer) => { buffer[8] = 0; }, /gzip header/u],
    ["gzip-os", (buffer) => { buffer[9] = 3; }, /gzip header/u],
    ["gzip-crc", (buffer) => { buffer[buffer.length - 8] ^= 1; }, /CRC32|deflate/u],
    ["gzip-isize", (buffer) => { buffer[buffer.length - 4] ^= 1; }, /ISIZE|deflate/u]
  ];
  for (const [label, mutate, pattern] of gzipMutations) {
    const buffer = Buffer.from(canonicalArchive);
    mutate(buffer);
    assertArchiveReject(label, buffer, pattern);
  }
  assertArchiveReject("gzip-concatenated", Buffer.concat([canonicalArchive, canonicalArchive]), /deflate|trailing|CRC32|ISIZE/u);
  assertArchiveReject("gzip-trailing", Buffer.concat([canonicalArchive, Buffer.from([1])]), /deflate|trailing|CRC32|ISIZE/u);

  // Target and CLI boundaries stay fail closed.
  assertCliPass(["assert", "--target", fixture, "--commit", commit]);
  assertCliPass(["verify", "--target", fixture, "--commit", commit, "--archive", fixtureArchive]);
  assertCliReject(["verify", "--target", fixture, "--commit", commit, "--archive", fixtureArchive, "--metadata", fixtureMetadataPath], /Unknown option --metadata/u);
  assertCliReject(["assert", "--target", fixture, "--commit", commit, "--__proto__", "x"], /Unknown option/u);
  assertCliReject(["assert", "--target", fixture, "--target", fixture, "--commit", commit], /Duplicate option/u);
  assertCliReject(["assert", "--target"], /Invalid argument sequence/u);
  assertCliReject(["assert", `--target=${fixture}`, "--commit", commit], /Invalid argument sequence/u);
  assertCliReject(["unknown", "--target", fixture, "--commit", commit], /Usage:/u);

  const alias = resolve(temporaryRoot, "canonical-alias");
  const canonicalRoot = resolve(dirname(SCRIPT_PATH), "..");
  symlinkSync(canonicalRoot, alias);
  assert.throws(() => normalizeDetachedTarget(alias, git(canonicalRoot, ["rev-parse", "HEAD"])), /canonical checkout/u);
  writeFileSync(resolve(fixture, "untracked.txt"), "x");
  assert.throws(() => assertDetachedTarget(fixture, commit), /must be clean/u);
  rmSync(resolve(fixture, "untracked.txt"));
  chmodSync(resolve(fixture, "plain.txt"), 0o600);
  assert.throws(() => assertDetachedTarget(fixture, commit), /has mode 0600/u);
  chmodSync(resolve(fixture, "plain.txt"), 0o644);
  assert.throws(() => assertDetachedTarget(fixture, `${commit}^`), /ambiguous argument|Command failed/u);

  console.log("Release pack policy self-test passed: bounded npm process-group liveness and cleanup, internally derived pinned npm authority, lifecycle/environment isolation, canonical gzip/USTAR, strict membership/path/CLI grammar, Git-index/bin modes, exact bytes, and manifest identity.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

/** @param {string} label @param {Buffer} tar @param {RegExp} pattern @param {boolean} [refreshMetadata] */
function assertTarReject(label, tar, pattern, refreshMetadata = true) {
  const archiveBuffer = encodeCanonicalGzip(tar);
  assertArchiveReject(label, archiveBuffer, pattern, refreshMetadata);
}

/** @param {string} label @param {Buffer} archiveBuffer @param {RegExp} pattern @param {boolean} [_refreshMetadata] */
function assertArchiveReject(label, archiveBuffer, pattern, _refreshMetadata = true) {
  const caseRoot = resolve(temporaryRoot, `case-${label}`);
  mkdirSync(caseRoot);
  const archivePath = resolve(caseRoot, "pack-policy-fixture-1.0.0.tgz");
  writeFileSync(archivePath, archiveBuffer);
  assert.throws(() => verifyArchive(fixture, git(fixture, ["rev-parse", "HEAD"]), archivePath, undefined), pattern, label);
}

/** @param {Record<string, unknown>} record @param {Buffer} archiveBuffer */
function refreshArchiveMetadata(record, archiveBuffer) {
  record.size = archiveBuffer.length;
  record.shasum = createHash("sha1").update(archiveBuffer).digest("hex");
  record.integrity = `sha512-${createHash("sha512").update(archiveBuffer).digest("base64")}`;
}

/** @param {Buffer} tar @param {(header:Buffer)=>void} mutate */
function mutateFirstHeader(tar, mutate) {
  const result = Buffer.from(tar);
  mutate(result.subarray(0, BLOCK_SIZE));
  return result;
}

/** @param {Buffer} tar @param {string} path */
function replaceFirstHeaderPath(tar, path) {
  return mutateFirstHeader(tar, (header) => {
    header.fill(0, 0, 100);
    const bytes = Buffer.from(path, "ascii");
    bytes.copy(header, 0, 0, Math.min(bytes.length, 100));
    writeCanonicalChecksum(header);
  });
}

/** @param {Buffer} tar */
function mutateTarMemberPadding(tar) {
  const result = Buffer.from(tar);
  const size = readCanonicalOctal(result.subarray(124, 136));
  result[BLOCK_SIZE + size] = 1;
  return result;
}

/** @param {Buffer} tar */
function readMemberHeaders(tar) {
  const rows = [];
  for (let offset = 0; offset < tar.length - 2 * BLOCK_SIZE;) {
    const header = tar.subarray(offset, offset + BLOCK_SIZE);
    const name = readAscii(header.subarray(0, 100));
    const prefix = readAscii(header.subarray(345, 500));
    const path = prefix ? `${prefix}/${name}` : name;
    const size = readCanonicalOctal(header.subarray(124, 136));
    rows.push({ path, header, offset, size });
    offset += BLOCK_SIZE + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
  }
  return rows;
}

/** @param {Buffer} tar */
function readMemberChunks(tar) {
  return readMemberHeaders(tar).map(({ offset, size }) => tar.subarray(offset, offset + BLOCK_SIZE + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE));
}

/** @param {Buffer} tar */
function firstMemberEnd(tar) {
  const size = readCanonicalOctal(tar.subarray(124, 136));
  return BLOCK_SIZE + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
}

/** @param {Buffer} tar */
function findFirstZeroBlock(tar) {
  for (let offset = 0; offset + BLOCK_SIZE <= tar.length; offset += BLOCK_SIZE) if (tar.subarray(offset, offset + BLOCK_SIZE).every((byte) => byte === 0)) return offset;
  throw new Error("Test archive has no zero block");
}

/** @param {Buffer} field */
function readAscii(field) { const end = field.indexOf(0); return field.subarray(0, end < 0 ? field.length : end).toString("ascii"); }
/** @param {Buffer} field */
function readCanonicalOctal(field) { return Number.parseInt(field.toString("ascii").replace(/ \0$/u, ""), 8); }

/** @param {Buffer} header */
function writeCanonicalChecksum(header) {
  header.fill(0x20, 148, 156);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const digits = checksum.toString(8).padStart(6, "0");
  header.write(`${digits} \0`, 148, 8, "ascii");
}

/** @param {Buffer} tar */
function encodeCanonicalGzip(tar) {
  const header = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x02, 0xff]);
  const body = deflateRawSync(tar, { level: 9 });
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc32(tar) >>> 0, 0);
  trailer.writeUInt32LE(tar.length >>> 0, 4);
  return Buffer.concat([header, body, trailer]);
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
/** @param {string} packStatement */
function fakeNpmBody(packStatement) {
  return `if (process.argv[2] === "--version") process.stdout.write("10.9.8\\n"); else { ${packStatement} }`;
}

/**
 * Exercise pinned runtime and subprocess failure paths without exposing a
 * production environment override for the npm authority.
 * @param {string} label
 * @param {{nodeVersion?:string,npmBody?:string,timeoutBody?:string,missingTimeout?:boolean}} options
 * @param {RegExp} pattern
 */
function assertCopiedPolicyReject(label, options, pattern) {
  const copyRoot = resolve(temporaryRoot, `copied-${label}`);
  const scripts = resolve(copyRoot, "scripts");
  mkdirSync(scripts, { recursive: true });
  const fakeCli = resolve(copyRoot, "fake-npm.mjs");
  writeFileSync(fakeCli, options.npmBody ?? fakeNpmBody("process.stdout.write('[]\\n')"));
  const fakeTimeout = resolve(copyRoot, "fake-timeout");
  if (!options.missingTimeout) {
    writeFileSync(fakeTimeout, options.timeoutBody ?? "#!/bin/sh\nexec /usr/bin/timeout \"$@\"\n", { mode: 0o755 });
    chmodSync(fakeTimeout, 0o755);
  }
  let source = readFileSync(SCRIPT_PATH, "utf8");
  if (options.nodeVersion) source = source.replace('const PINNED_NODE_VERSION = "v22.22.3";', `const PINNED_NODE_VERSION = ${JSON.stringify(options.nodeVersion)};`);
  source = source.replace('const PINNED_NPM_CLI = "/usr/lib/node_modules/npm/bin/npm-cli.js";', `const PINNED_NPM_CLI = ${JSON.stringify(fakeCli)};`);
  source = source.replace('const PINNED_TIMEOUT_CLI = "/usr/bin/timeout";', `const PINNED_TIMEOUT_CLI = ${JSON.stringify(fakeTimeout)};`);
  const copiedScript = resolve(scripts, "release-pack-policy.js");
  writeFileSync(copiedScript, source);
  const result = spawnSync(process.execPath, [copiedScript, "verify", "--target", fixture, "--commit", git(fixture, ["rev-parse", "HEAD"]), "--archive", fixtureArchive], { encoding: "utf8", timeout: 5_000 });
  assert.equal(result.error, undefined, `${label} must return before its outer watchdog: ${result.error?.message ?? ""}`);
  assert.notEqual(result.status, 0, `${label} must fail closed`);
  assert.match(result.stderr, pattern, label);
}

/**
 * Prove both npm operations have bounded process-group termination and cleanup.
 * Test-only deadlines are injected by editing a disposable source copy, never
 * through production environment variables.
 * @param {string} label
 * @param {"version"|"dry-pack"} operation
 * @param {boolean} spawnDescendant
 * @param {RegExp} pattern
 * @param {boolean} [resistTerm]
 */
function assertCopiedPolicyTimeout(label, operation, spawnDescendant, pattern, resistTerm = false) {
  const copyRoot = resolve(temporaryRoot, `copied-${label}`);
  const scripts = resolve(copyRoot, "scripts");
  mkdirSync(scripts, { recursive: true });
  const pidFile = resolve(copyRoot, "pids.txt");
  const fakeCli = resolve(copyRoot, "fake-npm.mjs");
  const descendant = spawnDescendant
    ? `const child = spawn(process.execPath, ["-e", ${JSON.stringify(resistTerm ? "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)" : "setInterval(()=>{},1000)")}], { stdio: "ignore" });\npids.push(child.pid);`
    : "";
  const hangBody = `const pids=[process.pid];\n${descendant}\nwriteFileSync(${JSON.stringify(pidFile)}, pids.join(" "));\n${resistTerm ? "process.on('SIGTERM',()=>{});" : ""}\nsetInterval(()=>{},1000);`;
  const body = `import { spawn } from "node:child_process";\nimport { writeFileSync } from "node:fs";\n${operation === "version"
    ? hangBody
    : `if (process.argv[2] === "--version") process.stdout.write("10.9.8\\n"); else {\n${hangBody}\n}`}\n`;
  writeFileSync(fakeCli, body);
  const uniquePrefix = `aerobeat-release-pack-test-${process.pid}-${label}-`;
  const unrelated = resolve(tmpdir(), `${uniquePrefix}unrelated`);
  mkdirSync(unrelated);
  let source = readFileSync(SCRIPT_PATH, "utf8")
    .replace('const PINNED_NPM_CLI = "/usr/lib/node_modules/npm/bin/npm-cli.js";', `const PINNED_NPM_CLI = ${JSON.stringify(fakeCli)};`)
    .replace("const NPM_VERSION_TIMEOUT_SECONDS = 15;", "const NPM_VERSION_TIMEOUT_SECONDS = 0.25;")
    .replace("const NPM_DRY_PACK_TIMEOUT_SECONDS = 120;", "const NPM_DRY_PACK_TIMEOUT_SECONDS = 0.25;")
    .replace("const NPM_TIMEOUT_KILL_AFTER_SECONDS = 2;", "const NPM_TIMEOUT_KILL_AFTER_SECONDS = 0.2;")
    .replace('const ISOLATED_TEMP_PREFIX = "aerobeat-release-pack-";', `const ISOLATED_TEMP_PREFIX = ${JSON.stringify(uniquePrefix)};`);
  const copiedScript = resolve(scripts, "release-pack-policy.js");
  writeFileSync(copiedScript, source);
  const result = spawnSync(process.execPath, [copiedScript, "verify", "--target", fixture, "--commit", git(fixture, ["rev-parse", "HEAD"]), "--archive", fixtureArchive], {
    encoding: "utf8",
    timeout: 5_000,
    killSignal: "SIGKILL"
  });
  const pids = existsSync(pidFile) ? readFileSync(pidFile, "utf8").trim().split(/\s+/u).filter(Boolean).map(Number) : [];
  try {
    assert.equal(result.error, undefined, `${label} must return before its outer watchdog: ${result.error?.message ?? ""}`);
    assert.notEqual(result.status, 0, `${label} must fail closed`);
    assert.match(result.stderr, pattern, label);
    assert(pids.length >= 1, `${label} fake CLI must record its PID`);
    for (const pid of pids) assertProcessGone(pid, label);
    assert.equal(git(fixture, ["status", "--porcelain=v1", "--untracked-files=all"]), "", `${label} must leave target clean`);
    assert.equal(statSync(resolve(fixture, "plain.txt")).mode & 0o777, 0o644, `${label} must preserve target modes`);
    assert.deepEqual(readdirSync(tmpdir()).filter((name) => name.startsWith(uniquePrefix)), [`${uniquePrefix}unrelated`]);
    assert.equal(existsSync(unrelated), true, `${label} cleanup must preserve unrelated lookalike path`);
  } finally {
    for (const pid of pids) {
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
    rmSync(unrelated, { recursive: true, force: true });
  }
}

/** @param {number} pid @param {string} label */
function assertProcessGone(pid, label) {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    try { process.kill(pid, 0); }
    catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") return;
      throw error;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
  assert.fail(`${label} left process ${pid} alive after timeout cleanup`);
}

/** @param {string} root @param {string[]} args */
function git(root, args) { return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
/** @param {Buffer} value */
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
