// @ts-check
// Pure right-handed intrinsic-local XYZ quaternion helpers. Euler composition is
// qZ * qY * qX; quaternion records use {x,y,z,w}.

const EPSILON = 1e-12;

export function normalizeQuaternion(value) {
  const x = Number(value?.x), y = Number(value?.y), z = Number(value?.z), w = Number(value?.w);
  const magnitude = Math.hypot(x, y, z, w);
  if (![x, y, z, w, magnitude].every(Number.isFinite) || magnitude < EPSILON) throw new TypeError("quaternion must be finite and non-zero");
  return Object.freeze({ x: x / magnitude, y: y / magnitude, z: z / magnitude, w: w / magnitude });
}

export function quaternionFromEulerDeg(value) {
  const x = Number(value?.x), y = Number(value?.y), z = Number(value?.z);
  if (![x, y, z].every(Number.isFinite)) throw new TypeError("Euler rotation must contain finite x/y/z degrees");
  const hx = x * Math.PI / 360, hy = y * Math.PI / 360, hz = z * Math.PI / 360;
  const cx = Math.cos(hx), sx = Math.sin(hx), cy = Math.cos(hy), sy = Math.sin(hy), cz = Math.cos(hz), sz = Math.sin(hz);
  return normalizeQuaternion({
    x: cz * cy * sx - sz * sy * cx,
    y: cz * sy * cx + sz * cy * sx,
    z: sz * cy * cx - cz * sy * sx,
    w: cz * cy * cx + sz * sy * sx
  });
}

export function quaternionToEulerDeg(value) {
  const q = normalizeQuaternion(value);
  const sinXCosY = 2 * (q.w * q.x + q.y * q.z);
  const cosXCosY = 1 - 2 * (q.x * q.x + q.y * q.y);
  const x = Math.atan2(sinXCosY, cosXCosY);
  const sinY = 2 * (q.w * q.y - q.z * q.x);
  const y = Math.abs(sinY) >= 1 ? Math.sign(sinY) * Math.PI / 2 : Math.asin(sinY);
  const sinZCosY = 2 * (q.w * q.z + q.x * q.y);
  const cosZCosY = 1 - 2 * (q.y * q.y + q.z * q.z);
  const z = Math.atan2(sinZCosY, cosZCosY);
  const canonical = (radians) => {
    const degrees = radians * 180 / Math.PI;
    const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
    return Math.abs(wrapped) < 1e-12 ? 0 : wrapped;
  };
  return Object.freeze({ x: canonical(x), y: canonical(y), z: canonical(z) });
}

export function quaternionDot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

/** Fixed-endpoint, normalized shortest-path quaternion slerp. */
export function slerpQuaternionShortest(startValue, targetValue, amount) {
  const start = normalizeQuaternion(startValue), normalizedTarget = normalizeQuaternion(targetValue);
  const t = Math.max(0, Math.min(1, Number(amount)));
  if (!Number.isFinite(t)) throw new TypeError("slerp amount must be finite");
  let target = normalizedTarget;
  let dot = quaternionDot(start, target);
  if (dot < 0) { target = { x: -target.x, y: -target.y, z: -target.z, w: -target.w }; dot = -dot; }
  if (dot > 0.9995) return normalizeQuaternion({
    x: start.x + (target.x - start.x) * t,
    y: start.y + (target.y - start.y) * t,
    z: start.z + (target.z - start.z) * t,
    w: start.w + (target.w - start.w) * t
  });
  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sinTheta = Math.sin(theta);
  const a = Math.sin((1 - t) * theta) / sinTheta;
  const b = Math.sin(t * theta) / sinTheta;
  return normalizeQuaternion({ x: a * start.x + b * target.x, y: a * start.y + b * target.y, z: a * start.z + b * target.z, w: a * start.w + b * target.w });
}

export const IDENTITY_QUATERNION = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });
