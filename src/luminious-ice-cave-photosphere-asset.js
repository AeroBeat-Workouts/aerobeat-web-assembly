// @ts-check

const dimensions = Object.freeze([4096, 2048]);
const orientation = Object.freeze({ yaw: 0, pitch: 0, roll: 0 });
const centerForward = Object.freeze([0, 0, -1]);
const worldUp = Object.freeze([0, 1, 0]);
const environmentAssetPath = "../assets/environments/luminious-ice-cave-photosphere/1.0.0/luminious-ice-cave-photosphere.jpg";

/** Internal assembly-owned renderer descriptor. Not part of package exports, host commands, events, or snapshots. */
export const luminiousIceCavePhotosphereAsset = Object.freeze({
  id: "luminious-ice-cave-photosphere",
  url: new URL(environmentAssetPath, import.meta.url).href,
  mimeType: "image/jpeg",
  bytes: 2210289,
  sha256: "ff142b3ce3d3509ab3cfafcfc6a8cc2d3b0ff737852072d3a7aea8075478eed5",
  projection: "equirectangular",
  dimensions,
  orientation,
  centerForward,
  worldUp
});
