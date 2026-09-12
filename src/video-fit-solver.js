// @ts-check

import { aeroVideoFitReferences } from "@aerobeat/web-contracts/gameplay-contracts";

/**
 * he8u: affine video-fit solver (pure, DOM-free, unit-testable).
 *
 * The fit maps the calibrated body envelope (measured in the *displayed*
 * selfie-mirrored video, i.e. CSS pixels of the full-viewport `.media`
 * element) onto the 4x3 gameplay grid's screen rectangle projected through
 * the live renderer camera. The values are DERIVED on every recompute —
 * never fixed per-device constants. The user knobs are RELATIVE adjustments
 * composed on top of the derived transform.
 *
 * Coordinate convention (both rectangles share it): x right, y down, CSS
 * pixels of the game viewport (the `.media` element box).
 */

/** Gameplay grid plane in world coordinates (mirrors the renderer's `gameplayWorldGrid` span). */
const gridCornersWorld = Object.freeze([
  Object.freeze({ x: -2, y: 2.5 }),
  Object.freeze({ x: 2, y: 2.5 }),
  Object.freeze({ x: 2, y: -0.5 }),
  Object.freeze({ x: -2, y: -0.5 })
]);

/** @param {number} value */
function finiteNumber(value) { return typeof value === "number" && Number.isFinite(value); }
/** @param {unknown} value */
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }

/** @param {number} degrees */
function toRad(degrees) { return degrees * Math.PI / 180; }

/**
 * Project the four grid-plane corners (world x -2..2, y -0.5..2.5 at the
 * marker z plane) through a perspective camera.
 *
 * @param {Readonly<{x:number,y:number,z:number}>} cameraPosition
 * @param {Readonly<{xPitch:number,yYaw:number,zRoll:number}>} cameraRotationEulerDegrees
 * @param {Readonly<{verticalFovDegrees:number,nearClip:number,farClip:number}>} projection
 * @param {Readonly<{widthCssPx:number,heightCssPx:number}>} viewport
 * @param {number} [markerPlaneZ] World z of the marker (grid) plane.
 * @returns {ReadonlyArray<Readonly<{x:number,y:number}>> | null}
 *   Screen positions (x right, y DOWN) in element CSS pixels, in
 *   [top-left, top-right, bottom-right, bottom-left] world-corner order.
 *   Null when any corner is behind the near clip plane.
 */
