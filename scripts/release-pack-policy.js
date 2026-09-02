// @ts-check

import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, posix, relative, resolve, sep } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { crc32, inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const SCRIPT_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAR_BLOCK_SIZE = 512;
const TAR_TERMINATOR_SIZE = TAR_BLOCK_SIZE * 2;
const PINNED_MTIME_SECONDS = 499162500;
const CANONICAL_GZIP_HEADER = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff]);
const PINNED_NODE_VERSION = "v22.22.3";
const PINNED_NPM_VERSION = "10.9.8";
const PINNED_NPM_CLI = "/usr/lib/node_modules/npm/bin/npm-cli.js";
const PINNED_TIMEOUT_CLI = "/usr/bin/timeout";
const PINNED_TIMEOUT_VERSION = "timeout (GNU coreutils) 9.4";
const NPM_VERSION_TIMEOUT_SECONDS = 15;
const NPM_DRY_PACK_TIMEOUT_SECONDS = 120;
const NPM_TIMEOUT_KILL_AFTER_SECONDS = 2;
const TIMEOUT_IDENTITY_TIMEOUT_MS = 5_000;
const TIMEOUT_OUTER_MARGIN_MS = 5_000;
const ISOLATED_TEMP_PARENT = "/tmp";
const ISOLATED_TEMP_PREFIX = "aerobeat-release-pack-";
const EXPECTED_FILESYSTEM_MODES = new Map([
  ["100644", 0o644],
  ["100755", 0o755]
]);
const METADATA_KEYS = ["bundled", "entryCount", "filename", "files", "id", "integrity", "name", "shasum", "size", "unpackedSize", "version"];
const METADATA_FILE_KEYS = ["mode", "path", "size"];

/**
 * Normalize a clean detached worktree from Git-index modes and assert the result.
 * The canonical checkout containing this script is always refused.
 * @param {string} target
 * @param {string} expectedCommit
 */
export function normalizeDetachedTarget(target, expectedCommit) {
  const context = inspectDetachedTarget(target, expectedCommit);
  assertClean(context.root);
  for (const entry of context.entries) chmodSync(resolveTrackedPath(context.root, entry.path), entry.filesystemMode);
  assertTrackedModes(context.root, context.entries);
  assertClean(context.root);
  return summarizeTarget(context);
}

/**
 * Assert a detached target is normalized without changing it.
 * @param {string} target
 * @param {string} expectedCommit
 */
export function assertDetachedTarget(target, expectedCommit) {
  const context = inspectDetachedTarget(target, expectedCommit);
  assertClean(context.root);
  assertTrackedModes(context.root, context.entries);
  return summarizeTarget(context);
}

/**
 * Verify one npm 10.9.8 archive against metadata independently derived by the
 * policy tool from the exact normalized detached target. The caller cannot
 * supply package inventory or hashes. This accepts one canonical single-member
 * gzip + USTAR regular-file grammar, not general tar input.
 * @param {string} target
 * @param {string} expectedCommit
 * @param {string} archivePath
 * @param {string | undefined} manifestPath
 */
export function verifyArchive(target, expectedCommit, archivePath, manifestPath) {
  const context = inspectDetachedTarget(target, expectedCommit);
  assertClean(context.root);
  assertTrackedModes(context.root, context.entries);
  const resolvedArchive = assertExternalExistingFile(archivePath, context.root, "archive");
  const archive = readFileSync(resolvedArchive);
  const packageRecord = readPackageRecord(context.root);
  const derived = deriveNpmPackMetadata(context);
  const metadata = readDerivedMetadata(derived.stdout, resolvedArchive, archive, context, packageRecord);
  assertClean(context.root);
  assertTrackedModes(context.root, context.entries);
  const tar = decodeCanonicalGzip(archive);
  const rows = verifyCanonicalTar(tar, metadata.files, context, packageRecord);
  assertArchiveIdentity(metadata, archive);
  const modeCounts = new Map();
  for (const row of rows) modeCounts.set(row.mode, (modeCounts.get(row.mode) ?? 0) + 1);
  const manifest = rows
    .slice()
    .sort((left, right) => compareCodePoints(left.path, right.path))
    .map((row) => `${JSON.stringify(row.path)}\t${row.mode}\t${row.size}\t${row.sha256}\n`)
    .join("");
  if (manifestPath) {
    const resolvedManifest = assertExternalOutputPath(manifestPath, context.root, "manifest");
    writeFileSync(resolvedManifest, manifest);
  }
  return {
    target: context.root,
    commit: context.commit,
    archive: resolvedArchive,
    derivedMetadataSha256: sha256(Buffer.from(derived.stdout)),
    archiveSha256: sha256(archive),
    decompressedTarSha256: sha256(tar),
    manifestSha256: sha256(Buffer.from(manifest)),
    memberCount: rows.length,
    paxCount: 0,
    modeCounts: Object.fromEntries([...modeCounts].sort(([left], [right]) => compareCodePoints(left, right)))
  };
}

