// @ts-check

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const packagePath = resolve("package.json");
const lockPath = resolve("package-lock.json");

/**
 * @param {string} version
 * @returns {string}
 */
function bumpPatch(version) {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Expected semver patch version, got ${version}`);
  }
  parts[2] += 1;
  return parts.join(".");
}

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const nextVersion = bumpPatch(packageJson.version);
packageJson.version = nextVersion;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const lockJson = JSON.parse(readFileSync(lockPath, "utf8"));
lockJson.version = nextVersion;
if (lockJson.packages?.[""]) {
  lockJson.packages[""].version = nextVersion;
}
writeFileSync(lockPath, `${JSON.stringify(lockJson, null, 2)}\n`);

console.log(`AeroBeat web assembly version bumped to ${nextVersion}`);