export function projectGridCornersToScreen(cameraPosition, cameraRotationEulerDegrees, projection, viewport, markerPlaneZ = 0) {
  const requiredRecords = [cameraPosition, cameraRotationEulerDegrees, projection, viewport];
  if (!requiredRecords.every(isRecord)) return null;
  const px = Number(/** @type {Record<string, unknown>} */ (cameraPosition).x);
  const py = Number(/** @type {Record<string, unknown>} */ (cameraPosition).y);
  const pz = Number(/** @type {Record<string, unknown>} */ (cameraPosition).z);
  const pitchDeg = Number(/** @type {Record<string, unknown>} */ (cameraRotationEulerDegrees).xPitch);
  const yawDeg = Number(/** @type {Record<string, unknown>} */ (cameraRotationEulerDegrees).yYaw);
  const rollDeg = Number(/** @type {Record<string, unknown>} */ (cameraRotationEulerDegrees).zRoll);
  const fov = Number(/** @type {Record<string, unknown>} */ (projection).verticalFovDegrees);
  const nearClip = Number(/** @type {Record<string, unknown>} */ (projection).nearClip);
  const widthCssPx = Number(/** @type {Record<string, unknown>} */ (viewport).widthCssPx);
  const heightCssPx = Number(/** @type {Record<string, unknown>} */ (viewport).heightCssPx);
  const required = [px, py, pz, pitchDeg, yawDeg, rollDeg, fov, nearClip, markerPlaneZ, widthCssPx, heightCssPx];
  if (!required.every(finiteNumber) || fov <= 0 || fov >= 180 || nearClip <= 0 || widthCssPx <= 0 || heightCssPx <= 0) return null;

  // Camera orientation: PlayCanvas `setEulerAngles(x,y,z)` → `quat.setFromEulerAngles`
  // (intrinsic X-Y-Z: q = qx · qy · qz). The camera looks down local -Z, so the
  // world-space basis vectors are the rows of the rotation matrix derived from
  // the quaternion. This matches the renderer's `cameraEntity.forward/right/up`.
  const halfToRad = 0.5 * toRad(1);
  const ex = pitchDeg * halfToRad, ey = yawDeg * halfToRad, ez = rollDeg * halfToRad;
  const sx = Math.sin(ex), cx = Math.cos(ex);
  const sy = Math.sin(ey), cy = Math.cos(ey);
  const sz = Math.sin(ez), cz = Math.cos(ez);
  const qx = sx * cy * cz - cx * sy * sz;
  const qy = cx * sy * cz + sx * cy * sz;
  const qz = cx * cy * sz - sx * sy * cz;
  const qw = cx * cy * cz + sx * sy * sz;
  // Rotation matrix R from quaternion (right-handed, row-major):
  //   R = [1-2(y²+z²), 2(xy-wz),    2(xz+wy)  ;
  //        2(xy+wz),    1-2(x²+z²), 2(yz-wx)  ;
  //        2(xz-wy),    2(yz+wx),   1-2(x²+y²)]
  const r00 = 1 - 2 * (qy * qy + qz * qz), r01 = 2 * (qx * qy - qw * qz), r02 = 2 * (qx * qz + qw * qy);
  const r10 = 2 * (qx * qy + qw * qz), r11 = 1 - 2 * (qx * qx + qz * qz), r12 = 2 * (qy * qz - qw * qx);
  const r20 = 2 * (qx * qz - qw * qy), r21 = 2 * (qy * qz + qw * qx), r22 = 1 - 2 * (qx * qx + qy * qy);
  // Camera basis in world space: forward = R·(0,0,-1), right = R·(1,0,0), up = R·(0,1,0).
  const forward = { x: -r02, y: -r12, z: -r22 };
  const right = { x: r00, y: r10, z: r20 };
  const up = { x: r01, y: r11, z: r21 };

  const halfV = Math.tan(toRad(fov) / 2);
  const halfH = halfV * (widthCssPx / heightCssPx);

  // Pinhole basis in camera-local space (forward = local -Z): a world point
  // p projects from view coords v where v_z = -dot(d, forward) is the depth
  // along the forward axis, v_x = dot(d, right), v_y = dot(d, up).
  const projectPoint = (wx, wy) => {
    const dx = wx - px, dy = wy - py, dz = markerPlaneZ - pz;
    // Depth along the camera forward axis (positive when the point is ahead).
    const viewZ = dx * forward.x + dy * forward.y + dz * forward.z;
    if (!(viewZ > nearClip * 0.5)) return null;
    const viewX = dx * right.x + dy * right.y + dz * right.z;
    const viewY = dx * up.x + dy * up.y + dz * up.z;
    const ndcX = viewX / (viewZ * halfH);
    const ndcY = viewY / (viewZ * halfV);
    return Object.freeze({ x: ((ndcX + 1) / 2) * widthCssPx, y: ((1 - ndcY) / 2) * heightCssPx });
  };
  const projected = gridCornersWorld.map((corner) => projectPoint(corner.x, corner.y));
  return projected.every((point) => point !== null)
    ? Object.freeze(/** @type {ReadonlyArray<Readonly<{x:number,y:number}>>} */ (projected))
    : null;
}

/**
 * Solve the affine video-fit transform.
 *
 * @param {Readonly<{
 *   envelope: Readonly<{left:number,top:number,right:number,bottom:number}>,
 *   gridScreenCorners: ReadonlyArray<Readonly<{x:number,y:number}>>,
 *   elementWidthCssPx: number,
 *   elementHeightCssPx: number,
 *   reference?: "center"|"far"|"near",
 *   scalePercent?: number,
 *   offsetXPercent?: number,
 *   offsetYPercent?: number
 * }>} input
 * @returns {Readonly<{scaleX:number,scaleY:number,translateX:number,translateY:number}> | null}
 *   CSS transform components in element CSS pixel units for the transform
 *   order `translate(translateX, translateY) scale(scaleX, scaleY)` applied
 *   about the element's CSS center. The existing `scaleX(-1)` mirror is
 *   composed by the caller AFTER these values (compose, don't drop).
 *   Null when no fit is derivable (pre-calibration / failed projection /
 *   degenerate input) → the caller keeps the cover fallback.
 */
