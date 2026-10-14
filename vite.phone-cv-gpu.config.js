// @ts-check
// Isolated GPU-first / CPU-fallback camera CV experiment, built only from clean committed source.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("./", import.meta.url);
const rootPath = realpathSync(fileURLToPath(root));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
if (pkg.name !== "@aerobeat/web-assembly") throw new Error("CV GPU experiment assembly package mismatch");
const linked = Object.entries(pkg.dependencies ?? {});
if (linked.length !== 14) throw new Error("CV GPU experiment requires exactly fourteen linked repositories");
const packages = linked.map(([name, spec]) => {
  const siblingName = `aerobeat-${name.slice("@aerobeat/".length)}`;
  if (!name.startsWith("@aerobeat/web-") || spec !== `file:../${siblingName}`) throw new Error(`CV GPU experiment linked specification drifted: ${name}`);
  const expected = realpathSync(fileURLToPath(new URL(`../${siblingName}/`, root)));
  const linkedPath = realpathSync(fileURLToPath(new URL(`${spec.slice(5)}/`, root)));
  const installed = realpathSync(fileURLToPath(new URL(`node_modules/${name}/`, root)));
  if (linkedPath !== expected || installed !== expected || expected === rootPath) throw new Error(`CV GPU experiment linked realpath mismatch: ${name}`);
  const owned = JSON.parse(readFileSync(new URL(`../${siblingName}/package.json`, root), "utf8"));
  if (owned.name !== name) throw new Error(`CV GPU experiment package ownership mismatch: ${name}`);
  return { name, path: expected, exports: owned.exports ?? {} };
});
const sourceRoots = [{ name: pkg.name, path: rootPath }, ...packages];
function sourceManifest() {
  return {
    schema: "aerobeat/private_phone_cv_gpu_source_manifest", version: 1, packageVersion: pkg.version,
    sources: Object.fromEntries(sourceRoots.map(({ name, path }) => [name, {
      commit: git(path, "rev-parse", "HEAD"), tree: git(path, "rev-parse", "HEAD^{tree}"),
      sourceSha256: sha256(Buffer.from(git(path, "ls-tree", "-r", "--full-tree", "HEAD")))
    }]))
  };
}
const manifest = sourceManifest();
const manifestJson = JSON.stringify(manifest);
const stamp = `PHONE-CV-GPU-FIRST-${pkg.version}-${sha256(Buffer.from(manifestJson)).slice(0, 24)}`;
const aliases = packages.flatMap(({ name, path, exports: exported }) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return [
    ...Object.entries(exported).filter(([key, target]) => key.startsWith("./") && typeof target === "string")
      .map(([key, target]) => ({ find: `${name}/${key.slice(2)}`, replacement: `${path}/${target.replace(/^\.\//u, "")}` })),
    { find: new RegExp(`^${escaped}/(.+)$`, "u"), replacement: `${path}/src/$1.js` },
    { find: new RegExp(`^${escaped}$`, "u"), replacement: `${path}/src/index.js` }
  ];
});
const favicon = readFileSync(new URL("assets/favicon/favicon.ico", root));
if (sha256(favicon) !== "5e8ac126cbef7a8a82b00b86c91ea656b61ea34d2afb1bd445c3edfe594ddc65") throw new Error("CV GPU experiment favicon drifted");
const model = new URL("../aerobeat-vendor-mediapipe-python/models/pose_landmarker_lite.task", root);
const mediaRoot = new URL("../aerobeat-web-vendor-mediapipe/node_modules/@mediapipe/tasks-vision/", root);
const mediaFiles = [
  ["assets/mediapipe/pose_landmarker_lite.task", model],
  ["assets/mediapipe/vision_bundle.js", new URL("vision_bundle.js", mediaRoot)],
  ...readdirSync(new URL("wasm/", mediaRoot)).sort().map(name => [`assets/mediapipe/wasm/${name}`, new URL(`wasm/${name}`, mediaRoot)])
];
const mediaAssets = mediaFiles.map(([name, url]) => [name, readFileSync(url)]);
const mediaDigest = () => sha256(Buffer.from(mediaAssets.map(([name, bytes]) => `${name}\t${bytes.byteLength}\t${sha256(bytes)}\n`).join("")));
if (sha256(mediaAssets[0][1]) !== "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a" ||
    mediaAssets.length !== 8 || mediaDigest() !== "73dce3877d951dff100ed46655b82143d6644b1e1308164b8feab48dda0fee9b") throw new Error("CV GPU experiment MediaPipe asset inventory drifted");
