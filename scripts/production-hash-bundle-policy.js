// @ts-check

/**
 * Fail closed unless production bundles attribute every direct SubtleCrypto
 * digest call to the exact shared @aerobeat/web-hash source module.
 * @param {readonly Readonly<{fileName:string,type:string,source?:unknown,code?:string,map?:unknown,isEntry?:boolean}>[]} outputs
 */
const MAIN_FILE = /(?:^|\/)index(?:-[A-Za-z0-9_-]+)?\.js$/u;
const CONVERSION_WORKER_FILE = /(?:^|\/)conversion-worker(?:-[A-Za-z0-9_-]+)?\.js$/u;

export function validateProductionHashBundle(outputs) {
  const relevantOutputs = outputs.filter((output) => output.fileName.endsWith(".js") || output.fileName.endsWith(".js.map"));
  for (const output of relevantOutputs) {
    const segments = output.fileName.split("/");
    if (output.fileName.startsWith("/") || output.fileName.includes("\\") || output.fileName.includes(":") || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      throw new Error(`Production bundle contains unsafe JavaScript output filename: ${output.fileName}`);
    }
  }
  const scripts = relevantOutputs.filter((output) => output.fileName.endsWith(".js"));
  const chunks = scripts.filter((output) => output.type === "chunk");
  /** @type {Map<string, unknown>} */
  const maps = new Map();
  for (const output of scripts) if (output.map) maps.set(output.fileName, output.map);
  for (const output of relevantOutputs) {
    if (output.type !== "asset" || !output.fileName.endsWith(".js.map")) continue;
    const target = output.fileName.slice(0, -4);
    if (!maps.has(target)) maps.set(target, output.source);
  }
  if (maps.size === 0 || scripts.length === 0) throw new Error("Production hash ownership scan requires JavaScript and source maps");
  const sharedAttributions = new Set();
  let sharedImplementation = "";
  for (const [fileName, value] of maps) {
    const map = typeof value === "string" || ArrayBuffer.isView(value) ? JSON.parse(typeof value === "string" ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("utf8")) : value;
    if (!map || typeof map !== "object" || !Array.isArray(map.sources) || !Array.isArray(map.sourcesContent) || map.sources.length !== map.sourcesContent.length) throw new Error(`Source map is incomplete: ${fileName}.map`);
    for (let index = 0; index < map.sources.length; index += 1) {
      const sourcePath = String(map.sources[index]).replaceAll("\\", "/");
      const source = typeof map.sourcesContent[index] === "string" ? map.sourcesContent[index] : "";
      const ownsDigest = /(?:crypto\s*\??\.\s*subtle|subtle\s*\.\s*digest)/u.test(source);
      const isSharedHash = /(?:^|\/)aerobeat-web-hash\/src\/index\.js$/u.test(sourcePath);
      if (isSharedHash) { sharedAttributions.add(fileName); sharedImplementation = source; }
      if (ownsDigest && !isSharedHash) throw new Error(`Production SubtleCrypto digest ownership escaped @aerobeat/web-hash: ${sourcePath}`);
    }
  }
  const explicitMainCandidates = chunks.filter((output) => output.isEntry && !CONVERSION_WORKER_FILE.test(output.fileName));
  const mainCandidates = explicitMainCandidates.length > 0 ? explicitMainCandidates : chunks.filter((output) => MAIN_FILE.test(output.fileName));
  const conversionWorkerCandidates = scripts.filter((output) => CONVERSION_WORKER_FILE.test(output.fileName));
  if (mainCandidates.length !== 1) throw new Error(`Production hash ownership requires exactly one main entry source-map identity; found ${mainCandidates.length}`);
  if (conversionWorkerCandidates.length !== 1) throw new Error(`Production hash ownership requires exactly one conversion module Worker source-map identity; found ${conversionWorkerCandidates.length}`);
  const mainFile = mainCandidates[0].fileName;
  const conversionWorkerFile = conversionWorkerCandidates[0].fileName;
  if (!maps.has(mainFile) || !sharedAttributions.has(mainFile)) throw new Error("Production main entry omitted exact @aerobeat/web-hash source ownership");
  if (!maps.has(conversionWorkerFile) || !sharedAttributions.has(conversionWorkerFile)) throw new Error("Production conversion module Worker omitted exact @aerobeat/web-hash source ownership");
  for (const marker of ["export class Sha1", "export class Sha256", "backend !== \"fallback\"", "subtle.digest.call(subtle.subtle, algorithm, snapshot)"]) {
    if (!sharedImplementation.includes(marker)) throw new Error(`Bundled shared hash source omitted ${marker}`);
  }
  if (/https?:\/\/|\bfetch\s*\(|import\s*\(|\.wasm(?:\?|["'])|WebAssembly\s*\./iu.test(sharedImplementation)) throw new Error("Shared hash production source contains an external runtime, dynamic import, fetch, or WASM path");
  return Object.freeze({ scripts: scripts.length, sourceMaps: maps.size, sharedSourceCount: sharedAttributions.size, sharedAttributions: Object.freeze([...sharedAttributions].sort()) });
}