/**
 * Derive the sole authoritative npm-pack record from the normalized detached
 * target with the pinned Node/npm toolchain and a sanitized isolated runtime.
 * @param {{root:string,commit:string,entries:IndexEntry[]}} context
 */
function deriveNpmPackMetadata(context) {
  if (process.version !== PINNED_NODE_VERSION) throw new Error(`Release pack policy requires Node ${PINNED_NODE_VERSION}, received ${process.version}`);
  const npmCli = realpathSync(PINNED_NPM_CLI);
  if (npmCli !== PINNED_NPM_CLI) throw new Error(`Pinned npm CLI must resolve exactly to ${PINNED_NPM_CLI}`);
  const timeoutCli = validatePinnedTimeout();
  const parent = realpathSync(ISOLATED_TEMP_PARENT);
  const temporaryRoot = mkdtempSync(resolve(parent, ISOLATED_TEMP_PREFIX));
  try {
    assertOwnedTemporaryRoot(temporaryRoot, parent);
    assertPathSeparate(temporaryRoot, context.root, "isolated temporary root");
    assertPathSeparate(temporaryRoot, SCRIPT_REPOSITORY_ROOT, "isolated temporary root");
    const cache = resolve(temporaryRoot, "cache");
    const temporary = resolve(temporaryRoot, "tmp");
    const output = resolve(temporaryRoot, "output");
    const home = resolve(temporaryRoot, "home");
    mkdirSync(cache, { mode: 0o700 });
    mkdirSync(temporary, { mode: 0o700 });
    mkdirSync(output, { mode: 0o700 });
    mkdirSync(home, { mode: 0o700 });
    const userConfig = resolve(temporaryRoot, "user.npmrc");
    const globalConfig = resolve(temporaryRoot, "global.npmrc");
    writeFileSync(userConfig, "", { mode: 0o600 });
    writeFileSync(globalConfig, "", { mode: 0o600 });
    for (const path of [cache, temporary, output, home, userConfig, globalConfig]) {
      const actual = realpathSync(path);
      if (!isPathInside(actual, temporaryRoot)) throw new Error(`Isolated npm path escaped temporary root: ${path}`);
      assertPathSeparate(actual, context.root, "isolated npm path");
      assertPathSeparate(actual, SCRIPT_REPOSITORY_ROOT, "isolated npm path");
    }
    const environment = {
      PATH: "/usr/bin:/bin",
      HOME: home,
      TMPDIR: temporary,
      TMP: temporary,
      TEMP: temporary,
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      TZ: "UTC",
      NO_COLOR: "1",
      npm_config_cache: cache,
      npm_config_userconfig: userConfig,
      npm_config_globalconfig: globalConfig,
      npm_config_ignore_scripts: "true",
      npm_config_foreground_scripts: "false",
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
      npm_config_color: "false",
      npm_config_loglevel: "silent",
      npm_config_offline: "true"
    };
    const version = runPinnedNpm(["--version"], context.root, environment, "npm version check", NPM_VERSION_TIMEOUT_SECONDS, timeoutCli);
    if (version.stdout !== `${PINNED_NPM_VERSION}\n` || version.stderr !== "") {
      throw new Error(`Release pack policy requires npm ${PINNED_NPM_VERSION} with noise-free output`);
    }
    const result = runPinnedNpm([
      "pack", "--dry-run", "--json", "--ignore-scripts=true", "--foreground-scripts=false",
      "--pack-destination", output, "--cache", cache, "--userconfig", userConfig,
      "--globalconfig", globalConfig, "--offline=true", "--loglevel=silent", "--color=false"
    ], context.root, environment, "internal npm dry-pack derivation", NPM_DRY_PACK_TIMEOUT_SECONDS, timeoutCli);
    if (result.stderr !== "") throw new Error("Internal npm dry-pack derivation produced unexpected stderr noise");
    if (!result.stdout.endsWith("\n") || result.stdout.trim() === "") throw new Error("Internal npm dry-pack derivation produced malformed stdout");
    if (readdirSync(output).length !== 0) throw new Error("Internal npm dry-pack derivation unexpectedly wrote package output");
    assertClean(context.root);
    assertTrackedModes(context.root, context.entries);
    return { stdout: result.stdout };
  } finally {
    assertOwnedTemporaryRoot(temporaryRoot, parent);
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

/** Validate the absolute GNU timeout watchdog before trusting it with npm liveness. */
function validatePinnedTimeout() {
  let timeoutCli;
  try { timeoutCli = realpathSync(PINNED_TIMEOUT_CLI); }
  catch (error) { throw new Error(`Pinned GNU timeout is unavailable at ${PINNED_TIMEOUT_CLI}: ${error instanceof Error ? error.message : String(error)}`); }
  if (timeoutCli !== PINNED_TIMEOUT_CLI || !lstatSync(timeoutCli).isFile()) {
    throw new Error(`Pinned GNU timeout must resolve exactly to regular file ${PINNED_TIMEOUT_CLI}`);
  }
  const result = spawnSync(timeoutCli, ["--version"], {
    env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" },
    encoding: "utf8",
    maxBuffer: 64 * 1024,
    timeout: TIMEOUT_IDENTITY_TIMEOUT_MS,
    killSignal: "SIGKILL",
    windowsHide: true
  });
  if (result.error) {
    const timedOut = "code" in result.error && result.error.code === "ETIMEDOUT";
    throw new Error(timedOut ? "Pinned GNU timeout identity check timed out" : `Pinned GNU timeout identity check failed to start: ${result.error.message}`);
  }
  if (result.signal) throw new Error(`Pinned GNU timeout identity check terminated by signal ${result.signal}`);
  if (result.status !== 0) throw new Error(`Pinned GNU timeout identity check failed with exit ${result.status}: ${result.stderr || result.stdout}`);
  if (result.stderr !== "" || result.stdout.split("\n", 1)[0] !== PINNED_TIMEOUT_VERSION) {
    throw new Error(`Pinned GNU timeout identity mismatch; expected ${PINNED_TIMEOUT_VERSION}`);
  }
  return timeoutCli;
}

/**
 * Run one pinned npm operation under GNU timeout's process-group watchdog.
 * Production deadlines are fixed source policy, not caller/environment knobs.
 * @param {string[]} args
 * @param {string} cwd
 * @param {NodeJS.ProcessEnv} environment
 * @param {string} label
 * @param {number} deadlineSeconds
 * @param {string} timeoutCli
 */
function runPinnedNpm(args, cwd, environment, label, deadlineSeconds, timeoutCli) {
  if (!Number.isFinite(deadlineSeconds) || deadlineSeconds <= 0) throw new Error(`${label} has an invalid timeout policy`);
  const deadline = `${deadlineSeconds}s`;
  const killAfter = `${NPM_TIMEOUT_KILL_AFTER_SECONDS}s`;
  const timeoutArguments = [
    "--verbose", "--signal=TERM", `--kill-after=${killAfter}`, deadline,
    process.execPath, PINNED_NPM_CLI, ...args
  ];
  const result = spawnSync(timeoutCli, timeoutArguments, {
    cwd,
    env: environment,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: Math.ceil((deadlineSeconds + NPM_TIMEOUT_KILL_AFTER_SECONDS) * 1000) + TIMEOUT_OUTER_MARGIN_MS,
    killSignal: "SIGKILL",
    windowsHide: true
  });
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  const watchdogTimedOut = stderr.includes(`${timeoutCli}: sending signal TERM to command`)
    || stderr.includes(`${timeoutCli}: sending signal KILL to command`);
  if (watchdogTimedOut) {
    throw new Error(`${label} timed out after ${deadline}; process group received TERM with KILL escalation after ${killAfter}`);
  }
  if (result.error) {
    const outerTimedOut = "code" in result.error && result.error.code === "ETIMEDOUT";
    throw new Error(outerTimedOut
      ? `${label} timeout watchdog failed to return within its bounded outer deadline`
      : `${label} failed to start: ${result.error.message}`);
  }
  if (result.signal) throw new Error(`${label} terminated by signal ${result.signal}`);
  if (result.status !== 0) throw new Error(`${label} failed with exit ${result.status}: ${stderr || result.stdout}`);
  if (typeof result.stdout !== "string" || typeof result.stderr !== "string") throw new Error(`${label} did not return text output`);
  return { stdout: result.stdout, stderr: result.stderr };
}

/** @param {string} path @param {string} targetRoot @param {string} label */
function assertExternalExistingFile(path, targetRoot, label) {
  if (!path) throw new Error(`verify requires --${label}`);
  const actual = realpathSync(resolve(path));
  if (!lstatSync(actual).isFile()) throw new Error(`--${label} must name a regular file`);
  assertPathOutside(actual, targetRoot, label);
  assertPathOutside(actual, SCRIPT_REPOSITORY_ROOT, label);
  return actual;
}

/** @param {string} path @param {string} targetRoot @param {string} label */
function assertExternalOutputPath(path, targetRoot, label) {
  if (!path) throw new Error(`verify requires --${label}`);
  const parent = realpathSync(dirname(resolve(path)));
  assertPathOutside(parent, targetRoot, label);
  assertPathOutside(parent, SCRIPT_REPOSITORY_ROOT, label);
  const actual = resolve(parent, basename(path));
  try {
    const existing = realpathSync(actual);
    assertPathOutside(existing, targetRoot, label);
    assertPathOutside(existing, SCRIPT_REPOSITORY_ROOT, label);
    if (!lstatSync(existing).isFile()) throw new Error(`--${label} must name a regular file`);
    return existing;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return actual;
    throw error;
  }
}

/** @param {string} candidate @param {string} protectedRoot @param {string} label */
function assertPathOutside(candidate, protectedRoot, label) {
  const protectedReal = realpathSync(protectedRoot);
  const candidateReal = realpathSync(candidate);
  if (candidateReal === protectedReal || isPathInside(candidateReal, protectedReal)) {
    throw new Error(`${label} must be outside and must not alias the protected checkout ${protectedReal}`);
  }
}

/** @param {string} candidate @param {string} protectedRoot @param {string} label */
function assertPathSeparate(candidate, protectedRoot, label) {
  const protectedReal = realpathSync(protectedRoot);
  const candidateReal = realpathSync(candidate);
  if (candidateReal === protectedReal || isPathInside(candidateReal, protectedReal) || isPathInside(protectedReal, candidateReal)) {
    throw new Error(`${label} must be outside and must not alias the protected checkout ${protectedReal}`);
  }
}

/** @param {string} candidate @param {string} parent */
function isPathInside(candidate, parent) { return candidate.startsWith(`${parent}${sep}`); }

/** @param {string} root @param {string} parent */
function assertOwnedTemporaryRoot(root, parent) {
  const actual = realpathSync(root);
  if (actual !== root || dirname(actual) !== parent || !basename(actual).startsWith(ISOLATED_TEMP_PREFIX) || !lstatSync(actual).isDirectory()) {
    throw new Error(`Refusing unsafe temporary cleanup path ${root}`);
  }
}

/** @param {string} root */
function readPackageRecord(root) {
  let value;
  try { value = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")); }
  catch { throw new Error("Detached target package.json must be valid JSON"); }
  if (!isPlainRecord(value) || typeof value.name !== "string" || !value.name || typeof value.version !== "string" || !value.version) {
    throw new Error("Detached target package.json must contain nonempty name and version strings");
  }
  const bins = new Set();
  if (typeof value.bin === "string") bins.add(normalizeBinPath(value.bin));
  else if (value.bin !== undefined) {
    if (!isPlainRecord(value.bin)) throw new Error("Unsupported package.json bin contract");
    for (const binPath of Object.values(value.bin)) {
      if (typeof binPath !== "string") throw new Error("Unsupported package.json bin contract");
      bins.add(normalizeBinPath(binPath));
    }
  }
  return { name: value.name, version: value.version, bins };
}

/** @param {string} value */
function normalizeBinPath(value) {
  const normalized = value.replace(/^\.\//u, "");
  assertSafePackageRelativePath(normalized, "package.json bin");
  return normalized;
}

/**
 * @param {string} metadataText
 * @param {string} archivePath
 * @param {Buffer} archive
 * @param {{root:string,commit:string,entries:IndexEntry[]}} context
 * @param {{name:string,version:string,bins:Set<string>}} packageRecord
 */
function readDerivedMetadata(metadataText, archivePath, archive, context, packageRecord) {
  let document;
  try { document = JSON.parse(metadataText); }
  catch { throw new Error("Internally derived npm pack metadata must be valid JSON without stdout noise"); }
  if (!Array.isArray(document) || document.length !== 1 || !isPlainRecord(document[0])) {
    throw new Error("Internally derived npm pack metadata must be a one-record JSON array");
  }
  const metadata = document[0];
  assertExactKeys(metadata, METADATA_KEYS, "npm pack metadata");
  const expectedFilename = `${packageRecord.name.replace(/^@/u, "").replaceAll("/", "-")}-${packageRecord.version}.tgz`;
  if (metadata.name !== packageRecord.name || metadata.version !== packageRecord.version || metadata.id !== `${packageRecord.name}@${packageRecord.version}`) {
    throw new Error("npm pack metadata package identity does not match detached target package.json");
  }
  if (metadata.filename !== expectedFilename || basename(resolve(archivePath)) !== expectedFilename) {
    throw new Error(`npm pack metadata filename must be ${expectedFilename}`);
  }
  assertSafeInteger(metadata.size, "metadata size");
  assertSafeInteger(metadata.unpackedSize, "metadata unpackedSize");
  assertSafeInteger(metadata.entryCount, "metadata entryCount");
  if (typeof metadata.shasum !== "string" || !/^[0-9a-f]{40}$/u.test(metadata.shasum)) throw new Error("Internally derived npm metadata shasum is malformed");
  if (typeof metadata.integrity !== "string" || !/^sha512-[A-Za-z0-9+/]{86}==$/u.test(metadata.integrity)) throw new Error("Internally derived npm metadata integrity is malformed");
  if (!Array.isArray(metadata.bundled) || metadata.bundled.length !== 0) throw new Error("npm pack metadata bundled must be an empty array");
  if (!Array.isArray(metadata.files) || metadata.files.length === 0 || metadata.entryCount !== metadata.files.length) {
    throw new Error("npm pack metadata files must be a nonempty exact entryCount array");
  }

  const tracked = new Map(context.entries.map((entry) => [entry.path, entry]));
  const seen = new Set();
  let unpackedSize = 0;
  const files = metadata.files.map((file, index) => {
    if (!isPlainRecord(file)) throw new Error(`npm metadata file ${index} must be a plain record`);
    assertExactKeys(file, METADATA_FILE_KEYS, `npm metadata file ${index}`);
    if (typeof file.path !== "string") throw new Error(`npm metadata file ${index} path must be a string`);
    assertSafePackageRelativePath(file.path, "npm metadata file");
    if (seen.has(file.path)) throw new Error(`Duplicate npm metadata file ${file.path}`);
    seen.add(file.path);
    assertSafeInteger(file.size, `metadata size for ${file.path}`);
    assertSafeInteger(file.mode, `metadata mode for ${file.path}`);
    const entry = tracked.get(file.path);
    if (!entry) throw new Error(`npm metadata file ${file.path} is not tracked in ${context.commit}`);
    const source = readFileSync(resolveTrackedPath(context.root, file.path));
    if (source.length !== file.size) throw new Error(`npm metadata size for ${file.path} does not match exact tracked bytes`);
    const expectedMode = expectedNpmMode(entry, file.path, packageRecord.bins);
    if (file.mode !== expectedMode) {
      throw new Error(`npm metadata mode for ${file.path} is ${formatMode(file.mode)}, expected ${formatMode(expectedMode)}`);
    }
    unpackedSize += file.size;
    if (!Number.isSafeInteger(unpackedSize)) throw new Error("npm metadata unpacked size overflow");
    return { path: file.path, size: file.size, mode: file.mode, source };
  });
  const npmComparator = new Intl.Collator("en", { sensitivity: "case", numeric: true }).compare;
  const expectedOrder = [
    ...files.filter((file) => file.path[0] === file.path[0].toUpperCase()).sort((left, right) => npmComparator(left.path, right.path)),
    ...files.filter((file) => file.path[0] !== file.path[0].toUpperCase()).sort((left, right) => npmComparator(left.path, right.path))
  ];
  if (files.some((file, index) => file.path !== expectedOrder[index].path)) throw new Error("npm metadata files do not use the pinned npm locale path order");
  if (metadata.unpackedSize !== unpackedSize) throw new Error("npm metadata unpackedSize does not equal exact file-byte sum");
  return { files, size: metadata.size, shasum: metadata.shasum, integrity: metadata.integrity };
}

/** @param {{size:number,shasum:string,integrity:string}} metadata @param {Buffer} archive */
function assertArchiveIdentity(metadata, archive) {
  if (metadata.size !== archive.length) throw new Error(`Archive byte length ${archive.length} does not match internally derived npm metadata ${metadata.size}`);
  const archiveSha1 = digest("sha1", archive, "hex");
  const archiveSha512 = `sha512-${digest("sha512", archive, "base64")}`;
  if (metadata.shasum !== archiveSha1) throw new Error("Archive SHA-1 does not match internally derived npm metadata");
  if (metadata.integrity !== archiveSha512) throw new Error("Archive SHA-512 integrity does not match internally derived npm metadata");
}

/** @param {Buffer} archive */
function decodeCanonicalGzip(archive) {
  if (archive.length < CANONICAL_GZIP_HEADER.length + 8 || !archive.subarray(0, 10).equals(CANONICAL_GZIP_HEADER)) {
    throw new Error("Archive does not use the canonical npm gzip header");
  }
  const deflate = archive.subarray(10, archive.length - 8);
  let inflated;
  try { inflated = inflateRawSync(deflate, { info: true }); }
  catch { throw new Error("Archive contains an invalid canonical deflate stream"); }
  if (!inflated || !Buffer.isBuffer(inflated.buffer) || inflated.engine.bytesWritten !== deflate.length) {
    throw new Error("Archive contains concatenated or trailing compressed data");
  }
  const tar = inflated.buffer;
  const trailer = archive.subarray(archive.length - 8);
  if (trailer.readUInt32LE(0) !== (crc32(tar) >>> 0)) throw new Error("Archive gzip CRC32 trailer does not match decompressed tar");
  if (trailer.readUInt32LE(4) !== (tar.length >>> 0)) throw new Error("Archive gzip ISIZE trailer does not match decompressed tar");
  return tar;
}

/**
 * @param {Buffer} tar
 * @param {{path:string,size:number,mode:number,source:Buffer}[]} metadataFiles
 * @param {{root:string,commit:string,entries:IndexEntry[]}} context
 * @param {{bins:Set<string>}} packageRecord
 */
function verifyCanonicalTar(tar, metadataFiles, context, packageRecord) {
  if (tar.length < TAR_TERMINATOR_SIZE || tar.length % TAR_BLOCK_SIZE !== 0) throw new Error("Tar must use exact 512-byte framing and a two-block terminator");
  const expectedByPath = new Map(metadataFiles.map((file) => [file.path, file]));
  const seen = new Set();
  const rows = [];
  let offset = 0;
  for (let memberIndex = 0; memberIndex < metadataFiles.length; memberIndex += 1) {
    if (offset + TAR_BLOCK_SIZE > tar.length - TAR_TERMINATOR_SIZE) throw new Error("Tar member inventory is a subset of internally derived npm metadata");
    const actualHeader = tar.subarray(offset, offset + TAR_BLOCK_SIZE);
    if (isZeroBlock(actualHeader)) throw new Error("Tar member inventory is a subset of internally derived npm metadata");
    const archivePath = readCanonicalHeaderPath(actualHeader, offset);
    const sourcePath = archivePath.slice("package/".length);
    const file = expectedByPath.get(sourcePath);
    if (!file) throw new Error(`Tar contains an extra member not present in internally derived npm inventory: ${archivePath}`);
    if (seen.has(sourcePath)) throw new Error(`Duplicate npm tar member ${sourcePath}`);
    seen.add(sourcePath);
    const entry = context.entries.find((candidate) => candidate.path === sourcePath);
    if (!entry) throw new Error(`Tar member ${sourcePath} is not tracked in ${context.commit}`);
    const expectedMode = expectedNpmMode(entry, sourcePath, packageRecord.bins);
    const expectedHeader = buildCanonicalHeader(archivePath, expectedMode, file.size);
    if (!actualHeader.equals(expectedHeader)) {
      const difference = firstDifference(actualHeader, expectedHeader);
      throw new Error(`Non-canonical npm USTAR header for ${archivePath} at byte ${offset + difference}`);
    }
    const contentStart = offset + TAR_BLOCK_SIZE;
    const contentEnd = contentStart + file.size;
    const paddedEnd = contentStart + Math.ceil(file.size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
    if (paddedEnd > tar.length - TAR_TERMINATOR_SIZE) throw new Error(`Truncated tar member ${archivePath}`);
    if (!tar.subarray(contentStart, contentEnd).equals(file.source)) throw new Error(`Tar member ${sourcePath} does not match exact tracked target bytes`);
    if (!tar.subarray(contentEnd, paddedEnd).every((byte) => byte === 0)) throw new Error(`Nonzero tar member padding at ${archivePath}`);
    rows.push({ path: archivePath, mode: formatMode(expectedMode), size: file.size, sha256: sha256(file.source) });
    offset = paddedEnd;
  }
  if (seen.size !== metadataFiles.length) throw new Error("Tar member inventory does not match internally derived npm metadata");
  if (offset + TAR_TERMINATOR_SIZE !== tar.length || !isZeroBlock(tar.subarray(offset, offset + 512)) || !isZeroBlock(tar.subarray(offset + 512))) {
    throw new Error("Tar must end with exactly two zero blocks and exact EOF after internally derived npm membership");
  }
  return rows;
}

/** @param {Buffer} header @param {number} offset */
function readCanonicalHeaderPath(header, offset) {
  const name = readCanonicalAsciiField(header, 0, 100, "name", offset, false);
  const prefix = readCanonicalAsciiField(header, 345, 155, "prefix", offset, true);
  const path = prefix ? `${prefix}/${name}` : name;
  assertSafeNpmMemberPath(path);
  return path;
}

/** @param {Buffer} header @param {number} start @param {number} length @param {string} label @param {number} offset @param {boolean} allowEmpty */
function readCanonicalAsciiField(header, start, length, label, offset, allowEmpty) {
  const field = header.subarray(start, start + length);
  const nul = field.indexOf(0);
  const end = nul < 0 ? field.length : nul;
  if (nul >= 0 && !field.subarray(nul).every((byte) => byte === 0)) throw new Error(`Malformed tar ${label} field at byte ${offset}`);
  const bytes = field.subarray(0, end);
  if (!allowEmpty && bytes.length === 0) throw new Error(`Malformed tar ${label} field at byte ${offset}: empty value`);
  if (!bytes.every((byte) => byte >= 0x20 && byte <= 0x7e)) throw new Error(`Malformed tar ${label} field at byte ${offset}: canonical ASCII required`);
  return bytes.toString("ascii");
}

/** @param {string} path @param {number} mode @param {number} size */
function buildCanonicalHeader(path, mode, size) {
  const [name, prefix] = splitCanonicalTarPath(path);
  const header = Buffer.alloc(TAR_BLOCK_SIZE);
  writeCanonicalString(header, 0, 100, name);
  writeCanonicalOctal(header, 100, 8, mode);
  // portable npm tar leaves uid/gid and uname/gname/linkpath as all-zero fields
  writeCanonicalOctal(header, 124, 12, size);
  writeCanonicalOctal(header, 136, 12, PINNED_MTIME_SECONDS);
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  header.write("ustar\0", 257, "ascii");
  header.write("00", 263, "ascii");
  writeCanonicalOctal(header, 329, 8, 0);
  writeCanonicalOctal(header, 337, 8, 0);
  writeCanonicalString(header, 345, 155, prefix);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeCanonicalOctal(header, 148, 8, checksum);
  return header;
}

/** @param {string} path */
function splitCanonicalTarPath(path) {
  assertSafeNpmMemberPath(path);
  if (Buffer.byteLength(path, "ascii") < 100) return [path, ""];
  const root = posix.parse(path).root || ".";
  let prefix = posix.dirname(path);
  let name = posix.basename(path);
  while (prefix !== root) {
    if (Buffer.byteLength(name, "ascii") <= 100 && Buffer.byteLength(prefix, "ascii") <= 155) return [name, prefix];
    if (Buffer.byteLength(name, "ascii") > 100 && Buffer.byteLength(prefix, "ascii") <= 155) {
      throw new Error(`Tar path would require forbidden PAX/truncation: ${path}`);
    }
    name = posix.join(posix.basename(prefix), name);
    prefix = posix.dirname(prefix);
  }
  throw new Error(`Tar path does not fit canonical USTAR fields: ${path}`);
}

/** @param {Buffer} target @param {number} start @param {number} length @param {string} value */
function writeCanonicalString(target, start, length, value) {
  const bytes = Buffer.from(value, "ascii");
  if (bytes.length > length || !bytes.every((byte) => byte >= 0x20 && byte <= 0x7e)) throw new Error(`Non-canonical tar string ${value}`);
  bytes.copy(target, start);
}

/** @param {Buffer} target @param {number} start @param {number} length @param {number} value */
function writeCanonicalOctal(target, start, length, value) {
  assertSafeInteger(value, "tar numeric value");
  const digits = value.toString(8);
  if (digits.length > length - 1) throw new Error(`Tar numeric value ${value} requires forbidden base-256 encoding`);
  const text = digits.length === length - 1 ? `${digits}\0` : `${digits.padStart(length - 2, "0")} \0`;
  target.write(text, start, length, "ascii");
}

/** @param {IndexEntry} entry @param {string} path @param {Set<string>} bins */
function expectedNpmMode(entry, path, bins) {
  return bins.has(path) ? entry.filesystemMode | 0o111 : entry.filesystemMode;
}

/** @param {string} target @param {string} expectedCommit */
function inspectDetachedTarget(target, expectedCommit) {
  if (!target || !expectedCommit) throw new Error("Both --target and --commit are required");
  const root = realpathSync(git(target, ["rev-parse", "--show-toplevel"]));
  if (root !== realpathSync(resolve(target))) throw new Error(`--target must name the worktree root exactly: ${root}`);
  if (root === realpathSync(SCRIPT_REPOSITORY_ROOT)) throw new Error("Refusing to operate on the canonical checkout containing this script");
  let attached = true;
  try { git(root, ["symbolic-ref", "-q", "HEAD"]); } catch { attached = false; }
  if (attached) throw new Error(`Refusing attached worktree ${root}; an explicitly detached target is required`);
  const commit = git(root, ["rev-parse", "HEAD"]);
  const wanted = git(root, ["rev-parse", `${expectedCommit}^{commit}`]);
  if (commit !== wanted) throw new Error(`Detached target is ${commit}, expected ${wanted}`);
  const entries = parseGitIndex(root);
  return { root, commit, entries };
}

/** @typedef {{path:string,gitMode:string,objectId:string,filesystemMode:number}} IndexEntry */
/** @param {string} root */
function parseGitIndex(root) {
  const output = execFileSync("git", ["-C", root, "ls-files", "--stage", "-z"]);
  return output.toString("utf8").split("\0").filter(Boolean).map((record) => {
    const tab = record.indexOf("\t");
    if (tab < 0) throw new Error("Malformed Git-index entry");
    const metadata = record.slice(0, tab).split(" ");
    const path = record.slice(tab + 1);
    const [gitMode, objectId, stage] = metadata;
    if (stage !== "0") throw new Error(`Unmerged Git-index entry is forbidden: ${path}`);
    const filesystemMode = EXPECTED_FILESYSTEM_MODES.get(gitMode);
    if (filesystemMode === undefined) throw new Error(`Unsupported tracked Git mode ${gitMode} at ${path}`);
    return { path, gitMode, objectId, filesystemMode };
  });
}

/** @param {string} root @param {IndexEntry[]} entries */
function assertTrackedModes(root, entries) {
  for (const entry of entries) {
    const path = resolveTrackedPath(root, entry.path);
    const stat = lstatSync(path);
    if (!stat.isFile()) throw new Error(`Tracked entry is not a regular file: ${entry.path}`);
    const actual = stat.mode & 0o7777;
    if (actual !== entry.filesystemMode) throw new Error(`Tracked file ${entry.path} has mode ${formatMode(actual)}, expected ${formatMode(entry.filesystemMode)} from Git ${entry.gitMode}`);
  }
}

/** @param {string} root */
function assertClean(root) {
  const status = git(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status) throw new Error(`Detached target must be clean:\n${status}`);
}

/** @param {{root:string,commit:string,entries:IndexEntry[]}} context */
function summarizeTarget(context) {
  const modeCounts = new Map();
  for (const entry of context.entries) {
    const mode = formatMode(entry.filesystemMode);
    modeCounts.set(mode, (modeCounts.get(mode) ?? 0) + 1);
  }
  return { target: context.root, commit: context.commit, trackedFileCount: context.entries.length, modeCounts: Object.fromEntries([...modeCounts].sort(([left], [right]) => compareCodePoints(left, right))) };
}

/** @param {string} path */
function assertSafeNpmMemberPath(path) {
  if (!path.startsWith("package/")) throw new Error(`Unsafe npm member path ${path || "<empty>"}`);
  assertSafePackageRelativePath(path.slice("package/".length), "npm member");
}

/** @param {string} path @param {string} label */
function assertSafePackageRelativePath(path, label) {
  if (!path || path.startsWith("/") || path.startsWith("\\") || path.includes("\\") || path.endsWith("/") || /[^\x20-\x7e]/u.test(path)) throw new Error(`Unsafe ${label} path ${path || "<empty>"}`);
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || /^[A-Za-z]:$/u.test(segment))) throw new Error(`Unsafe ${label} path ${path}`);
}

/** @param {string} root @param {string} path */
function resolveTrackedPath(root, path) {
  const resolved = resolve(root, path);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) throw new Error(`Unsafe tracked path ${path}`);
  return resolved;
}

/** @param {unknown} value */
function isPlainRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
/** @param {Record<string,unknown>} value @param {string[]} expected @param {string} label */
function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort(compareCodePoints);
  const wanted = expected.slice().sort(compareCodePoints);
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw new Error(`${label} has an unexpected schema`);
}
/** @param {unknown} value @param {string} label */
function assertSafeInteger(value, label) { if (!Number.isSafeInteger(value) || /** @type {number} */ (value) < 0) throw new Error(`${label} must be a nonnegative safe integer`); }
/** @param {Buffer} left @param {Buffer} right */
function firstDifference(left, right) { for (let index = 0; index < Math.min(left.length, right.length); index += 1) if (left[index] !== right[index]) return index; return Math.min(left.length, right.length); }
/** @param {Buffer} block */
function isZeroBlock(block) { return block.length === TAR_BLOCK_SIZE && block.every((byte) => byte === 0); }
/** @param {string | Buffer} value */
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
/** @param {"sha1"|"sha512"} algorithm @param {Buffer} value @param {"hex"|"base64"} encoding */
function digest(algorithm, value, encoding) { return createHash(algorithm).update(value).digest(encoding); }
/** @param {number} mode */
function formatMode(mode) { return mode.toString(8).padStart(4, "0"); }
/** @param {string} left @param {string} right */
function compareCodePoints(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
/** @param {string} root @param {string[]} args */
function git(root, args) { return execFileSync("git", ["-C", resolve(root), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }

const COMMAND_OPTION_SCHEMAS = new Map([
  ["normalize", { required: new Set(["target", "commit"]), optional: new Set() }],
  ["assert", { required: new Set(["target", "commit"]), optional: new Set() }],
  ["verify", { required: new Set(["target", "commit", "archive"]), optional: new Set(["manifest"]) }]
]);

/** @param {string[]} argv */
function parseArguments(argv) {
  const [command, ...rest] = argv;
  const schema = command ? COMMAND_OPTION_SCHEMAS.get(command) : undefined;
  if (!schema) throw new Error("Usage: release-pack-policy.js <normalize|assert|verify> --target PATH --commit COMMIT [--archive TGZ --manifest FILE]");
  const options = new Map();
  for (let index = 0; index < rest.length; index += 2) {
    const token = rest[index];
    const value = rest[index + 1];
    if (!token?.startsWith("--") || token.length === 2 || token.includes("=") || value === undefined || value === "" || value.startsWith("--")) throw new Error(`Invalid argument sequence near ${token ?? "<end>"}`);
    const key = token.slice(2);
    if (!schema.required.has(key) && !schema.optional.has(key)) throw new Error(`Unknown option --${key} for ${command}`);
    if (options.has(key)) throw new Error(`Duplicate option --${key}`);
    options.set(key, value);
  }
  for (const key of schema.required) if (!options.has(key)) throw new Error(`${command} requires --${key}`);
  return { command, options };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const { command, options } = parseArguments(process.argv.slice(2));
    const target = options.get("target") ?? "";
    const commit = options.get("commit") ?? "";
    let result;
    if (command === "normalize") result = normalizeDetachedTarget(target, commit);
    else if (command === "assert") result = assertDetachedTarget(target, commit);
    else if (command === "verify") result = verifyArchive(target, commit, options.get("archive") ?? "", options.get("manifest"));
    else throw new Error("Unknown release pack policy command");
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
