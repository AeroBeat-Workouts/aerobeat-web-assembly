// @ts-check

import { createHash } from "node:crypto";
import { chmodSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, relative, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const SCRIPT_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TAR_BLOCK_SIZE = 512;
const TAR_TERMINATOR_SIZE = TAR_BLOCK_SIZE * 2;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const EXPECTED_FILESYSTEM_MODES = new Map([
  ["100644", 0o644],
  ["100755", 0o755]
]);

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
 * Verify one npm archive against the detached target's Git-index modes and
 * produce a canonical path/mode/size/content-SHA256 manifest.
 * @param {string} target
 * @param {string} expectedCommit
 * @param {string} archivePath
 * @param {string | undefined} manifestPath
 */
export function verifyArchive(target, expectedCommit, archivePath, manifestPath) {
  const context = inspectDetachedTarget(target, expectedCommit);
  assertClean(context.root);
  assertTrackedModes(context.root, context.entries);
  const tracked = new Map(context.entries.map((entry) => [entry.path, entry]));
  const archive = readFileSync(resolve(archivePath));
  const tar = gunzipSync(archive);
  const members = parseTar(tar);
  const seen = new Set();
  const modeCounts = new Map();
  const rows = [];

  for (const member of members) {
    assertSafeNpmMemberPath(member.path);
    if (member.type === "pax") throw new Error(`PAX member is forbidden: ${member.path}`);
    if (member.type === "directory") {
      if (member.mode !== 0o755) throw new Error(`Directory ${member.path} has mode ${formatMode(member.mode)}, expected 0755`);
      continue;
    }
    if (member.type !== "file") throw new Error(`Unsupported npm tar member type ${member.type} at ${member.path}`);
    const sourcePath = member.path.slice("package/".length);
    if (seen.has(sourcePath)) throw new Error(`Duplicate npm member ${sourcePath}`);
    seen.add(sourcePath);
    const entry = tracked.get(sourcePath);
    if (!entry) throw new Error(`npm member ${sourcePath} is not a tracked file in ${context.commit}`);
    if (member.mode !== entry.filesystemMode) {
      throw new Error(`npm member ${sourcePath} has mode ${formatMode(member.mode)}, expected ${formatMode(entry.filesystemMode)} from Git ${entry.gitMode}`);
    }
    const source = readFileSync(resolveTrackedPath(context.root, sourcePath));
    if (source.length !== member.size || !source.equals(member.content)) {
      throw new Error(`npm member ${sourcePath} does not match the exact tracked target bytes`);
    }
    const mode = formatMode(member.mode);
    modeCounts.set(mode, (modeCounts.get(mode) ?? 0) + 1);
    rows.push({ path: member.path, mode, size: member.size, sha256: sha256(member.content) });
  }

  rows.sort((left, right) => compareCodePoints(left.path, right.path));
  const manifest = rows.map((row) => `${JSON.stringify(row.path)}\t${row.mode}\t${row.size}\t${row.sha256}\n`).join("");
  if (manifestPath) writeFileSync(resolve(manifestPath), manifest);
  return {
    target: context.root,
    commit: context.commit,
    archive: resolve(archivePath),
    archiveSha256: sha256(archive),
    decompressedTarSha256: sha256(tar),
    manifestSha256: sha256(Buffer.from(manifest)),
    memberCount: rows.length,
    paxCount: 0,
    modeCounts: Object.fromEntries([...modeCounts].sort(([left], [right]) => compareCodePoints(left, right)))
  };
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

/** @param {string} root */
function parseGitIndex(root) {
  const output = execFileSync("git", ["-C", root, "ls-files", "--stage", "-z"]);
  return output.toString("utf8").split("\0").filter(Boolean).map((record) => {
    const tab = record.indexOf("\t");
    const metadata = record.slice(0, tab).split(" ");
    const path = record.slice(tab + 1);
    const [gitMode, objectId, stage] = metadata;
    if (stage !== "0") throw new Error(`Unmerged Git-index entry is forbidden: ${path}`);
    const filesystemMode = EXPECTED_FILESYSTEM_MODES.get(gitMode);
    if (filesystemMode === undefined) throw new Error(`Unsupported tracked Git mode ${gitMode} at ${path}`);
    return { path, gitMode, objectId, filesystemMode };
  });
}

/** @param {string} root @param {{path:string, gitMode:string, filesystemMode:number}[]} entries */
function assertTrackedModes(root, entries) {
  for (const entry of entries) {
    const path = resolveTrackedPath(root, entry.path);
    const stat = lstatSync(path);
    if (!stat.isFile()) throw new Error(`Tracked entry is not a regular file: ${entry.path}`);
    const actual = stat.mode & 0o7777;
    if (actual !== entry.filesystemMode) {
      throw new Error(`Tracked file ${entry.path} has mode ${formatMode(actual)}, expected ${formatMode(entry.filesystemMode)} from Git ${entry.gitMode}`);
    }
  }
}

/** @param {string} root */
function assertClean(root) {
  const status = git(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status) throw new Error(`Detached target must be clean:\n${status}`);
}

/** @param {{root:string, commit:string, entries:{filesystemMode:number}[]}} context */
function summarizeTarget(context) {
  const modeCounts = new Map();
  for (const entry of context.entries) {
    const mode = formatMode(entry.filesystemMode);
    modeCounts.set(mode, (modeCounts.get(mode) ?? 0) + 1);
  }
  return {
    target: context.root,
    commit: context.commit,
    trackedFileCount: context.entries.length,
    modeCounts: Object.fromEntries([...modeCounts].sort(([left], [right]) => compareCodePoints(left, right)))
  };
}

/** @param {Buffer} tar */
function parseTar(tar) {
  if (tar.length < TAR_TERMINATOR_SIZE) throw new Error("Truncated tar: missing canonical two-block end-of-archive terminator");
  if (tar.length % TAR_BLOCK_SIZE !== 0) throw new Error(`Malformed tar length ${tar.length}: expected exact 512-byte block framing`);

  const members = [];
  let offset = 0;
  while (true) {
    if (offset + TAR_BLOCK_SIZE > tar.length) throw new Error("Truncated tar: missing canonical two-block end-of-archive terminator");
    const header = tar.subarray(offset, offset + TAR_BLOCK_SIZE);
    if (isZeroBlock(header)) {
      if (offset + TAR_TERMINATOR_SIZE > tar.length || !isZeroBlock(tar.subarray(offset + TAR_BLOCK_SIZE, offset + TAR_TERMINATOR_SIZE))) {
        throw new Error(`Truncated tar terminator at byte ${offset}: expected two consecutive zero blocks`);
      }
      if (offset + TAR_TERMINATOR_SIZE !== tar.length) {
        const trailing = tar.subarray(offset + TAR_TERMINATOR_SIZE);
        if (trailing.every((byte) => byte === 0)) throw new Error(`Non-canonical extra zero padding after tar terminator at byte ${offset + TAR_TERMINATOR_SIZE}`);
        throw new Error(`Nonzero trailing data after tar terminator at byte ${offset + TAR_TERMINATOR_SIZE}`);
      }
      return members;
    }

    verifyTarChecksum(header, offset);
    const name = readTarPathField(header, 0, 100, "name", offset, false);
    const prefix = readTarPathField(header, 345, 155, "prefix", offset, true);
    const path = prefix ? `${prefix}/${name}` : name;
    assertSafeNpmMemberPath(path);
    const mode = readTarNumber(header, 100, 8);
    const size = readTarNumber(header, 124, 12);
    if (!Number.isSafeInteger(mode) || mode < 0 || !Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Invalid tar mode or size at byte ${offset}`);
    }
    const typeFlag = header[156];
    const contentStart = offset + TAR_BLOCK_SIZE;
    const contentEnd = contentStart + size;
    const nextOffset = contentStart + Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
    if (contentEnd > tar.length || nextOffset > tar.length) throw new Error(`Truncated tar member ${path}`);
    if (!tar.subarray(contentEnd, nextOffset).every((byte) => byte === 0)) throw new Error(`Nonzero tar member padding at ${path}`);
    const content = tar.subarray(contentStart, contentEnd);
    let type;
    if (typeFlag === 0 || typeFlag === 48) type = "file";
    else if (typeFlag === 53) type = "directory";
    else if (typeFlag === 120 || typeFlag === 103) type = "pax";
    else type = `type-${String.fromCharCode(typeFlag)}`;
    members.push({ path, mode, size, content, type });
    offset = nextOffset;
  }
}

/** @param {Buffer} block */
function isZeroBlock(block) {
  return block.length === TAR_BLOCK_SIZE && block.every((byte) => byte === 0);
}

/** @param {Buffer} header @param {number} offset */
function verifyTarChecksum(header, offset) {
  const recorded = readTarNumber(header, 148, 8);
  let computed = 0;
  for (let index = 0; index < header.length; index += 1) computed += index >= 148 && index < 156 ? 32 : header[index];
  if (recorded !== computed) throw new Error(`Invalid tar header checksum at byte ${offset}: ${recorded} != ${computed}`);
}

/**
 * Read the narrow NUL-terminated UTF-8 name/prefix shape emitted by npm's tar
 * writer. Accepting unterminated, invalid UTF-8, or nonzero post-NUL bytes would
 * make distinct raw headers collapse to one verifier path.
 * @param {Buffer} header
 * @param {number} start
 * @param {number} length
 * @param {string} label
 * @param {number} headerOffset
 * @param {boolean} allowEmpty
 */
function readTarPathField(header, start, length, label, headerOffset, allowEmpty) {
  const field = header.subarray(start, start + length);
  const end = field.indexOf(0);
  if (end < 0) throw new Error(`Malformed tar ${label} field at byte ${headerOffset}: missing NUL terminator`);
  if (!field.subarray(end + 1).every((byte) => byte === 0)) {
    throw new Error(`Malformed tar ${label} field at byte ${headerOffset}: nonzero bytes after NUL`);
  }
  let value;
  try {
    value = UTF8_DECODER.decode(field.subarray(0, end));
  } catch {
    throw new Error(`Malformed tar ${label} field at byte ${headerOffset}: invalid UTF-8`);
  }
  if (!allowEmpty && !value) throw new Error(`Malformed tar ${label} field at byte ${headerOffset}: empty value`);
  return value;
}

/**
 * Every member, including directories, PAX records, and unsupported types,
 * must first name one unambiguous descendant of npm's package/ root.
 * @param {string} path
 */
function assertSafeNpmMemberPath(path) {
  if (!path || path.startsWith("/") || path.startsWith("\\") || path.includes("\\") || /[\u0000-\u001f\u007f]/u.test(path)) {
    throw new Error(`Unsafe npm member path ${path || "<empty>"}`);
  }
  const withoutTrailingSlash = path.endsWith("/") ? path.slice(0, -1) : path;
  const segments = withoutTrailingSlash.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || /^[A-Za-z]:$/u.test(segment))) {
    throw new Error(`Unsafe npm member path ${path}`);
  }
  if (segments[0] !== "package" || segments.length < 2) throw new Error(`Unsafe npm member path ${path}`);
}

/** @param {Buffer} header @param {number} start @param {number} length */
function readTarNumber(header, start, length) {
  const field = header.subarray(start, start + length);
  if (field[0] & 0x80) {
    let value = BigInt(field[0] & 0x7f);
    for (const byte of field.subarray(1)) value = (value << 8n) | BigInt(byte);
    return Number(value);
  }
  const text = field.toString("ascii").replace(/\0.*$/u, "").trim();
  return text ? Number.parseInt(text, 8) : 0;
}

/** @param {string} root @param {string} path */
function resolveTrackedPath(root, path) {
  const resolved = resolve(root, path);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) throw new Error(`Unsafe tracked path ${path}`);
  return resolved;
}

/** @param {string | Buffer} value */
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
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
    if (!token?.startsWith("--") || token.length === 2 || token.includes("=") || value === undefined || value === "" || value.startsWith("--")) {
      throw new Error(`Invalid argument sequence near ${token ?? "<end>"}`);
    }
    const key = token.slice(2);
    if (!schema.required.has(key) && !schema.optional.has(key)) throw new Error(`Unknown option --${key} for ${command}`);
    if (options.has(key)) throw new Error(`Duplicate option --${key}`);
    options.set(key, value);
  }
  for (const key of schema.required) {
    if (!options.has(key)) throw new Error(`${command} requires --${key}`);
  }
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
    else if (command === "verify") {
      const archive = options.get("archive");
      if (!archive) throw new Error("verify requires --archive");
      result = verifyArchive(target, commit, archive, options.get("manifest"));
    } else {
      throw new Error("Usage: release-pack-policy.js <normalize|assert|verify> --target PATH --commit COMMIT [--archive TGZ] [--manifest FILE]");
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
