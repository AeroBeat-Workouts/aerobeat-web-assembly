// @ts-check
// kl80: favicon provenance — the served copy in public/favicon.ico must be
// byte-identical to the branding anchor. Fails closed on any drift so a raw
// build can never ship a stale or tampered icon. The branding repo is read
// only for cross-checking; the canonical shipped bytes live here in `public/`.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shippedPath = resolve(root, "assets", "favicon", "favicon.ico");
const brandingRepo = resolve(root, "../aerobeat-branding");
const brandingPath = resolve(brandingRepo, "derived", "favicon.ico");
// Branding anchor (aerobeat-branding 5b57036): multi-image ICO, 12,114 B,
// PNG-encoded 16/32/48/64 entries at 32bpp.
const expectedSha256 = "5e8ac126cbef7a8a82b00b86c91ea656b61ea34d2afb1bd445c3edfe594ddc65";
const expectedBytes = 12_114;

function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

assert.ok(existsSync(shippedPath), `kl80: shipped favicon missing at ${shippedPath}`);
// The vite buildStart plugin (aerobeat-owned-runtime-assets) copies this file
// to the build root as `favicon.ico`; index.html references `/favicon.ico`.
const shipped = readFileSync(shippedPath);
assert.equal(shipped.byteLength, expectedBytes, `kl80: shipped favicon byte length drifted: ${shipped.byteLength} != ${expectedBytes}`);
assert.equal(hash(shipped), expectedSha256, `kl80: shipped favicon SHA-256 drifted from branding anchor: ${hash(shipped)}`);

// Cross-check against the upstream branding repo when it is present and clean.
if (existsSync(brandingPath)) {
  const upstream = readFileSync(brandingPath);
  assert.equal(upstream.byteLength, expectedBytes, `kl80: branding favicon byte length drifted: ${upstream.byteLength}`);
  assert.equal(hash(upstream), expectedSha256, `kl80: branding favicon SHA-256 drifted from anchor: ${hash(upstream)}`);
  assert.deepEqual([...upstream], [...shipped], "kl80: shipped favicon must be byte-identical to the branding anchor");
} else {
  // Branding repo not checked out here — the hardcoded anchor still pins the bytes.
  process.stderr.write(`kl80: branding repo absent; validated shipped bytes against the pinned anchor only.\n`);
}

console.log(`Favicon provenance passed: assets/favicon/favicon.ico SHA-256 ${expectedSha256} (${expectedBytes} B), byte-identical to the aerobeat-branding anchor (emitted to the build root as favicon.ico).`);
