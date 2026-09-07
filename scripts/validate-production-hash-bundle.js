// @ts-check

import assert from "node:assert/strict";
import { build } from "vite";
import { validateProductionHashBundle } from "./production-hash-bundle-policy.js";

const sharedHashSource = `
export class Sha1 {}
export class Sha256 {}
if (backend !== "fallback") subtle.digest.call(subtle.subtle, algorithm, snapshot);
`;
const unrelatedSource = "export const unrelated = true;";
const completeMap = (shared = true) => ({
  version: 3,
  sources: [shared ? "../../../aerobeat-web-hash/src/index.js" : "../../../unrelated/src/index.js"],
  sourcesContent: [shared ? sharedHashSource : unrelatedSource]
});
const chunk = (fileName, map = completeMap(), isEntry = false) => ({ type: "chunk", fileName, map, isEntry });
const validHyphenatedFixture = [
  chunk("assets/index-C-m--G1i.js"),
  chunk("assets/conversion-worker-C-m--G1i.js")
];
const fixtureEvidence = validateProductionHashBundle(validHyphenatedFixture);
assert.deepEqual(fixtureEvidence.sharedAttributions, ["assets/conversion-worker-C-m--G1i.js", "assets/index-C-m--G1i.js"], "valid Vite base64url-style hyphenated main/Worker hashes must retain exact source-map identity");

const rejectedFixtures = [
  ["absent Worker", [chunk("assets/index-C-m--G1i.js")], /exactly one conversion module Worker source-map identity; found 0/u],
  ["incomplete Worker map", [chunk("assets/index-C-m--G1i.js"), chunk("assets/conversion-worker-C-m--G1i.js", { version: 3, sources: ["../../../aerobeat-web-hash/src/index.js"], sourcesContent: [] })], /Source map is incomplete/u],
  ["missing Worker attribution", [chunk("assets/index-C-m--G1i.js"), chunk("assets/conversion-worker-C-m--G1i.js", completeMap(false))], /conversion module Worker omitted exact @aerobeat\/web-hash source ownership/u],
  ["ambiguous Workers", [...validHyphenatedFixture, chunk("assets/conversion-worker-second_hash.js")], /exactly one conversion module Worker source-map identity; found 2/u],
  ["ambiguous fallback mains", [...validHyphenatedFixture, chunk("assets/index-second_hash.js")], /exactly one main entry source-map identity; found 2/u],
  ["path-injected Worker", [chunk("assets/index-C-m--G1i.js"), chunk("assets/../conversion-worker-C-m--G1i.js")], /unsafe JavaScript output filename/u],
  ["malformed Worker hash", [chunk("assets/index-C-m--G1i.js"), chunk("assets/conversion-worker-C.m--G1i.js")], /exactly one conversion module Worker source-map identity; found 0/u]
];
for (const [label, fixture, expected] of rejectedFixtures) {
  assert.throws(() => validateProductionHashBundle(fixture), expected, `${label} fixture must fail closed`);
}

const result = await build({ configFile: "vite.config.js", logLevel: "silent", build: { write: false, sourcemap: true } });
const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.output);
const evidence = validateProductionHashBundle(outputs);
assert.ok(evidence.scripts >= 2, "main and module Worker JavaScript must both be production bundled");
assert.ok(evidence.sharedAttributions.some((fileName) => /(?:^|\/)index(?:-[A-Za-z0-9_-]+)?\.js$/u.test(fileName)), "main entry must own shared hashing");
assert.ok(evidence.sharedAttributions.some((fileName) => /(?:^|\/)conversion-worker(?:-[A-Za-z0-9_-]+)?\.js$/u.test(fileName)), "conversion Worker must own shared hashing");
assert.equal(outputs.some((output) => output.fileName.endsWith(".wasm")), false, "production build must contain no WASM");
console.log(`Production hash bundle ownership passed: ${evidence.scripts} scripts, ${evidence.sourceMaps} deduplicated maps, exact ${evidence.sharedAttributions.join(" + ")} ownership.`);
