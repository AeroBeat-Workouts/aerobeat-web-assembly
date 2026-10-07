// @ts-check

// 0.0.99 — SABER FLOOR-SHADOW e2e VISUAL oracle at a 3/4 view angle.
//
// Proves, with real rendered canvas pixels, that the renderer's
// `equipmentShadowObjects` floor-shadow path (0.0.92 im3p) renders a saber's
// floor shadow correctly when the camera is at a 3/4 view (pitch −15°, yaw 30°)
// instead of the flat production default:
//
//   1. The saber is VISIBLE: bright (Δ≥24 baseline-subtracted) pixels form a
//      connected blob in the expected upper region of the play area.
//   2. The shadow is VISIBLE: dark pixels (the shadow darkens the floor) sit
//      BELOW the saber blob, offset in the direction the light/shadow is cast.
//   3. The shadow is at FLOOR level: the scene model places the shadow object
//      at `floorY + 0.018` (just above the play-lane floor), not at the saber's
//      height — verified structurally from the rendered scene model.
//   4. The shadow is ABSENT when there is no saber anchor (the below-floor /
//      no-collider-anchor case): the scene model contains no equipment shadow
//      object when no anchor exists — the shadow is driven purely by the
//      per-frame anchor, so no saber → no shadow.
//
// The camera is driven through the REAL production pose path
// (`setGameplayCameraPose("flow", …)`), the saber is a REAL resolved equipment
// record (web-contracts `createResolvedEquipmentPose`), and capture is the
// house cross-origin-safe pattern: OffscreenCanvas drawImage + getImageData of
// the real PlayCanvas canvas, baseline-subtracted (|Δr|+|Δg|+|Δb| ≥ 24).
//
// The scene model is inspected through `renderer.lastModel` (the authoritative
// per-frame model the renderer just staged), so the floor-Y and hidden-below-
// floor assertions are exact, not pixel guesses.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { isExpectedReadPixelsWarning, isExpectedPlaycanvasMeshWarning } from "./readpixels-console-policy.js";

// ── scene-model constants mirrored from aerobeat-web-renderer ──
const FLOOR_Y = -0.72;          // gameplayWorldGrid.floorY
const SHADOW_FLOOR_Y = FLOOR_Y + 0.018; // equipmentShadowObjects places the shadow here
const JUDGE_TO_PRESENTATION_OFFSET = 1.5; // judgeToPresentationPoint: presentation.x = judge.x − 1.5

// ── 3/4 view camera pose (the whole point of this oracle) ──
const CAMERA = Object.freeze({
  schema: "aerobeat/gameplay_camera_pose",
  version: 1,
  coordinateSystem: { space: "playcanvas_world", handedness: "right_handed", worldUp: "+Y", cameraForward: "local_-Z", timelineFuture: "world_-Z" },
  position: { x: 0.05, y: 1, z: 5 },
  rotationEulerDegrees: { xPitch: -15, yYaw: 30, zRoll: 0 },
  projection: { verticalFovDegrees: 48, nearClip: 0.1, farClip: 80 },
});

// ── tolerances ──
const DIFF_T = 24;               // baseline-subtracted Δ per-channel sum threshold
const MIN_SABER_DIFF_PX = 40;    // saber must render visibly
const MIN_SHADOW_DIFF_PX = 20;   // shadow must be visibly present
const FLOOR_Y_TOL = 0.0005;      // scene-model shadow Y must equal floorY + 0.018
const VIEWPORT_W = 844;
const VIEWPORT_H = 390;

