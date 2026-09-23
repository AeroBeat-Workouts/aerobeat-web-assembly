// @ts-check
// Canonical build-default bake target for private Visual Test equipment authoring.
// Exported YAML and baked defaults use aerobeat/equipment_config version 2.

const euler = (x = 0, y = 0, z = 0) => Object.freeze({ x, y, z });

/**
 * Complete, deeply frozen canonical equipment configuration v2.
 * The bake script rewrites this export in deterministic schema order.
 */
export const equipmentConfigDefaults = Object.freeze({
  schema: "aerobeat/equipment_config",
  version: 2,
  flow: Object.freeze({
    perHand: Object.freeze({
      left: Object.freeze({ scale: 2, rotationEulerDeg: euler() }),
      right: Object.freeze({ scale: 2, rotationEulerDeg: euler() })
    }),
    saber: Object.freeze({
      zones: Object.freeze({
        edgeTop: Object.freeze({ headingDeg: 90, localRotationEulerDeg: euler() }),
        edgeBottom: Object.freeze({ headingDeg: -90, localRotationEulerDeg: euler() }),
        edgeLeft: Object.freeze({ headingDeg: -180, localRotationEulerDeg: euler() }),
        edgeRight: Object.freeze({ headingDeg: 0, localRotationEulerDeg: euler() }),
        center: Object.freeze({ headingDeg: null, localRotationEulerDeg: euler() })
      }),
      ease: Object.freeze({ type: "linear", durationMs: 100 }),
      blendRadius: 0.15
    })
  }),
  boxing: Object.freeze({
    perHand: Object.freeze({
      left: Object.freeze({ scale: 0.75, rotationEulerDeg: euler() }),
      right: Object.freeze({ scale: 0.75, rotationEulerDeg: euler() })
    }),
    glove: Object.freeze({
      states: Object.freeze({
        straight: Object.freeze({ rotationEulerDeg: euler() }),
        uppercut: Object.freeze({ rotationEulerDeg: euler(0, 0, -35) }),
        hookL: Object.freeze({ rotationEulerDeg: euler(0, 0, 60) }),
        hookR: Object.freeze({ rotationEulerDeg: euler(0, 0, -60) }),
        guard: Object.freeze({ rotationEulerDeg: euler(0, 0, -70) })
      }),
      ease: Object.freeze({ type: "easeOut", durationMs: 100 }),
      upcomingBeatWindowMs: 500
    })
  })
});
