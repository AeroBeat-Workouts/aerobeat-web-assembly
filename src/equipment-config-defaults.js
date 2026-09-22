// @ts-check
// Build-default bake target for the Test-mode equipment config (AeroBeat 0.0.63,
// decision D2; plan 2026-09-21-0.0.63-playtest-feedback-0.0.62-retest-successor.md,
// L-C design, child C1 of bead 376l).
//
// This object is the canonical build defaults consumed by the assembly at
// runtime. Finalized YAMLs exported from Test mode (by Derrick) are baked in
// as the NEW build defaults via
// `node scripts/bake-equipment-config.js <file.yaml>`, which rewrites the
// `equipmentConfigDefaults` export below in place while preserving this file
// header comment.
//
// Schema: per-mode (flow / boxing):
//   perHand.{left,right} = { scale, rotationZDeg }   — base per-hand transform
//   flow.saber    = { zones.{edgeTop,edgeBottom,edgeLeft,edgeRight,center}.{rotationDeg},
//                     ease.{type,durationMs}, blendRadius }
//   boxing.glove  = { states.{straight,upercut,hookL,hookR,guard}.{rotationZDeg},
//                     ease.{type,durationMs}, upcomingBeatWindowMs }
// `center.rotationDeg === null` means NEUTRAL: the saber keeps its
// motion-derived direction instead of snapping to a zone angle.

/**
 * Frozen per-mode equipment config defaults (build baseline; re-pinned by the
 * bake script when Derrick finalizes a Test-mode export).
 *
 * @type {Readonly<{
 *   flow: Readonly<{
 *     perHand: Readonly<{ left: Readonly<{ scale: number, rotationZDeg: number }>, right: Readonly<{ scale: number, rotationZDeg: number }> }>,
 *     saber: Readonly<{
 *       zones: Readonly<{
 *         edgeTop: Readonly<{ rotationDeg: number }>,
 *         edgeBottom: Readonly<{ rotationDeg: number }>,
 *         edgeLeft: Readonly<{ rotationDeg: number }>,
 *         edgeRight: Readonly<{ rotationDeg: number }>,
 *         center: Readonly<{ rotationDeg: number | null }>
 *       }>,
 *       ease: Readonly<{ type: "linear" | "easeIn" | "easeOut" | "easeInOut", durationMs: number }>,
 *       blendRadius: number
 *     }>
 *   }>,
 *   boxing: Readonly<{
 *     perHand: Readonly<{ left: Readonly<{ scale: number, rotationZDeg: number }>, right: Readonly<{ scale: number, rotationZDeg: number }> }>,
 *     glove: Readonly<{
 *       states: Readonly<{
 *         straight: Readonly<{ rotationZDeg: number }>,
 *         uppercut: Readonly<{ rotationZDeg: number }>,
 *         hookL: Readonly<{ rotationZDeg: number }>,
 *         hookR: Readonly<{ rotationZDeg: number }>,
 *         guard: Readonly<{ rotationZDeg: number }>
 *       }>,
 *       ease: Readonly<{ type: "linear" | "easeIn" | "easeOut" | "easeInOut", durationMs: number }>,
 *       upcomingBeatWindowMs: number
 *     }>
 *   }>
 * }>}
 */
export const equipmentConfigDefaults = Object.freeze({
  flow: Object.freeze({
    perHand: Object.freeze({
      left: Object.freeze({
        scale: 1,
        rotationZDeg: 0
      }),
      right: Object.freeze({
        scale: 1,
        rotationZDeg: 0
      })
    }),
    saber: Object.freeze({
      zones: Object.freeze({
        edgeTop: Object.freeze({
          rotationDeg: 90
        }),
        edgeBottom: Object.freeze({
          rotationDeg: 270
        }),
        edgeLeft: Object.freeze({
          rotationDeg: 180
        }),
        edgeRight: Object.freeze({
          rotationDeg: 0
        }),
        center: Object.freeze({
          rotationDeg: null
        })
      }),
      ease: Object.freeze({
        type: "linear",
        durationMs: 100
      }),
      blendRadius: 0.15
    })
  }),
  boxing: Object.freeze({
    perHand: Object.freeze({
      left: Object.freeze({
        scale: 1,
        rotationZDeg: 0
      }),
      right: Object.freeze({
        scale: 1,
        rotationZDeg: 0
      })
    }),
    glove: Object.freeze({
      // INITIAL DEFAULTS — Derrick tunes these in Test mode; the value baked
      // in after his first export is the signed-off baseline (D3/D4 addenda).
      states: Object.freeze({
        straight: Object.freeze({
          rotationZDeg: 0
        }),
        uppercut: Object.freeze({
          rotationZDeg: -35
        }),
        hookL: Object.freeze({
          rotationZDeg: 60
        }),
        hookR: Object.freeze({
          rotationZDeg: -60
        }),
        guard: Object.freeze({
          rotationZDeg: -70
        })
      }),
      ease: Object.freeze({
        type: "easeOut",
        durationMs: 100
      }),
      upcomingBeatWindowMs: 500
    })
  })
});
