// @ts-check

import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Raw proof release version for GitHub release wiring.
 *
 * @type {"0.0.1"}
 */
const proofVersion = "0.0.1";

const releaseRoot = resolve("release", "raw", proofVersion);
if (!existsSync(releaseRoot)) {
  throw new Error("Run npm run build-release before preparing GitHub release submission.");
}

const submissionPath = resolve(releaseRoot, "github-release-submission.json");
writeFileSync(
  submissionPath,
  `${JSON.stringify(
    {
      tagName: `aerobeat-web-assembly-v${proofVersion}`,
      name: `AeroBeat Web Assembly ${proofVersion} raw proof`,
      body: "Raw unminified browser proof artifact for the first assembly app shell.",
      artifactDirectory: releaseRoot,
      dryRun: true
    },
    null,
    2
  )}\n`
);

console.log(`GitHub release submission dry-run written to ${submissionPath}`);
