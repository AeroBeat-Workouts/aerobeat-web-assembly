// @ts-check

import { networkInterfaces } from "node:os";

/**
 * Preferred local development port.
 *
 * @type {number}
 */
const port = Number.parseInt(process.env.PORT ?? "5173", 10);

/**
 * @returns {string[]}
 */
function hostAddresses() {
  /** @type {string[]} */
  const addresses = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

const urls = [
  `http://127.0.0.1:${port}/`,
  ...hostAddresses().map((address) => `http://${address}:${port}/`)
];

console.log("AeroBeat Web Assembly iteration URLs:");
for (const url of urls) {
  console.log(`- ${url}`);
}
console.log("For phone camera checks, use localhost on the host or HTTPS over Tailscale as documented in docs/secure-context.md.");
