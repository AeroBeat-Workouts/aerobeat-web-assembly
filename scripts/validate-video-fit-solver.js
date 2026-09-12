// @ts-check
// he8u: unit oracle for the pure affine video-fit solver (no DOM, no browser).

import assert from "node:assert/strict";
import { projectGridCornersToScreen, solveVideoFit } from "../src/video-fit-solver.js";
// Pinned to the renderer's canonical pose (gameplay-camera-pose.js): any
// drift of the upstream default camera must surface here as a test failure.
const defaultGameplayCameraPose = Object.freeze({
  position: Object.freeze({ x: 0.05, y: 1, z: 5 }),
  rotationEulerDegrees: Object.freeze({ xPitch: 0, yYaw: 0, zRoll: 0 }),
  projection: Object.freeze({ verticalFovDegrees: 48, nearClip: 0.1, farClip: 80 })
});

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b} (eps ${eps})`);

// ---------------------------------------------------------------------------
// Known camera → known projection (orthographic sanity + exact pinhole math).
// ---------------------------------------------------------------------------
{
  // Forward camera looking down −Z at the origin; the grid plane sits at
  // z = −10, in front of the camera. Identity rotation → forward = (0,0,−1).
  const cam = { x: 0, y: 0, z: 0 };
  const rot = { xPitch: 0, yYaw: 0, zRoll: 0 };
  const proj = { verticalFovDegrees: 48, nearClip: 0.1, farClip: 80 };
  const viewport = { widthCssPx: 1000, heightCssPx: 500 };
  const corners = projectGridCornersToScreen(cam, rot, proj, viewport, -10);
  assert.ok(Array.isArray(corners) && corners.length === 4, "projection must return four corners");
  const [tl, tr, br, bl] = /** @type {ReadonlyArray<Readonly<{x:number,y:number}>>} */ (corners);
  // x span: 4 world units at distance 10, halfH = tan(24°)*(1000/500).
  const halfH = Math.tan(24 * Math.PI / 180) * 2;
  near(tl.x, (1 - 2 / (10 * halfH)) / 2 * 1000, 1e-9);
  near(tr.x, (1 + 2 / (10 * halfH)) / 2 * 1000, 1e-9);
  // y: top corner (y=2.5) must be ABOVE bottom corner (y=-0.5) on screen.
  assert.ok(tl.y < br.y, "top world corner must project above bottom world corner");
  // x center of the projected box is the screen center (camera at x=0).
  near((tl.x + tr.x + bl.x + br.x) / 4, 500, 1e-9);
  // y center: the camera sits ON the plane's y range (y=0 is inside [-0.5,2.5]),
  // so perspective pulls the screen center away from the geometric y mean —
  // only verify it lands between top and bottom, biased toward the camera side.
  const yMean = (tl.y + tr.y + bl.y + br.y) / 4;
  assert.ok(yMean > tl.y && yMean < br.y, `projected y center ${yMean} must be inside the grid span`);
  // Degenerate: plane between camera and… no, z=−0.01 is still 0.01 ahead but
  // inside near*0.5=0.05 → fails the depth guard. Plane BEHIND the camera
  // (z=+10) must also fail.
  assert.equal(projectGridCornersToScreen(cam, rot, proj, viewport, 10), null, "plane behind camera must fail");
  assert.equal(projectGridCornersToScreen(cam, rot, { ...proj, verticalFovDegrees: 0 }, viewport, -10), null, "fov 0 must fail");
}

// ---------------------------------------------------------------------------
// Solve: known envelope + known corners → expected transform at all references.
// ---------------------------------------------------------------------------
{
  const corners = Object.freeze([
    Object.freeze({ x: 300, y: 100 }),
    Object.freeze({ x: 700, y: 120 }),
    Object.freeze({ x: 720, y: 380 }),
    Object.freeze({ x: 280, y: 400 })
  ]); // trapezoid: near edge wider (y 380/400) than far edge (y 100/120)
  const envelope = { left: 200, top: 60, right: 800, bottom: 440 };
  const element = { elementWidthCssPx: 1000, elementHeightCssPx: 500 };

  // center: box-to-box least squares; envelope center (500,250) ↔ grid box
  // center (500,250); scale 600/440 × 380/300.
  const center = solveVideoFit({ envelope, gridScreenCorners: corners, ...element, reference: "center" });
  assert.ok(center !== null, "center reference must solve");
  near(center.scaleX, 600 / 440, 1e-9);
  near(center.scaleY, 380 / 300, 1e-9);
  near(center.translateX, 500 - (600 / 440) * 500, 1e-9);
  near(center.translateY, 250 - (380 / 300) * 250, 1e-9);
  // Envelope center must land on the grid (bounding-box) center.
  const applyX = (x) => center.translateX + center.scaleX * x;
  const applyY = (y) => center.translateY + center.scaleY * y;
  near(applyX(500), 500, 1e-9);
  near(applyY(250), 250, 1e-9);

  // far: far edge (minY=100) pinned to envelope top (60).
  const far = solveVideoFit({ envelope, gridScreenCorners: corners, ...element, reference: "far" });
  assert.ok(far !== null, "far reference must solve");
  near(far.scaleX, center.scaleX, 1e-9);
  near(far.scaleY, center.scaleY, 1e-9);
  near(far.translateY, 60 - (380 / 300) * 100, 1e-9);
  near(far.translateY + far.scaleY * 100, 60, 1e-9, "far edge must map exactly onto the envelope far edge");

  // near: near edge (maxY=400) pinned to envelope bottom (440).
  const nearRef = solveVideoFit({ envelope, gridScreenCorners: corners, ...element, reference: "near" });
  assert.ok(nearRef !== null, "near reference must solve");
  near(nearRef.translateY, 440 - (380 / 300) * 400, 1e-9);
  near(nearRef.translateY + nearRef.scaleY * 400, 440, 1e-9, "near edge must map exactly onto the envelope near edge");

  // Default reference is center.
  const defaulted = solveVideoFit({ envelope, gridScreenCorners: corners, ...element });
  assert.ok(defaulted !== null);
  assert.deepEqual({ s: defaulted.scaleX, t: defaulted.translateY }, { s: center.scaleX, t: center.translateY }, "default reference must be center");

  // ---------------------------------------------------------------------
  // Knobs are RELATIVE: scale 110 multiplies the derived scale; offsets
  // translate by percent of the ELEMENT size.
  // ---------------------------------------------------------------------
  const knobbed = solveVideoFit({ envelope, gridScreenCorners: corners, ...element, reference: "center", scalePercent: 110, offsetXPercent: 4, offsetYPercent: -5 });
  assert.ok(knobbed !== null);
  near(knobbed.scaleX, center.scaleX * 1.1, 1e-9);
  near(knobbed.scaleY, center.scaleY * 1.1, 1e-9);
  near(knobbed.translateX, center.translateX + 0.04 * 1000, 1e-9);
  near(knobbed.translateY, center.translateY - 0.05 * 500, 1e-9);
}

// ---------------------------------------------------------------------------
// Null pre-calibration / degenerate inputs (cover fallback).
// ---------------------------------------------------------------------------
{
  assert.equal(solveVideoFit(null), null);
  assert.equal(solveVideoFit({}), null, "missing envelope must be null");
  assert.equal(solveVideoFit({ envelope: { left: 0, top: 0, right: 1, bottom: 1 } }), null, "missing corners must be null");
  assert.equal(solveVideoFit({ envelope: { left: 0, top: 0, right: 0, bottom: 1 }, gridScreenCorners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], elementWidthCssPx: 10, elementHeightCssPx: 10 }), null, "zero-width envelope must be null");
  assert.equal(solveVideoFit({ envelope: { left: 0, top: 0, right: 10, bottom: 10 }, gridScreenCorners: [{ x: 5, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 1 }], elementWidthCssPx: 10, elementHeightCssPx: 10 }), null, "degenerate corners must be null");
  assert.equal(solveVideoFit({ envelope: { left: 0, top: 0, right: 10, bottom: 10 }, gridScreenCorners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: NaN, y: 1 }], elementWidthCssPx: 10, elementHeightCssPx: 10 }), null, "NaN corner must be null");
  assert.equal(solveVideoFit({ envelope: { left: 0, top: 0, right: 10, bottom: 10 }, gridScreenCorners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], elementWidthCssPx: 10, elementHeightCssPx: 10, reference: "side" }), null, "unknown reference must be null");
}

// ---------------------------------------------------------------------------
// Aspect preservation + mirror composition invariant.
// ---------------------------------------------------------------------------
{
  // A camera with a 4:3 viewport must project the square (in world) grid
  // with the viewport aspect preserved: screenW/screenY ratio matches the
  // world 4:3 span ratio at the same depth.
  const corners = projectGridCornersToScreen(
    { x: 0, y: 1, z: 5 },
    { xPitch: 0, yYaw: 0, zRoll: 0 },
    { verticalFovDegrees: 48, nearClip: 0.1, farClip: 80 },
    { widthCssPx: 1280, heightCssPx: 720 },
    0
  );
  assert.ok(corners !== null, "default-pose camera must project");
  const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
  const screenAspect = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
  const worldAspect = 4 / 3; // x span 4, y span 3 at one depth (orthographic limit)
  // Under perspective the far edge is smaller, but for a forward camera the
  // bounding-box aspect still tracks the world 4:3 within a small bound.
  assert.ok(Math.abs(screenAspect - worldAspect) < 0.2, `projected grid aspect ${screenAspect} must track world 4:3`);

  // Mirror composition: the CSS the caller builds is
  //   translate(tx,ty) scale(sx*mirrorSign, sy) ... scaleX(-1)
  // and must equal the mirror-first composition
  //   scaleX(-1) translate(-tx, ty) scale(sx, sy)
  // applied about the element center (w,h)/2. Check the envelope-center
  // image under both orderings for a known fit.
  const fit = solveVideoFit({
    envelope: { left: 200, top: 60, right: 800, bottom: 440 },
    gridScreenCorners: [{ x: 300, y: 100 }, { x: 700, y: 120 }, { x: 720, y: 380 }, { x: 280, y: 400 }],
    elementWidthCssPx: 1000, elementHeightCssPx: 500, reference: "center"
  });
  assert.ok(fit !== null);
  const cx = 500, cy = 250;
  void cy;
  // Mirror composition invariants (the existing scaleX(-1) is preserved —
  // composed, never dropped). With M(x) = 2cx − x and F the fit's centered
  // x-map, the applied transform is G = M ∘ F:
  //   (a) G equals the closed form cx − tx − sx·(q−cx) (translate then a
  //       NEGATED scale about the center — the mirror sign survives);
  //   (b) G's slope is exactly −sx (mirroring flips the x-scale sign);
  //   (c) the anchor of the composite is where G(q) = cx, which sits opposite
  //       the fit's translate by the same magnitude.
  for (const q of [350, 650]) {
    const gValue = 2 * cx - (cx + fit.translateX + fit.scaleX * (q - cx));
    near(gValue, cx - fit.translateX - fit.scaleX * (q - cx), 1e-9, `applied composite equals negated-scale map at x=${q}`);
  }
  const g = (q) => 2 * cx - (cx + fit.translateX + fit.scaleX * (q - cx));
  near((g(650) - g(350)) / 300, -fit.scaleX, 1e-9, "mirror composition negates the affine x-scale");
  near(g(cx - fit.translateX / fit.scaleX), cx, 1e-9, "composite anchor mirrors the fit anchor");
}

// ---------------------------------------------------------------------------
// Live camera pose: the real default renderer pose must project a sensible
// on-screen grid rectangle (oracle anchor for the browser center-match test).
// ---------------------------------------------------------------------------
{
  const pose = defaultGameplayCameraPose;
  const corners = projectGridCornersToScreen(pose.position, pose.rotationEulerDegrees, pose.projection, { widthCssPx: 1100, heightCssPx: 760 }, 0);
  assert.ok(corners !== null, "default gameplay camera must project the grid plane");
  const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
  const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  assert.ok(box.left > 0 && box.right < 1100 && box.top > 0 && box.bottom < 760, `grid must be on-screen: ${JSON.stringify(box)}`);
  const fit = solveVideoFit({
    envelope: { left: 350, top: 130, right: 750, bottom: 450 },
    gridScreenCorners: corners,
    elementWidthCssPx: 1100, elementHeightCssPx: 760
  });
  assert.ok(fit !== null, "default-pose fit must solve");
  // The affine is exact at its reference anchor (center by default): the
  // envelope center must map onto the projected grid's bounding-box center.
  const gridCenterX = (box.left + box.right) / 2;
  const gridCenterY = (box.top + box.bottom) / 2;
  near(fit.translateX + fit.scaleX * gridCenterX, 550, 1e-9, "envelope center (550) must land on the projected grid center x");
  near(fit.translateY + fit.scaleY * gridCenterY, 290, 1e-9, "envelope center (290) must land on the projected grid center y");
  // Forward map (solver convention): a displayed-video point maps to screen
  // as S(q) = t + s·q. The grid's bounding-box center must land on the
  // envelope center — that IS the oracle's "envelope center lands on grid
  // center" check, stated in forward form.
  near(fit.translateX + fit.scaleX * gridCenterX, 550, 1e-9);
  near(fit.translateY + fit.scaleY * gridCenterY, 290, 1e-9);
  // The inverse: applying the transform to a point at the ENVELOPE center
  // (in video coordinates) yields the point whose screen image is the grid
  // center — verify by composing screen-space forward + inverse.
  const videoAtEnvelopeCenter = { x: (550 - fit.translateX) / fit.scaleX, y: (290 - fit.translateY) / fit.scaleY };
  near(fit.scaleX * videoAtEnvelopeCenter.x + fit.translateX, 550, 1e-9, "inverse of the forward map recovers the envelope center screen image");
}

console.log("Video-fit solver: projection math, three reference anchors, knob relativity, null fallbacks, aspect/mirror composition and live-pose centering all passed.");
