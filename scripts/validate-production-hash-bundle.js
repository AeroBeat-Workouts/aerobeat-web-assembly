// @ts-check

import assert from "node:assert/strict";
import { build } from "vite";
import { validateProductionHashBundle } from "./production-hash-bundle-policy.js";

const result = await build({ configFile: "vite.config.js", logLevel: "silent", build: { write: false, sourcemap: true } });
const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.output);
const evidence = validateProductionHashBundle(outputs);
assert.ok(evidence.scripts >= 2, "main and module Worker JavaScript must both be production bundled");
assert.ok(evidence.sharedAttributions.some((fileName) => /(?:^|\/)index(?:-[\w]+)?\.js$/u.test(fileName)), "main entry must own shared hashing");
assert.ok(evidence.sharedAttributions.some((fileName) => /(?:^|\/)conversion-worker(?:-[\w]+)?\.js$/u.test(fileName)), "conversion Worker must own shared hashing");
assert.equal(outputs.some((output) => output.fileName.endsWith(".wasm")), false, "production build must contain no WASM");
console.log(`Production hash bundle ownership passed: ${evidence.scripts} scripts, ${evidence.sourceMaps} deduplicated maps, exact ${evidence.sharedAttributions.join(" + ")} ownership.`);