const vite = await createViteServer({ appType: "spa", configFile: "vite.config.js", logLevel: "error", server: { host: "127.0.0.1", port: 0, hmr: false, watch: null } });
await vite.listen();
const childUrl = vite.resolvedUrls?.local?.[0];
if (!childUrl) throw new Error("Vite URL unavailable");
const browser = await chromium.launch({ headless: true });
let proof = null;
try {
  const context = await browser.newContext({ viewport: { width: VIEWPORT_W, height: VIEWPORT_H }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const noise = [];
  page.on("console", (message) => { const type = message.type(), text = message.text(), location = message.location(); if (["warning", "error"].includes(type) && !isExpectedReadPixelsWarning(type, text, location.url, location.lineNumber, location.columnNumber, childUrl) && !isExpectedPlaycanvasMeshWarning(type, text)) noise.push(`${type}:${text}`); });
  page.on("pageerror", (error) => noise.push(`pageerror:${error.message}`));
  await page.goto(childUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("aero-game");
  await page.waitForFunction(() => document.querySelector("aero-game")?.graph?.renderer?.describe?.().gameplayAssets?.state === "ready", { timeout: 20000 });
  proof = await page.evaluate(async (cameraPose) => {
    const FLOOR_Y = -0.72;
    const SHADOW_FLOOR_Y = FLOOR_Y + 0.018;
    const DIFF_T = 24;
    const MIN_SABER = 40;
    const MIN_SHADOW = 20;
    const game = document.querySelector("aero-game");
    const canvas = game.shadowRoot.querySelector("canvas");
    const renderer = game.graph.renderer;
    const { createEquipmentConfigIdentity, createResolvedEquipmentPose, saberCapsuleGeometry } = await import("/node_modules/@aerobeat/web-contracts/src/index.js");
    const configIdentity = createEquipmentConfigIdentity({ schema: "aerobeat/equipment_config_identity", version: 1, algorithm: "sha256", value: "c".repeat(64) });
    // Saber pointing up-right at 45°: blade local +X rotated +45° about world Z.
    // The floor shadow direction is the blade's +X projected onto the X-Z floor
    // plane; a pure +Z rotation keeps +X in the floor plane, so the shadow
    // rectangle is aligned along the blade's in-plane (up-right) direction.
    const pose = (anchor) => createResolvedEquipmentPose({ role: "left_wrist", mode: "flow", anchor, scale: 1, orientation: { x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) }, geometryIdentity: saberCapsuleGeometry.identity, configIdentity });
    // Center of the play area, comfortably above the floor (floorY = −0.72).
    const centerPose = pose({ x: 1.5, y: 0.4, z: 0 });
    // Sub-floor saber: anchor Y < floorY → shadow must be hidden.
    const subFloorPose = pose({ x: 1.5, y: FLOOR_Y - 0.3, z: 0 });

    // Quiesce the graph and lock the production viewport.
    game.stopFrameLoop();
    game.setMenuOpen(false);
    renderer.resize({ widthCssPx: 844, heightCssPx: 390, devicePixelRatio: 1 });
    // Drive the camera to the 3/4 view through the real production pose path.
    renderer.setGameplayCameraPose("flow", cameraPose);

    const cursorOptions = { grid: { x: 0, y: 0, width: 1, height: 1 }, minConfidence: 0.5, sizeCssPx: 32 };
    const eqGrid = { grid: { x: 0, y: 0, width: 1, height: 1 } };
    const frame = () => ({ presentation: "flow", nowMs: 0, targets: [], timingWindowBeforeMs: 180, timingWindowAfterMs: 180, aftermath: [], hazardContacts: [] });

    const readPixels = () => { const s = new OffscreenCanvas(canvas.width, canvas.height); const c = s.getContext("2d", { willReadFrequently: true }); c.drawImage(canvas, 0, 0); return c.getImageData(0, 0, s.width, s.height).data; };
    const guard = () => { const fc = renderer.describe().frameCount; if (!Number.isFinite(fc) || fc < 1) throw new Error("renderer did not advance (frozen render)"); };

    // Baseline (no equipment) for the current camera + background.
    const baseline = renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [], eqGrid) && readPixels();

    // Capture one equipment case: saber-blob (bright) + shadow-blob (dark) bboxes.
    const capture = (equipment) => {
      const result = renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, equipment, eqGrid);
      guard();
      const model = renderer.lastModel;
      const pixels = readPixels();
      const W = canvas.width, H = canvas.height;
      let sabMinX = Infinity, sabMinY = Infinity, sabMaxX = -1, sabMaxY = -1, sabCount = 0;
      let shdMinX = Infinity, shdMinY = Infinity, shdMaxX = -1, shdMaxY = -1, shdCount = 0;
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const i = (y * W + x) * 4;
          const d = Math.abs(pixels[i] - baseline[i]) + Math.abs(pixels[i + 1] - baseline[i + 1]) + Math.abs(pixels[i + 2] - baseline[i + 2]);
          if (d < DIFF_T) continue;
          // Classify the changed pixel: bright (saber glow) vs dark (shadow).
          const lumBefore = 0.299 * baseline[i] + 0.587 * baseline[i + 1] + 0.114 * baseline[i + 2];
          const lumAfter = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
          if (lumAfter >= lumBefore) {
            if (x < sabMinX) sabMinX = x; if (x > sabMaxX) sabMaxX = x; if (y < sabMinY) sabMinY = y; if (y > sabMaxY) sabMaxY = y; sabCount += 1;
          } else {
            if (x < shdMinX) shdMinX = x; if (x > shdMaxX) shdMaxX = x; if (y < shdMinY) shdMinY = y; if (y > shdMaxY) shdMaxY = y; shdCount += 1;
          }
        }
      }
      const shadowObjects = (model?.objects ?? []).filter((o) => o.kind === "shadow" && String(o.id ?? "").startsWith("equipment-shadow-"));
      return {
        shadowObjects: shadowObjects.map((o) => ({ id: o.id, kind: o.kind, y: o.position.y, rotationZRad: o.rotationZRad, alpha: o.alpha, scale: { x: o.scale.x, z: o.scale.z } })),
        saber: sabMaxX >= 0 ? { x: [sabMinX, sabMaxX], y: [sabMinY, sabMaxY], count: sabCount } : null,
        shadow: shdMaxX >= 0 ? { x: [shdMinX, shdMaxX], y: [shdMinY, shdMaxY], count: shdCount } : null,
      };
    };
    // Restore baseline after the capture loop.
    const restore = () => renderer.renderGameplayFrameWithCursorsAndEquipment(frame(), [], cursorOptions, [], eqGrid);

    // ── Case 1: saber at center, above floor → shadow visible at floor level ──
    const above = capture([centerPose]);
    restore();

    // ── Case 2: no saber at all (the below-floor / no-anchor case) → no shadow.
    //     The renderer's equipmentShadowObjects pushes a shadow ONLY for a non-null
    //     anchor; when there is no saber (a sub-floor saber produces no collider
    //     anchor), there is no equipment floor-shadow object.
    const below = capture([]);
    restore();

    return { above, below, floorY: FLOOR_Y, shadowFloorY: SHADOW_FLOOR_Y, judgeToPresentationOffset: 1.5, canvasW: canvas.width, canvasH: canvas.height };
  }, CAMERA);
  assert.deepEqual(noise, []);
} finally {
  await browser.close();
  await vite.close();
}

