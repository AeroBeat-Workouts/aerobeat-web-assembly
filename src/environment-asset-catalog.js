// @ts-check

const VERSION = "1.0.0";
const CONFIG_SCHEMA = "aerobeat/environment_asset_config";
const CONFIG_VERSION = 1;
const MAXIMUM_CONFIG_BYTES = 16 * 1024;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const dimensions = Object.freeze([4096, 2048]);
const centerForward = Object.freeze([0, 0, -1]);
const worldUp = Object.freeze([0, 1, 0]);

const definitions = [
  ["luminious-ice-cave-photosphere", "Luminious Ice Cave", "strong", 2210289, "ff142b3ce3d3509ab3cfafcfc6a8cc2d3b0ff737852072d3a7aea8075478eed5", 333, "57729755f3ba686e60314cd69c1921305bab1a19037effabedb59322c4e67443", 4869, "524c7a5623dfbafb65590a9b3b78dc894d4341165d564ac267d470f03acf7e80"],
  ["icebergs-on-sea-shore-photosphere", "Icebergs on Sea Shore", "strong-comparison", 1689089, "aa91137af632f15d03d1e900006cb490bd1229c761b47aebef94ae300678fe12", 336, "d016f6025b203711187572bd336486a153a679f5d15013767c7ec9801dde01f2", 4148, "f62821ae9dc2cf48ac41592472f6e11ff3e4fab55c6c9ea697be2e7fd997b9ab"],
  ["snow-mountain-with-lake-photosphere", "Snow Mountain with Lake", "comparison-with-artifacts", 1821243, "f501bec5b23357dc06be0fe8df8cb8ca39e901ca2b3230c66019fb2eaa08029e", 338, "5c0c8f0da565e92c8372e6f92b0fdbb05e34c6608776b3292edb497b94d6b5e5", 4187, "1e39c718c7033aaac2caff8f58d5e1d63d809d73020f3a1c2babc66057db4af2"],
  ["iceland-waterfall-photosphere", "Iceland Waterfall", "strong-comparison", 1983883, "282f69ba1cad321074a8bdb84dd79d747d3c14a3df7408146837da1b08713c09", 332, "c129f38beea688e3c43399a72ace098befb621655fb43aaed9da34a2bec8bdd5", 4131, "137da54aaae3162ae1cc3a3a895ad3d91dc9bcfc8482cf1392c0b10bf8767692"],
  ["igloo-toon-photosphere", "Igloo Toon", "comparison-with-artifacts", 1624217, "c8deae4e235ba529c093ce9ec28aed9d0088d94c379dafe7a23b9c82aac06477", 325, "481329192d693584da295139d800647c326016c5c2ff5f2c29efa6c6a9ebc271", 4074, "d66a0b5f49590dfe63c6a27454b8b21194b6b93be9ca86edcaf197b4495018a1"],
  ["salt-lake-photosphere", "Salt Lake", "strong-comparison", 2010461, "2768567c95424d33a0b1727f1c50a48e3e063902d021132642ea7b6f5851185c", 324, "4f602515f85343c8e44ebc0271b5ccadd6a8848d917bb311cc742deea04af5c7", 4079, "f955189d3002f484940fa9ad6aa8f656400667eab8e26f88277ee6e455508121"],
  ["salt-lake-2-photosphere", "Salt Lake 2", "strong-comparison", 1974340, "beebe837d370302e201b4e0dbf6ac28010afc35dc9ec115b01256032737ed474", 326, "f651188606f49506bfe9c627bf06718fa8c616f5dec30a1a55065fbfd0c6600f", 4076, "36c3c0f7ceb0fcd5e881a615157f30563ebe0b4720c47f2b86cf66c52cc88c48"],
  ["alpine-river-valley-photosphere", "Alpine River Valley", "strong-comparison", 2664010, "7a529a6e0c1bee343633273d672a22f346f8ffc7406bf6a40812ae5435f3260b", 334, "c1cda19a958cee99c4d021baf9455ed95e0d0fd9cc420bfe1857ee5b7da1f5e6", 4147, "5f01074a8eebfd2246587b68dc3a162a77d431c4350700a5df38ba67cb00d201"]
];
const knownEnvironmentIds = new Set(definitions.map(([id]) => id));
const artifactComparisonIds = Object.freeze(["snow-mountain-with-lake-photosphere", "igloo-toon-photosphere"]);

function assertNoProxyGraph(value, label) {
  if (typeof globalThis.structuredClone !== "function") throw new TypeError(`${label} validation is unavailable`);
  try { globalThis.structuredClone(value); } catch { throw new TypeError(`${label} proxies are invalid`); }
}

function canonicalNumber(value, minimum, maximum, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new TypeError(`${label} is invalid`);
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function exactRecord(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be a plain record`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} must be a plain record`);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))) throw new TypeError(`${label} contains missing or unknown keys`);
  const output = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypeError(`${label}.${key} must be own data`);
    output[key] = descriptor.value;
  }
  return output;
}

