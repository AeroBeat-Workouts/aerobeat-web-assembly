// @ts-check

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { viteAllowedFileSystemRoots } from "../vite.config.js";

const assemblyRoot = fileURLToPath(new URL("../", import.meta.url));
const parentRoot = path.dirname(assemblyRoot);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const linkedDependencies = Object.entries(packageJson.dependencies).filter(([, spec]) => typeof spec === "string" && spec.startsWith("file:"));
const expectedRoots = [assemblyRoot, ...linkedDependencies.map(([, spec]) => fileURLToPath(new URL(`${spec.slice("file:".length).replace(/\/$/u, "")}/`, new URL("../vite.config.js", import.meta.url))))];
assert.deepEqual(viteAllowedFileSystemRoots, expectedRoots, "Vite roots must derive exactly from assembly plus declared file dependency ownership");
assert.equal(viteAllowedFileSystemRoots.includes(parentRoot), false, "the broad AeroBeat parent root must never be allowed");
assert.equal(new Set(viteAllowedFileSystemRoots).size, viteAllowedFileSystemRoots.length, "allow roots must be unique");
for (const [index, root] of viteAllowedFileSystemRoots.entries()) {
  assert.equal(path.dirname(root), index === 0 ? parentRoot : parentRoot, `allow root escaped the exact AeroBeat package ownership boundary: ${root}`);
  assert.equal(existsSync(root), true, `required allow root is missing: ${root}`);
}

const server = await createServer({
  configFile: fileURLToPath(new URL("../vite.config.js", import.meta.url)),
  logLevel: "silent",
  server: { host: "127.0.0.1", port: 0, strictPort: true }
});
try {
  assert.equal(server.config.server.fs.strict, true);
  assert.deepEqual(server.config.server.fs.allow, expectedRoots.map((root) => path.resolve(root)), "Vite may normalize trailing separators but must retain the exact roots");
  await server.listen();
  const address = server.httpServer?.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;

  await expectAllowed(origin, path.join(assemblyRoot, "src/index.js"), "assembly entry");
  for (const [packageName, spec] of linkedDependencies) {
    const packageRoot = fileURLToPath(new URL(`${spec.slice("file:".length).replace(/\/$/u, "")}/`, new URL("../vite.config.js", import.meta.url)));
    const linkedPackage = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
    assert.equal(linkedPackage.name, packageName);
    const exported = linkedPackage.exports?.["."] ?? linkedPackage.exports;
    const entry = typeof exported === "string" ? exported : exported?.browser ?? exported?.import ?? exported?.default;
    assert.equal(typeof entry, "string", `${packageName} must expose one browser module entry`);
    await expectAllowed(origin, path.join(packageRoot, entry), `${packageName} module entry`);
  }

  await expectAllowed(origin, path.join(assemblyRoot, "assets/environments/alpine-river-valley-photosphere/1.0.0/alpine-river-valley-photosphere.jpg"), "approved environment asset");
  const gameplayRoot = path.join(parentRoot, "aerobeat-web-renderer/assets/gameplay/0.0.7");
  const inventory = JSON.parse(readFileSync(path.join(gameplayRoot, "inventory.v1.json"), "utf8"));
  const gameplayGlb = inventory.payload.find((entry) => entry.path.endsWith(".glb"));
  assert.ok(gameplayGlb);
  await expectAllowed(origin, path.join(gameplayRoot, gameplayGlb.path), "approved pinned gameplay asset");

  const denied = [
    [path.join(parentRoot, "aerobeat-branding/package.json"), "unapproved sibling package"],
    [path.join(parentRoot, ".plans/2026-08-25-mobile-cv-responsiveness.md"), "parent-owned plan"],
    ["/etc/hosts", "outside file"]
  ];
  for (const [file, label] of denied) {
    assert.equal(existsSync(file), true, `${label} fixture must exist`);
    const response = await fetch(fileUrl(origin, file));
    assert.equal(response.status, 403, `${label} must be forbidden by Vite fs.strict: ${file}`);
  }
} finally {
  await server.close();
}

console.log(`Vite strict filesystem allowlist validation passed (${viteAllowedFileSystemRoots.length} exact package roots).`);

async function expectAllowed(origin, file, label) {
  assert.equal(existsSync(file), true, `${label} fixture must exist: ${file}`);
  const response = await fetch(fileUrl(origin, file));
  assert.equal(response.status, 200, `${label} must load through Vite: ${file}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.ok(bytes.byteLength > 0, `${label} must return nonempty bytes`);
}

function fileUrl(origin, file) { return `${origin}/@fs/${file.replaceAll(path.sep, "/")}`; }