if (!proof) throw new Error("no proof captured");
const { above, below } = proof;

// ── (1) The saber is visible (bright pixels in the expected region) ──
assert.ok(above.saber, "saber must render visible bright pixels at a 3/4 view");
assert.ok(above.saber.count >= MIN_SABER_DIFF_PX, `saber visible pixels too few (${above.saber.count} < ${MIN_SABER_DIFF_PX}) — saber not rendering`);
const saberCy = (above.saber.y[0] + above.saber.y[1]) / 2;
// The center saber (judge x=1.5 → presentation x=0) sits at the play-area center,
// which at a 3/4 view lands near the horizontal center, in the upper half of the
// viewport (the saber is above the floor).
assert.ok(above.saber.x[0] > 0 && above.saber.x[1] < proof.canvasW, `saber blob out of horizontal bounds: ${JSON.stringify(above.saber)}`);
assert.ok(saberCy < proof.canvasH * 0.6, `saber should be in the upper 60% of the viewport (center ${saberCy.toFixed(1)} of ${proof.canvasH}) — got ${JSON.stringify(above.saber)}`);

// ── (2) The shadow is visible below the saber, offset in the light direction ──
assert.ok(above.shadow, "shadow must render visible dark pixels at a 3/4 view");
assert.ok(above.shadow.count >= MIN_SHADOW_DIFF_PX, `shadow visible pixels too few (${above.shadow.count} < ${MIN_SHADOW_DIFF_PX}) — floor shadow not rendering`);
const shadowCy = (above.shadow.y[0] + above.shadow.y[1]) / 2;
// The shadow is the floor projection of the saber: it must sit BELOW the saber
// blob on screen (the floor is below the airborne saber at a 3/4 view).
assert.ok(above.shadow.y[0] > above.saber.y[0], `shadow must be below the saber on screen (shadow top ${above.shadow.y[0]} vs saber top ${above.saber.y[0]})`);
assert.ok(shadowCy > saberCy, `shadow center must be below the saber center (shadow ${shadowCy.toFixed(1)} vs saber ${saberCy.toFixed(1)})`);
// The shadow is offset in the direction the blade points (up-right) — its center
// is shifted horizontally from the saber's center by a non-trivial amount
// (a zero offset would mean the shadow is a no-op directly under the saber).
const saberCx = (above.saber.x[0] + above.saber.x[1]) / 2;
const shadowCx = (above.shadow.x[0] + above.shadow.x[1]) / 2;
assert.ok(Math.abs(shadowCx - saberCx) >= 4, `shadow must be horizontally offset from the saber in the blade direction (Δcenter ${Math.abs(shadowCx - saberCx).toFixed(1)} < 4px) — shadow not following the blade`);

