// @ts-check
// Canonical build-default bake target for private Visual Test equipment authoring.
// Exported YAML and baked defaults use aerobeat/equipment_config version 4.

const euler = (x = 0, y = 0, z = 0) => Object.freeze({ x, y, z });

/** Complete, deeply frozen canonical equipment configuration v4. */
export const equipmentConfigDefaults = Object.freeze({
  schema: "aerobeat/equipment_config",
  version: 4,
  flow: Object.freeze({
    perHand: Object.freeze({
      left: Object.freeze({ scale: 2, rotationEulerDeg: euler(0, -90, 0) }),
      right: Object.freeze({ scale: 2, rotationEulerDeg: euler(0, -90, 0) })
    }),
    saber: Object.freeze({
      zones: Object.freeze({
        edgeTop: Object.freeze({ headingDeg: 90, localRotationEulerDeg: euler(0, 0, 45) }),
        edgeBottom: Object.freeze({ headingDeg: -90, localRotationEulerDeg: euler(0, 0, -45) }),
        edgeLeft: Object.freeze({ headingDeg: -180, localRotationEulerDeg: euler(0, -45, 0) }),
        edgeRight: Object.freeze({ headingDeg: 0, localRotationEulerDeg: euler(0, 145, 0) })
      }),
      ease: Object.freeze({ type: "linear", durationMs: 100 }),
      blendRadius: 0.15
    })
  }),
  boxing: Object.freeze({
    perHand: Object.freeze({
      left: Object.freeze({ scale: 0.75, rotationEulerDeg: euler(0, 0, 45) }),
      right: Object.freeze({ scale: 0.75, rotationEulerDeg: euler(0, 0, 45) })
    }),
    glove: Object.freeze({
      states: Object.freeze({
        straight: Object.freeze({ rotationEulerDeg: euler() }),
        uppercut: Object.freeze({ rotationEulerDeg: euler(0, 45, 0) }),
        hookL: Object.freeze({ rotationEulerDeg: euler(45, 0, 0) }),
        hookR: Object.freeze({ rotationEulerDeg: euler(45, 0, 0) }),
        guard: Object.freeze({ rotationEulerDeg: euler(0, 0, -70) })
      }),
      ease: Object.freeze({ type: "easeOut", durationMs: 100 }),
      upcomingBeatWindowMs: 500
    })
  })
});