export function normalizeEnvironmentTransform(value) {
  const transform = exactRecord(value, ["position", "rotationDegrees", "scale"], "transform");
  const position = exactRecord(transform.position, ["x", "y", "z"], "transform.position");
  const rotation = exactRecord(transform.rotationDegrees, ["xPitch", "yYaw", "zRoll"], "transform.rotationDegrees");
  assertNoProxyGraph(value, "transform");
  const normalized = Object.freeze({
    position: Object.freeze({ x: canonicalNumber(position.x, -30, 30, "position.x"), y: canonicalNumber(position.y, -30, 30, "position.y"), z: canonicalNumber(position.z, -30, 30, "position.z") }),
    rotationDegrees: Object.freeze({ xPitch: canonicalNumber(rotation.xPitch, -180, 180, "rotation.xPitch"), yYaw: canonicalNumber(rotation.yYaw, -180, 180, "rotation.yYaw"), zRoll: canonicalNumber(rotation.zRoll, -180, 180, "rotation.zRoll") }),
    scale: canonicalNumber(transform.scale, 0.25, 4, "scale")
  });
  if (Math.hypot(normalized.position.x, normalized.position.y, normalized.position.z) > 30 * normalized.scale - 0.5) throw new TypeError("position must keep the camera inside the sphere");
  return normalized;
}

export function normalizeEnvironmentConfig(value, expectedId) {
  if (typeof expectedId !== "string" || expectedId.length > 96 || !ID_PATTERN.test(expectedId) || !knownEnvironmentIds.has(expectedId)) throw new TypeError("Environment config id is invalid");
  const config = exactRecord(value, ["schema", "version", "id", "projection", "transform"], "config");
  if (typeof config.id !== "string" || config.id.length > 96 || !ID_PATTERN.test(config.id) || !knownEnvironmentIds.has(config.id)) throw new TypeError("Environment config id is invalid");
  const transform = normalizeEnvironmentTransform(config.transform);
  assertNoProxyGraph(value, "config");
  if (config.schema !== CONFIG_SCHEMA || config.version !== CONFIG_VERSION || config.id !== expectedId || config.projection !== "equirectangular") throw new TypeError("Environment config identity is invalid");
  return Object.freeze({ schema: CONFIG_SCHEMA, version: CONFIG_VERSION, id: expectedId, projection: "equirectangular", transform });
}

export function serializeEnvironmentConfig(config) {
  const idDescriptor = config && typeof config === "object" ? Object.getOwnPropertyDescriptor(config, "id") : null;
  if (!idDescriptor || !idDescriptor.enumerable || !("value" in idDescriptor) || typeof idDescriptor.value !== "string") throw new TypeError("Environment config id must be own data");
  const normalized = normalizeEnvironmentConfig(config, idDescriptor.value);
  const text = `${JSON.stringify(normalized, null, 2)}\n`;
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > MAXIMUM_CONFIG_BYTES) throw new TypeError("Environment config exceeds 16 KiB");
  return Object.freeze({ data: normalized, text, bytes, filename: `${normalized.id}.environment-config.v1.json`, mimeType: "application/json" });
}

function makeEntry(definition) {
  const [id, label, , imageBytes, imageHash, configBytes, configHash, manifestBytes, manifestHash] = definition;
  const root = `../assets/environments/${id}/${VERSION}`;
  const transform = normalizeEnvironmentTransform({ position:{x:0,y:0,z:0}, rotationDegrees:{xPitch:0,yYaw:0,zRoll:0}, scale:1 });
  const descriptor = Object.freeze({ id, url:new URL(`${root}/${id}.jpg`, import.meta.url).href, mimeType:"image/jpeg", bytes:imageBytes, sha256:imageHash, projection:"equirectangular", dimensions, centerForward, worldUp });
  const defaultConfig = Object.freeze({ schema:CONFIG_SCHEMA, version:CONFIG_VERSION, id, projection:"equirectangular", transform });
  const files = Object.freeze([
    Object.freeze({ path:`assets/environments/${id}/${VERSION}/${id}.jpg`, bytes:imageBytes, sha256:imageHash }),
    Object.freeze({ path:`assets/environments/${id}/${VERSION}/${id}.config.json`, bytes:configBytes, sha256:configHash }),
    Object.freeze({ path:`assets/environments/${id}/${VERSION}/manifest.json`, bytes:manifestBytes, sha256:manifestHash })
  ]);
  return Object.freeze({ label, descriptor, defaultConfig, files });
}

export const environmentAssetCatalog = Object.freeze(definitions.map(makeEntry));
export const environmentArtifactComparisonIds = artifactComparisonIds;
export const defaultEnvironmentAssetId = "luminious-ice-cave-photosphere";
export const environmentAssetFiles = Object.freeze(environmentAssetCatalog.flatMap((entry) => entry.files));
export const maximumEnvironmentConfigBytes = MAXIMUM_CONFIG_BYTES;

if (environmentAssetCatalog.length !== 8 || new Set(environmentAssetCatalog.map(({descriptor}) => descriptor.id)).size !== 8 || !environmentAssetCatalog.some(({descriptor}) => descriptor.id === defaultEnvironmentAssetId) || environmentAssetFiles.length !== 24) throw new Error("Environment catalog inventory drifted");