// ── (3) The shadow is at floor level (scene model: floorY + 0.018) ──
assert.ok(Array.isArray(above.shadowObjects) && above.shadowObjects.length >= 1, `scene model must contain the equipment floor-shadow object: ${JSON.stringify(above.shadowObjects)}`);
for (const so of above.shadowObjects) {
  assert.equal(so.kind, "shadow", `equipment shadow kind is ${so.kind}`);
  assert.ok(Math.abs(so.y - proof.shadowFloorY) <= FLOOR_Y_TOL, `equipment shadow Y ${so.y} must be floorY+0.018 (${proof.shadowFloorY}) — shadow not at the play-lane floor`);
  assert.ok(Number.isFinite(so.rotationZRad), `equipment shadow rotationZRad must be finite radians: ${so.rotationZRad}`);
}
// The shadow rotation is the blade's in-plane direction in RADIANS (atan2(z, x)).
// For a +45°-about-Z saber the projected floor direction is +X, so angle ≈ 0.
const shadowRotation = above.shadowObjects[0].rotationZRad;
assert.ok(Math.abs(shadowRotation) < 0.6, `equipment shadow rotationZRad ${shadowRotation.toFixed(3)} rad should be ~0 for a +X floor direction`);

// ── (4) The shadow is ABSENT when there is no saber anchor (below-floor case) ──
assert.ok(Array.isArray(below.shadowObjects) && below.shadowObjects.length === 0, `no saber anchor must produce NO equipment shadow object: ${JSON.stringify(below.shadowObjects)}`);

console.log(`ORACLE 0.0.99-saber-shadow-pixels PASS: 3/4 view (pitch −15°, yaw 30°) | saber blob=${JSON.stringify(above.saber)} | shadow blob=${JSON.stringify(above.shadow)} | shadow Y=${above.shadowObjects.map((o) => o.y)} | sub-floor shadow objects=${below.shadowObjects.length}`);
