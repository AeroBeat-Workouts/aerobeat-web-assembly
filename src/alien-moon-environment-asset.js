// @ts-check

const identityPosition = Object.freeze([0, 0, 0]);
const identityRotationDegrees = Object.freeze([0, 0, 0]);
const identityScale = Object.freeze([1, 1, 1]);

/** Internal assembly-owned runtime descriptor. Not part of the package exports or host snapshot contract. */
export const alienMoonEnvironmentAsset = Object.freeze({
  id: "alien-moon-icescape",
  version: "1.0.0",
  glbUrl: new URL("../assets/environments/alien-moon-icescape/1.0.0/alien-moon-icescape.glb", import.meta.url).href,
  configUrl: new URL("../assets/environments/alien-moon-icescape/1.0.0/alien-moon-icescape.config.yaml", import.meta.url).href,
  manifestUrl: new URL("../assets/environments/alien-moon-icescape/1.0.0/manifest.json", import.meta.url).href,
  glb: Object.freeze({ bytes: 6149400, sha256: "40e38a7bdce9eab4266d8bb19510a95bb4e0410534f3f14a500f36fac2b65077" }),
  config: Object.freeze({ bytes: 100, sha256: "1e50a9416dc2e506284919947088df812da54e537df69be5ec002c4cc167e788" }),
  transform: Object.freeze({ position: identityPosition, rotationDegrees: identityRotationDegrees, scale: identityScale })
});