export function solveVideoFit(input) {
  if (!isRecord(input)) return null;
  const envelope = isRecord(input.envelope) ? input.envelope : null;
  const corners = Array.isArray(input.gridScreenCorners) ? input.gridScreenCorners : null;
  if (!envelope || !corners || corners.length !== 4) return null;
  const e = [Number(envelope.left), Number(envelope.top), Number(envelope.right), Number(envelope.bottom)];
  const elementWidth = Number(input.elementWidthCssPx);
  const elementHeight = Number(input.elementHeightCssPx);
  if (!([...e, elementWidth, elementHeight].every(finiteNumber))) return null;
  const envelopeWidth = e[2] - e[0];
  const envelopeHeight = e[3] - e[1];
  if (!(envelopeWidth > 0) || !(envelopeHeight > 0) || !(elementWidth > 0) || !(elementHeight > 0)) return null;
  const points = corners.map((corner) => {
    if (!isRecord(corner)) return null;
    const x = Number(corner.x), y = Number(corner.y);
    return finiteNumber(x) && finiteNumber(y) ? { x, y } : null;
  });
  if (!points.every((point) => point !== null)) return null;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const gridWidth = maxX - minX;
  const gridHeight = maxY - minY;
  if (!(gridWidth > 0) || !(gridHeight > 0)) return null;

  // Least-squares affine of the (possibly trapezoidal) projected grid
  // rectangle onto the axis-aligned envelope rectangle. Per axis the best
  // affine is a scale + translate; for a trapezoid the exact anchors are the
  // min/max edges, so the box-to-box map is the least-squares solution:
  // envelope center ↔ projected grid bounding-box center, edges ↔ edges.
  const baseScaleX = envelopeWidth / gridWidth;
  const baseScaleY = envelopeHeight / gridHeight;
  const gridCenterX = (minX + maxX) / 2;
  const gridCenterY = (minY + maxY) / 2;
  const envelopeCenterX = (e[0] + e[2]) / 2;
  const envelopeCenterY = (e[1] + e[3]) / 2;
  const baseTranslateX = envelopeCenterX - baseScaleX * gridCenterX;
  const baseTranslateY = envelopeCenterY - baseScaleY * gridCenterY;

  // Reference anchoring: the affine is exact at the chosen reference depth
  // line of the trapezoid. For a forward camera the FAR edge projects to the
  // top of the screen bounding box (minY) and the NEAR edge to the bottom
  // (maxY). Anchoring shifts the scale origin onto that edge so the chosen
  // edge maps exactly onto the envelope edge and the opposite edge carries
  // the perspective drift.
  const reference = input.reference ?? "center";
  if (!aeroVideoFitReferences.includes(reference)) return null;
  let translateX = baseTranslateX;
  let translateY = baseTranslateY;
  if (reference === "far" || reference === "near") {
    // Re-anchor the Y map so the chosen depth edge is exact: the map
    //   Y' = baseScaleY * (y - edgeY) + envelopeEdgeY
    // puts the chosen grid edge exactly on the envelope edge; the
    // perspective drift then lives on the opposite edge. (For a symmetric
    // trapezoid the far edge projects to the top of the screen box, minY,
    // and the near edge to the bottom, maxY, for a forward camera.)
    const gridEdgeY = reference === "far" ? minY : maxY;
    const envelopeEdgeY = reference === "far" ? e[1] : e[3];
    translateY = envelopeEdgeY - baseScaleY * gridEdgeY;
  }

  // Relative knobs composed on the derived fit, about the fit center.
  const scalePercent = input.scalePercent ?? 100;
  const offsetXPercent = input.offsetXPercent ?? 0;
  const offsetYPercent = input.offsetYPercent ?? 0;
  if (![scalePercent, offsetXPercent, offsetYPercent].every(finiteNumber)) return null;
  const knobScale = scalePercent / 100;
  const scaleX = baseScaleX * knobScale;
  const scaleY = baseScaleY * knobScale;
  translateX += (offsetXPercent / 100) * elementWidth;
  translateY += (offsetYPercent / 100) * elementHeight;

  return Object.freeze({ scaleX, scaleY, translateX, translateY });
}
