// Isolated Test hit/no-hit diagnostic. Reuse the phone-only package aliases,
// gameplay assets and source/shadow stamps; never enter the production Vite build.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import phone from "./vite.phone.config.js";

const gameplayRoot = fileURLToPath(new URL("../aerobeat-web-gameplay/", import.meta.url));
const gameplayCommit = execFileSync("git", ["-C", gameplayRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

export default {
  ...phone,
  define: { ...phone.define, __AEROBEAT_PHONE_GAMEPLAY_COMMIT__: JSON.stringify(gameplayCommit) },
  build: {
    ...phone.build,
    rollupOptions: { input: fileURLToPath(new URL("./phone-hit-performance.html", import.meta.url)) }
  }
};