function assertCleanBuild() {
  for (const { name, path } of sourceRoots) {
    if (git(path, "status", "--porcelain=v1", "--untracked-files=all") !== "") throw new Error(`CV GPU experiment build requires clean committed source: ${name}`);
  }
  if (JSON.stringify(sourceManifest()) !== manifestJson) throw new Error("CV GPU experiment source changed since config load");
  if (sha256(readFileSync(new URL("assets/favicon/favicon.ico", root))) !== sha256(favicon)) throw new Error("CV GPU experiment favicon changed since config load");
  const current = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  if (JSON.stringify(current.dependencies) !== JSON.stringify(pkg.dependencies) || current.version !== pkg.version) throw new Error("CV GPU experiment assembly package changed since config load");
  for (const { name, path } of packages) {
    if (realpathSync(fileURLToPath(new URL(`node_modules/${name}/`, root))) !== path) throw new Error(`CV GPU experiment installed symlink changed: ${name}`);
  }
  if (sha256(Buffer.from(mediaFiles.map(([name, url]) => {
    const bytes = readFileSync(url); return `${name}\t${bytes.byteLength}\t${sha256(bytes)}\n`;
  }).join(""))) !== mediaDigest()) throw new Error("CV GPU experiment MediaPipe assets changed since config load");
}
export default {
  base: "/",
  define: {
    __AEROBEAT_CV_MARKER_BUILD_STAMP__: JSON.stringify(stamp),
    __AEROBEAT_PACKAGE_VERSION__: JSON.stringify(pkg.version)
  },
  resolve: { alias: aliases, preserveSymlinks: false },
  optimizeDeps: { exclude: packages.map(({ name }) => name) },
  // Only transform Vite's build-time HTML; leave the CPU source file untouched.
  plugins: [{
    name: "phone-cv-gpu-build-html", apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        if (context.path !== "/phone-cv-marker-baseline.html") throw new Error(`CV GPU experiment unexpected HTML path: ${context.path}`);
        const replacements = [
          ["/src/phone-cv-marker-baseline.js", "/src/phone-cv-gpu-experiment.js"],
          ["AeroBeat · Camera CV marker baseline", "AeroBeat · GPU-first / CPU fallback CV marker experiment"],
          ["Private camera and CV marker baseline", "Private GPU-first / CPU fallback CV marker experiment"],
          ["Camera + CV markers only · no game", "GPU-first / CPU fallback · camera + CV markers only · no game"]
        ];
        for (const [before, after] of replacements) {
          if (html.split(before).length !== 2) throw new Error(`CV GPU experiment HTML anchor drifted: ${before}`);
          html = html.replace(before, after);
        }
        return html;
      }
    }
  }, {
    name: "phone-cv-gpu-clean-source-and-media-assets", apply: "build",
    buildStart() { assertCleanBuild(); for (const [fileName, source] of [["favicon.ico", favicon], ...mediaAssets]) this.emitFile({ type: "asset", fileName, source }); },
    closeBundle() { assertCleanBuild(); }
  }],
  server: { host: "127.0.0.1", port: 5196, strictPort: true, allowedHosts: ["derrick-legion-go-8apu1.tail613fcb.ts.net"], fs: { strict: true, allow: [rootPath, ...packages.map(({ path }) => path)] } },
  preview: { host: "127.0.0.1", port: 4196, strictPort: true, allowedHosts: ["derrick-legion-go-8apu1.tail613fcb.ts.net"] },
  build: { outDir: "dist-phone-cv-gpu-experiment", assetsInlineLimit: 0, rollupOptions: { input: fileURLToPath(new URL("phone-cv-marker-baseline.html", root)) } }
};
