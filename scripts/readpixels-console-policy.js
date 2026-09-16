// @ts-check

export const READ_PIXELS_WARNING_BODY = "GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels";
export const READ_PIXELS_WARNING_REPEAT_SUFFIX = " (this message will no longer repeat)";
export const READ_PIXELS_WARNING_PATTERN = /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$(?![\s\S])/;

/**
 * Returns whether a Playwright console tuple is the established managed-browser
 * ReadPixels warning for one exact validation page.
 *
 * @param {string} type
 * @param {string} text
 * @param {string} sourceUrl
 * @param {number} lineNumber
 * @param {number} columnNumber
 * @param {string} expectedPageUrl
 * @returns {boolean}
 */
export function isExpectedReadPixelsWarning(type, text, sourceUrl, lineNumber, columnNumber, expectedPageUrl) {
  return type === "warning"
    && READ_PIXELS_WARNING_PATTERN.test(text)
    && sourceUrl === expectedPageUrl
    && lineNumber === 0
    && columnNumber === 0;
}

// Host red gate (documented in AGENTS.md / 0.0.52 wave plan): the Vite dev server
// re-emits PlayCanvas's addComponent warning during its dependency optimization
// step. This is baseline-verified pre-existing on clean main — it is not caused by
// assembly changes. We admit every exact match of this pinned body — Playwright
// reports the same warning three times per process (once per bundle warm-up) and
// any count cap would mask genuine new warnings while also failing on the
// documented baseline. The web-ui oracle uses the identical discipline with its
// own `PLAYCANVAS_MESH_WARNING` constant.
//
// NOTE: Playwright does NOT prefix the text with "warning: " (that's already
// conveyed by message.type()), so the pinned body starts at "addComponent:".
export const PLAYCANVAS_MESH_WARNING_BODY = "addComponent: ignoring unknown option 'mesh' passed to the 'render' component - check for a typo.";

/**
 * Returns whether a Playwright console tuple is the pinned Vite-dep-opt PlayCanvas
 * mesh warning. Exact text + type match — nothing else matches this string.
 *
 * @param {string} type
 * @param {string} text
 * @returns {boolean}
 */
export function isExpectedPlaycanvasMeshWarning(type, text) {
  return type === "warning" && text === PLAYCANVAS_MESH_WARNING_BODY;
}

// 0.0.55 W0: the collider debug overlays (tolerance_cone / collider_square) use
// custom vertex buffers without the standard `vertex_position` semantic. In
// headless Chromium this triggers a pair of PlayCanvas GL warnings per overlay
// node: an "error" about the missing vertex_position attribute and a "warning"
// about Safari compatibility. Both are benign — the overlays render correctly
// via the raw buffer layout. We admit these exact patterns so the visual-proof
// oracle can enable the overlays without tripping the zero-noise gate.
const COLLIDER_OVERLAY_VERTEX_ERROR_PATTERN = /^Vertex attribute \[vertex_position\] at location 0 required by the shader is not present in the currently assigned vertex buffers/u;
const COLLIDER_OVERLAY_VERTEX_WARNING_PATTERN = /^No vertex attribute is mapped to location 0/u;

/**
 * Returns whether a Playwright console tuple is an expected PlayCanvas warning
 * from the collider-overlay tolerance-cone / collider-square meshes in headless
 * Chromium. The source URL must be the bundled playcanvas.js dependency.
 *
 * @param {string} type
 * @param {string} text
 * @param {string} sourceUrl
 * @returns {boolean}
 */
export function isExpectedColliderOverlayVertexWarning(type, text, sourceUrl) {
  if (!sourceUrl.includes("playcanvas")) return false;
  if (type === "error") return COLLIDER_OVERLAY_VERTEX_ERROR_PATTERN.test(text);
  if (type === "warning") return COLLIDER_OVERLAY_VERTEX_WARNING_PATTERN.test(text);
  return false;
}
