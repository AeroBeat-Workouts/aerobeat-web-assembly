// @ts-check

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} path
 * @returns {string[]}
 */
function collectFiles(path) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(path)) {
    const fullPath = join(path, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && entry !== "node_modules") {
      files.push(...collectFiles(fullPath));
    } else if (entry.endsWith(".html") || entry.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

const failures = [];

for (const root of ["src", "test", "demo"]) {
  if (!existsSync(root)) {
    continue;
  }
  for (const file of collectFiles(root)) {
    const source = readFileSync(file, "utf8");
    const withoutAssemblyShellButtons = source.replace(/<button\b(?=[^>]*\bdata-action="(?:menu-toggle|menu-close|menu-backdrop|debug-camera-move|debug-camera-speed|debug-camera-reset|debug-camera-export)")[^>]*>/gu, "").replace(/<input\b(?=[^>]*\bdata-action="environment-select")[^>]*>/gu, "");
    if (/<(?:button|input|select|textarea)\b/u.test(withoutAssemblyShellButtons)) {
      failures.push(`${file}: visible controls must be named aero-* Web Components or approved assembly interaction-shell buttons`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Component-only placeholder check passed.");
