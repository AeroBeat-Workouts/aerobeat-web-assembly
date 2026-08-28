// @ts-check

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const allowedConcreteVendor = "@aerobeat/web-vendor-mediapipe";

/**
 * @param {string} specifier
 * @returns {boolean}
 */
function isForbiddenPoseRuntime(specifier) {
  return (specifier.startsWith("@aerobeat/web-vendor-") && specifier !== allowedConcreteVendor)
    || specifier === "onnxruntime-web"
    || specifier.startsWith("onnxruntime-web/")
    || specifier === "@tensorflow-models/pose-detection"
    || specifier.startsWith("@tensorflow-models/pose-detection/")
    || specifier.startsWith("@tensorflow/tfjs-");
}

/**
 * @param {string} path
 * @returns {string[]}
 */
function collectJavaScriptFiles(path) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(path)) {
    const fullPath = join(path, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && entry !== "node_modules") {
      files.push(...collectJavaScriptFiles(fullPath));
    } else if (entry.endsWith(".js") || entry.endsWith(".mjs")) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * @param {string} source
 * @returns {string[]}
 */
function collectModuleSpecifiers(source) {
  const specifiers = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/gu;
  for (const match of source.matchAll(pattern)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

for (const forbidden of [
  "@aerobeat/web-vendor-movenet",
  "@aerobeat/web-vendor-onnxruntime",
  "@tensorflow-models/pose-detection",
  "@tensorflow/tfjs-core",
  "onnxruntime-web"
]) {
  assert.equal(isForbiddenPoseRuntime(forbidden), true, `validator must reject ${forbidden}`);
}
assert.equal(isForbiddenPoseRuntime(allowedConcreteVendor), false);

const failures = [];
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
for (const section of ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies"]) {
  for (const dependency of Object.keys(packageJson[section] ?? {})) {
    if (isForbiddenPoseRuntime(dependency)) {
      failures.push(`package.json ${section}: forbidden pose runtime ${dependency}`);
    }
  }
}

for (const root of ["src", "test", "demo", "scripts"]) {
  if (!existsSync(root)) {
    continue;
  }
  for (const file of collectJavaScriptFiles(root)) {
    const source = readFileSync(file, "utf8");
    for (const specifier of collectModuleSpecifiers(source)) {
      if (isForbiddenPoseRuntime(specifier)) {
        failures.push(`${file}: forbidden pose runtime import ${specifier}`);
      }
      if (/aerobeat-web-[^/"']*\/src\//u.test(specifier)) {
        failures.push(`${file}: imports a sibling repo source path`);
      }
      if (/^@aerobeat\/web-[^/]+\/internal/u.test(specifier)) {
        failures.push(`${file}: imports another package internal surface`);
      }
    }
  }
}

const packageLock = readFileSync("package-lock.json", "utf8");
for (const forbiddenPackage of [
  "@aerobeat/web-vendor-movenet",
  "@aerobeat/web-vendor-onnxruntime",
  "@tensorflow-models/pose-detection",
  "onnxruntime-web"
]) {
  if (packageLock.includes(`\"${forbiddenPackage}\"`)) {
    failures.push(`package-lock.json: forbidden pose runtime graph ${forbiddenPackage}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("MediaPipe-only dependency and public import boundary validation passed.");
