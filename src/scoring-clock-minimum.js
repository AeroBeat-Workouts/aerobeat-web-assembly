// @ts-check

import { effectivePlayNoteAfterWindowMs } from "@aerobeat/web-gameplay";

const punchActions = new Set(["straight_left", "straight_right", "hook_left", "hook_right", "uppercut_left", "uppercut_right"]);
const feedbackMarginMs = 400;

/**
 * The selected chart's Play clock must advance strictly past every scored
 * deadline and leave time to render the committed feedback. This is a clock
 * requirement, not a change to the encoded music or its source identity.
 * Mixed future-swap snapshots contain old events: only the selected chart is
 * used here; the audio service's extension-only minimum retains older needs.
 *
 * @param {readonly {variantId?:string,chartId?:string,centerTimestampMs:number,type?:string,authoredBeat?:{type?:string},checkpoint?:{timingWindowMs?:number}}[]} events Resolved content events.
 * @param {{variantId:string,chartId:string,rulesetId:string}} variant
 * @param {{timingWindowMs:number,colliderDepthBackward:number}} settings Run-locked or next-run collider settings.
 * @returns {number | undefined} Minimum seconds, absent if there is no scored event.
 */
export function scoringClockMinimumDurationSeconds(events, variant, settings) {
  let lastDeadlineMs = -Infinity;
  const windowMs = Number(settings.timingWindowMs);
  const depth = Number(settings.colliderDepthBackward);
  for (const event of events) {
    if (event.variantId !== variant.variantId || event.chartId !== variant.chartId) continue;
    const centerMs = Number(event.centerTimestampMs);
    if (!Number.isFinite(centerMs) || centerMs < 0) continue;
    const type = event.authoredBeat?.type ?? event.type;
    if (variant.rulesetId === "flow_colliders_v1" && type === "note" || variant.rulesetId === "boxing_collider_v1" && punchActions.has(type)) {
      lastDeadlineMs = Math.max(lastDeadlineMs, effectivePlayNoteAfterWindowMs(centerMs, windowMs, depth));
    } else if (variant.rulesetId === "boxing_collider_v1" && (type === "guard" || type === "crossed_guard" || type === "squat" || type === "weave_left" || type === "weave_right")) {
      const checkpointMs = Number(event.checkpoint?.timingWindowMs);
      const deadlineMs = type === "guard" || type === "crossed_guard"
        ? Number.isFinite(checkpointMs) && checkpointMs > 0 ? checkpointMs : windowMs * depth
        : windowMs * depth;
      lastDeadlineMs = Math.max(lastDeadlineMs, centerMs + deadlineMs);
    }
  }
  if (!Number.isFinite(lastDeadlineMs)) return undefined;
  // The audio API bounds declared duration at 86400 seconds. A chart beyond
  // that bound cannot be represented truthfully; fail instead of truncating.
  const seconds = (lastDeadlineMs + feedbackMarginMs) / 1000;
  if (seconds > 86400) throw new RangeError("Selected chart scoring deadline exceeds audio clock limit");
  return seconds;
}
