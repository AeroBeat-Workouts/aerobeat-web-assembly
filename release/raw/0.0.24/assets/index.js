//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
//#endregion
//#region ../aerobeat-web-contracts/src/service-ids.js
/**
* Canonical AeroBeat web service IDs.
*
* @type {Readonly<{
*   audioClock: "aero.audio.clock",
*   videoMedia: "aero.video.media",
*   cvPose: "aero.cv.pose",
*   inputRouter: "aero.input.router",
*   bodyGrid: "aero.input.body-grid",
*   beatSaverVendor: "aero.vendor.beatsaver",
*   contentAuthoring: "aero.content.authoring",
*   contentLibrary: "aero.content.library",
*   gameplaySession: "aero.gameplay.session",
*   prototypeProfiles: "aero.gameplay.prototype-profiles",
*   mediaLease: "aero.assembly.media-lease",
*   rendererWebgl2: "aero.renderer.webgl2",
*   uiRouter: "aero.ui.router",
*   performancePolicy: "aero.performance.policy"
* }>}
*/
var serviceIds = Object.freeze({
	audioClock: "aero.audio.clock",
	videoMedia: "aero.video.media",
	cvPose: "aero.cv.pose",
	inputRouter: "aero.input.router",
	bodyGrid: "aero.input.body-grid",
	beatSaverVendor: "aero.vendor.beatsaver",
	contentAuthoring: "aero.content.authoring",
	contentLibrary: "aero.content.library",
	gameplaySession: "aero.gameplay.session",
	prototypeProfiles: "aero.gameplay.prototype-profiles",
	mediaLease: "aero.assembly.media-lease",
	rendererWebgl2: "aero.renderer.webgl2",
	uiRouter: "aero.ui.router",
	performancePolicy: "aero.performance.policy"
});
Object.freeze({
	uiNavigate: "aero:ui:navigate",
	cvPoseFrame: "aero:cv:pose-frame",
	audioClockTick: "aero:audio:clock-tick",
	inputBoxingIntent: "aero:input:boxing-intent",
	inputFlowIntent: "aero:input:flow-intent",
	bodyGridChanged: "aero:input:body-grid-changed",
	calibrationChanged: "aero:input:calibration-changed",
	trackingSafetyChanged: "aero:input:tracking-safety-changed",
	beatSaverResults: "aero:beatsaver:results",
	contentImportChanged: "aero:content:import-changed",
	contentChartLoaded: "aero:content:chart-loaded",
	contentVariantChanged: "aero:content:variant-changed",
	gameplaySessionChanged: "aero:gameplay:session-changed",
	gameplayScoreChange: "aero:gameplay:score-change",
	gameplayJudgement: "aero:gameplay:judgement",
	countdownChanged: "aero:gameplay:countdown-changed",
	mediaLeaseChanged: "aero:assembly:media-lease-changed",
	gameCommand: "aero:game:command",
	gameEvent: "aero:game:event"
});
//#endregion
//#region ../aerobeat-web-contracts/src/element-names.js
/**
* Canonical custom element registry names used across AeroBeat web packages.
*
* @type {Readonly<{
*   game: "aero-game",
*   iconButton: "aero-icon-button",
*   calibrationBadge: "aero-calibration-badge",
*   calibrationScreen: "aero-calibration-screen",
*   gridPlayfield: "aero-grid-playfield",
*   flowHud: "aero-flow-hud",
*   boxingTrackHud: "aero-boxing-track-hud",
*   boxingSpatialHud: "aero-boxing-spatial-hud",
*   trackingPause: "aero-tracking-pause",
*   countdown: "aero-resume-countdown",
*   prototypeSelector: "aero-prototype-selector",
*   beatSaverBrowser: "aero-beatsaver-browser",
*   contentImportProgress: "aero-content-import-progress",
*   contentLibrary: "aero-content-library",
*   fullscreenButton: "aero-fullscreen-button"
* }>}
*/
var elementNames = Object.freeze({
	game: "aero-game",
	iconButton: "aero-icon-button",
	calibrationBadge: "aero-calibration-badge",
	calibrationScreen: "aero-calibration-screen",
	gridPlayfield: "aero-grid-playfield",
	flowHud: "aero-flow-hud",
	boxingTrackHud: "aero-boxing-track-hud",
	boxingSpatialHud: "aero-boxing-spatial-hud",
	trackingPause: "aero-tracking-pause",
	countdown: "aero-resume-countdown",
	prototypeSelector: "aero-prototype-selector",
	beatSaverBrowser: "aero-beatsaver-browser",
	contentImportProgress: "aero-content-import-progress",
	contentLibrary: "aero-content-library",
	fullscreenButton: "aero-fullscreen-button"
});
//#endregion
//#region ../aerobeat-web-contracts/src/contract-guards.js
/**
* @param {unknown} value
* @returns {value is Readonly<Record<string, unknown>>}
*/
function isRecord$3(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
/**
* Require a plain record to contain exactly the declared own enumerable keys.
* Payload records remain the versioned extension point; contract envelopes do not.
*
* @param {unknown} value
* @param {readonly string[]} expectedKeys
* @returns {value is Readonly<Record<string, unknown>>}
*/
function hasExactKeys$1(value, expectedKeys) {
	if (!isRecord$3(value)) return false;
	const keys = Reflect.ownKeys(value);
	return keys.length === expectedKeys.length && keys.every((key) => {
		if (typeof key !== "string" || !expectedKeys.includes(key)) return false;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		return descriptor !== void 0 && descriptor.enumerable && "value" in descriptor;
	});
}
/**
* @param {unknown} value
* @returns {value is number}
*/
function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}
/**
* @param {unknown} value
* @returns {value is number}
*/
function isNonNegativeFiniteNumber(value) {
	return isFiniteNumber(value) && value >= 0;
}
/**
* @param {unknown} value
* @returns {value is string}
*/
function isNonEmptyString$1(value) {
	return typeof value === "string" && value.length > 0;
}
/**
* @param {unknown} value
* @returns {value is number}
*/
function isNormalizedNumber(value) {
	return isFiniteNumber(value) && value >= 0 && value <= 1;
}
/**
* @template {string} T
* @param {unknown} value
* @param {readonly T[]} allowed
* @returns {value is T}
*/
function isOneOf(value, allowed) {
	return typeof value === "string" && allowed.includes(value);
}
Object.freeze([
	"camera_preview_top_left",
	"gameplay_camera_bottom_left",
	"athlete_top_left",
	"playfield_top_left"
]);
/** @type {AeroGridDescriptor} */
var athleteBodyGrid4x3 = Object.freeze({
	schema: "aerobeat/grid_descriptor",
	version: 1,
	id: "athlete_body_4x3",
	columns: 4,
	rows: 3,
	coordinateSpace: "athlete_top_left",
	indexing: "top_left_row_major",
	horizontallyOpposedToCamera: true
});
/** @type {AeroGridDescriptor} */
var athleteBodySubgrid8x6 = Object.freeze({
	schema: "aerobeat/grid_descriptor",
	version: 1,
	id: "athlete_body_8x6",
	columns: 8,
	rows: 6,
	coordinateSpace: "athlete_top_left",
	indexing: "top_left_row_major",
	horizontallyOpposedToCamera: true
});
Object.freeze({
	schema: "aerobeat/grid_descriptor",
	version: 1,
	id: "gameplay_playfield_4x3",
	columns: 4,
	rows: 3,
	coordinateSpace: "playfield_top_left",
	indexing: "top_left_row_major",
	horizontallyOpposedToCamera: false
});
/**
* Convert an upstream camera point directly to public athlete space.
*
* @param {AeroNormalizedPoint} point
* @returns {AeroNormalizedPoint}
*/
function cameraPreviewToAthlete(point) {
	return Object.freeze({
		x: 1 - point.x,
		y: point.y
	});
}
/**
* Resolve a normalized point without clamping. Coordinates on or outside the far edge
* are diagnostic-only and produce no scoring cell.
*
* @param {AeroNormalizedPoint} point
* @param {AeroGridDescriptor} descriptor
* @returns {AeroGridCellRef | null}
*/
function normalizedPointToGridCell(point, descriptor) {
	if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y) || point.x < 0 || point.x >= 1 || point.y < 0 || point.y >= 1) return null;
	const column = point.x === 0 ? 0 : Math.floor(point.x * descriptor.columns);
	const row = point.y === 0 ? 0 : Math.floor(point.y * descriptor.rows);
	return Object.freeze({
		id: row === 0 && column === 0 ? 0 : row * descriptor.columns + column,
		row,
		column
	});
}
Object.freeze(["measured", "predicted"]);
Object.freeze({
	idle: "idle",
	loading: "loading",
	ready: "ready",
	failed: "failed",
	disposed: "disposed"
});
//#endregion
//#region ../aerobeat-web-contracts/src/body-grid-contracts.js
/**
* @typedef {"nose" | "left_shoulder" | "right_shoulder" | "left_elbow" | "right_elbow" | "left_wrist" | "right_wrist"} AeroUpperBodyAnchorName
*/
/**
* @typedef {"up" | "up-right" | "right" | "down-right" | "down" | "down-left" | "left" | "up-left"} AeroBodyGridDirection
*/
/**
* Compatibility alias for consumers that previously named this cardinal-only contract.
* The serialized direction field is now eight-way without changing its schema shape.
* @deprecated Use AeroBodyGridDirection.
* @typedef {AeroBodyGridDirection} AeroCardinalDirection
*/
/**
* @typedef {"uncalibrated" | "holding" | "cooldown" | "calibrated" | "recalibrating" | "tracking_lost" | "invalidated"} AeroCalibrationState
*/
/**
* @typedef {"not_ready" | "calibration_required" | "countdown" | "ready" | "paused_tracking" | "paused_manual" | "destroyed"} AeroReadinessState
*/
/**
* @typedef {Object} AeroCalibratedBounds
* @property {number} left Athlete-space left edge.
* @property {number} top Athlete-space top edge.
* @property {number} right Athlete-space right edge.
* @property {number} bottom Athlete-space bottom edge.
*/
/**
* @typedef {Object} AeroBodyGridAnchorSnapshot
* @property {"aerobeat/body_grid_anchor_snapshot"} schema Schema ID.
* @property {1} version Schema version.
* @property {AeroUpperBodyAnchorName} anchor Anchor identity.
* @property {string} calibrationId Calibration generation identity.
* @property {number} measurementTimestampMs Latest real measurement timestamp.
* @property {boolean} valid Whether this measured anchor is gameplay-valid.
* @property {number} confidence Normalized measured confidence.
* @property {number} rawX Unclamped athlete-space X.
* @property {number} rawY Unclamped athlete-space Y.
* @property {number | null} x Normalized athlete-space X when valid.
* @property {number | null} y Normalized athlete-space Y when valid.
* @property {number | null} cell Top-left row-major 4x3 scoring cell, or null outside the grid.
* @property {number | null} subcell Top-left row-major 8x6 diagnostic/scoring subcell, or null outside the grid.
*/
/**
* @typedef {Object} AeroBodyGridCellEntry
* @property {"aerobeat/body_grid_cell_entry"} schema Schema ID.
* @property {1} version Schema version.
* @property {AeroUpperBodyAnchorName} anchor Anchor identity.
* @property {string} calibrationId Calibration generation identity.
* @property {number} measurementTimestampMs Real measurement timestamp.
* @property {number} fromCell In-grid source cell.
* @property {number} toCell In-grid destination cell.
* @property {AeroBodyGridDirection} [direction] Eight-way athlete-space entry direction when recent motion is unambiguous. Omission records a measured cell entry without directional evidence.
* @property {"measured"} provenance Cell entries used for calibrated evidence are measured.
*/
/**
* @typedef {Object} AeroCalibrationSnapshot
* @property {"aerobeat/calibration_snapshot"} schema Schema ID.
* @property {1} version Schema version.
* @property {AeroCalibrationState} state Calibration lifecycle state.
* @property {AeroReadinessState} readiness Gameplay readiness state.
* @property {string | null} calibrationId Current calibration generation.
* @property {number} timestampMs Snapshot timestamp.
* @property {number} holdDurationMs Required qualified hold duration.
* @property {number} holdProgressMs Current qualified hold progress.
* @property {number} cooldownRemainingMs Cooldown remaining after completion.
* @property {boolean} releaseRequired Whether T-pose release is required before refire.
* @property {AeroCalibratedBounds | null} bounds Atomically published athlete-space bounds.
* @property {import("./coordinate-spaces.js").AeroGridDescriptor} grid Public 4x3 athlete grid.
* @property {import("./coordinate-spaces.js").AeroGridDescriptor} subgrid Public 8x6 athlete subgrid.
* @property {string | null} invalidationReason Null or stable invalidation reason.
*/
/**
* @typedef {Object} AeroTrackingSafetySnapshot
* @property {"aerobeat/tracking_safety_snapshot"} schema Schema ID.
* @property {1} version Schema version.
* @property {number} timestampMs Snapshot timestamp.
* @property {number} lossThresholdMs Sustained loss duration that pauses gameplay.
* @property {number} lossDurationMs Current sustained loss duration.
* @property {boolean} allRequiredAnchorsVisible Whether all seven required anchors pass confidence.
* @property {boolean} gameplayPaused Whether tracking safety currently pauses gameplay.
* @property {boolean} freshCalibrationRequired Whether pause exit requires new calibration.
*/
/** @type {readonly AeroUpperBodyAnchorName[]} */
var upperBodyAnchorNames = Object.freeze([
	"nose",
	"left_shoulder",
	"right_shoulder",
	"left_elbow",
	"right_elbow",
	"left_wrist",
	"right_wrist"
]);
/** @type {readonly AeroBodyGridDirection[]} */
var bodyGridDirections = Object.freeze([
	"up",
	"up-right",
	"right",
	"down-right",
	"down",
	"down-left",
	"left",
	"up-left"
]);
Object.freeze([
	"uncalibrated",
	"holding",
	"cooldown",
	"calibrated",
	"recalibrating",
	"tracking_lost",
	"invalidated"
]);
/** @type {readonly AeroReadinessState[]} */
var readinessStates = Object.freeze([
	"not_ready",
	"calibration_required",
	"countdown",
	"ready",
	"paused_tracking",
	"paused_manual",
	"destroyed"
]);
var calibrationDefaults = Object.freeze({
	requiredConfidence: .5,
	holdDurationMs: 4e3,
	cooldownDurationMs: 4e3,
	trackingLossPauseMs: 500,
	wristElbowVerticalRatio: .35,
	minimumElbowAngleDeg: 130
});
/**
* @param {unknown} value
* @returns {value is AeroBodyGridAnchorSnapshot}
*/
function isBodyGridAnchorSnapshot(value) {
	if (!isRecord$3(value)) return false;
	const valid = typeof value.valid === "boolean" ? value.valid : false;
	const normalizedPosition = valid ? isNormalizedNumber(value.rawX) && isNormalizedNumber(value.rawY) && isNormalizedNumber(value.x) && isNormalizedNumber(value.y) : (value.x === null || isNormalizedNumber(value.x)) && (value.y === null || isNormalizedNumber(value.y));
	const nullableCell = value.cell === null || Number.isInteger(value.cell) && Number(value.cell) >= 0 && Number(value.cell) < 12;
	const nullableSubcell = value.subcell === null || Number.isInteger(value.subcell) && Number(value.subcell) >= 0 && Number(value.subcell) < 48;
	const invalidHasNoScoringCell = valid || value.cell === null && value.subcell === null;
	return value.schema === "aerobeat/body_grid_anchor_snapshot" && value.version === 1 && isOneOf(value.anchor, upperBodyAnchorNames) && isNonEmptyString$1(value.calibrationId) && isNonNegativeFiniteNumber(value.measurementTimestampMs) && typeof value.valid === "boolean" && isNormalizedNumber(value.confidence) && isFiniteNumber(value.rawX) && isFiniteNumber(value.rawY) && normalizedPosition && nullableCell && nullableSubcell && invalidHasNoScoringCell && (!valid || value.x !== null && value.y !== null);
}
/**
* @param {unknown} value
* @returns {value is AeroBodyGridCellEntry}
*/
function isBodyGridCellEntry(value) {
	if (!isRecord$3(value)) return false;
	const directionValid = !Object.hasOwn(value, "direction") || isOneOf(value.direction, bodyGridDirections);
	return value.schema === "aerobeat/body_grid_cell_entry" && value.version === 1 && isOneOf(value.anchor, upperBodyAnchorNames) && isNonEmptyString$1(value.calibrationId) && isNonNegativeFiniteNumber(value.measurementTimestampMs) && Number.isInteger(value.fromCell) && Number(value.fromCell) >= 0 && Number(value.fromCell) < 12 && Number.isInteger(value.toCell) && Number(value.toCell) >= 0 && Number(value.toCell) < 12 && directionValid && value.provenance === "measured";
}
Object.freeze([
	"idle",
	"selecting_content",
	"calibrating",
	"countdown",
	"playing",
	"paused_manual",
	"paused_tracking",
	"completed",
	"error",
	"destroyed"
]);
Object.freeze([
	"initial_start",
	"manual_resume",
	"tracking_resume",
	"content_change"
]);
/** @type {readonly ("camera" | "audio")[]} */
var mediaLeaseResources = Object.freeze(["camera", "audio"]);
/**
* @param {unknown} value
* @returns {value is AeroMediaLeaseSnapshot}
*/
function isMediaLeaseSnapshot(value) {
	return hasExactKeys$1(value, [
		"schema",
		"version",
		"ownerInstanceId",
		"generation",
		"state",
		"resources"
	]) && value.schema === "aerobeat/media_lease_snapshot" && value.version === 1 && (value.ownerInstanceId === null || isNonEmptyString$1(value.ownerInstanceId)) && Number.isInteger(value.generation) && Number(value.generation) >= 0 && (value.state === "idle" || value.state === "transferring" || value.state === "owned") && Array.isArray(value.resources) && value.resources.every((item) => mediaLeaseResources.includes(item)) && new Set(value.resources).size === value.resources.length;
}
//#endregion
//#region ../aerobeat-web-contracts/src/gameplay-contracts.js
/**
* @typedef {"flow_grid_v1" | "boxing_semantic_track_v1" | "boxing_spatial_grid_v1"} AeroRulesetId
*/
/**
* @typedef {"row_family_balanced_height_v1" | "cut_family_source_height_v1"} AeroConversionRecipeId
*/
/**
* @typedef {"straight_left" | "straight_right" | "hook_left" | "hook_right" | "uppercut_left" | "uppercut_right" | "guard" | "crossed_guard" | "squat" | "weave_left" | "weave_right"} AeroBoxingAction
*/
/**
* @typedef {"no_input" | "stale_input" | "wrong_cell" | "wrong_subcell" | "wrong_direction" | "qualification_too_short" | "tracking_invalid" | "calibration_mismatch" | "timing_miss" | "blocked_overlap" | "action_consumed"} AeroJudgementDiagnosticCode
*/
/**
* @typedef {Object} AeroGameplayEvidenceSnapshot
* @property {"aerobeat/gameplay_evidence_snapshot"} schema Schema ID.
* @property {1} version Schema version.
* @property {string} calibrationId Calibration generation.
* @property {string} measuredSourceFrameId Real source-frame identity.
* @property {number} measurementTimestampMs Real measurement timestamp.
* @property {"measured"} provenance Evidence used by calibrated prototype scoring is measured.
* @property {readonly AeroBoxingAction[]} activeBoxingActions Positive semantic observations; overlapping actions are allowed.
* @property {readonly import("./body-grid-contracts.js").AeroBodyGridAnchorSnapshot[]} anchors Measured anchor snapshots.
* @property {readonly import("./body-grid-contracts.js").AeroBodyGridCellEntry[]} entries Measured cell entries with optional eight-way directional evidence.
*/
/**
* @typedef {Object} AeroGameplayJudgement
* @property {"aerobeat/gameplay_judgement"} schema Schema ID.
* @property {1} version Schema version.
* @property {string} eventId Authored event identity.
* @property {AeroRulesetId} rulesetId Ruleset identity.
* @property {AeroConversionRecipeId | null} recipeId Recipe identity when generated.
* @property {"hit" | "miss" | "ignored"} result Binary prototype result or non-scoring ignored event.
* @property {number} beatCenterTimestampMs Event center timestamp.
* @property {number | null} evidenceTimestampMs Consumed evidence timestamp.
* @property {number | null} timingOffsetMs Evidence minus beat center.
* @property {readonly AeroJudgementDiagnosticCode[]} diagnostics Detailed diagnostics.
* @property {boolean} shadow Whether this judgement is diagnostic-only.
*/
/**
* @typedef {Object} AeroPrototypeTuningIdentityBase
* @property {"aerobeat/prototype_tuning_identity"} schema Schema ID.
* @property {1} version Schema version.
* @property {string} profileId Stable bounded profile ID.
* @property {string} profileVersion Stable bounded profile version.
* @property {string} contentHash Bare lowercase SHA-256 content hash.
*/
/**
* A converter identity is pending when `regenerationRequired` is true and
* applied when the owning registry has matched generated-package provenance
* and emits false. Visual and scoring identities are always live/applied.
*
* @typedef {(AeroPrototypeTuningIdentityBase & {class:"live_visual" | "between_run_ruleset", regenerationRequired:false}) | (AeroPrototypeTuningIdentityBase & {class:"converter_regeneration", regenerationRequired:boolean})} AeroPrototypeTuningIdentity
*/
/** @type {readonly AeroRulesetId[]} */
var rulesetIds = Object.freeze([
	"flow_grid_v1",
	"boxing_semantic_track_v1",
	"boxing_spatial_grid_v1"
]);
/** @type {readonly AeroConversionRecipeId[]} */
var conversionRecipeIds = Object.freeze(["row_family_balanced_height_v1", "cut_family_source_height_v1"]);
/** @type {readonly AeroBoxingAction[]} */
var boxingActions = Object.freeze([
	"straight_left",
	"straight_right",
	"hook_left",
	"hook_right",
	"uppercut_left",
	"uppercut_right",
	"guard",
	"crossed_guard",
	"squat",
	"weave_left",
	"weave_right"
]);
Object.freeze([
	"no_input",
	"stale_input",
	"wrong_cell",
	"wrong_subcell",
	"wrong_direction",
	"qualification_too_short",
	"tracking_invalid",
	"calibration_mismatch",
	"timing_miss",
	"blocked_overlap",
	"action_consumed"
]);
var prototypeJudgementDefaults = Object.freeze({
	timingWindowBeforeMs: 180,
	timingWindowAfterMs: 180,
	checkpointFreshnessMs: 150,
	straightQualificationMs: 100,
	straightContinuityGapMs: 150,
	minimumPunchSpacingMs: 360
});
/**
* @param {unknown} value
* @returns {value is AeroGameplayEvidenceSnapshot}
*/
function isGameplayEvidenceSnapshot(value) {
	return isRecord$3(value) && value.schema === "aerobeat/gameplay_evidence_snapshot" && value.version === 1 && isNonEmptyString$1(value.calibrationId) && isNonEmptyString$1(value.measuredSourceFrameId) && isNonNegativeFiniteNumber(value.measurementTimestampMs) && value.provenance === "measured" && Array.isArray(value.activeBoxingActions) && value.activeBoxingActions.every((item) => isOneOf(item, boxingActions)) && Array.isArray(value.anchors) && value.anchors.every(isBodyGridAnchorSnapshot) && Array.isArray(value.entries) && value.entries.every(isBodyGridCellEntry);
}
/**
* @param {unknown} value
* @returns {value is AeroPrototypeTuningIdentity}
*/
function isPrototypeTuningIdentity(value) {
	return hasExactKeys$1(value, [
		"schema",
		"version",
		"profileId",
		"profileVersion",
		"contentHash",
		"class",
		"regenerationRequired"
	]) && value.schema === "aerobeat/prototype_tuning_identity" && value.version === 1 && isBoundedNonEmptyString(value.profileId, 256) && isBoundedNonEmptyString(value.profileVersion, 256) && typeof value.contentHash === "string" && /^[0-9a-f]{64}$/u.test(value.contentHash) && isOneOf(value.class, [
		"live_visual",
		"between_run_ruleset",
		"converter_regeneration"
	]) && typeof value.regenerationRequired === "boolean" && (value.class === "converter_regeneration" || value.regenerationRequired === false);
}
/** @param {unknown} value @param {number} maximum */
function isBoundedNonEmptyString(value, maximum) {
	return typeof value === "string" && value.length > 0 && value.length <= maximum;
}
//#endregion
//#region ../aerobeat-web-contracts/src/content-contracts.js
/**
* @typedef {"no_squats" | "no_weaves" | "any_punch" | "crossed_guard" | "cross_body"} AeroMapModifierId
*/
/**
* @typedef {Object} AeroContentHash
* @property {"aerobeat/content_hash"} schema Schema ID.
* @property {1} version Schema version.
* @property {"sha1" | "sha256"} algorithm Hash algorithm.
* @property {string} value Lowercase hexadecimal hash.
*/
/**
* @typedef {Object} AeroContentProvenance
* @property {"aerobeat/content_provenance"} schema Schema ID.
* @property {1} version Schema version.
* @property {string} sourceProvider Provider identity.
* @property {string} sourceId Provider map/source identity.
* @property {string} sourceVersionHash Selected source version hash.
* @property {string} sourceDifficulty Source difficulty identity.
* @property {string} recipeVersion Immutable recipe version.
* @property {readonly string[]} sourceEventIds Stable source event lineage.
*/
/**
* @typedef {Object} AeroContentVariantIdentity
* @property {"aerobeat/content_variant_identity"} schema Schema ID.
* @property {1} version Schema version.
* @property {string} packageId Package identity.
* @property {string} chartId Chart identity.
* @property {import("./gameplay-contracts.js").AeroRulesetId} rulesetId Ruleset identity.
* @property {import("./gameplay-contracts.js").AeroConversionRecipeId | null} recipeId Conversion recipe.
* @property {readonly AeroMapModifierId[]} modifierIds Ordered modifier identities.
* @property {AeroContentHash} mapHash Canonical map hash.
* @property {AeroContentHash} scoreIdentityHash Ruleset/recipe/map score partition hash.
* @property {boolean} ranked Whether this immutable variant is ranked.
*/
/**
* @typedef {Object} AeroPersistenceHandle
* @property {"aerobeat/persistence_handle"} schema Schema ID.
* @property {1} version Schema version.
* @property {"indexeddb" | "memory" | "external_url"} storage Storage class.
* @property {string} namespace Stable storage namespace.
* @property {string} key Opaque package key.
* @property {string} packageId Public package identity.
* @property {AeroContentHash} packageHash Package integrity hash.
*/
/** @type {readonly AeroMapModifierId[]} */
var mapModifierIds = Object.freeze([
	"no_squats",
	"no_weaves",
	"any_punch",
	"crossed_guard",
	"cross_body"
]);
/**
* @param {unknown} value
* @returns {value is AeroContentHash}
*/
function isContentHash(value) {
	if (!hasExactKeys$1(value, [
		"schema",
		"version",
		"algorithm",
		"value"
	]) || value.schema !== "aerobeat/content_hash" || value.version !== 1) return false;
	if (value.algorithm !== "sha1" && value.algorithm !== "sha256") return false;
	if (typeof value.value !== "string") return false;
	const expectedLength = value.algorithm === "sha1" ? 40 : 64;
	return value.value.length === expectedLength && /^[0-9a-f]+$/u.test(value.value);
}
/**
* @param {unknown} value
* @returns {value is AeroPersistenceHandle}
*/
function isPersistenceHandle(value) {
	return hasExactKeys$1(value, [
		"schema",
		"version",
		"storage",
		"namespace",
		"key",
		"packageId",
		"packageHash"
	]) && value.schema === "aerobeat/persistence_handle" && value.version === 1 && isOneOf(value.storage, [
		"indexeddb",
		"memory",
		"external_url"
	]) && isNonEmptyString$1(value.namespace) && isNonEmptyString$1(value.key) && isNonEmptyString$1(value.packageId) && isContentHash(value.packageHash);
}
Object.freeze([
	"queued",
	"acquiring",
	"inspecting",
	"converting",
	"validating",
	"persisting",
	"complete",
	"cancelled",
	"failed"
]);
//#endregion
//#region ../aerobeat-web-contracts/src/theme-contracts.js
/**
* @typedef {Object} AeroThemeTokens
* @property {string} leftHandColor CSS color token value.
* @property {string} rightHandColor CSS color token value.
* @property {string} guardColor CSS color token value.
* @property {string} obstacleColor CSS color token value.
* @property {string} receptorColor CSS color token value.
* @property {number} approachLeadMs Approach animation lead time.
* @property {number} targetStartScale Target initial scale.
* @property {number} targetHitScale Target beat-center scale.
* @property {string} approachEasing Serializable easing token.
* @property {string} hitEasing Serializable easing token.
* @property {string} missEasing Serializable easing token.
*/
/**
* @typedef {Object} AeroThemeDescriptor
* @property {"aerobeat/theme_descriptor"} schema Schema ID.
* @property {1} version Schema version.
* @property {string} id Stable theme ID.
* @property {string} themeVersion Theme version.
* @property {AeroThemeTokens} tokens Serializable approved tokens.
* @property {import("./content-contracts.js").AeroContentHash} contentHash Canonical token hash.
*/
/**
* @typedef {Object} AeroBackgroundSuggestion
* @property {"aerobeat/background_suggestion"} schema Schema ID.
* @property {1} version Schema version.
* @property {"default" | "playlist" | "song" | "athlete"} source Suggestion precedence source.
* @property {"css" | "image" | "video"} kind Background kind.
* @property {string | null} url External/package URL for media kinds.
* @property {import("./content-contracts.js").AeroContentHash | null} hash Required media hash for gameplay package assets.
* @property {string | null} themeId Optional associated theme.
*/
/** @type {readonly (keyof AeroThemeTokens)[]} */
var serializableThemeTokenNames = Object.freeze([
	"leftHandColor",
	"rightHandColor",
	"guardColor",
	"obstacleColor",
	"receptorColor",
	"approachLeadMs",
	"targetStartScale",
	"targetHitScale",
	"approachEasing",
	"hitEasing",
	"missEasing"
]);
/** @type {readonly ("default" | "playlist" | "song" | "athlete")[]} */
var backgroundSuggestionPrecedence = Object.freeze([
	"default",
	"playlist",
	"song",
	"athlete"
]);
/**
* @param {unknown} value
* @returns {value is AeroThemeDescriptor}
*/
function isThemeDescriptor(value) {
	if (!hasExactKeys$1(value, [
		"schema",
		"version",
		"id",
		"themeVersion",
		"tokens",
		"contentHash"
	]) || !isRecord$3(value.tokens)) return false;
	const tokens = value.tokens;
	const exactTokenKeys = Object.keys(tokens).length === serializableThemeTokenNames.length && Object.keys(tokens).every((key) => serializableThemeTokenNames.includes(key));
	return value.schema === "aerobeat/theme_descriptor" && value.version === 1 && isNonEmptyString$1(value.id) && isNonEmptyString$1(value.themeVersion) && exactTokenKeys && isNonEmptyString$1(tokens.leftHandColor) && isNonEmptyString$1(tokens.rightHandColor) && isNonEmptyString$1(tokens.guardColor) && isNonEmptyString$1(tokens.obstacleColor) && isNonEmptyString$1(tokens.receptorColor) && isNonNegativeFiniteNumber(tokens.approachLeadMs) && isNonNegativeFiniteNumber(tokens.targetStartScale) && isNonNegativeFiniteNumber(tokens.targetHitScale) && isNonEmptyString$1(tokens.approachEasing) && isNonEmptyString$1(tokens.hitEasing) && isNonEmptyString$1(tokens.missEasing) && isContentHash(value.contentHash);
}
/**
* @param {unknown} value
* @returns {value is AeroBackgroundSuggestion}
*/
function isBackgroundSuggestion(value) {
	if (!hasExactKeys$1(value, [
		"schema",
		"version",
		"source",
		"kind",
		"url",
		"hash",
		"themeId"
	])) return false;
	const sources = [
		"default",
		"playlist",
		"song",
		"athlete"
	];
	const kinds = [
		"css",
		"image",
		"video"
	];
	const mediaKind = value.kind === "image" || value.kind === "video";
	return value.schema === "aerobeat/background_suggestion" && value.version === 1 && typeof value.source === "string" && sources.includes(value.source) && typeof value.kind === "string" && kinds.includes(value.kind) && (mediaKind ? isNonEmptyString$1(value.url) : value.url === null) && (value.hash === null || isContentHash(value.hash)) && (value.themeId === null || isNonEmptyString$1(value.themeId));
}
//#endregion
//#region ../aerobeat-web-contracts/src/host-contracts.js
/**
* @typedef {"configure" | "start" | "pause" | "resume" | "stop" | "reset_calibration" | "request_fullscreen" | "select_content" | "select_variant" | "browse_beatsaver" | "import_beatsaver" | "import_local_zip" | "cancel_import" | "delete_package" | "set_theme" | "destroy"} AeroGameCommandType
*/
/**
* @typedef {"ready" | "capabilities_changed" | "calibration_changed" | "tracking_changed" | "session_changed" | "score_changed" | "content_changed" | "beatsaver_results" | "import_changed" | "fullscreen_changed" | "error" | "destroyed"} AeroGameEventType
*/
/**
* @typedef {Object} AeroGameCommand
* @property {"aerobeat/game_command"} schema Schema ID.
* @property {1} version Schema version.
* @property {string} commandId Caller-provided command identity.
* @property {AeroGameCommandType} type Command type.
* @property {Readonly<Record<string, unknown>> | null} payload Versioned command payload.
*/
/**
* @typedef {Object} AeroGameEvent
* @property {"aerobeat/game_event"} schema Schema ID.
* @property {1} version Schema version.
* @property {string} eventId Event identity.
* @property {AeroGameEventType} type Event type.
* @property {number} timestampMs Event timestamp.
* @property {Readonly<Record<string, unknown>> | null} payload Versioned event payload.
*/
/**
* @typedef {Object} AeroContainerSnapshot
* @property {"aerobeat/container_snapshot"} schema Schema ID.
* @property {1} version Schema version.
* @property {number} widthCssPx Parent content-box width.
* @property {number} heightCssPx Parent content-box height.
* @property {number} devicePixelRatio Effective device-pixel ratio.
* @property {boolean} visible Whether the owning document/iframe is visible.
* @property {boolean} fullscreen Whether the child game element is fullscreen.
*/
/**
* @typedef {Object} AeroFullscreenSnapshot
* @property {"aerobeat/fullscreen_snapshot"} schema Schema ID.
* @property {1} version Schema version.
* @property {boolean} supported Whether fullscreen is available and delegated.
* @property {boolean} active Whether this game element is currently fullscreen.
* @property {boolean} requestPending Whether a child-owned request is pending.
* @property {string | null} errorCode Stable failure code for the latest request.
*/
/**
* @typedef {Object} AeroGameCapabilities
* @property {"aerobeat/game_capabilities"} schema Schema ID.
* @property {1} version Schema version.
* @property {boolean} secureContext Secure-context availability.
* @property {boolean} camera Camera API availability/delegation.
* @property {boolean} fullscreen Fullscreen availability/delegation.
* @property {boolean} autoplay Audio autoplay availability.
* @property {boolean} webgl2 WebGL2 availability.
* @property {boolean} indexedDb IndexedDB availability.
* @property {boolean} worker Worker availability.
* @property {boolean} directBeatSaverCors Direct BeatSaver transport observed available.
* @property {boolean} localZipImport Local File/ZIP import availability.
* @property {readonly string[]} limitations Stable limitation codes.
*/
/**
* @typedef {Object} AeroAssetPolicy
* @property {"aerobeat/asset_policy"} schema Schema ID.
* @property {1} version Schema version.
* @property {boolean} requireChartHash Whether charts require declared hashes.
* @property {boolean} requireAudioHash Whether audio requires declared hashes.
* @property {boolean} requireExternalAudioCors Whether external audio must be CORS-readable.
* @property {boolean} requireSampledMediaCors Whether sampled image/video media must be CORS-readable.
* @property {"fallback"} cosmeticBackgroundFailure Cosmetic background behavior.
* @property {"block_startup"} criticalAssetFailure Gameplay-critical asset behavior.
*/
/** @type {readonly AeroGameCommandType[]} */
var gameCommandTypes = Object.freeze([
	"configure",
	"start",
	"pause",
	"resume",
	"stop",
	"reset_calibration",
	"request_fullscreen",
	"select_content",
	"select_variant",
	"browse_beatsaver",
	"import_beatsaver",
	"import_local_zip",
	"cancel_import",
	"delete_package",
	"set_theme",
	"destroy"
]);
/** @type {readonly AeroGameEventType[]} */
var gameEventTypes = Object.freeze([
	"ready",
	"capabilities_changed",
	"calibration_changed",
	"tracking_changed",
	"session_changed",
	"score_changed",
	"content_changed",
	"beatsaver_results",
	"import_changed",
	"fullscreen_changed",
	"error",
	"destroyed"
]);
Object.freeze({
	schema: "aerobeat/asset_policy",
	version: 1,
	requireChartHash: true,
	requireAudioHash: true,
	requireExternalAudioCors: true,
	requireSampledMediaCors: true,
	cosmeticBackgroundFailure: "fallback",
	criticalAssetFailure: "block_startup"
});
/**
* @param {unknown} value
* @returns {value is AeroGameCommand}
*/
function isGameCommand(value) {
	return hasExactKeys$1(value, [
		"schema",
		"version",
		"commandId",
		"type",
		"payload"
	]) && value.schema === "aerobeat/game_command" && value.version === 1 && isNonEmptyString$1(value.commandId) && isOneOf(value.type, gameCommandTypes) && (value.payload === null || isRecord$3(value.payload));
}
/**
* @param {unknown} value
* @returns {value is AeroGameEvent}
*/
function isGameEvent(value) {
	return hasExactKeys$1(value, [
		"schema",
		"version",
		"eventId",
		"type",
		"timestampMs",
		"payload"
	]) && value.schema === "aerobeat/game_event" && value.version === 1 && isNonEmptyString$1(value.eventId) && isOneOf(value.type, gameEventTypes) && isNonNegativeFiniteNumber(value.timestampMs) && (value.payload === null || isRecord$3(value.payload));
}
//#endregion
//#region ../aerobeat-web-contracts/src/iframe-contracts.js
/**
* @typedef {"handshake_request" | "handshake_ack" | "command" | "event" | "error" | "disconnect"} AeroIframeMessageKind
*/
/**
* @typedef {Object} AeroIframeMessage
* @property {"aerobeat/iframe_message"} schema Schema ID.
* @property {1} version Protocol version.
* @property {AeroIframeMessageKind} kind Message kind.
* @property {string} messageId Message identity.
* @property {string} instanceId Child game instance identity.
* @property {Readonly<Record<string, unknown>> | null} payload Structured payload without media/binary data.
*/
/** @type {readonly AeroIframeMessageKind[]} */
var iframeMessageKinds = Object.freeze([
	"handshake_request",
	"handshake_ack",
	"command",
	"event",
	"error",
	"disconnect"
]);
Object.freeze({
	schema: "aerobeat/iframe_message",
	version: 1,
	target: "immediate_parent",
	rawMediaAllowed: false
});
Object.freeze([
	"audioBytes",
	"frame",
	"frames",
	"imageBitmap",
	"mediaStream",
	"mediaStreamTrack",
	"pixels",
	"rawAudio",
	"rawFrame",
	"rawFrames",
	"screenshot",
	"videoFrame",
	"zipBytes"
]);
var forbiddenIframePayloadKeyAliases = /* @__PURE__ */ new Set([
	"archive",
	"archivebuffer",
	"archivebytes",
	"archivedata",
	"audiobuffer",
	"audiobytes",
	"audiodata",
	"audiotrack",
	"cameraframe",
	"cameraframes",
	"frame",
	"framedata",
	"framebuffer",
	"frames",
	"imagebitmap",
	"imagepixels",
	"mediastream",
	"mediastreamtrack",
	"mediatrack",
	"pixel",
	"pixelbuffer",
	"pixeldata",
	"pixels",
	"rawaudio",
	"rawcameraframe",
	"rawcameraframes",
	"rawframe",
	"rawframes",
	"screencapture",
	"screenshot",
	"screenshotbytes",
	"screenshotdata",
	"screenshots",
	"streamtrack",
	"videoframe",
	"videoframes",
	"videotrack",
	"zip",
	"ziparchive",
	"zipbuffer",
	"zipbytes",
	"zipdata"
]);
/**
* @param {string} key
* @returns {boolean}
*/
function isForbiddenIframePayloadKey(key) {
	const canonicalKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
	return forbiddenIframePayloadKeyAliases.has(canonicalKey);
}
/**
* @param {unknown} value
* @param {Set<object>} seen
* @returns {boolean}
*/
function isBridgeValue(value, seen) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (Array.isArray(value)) {
		if (seen.has(value)) return false;
		seen.add(value);
		const valid = value.every((item) => isBridgeValue(item, seen));
		seen.delete(value);
		return valid;
	}
	if (!isRecord$3(value)) return false;
	if (seen.has(value)) return false;
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => {
		if (typeof key !== "string") return true;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		return descriptor === void 0 || !descriptor.enumerable || !("value" in descriptor);
	})) return false;
	seen.add(value);
	for (const key of keys) {
		const entry = value[key];
		if (isForbiddenIframePayloadKey(key) || !isBridgeValue(entry, seen)) {
			seen.delete(value);
			return false;
		}
	}
	seen.delete(value);
	return true;
}
/**
* Verify that a bridge payload is bounded to JSON-like records and contains no raw
* frame, archive, audio, pixel, screenshot, stream, or transferable objects.
*
* @param {unknown} value
* @returns {boolean}
*/
function isSafeIframePayload(value) {
	return value === null || isRecord$3(value) && isBridgeValue(value, /* @__PURE__ */ new Set());
}
/**
* @param {unknown} value
* @returns {value is AeroIframeMessage}
*/
function isIframeMessage(value) {
	if (!hasExactKeys$1(value, [
		"schema",
		"version",
		"kind",
		"messageId",
		"instanceId",
		"payload"
	])) return false;
	if (value.schema !== "aerobeat/iframe_message" || value.version !== 1 || !isOneOf(value.kind, iframeMessageKinds) || !isNonEmptyString$1(value.messageId) || !isNonEmptyString$1(value.instanceId) || !isSafeIframePayload(value.payload)) return false;
	if (value.kind === "handshake_request") return hasExactKeys$1(value.payload, ["protocolVersion"]) && value.payload.protocolVersion === 1;
	if (value.kind === "handshake_ack") return hasExactKeys$1(value.payload, ["protocolVersion", "accepted"]) && value.payload.protocolVersion === 1 && typeof value.payload.accepted === "boolean";
	if (value.kind === "command") return hasExactKeys$1(value.payload, ["command"]) && isGameCommand(value.payload.command);
	if (value.kind === "event") return hasExactKeys$1(value.payload, ["event"]) && isGameEvent(value.payload.event);
	return true;
}
//#endregion
//#region ../aerobeat-web-gameplay/src/data.js
/** @typedef {Readonly<Record<string, unknown>>} DataRecord */
var MAX_DEPTH = 12;
var MAX_ITEMS = 4096;
var MAX_KEYS = 256;
var MAX_STRING = 8192;
/**
* Clone untrusted JSON-like data without invoking getters or coercion hooks.
*
* @param {unknown} value
* @param {string} [code]
* @param {number} [maximumItems]
* @returns {unknown}
*/
function cloneGameplayData(value, code = "gameplay_data_invalid", maximumItems = MAX_ITEMS) {
	if (!Number.isSafeInteger(maximumItems) || maximumItems <= 0 || maximumItems > 15e5) throw gameplayError(code, "Gameplay item limit is invalid");
	let items = 0;
	return clone(value, 0);
	/** @param {unknown} entry @param {number} depth @returns {unknown} */
	function clone(entry, depth) {
		if (depth > MAX_DEPTH || items > maximumItems) throw gameplayError(code, "Gameplay data exceeds structural limits");
		if (entry === null || typeof entry === "boolean") return entry;
		if (typeof entry === "number") {
			if (!Number.isFinite(entry)) throw gameplayError(code, "Gameplay numbers must be finite");
			return Object.is(entry, -0) ? 0 : entry;
		}
		if (typeof entry === "string") {
			if (entry.length > MAX_STRING) throw gameplayError(code, "Gameplay strings exceed the length limit");
			return entry;
		}
		if (Array.isArray(entry)) {
			if (Reflect.ownKeys(entry).some((key) => typeof key !== "string" || key !== "length" && !/^(0|[1-9][0-9]*)$/u.test(key))) throw gameplayError(code, "Gameplay arrays cannot contain symbolic or named properties");
			const lengthDescriptor = Object.getOwnPropertyDescriptor(entry, "length");
			if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 || lengthDescriptor.value > maximumItems) throw gameplayError(code, "Gameplay arrays exceed the item limit");
			const length = lengthDescriptor.value;
			items += length;
			if (items > maximumItems) throw gameplayError(code, "Gameplay data exceeds structural limits");
			const result = [];
			for (let index = 0; index < length; index += 1) {
				const descriptor = Object.getOwnPropertyDescriptor(entry, String(index));
				if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw gameplayError(code, "Gameplay arrays cannot contain accessors or holes");
				result.push(clone(descriptor.value, depth + 1));
			}
			return Object.freeze(result);
		}
		if (!isPlainRecord$3(entry)) throw gameplayError(code, "Gameplay data must contain plain records only");
		const keys = Reflect.ownKeys(entry);
		if (keys.length > MAX_KEYS || keys.some((key) => typeof key !== "string")) throw gameplayError(code, "Gameplay records exceed key limits or contain symbols");
		items += keys.length;
		if (items > maximumItems) throw gameplayError(code, "Gameplay data exceeds structural limits");
		/** @type {Record<string, unknown>} */
		const result = {};
		for (const keyValue of keys) {
			const key = keyValue;
			if (key.length > 256) throw gameplayError(code, "Gameplay record keys exceed the length limit");
			const descriptor = Object.getOwnPropertyDescriptor(entry, key);
			if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw gameplayError(code, "Gameplay records cannot contain accessors or hidden properties");
			result[key] = clone(descriptor.value, depth + 1);
		}
		return Object.freeze(result);
	}
}
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainRecord$3(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
/**
* Read only an exact set of top-level own data fields without traversing values.
* This is used for transport envelopes whose documented optional values may be undefined.
*
* @param {unknown} value
* @param {string} code
* @param {readonly string[]} allowedKeys
* @returns {DataRecord}
*/
function requireDataRecordFields(value, code, allowedKeys) {
	if (!isPlainRecord$3(value)) throw gameplayError(code, "Expected a plain record");
	const allowed = new Set(allowedKeys);
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== "string" || !allowed.has(key))) throw gameplayError(code, "Record contains unknown or symbolic fields");
	/** @type {Record<string, unknown>} */
	const result = {};
	for (const keyValue of keys) {
		const key = keyValue;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw gameplayError(code, "Record cannot contain accessors or hidden fields");
		result[key] = descriptor.value;
	}
	return Object.freeze(result);
}
/** @param {unknown} value @param {string} code @param {number} [maximumItems] @returns {DataRecord} */
function requireRecord$3(value, code, maximumItems) {
	if (!isPlainRecord$3(value)) throw gameplayError(code, "Expected a plain record");
	return cloneGameplayData(value, code, maximumItems);
}
/** @param {unknown} value @param {string} code @returns {string} */
function requireString$1(value, code) {
	if (typeof value !== "string" || value.length === 0 || value.length > 256) throw gameplayError(code, "Expected a bounded non-empty string");
	return value;
}
/** @param {unknown} value @param {string} code @returns {number} */
function requireNonNegativeNumber(value, code) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw gameplayError(code, "Expected a non-negative finite number");
	return Object.is(value, -0) ? 0 : value;
}
/** @param {unknown} value @param {string} code @param {number} [limit] @returns {readonly string[]} */
function requireStringArray(value, code, limit = 2048) {
	const copy = cloneGameplayData(value, code, limit);
	if (!Array.isArray(copy) || copy.length > limit) throw gameplayError(code, "Expected a bounded string array");
	const result = [];
	for (const entry of copy) result.push(requireString$1(entry, code));
	return Object.freeze(result);
}
/** @param {string} code @param {string} message @returns {Error & {code: string}} */
function gameplayError(code, message) {
	return Object.assign(new Error(message), { code });
}
/** @param {string} left @param {string} right @returns {number} */
function compareCodePoints$2(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}
//#endregion
//#region ../aerobeat-web-gameplay/src/session-coordinator.js
/** @typedef {Readonly<Record<string, unknown>>} DataRecord */
/** @typedef {import("@aerobeat/web-contracts").AeroGameplayEvidenceSnapshot} AeroGameplayEvidenceSnapshot */
/** @typedef {import("@aerobeat/web-contracts").AeroGameplayJudgement} AeroGameplayJudgement */
/** @typedef {import("@aerobeat/web-contracts").AeroGameplaySessionState} AeroGameplaySessionState */
/** @typedef {import("@aerobeat/web-contracts").AeroCountdownReason} AeroCountdownReason */
/** @type {readonly string[]} */
var CHECKPOINT_ACTIONS = Object.freeze([
	"guard",
	"crossed_guard",
	"squat",
	"weave_left",
	"weave_right"
]);
/** @type {readonly string[]} */
var PUNCH_ACTIONS = Object.freeze([
	"straight_left",
	"straight_right",
	"hook_left",
	"hook_right",
	"uppercut_left",
	"uppercut_right"
]);
/** @type {readonly string[]} */
var SUPPORTED_MODIFIERS = Object.freeze([
	"any_punch",
	"cross_body",
	"crossed_guard",
	"no_squats",
	"no_weaves"
]);
/**
* @typedef {Object} GameplayCoordinatorOptions
* @property {string} [sessionId]
* @property {string} [instanceId]
* @property {number} [countdownStepMs]
* @property {(error: unknown) => void} [onListenerError]
*/
/**
* @typedef {Object} GameplayContentConfiguration
* @property {string} packageId
* @property {DataRecord} selectedVariant
* @property {readonly DataRecord[]} resolvedEvents
* @property {DataRecord} [profileIdentity]
* @property {DataRecord} [scoringSettings]
* @property {readonly DataRecord[]} [shadowVariants]
*/
/**
* Create a deterministic per-game session coordinator. Wall timestamps drive safety/countdown;
* the injected audio clock is the sole gameplay timeline authority.
*
* @param {GameplayCoordinatorOptions} [options]
*/
function createAeroGameplaySessionCoordinator(options = {}) {
	const normalizedOptions = normalizeOptions(options);
	const sessionId = normalizedOptions.sessionId;
	const instanceId = normalizedOptions.instanceId;
	const countdownStepMs = normalizedOptions.countdownStepMs;
	const listeners = /* @__PURE__ */ new Set();
	let destroyed = false;
	let generation = 0;
	let state = "idle";
	let timestampMs = 0;
	let timelinePositionMs = 0;
	let packageId = null;
	let variant = null;
	let profileIdentity = defaultProfileIdentity();
	let scoringSettings = defaultScoringSettings();
	let events = Object.freeze([]);
	let contentGeneration = 0;
	let eventTruth = /* @__PURE__ */ new WeakMap();
	let shadowVariants = Object.freeze([]);
	let calibrationId = null;
	let safetyReady = false;
	let freshCalibrationRequired = true;
	let pauseReason = null;
	let countdown = inactiveCountdown(0);
	let countdownStepStartedAtMs = 0;
	let countdownTimelinePositionMs = 0;
	let countdownReason = null;
	let invalidatedCalibrationId = null;
	let lastInput = null;
	let latestEvidence = null;
	let latestEvidenceTimelineMs = 0;
	let lastEvidenceFrameId = null;
	let leaseSnapshot = null;
	const judgedIds = /* @__PURE__ */ new Set();
	let activeIds = /* @__PURE__ */ new Set();
	const judgements = [];
	const shadowJudgements = [];
	const shadowConsumed = /* @__PURE__ */ new Set();
	const consumedActions = /* @__PURE__ */ new Set();
	const consumedGuardPunchWindows = /* @__PURE__ */ new Map();
	const partitions = /* @__PURE__ */ new Map();
	let snapshot = makeSnapshot(null);
	return Object.freeze({
		configureContent,
		requestStart,
		pause,
		resume,
		advance,
		synchronizePausedClock,
		applyFutureContent,
		setActiveEventIds,
		setLeaseSnapshot,
		stop,
		reset,
		getSnapshot: () => snapshot,
		getJudgements: () => Object.freeze([...judgements]),
		getScorePartitions: () => Object.freeze([...partitions.values()].map((entry) => Object.freeze({ ...entry }))),
		subscribe,
		destroy
	});
	/** @param {GameplayContentConfiguration} configuration */
	function configureContent(configuration) {
		assertOpen();
		const source = requireRecord$3(configuration, "content_configuration_invalid", 15e5);
		const nextPackageId = requireString$1(source.packageId, "content_package_invalid");
		const nextVariant = normalizeVariant(source.selectedVariant);
		const nextEvents = normalizeEvents(source.resolvedEvents, nextVariant);
		const nextProfileIdentity = source.profileIdentity === void 0 ? defaultProfileIdentity() : normalizeProfile$1(source.profileIdentity);
		const nextScoringSettings = source.scoringSettings === void 0 ? defaultScoringSettings() : normalizeScoringSettings(source.scoringSettings);
		const nextShadowVariants = source.shadowVariants === void 0 ? Object.freeze([]) : normalizeShadowVariants(source.shadowVariants);
		const nextContentGeneration = contentGeneration + 1;
		const nextEventTruth = bindEventTruth(nextEvents, nextPackageId, nextContentGeneration, nextVariant, nextProfileIdentity, nextScoringSettings);
		packageId = nextPackageId;
		variant = nextVariant;
		contentGeneration = nextContentGeneration;
		eventTruth = nextEventTruth;
		events = nextEvents;
		profileIdentity = nextProfileIdentity;
		scoringSettings = nextScoringSettings;
		shadowVariants = nextShadowVariants;
		clearRunTruth();
		state = "calibrating";
		pauseReason = "calibration_required";
		generation += 1;
		publish(null);
		return snapshot;
	}
	/** @param {number} atTimestampMs */
	function requestStart(atTimestampMs) {
		assertConfigured();
		if (state !== "calibrating") throw gameplayError("session_state_invalid", "Initial start requires the calibrating state");
		advanceTimestamp(atTimestampMs);
		if (!hasRequiredLease()) {
			state = "paused_manual";
			pauseReason = "media_lease_unavailable";
			publish(null);
			return Object.freeze({
				accepted: false,
				reason: "media_lease_unavailable"
			});
		}
		if (!safetyReady || freshCalibrationRequired || calibrationId === null) {
			state = "calibrating";
			pauseReason = "calibration_required";
			publish(null);
			return Object.freeze({
				accepted: false,
				reason: "calibration_required"
			});
		}
		beginCountdown("initial_start");
		return Object.freeze({
			accepted: true,
			reason: null
		});
	}
	/** @param {number} atTimestampMs @param {string} [reason] */
	function pause(atTimestampMs, reason = "manual") {
		assertOpen();
		advanceTimestamp(atTimestampMs);
		if (state === "destroyed") return snapshot;
		cancelCountdown();
		state = "paused_manual";
		pauseReason = boundedReason(reason);
		publish(null);
		return snapshot;
	}
	/** @param {number} atTimestampMs */
	function resume(atTimestampMs) {
		assertConfigured();
		if (state !== "paused_manual" && state !== "paused_tracking") throw gameplayError("session_state_invalid", "Resume requires a paused session");
		advanceTimestamp(atTimestampMs);
		if (!hasRequiredLease()) {
			state = "paused_manual";
			pauseReason = "media_lease_unavailable";
			publish(null);
			return Object.freeze({
				accepted: false,
				reason: "media_lease_unavailable"
			});
		}
		if (!safetyReady || freshCalibrationRequired || calibrationId === null) {
			state = freshCalibrationRequired ? "paused_tracking" : "calibrating";
			pauseReason = "calibration_required";
			publish(null);
			return Object.freeze({
				accepted: false,
				reason: "calibration_required"
			});
		}
		beginCountdown(state === "paused_tracking" ? "tracking_resume" : "manual_resume");
		return Object.freeze({
			accepted: true,
			reason: null
		});
	}
	/**
	* Advance deterministic state using one audio-clock and optional input sample.
	*
	* @param {{timestampMs: number, clock: unknown, input?: unknown, lease?: unknown}} frame
	*/
	function advance(frame) {
		assertOpen();
		const safeFrame = requireDataRecordFields(frame, "advance_frame_invalid", [
			"timestampMs",
			"clock",
			"input",
			"lease"
		]);
		const nextTimestampMs = requireNonNegativeNumber(safeFrame.timestampMs, "timestamp_invalid");
		if (nextTimestampMs < timestampMs) throw gameplayError("timestamp_rollback", "Gameplay timestamps must not roll back");
		const clock = normalizeClock(safeFrame.clock);
		const nextLease = safeFrame.lease === void 0 ? null : normalizeLeaseSnapshot(safeFrame.lease);
		const nextInput = safeFrame.input === void 0 ? null : normalizeInputSnapshot(safeFrame.input);
		const enteredState = state;
		const enteredAsCountdown = enteredState === "countdown";
		const previousTimelinePositionMs = timelinePositionMs;
		timestampMs = nextTimestampMs;
		if (nextLease !== null) leaseSnapshot = nextLease;
		if (nextInput !== null) commitInput(nextInput);
		enforceLease();
		enforceSafety();
		if (enteredAsCountdown && state === "countdown") advanceCountdown(clock);
		if (enteredState === "playing" && state === "playing") {
			if (!clock.playing) {
				state = "paused_manual";
				pauseReason = "audio_clock_not_playing";
			} else if (clock.positionMs < previousTimelinePositionMs) {
				state = "paused_manual";
				pauseReason = "audio_clock_rollback";
			} else {
				timelinePositionMs = clock.positionMs;
				captureEvidenceForTimeline();
				judgeLiveEvents();
				judgeShadowEvents();
				if (events.length > 0 && judgedIds.size >= events.length) {
					state = "completed";
					pauseReason = null;
				}
			}
		} else if (enteredState !== "playing" && enteredState !== "countdown" && enteredState !== "paused_manual" && enteredState !== "paused_tracking" && state !== "paused_tracking") timelinePositionMs = clock.positionMs;
		publish(null);
		return snapshot;
	}
	/**
	* Synchronize an explicit paused seek from the authoritative audio clock.
	* Ordinary advance frames cannot move a manually paused timeline.
	*
	* @param {{timestampMs: number, clock: unknown}} frame
	*/
	function synchronizePausedClock(frame) {
		assertConfigured();
		if (state !== "paused_manual") throw gameplayError("session_state_invalid", "Paused clock synchronization requires a manual pause");
		const safeFrame = requireDataRecordFields(frame, "paused_clock_frame_invalid", ["timestampMs", "clock"]);
		const nextTimestampMs = requireNonNegativeNumber(safeFrame.timestampMs, "timestamp_invalid");
		if (nextTimestampMs < timestampMs) throw gameplayError("timestamp_rollback", "Gameplay timestamps must not roll back");
		const clock = normalizeClock(safeFrame.clock);
		if (clock.playing) throw gameplayError("paused_clock_not_frozen", "Paused clock synchronization requires a stopped audio clock");
		timestampMs = nextTimestampMs;
		timelinePositionMs = clock.positionMs;
		publish(null);
		return snapshot;
	}
	/** @param {GameplayContentConfiguration} configuration */
	function applyFutureContent(configuration) {
		assertConfigured();
		if (state === "playing" || state === "countdown") throw gameplayError("variant_swap_requires_pause", "Future variant swaps require a paused session");
		const source = requireRecord$3(configuration, "content_configuration_invalid", 15e5);
		const nextPackageId = requireString$1(source.packageId, "content_package_invalid");
		if (nextPackageId !== packageId) throw gameplayError("variant_swap_package_mismatch", "Future variant swaps must remain in the loaded package");
		const nextVariant = normalizeVariant(source.selectedVariant);
		const nextEvents = normalizeEvents(source.resolvedEvents, nextVariant);
		const nextProfileIdentity = source.profileIdentity === void 0 ? profileIdentity : normalizeProfile$1(source.profileIdentity);
		const nextScoringSettings = source.scoringSettings === void 0 ? scoringSettings : normalizeScoringSettings(source.scoringSettings);
		const nextShadowVariants = source.shadowVariants === void 0 ? shadowVariants : normalizeShadowVariants(source.shadowVariants);
		const preserve = new Map(events.filter((event) => shouldPreserveEvent(event)).map((event) => [String(event.eventId), event]));
		const lineage = new Set([...preserve.values()].flatMap((event) => lineageIds(event)));
		const merged = [...preserve.values()];
		const acceptedNextEvents = [];
		for (const event of nextEvents) {
			if (preserve.has(String(event.eventId))) continue;
			if (Number(event.centerTimestampMs) <= timelinePositionMs) continue;
			if (lineageIds(event).some((id) => lineage.has(id))) continue;
			merged.push(event);
			acceptedNextEvents.push(event);
		}
		if (merged.length > 1e5) throw gameplayError("content_events_invalid", "Future content merge exceeds the event limit");
		merged.sort(eventOrder);
		const nextContentGeneration = contentGeneration + 1;
		const nextEventTruth = /* @__PURE__ */ new WeakMap();
		for (const event of preserve.values()) {
			const truth = eventTruth.get(event);
			if (!truth) throw gameplayError("event_truth_missing", "Preserved events require immutable content-generation truth");
			nextEventTruth.set(event, truth);
		}
		for (const event of acceptedNextEvents) nextEventTruth.set(event, makeEventTruth(nextPackageId, nextContentGeneration, nextVariant, nextProfileIdentity, nextScoringSettings));
		events = Object.freeze(merged);
		variant = nextVariant;
		contentGeneration = nextContentGeneration;
		eventTruth = nextEventTruth;
		profileIdentity = nextProfileIdentity;
		scoringSettings = nextScoringSettings;
		shadowVariants = nextShadowVariants;
		generation += 1;
		publish(null);
		return snapshot;
	}
	/** @param {readonly string[]} ids */
	function setActiveEventIds(ids) {
		assertConfigured();
		const normalizedIds = requireStringArray(ids, "active_event_ids_invalid", 2048);
		if (new Set(normalizedIds).size !== normalizedIds.length) throw gameplayError("active_event_ids_invalid", "Active event IDs must be unique");
		const knownIds = new Set(events.map((event) => String(event.eventId)));
		if (normalizedIds.some((id) => !knownIds.has(id))) throw gameplayError("active_event_ids_invalid", "Active event IDs must belong to current content");
		activeIds = new Set(normalizedIds);
		publish(null);
		return snapshot;
	}
	/** @param {unknown} value */
	function setLeaseSnapshot(value) {
		assertOpen();
		setLeaseSnapshotInternal(value);
		enforceLease();
		publish(null);
		return snapshot;
	}
	/** @param {number} atTimestampMs */
	function stop(atTimestampMs) {
		assertOpen();
		advanceTimestamp(atTimestampMs);
		cancelCountdown();
		state = "completed";
		pauseReason = null;
		publish(null);
		return snapshot;
	}
	/** @param {number} [atTimestampMs] */
	function reset(atTimestampMs = timestampMs) {
		assertOpen();
		advanceTimestamp(atTimestampMs);
		generation += 1;
		clearRunTruth();
		state = packageId === null ? "idle" : "calibrating";
		pauseReason = packageId === null ? null : "calibration_required";
		calibrationId = null;
		invalidatedCalibrationId = null;
		safetyReady = false;
		freshCalibrationRequired = true;
		publish(null);
		return snapshot;
	}
	/** @param {(value: DataRecord) => void} listener */
	function subscribe(listener) {
		assertOpen();
		if (typeof listener !== "function") throw gameplayError("listener_invalid", "Gameplay listener must be a function");
		listeners.add(listener);
		notify(listener);
		return () => listeners.delete(listener);
	}
	function destroy() {
		if (destroyed) return;
		generation += 1;
		destroyed = true;
		state = "destroyed";
		cancelCountdown();
		latestEvidence = null;
		lastInput = null;
		pauseReason = null;
		publish(null);
		listeners.clear();
	}
	/** @param {unknown} value @returns {DataRecord} */
	function normalizeInputSnapshot(value) {
		const input = requireRecord$3(value, "input_snapshot_invalid");
		const calibration = requireRecord$3(input.calibration, "input_calibration_invalid");
		const tracking = requireRecord$3(input.tracking, "input_tracking_invalid");
		const nextCalibrationId = calibration.calibrationId === null ? null : requireString$1(calibration.calibrationId, "calibration_id_invalid");
		const readiness = requireString$1(calibration.readiness, "input_calibration_invalid");
		if (!readinessStates.includes(readiness)) throw gameplayError("input_calibration_invalid", "Input readiness state is unsupported");
		if (typeof tracking.gameplayPaused !== "boolean" || typeof tracking.freshCalibrationRequired !== "boolean" || typeof input.countdownFrozen !== "boolean") throw gameplayError("input_tracking_invalid", "Input tracking safety fields must be boolean");
		const qualifications = normalizeStraightQualifications(input.straightQualifications ?? []);
		const candidate = input.latestEvidence;
		if (candidate !== null && candidate !== void 0) {
			if (!isGameplayEvidenceSnapshot(candidate)) throw gameplayError("input_evidence_invalid", "Input evidence does not satisfy the public contract");
			validateEvidenceIdentity(candidate);
			if (nextCalibrationId === null || candidate.calibrationId !== nextCalibrationId) throw gameplayError("input_evidence_invalid", "Input evidence must belong to the snapshot calibration");
		}
		return Object.freeze({
			input: Object.freeze({
				...input,
				straightQualifications: qualifications
			}),
			nextCalibrationId,
			readiness,
			trackingPaused: tracking.gameplayPaused || input.countdownFrozen,
			upstreamFreshRequired: tracking.freshCalibrationRequired,
			candidate: candidate ?? null
		});
	}
	/** @param {DataRecord} normalized */
	function commitInput(normalized) {
		const input = normalized.input;
		const nextCalibrationId = normalized.nextCalibrationId;
		const readiness = normalized.readiness;
		const trackingPaused = normalized.trackingPaused === true;
		lastInput = input;
		const recoveryIdMatches = invalidatedCalibrationId !== null && nextCalibrationId === invalidatedCalibrationId;
		freshCalibrationRequired = normalized.upstreamFreshRequired === true || nextCalibrationId === null || recoveryIdMatches;
		safetyReady = (readiness === "ready" || readiness === "countdown") && !trackingPaused && !freshCalibrationRequired;
		if (nextCalibrationId !== calibrationId) {
			calibrationId = nextCalibrationId;
			latestEvidence = null;
			lastEvidenceFrameId = null;
		}
		if (safetyReady && invalidatedCalibrationId !== null && nextCalibrationId !== invalidatedCalibrationId) invalidatedCalibrationId = null;
		if (normalized.candidate !== null) latestEvidence = normalized.candidate;
	}
	function captureEvidenceForTimeline() {
		if (!latestEvidence || latestEvidence.measuredSourceFrameId === lastEvidenceFrameId) return;
		lastEvidenceFrameId = latestEvidence.measuredSourceFrameId;
		latestEvidenceTimelineMs = timelinePositionMs;
	}
	function enforceSafety() {
		if (state === "playing" || state === "countdown" || state === "paused_manual") {
			if (!safetyReady || freshCalibrationRequired) enterTrackingPause();
		} else if (state === "paused_tracking" && safetyReady && !freshCalibrationRequired && calibrationId !== null) beginCountdown("tracking_resume");
		else if (state === "calibrating" && safetyReady && calibrationId !== null) pauseReason = null;
	}
	function enterTrackingPause() {
		if (invalidatedCalibrationId === null && calibrationId !== null) invalidatedCalibrationId = calibrationId;
		cancelCountdown();
		state = "paused_tracking";
		pauseReason = "tracking_lost_recalibration_required";
		latestEvidence = null;
		lastEvidenceFrameId = null;
		freshCalibrationRequired = true;
		safetyReady = false;
	}
	function hasRequiredLease() {
		if (!leaseSnapshot || !instanceId) return true;
		return leaseSnapshot.ownerInstanceId === instanceId && leaseSnapshot.state === "owned" && Array.isArray(leaseSnapshot.resources) && leaseSnapshot.resources.includes("audio") && leaseSnapshot.resources.includes("camera");
	}
	function enforceLease() {
		if (hasRequiredLease()) return;
		if (state === "playing" || state === "countdown") {
			cancelCountdown();
			state = "paused_manual";
			pauseReason = "media_lease_unavailable";
		}
	}
	/** @param {unknown} value */
	function setLeaseSnapshotInternal(value) {
		leaseSnapshot = normalizeLeaseSnapshot(value);
	}
	/** @param {AeroCountdownReason} reason */
	function beginCountdown(reason) {
		state = "countdown";
		pauseReason = null;
		countdownReason = reason;
		countdownStepStartedAtMs = timestampMs;
		countdownTimelinePositionMs = timelinePositionMs;
		countdown = countdownSnapshot("three", reason, 3, timestampMs, calibrationId);
		publish(null);
	}
	/** @param {{positionMs: number, playing: boolean}} clock */
	function advanceCountdown(clock) {
		if (clock.playing || clock.positionMs !== countdownTimelinePositionMs) {
			timelinePositionMs = countdownTimelinePositionMs;
			cancelCountdown();
			state = "paused_manual";
			pauseReason = "countdown_audio_not_frozen";
			return;
		}
		if (timestampMs - countdownStepStartedAtMs < countdownStepMs) {
			countdown = countdownSnapshot(countdown.state, countdownReason, countdown.value, timestampMs, calibrationId);
			return;
		}
		countdownStepStartedAtMs = timestampMs;
		if (countdown.state === "three") countdown = countdownSnapshot("two", countdownReason, 2, timestampMs, calibrationId);
		else if (countdown.state === "two") countdown = countdownSnapshot("one", countdownReason, 1, timestampMs, calibrationId);
		else {
			countdown = countdownSnapshot("complete", countdownReason, null, timestampMs, calibrationId);
			state = "playing";
			pauseReason = null;
		}
	}
	function cancelCountdown() {
		if (countdown.state !== "inactive" && countdown.state !== "complete") countdown = countdownSnapshot("cancelled", countdownReason, null, timestampMs, calibrationId);
		else countdown = inactiveCountdown(timestampMs);
		countdownReason = null;
	}
	function judgeLiveEvents() {
		for (const event of events) {
			const eventId = String(event.eventId);
			if (judgedIds.has(eventId)) continue;
			const center = Number(event.centerTimestampMs);
			if (variantForEvent(event).mode === "flow" && event.type !== "note") {
				if (timelinePositionMs >= center) recordJudgement(event, "ignored", Object.freeze([]), null, false);
				continue;
			}
			if (timelinePositionMs < center - prototypeJudgementDefaults.timingWindowBeforeMs) continue;
			if (tryHit(event, false)) continue;
			if (timelinePositionMs > center + prototypeJudgementDefaults.timingWindowAfterMs) recordJudgement(event, "miss", missDiagnostics(event), null, false);
		}
	}
	function judgeShadowEvents() {
		if (!latestEvidence || !lastInput || latestEvidence.calibrationId !== calibrationId) return;
		const evidenceAge = timestampMs - latestEvidence.measurementTimestampMs;
		if (evidenceAge < 0 || evidenceAge > prototypeJudgementDefaults.checkpointFreshnessMs) return;
		for (const shadow of shadowVariants) {
			const shadowEvents = Array.isArray(shadow.resolvedEvents) ? shadow.resolvedEvents : [];
			for (const eventValue of shadowEvents) {
				if (!isPlainRecord$3(eventValue)) continue;
				const event = eventValue;
				const key = `${String(shadow.variantId)}:${String(event.eventId)}:${latestEvidence.measuredSourceFrameId}`;
				if (shadowConsumed.has(key)) continue;
				const center = Number(event.centerTimestampMs);
				if (Math.abs(latestEvidenceTimelineMs - center) > prototypeJudgementDefaults.timingWindowAfterMs) continue;
				const match = matchEvent(event, shadow, latestEvidence, lastInput);
				if (match.hit) {
					shadowConsumed.add(key);
					shadowJudgements.push(makeJudgement(event, shadow, "hit", match.diagnostics, latestEvidence, latestEvidenceTimelineMs, profileIdentity, true));
				}
			}
		}
	}
	/** @param {DataRecord} event @param {boolean} shadow */
	function tryHit(event, shadow) {
		if (!latestEvidence || !lastInput) return false;
		if (latestEvidence.calibrationId !== calibrationId) return false;
		const evidenceAge = timestampMs - latestEvidence.measurementTimestampMs;
		if (evidenceAge < 0 || evidenceAge > prototypeJudgementDefaults.checkpointFreshnessMs) return false;
		const center = Number(event.centerTimestampMs);
		const offset = latestEvidenceTimelineMs - center;
		if (offset < -prototypeJudgementDefaults.timingWindowBeforeMs || offset > prototypeJudgementDefaults.timingWindowAfterMs) return false;
		const match = matchEvent(event, variantForEvent(event), latestEvidence, lastInput);
		if (!match.hit) return false;
		const action = expectedAction(event);
		const actionKey = `${latestEvidence.measuredSourceFrameId}|${action}`;
		if (consumedActions.has(actionKey)) {
			recordJudgement(event, "miss", Object.freeze(["action_consumed"]), latestEvidence, shadow);
			return true;
		}
		const category = eventCategory(event);
		const frameId = latestEvidence.measuredSourceFrameId;
		const consumedWindows = consumedGuardPunchWindows.get(frameId) ?? [];
		if ((category === "guard" || category === "punch") && consumedWindows.some((entry) => entry.category !== category && Math.abs(entry.centerTimestampMs - center) <= prototypeJudgementDefaults.timingWindowBeforeMs + prototypeJudgementDefaults.timingWindowAfterMs)) {
			recordJudgement(event, "miss", Object.freeze(["blocked_overlap"]), latestEvidence, shadow);
			return true;
		}
		consumedActions.add(actionKey);
		if (category === "guard" || category === "punch") consumedGuardPunchWindows.set(frameId, Object.freeze([...consumedWindows, Object.freeze({
			category,
			centerTimestampMs: center
		})]));
		recordJudgement(event, "hit", match.diagnostics, latestEvidence, shadow);
		return true;
	}
	/** @param {DataRecord} event @param {"hit" | "miss" | "ignored"} result @param {readonly string[]} diagnostics @param {AeroGameplayEvidenceSnapshot | null} evidence @param {boolean} shadow */
	function recordJudgement(event, result, diagnostics, evidence, shadow) {
		const eventVariant = variantForEvent(event);
		const eventProfile = profileForEvent(event);
		const judgement = makeJudgement(event, eventVariant, result, diagnostics, evidence, evidence ? latestEvidenceTimelineMs : null, eventProfile, shadow);
		if (shadow) shadowJudgements.push(judgement);
		else {
			judgements.push(judgement);
			judgedIds.add(String(event.eventId));
			updateScore(result, eventVariant, eventProfile, scoringSettingsForEvent(event));
		}
	}
	/** @param {"hit" | "miss" | "ignored"} result @param {DataRecord} scoreVariant @param {DataRecord} scoreProfile @param {DataRecord} settings */
	function updateScore(result, scoreVariant, scoreProfile, settings) {
		const key = scorePartitionKey(scoreVariant, scoreProfile, settings);
		const next = { ...partitions.get(key) ?? {
			partitionId: key,
			variantId: scoreVariant.variantId,
			chartId: scoreVariant.chartId,
			rulesetId: scoreVariant.rulesetId,
			recipeId: scoreVariant.recipeId,
			modifierIds: scoreVariant.modifierIds,
			mapHash: scoreVariant.mapHash,
			scoreIdentityHash: scoreVariant.scoreIdentityHash,
			profileId: scoreProfile.profileId,
			profileVersion: scoreProfile.profileVersion,
			profileHash: scoreProfile.contentHash,
			profileClass: scoreProfile.class,
			regenerationRequired: scoreProfile.regenerationRequired,
			scoringSettings: settings,
			scoringSettingsIdentity: scoreSettingsIdentity(settings),
			ranked: scoreVariant.ranked === true,
			localOnly: true,
			hits: 0,
			misses: 0,
			ignored: 0,
			score: 0,
			maxCombo: 0,
			combo: 0
		} };
		if (result === "hit") {
			next.hits += 1;
			next.combo += 1;
			next.score = finiteScore(next.score + Number(settings.hitPoints) + Math.max(0, next.combo - 1) * Number(settings.comboBonusPerHit));
			next.maxCombo = Math.max(next.maxCombo, next.combo);
		} else if (result === "miss") {
			next.misses += 1;
			next.score = finiteScore(Math.max(0, next.score - Number(settings.missPenalty)));
			next.combo = 0;
		} else next.ignored += 1;
		partitions.set(key, Object.freeze(next));
	}
	/** @param {DataRecord} event @returns {readonly string[]} */
	function missDiagnostics(event) {
		if (!latestEvidence) return Object.freeze(["no_input"]);
		if (latestEvidence.calibrationId !== calibrationId) return Object.freeze(["calibration_mismatch"]);
		const age = timestampMs - latestEvidence.measurementTimestampMs;
		if (age < 0 || age > prototypeJudgementDefaults.checkpointFreshnessMs) return Object.freeze(["stale_input"]);
		const match = matchEvent(event, variantForEvent(event), latestEvidence, lastInput);
		return match.diagnostics.length > 0 ? match.diagnostics : Object.freeze(["timing_miss"]);
	}
	/** @param {Readonly<{code: string, message: string}> | null} error */
	function publish(error) {
		snapshot = makeSnapshot(error);
		for (const listener of listeners) notify(listener);
	}
	/** @param {(value: DataRecord) => void} listener */
	function notify(listener) {
		try {
			listener(snapshot);
		} catch (error) {
			try {
				normalizedOptions.onListenerError?.(error);
			} catch {}
		}
	}
	/** @param {Readonly<{code: string, message: string}> | null} error */
	function makeSnapshot(error) {
		return Object.freeze({
			schema: "aerobeat/gameplay_coordinator_snapshot",
			version: 1,
			serviceId: "aero.gameplay.session",
			generation,
			session: Object.freeze({
				schema: "aerobeat/gameplay_session_snapshot",
				version: 1,
				sessionId,
				state,
				timestampMs,
				timelinePositionMs,
				packageId,
				chartId: variant?.chartId ?? null,
				calibrationId,
				rulesetId: variant?.rulesetId ?? null,
				recipeId: variant?.recipeId ?? null,
				ranked: variant?.ranked === true,
				pauseReason
			}),
			countdown,
			safety: Object.freeze({
				ready: safetyReady,
				freshCalibrationRequired
			}),
			lease: leaseSnapshot,
			selectedVariant: variant ? publicVariant$1(variant) : null,
			profileIdentity,
			scoringSettings,
			activeEventIds: Object.freeze([...activeIds].sort(compareCodePoints$2)),
			judgedEventIds: Object.freeze([...judgedIds].sort(compareCodePoints$2)),
			judgements: Object.freeze([...judgements]),
			shadowJudgements: Object.freeze([...shadowJudgements]),
			scorePartitions: Object.freeze([...partitions.values()].map((entry) => Object.freeze({ ...entry }))),
			error
		});
	}
	function clearRunTruth() {
		judgedIds.clear();
		activeIds.clear();
		judgements.length = 0;
		shadowJudgements.length = 0;
		shadowConsumed.clear();
		consumedActions.clear();
		consumedGuardPunchWindows.clear();
		partitions.clear();
		timelinePositionMs = 0;
		countdownTimelinePositionMs = 0;
		latestEvidence = null;
		lastEvidenceFrameId = null;
		lastInput = null;
		countdown = inactiveCountdown(timestampMs);
	}
	/** @param {DataRecord} event */
	function shouldPreserveEvent(event) {
		return Number(event.centerTimestampMs) <= timelinePositionMs || judgedIds.has(String(event.eventId)) || activeIds.has(String(event.eventId));
	}
	/** @param {DataRecord} event @returns {DataRecord} */
	function truthForEvent(event) {
		const truth = eventTruth.get(event);
		if (!truth) throw gameplayError("event_truth_missing", "Gameplay events require immutable content-generation truth");
		return truth;
	}
	/** @param {DataRecord} event @returns {DataRecord} */
	function variantForEvent(event) {
		return truthForEvent(event).variant;
	}
	/** @param {DataRecord} event @returns {DataRecord} */
	function profileForEvent(event) {
		return truthForEvent(event).profileIdentity;
	}
	/** @param {DataRecord} event @returns {DataRecord} */
	function scoringSettingsForEvent(event) {
		return truthForEvent(event).scoringSettings;
	}
	function assertOpen() {
		if (destroyed) throw gameplayError("service_destroyed", "Gameplay coordinator is destroyed");
	}
	function assertConfigured() {
		assertOpen();
		if (!variant || packageId === null) throw gameplayError("content_not_configured", "Gameplay content is not configured");
	}
	/** @param {number} value */
	function advanceTimestamp(value) {
		const next = requireNonNegativeNumber(value, "timestamp_invalid");
		if (next < timestampMs) throw gameplayError("timestamp_rollback", "Gameplay timestamps must not roll back");
		timestampMs = next;
	}
}
/** @param {readonly DataRecord[]} sourceEvents @param {string} contentPackageId @param {number} generation @param {DataRecord} sourceVariant @param {DataRecord} sourceProfile @param {DataRecord} sourceScoringSettings */
function bindEventTruth(sourceEvents, contentPackageId, generation, sourceVariant, sourceProfile, sourceScoringSettings) {
	const result = /* @__PURE__ */ new WeakMap();
	const truth = makeEventTruth(contentPackageId, generation, sourceVariant, sourceProfile, sourceScoringSettings);
	for (const event of sourceEvents) result.set(event, truth);
	return result;
}
/** @param {string} contentPackageId @param {number} generation @param {DataRecord} sourceVariant @param {DataRecord} sourceProfile @param {DataRecord} sourceScoringSettings */
function makeEventTruth(contentPackageId, generation, sourceVariant, sourceProfile, sourceScoringSettings) {
	return Object.freeze({
		contentPackageId,
		contentGeneration: generation,
		variant: sourceVariant,
		profileIdentity: sourceProfile,
		scoringSettings: sourceScoringSettings
	});
}
/** @param {GameplayCoordinatorOptions} options */
function normalizeOptions(options) {
	if (!isPlainRecord$3(options)) throw gameplayError("gameplay_options_invalid", "Gameplay options must be a plain record");
	const keys = Reflect.ownKeys(options);
	if (keys.some((key) => typeof key !== "string" || ![
		"sessionId",
		"instanceId",
		"countdownStepMs",
		"onListenerError"
	].includes(key))) throw gameplayError("gameplay_options_invalid", "Gameplay options contain unknown or symbolic fields");
	/** @type {Record<string, unknown>} */
	const values = {};
	for (const keyValue of keys) {
		const key = keyValue;
		const descriptor = Object.getOwnPropertyDescriptor(options, key);
		if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw gameplayError("gameplay_options_invalid", "Gameplay options cannot contain accessors or hidden fields");
		values[key] = descriptor.value;
	}
	const callback = values.onListenerError;
	if (callback !== void 0 && typeof callback !== "function") throw gameplayError("gameplay_options_invalid", "Listener error hook must be a function");
	return Object.freeze({
		sessionId: values.sessionId === void 0 ? `session-${randomToken()}` : requireString$1(values.sessionId, "session_id_invalid"),
		instanceId: values.instanceId === void 0 ? null : requireString$1(values.instanceId, "instance_id_invalid"),
		countdownStepMs: values.countdownStepMs === void 0 ? 1e3 : positiveNumber(values.countdownStepMs, "countdown_step_invalid"),
		onListenerError: callback
	});
}
/** @param {unknown} value @returns {{positionMs: number, playing: boolean}} */
function normalizeClock(value) {
	const record = requireDataRecordFields(value, "audio_clock_invalid", [
		"contextTimeSeconds",
		"positionSeconds",
		"durationSeconds",
		"progress",
		"playing"
	]);
	const positionSeconds = requireNonNegativeNumber(record.positionSeconds, "audio_clock_invalid");
	if (record.contextTimeSeconds !== void 0) requireNonNegativeNumber(record.contextTimeSeconds, "audio_clock_invalid");
	if (record.durationSeconds !== void 0) requireNonNegativeNumber(record.durationSeconds, "audio_clock_invalid");
	if (record.progress !== void 0 && (typeof record.progress !== "number" || !Number.isFinite(record.progress) || record.progress < 0 || record.progress > 1)) throw gameplayError("audio_clock_invalid", "Audio clock progress must be normalized");
	if (typeof record.playing !== "boolean") throw gameplayError("audio_clock_invalid", "Audio clock playing must be boolean");
	const positionMs = positionSeconds * 1e3;
	if (!Number.isSafeInteger(positionMs) && (!Number.isFinite(positionMs) || positionMs > Number.MAX_SAFE_INTEGER)) throw gameplayError("audio_clock_invalid", "Audio clock position exceeds safe gameplay range");
	return Object.freeze({
		positionMs,
		playing: record.playing
	});
}
/** @param {unknown} value @returns {DataRecord} */
function normalizeLeaseSnapshot(value) {
	const copy = cloneGameplayData(value, "media_lease_invalid");
	if (!isMediaLeaseSnapshot(copy)) throw gameplayError("media_lease_invalid", "Media lease snapshot does not satisfy the public contract");
	return copy;
}
/** @param {unknown} value @returns {DataRecord} */
function normalizeVariant(value) {
	const record = requireRecord$3(value, "variant_invalid");
	const rulesetId = requireString$1(record.rulesetId, "ruleset_invalid");
	if (!rulesetIds.includes(rulesetId)) throw gameplayError("ruleset_invalid", "Variant ruleset is unsupported");
	const mode = record.mode === "flow" ? "flow" : record.mode === "boxing" ? "boxing" : (() => {
		throw gameplayError("mode_invalid", "Variant mode is unsupported");
	})();
	const recipeId = record.recipeId === null ? null : requireString$1(record.recipeId, "recipe_invalid");
	if (mode === "flow" && (rulesetId !== "flow_grid_v1" || recipeId !== null)) throw gameplayError("variant_identity_invalid", "Flow variants require the Flow ruleset and no conversion recipe");
	if (mode === "boxing" && (rulesetId === "flow_grid_v1" || recipeId === null || !conversionRecipeIds.includes(recipeId))) throw gameplayError("variant_identity_invalid", "Boxing variants require a supported Boxing ruleset and conversion recipe");
	const modifierIds = requireStringArray(record.modifierIds ?? [], "modifier_ids_invalid", 32);
	if (new Set(modifierIds).size !== modifierIds.length || [...modifierIds].sort(compareCodePoints$2).some((entry, index) => entry !== modifierIds[index]) || modifierIds.some((entry) => !SUPPORTED_MODIFIERS.includes(entry))) throw gameplayError("modifier_ids_invalid", "Modifier identity must be supported, sorted and unique");
	if (typeof record.ranked !== "boolean") throw gameplayError("variant_rank_invalid", "Variant ranked identity must be boolean");
	const provenance = record.provenance === void 0 ? null : cloneGameplayData(record.provenance);
	if (isPlainRecord$3(provenance) && provenance.kind === "composite" && record.ranked) throw gameplayError("variant_rank_invalid", "Runtime composite variants must be unranked");
	const mapHash = cloneGameplayData(record.mapHash, "map_hash_invalid");
	const scoreIdentityHash = cloneGameplayData(record.scoreIdentityHash, "score_identity_hash_invalid");
	if (!isContentHash(mapHash) || !isContentHash(scoreIdentityHash)) throw gameplayError("variant_hash_invalid", "Variant map and score identity hashes must satisfy the public content contract");
	return Object.freeze({
		variantId: requireString$1(record.variantId, "variant_id_invalid"),
		chartId: requireString$1(record.chartId, "chart_id_invalid"),
		mode,
		rulesetId,
		recipeId,
		modifierIds,
		ranked: record.ranked === true,
		mapHash,
		scoreIdentityHash,
		provenance
	});
}
/** @param {unknown} value @param {DataRecord} selectedVariant @returns {readonly DataRecord[]} */
function normalizeEvents(value, selectedVariant) {
	if (!Array.isArray(value) || value.length > 1e5) throw gameplayError("content_events_invalid", "Resolved events must be a bounded array");
	const ids = /* @__PURE__ */ new Set();
	const lineageOwners = /* @__PURE__ */ new Set();
	const result = value.map((entry) => {
		const envelope = requireRecord$3(entry, "content_event_invalid");
		const authoredBeat = envelope.authoredBeat === void 0 ? null : requireRecord$3(envelope.authoredBeat, "authored_beat_invalid");
		const eventId = requireString$1(envelope.eventId, "event_id_invalid");
		if (ids.has(eventId)) throw gameplayError("event_id_duplicate", "Resolved event IDs must be unique");
		ids.add(eventId);
		if (authoredBeat?.eventId !== void 0 && authoredBeat.eventId !== eventId) throw gameplayError("event_id_mismatch", "Resolved and authored event IDs must agree");
		const centerTimestampMs = requireNonNegativeNumber(envelope.centerTimestampMs, "event_timestamp_invalid");
		const variantId = envelope.variantId === void 0 ? selectedVariant.variantId : requireString$1(envelope.variantId, "variant_id_invalid");
		const chartId = envelope.chartId === void 0 ? selectedVariant.chartId : requireString$1(envelope.chartId, "chart_id_invalid");
		if (variantId !== selectedVariant.variantId || chartId !== selectedVariant.chartId) throw gameplayError("event_variant_mismatch", "Resolved events must belong to the selected variant and chart");
		const event = Object.freeze({
			...envelope,
			...authoredBeat ?? {},
			authoredBeat,
			eventId,
			centerTimestampMs,
			variantId,
			chartId
		});
		validateEventForVariant(event, selectedVariant);
		for (const sourceId of lineageIds(event)) {
			if (lineageOwners.has(sourceId)) throw gameplayError("event_lineage_invalid", "Source lineage IDs must have one event owner");
			lineageOwners.add(sourceId);
		}
		return event;
	});
	result.sort(eventOrder);
	return Object.freeze(result);
}
/** @param {DataRecord} event @param {DataRecord} selectedVariant */
function validateEventForVariant(event, selectedVariant) {
	const type = requireString$1(event.type, "event_type_invalid");
	if (selectedVariant.mode === "flow") {
		if (![
			"note",
			"bomb",
			"obstacle",
			"arc",
			"burst"
		].includes(type)) throw gameplayError("event_type_invalid", "Flow event type is unsupported");
		if (type === "note") {
			if (event.hand !== "left" && event.hand !== "right") throw gameplayError("event_hand_invalid", "Flow notes require a hand");
			requireGridCell(event.placement, "event_placement_invalid");
			if (event.direction !== void 0 && flowDirectionName(event.direction) === null) throw gameplayError("event_direction_invalid", "Flow note direction is unsupported");
		}
	} else {
		const action = expectedAction(event);
		if (![...PUNCH_ACTIONS, ...CHECKPOINT_ACTIONS].includes(action)) throw gameplayError("event_type_invalid", "Boxing event type is unsupported");
		if (selectedVariant.rulesetId === "boxing_spatial_grid_v1") {
			if (PUNCH_ACTIONS.includes(action)) {
				const target = requireRecord$3(event.spatialTarget, "spatial_target_invalid");
				requireGridCell(target.targetCell, "spatial_target_invalid");
				if (!Array.isArray(target.acceptedSubcells) || target.acceptedSubcells.length > 48 || target.acceptedSubcells.some((entry) => !Number.isInteger(entry) || entry < 0 || entry > 47)) throw gameplayError("spatial_target_invalid", "Spatial accepted subcells are invalid");
				if (target.sourceCell !== void 0) requireGridCell(target.sourceCell, "spatial_target_invalid");
				if (target.entryDirection !== void 0 && cardinalDirectionName(target.entryDirection) === null) throw gameplayError("spatial_target_invalid", "Spatial entry direction is invalid");
			} else if (action === "guard" || action === "crossed_guard") {
				const target = requireRecord$3(event.guardTarget, "guard_target_invalid");
				requireGridCell(target.leftCell, "guard_target_invalid");
				requireGridCell(target.rightCell, "guard_target_invalid");
			} else {
				const checkpoint = requireRecord$3(event.checkpoint, "checkpoint_invalid");
				if (!Array.isArray(checkpoint.noseSafeCells) || checkpoint.noseSafeCells.length > 12 || checkpoint.noseSafeCells.some((entry) => !Number.isInteger(entry) || entry < 0 || entry > 11)) throw gameplayError("checkpoint_invalid", "Checkpoint nose-safe cells are invalid");
			}
		}
	}
	if (event.sourceEventIds !== void 0) {
		const sourceIds = requireStringArray(event.sourceEventIds, "event_lineage_invalid", 256);
		if (new Set(sourceIds).size !== sourceIds.length) throw gameplayError("event_lineage_invalid", "Event lineage IDs must be unique");
	}
}
/** @param {unknown} value @returns {DataRecord} */
function normalizeProfile$1(value) {
	const record = requireRecord$3(value, "profile_identity_invalid");
	if (!isPrototypeTuningIdentity(record) || record.class !== "between_run_ruleset") throw gameplayError("profile_identity_invalid", "Profile identity does not satisfy the gameplay tuning contract for a between-run ruleset");
	return record;
}
/** @param {unknown} value @returns {DataRecord} */
function normalizeScoringSettings(value) {
	const record = requireDataRecordFields(value, "scoring_settings_invalid", [
		"comboBonusPerHit",
		"hitPoints",
		"missPenalty"
	]);
	if (Reflect.ownKeys(record).length !== 3) throw gameplayError("scoring_settings_invalid", "Scoring settings require every exact field");
	return Object.freeze({
		comboBonusPerHit: boundedScoreNumber(record.comboBonusPerHit),
		hitPoints: boundedScoreNumber(record.hitPoints),
		missPenalty: boundedScoreNumber(record.missPenalty)
	});
}
/** @param {unknown} value */
function boundedScoreNumber(value) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) throw gameplayError("scoring_settings_invalid", "Scoring settings must be finite values from 0 through 100");
	return Object.is(value, -0) ? 0 : value;
}
/** @param {unknown} value @returns {readonly DataRecord[]} */
function normalizeShadowVariants(value) {
	if (!Array.isArray(value) || value.length > 4) throw gameplayError("shadow_variants_invalid", "Shadow variants must be a bounded array");
	return Object.freeze(value.map((entry) => {
		const record = requireRecord$3(entry, "shadow_variant_invalid");
		const normalized = normalizeVariant(record);
		const resolvedEvents = normalizeEvents(record.resolvedEvents ?? [], normalized);
		return Object.freeze({
			...normalized,
			resolvedEvents
		});
	}));
}
/** @param {unknown} value @returns {readonly DataRecord[]} */
function normalizeStraightQualifications(value) {
	const entries = cloneGameplayData(value, "straight_qualifications_invalid", 64);
	if (!Array.isArray(entries) || entries.length > 2) throw gameplayError("straight_qualifications_invalid", "Straight qualifications must be a bounded array");
	const hands = /* @__PURE__ */ new Set();
	return Object.freeze(entries.map((entryValue) => {
		const entry = requireRecord$3(entryValue, "straight_qualification_invalid");
		const hand = entry.hand === "left" || entry.hand === "right" ? entry.hand : (() => {
			throw gameplayError("straight_qualification_invalid", "Straight qualification hand is invalid");
		})();
		if (hands.has(hand)) throw gameplayError("straight_qualification_invalid", "Straight qualification hands must be unique");
		hands.add(hand);
		if (typeof entry.semanticQualified !== "boolean" || typeof entry.spatialQualified !== "boolean") throw gameplayError("straight_qualification_invalid", "Straight qualification flags must be boolean");
		const semanticStartTimestampMs = entry.semanticStartTimestampMs === null ? null : requireNonNegativeNumber(entry.semanticStartTimestampMs, "straight_qualification_invalid");
		const spatialStartTimestampMs = entry.spatialStartTimestampMs === null ? null : requireNonNegativeNumber(entry.spatialStartTimestampMs, "straight_qualification_invalid");
		const semanticDurationMs = requireNonNegativeNumber(entry.semanticDurationMs, "straight_qualification_invalid");
		const spatialDurationMs = requireNonNegativeNumber(entry.spatialDurationMs, "straight_qualification_invalid");
		if (entry.semanticQualified && semanticStartTimestampMs === null || entry.spatialQualified && spatialStartTimestampMs === null) throw gameplayError("straight_qualification_invalid", "Qualified straight evidence requires a measured start timestamp");
		if (!Array.isArray(entry.acceptedSubcellColumns) || entry.acceptedSubcellColumns.length > 8 || entry.acceptedSubcellColumns.some((column) => !Number.isInteger(column) || column < 0 || column > 7) || new Set(entry.acceptedSubcellColumns).size !== entry.acceptedSubcellColumns.length) throw gameplayError("straight_qualification_invalid", "Accepted subcell columns are invalid");
		return Object.freeze({
			hand,
			semanticStartTimestampMs,
			semanticDurationMs,
			semanticQualified: entry.semanticQualified,
			spatialStartTimestampMs,
			spatialDurationMs,
			spatialQualified: entry.spatialQualified,
			acceptedSubcellColumns: Object.freeze([...entry.acceptedSubcellColumns])
		});
	}));
}
/** @param {AeroGameplayEvidenceSnapshot} evidence */
function validateEvidenceIdentity(evidence) {
	if (new Set(evidence.activeBoxingActions).size !== evidence.activeBoxingActions.length) throw gameplayError("input_evidence_invalid", "Active Boxing action IDs must be unique");
	const anchorIds = evidence.anchors.map((anchor) => anchor.anchor);
	if (new Set(anchorIds).size !== anchorIds.length) throw gameplayError("input_evidence_invalid", "Measured anchor IDs must be unique");
	const entryIds = evidence.entries.map((entry) => entry.anchor);
	if (new Set(entryIds).size !== entryIds.length) throw gameplayError("input_evidence_invalid", "Measured entry anchor IDs must be unique");
}
/** @param {DataRecord} event @param {DataRecord | null} selectedVariant @param {AeroGameplayEvidenceSnapshot} evidence @param {DataRecord | null} input */
function matchEvent(event, selectedVariant, evidence, input) {
	const diagnostics = [];
	const rulesetId = String(selectedVariant?.rulesetId ?? "flow_grid_v1");
	if (rulesetId === "flow_grid_v1") return matchFlow(event, evidence);
	const action = expectedAction(event);
	if (!evidence.activeBoxingActions.includes(action)) diagnostics.push("no_input");
	if (action.startsWith("straight_") && rulesetId === "boxing_semantic_track_v1") {
		const hand = action.endsWith("_right") ? "right" : "left";
		const qualification = (Array.isArray(input?.straightQualifications) ? input.straightQualifications : []).find((entry) => isPlainRecord$3(entry) && entry.hand === hand);
		const start = isPlainRecord$3(qualification) && typeof qualification.semanticStartTimestampMs === "number" ? qualification.semanticStartTimestampMs : null;
		if (!(isPlainRecord$3(qualification) && qualification.semanticQualified === true && start !== null && evidence.measurementTimestampMs - start >= prototypeJudgementDefaults.straightQualificationMs)) diagnostics.push("qualification_too_short");
	}
	if (rulesetId === "boxing_spatial_grid_v1") matchSpatial(event, action, evidence, input, diagnostics);
	return Object.freeze({
		hit: diagnostics.length === 0,
		diagnostics: Object.freeze(diagnostics)
	});
}
/** @param {DataRecord} event @param {AeroGameplayEvidenceSnapshot} evidence */
function matchFlow(event, evidence) {
	const anchorName = `${event.hand === "right" ? "right" : "left"}_wrist`;
	const anchor = evidence.anchors.find((entry) => entry.anchor === anchorName);
	const diagnostics = [];
	const placement = requireGridCell(event.placement, "event_placement_invalid");
	if (!anchor || anchor.cell !== placement) diagnostics.push("wrong_cell");
	const entry = evidence.entries.find((candidate) => candidate.anchor === anchorName && candidate.toCell === placement);
	if (event.direction === void 0) {
		if (!entry) diagnostics.push("no_input");
	} else {
		const direction = flowDirectionName(event.direction);
		if (!entry || direction === null || entry.direction !== direction) diagnostics.push("wrong_direction");
	}
	return Object.freeze({
		hit: diagnostics.length === 0,
		diagnostics: Object.freeze(diagnostics)
	});
}
/** @param {DataRecord} event @param {string} action @param {AeroGameplayEvidenceSnapshot} evidence @param {DataRecord | null} input @param {string[]} diagnostics */
function matchSpatial(event, action, evidence, input, diagnostics) {
	if (PUNCH_ACTIONS.includes(action)) {
		const hand = action.endsWith("_right") ? "right" : "left";
		const anchor = evidence.anchors.find((entry) => entry.anchor === `${hand}_wrist`);
		const target = isPlainRecord$3(event.spatialTarget) ? event.spatialTarget : null;
		if (!anchor || !target) {
			diagnostics.push("wrong_cell");
			return;
		}
		const accepted = Array.isArray(target.acceptedSubcells) ? target.acceptedSubcells : [];
		const targetCell = requireGridCell(target.targetCell, "spatial_target_invalid");
		if (accepted.length > 0 && !accepted.includes(anchor.subcell)) diagnostics.push("wrong_subcell");
		else if (anchor.cell !== targetCell) diagnostics.push("wrong_cell");
		if (target.entryDirection !== void 0) {
			const sourceCell = target.sourceCell === void 0 ? null : requireGridCell(target.sourceCell, "spatial_target_invalid");
			const direction = cardinalDirectionName(target.entryDirection);
			if (!evidence.entries.some((entry) => entry.anchor === `${hand}_wrist` && entry.toCell === targetCell && (sourceCell === null || entry.fromCell === sourceCell) && entry.direction === direction)) diagnostics.push("wrong_direction");
		}
		if (action.startsWith("straight_")) {
			const qualification = (Array.isArray(input?.straightQualifications) ? input.straightQualifications : []).find((entry) => isPlainRecord$3(entry) && entry.hand === hand);
			const start = isPlainRecord$3(qualification) && typeof qualification.spatialStartTimestampMs === "number" ? qualification.spatialStartTimestampMs : null;
			if (!(isPlainRecord$3(qualification) && qualification.spatialQualified === true && start !== null && evidence.measurementTimestampMs - start >= prototypeJudgementDefaults.straightQualificationMs)) diagnostics.push("qualification_too_short");
		}
	} else if (action === "guard" || action === "crossed_guard") {
		const target = isPlainRecord$3(event.guardTarget) ? event.guardTarget : null;
		const left = evidence.anchors.find((entry) => entry.anchor === "left_wrist");
		const right = evidence.anchors.find((entry) => entry.anchor === "right_wrist");
		if (!target || !left || !right || left.cell !== target.leftCell || right.cell !== target.rightCell) diagnostics.push("wrong_cell");
		if (target?.crossed === true && !evidence.activeBoxingActions.includes("crossed_guard")) diagnostics.push("no_input");
	} else if (CHECKPOINT_ACTIONS.includes(action) && isPlainRecord$3(event.checkpoint) && Array.isArray(event.checkpoint.noseSafeCells)) {
		const nose = evidence.anchors.find((entry) => entry.anchor === "nose");
		if (!nose || !event.checkpoint.noseSafeCells.includes(nose.cell)) diagnostics.push("wrong_cell");
	}
}
/** @param {DataRecord} event @param {DataRecord | null} selectedVariant @param {"hit" | "miss" | "ignored"} result @param {readonly string[]} diagnostics @param {AeroGameplayEvidenceSnapshot | null} evidence @param {number | null} evidenceTimelineMs @param {DataRecord} profile @param {boolean} shadow @returns {AeroGameplayJudgement} */
function makeJudgement(event, selectedVariant, result, diagnostics, evidence, evidenceTimelineMs, profile, shadow) {
	const rulesetId = selectedVariant?.rulesetId ?? "flow_grid_v1";
	const recipeId = selectedVariant?.recipeId ?? null;
	const center = Number(event.centerTimestampMs);
	return Object.freeze({
		schema: "aerobeat/gameplay_judgement",
		version: 1,
		eventId: String(event.eventId),
		rulesetId,
		recipeId,
		result,
		beatCenterTimestampMs: center,
		evidenceTimestampMs: evidence ? evidence.measurementTimestampMs : null,
		timingOffsetMs: evidenceTimelineMs === null ? null : evidenceTimelineMs - center,
		diagnostics: Object.freeze([...diagnostics]),
		shadow,
		variantId: selectedVariant?.variantId ?? null,
		chartId: selectedVariant?.chartId ?? null,
		sourceEventIds: Object.freeze([...lineageIds(event)]),
		mapHash: selectedVariant?.mapHash ?? null,
		scoreIdentityHash: selectedVariant?.scoreIdentityHash ?? null,
		profileId: profile.profileId,
		profileVersion: profile.profileVersion,
		profileHash: profile.contentHash
	});
}
/** @param {DataRecord} event */
function expectedAction(event) {
	if (event.type === "guard" && isPlainRecord$3(event.guardTarget) && event.guardTarget.crossed === true) return "crossed_guard";
	return typeof event.type === "string" ? event.type : "note";
}
/** @param {DataRecord} event */
function eventCategory(event) {
	const action = expectedAction(event);
	return PUNCH_ACTIONS.includes(action) ? "punch" : action === "guard" || action === "crossed_guard" ? "guard" : "checkpoint";
}
/** @param {DataRecord} event */
function lineageIds(event) {
	return Array.isArray(event.sourceEventIds) ? event.sourceEventIds.filter((entry) => typeof entry === "string") : [];
}
/** @param {DataRecord} left @param {DataRecord} right */
function eventOrder(left, right) {
	return Number(left.centerTimestampMs) - Number(right.centerTimestampMs) || compareCodePoints$2(String(left.eventId), String(right.eventId));
}
/** @param {unknown} value @param {string} code */
function positiveNumber(value, code) {
	const number = requireNonNegativeNumber(value, code);
	if (number <= 0) throw gameplayError(code, "Expected a positive number");
	return number;
}
function defaultProfileIdentity() {
	return Object.freeze({
		schema: "aerobeat/prototype_tuning_identity",
		version: 1,
		profileId: "aero.gameplay.prototype.default",
		profileVersion: "1",
		contentHash: "0".repeat(64),
		class: "between_run_ruleset",
		regenerationRequired: false
	});
}
function defaultScoringSettings() {
	return Object.freeze({
		comboBonusPerHit: 0,
		hitPoints: 1,
		missPenalty: 0
	});
}
/** @param {DataRecord} settings */
function scoreSettingsIdentity(settings) {
	return `scoring-v1:${JSON.stringify(settings.hitPoints)},${JSON.stringify(settings.missPenalty)},${JSON.stringify(settings.comboBonusPerHit)}`;
}
/** @param {number} value */
function finiteScore(value) {
	if (!Number.isFinite(value) || value < 0) throw gameplayError("score_value_invalid", "Score arithmetic must remain finite and non-negative");
	return Object.is(value, -0) ? 0 : value;
}
/** @param {DataRecord} variant @param {DataRecord} profile @param {DataRecord} settings */
function scorePartitionKey(variant, profile, settings) {
	const mapHash = isPlainRecord$3(variant.mapHash) && typeof variant.mapHash.value === "string" ? variant.mapHash.value : "unhashed";
	const scoreHash = isPlainRecord$3(variant.scoreIdentityHash) && typeof variant.scoreIdentityHash.value === "string" ? variant.scoreIdentityHash.value : "unhashed";
	return [
		variant.variantId,
		variant.chartId,
		variant.mode,
		variant.rulesetId,
		variant.recipeId ?? "none",
		[...variant.modifierIds].join(","),
		variant.ranked ? "ranked" : "unranked",
		mapHash,
		scoreHash,
		profile.profileId,
		profile.profileVersion,
		profile.contentHash,
		profile.class,
		profile.regenerationRequired ? "regenerate" : "live",
		scoreSettingsIdentity(settings)
	].join("|");
}
/** @param {DataRecord} variant */
function publicVariant$1(variant) {
	return Object.freeze({
		variantId: variant.variantId,
		chartId: variant.chartId,
		mode: variant.mode,
		rulesetId: variant.rulesetId,
		recipeId: variant.recipeId,
		modifierIds: variant.modifierIds,
		ranked: variant.ranked,
		mapHash: variant.mapHash,
		scoreIdentityHash: variant.scoreIdentityHash,
		provenance: variant.provenance
	});
}
/** @param {"three" | "two" | "one" | "complete" | "cancelled"} state @param {AeroCountdownReason | null} reason @param {number | null} value @param {number} timestampMs @param {string | null} calibrationId */
function countdownSnapshot(state, reason, value, timestampMs, calibrationId) {
	return Object.freeze({
		schema: "aerobeat/countdown_snapshot",
		version: 1,
		state,
		reason,
		value,
		timestampMs,
		gameplayTimeFrozen: state !== "complete",
		calibrationId
	});
}
/** @param {number} timestampMs */
function inactiveCountdown(timestampMs) {
	return Object.freeze({
		schema: "aerobeat/countdown_snapshot",
		version: 1,
		state: "inactive",
		reason: null,
		value: null,
		timestampMs,
		gameplayTimeFrozen: true,
		calibrationId: null
	});
}
/** @param {unknown} value */
function boundedReason(value) {
	return typeof value === "string" && value.length > 0 && value.length <= 128 ? value : "manual";
}
/** @type {readonly import("@aerobeat/web-contracts").AeroBodyGridDirection[]} */
var BEAT_SABER_FLOW_DIRECTIONS = Object.freeze([
	"up",
	"down",
	"left",
	"right",
	"up-left",
	"up-right",
	"down-left",
	"down-right"
]);
/** @type {readonly ("up" | "down" | "left" | "right")[]} */
var CARDINAL_DIRECTIONS = Object.freeze([
	"up",
	"down",
	"left",
	"right"
]);
/** @param {unknown} value @returns {import("@aerobeat/web-contracts").AeroBodyGridDirection | null} */
function flowDirectionName(value) {
	if (Number.isInteger(value) && Number(value) >= 0 && Number(value) < BEAT_SABER_FLOW_DIRECTIONS.length) return BEAT_SABER_FLOW_DIRECTIONS[Number(value)] ?? null;
	return typeof value === "string" && bodyGridDirections.includes(value) ? value : null;
}
/** @param {unknown} value @returns {"up" | "down" | "left" | "right" | null} */
function cardinalDirectionName(value) {
	if (Number.isInteger(value) && Number(value) >= 0 && Number(value) < CARDINAL_DIRECTIONS.length) return CARDINAL_DIRECTIONS[Number(value)] ?? null;
	return typeof value === "string" && CARDINAL_DIRECTIONS.includes(value) ? value : null;
}
/** @param {unknown} value @param {string} code */
function requireGridCell(value, code) {
	if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 11) throw gameplayError(code, "Expected a 4x3 grid cell");
	return Number(value);
}
function randomToken() {
	const bytes = /* @__PURE__ */ new Uint32Array(2);
	if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
	else {
		bytes[0] = Math.floor(Math.random() * 4294967295);
		bytes[1] = Math.floor(Math.random() * 4294967295);
	}
	return `${bytes[0].toString(16)}${bytes[1].toString(16)}`;
}
//#endregion
//#region ../aerobeat-web-gameplay/src/prototype-profile-registry.js
var PROFILE_SCHEMA = "aerobeat/prototype_profile";
var BUNDLE_SCHEMA = "aerobeat/prototype_profile_bundle";
var SNAPSHOT_SCHEMA = "aerobeat/prototype_profile_registry_snapshot";
var PROFILE_CLASSES = Object.freeze([
	"live_visual",
	"between_run_ruleset",
	"converter_regeneration"
]);
var DEFAULT_IDS = Object.freeze({
	live_visual: "aero.visual.default",
	between_run_ruleset: "aero.scoring.locked",
	converter_regeneration: "aero.converter.canonical"
});
var SCORING_SAFE_STATES = Object.freeze([
	"idle",
	"calibrating",
	"paused_manual",
	"paused_tracking",
	"completed",
	"stopped"
]);
/** @typedef {Readonly<Record<string, unknown>>} DataRecord */
var DEFAULT_DEFINITIONS = Object.freeze([
	Object.freeze({
		profileId: "aero.visual.default",
		profileVersion: "1.0.0",
		class: "live_visual",
		label: "Default Visual (Experimental)",
		settings: Object.freeze({
			motionIntensity: 1,
			roleScale: 1
		})
	}),
	Object.freeze({
		profileId: "aero.visual.compact",
		profileVersion: "1.0.0",
		class: "live_visual",
		label: "Compact Visual (Experimental)",
		settings: Object.freeze({
			motionIntensity: .8,
			roleScale: .86
		})
	}),
	Object.freeze({
		profileId: "aero.scoring.locked",
		profileVersion: "1.0.0",
		class: "between_run_ruleset",
		label: "Locked Scoring (Experimental)",
		settings: Object.freeze({
			comboBonusPerHit: 0,
			hitPoints: 1,
			missPenalty: 0
		})
	}),
	Object.freeze({
		profileId: "aero.scoring.prototype-wide",
		profileVersion: "1.0.0",
		class: "between_run_ruleset",
		label: "Prototype Wide Scoring (Experimental)",
		settings: Object.freeze({
			comboBonusPerHit: .05,
			hitPoints: 1.25,
			missPenalty: 0
		})
	}),
	Object.freeze({
		profileId: "aero.converter.canonical",
		profileVersion: "1.0.0",
		class: "converter_regeneration",
		label: "Canonical Converter (Experimental)",
		settings: Object.freeze({
			guardRelocationRadius: 1,
			reachAllowanceSubcells: 0
		})
	}),
	Object.freeze({
		profileId: "aero.converter.prototype-reach",
		profileVersion: "1.0.0",
		class: "converter_regeneration",
		label: "Prototype Reach Converter (Experimental)",
		settings: Object.freeze({
			guardRelocationRadius: 2,
			reachAllowanceSubcells: 1
		})
	})
]);
/**
* Per-game prototype profile authority. Profiles are experimental identities,
* never a production winner selection.
*
* @param {{defaults?:readonly unknown[],bundleVersion?:string,onListenerError?:(error:unknown)=>void}} [options]
*/
function createAeroPrototypeProfileRegistry(options = {}) {
	const safeOptions = requireDataRecordFields(options, "profile_registry_options_invalid", [
		"defaults",
		"bundleVersion",
		"onListenerError"
	]);
	const listenerError = safeOptions.onListenerError;
	if (listenerError !== void 0 && typeof listenerError !== "function") throw gameplayError("profile_registry_options_invalid", "Listener error handler must be a function");
	const bundleVersion = safeOptions.bundleVersion === void 0 ? "1.0.0" : requireString$1(safeOptions.bundleVersion, "profile_bundle_version_invalid");
	const defaults = materializeDefaultProfileList(safeOptions.defaults ?? DEFAULT_DEFINITIONS, "profile_defaults_invalid");
	assertRequiredDefaults(defaults);
	let profiles = mapProfiles(defaults);
	let activeIds = Object.freeze({ ...DEFAULT_IDS });
	let appliedConverterHash = String(profiles.get(DEFAULT_IDS.converter_regeneration)?.contentHash ?? "");
	let generation = 0;
	let destroyed = false;
	const listeners = /* @__PURE__ */ new Set();
	let snapshot = makeSnapshot();
	return Object.freeze({
		list,
		getActive,
		select,
		importProfiles,
		exportProfiles,
		reset,
		getSnapshot: () => snapshot,
		subscribe,
		destroy
	});
	function list() {
		assertOpen();
		return Object.freeze([...profiles.values()].sort(profileOrder));
	}
	/** @param {"live_visual"|"between_run_ruleset"|"converter_regeneration"} profileClass */
	function getActive(profileClass) {
		assertOpen();
		return activeState(requireProfileClass(profileClass));
	}
	/**
	* @param {string} profileId
	* @param {{sessionState?:string,regeneratedPackageProfileHash?:string}} [context]
	*/
	function select(profileId, context = {}) {
		assertOpen();
		const id = requireString$1(profileId, "profile_id_invalid");
		const profile = profiles.get(id);
		if (!profile) throw gameplayError("profile_not_found", "Prototype profile is not registered");
		const safeContext = requireDataRecordFields(context, "profile_selection_context_invalid", ["sessionState", "regeneratedPackageProfileHash"]);
		if (profile.class === "between_run_ruleset") {
			const sessionState = requireString$1(safeContext.sessionState, "profile_session_state_required");
			if (!SCORING_SAFE_STATES.includes(sessionState)) throw gameplayError("profile_change_requires_pause", "Scoring profiles change only while idle, paused, or between runs");
		}
		const regeneratedHash = safeContext.regeneratedPackageProfileHash;
		if (regeneratedHash !== void 0) {
			const normalizedHash = requireHash$1(regeneratedHash, "profile_provenance_hash_invalid");
			if (profile.class !== "converter_regeneration" || normalizedHash !== profile.contentHash) throw gameplayError("profile_provenance_hash_mismatch", "Regenerated package provenance must match the selected converter profile");
			appliedConverterHash = normalizedHash;
		}
		activeIds = Object.freeze({
			...activeIds,
			[profile.class]: id
		});
		generation += 1;
		publish();
		return activeState(profile.class);
	}
	/** @param {unknown} bundle @param {{sessionState?:string}} [context] */
	function importProfiles(bundle, context = {}) {
		assertOpen();
		const safeContext = requireDataRecordFields(context, "profile_import_context_invalid", ["sessionState"]);
		const normalized = normalizeBundle(bundle);
		if (normalized.bundleVersion !== bundleVersion) throw gameplayError("profile_bundle_version_incompatible", "Imported profile bundle version must match the registry bundle version");
		const nextProfiles = mapProfiles(normalized.profiles);
		assertRequiredDefaults(nextProfiles.values());
		for (const activeId of Object.values(activeIds)) if (!nextProfiles.has(activeId)) throw gameplayError("profile_bundle_active_missing", "Imported bundle must contain every active profile");
		const currentScoring = profiles.get(activeIds.between_run_ruleset);
		const nextScoring = nextProfiles.get(activeIds.between_run_ruleset);
		if (currentScoring?.contentHash !== nextScoring?.contentHash) {
			const sessionState = requireString$1(safeContext.sessionState, "profile_session_state_required");
			if (!SCORING_SAFE_STATES.includes(sessionState)) throw gameplayError("profile_change_requires_pause", "An imported active scoring profile changes only while idle, paused, or between runs");
		}
		profiles = nextProfiles;
		generation += 1;
		publish();
		return snapshot;
	}
	function exportProfiles() {
		assertOpen();
		const exportedProfiles = Object.freeze([...profiles.values()].sort(profileOrder));
		const body = Object.freeze({
			schema: BUNDLE_SCHEMA,
			version: 1,
			bundleVersion,
			profiles: exportedProfiles
		});
		return Object.freeze({
			...body,
			bundleHash: `sha256:${sha256Hex$2(canonicalJson$2(body))}`
		});
	}
	function reset() {
		assertOpen();
		profiles = mapProfiles(defaults);
		activeIds = Object.freeze({ ...DEFAULT_IDS });
		appliedConverterHash = String(profiles.get(DEFAULT_IDS.converter_regeneration)?.contentHash ?? "");
		generation += 1;
		publish();
		return snapshot;
	}
	/** @param {(value:DataRecord)=>void} listener */
	function subscribe(listener) {
		assertOpen();
		if (typeof listener !== "function") throw gameplayError("profile_listener_invalid", "Profile listener must be a function");
		listeners.add(listener);
		notify(listener);
		return () => listeners.delete(listener);
	}
	function destroy() {
		if (destroyed) return;
		destroyed = true;
		generation += 1;
		snapshot = makeSnapshot();
		listeners.clear();
	}
	function assertOpen() {
		if (destroyed) throw gameplayError("profile_registry_destroyed", "Prototype profile registry is destroyed");
	}
	function publish() {
		snapshot = makeSnapshot();
		for (const listener of listeners) notify(listener);
	}
	/** @param {(value:DataRecord)=>void} listener */
	function notify(listener) {
		try {
			listener(snapshot);
		} catch (error) {
			try {
				if (typeof listenerError === "function") listenerError(error);
			} catch {}
		}
	}
	function makeSnapshot() {
		const converter = profiles.get(activeIds.converter_regeneration);
		const selectedConverterHash = String(converter?.contentHash ?? "");
		return Object.freeze({
			schema: SNAPSHOT_SCHEMA,
			version: 1,
			generation,
			destroyed,
			bundleVersion,
			profiles: Object.freeze([...profiles.values()].sort(profileOrder)),
			active: Object.freeze({
				visual: activeState("live_visual"),
				scoring: activeState("between_run_ruleset"),
				converter: activeState("converter_regeneration")
			}),
			appliedConverterHash,
			pendingConverterHash: selectedConverterHash === appliedConverterHash ? null : selectedConverterHash,
			regenerationRequired: selectedConverterHash !== appliedConverterHash,
			experimental: true
		});
	}
	/** @param {"live_visual"|"between_run_ruleset"|"converter_regeneration"} profileClass */
	function activeState(profileClass) {
		const profile = profiles.get(activeIds[profileClass]);
		if (!profile) throw gameplayError("profile_active_missing", "Active profile is not registered");
		const regenerationRequired = profileClass === "converter_regeneration" && profile.contentHash !== appliedConverterHash;
		return Object.freeze({
			profile,
			identity: tuningIdentity$1(profile, regenerationRequired),
			settings: profile.settings,
			regenerationRequired,
			appliedContentHash: profileClass === "converter_regeneration" ? appliedConverterHash : profile.contentHash
		});
	}
}
/** @param {Iterable<DataRecord>} entries */
function mapProfiles(entries) {
	const result = /* @__PURE__ */ new Map();
	for (const profile of entries) {
		if (result.has(String(profile.profileId))) throw gameplayError("profile_id_duplicate", "Profile IDs must be unique");
		result.set(String(profile.profileId), profile);
	}
	return result;
}
/** @param {Iterable<DataRecord>} entries */
function assertRequiredDefaults(entries) {
	const profiles = [...entries];
	const byClass = new Set(profiles.map((entry) => entry.class));
	for (const profileClass of PROFILE_CLASSES) if (!byClass.has(profileClass)) throw gameplayError("profile_default_missing", `Profile class ${profileClass} requires at least one profile`);
	for (const id of Object.values(DEFAULT_IDS)) if (!profiles.some((entry) => entry.profileId === id)) throw gameplayError("profile_default_missing", `Required default profile ${id} is missing`);
}
/** @param {unknown} value @param {string} code @returns {readonly DataRecord[]} */
function materializeDefaultProfileList(value, code) {
	return normalizeProfileList(value, code, materializeDefaultProfile);
}
/** @param {unknown} value @param {string} code @returns {readonly DataRecord[]} */
function normalizeImportedProfileList(value, code) {
	return normalizeProfileList(value, code, normalizeImportedProfile);
}
/** @param {unknown} value @param {string} code @param {(entry:unknown)=>DataRecord} normalizeEntry @returns {readonly DataRecord[]} */
function normalizeProfileList(value, code, normalizeEntry) {
	const cloned = cloneGameplayData(value, code, 4096);
	if (!Array.isArray(cloned) || cloned.length < 3 || cloned.length > 64) throw gameplayError(code, "Profile list must contain 3..64 profiles");
	const ids = /* @__PURE__ */ new Set();
	const profiles = cloned.map(normalizeEntry);
	for (const profile of profiles) {
		if (ids.has(profile.profileId)) throw gameplayError("profile_id_duplicate", "Profile IDs must be unique");
		ids.add(profile.profileId);
	}
	return Object.freeze(profiles.sort(profileOrder));
}
/** @param {unknown} value @returns {DataRecord} */
function materializeDefaultProfile(value) {
	return normalizeProfile(value, false);
}
/** @param {unknown} value @returns {DataRecord} */
function normalizeImportedProfile(value) {
	return normalizeProfile(value, true);
}
/** @param {unknown} value @param {boolean} strictImport @returns {DataRecord} */
function normalizeProfile(value, strictImport) {
	const fields = [
		"schema",
		"version",
		"profileId",
		"profileVersion",
		"class",
		"label",
		"experimental",
		"settings",
		"contentHash"
	];
	const record = requireDataRecordFields(value, "prototype_profile_invalid", fields);
	if (strictImport && Reflect.ownKeys(record).length !== fields.length) throw gameplayError("prototype_profile_fields_missing", "Imported prototype profiles require every exact field");
	if ((strictImport || record.schema !== void 0) && record.schema !== PROFILE_SCHEMA || (strictImport || record.version !== void 0) && record.version !== 1) throw gameplayError("prototype_profile_invalid", "Prototype profile schema/version is invalid");
	const profileId = requireString$1(record.profileId, "profile_id_invalid");
	const profileVersion = requireString$1(record.profileVersion, "profile_version_invalid");
	const profileClass = requireProfileClass(record.class);
	const label = requireString$1(record.label, "profile_label_invalid");
	if ((strictImport || record.experimental !== void 0) && record.experimental !== true) throw gameplayError("profile_not_experimental", "Prototype profiles must remain experimental");
	const settings = normalizeSettings(profileClass, record.settings);
	const hashBody = Object.freeze({
		schema: PROFILE_SCHEMA,
		version: 1,
		profileId,
		profileVersion,
		class: profileClass,
		settings
	});
	const contentHash = sha256Hex$2(canonicalJson$2(hashBody));
	if (strictImport || record.contentHash !== void 0) {
		if (requireHash$1(record.contentHash, "profile_hash_invalid") !== contentHash) throw gameplayError("profile_hash_mismatch", "Profile content hash does not match canonical settings");
	}
	return Object.freeze({
		...hashBody,
		label,
		experimental: true,
		contentHash
	});
}
/** @param {unknown} value */
function normalizeBundle(value) {
	const record = requireDataRecordFields(value, "profile_bundle_invalid", [
		"schema",
		"version",
		"bundleVersion",
		"profiles",
		"bundleHash"
	]);
	if (record.schema !== BUNDLE_SCHEMA || record.version !== 1) throw gameplayError("profile_bundle_invalid", "Profile bundle schema/version is invalid");
	const bundleVersion = requireString$1(record.bundleVersion, "profile_bundle_version_invalid");
	const profiles = normalizeImportedProfileList(record.profiles, "profile_bundle_profiles_invalid");
	const body = Object.freeze({
		schema: BUNDLE_SCHEMA,
		version: 1,
		bundleVersion,
		profiles
	});
	const expected = `sha256:${sha256Hex$2(canonicalJson$2(body))}`;
	if (record.bundleHash !== expected) throw gameplayError("profile_bundle_hash_mismatch", "Profile bundle hash does not match canonical content");
	return Object.freeze({
		...body,
		bundleHash: expected
	});
}
/** @param {unknown} value @returns {"live_visual"|"between_run_ruleset"|"converter_regeneration"} */
function requireProfileClass(value) {
	if (!PROFILE_CLASSES.includes(value)) throw gameplayError("profile_class_invalid", "Prototype profile class is invalid");
	return value;
}
/** @param {string} profileClass @param {unknown} value */
function normalizeSettings(profileClass, value) {
	if (profileClass === "live_visual") {
		const record = exactSettings(value, ["motionIntensity", "roleScale"]);
		return Object.freeze({
			motionIntensity: boundedNumber(record.motionIntensity, 0, 2),
			roleScale: boundedNumber(record.roleScale, .5, 1.5)
		});
	}
	if (profileClass === "between_run_ruleset") {
		const record = exactSettings(value, [
			"comboBonusPerHit",
			"hitPoints",
			"missPenalty"
		]);
		return Object.freeze({
			comboBonusPerHit: boundedNumber(record.comboBonusPerHit, 0, 10),
			hitPoints: boundedNumber(record.hitPoints, 0, 100),
			missPenalty: boundedNumber(record.missPenalty, 0, 100)
		});
	}
	const record = exactSettings(value, ["guardRelocationRadius", "reachAllowanceSubcells"]);
	return Object.freeze({
		guardRelocationRadius: boundedInteger$2(record.guardRelocationRadius, 0, 8),
		reachAllowanceSubcells: boundedInteger$2(record.reachAllowanceSubcells, 0, 8)
	});
}
/** @param {unknown} value @param {readonly string[]} keys */
function exactSettings(value, keys) {
	const record = requireDataRecordFields(value, "profile_settings_invalid", keys);
	if (Reflect.ownKeys(record).length !== keys.length) throw gameplayError("profile_settings_invalid", "Profile settings must contain every exact field");
	return record;
}
/** @param {unknown} value @param {number} minimum @param {number} maximum */
function boundedNumber(value, minimum, maximum) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw gameplayError("profile_setting_invalid", "Profile numeric setting is outside its bounds");
	return Object.is(value, -0) ? 0 : value;
}
/** @param {unknown} value @param {number} minimum @param {number} maximum */
function boundedInteger$2(value, minimum, maximum) {
	const result = boundedNumber(value, minimum, maximum);
	if (!Number.isInteger(result)) throw gameplayError("profile_setting_invalid", "Profile integer setting is invalid");
	return result;
}
/** @param {unknown} value @param {string} code */
function requireHash$1(value, code) {
	if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw gameplayError(code, "Expected a lowercase SHA-256 hex value");
	return value;
}
/** @param {DataRecord} profile @param {boolean} regenerationRequired */
function tuningIdentity$1(profile, regenerationRequired) {
	return Object.freeze({
		schema: "aerobeat/prototype_tuning_identity",
		version: 1,
		profileId: profile.profileId,
		profileVersion: profile.profileVersion,
		contentHash: profile.contentHash,
		class: profile.class,
		regenerationRequired
	});
}
/** @param {DataRecord} left @param {DataRecord} right */
function profileOrder(left, right) {
	return compareUnicodeCodePoints(String(left.profileId), String(right.profileId));
}
/** Canonical JSON for bounded profile records. @param {unknown} value */
function canonicalPrototypeProfileJson(value) {
	return stringify(cloneGameplayData(value, "profile_canonical_json_invalid", 4096));
	/** @param {unknown} entry @returns {string} */
	function stringify(entry) {
		if (entry === null || typeof entry === "boolean" || typeof entry === "number" || typeof entry === "string") return JSON.stringify(entry);
		if (Array.isArray(entry)) return `[${entry.map(stringify).join(",")}]`;
		if (!isPlainRecord$3(entry)) throw gameplayError("profile_canonical_json_invalid", "Canonical profile data must be plain");
		return `{${Object.keys(entry).sort(compareUnicodeCodePoints).map((key) => `${JSON.stringify(key)}:${stringify(entry[key])}`).join(",")}}`;
	}
}
/** @param {string} text */
function sha256Hex$2(text) {
	const bytes = new TextEncoder().encode(text);
	const words = [];
	const bitLength = bytes.length * 8;
	for (const byte of bytes) words.push(byte);
	words.push(128);
	while (words.length % 64 !== 56) words.push(0);
	const high = Math.floor(bitLength / 4294967296);
	const low = bitLength >>> 0;
	for (let shift = 24; shift >= 0; shift -= 8) words.push(high >>> shift & 255);
	for (let shift = 24; shift >= 0; shift -= 8) words.push(low >>> shift & 255);
	const h = [
		1779033703,
		3144134277,
		1013904242,
		2773480762,
		1359893119,
		2600822924,
		528734635,
		1541459225
	];
	const k = [
		1116352408,
		1899447441,
		3049323471,
		3921009573,
		961987163,
		1508970993,
		2453635748,
		2870763221,
		3624381080,
		310598401,
		607225278,
		1426881987,
		1925078388,
		2162078206,
		2614888103,
		3248222580,
		3835390401,
		4022224774,
		264347078,
		604807628,
		770255983,
		1249150122,
		1555081692,
		1996064986,
		2554220882,
		2821834349,
		2952996808,
		3210313671,
		3336571891,
		3584528711,
		113926993,
		338241895,
		666307205,
		773529912,
		1294757372,
		1396182291,
		1695183700,
		1986661051,
		2177026350,
		2456956037,
		2730485921,
		2820302411,
		3259730800,
		3345764771,
		3516065817,
		3600352804,
		4094571909,
		275423344,
		430227734,
		506948616,
		659060556,
		883997877,
		958139571,
		1322822218,
		1537002063,
		1747873779,
		1955562222,
		2024104815,
		2227730452,
		2361852424,
		2428436474,
		2756734187,
		3204031479,
		3329325298
	];
	const w = /* @__PURE__ */ new Uint32Array(64);
	for (let offset = 0; offset < words.length; offset += 64) {
		for (let i = 0; i < 16; i += 1) w[i] = (words[offset + i * 4] << 24 | words[offset + i * 4 + 1] << 16 | words[offset + i * 4 + 2] << 8 | words[offset + i * 4 + 3]) >>> 0;
		for (let i = 16; i < 64; i += 1) {
			const x = w[i - 15], y = w[i - 2];
			const s0 = (ror(x, 7) ^ ror(x, 18) ^ x >>> 3) >>> 0, s1 = (ror(y, 17) ^ ror(y, 19) ^ y >>> 10) >>> 0;
			w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
		}
		let [a, b, c, d, e, f, g, hh] = h;
		for (let i = 0; i < 64; i += 1) {
			const s1 = (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) >>> 0;
			const ch = (e & f ^ ~e & g) >>> 0;
			const t1 = hh + s1 + ch + k[i] + w[i] >>> 0;
			const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) >>> 0) + ((a & b ^ a & c ^ b & c) >>> 0) >>> 0;
			hh = g;
			g = f;
			f = e;
			e = d + t1 >>> 0;
			d = c;
			c = b;
			b = a;
			a = t1 + t2 >>> 0;
		}
		h[0] = h[0] + a >>> 0;
		h[1] = h[1] + b >>> 0;
		h[2] = h[2] + c >>> 0;
		h[3] = h[3] + d >>> 0;
		h[4] = h[4] + e >>> 0;
		h[5] = h[5] + f >>> 0;
		h[6] = h[6] + g >>> 0;
		h[7] = h[7] + hh >>> 0;
	}
	return h.map((value) => value.toString(16).padStart(8, "0")).join("");
}
/** @param {string} left @param {string} right */
function compareUnicodeCodePoints(left, right) {
	const leftPoints = Array.from(left, (entry) => entry.codePointAt(0) ?? 0);
	const rightPoints = Array.from(right, (entry) => entry.codePointAt(0) ?? 0);
	const length = Math.min(leftPoints.length, rightPoints.length);
	for (let index = 0; index < length; index += 1) if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
	return leftPoints.length - rightPoints.length;
}
/** @param {number} value @param {number} bits */
function ror(value, bits) {
	return (value >>> bits | value << 32 - bits) >>> 0;
}
/** @param {unknown} value */
function canonicalJson$2(value) {
	return canonicalPrototypeProfileJson(value);
}
serviceIds.gameplaySession;
Object.freeze(["flow", "boxing"]);
Object.freeze({
	authoritativeAudioClock: true,
	calibratedInputOnly: true,
	trackingSafetyPause: true,
	frozenCountdown: true,
	explicitPausedClockSynchronization: true,
	flowGrid: true,
	semanticTrackBoxing: true,
	spatialGridBoxing: true,
	futureVariantSwap: true,
	diagnosticShadows: true,
	prototypeProfileRegistry: true,
	deterministicProfileBundles: true,
	localPrototypeScoresOnly: true,
	publicLeaderboards: false
});
//#endregion
//#region ../aerobeat-web-ui/src/elements/aero-button/aero-button.js
/**
* @typedef {Object} AeroButtonActivateDetail
* @property {string} label Visible command label when activation occurred.
*/
/**
* Public command event dispatched by `aero-button` after native activation.
*
* @type {"aero-button-activate"}
*/
var aeroButtonActivateEventName = "aero-button-activate";
/**
* Frutiger Aero command button Web Component.
*/
var AeroButton = class extends HTMLElement {
	/**
	* Observed attributes for the component.
	*
	* @returns {string[]}
	*/
	static get observedAttributes() {
		return [
			"disabled",
			"label",
			"variant"
		];
	}
	/**
	* Creates the button shadow DOM.
	*/
	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = `
      <style>
        :host {
          display: inline-flex;
        }

        .control {
          align-items: center;
          appearance: none;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(142, 219, 255, 0.78));
          border: 1px solid rgba(47, 139, 182, 0.52);
          border-radius: var(--aero-radius-control, 8px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 8px 18px rgba(17, 77, 104, 0.18);
          color: var(--aero-color-ink, #103447);
          cursor: pointer;
          display: inline-flex;
          font: 600 0.95rem var(--aero-font-family, system-ui, sans-serif);
          justify-content: center;
          min-height: 36px;
          min-width: 44px;
          padding: 0 var(--aero-space-4, 16px);
        }

        .control:focus-visible {
          outline: 2px solid var(--aero-color-focus, #0a84ff);
          outline-offset: 2px;
        }
      </style>
      <button class="control" part="control" type="button"></button>
    `;
		root.querySelector(".control")?.addEventListener("click", () => {
			this.#dispatchActivateEvent();
		});
	}
	/**
	* Syncs attribute changes into the rendered label.
	*/
	connectedCallback() {
		this.#render();
	}
	/**
	* Syncs attribute changes into the rendered label.
	*/
	attributeChangedCallback() {
		this.#render();
	}
	/**
	* Updates the visible control text.
	*/
	#render() {
		const control = this.shadowRoot?.querySelector("button.control");
		if (control) {
			control.textContent = this.getAttribute("label") ?? "Continue";
			control.disabled = this.hasAttribute("disabled");
		}
	}
	/**
	* Dispatches the public activation event for consumers that avoid private shadow DOM coupling.
	*
	* @returns {void}
	*/
	#dispatchActivateEvent() {
		/** @type {AeroButtonActivateDetail} */
		const detail = { label: this.getAttribute("label") ?? "Continue" };
		this.dispatchEvent(new CustomEvent(aeroButtonActivateEventName, {
			bubbles: true,
			composed: true,
			detail
		}));
	}
};
/**
* Defines `aero-button` when it is not already registered.
*
* @returns {void}
*/
function defineAeroButton() {
	if (!customElements.get("aero-button")) customElements.define("aero-button", AeroButton);
}
//#endregion
//#region ../aerobeat-web-video/src/source-descriptors.js
/** @typedef {"live-camera" | "loaded-video" | "replay-video-feed"} AeroVideoSourceKind */
/** @typedef {"stretch" | "contain" | "cover"} AeroVideoFitMode */
/** @typedef {"background-only" | "sampled-media"} AeroVideoReadabilityRequirement */
/** @typedef {"anonymous" | "use-credentials" | undefined} AeroVideoCrossOriginMode */
/**
* Shared descriptor fields for every video source.
*
* @typedef {object} AeroVideoSourceBase
* @property {AeroVideoSourceKind} kind Source kind.
* @property {string} sourceId Stable source identifier for diagnostics and calibration invalidation.
* @property {AeroVideoFitMode} fitMode Presentation fit metadata.
* @property {boolean} mirrored Whether consumers should mirror the surface.
*/
/**
* @typedef {AeroVideoSourceBase & {
*   kind: "live-camera",
*   constraints: MediaStreamConstraints
* }} LiveCameraSourceDescriptor
*/
/**
* @typedef {AeroVideoSourceBase & {
*   kind: "loaded-video",
*   url: string,
*   mediaType: string | undefined,
*   loop: boolean,
*   autoplay: boolean,
*   muted: boolean,
*   startTimeSeconds: number,
*   readabilityRequirement: AeroVideoReadabilityRequirement,
*   crossOrigin: AeroVideoCrossOriginMode,
*   objectUrlOwned: boolean
* }} LoadedVideoSourceDescriptor
*/
/**
* @typedef {AeroVideoSourceBase & {
*   kind: "replay-video-feed",
*   url: string,
*   frameRate: number | undefined,
*   loop: boolean,
*   autoplay: boolean,
*   muted: boolean,
*   startTimeSeconds: number,
*   readabilityRequirement: "sampled-media",
*   crossOrigin: AeroVideoCrossOriginMode,
*   objectUrlOwned: boolean
* }} ReplayVideoFeedSourceDescriptor
*/
/**
* @typedef {object} LiveCameraSourceDescriptorOptions
* @property {string | undefined} sourceId Stable source identifier.
* @property {MediaStreamConstraints | undefined} constraints Browser camera constraints.
* @property {AeroVideoFitMode | undefined} fitMode Presentation fit metadata.
* @property {boolean | undefined} mirrored Whether consumers should mirror the surface.
*/
/**
* @typedef {object} LoadedVideoSourceDescriptorOptions
* @property {string} url Browser-loadable video URL.
* @property {string | undefined} sourceId Stable source identifier.
* @property {string | undefined} mediaType Optional MIME type hint.
* @property {AeroVideoFitMode | undefined} fitMode Presentation fit metadata.
* @property {boolean | undefined} mirrored Whether consumers should mirror the surface.
* @property {boolean | undefined} loop Whether playback should loop.
* @property {boolean | undefined} autoplay Whether playback should begin after loading.
* @property {boolean | undefined} muted Whether the element should be muted.
* @property {number | undefined} startTimeSeconds Initial playback position.
* @property {AeroVideoReadabilityRequirement | undefined} readabilityRequirement Whether the source is cosmetic-only or must remain sample-readable.
* @property {AeroVideoCrossOriginMode} crossOrigin Browser media CORS mode.
* @property {boolean | undefined} objectUrlOwned Whether the facade must revoke this object URL on release.
*/
/**
* @typedef {object} ReplayVideoFeedSourceDescriptorOptions
* @property {string} url Browser-loadable replay video URL.
* @property {string | undefined} sourceId Stable source identifier.
* @property {number | undefined} frameRate Optional replay frame-rate metadata.
* @property {AeroVideoFitMode | undefined} fitMode Presentation fit metadata.
* @property {boolean | undefined} mirrored Whether consumers should mirror the surface.
* @property {boolean | undefined} loop Whether playback should loop.
* @property {boolean | undefined} autoplay Whether playback should begin after loading.
* @property {boolean | undefined} muted Whether the element should be muted.
* @property {number | undefined} startTimeSeconds Initial playback position.
* @property {AeroVideoCrossOriginMode} crossOrigin Browser media CORS mode.
* @property {boolean | undefined} objectUrlOwned Whether the facade must revoke this object URL on release.
*/
/** @returns {MediaStreamConstraints} */
function defaultLiveCameraConstraints() {
	return {
		audio: false,
		video: { facingMode: "user" }
	};
}
/**
* @param {LiveCameraSourceDescriptorOptions} [options]
* @returns {LiveCameraSourceDescriptor}
*/
function createLiveCameraSourceDescriptor(options = {}) {
	return {
		kind: "live-camera",
		sourceId: options.sourceId ?? "aero.video.live-camera",
		constraints: options.constraints ?? defaultLiveCameraConstraints(),
		fitMode: options.fitMode ?? "contain",
		mirrored: options.mirrored ?? true
	};
}
/**
* @param {LoadedVideoSourceDescriptorOptions} options
* @returns {LoadedVideoSourceDescriptor}
*/
function createLoadedVideoSourceDescriptor(options) {
	const readabilityRequirement = options.readabilityRequirement ?? "background-only";
	return {
		kind: "loaded-video",
		sourceId: options.sourceId ?? "aero.video.loaded-video",
		url: options.url,
		mediaType: options.mediaType,
		fitMode: options.fitMode ?? "contain",
		mirrored: options.mirrored ?? false,
		loop: options.loop ?? false,
		autoplay: options.autoplay ?? false,
		muted: options.muted ?? false,
		startTimeSeconds: finiteNonNegative$2(options.startTimeSeconds),
		readabilityRequirement,
		crossOrigin: options.crossOrigin ?? (readabilityRequirement === "sampled-media" ? "anonymous" : void 0),
		objectUrlOwned: options.objectUrlOwned ?? false
	};
}
/** @param {number | undefined} value @returns {number} */
function finiteNonNegative$2(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
//#endregion
//#region ../aerobeat-web-video/src/browser-video-facade.js
/** @type {"aero.video.media"} */
var aeroVideoMediaServiceId = "aero.video.media";
/** @typedef {"idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error" | "destroyed"} AeroVideoPlaybackState */
/** @typedef {"connected" | "destroyed"} AeroVideoLifecycleState */
/** @typedef {"inactive" | "active" | "paused" | "released"} AeroVideoLeaseState */
/** @typedef {"facade-owned" | "host-owned" | "none"} AeroMediaStreamOwnership */
/** @typedef {"not-required" | "unknown" | "readable" | "blocked"} AeroVideoReadabilityState */
/** @typedef {import("./source-descriptors.js").AeroVideoFitMode} AeroVideoFitMode */
/** @typedef {import("./source-descriptors.js").AeroVideoSourceKind} AeroVideoSourceKind */
/** @typedef {import("./source-descriptors.js").LiveCameraSourceDescriptor} LiveCameraSourceDescriptor */
/** @typedef {import("./source-descriptors.js").LoadedVideoSourceDescriptor} LoadedVideoSourceDescriptor */
/** @typedef {import("./source-descriptors.js").ReplayVideoFeedSourceDescriptor} ReplayVideoFeedSourceDescriptor */
/** @typedef {LoadedVideoSourceDescriptor | ReplayVideoFeedSourceDescriptor} BrowserLoadedVideoDescriptor */
/**
* @typedef {object} AeroVideoErrorSnapshot
* @property {string} code Stable AeroBeat error code.
* @property {string} name Browser or adapter error name.
* @property {string} message Human-readable diagnostic.
*/
/**
* @typedef {object} AeroVideoCapabilities
* @property {boolean} cameraRequest Camera requests are available.
* @property {true} injectedStreams Host streams can be injected.
* @property {true} loadedVideo Browser video sources are supported.
* @property {true} visibilityPause Visibility pause hooks are supported.
* @property {true} leaseLifecycle Lease lifecycle hooks are supported.
* @property {true} corsReadabilityReporting Sample readability can be reported truthfully.
* @property {boolean} objectUrls Blob object URLs can be created and revoked.
*/
/**
* @typedef {object} AeroCameraRequestResult
* @property {"granted" | "unsupported" | "blocked" | "stale"} status Permission result.
* @property {LiveCameraSourceDescriptor} source Source descriptor used for the request.
* @property {MediaStream | undefined} stream Retained stream only when permission is granted.
* @property {string | undefined} errorName Browser error name when blocked.
* @property {string} message Diagnostic message.
* @property {number} generation Lifecycle generation that produced the result.
*/
/**
* @typedef {object} AeroCameraDeviceDescriptor
* @property {string} deviceId Browser media device ID.
* @property {string} label Browser-provided or fallback display label.
* @property {string | undefined} groupId Browser media device group ID.
*/
/**
* @typedef {object} AeroVideoStatusSnapshot
* @property {"aero.video.media"} serviceId Stable service ID.
* @property {AeroVideoLifecycleState} lifecycleState Connection lifecycle.
* @property {number} generation Lifecycle generation.
* @property {AeroVideoLeaseState} leaseState Lease participation state.
* @property {boolean} documentHidden Whether the owning document is hidden.
* @property {boolean} inferencePaused Whether inference consumers must pause.
* @property {boolean} gameplayPaused Whether gameplay consumers must pause.
* @property {AeroMediaStreamOwnership} streamOwnership Current stream ownership.
* @property {number} sourceChangeId Monotonic source/mirror/aspect identity generation.
* @property {string | undefined} calibrationSourceIdentity Source identity used for calibration invalidation.
* @property {AeroVideoReadabilityState} readabilityState Current sampled-media readability truth.
* @property {string | undefined} readabilityReason Optional readability diagnostic.
* @property {AeroVideoErrorSnapshot | undefined} lastError Last lifecycle error.
* @property {AeroVideoCapabilities} capabilities Runtime capabilities.
*/
/**
* @typedef {object} AeroVideoSurfaceDescriptor
* @property {"aero.video.media"} serviceId Stable service ID.
* @property {AeroVideoSourceKind | undefined} sourceKind Current source kind.
* @property {string | undefined} sourceId Current source identifier.
* @property {AeroVideoPlaybackState} playbackState Current playback state.
* @property {AeroVideoFitMode} fitMode Presentation fit metadata.
* @property {boolean} mirrored Whether consumers should mirror the surface.
* @property {boolean} hasElement Whether a video element is attached.
* @property {boolean} hasRetainedStream Whether a stream is retained.
* @property {AeroMediaStreamOwnership} streamOwnership Current stream ownership.
* @property {number | undefined} intrinsicWidth Current video intrinsic width.
* @property {number | undefined} intrinsicHeight Current video intrinsic height.
* @property {number | undefined} sourceAspectRatio Current intrinsic aspect ratio.
* @property {number | undefined} durationSeconds Current media duration.
* @property {number} currentTimeSeconds Current playback position.
* @property {number} sourceChangeId Monotonic source/mirror/aspect identity generation.
* @property {string | undefined} calibrationSourceIdentity Source identity used for calibration invalidation.
* @property {AeroVideoReadabilityState} readabilityState Current sampled-media readability truth.
* @property {AeroVideoLifecycleState} lifecycleState Connection lifecycle.
* @property {AeroVideoLeaseState} leaseState Lease participation state.
* @property {boolean} documentHidden Whether the owning document is hidden.
*/
/**
* @typedef {object} AeroVisibilityDocument
* @property {string | undefined} visibilityState Visibility state.
* @property {(type: string, listener: () => void) => void} addEventListener Adds a listener.
* @property {(type: string, listener: () => void) => void} removeEventListener Removes a listener.
*/
/**
* @typedef {object} AeroObjectUrlApi
* @property {(value: Blob) => string} createObjectURL Creates an object URL.
* @property {(url: string) => void} revokeObjectURL Revokes an object URL.
*/
/**
* @typedef {object} BrowserVideoMediaFacadeOptions
* @property {MediaDevices | undefined} mediaDevices Optional media-devices adapter.
* @property {AeroVisibilityDocument | undefined} document Optional visibility adapter.
* @property {AeroObjectUrlApi | undefined} objectUrlApi Optional object-URL adapter.
*/
/**
* @typedef {object} CameraRequestOptions
* @property {AbortSignal | undefined} signal Consumer cancellation signal.
*/
/**
* @typedef {object} InjectCameraStreamOptions
* @property {LiveCameraSourceDescriptor | undefined} source Source metadata.
* @property {"host-owned" | "facade-owned" | undefined} ownership Stream ownership. Host-owned is the safe default.
*/
/**
* @typedef {object} AttachStreamOptions
* @property {LiveCameraSourceDescriptor | undefined} source Source metadata.
* @property {"host-owned" | "facade-owned" | undefined} ownership Ownership when the supplied stream is not already retained.
*/
/**
* @typedef {object} BlobVideoSourceOptions
* @property {string | undefined} sourceId Source identifier.
* @property {string | undefined} mediaType MIME hint.
* @property {AeroVideoFitMode | undefined} fitMode Fit mode.
* @property {boolean | undefined} mirrored Mirror metadata.
* @property {boolean | undefined} loop Loop playback.
* @property {boolean | undefined} autoplay Autoplay playback.
* @property {boolean | undefined} muted Mute playback.
* @property {number | undefined} startTimeSeconds Start time.
* @property {"background-only" | "sampled-media" | undefined} readabilityRequirement Readability requirement.
*/
/**
* @typedef {object} LeaseReleaseOptions
* @property {boolean | undefined} releaseStream Whether to release the retained stream. Defaults true.
*/
/**
* @typedef {object} BrowserVideoMediaFacade
* @property {"aero.video.media"} serviceId Stable service ID.
* @property {readonly AeroVideoSourceKind[]} supportedSources Supported kinds.
* @property {() => MediaStream | undefined} getRetainedCameraStream Reads the retained stream.
* @property {() => Promise<readonly AeroCameraDeviceDescriptor[]>} listCameraDevices Lists cameras.
* @property {(source?: LiveCameraSourceDescriptor, options?: CameraRequestOptions) => Promise<AeroCameraRequestResult>} requestCamera Requests an owned camera stream.
* @property {(stream: MediaStream, options?: InjectCameraStreamOptions) => AeroVideoSurfaceDescriptor} injectCameraStream Retains a host or transferred stream without attaching a surface.
* @property {(videoElement: HTMLVideoElement, stream?: MediaStream, options?: AttachStreamOptions) => AeroVideoSurfaceDescriptor} attachCameraStream Attaches a stream.
* @property {(videoElement: HTMLVideoElement, source: BrowserLoadedVideoDescriptor) => AeroVideoSurfaceDescriptor} attachVideoSource Attaches a URL source.
* @property {(videoElement: HTMLVideoElement, blob: Blob, options?: BlobVideoSourceOptions) => AeroVideoSurfaceDescriptor} attachVideoBlob Creates and owns an object URL source.
* @property {(videoElement: HTMLVideoElement) => Promise<AeroVideoSurfaceDescriptor>} play Starts playback.
* @property {(videoElement?: HTMLVideoElement) => AeroVideoSurfaceDescriptor} pause Pauses playback.
* @property {(videoElement: HTMLVideoElement, timeSeconds: number) => AeroVideoSurfaceDescriptor} seek Seeks playback.
* @property {(readable: boolean, reason?: string) => AeroVideoStatusSnapshot} reportSourceReadability Records sampled-media CORS/readback truth.
* @property {(hidden: boolean) => AeroVideoStatusSnapshot} setDocumentHidden Applies visibility pause hooks while retaining camera.
* @property {() => AeroVideoStatusSnapshot} activateLease Activates this instance's lease.
* @property {() => AeroVideoStatusSnapshot} pauseForLease Pauses consumers while retaining resources.
* @property {(options?: LeaseReleaseOptions) => AeroVideoStatusSnapshot} releaseLease Releases lease participation.
* @property {(videoElement?: HTMLVideoElement) => AeroVideoSurfaceDescriptor} describeSurface Describes surface state.
* @property {() => AeroVideoStatusSnapshot} describeStatus Describes lifecycle/capability state.
* @property {() => void} teardownCameraStream Releases the retained stream and stops only facade-owned tracks.
* @property {(videoElement?: HTMLVideoElement) => AeroVideoSurfaceDescriptor} clearVideoElement Detaches and cleans a surface.
* @property {() => AeroVideoStatusSnapshot} destroy Destroys synchronously and idempotently.
* @property {() => AeroVideoStatusSnapshot} reconnect Starts a fresh lifecycle generation after destroy.
*/
/**
* @param {BrowserVideoMediaFacadeOptions} [options]
* @returns {BrowserVideoMediaFacade}
*/
function createBrowserVideoMediaFacade(options = {}) {
	const mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices;
	const visibilityDocument = options.document ?? asVisibilityDocument(globalThis.document);
	const objectUrlApi = options.objectUrlApi ?? asObjectUrlApi(globalThis.URL);
	/** @type {MediaStream | undefined} */ let retainedStream;
	/** @type {AeroMediaStreamOwnership} */ let streamOwnership = "none";
	/** @type {LiveCameraSourceDescriptor | BrowserLoadedVideoDescriptor | undefined} */ let currentSource;
	/** @type {HTMLVideoElement | undefined} */ let attachedElement;
	/** @type {AeroVideoPlaybackState} */ let playbackState = "idle";
	/** @type {AeroVideoLifecycleState} */ let lifecycleState = "connected";
	/** @type {AeroVideoLeaseState} */ let leaseState = "inactive";
	/** @type {AeroVideoReadabilityState} */ let readabilityState = "not-required";
	/** @type {string | undefined} */ let readabilityReason;
	/** @type {AeroVideoErrorSnapshot | undefined} */ let lastError;
	/** @type {string | undefined} */ let ownedObjectUrl;
	let documentHidden = visibilityDocument?.visibilityState === "hidden";
	let generation = 1;
	let operationId = 0;
	let sourceChangeId = 0;
	/** @type {string | undefined} */ let sourceSignature;
	/** @type {Array<() => void>} */ let elementCleanups = [];
	/** @type {AeroVideoCapabilities} */
	const capabilities = Object.freeze({
		cameraRequest: Boolean(mediaDevices?.getUserMedia),
		injectedStreams: true,
		loadedVideo: true,
		visibilityPause: true,
		leaseLifecycle: true,
		corsReadabilityReporting: true,
		objectUrls: Boolean(objectUrlApi)
	});
	const onVisibilityChange = () => {
		setDocumentHidden(visibilityDocument?.visibilityState === "hidden");
	};
	visibilityDocument?.addEventListener("visibilitychange", onVisibilityChange);
	function nextOperation() {
		operationId += 1;
		return operationId;
	}
	/** @param {number} expectedGeneration @param {number} expectedOperation */
	function isCurrent(expectedGeneration, expectedOperation) {
		return lifecycleState === "connected" && generation === expectedGeneration && operationId === expectedOperation;
	}
	/** @param {MediaStream | undefined} stream */
	function stopTracks(stream) {
		stream?.getTracks().forEach((track) => track.stop());
	}
	function releaseRetainedStream() {
		if (streamOwnership === "facade-owned") stopTracks(retainedStream);
		retainedStream = void 0;
		streamOwnership = "none";
	}
	function revokeOwnedObjectUrl() {
		if (ownedObjectUrl && objectUrlApi) objectUrlApi.revokeObjectURL(ownedObjectUrl);
		ownedObjectUrl = void 0;
	}
	function unbindElement() {
		for (const cleanup of elementCleanups) cleanup();
		elementCleanups = [];
	}
	/** @param {HTMLVideoElement} element */
	function detachElement(element) {
		element.pause();
		if (element.srcObject) element.srcObject = null;
		element.removeAttribute("src");
		element.load();
		if (element === attachedElement) {
			unbindElement();
			attachedElement = void 0;
			revokeOwnedObjectUrl();
		}
	}
	/** @param {HTMLVideoElement} element */
	function bindElement(element) {
		if (attachedElement && attachedElement !== element) detachElement(attachedElement);
		else unbindElement();
		attachedElement = element;
		const bindings = [
			["loadedmetadata", () => refreshSourceIdentity(element)],
			["play", () => {
				if (attachedElement === element) playbackState = "playing";
			}],
			["pause", () => {
				if (attachedElement === element && playbackState !== "destroyed") playbackState = "paused";
			}],
			["ended", () => {
				if (attachedElement === element) playbackState = "ended";
			}],
			["error", () => {
				if (attachedElement === element) {
					playbackState = "error";
					lastError = {
						code: "media_element_error",
						name: "MediaElementError",
						message: "The attached media element reported an error"
					};
				}
			}]
		];
		for (const [type, listener] of bindings) {
			element.addEventListener?.(type, listener);
			elementCleanups.push(() => element.removeEventListener?.(type, listener));
		}
		refreshSourceIdentity(element);
	}
	/** @param {HTMLVideoElement | undefined} element */
	function refreshSourceIdentity(element) {
		const width = positiveNumberOrUndefined$2(element?.videoWidth);
		const height = positiveNumberOrUndefined$2(element?.videoHeight);
		const aspect = width && height ? width / height : void 0;
		const signature = currentSource ? `${currentSource.kind}|${currentSource.sourceId}|${currentSource.mirrored ? "mirrored" : "unmirrored"}|${aspect?.toFixed(6) ?? "aspect-unknown"}` : void 0;
		if (signature !== sourceSignature) {
			sourceSignature = signature;
			sourceChangeId += 1;
		}
	}
	/** @param {LiveCameraSourceDescriptor | BrowserLoadedVideoDescriptor} source */
	function setCurrentSource(source) {
		currentSource = source;
		readabilityReason = void 0;
		readabilityState = source.kind === "live-camera" ? "readable" : source.readabilityRequirement === "background-only" ? "not-required" : "unknown";
		refreshSourceIdentity(attachedElement);
	}
	/** @param {boolean} hidden */
	function setDocumentHidden(hidden) {
		documentHidden = hidden;
		if (hidden) {
			nextOperation();
			if (attachedElement) attachedElement.pause();
			if (playbackState === "playing" || playbackState === "loading") playbackState = "paused";
		}
		return describeStatus();
	}
	function describeStatus() {
		return Object.freeze({
			serviceId: aeroVideoMediaServiceId,
			lifecycleState,
			generation,
			leaseState,
			documentHidden,
			inferencePaused: documentHidden || leaseState !== "active" || lifecycleState === "destroyed",
			gameplayPaused: documentHidden || leaseState !== "active" || lifecycleState === "destroyed",
			streamOwnership,
			sourceChangeId,
			calibrationSourceIdentity: sourceSignature,
			readabilityState,
			readabilityReason,
			lastError: lastError ? Object.freeze({ ...lastError }) : void 0,
			capabilities
		});
	}
	/** @param {HTMLVideoElement | undefined} element */
	function describeSurface(element = attachedElement) {
		refreshSourceIdentity(element);
		const width = positiveNumberOrUndefined$2(element?.videoWidth);
		const height = positiveNumberOrUndefined$2(element?.videoHeight);
		return Object.freeze({
			serviceId: aeroVideoMediaServiceId,
			sourceKind: currentSource?.kind,
			sourceId: currentSource?.sourceId,
			playbackState,
			fitMode: currentSource?.fitMode ?? "contain",
			mirrored: currentSource?.mirrored ?? false,
			hasElement: Boolean(element),
			hasRetainedStream: Boolean(retainedStream),
			streamOwnership,
			intrinsicWidth: width,
			intrinsicHeight: height,
			sourceAspectRatio: width && height ? width / height : void 0,
			durationSeconds: finiteNumberOrUndefined(element?.duration),
			currentTimeSeconds: finiteNumberOrZero$1(element?.currentTime),
			sourceChangeId,
			calibrationSourceIdentity: sourceSignature,
			readabilityState,
			lifecycleState,
			leaseState,
			documentHidden
		});
	}
	/** @param {HTMLVideoElement | undefined} element */
	function clearVideoElement(element = attachedElement) {
		nextOperation();
		if (element) detachElement(element);
		else {
			unbindElement();
			attachedElement = void 0;
			revokeOwnedObjectUrl();
		}
		if (currentSource?.kind !== "live-camera") {
			currentSource = void 0;
			refreshSourceIdentity(void 0);
			readabilityState = "not-required";
			readabilityReason = void 0;
		}
		if (lifecycleState !== "destroyed") playbackState = retainedStream ? "ready" : "idle";
		return describeSurface();
	}
	function teardownCameraStream() {
		nextOperation();
		releaseRetainedStream();
		if (currentSource?.kind === "live-camera") {
			if (attachedElement) detachElement(attachedElement);
			currentSource = void 0;
			refreshSourceIdentity(void 0);
			if (lifecycleState !== "destroyed") playbackState = "idle";
		}
	}
	const facade = {
		serviceId: aeroVideoMediaServiceId,
		supportedSources: Object.freeze([
			"live-camera",
			"loaded-video",
			"replay-video-feed"
		]),
		getRetainedCameraStream() {
			return retainedStream;
		},
		async listCameraDevices() {
			if (!mediaDevices?.enumerateDevices || lifecycleState === "destroyed") return [];
			return (await mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput" && device.deviceId).map((device, index) => ({
				deviceId: device.deviceId,
				label: device.label || `Camera ${index + 1}`,
				groupId: device.groupId || void 0
			}));
		},
		async requestCamera(source = createLiveCameraSourceDescriptor(), requestOptions = {}) {
			if (lifecycleState === "destroyed") return {
				status: "stale",
				source,
				stream: void 0,
				errorName: "InvalidStateError",
				message: "Reconnect before requesting a camera",
				generation
			};
			const requestGeneration = generation;
			const requestOperation = nextOperation();
			const previousSourceKind = currentSource?.kind;
			lastError = void 0;
			playbackState = "loading";
			if (!mediaDevices?.getUserMedia) {
				playbackState = "error";
				lastError = {
					code: "camera_unsupported",
					name: "NotSupportedError",
					message: "Camera API unavailable in this browser context"
				};
				return {
					status: "unsupported",
					source,
					stream: void 0,
					errorName: void 0,
					message: lastError.message,
					generation: requestGeneration
				};
			}
			if (requestOptions.signal?.aborted) {
				playbackState = "idle";
				return {
					status: "stale",
					source,
					stream: void 0,
					errorName: "AbortError",
					message: "Camera request was cancelled",
					generation: requestGeneration
				};
			}
			try {
				const stream = await mediaDevices.getUserMedia(source.constraints);
				if (requestOptions.signal?.aborted || !isCurrent(requestGeneration, requestOperation)) {
					stopTracks(stream);
					return {
						status: "stale",
						source,
						stream: void 0,
						errorName: "AbortError",
						message: "Late camera result was discarded",
						generation: requestGeneration
					};
				}
				if (previousSourceKind !== void 0 && previousSourceKind !== "live-camera" && attachedElement) detachElement(attachedElement);
				releaseRetainedStream();
				retainedStream = stream;
				streamOwnership = "facade-owned";
				setCurrentSource(source);
				if (previousSourceKind === "live-camera" && attachedElement) attachedElement.srcObject = stream;
				playbackState = "ready";
				return {
					status: "granted",
					source,
					stream,
					errorName: void 0,
					message: "Camera permission granted",
					generation: requestGeneration
				};
			} catch (error) {
				if (!isCurrent(requestGeneration, requestOperation)) return {
					status: "stale",
					source,
					stream: void 0,
					errorName: "AbortError",
					message: "Late camera failure was discarded",
					generation: requestGeneration
				};
				playbackState = "error";
				lastError = {
					code: "camera_request_failed",
					name: readErrorField(error, "name") ?? "CameraRequestError",
					message: readErrorField(error, "message") ?? "Camera permission request failed"
				};
				return {
					status: "blocked",
					source,
					stream: void 0,
					errorName: lastError.name,
					message: lastError.message,
					generation: requestGeneration
				};
			}
		},
		injectCameraStream(stream, injectOptions = {}) {
			if (lifecycleState === "destroyed") return describeSurface();
			nextOperation();
			const previousSourceKind = currentSource?.kind;
			if (previousSourceKind !== void 0 && previousSourceKind !== "live-camera" && attachedElement) detachElement(attachedElement);
			const nextOwnership = injectOptions.ownership ?? (stream === retainedStream ? streamOwnership : "host-owned");
			if (stream !== retainedStream) releaseRetainedStream();
			retainedStream = stream;
			streamOwnership = nextOwnership;
			setCurrentSource(injectOptions.source ?? createLiveCameraSourceDescriptor());
			if (previousSourceKind === "live-camera" && attachedElement) attachedElement.srcObject = stream;
			lastError = void 0;
			playbackState = "ready";
			return describeSurface();
		},
		attachCameraStream(videoElement, stream = retainedStream, attachOptions = {}) {
			if (lifecycleState === "destroyed") return describeSurface();
			nextOperation();
			if (currentSource?.kind !== void 0 && currentSource.kind !== "live-camera" && attachedElement) detachElement(attachedElement);
			if (!stream) {
				setCurrentSource(attachOptions.source ?? createLiveCameraSourceDescriptor());
				playbackState = "error";
				lastError = {
					code: "camera_stream_missing",
					name: "MediaStreamError",
					message: "No camera stream is available to attach"
				};
				return describeSurface(videoElement);
			}
			if (stream !== retainedStream) facade.injectCameraStream(stream, attachOptions);
			else if (attachOptions.source || currentSource?.kind !== "live-camera") setCurrentSource(attachOptions.source ?? createLiveCameraSourceDescriptor());
			bindElement(videoElement);
			videoElement.srcObject = stream;
			videoElement.muted = true;
			videoElement.playsInline = true;
			playbackState = "ready";
			return describeSurface(videoElement);
		},
		attachVideoSource(videoElement, source) {
			if (lifecycleState === "destroyed") return describeSurface();
			nextOperation();
			if (currentSource?.kind === "live-camera") teardownCameraStream();
			else clearVideoElement(attachedElement);
			setCurrentSource(source);
			bindElement(videoElement);
			playbackState = "loading";
			videoElement.srcObject = null;
			videoElement.crossOrigin = source.crossOrigin ?? null;
			videoElement.src = source.url;
			videoElement.loop = source.loop;
			videoElement.autoplay = source.autoplay;
			videoElement.muted = source.muted;
			videoElement.currentTime = source.startTimeSeconds;
			if (source.objectUrlOwned) ownedObjectUrl = source.url;
			playbackState = "ready";
			return describeSurface(videoElement);
		},
		attachVideoBlob(videoElement, blob, blobOptions = {}) {
			if (lifecycleState === "destroyed") return describeSurface();
			if (!objectUrlApi) {
				playbackState = "error";
				lastError = {
					code: "object_url_unsupported",
					name: "NotSupportedError",
					message: "Object URLs are unavailable in this browser context"
				};
				return describeSurface(videoElement);
			}
			const url = objectUrlApi.createObjectURL(blob);
			const source = createLoadedVideoSourceDescriptor({
				...blobOptions,
				url,
				mediaType: blobOptions.mediaType ?? (blob.type || void 0),
				objectUrlOwned: true
			});
			return facade.attachVideoSource(videoElement, source);
		},
		async play(videoElement) {
			if (lifecycleState === "destroyed") return describeSurface(videoElement);
			const playGeneration = generation;
			const playOperation = nextOperation();
			bindElement(videoElement);
			try {
				await videoElement.play();
				if (isCurrent(playGeneration, playOperation)) playbackState = "playing";
			} catch (error) {
				if (isCurrent(playGeneration, playOperation)) {
					playbackState = "error";
					lastError = {
						code: "media_play_failed",
						name: readErrorField(error, "name") ?? "PlaybackError",
						message: readErrorField(error, "message") ?? "Media playback failed"
					};
				}
			}
			return describeSurface(videoElement);
		},
		pause(videoElement = attachedElement) {
			nextOperation();
			videoElement?.pause();
			if (lifecycleState !== "destroyed") playbackState = "paused";
			return describeSurface(videoElement);
		},
		seek(videoElement, timeSeconds) {
			videoElement.currentTime = finiteNonNegative$1(timeSeconds);
			return describeSurface(videoElement);
		},
		reportSourceReadability(readable, reason) {
			if (lifecycleState === "destroyed") return describeStatus();
			readabilityState = readable ? "readable" : "blocked";
			readabilityReason = reason;
			if (!readable && currentSource && currentSource.kind !== "live-camera" && currentSource.readabilityRequirement === "sampled-media") lastError = {
				code: "sampled_media_unreadable",
				name: "SecurityError",
				message: reason ?? "Sampled media is not readable; verify CORS headers"
			};
			return describeStatus();
		},
		setDocumentHidden,
		activateLease() {
			if (lifecycleState === "connected") leaseState = "active";
			return describeStatus();
		},
		pauseForLease() {
			if (lifecycleState === "destroyed") return describeStatus();
			nextOperation();
			leaseState = "paused";
			if (attachedElement) {
				attachedElement.pause();
				playbackState = "paused";
			}
			return describeStatus();
		},
		releaseLease(releaseOptions = {}) {
			if (lifecycleState === "destroyed") return describeStatus();
			nextOperation();
			leaseState = "released";
			if (attachedElement) {
				attachedElement.pause();
				playbackState = "paused";
			}
			if (releaseOptions.releaseStream ?? true) teardownCameraStream();
			return describeStatus();
		},
		describeSurface,
		describeStatus,
		teardownCameraStream,
		clearVideoElement,
		destroy() {
			if (lifecycleState === "destroyed") return describeStatus();
			nextOperation();
			generation += 1;
			lifecycleState = "destroyed";
			leaseState = "released";
			visibilityDocument?.removeEventListener("visibilitychange", onVisibilityChange);
			clearVideoElement(attachedElement);
			releaseRetainedStream();
			currentSource = void 0;
			sourceSignature = void 0;
			playbackState = "destroyed";
			readabilityState = "not-required";
			readabilityReason = void 0;
			return describeStatus();
		},
		reconnect() {
			if (lifecycleState === "connected") return describeStatus();
			generation += 1;
			nextOperation();
			lifecycleState = "connected";
			leaseState = "inactive";
			playbackState = "idle";
			lastError = void 0;
			documentHidden = visibilityDocument?.visibilityState === "hidden";
			visibilityDocument?.addEventListener("visibilitychange", onVisibilityChange);
			return describeStatus();
		}
	};
	return facade;
}
/** @param {unknown} value @returns {AeroVisibilityDocument | undefined} */
function asVisibilityDocument(value) {
	if (value && typeof value === "object" && "addEventListener" in value && "removeEventListener" in value) return value;
}
/** @param {unknown} value @returns {AeroObjectUrlApi | undefined} */
function asObjectUrlApi(value) {
	if (value && typeof value === "function" && "createObjectURL" in value && "revokeObjectURL" in value) return value;
}
/** @param {number | undefined} value @returns {number | undefined} */
function positiveNumberOrUndefined$2(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
/** @param {number | undefined} value @returns {number | undefined} */
function finiteNumberOrUndefined(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/** @param {number | undefined} value @returns {number} */
function finiteNumberOrZero$1(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
/** @param {number} value @returns {number} */
function finiteNonNegative$1(value) {
	return Number.isFinite(value) && value >= 0 ? value : 0;
}
/** @param {unknown} value @param {"name" | "message"} field @returns {string | undefined} */
function readErrorField(value, field) {
	if (value && typeof value === "object" && field in value) {
		const fieldValue = value[field];
		return typeof fieldValue === "string" ? fieldValue : void 0;
	}
}
//#endregion
//#region ../aerobeat-web-renderer/src/gameplay-plan.js
/** @typedef {"flow" | "boxing_spatial_grid" | "boxing_semantic_track"} AeroGameplayPresentation */
/** @typedef {"left" | "right" | "guard" | "obstacle" | "neutral" | "safe"} AeroVisualRole */
/** @typedef {"rect" | "circle" | "ring" | "hatch" | "icon" | "line"} AeroDrawKind */
/** @typedef {{x:number,y:number,width:number,height:number}} AeroNormalizedRect */
/** @typedef {{kind:AeroDrawKind, role:AeroVisualRole, rect:AeroNormalizedRect, alpha:number, scale:number, saturation:number, iconId:string|null, hatch:boolean, contrast:boolean, layer:number, targetId:string|null}} AeroGameplayDrawCommand */
/** @typedef {{id:string, kind:"flow"|"punch"|"guard"|"obstacle"|"safe", hand:"left"|"right"|"both"|"neutral", family:"straight"|"hook"|"uppercut"|"flow"|"guard"|"crossed_guard"|"squat"|"weave"|"obstacle"|"safe", cell:number|null, cells:readonly number[], lane:"left"|"right"|null, beatCenterMs:number, approachLeadMs?:number, judgement?:"pending"|"hit"|"miss", feedbackProgress?:number, direction?:import("@aerobeat/web-contracts/body-grid-contracts").AeroBodyGridDirection|null}} AeroRenderableTarget */
/** @typedef {{presentation:AeroGameplayPresentation, nowMs:number, targets:readonly AeroRenderableTarget[], blockedCells?:readonly number[], safeCells?:readonly number[], countdown?:number|null, overlay?:"none"|"paused"|"calibrating"|"tracking_lost", calibrationDim?:number, viewportAspect?:number, theme?:Readonly<Record<string, unknown>>, tuning?:Readonly<Record<string, unknown>>}} AeroGameplayFrame */
/** @typedef {{id:string, version:string, hash:string, gridInset:number, gridGap:number, receptorAlpha:number, approachRingScale:number, approachRingWidth:number, laneWidth:number, roleScale:number, dprCap:number}} AeroRendererTuning */
/** @typedef {{leftHandColor:string,rightHandColor:string,guardColor:string,obstacleColor:string,receptorColor:string,approachLeadMs:number,targetStartScale:number,targetHitScale:number,approachEasing:string,hitEasing:string,missEasing:string}} AeroRendererThemeTokens */
/** @typedef {{commands:readonly AeroGameplayDrawCommand[], overlay:Readonly<{kind:string,dim:number,countdown:number|null}>, presentation:AeroGameplayPresentation, grid:Readonly<{x:number,y:number,width:number,height:number,columns:4,rows:3}>}} AeroGameplayRenderPlan */
/** @type {AeroRendererTuning} */
var defaultRendererTuning = Object.freeze({
	id: "aero.renderer.prototype.default",
	version: "1",
	hash: "visual-538685f6",
	gridInset: .055,
	gridGap: .018,
	receptorAlpha: .22,
	approachRingScale: 1.55,
	approachRingWidth: .08,
	laneWidth: .22,
	roleScale: 1,
	dprCap: 2
});
/** @type {AeroRendererThemeTokens} */
var defaultRendererThemeTokens = Object.freeze({
	leftHandColor: "#2693ff",
	rightHandColor: "#39c96b",
	guardColor: "#9a67ea",
	obstacleColor: "#e5484d",
	receptorColor: "#d9f5ff",
	approachLeadMs: 900,
	targetStartScale: .48,
	targetHitScale: 1,
	approachEasing: "linear",
	hitEasing: "ease-out",
	missEasing: "ease-out"
});
/** Stable branding semantic IDs consumed by the alpha-mask atlas. */
var gameplayIconIds = Object.freeze([
	"boxing.glove",
	"boxing.guard.crossed",
	"boxing.guard.standard",
	"boxing.hook.left",
	"boxing.hook.right",
	"boxing.squat",
	"boxing.straight.left",
	"boxing.straight.right",
	"boxing.uppercut.left",
	"boxing.uppercut.right",
	"boxing.weave.left",
	"boxing.weave.right",
	"calibration.tpose"
]);
/**
* Build a deterministic, screenshot-free renderer command plan. The visible playfield
* is normalized screen space and never consumes camera/athlete-grid coordinates.
*
* @param {AeroGameplayFrame} frame
* @param {AeroRendererThemeTokens} [theme]
* @param {AeroRendererTuning} [tuning]
* @returns {AeroGameplayRenderPlan}
*/
function buildGameplayRenderPlan(frame, theme = defaultRendererThemeTokens, tuning = defaultRendererTuning) {
	if (!isPresentation(frame.presentation) || !Number.isFinite(frame.nowMs) || !Array.isArray(frame.targets)) throw new TypeError("Gameplay frame is invalid");
	const grid = fitPlayfieldGrid(tuning.gridInset, frame.viewportAspect);
	/** @type {AeroGameplayDrawCommand[]} */
	const commands = [];
	if (frame.presentation === "boxing_semantic_track") addTrack(commands, tuning, frame.viewportAspect);
	else addGridReceptors(commands, grid, tuning);
	for (const cell of frame.safeCells ?? []) {
		const rect = cellRect(cell, grid, tuning.gridGap);
		if (rect) commands.push(command("hatch", "safe", rect, .22, 1, null, true, 1, null));
	}
	for (const cell of frame.blockedCells ?? []) {
		const rect = cellRect(cell, grid, tuning.gridGap);
		if (rect) commands.push(command("hatch", "obstacle", rect, .72, 1, null, true, 3, null));
	}
	for (const target of frame.targets) addTarget(commands, frame, target, grid, theme, tuning);
	const overlayKind = frame.overlay ?? "none";
	const defaultDim = overlayKind === "none" ? 0 : .62;
	return Object.freeze({
		commands: Object.freeze(commands.sort((a, b) => a.layer - b.layer)),
		overlay: Object.freeze({
			kind: overlayKind,
			dim: clamp$3(frame.calibrationDim ?? defaultDim, 0, 1),
			countdown: normalizeCountdown(frame.countdown)
		}),
		presentation: frame.presentation,
		grid
	});
}
/**
* Fit a physical 4:3 playfield into any normalized viewport. Normalized widths are
* compensated by viewport aspect so 4x3 cells and icons remain physically square.
*
* @param {number} inset
* @param {number|undefined} viewportAspect
* @returns {Readonly<{x:number,y:number,width:number,height:number,columns:4,rows:3}>}
*/
function fitPlayfieldGrid(inset, viewportAspect) {
	const aspect = Number.isFinite(viewportAspect) && Number(viewportAspect) > 0 ? Number(viewportAspect) : 4 / 3;
	const available = Math.max(.02, 1 - clamp$3(inset, 0, .25) * 2);
	const playfieldAspect = 4 / 3;
	const width = aspect >= playfieldAspect ? available * playfieldAspect / aspect : available;
	const height = aspect >= playfieldAspect ? available : available * aspect / playfieldAspect;
	return Object.freeze({
		x: (1 - width) / 2,
		y: (1 - height) / 2,
		width,
		height,
		columns: 4,
		rows: 3
	});
}
/** @param {AeroGameplayDrawCommand[]} commands @param {AeroRendererTuning} tuning @param {number|undefined} viewportAspect */
function addTrack(commands, tuning, viewportAspect) {
	const track = trackGeometry(tuning, viewportAspect);
	commands.push(command("rect", "left", {
		x: track.leftX,
		y: track.y,
		width: track.width,
		height: track.height
	}, .12, 1, null, false, 0, null));
	commands.push(command("rect", "right", {
		x: track.rightX,
		y: track.y,
		width: track.width,
		height: track.height
	}, .12, 1, null, false, 0, null));
	const lineHeight = Math.min(.008, track.targetHeight * .05);
	commands.push(command("line", "neutral", {
		x: track.leftX,
		y: track.receptorY + track.targetHeight / 2,
		width: track.width,
		height: lineHeight
	}, .68, 1, null, false, 1, null));
	commands.push(command("line", "neutral", {
		x: track.rightX,
		y: track.receptorY + track.targetHeight / 2,
		width: track.width,
		height: lineHeight
	}, .68, 1, null, false, 1, null));
}
/** @param {AeroRendererTuning} tuning @param {number|undefined} viewportAspect */
function trackGeometry(tuning, viewportAspect) {
	const aspect = Number.isFinite(viewportAspect) && Number(viewportAspect) > 0 ? Number(viewportAspect) : 4 / 3;
	const gap = .1;
	const y = .08;
	const height = .84;
	const width = Math.min(tuning.laneWidth, height * .32 / aspect);
	const leftX = .5 - gap / 2 - width;
	const rightX = .55;
	const targetHeight = width * aspect;
	return {
		width,
		leftX,
		rightX,
		y,
		height,
		targetHeight,
		receptorY: .9199999999999999 - targetHeight
	};
}
/** @param {AeroGameplayDrawCommand[]} commands @param {{x:number,y:number,width:number,height:number}} grid @param {AeroRendererTuning} tuning */
function addGridReceptors(commands, grid, tuning) {
	for (let cell = 0; cell < 12; cell += 1) {
		const rect = cellRect(cell, grid, tuning.gridGap);
		if (rect) commands.push(command("rect", "neutral", rect, tuning.receptorAlpha, 1, null, false, 0, null));
	}
}
/** @param {AeroGameplayDrawCommand[]} commands @param {AeroGameplayFrame} frame @param {AeroRenderableTarget} target @param {{x:number,y:number,width:number,height:number}} grid @param {AeroRendererThemeTokens} theme @param {AeroRendererTuning} tuning */
function addTarget(commands, frame, target, grid, theme, tuning) {
	const role = target.hand === "left" ? "left" : target.hand === "right" ? "right" : target.kind === "obstacle" ? "obstacle" : target.kind === "safe" ? "safe" : target.kind === "guard" ? "guard" : "neutral";
	const lead = Math.max(1, target.approachLeadMs ?? theme.approachLeadMs);
	const progress = applyNamedEasing(clamp$3(1 - (target.beatCenterMs - frame.nowMs) / lead, 0, 1), theme.approachEasing);
	const feedback = applyNamedEasing(clamp$3(target.feedbackProgress ?? 0, 0, 1), target.judgement === "miss" ? theme.missEasing : theme.hitEasing);
	let scale = lerp$1(theme.targetStartScale, theme.targetHitScale, progress);
	let alpha = lerp$1(.35, 1, progress);
	if (target.judgement === "hit") {
		scale *= 1 - feedback * .65;
		alpha *= 1 - feedback;
	} else if (target.judgement === "miss") {
		scale *= 1 + feedback * .12;
		alpha *= 1 - feedback * .9;
	}
	const rects = targetRects(frame.presentation, target, grid, tuning, frame.viewportAspect);
	for (const targetRect of rects) {
		const baseRect = scaledRect(targetRect, tuning.roleScale);
		const rect = scaledRect(baseRect, scale);
		const iconId = iconIdFor(target);
		const kind = target.kind === "obstacle" ? "hatch" : iconId ? "icon" : "circle";
		commands.push(command(kind, role, rect, alpha, scale, iconId, target.kind === "obstacle", 4, target.id, progress));
		if (target.direction) for (const cue of directionCueRects(rect, target.direction)) commands.push(command(cue.kind, role, cue.rect, alpha, scale, null, false, 5, target.id, progress, true));
		if (target.judgement === void 0 || target.judgement === "pending") commands.push(command("ring", role, scaledRect(baseRect, lerp$1(tuning.approachRingScale, 1, progress)), .85, lerp$1(tuning.approachRingScale, 1, progress), null, false, 5, target.id, progress));
	}
}
/** @param {AeroGameplayPresentation} presentation @param {AeroRenderableTarget} target @param {{x:number,y:number,width:number,height:number}} grid @param {AeroRendererTuning} tuning @param {number|undefined} viewportAspect @returns {AeroNormalizedRect[]} */
function targetRects(presentation, target, grid, tuning, viewportAspect) {
	if (presentation === "boxing_semantic_track" && target.kind !== "obstacle") {
		const track = trackGeometry(tuning, viewportAspect);
		if (target.kind === "guard") return [{
			x: track.leftX,
			y: track.receptorY,
			width: track.rightX + track.width - track.leftX,
			height: track.targetHeight
		}];
		return [{
			x: (target.lane ?? target.hand) === "left" ? track.leftX : track.rightX,
			y: track.receptorY,
			width: track.width,
			height: track.targetHeight
		}];
	}
	const cells = target.cells.length > 0 ? target.cells : target.cell === null ? [] : [target.cell];
	if (target.kind === "guard" && cells.length >= 2) {
		const first = cellRect(cells[0], grid, tuning.gridGap);
		const second = cellRect(cells[1], grid, tuning.gridGap);
		if (!first || !second) return [];
		const left = Math.min(first.x, second.x);
		const top = Math.min(first.y, second.y);
		return [{
			x: left,
			y: top,
			width: Math.max(first.x + first.width, second.x + second.width) - left,
			height: Math.max(first.y + first.height, second.y + second.height) - top
		}];
	}
	return cells.map((cell) => cellRect(cell, grid, tuning.gridGap)).filter((rect) => rect !== null);
}
/** @param {number} cell @param {{x:number,y:number,width:number,height:number}} grid @param {number} gap @returns {AeroNormalizedRect|null} */
function cellRect(cell, grid, gap = 0) {
	if (!Number.isInteger(cell) || cell < 0 || cell >= 12) return null;
	const column = cell % 4;
	const row = Math.floor(cell / 4);
	const width = grid.width / 4;
	const height = grid.height / 3;
	return Object.freeze({
		x: grid.x + column * width + gap / 2,
		y: grid.y + row * height + gap / 2,
		width: width - gap,
		height: height - gap
	});
}
/** @param {AeroRenderableTarget} target @returns {string|null} */
function iconIdFor(target) {
	if (target.kind === "guard") return target.family === "crossed_guard" ? "boxing.guard.crossed" : "boxing.guard.standard";
	if (target.kind === "punch") return `boxing.${target.family}.${target.hand}`;
	if (target.family === "squat") return "boxing.squat";
	if (target.family === "weave" && (target.hand === "left" || target.hand === "right")) return `boxing.weave.${target.hand}`;
	return null;
}
/** @param {AeroDrawKind} kind @param {AeroVisualRole} role @param {AeroNormalizedRect} rect @param {number} alpha @param {number} scale @param {string|null} iconId @param {boolean} hatch @param {number} layer @param {string|null} targetId @param {number} [saturation] @param {boolean} [contrast] @returns {AeroGameplayDrawCommand} */
function command(kind, role, rect, alpha, scale, iconId, hatch, layer, targetId, saturation = 1, contrast = false) {
	return Object.freeze({
		kind,
		role,
		rect: Object.freeze({ ...rect }),
		alpha,
		scale,
		saturation: clamp$3(saturation, 0, 1),
		iconId,
		hatch,
		contrast,
		layer,
		targetId
	});
}
/** @param {AeroNormalizedRect} rect @param {import("@aerobeat/web-contracts/body-grid-contracts").AeroBodyGridDirection} direction @returns {readonly {kind:"line"|"circle",rect:AeroNormalizedRect}[]} */
function directionCueRects(rect, direction) {
	if (![
		"up",
		"up-right",
		"right",
		"down-right",
		"down",
		"down-left",
		"left",
		"up-left"
	].includes(direction)) throw new TypeError("Flow direction cue is unsupported");
	const thickness = Math.min(rect.width, rect.height) * .09;
	if (!direction.includes("-")) {
		const shaft = direction === "left" || direction === "right" ? {
			x: rect.x + rect.width * .25,
			y: rect.y + rect.height * .5 - thickness / 2,
			width: rect.width * .5,
			height: thickness
		} : {
			x: rect.x + rect.width * .5 - thickness / 2,
			y: rect.y + rect.height * .25,
			width: thickness,
			height: rect.height * .5
		};
		const size = thickness * 2.5;
		const headX = direction === "left" ? rect.x + rect.width * .2 : direction === "right" ? rect.x + rect.width * .8 : rect.x + rect.width * .5;
		const headY = direction === "up" ? rect.y + rect.height * .2 : direction === "down" ? rect.y + rect.height * .8 : rect.y + rect.height * .5;
		return Object.freeze([{
			kind: "line",
			rect: Object.freeze(shaft)
		}, {
			kind: "circle",
			rect: Object.freeze({
				x: headX - size / 2,
				y: headY - size / 2,
				width: size,
				height: size
			})
		}]);
	}
	const xSign = direction.endsWith("right") ? 1 : -1;
	const ySign = direction.startsWith("down") ? 1 : -1;
	const segments = 7;
	/** @type {{kind:"line"|"circle",rect:AeroNormalizedRect}[]} */
	const cues = [];
	for (let index = 0; index < segments; index += 1) {
		const offset = -.2 + index * (.4 / 6);
		const centerX = rect.x + rect.width * (.5 + xSign * offset);
		const centerY = rect.y + rect.height * (.5 + ySign * offset);
		cues.push({
			kind: "line",
			rect: Object.freeze({
				x: centerX - thickness / 2,
				y: centerY - thickness / 2,
				width: thickness,
				height: thickness
			})
		});
	}
	const size = thickness * 2.5;
	const headX = rect.x + rect.width * (.5 + xSign * .3);
	const headY = rect.y + rect.height * (.5 + ySign * .3);
	cues.push({
		kind: "circle",
		rect: Object.freeze({
			x: headX - size / 2,
			y: headY - size / 2,
			width: size,
			height: size
		})
	});
	return Object.freeze(cues);
}
/** @param {AeroNormalizedRect} rect @param {number} scale @returns {AeroNormalizedRect} */
function scaledRect(rect, scale) {
	const width = rect.width * scale;
	const height = rect.height * scale;
	return {
		x: rect.x + (rect.width - width) / 2,
		y: rect.y + (rect.height - height) / 2,
		width,
		height
	};
}
/** @param {unknown} value @returns {value is AeroGameplayPresentation} */
function isPresentation(value) {
	return value === "flow" || value === "boxing_spatial_grid" || value === "boxing_semantic_track";
}
/** @param {number|undefined|null} value @returns {number|null} */
function normalizeCountdown(value) {
	return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 3 ? Number(value) : null;
}
/** @param {number} value @param {number} minimum @param {number} maximum */
function clamp$3(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, value));
}
/** @param {number} progress @param {string} easing @returns {number} */
function applyNamedEasing(progress, easing) {
	const value = clamp$3(progress, 0, 1);
	if (easing === "ease-in") return value * value;
	if (easing === "ease-out") return 1 - (1 - value) * (1 - value);
	if (easing === "ease-in-out") return value < .5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
	return value;
}
/** @param {number} start @param {number} end @param {number} progress */
function lerp$1(start, end, progress) {
	return start + (end - start) * progress;
}
//#endregion
//#region ../aerobeat-web-renderer/src/icon-atlas.js
/**
* Narrow atlas bytes and UV metadata before they become private GPU state.
* Every semantic icon is required; malformed or colored RGB inputs degrade to shapes.
*
* @param {unknown} value
* @returns {AeroIconAtlasData}
*/
function normalizeIconAtlasData(value) {
	if (!isRecord$2(value) || !Number.isInteger(value.width) || !Number.isInteger(value.height) || Number(value.width) <= 0 || Number(value.height) <= 0 || Number(value.width) > 4096 || Number(value.height) > 4096 || !(value.pixels instanceof Uint8Array) || !Array.isArray(value.entries)) throw new TypeError("Icon atlas data is invalid");
	const width = Number(value.width);
	const height = Number(value.height);
	if (value.pixels.length !== width * height * 4) throw new TypeError("Icon atlas pixel length is invalid");
	for (let index = 0; index < value.pixels.length; index += 4) if (value.pixels[index] !== 255 || value.pixels[index + 1] !== 255 || value.pixels[index + 2] !== 255) throw new TypeError("Icon atlas RGB must be normalized white");
	/** @type {AeroIconAtlasEntry[]} */
	const entries = [];
	const seen = /* @__PURE__ */ new Set();
	for (const raw of value.entries) {
		if (!isRecord$2(raw) || typeof raw.id !== "string" || !gameplayIconIds.includes(raw.id) || seen.has(raw.id) || ![
			raw.u0,
			raw.v0,
			raw.u1,
			raw.v1
		].every((entry) => typeof entry === "number" && Number.isFinite(entry) && entry >= 0 && entry <= 1) || Number(raw.u0) >= Number(raw.u1) || Number(raw.v0) >= Number(raw.v1)) throw new TypeError("Icon atlas entry is invalid");
		seen.add(raw.id);
		entries.push(Object.freeze({
			id: raw.id,
			u0: Number(raw.u0),
			v0: Number(raw.v0),
			u1: Number(raw.u1),
			v1: Number(raw.v1)
		}));
	}
	if (entries.length !== gameplayIconIds.length || gameplayIconIds.some((id) => !seen.has(id))) throw new TypeError("Icon atlas does not contain the expected semantic set");
	return Object.freeze({
		width,
		height,
		pixels: value.pixels.slice(),
		entries: Object.freeze(entries)
	});
}
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord$2(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
//#endregion
//#region ../aerobeat-web-renderer/src/landmark-mapping.js
/**
* Media fitting modes shared with `@aerobeat/web-video` descriptors.
*
* @typedef {"stretch" | "contain" | "cover"} AeroRendererFitMode
*/
/**
* Normalized pose or hand landmark accepted by the renderer overlay path.
*
* @typedef {object} AeroNormalizedLandmark
* @property {number | undefined} id Optional landmark identifier.
* @property {number} x Normalized horizontal position in source media space.
* @property {number} y Normalized vertical position in source media space.
* @property {number | undefined} z Optional normalized depth.
* @property {number | undefined} v Optional visibility/confidence.
*/
/**
* Pixel rectangle occupied by fitted media content inside a render viewport.
*
* @typedef {object} AeroRendererContentRect
* @property {number} x Left edge in viewport pixels.
* @property {number} y Top edge in viewport pixels.
* @property {number} width Width in viewport pixels.
* @property {number} height Height in viewport pixels.
*/
/**
* Surface metadata used to map normalized landmarks over media. It is designed
* to accept public metadata from `@aerobeat/web-video` without importing that
* package or owning its lifecycle.
*
* @typedef {object} AeroRendererOverlaySurfaceDescriptor
* @property {number} viewportWidth Canvas drawing-buffer or viewport width.
* @property {number} viewportHeight Canvas drawing-buffer or viewport height.
* @property {number | undefined} intrinsicWidth Source media intrinsic width.
* @property {number | undefined} intrinsicHeight Source media intrinsic height.
* @property {AeroRendererFitMode} fitMode Presentation fit mode.
* @property {boolean} mirrored Whether normalized x should be mirrored.
* @property {AeroRendererContentRect | undefined} contentRect Explicit fitted media rectangle, when already known.
*/
/**
* Viewport-space landmark after fitting and mirroring.
*
* @typedef {object} AeroViewportLandmark
* @property {number | undefined} id Optional landmark identifier.
* @property {number} x Pixel-space horizontal position.
* @property {number} y Pixel-space vertical position.
* @property {number | undefined} z Optional normalized depth.
* @property {number | undefined} v Optional visibility/confidence.
*/
/**
* Clip-space landmark suitable for direct WebGL2 drawing.
*
* @typedef {object} AeroClipSpaceLandmark
* @property {number | undefined} id Optional landmark identifier.
* @property {number} x Clip-space horizontal position.
* @property {number} y Clip-space vertical position.
* @property {number | undefined} z Optional normalized depth.
* @property {number | undefined} v Optional visibility/confidence.
*/
/**
* @typedef {object} AeroRendererOverlaySurfaceDescriptorInput
* @property {number} [viewportWidth] Canvas drawing-buffer or viewport width.
* @property {number} [viewportHeight] Canvas drawing-buffer or viewport height.
* @property {number} [width] Alternate viewport width.
* @property {number} [height] Alternate viewport height.
* @property {number} [intrinsicWidth] Source media intrinsic width.
* @property {number} [intrinsicHeight] Source media intrinsic height.
* @property {number} [videoWidth] Alternate source media width.
* @property {number} [videoHeight] Alternate source media height.
* @property {AeroRendererFitMode} [fitMode] Presentation fit mode.
* @property {boolean} [mirrored] Whether normalized x should be mirrored.
* @property {boolean} [mirror] Alternate mirror flag.
* @property {AeroRendererContentRect} [contentRect] Explicit fitted media rectangle.
*/
/**
* Normalizes a partial descriptor into the renderer's mapping shape.
*
* @param {AeroRendererOverlaySurfaceDescriptorInput} [descriptor]
* @returns {AeroRendererOverlaySurfaceDescriptor}
*/
function normalizeOverlaySurfaceDescriptor(descriptor = {}) {
	return {
		viewportWidth: positiveNumberOrZero(descriptor.viewportWidth ?? descriptor.width),
		viewportHeight: positiveNumberOrZero(descriptor.viewportHeight ?? descriptor.height),
		intrinsicWidth: positiveNumberOrUndefined$1(descriptor.intrinsicWidth ?? descriptor.videoWidth),
		intrinsicHeight: positiveNumberOrUndefined$1(descriptor.intrinsicHeight ?? descriptor.videoHeight),
		fitMode: normalizeFitMode$1(descriptor.fitMode),
		mirrored: Boolean(descriptor.mirrored ?? descriptor.mirror ?? false),
		contentRect: descriptor.contentRect
	};
}
/**
* Computes the fitted media rectangle inside a viewport.
*
* @param {AeroRendererOverlaySurfaceDescriptorInput | AeroRendererOverlaySurfaceDescriptor} descriptor
* @returns {AeroRendererContentRect}
*/
function computeMediaContentRect(descriptor) {
	const surface = normalizeOverlaySurfaceDescriptor(descriptor);
	if (surface.contentRect) return sanitizeRect(surface.contentRect);
	if (surface.viewportWidth <= 0 || surface.viewportHeight <= 0) return {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	};
	if (surface.fitMode === "stretch" || !surface.intrinsicWidth || !surface.intrinsicHeight) return {
		x: 0,
		y: 0,
		width: surface.viewportWidth,
		height: surface.viewportHeight
	};
	const containScale = Math.min(surface.viewportWidth / surface.intrinsicWidth, surface.viewportHeight / surface.intrinsicHeight);
	const coverScale = Math.max(surface.viewportWidth / surface.intrinsicWidth, surface.viewportHeight / surface.intrinsicHeight);
	const scale = surface.fitMode === "cover" ? coverScale : containScale;
	const width = surface.intrinsicWidth * scale;
	const height = surface.intrinsicHeight * scale;
	return {
		x: (surface.viewportWidth - width) * .5,
		y: (surface.viewportHeight - height) * .5,
		width,
		height
	};
}
/**
* Maps a normalized landmark to viewport pixels, respecting fit and mirror.
*
* @param {AeroNormalizedLandmark} landmark
* @param {AeroRendererOverlaySurfaceDescriptorInput | AeroRendererOverlaySurfaceDescriptor} descriptor
* @returns {AeroViewportLandmark}
*/
function mapNormalizedLandmarkToViewport(landmark, descriptor) {
	const surface = normalizeOverlaySurfaceDescriptor(descriptor);
	const rect = computeMediaContentRect(surface);
	const normalizedX = clamp01$2(landmark.x);
	const x = surface.mirrored ? 1 - normalizedX : normalizedX;
	return {
		id: landmark.id,
		x: rect.x + x * rect.width,
		y: rect.y + clamp01$2(landmark.y) * rect.height,
		z: landmark.z,
		v: landmark.v
	};
}
/**
* Maps a normalized landmark to WebGL clip space.
*
* @param {AeroNormalizedLandmark} landmark
* @param {AeroRendererOverlaySurfaceDescriptorInput | AeroRendererOverlaySurfaceDescriptor} descriptor
* @returns {AeroClipSpaceLandmark}
*/
function mapNormalizedLandmarkToClipSpace(landmark, descriptor) {
	const surface = normalizeOverlaySurfaceDescriptor(descriptor);
	const viewport = mapNormalizedLandmarkToViewport(landmark, surface);
	return {
		id: landmark.id,
		x: surface.viewportWidth > 0 ? viewport.x / surface.viewportWidth * 2 - 1 : 0,
		y: surface.viewportHeight > 0 ? 1 - viewport.y / surface.viewportHeight * 2 : 0,
		z: landmark.z,
		v: landmark.v
	};
}
/**
* @param {AeroRendererFitMode | undefined} value
* @returns {AeroRendererFitMode}
*/
function normalizeFitMode$1(value) {
	return value === "cover" || value === "stretch" || value === "contain" ? value : "contain";
}
/**
* @param {number | undefined} value
* @returns {number}
*/
function positiveNumberOrZero(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
/**
* @param {number | undefined} value
* @returns {number | undefined}
*/
function positiveNumberOrUndefined$1(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
/**
* @param {number} value
* @returns {number}
*/
function clamp01$2(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.min(Math.max(value, 0), 1);
}
/**
* @param {AeroRendererContentRect} rect
* @returns {AeroRendererContentRect}
*/
function sanitizeRect(rect) {
	return {
		x: finiteNumberOrZero(rect.x),
		y: finiteNumberOrZero(rect.y),
		width: positiveNumberOrZero(rect.width),
		height: positiveNumberOrZero(rect.height)
	};
}
/**
* @param {number} value
* @returns {number}
*/
function finiteNumberOrZero(value) {
	return Number.isFinite(value) ? value : 0;
}
//#endregion
//#region ../aerobeat-web-renderer/src/visual-profiles.js
/** @typedef {import("./gameplay-plan.js").AeroRendererThemeTokens} AeroRendererThemeTokens */
/** @typedef {import("./gameplay-plan.js").AeroRendererTuning} AeroRendererTuning */
/** @typedef {{schema:"aerobeat/theme_descriptor",version:1,id:string,themeVersion:string,tokens:AeroRendererThemeTokens,contentHash:Readonly<{algorithm:string,value:string}>}} AeroThemeDescriptor */
/** @typedef {{kind:"solid"|"linear-gradient",colors:readonly string[],angleDeg:number}} AeroRendererBackgroundProjection */
/** @typedef {Readonly<{schema:"aerobeat/prototype_tuning_identity",version:1,profileId:string,profileVersion:string,contentHash:string,class:"live_visual",regenerationRequired:false}>} AeroRendererVisualIdentity */
/** @typedef {Readonly<{motionIntensity:number,roleScale:number}>} AeroRendererVisualSettings */
/** @typedef {Readonly<{identity:AeroRendererVisualIdentity,settings:AeroRendererVisualSettings}>} AeroRendererVisualProfileSelection */
var DEFAULT_VISUAL_HASH = "fdcf478c91e21ef88970299e29fcc35d574bfe69e0d7d00d9f823ee9507f39a3";
var COMPACT_VISUAL_HASH = "e65d53dfaafe8a859c08837acb3d447b10b03508bd5ae64677d273c93657d603";
/** @type {AeroRendererVisualProfileSelection} */
var defaultRendererVisualProfile = visualProfile("aero.visual.default", DEFAULT_VISUAL_HASH, 1, 1);
/** @type {AeroRendererVisualProfileSelection} */
var compactRendererVisualProfile = visualProfile("aero.visual.compact", COMPACT_VISUAL_HASH, .8, .86);
/**
* Narrow a public theme descriptor into renderer-owned immutable tokens.
*
* @param {unknown} value
* @returns {AeroRendererThemeTokens}
*/
function normalizeRendererTheme(value) {
	if (!isThemeDescriptor(value) || !isRecord$1(value.tokens)) return defaultRendererThemeTokens;
	const tokens = value.tokens;
	if (![
		"leftHandColor",
		"rightHandColor",
		"guardColor",
		"obstacleColor",
		"receptorColor"
	].every((name) => isRendererColorToken(tokens[name])) || ![
		"approachEasing",
		"hitEasing",
		"missEasing"
	].every((name) => isNamedEasing(tokens[name]))) return defaultRendererThemeTokens;
	if (typeof tokens.approachLeadMs !== "number" || !Number.isFinite(tokens.approachLeadMs) || tokens.approachLeadMs < 1 || tokens.approachLeadMs > 1e4 || typeof tokens.targetStartScale !== "number" || !Number.isFinite(tokens.targetStartScale) || tokens.targetStartScale < .05 || tokens.targetStartScale > 3 || typeof tokens.targetHitScale !== "number" || !Number.isFinite(tokens.targetHitScale) || tokens.targetHitScale < .05 || tokens.targetHitScale > 3) return defaultRendererThemeTokens;
	return Object.freeze({
		leftHandColor: String(tokens.leftHandColor),
		rightHandColor: String(tokens.rightHandColor),
		guardColor: String(tokens.guardColor),
		obstacleColor: String(tokens.obstacleColor),
		receptorColor: String(tokens.receptorColor),
		approachLeadMs: Number(tokens.approachLeadMs),
		targetStartScale: Number(tokens.targetStartScale),
		targetHitScale: Number(tokens.targetHitScale),
		approachEasing: String(tokens.approachEasing),
		hitEasing: String(tokens.hitEasing),
		missEasing: String(tokens.missEasing)
	});
}
/**
* Normalize renderer-only visual tuning. Scoring/converter values are deliberately absent.
*
* @param {unknown} value
* @returns {AeroRendererTuning}
*/
function normalizeRendererTuning(value) {
	if (!isRecord$1(value)) return defaultRendererTuning;
	const numberNames = [
		"gridInset",
		"gridGap",
		"receptorAlpha",
		"approachRingScale",
		"approachRingWidth",
		"laneWidth",
		"roleScale",
		"dprCap"
	];
	const requiredNames = [
		"id",
		"version",
		...numberNames
	];
	const keys = Object.keys(value);
	if (!keys.every((key) => requiredNames.includes(key) || key === "hash") || !requiredNames.every((key) => keys.includes(key)) || typeof value.id !== "string" || value.id.length === 0 || typeof value.version !== "string" || value.version.length === 0 || !numberNames.every((name) => typeof value[name] === "number" && Number.isFinite(value[name]))) return defaultRendererTuning;
	const normalized = {
		id: value.id,
		version: value.version,
		gridInset: clamp$2(Number(value.gridInset), 0, .25),
		gridGap: clamp$2(Number(value.gridGap), 0, .08),
		receptorAlpha: clamp$2(Number(value.receptorAlpha), 0, 1),
		approachRingScale: clamp$2(Number(value.approachRingScale), 1, 3),
		approachRingWidth: clamp$2(Number(value.approachRingWidth), .01, .3),
		laneWidth: clamp$2(Number(value.laneWidth), .1, .4),
		roleScale: clamp$2(Number(value.roleScale), .5, 1.5),
		dprCap: clamp$2(Number(value.dprCap), 1, 4)
	};
	const hash = stableVisualHash(normalized);
	if (value.hash !== void 0 && value.hash !== hash) return defaultRendererTuning;
	return Object.freeze({
		...normalized,
		hash
	});
}
/**
* Strictly narrow one public gameplay visual selection without depending on the
* gameplay package. Only the two content-hashed experimental Task 11 profiles
* are renderer inputs; scoring/converter identities never cross this adapter.
*
* @param {unknown} value
* @returns {AeroRendererVisualProfileSelection}
*/
function normalizeRendererVisualProfile(value) {
	const outer = exactDataRecord(value, ["identity", "settings"], "Visual profile selection");
	const identity = exactDataRecord(outer.identity, [
		"schema",
		"version",
		"profileId",
		"profileVersion",
		"contentHash",
		"class",
		"regenerationRequired"
	], "Visual profile identity");
	const settings = exactDataRecord(outer.settings, ["motionIntensity", "roleScale"], "Visual profile settings");
	if (identity.schema !== "aerobeat/prototype_tuning_identity" || identity.version !== 1 || identity.class !== "live_visual" || identity.regenerationRequired !== false) throw new TypeError("Visual profile identity is incompatible with live renderer tuning");
	for (const name of [
		"profileId",
		"profileVersion",
		"contentHash"
	]) if (typeof identity[name] !== "string" || identity[name].length === 0 || identity[name].length > 128) throw new TypeError(`Visual profile ${name} is invalid`);
	if (!/^[0-9a-f]{64}$/u.test(String(identity.contentHash))) throw new TypeError("Visual profile contentHash must be bare lowercase SHA-256");
	if (typeof settings.motionIntensity !== "number" || !Number.isFinite(settings.motionIntensity) || settings.motionIntensity < 0 || settings.motionIntensity > 2 || typeof settings.roleScale !== "number" || !Number.isFinite(settings.roleScale) || settings.roleScale < .5 || settings.roleScale > 1.5) throw new TypeError("Visual profile settings are outside renderer bounds");
	const normalized = visualProfile(String(identity.profileId), String(identity.contentHash), Number(settings.motionIntensity), Number(settings.roleScale), String(identity.profileVersion));
	const expected = normalized.identity.profileId === "aero.visual.default" ? defaultRendererVisualProfile : normalized.identity.profileId === "aero.visual.compact" ? compactRendererVisualProfile : null;
	if (!expected || !sameVisualSelection(normalized, expected)) throw new TypeError("Visual profile identity, settings, or content hash is not a supported experimental profile");
	return expected;
}
/** @param {AeroRendererVisualProfileSelection} profile @returns {AeroRendererTuning} */
function rendererTuningFromVisualProfile(profile) {
	const motionIntensity = profile.settings.motionIntensity;
	const roleScale = profile.settings.roleScale;
	return normalizeRendererTuning({
		id: profile.identity.profileId,
		version: profile.identity.profileVersion,
		gridInset: defaultRendererTuning.gridInset,
		gridGap: defaultRendererTuning.gridGap,
		receptorAlpha: defaultRendererTuning.receptorAlpha,
		approachRingScale: 1 + (defaultRendererTuning.approachRingScale - 1) * motionIntensity,
		approachRingWidth: defaultRendererTuning.approachRingWidth * Math.max(.5, motionIntensity),
		laneWidth: defaultRendererTuning.laneWidth,
		roleScale,
		dprCap: defaultRendererTuning.dprCap
	});
}
/**
* @param {unknown} value
* @returns {AeroRendererBackgroundProjection}
*/
function normalizeBackgroundProjection(value) {
	if (!isRecord$1(value) || !Object.keys(value).every((key) => key === "kind" || key === "colors" || key === "angleDeg") || value.kind !== "solid" && value.kind !== "linear-gradient" || !Array.isArray(value.colors) || value.colors.length === 0 || !value.colors.every(isRendererColorToken)) return Object.freeze({
		kind: "linear-gradient",
		colors: Object.freeze(["#071426", "#153b5d"]),
		angleDeg: 180
	});
	return Object.freeze({
		kind: value.kind,
		colors: Object.freeze(value.colors.map(String).slice(0, 4)),
		angleDeg: typeof value.angleDeg === "number" && Number.isFinite(value.angleDeg) ? value.angleDeg : 180
	});
}
/**
* Convert supported CSS tokens to linear renderer RGBA. Unknown CSS variables degrade
* to the supplied fallback instead of pretending WebGL can resolve the cascade.
*
* @param {string} token
* @param {readonly [number,number,number,number]} fallback
* @returns {readonly [number,number,number,number]}
*/
function colorTokenToRgba(token, fallback) {
	const hex = token.trim().match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/iu);
	if (hex) {
		const value = hex[1];
		return Object.freeze([
			parseInt(value.slice(0, 2), 16) / 255,
			parseInt(value.slice(2, 4), 16) / 255,
			parseInt(value.slice(4, 6), 16) / 255,
			value.length === 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1
		]);
	}
	const rgb = token.trim().match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/iu);
	if (rgb) return Object.freeze([
		clamp$2(Number(rgb[1]) / 255, 0, 1),
		clamp$2(Number(rgb[2]) / 255, 0, 1),
		clamp$2(Number(rgb[3]) / 255, 0, 1),
		clamp$2(rgb[4] === void 0 ? 1 : Number(rgb[4]), 0, 1)
	]);
	return fallback;
}
/** @param {Readonly<Record<string, string|number>>} value @returns {string} */
function stableVisualHash(value) {
	const canonical = Object.keys(value).sort().map((key) => `${key}:${String(value[key])}`).join("|");
	let hash = 2166136261;
	for (let index = 0; index < canonical.length; index += 1) {
		hash ^= canonical.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `visual-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
/** @param {unknown} value @returns {value is string} */
function isRendererColorToken(value) {
	if (typeof value !== "string" || value.length === 0 || value.length > 128) return false;
	return /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/iu.test(value.trim()) || /^rgba?\(\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?(?:\s*,\s*\d*(?:\.\d+)?)?\s*\)$/iu.test(value.trim());
}
/** @param {unknown} value @returns {value is string} */
function isNamedEasing(value) {
	return value === "linear" || value === "ease-in" || value === "ease-out" || value === "ease-in-out";
}
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord$1(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
/** @param {number} value @param {number} minimum @param {number} maximum */
function clamp$2(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, value));
}
/** @param {string} profileId @param {string} contentHash @param {number} motionIntensity @param {number} roleScale @param {string} [profileVersion] @returns {AeroRendererVisualProfileSelection} */
function visualProfile(profileId, contentHash, motionIntensity, roleScale, profileVersion = "1.0.0") {
	return Object.freeze({
		identity: Object.freeze({
			schema: "aerobeat/prototype_tuning_identity",
			version: 1,
			profileId,
			profileVersion,
			contentHash,
			class: "live_visual",
			regenerationRequired: false
		}),
		settings: Object.freeze({
			motionIntensity,
			roleScale
		})
	});
}
/** @param {unknown} value @param {readonly string[]} keys @param {string} label @returns {Record<string,unknown>} */
function exactDataRecord(value, keys, label) {
	if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length !== 0) throw new TypeError(`${label} must be a plain data record`);
	const descriptors = Object.getOwnPropertyDescriptors(value);
	const names = Object.keys(descriptors);
	if (names.length !== keys.length || !keys.every((key) => names.includes(key))) throw new TypeError(`${label} fields are invalid`);
	/** @type {Record<string,unknown>} */ const result = {};
	for (const key of keys) {
		const descriptor = descriptors[key];
		if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) throw new TypeError(`${label} must not contain accessors or hidden fields`);
		result[key] = descriptor.value;
	}
	return result;
}
/** @param {AeroRendererVisualProfileSelection} left @param {AeroRendererVisualProfileSelection} right */
function sameVisualSelection(left, right) {
	return left.identity.profileId === right.identity.profileId && left.identity.profileVersion === right.identity.profileVersion && left.identity.contentHash === right.identity.contentHash && left.settings.motionIntensity === right.settings.motionIntensity && left.settings.roleScale === right.settings.roleScale;
}
//#endregion
//#region ../aerobeat-web-renderer/src/renderer-facade.js
/** @type {"aero.renderer.webgl2"} */
var aeroWebGl2RendererServiceId = "aero.renderer.webgl2";
/** @typedef {import("./gameplay-plan.js").AeroGameplayFrame} AeroGameplayFrame */
/** @typedef {import("./gameplay-plan.js").AeroGameplayRenderPlan} AeroGameplayRenderPlan */
/** @typedef {import("./gameplay-plan.js").AeroRendererThemeTokens} AeroRendererThemeTokens */
/** @typedef {import("./gameplay-plan.js").AeroRendererTuning} AeroRendererTuning */
/** @typedef {import("./icon-atlas.js").AeroIconAtlasData} AeroIconAtlasData */
/** @typedef {import("./landmark-mapping.js").AeroNormalizedLandmark} AeroNormalizedLandmark */
/** @typedef {import("./landmark-mapping.js").AeroRendererOverlaySurfaceDescriptorInput} AeroRendererOverlaySurfaceDescriptorInput */
/** @typedef {"unsupported"|"ready"|"running"|"context_lost"|"error"|"destroyed"} AeroRendererState */
/** @typedef {{widthCssPx:number,heightCssPx:number,devicePixelRatio:number,maxDevicePixelRatio?:number}} AeroRendererResize */
/** @typedef {{surface?:AeroRendererOverlaySurfaceDescriptorInput,connections?:readonly (readonly [number,number])[],minVisibility?:number,color?:readonly [number,number,number,number],pointSize?:number}} AeroRendererOverlayOptions */
/** @typedef {"nose"|"left_wrist"|"right_wrist"} AeroGameplayCursorRole */
/** @typedef {{role:AeroGameplayCursorRole,x:number,y:number,confidence:number}} AeroGameplayCursor */
/** @typedef {{grid:Readonly<{x:number,y:number,width:number,height:number}>,minConfidence?:number,sizeCssPx?:number}} AeroGameplayCursorOptions */
/** @typedef {{status:AeroWebGl2RendererStatus,cursorCount:number,roles:readonly AeroGameplayCursorRole[]}} AeroGameplayCursorResult */
/** @typedef {{serviceId:"aero.renderer.webgl2",state:AeroRendererState,supported:boolean,attached:boolean,contextLost:boolean,destroyed:boolean,frameCount:number,drawCount:number,viewportWidth:number,viewportHeight:number,widthCssPx:number,heightCssPx:number,devicePixelRatio:number,themeId:string,themeVersion:string,themeHash:string,tuningId:string,tuningVersion:string,tuningHash:string,tuningRequiresRegeneration:false,visualProfile:import("./visual-profiles.js").AeroRendererVisualProfileSelection,visualProfileIdentity:import("./visual-profiles.js").AeroRendererVisualIdentity,visualProfileSettings:import("./visual-profiles.js").AeroRendererVisualSettings,experimental:true,iconAtlasReady:boolean,iconAtlasError:string|null,errorMessage:string|null}} AeroWebGl2RendererStatus */
/** @typedef {{serviceId:"aero.renderer.webgl2",webgl2:boolean,exactContainerResize:true,dprAware:true,contextLossRecovery:true,alphaMaskIcons:boolean,liveTuning:true,maxDevicePixelRatio:number,degradations:readonly string[]}} AeroWebGl2RendererCapabilities */
/** @typedef {{program:WebGLProgram,buffer:WebGLBuffer,positionLocation:number,localLocation:number,colorLocation:WebGLUniformLocation|null,shapeLocation:WebGLUniformLocation|null,ringWidthLocation:WebGLUniformLocation|null}} ShapeProgram */
/** @typedef {{program:WebGLProgram,buffer:WebGLBuffer,positionLocation:number,localLocation:number,colorLocation:WebGLUniformLocation|null,uvRectLocation:WebGLUniformLocation|null,samplerLocation:WebGLUniformLocation|null}} IconProgram */
/** @typedef {{program:WebGLProgram,buffer:WebGLBuffer,positionLocation:number,colorLocation:WebGLUniformLocation|null,pointSizeLocation:WebGLUniformLocation|null}} OverlayProgram */
/**
* Per-game renderer. No process-global singleton exists: each connected aero-game owns
* one instance and one canvas/context lifecycle.
*/
var AeroWebGl2Renderer = class {
	/** @param {{contextAttributes?:WebGLContextAttributes}} [options] */
	constructor(options = {}) {
		this.serviceId = aeroWebGl2RendererServiceId;
		this.contextAttributes = options.contextAttributes ?? {
			alpha: true,
			antialias: true,
			premultipliedAlpha: true
		};
		/** @type {HTMLCanvasElement|null} */ this.canvas = null;
		/** @type {WebGL2RenderingContext|null} */ this.gl = null;
		/** @type {ShapeProgram|null} */ this.shapeProgram = null;
		/** @type {IconProgram|null} */ this.iconProgram = null;
		/** @type {OverlayProgram|null} */ this.overlayProgram = null;
		/** @type {WebGLTexture|null} */ this.iconTexture = null;
		/** @type {AeroIconAtlasData|null} */ this.iconAtlasData = null;
		/** @type {Map<string, import("./icon-atlas.js").AeroIconAtlasEntry>} */ this.iconEntries = /* @__PURE__ */ new Map();
		/** @type {AeroRendererState} */ this.state = "unsupported";
		/** @type {AeroRendererThemeTokens} */ this.theme = defaultRendererThemeTokens;
		this.visualProfile = defaultRendererVisualProfile;
		/** @type {AeroRendererTuning} */ this.tuning = rendererTuningFromVisualProfile(this.visualProfile);
		this.themeId = "aero.theme.default";
		this.themeVersion = "1";
		this.themeHash = "theme-default";
		this.background = normalizeBackgroundProjection(null);
		this.iconAtlasError = null;
		this.errorMessage = null;
		this.frameCount = 0;
		this.drawCount = 0;
		this.widthCssPx = 0;
		this.heightCssPx = 0;
		this.devicePixelRatio = 1;
		this.contextLost = false;
		this.destroyed = false;
		this.onContextLost = (event) => {
			event.preventDefault();
			this.contextLost = true;
			this.state = "context_lost";
			this.releaseGpuReferences(false);
		};
		this.onContextRestored = () => {
			if (!this.canvas || this.destroyed) return;
			this.contextLost = false;
			this.acquireContext();
		};
	}
	/** @param {HTMLCanvasElement} canvas @param {WebGLContextAttributes} [options] @returns {AeroWebGl2RendererStatus} */
	attach(canvas, options = this.contextAttributes) {
		if (this.destroyed) return this.describe();
		if (this.canvas !== canvas) this.detach();
		this.canvas = canvas;
		this.contextAttributes = options;
		canvas.addEventListener("webglcontextlost", this.onContextLost);
		canvas.addEventListener("webglcontextrestored", this.onContextRestored);
		this.acquireContext();
		return this.describe();
	}
	/** @returns {AeroWebGl2RendererStatus} */
	detach() {
		if (this.canvas) {
			this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
			this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
		}
		this.deleteGpuResources();
		this.canvas = null;
		this.gl = null;
		this.contextLost = false;
		if (!this.destroyed) this.state = "unsupported";
		return this.describe();
	}
	/** @param {AeroRendererResize} size @returns {AeroWebGl2RendererStatus} */
	resize(size) {
		if (!this.canvas || this.destroyed) return this.describe();
		this.widthCssPx = finiteNonNegative(size.widthCssPx);
		this.heightCssPx = finiteNonNegative(size.heightCssPx);
		const cap = Math.max(1, Math.min(size.maxDevicePixelRatio ?? this.tuning.dprCap, this.tuning.dprCap));
		this.devicePixelRatio = Math.max(.1, Math.min(Number.isFinite(size.devicePixelRatio) ? size.devicePixelRatio : 1, cap));
		const width = Math.max(1, Math.round(this.widthCssPx * this.devicePixelRatio));
		const height = Math.max(1, Math.round(this.heightCssPx * this.devicePixelRatio));
		if (this.canvas.width !== width) this.canvas.width = width;
		if (this.canvas.height !== height) this.canvas.height = height;
		this.canvas.style.width = `${this.widthCssPx}px`;
		this.canvas.style.height = `${this.heightCssPx}px`;
		this.configureViewport();
		return this.describe();
	}
	/** @param {unknown} descriptor @returns {AeroWebGl2RendererStatus} */
	setTheme(descriptor) {
		if (this.destroyed) return this.describe();
		const normalized = normalizeRendererTheme(descriptor);
		const accepted = isThemeDescriptor(descriptor) && normalized !== defaultRendererThemeTokens;
		this.theme = normalized;
		this.themeId = accepted ? descriptor.id : "aero.theme.default";
		this.themeVersion = accepted ? descriptor.themeVersion : "1";
		this.themeHash = accepted ? descriptor.contentHash.value : "theme-default";
		return this.describe();
	}
	/** @param {unknown} selection @returns {AeroWebGl2RendererStatus} */
	setTuning(selection) {
		return this.importTuning(selection);
	}
	/** @param {unknown} selection @returns {AeroWebGl2RendererStatus} */
	importTuning(selection) {
		if (this.destroyed) return this.describe();
		const visualProfile = normalizeRendererVisualProfile(selection);
		const tuning = rendererTuningFromVisualProfile(visualProfile);
		this.visualProfile = visualProfile;
		this.tuning = tuning;
		return this.describe();
	}
	/** @returns {AeroWebGl2RendererStatus} */
	resetTuning() {
		if (!this.destroyed) {
			this.visualProfile = defaultRendererVisualProfile;
			this.tuning = rendererTuningFromVisualProfile(this.visualProfile);
		}
		return this.describe();
	}
	/** @returns {import("./visual-profiles.js").AeroRendererVisualProfileSelection} */
	exportTuning() {
		return this.visualProfile;
	}
	/** @returns {AeroWebGl2RendererStatus} */
	getSnapshot() {
		return this.describe();
	}
	/** @param {unknown} background @returns {AeroWebGl2RendererStatus} */
	setBackgroundProjection(background) {
		if (!this.destroyed) this.background = normalizeBackgroundProjection(background);
		return this.describe();
	}
	/** @param {AeroIconAtlasData} atlas @returns {AeroWebGl2RendererStatus} */
	uploadIconAtlas(atlas) {
		if (this.destroyed) return this.describe();
		let normalized;
		try {
			normalized = normalizeIconAtlasData(atlas);
		} catch (error) {
			if (this.gl && this.iconTexture) this.gl.deleteTexture(this.iconTexture);
			this.iconTexture = null;
			this.iconAtlasData = null;
			this.iconEntries.clear();
			this.iconAtlasError = error instanceof Error ? error.message : "Icon atlas is invalid";
			return this.describe();
		}
		this.iconAtlasData = normalized;
		this.iconEntries = new Map(normalized.entries.map((entry) => [entry.id, entry]));
		this.iconAtlasError = null;
		const gl = this.gl;
		if (!gl) return this.describe();
		if (this.iconTexture) gl.deleteTexture(this.iconTexture);
		const texture = gl.createTexture();
		if (!texture) {
			this.iconAtlasError = "Unable to create icon atlas texture";
			return this.describe();
		}
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, normalized.width, normalized.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, normalized.pixels);
		this.iconTexture = texture;
		return this.describe();
	}
	/** @param {AeroGameplayFrame} frame @returns {{status:AeroWebGl2RendererStatus,plan:AeroGameplayRenderPlan}} */
	renderGameplayFrame(frame) {
		const width = this.widthCssPx > 0 ? this.widthCssPx : this.gl?.drawingBufferWidth ?? 0;
		const height = this.heightCssPx > 0 ? this.heightCssPx : this.gl?.drawingBufferHeight ?? 0;
		const viewportAspect = frame.viewportAspect ?? (width > 0 && height > 0 ? width / height : 4 / 3);
		const plan = buildGameplayRenderPlan({
			...frame,
			viewportAspect
		}, this.theme, this.tuning);
		const gl = this.gl;
		if (!gl || this.destroyed || this.contextLost) return {
			status: this.describe(),
			plan
		};
		try {
			this.configureViewport();
			const background = colorTokenToRgba(this.background.colors[0], [
				.03,
				.08,
				.15,
				1
			]);
			gl.clearColor(background[0], background[1], background[2], background[3]);
			gl.clear(gl.COLOR_BUFFER_BIT);
			for (const draw of plan.commands) this.drawCommand(draw);
			if (plan.overlay.dim > 0) this.drawShape({
				x: 0,
				y: 0,
				width: 1,
				height: 1
			}, [
				0,
				0,
				0,
				plan.overlay.dim
			], 0, .08);
			if (plan.overlay.countdown !== null) this.drawCountdown(plan.overlay.countdown);
			this.frameCount += 1;
			this.state = "running";
		} catch (error) {
			this.fail(error);
		}
		return {
			status: this.describe(),
			plan
		};
	}
	/** @param {{color?:readonly [number,number,number,number]}} [options] */
	clear(options = {}) {
		const gl = this.gl;
		if (!gl || this.destroyed) return { status: this.describe() };
		const color = options.color ?? [
			0,
			0,
			0,
			0
		];
		this.configureViewport();
		gl.clearColor(...color);
		gl.clear(gl.COLOR_BUFFER_BIT);
		this.frameCount += 1;
		this.state = "running";
		return { status: this.describe() };
	}
	/** @param {{color?:readonly [number,number,number,number]}} [options] */
	renderFrame(options = {}) {
		return this.clear(options);
	}
	/** @param {readonly AeroNormalizedLandmark[]} landmarks @param {AeroRendererOverlayOptions} [options] */
	renderLandmarkOverlay(landmarks, options = {}) {
		const gl = this.gl;
		if (!gl || this.destroyed) return {
			status: this.describe(),
			pointCount: 0,
			lineVertexCount: 0
		};
		try {
			const program = this.overlayProgram ?? createOverlayProgram(gl);
			this.overlayProgram = program;
			const surface = normalizeOverlaySurfaceDescriptor({
				viewportWidth: gl.drawingBufferWidth,
				viewportHeight: gl.drawingBufferHeight,
				...options.surface
			});
			const visible = landmarks.filter((landmark) => (typeof landmark.v === "number" ? landmark.v : 1) >= (options.minVisibility ?? 0));
			const points = visible.flatMap((landmark) => {
				const clip = mapNormalizedLandmarkToClipSpace(landmark, surface);
				return [clip.x, clip.y];
			});
			const byId = new Map(visible.map((landmark) => [landmark.id, landmark]));
			/** @type {number[]} */ const lines = [];
			for (const pair of options.connections ?? []) {
				const a = byId.get(pair[0]);
				const b = byId.get(pair[1]);
				if (a && b) {
					const ac = mapNormalizedLandmarkToClipSpace(a, surface);
					const bc = mapNormalizedLandmarkToClipSpace(b, surface);
					lines.push(ac.x, ac.y, bc.x, bc.y);
				}
			}
			drawOverlay(gl, program, lines, gl.LINES, options);
			drawOverlay(gl, program, points, gl.POINTS, options);
			this.drawCount += 1;
			this.state = "running";
			return {
				status: this.describe(),
				pointCount: points.length / 2,
				lineVertexCount: lines.length / 2
			};
		} catch (error) {
			this.fail(error);
			return {
				status: this.describe(),
				pointCount: 0,
				lineVertexCount: 0
			};
		}
	}
	/**
	* Draws bounded semantic gameplay cursors after a gameplay frame. Coordinates are
	* already-calibrated athlete positions normalized within the supplied playfield grid.
	* The method is deliberately stateless: callers redraw current cursors after every
	* `renderGameplayFrame`, which keeps stale tracking evidence off the canvas.
	*
	* @param {readonly AeroGameplayCursor[]} cursors
	* @param {AeroGameplayCursorOptions} options
	* @returns {AeroGameplayCursorResult}
	*/
	renderGameplayCursors(cursors, options) {
		const normalizedOptions = normalizeGameplayCursorOptions(options);
		const grid = normalizeGameplayCursorGrid(normalizedOptions.grid);
		const minConfidence = Math.max(0, Math.min(1, finitePositiveOrZero(normalizedOptions.minConfidence, .5)));
		const sizeCssPx = Math.max(12, Math.min(64, finitePositive(normalizedOptions.sizeCssPx, 18)));
		const current = normalizeGameplayCursors(cursors, minConfidence);
		if (!this.gl || this.destroyed || this.contextLost || this.widthCssPx <= 0 || this.heightCssPx <= 0) return Object.freeze({
			status: this.describe(),
			cursorCount: 0,
			roles: Object.freeze([])
		});
		const roles = [];
		try {
			for (const role of gameplayCursorRoles) {
				const cursor = current.get(role);
				if (!cursor) continue;
				const centerX = grid.x + cursor.x * grid.width;
				const centerY = grid.y + cursor.y * grid.height;
				const centerColor = role === "nose" ? [
					1,
					.76,
					.04,
					1
				] : this.roleColor(role === "left_wrist" ? "left" : "right", 1, 1);
				this.drawCursorLayer(centerX, centerY, sizeCssPx, [
					0,
					0,
					0,
					1
				]);
				this.drawCursorLayer(centerX, centerY, sizeCssPx * .76, [
					1,
					1,
					1,
					1
				]);
				this.drawCursorLayer(centerX, centerY, sizeCssPx * .48, centerColor);
				roles.push(role);
				this.drawCount += 3;
			}
			if (roles.length > 0) this.state = "running";
			return Object.freeze({
				status: this.describe(),
				cursorCount: roles.length,
				roles: Object.freeze(roles)
			});
		} catch (error) {
			this.fail(error);
			return Object.freeze({
				status: this.describe(),
				cursorCount: 0,
				roles: Object.freeze([])
			});
		}
	}
	/** @returns {AeroWebGl2RendererCapabilities} */
	getCapabilities() {
		const degradations = [];
		if (!this.gl) degradations.push("webgl2_unavailable");
		if (!this.iconTexture) degradations.push(this.iconAtlasError ? "icon_atlas_invalid_fallback_shapes" : "icon_atlas_unavailable_fallback_shapes");
		if (this.background.kind === "linear-gradient" && this.background.colors.length > 1) degradations.push("gradient_background_projected_to_primary_color");
		return Object.freeze({
			serviceId: aeroWebGl2RendererServiceId,
			webgl2: Boolean(this.gl),
			exactContainerResize: true,
			dprAware: true,
			contextLossRecovery: true,
			alphaMaskIcons: Boolean(this.iconTexture),
			liveTuning: true,
			maxDevicePixelRatio: this.tuning.dprCap,
			degradations: Object.freeze(degradations)
		});
	}
	/** @returns {AeroWebGl2RendererStatus} */
	describe() {
		return Object.freeze({
			serviceId: aeroWebGl2RendererServiceId,
			state: this.state,
			supported: Boolean(this.gl),
			attached: Boolean(this.canvas && this.gl),
			contextLost: this.contextLost,
			destroyed: this.destroyed,
			frameCount: this.frameCount,
			drawCount: this.drawCount,
			viewportWidth: this.gl?.drawingBufferWidth ?? this.canvas?.width ?? 0,
			viewportHeight: this.gl?.drawingBufferHeight ?? this.canvas?.height ?? 0,
			widthCssPx: this.widthCssPx,
			heightCssPx: this.heightCssPx,
			devicePixelRatio: this.devicePixelRatio,
			themeId: this.themeId,
			themeVersion: this.themeVersion,
			themeHash: this.themeHash,
			tuningId: this.tuning.id,
			tuningVersion: this.tuning.version,
			tuningHash: this.tuning.hash,
			tuningRequiresRegeneration: false,
			visualProfile: this.visualProfile,
			visualProfileIdentity: this.visualProfile.identity,
			visualProfileSettings: this.visualProfile.settings,
			experimental: true,
			iconAtlasReady: Boolean(this.iconTexture),
			iconAtlasError: this.iconAtlasError,
			errorMessage: this.errorMessage
		});
	}
	/** @returns {AeroWebGl2RendererStatus} */
	destroy() {
		if (this.destroyed) return this.describe();
		this.destroyed = true;
		this.detach();
		this.state = "destroyed";
		this.iconEntries.clear();
		this.iconAtlasData = null;
		return this.describe();
	}
	acquireContext() {
		if (!this.canvas || this.destroyed) return;
		try {
			const context = this.canvas.getContext("webgl2", this.contextAttributes);
			if (!context) {
				this.gl = null;
				this.state = "unsupported";
				this.errorMessage = "WebGL2 is unavailable for this canvas";
				return;
			}
			this.gl = context;
			this.state = "ready";
			this.errorMessage = null;
			this.contextLost = false;
			context.enable(context.BLEND);
			context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
			this.configureViewport();
			if (this.iconAtlasData) this.uploadIconAtlas(this.iconAtlasData);
		} catch (error) {
			this.gl = null;
			this.fail(error);
		}
	}
	configureViewport() {
		if (this.gl) this.gl.viewport(0, 0, this.gl.drawingBufferWidth || this.canvas?.width || 1, this.gl.drawingBufferHeight || this.canvas?.height || 1);
	}
	/** @param {import("./gameplay-plan.js").AeroGameplayDrawCommand} draw */
	drawCommand(draw) {
		const color = draw.contrast ? this.cueContrastColor(draw.role, draw.alpha, draw.saturation) : this.roleColor(draw.role, draw.alpha, draw.saturation);
		if (draw.kind === "icon" && draw.iconId && this.iconTexture && this.iconEntries.has(draw.iconId)) this.drawIcon(draw.rect, color, this.iconEntries.get(draw.iconId));
		else this.drawShape(draw.rect, color, draw.kind === "circle" ? 1 : draw.kind === "ring" ? 2 : draw.kind === "hatch" ? 3 : 0, this.tuning.approachRingWidth);
		this.drawCount += 1;
	}
	/** @param {string} role @param {number} alpha @param {number} saturation @returns {readonly [number,number,number,number]} */
	roleColor(role, alpha, saturation) {
		const fallback = [
			.85,
			.95,
			1,
			alpha
		];
		const color = colorTokenToRgba(role === "left" ? this.theme.leftHandColor : role === "right" ? this.theme.rightHandColor : role === "guard" ? this.theme.guardColor : role === "obstacle" ? this.theme.obstacleColor : role === "safe" ? "#56d6c9" : this.theme.receptorColor, fallback);
		const gray = color[0] * .2126 + color[1] * .7152 + color[2] * .0722;
		return [
			gray + (color[0] - gray) * saturation,
			gray + (color[1] - gray) * saturation,
			gray + (color[2] - gray) * saturation,
			color[3] * alpha
		];
	}
	/** @param {string} role @param {number} alpha @param {number} saturation @returns {readonly [number,number,number,number]} */
	cueContrastColor(role, alpha, saturation) {
		const target = this.roleColor(role, alpha, saturation);
		const luminance = relativeLuminance(target[0], target[1], target[2]);
		const blackContrast = (luminance + .05) / .05;
		const channel = 1.05 / (luminance + .05) > blackContrast ? 1 : 0;
		return [
			channel,
			channel,
			channel,
			target[3]
		];
	}
	/** @param {number} centerX @param {number} centerY @param {number} diameterCssPx @param {readonly [number,number,number,number]} color */
	drawCursorLayer(centerX, centerY, diameterCssPx, color) {
		const width = diameterCssPx / this.widthCssPx;
		const height = diameterCssPx / this.heightCssPx;
		this.drawShape({
			x: centerX - width / 2,
			y: centerY - height / 2,
			width,
			height
		}, color, 1, 0);
	}
	/** @param {{x:number,y:number,width:number,height:number}} rect @param {readonly [number,number,number,number]} color @param {number} shape @param {number} ringWidth */
	drawShape(rect, color, shape, ringWidth) {
		const gl = this.gl;
		if (!gl) return;
		const program = this.shapeProgram ?? createShapeProgram(gl);
		this.shapeProgram = program;
		uploadQuad(gl, program.buffer, program.positionLocation, program.localLocation, rect);
		gl.useProgram(program.program);
		gl.uniform4f(program.colorLocation, ...color);
		gl.uniform1i(program.shapeLocation, shape);
		gl.uniform1f(program.ringWidthLocation, ringWidth);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
	/** @param {{x:number,y:number,width:number,height:number}} rect @param {readonly [number,number,number,number]} color @param {import("./icon-atlas.js").AeroIconAtlasEntry|undefined} entry */
	drawIcon(rect, color, entry) {
		const gl = this.gl;
		if (!gl || !entry || !this.iconTexture) return;
		const program = this.iconProgram ?? createIconProgram(gl);
		this.iconProgram = program;
		uploadQuad(gl, program.buffer, program.positionLocation, program.localLocation, rect);
		gl.useProgram(program.program);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.iconTexture);
		gl.uniform1i(program.samplerLocation, 0);
		gl.uniform4f(program.colorLocation, ...color);
		gl.uniform4f(program.uvRectLocation, entry.u0, entry.v0, entry.u1, entry.v1);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
	/** @param {number} value */
	drawCountdown(value) {
		const segments = countdownSegments(value);
		for (const rect of segments) this.drawShape(rect, [
			1,
			1,
			1,
			.94
		], 0, .1);
	}
	deleteGpuResources() {
		const gl = this.gl;
		if (gl) {
			for (const program of [
				this.shapeProgram,
				this.iconProgram,
				this.overlayProgram
			]) if (program) {
				gl.deleteBuffer(program.buffer);
				gl.deleteProgram(program.program);
			}
			if (this.iconTexture) gl.deleteTexture(this.iconTexture);
		}
		this.releaseGpuReferences(true);
	}
	/** @param {boolean} clearEntries */
	releaseGpuReferences(clearEntries) {
		this.shapeProgram = null;
		this.iconProgram = null;
		this.overlayProgram = null;
		this.iconTexture = null;
		if (clearEntries) this.iconEntries.clear();
	}
	/** @param {unknown} error */
	fail(error) {
		this.state = "error";
		this.errorMessage = error instanceof Error ? error.message : "Renderer operation failed";
	}
};
/** @param {{contextAttributes?:WebGLContextAttributes}} [options] @returns {AeroWebGl2Renderer} */
function createAeroWebGl2Renderer(options) {
	return new AeroWebGl2Renderer(options);
}
/** Canonical draw order also makes returned role evidence deterministic. @type {readonly AeroGameplayCursorRole[]} */
var gameplayCursorRoles = Object.freeze([
	"nose",
	"left_wrist",
	"right_wrist"
]);
var gameplayCursorRoleSet = new Set(gameplayCursorRoles);
var maxGameplayCursorCandidates = 12;
/**
* @param {unknown} value
* @returns {AeroGameplayCursorOptions}
*/
function normalizeGameplayCursorOptions(value) {
	if (!isPlainDataRecord$1(value)) throw new TypeError("Gameplay cursor options are required");
	const descriptors = Object.getOwnPropertyDescriptors(value);
	if (Object.keys(descriptors).some((key) => ![
		"grid",
		"minConfidence",
		"sizeCssPx"
	].includes(key))) throw new TypeError("Gameplay cursor options contain unsupported fields");
	if (!isDataDescriptor(descriptors.grid)) throw new TypeError("Gameplay cursor grid is required");
	for (const key of ["minConfidence", "sizeCssPx"]) if (descriptors[key] && !isDataDescriptor(descriptors[key])) throw new TypeError(`Gameplay cursor ${key} must be data`);
	return {
		grid: descriptors.grid.value,
		minConfidence: descriptors.minConfidence?.value,
		sizeCssPx: descriptors.sizeCssPx?.value
	};
}
/**
* Invalid and repeated semantic candidates are intentionally omitted. Candidate count is
* bounded before inspection so malformed callers cannot turn a three-cursor draw into
* unbounded work. Accessor-bearing records are never invoked.
* @param {unknown} value
* @param {number} minConfidence
* @returns {ReadonlyMap<AeroGameplayCursorRole,AeroGameplayCursor>}
*/
function normalizeGameplayCursors(value, minConfidence) {
	if (!Array.isArray(value)) throw new TypeError("Gameplay cursors must be an array");
	if (value.length > maxGameplayCursorCandidates) throw new TypeError(`Gameplay cursors cannot exceed ${maxGameplayCursorCandidates} candidates`);
	/** @type {Map<AeroGameplayCursorRole,AeroGameplayCursor>} */ const normalized = /* @__PURE__ */ new Map();
	for (const candidate of value) {
		if (!isPlainDataRecord$1(candidate)) continue;
		const descriptors = Object.getOwnPropertyDescriptors(candidate);
		if (Object.keys(descriptors).length !== 4 || [
			"role",
			"x",
			"y",
			"confidence"
		].some((key) => !isDataDescriptor(descriptors[key]))) continue;
		const role = descriptors.role.value;
		if (!gameplayCursorRoleSet.has(role) || normalized.has(role)) continue;
		const cursor = {
			role,
			x: descriptors.x.value,
			y: descriptors.y.value,
			confidence: descriptors.confidence.value
		};
		if (validGameplayCursor(cursor, minConfidence)) normalized.set(role, Object.freeze(cursor));
	}
	return normalized;
}
/** @param {unknown} value @returns {{x:number,y:number,width:number,height:number}} */
function normalizeGameplayCursorGrid(value) {
	if (!isPlainDataRecord$1(value)) throw new TypeError("Gameplay cursor grid is required");
	const descriptors = Object.getOwnPropertyDescriptors(value);
	const keys = [
		"x",
		"y",
		"width",
		"height"
	];
	const allowed = [
		...keys,
		"columns",
		"rows"
	];
	if (Object.keys(descriptors).some((key) => !allowed.includes(key)) || keys.some((key) => !isDataDescriptor(descriptors[key])) || ["columns", "rows"].some((key) => descriptors[key] && !isDataDescriptor(descriptors[key]))) throw new TypeError("Gameplay cursor grid must contain exact data coordinates");
	if (descriptors.columns && descriptors.columns.value !== 4 || descriptors.rows && descriptors.rows.value !== 3) throw new TypeError("Gameplay cursor grid dimensions must remain 4x3");
	const [x, y, width, height] = keys.map((key) => descriptors[key].value);
	if (![
		x,
		y,
		width,
		height
	].every((entry) => typeof entry === "number" && Number.isFinite(entry))) throw new TypeError("Gameplay cursor grid must contain finite coordinates");
	if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) throw new TypeError("Gameplay cursor grid must remain inside normalized viewport space");
	return {
		x,
		y,
		width,
		height
	};
}
/** @param {AeroGameplayCursor|undefined} cursor @param {number} minConfidence @returns {cursor is AeroGameplayCursor} */
function validGameplayCursor(cursor, minConfidence) {
	return Boolean(cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y) && cursor.x >= 0 && cursor.x <= 1 && cursor.y >= 0 && cursor.y <= 1 && Number.isFinite(cursor.confidence) && cursor.confidence >= minConfidence);
}
/** @param {unknown} value @returns {value is Record<string,unknown>} */
function isPlainDataRecord$1(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
/** @param {PropertyDescriptor|undefined} descriptor @returns {descriptor is PropertyDescriptor & {value:unknown}} */
function isDataDescriptor(descriptor) {
	return Boolean(descriptor && Object.hasOwn(descriptor, "value") && descriptor.get === void 0 && descriptor.set === void 0);
}
/** @param {number|undefined} value @param {number} fallback */
function finitePositive(value, fallback) {
	return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}
/** @param {number|undefined} value @param {number} fallback */
function finitePositiveOrZero(value, fallback) {
	return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : fallback;
}
/** @param {WebGL2RenderingContext} gl @returns {ShapeProgram} */
function createShapeProgram(gl) {
	const program = linkProgram(gl, QUAD_VERTEX, SHAPE_FRAGMENT);
	return {
		program,
		buffer: requiredBuffer(gl),
		positionLocation: gl.getAttribLocation(program, "a_position"),
		localLocation: gl.getAttribLocation(program, "a_local"),
		colorLocation: gl.getUniformLocation(program, "u_color"),
		shapeLocation: gl.getUniformLocation(program, "u_shape"),
		ringWidthLocation: gl.getUniformLocation(program, "u_ringWidth")
	};
}
/** @param {WebGL2RenderingContext} gl @returns {IconProgram} */
function createIconProgram(gl) {
	const program = linkProgram(gl, QUAD_VERTEX, ICON_FRAGMENT);
	return {
		program,
		buffer: requiredBuffer(gl),
		positionLocation: gl.getAttribLocation(program, "a_position"),
		localLocation: gl.getAttribLocation(program, "a_local"),
		colorLocation: gl.getUniformLocation(program, "u_color"),
		uvRectLocation: gl.getUniformLocation(program, "u_uvRect"),
		samplerLocation: gl.getUniformLocation(program, "u_mask")
	};
}
/** @param {WebGL2RenderingContext} gl @returns {OverlayProgram} */
function createOverlayProgram(gl) {
	const program = linkProgram(gl, `#version 300 es\nin vec2 a_position; uniform float u_pointSize; void main(){gl_Position=vec4(a_position,0.,1.);gl_PointSize=u_pointSize;}`, `#version 300 es\nprecision mediump float; uniform vec4 u_color; out vec4 outColor; void main(){outColor=u_color;}`);
	return {
		program,
		buffer: requiredBuffer(gl),
		positionLocation: gl.getAttribLocation(program, "a_position"),
		colorLocation: gl.getUniformLocation(program, "u_color"),
		pointSizeLocation: gl.getUniformLocation(program, "u_pointSize")
	};
}
/** @param {WebGL2RenderingContext} gl @param {string} vertex @param {string} fragment */
function linkProgram(gl, vertex, fragment) {
	const vs = compile(gl, gl.VERTEX_SHADER, vertex);
	const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
	const program = gl.createProgram();
	if (!program) throw new Error("Unable to create renderer program");
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	gl.deleteShader(vs);
	gl.deleteShader(fs);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Unable to link renderer program");
	return program;
}
/** @param {WebGL2RenderingContext} gl @param {number} type @param {string} source */
function compile(gl, type, source) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Unable to create renderer shader");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Unable to compile renderer shader");
	return shader;
}
/** @param {WebGL2RenderingContext} gl */
function requiredBuffer(gl) {
	const buffer = gl.createBuffer();
	if (!buffer) throw new Error("Unable to create renderer buffer");
	return buffer;
}
/** @param {WebGL2RenderingContext} gl @param {WebGLBuffer} buffer @param {number} positionLocation @param {number} localLocation @param {{x:number,y:number,width:number,height:number}} rect */
function uploadQuad(gl, buffer, positionLocation, localLocation, rect) {
	const x0 = rect.x * 2 - 1;
	const x1 = (rect.x + rect.width) * 2 - 1;
	const y0 = 1 - rect.y * 2;
	const y1 = 1 - (rect.y + rect.height) * 2;
	const values = new Float32Array([
		x0,
		y0,
		0,
		0,
		x1,
		y0,
		1,
		0,
		x0,
		y1,
		0,
		1,
		x0,
		y1,
		0,
		1,
		x1,
		y0,
		1,
		0,
		x1,
		y1,
		1,
		1
	]);
	gl.useProgram(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, values, gl.STREAM_DRAW);
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
	gl.enableVertexAttribArray(localLocation);
	gl.vertexAttribPointer(localLocation, 2, gl.FLOAT, false, 16, 8);
}
/** @param {WebGL2RenderingContext} gl @param {OverlayProgram} program @param {number[]} vertices @param {number} primitive @param {AeroRendererOverlayOptions} options */
function drawOverlay(gl, program, vertices, primitive, options) {
	if (vertices.length === 0) return;
	const color = options.color ?? [
		.24,
		.9,
		.45,
		.95
	];
	gl.useProgram(program.program);
	gl.bindBuffer(gl.ARRAY_BUFFER, program.buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
	gl.enableVertexAttribArray(program.positionLocation);
	gl.vertexAttribPointer(program.positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.uniform4f(program.colorLocation, ...color);
	gl.uniform1f(program.pointSizeLocation, options.pointSize ?? 6);
	gl.drawArrays(primitive, 0, vertices.length / 2);
}
/** @param {number} value @returns {readonly {x:number,y:number,width:number,height:number}[]} */
function countdownSegments(value) {
	const horizontal = (y) => ({
		x: .43,
		y,
		width: .14,
		height: .025
	});
	const left = (y) => ({
		x: .43,
		y,
		width: .025,
		height: .12
	});
	const right = (y) => ({
		x: .545,
		y,
		width: .025,
		height: .12
	});
	if (value === 1) return [right(.36), right(.51)];
	if (value === 2) return [
		horizontal(.34),
		right(.36),
		horizontal(.49),
		left(.51),
		horizontal(.64)
	];
	return [
		horizontal(.34),
		right(.36),
		horizontal(.49),
		right(.51),
		horizontal(.64)
	];
}
/** @param {number} value */
function finiteNonNegative(value) {
	return Number.isFinite(value) ? Math.max(0, value) : 0;
}
/** @param {number} red @param {number} green @param {number} blue */
function relativeLuminance(red, green, blue) {
	const linear = (channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
	return linear(red) * .2126 + linear(green) * .7152 + linear(blue) * .0722;
}
var QUAD_VERTEX = `#version 300 es
in vec2 a_position; in vec2 a_local; out vec2 v_local; void main(){v_local=a_local;gl_Position=vec4(a_position,0.,1.);}`;
var SHAPE_FRAGMENT = `#version 300 es
precision mediump float; in vec2 v_local; uniform vec4 u_color; uniform int u_shape; uniform float u_ringWidth; out vec4 outColor;
void main(){float d=distance(v_local,vec2(.5)); if(u_shape==1 && d>.5) discard; if(u_shape==2 && abs(d-.43)>u_ringWidth*.5) discard; vec4 color=u_color; if(u_shape==3 && mod(floor((v_local.x+v_local.y)*18.),2.)<1.) color.rgb*=.48; outColor=color;}`;
var ICON_FRAGMENT = `#version 300 es
precision mediump float; in vec2 v_local; uniform sampler2D u_mask; uniform vec4 u_color; uniform vec4 u_uvRect; out vec4 outColor;
void main(){vec2 uv=mix(u_uvRect.xy,u_uvRect.zw,v_local);float alpha=texture(u_mask,uv).a; if(alpha<.02) discard;outColor=vec4(u_color.rgb,u_color.a*alpha);}`;
//#endregion
//#region ../aerobeat-web-ui/src/elements/aero-media-pose-preview/aero-media-pose-preview.js
/**
* Pose landmark IDs used for the durable body skeleton overlay.
*
* @type {readonly (readonly [number, number])[]}
*/
var aeroPosePreviewSkeletonConnections = Object.freeze([
	Object.freeze([0, 5]),
	Object.freeze([0, 6]),
	Object.freeze([5, 6]),
	Object.freeze([5, 7]),
	Object.freeze([7, 9]),
	Object.freeze([6, 8]),
	Object.freeze([8, 10])
]);
/**
* Upper-body pose landmarks visible in the phone calibration checkpoint.
*
* @type {ReadonlyMap<string, number>}
*/
var aeroPosePreviewLandmarkIds = /* @__PURE__ */ new Map([
	["nose", 0],
	["left_shoulder", 5],
	["right_shoulder", 6],
	["left_elbow", 7],
	["right_elbow", 8],
	["left_wrist", 9],
	["right_wrist", 10]
]);
/**
* @type {readonly string[]}
*/
var aeroPosePreviewLandmarkOrder = Object.freeze([
	"nose",
	"left_wrist",
	"left_elbow",
	"left_shoulder",
	"right_shoulder",
	"right_elbow",
	"right_wrist"
]);
/**
* @typedef {"smoother" | "fast"} AeroMediaPosePreviewTrackingProfile
*/
/**
* Preview tracking profiles for phone readability versus latency checks.
*
* @type {Readonly<Record<AeroMediaPosePreviewTrackingProfile, { alpha: number }>>}
*/
var aeroPosePreviewTrackingProfiles = Object.freeze({
	smoother: Object.freeze({ alpha: .42 }),
	fast: Object.freeze({ alpha: 1 })
});
/**
* @typedef {import("@aerobeat/web-contracts").NormalizedPoseFrame} NormalizedPoseFrame
* @typedef {import("@aerobeat/web-contracts").AeroPoseRoutingSample} AeroPoseRoutingSample
* @typedef {import("@aerobeat/web-video").createBrowserVideoMediaFacade} CreateBrowserVideoMediaFacade
*/
/**
* @typedef {ReturnType<CreateBrowserVideoMediaFacade>} BrowserVideoMediaFacade
* @typedef {ReturnType<import("@aerobeat/web-renderer").createAeroWebGl2Renderer>} AeroWebGl2Renderer
*/
/**
* @typedef {"contain" | "cover" | "stretch"} AeroMediaPosePreviewFitMode
*/
/**
* @typedef {object} AeroMediaPosePreviewSource
* @property {"live-camera" | "loaded-video" | "replay-video-feed"} kind Source kind owned by `@aerobeat/web-video`.
* @property {string} sourceId Source identifier.
* @property {AeroMediaPosePreviewFitMode} fitMode Visible media fit mode.
* @property {boolean} mirrored Whether the player-facing preview is mirrored.
*/
/**
* @typedef {AeroMediaPosePreviewSource & {
*   url: string,
*   loop: boolean,
*   autoplay: boolean,
*   muted: boolean,
*   startTimeSeconds: number
* }} AeroMediaPosePreviewVideoSource
*/
/**
* @typedef {object} AeroMediaPosePreviewSurface
* @property {string | undefined} sourceKind Current source kind.
* @property {string | undefined} sourceId Current source identifier.
* @property {AeroMediaPosePreviewFitMode} fitMode Visible media fit mode.
* @property {boolean} mirrored Whether the player-facing preview is mirrored.
* @property {number | undefined} intrinsicWidth Source media width.
* @property {number | undefined} intrinsicHeight Source media height.
* @property {number} currentTimeSeconds Current media time.
*/
/**
* @typedef {object} AeroMediaPosePreviewSnapshot
* @property {string | undefined} sourceKind Current source kind.
* @property {string | undefined} sourceId Current source identifier.
* @property {AeroMediaPosePreviewFitMode} fitMode Visible media fit mode.
* @property {boolean} mirrored Whether the player-facing preview is mirrored.
* @property {number} landmarkCount Number of landmarks submitted to the overlay.
* @property {number} rendererDrawCount Current renderer draw count.
* @property {AeroMediaPosePreviewTrackingProfile} trackingProfile Active preview smoothing profile.
* @property {{x: number, y: number, width: number, height: number}} contentRect Fitted content rectangle.
* @property {number | undefined} mediaPoseDeltaMs Media time minus latest real measurement timestamp, when comparable.
* @property {number | undefined} presentationTargetDeltaMs Media time minus the routed presentation target, when comparable.
* @property {import("@aerobeat/web-contracts").AeroPoseSampleProvenance | undefined} poseProvenance Measured or predicted overlay source.
* @property {number | undefined} measurementTimestampMs Latest real measurement timestamp.
* @property {number | undefined} predictionHorizonMs Current bounded prediction horizon.
*/
/**
* @typedef {object} AeroMediaPosePreviewOverlaySurface
* @property {number} viewportWidth Overlay canvas width.
* @property {number} viewportHeight Overlay canvas height.
* @property {number | undefined} intrinsicWidth Source media width.
* @property {number | undefined} intrinsicHeight Source media height.
* @property {AeroMediaPosePreviewFitMode} fitMode Visible media fit mode.
* @property {boolean} mirrored Whether normalized x should be mirrored.
* @property {{x: number, y: number, width: number, height: number} | undefined} contentRect Explicit fitted media rectangle.
*/
/**
* @typedef {object} AeroMediaPosePreviewLandmark
* @property {number} id Stable pose landmark identifier.
* @property {string} name Stable AeroBeat landmark name.
* @property {number} x Smoothed normalized horizontal position.
* @property {number} y Smoothed normalized vertical position.
* @property {number} v Detector confidence.
*/
/**
* Web UI presenter that composes a video-owned media surface with the shared
* WebGL2 renderer overlay path. CV and vendor adapters only provide pose data.
*/
var AeroMediaPosePreview = class extends HTMLElement {
	/**
	* Observed attributes for declarative scenes.
	*
	* @returns {string[]}
	*/
	static get observedAttributes() {
		return [
			"fit-mode",
			"mirrored",
			"source-id",
			"source-kind",
			"tracking-profile"
		];
	}
	/**
	* Creates the preview shadow DOM.
	*/
	constructor() {
		super();
		/** @type {BrowserVideoMediaFacade} */
		this.videoMediaFacade = createBrowserVideoMediaFacade();
		/** @type {AeroWebGl2Renderer} */
		this.renderer = createAeroWebGl2Renderer();
		/** @type {AeroMediaPosePreviewSurface | undefined} */
		this.surface = void 0;
		/** @type {NormalizedPoseFrame | undefined} */
		this.poseFrame = void 0;
		/** @type {AeroPoseRoutingSample | undefined} */
		this.poseRoutingSample = void 0;
		/** @type {Map<string, AeroMediaPosePreviewLandmark>} */
		this.smoothedLandmarks = /* @__PURE__ */ new Map();
		/** @type {string} */
		this.lastSmoothedFrameKey = "";
		/** @type {string} */
		this.lastSmoothedSourceId = "";
		/** @type {AeroMediaPosePreviewTrackingProfile} */
		this.trackingProfile = "smoother";
		/** @type {ResizeObserver | undefined} */
		this.resizeObserver = void 0;
		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = `
      <style>
        :host {
          aspect-ratio: 16 / 9;
          background: #06151a;
          border: 1px solid var(--aero-color-border, rgba(53, 141, 175, 0.42));
          border-radius: var(--aero-radius-panel, 8px);
          box-shadow: var(--aero-shadow-panel, 0 16px 38px rgba(16, 52, 71, 0.18));
          box-sizing: border-box;
          display: block;
          inline-size: 100%;
          max-inline-size: 720px;
          min-block-size: 180px;
          overflow: hidden;
        }

        .preview {
          block-size: 100%;
          display: grid;
          inline-size: 100%;
          overflow: hidden;
          position: relative;
        }

        video,
        canvas {
          block-size: 100%;
          grid-area: 1 / 1;
          inline-size: 100%;
        }

        video {
          background: #06151a;
        }

        video[data-fit-mode="contain"] {
          object-fit: contain;
        }

        video[data-fit-mode="cover"] {
          object-fit: cover;
        }

        video[data-fit-mode="stretch"] {
          object-fit: fill;
        }

        video[data-mirrored="true"] {
          transform: scaleX(-1);
        }

        canvas {
          pointer-events: none;
          position: relative;
          z-index: 1;
        }
      </style>
      <section class="preview" part="preview">
        <video muted playsinline data-fit-mode="contain" data-mirrored="false"></video>
        <canvas aria-hidden="true"></canvas>
      </section>
    `;
	}
	/**
	* Attaches renderer and size observers when connected.
	*/
	connectedCallback() {
		this.#syncAttributesToSurface();
		this.#attachRenderer();
		this.resizeObserver = new ResizeObserver(() => {
			this.#sizeOverlayCanvas();
			this.renderPreview();
		});
		this.resizeObserver.observe(this);
		this.renderPreview();
	}
	/**
	* Releases local observers and renderer attachment.
	*/
	disconnectedCallback() {
		this.resizeObserver?.disconnect();
		this.resizeObserver = void 0;
		this.renderer.detach();
	}
	/**
	* Syncs declarative attributes.
	*/
	attributeChangedCallback() {
		this.#syncAttributesToSurface();
		this.renderPreview();
	}
	/**
	* Injects the video facade owned by `@aerobeat/web-video`.
	*
	* @param {BrowserVideoMediaFacade} videoMediaFacade
	* @returns {void}
	*/
	setVideoMediaFacade(videoMediaFacade) {
		this.videoMediaFacade = videoMediaFacade;
	}
	/**
	* Injects the WebGL2 overlay renderer owned by `@aerobeat/web-renderer`.
	*
	* @param {AeroWebGl2Renderer} renderer
	* @returns {void}
	*/
	setRenderer(renderer) {
		this.renderer.detach();
		this.renderer = renderer;
		this.#attachRenderer();
		this.renderPreview();
	}
	/**
	* Attaches a retained or supplied live camera stream to the media surface.
	*
	* @param {MediaStream | undefined} stream
	* @param {AeroMediaPosePreviewSource | undefined} source
	* @returns {AeroMediaPosePreviewSurface}
	*/
	attachCameraStream(stream, source) {
		const surface = this.videoMediaFacade.attachCameraStream(this.#videoElement(), stream, { source });
		this.setSurfaceDescriptor(surface);
		return this.#surfaceSnapshot();
	}
	/**
	* Attaches a loaded video or replay feed descriptor to the media surface.
	*
	* @param {AeroMediaPosePreviewVideoSource} source
	* @returns {AeroMediaPosePreviewSurface}
	*/
	attachVideoSource(source) {
		const surface = this.videoMediaFacade.attachVideoSource(this.#videoElement(), source);
		this.setSurfaceDescriptor(surface);
		return this.#surfaceSnapshot();
	}
	/**
	* Updates public surface metadata already described by the video facade.
	*
	* @param {Partial<AeroMediaPosePreviewSurface>} surface
	* @param {{ render?: boolean }} [options]
	* @returns {void}
	*/
	setSurfaceDescriptor(surface, options = {}) {
		const previousSurface = this.surface;
		this.surface = normalizeSurface({
			...this.surface,
			...surface
		});
		if (hasPresentationSurfaceChanged(previousSurface, this.surface)) this.#resetSmoothingState();
		this.#applySurfaceToMedia();
		if (options.render !== false) this.renderPreview();
	}
	/**
	* Updates the pose frame drawn by the renderer overlay.
	*
	* @param {NormalizedPoseFrame | undefined} poseFrame
	* @param {{ render?: boolean }} [options]
	* @returns {void}
	*/
	setPoseFrame(poseFrame, options = {}) {
		const previousSourceId = this.poseRoutingSample?.sourceId ?? this.poseFrame?.sourceId;
		const crossedRoutingBoundary = Boolean(this.poseRoutingSample);
		this.poseRoutingSample = void 0;
		this.poseFrame = poseFrame;
		if (!poseFrame || crossedRoutingBoundary || previousSourceId !== poseFrame.sourceId) this.#resetSmoothingState();
		if (options.render !== false) this.renderPreview();
	}
	/**
	* Updates the overlay from a truthfully tagged gameplay-routing sample without
	* exposing the estimate as measured adapter output.
	*
	* @param {AeroPoseRoutingSample | undefined} sample
	* @param {{ render?: boolean }} [options]
	* @returns {void}
	*/
	setPoseRoutingSample(sample, options = {}) {
		const previousSample = this.poseRoutingSample;
		const crossedMeasuredFrameBoundary = Boolean(this.poseFrame);
		this.poseFrame = void 0;
		this.poseRoutingSample = sample;
		if (!sample || crossedMeasuredFrameBoundary || previousSample?.sourceId !== sample.sourceId || previousSample?.routeEpoch !== sample.routeEpoch || previousSample?.provenance !== sample.provenance) this.#resetSmoothingState();
		if (options.render !== false) this.renderPreview();
	}
	/**
	* Selects how aggressively preview landmarks smooth incoming pose frames.
	*
	* @param {AeroMediaPosePreviewTrackingProfile | string | undefined} profile
	* @returns {void}
	*/
	setTrackingProfile(profile) {
		const nextProfile = normalizeTrackingProfile(profile);
		if (nextProfile === this.trackingProfile) return;
		this.trackingProfile = nextProfile;
		this.#resetSmoothingState();
		this.setAttribute("tracking-profile", nextProfile);
		this.renderPreview();
	}
	/**
	* Renders the current pose frame over the current media content rect.
	*
	* @returns {AeroMediaPosePreviewSnapshot}
	*/
	renderPreview() {
		this.#sizeOverlayCanvas();
		this.#applySurfaceToMedia();
		this.renderer.clear({ color: [
			0,
			0,
			0,
			0
		] });
		const surface = this.#overlaySurface();
		const landmarks = this.#visiblePoseLandmarks();
		const result = this.renderer.renderLandmarkOverlay(landmarks, {
			surface,
			connections: aeroPosePreviewSkeletonConnections,
			minVisibility: .25,
			color: [
				.24,
				.9,
				.45,
				.95
			],
			pointSize: 7
		});
		const canvas = this.#canvasElement();
		canvas.dataset.landmarkCount = String(landmarks.length);
		canvas.dataset.rendererDrawCount = String(result.status.drawCount);
		canvas.dataset.trackingProfile = this.trackingProfile;
		canvas.dataset.contentRect = JSON.stringify(computeMediaContentRect(surface));
		canvas.dataset.mediaPoseDeltaMs = String(this.#mediaPoseDeltaMs() ?? "");
		canvas.dataset.presentationTargetDeltaMs = String(this.#presentationTargetDeltaMs() ?? "");
		canvas.dataset.poseProvenance = this.poseRoutingSample?.provenance ?? (this.poseFrame ? "measured" : "");
		canvas.dataset.measurementTimestampMs = String(this.#measurementTimestampMs() ?? "");
		canvas.dataset.predictionHorizonMs = String(this.poseRoutingSample?.predictionHorizonMs ?? (this.poseFrame ? 0 : ""));
		return this.describePreview();
	}
	/**
	* Reports the current preview composition state for validation and assembly.
	*
	* @returns {AeroMediaPosePreviewSnapshot}
	*/
	describePreview() {
		const surface = this.#overlaySurface();
		const rendererStatus = this.renderer.describe();
		return {
			sourceKind: this.surface?.sourceKind,
			sourceId: this.surface?.sourceId,
			fitMode: surface.fitMode,
			mirrored: surface.mirrored ?? false,
			landmarkCount: this.#visiblePoseLandmarks().length,
			rendererDrawCount: rendererStatus.drawCount,
			trackingProfile: this.trackingProfile,
			contentRect: computeMediaContentRect(surface),
			mediaPoseDeltaMs: this.#mediaPoseDeltaMs(),
			presentationTargetDeltaMs: this.#presentationTargetDeltaMs(),
			poseProvenance: this.poseRoutingSample?.provenance ?? (this.poseFrame ? "measured" : void 0),
			measurementTimestampMs: this.#measurementTimestampMs(),
			predictionHorizonMs: this.poseRoutingSample?.predictionHorizonMs ?? (this.poseFrame ? 0 : void 0)
		};
	}
	/**
	* @returns {HTMLVideoElement}
	*/
	#videoElement() {
		const video = this.shadowRoot?.querySelector("video");
		if (!(video instanceof HTMLVideoElement)) throw new Error("Aero media preview video element is unavailable.");
		return video;
	}
	/**
	* @returns {HTMLCanvasElement}
	*/
	#canvasElement() {
		const canvas = this.shadowRoot?.querySelector("canvas");
		if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Aero media preview canvas element is unavailable.");
		return canvas;
	}
	/**
	* @returns {void}
	*/
	#attachRenderer() {
		if (!this.isConnected) return;
		this.#sizeOverlayCanvas();
		this.renderer.attach(this.#canvasElement(), {
			alpha: true,
			antialias: true
		});
	}
	/**
	* @returns {void}
	*/
	#sizeOverlayCanvas() {
		const canvas = this.#canvasElement();
		const rect = this.getBoundingClientRect();
		const width = Math.max(1, Math.round(rect.width || this.clientWidth || 640));
		const height = Math.max(1, Math.round(rect.height || this.clientHeight || 360));
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
	}
	/**
	* @returns {void}
	*/
	#syncAttributesToSurface() {
		const previousSurface = this.surface;
		const nextTrackingProfile = normalizeTrackingProfile(this.getAttribute("tracking-profile") ?? this.trackingProfile);
		if (nextTrackingProfile !== this.trackingProfile) {
			this.trackingProfile = nextTrackingProfile;
			this.#resetSmoothingState();
		}
		this.surface = normalizeSurface({
			...this.surface,
			sourceKind: this.getAttribute("source-kind") ?? this.surface?.sourceKind,
			sourceId: this.getAttribute("source-id") ?? this.surface?.sourceId,
			fitMode: normalizeFitMode(this.getAttribute("fit-mode") ?? this.surface?.fitMode),
			mirrored: this.hasAttribute("mirrored") ? this.getAttribute("mirrored") !== "false" : this.surface?.mirrored
		});
		if (hasPresentationSurfaceChanged(previousSurface, this.surface)) this.#resetSmoothingState();
		this.#applySurfaceToMedia();
	}
	/**
	* @returns {void}
	*/
	#applySurfaceToMedia() {
		const video = this.#videoElement();
		const fitMode = this.surface?.fitMode ?? "contain";
		video.dataset.fitMode = fitMode;
		video.dataset.mirrored = String(this.surface?.mirrored ?? false);
		video.dataset.sourceKind = this.surface?.sourceKind ?? "";
		video.dataset.sourceId = this.surface?.sourceId ?? "";
	}
	/**
	* @returns {AeroMediaPosePreviewOverlaySurface}
	*/
	#overlaySurface() {
		const canvas = this.#canvasElement();
		const video = this.#videoElement();
		return {
			viewportWidth: canvas.width,
			viewportHeight: canvas.height,
			intrinsicWidth: this.surface?.intrinsicWidth ?? positiveNumberOrUndefined(video.videoWidth),
			intrinsicHeight: this.surface?.intrinsicHeight ?? positiveNumberOrUndefined(video.videoHeight),
			fitMode: this.surface?.fitMode ?? "contain",
			mirrored: this.surface?.mirrored ?? false,
			contentRect: this.#measuredVideoContentRect()
		};
	}
	/**
	* @returns {AeroMediaPosePreviewLandmark[]}
	*/
	#visiblePoseLandmarks() {
		const presentation = this.poseRoutingSample ?? this.poseFrame;
		const sourceId = presentation?.sourceId ?? "none";
		const presentationSourceKey = this.poseRoutingSample ? `routing:${this.poseRoutingSample.routeEpoch}:${this.poseRoutingSample.provenance}:${sourceId}` : `measured-frame:${sourceId}`;
		const frameKey = this.poseRoutingSample ? `${presentationSourceKey}:${this.poseRoutingSample.targetTimestampMs}` : `${presentationSourceKey}:${this.poseFrame?.timestampMs ?? -1}`;
		if (frameKey !== this.lastSmoothedFrameKey) {
			if (presentationSourceKey !== this.lastSmoothedSourceId) this.smoothedLandmarks = /* @__PURE__ */ new Map();
			const rawLandmarks = normalizePoseLandmarks(presentation);
			/** @type {Map<string, AeroMediaPosePreviewLandmark>} */
			const nextSmoothed = /* @__PURE__ */ new Map();
			const smoothingAlpha = aeroPosePreviewTrackingProfiles[this.trackingProfile].alpha;
			for (const landmark of rawLandmarks) {
				const previous = this.smoothedLandmarks.get(landmark.name);
				nextSmoothed.set(landmark.name, previous ? smoothLandmark(previous, landmark, smoothingAlpha) : landmark);
			}
			this.smoothedLandmarks = nextSmoothed;
			this.lastSmoothedFrameKey = frameKey;
			this.lastSmoothedSourceId = presentationSourceKey;
		}
		return aeroPosePreviewLandmarkOrder.map((name) => this.smoothedLandmarks.get(name)).filter(isPreviewLandmark);
	}
	/**
	* Drops filter history at source, lifecycle, tracking, and provenance boundaries.
	*
	* @returns {void}
	*/
	#resetSmoothingState() {
		this.smoothedLandmarks = /* @__PURE__ */ new Map();
		this.lastSmoothedFrameKey = "";
		this.lastSmoothedSourceId = "";
	}
	/**
	* @returns {{x: number, y: number, width: number, height: number} | undefined}
	*/
	#measuredVideoContentRect() {
		const canvas = this.#canvasElement();
		const video = this.#videoElement();
		const canvasRect = canvas.getBoundingClientRect();
		const videoRect = video.getBoundingClientRect();
		if (canvasRect.width <= 0 || canvasRect.height <= 0 || videoRect.width <= 0 || videoRect.height <= 0) return;
		const fitRect = computeMediaContentRect({
			viewportWidth: videoRect.width,
			viewportHeight: videoRect.height,
			intrinsicWidth: this.surface?.intrinsicWidth ?? positiveNumberOrUndefined(video.videoWidth),
			intrinsicHeight: this.surface?.intrinsicHeight ?? positiveNumberOrUndefined(video.videoHeight),
			fitMode: this.surface?.fitMode ?? "contain",
			mirrored: this.surface?.mirrored ?? false
		});
		const scaleX = canvas.width / canvasRect.width;
		const scaleY = canvas.height / canvasRect.height;
		return {
			x: (videoRect.left - canvasRect.left + fitRect.x) * scaleX,
			y: (videoRect.top - canvasRect.top + fitRect.y) * scaleY,
			width: fitRect.width * scaleX,
			height: fitRect.height * scaleY
		};
	}
	/**
	* @returns {number | undefined}
	*/
	#mediaPoseDeltaMs() {
		const measurementTimestampMs = this.#measurementTimestampMs();
		if (measurementTimestampMs === void 0 || this.surface?.sourceKind !== "live-camera") return;
		const mediaTimeMs = this.surface.currentTimeSeconds * 1e3;
		if (!Number.isFinite(mediaTimeMs)) return;
		return Math.round(mediaTimeMs - measurementTimestampMs);
	}
	/**
	* @returns {number | undefined}
	*/
	#presentationTargetDeltaMs() {
		if (!this.poseRoutingSample || this.surface?.sourceKind !== "live-camera") return;
		const mediaTimeMs = this.surface.currentTimeSeconds * 1e3;
		if (!Number.isFinite(mediaTimeMs) || !Number.isFinite(this.poseRoutingSample.targetTimestampMs)) return;
		return Math.round(mediaTimeMs - this.poseRoutingSample.targetTimestampMs);
	}
	/**
	* @returns {number | undefined}
	*/
	#measurementTimestampMs() {
		return this.poseRoutingSample?.measurementTimestampMs ?? this.poseFrame?.timestampMs;
	}
	/**
	* @returns {AeroMediaPosePreviewSurface}
	*/
	#surfaceSnapshot() {
		return normalizeSurface(this.surface);
	}
};
/**
* Defines `aero-media-pose-preview` when it is not already registered.
*
* @returns {void}
*/
function defineAeroMediaPosePreview() {
	if (!customElements.get("aero-media-pose-preview")) customElements.define("aero-media-pose-preview", AeroMediaPosePreview);
}
/**
* @param {Partial<AeroMediaPosePreviewSurface> | undefined} surface
* @returns {AeroMediaPosePreviewSurface}
*/
function normalizeSurface(surface) {
	return {
		sourceKind: surface?.sourceKind,
		sourceId: surface?.sourceId,
		fitMode: normalizeFitMode(surface?.fitMode),
		mirrored: surface?.mirrored ?? false,
		intrinsicWidth: positiveNumberOrUndefined(surface?.intrinsicWidth),
		intrinsicHeight: positiveNumberOrUndefined(surface?.intrinsicHeight),
		currentTimeSeconds: typeof surface?.currentTimeSeconds === "number" ? surface.currentTimeSeconds : 0
	};
}
/**
* @param {AeroMediaPosePreviewSurface | undefined} previous
* @param {AeroMediaPosePreviewSurface | undefined} next
* @returns {boolean}
*/
function hasPresentationSurfaceChanged(previous, next) {
	return previous?.sourceKind !== next?.sourceKind || previous?.sourceId !== next?.sourceId || previous?.mirrored !== next?.mirrored;
}
/**
* @param {string | undefined} value
* @returns {AeroMediaPosePreviewFitMode}
*/
function normalizeFitMode(value) {
	return value === "cover" || value === "stretch" || value === "contain" ? value : "contain";
}
/**
* @param {string | undefined} value
* @returns {AeroMediaPosePreviewTrackingProfile}
*/
function normalizeTrackingProfile(value) {
	return value === "fast" ? "fast" : "smoother";
}
/**
* @param {number | undefined} value
* @returns {number | undefined}
*/
function positiveNumberOrUndefined(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
/**
* @param {NormalizedPoseFrame | AeroPoseRoutingSample | undefined} poseSample
* @returns {AeroMediaPosePreviewLandmark[]}
*/
function normalizePoseLandmarks(poseSample) {
	/** @type {Map<string, AeroMediaPosePreviewLandmark>} */
	const landmarksByName = /* @__PURE__ */ new Map();
	for (const landmark of poseSample?.landmarks ?? []) {
		const id = aeroPosePreviewLandmarkIds.get(landmark.name);
		if (id === void 0) continue;
		landmarksByName.set(landmark.name, {
			id,
			name: landmark.name,
			x: landmark.x,
			y: landmark.y,
			v: landmark.confidence
		});
	}
	return aeroPosePreviewLandmarkOrder.map((name) => landmarksByName.get(name)).filter(isPreviewLandmark);
}
/**
* @param {AeroMediaPosePreviewLandmark | undefined} landmark
* @returns {landmark is AeroMediaPosePreviewLandmark}
*/
function isPreviewLandmark(landmark) {
	return Boolean(landmark);
}
/**
* @param {AeroMediaPosePreviewLandmark} previous
* @param {AeroMediaPosePreviewLandmark} next
* @param {number} alpha
* @returns {AeroMediaPosePreviewLandmark}
*/
function smoothLandmark(previous, next, alpha) {
	return {
		id: next.id,
		name: next.name,
		x: lerp(previous.x, next.x, alpha),
		y: lerp(previous.y, next.y, alpha),
		v: next.v
	};
}
/**
* @param {number} start
* @param {number} end
* @param {number} alpha
* @returns {number}
*/
function lerp(start, end, alpha) {
	return start + (end - start) * alpha;
}
//#endregion
//#region ../aerobeat-web-ui/src/elements/aero-pose-flow-panel/aero-pose-flow-panel.js
/**
* @typedef {import("@aerobeat/web-contracts").NormalizedPoseFrame} NormalizedPoseFrame
*/
/**
* @typedef {Object} PoseFlowDraftEventView
* @property {string} mode Gameplay mode.
* @property {string} eventName Browser event name.
* @property {string} summary Short event summary.
*/
/**
* @typedef {Object} PoseFlowPanelState
* @property {NormalizedPoseFrame | undefined} poseFrame Current normalized pose frame.
* @property {readonly PoseFlowDraftEventView[]} inputEvents Gameplay-facing draft input events.
*/
/**
* Proving panel for deterministic pose-frame and input-router runtime state.
*/
var AeroPoseFlowPanel = class extends HTMLElement {
	/**
	* Observed attributes for declarative scenes.
	*
	* @returns {string[]}
	*/
	static get observedAttributes() {
		return [
			"source-id",
			"timestamp-ms",
			"input-summary"
		];
	}
	/**
	* Creates the panel shadow DOM.
	*/
	constructor() {
		super();
		/** @type {PoseFlowPanelState} */
		this.state = {
			poseFrame: void 0,
			inputEvents: []
		};
		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .panel {
          background: var(--aero-color-surface, rgba(244, 252, 255, 0.9));
          border: 1px solid var(--aero-color-border, rgba(53, 141, 175, 0.42));
          border-radius: var(--aero-radius-panel, 8px);
          box-shadow: var(--aero-shadow-panel, 0 16px 38px rgba(16, 52, 71, 0.18));
          color: var(--aero-color-ink, #103447);
          display: grid;
          gap: var(--aero-space-3, 12px);
          padding: var(--aero-space-4, 16px);
        }

        .heading {
          font: 700 1rem var(--aero-font-family, system-ui, sans-serif);
        }

        .grid {
          display: grid;
          gap: var(--aero-space-2, 8px);
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .metric,
        .events {
          border-block-start: 1px solid var(--aero-color-border, rgba(53, 141, 175, 0.28));
          display: grid;
          gap: 4px;
          padding-block-start: var(--aero-space-2, 8px);
        }

        .label {
          font: 700 0.72rem var(--aero-font-family, system-ui, sans-serif);
          text-transform: uppercase;
        }

        .value {
          font: 500 0.9rem var(--aero-font-family, system-ui, sans-serif);
          overflow-wrap: anywhere;
        }

        .events {
          grid-column: 1 / -1;
        }
      </style>
      <section class="panel" part="panel">
        <span class="heading">Runtime pose flow</span>
        <div class="grid">
          <span class="metric">
            <span class="label">Source</span>
            <span class="value source">No frame</span>
          </span>
          <span class="metric">
            <span class="label">Timestamp</span>
            <span class="value timestamp">0 ms</span>
          </span>
          <span class="metric">
            <span class="label">Landmarks</span>
            <span class="value landmarks">0</span>
          </span>
          <span class="metric">
            <span class="label">Input events</span>
            <span class="value event-count">0</span>
          </span>
          <span class="events">
            <span class="label">Draft event data</span>
            <span class="value event-summary">Waiting for replay input</span>
          </span>
        </div>
      </section>
    `;
	}
	/**
	* Syncs state into the shadow DOM.
	*/
	connectedCallback() {
		this.#render();
	}
	/**
	* Syncs attributes into the panel content.
	*/
	attributeChangedCallback() {
		this.#render();
	}
	/**
	* @param {NormalizedPoseFrame | undefined} poseFrame
	* @returns {void}
	*/
	setPoseFrame(poseFrame) {
		this.state = {
			poseFrame,
			inputEvents: this.state.inputEvents
		};
		this.#render();
	}
	/**
	* @param {readonly PoseFlowDraftEventView[]} inputEvents
	* @returns {void}
	*/
	setInputEvents(inputEvents) {
		this.state = {
			poseFrame: this.state.poseFrame,
			inputEvents
		};
		this.#render();
	}
	/**
	* @param {PoseFlowPanelState} state
	* @returns {void}
	*/
	setProvingState(state) {
		this.state = {
			poseFrame: state.poseFrame,
			inputEvents: [...state.inputEvents]
		};
		this.#render();
	}
	/**
	* Updates visible panel content from state or declarative attributes.
	*/
	#render() {
		const poseFrame = this.state.poseFrame;
		const sourceId = poseFrame?.sourceId ?? this.getAttribute("source-id") ?? "No frame";
		const timestampMs = poseFrame?.timestampMs ?? Number(this.getAttribute("timestamp-ms") ?? 0);
		const landmarkCount = poseFrame?.landmarks.length ?? 0;
		const inputEvents = this.state.inputEvents;
		const fallbackSummary = this.getAttribute("input-summary") ?? "Waiting for replay input";
		const eventSummary = inputEvents.length > 0 ? inputEvents.map((event) => `${event.mode} ${event.summary}`).join(" | ") : fallbackSummary;
		this.#setText(".source", sourceId);
		this.#setText(".timestamp", `${timestampMs} ms`);
		this.#setText(".landmarks", String(landmarkCount));
		this.#setText(".event-count", String(inputEvents.length));
		this.#setText(".event-summary", eventSummary);
	}
	/**
	* @param {string} selector
	* @param {string} text
	* @returns {void}
	*/
	#setText(selector, text) {
		const target = this.shadowRoot?.querySelector(selector);
		if (target) target.textContent = text;
	}
};
/**
* Defines `aero-pose-flow-panel` when it is not already registered.
*
* @returns {void}
*/
function defineAeroPoseFlowPanel() {
	if (!customElements.get("aero-pose-flow-panel")) customElements.define("aero-pose-flow-panel", AeroPoseFlowPanel);
}
//#endregion
//#region ../aerobeat-web-ui/src/elements/aero-product-presenters.js
/** Public composed UI-intent event name. @type {"aero:ui:intent"} */
var aeroUiIntentEventName = "aero:ui:intent";
/**
* @typedef {Object} AeroUiIntentDetail
* @property {string} type Stable intent type.
* @property {Readonly<Record<string, string | number | boolean | null>>} payload Serializable metadata only; never files or bytes.
*/
/** @typedef {Readonly<Record<string, unknown>>} AeroPresenterSnapshot */
var sharedStyles = `
  :host { box-sizing: border-box; color: var(--aero-color-ink, #103447); display: block; font-family: var(--aero-font-family, system-ui, sans-serif); min-inline-size: 0; }
  *, *::before, *::after { box-sizing: border-box; }
  .panel { background: linear-gradient(145deg, rgba(255,255,255,.94), rgba(207,241,255,.84)); border: 1px solid var(--aero-color-border, rgba(53,141,175,.42)); border-radius: var(--aero-radius-panel, 14px); box-shadow: 0 10px 28px rgba(16,52,71,.16); display: grid; gap: var(--aero-space-3, 12px); min-inline-size: 0; padding: var(--aero-space-4, 16px); }
  h2, h3, p { margin: 0; }
  h2 { font-size: clamp(1rem, 3.5vw, 1.35rem); }
  h3 { font-size: .94rem; }
  .muted { color: var(--aero-color-muted, #486c7d); font-size: .82rem; min-inline-size: 0; overflow-wrap: anywhere; }
  .row { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }
  .stack { display: grid; gap: 8px; }
  .control, button, input, select { border: 1px solid var(--aero-color-border, rgba(53,141,175,.5)); border-radius: 8px; color: inherit; font: inherit; min-block-size: 42px; }
  button { background: linear-gradient(180deg, #fff, #bcecff); color: var(--aero-color-ink, #103447); cursor: pointer; font-weight: 750; padding: 8px 13px; touch-action: manipulation; }
  button[aria-pressed="true"], button[role="radio"][aria-checked="true"] { background: linear-gradient(180deg, #0a84ff, #086ccf); border-color: #fff; box-shadow: 0 0 0 3px var(--aero-color-focus, #0a84ff), inset 0 0 0 2px rgba(255,255,255,.72); color: #fff; }
  button[disabled], input[disabled], select[disabled] { cursor: not-allowed; opacity: .55; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid var(--aero-color-focus, #0a84ff); outline-offset: 2px; }
  input, select { background: rgba(255,255,255,.92); inline-size: 100%; padding: 8px 10px; }
  label { display: grid; font-size: .78rem; font-weight: 750; gap: 4px; }
  .live { min-block-size: 1.25em; }
  .pill { background: rgba(43,142,183,.12); border-radius: 999px; display: inline-flex; font-size: .74rem; font-weight: 800; padding: 4px 8px; }
  .error { color: var(--aero-color-error, #9f1d24); }
  .cards { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); }
  .card { background: rgba(255,255,255,.72); border: 1px solid rgba(53,141,175,.3); border-radius: 10px; display: grid; gap: 6px; padding: 10px; text-align: start; }
  .cards > article > .card { inline-size: 100%; }
  .choice-radio { align-items: center; cursor: pointer; display: flex; font-size: 1rem; gap: 10px; min-block-size: 42px; }
  .choice-radio:has(input:checked) { background: rgba(10,132,255,.14); border-color: var(--aero-color-focus, #0a84ff); box-shadow: inset 0 0 0 1px var(--aero-color-focus, #0a84ff); }
  .choice-radio input[type="radio"] { accent-color: var(--aero-color-focus, #0a84ff); block-size: 42px; flex: 0 0 42px; inline-size: 42px; margin: 0 8px 0 0; padding: 0; }
  .card > .choice-radio { border: 1px solid transparent; border-radius: 8px; padding: 0 8px; }
  .choice-copy { display: grid; gap: 4px; min-inline-size: 0; }
  progress { accent-color: var(--aero-color-focus, #0a84ff); inline-size: 100%; }
  .visually-hidden { block-size: 1px; clip: rect(0 0 0 0); clip-path: inset(50%); inline-size: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; white-space: nowrap; }
  :host([compact]) .panel { background: transparent; border: 0; border-radius: 0; box-shadow: none; gap: 8px; padding: 0; }
  :host([compact]) h1, :host([compact]) h2, :host([compact]) h3, :host([compact]) .compact-field-label, :host([compact]) .compact-converter-truth { block-size: 1px; clip: rect(0 0 0 0); clip-path: inset(50%); inline-size: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; white-space: nowrap; }
  :host([compact]) .compact-explanatory, :host([compact]) .compact-identity, :host([compact]) .compact-telemetry, :host([compact]) .muted:not(.live):not(.compact-critical):not(.compact-converter-truth), :host([compact]) .pill:not(.error) { display: none; }
  :host([compact]) .compact-status:not(.error) { block-size: 1px; clip: rect(0 0 0 0); clip-path: inset(50%); inline-size: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; white-space: nowrap; }
  :host([compact]) [part="storage"], :host([compact]) [part="detail"] > p, :host([compact]) .choice-copy > .muted { display: none; }
  :host([compact]) [part="items"] span[role="status"] { block-size: 1px; clip: rect(0 0 0 0); clip-path: inset(50%); inline-size: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; white-space: nowrap; }
  :host([compact]) .cards { grid-template-columns: minmax(0, 1fr); }
  :host([compact]) .card { padding: 8px; }
  :host([compact]) label { gap: 0; }
  :host([compact]) .compact-hide-when-clear { display: none; }
  :host([compact]) .compact-library-choices { display: grid; gap: 6px; }
  :host([compact]) .compact-library-choice { align-items: center; background: rgba(255,255,255,.88); border: 1px solid rgba(53,141,175,.42); border-radius: 10px; cursor: pointer; display: flex; font-size: 1rem; gap: 10px; min-block-size: 42px; padding: 0 10px; }
  :host([compact]) .compact-library-choice:has(input:checked) { background: rgba(10,132,255,.18); border-color: var(--aero-color-focus,#0a84ff); box-shadow: inset 0 0 0 1px var(--aero-color-focus,#0a84ff); }
  :host([compact]) .compact-library-choice input[type="radio"] { accent-color: var(--aero-color-focus,#0a84ff); block-size: 42px; flex: 0 0 42px; inline-size: 42px; margin: 0; padding: 0; }
  :host([compact]) .compact-library-choice span { font-weight: 750; min-inline-size: 0; overflow-wrap: anywhere; }
  :host([compact]) .compact-library-actions { border-block-start: 1px solid rgba(53,141,175,.32); margin-block-start: 2px; padding-block-start: 8px; }
  :host([compact]) .compact-preview-action { inline-size: 100%; }
  :host([compact]) .compact-singleton-field { align-items: center; background: rgba(255,255,255,.88); border: 1px solid rgba(53,141,175,.42); border-radius: 8px; display: grid; gap: 2px; min-block-size: 42px; padding: 5px 10px; }
  :host([compact]) .compact-singleton-field > span { color: var(--aero-color-muted,#486c7d); font-size: .7rem; font-weight: 750; }
  :host([compact]) .compact-singleton-field > output { font-size: .92rem; font-weight: 750; min-inline-size: 0; overflow-wrap: anywhere; }
  @media (max-width: 430px) { .panel { border-radius: 10px; padding: 12px; } .row > button { flex: 1 1 auto; } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; } }
`;
/**
* Presenter base with deferred DOM setup and reconnect-safe delegated listeners.
*/
var AeroPresenterElement = class extends HTMLElement {
	constructor() {
		super();
		/** @type {AeroPresenterSnapshot} */
		this.presenterSnapshot = Object.freeze({});
		this.boundClick = (event) => this.handleDelegatedClick(event);
		this.boundChange = (event) => this.handleDelegatedChange(event);
		this.boundSubmit = (event) => this.handleDelegatedSubmit(event);
		this.boundKeydown = (event) => this.handleDelegatedKeydown(event);
	}
	/** Boolean compact rendering mode; equivalent to the provider-neutral `[compact]` attribute. @returns {boolean} */
	get compact() {
		return this.hasAttribute("compact");
	}
	/** @param {boolean} value */
	set compact(value) {
		this.toggleAttribute("compact", value === true);
	}
	connectedCallback() {
		if (!this.shadowRoot) this.attachShadow({ mode: "open" });
		this.shadowRoot?.addEventListener("click", this.boundClick);
		this.shadowRoot?.addEventListener("change", this.boundChange);
		this.shadowRoot?.addEventListener("submit", this.boundSubmit);
		this.shadowRoot?.addEventListener("keydown", this.boundKeydown);
		this.render();
	}
	disconnectedCallback() {
		this.shadowRoot?.removeEventListener("click", this.boundClick);
		this.shadowRoot?.removeEventListener("change", this.boundChange);
		this.shadowRoot?.removeEventListener("submit", this.boundSubmit);
		this.shadowRoot?.removeEventListener("keydown", this.boundKeydown);
	}
	/** @param {AeroPresenterSnapshot} snapshot */
	setSnapshot(snapshot) {
		this.presenterSnapshot = narrowAeroPresenterSnapshot(snapshot);
		this.render();
	}
	/** @returns {void} */
	render() {}
	/** @param {Event} event @returns {void} */
	handleDelegatedClick(event) {
		const target = event.composedPath()[0];
		if (!(target instanceof HTMLElement)) return;
		const type = target.dataset.intent;
		if (!type || target.getAttribute("aria-disabled") === "true" || target instanceof HTMLButtonElement && target.disabled) return;
		this.onIntent(type, target);
	}
	/** @param {Event} event @returns {void} */
	handleDelegatedChange(event) {
		const target = event.composedPath()[0];
		if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
		const type = target.dataset.intent;
		if (type) this.onIntent(type, target);
	}
	/** @param {Event} event @returns {void} */
	handleDelegatedSubmit(event) {
		const target = event.composedPath()[0];
		if (!(target instanceof HTMLFormElement) || target.dataset.form !== "search") return;
		event.preventDefault();
		const input = this.shadowRoot?.querySelector("input[data-field='query']");
		this.emitIntent("beatsaver-search", { query: input instanceof HTMLInputElement ? input.value.trim().slice(0, 256) : "" });
	}
	/** @param {KeyboardEvent} event @returns {void} */
	handleDelegatedKeydown(event) {}
	/** @param {string} type @param {HTMLElement} target @returns {void} */
	onIntent(type, target) {
		const value = target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : target.dataset.value ?? "";
		this.emitIntent(type, value === "" ? {} : { value });
	}
	/** @param {string} type @param {Record<string, string | number | boolean | null>} [payload] @returns {void} */
	emitIntent(type, payload = {}) {
		/** @type {AeroUiIntentDetail} */
		const detail = Object.freeze({
			type,
			payload: Object.freeze({ ...payload })
		});
		this.dispatchEvent(new CustomEvent(aeroUiIntentEventName, {
			bubbles: true,
			composed: true,
			detail
		}));
	}
	/** @param {string} markup @returns {void} */
	renderMarkup(markup) {
		if (!this.shadowRoot || !this.isConnected) return;
		const focused = this.shadowRoot.activeElement;
		const focusIdentity = focused instanceof HTMLElement ? Object.freeze({
			intent: focused.dataset.intent ?? "",
			value: focused.dataset.value ?? "",
			field: focused.dataset.field ?? ""
		}) : null;
		this.shadowRoot.innerHTML = `<style>${sharedStyles}</style>${markup}`;
		if (focusIdentity && (focusIdentity.intent || focusIdentity.field)) {
			const controls = this.shadowRoot.querySelectorAll("button,input,select");
			for (const control of controls) if (control instanceof HTMLElement && (control.dataset.intent ?? "") === focusIdentity.intent && (control.dataset.value ?? "") === focusIdentity.value && (control.dataset.field ?? "") === focusIdentity.field) {
				control.focus();
				break;
			}
		}
	}
};
/** BeatSaver discovery, detail, version, difficulty and local-import intent presenter. */
var AeroBeatSaverBrowser = class extends AeroPresenterElement {
	static observedAttributes = ["compact"];
	/** Compact changes selected-map choice markup; removing it restores the default presenter exactly. @param {string} name @param {string | null} oldValue @param {string | null} newValue */
	attributeChangedCallback(name, oldValue, newValue) {
		if (name === "compact" && oldValue !== newValue && this.isConnected) this.render();
	}
	render() {
		const state = readString(this.presenterSnapshot, "state", "idle");
		const query = readString(this.presenterSnapshot, "query", "");
		const results = readRecordList(this.presenterSnapshot, "results").slice(0, 50);
		const selected = readRecord(this.presenterSnapshot, "selectedMap");
		const selectedMapId = selected ? readString(selected, "mapId", "") : "";
		const selectedResultIndex = results.findIndex((result) => readString(result, "mapId", "") === selectedMapId);
		const checkedResultIndex = results.length ? Math.max(0, selectedResultIndex) : -1;
		const versions = readRecordList(this.presenterSnapshot, "versions");
		const difficulties = readStringList(this.presenterSnapshot, "difficulties");
		const selectedVersion = readString(this.presenterSnapshot, "selectedVersionHash", "");
		const selectedDifficulty = readString(this.presenterSnapshot, "selectedDifficulty", "");
		const error = readString(this.presenterSnapshot, "errorMessage", "");
		const busy = state === "loading";
		const detail = selected ? this.compact ? compactBeatSaverDetailMarkup(selected, versions, difficulties, selectedVersion, selectedDifficulty, previewSnapshot(this.presenterSnapshot)) : defaultBeatSaverDetailMarkup(selected, versions, difficulties, selectedVersion, selectedDifficulty) : "";
		this.renderMarkup(`
      <section class="panel" part="panel" aria-labelledby="beatsaver-heading">
        <h2 id="beatsaver-heading">Find BeatSaver maps</h2>
        <form class="row" part="search" data-form="search">
          <label style="flex:1 1 14rem"><span class="compact-field-label">Search maps</span><input part="search-input" data-field="query" aria-label="Search maps" value="${escapeAttribute(query)}" autocomplete="off" ${busy ? "disabled" : ""}></label>
          <button part="search-button" type="submit" ${busy ? "disabled" : ""}>Search</button>
          <button part="latest-button" type="button" data-intent="beatsaver-latest" ${busy ? "disabled" : ""}>Latest</button>
          <button part="local-import-button" type="button" data-intent="local-zip-request">Choose local ZIP</button>
        </form>
        <p class="live compact-status ${error ? "error" : "muted"}" role="status" aria-live="polite">${escapeHtml(error || statusText(state, results.length))}</p>
        <div class="cards choice-radios" part="results" role="radiogroup" aria-label="BeatSaver results">
          ${results.map((result, index) => mapResultMarkup(result, index === checkedResultIndex)).join("") || `<p class="muted">${state === "empty" ? "No compatible maps found." : "Search or browse latest maps."}</p>`}
        </div>
        ${detail}
      </section>`);
	}
	/** Map radios commit on `change`; action buttons retain the inherited click path. @param {Event} event */
	handleDelegatedClick(event) {
		const target = event.composedPath()[0];
		if (target instanceof HTMLInputElement && target.type === "radio" || target instanceof HTMLSelectElement) return;
		super.handleDelegatedClick(event);
	}
	/** @param {string} type @param {HTMLElement} target */
	onIntent(type, target) {
		const selectedMap = readRecord(this.presenterSnapshot, "selectedMap");
		const mapId = selectedMap ? readString(selectedMap, "mapId", "") : "";
		const versionHash = readString(this.presenterSnapshot, "selectedVersionHash", "");
		const difficultyId = readString(this.presenterSnapshot, "selectedDifficulty", "");
		if (type === "beatsaver-select-map") {
			this.emitIntent(type, { mapId: target.dataset.value ?? "" });
			return;
		}
		if (type === "beatsaver-search") {
			const input = this.shadowRoot?.querySelector("input[data-field='query']");
			this.emitIntent(type, { query: input instanceof HTMLInputElement ? input.value.trim() : "" });
			return;
		}
		if (type === "beatsaver-version-select") {
			this.emitIntent(type, {
				mapId,
				versionHash: target instanceof HTMLSelectElement ? target.value : ""
			});
			return;
		}
		if (type === "beatsaver-difficulty-select") {
			this.emitIntent(type, {
				mapId,
				versionHash,
				difficultyId: target instanceof HTMLSelectElement ? target.value : ""
			});
			return;
		}
		if (type === "beatsaver-preview-toggle") {
			this.emitIntent(type, {
				mapId,
				versionHash
			});
			return;
		}
		if (type === "beatsaver-import") {
			const versionSelect = this.shadowRoot?.querySelector("select[data-intent='beatsaver-version-select']");
			const selectedVersionHash = versionSelect instanceof HTMLSelectElement ? versionSelect.value : versionHash;
			const difficultySelect = this.shadowRoot?.querySelector("select[data-intent='beatsaver-difficulty-select']");
			this.emitIntent(type, this.compact ? {
				mapId,
				versionHash: selectedVersionHash
			} : {
				mapId,
				versionHash: selectedVersionHash,
				difficultyId: difficultySelect instanceof HTMLSelectElement ? difficultySelect.value : difficultyId
			});
			return;
		}
		this.emitIntent(type);
	}
};
/** Worker conversion progress and cancellation presenter. */
var AeroContentImportProgress = class extends AeroPresenterElement {
	render() {
		const state = readString(this.presenterSnapshot, "state", "queued");
		const progress = clamp$1(readNumber(this.presenterSnapshot, "progress", 0), 0, 1);
		const jobId = readString(this.presenterSnapshot, "jobId", "");
		const error = readString(this.presenterSnapshot, "errorMessage", "");
		const cancellable = ![
			"complete",
			"cancelled",
			"failed"
		].includes(state);
		this.renderMarkup(`<section class="panel" part="panel" aria-labelledby="import-heading"><h2 id="import-heading">Content import</h2><p class="live ${error ? "error" : ""}" role="status" aria-live="polite">${escapeHtml(error || `${titleCase(state)} · ${Math.round(progress * 100)}%`)}</p><progress part="progress" max="1" value="${progress}" aria-label="Import progress"></progress><button part="cancel-button" type="button" data-intent="content-import-cancel" data-value="${escapeAttribute(jobId)}" ${cancellable ? "" : "disabled"}>Cancel import</button></section>`);
	}
	/** @param {string} type @param {HTMLElement} target */
	onIntent(type, target) {
		this.emitIntent(type, { jobId: target.dataset.value ?? "" });
	}
};
/** Locally authored package and quota presenter. */
var AeroContentLibrary = class extends AeroPresenterElement {
	static observedAttributes = ["compact"];
	constructor() {
		super();
		this.pendingDeleteCollectionId = "";
		this.pendingSelectedCollectionId = "";
		this.pendingSelectedPackageId = "";
	}
	/** A host snapshot settles any optimistic compact song/difficulty selection. @param {AeroPresenterSnapshot} snapshot */
	setSnapshot(snapshot) {
		this.pendingSelectedCollectionId = "";
		this.pendingSelectedPackageId = "";
		super.setSnapshot(snapshot);
	}
	/** Compact changes the product composition, while removing it restores the default development markup. @param {string} name @param {string | null} oldValue @param {string | null} newValue */
	attributeChangedCallback(name, oldValue, newValue) {
		if (name === "compact" && oldValue !== newValue && this.isConnected) this.render();
	}
	render() {
		const packages = readRecordList(this.presenterSnapshot, "packages").slice(0, 100);
		const used = readStorageBytes(this.presenterSnapshot, "usedBytes");
		const quota = readStorageBytes(this.presenterSnapshot, "quotaBytes");
		const error = readString(this.presenterSnapshot, "errorMessage", "");
		const snapshotSelectedPackageId = readString(this.presenterSnapshot, "selectedPackageId", "");
		const selectedPackageId = this.pendingSelectedPackageId && packages.some((item) => readString(item, "packageId", "") === this.pendingSelectedPackageId) ? this.pendingSelectedPackageId : snapshotSelectedPackageId;
		const selectedPackageIndex = packages.findIndex((item) => readString(item, "packageId", "") === selectedPackageId);
		const checkedPackageIndex = packages.length ? Math.max(0, selectedPackageIndex) : -1;
		if (this.compact) {
			const songs = compactDownloadedSongs(this.presenterSnapshot, packages);
			const selectedCollectionId = compactSelectedCollectionId(this.presenterSnapshot, songs, this.pendingSelectedCollectionId, this.pendingSelectedPackageId);
			if (this.pendingDeleteCollectionId && !songs.some((song) => song.collectionId === this.pendingDeleteCollectionId)) this.pendingDeleteCollectionId = "";
			this.renderMarkup(compactLibraryMarkup(songs, selectedCollectionId, this.pendingSelectedPackageId, this.pendingDeleteCollectionId, error, previewSnapshot(this.presenterSnapshot)));
			return;
		}
		if (this.pendingDeleteCollectionId && !packages.some((item) => readString(item, "packageId", "") === this.pendingDeleteCollectionId)) this.pendingDeleteCollectionId = "";
		this.renderMarkup(`<section class="panel" part="panel" aria-labelledby="library-heading"><h2 id="library-heading">My AeroBeat library</h2><p class="muted" part="storage">${escapeHtml(formatStorage(used, quota))}</p>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}<div class="cards choice-radios" part="items" role="radiogroup" aria-label="Available library packages">${packages.map((item, index) => libraryItemMarkup(item, this.pendingDeleteCollectionId, index === checkedPackageIndex)).join("") || `<p class="muted">No locally authored packages yet.</p>`}</div></section>`);
	}
	/** Package radios commit on `change`; package actions retain the inherited click path. @param {Event} event */
	handleDelegatedClick(event) {
		const target = event.composedPath()[0];
		if (target instanceof HTMLInputElement && target.type === "radio" || target instanceof HTMLSelectElement) return;
		super.handleDelegatedClick(event);
	}
	/** @param {string} type @param {HTMLElement} target */
	onIntent(type, target) {
		const value = target.dataset.value ?? (target instanceof HTMLSelectElement ? target.value : "");
		if (type === "library-select") {
			if (!this.compact) {
				this.emitIntent(type, { packageId: value });
				return;
			}
			this.emitIntent(type, { collectionId: value });
			this.pendingSelectedCollectionId = value;
			this.pendingSelectedPackageId = "";
			this.pendingDeleteCollectionId = "";
			this.render();
			queueMicrotask(() => [...this.shadowRoot?.querySelectorAll("input[name='library-song-choice']") ?? []].find((input) => input instanceof HTMLInputElement && input.value === value)?.focus());
			return;
		}
		if (type === "library-difficulty-select") {
			const packageId = target instanceof HTMLSelectElement ? target.value : "";
			const collectionId = target.dataset.collectionId ?? "";
			this.emitIntent(type, {
				collectionId,
				packageId
			});
			this.pendingSelectedCollectionId = collectionId;
			this.pendingSelectedPackageId = packageId;
			this.pendingDeleteCollectionId = "";
			this.render();
			return;
		}
		if (type === "library-preview-toggle" || type === "library-export") {
			this.emitIntent(type, { packageId: value });
			return;
		}
		if (type === "library-delete-request") {
			this.pendingDeleteCollectionId = value;
			this.render();
			queueMicrotask(() => {
				const confirm = this.shadowRoot?.querySelector("button[data-intent='library-delete']");
				if (confirm instanceof HTMLElement) confirm.focus();
			});
			return;
		}
		if (type === "library-delete-cancel") {
			this.pendingDeleteCollectionId = "";
			this.render();
			return;
		}
		if (type === "library-delete") {
			this.pendingDeleteCollectionId = "";
			this.emitIntent(type, this.compact ? { collectionId: value } : { packageId: value });
			this.render();
			return;
		}
		this.emitIntent(type, { packageId: value });
	}
};
/** T-pose hold/cooldown/success badge. */
var AeroCalibrationBadge = class extends AeroPresenterElement {
	render() {
		const state = readString(this.presenterSnapshot, "state", "waiting");
		const progress = clamp$1(readNumber(this.presenterSnapshot, "progress", 0), 0, 1);
		const message = readString(this.presenterSnapshot, "message", calibrationMessage(state));
		const calibrationId = readString(this.presenterSnapshot, "calibrationId", "");
		this.renderMarkup(`<section class="panel" part="badge" aria-labelledby="calibration-badge-heading"><div class="row"><h2 id="calibration-badge-heading">T-pose calibration</h2><span class="pill" part="state">${escapeHtml(titleCase(state))}</span></div><p class="live" role="status" aria-live="polite">${escapeHtml(message)}</p><progress part="hold-progress" max="1" value="${progress}" aria-label="T-pose hold progress"></progress><p class="muted">${calibrationId ? `Calibration ${escapeHtml(calibrationId)}` : "Session calibration required"}</p><button part="reset-button" type="button" data-intent="calibration-reset">Reset calibration</button></section>`);
	}
};
/** Renderer-owned surface host for Flow and Spatial Grid. */
var AeroGridPlayfield = class extends AeroPresenterElement {
	render() {
		const mode = readString(this.presenterSnapshot, "mode", "flow");
		const dimmed = readBoolean(this.presenterSnapshot, "dimmed", false);
		const label = readString(this.presenterSnapshot, "label", `${titleCase(mode)} playfield`);
		if (!this.shadowRoot?.querySelector(".playfield")) this.renderMarkup(`<section class="playfield" part="playfield"><div class="surface" part="render-surface" data-render-surface></div><div class="receptors" aria-hidden="true">${Array.from({ length: 12 }, (_, index) => `<i data-cell="${index}"></i>`).join("")}</div></section><style>:host{block-size:100%;inline-size:100%;min-block-size:12rem}.playfield{background:linear-gradient(180deg,var(--aero-playfield-background-start,#071426),var(--aero-playfield-background-end,#153b5d));block-size:100%;border-radius:12px;inline-size:100%;overflow:hidden;position:relative}.playfield.dimmed{filter:brightness(.45)}.surface{inset:0;position:absolute}.receptors{display:grid;gap:2%;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);inset:8%;position:absolute}.receptors i{border:1px solid color-mix(in srgb,var(--aero-role-receptor,#d9f5ff) 32%,transparent);border-radius:8px}</style>`);
		const playfield = this.shadowRoot?.querySelector(".playfield");
		if (playfield instanceof HTMLElement) {
			playfield.classList.toggle("dimmed", dimmed);
			playfield.setAttribute("aria-label", label);
		}
	}
	/** @returns {HTMLElement | null} Public renderer attachment surface. */
	getRenderSurface() {
		const surface = this.shadowRoot?.querySelector("[data-render-surface]");
		return surface instanceof HTMLElement ? surface : null;
	}
};
/** Flow HUD presenter. */
var AeroFlowHud = class extends AeroPresenterElement {
	render() {
		const score = readNumber(this.presenterSnapshot, "score", 0);
		const combo = readNumber(this.presenterSnapshot, "combo", 0);
		const direction = readString(this.presenterSnapshot, "direction", "—");
		this.renderMarkup(`<section class="panel row" part="hud" aria-label="Flow status"><strong>Flow</strong><span part="score">Score ${score}</span><span part="combo">Combo ${combo}</span><span part="direction">Direction ${escapeHtml(direction)}</span></section>`);
	}
};
/** Semantic two-lane Boxing HUD presenter. */
var AeroBoxingTrackHud = class extends AeroPresenterElement {
	render() {
		const left = readString(this.presenterSnapshot, "leftAction", "Ready");
		const right = readString(this.presenterSnapshot, "rightAction", "Ready");
		const defense = readString(this.presenterSnapshot, "defense", "Clear");
		this.renderMarkup(`<section class="tracks" part="hud" aria-label="Semantic Track Boxing"><div class="lane left" part="left-lane"><strong>Athlete left</strong><span>${escapeHtml(left)}</span></div><div class="lane right" part="right-lane"><strong>Athlete right</strong><span>${escapeHtml(right)}</span></div><div class="defense" part="defense-layer">Defense: ${escapeHtml(defense)}</div></section><style>.tracks{display:grid;gap:8px;grid-template-columns:1fr 1fr}.lane,.defense{border-radius:10px;color:var(--aero-role-on-color,#071426);display:grid;gap:4px;min-block-size:64px;padding:12px}.left{background:var(--aero-role-left,#2693ff)}.right{background:var(--aero-role-right,#39c96b)}.defense{background:var(--aero-role-guard,#9a67ea);grid-column:1/-1;min-block-size:auto}</style>`);
	}
};
/** Spatial Grid Boxing HUD presenter. */
var AeroBoxingSpatialHud = class extends AeroPresenterElement {
	render() {
		const target = readString(this.presenterSnapshot, "target", "Ready");
		const blockedCells = readNumberList(this.presenterSnapshot, "blockedCells");
		const safeCell = readNumber(this.presenterSnapshot, "safeCell", -1);
		this.renderMarkup(`<section class="panel" part="hud" aria-label="Spatial Grid Boxing"><div class="row"><strong>Spatial Grid</strong><span>${escapeHtml(target)}</span></div><p class="muted">Blocked cells: ${blockedCells.length ? blockedCells.join(", ") : "none"}${safeCell >= 0 ? ` · safe cell ${safeCell}` : ""}</p></section>`);
	}
};
/** Tracking-loss pause presenter. */
var AeroTrackingPause = class extends AeroPresenterElement {
	constructor() {
		super();
		this.dialogActive = false;
		/** @type {HTMLElement | null} */
		this.returnFocus = null;
	}
	render() {
		const active = readBoolean(this.presenterSnapshot, "active", false);
		const message = readString(this.presenterSnapshot, "message", "Tracking paused. Recalibrate to continue.");
		const reason = readString(this.presenterSnapshot, "reason", "tracking_lost");
		if (active && !this.dialogActive) this.returnFocus = deepActiveElement$1();
		const restoreFocus = !active && this.dialogActive ? this.returnFocus : null;
		this.dialogActive = active;
		this.toggleAttribute("hidden", !active);
		this.renderMarkup(`<section class="overlay" part="overlay" role="alertdialog" aria-modal="true" aria-labelledby="tracking-heading" aria-describedby="tracking-message"><h2 id="tracking-heading">Workout paused</h2><p id="tracking-message">${escapeHtml(message)}</p><span class="pill">${escapeHtml(reason)}</span><button part="recalibrate-button" type="button" data-intent="calibration-reset">Recalibrate</button></section><style>:host{inset:0;position:absolute;z-index:20}:host([hidden]){display:none}.overlay{align-content:center;background:rgba(4,17,30,var(--aero-overlay-dim-opacity,.72));block-size:100%;color:#fff;display:grid;gap:14px;inline-size:100%;justify-items:center;padding:24px;text-align:center}</style>`);
		queueMicrotask(() => {
			if (active) {
				const action = this.shadowRoot?.querySelector("button[data-intent='calibration-reset']");
				if (action instanceof HTMLElement) action.focus();
			} else if (restoreFocus?.isConnected) restoreFocus.focus();
		});
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		if (this.dialogActive && this.returnFocus?.isConnected) this.returnFocus.focus();
	}
};
/** Frozen-time resume countdown presenter. */
var AeroResumeCountdown = class extends AeroPresenterElement {
	render() {
		const active = readBoolean(this.presenterSnapshot, "active", false);
		const value = readNumber(this.presenterSnapshot, "value", 3);
		const frozen = readBoolean(this.presenterSnapshot, "frozen", true);
		this.toggleAttribute("hidden", !active);
		this.renderMarkup(`<div class="countdown" part="countdown" role="status" aria-live="assertive" aria-label="Resume countdown ${value}"><strong>${value}</strong><span>${frozen ? "Workout time frozen" : "Get ready"}</span></div><style>:host{display:grid;inset:0;place-items:center;pointer-events:none;position:absolute;z-index:19}:host([hidden]){display:none}.countdown{align-items:center;background:rgba(4,17,30,.82);border-radius:50%;color:#fff;display:grid;inline-size:8rem;justify-items:center;min-block-size:8rem;padding:12px;text-align:center}.countdown strong{font-size:3.6rem;line-height:1}</style>`);
	}
};
/** Cosmetic environment presenter; loading/fallback policy remains outside UI. */
var AeroBackgroundEnvironment = class extends AeroPresenterElement {
	render() {
		const label = readString(this.presenterSnapshot, "label", "AeroBeat environment");
		const url = readString(this.presenterSnapshot, "url", "");
		const fallback = readBoolean(this.presenterSnapshot, "fallback", false);
		this.renderMarkup(`<div class="environment" part="environment" role="img" aria-label="${escapeAttribute(label)}"><span class="pill">${fallback ? "Fallback environment" : escapeHtml(label)}</span></div><style>:host{inset:0;position:absolute;z-index:-1}.environment{background:linear-gradient(160deg,var(--aero-playfield-background-start,#071426),var(--aero-playfield-background-end,#153b5d));block-size:100%;inline-size:100%;padding:12px}</style>`);
		const environment = this.shadowRoot?.querySelector(".environment");
		if (environment instanceof HTMLElement && isSafeVisualUrl(url)) environment.style.backgroundImage = `url(${JSON.stringify(url)})`;
	}
};
/** Child-owned fullscreen request presenter. */
var AeroFullscreenButton = class extends AeroPresenterElement {
	render() {
		const supported = readBoolean(this.presenterSnapshot, "supported", false);
		const active = readBoolean(this.presenterSnapshot, "active", false);
		const pending = readBoolean(this.presenterSnapshot, "requestPending", false);
		const error = readString(this.presenterSnapshot, "errorCode", "");
		this.renderMarkup(`<div class="stack"><button part="control" type="button" data-intent="${active ? "fullscreen-exit" : "fullscreen-request"}" aria-pressed="${active}" ${supported && !pending ? "" : "disabled"}>${active ? "Exit fullscreen" : "Enter fullscreen"}</button>${error ? `<span class="error" role="status">${escapeHtml(error)}</span>` : ""}</div>`);
	}
};
/** Capability and limitation presenter. */
var AeroCapabilitiesPanel = class extends AeroPresenterElement {
	render() {
		const limitations = readStringList(this.presenterSnapshot, "limitations");
		this.renderMarkup(`<section class="panel ${limitations.length ? "" : "compact-hide-when-clear"}" part="panel" aria-labelledby="capabilities-heading"><h2 id="capabilities-heading">Device capabilities</h2><div class="cards compact-telemetry">${[
			"camera",
			"fullscreen",
			"autoplay",
			"webgl2",
			"indexedDb",
			"worker",
			"directBeatSaverCors",
			"localZipImport"
		].map((name) => `<span class="pill">${escapeHtml(titleCase(name))}: ${readBoolean(this.presenterSnapshot, name, false) ? "available" : "unavailable"}</span>`).join("")}</div>${limitations.length ? `<ul part="limitations" aria-label="Device limitations">${limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="muted">No reported limitations.</p>`}</section>`);
	}
};
/** User-safe error presenter. */
var AeroErrorPanel = class extends AeroPresenterElement {
	render() {
		const code = readString(this.presenterSnapshot, "code", "unknown_error");
		const message = readString(this.presenterSnapshot, "message", "An unexpected error occurred.");
		const retryable = readBoolean(this.presenterSnapshot, "retryable", false);
		this.renderMarkup(`<section class="panel" part="panel" role="alert"><h2>Something needs attention</h2><p class="error">${escapeHtml(message)}</p><span class="pill">${escapeHtml(code)}</span>${retryable ? `<button part="retry-button" type="button" data-intent="error-retry">Try again</button>` : ""}</section>`);
	}
};
var prototypeOptions = Object.freeze([
	Object.freeze({
		id: "flow",
		label: "Flow · Grid",
		productLabel: "Flow",
		rulesetId: rulesetIds[0],
		recipeId: ""
	}),
	Object.freeze({
		id: "semantic-row",
		label: "Semantic Track · Row Family",
		productLabel: "Semantic Row",
		rulesetId: rulesetIds[1],
		recipeId: conversionRecipeIds[0]
	}),
	Object.freeze({
		id: "spatial-row",
		label: "Spatial Grid · Row Family",
		productLabel: "Spatial Row",
		rulesetId: rulesetIds[2],
		recipeId: conversionRecipeIds[0]
	}),
	Object.freeze({
		id: "semantic-cut",
		label: "Semantic Track · Cut Family",
		productLabel: "Semantic Cut",
		rulesetId: rulesetIds[1],
		recipeId: conversionRecipeIds[1]
	}),
	Object.freeze({
		id: "spatial-cut",
		label: "Spatial Grid · Cut Family",
		productLabel: "Spatial Cut",
		rulesetId: rulesetIds[2],
		recipeId: conversionRecipeIds[1]
	})
]);
var profileClasses = Object.freeze([
	"live_visual",
	"between_run_ruleset",
	"converter_regeneration"
]);
var scoringChangeStates = Object.freeze([
	"idle",
	"calibrating",
	"paused_manual",
	"paused_tracking",
	"completed",
	"stopped"
]);
/** Flow/four-Boxing prototype and three-class experimental profile presenter. Product embeds may narrow it to Gameplay or Visuals with `[scope]`. */
var AeroPrototypeSelector = class extends AeroPresenterElement {
	static get observedAttributes() {
		return ["scope"];
	}
	/** Narrow product view, or the unchanged full development view when omitted. @returns {"gameplay" | "visuals" | "full"} */
	get scope() {
		const value = this.getAttribute("scope");
		return value === "gameplay" || value === "visuals" ? value : "full";
	}
	/** @param {string | null} value */
	set scope(value) {
		if (value === "gameplay" || value === "visuals") this.setAttribute("scope", value);
		else this.removeAttribute("scope");
	}
	/** @returns {void} */
	attributeChangedCallback() {
		this.render();
	}
	/** Atomically accept an exact public profile snapshot; malformed input preserves prior state. @param {AeroPresenterSnapshot} snapshot */
	setSnapshot(snapshot) {
		if (!isPlainRecord$2(snapshot) || Object.hasOwn(snapshot, "profileClasses") && !isValidProfilePresenterSnapshot(snapshot)) return;
		super.setSnapshot(snapshot);
	}
	/** Deterministic, immutable host-readable profile state; never a bundle. @returns {Readonly<{selectedProfileId:string,sessionState:string,profileClasses:readonly ProfileClassState[]}>} */
	getProfilePresenterState() {
		const selectedSnapshot = readString(this.presenterSnapshot, "selectedProfileId", "flow");
		return Object.freeze({
			selectedProfileId: prototypeOptions.some((option) => option.id === selectedSnapshot) ? selectedSnapshot : "flow",
			sessionState: readString(this.presenterSnapshot, "sessionState", "idle"),
			profileClasses: normalizeProfileClassStates(this.presenterSnapshot)
		});
	}
	render() {
		const selectedSnapshot = readString(this.presenterSnapshot, "selectedProfileId", "flow");
		const selected = prototypeOptions.some((option) => option.id === selectedSnapshot) ? selectedSnapshot : "flow";
		if (this.scope === "gameplay") {
			const options = prototypeOptions.map((option) => Object.freeze({
				id: option.id,
				label: option.productLabel,
				profileClass: "",
				profileVersion: "",
				contentHash: ""
			}));
			this.renderMarkup(productRadioMarkup("Gameplay", "gameplay-choice", options, Math.max(0, options.findIndex((option) => option.id === selected)), "prototype-select"));
			return;
		}
		if (this.scope === "visuals") {
			const visualState = readRecordList(this.presenterSnapshot, "profileClasses").find((state) => readString(state, "class", "") === "live_visual");
			const active = visualState ? readRecord(visualState, "active") : null;
			const options = visualState ? readRecordList(visualState, "profiles").map((profile) => Object.freeze({
				id: readString(profile, "profileId", ""),
				label: visualProfileLabel(readString(profile, "profileId", "")),
				profileClass: "live_visual",
				profileVersion: readString(profile, "profileVersion", ""),
				contentHash: readString(profile, "contentHash", "")
			})).filter((option) => option.id !== "") : [];
			const activeIndex = active ? options.findIndex((option) => option.id === readString(active, "profileId", "") && option.profileVersion === readString(active, "profileVersion", "") && option.contentHash === readString(active, "contentHash", "")) : -1;
			this.renderMarkup(productRadioMarkup("Visuals", "visual-choice", options, Math.max(0, activeIndex), "prototype-profile-select"));
			return;
		}
		const sessionState = readString(this.presenterSnapshot, "sessionState", "idle");
		const scoringDisabled = !scoringChangeStates.includes(sessionState);
		const scoringReason = scoringDisabled ? sessionState === "countdown" ? "Scoring profiles are locked during countdown." : "Pause or finish the run to change scoring profiles." : "Scoring profile changes apply between runs.";
		const classStates = normalizeProfileClassStates(this.presenterSnapshot);
		const statusText = classStates.length === 3 ? "Visual, scoring, and converter profile state loaded." : "Profile state is incomplete.";
		this.renderMarkup(`<section class="panel" part="panel" aria-labelledby="profiles-heading"><h2 id="profiles-heading">Workout prototype</h2><div class="cards" part="profiles" role="radiogroup" aria-label="Prototype presentation">${prototypeOptions.map((option) => `<button type="button" part="profile" role="radio" aria-checked="${selected === option.id}" tabindex="${selected === option.id ? "0" : "-1"}" data-intent="prototype-select" data-value="${option.id}"><strong>${escapeHtml(option.label)}</strong><span class="muted">${escapeHtml(option.rulesetId)}${option.recipeId ? ` · ${escapeHtml(option.recipeId)}` : ""}</span></button>`).join("")}</div><p class="muted live compact-status" role="status" aria-live="polite">${escapeHtml(statusText)}</p><section class="stack" part="telemetry" aria-label="Experimental profile management">${classStates.map((state) => profileClassMarkup(state, scoringDisabled, scoringReason)).join("") || `<p class="muted">No valid experimental profile state loaded.</p>`}</section><div class="row" aria-label="Profile bundle actions"><button type="button" part="import-button" data-intent="tuning-import-request" aria-label="Import experimental profile bundle">Import profiles</button><button type="button" part="export-button" data-intent="tuning-export" aria-label="Export experimental profile bundle">Export profiles</button><button type="button" part="reset-button" data-intent="tuning-reset" aria-label="Reset experimental profiles">Reset profiles</button></div></section>`);
	}
	/** Native scoped radios commit on `change`; full-view buttons retain the inherited click path. @param {Event} event */
	handleDelegatedClick(event) {
		const target = event.composedPath()[0];
		if (this.scope !== "full" && target instanceof HTMLInputElement && target.type === "radio") return;
		super.handleDelegatedClick(event);
	}
	/** @param {string} type @param {HTMLElement} target */
	onIntent(type, target) {
		if (type === "prototype-select") {
			for (const radio of this.shadowRoot?.querySelectorAll("button[role='radio']") ?? []) if (radio instanceof HTMLButtonElement) {
				const selected = radio === target;
				radio.tabIndex = selected ? 0 : -1;
				radio.setAttribute("aria-checked", selected ? "true" : "false");
			}
			this.emitIntent(type, { profileId: target.dataset.value ?? "" });
		} else if (type === "prototype-profile-select") this.emitIntent(type, {
			profileClass: target.dataset.profileClass ?? "",
			profileId: target.dataset.value ?? "",
			profileVersion: target.dataset.profileVersion ?? "",
			contentHash: target.dataset.contentHash ?? ""
		});
		else this.emitIntent(type);
	}
	/** @param {KeyboardEvent} event */
	handleDelegatedKeydown(event) {
		const target = event.composedPath()[0];
		if (!(target instanceof HTMLButtonElement) || target.getAttribute("role") !== "radio") return;
		const radios = [...this.shadowRoot?.querySelectorAll("button[role='radio']") ?? []].filter((item) => item instanceof HTMLButtonElement);
		const currentIndex = radios.indexOf(target);
		if (currentIndex < 0) return;
		let nextIndex = currentIndex;
		if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % radios.length;
		else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + radios.length) % radios.length;
		else if (event.key === "Home") nextIndex = 0;
		else if (event.key === "End") nextIndex = radios.length - 1;
		else return;
		event.preventDefault();
		for (const [index, radio] of radios.entries()) {
			radio.tabIndex = index === nextIndex ? 0 : -1;
			radio.setAttribute("aria-checked", index === nextIndex ? "true" : "false");
		}
		const next = radios[nextIndex];
		next.focus();
		this.emitIntent("prototype-select", { profileId: next.dataset.value ?? "" });
	}
};
/** @type {Readonly<Record<string, CustomElementConstructor>>} */
var aeroProductPresenterConstructors = Object.freeze({
	[elementNames.beatSaverBrowser]: AeroBeatSaverBrowser,
	[elementNames.contentImportProgress]: AeroContentImportProgress,
	[elementNames.contentLibrary]: AeroContentLibrary,
	[elementNames.calibrationBadge]: AeroCalibrationBadge,
	[elementNames.gridPlayfield]: AeroGridPlayfield,
	[elementNames.flowHud]: AeroFlowHud,
	[elementNames.boxingTrackHud]: AeroBoxingTrackHud,
	[elementNames.boxingSpatialHud]: AeroBoxingSpatialHud,
	[elementNames.trackingPause]: AeroTrackingPause,
	[elementNames.countdown]: AeroResumeCountdown,
	[elementNames.prototypeSelector]: AeroPrototypeSelector,
	[elementNames.fullscreenButton]: AeroFullscreenButton,
	"aero-background-environment": AeroBackgroundEnvironment,
	"aero-capabilities-panel": AeroCapabilitiesPanel,
	"aero-error-panel": AeroErrorPanel
});
/** Defines all Task 9 product presenter elements idempotently. @returns {void} */
function defineAeroProductPresenters() {
	for (const [name, constructor] of Object.entries(aeroProductPresenterConstructors)) if (!customElements.get(name)) customElements.define(name, constructor);
}
/** @param {Readonly<Record<string, unknown>>} record @param {string} key @param {string} fallback @returns {string} */
function readString(record, key, fallback) {
	const value = record[key];
	return typeof value === "string" ? value : fallback;
}
/** @param {Readonly<Record<string, unknown>>} record @param {string} key @param {number} fallback @returns {number} */
function readNumber(record, key, fallback) {
	const value = record[key];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
/** @param {Readonly<Record<string, unknown>>} record @param {string} key @returns {number} */
function readStorageBytes(record, key) {
	return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(readNumber(record, key, 0))));
}
/** @param {Readonly<Record<string, unknown>>} record @param {string} key @param {boolean} fallback @returns {boolean} */
function readBoolean(record, key, fallback) {
	const value = record[key];
	return typeof value === "boolean" ? value : fallback;
}
/** @param {Readonly<Record<string, unknown>>} record @param {string} key @returns {Readonly<Record<string, unknown>> | null} */
function readRecord(record, key) {
	const value = record[key];
	return isPlainRecord$2(value) ? value : null;
}
/** @param {Readonly<Record<string, unknown>>} record @param {string} key @returns {Readonly<Record<string, unknown>>[]} */
function readRecordList(record, key) {
	const value = record[key];
	return Array.isArray(value) ? value.filter(isPlainRecord$2) : [];
}
/** @param {Readonly<Record<string, unknown>>} record @param {string} key @returns {string[]} */
function readStringList(record, key) {
	const value = record[key];
	return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
/** @param {Readonly<Record<string, unknown>>} record @param {string} key @returns {number[]} */
function readNumberList(record, key) {
	const value = record[key];
	return Array.isArray(value) ? value.filter((item) => typeof item === "number" && Number.isFinite(item)) : [];
}
/** @param {unknown} value @returns {value is Readonly<Record<string, unknown>>} */
function isPlainRecord$2(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	try {
		const prototype = Object.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	} catch {
		return false;
	}
}
/** Narrow an external presenter snapshot to immutable JSON-like data. @param {unknown} value @returns {AeroPresenterSnapshot} */
function narrowAeroPresenterSnapshot(value) {
	const narrowed = narrowSnapshotValue(value, /* @__PURE__ */ new Set(), 0);
	return isPlainRecord$2(narrowed) ? narrowed : Object.freeze({});
}
/** @param {unknown} value @param {Set<object>} seen @param {number} depth @returns {unknown} */
function narrowSnapshotValue(value, seen, depth) {
	if (value === null || typeof value === "boolean") return value;
	if (typeof value === "string") return value.slice(0, 4096);
	if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
	if (depth >= 10 || typeof value !== "object" || value === null || seen.has(value)) return void 0;
	if (Array.isArray(value)) {
		seen.add(value);
		const items = [];
		const length = Math.min(500, value.length);
		for (let index = 0; index < length; index += 1) {
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
			if (!descriptor || !("value" in descriptor)) continue;
			const narrowed = narrowSnapshotValue(descriptor.value, seen, depth + 1);
			if (narrowed !== void 0) items.push(narrowed);
		}
		seen.delete(value);
		return Object.freeze(items);
	}
	if (!isPlainRecord$2(value)) return void 0;
	seen.add(value);
	/** @type {Record<string, unknown>} */
	const record = {};
	try {
		for (const key of Reflect.ownKeys(value).slice(0, 500)) {
			if (typeof key !== "string") continue;
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor?.enumerable || !("value" in descriptor)) continue;
			const narrowed = narrowSnapshotValue(descriptor.value, seen, depth + 1);
			if (narrowed !== void 0) record[key] = narrowed;
		}
	} catch {
		seen.delete(value);
		return;
	}
	seen.delete(value);
	return Object.freeze(record);
}
/** @returns {HTMLElement | null} */
function deepActiveElement$1() {
	let active = document.activeElement;
	while (active instanceof HTMLElement && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
	return active instanceof HTMLElement ? active : null;
}
/** @param {string} value @returns {string} */
function escapeHtml(value) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}
/** @param {string} value @returns {string} */
function escapeAttribute(value) {
	return escapeHtml(value).replaceAll("`", "&#96;");
}
/** @param {number} value @param {number} min @param {number} max @returns {number} */
function clamp$1(value, min, max) {
	return Math.min(max, Math.max(min, value));
}
/** @param {string} value @returns {string} */
function titleCase(value) {
	return value.replaceAll(/[_-]/gu, " ").replaceAll(/\b\w/gu, (letter) => letter.toUpperCase());
}
/** @param {string} state @param {number} count @returns {string} */
function statusText(state, count) {
	if (state === "loading") return "Loading BeatSaver maps…";
	if (state === "empty") return "No compatible maps found.";
	if (count > 0) return `${count} map${count === 1 ? "" : "s"} available.`;
	return "Search or browse latest maps.";
}
/** @param {Readonly<Record<string, unknown>>} result @param {boolean} checked @returns {string} */
function mapResultMarkup(result, checked) {
	const id = readString(result, "mapId", "");
	const name = readString(result, "name", "Untitled map");
	const author = readString(result, "songAuthorName", "Unknown artist");
	return `<article><label class="card choice-radio" part="result"><input type="radio" name="beatsaver-map-choice" value="${escapeAttribute(id)}" data-intent="beatsaver-select-map" data-value="${escapeAttribute(id)}" ${checked ? "checked" : ""}><span class="choice-copy"><strong>${escapeHtml(name)}</strong><span class="muted">${escapeHtml(author)} · ${escapeHtml(id)}</span></span></label></article>`;
}
/** @param {string} value @param {string} label @param {string} selected @returns {string} */
function optionMarkup(value, label, selected) {
	return `<option value="${escapeAttribute(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}
/** @typedef {Readonly<{state:"idle"|"loading"|"playing"|"ended"|"error",mapId:string,versionHash:string,packageId:string,errorMessage:string}>} PreviewSnapshot */
/** Default selected-map markup remains byte-for-byte compatible when compact mode is absent. @param {Readonly<Record<string, unknown>>} selected @param {readonly Readonly<Record<string, unknown>>[]} versions @param {readonly string[]} difficulties @param {string} selectedVersion @param {string} selectedDifficulty @returns {string} */
function defaultBeatSaverDetailMarkup(selected, versions, difficulties, selectedVersion, selectedDifficulty) {
	return `<section class="card" part="detail" aria-label="Selected map"><h3>${escapeHtml(readString(selected, "name", "Selected map"))}</h3><p class="muted">${escapeHtml(readString(selected, "songAuthorName", ""))} · mapped by ${escapeHtml(readString(selected, "levelAuthorName", "Unknown"))}</p>
          <label><span class="compact-field-label">Version</span><select aria-label="Version" part="version-select" data-intent="beatsaver-version-select">${versions.map((version) => optionMarkup(readString(version, "versionHash", ""), readString(version, "label", readString(version, "versionHash", "Version")), selectedVersion)).join("")}</select></label>
          <label><span class="compact-field-label">Difficulty</span><select aria-label="Difficulty" part="difficulty-select" data-intent="beatsaver-difficulty-select">${difficulties.map((difficulty) => optionMarkup(difficulty, difficulty, selectedDifficulty)).join("")}</select></label>
          <button part="import-button" type="button" data-intent="beatsaver-import" ${selectedVersion && selectedDifficulty ? "" : "disabled"}>Import selected map</button></section>`;
}
/** Compact selected-map markup exposes version-level Preview and Download only. Difficulty belongs to downloaded songs. @param {Readonly<Record<string, unknown>>} selected @param {readonly Readonly<Record<string, unknown>>[]} versionRecords @param {readonly string[]} _difficultyValues @param {string} selectedVersion @param {string} _selectedDifficulty @param {PreviewSnapshot} preview @returns {string} */
function compactBeatSaverDetailMarkup(selected, versionRecords, _difficultyValues, selectedVersion, _selectedDifficulty, preview) {
	const mapId = readBoundedString(selected, "mapId", "", 256);
	const mapName = readBoundedString(selected, "name", "Selected map", 256);
	const versions = versionRecords.filter((version) => readBoundedString(version, "versionHash", "", 256) !== "").slice(0, 32);
	const effectiveVersion = versions.some((version) => readString(version, "versionHash", "") === selectedVersion) ? selectedVersion : readString(versions[0] ?? {}, "versionHash", "");
	const exactPreview = preview.mapId === mapId && preview.versionHash === effectiveVersion;
	const previewActive = exactPreview && (preview.state === "loading" || preview.state === "playing");
	const previewError = exactPreview && preview.state === "error" ? preview.errorMessage : "";
	const previewLabel = previewActive ? "Stop" : "Preview";
	const versionField = compactChoiceFieldMarkup("Version", "version-select", "beatsaver-version-select", versions.map((version) => ({
		value: readBoundedString(version, "versionHash", "", 256),
		label: readBoundedString(version, "label", readBoundedString(version, "versionHash", "Version", 256), 256)
	})), effectiveVersion);
	return `<section class="card" part="detail" aria-label="Selected map"><h3>${escapeHtml(mapName)}</h3><button class="compact-preview-action" part="preview-button" type="button" data-intent="beatsaver-preview-toggle" aria-label="${previewLabel} ${escapeAttribute(mapName)}" aria-pressed="${previewActive}" aria-busy="${preview.state === "loading" && exactPreview}" ${effectiveVersion ? "" : "disabled"}>${previewLabel}</button>${previewError ? `<p class="error" role="status" aria-live="polite">${escapeHtml(previewError)}</p>` : ""}${versionField}<button part="import-button" type="button" data-intent="beatsaver-import" ${effectiveVersion ? "" : "disabled"}>Download</button></section>`;
}
/** @typedef {Readonly<{value:string,label:string}>} CompactChoice */
/** A compact field is static for one value, a native select for real choice, and an error for none. @param {string} label @param {string} part @param {string} intent @param {readonly CompactChoice[]} choices @param {string} selected @returns {string} */
function compactChoiceFieldMarkup(label, part, intent, choices, selected) {
	if (choices.length === 0) return `<p class="error" role="status">${escapeHtml(label)} unavailable.</p>`;
	if (choices.length === 1) return `<div class="compact-singleton-field" part="${escapeAttribute(part)}"><span>${escapeHtml(label)}</span><output aria-label="${escapeAttribute(label)}">${escapeHtml(choices[0].label)}</output></div>`;
	return `<label><span class="compact-field-label">${escapeHtml(label)}</span><select aria-label="${escapeAttribute(label)}" part="${escapeAttribute(part)}" data-intent="${escapeAttribute(intent)}">${choices.map((choice) => optionMarkup(choice.value, choice.label, selected)).join("")}</select></label>`;
}
/** Read bounded scalar preview presentation state only. @param {Readonly<Record<string, unknown>>} snapshot @returns {PreviewSnapshot} */
function previewSnapshot(snapshot) {
	const preview = readRecord(snapshot, "preview") ?? {};
	const rawState = readBoundedString(preview, "state", "idle", 32);
	const state = [
		"idle",
		"loading",
		"playing",
		"ended",
		"error"
	].includes(rawState) ? rawState : "idle";
	return Object.freeze({
		state,
		mapId: readBoundedString(preview, "mapId", "", 256),
		versionHash: readBoundedString(preview, "versionHash", "", 256),
		packageId: readBoundedString(preview, "packageId", "", 1024),
		errorMessage: readBoundedString(preview, "errorMessage", "", 256)
	});
}
/** @param {Readonly<Record<string, unknown>>} record @param {string} key @param {string} fallback @param {number} maximumLength @returns {string} */
function readBoundedString(record, key, fallback, maximumLength) {
	return readString(record, key, fallback).slice(0, maximumLength);
}
/** @typedef {Readonly<{difficultyId:string,label:string,packageId:string}>} CompactDownloadedDifficulty */
/** @typedef {Readonly<{collectionId:string,songName:string,activePackageId:string,difficulties:readonly CompactDownloadedDifficulty[]}>} CompactDownloadedSong */
/** Read exact bounded collection summaries, or adapt old package summaries into singleton songs. @param {AeroPresenterSnapshot} snapshot @param {readonly Readonly<Record<string, unknown>>[]} packages @returns {readonly CompactDownloadedSong[]} */
function compactDownloadedSongs(snapshot, packages) {
	if (Array.isArray(snapshot.songs)) return Object.freeze(readRecordList(snapshot, "songs").slice(0, 100).map(normalizeDownloadedSong).filter((song) => song !== null));
	return Object.freeze(packages.slice(0, 100).map((item) => {
		const packageId = readBoundedString(item, "packageId", "", 1024);
		if (!packageId) return null;
		const difficulty = readBoundedString(item, "difficulty", "Downloaded", 128);
		return Object.freeze({
			collectionId: packageId,
			songName: readBoundedString(item, "songName", readBoundedString(item, "name", "Downloaded song", 256), 256),
			activePackageId: packageId,
			difficulties: Object.freeze([Object.freeze({
				difficultyId: difficulty,
				label: difficulty,
				packageId
			})])
		});
	}).filter((song) => song !== null));
}
/** @param {Readonly<Record<string, unknown>>} record @returns {CompactDownloadedSong | null} */
function normalizeDownloadedSong(record) {
	if (!hasExactKeys$1(record, [
		"collectionId",
		"songName",
		"activePackageId",
		"difficulties"
	])) return null;
	const collectionId = readBoundedString(record, "collectionId", "", 1024);
	const songName = readBoundedString(record, "songName", "", 256);
	const rawDifficulties = readRecordList(record, "difficulties");
	if (!collectionId || !songName || rawDifficulties.length === 0 || rawDifficulties.length > 8) return null;
	/** @type {CompactDownloadedDifficulty[]} */
	const difficulties = [];
	const packageIds = /* @__PURE__ */ new Set();
	const difficultyIds = /* @__PURE__ */ new Set();
	for (const difficulty of rawDifficulties) {
		if (!hasExactKeys$1(difficulty, [
			"difficultyId",
			"label",
			"packageId"
		])) return null;
		const difficultyId = readBoundedString(difficulty, "difficultyId", "", 128);
		const label = readBoundedString(difficulty, "label", "", 128);
		const packageId = readBoundedString(difficulty, "packageId", "", 1024);
		if (!difficultyId || !label || !packageId || packageIds.has(packageId) || difficultyIds.has(difficultyId)) return null;
		packageIds.add(packageId);
		difficultyIds.add(difficultyId);
		difficulties.push(Object.freeze({
			difficultyId,
			label,
			packageId
		}));
	}
	const declaredActive = readBoundedString(record, "activePackageId", "", 1024);
	const activePackageId = packageIds.has(declaredActive) ? declaredActive : difficulties[0].packageId;
	return Object.freeze({
		collectionId,
		songName,
		activePackageId,
		difficulties: Object.freeze(difficulties)
	});
}
/** @param {AeroPresenterSnapshot} snapshot @param {readonly CompactDownloadedSong[]} songs @param {string} pendingCollectionId @param {string} pendingPackageId @returns {string} */
function compactSelectedCollectionId(snapshot, songs, pendingCollectionId, pendingPackageId) {
	if (songs.some((song) => song.collectionId === pendingCollectionId)) return pendingCollectionId;
	const selectedCollectionId = readBoundedString(snapshot, "selectedCollectionId", "", 1024);
	if (songs.some((song) => song.collectionId === selectedCollectionId)) return selectedCollectionId;
	const selectedPackageId = pendingPackageId || readBoundedString(snapshot, "selectedPackageId", "", 1024);
	return songs.find((song) => song.difficulties.some((difficulty) => difficulty.packageId === selectedPackageId))?.collectionId ?? songs[0]?.collectionId ?? "";
}
/** @param {readonly CompactDownloadedSong[]} songs @param {string} selectedCollectionId @param {string} pendingPackageId @param {string} pendingDeleteCollectionId @param {string} error @param {PreviewSnapshot} preview @returns {string} */
function compactLibraryMarkup(songs, selectedCollectionId, pendingPackageId, pendingDeleteCollectionId, error, preview) {
	const selectedIndex = songs.findIndex((song) => song.collectionId === selectedCollectionId);
	const checkedIndex = songs.length ? Math.max(0, selectedIndex) : -1;
	const totals = /* @__PURE__ */ new Map();
	for (const song of songs) totals.set(song.songName, (totals.get(song.songName) ?? 0) + 1);
	const positions = /* @__PURE__ */ new Map();
	/** @type {string[]} */
	const labels = [];
	const choices = songs.map((song, index) => {
		const position = (positions.get(song.songName) ?? 0) + 1;
		positions.set(song.songName, position);
		const label = (totals.get(song.songName) ?? 0) > 1 ? `${song.songName} · ${position}` : song.songName;
		labels[index] = label;
		return `<label class="compact-library-choice" part="item"><input type="radio" name="library-song-choice" value="${escapeAttribute(song.collectionId)}" data-intent="library-select" data-value="${escapeAttribute(song.collectionId)}" aria-label="Select ${escapeAttribute(label)}" ${index === checkedIndex ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`;
	}).join("");
	const selected = checkedIndex >= 0 ? songs[checkedIndex] : null;
	const actions = selected ? compactLibraryActions(selected, pendingPackageId, pendingDeleteCollectionId, labels[checkedIndex] ?? selected.songName, preview) : "";
	return `<section class="panel compact-library" part="panel" aria-labelledby="library-heading"><h2 id="library-heading">Downloaded songs</h2>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}<div class="compact-library-choices" part="items" role="radiogroup" aria-label="Downloaded songs">${choices || `<p class="muted compact-critical">No downloaded songs.</p>`}</div>${actions}</section>`;
}
/** @param {CompactDownloadedSong} song @param {string} pendingPackageId @param {string} pendingDeleteCollectionId @param {string} label @param {PreviewSnapshot} preview @returns {string} */
function compactLibraryActions(song, pendingPackageId, pendingDeleteCollectionId, label, preview) {
	const selectedPackageId = song.difficulties.some((difficulty) => difficulty.packageId === pendingPackageId) ? pendingPackageId : song.activePackageId;
	const accessibleLabel = escapeAttribute(label);
	const pendingDelete = song.collectionId === pendingDeleteCollectionId;
	const exactPreview = preview.packageId === selectedPackageId;
	const previewActive = exactPreview && (preview.state === "loading" || preview.state === "playing");
	const previewLabel = previewActive ? "Stop" : "Preview";
	const previewError = exactPreview && preview.state === "error" ? preview.errorMessage : "";
	const difficulty = song.difficulties.find((entry) => entry.packageId === selectedPackageId) ?? song.difficulties[0];
	const difficultyLabel = `Difficulty for ${label}`;
	const difficultyField = song.difficulties.length === 1 ? `<div class="compact-singleton-field" part="difficulty-select"><span>Difficulty</span><output aria-label="${escapeAttribute(difficultyLabel)}">${escapeHtml(difficulty.label)}</output></div>` : `<label><span class="compact-field-label">Difficulty</span><select aria-label="${escapeAttribute(difficultyLabel)}" part="difficulty-select" data-intent="library-difficulty-select" data-collection-id="${escapeAttribute(song.collectionId)}">${song.difficulties.map((entry) => optionMarkup(entry.packageId, entry.label, selectedPackageId)).join("")}</select></label>`;
	const deleteControls = pendingDelete ? `<span role="status">Delete ${escapeHtml(label)}?</span><button type="button" aria-label="Confirm delete ${accessibleLabel}" data-intent="library-delete" data-value="${escapeAttribute(song.collectionId)}">Confirm</button><button type="button" aria-label="Cancel deleting ${accessibleLabel}" data-intent="library-delete-cancel" data-value="${escapeAttribute(song.collectionId)}">Cancel</button>` : `<button type="button" aria-label="Delete ${accessibleLabel}" data-intent="library-delete-request" data-value="${escapeAttribute(song.collectionId)}">Delete</button>`;
	return `<div class="row compact-library-actions" part="selected-actions" aria-label="Selected song actions"><button class="compact-preview-action" part="preview-button" type="button" aria-label="${previewLabel} ${accessibleLabel}" aria-pressed="${previewActive}" aria-busy="${exactPreview && preview.state === "loading"}" data-intent="library-preview-toggle" data-value="${escapeAttribute(selectedPackageId)}">${previewLabel}</button>${previewError ? `<p class="error" role="status" aria-live="polite">${escapeHtml(previewError)}</p>` : ""}${difficultyField}<button type="button" aria-label="Export ${accessibleLabel}" data-intent="library-export" data-value="${escapeAttribute(selectedPackageId)}">Export</button>${deleteControls}</div>`;
}
/** @param {Readonly<Record<string, unknown>>} item @param {string} pendingDeletePackageId @param {boolean} checked @returns {string} */
function libraryItemMarkup(item, pendingDeletePackageId, checked) {
	const id = readString(item, "packageId", "");
	const name = readString(item, "name", "Untitled package");
	const variantCount = readNumber(item, "variantCount", 0);
	const pending = id !== "" && id === pendingDeletePackageId;
	const accessibleName = escapeAttribute(name);
	const deleteControls = pending ? `<span role="status">Delete ${escapeHtml(name)}?</span><button type="button" aria-label="Confirm delete ${accessibleName}" data-intent="library-delete" data-value="${escapeAttribute(id)}">Confirm delete</button><button type="button" aria-label="Cancel deleting ${accessibleName}" data-intent="library-delete-cancel" data-value="${escapeAttribute(id)}">Cancel</button>` : `<button type="button" aria-label="Delete ${accessibleName}" data-intent="library-delete-request" data-value="${escapeAttribute(id)}">Delete</button>`;
	return `<article class="card" part="item"><label class="choice-radio"><input type="radio" name="library-package-choice" value="${escapeAttribute(id)}" data-intent="library-select" data-value="${escapeAttribute(id)}" aria-label="Select ${accessibleName}" ${checked ? "checked" : ""}><span class="choice-copy"><strong>${escapeHtml(name)}</strong><span class="muted">${variantCount} playable variant${variantCount === 1 ? "" : "s"}</span></span></label><div class="row"><button type="button" aria-label="Export ${accessibleName}" data-intent="library-export" data-value="${escapeAttribute(id)}">Export</button>${deleteControls}</div></article>`;
}
/** @param {number} used @param {number} quota @returns {string} */
function formatStorage(used, quota) {
	if (quota <= 0) return `${formatBytes(used)} stored · quota unavailable`;
	if (used > quota) return `${formatBytes(used)} of ${formatBytes(quota)} used · over quota`;
	return `${formatBytes(used)} of ${formatBytes(quota)} used (${Math.round(used / quota * 100)}%)`;
}
/** @param {number} bytes @returns {string} */
function formatBytes(bytes) {
	if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / 1048576).toFixed(1)} MiB`;
}
/** @param {string} state @returns {string} */
function calibrationMessage(state) {
	return {
		waiting: "Step back until your upper body is visible.",
		holding: "Hold a steady T-pose for four seconds.",
		cooldown: "Calibration captured. Relax your arms.",
		calibrated: "Calibration ready.",
		tracking_lost: "Tracking lost. A fresh calibration is required.",
		error: "Calibration could not complete."
	}[state] ?? "Calibration required.";
}
/** @typedef {Readonly<{schema:"aerobeat/prototype_tuning_identity",version:1,profileId:string,profileVersion:string,contentHash:string,class:string,regenerationRequired:boolean}>} ProfileIdentity */
/** @typedef {Readonly<{class:string,active:ProfileIdentity,profiles:readonly ProfileIdentity[],experimental:boolean,selectedContentHash:string,appliedContentHash:string,pendingContentHash:string|null,regenerationRequired:boolean}>} ProfileClassState */
/** @typedef {Readonly<{id:string,label:string,profileClass:string,profileVersion:string,contentHash:string}>} ProductRadioOption */
/** Native product radio group with no development identity text. @param {string} heading @param {string} name @param {readonly ProductRadioOption[]} options @param {number} selectedIndex @param {string} intent @returns {string} */
function productRadioMarkup(heading, name, options, selectedIndex, intent) {
	return `<section class="panel product-selector" part="panel" aria-labelledby="product-selector-heading"><h2 id="product-selector-heading">${escapeHtml(heading)}</h2><fieldset part="choices"><legend class="visually-hidden">Choose ${escapeHtml(heading)}</legend><div class="product-radios">${options.map((option, index) => `<label class="product-radio"><input type="radio" name="${escapeAttribute(name)}" value="${escapeAttribute(option.id)}" data-intent="${escapeAttribute(intent)}" data-value="${escapeAttribute(option.id)}" data-profile-class="${escapeAttribute(option.profileClass)}" data-profile-version="${escapeAttribute(option.profileVersion)}" data-content-hash="${escapeAttribute(option.contentHash)}" ${index === selectedIndex ? "checked" : ""}><span>${escapeHtml(option.label)}</span></label>`).join("")}</div></fieldset></section><style>:host([scope]) .product-selector{gap:8px}:host([scope]) fieldset{border:0;margin:0;min-inline-size:0;padding:0}:host([scope]) .product-radios{display:grid;gap:6px}:host([scope]) .product-radio{align-items:center;background:rgba(255,255,255,.72);border:1px solid rgba(53,141,175,.3);border-radius:10px;cursor:pointer;display:flex;font-size:1rem;gap:10px;min-block-size:42px;padding:0 10px}:host([scope]) .product-radio:has(input:checked){background:rgba(10,132,255,.14);border-color:var(--aero-color-focus,#0a84ff);box-shadow:inset 0 0 0 1px var(--aero-color-focus,#0a84ff)}:host([scope]) .product-radio input[type="radio"]{accent-color:var(--aero-color-focus,#0a84ff);block-size:42px;flex:0 0 42px;inline-size:42px;margin:0;padding:0}:host([scope]) .product-radio span{font-weight:750}:host([scope][compact]) .product-selector h2{block-size:1px;clip:rect(0 0 0 0);clip-path:inset(50%);inline-size:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;white-space:nowrap}</style>`;
}
/** Human-facing live visual label. @param {string} profileId @returns {string} */
function visualProfileLabel(profileId) {
	return titleCase(profileId.replace(/^aero\.visual\./u, "").replaceAll(/(?:^|[._-])experimental(?:[._-]|$)/giu, " ").trim() || "Visual");
}
/** Validate one complete selector snapshot without invoking accessors. @param {unknown} value @returns {boolean} */
function isValidProfilePresenterSnapshot(value) {
	if (!hasExactKeys$1(value, [
		"selectedProfileId",
		"sessionState",
		"profileClasses"
	])) return false;
	if (typeof value.selectedProfileId !== "string" || !prototypeOptions.some((option) => option.id === value.selectedProfileId) || typeof value.sessionState !== "string" || value.sessionState.length > 64 || !isExactDataArray(value.profileClasses, 3)) return false;
	const seen = /* @__PURE__ */ new Set();
	for (const state of value.profileClasses) {
		const classDescriptor = typeof state === "object" && state !== null ? Object.getOwnPropertyDescriptor(state, "class") : void 0;
		if (!classDescriptor?.enumerable || !("value" in classDescriptor) || typeof classDescriptor.value !== "string" || !profileClasses.includes(classDescriptor.value) || seen.has(classDescriptor.value)) return false;
		const isConverter = classDescriptor.value === "converter_regeneration";
		if (!hasExactKeys$1(state, isConverter ? [
			"class",
			"active",
			"profiles",
			"experimental",
			"selectedContentHash",
			"appliedContentHash",
			"pendingContentHash",
			"regenerationRequired"
		] : [
			"class",
			"active",
			"profiles",
			"experimental"
		]) || !isPrototypeTuningIdentity(state.active) || state.active.class !== state.class || typeof state.experimental !== "boolean" || !isExactDataArray(state.profiles, 64) || !state.profiles.every((identity) => isPrototypeTuningIdentity(identity) && identity.class === state.class)) return false;
		if (isConverter) {
			const selected = state.selectedContentHash;
			const applied = state.appliedContentHash;
			const pending = state.pendingContentHash;
			if (!isBareHash(selected) || !isBareHash(applied) || pending !== null && !isBareHash(pending) || typeof state.regenerationRequired !== "boolean" || state.active.contentHash !== selected || state.active.regenerationRequired !== state.regenerationRequired) return false;
			if (state.regenerationRequired ? pending !== selected || selected === applied : pending !== null || selected !== applied) return false;
		}
		seen.add(state.class);
	}
	return seen.size === 3;
}
/** @param {unknown} value @param {number} maximumLength @returns {value is readonly unknown[]} */
function isExactDataArray(value, maximumLength) {
	if (!Array.isArray(value) || value.length > maximumLength) return false;
	const keys = Reflect.ownKeys(value);
	if (keys.length !== value.length + 1 || keys.at(-1) !== "length") return false;
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor?.enumerable || !("value" in descriptor)) return false;
	}
	return true;
}
/** @param {unknown} value @returns {value is string} */
function isBareHash(value) {
	return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}
/** @param {Readonly<Record<string, unknown>>} snapshot @returns {readonly ProfileClassState[]} */
function normalizeProfileClassStates(snapshot) {
	const result = [];
	for (const source of readRecordList(snapshot, "profileClasses")) {
		const active = readRecord(source, "active");
		const profiles = readRecordList(source, "profiles");
		profiles.sort((left, right) => `${left.profileId}\u0000${left.profileVersion}\u0000${left.contentHash}`.localeCompare(`${right.profileId}\u0000${right.profileVersion}\u0000${right.contentHash}`));
		const isConverter = active.class === "converter_regeneration";
		result.push(Object.freeze({
			class: active.class,
			active,
			profiles: Object.freeze(profiles),
			experimental: readBoolean(source, "experimental", false),
			selectedContentHash: isConverter ? readString(source, "selectedContentHash", "") : active.contentHash,
			appliedContentHash: isConverter ? readString(source, "appliedContentHash", "") : active.contentHash,
			pendingContentHash: isConverter ? source.pendingContentHash === null ? null : readString(source, "pendingContentHash", "") : null,
			regenerationRequired: isConverter && readBoolean(source, "regenerationRequired", false)
		}));
	}
	result.sort((left, right) => profileClasses.indexOf(left.class) - profileClasses.indexOf(right.class));
	return Object.freeze(result);
}
/** @param {ProfileClassState} state @param {boolean} scoringDisabled @param {string} scoringReason @returns {string} */
function profileClassMarkup(state, scoringDisabled, scoringReason) {
	const isScoring = state.class === "between_run_ruleset";
	const isConverter = state.class === "converter_regeneration";
	const disabled = isScoring && scoringDisabled;
	const policy = state.class === "live_visual" ? "Applies immediately." : isScoring ? scoringReason : state.regenerationRequired ? "Regenerate content to apply this converter profile." : "Selected converter profile matches generated content.";
	const options = state.profiles.length ? `<div class="row" aria-label="${escapeAttribute(titleCase(state.class))} profile choices">${state.profiles.map((profile) => {
		const active = profile.profileId === state.active.profileId && profile.profileVersion === state.active.profileVersion && profile.contentHash === state.active.contentHash;
		return `<button type="button" data-intent="prototype-profile-select" data-profile-class="${escapeAttribute(profile.class)}" data-value="${escapeAttribute(profile.profileId)}" data-profile-version="${escapeAttribute(profile.profileVersion)}" data-content-hash="${escapeAttribute(profile.contentHash)}" aria-pressed="${active}" ${disabled ? "disabled" : ""} aria-label="Select ${escapeAttribute(profile.profileId)} ${escapeAttribute(titleCase(profile.class))} profile">${escapeHtml(profile.profileId)}</button>`;
	}).join("")}</div>` : "";
	const converterTruth = isConverter ? `<p class="muted compact-converter-truth" role="status" aria-live="polite">Selected ${escapeHtml(state.selectedContentHash)}<br>Applied ${escapeHtml(state.appliedContentHash)}<br>Pending ${escapeHtml(state.pendingContentHash ?? "none")}</p>` : "";
	const policyClass = disabled ? "compact-critical" : "compact-explanatory";
	return `<article class="card" data-profile-class="${escapeAttribute(state.class)}"><div class="row"><h3>${escapeHtml(titleCase(state.class))}</h3>${state.experimental ? `<span class="pill compact-telemetry">Experimental</span>` : ""}${state.regenerationRequired ? `<span class="pill error">Regeneration required</span>` : `<span class="pill">Applied</span>`}</div>${identityMarkup(state.active)}<p class="muted live ${policyClass}" role="status" aria-live="polite">${escapeHtml(policy)}</p>${converterTruth}${options}</article>`;
}
/** @param {ProfileIdentity} identity @returns {string} */
function identityMarkup(identity) {
	return `<div class="compact-identity" part="profile-identity"><strong>${escapeHtml(identity.profileId)}</strong><p class="muted">Version ${escapeHtml(identity.profileVersion)} · ${escapeHtml(identity.class)}<br>Hash ${escapeHtml(identity.contentHash)}</p></div>`;
}
/** @param {string} url @returns {boolean} */
function isSafeVisualUrl(url) {
	if (url === "") return false;
	try {
		const parsed = new URL(url, document.baseURI);
		return parsed.protocol === "https:" || parsed.protocol === "blob:" || parsed.protocol === "http:" && parsed.hostname === "127.0.0.1";
	} catch {
		return false;
	}
}
//#endregion
//#region ../aerobeat-web-ui/src/elements/aero-select/aero-select.js
/**
* Public change event dispatched by `aero-select` after option selection.
*
* @type {"aero-select-change"}
*/
var aeroSelectChangeEventName = "aero-select-change";
/**
* @typedef {object} AeroSelectOption
* @property {string} value Stable option value.
* @property {string} label Visible option label.
*/
/**
* Reusable select control for compact phone-test settings.
*/
var AeroSelect = class extends HTMLElement {
	/**
	* Observed attributes for the component.
	*
	* @returns {string[]}
	*/
	static get observedAttributes() {
		return [
			"disabled",
			"label",
			"value"
		];
	}
	/**
	* Creates the select shadow DOM.
	*/
	constructor() {
		super();
		/** @type {AeroSelectOption[]} */
		this.options = [];
		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = `
      <style>
        :host {
          color: var(--aero-color-ink, #103447);
          display: block;
          font-family: var(--aero-font-family, system-ui, sans-serif);
        }

        .field {
          display: grid;
          gap: 4px;
        }

        .label {
          font-size: 0.72rem;
          font-weight: 800;
          line-height: 1.1;
        }

        .control {
          appearance: none;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(218, 246, 255, 0.82)),
            linear-gradient(90deg, transparent calc(100% - 34px), rgba(83, 163, 189, 0.18) calc(100% - 34px));
          border: 1px solid var(--aero-color-border, rgba(53, 141, 175, 0.42));
          border-radius: 8px;
          box-shadow: 0 8px 18px rgba(16, 52, 71, 0.13);
          box-sizing: border-box;
          color: var(--aero-color-ink, #103447);
          font: 750 0.82rem var(--aero-font-family, system-ui, sans-serif);
          inline-size: 100%;
          min-block-size: 36px;
          padding: 8px 34px 8px 10px;
        }

        .select-wrap {
          display: grid;
          position: relative;
        }

        .select-wrap::after {
          block-size: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid #245e77;
          content: "";
          inline-size: 0;
          inset-block-start: 50%;
          inset-inline-end: 12px;
          pointer-events: none;
          position: absolute;
          transform: translateY(-35%);
        }

        :host([disabled]) .control {
          cursor: not-allowed;
          opacity: 0.58;
        }
      </style>
      <label class="field">
        <span class="label"></span>
        <span class="select-wrap">
          <select class="control" part="control"></select>
        </span>
      </label>
    `;
		this.#selectElement().addEventListener("change", () => this.#dispatchChange());
	}
	/**
	* Syncs attributes and options.
	*/
	connectedCallback() {
		this.#render();
	}
	/**
	* Syncs attributes and options.
	*/
	attributeChangedCallback() {
		this.#render();
	}
	/**
	* Replaces the available option set.
	*
	* @param {readonly AeroSelectOption[]} options
	* @returns {void}
	*/
	setOptions(options) {
		this.options = options.map((option) => ({
			value: option.value,
			label: option.label
		}));
		this.#render();
	}
	/**
	* @returns {string}
	*/
	get value() {
		return this.#selectElement().value;
	}
	/**
	* @param {string} value
	*/
	set value(value) {
		this.setAttribute("value", value);
	}
	/**
	* @returns {HTMLSelectElement}
	*/
	#selectElement() {
		const select = this.shadowRoot?.querySelector("select.control");
		if (!(select instanceof HTMLSelectElement)) throw new Error("Aero select control is unavailable.");
		return select;
	}
	/**
	* @returns {void}
	*/
	#render() {
		const label = this.shadowRoot?.querySelector(".label");
		if (label) label.textContent = this.getAttribute("label") ?? "Select";
		const select = this.#selectElement();
		const targetValue = this.getAttribute("value") ?? select.value;
		select.disabled = this.hasAttribute("disabled");
		select.replaceChildren(...this.options.map((option) => {
			const element = document.createElement("option");
			element.value = option.value;
			element.textContent = option.label;
			return element;
		}));
		if (this.options.some((option) => option.value === targetValue)) select.value = targetValue;
	}
	/**
	* @returns {void}
	*/
	#dispatchChange() {
		const select = this.#selectElement();
		this.setAttribute("value", select.value);
		this.dispatchEvent(new CustomEvent(aeroSelectChangeEventName, {
			bubbles: true,
			composed: true,
			detail: {
				value: select.value,
				label: select.selectedOptions[0]?.textContent ?? select.value
			}
		}));
	}
};
/**
* Defines `aero-select` when it is not already registered.
*
* @returns {void}
*/
function defineAeroSelect() {
	if (!customElements.get("aero-select")) customElements.define("aero-select", AeroSelect);
}
//#endregion
//#region ../aerobeat-web-ui/src/elements/aero-status-panel/aero-status-panel.js
/**
* Status panel for calibration, CV, and input proving scenes.
*/
var AeroStatusPanel = class extends HTMLElement {
	/**
	* Observed attributes for the component.
	*
	* @returns {string[]}
	*/
	static get observedAttributes() {
		return ["heading", "status"];
	}
	/**
	* Creates the panel shadow DOM.
	*/
	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .panel {
          background: var(--aero-color-surface, rgba(244, 252, 255, 0.84));
          border: 1px solid var(--aero-color-border, rgba(53, 141, 175, 0.42));
          border-radius: var(--aero-radius-panel, 8px);
          box-shadow: var(--aero-shadow-panel, 0 16px 38px rgba(16, 52, 71, 0.18));
          color: var(--aero-color-ink, #103447);
          display: grid;
          gap: var(--aero-space-2, 8px);
          padding: var(--aero-space-4, 16px);
        }

        .heading {
          font: 700 1rem var(--aero-font-family, system-ui, sans-serif);
        }

        .status {
          font: 500 0.9rem var(--aero-font-family, system-ui, sans-serif);
        }
      </style>
      <section class="panel" part="panel">
        <span class="heading"></span>
        <span class="status"></span>
      </section>
    `;
	}
	/**
	* Syncs attributes into the panel content.
	*/
	connectedCallback() {
		this.#render();
	}
	/**
	* Syncs attributes into the panel content.
	*/
	attributeChangedCallback() {
		this.#render();
	}
	/**
	* Updates the visible panel content.
	*/
	#render() {
		const heading = this.shadowRoot?.querySelector(".heading");
		const status = this.shadowRoot?.querySelector(".status");
		if (heading) heading.textContent = this.getAttribute("heading") ?? "AeroBeat";
		if (status) status.textContent = this.getAttribute("status") ?? "Ready";
	}
};
/**
* Defines `aero-status-panel` when it is not already registered.
*
* @returns {void}
*/
function defineAeroStatusPanel() {
	if (!customElements.get("aero-status-panel")) customElements.define("aero-status-panel", AeroStatusPanel);
}
//#endregion
//#region ../aerobeat-web-ui/src/screens/aero-calibration-screen/aero-calibration-screen.js
/** @typedef {Readonly<Record<string, unknown>>} AeroCalibrationCompositionSnapshot */
/**
* Automatic-calibration composition screen. The screen presents snapshots only;
* camera, pose math, calibration and capability policy stay with their owners.
*/
var AeroCalibrationScreen = class extends HTMLElement {
	constructor() {
		super();
		/** @type {AeroCalibrationCompositionSnapshot} */
		this.screenSnapshot = Object.freeze({});
	}
	connectedCallback() {
		defineAeroMediaPosePreview();
		defineAeroProductPresenters();
		if (!this.shadowRoot) this.attachShadow({ mode: "open" });
		this.#ensureDom();
		this.#applySnapshot();
	}
	disconnectedCallback() {
		const preview = this.shadowRoot?.querySelector("aero-media-pose-preview");
		if (preview instanceof HTMLElement && "clearPoseFrame" in preview && typeof preview.clearPoseFrame === "function") preview.clearPoseFrame();
	}
	/** @param {AeroCalibrationCompositionSnapshot} snapshot @returns {void} */
	setSnapshot(snapshot) {
		this.screenSnapshot = narrowAeroPresenterSnapshot(snapshot);
		this.#applySnapshot();
	}
	/** @returns {void} */
	#ensureDom() {
		if (!this.shadowRoot || this.shadowRoot.childElementCount > 0) return;
		this.shadowRoot.innerHTML = `
      <style>
        :host { block-size: 100%; box-sizing: border-box; display: block; inline-size: 100%; min-block-size: 0; min-inline-size: 0; }
        .layout { block-size: 100%; display: grid; gap: var(--aero-space-4, 16px); grid-template-columns: minmax(0, 1fr) minmax(18rem, .6fr); inline-size: 100%; padding: var(--aero-space-4, 16px); }
        .preview { min-block-size: 16rem; min-inline-size: 0; position: relative; }
        .preview > aero-media-pose-preview, .preview > aero-grid-playfield { block-size: 100%; inline-size: 100%; inset: 0; position: absolute; }
        .status { align-content: start; display: grid; gap: var(--aero-space-3, 12px); min-inline-size: 0; overflow: auto; }
        @media (max-width: 700px), (max-height: 440px) and (orientation: landscape) { .layout { grid-template-columns: 1fr; grid-template-rows: minmax(12rem, 1fr) auto; padding: 10px; } .status { grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); } }
      </style>
      <section class="layout" part="layout" aria-label="Camera calibration">
        <div class="preview" part="preview"><aero-media-pose-preview></aero-media-pose-preview><aero-grid-playfield></aero-grid-playfield></div>
        <div class="status" part="status"><aero-calibration-badge></aero-calibration-badge><aero-capabilities-panel></aero-capabilities-panel></div>
      </section>`;
	}
	/** @returns {void} */
	#applySnapshot() {
		if (!this.shadowRoot || !this.isConnected) return;
		const calibration = isRecord(this.screenSnapshot.calibration) ? this.screenSnapshot.calibration : Object.freeze({ state: "waiting" });
		const capabilities = isRecord(this.screenSnapshot.capabilities) ? this.screenSnapshot.capabilities : Object.freeze({});
		const grid = isRecord(this.screenSnapshot.grid) ? this.screenSnapshot.grid : Object.freeze({
			mode: "calibration",
			dimmed: true,
			label: "Retained calibration grid"
		});
		const badge = this.shadowRoot.querySelector("aero-calibration-badge");
		if (badge instanceof AeroCalibrationBadge) badge.setSnapshot(calibration);
		const capabilityPanel = this.shadowRoot.querySelector("aero-capabilities-panel");
		if (capabilityPanel instanceof AeroCapabilitiesPanel) capabilityPanel.setSnapshot(capabilities);
		const playfield = this.shadowRoot.querySelector("aero-grid-playfield");
		if (playfield instanceof AeroGridPlayfield) playfield.setSnapshot(grid);
	}
};
/** Defines `aero-calibration-screen` idempotently. @returns {void} */
function defineAeroCalibrationScreen() {
	if (!customElements.get("aero-calibration-screen")) customElements.define("aero-calibration-screen", AeroCalibrationScreen);
}
/** @param {unknown} value @returns {value is Readonly<Record<string, unknown>>} */
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region ../aerobeat-web-ui/src/index.js
/** Defines every public AeroBeat UI component idempotently. @returns {void} */
function defineAeroUiElements() {
	defineAeroButton();
	defineAeroMediaPosePreview();
	defineAeroPoseFlowPanel();
	defineAeroProductPresenters();
	defineAeroSelect();
	defineAeroStatusPanel();
	defineAeroCalibrationScreen();
}
Object.freeze({
	aeroButton: AeroButton,
	aeroMediaPosePreview: AeroMediaPosePreview,
	aeroPoseFlowPanel: AeroPoseFlowPanel,
	aeroSelect: AeroSelect,
	aeroStatusPanel: AeroStatusPanel,
	aeroCalibrationScreen: AeroCalibrationScreen,
	aeroBeatSaverBrowser: AeroBeatSaverBrowser,
	aeroContentImportProgress: AeroContentImportProgress,
	aeroContentLibrary: AeroContentLibrary,
	aeroCalibrationBadge: AeroCalibrationBadge,
	aeroGridPlayfield: AeroGridPlayfield,
	aeroFlowHud: AeroFlowHud,
	aeroBoxingTrackHud: AeroBoxingTrackHud,
	aeroBoxingSpatialHud: AeroBoxingSpatialHud,
	aeroTrackingPause: AeroTrackingPause,
	aeroResumeCountdown: AeroResumeCountdown,
	aeroBackgroundEnvironment: AeroBackgroundEnvironment,
	aeroFullscreenButton: AeroFullscreenButton,
	aeroCapabilitiesPanel: AeroCapabilitiesPanel,
	aeroErrorPanel: AeroErrorPanel,
	aeroPrototypeSelector: AeroPrototypeSelector
});
//#endregion
//#region src/release-metadata.js
/**
* Vite-injected build stamp.
*
* @type {string}
*/
var buildStamp = "source:64f0cf8fc61596f712571ab59b1f02223c92d317c31c9650d82bc1d07a73df95";
/**
* Vite-injected cache-bust token.
*
* @type {string}
*/
var cacheBust = "0.0.24-64f0cf8fc61596f7";
/**
* Vite-injected package version from package.json.
*
* @type {string}
*/
var packageVersion = "0.0.24";
/**
* Visible app metadata used for cache-bust and raw release proof.
*
* @type {Readonly<{
*   packageName: "@aerobeat/web-assembly",
*   packageVersion: string,
*   displayVersion: string,
*   buildStamp: string,
*   cacheBust: string
* }>}
*/
var appMetadata = Object.freeze({
	packageName: "@aerobeat/web-assembly",
	packageVersion,
	displayVersion: packageVersion,
	buildStamp,
	cacheBust
});
//#endregion
//#region src/iframe-bridge.js
var MAX_BRIDGE_BYTES = 65536;
/** @typedef {{parentWindow:Window,instanceId:string,expectedOrigin:string,onConnect?:()=>void,onCommand:(command:import("@aerobeat/web-contracts").AeroGameCommand)=>void,onError?:(error:unknown)=>void}} IframeBridgeOptions */
/** Strict immediate-parent protocol adapter owned by one connected game. */
function createAeroGameIframeBridge(options) {
	const { parentWindow, instanceId, expectedOrigin, onCommand } = options;
	if (!expectedOrigin || expectedOrigin === "*" || new URL(expectedOrigin).origin !== expectedOrigin) throw new TypeError("Iframe bridge requires one exact parent origin");
	let connected = false;
	let destroyed = false;
	let sequence = 0;
	const seenMessageIds = /* @__PURE__ */ new Set();
	const seenCommandIds = /* @__PURE__ */ new Set();
	const onMessage = (event) => {
		if (destroyed || event.source !== parentWindow || event.origin !== expectedOrigin || !isAeroGameIframeValueWithinLimits(event.data) || !isIframeMessage(event.data) || event.data.instanceId !== instanceId) return;
		const message = event.data;
		if (message.kind === "handshake_request") {
			const firstConnection = !connected;
			connected = true;
			if (firstConnection) {
				seenMessageIds.clear();
				seenCommandIds.clear();
			}
			post("handshake_ack", {
				protocolVersion: 1,
				accepted: true
			}, message.messageId);
			if (firstConnection) try {
				options.onConnect?.();
			} catch (error) {
				report(error);
			}
			return;
		}
		if (!connected) return;
		if (message.kind === "command" && message.payload && "command" in message.payload) {
			const command = message.payload.command;
			if (seenMessageIds.has(message.messageId) || seenCommandIds.has(command.commandId) || seenMessageIds.size >= 256 || seenCommandIds.size >= 256) return;
			seenMessageIds.add(message.messageId);
			seenCommandIds.add(command.commandId);
			try {
				onCommand(command);
			} catch (error) {
				report(error);
			}
		} else if (message.kind === "disconnect") connected = false;
	};
	globalThis.addEventListener("message", onMessage);
	function report(error) {
		try {
			options.onError?.(error);
		} catch {}
	}
	/** @param {string} kind @param {Readonly<Record<string,unknown>>|null} payload @param {string} [messageId] */
	function post(kind, payload, messageId = `child-${++sequence}`) {
		if (destroyed || !isAeroGameIframeValueWithinLimits(payload) || !isSafeIframePayload(payload)) return false;
		const message = Object.freeze({
			schema: "aerobeat/iframe_message",
			version: 1,
			kind,
			messageId,
			instanceId,
			payload
		});
		if (!isIframeMessage(message) || !isAeroGameIframeValueWithinLimits(message)) return false;
		parentWindow.postMessage(message, expectedOrigin);
		return true;
	}
	return Object.freeze({
		getSnapshot() {
			return Object.freeze({
				schema: "aerobeat/iframe_bridge_snapshot",
				version: 1,
				framed: true,
				connected,
				parentOrigin: expectedOrigin
			});
		},
		sendEvent(event) {
			if (!connected || !isGameEvent(event)) return false;
			return post("event", Object.freeze({ event }));
		},
		destroy() {
			if (destroyed) return;
			if (connected) post("disconnect", Object.freeze({ reason: "child_destroyed" }));
			destroyed = true;
			connected = false;
			globalThis.removeEventListener("message", onMessage);
		}
	});
}
/** Descriptor-safe 64 KiB/depth/item/string preflight for either bridge direction. @param {unknown} value */
function isAeroGameIframeValueWithinLimits(value) {
	return withinBridgeLimits(value) && encodedSize(value) <= MAX_BRIDGE_BYTES;
}
/** Descriptor-safe preflight prevents hostile depth/item work before contract validation. @param {unknown} value */
function withinBridgeLimits(value) {
	let items = 0;
	const seen = /* @__PURE__ */ new Set();
	const visit = (entry, depth) => {
		items += 1;
		if (items > 2048 || depth > 12) return false;
		if (entry === null || typeof entry === "boolean") return true;
		if (typeof entry === "string") return entry.length <= 8192;
		if (typeof entry === "number") return Number.isFinite(entry);
		if (!entry || typeof entry !== "object" || seen.has(entry)) return false;
		const prototype = Object.getPrototypeOf(entry);
		if (Array.isArray(entry)) {
			if (prototype !== Array.prototype || entry.length > 256) return false;
			const keys = Reflect.ownKeys(entry);
			const expected = /* @__PURE__ */ new Set(["length", ...Array.from({ length: entry.length }, (_, index) => String(index))]);
			if (keys.length !== expected.size || keys.some((key) => typeof key !== "string" || !expected.has(key))) return false;
			const lengthDescriptor = Object.getOwnPropertyDescriptor(entry, "length");
			if (!lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.value !== entry.length) return false;
			seen.add(entry);
			for (let index = 0; index < entry.length; index += 1) {
				const descriptor = Object.getOwnPropertyDescriptor(entry, String(index));
				if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || !visit(descriptor.value, depth + 1)) {
					seen.delete(entry);
					return false;
				}
			}
			seen.delete(entry);
			return true;
		}
		if (prototype !== Object.prototype) return false;
		const keys = Reflect.ownKeys(entry);
		if (keys.length > 128 || keys.some((key) => typeof key !== "string" || key.length > 256)) return false;
		seen.add(entry);
		for (const key of keys) {
			const descriptor = Object.getOwnPropertyDescriptor(entry, key);
			if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || !visit(descriptor.value, depth + 1)) {
				seen.delete(entry);
				return false;
			}
		}
		seen.delete(entry);
		return true;
	};
	return visit(value, 0);
}
/** @param {unknown} value */
function encodedSize(value) {
	try {
		return new TextEncoder().encode(JSON.stringify(cloneForEncoding(value))).byteLength;
	} catch {
		return Number.POSITIVE_INFINITY;
	}
}
/** The preflight has already rejected accessors/classes/cycles. @param {unknown} value @returns {unknown} */
function cloneForEncoding(value) {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map((entry) => cloneForEncoding(entry));
	const clone = Object.create(null);
	for (const key of Object.keys(value).sort(compareCodePoints$1)) clone[key] = cloneForEncoding(value[key]);
	return clone;
}
/** @param {string} left @param {string} right */
function compareCodePoints$1(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}
//#endregion
//#region src/media-lease-coordinator.js
/** @typedef {{participantId:string,token:symbol}} AeroGameLeaseCallbackContext */
/** @typedef {{instanceId:string,pauseForLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>,activateLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>,releaseLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>}} AeroGameMediaLeaseParticipant */
/** @typedef {{source:AeroGameMediaLeaseParticipant,instanceId:string,pauseForLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>,activateLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>,releaseLease:(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>}} RegisteredParticipant */
/**
* Process-wide policy coordinator. Browser resources remain owned by per-game
* audio/video services; transfer only pauses the previous participant.
*/
var AeroGameMediaLeaseCoordinator = class {
	constructor() {
		/** @type {Map<string,RegisteredParticipant>} */ this.participants = /* @__PURE__ */ new Map();
		/** @type {WeakMap<object,RegisteredParticipant>} */ this.registrations = /* @__PURE__ */ new WeakMap();
		/** @type {RegisteredParticipant|null} */ this.owner = null;
		/** @type {RegisteredParticipant|null} */ this.candidate = null;
		this.generation = 0;
		this.transferring = false;
		/** @type {RegisteredParticipant|null} */ this.callbackParticipant = null;
		/** @type {AeroGameLeaseCallbackContext|null} */ this.callbackContext = null;
		/** @type {WeakSet<RegisteredParticipant>} */ this.releasedDuringTransfer = /* @__PURE__ */ new WeakSet();
		/** @type {WeakSet<RegisteredParticipant>} */ this.activatedParticipants = /* @__PURE__ */ new WeakSet();
		/** @type {Promise<unknown>} */ this.operationQueue = Promise.resolve();
	}
	/** @param {AeroGameMediaLeaseParticipant} participant */
	register(participant) {
		const registered = normalizeParticipant(participant);
		if (this.participants.has(registered.instanceId) || this.registrations.has(participant)) throw new Error(`Lease participant ID is already registered: ${registered.instanceId}`);
		this.participants.set(registered.instanceId, registered);
		this.registrations.set(participant, registered);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			this.unregister(participant).catch(() => {});
		};
	}
	/** @param {AeroGameMediaLeaseParticipant} participant @param {AeroGameLeaseCallbackContext} [callbackContext] */
	async request(participant, callbackContext) {
		this.assertNotReentrant(participant, callbackContext);
		this.requireRegistration(participant);
		return this.enqueue(async () => {
			const registered = this.requireRegistration(participant);
			if (this.owner === registered && !this.transferring) return this.snapshot();
			const token = ++this.generation;
			const previous = this.owner ?? this.candidate;
			let previousPaused = false;
			let activationAttempted = false;
			this.owner = null;
			this.candidate = registered;
			this.transferring = true;
			try {
				if (previous && previous !== registered) {
					await this.invoke(previous, previous.pauseForLease);
					previousPaused = true;
				}
				if (this.participants.get(registered.instanceId) !== registered) {
					const recoverable = previousPaused ? await this.reactivateIfRegistered(previous).catch(() => null) : null;
					this.owner = recoverable;
					this.candidate = null;
					this.transferring = false;
					return this.snapshot();
				}
				activationAttempted = true;
				await this.invoke(registered, registered.activateLease);
				this.activatedParticipants.add(registered);
				if (this.participants.get(registered.instanceId) !== registered) {
					try {
						await this.invoke(registered, registered.releaseLease);
					} catch {} finally {
						this.activatedParticipants.delete(registered);
						this.releasedDuringTransfer.add(registered);
					}
					const recoverable = previousPaused ? await this.reactivateIfRegistered(previous).catch(() => null) : null;
					this.owner = recoverable;
					this.candidate = null;
					this.transferring = false;
					return this.snapshot();
				}
				this.owner = registered;
				this.candidate = null;
				this.transferring = false;
				return this.snapshot();
			} catch (error) {
				if (this.generation === token) {
					if (activationAttempted) try {
						await this.invoke(registered, registered.releaseLease);
					} catch {} finally {
						this.activatedParticipants.delete(registered);
						if (this.participants.get(registered.instanceId) !== registered) this.releasedDuringTransfer.add(registered);
					}
					const recoverable = previousPaused ? await this.reactivateIfRegistered(previous).catch(() => null) : previous && this.participants.get(previous.instanceId) === previous ? previous : null;
					this.candidate = null;
					this.transferring = false;
					this.owner = recoverable;
				}
				throw error;
			}
		});
	}
	/** @param {AeroGameMediaLeaseParticipant} participant @param {AeroGameLeaseCallbackContext} [callbackContext] */
	async release(participant, callbackContext) {
		this.assertNotReentrant(participant, callbackContext);
		return this.enqueue(async () => {
			const registered = this.registrations.get(participant);
			if (!registered || this.owner !== registered && this.candidate !== registered) return this.snapshot();
			const token = ++this.generation;
			const wasOwner = this.owner === registered;
			this.owner = null;
			this.candidate = registered;
			this.transferring = true;
			try {
				await this.invoke(registered, registered.releaseLease);
			} catch (error) {
				if (this.generation === token) {
					this.owner = wasOwner && this.participants.get(registered.instanceId) === registered ? registered : null;
					this.candidate = null;
					this.transferring = false;
				}
				throw error;
			}
			this.activatedParticipants.delete(registered);
			if (this.generation === token) {
				this.candidate = null;
				this.transferring = false;
			}
			return this.snapshot();
		});
	}
	/** @param {AeroGameMediaLeaseParticipant} participant @param {AeroGameLeaseCallbackContext} [callbackContext] */
	async unregister(participant, callbackContext) {
		this.assertNotReentrant(participant, callbackContext);
		const registered = this.registrations.get(participant);
		if (!registered) return this.snapshot();
		this.registrations.delete(participant);
		this.participants.delete(registered.instanceId);
		return this.enqueue(async () => {
			const token = ++this.generation;
			if (this.owner === registered) this.owner = null;
			if (!this.candidate || this.candidate === registered) this.candidate = registered;
			this.transferring = true;
			try {
				if (this.releasedDuringTransfer.has(registered)) this.releasedDuringTransfer.delete(registered);
				else if (this.activatedParticipants.has(registered)) await this.invoke(registered, registered.releaseLease);
			} finally {
				this.activatedParticipants.delete(registered);
				if (this.generation === token) {
					if (this.candidate === registered) this.candidate = null;
					this.transferring = false;
				}
			}
			return this.snapshot();
		});
	}
	snapshot() {
		return Object.freeze({
			schema: "aerobeat/media_lease_snapshot",
			version: 1,
			ownerInstanceId: this.owner?.instanceId ?? null,
			generation: this.generation,
			state: this.transferring ? "transferring" : this.owner ? "owned" : "idle",
			resources: Object.freeze(["camera", "audio"])
		});
	}
	getParticipantCount() {
		return this.participants.size;
	}
	/** @param {AeroGameMediaLeaseParticipant} participant */
	requireRegistration(participant) {
		const registered = this.registrations.get(participant);
		if (!registered || this.participants.get(registered.instanceId) !== registered) throw new Error("Lease participant is not registered");
		return registered;
	}
	/** @param {RegisteredParticipant|null} participant @returns {Promise<RegisteredParticipant|null>} */
	async reactivateIfRegistered(participant) {
		if (!participant || this.participants.get(participant.instanceId) !== participant) return null;
		await this.invoke(participant, participant.activateLease);
		this.activatedParticipants.add(participant);
		return this.participants.get(participant.instanceId) === participant ? participant : null;
	}
	/** @param {AeroGameMediaLeaseParticipant} participant @param {AeroGameLeaseCallbackContext} [callbackContext] */
	assertNotReentrant(_participant, callbackContext) {
		if (callbackContext && this.callbackContext === callbackContext) throw new Error("Lease participant callbacks cannot reenter the coordinator");
	}
	/** @template T @param {()=>Promise<T>} operation @returns {Promise<T>} */
	enqueue(operation) {
		const queued = this.operationQueue.then(operation, operation);
		this.operationQueue = queued.catch(() => {});
		return queued;
	}
	/** @param {RegisteredParticipant} participant @param {(context?:AeroGameLeaseCallbackContext)=>void|Promise<void>} callback */
	async invoke(participant, callback) {
		const context = Object.freeze({
			participantId: participant.instanceId,
			token: Symbol(participant.instanceId)
		});
		this.callbackParticipant = participant;
		this.callbackContext = context;
		try {
			await callback(context);
		} finally {
			if (this.callbackContext === context) {
				this.callbackParticipant = null;
				this.callbackContext = null;
			}
		}
	}
};
/** @param {AeroGameMediaLeaseParticipant} participant @returns {RegisteredParticipant} */
function normalizeParticipant(participant) {
	if (!participant || typeof participant !== "object" || Object.getPrototypeOf(participant) !== Object.prototype) throw new TypeError("Lease participant must be a plain record");
	const instanceId = dataProperty$3(participant, "instanceId");
	if (typeof instanceId !== "string" || instanceId.length === 0 || instanceId.length > 256) throw new TypeError("Lease participant requires a bounded instanceId");
	const pauseForLease = dataProperty$3(participant, "pauseForLease");
	const activateLease = dataProperty$3(participant, "activateLease");
	const releaseLease = dataProperty$3(participant, "releaseLease");
	if (typeof pauseForLease !== "function" || typeof activateLease !== "function" || typeof releaseLease !== "function") throw new TypeError("Lease participant operations must be own enumerable functions");
	return Object.freeze({
		source: participant,
		instanceId,
		pauseForLease,
		activateLease,
		releaseLease
	});
}
/** @param {object} value @param {string} key */
function dataProperty$3(value, key) {
	const descriptor = Object.getOwnPropertyDescriptor(value, key);
	return descriptor && descriptor.enumerable && "value" in descriptor ? descriptor.value : void 0;
}
/** One coordinator for the browser process, not one per component. */
var aeroGameMediaLeaseCoordinator = new AeroGameMediaLeaseCoordinator();
//#endregion
//#region src/production-cv-service.js
/** @typedef {import("@aerobeat/web-contracts/pose-adapter").AeroPoseAdapter} AeroPoseAdapter */
/**
* Narrow live-camera CV service used by the product root. It intentionally has
* no replay, fallback, backend selector, resize, prediction, or worker route.
*
* @param {{poseAdapter:AeroPoseAdapter,submissionCadenceTargetFps?:number,now?:()=>number}} options
*/
function createLockedProductionCvService(options) {
	const adapter = options.poseAdapter;
	const targetFps = options.submissionCadenceTargetFps ?? 15;
	if (!Number.isFinite(targetFps) || targetFps <= 0 || targetFps > 15) throw new TypeError("Production CV cadence must be within the 15fps ceiling");
	const now = options.now ?? (() => performance.now());
	let lifecycleState = "idle";
	let generation = 0;
	let timer = 0;
	let activeSource = null;
	/** @type {Promise<void>|null} */ let loading = null;
	/** @type {Promise<unknown>} */ let adapterQueue = Promise.resolve();
	let latestPoseFrame;
	let latestPoseGeneration = -1;
	/** @type {Promise<unknown>|null} */ let nextFrameOperation = null;
	/** @type {Promise<void>|null} */ let disposeOperation = null;
	let lastError = null;
	let submittedFrameCount = 0;
	let poseFrameCount = 0;
	let droppedFrameCount = 0;
	/** @type {Promise<void>|null} */ let inFlight = null;
	let lastTimestampMs = -1;
	return Object.freeze({
		serviceId: "aero.cv.pose",
		supportedSources: Object.freeze(["live-camera"]),
		get sourceKind() {
			return "live-camera";
		},
		get running() {
			return lifecycleState === "running";
		},
		async start(source) {
			if (lifecycleState === "disposed") throw new Error("Production CV service is disposed");
			const normalized = normalizeSource(source);
			const token = ++generation;
			stopTimer();
			activeSource = null;
			latestPoseFrame = void 0;
			latestPoseGeneration = -1;
			nextFrameOperation = null;
			lifecycleState = "loading";
			lastError = null;
			const operation = enqueueAdapter(() => adapter.load());
			loading = operation;
			try {
				await operation;
			} catch (error) {
				if (token !== generation || lifecycleState === "disposed") return;
				lastError = errorMessage$2(error);
				lifecycleState = "error";
				throw new Error(lastError);
			} finally {
				if (loading === operation) loading = null;
			}
			if (token !== generation || lifecycleState === "disposed") return;
			activeSource = normalized;
			lifecycleState = "running";
			timer = globalThis.setInterval(() => {
				estimate(token);
			}, Math.ceil(1e3 / targetFps));
		},
		async stop() {
			if (disposeOperation) {
				await disposeOperation;
				return;
			}
			if (lifecycleState === "disposed") return;
			++generation;
			stopTimer();
			activeSource = null;
			latestPoseFrame = void 0;
			latestPoseGeneration = -1;
			nextFrameOperation = null;
			lifecycleState = "stopped";
		},
		async dispose() {
			if (disposeOperation) {
				await disposeOperation;
				return;
			}
			if (lifecycleState === "disposed") return;
			++generation;
			stopTimer();
			activeSource = null;
			latestPoseFrame = void 0;
			latestPoseGeneration = -1;
			nextFrameOperation = null;
			lifecycleState = "disposed";
			const operation = (async () => {
				await loading?.catch(() => {});
				await inFlight?.catch(() => {});
				await enqueueAdapter(() => adapter.dispose?.());
			})();
			disposeOperation = operation;
			await operation;
		},
		async nextPoseFrame() {
			if (!activeSource || lifecycleState !== "running") throw new Error("Production CV source is not running");
			if (nextFrameOperation) return nextFrameOperation;
			const token = generation;
			const operation = (async () => {
				if (inFlight) {
					const pending = inFlight;
					await pending;
					if (inFlight === pending) inFlight = null;
				}
				if (token !== generation || lifecycleState !== "running" || !activeSource) throw new Error("Production CV source changed before a fresh frame completed");
				const previousFrameCount = poseFrameCount;
				await estimate(token);
				if (token !== generation || lifecycleState !== "running" || latestPoseGeneration !== token || poseFrameCount === previousFrameCount || !latestPoseFrame) throw new Error(lastError ?? "Production CV did not produce a fresh pose frame");
				return latestPoseFrame;
			})();
			nextFrameOperation = operation;
			try {
				return await operation;
			} finally {
				if (nextFrameOperation === operation) nextFrameOperation = null;
			}
		},
		submitFrame() {
			estimate(generation);
		},
		getLatestPoseFrame() {
			return latestPoseFrame;
		},
		getStatus() {
			const execution = adapter.getExecutionTelemetry?.();
			return Object.freeze({
				serviceId: "aero.cv.pose",
				lifecycleState,
				running: lifecycleState === "running",
				sourceKind: "live-camera",
				sourceId: activeSource?.sourceId ?? "aero.mediapipe.live",
				mirrored: activeSource?.mirrored ?? true,
				selectedVendorId: adapter.vendorId,
				selectedBackendId: "mediapipe",
				requestedBackendId: "mediapipe",
				providerId: execution?.provider ?? "gpu-webgl",
				gameplaySource: "measured",
				resizePath: "none",
				submissionCadenceTargetFps: targetFps,
				submittedFrameCount,
				poseFrameCount,
				droppedFrameCount,
				latestPoseTimestampMs: latestPoseFrame?.timestampMs ?? null,
				error: lastError
			});
		}
	});
	/** @param {number} token */
	async function estimate(token) {
		if (inFlight) {
			droppedFrameCount += 1;
			return;
		}
		const source = activeSource;
		if (token !== generation || lifecycleState !== "running" || !source || !source.isFrameAvailable()) return;
		submittedFrameCount += 1;
		const operation = runEstimate(token, source);
		inFlight = operation;
		try {
			await operation;
		} finally {
			if (inFlight === operation) inFlight = null;
		}
	}
	/** @param {number} token @param {ReturnType<typeof normalizeSource>} source */
	async function runEstimate(token, source) {
		try {
			const rawTimestamp = source.getTimestampMs();
			const timestampMs = Math.max(lastTimestampMs + .001, Number.isFinite(rawTimestamp) ? rawTimestamp : now());
			const frame = await enqueueAdapter(() => adapter.estimateNormalizedPoseFrame(source.frameSource, {
				sourceId: source.sourceId,
				timestampMs,
				mirrored: source.mirrored,
				flipHorizontal: false,
				frameWidth: source.frameWidth(),
				frameHeight: source.frameHeight()
			}));
			if (token !== generation || lifecycleState !== "running") return;
			lastTimestampMs = timestampMs;
			latestPoseFrame = frame;
			latestPoseGeneration = token;
			poseFrameCount += 1;
			lastError = null;
		} catch (error) {
			if (token === generation) {
				latestPoseFrame = void 0;
				latestPoseGeneration = -1;
				lastError = errorMessage$2(error);
				lifecycleState = "error";
				stopTimer();
			}
		}
	}
	/** @template T @param {()=>T|Promise<T>} operation @returns {Promise<T>} */
	function enqueueAdapter(operation) {
		const queued = adapterQueue.then(operation, operation);
		adapterQueue = queued.catch(() => {});
		return queued;
	}
	function stopTimer() {
		if (timer) globalThis.clearInterval(timer);
		timer = 0;
	}
}
/** @param {HTMLVideoElement} video @param {{sourceId?:string,mirrored?:boolean}} surface */
function createLockedVideoFrameSource(video, surface) {
	if (!(video instanceof HTMLVideoElement)) throw new TypeError("Production CV requires an HTMLVideoElement");
	return Object.freeze({
		kind: "live-camera",
		sourceId: typeof surface.sourceId === "string" && surface.sourceId ? surface.sourceId : "aero.mediapipe.live",
		mirrored: surface.mirrored === true,
		frameSource: video,
		getTimestampMs: () => performance.now(),
		isFrameAvailable: () => video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0,
		frameWidth: () => video.videoWidth,
		frameHeight: () => video.videoHeight
	});
}
/** @param {unknown} source */
function normalizeSource(source) {
	if (!source || typeof source !== "object" || Object.getPrototypeOf(source) !== Object.prototype) throw new TypeError("Production CV source must be a plain record");
	for (const key of [
		"sourceId",
		"mirrored",
		"frameSource",
		"getTimestampMs",
		"isFrameAvailable",
		"frameWidth",
		"frameHeight"
	]) {
		const descriptor = Object.getOwnPropertyDescriptor(source, key);
		if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypeError(`Production CV source ${key} is invalid`);
	}
	if (typeof source.sourceId !== "string" || !source.sourceId || source.sourceId.length > 512 || typeof source.mirrored !== "boolean" || !(source.frameSource instanceof HTMLVideoElement) || typeof source.getTimestampMs !== "function" || typeof source.isFrameAvailable !== "function" || typeof source.frameWidth !== "function" || typeof source.frameHeight !== "function") throw new TypeError("Production CV source fields are invalid");
	return source;
}
/** @param {unknown} error */
function errorMessage$2(error) {
	if (!error || typeof error !== "object") return "Production CV failed";
	const descriptor = Object.getOwnPropertyDescriptor(error, "message");
	return descriptor && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value.slice(0, 2048) : "Production CV failed";
}
//#endregion
//#region src/runtime-cadence.js
/**
* @typedef {Object} AeroCadenceScheduler
* @property {(callback: () => void) => number} schedule Schedules a cadence opportunity.
* @property {(handle: number) => void} cancel Cancels a cadence opportunity.
*/
/**
* @typedef {Object} AeroCadenceLoopOptions
* @property {number} targetRateFps Maximum callback rate.
* @property {() => void} callback Work performed at the paced cadence.
* @property {AeroCadenceScheduler | undefined} scheduler Optional deterministic scheduler.
* @property {(() => number) | undefined} now Optional monotonic clock.
*/
/**
* @typedef {Object} AeroCadenceLoopStatus
* @property {number} targetRateFps Configured maximum callback rate.
* @property {number} tickCount Number of callbacks actually performed.
* @property {number | undefined} effectiveRateFps Effective callback rate since the first tick.
* @property {number | undefined} latestTickAgeMs Monotonic age since the latest callback.
*/
/**
* @typedef {Object} AeroCadenceLoop
* @property {() => void} start Starts the independent cadence loop.
* @property {() => void} stop Stops the independent cadence loop.
* @property {() => AeroCadenceLoopStatus} getStatus Reads truthful cadence telemetry.
*/
/**
* Creates an unthrottled display-driven lane. Each scheduler opportunity produces
* exactly one callback and schedules exactly one successor until stopped.
*
* @param {{callback: () => void, scheduler?: AeroCadenceScheduler}} options
* @returns {{start: () => void, stop: () => void, getStatus: () => {active:boolean,tickCount:number}}}
*/
function createAeroDisplayLoop(options) {
	const scheduler = options.scheduler ?? createAnimationFrameScheduler();
	let running = false;
	/** @type {number | undefined} */
	let handle;
	let tickCount = 0;
	return {
		start() {
			if (running) return;
			running = true;
			scheduleNext();
		},
		stop() {
			running = false;
			if (handle !== void 0) {
				scheduler.cancel(handle);
				handle = void 0;
			}
		},
		getStatus() {
			return {
				active: running,
				tickCount
			};
		}
	};
	function scheduleNext() {
		if (!running || handle !== void 0) return;
		handle = scheduler.schedule(() => {
			handle = void 0;
			if (!running) return;
			tickCount += 1;
			options.callback();
			scheduleNext();
		});
	}
}
/**
* @returns {AeroCadenceScheduler}
*/
function createAnimationFrameScheduler() {
	return {
		schedule(callback) {
			if (typeof globalThis.requestAnimationFrame === "function") return globalThis.requestAnimationFrame(callback);
			return globalThis.setTimeout(callback, 16);
		},
		cancel(handle) {
			if (typeof globalThis.cancelAnimationFrame === "function") {
				globalThis.cancelAnimationFrame(handle);
				return;
			}
			globalThis.clearTimeout(handle);
		}
	};
}
//#endregion
//#region ../aerobeat-web-audio/src/audio-source.js
/** @typedef {"url" | "object-url" | "blob" | "array-buffer" | "generated-silence"} AudioSourceKind */
/** @typedef {"SHA-256"} AudioHashAlgorithm */
/**
* @typedef {Object} AudioExpectedHash
* @property {AudioHashAlgorithm} algorithm Hash algorithm.
* @property {string} value Lowercase or uppercase hexadecimal digest.
*/
/**
* @typedef {Object} AudioSourceDescriptorInput
* @property {string} id Stable song/audio source ID.
* @property {AudioSourceKind} kind Encoded-audio storage kind.
* @property {string} label Human-readable source label.
* @property {number | undefined} [durationSeconds] Known source duration, when available.
* @property {string | undefined} [url] Browser-resolvable URL for URL-backed sources.
* @property {Blob | undefined} [blob] Encoded audio blob.
* @property {ArrayBuffer | undefined} [arrayBuffer] Encoded audio bytes.
* @property {string | undefined} [contentType] Declared media type for diagnostics only.
* @property {AudioExpectedHash | undefined} [expectedHash] Optional encoded-byte integrity expectation.
* @property {boolean | undefined} [ownsObjectUrl] Whether the service must revoke an object URL after use.
*/
/**
* Serializable metadata for the loaded audio source. Encoded bytes and Blob
* objects deliberately remain private to the service.
*
* @typedef {Object} AudioSourceDescriptor
* @property {string} id Stable song/audio source ID.
* @property {AudioSourceKind} kind Encoded-audio storage kind.
* @property {string} label Human-readable source label.
* @property {number | undefined} durationSeconds Known or decoded duration.
* @property {string | undefined} url Browser-resolvable URL for URL-backed sources.
* @property {string | undefined} contentType Declared media type for diagnostics only.
* @property {AudioExpectedHash | undefined} expectedHash Optional encoded-byte integrity expectation.
* @property {boolean} ownsObjectUrl Whether the service owns object-URL revocation.
*/
/**
* Validates and normalizes an audio source descriptor without treating a file
* extension (including `.egg`) as a codec contract.
*
* @param {AudioSourceDescriptorInput} input
* @returns {AudioSourceDescriptor}
*/
function createAudioSourceDescriptor(input) {
	const id = requireText(input.id, "Audio source id is required");
	const label = requireText(input.label, "Audio source label is required");
	const durationSeconds = normalizeDuration(input.durationSeconds);
	const kind = input.kind;
	if (!audioSourceKinds.includes(kind)) throw new TypeError(`Unsupported audio source kind: ${String(kind)}`);
	if ((kind === "url" || kind === "object-url") && !input.url?.trim()) throw new TypeError(`${kind} audio sources require a url`);
	if (kind === "blob" && !(input.blob instanceof Blob)) throw new TypeError("Blob audio sources require a Blob");
	if (kind === "array-buffer" && !(input.arrayBuffer instanceof ArrayBuffer)) throw new TypeError("Array-buffer audio sources require an ArrayBuffer");
	if (input.ownsObjectUrl && kind !== "object-url") throw new TypeError("Only object-url sources may transfer URL revocation ownership");
	const expectedHash = normalizeExpectedHash(input.expectedHash);
	return Object.freeze({
		id,
		kind,
		label,
		durationSeconds,
		url: input.url?.trim() || void 0,
		contentType: input.contentType?.trim() || void 0,
		expectedHash,
		ownsObjectUrl: input.ownsObjectUrl === true
	});
}
/** @type {readonly AudioSourceKind[]} */
var audioSourceKinds = Object.freeze([
	"url",
	"object-url",
	"blob",
	"array-buffer",
	"generated-silence"
]);
/**
* @param {AudioExpectedHash | undefined} value
* @returns {AudioExpectedHash | undefined}
*/
function normalizeExpectedHash(value) {
	if (!value) return;
	if (value.algorithm !== "SHA-256") throw new TypeError("Only SHA-256 audio integrity expectations are supported");
	const digest = value.value.trim().toLowerCase();
	if (!/^[0-9a-f]{64}$/u.test(digest)) throw new TypeError("Expected SHA-256 audio hash must be 64 hexadecimal characters");
	return Object.freeze({
		algorithm: value.algorithm,
		value: digest
	});
}
/**
* @param {number | undefined} value
* @returns {number | undefined}
*/
function normalizeDuration(value) {
	if (value === void 0) return;
	if (!Number.isFinite(value) || value < 0) throw new TypeError("Audio source duration must be a non-negative finite number when provided");
	return value;
}
/**
* @param {string} value
* @param {string} errorMessage
* @returns {string}
*/
function requireText(value, errorMessage) {
	const normalized = value.trim();
	if (!normalized) throw new TypeError(errorMessage);
	return normalized;
}
//#endregion
//#region ../aerobeat-web-audio/src/playback-clock.js
/**
* @typedef {Object} PlaybackClockSnapshot
* @property {number} contextTimeSeconds Current audio-context time.
* @property {number} positionSeconds Song playback position.
* @property {number | undefined} durationSeconds Song duration, when known.
* @property {number} progress Normalized progress from 0 to 1 when duration is known, otherwise 0.
* @property {boolean} playing Whether the clock is currently advancing.
*/
/**
* @typedef {Object} PlaybackClock
* @property {(contextTimeSeconds: number) => void} start Starts advancing from the current offset.
* @property {(contextTimeSeconds: number) => void} pause Freezes the clock at the current position.
* @property {() => void} stop Stops and rewinds to zero.
* @property {(positionSeconds: number, contextTimeSeconds: number) => void} seek Sets the current playback position.
* @property {(contextTimeSeconds: number) => PlaybackClockSnapshot} snapshot Reads a clock snapshot.
*/
/**
* @typedef {Object} SongTimeline
* @property {number} bpm Beats per minute.
* @property {number} offsetSeconds Time offset for beat zero.
* @property {number | undefined} durationSeconds Song duration, when known.
* @property {(seconds: number) => number} secondsToBeat Converts timeline seconds to beat position.
* @property {(beat: number) => number} beatToSeconds Converts beat position to timeline seconds.
*/
/**
* Creates a deterministic playback clock.
*
* @param {{ durationSeconds?: number }} [options]
* @returns {PlaybackClock}
*/
function createPlaybackClock(options = {}) {
	const durationSeconds = options.durationSeconds;
	let playing = false;
	let offsetSeconds = 0;
	let startedAtContextTimeSeconds = 0;
	return {
		start(contextTimeSeconds) {
			if (!playing) {
				startedAtContextTimeSeconds = normalizeContextTime(contextTimeSeconds);
				playing = true;
			}
		},
		pause(contextTimeSeconds) {
			offsetSeconds = currentPosition(contextTimeSeconds);
			playing = false;
		},
		stop() {
			offsetSeconds = 0;
			startedAtContextTimeSeconds = 0;
			playing = false;
		},
		seek(positionSeconds, contextTimeSeconds) {
			offsetSeconds = normalizePosition(positionSeconds, durationSeconds);
			startedAtContextTimeSeconds = normalizeContextTime(contextTimeSeconds);
		},
		snapshot(contextTimeSeconds) {
			const safeContextTime = normalizeContextTime(contextTimeSeconds);
			const positionSeconds = normalizePosition(currentPosition(safeContextTime), durationSeconds);
			return Object.freeze({
				contextTimeSeconds: safeContextTime,
				positionSeconds,
				durationSeconds,
				progress: durationSeconds && durationSeconds > 0 ? positionSeconds / durationSeconds : 0,
				playing
			});
		}
	};
	/**
	* @param {number} contextTimeSeconds
	* @returns {number}
	*/
	function currentPosition(contextTimeSeconds) {
		const safeContextTime = normalizeContextTime(contextTimeSeconds);
		return playing ? offsetSeconds + safeContextTime - startedAtContextTimeSeconds : offsetSeconds;
	}
}
/**
* @param {number} positionSeconds
* @param {number | undefined} durationSeconds
* @returns {number}
*/
function normalizePosition(positionSeconds, durationSeconds) {
	if (!Number.isFinite(positionSeconds)) return 0;
	const nonNegativePosition = Math.max(0, positionSeconds);
	return durationSeconds === void 0 ? nonNegativePosition : Math.min(durationSeconds, nonNegativePosition);
}
/**
* @param {number} contextTimeSeconds
* @returns {number}
*/
function normalizeContextTime(contextTimeSeconds) {
	return Number.isFinite(contextTimeSeconds) ? Math.max(0, contextTimeSeconds) : 0;
}
//#endregion
//#region ../aerobeat-web-audio/src/audio-service.js
/** @typedef {import("./audio-source.js").AudioSourceDescriptorInput} AudioSourceDescriptorInput */
/** @typedef {import("./audio-source.js").AudioSourceDescriptor} AudioSourceDescriptor */
/** @typedef {import("./playback-clock.js").PlaybackClockSnapshot} PlaybackClockSnapshot */
/** @typedef {import("./playback-clock.js").PlaybackClock} PlaybackClock */
/** @typedef {"idle" | "unsupported" | "loading" | "ready" | "playing" | "paused" | "stopped" | "error" | "destroyed"} AudioServiceState */
/** @typedef {"unknown" | "allowed" | "blocked" | "unavailable"} AudioAutoplayState */
/** @typedef {"visible" | "hidden"} AudioVisibilityState */
/** @typedef {"active" | "inactive" | "released"} AudioLeaseState */
/** @typedef {"audio_fetch_failed" | "audio_fetch_http_error" | "audio_hash_unavailable" | "audio_hash_mismatch" | "audio_decode_unsupported" | "audio_decode_failed" | "audio_autoplay_blocked" | "audio_context_failed" | "audio_source_missing" | "audio_lease_inactive" | "audio_document_hidden" | "audio_operation_aborted" | "audio_destroyed"} AudioErrorCode */
/**
* @typedef {Object} AudioServiceError
* @property {AudioErrorCode} code Stable machine-readable error code.
* @property {string} message Human-readable diagnostic.
*/
/**
* @typedef {Object} AudioServiceStatus
* @property {AudioServiceState} state Current lifecycle state.
* @property {boolean} supported Whether a Web Audio context is available.
* @property {number} generation Current source/lifecycle generation.
* @property {string | undefined} sourceId Loaded audio source ID.
* @property {number} positionSeconds Current playback position.
* @property {number | undefined} durationSeconds Loaded source duration, when known.
* @property {string} contextState Current browser audio-context state.
* @property {AudioAutoplayState} autoplayState Current autoplay/resume capability truth.
* @property {AudioVisibilityState} visibilityState Current document visibility truth.
* @property {AudioLeaseState} leaseState Current assembly-controlled lease state.
* @property {AudioErrorCode | undefined} errorCode Last stable error code.
* @property {string | undefined} errorMessage Last error diagnostic.
*/
/**
* @typedef {Object} AudioServiceCapabilities
* @property {boolean} webAudio Web Audio context availability.
* @property {boolean} encodedAudioDecode Encoded byte decoding availability.
* @property {boolean} bufferPlayback AudioBufferSource playback availability.
* @property {boolean} urlLoading URL fetch availability.
* @property {boolean} blobLoading Blob loading support.
* @property {boolean} arrayBufferLoading ArrayBuffer loading support.
* @property {boolean} hashVerification SHA-256 verification availability.
* @property {boolean} visibilityLifecycle Visibility pause/resume support.
* @property {boolean} leaseLifecycle Media-lease participation support.
*/
/**
* @typedef {Object} AudioOperationResult
* @property {AudioServiceStatus} status Service status after the operation.
* @property {AudioServiceStatus} previousStatus Service status before the operation.
* @property {boolean} stale Whether a newer generation superseded this operation.
*/
/**
* @typedef {Object} AudioBufferAdapter
* @property {number} duration Decoded duration in seconds.
*/
/**
* @typedef {Object} AudioBufferSourceNodeAdapter
* @property {AudioBufferAdapter | null} buffer Decoded buffer.
* @property {(() => void) | null} onended End callback.
* @property {(destination: unknown) => void} connect Connects to a destination.
* @property {(when?: number, offset?: number) => void} start Starts buffer playback.
* @property {() => void} stop Stops buffer playback.
* @property {() => void} disconnect Disconnects the node.
*/
/**
* Minimal Web Audio context surface used by the service and deterministic tests.
*
* @typedef {Object} AudioContextAdapter
* @property {number} currentTime Audio context time in seconds.
* @property {string} state Browser audio context state.
* @property {unknown} [destination] Audio destination node.
* @property {() => Promise<void>} resume Resumes the audio context.
* @property {() => Promise<void>} suspend Suspends the audio context.
* @property {() => Promise<void>} close Closes the audio context.
* @property {(bytes: ArrayBuffer) => Promise<AudioBufferAdapter>} [decodeAudioData] Decodes encoded audio bytes.
* @property {() => AudioBufferSourceNodeAdapter} [createBufferSource] Creates a one-shot decoded-buffer source.
*/
/**
* @typedef {Object} AudioVisibilityTarget
* @property {boolean} hidden Current hidden state.
* @property {(type: "visibilitychange", listener: () => void) => void} addEventListener Registers a visibility listener.
* @property {(type: "visibilitychange", listener: () => void) => void} removeEventListener Removes a visibility listener.
*/
/**
* @callback AudioFetch
* @param {string} url
* @param {{ signal: AbortSignal, mode: "cors" }} init
* @returns {Promise<Response>}
*/
/**
* @callback AudioHashBytes
* @param {ArrayBuffer} bytes
* @param {"SHA-256"} algorithm
* @returns {Promise<string>}
*/
/**
* @typedef {Object} AudioLoadOptions
* @property {AbortSignal | undefined} [signal] Optional caller cancellation signal.
*/
/**
* @typedef {Object} AeroWebAudioServiceOptions
* @property {AudioContextAdapter | undefined} [audioContext] Injected context; the service does not close externally owned contexts.
* @property {(() => AudioContextAdapter | undefined) | undefined} [audioContextFactory] Optional owned-context factory.
* @property {AudioFetch | null | undefined} [fetch] Injected CORS fetch adapter; null explicitly disables URL loading.
* @property {AudioHashBytes | null | undefined} [hashBytes] Injected SHA-256 adapter; null explicitly disables verification.
* @property {AudioVisibilityTarget | undefined} [visibilityTarget] Injected document visibility target.
* @property {((url: string) => void) | undefined} [revokeObjectURL] Injected object-URL revoker.
* @property {boolean | undefined} [initialLeaseActive] Whether this instance initially owns the media lease.
*/
/**
* @typedef {Object} AeroWebAudioService
* @property {"aero.audio.clock"} serviceId Stable service ID.
* @property {() => AudioServiceStatus} getStatus Reads current lifecycle state.
* @property {() => AudioServiceCapabilities} getCapabilities Reads immutable capability truth.
* @property {() => AudioSourceDescriptor | undefined} getSource Reads loaded source metadata without encoded bytes.
* @property {(source: AudioSourceDescriptorInput, options?: AudioLoadOptions) => Promise<AudioOperationResult>} load Loads and decodes a source.
* @property {() => Promise<AudioOperationResult>} play Starts or resumes playback.
* @property {() => Promise<AudioOperationResult>} pause Pauses playback.
* @property {() => Promise<AudioOperationResult>} stop Stops playback and rewinds to zero.
* @property {(positionSeconds: number) => Promise<AudioOperationResult>} seek Moves playback to a timeline position.
* @property {(hidden: boolean) => Promise<AudioOperationResult>} setDocumentHidden Applies visibility pause/resume policy.
* @property {() => Promise<AudioOperationResult>} activateLease Activates or reacquires this instance's media lease.
* @property {() => Promise<AudioOperationResult>} pauseForLease Pauses while another game instance takes the lease.
* @property {() => Promise<AudioOperationResult>} releaseLease Releases the lease and clears automatic-resume intent.
* @property {() => PlaybackClockSnapshot} getClockSnapshot Reads authoritative clock state.
* @property {() => Promise<AudioOperationResult>} destroy Idempotently tears down owned resources.
*/
/**
* Creates a reconnectable per-game Web Audio service. Destroyed services are
* terminal; reconnecting an `aero-game` creates a fresh service generation.
*
* @param {AeroWebAudioServiceOptions} [options]
* @returns {AeroWebAudioService}
*/
function createAeroWebAudioService(options = {}) {
	const injectedContext = options.audioContext;
	const contextFactory = options.audioContextFactory ?? createBrowserAudioContext;
	const audioContext = injectedContext ?? contextFactory();
	const ownsAudioContext = !injectedContext && Boolean(audioContext);
	const fetchAudio = options.fetch === void 0 ? createBrowserFetch() : options.fetch;
	const hashBytes = options.hashBytes === void 0 ? createBrowserHashBytes() : options.hashBytes;
	const visibilityTarget = options.visibilityTarget ?? createBrowserVisibilityTarget();
	const revokeObjectURL = options.revokeObjectURL ?? createBrowserObjectUrlRevoker();
	/** @type {AudioSourceDescriptor | undefined} */
	let source;
	/** @type {AudioBufferAdapter | undefined} */
	let decodedBuffer;
	/** @type {AudioBufferSourceNodeAdapter | undefined} */
	let playbackNode;
	/** @type {PlaybackClock} */
	let clock = createPlaybackClock();
	/** @type {AudioServiceState} */
	let state = audioContext ? "idle" : "unsupported";
	/** @type {AudioAutoplayState} */
	let autoplayState = audioContext ? "unknown" : "unavailable";
	/** @type {AudioVisibilityState} */
	let visibilityState = visibilityTarget?.hidden ? "hidden" : "visible";
	/** @type {AudioLeaseState} */
	let leaseState = options.initialLeaseActive === false ? "inactive" : "active";
	/** @type {AudioServiceError | undefined} */
	let error = audioContext ? void 0 : createError("audio_context_failed", "Web Audio API unavailable in this browser context");
	let generation = 0;
	let operationId = 0;
	let destroyed = false;
	let resumeAfterVisibility = false;
	let resumeAfterLease = false;
	/** @type {AbortController | undefined} */
	let loadController;
	/** @type {string | undefined} */
	let ownedObjectUrl;
	const visibilityListener = () => {
		setDocumentHidden(Boolean(visibilityTarget?.hidden));
	};
	visibilityTarget?.addEventListener("visibilitychange", visibilityListener);
	const capabilities = Object.freeze({
		webAudio: Boolean(audioContext),
		encodedAudioDecode: Boolean(audioContext?.decodeAudioData),
		bufferPlayback: Boolean(audioContext?.createBufferSource),
		urlLoading: Boolean(fetchAudio),
		blobLoading: typeof Blob !== "undefined",
		arrayBufferLoading: typeof ArrayBuffer !== "undefined",
		hashVerification: Boolean(hashBytes),
		visibilityLifecycle: true,
		leaseLifecycle: true
	});
	return Object.freeze({
		serviceId: "aero.audio.clock",
		getStatus,
		getCapabilities() {
			return capabilities;
		},
		getSource() {
			return source ? cloneSourceDescriptor(source) : void 0;
		},
		load,
		play,
		pause,
		stop,
		seek,
		setDocumentHidden,
		activateLease,
		pauseForLease,
		releaseLease,
		getClockSnapshot() {
			return clock.snapshot(contextTime());
		},
		destroy
	});
	/** @returns {AudioServiceStatus} */
	function getStatus() {
		const snapshot = clock.snapshot(contextTime());
		return Object.freeze({
			state,
			supported: Boolean(audioContext),
			generation,
			sourceId: source?.id,
			positionSeconds: snapshot.positionSeconds,
			durationSeconds: source?.durationSeconds ?? snapshot.durationSeconds,
			contextState: audioContext?.state ?? "unavailable",
			autoplayState,
			visibilityState,
			leaseState,
			errorCode: error?.code,
			errorMessage: error?.message
		});
	}
	/**
	* @param {AudioSourceDescriptorInput} sourceInput
	* @param {AudioLoadOptions} [loadOptions]
	* @returns {Promise<AudioOperationResult>}
	*/
	async function load(sourceInput, loadOptions = {}) {
		const previousStatus = getStatus();
		if (!audioContext || destroyed) {
			setTerminalError(destroyed ? "audio_destroyed" : "audio_context_failed", destroyed ? "Audio service is destroyed" : "Web Audio API unavailable in this browser context");
			return result(previousStatus, false);
		}
		const descriptor = createAudioSourceDescriptor(sourceInput);
		const currentGeneration = ++generation;
		++operationId;
		loadController?.abort();
		const linked = createLinkedAbortController(loadOptions.signal);
		loadController = linked.controller;
		stopPlaybackNode();
		revokeOwnedObjectUrl();
		decodedBuffer = void 0;
		source = descriptor;
		ownedObjectUrl = descriptor.kind === "object-url" && descriptor.ownsObjectUrl ? descriptor.url : void 0;
		clock = createPlaybackClock({ durationSeconds: descriptor.durationSeconds });
		state = "loading";
		error = void 0;
		try {
			if (descriptor.kind === "generated-silence") {
				state = "ready";
				return result(previousStatus, false);
			}
			const bytes = await resolveEncodedBytes(sourceInput, descriptor, linked.controller.signal);
			if (isGenerationStale(currentGeneration)) return result(previousStatus, true);
			throwIfAborted(linked.controller.signal);
			await verifyExpectedHash(bytes, descriptor);
			if (isGenerationStale(currentGeneration)) return result(previousStatus, true);
			throwIfAborted(linked.controller.signal);
			if (!audioContext.decodeAudioData) throw createAudioFailure("audio_decode_unsupported", "This Web Audio context cannot decode encoded audio bytes");
			let nextBuffer;
			try {
				nextBuffer = await audioContext.decodeAudioData(bytes.slice(0));
			} catch (decodeCause) {
				throw createAudioFailure("audio_decode_failed", `Browser audio decode failed; file extensions such as .egg do not guarantee codec support${diagnosticSuffix(decodeCause)}`);
			}
			if (isGenerationStale(currentGeneration)) return result(previousStatus, true);
			throwIfAborted(linked.controller.signal);
			decodedBuffer = nextBuffer;
			source = Object.freeze({
				...descriptor,
				durationSeconds: normalizeDecodedDuration(nextBuffer.duration, descriptor.durationSeconds)
			});
			clock = createPlaybackClock({ durationSeconds: source.durationSeconds });
			state = "ready";
			error = void 0;
			return result(previousStatus, false);
		} catch (cause) {
			if (isGenerationStale(currentGeneration)) return result(previousStatus, true);
			const failure = normalizeFailure(cause, linked.controller.signal.aborted);
			setTerminalError(failure.code, failure.message);
			return result(previousStatus, false);
		} finally {
			linked.cleanup();
			if (loadController === linked.controller) loadController = void 0;
		}
	}
	/** @returns {Promise<AudioOperationResult>} */
	async function play() {
		return playFromIntent(getStatus());
	}
	/**
	* @param {AudioServiceStatus} previousStatus
	* @returns {Promise<AudioOperationResult>}
	*/
	async function playFromIntent(previousStatus) {
		if (!audioContext || destroyed) {
			setTerminalError(destroyed ? "audio_destroyed" : "audio_context_failed", destroyed ? "Audio service is destroyed" : "Web Audio API unavailable in this browser context");
			return result(previousStatus, false);
		}
		if (!source || state === "loading") {
			setTerminalError("audio_source_missing", state === "loading" ? "Audio source is still loading" : "No audio source loaded");
			return result(previousStatus, false);
		}
		if (!hasPlayableSource()) {
			if (state !== "error" || !error) setTerminalError("audio_source_missing", "The audio source has not decoded into a playable buffer");
			return result(previousStatus, false);
		}
		if (leaseState !== "active") {
			setTerminalError("audio_lease_inactive", "This game instance does not own the audio lease");
			return result(previousStatus, false);
		}
		if (visibilityState === "hidden") {
			setTerminalError("audio_document_hidden", "Audio playback is paused while the document is hidden");
			return result(previousStatus, false);
		}
		const currentOperation = ++operationId;
		const currentGeneration = generation;
		try {
			await audioContext.resume();
			if (isStale(currentGeneration, currentOperation)) {
				await suspendAfterStaleResume();
				return result(previousStatus, true);
			}
			if (audioContext.state === "suspended") throw createAudioFailure("audio_autoplay_blocked", "Browser autoplay policy kept the AudioContext suspended");
			autoplayState = "allowed";
			error = void 0;
			let snapshot = clock.snapshot(contextTime());
			if (source.durationSeconds !== void 0 && snapshot.positionSeconds >= source.durationSeconds) {
				clock.seek(0, contextTime());
				snapshot = clock.snapshot(contextTime());
			}
			startPlaybackNode(snapshot.positionSeconds, currentGeneration);
			clock.start(contextTime());
			state = "playing";
			resumeAfterLease = false;
			resumeAfterVisibility = false;
			return result(previousStatus, false);
		} catch (cause) {
			if (isStale(currentGeneration, currentOperation)) return result(previousStatus, true);
			const failure = normalizePlayFailure(cause);
			autoplayState = failure.code === "audio_autoplay_blocked" ? "blocked" : autoplayState;
			clock.pause(contextTime());
			stopPlaybackNode();
			setTerminalError(failure.code, failure.message);
			if (audioContext.state !== "closed" && audioContext.state !== "suspended") try {
				await audioContext.suspend();
			} catch {}
			if (isStale(currentGeneration, currentOperation)) {
				await restoreAfterStaleSuspend();
				return result(previousStatus, true);
			}
			return result(previousStatus, false);
		}
	}
	/** @returns {boolean} */
	function hasPlayableSource() {
		return Boolean(source && (source.kind === "generated-silence" || decodedBuffer));
	}
	/** @returns {Promise<AudioOperationResult>} */
	async function pause() {
		const previousStatus = getStatus();
		await pauseInternal("paused");
		resumeAfterLease = false;
		resumeAfterVisibility = false;
		return result(previousStatus, false);
	}
	/**
	* @param {AudioServiceState} nextState
	* @returns {Promise<void>}
	*/
	async function pauseInternal(nextState) {
		const currentOperation = ++operationId;
		const currentGeneration = generation;
		if (!audioContext || destroyed) return;
		const preserveLoadFailure = state === "error" && !hasPlayableSource();
		clock.pause(contextTime());
		stopPlaybackNode();
		if (!preserveLoadFailure) {
			state = source ? nextState : "idle";
			error = void 0;
		}
		if (audioContext.state !== "closed") try {
			await audioContext.suspend();
		} catch (cause) {
			if (!isStale(currentGeneration, currentOperation)) setTerminalError("audio_context_failed", `AudioContext suspend failed${diagnosticSuffix(cause)}`);
			return;
		}
		if (isStale(currentGeneration, currentOperation)) await restoreAfterStaleSuspend();
	}
	/** @returns {Promise<AudioOperationResult>} */
	async function stop() {
		const previousStatus = getStatus();
		const currentOperation = ++operationId;
		const currentGeneration = generation;
		const preserveLoadFailure = state === "error" && !hasPlayableSource();
		clock.stop();
		stopPlaybackNode();
		if (!preserveLoadFailure) {
			state = source ? "stopped" : audioContext ? "idle" : "unsupported";
			error = void 0;
		}
		resumeAfterLease = false;
		resumeAfterVisibility = false;
		if (audioContext && !destroyed && audioContext.state !== "closed") try {
			await audioContext.suspend();
		} catch (cause) {
			if (!isStale(currentGeneration, currentOperation)) setTerminalError("audio_context_failed", `AudioContext suspend failed${diagnosticSuffix(cause)}`);
			return result(previousStatus, isStale(currentGeneration, currentOperation));
		}
		if (isStale(currentGeneration, currentOperation)) {
			await restoreAfterStaleSuspend();
			return result(previousStatus, true);
		}
		return result(previousStatus, false);
	}
	/**
	* @param {number} positionSeconds
	* @returns {Promise<AudioOperationResult>}
	*/
	async function seek(positionSeconds) {
		const previousStatus = getStatus();
		if (destroyed) {
			setTerminalError("audio_destroyed", "Audio service is destroyed");
			return result(previousStatus, false);
		}
		if (!source || !hasPlayableSource()) {
			if (state !== "error" || !error) setTerminalError("audio_source_missing", source ? "The audio source has not decoded into a seekable buffer" : "No audio source loaded");
			return result(previousStatus, false);
		}
		const wasPlaying = state === "playing";
		const safePosition = normalizePosition(positionSeconds, source?.durationSeconds);
		++operationId;
		stopPlaybackNode();
		clock.seek(safePosition, contextTime());
		if (wasPlaying && audioContext) try {
			startPlaybackNode(safePosition, generation);
			clock.start(contextTime());
			state = "playing";
		} catch (cause) {
			const failure = normalizeFailure(cause, false);
			setTerminalError(failure.code, failure.message);
			return result(previousStatus, false);
		}
		else if (source) state = "paused";
		error = void 0;
		return result(previousStatus, false);
	}
	/**
	* @param {boolean} hidden
	* @returns {Promise<AudioOperationResult>}
	*/
	async function setDocumentHidden(hidden) {
		const previousStatus = getStatus();
		const nextVisibility = hidden ? "hidden" : "visible";
		if (visibilityState === nextVisibility || destroyed) return result(previousStatus, false);
		visibilityState = nextVisibility;
		if (hidden) {
			resumeAfterVisibility = state === "playing";
			await pauseInternal(source ? "paused" : "idle");
			return result(previousStatus, false);
		}
		if (resumeAfterVisibility && leaseState === "active") {
			resumeAfterVisibility = false;
			return playFromIntent(previousStatus);
		}
		return result(previousStatus, false);
	}
	/** @returns {Promise<AudioOperationResult>} */
	async function activateLease() {
		const previousStatus = getStatus();
		if (destroyed) {
			setTerminalError("audio_destroyed", "Audio service is destroyed");
			return result(previousStatus, false);
		}
		leaseState = "active";
		if (resumeAfterLease && visibilityState === "visible") {
			resumeAfterLease = false;
			return playFromIntent(previousStatus);
		}
		error = void 0;
		return result(previousStatus, false);
	}
	/** @returns {Promise<AudioOperationResult>} */
	async function pauseForLease() {
		const previousStatus = getStatus();
		if (destroyed) return result(previousStatus, false);
		resumeAfterLease = state === "playing";
		leaseState = "inactive";
		await pauseInternal(source ? "paused" : "idle");
		return result(previousStatus, false);
	}
	/** @returns {Promise<AudioOperationResult>} */
	async function releaseLease() {
		const previousStatus = getStatus();
		if (destroyed) return result(previousStatus, false);
		leaseState = "released";
		resumeAfterLease = false;
		await pauseInternal(source ? "paused" : "idle");
		return result(previousStatus, false);
	}
	/** @returns {Promise<AudioOperationResult>} */
	async function destroy() {
		const previousStatus = getStatus();
		if (destroyed) return result(previousStatus, false);
		destroyed = true;
		++generation;
		++operationId;
		loadController?.abort();
		loadController = void 0;
		visibilityTarget?.removeEventListener("visibilitychange", visibilityListener);
		stopPlaybackNode();
		revokeOwnedObjectUrl();
		decodedBuffer = void 0;
		source = void 0;
		clock.stop();
		leaseState = "released";
		resumeAfterLease = false;
		resumeAfterVisibility = false;
		state = "destroyed";
		error = void 0;
		if (audioContext && ownsAudioContext && audioContext.state !== "closed") try {
			await audioContext.close();
		} catch (cause) {
			error = createError("audio_context_failed", `Owned AudioContext close failed${diagnosticSuffix(cause)}`);
		}
		return result(previousStatus, false);
	}
	/**
	* @param {AudioSourceDescriptorInput} input
	* @param {AudioSourceDescriptor} descriptor
	* @param {AbortSignal} signal
	* @returns {Promise<ArrayBuffer>}
	*/
	async function resolveEncodedBytes(input, descriptor, signal) {
		if (signal.aborted) throw createAbortFailure();
		if (descriptor.kind === "array-buffer" && input.arrayBuffer) return input.arrayBuffer.slice(0);
		if (descriptor.kind === "blob" && input.blob) return input.blob.arrayBuffer();
		if ((descriptor.kind === "url" || descriptor.kind === "object-url") && descriptor.url) {
			if (!fetchAudio) throw createAudioFailure("audio_fetch_failed", "No browser fetch implementation is available for URL audio");
			let response;
			try {
				response = await fetchAudio(descriptor.url, {
					signal,
					mode: "cors"
				});
			} catch (cause) {
				if (signal.aborted) throw createAbortFailure();
				throw createAudioFailure("audio_fetch_failed", `Audio fetch failed; verify HTTPS and CORS access${diagnosticSuffix(cause)}`);
			}
			if (!response.ok) throw createAudioFailure("audio_fetch_http_error", `Audio fetch failed with HTTP ${response.status}`);
			try {
				return await response.arrayBuffer();
			} catch (cause) {
				throw createAudioFailure("audio_fetch_failed", `Audio response bytes could not be read${diagnosticSuffix(cause)}`);
			}
		}
		throw createAudioFailure("audio_source_missing", "Audio source does not contain encoded bytes");
	}
	/**
	* @param {ArrayBuffer} bytes
	* @param {AudioSourceDescriptor} descriptor
	* @returns {Promise<void>}
	*/
	async function verifyExpectedHash(bytes, descriptor) {
		if (!descriptor.expectedHash) return;
		if (!hashBytes) throw createAudioFailure("audio_hash_unavailable", "SHA-256 verification is unavailable in this browser context");
		let actual;
		try {
			actual = (await hashBytes(bytes, descriptor.expectedHash.algorithm)).toLowerCase();
		} catch (cause) {
			throw createAudioFailure("audio_hash_unavailable", `SHA-256 verification failed in this browser context${diagnosticSuffix(cause)}`);
		}
		if (actual !== descriptor.expectedHash.value) throw createAudioFailure("audio_hash_mismatch", `Audio SHA-256 mismatch: expected ${descriptor.expectedHash.value}, received ${actual}`);
	}
	/**
	* @param {number} offsetSeconds
	* @param {number} nodeGeneration
	*/
	function startPlaybackNode(offsetSeconds, nodeGeneration) {
		stopPlaybackNode();
		if (!decodedBuffer || !audioContext?.createBufferSource) return;
		let node;
		try {
			node = audioContext.createBufferSource();
		} catch (cause) {
			throw createAudioFailure("audio_context_failed", `Audio source node could not be created${diagnosticSuffix(cause)}`);
		}
		playbackNode = node;
		node.buffer = decodedBuffer;
		node.onended = () => {
			if (node !== playbackNode || nodeGeneration !== generation || state !== "playing") return;
			playbackNode = void 0;
			node.onended = null;
			disconnectPlaybackNode(node);
			clock.seek(source?.durationSeconds ?? decodedBuffer?.duration ?? offsetSeconds, contextTime());
			clock.pause(contextTime());
			state = "stopped";
		};
		try {
			if (audioContext.destination !== void 0) node.connect(audioContext.destination);
			node.start(0, offsetSeconds);
		} catch (cause) {
			playbackNode = void 0;
			node.onended = null;
			stopAndDisconnectPlaybackNode(node);
			throw createAudioFailure("audio_context_failed", `Audio source node could not start${diagnosticSuffix(cause)}`);
		}
	}
	function stopPlaybackNode() {
		const node = playbackNode;
		playbackNode = void 0;
		if (!node) return;
		node.onended = null;
		stopAndDisconnectPlaybackNode(node);
	}
	/** @param {AudioBufferSourceNodeAdapter} node */
	function stopAndDisconnectPlaybackNode(node) {
		try {
			node.stop();
		} catch {}
		disconnectPlaybackNode(node);
	}
	/** @param {AudioBufferSourceNodeAdapter} node */
	function disconnectPlaybackNode(node) {
		try {
			node.disconnect();
		} catch {}
	}
	function revokeOwnedObjectUrl() {
		if (ownedObjectUrl && revokeObjectURL) revokeObjectURL(ownedObjectUrl);
		ownedObjectUrl = void 0;
	}
	/**
	* @param {number} currentGeneration
	* @param {number} currentOperation
	* @returns {boolean}
	*/
	function isStale(currentGeneration, currentOperation) {
		return isGenerationStale(currentGeneration) || operationId !== currentOperation;
	}
	/** @param {number} currentGeneration @returns {boolean} */
	function isGenerationStale(currentGeneration) {
		return destroyed || generation !== currentGeneration;
	}
	/** @param {AbortSignal} signal */
	function throwIfAborted(signal) {
		if (signal.aborted) throw createAbortFailure();
	}
	/**
	* A browser resume promise may settle after pause, load, or lease intent has
	* superseded it. Re-suspend only when no newer operation is playing.
	*
	* @returns {Promise<void>}
	*/
	async function suspendAfterStaleResume() {
		if (destroyed || state === "playing" || !audioContext || audioContext.state === "closed" || audioContext.state === "suspended") return;
		try {
			await audioContext.suspend();
		} catch {}
	}
	/**
	* A stale suspend may settle after a newer play intent has already started.
	* Restore the context only while that newer intent remains current.
	*
	* @returns {Promise<void>}
	*/
	async function restoreAfterStaleSuspend() {
		if (destroyed || state !== "playing" || !audioContext || audioContext.state === "closed" || audioContext.state === "running") return;
		const restoreGeneration = generation;
		const restoreOperation = operationId;
		try {
			await audioContext.resume();
		} catch (cause) {
			if (!isStale(restoreGeneration, restoreOperation) && state === "playing") {
				clock.pause(contextTime());
				stopPlaybackNode();
				setTerminalError("audio_context_failed", `AudioContext resume after stale suspend failed${diagnosticSuffix(cause)}`);
			}
		}
	}
	/** @returns {number} */
	function contextTime() {
		return audioContext && Number.isFinite(audioContext.currentTime) ? Math.max(0, audioContext.currentTime) : 0;
	}
	/**
	* @param {AudioServiceStatus} previousStatus
	* @param {boolean} stale
	* @returns {AudioOperationResult}
	*/
	function result(previousStatus, stale) {
		return Object.freeze({
			previousStatus,
			status: getStatus(),
			stale
		});
	}
	/**
	* @param {AudioErrorCode} code
	* @param {string} message
	*/
	function setTerminalError(code, message) {
		error = createError(code, message);
		state = destroyed ? "destroyed" : audioContext ? "error" : "unsupported";
	}
}
/**
* @param {AudioErrorCode} code
* @param {string} message
* @returns {AudioServiceError}
*/
function createError(code, message) {
	return Object.freeze({
		code,
		message
	});
}
/**
* @typedef {Object} AudioFailure
* @property {AudioErrorCode} audioCode
* @property {string} message
*/
/**
* @param {AudioErrorCode} code
* @param {string} message
* @returns {AudioFailure}
*/
function createAudioFailure(code, message) {
	return Object.freeze({
		audioCode: code,
		message
	});
}
/** @returns {AudioFailure} */
function createAbortFailure() {
	return createAudioFailure("audio_operation_aborted", "Audio operation was aborted");
}
/**
* @param {unknown} cause
* @param {boolean} aborted
* @returns {AudioServiceError}
*/
function normalizeFailure(cause, aborted) {
	if (aborted) return createError("audio_operation_aborted", "Audio operation was aborted");
	if (isAudioFailure(cause)) return createError(cause.audioCode, cause.message);
	return createError("audio_context_failed", `Audio operation failed${diagnosticSuffix(cause)}`);
}
/**
* @param {unknown} cause
* @returns {AudioServiceError}
*/
function normalizePlayFailure(cause) {
	if (isAudioFailure(cause)) return createError(cause.audioCode, cause.message);
	return createError("audio_autoplay_blocked", `Browser rejected AudioContext resume/playback${diagnosticSuffix(cause)}`);
}
/**
* @param {unknown} value
* @returns {value is AudioFailure}
*/
function isAudioFailure(value) {
	return typeof value === "object" && value !== null && "audioCode" in value && "message" in value;
}
/**
* @param {unknown} cause
* @returns {string}
*/
function diagnosticSuffix(cause) {
	return cause instanceof Error && cause.message ? `: ${cause.message}` : "";
}
/**
* @param {number} decodedDuration
* @param {number | undefined} fallback
* @returns {number | undefined}
*/
function normalizeDecodedDuration(decodedDuration, fallback) {
	return Number.isFinite(decodedDuration) && decodedDuration >= 0 ? decodedDuration : fallback;
}
/**
* @param {AudioSourceDescriptor} descriptor
* @returns {AudioSourceDescriptor}
*/
function cloneSourceDescriptor(descriptor) {
	return Object.freeze({
		id: descriptor.id,
		kind: descriptor.kind,
		label: descriptor.label,
		durationSeconds: descriptor.durationSeconds,
		url: descriptor.url,
		contentType: descriptor.contentType,
		expectedHash: descriptor.expectedHash ? Object.freeze({ ...descriptor.expectedHash }) : void 0,
		ownsObjectUrl: descriptor.ownsObjectUrl
	});
}
/**
* @param {AbortSignal | undefined} signal
* @returns {{ controller: AbortController, cleanup: () => void }}
*/
function createLinkedAbortController(signal) {
	const controller = new AbortController();
	const abort = () => controller.abort();
	if (signal?.aborted) controller.abort();
	else signal?.addEventListener("abort", abort, { once: true });
	return {
		controller,
		cleanup() {
			signal?.removeEventListener("abort", abort);
		}
	};
}
/** @returns {AudioContextAdapter | undefined} */
function createBrowserAudioContext() {
	const browserGlobal = globalThis;
	const AudioContextConstructor = globalThis.AudioContext ?? browserGlobal.webkitAudioContext;
	if (!AudioContextConstructor) return;
	return new AudioContextConstructor();
}
/** @returns {AudioFetch | undefined} */
function createBrowserFetch() {
	if (typeof globalThis.fetch !== "function") return;
	return (url, init) => globalThis.fetch(url, init);
}
/** @returns {AudioHashBytes | undefined} */
function createBrowserHashBytes() {
	if (!globalThis.crypto?.subtle) return;
	return async (bytes, algorithm) => {
		const digest = await globalThis.crypto.subtle.digest(algorithm, bytes);
		return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
	};
}
/** @returns {AudioVisibilityTarget | undefined} */
function createBrowserVisibilityTarget() {
	return typeof document === "undefined" ? void 0 : document;
}
/** @returns {((url: string) => void) | undefined} */
function createBrowserObjectUrlRevoker() {
	return typeof URL.revokeObjectURL === "function" ? (url) => URL.revokeObjectURL(url) : void 0;
}
//#endregion
//#region ../aerobeat-web-audio/src/index.js
/**
* @typedef {import("./audio-service.js").AudioServiceState} AudioServiceState
* @typedef {import("./audio-service.js").AudioAutoplayState} AudioAutoplayState
* @typedef {import("./audio-service.js").AudioVisibilityState} AudioVisibilityState
* @typedef {import("./audio-service.js").AudioLeaseState} AudioLeaseState
* @typedef {import("./audio-service.js").AudioErrorCode} AudioErrorCode
* @typedef {import("./audio-service.js").AudioServiceError} AudioServiceError
* @typedef {import("./audio-service.js").AudioServiceStatus} AudioServiceStatus
* @typedef {import("./audio-service.js").AudioServiceCapabilities} AudioServiceCapabilities
* @typedef {import("./audio-service.js").AudioOperationResult} AudioOperationResult
* @typedef {import("./audio-service.js").AudioBufferAdapter} AudioBufferAdapter
* @typedef {import("./audio-service.js").AudioBufferSourceNodeAdapter} AudioBufferSourceNodeAdapter
* @typedef {import("./audio-service.js").AudioContextAdapter} AudioContextAdapter
* @typedef {import("./audio-service.js").AudioVisibilityTarget} AudioVisibilityTarget
* @typedef {import("./audio-service.js").AudioFetch} AudioFetch
* @typedef {import("./audio-service.js").AudioHashBytes} AudioHashBytes
* @typedef {import("./audio-service.js").AudioLoadOptions} AudioLoadOptions
* @typedef {import("./audio-service.js").AeroWebAudioServiceOptions} AeroWebAudioServiceOptions
* @typedef {import("./audio-service.js").AeroWebAudioService} AeroWebAudioService
* @typedef {import("./audio-source.js").AudioSourceKind} AudioSourceKind
* @typedef {import("./audio-source.js").AudioHashAlgorithm} AudioHashAlgorithm
* @typedef {import("./audio-source.js").AudioExpectedHash} AudioExpectedHash
* @typedef {import("./audio-source.js").AudioSourceDescriptorInput} AudioSourceDescriptorInput
* @typedef {import("./audio-source.js").AudioSourceDescriptor} AudioSourceDescriptor
* @typedef {import("./playback-clock.js").PlaybackClockSnapshot} PlaybackClockSnapshot
* @typedef {import("./playback-clock.js").PlaybackClock} PlaybackClock
* @typedef {import("./playback-clock.js").SongTimeline} SongTimeline
*/
//#endregion
//#region ../aerobeat-web-content/src/runtime-data.js
/**
* Return whether a value is a plain enumerable data record.
*
* @param {unknown} value
* @returns {value is Record<string, unknown>}
*/
function isPlainDataRecord(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return false;
	return Reflect.ownKeys(value).every((key) => {
		if (typeof key !== "string") return false;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		return descriptor !== void 0 && descriptor.enumerable && "value" in descriptor;
	});
}
/**
* Read one already-narrowed plain-data field without invoking user code.
*
* @param {Record<string, unknown>} record
* @param {string} key
* @returns {unknown}
*/
function dataProperty$2(record, key) {
	const descriptor = Object.getOwnPropertyDescriptor(record, key);
	return descriptor && descriptor.enumerable && "value" in descriptor ? descriptor.value : void 0;
}
/** @param {unknown} value @param {readonly string[]} keys @returns {value is Record<string, unknown>} */
function hasExactDataKeys$1(value, keys) {
	if (!isPlainDataRecord(value)) return false;
	const actual = Reflect.ownKeys(value);
	return actual.length === keys.length && actual.every((key) => typeof key === "string" && keys.includes(key));
}
/** Locale-independent Unicode code-point ordering for durable identities. @param {string} left @param {string} right */
function compareCodePoints(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}
/** Read an own data-only diagnostic string without invoking accessors. @param {unknown} value @param {string} key */
function diagnosticString(value, key) {
	if (value === null || typeof value !== "object" && typeof value !== "function") return null;
	const descriptor = Object.getOwnPropertyDescriptor(value, key);
	return descriptor && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value : null;
}
/**
* Narrow untrusted package data into deeply frozen JSON-like data without executing
* accessors or retaining browser/provider objects.
*
* @param {unknown} value
* @param {{maximumDepth?: number, maximumItems?: number, maximumStringLength?: number}} [limits]
* @returns {unknown}
*/
function cloneFrozenData(value, limits = {}) {
	const maximumDepth = limits.maximumDepth ?? 48;
	const maximumItems = limits.maximumItems ?? 1e5;
	const maximumStringLength = limits.maximumStringLength ?? 1e6;
	const seen = /* @__PURE__ */ new Set();
	let items = 0;
	return visit(value, 0);
	/** @param {unknown} current @param {number} depth @returns {unknown} */
	function visit(current, depth) {
		items += 1;
		if (items > maximumItems) throw dataError("data_too_large", "Content data exceeds the item limit");
		if (depth > maximumDepth) throw dataError("data_too_deep", "Content data exceeds the nesting limit");
		if (current === null || typeof current === "boolean") return current;
		if (typeof current === "string") {
			if (current.length > maximumStringLength) throw dataError("string_too_large", "Content string exceeds the length limit");
			return current;
		}
		if (typeof current === "number") {
			if (!Number.isFinite(current)) throw dataError("number_invalid", "Content numbers must be finite");
			return Object.is(current, -0) ? 0 : current;
		}
		if (typeof current !== "object") throw dataError("data_type_invalid", "Content data must be JSON-like");
		if (seen.has(current)) throw dataError("data_cycle", "Content data must not contain cycles");
		seen.add(current);
		try {
			if (Array.isArray(current)) return Object.freeze(current.map((entry) => visit(entry, depth + 1)));
			if (!isPlainDataRecord(current)) throw dataError("data_record_invalid", "Content records must be plain enumerable data");
			const result = Object.create(null);
			for (const key of Reflect.ownKeys(current)) {
				if (typeof key !== "string") throw dataError("data_key_invalid", "Content keys must be strings");
				const descriptor = Object.getOwnPropertyDescriptor(current, key);
				if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw dataError("data_descriptor_invalid", "Content accessors and hidden fields are not allowed");
				result[key] = visit(descriptor.value, depth + 1);
			}
			return Object.freeze(result);
		} finally {
			seen.delete(current);
		}
	}
}
/** @param {unknown} value @returns {string} */
function canonicalJson$1(value) {
	return JSON.stringify(sortValue(value));
}
/** @param {unknown} value @returns {unknown} */
function sortValue(value) {
	if (Array.isArray(value)) return value.map(sortValue);
	if (isPlainDataRecord(value)) {
		const result = Object.create(null);
		for (const key of Object.keys(value).sort()) result[key] = sortValue(value[key]);
		return result;
	}
	return value;
}
/** @param {Uint8Array | string} value @returns {Promise<string>} */
async function sha256Hex$1(value) {
	const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
	const cryptoObject = globalThis.crypto;
	if (!cryptoObject?.subtle) throw dataError("hash_unavailable", "SHA-256 is unavailable in this environment");
	const digest = await cryptoObject.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
/** @param {unknown} value @returns {value is Uint8Array} */
function isByteArray(value) {
	return value instanceof Uint8Array;
}
/** @param {string} code @param {string} message @returns {Error & {code: string}} */
function dataError(code, message) {
	const error = new Error(message);
	error.name = "AeroContentRuntimeError";
	error.code = code;
	return error;
}
//#endregion
//#region ../aerobeat-web-content/src/assets.js
/** @typedef {Readonly<{path: string, kind: "audio" | "background" | "chart" | "other", hash: string, critical: boolean, url: string | null, readable: boolean, status: "ready" | "fallback", errorCode: string | null}>} PublicAssetSnapshot */
/** @typedef {{path: string, kind: "audio" | "background" | "chart" | "other", hash: string, critical: boolean, url: string | null, bytes: Uint8Array | null, readable: boolean, status: "ready" | "fallback", errorCode: string | null}} LoadedAsset */
var audioExtensions = /* @__PURE__ */ new Set([
	"egg",
	"ogg",
	"mp3",
	"wav",
	"m4a",
	"aac",
	"flac",
	"webm"
]);
var imageExtensions = /* @__PURE__ */ new Set([
	"png",
	"jpg",
	"jpeg",
	"webp",
	"gif",
	"avif"
]);
var videoExtensions = /* @__PURE__ */ new Set([
	"mp4",
	"webm",
	"mov",
	"m4v"
]);
var maximumMetadataBytes$1 = 16777216;
var maximumAssets$1 = 2048;
var maximumAssetBytes$1 = 134217728;
var maximumTotalAssetBytes$1 = 536870912;
var defaultTimeoutMs = 15e3;
/**
* Parse deterministic AEROPKG1 bytes and validate every embedded asset.
*
* @param {Uint8Array} bytes
*/
async function parseAeroPackage(bytes) {
	if (!isByteArray(bytes) || bytes.byteLength < 12 || bytes.byteLength > 553648140) throw dataError("aeropkg_invalid", "AEROPKG1 bytes are invalid");
	const magic = "AEROPKG1";
	for (let index = 0; index < 8; index += 1) if (bytes[index] !== magic.charCodeAt(index)) throw dataError("aeropkg_magic_invalid", "AEROPKG1 magic is invalid");
	const metadataLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true);
	if (metadataLength <= 0 || metadataLength > maximumMetadataBytes$1 || 12 + metadataLength > bytes.byteLength) throw dataError("aeropkg_metadata_invalid", "AEROPKG1 metadata length is invalid");
	let metadataValue;
	try {
		metadataValue = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(12, 12 + metadataLength)));
	} catch {
		throw dataError("aeropkg_metadata_invalid", "AEROPKG1 metadata is not valid UTF-8 JSON");
	}
	const metadata = requireRecord$2(cloneFrozenData(metadataValue), "aeropkg_metadata_invalid");
	if (!hasExactDataKeys$1(metadata, [
		"schema",
		"version",
		"packageHash",
		"package",
		"assets"
	]) || metadata.schema !== "aerobeat/authored_package_export" || metadata.version !== 1) throw dataError("aeropkg_schema_invalid", "AEROPKG1 metadata schema is unsupported");
	const packageHash = requireHash(metadata.packageHash, "aeropkg_package_hash_invalid");
	const table = requireArray$1(metadata.assets, "aeropkg_assets_invalid");
	if (table.length > maximumAssets$1) throw dataError("aeropkg_assets_invalid", "AEROPKG1 contains too many assets");
	const payloadStart = 12 + metadataLength;
	const seen = /* @__PURE__ */ new Set();
	let expectedOffset = 0;
	/** @type {{path: string, kind: "audio" | "background" | "chart" | "other", hash: string, critical: boolean, url: null, bytes: Uint8Array}[]} */
	const assets = [];
	for (const rawEntry of table) {
		const entry = requireRecord$2(rawEntry, "aeropkg_asset_invalid");
		if (!hasExactDataKeys$1(entry, [
			"path",
			"offset",
			"byteLength",
			"sha256"
		])) throw dataError("aeropkg_asset_invalid", "AEROPKG1 asset table entries must be exact records");
		const path = normalizeAssetPath(entry.path);
		if (entry.path !== path || path !== path.toLowerCase()) throw dataError("aeropkg_asset_path_noncanonical", "AEROPKG1 asset paths must already be normalized lowercase paths");
		if (seen.has(path.toLowerCase())) throw dataError("asset_duplicate", "Asset paths must be case-insensitively unique");
		seen.add(path.toLowerCase());
		if (!Number.isSafeInteger(entry.offset) || !Number.isSafeInteger(entry.byteLength) || Number(entry.offset) !== expectedOffset || Number(entry.byteLength) < 0 || Number(entry.byteLength) > maximumAssetBytes$1) throw dataError("aeropkg_asset_range_invalid", "AEROPKG1 asset ranges must be contiguous and bounded");
		const start = safeAdd(payloadStart, Number(entry.offset));
		const end = safeAdd(start, Number(entry.byteLength));
		if (end > bytes.byteLength) throw dataError("aeropkg_asset_range_invalid", "AEROPKG1 asset range exceeds payload");
		const hash = requireBareHash(entry.sha256, "asset_hash_invalid");
		const assetBytes = bytes.slice(start, end);
		if (await sha256Hex$1(assetBytes) !== hash) throw dataError("asset_hash_mismatch", `Asset ${path} failed SHA-256 verification`);
		const kind = inferKind(path);
		assets.push({
			path,
			kind,
			hash,
			critical: kind === "audio" || kind === "chart",
			url: null,
			bytes: assetBytes
		});
		expectedOffset = safeAdd(expectedOffset, Number(entry.byteLength));
		if (expectedOffset > maximumTotalAssetBytes$1) throw dataError("aeropkg_asset_range_invalid", "AEROPKG1 assets exceed the total byte limit");
	}
	if (payloadStart + expectedOffset !== bytes.byteLength) throw dataError("aeropkg_trailing_bytes", "AEROPKG1 contains unclaimed trailing bytes");
	return Object.freeze({
		package: metadata.package,
		packageHash,
		assets: Object.freeze(assets)
	});
}
/**
* Load and verify explicit package asset descriptors.
*
* @param {unknown} value
* @param {{fetch?: typeof globalThis.fetch, baseUrl?: string, signal?: AbortSignal, timeoutMs?: number, maximumAssetBytes?: number}} [options]
*/
async function loadPackageAssets(value, options = {}) {
	const input = value === void 0 ? [] : requireArray$1(value, "assets_invalid");
	if (input.length > maximumAssets$1) throw dataError("assets_invalid", "Package contains too many assets");
	const configuredMaximum = normalizePositiveLimit(options.maximumAssetBytes, maximumAssetBytes$1, "asset_limit_invalid");
	const seen = /* @__PURE__ */ new Set();
	let totalBytes = 0;
	/** @type {LoadedAsset[]} */
	const loaded = [];
	for (const rawEntry of input) {
		const entry = requireRecord$2(rawEntry, "asset_invalid");
		if (Reflect.ownKeys(entry).some((key) => typeof key !== "string" || ![
			"path",
			"kind",
			"hash",
			"url",
			"bytes",
			"critical"
		].includes(key))) throw dataError("asset_invalid", "Asset descriptors contain unsupported fields");
		const path = normalizeAssetPath(entry.path);
		if (seen.has(path.toLowerCase())) throw dataError("asset_duplicate", "Asset paths must be case-insensitively unique");
		seen.add(path.toLowerCase());
		const kind = normalizeKind(entry.kind, path);
		const critical = kind === "audio" || kind === "chart" || entry.critical === true;
		const hash = normalizeHash(entry.hash);
		if (critical && !hash) throw dataError("asset_hash_missing", `Critical asset ${path} has no declared SHA-256`);
		const url = normalizeAssetUrl(entry.url, options.baseUrl);
		let bytes = normalizeBytes(entry.bytes);
		let readable = bytes !== null;
		let status = "ready";
		let errorCode = null;
		try {
			if (!bytes && url) bytes = await fetchBytes(url, options.fetch, options.signal, options.timeoutMs, configuredMaximum);
			if (!bytes) throw dataError("asset_unavailable", `Asset ${path} has no readable source`);
			if (bytes.byteLength > configuredMaximum) throw dataError("asset_too_large", `Asset ${path} exceeds the byte limit`);
			totalBytes = safeAdd(totalBytes, bytes.byteLength);
			if (totalBytes > maximumTotalAssetBytes$1) throw dataError("assets_too_large", "Package assets exceed the total byte limit");
			readable = true;
			if (hash && await sha256Hex$1(bytes) !== hash) throw dataError("asset_hash_mismatch", `Asset ${path} failed SHA-256 verification`);
		} catch (cause) {
			const code = errorCodeFor(cause);
			if (critical) throw cause;
			bytes = null;
			readable = false;
			status = "fallback";
			errorCode = code;
		}
		loaded.push({
			path,
			kind,
			hash,
			critical,
			url,
			bytes,
			readable,
			status,
			errorCode
		});
	}
	if (!loaded.some((entry) => entry.kind === "audio" && entry.status === "ready")) throw dataError("audio_missing", "Playable content requires one verified audio asset");
	return loaded;
}
/** @param {readonly LoadedAsset[]} assets @returns {readonly PublicAssetSnapshot[]} */
function publicAssetSnapshots(assets) {
	return Object.freeze(assets.map((asset) => Object.freeze({
		path: asset.path,
		kind: asset.kind,
		hash: asset.hash,
		critical: asset.critical,
		url: asset.url,
		readable: asset.readable,
		status: asset.status,
		errorCode: asset.errorCode
	})));
}
/** @param {unknown} value @returns {string} */
function normalizeAssetPath(value) {
	if (typeof value !== "string" || value.length === 0 || value.length > 1024 || /[\u0000-\u001f\u007f]/u.test(value)) throw dataError("asset_path_invalid", "Asset path is invalid");
	const normalized = value.replaceAll("\\", "/").normalize("NFC").replace(/^\.\//u, "");
	if (normalized.startsWith("/") || /^[a-zA-Z]:/u.test(normalized) || normalized.split("/").some((part) => part === "" || part === "." || part === "..")) throw dataError("asset_path_invalid", "Asset path must be relative and normalized");
	return normalized;
}
/** @param {string} path @returns {"audio" | "background" | "chart" | "other"} */
function inferKind(path) {
	const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
	if (audioExtensions.has(extension)) return "audio";
	if (imageExtensions.has(extension) || videoExtensions.has(extension)) return "background";
	if (extension === "json" || extension === "yaml" || extension === "yml") return "chart";
	return "other";
}
/** @param {unknown} value @param {string} path */
function normalizeKind(value, path) {
	if (value === void 0 || value === null || value === "") return inferKind(path);
	if (value === "audio" || value === "background" || value === "chart" || value === "other") return value;
	throw dataError("asset_kind_invalid", "Asset kind is invalid");
}
/** @param {unknown} value @returns {string} */
function normalizeHash(value) {
	if (value === void 0 || value === null || value === "") return "";
	if (typeof value === "string") return value.startsWith("sha256:") ? requireHash(value, "asset_hash_invalid").slice(7) : requireBareHash(value, "asset_hash_invalid");
	if (hasExactDataKeys$1(value, [
		"schema",
		"version",
		"algorithm",
		"value"
	]) && value.schema === "aerobeat/content_hash" && value.version === 1 && value.algorithm === "sha256" && typeof value.value === "string") return requireBareHash(value.value, "asset_hash_invalid");
	throw dataError("asset_hash_invalid", "Asset SHA-256 declaration is invalid");
}
/** @param {unknown} value @returns {Uint8Array | null} */
function normalizeBytes(value) {
	if (value === void 0 || value === null) return null;
	if (value instanceof Uint8Array) return Uint8Array.from(value);
	if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
	throw dataError("asset_bytes_invalid", "Asset bytes must be Uint8Array or ArrayBuffer");
}
/** @param {unknown} value @param {string | undefined} baseUrl @returns {string | null} */
function normalizeAssetUrl(value, baseUrl) {
	if (value === void 0 || value === null || value === "") return null;
	if (typeof value !== "string") throw dataError("asset_url_invalid", "Asset URL must be a string");
	let parsed;
	try {
		parsed = new URL(value, baseUrl);
	} catch {
		throw dataError("asset_url_invalid", "Asset URL is invalid");
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "blob:" && !(parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost"))) throw dataError("asset_url_insecure", "External assets require HTTPS or localhost HTTP");
	return parsed.href;
}
/** @param {string} url @param {typeof globalThis.fetch | undefined} injected @param {AbortSignal | undefined} signal @param {number | undefined} timeoutMs @param {number} maximumBytes */
async function fetchBytes(url, injected, signal, timeoutMs, maximumBytes) {
	const fetchFunction = injected ?? globalThis.fetch;
	if (!fetchFunction) throw dataError("fetch_unavailable", "Fetch is unavailable");
	const timeout = normalizePositiveLimit(timeoutMs, defaultTimeoutMs, "timeout_invalid");
	const controller = new AbortController();
	const abort = () => controller.abort(signal?.reason);
	signal?.addEventListener("abort", abort, { once: true });
	let timeoutId;
	try {
		const request = Promise.resolve().then(() => fetchFunction(url, {
			mode: "cors",
			credentials: "omit",
			redirect: "follow",
			signal: controller.signal
		}));
		const timeoutFailure = new Promise((_, reject) => {
			timeoutId = setTimeout(() => {
				controller.abort();
				reject(dataError("fetch_timeout", "External asset request timed out"));
			}, timeout);
		});
		const response = await Promise.race([raceAbort$1(request, controller.signal), timeoutFailure]);
		if (!response.ok) throw dataError("asset_http_failed", `External asset returned HTTP ${response.status}`);
		if (response.url) normalizeAssetUrl(response.url, void 0);
		const declared = response.headers?.get?.("content-length");
		if (declared !== null && declared !== void 0 && declared !== "") {
			if (!/^(0|[1-9][0-9]*)$/u.test(declared)) throw dataError("asset_length_invalid", "External asset Content-Length is invalid");
			const parsed = Number(declared);
			if (!Number.isSafeInteger(parsed) || parsed > maximumBytes) throw dataError("asset_too_large", "External asset exceeds the byte limit");
		}
		const bytes = new Uint8Array(await raceAbort$1(response.arrayBuffer(), controller.signal));
		if (bytes.byteLength > maximumBytes) throw dataError("asset_too_large", "External asset exceeds the byte limit");
		return bytes;
	} catch (cause) {
		if (signal?.aborted) throw dataError("operation_aborted", "Content load was cancelled");
		if (cause && typeof cause === "object" && "code" in cause) throw cause;
		throw dataError("cors_unreadable", diagnosticString(cause, "message") ?? "External asset could not be read through CORS");
	} finally {
		clearTimeout(timeoutId);
		signal?.removeEventListener("abort", abort);
	}
}
/** @param {Promise<unknown>} promise @param {AbortSignal} signal */
async function raceAbort$1(promise, signal) {
	if (signal.aborted) throw dataError("operation_aborted", "Content load was cancelled");
	return new Promise((resolve, reject) => {
		const aborted = () => {
			cleanup();
			reject(dataError("operation_aborted", "Content load was cancelled"));
		};
		const cleanup = () => signal.removeEventListener("abort", aborted);
		signal.addEventListener("abort", aborted, { once: true });
		promise.then((value) => {
			cleanup();
			resolve(value);
		}, (cause) => {
			cleanup();
			reject(cause);
		});
	});
}
/** @param {unknown} value @param {number} fallback @param {string} code */
function normalizePositiveLimit(value, fallback, code) {
	if (value === void 0) return fallback;
	if (!Number.isSafeInteger(value) || Number(value) <= 0) throw dataError(code, "Runtime limit must be a positive safe integer");
	return Number(value);
}
/** @param {number} left @param {number} right */
function safeAdd(left, right) {
	const result = left + right;
	if (!Number.isSafeInteger(result)) throw dataError("aeropkg_asset_range_invalid", "Asset byte range overflowed");
	return result;
}
/** @param {unknown} value @param {string} code */
function requireRecord$2(value, code) {
	if (!isPlainDataRecord(value)) throw dataError(code, "Expected a plain asset record");
	return value;
}
/** @param {unknown} value @param {string} code */
function requireArray$1(value, code) {
	if (!Array.isArray(value)) throw dataError(code, "Expected an asset array");
	return value;
}
/** @param {unknown} value @param {string} code */
function requireHash(value, code) {
	if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) throw dataError(code, "Expected a lowercase prefixed SHA-256");
	return value;
}
/** @param {unknown} value @param {string} code */
function requireBareHash(value, code) {
	if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw dataError(code, "Expected a lowercase SHA-256");
	return value;
}
/** @param {unknown} cause */
function errorCodeFor(cause) {
	return diagnosticString(cause, "code") ?? "asset_failed";
}
//#endregion
//#region ../aerobeat-web-content/src/package-content.js
/** @typedef {Readonly<Record<string, unknown>>} DataRecord */
/** @typedef {Readonly<{variantId: string, chartId: string, mode: "flow" | "boxing", rulesetId: string, recipeId: string | null, modifierIds: readonly string[], ranked: boolean, mapHash: Readonly<Record<string, unknown>>, scoreIdentityHash: Readonly<Record<string, unknown>>, provenance: Readonly<Record<string, unknown>>, chart: DataRecord}>} RuntimeVariant */
/**
* Narrow and verify one canonical package and return its immutable variant catalog.
*
* @param {unknown} packageValue
* @param {{declaredPackageHash?: string | Readonly<Record<string, unknown>> | null, supportedRulesetIds?: readonly string[], supportedRecipeIds?: readonly string[]}} [options]
*/
async function validateRuntimePackage(packageValue, options = {}) {
	const packageRecord = cloneFrozenData(packageValue);
	requireString(packageRecord.schemaId, "package_schema_invalid");
	if (packageRecord.schemaId !== "aerobeat.song-package.v1" || packageRecord.schemaVersion !== 1) throw dataError("package_schema_invalid", "Song package schema/version is unsupported");
	const packageId = requireString(packageRecord.packageId, "package_identity_invalid");
	const songId = requireString(packageRecord.songId, "package_identity_invalid");
	const song = requireRecord$1(packageRecord.song, "song_invalid");
	if (song.songId !== songId) throw dataError("song_identity_mismatch", "Package and song identities do not match");
	validateSource(packageRecord.source);
	const converterProfile = await validatePackageConverterProfile(packageRecord);
	const bpm = readBpm(song);
	const charts = requireArray(packageRecord.charts, "charts_invalid");
	if (charts.length !== 5) throw dataError("chart_count_invalid", "Package must contain Flow plus exactly four Boxing prototype charts");
	const chartIds = /* @__PURE__ */ new Set();
	/** @type {RuntimeVariant[]} */
	const variants = [];
	const matrix = /* @__PURE__ */ new Set();
	let flowCount = 0;
	for (let index = 0; index < charts.length; index += 1) {
		const chart = requireRecord$1(charts[index], "chart_invalid");
		const chartId = requireString(chart.chartId, "chart_identity_invalid");
		if (chartIds.has(chartId)) throw dataError("chart_identity_duplicate", "Chart IDs must be unique");
		chartIds.add(chartId);
		const beats = requireArray(chart.beats, "chart_beats_invalid");
		validateEvents(beats, chart.mode === "boxing");
		let rulesetId = "flow_grid_v1";
		let recipeId = null;
		/** @type {string[]} */
		let modifierIds = [];
		let declaredChartHash = "";
		if (chart.mode === "flow") {
			flowCount += 1;
			declaredChartHash = await sha256Hex$1(canonicalJson$1(chart));
		} else if (chart.mode === "boxing") {
			const prototype = requireRecord$1(chart.prototype, "prototype_invalid");
			await validateChartConverterProfile(prototype, converterProfile);
			if (prototype.contractId !== "aerobeat.boxing.prototype.v1") throw dataError("prototype_contract_invalid", "Boxing prototype contract is unsupported");
			requireString(prototype.recipeVersion, "recipe_version_invalid");
			requireString(prototype.rulesetVersion, "ruleset_version_invalid");
			requireHashString(prototype.recipeHash, "recipe_hash_invalid");
			requireHashString(prototype.rulesetHash, "ruleset_hash_invalid");
			rulesetId = requireString(prototype.rulesetId, "ruleset_invalid");
			recipeId = requireString(prototype.recipeId, "recipe_invalid");
			if (!rulesetIds.includes(rulesetId) || rulesetId === "flow_grid_v1") throw dataError("ruleset_invalid", "Boxing ruleset is unsupported");
			if (!conversionRecipeIds.includes(recipeId)) throw dataError("recipe_invalid", "Conversion recipe is unsupported");
			if (options.supportedRulesetIds && !options.supportedRulesetIds.includes(rulesetId)) throw dataError("ruleset_unavailable", `Ruleset ${rulesetId} is unavailable`);
			if (options.supportedRecipeIds && !options.supportedRecipeIds.includes(recipeId)) throw dataError("recipe_unavailable", `Recipe ${recipeId} is unavailable`);
			modifierIds = normalizeModifiers$1(prototype.modifiers);
			validateEventModifierIdentity(beats, modifierIds);
			const sourceHash = requireHashString(prototype.sourceHash, "source_hash_invalid");
			declaredChartHash = requireHashString(prototype.contentHash, "chart_hash_invalid").slice(7);
			if (await sha256Hex$1(canonicalJson$1(chartHashProjection(beats, recipeId, rulesetId, `sha256:${sourceHash.slice(7)}`, converterProfile))) !== declaredChartHash) throw dataError("chart_hash_mismatch", `Chart ${chartId} failed content-hash verification`);
			matrix.add(`${recipeId}|${rulesetId}`);
		} else throw dataError("chart_mode_invalid", "Only Flow and Boxing charts are supported");
		const mapHash = contentHash(declaredChartHash);
		const scoreValue = await sha256Hex$1(canonicalJson$1({
			packageId,
			chartId,
			rulesetId,
			recipeId,
			modifierIds,
			mapHash: declaredChartHash,
			ranked: true
		}));
		variants.push(Object.freeze({
			variantId: chartId,
			chartId,
			mode: chart.mode,
			rulesetId,
			recipeId,
			modifierIds: Object.freeze([...modifierIds]),
			ranked: true,
			mapHash,
			scoreIdentityHash: contentHash(scoreValue),
			provenance: Object.freeze({
				schema: "aerobeat/runtime_variant_provenance",
				version: 1,
				kind: "authored",
				baseVariantId: null,
				requestedModifierIds: Object.freeze([]),
				effectiveModifierIds: Object.freeze([...modifierIds])
			}),
			chart
		}));
	}
	if (flowCount !== 1) throw dataError("flow_variant_invalid", "Package must contain exactly one Flow chart");
	if (!conversionRecipeIds.flatMap((recipe) => ["boxing_semantic_track_v1", "boxing_spatial_grid_v1"].map((ruleset) => `${recipe}|${ruleset}`)).every((identity) => matrix.has(identity))) throw dataError("boxing_matrix_incomplete", "Package does not contain all four Boxing prototype variants");
	validateSets(packageRecord.sets, chartIds);
	const packageHashValue = await sha256Hex$1(canonicalJson$1(packageRecord));
	const expectedPackageHash = normalizeDeclaredHash(options.declaredPackageHash);
	if (expectedPackageHash && expectedPackageHash !== packageHashValue) throw dataError("package_hash_mismatch", "Song package failed declared hash verification");
	return Object.freeze({
		package: packageRecord,
		packageId,
		packageHash: contentHash(packageHashValue),
		song,
		bpm,
		variants: Object.freeze(variants),
		source: isPlainDataRecord(packageRecord.source) ? packageRecord.source : Object.freeze(Object.create(null))
	});
}
/**
* Compose modifiers without changing the immutable base variant.
*
* @param {RuntimeVariant} base
* @param {readonly string[]} requestedModifiers
* @param {string} packageId
* @returns {Promise<RuntimeVariant>}
*/
async function composeRuntimeVariant(base, requestedModifiers, packageId) {
	const requested = normalizeModifiers$1(requestedModifiers);
	const modifiers = normalizeModifiers$1([...base.modifierIds, ...requested]);
	if (modifiers.every((entry, index) => entry === base.modifierIds[index]) && modifiers.length === base.modifierIds.length) return base;
	const chartCopy = cloneMutable(base.chart);
	let beats = requireArray(chartCopy.beats, "chart_beats_invalid").map((beat) => cloneMutable(beat));
	if (modifiers.includes("no_squats")) beats = beats.filter((beat) => beat.type !== "squat");
	if (modifiers.includes("no_weaves")) beats = beats.filter((beat) => beat.type !== "weave_left" && beat.type !== "weave_right");
	for (const beat of beats) {
		const type = String(beat.type ?? "");
		if (/^(straight|hook|uppercut)_/u.test(type)) {
			const punchModifiers = modifiers.filter((entry) => entry === "any_punch" || entry === "cross_body");
			if (punchModifiers.length > 0) {
				beat.runtimeModifiers = punchModifiers;
				beat.modifier = punchModifiers[0];
			}
		}
		if (type === "guard" && modifiers.includes("crossed_guard")) {
			const target = requireRecord$1(beat.guardTarget, "guard_target_invalid");
			beat.guardTarget = {
				...target,
				leftCell: target.rightCell,
				rightCell: target.leftCell,
				crossed: true
			};
			beat.runtimeModifiers = ["crossed_guard"];
			beat.modifier = "crossed_guard";
		}
	}
	chartCopy.beats = beats;
	const suffixSeed = await sha256Hex$1(canonicalJson$1({
		baseChartId: base.chartId,
		modifiers
	}));
	const chartId = `${base.chartId}~mods-${suffixSeed.slice(0, 12)}`;
	chartCopy.chartId = chartId;
	if (base.mode === "boxing") {
		const prototype = cloneMutable(requireRecord$1(chartCopy.prototype, "prototype_invalid"));
		const converterProfile = prototype.converterProfile === void 0 ? null : await normalizeConverterProfile$1(prototype.converterProfile);
		prototype.modifiers = [...modifiers];
		if (converterProfile) prototype.converterProfile = cloneMutable(converterProfile);
		prototype.contentHash = `sha256:${await sha256Hex$1(canonicalJson$1(chartHashProjection(beats, base.recipeId, base.rulesetId, requireHashString(prototype.sourceHash, "source_hash_invalid"), converterProfile)))}`;
		chartCopy.prototype = prototype;
	}
	const frozenChart = cloneFrozenData(chartCopy);
	const mapHashValue = await sha256Hex$1(canonicalJson$1(frozenChart));
	const scoreValue = await sha256Hex$1(canonicalJson$1({
		packageId,
		chartId,
		rulesetId: base.rulesetId,
		recipeId: base.recipeId,
		modifiers,
		mapHashValue,
		ranked: false
	}));
	return Object.freeze({
		variantId: chartId,
		chartId,
		mode: base.mode,
		rulesetId: base.rulesetId,
		recipeId: base.recipeId,
		modifierIds: Object.freeze(modifiers),
		ranked: false,
		mapHash: contentHash(mapHashValue),
		scoreIdentityHash: contentHash(scoreValue),
		provenance: Object.freeze({
			schema: "aerobeat/runtime_variant_provenance",
			version: 1,
			kind: "runtime_composite",
			baseVariantId: base.variantId,
			requestedModifierIds: Object.freeze(requested),
			effectiveModifierIds: Object.freeze([...modifiers])
		}),
		chart: frozenChart
	});
}
/** @param {DataRecord} packageRecord @returns {Promise<Readonly<Record<string, unknown>> | null>} */
async function validatePackageConverterProfile(packageRecord) {
	const sourceValue = requireRecord$1(packageRecord.source, "source_provenance_invalid").converterProfile;
	const traceValue = packageRecord.conversionTrace;
	const trace = isPlainDataRecord(traceValue) ? traceValue : null;
	if (sourceValue === void 0) {
		if (trace && trace.converterProfile !== void 0) throw dataError("converter_profile_unbound", "Conversion trace profile requires package source provenance");
		validateUnboundTraceProfiles(trace);
		return null;
	}
	const profile = await normalizeConverterProfile$1(sourceValue);
	if (!trace) throw dataError("converter_profile_trace_mismatch", "Profile-authored packages require conversion trace provenance");
	if (!sameProfile(profile, await normalizeConverterProfile$1(trace.converterProfile))) throw dataError("converter_profile_trace_mismatch", "Conversion trace profile must exactly match package source provenance");
	const boxing = requireArray(trace.boxing, "converter_profile_boxing_trace_mismatch");
	if (boxing.length !== 4) throw dataError("converter_profile_boxing_trace_mismatch", "Profile-authored packages require four Boxing trace profiles");
	for (const value of boxing) if (!sameProfile(profile, await normalizeConverterProfile$1(requireRecord$1(value, "converter_profile_boxing_trace_mismatch").converterProfile))) throw dataError("converter_profile_boxing_trace_mismatch", "Every Boxing trace profile must match package source provenance");
	const flow = requireArray(trace.flow, "converter_profile_flow_trace_forbidden");
	for (const value of flow) if (requireRecord$1(value, "converter_profile_flow_trace_forbidden").converterProfile !== void 0) throw dataError("converter_profile_flow_trace_forbidden", "Flow traces must not carry Boxing converter profile provenance");
	return profile;
}
/** @param {DataRecord | null} trace */
function validateUnboundTraceProfiles(trace) {
	if (!trace) return;
	for (const key of ["boxing", "flow"]) {
		const traces = trace[key];
		if (traces === void 0) continue;
		const values = requireArray(traces, "converter_profile_unbound");
		for (const value of values) if (requireRecord$1(value, "converter_profile_unbound").converterProfile !== void 0) throw dataError("converter_profile_unbound", "Trace converter profile requires package source provenance");
	}
}
/** @param {DataRecord} prototype @param {Readonly<Record<string, unknown>> | null} expected */
async function validateChartConverterProfile(prototype, expected) {
	if (!expected) {
		if (prototype.converterProfile !== void 0) throw dataError("converter_profile_unbound", "Chart converter profile requires package source provenance");
		return;
	}
	if (!sameProfile(expected, await normalizeConverterProfile$1(prototype.converterProfile))) throw dataError("converter_profile_chart_mismatch", "Chart converter profile must exactly match package source provenance");
}
/** @param {unknown} value @returns {Promise<Readonly<Record<string, unknown>>>} */
async function normalizeConverterProfile$1(value) {
	if (!hasExactDataKeys$1(value, [
		"schema",
		"version",
		"profileId",
		"profileVersion",
		"class",
		"label",
		"experimental",
		"settings",
		"contentHash"
	])) throw dataError("converter_profile_invalid", "Converter profile must contain the exact bounded profile fields");
	const record = value;
	if (record.schema !== "aerobeat/prototype_profile" || record.version !== 1 || record.class !== "converter_regeneration" || record.experimental !== true) throw dataError("converter_profile_invalid", "Converter profile schema, version, class and experimental truth are required");
	const profileId = boundedProfileString(record.profileId, 128);
	const profileVersion = boundedProfileString(record.profileVersion, 64);
	const label = boundedProfileString(record.label, 256);
	if (!hasExactDataKeys$1(record.settings, ["guardRelocationRadius", "reachAllowanceSubcells"])) throw dataError("converter_profile_settings_invalid", "Converter profile settings must contain the exact supported fields");
	const settingsValue = record.settings;
	const settings = Object.freeze({
		guardRelocationRadius: boundedProfileInteger(settingsValue.guardRelocationRadius),
		reachAllowanceSubcells: boundedProfileInteger(settingsValue.reachAllowanceSubcells)
	});
	const hashBody = Object.freeze({
		schema: "aerobeat/prototype_profile",
		version: 1,
		profileId,
		profileVersion,
		class: "converter_regeneration",
		settings
	});
	const contentHash = await sha256Hex$1(canonicalJson$1(hashBody));
	if (record.contentHash !== contentHash) throw dataError("converter_profile_hash_mismatch", "Converter profile content hash does not match its canonical identity and settings");
	return Object.freeze({
		...hashBody,
		label,
		experimental: true,
		contentHash
	});
}
/** @param {unknown} value @param {number} maximum */
function boundedProfileString(value, maximum) {
	if (typeof value !== "string" || !value || value.length > maximum) throw dataError("converter_profile_invalid", "Converter profile strings must be bounded and non-empty");
	return value;
}
/** @param {unknown} value */
function boundedProfileInteger(value) {
	if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 8) throw dataError("converter_profile_settings_invalid", "Converter profile settings must be integers from 0 through 8");
	return Number(value);
}
/** @param {Readonly<Record<string, unknown>>} left @param {Readonly<Record<string, unknown>>} right */
function sameProfile(left, right) {
	return canonicalJson$1(left) === canonicalJson$1(right);
}
/** @param {readonly unknown[]} beats @param {string | null} recipeId @param {string} rulesetId @param {string} sourceHash @param {Readonly<Record<string, unknown>> | null} converterProfile */
function chartHashProjection(beats, recipeId, rulesetId, sourceHash, converterProfile) {
	return {
		beats,
		recipeId,
		rulesetId,
		sourceHash,
		...converterProfile ? { converterProfile } : {}
	};
}
/** @param {unknown} sourceValue */
function validateSource(sourceValue) {
	const source = requireRecord$1(sourceValue, "source_provenance_invalid");
	for (const key of [
		"provider",
		"sourceId",
		"sourceVersionHash",
		"difficulty",
		"sourceDifficultyPath"
	]) requireString(source[key], "source_provenance_invalid");
	requireHashString(source.sourceHash, "source_hash_invalid");
}
/** @param {unknown} setsValue @param {Set<string>} chartIds */
function validateSets(setsValue, chartIds) {
	const sets = requireArray(setsValue, "sets_invalid");
	const setIds = /* @__PURE__ */ new Set();
	const linkedCharts = /* @__PURE__ */ new Set();
	for (const item of sets) {
		const set = requireRecord$1(item, "set_invalid");
		const setId = requireString(set.setId, "set_identity_invalid");
		const chartId = requireString(set.chartId, "set_chart_invalid");
		if (setIds.has(setId) || !chartIds.has(chartId)) throw dataError("set_reference_invalid", "Set identities and chart references must be unique and valid");
		setIds.add(setId);
		linkedCharts.add(chartId);
	}
	if ([...chartIds].some((chartId) => !linkedCharts.has(chartId))) throw dataError("set_reference_missing", "Every chart must have a set reference");
}
/** @param {readonly unknown[]} beats @param {boolean} boxing */
function validateEvents(beats, boxing) {
	const ids = /* @__PURE__ */ new Set();
	const lineageOwners = /* @__PURE__ */ new Set();
	for (let index = 0; index < beats.length; index += 1) {
		const beat = requireRecord$1(beats[index], "event_invalid");
		if (!Number.isFinite(beat.start) || Number(beat.start) < 0 || typeof beat.type !== "string" || beat.type.length === 0) throw dataError("event_shape_invalid", `Event ${index} is invalid`);
		if (!boxing) continue;
		const eventId = requireString(beat.eventId, "event_identity_invalid");
		if (ids.has(eventId)) throw dataError("event_identity_duplicate", "Boxing event IDs must be unique");
		ids.add(eventId);
		if (!Array.isArray(beat.sourceEventIds) || beat.sourceEventIds.length === 0 || beat.sourceEventIds.length > 64 || beat.sourceEventIds.some((entry) => typeof entry !== "string" || entry.length === 0 || entry.length > 512) || new Set(beat.sourceEventIds).size !== beat.sourceEventIds.length) throw dataError("event_lineage_invalid", "Boxing event lineage is required and must be unique");
		if (beat.sourceEventIds.some((entry) => lineageOwners.has(entry))) throw dataError("event_lineage_duplicate", "Source event lineage cannot identify multiple authored targets");
		for (const entry of beat.sourceEventIds) lineageOwners.add(entry);
	}
}
/** @param {DataRecord} song */
function readBpm(song) {
	const first = requireRecord$1(requireArray(requireRecord$1(song.timing, "song_timing_invalid").tempoSegments, "song_timing_invalid")[0], "song_timing_invalid");
	if (!Number.isFinite(first.bpm) || Number(first.bpm) <= 0) throw dataError("song_bpm_invalid", "Song BPM must be positive");
	return Number(first.bpm);
}
/** @param {unknown} value @param {string} code @returns {DataRecord} */
function requireRecord$1(value, code) {
	if (!isPlainDataRecord(value)) throw dataError(code, "Expected a plain content record");
	return value;
}
/** @param {unknown} value @param {string} code @returns {readonly unknown[]} */
function requireArray(value, code) {
	if (!Array.isArray(value)) throw dataError(code, "Expected a content array");
	return value;
}
/** @param {unknown} value @param {string} code @returns {string} */
function requireString(value, code) {
	if (typeof value !== "string" || value.length === 0) throw dataError(code, "Expected a non-empty content string");
	return value;
}
/** @param {unknown} value @param {string} code @returns {string} */
function requireHashString(value, code) {
	if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) throw dataError(code, "Expected a lowercase SHA-256 hash");
	return value;
}
/** @param {unknown} value @returns {string} */
function normalizeDeclaredHash(value) {
	if (value === null || value === void 0) return "";
	if (typeof value === "string") {
		if (!/^sha256:[0-9a-f]{64}$/u.test(value)) throw dataError("package_hash_invalid", "Declared package hash is invalid");
		return value.slice(7);
	}
	if (hasExactDataKeys$1(value, [
		"schema",
		"version",
		"algorithm",
		"value"
	]) && value.schema === "aerobeat/content_hash" && value.version === 1 && value.algorithm === "sha256" && typeof value.value === "string" && /^[0-9a-f]{64}$/u.test(value.value)) return value.value;
	throw dataError("package_hash_invalid", "Declared package hash is invalid");
}
/** @param {unknown} value @returns {string[]} */
function normalizeModifiers$1(value) {
	if (!Array.isArray(value) || value.length > mapModifierIds.length || value.some((entry) => typeof entry !== "string")) throw dataError("modifiers_invalid", "Modifiers must be a bounded string array");
	const result = [...new Set(value)].sort();
	if (result.some((entry) => !mapModifierIds.includes(entry))) throw dataError("modifier_invalid", "Modifier is unsupported");
	return result;
}
/** @param {readonly unknown[]} beats @param {readonly string[]} identity */
function validateEventModifierIdentity(beats, identity) {
	for (const value of beats) {
		const beat = requireRecord$1(value, "event_invalid");
		const emitted = [];
		if (beat.modifier !== void 0 && beat.modifier !== null) emitted.push(beat.modifier);
		if (beat.runtimeModifiers !== void 0) {
			if (!Array.isArray(beat.runtimeModifiers)) throw dataError("event_modifier_invalid", "Event runtimeModifiers must be an array");
			emitted.push(...beat.runtimeModifiers);
		}
		if (emitted.some((entry) => typeof entry !== "string" || !identity.includes(entry))) throw dataError("event_modifier_not_in_identity", "Every emitted event modifier must be declared in chart identity");
		if (beat.type === "guard" && isPlainDataRecord(beat.guardTarget) && beat.guardTarget.crossed === true && !identity.includes("crossed_guard")) throw dataError("crossed_guard_identity_missing", "Crossed guard events require crossed_guard chart identity");
	}
}
/** @param {string} value */
function contentHash(value) {
	return Object.freeze({
		schema: "aerobeat/content_hash",
		version: 1,
		algorithm: "sha256",
		value
	});
}
/** @param {unknown} value @returns {unknown} */
function cloneMutable(value) {
	if (Array.isArray(value)) return value.map(cloneMutable);
	if (isPlainDataRecord(value)) {
		const result = {};
		for (const key of Object.keys(value)) result[key] = cloneMutable(value[key]);
		return result;
	}
	return value;
}
//#endregion
//#region ../aerobeat-web-content/src/content-runtime.js
/** @typedef {ReturnType<typeof createAeroContentRuntime>} AeroContentRuntime */
/** @typedef {Readonly<Record<string, unknown>>} DataRecord */
/** @typedef {import("./package-content.js").RuntimeVariant} RuntimeVariant */
/** @typedef {import("./assets.js").LoadedAsset} LoadedAsset */
/** @type {Readonly<Record<string, unknown>>} */
var aeroContentRuntimeCapabilities = Object.freeze({
	directPackages: true,
	externalUrls: true,
	persistenceHandles: true,
	aeroPackageV1: true,
	sha256Verification: true,
	corsReadability: true,
	cosmeticFallback: true,
	variantComposition: true,
	pausedFutureSwap: true,
	playlistAllowlistRequired: false
});
/**
* Create one content runtime for one connected `aero-game`.
*
* @param {{fetch?: typeof globalThis.fetch, persistenceResolver?: {loadPackage?: (handle: DataRecord) => Promise<unknown>, readAsset?: (handle: DataRecord, path: string) => Promise<Uint8Array>, exportPackage?: (handle: DataRecord) => Promise<unknown>}, supportedRulesetIds?: readonly string[], supportedRecipeIds?: readonly string[], onListenerError?: (error: unknown) => void}} [options]
*/
function createAeroContentRuntime(options = {}) {
	const runtimeOptions = normalizeRuntimeConfiguration(options);
	const listeners = /* @__PURE__ */ new Set();
	let generation = 0;
	let activeAbort = new AbortController();
	let destroyed = false;
	/** @type {LoadedAsset[]} */
	let assets = [];
	/** @type {Map<string, RuntimeVariant>} */
	let variantById = /* @__PURE__ */ new Map();
	/** @type {Map<string, RuntimeVariant>} */
	let composedVariants = /* @__PURE__ */ new Map();
	/** @type {RuntimeVariant | null} */
	let selectedVariant = null;
	/** @type {readonly DataRecord[]} */
	let resolvedEvents = Object.freeze([]);
	let playbackState = "idle";
	let playbackPositionMs = 0;
	let judgedEventIds = /* @__PURE__ */ new Set();
	let activeEventIds = /* @__PURE__ */ new Set();
	/** @type {(() => Promise<unknown>) | null} */
	let reloadLoader = null;
	/** @type {RuntimeLoadOptions} */
	let reloadOptions = {};
	/** @type {DataRecord | null} */
	let loadedPackage = null;
	let loadedBpm = 120;
	let packageId = null;
	let packageHash = null;
	let sourceSnapshot = null;
	let contentLineage = null;
	let themeSnapshot = null;
	let backgroundSnapshot = fallbackBackground();
	let snapshot = makeSnapshot("idle", null);
	return Object.freeze({
		/**
		* Load a direct package wrapper. Raw bytes remain private to this service.
		*
		* @param {unknown} input Plain package or `{package, packageHash, assets}` wrapper.
		* @param {RuntimeLoadOptions} [loadOptions]
		*/
		loadPackage(input, loadOptions = {}) {
			assertOpen();
			const normalizedOptions = normalizeLoadOptions(loadOptions);
			const wrapper = isPlainDataRecord(input) && Object.hasOwn(input, "package") ? input : {
				package: input,
				assets: normalizedOptions.assets ?? []
			};
			const loader = async () => ({
				package: dataProperty$2(wrapper, "package"),
				packageHash: dataProperty$2(wrapper, "packageHash") ?? normalizedOptions.packageHash ?? null,
				assets: dataProperty$2(wrapper, "assets") ?? normalizedOptions.assets ?? [],
				baseUrl: normalizedOptions.baseUrl
			});
			return startLoad(loader, Object.freeze({
				kind: "direct",
				id: "direct-package"
			}), normalizedOptions);
		},
		/**
		* Load a CORS-readable external package JSON URL.
		*
		* @param {string} url
		* @param {RuntimeLoadOptions} [loadOptions]
		*/
		loadExternalPackage(url, loadOptions = {}) {
			assertOpen();
			const normalizedOptions = normalizeLoadOptions(loadOptions);
			const normalizedUrl = normalizeExternalUrl(url);
			const loader = async () => {
				const value = await fetchPackageJson(normalizedUrl, activeAbort.signal);
				const wrapper = isPlainDataRecord(value) && Object.hasOwn(value, "package") ? value : {
					package: value,
					assets: normalizedOptions.assets ?? []
				};
				return {
					package: dataProperty$2(wrapper, "package"),
					packageHash: dataProperty$2(wrapper, "packageHash") ?? normalizedOptions.packageHash ?? null,
					assets: dataProperty$2(wrapper, "assets") ?? normalizedOptions.assets ?? [],
					baseUrl: normalizedUrl
				};
			};
			return startLoad(loader, Object.freeze({
				kind: "external_url",
				id: normalizedUrl
			}), normalizedOptions);
		},
		/**
		* Resolve an authored persistence handle through the injected public resolver.
		*
		* @param {unknown} handleValue
		* @param {RuntimeLoadOptions} [loadOptions]
		*/
		loadPersistenceHandle(handleValue, loadOptions = {}) {
			assertOpen();
			const normalizedOptions = normalizeLoadOptions(loadOptions);
			if (!isPersistenceHandle(handleValue)) throw dataError("persistence_handle_invalid", "Persistence handle does not satisfy the public contract");
			const handle = cloneFrozenData(handleValue);
			const resolver = runtimeOptions.persistenceResolver;
			if (!resolver) throw dataError("persistence_resolver_unavailable", "No persistence resolver was injected");
			const loader = async () => {
				if (resolver.exportPackage) return {
					...await parseAeroPackage(extractExportBytes(await resolver.exportPackage(handle))),
					baseUrl: void 0
				};
				if (!resolver.loadPackage || !resolver.readAsset) throw dataError("persistence_resolver_incomplete", "Persistence resolver needs exportPackage or loadPackage/readAsset");
				const loaded = await resolver.loadPackage(handle);
				if (!isPlainDataRecord(loaded)) throw dataError("persistence_record_invalid", "Persistence resolver returned an invalid record");
				const rawPaths = dataProperty$2(loaded, "assetPaths");
				const paths = rawPaths === void 0 ? [] : normalizePathList(rawPaths);
				const declarations = normalizedOptions.assetHashes ?? Object.freeze({});
				const loadedAssets = [];
				for (const path of paths) {
					const bytes = await resolver.readAsset(handle, path);
					if (!(bytes instanceof Uint8Array)) throw dataError("persistence_asset_invalid", "Persistence resolver returned invalid asset bytes");
					loadedAssets.push({
						path,
						hash: dataProperty$2(declarations, path),
						bytes
					});
				}
				return {
					package: dataProperty$2(loaded, "package"),
					packageHash: handle.packageHash,
					assets: loadedAssets,
					baseUrl: void 0
				};
			};
			return startLoad(loader, Object.freeze({
				kind: "persistence_handle",
				id: `${handle.namespace}:${handle.key}`,
				handle
			}), normalizedOptions);
		},
		async reload() {
			assertOpen();
			if (!reloadLoader || !sourceSnapshot) throw dataError("reload_unavailable", "No content source is available to reload");
			return startLoad(reloadLoader, sourceSnapshot, reloadOptions);
		},
		/** @param {string} variantId @param {{modifierIds?: readonly string[]}} [selection] */
		async selectVariant(variantId, selection = {}) {
			assertReady();
			if (playbackState === "running") throw dataError("variant_swap_running", "Variants may not change while gameplay is running");
			const target = await resolveVariant(requireBoundedString(variantId, "variant_identity_invalid", 256), normalizeModifierSelection(selection));
			selectedVariant = target;
			resolvedEvents = timelineFor(target, loadedBpm);
			publish();
			return target;
		},
		/**
		* Replace only future targets while paused. Past, judged and active event objects
		* remain the exact frozen objects already observed by gameplay.
		*
		* @param {string} variantId
		* @param {{modifierIds?: readonly string[]}} [selection]
		*/
		async swapFutureVariant(variantId, selection = {}) {
			assertReady();
			if (playbackState !== "paused") throw dataError("variant_swap_not_paused", "Future-target swaps require a paused session");
			const target = await resolveVariant(requireBoundedString(variantId, "variant_identity_invalid", 256), normalizeModifierSelection(selection));
			const future = timelineFor(target, loadedBpm);
			const preserved = resolvedEvents.filter((event) => Number(event.centerTimestampMs) < playbackPositionMs || judgedEventIds.has(String(event.eventId)) || activeEventIds.has(String(event.eventId)));
			const preservedIds = new Set(preserved.map((event) => String(event.eventId)));
			const preservedTargets = new Set(preserved.flatMap(eventTargetKeys));
			const replacement = future.filter((event) => Number(event.centerTimestampMs) >= playbackPositionMs && !preservedIds.has(String(event.eventId)) && eventTargetKeys(event).every((key) => !preservedTargets.has(key)));
			resolvedEvents = Object.freeze([...preserved, ...replacement].sort((left, right) => Number(left.centerTimestampMs) - Number(right.centerTimestampMs) || compareCodePoints(String(left.eventId), String(right.eventId))));
			selectedVariant = target;
			publish();
			return target;
		},
		/** @param {{state: "idle" | "running" | "paused" | "stopped", positionMs: number, judgedEventIds?: readonly string[], activeEventIds?: readonly string[]}} state */
		setPlaybackState(state) {
			assertReady();
			const narrowed = normalizePlaybackState(state);
			playbackState = narrowed.state;
			playbackPositionMs = narrowed.positionMs;
			judgedEventIds = new Set(narrowed.judgedEventIds);
			activeEventIds = new Set(narrowed.activeEventIds);
			publish();
		},
		/** @param {string} path */
		readAsset(path) {
			assertReady();
			const normalized = normalizeAssetPath(path);
			const asset = assets.find((entry) => entry.path.toLowerCase() === normalized.toLowerCase());
			if (!asset?.bytes) throw dataError("asset_not_found", "Verified asset is unavailable");
			return Uint8Array.from(asset.bytes);
		},
		getSnapshot() {
			return snapshot;
		},
		getCapabilities() {
			return aeroContentRuntimeCapabilities;
		},
		/** @param {(value: typeof snapshot) => void} listener */
		subscribe(listener) {
			assertOpen();
			if (typeof listener !== "function") throw dataError("listener_invalid", "Listener must be a function");
			listeners.add(listener);
			notify(listener);
			return () => listeners.delete(listener);
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			generation += 1;
			activeAbort.abort();
			clearLoaded();
			sourceSnapshot = null;
			reloadLoader = null;
			reloadOptions = {};
			listeners.clear();
			snapshot = makeSnapshot("destroyed", Object.freeze({
				code: "service_destroyed",
				message: "Content runtime is destroyed"
			}));
		}
	});
	/** @param {() => Promise<unknown>} loader @param {DataRecord} publicSource @param {RuntimeLoadOptions} loadOptions */
	async function startLoad(loader, publicSource, loadOptions) {
		assertOpen();
		activeAbort.abort();
		activeAbort = new AbortController();
		const localAbort = activeAbort;
		const localGeneration = ++generation;
		const externalAbort = () => localAbort.abort();
		loadOptions.signal?.addEventListener("abort", externalAbort, { once: true });
		clearLoaded();
		reloadLoader = null;
		reloadOptions = {};
		sourceSnapshot = publicSource;
		snapshot = makeSnapshot("loading", null);
		notifyAll();
		try {
			const raw = await raceAbort(loader(), localAbort.signal);
			checkCurrent(localGeneration, localAbort.signal);
			if (!isPlainDataRecord(raw)) throw dataError("content_source_invalid", "Content source loader returned an invalid record");
			const packageValue = raw.package;
			const packageAudio = audioDeclaration(packageValue);
			let declarations = Array.isArray(raw.assets) ? raw.assets.map((entry) => enrichAssetHash(entry, packageAudio)) : [];
			const songSuggestion = presentationSuggestion(packageValue);
			const suggestedBackground = backgroundFromSuggestion(songSuggestion);
			if (suggestedBackground?.url && !declarations.some((entry) => isPlainDataRecord(entry) && entry.url === suggestedBackground.url)) declarations.push({
				path: pathFromUrl(suggestedBackground.url),
				kind: "background",
				url: suggestedBackground.url,
				hash: suggestedBackground.hash,
				critical: false
			});
			const packageResult = await validateRuntimePackage(packageValue, {
				declaredPackageHash: raw.packageHash ?? null,
				supportedRulesetIds: runtimeOptions.supportedRulesetIds,
				supportedRecipeIds: runtimeOptions.supportedRecipeIds
			});
			checkCurrent(localGeneration, localAbort.signal);
			const loadedAssets = await loadPackageAssets(declarations, {
				fetch: runtimeOptions.fetch,
				baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : loadOptions.baseUrl,
				signal: localAbort.signal,
				timeoutMs: runtimeOptions.timeoutMs,
				maximumAssetBytes: runtimeOptions.maximumAssetBytes
			});
			checkCurrent(localGeneration, localAbort.signal);
			verifyPackageAudio(packageResult.song, loadedAssets);
			loadedPackage = packageResult.package;
			loadedBpm = packageResult.bpm;
			packageId = packageResult.packageId;
			packageHash = packageResult.packageHash;
			contentLineage = packageResult.source;
			assets = loadedAssets;
			variantById = new Map(packageResult.variants.map((variant) => [variant.variantId, variant]));
			composedVariants.clear();
			selectedVariant = packageResult.variants.find((variant) => variant.mode === "flow") ?? packageResult.variants[0] ?? null;
			resolvedEvents = selectedVariant ? timelineFor(selectedVariant, loadedBpm) : Object.freeze([]);
			playbackState = "idle";
			playbackPositionMs = 0;
			judgedEventIds.clear();
			activeEventIds.clear();
			themeSnapshot = resolveTheme(songSuggestion, loadOptions);
			backgroundSnapshot = resolveBackground(songSuggestion, loadOptions, loadedAssets);
			reloadLoader = loader;
			reloadOptions = {
				...loadOptions,
				signal: void 0
			};
			snapshot = makeSnapshot("ready", null);
			notifyAll();
			return snapshot;
		} catch (cause) {
			if (localGeneration !== generation || localAbort.signal.aborted) throw dataError("operation_aborted", "Content load was cancelled");
			clearLoaded();
			snapshot = makeSnapshot("error", publicError(cause));
			notifyAll();
			throw cause;
		} finally {
			loadOptions.signal?.removeEventListener("abort", externalAbort);
		}
	}
	/** @param {string} variantId @param {readonly string[]} modifiers */
	async function resolveVariant(variantId, modifiers) {
		const base = variantById.get(variantId);
		if (!base) throw dataError("variant_not_found", "Content variant was not found");
		const key = `${variantId}|${[...modifiers].sort().join(",")}`;
		const cached = composedVariants.get(key);
		if (cached) return cached;
		const composed = await composeRuntimeVariant(base, modifiers, String(packageId));
		composedVariants.set(key, composed);
		return composed;
	}
	function clearLoaded() {
		assets = [];
		variantById.clear();
		composedVariants.clear();
		selectedVariant = null;
		resolvedEvents = Object.freeze([]);
		loadedPackage = null;
		packageId = null;
		packageHash = null;
		contentLineage = null;
		themeSnapshot = null;
		backgroundSnapshot = fallbackBackground();
		playbackState = "idle";
		playbackPositionMs = 0;
		judgedEventIds.clear();
		activeEventIds.clear();
	}
	function publish() {
		snapshot = makeSnapshot("ready", null);
		notifyAll();
	}
	function notifyAll() {
		for (const listener of [...listeners]) notify(listener);
	}
	/** @param {(value: typeof snapshot) => void} listener */
	function notify(listener) {
		try {
			listener(snapshot);
		} catch (error) {
			try {
				runtimeOptions.onListenerError?.(error);
			} catch {}
		}
	}
	function assertOpen() {
		if (destroyed) throw dataError("service_destroyed", "Content runtime is destroyed");
	}
	function assertReady() {
		assertOpen();
		if (!loadedPackage || snapshot.state !== "ready") throw dataError("content_not_ready", "Content is not ready");
	}
	/** @param {number} currentGeneration @param {AbortSignal} signal */
	function checkCurrent(currentGeneration, signal) {
		if (destroyed || currentGeneration !== generation || signal.aborted) throw dataError("operation_aborted", "Content load was cancelled");
	}
	/** @param {"idle" | "loading" | "ready" | "error" | "destroyed"} state @param {Readonly<{code: string, message: string}> | null} error */
	function makeSnapshot(state, error) {
		return Object.freeze({
			schema: "aerobeat/content_runtime_snapshot",
			version: 1,
			serviceId: serviceIds.contentLibrary,
			state,
			generation,
			source: sourceSnapshot,
			lineage: contentLineage,
			packageId,
			packageHash,
			song: loadedPackage?.song ?? null,
			variants: Object.freeze([...variantById.values()].map(publicVariant)),
			selectedVariant: selectedVariant ? publicVariant(selectedVariant) : null,
			resolvedEvents,
			playback: Object.freeze({
				state: playbackState,
				positionMs: playbackPositionMs,
				judgedEventIds: Object.freeze([...judgedEventIds]),
				activeEventIds: Object.freeze([...activeEventIds])
			}),
			assets: publicAssetSnapshots(assets),
			theme: themeSnapshot,
			background: backgroundSnapshot,
			capabilities: aeroContentRuntimeCapabilities,
			error
		});
	}
	/** @param {string} url @param {AbortSignal} signal */
	async function fetchPackageJson(url, signal) {
		const fetchFunction = runtimeOptions.fetch ?? globalThis.fetch;
		if (!fetchFunction) throw dataError("fetch_unavailable", "Fetch is unavailable");
		const controller = new AbortController();
		const abort = () => controller.abort(signal.reason);
		signal.addEventListener("abort", abort, { once: true });
		let timeoutId;
		try {
			const request = Promise.resolve().then(() => fetchFunction(url, {
				mode: "cors",
				credentials: "omit",
				redirect: "follow",
				signal: controller.signal
			}));
			const timeoutFailure = new Promise((_, reject) => {
				timeoutId = setTimeout(() => {
					controller.abort();
					reject(dataError("fetch_timeout", "External package request timed out"));
				}, runtimeOptions.timeoutMs);
			});
			const response = await Promise.race([raceAbort(request, controller.signal), timeoutFailure]);
			if (!response.ok) throw dataError("package_http_failed", `External package returned HTTP ${response.status}`);
			if (response.url) normalizeExternalUrl(response.url);
			const declared = response.headers?.get?.("content-length");
			if (declared !== null && declared !== void 0 && declared !== "") {
				if (!/^(0|[1-9][0-9]*)$/u.test(declared) || !Number.isSafeInteger(Number(declared))) throw dataError("package_length_invalid", "External package Content-Length is invalid");
				if (Number(declared) > runtimeOptions.maximumPackageBytes) throw dataError("package_too_large", "External package exceeds the byte limit");
			}
			const text = await raceAbort(response.text(), controller.signal);
			if (new TextEncoder().encode(text).byteLength > runtimeOptions.maximumPackageBytes) throw dataError("package_too_large", "External package exceeds the byte limit");
			try {
				return JSON.parse(text);
			} catch {
				throw dataError("package_json_invalid", "External package response is not valid JSON");
			}
		} catch (cause) {
			if (signal.aborted) throw dataError("operation_aborted", "Content load was cancelled");
			if (cause && typeof cause === "object" && "code" in cause) throw cause;
			throw dataError("cors_unreadable", diagnosticString(cause, "message") ?? "External package was not CORS-readable");
		} finally {
			clearTimeout(timeoutId);
			signal.removeEventListener("abort", abort);
		}
	}
}
/** @typedef {{signal?: AbortSignal, assets?: readonly unknown[], assetHashes?: Readonly<Record<string, unknown>>, packageHash?: unknown, baseUrl?: string, defaultTheme?: unknown, playlistTheme?: unknown, athleteTheme?: unknown, hostTheme?: unknown, defaultBackground?: unknown, playlistBackground?: unknown, athleteBackground?: unknown, hostBackground?: unknown}} RuntimeLoadOptions */
/** @param {unknown} value */
function normalizeRuntimeConfiguration(value) {
	if (!isPlainDataRecord(value)) throw dataError("runtime_options_invalid", "Runtime options must be a plain data record");
	const fetchValue = dataProperty$2(value, "fetch");
	const listenerError = dataProperty$2(value, "onListenerError");
	const resolverValue = dataProperty$2(value, "persistenceResolver");
	if (fetchValue !== void 0 && typeof fetchValue !== "function") throw dataError("runtime_fetch_invalid", "Injected fetch must be a function");
	if (listenerError !== void 0 && typeof listenerError !== "function") throw dataError("runtime_listener_invalid", "Listener error handler must be a function");
	const supportedRulesetIds = normalizeOptionalStringArray(dataProperty$2(value, "supportedRulesetIds"), 16, "runtime_rulesets_invalid");
	const supportedRecipeIds = normalizeOptionalStringArray(dataProperty$2(value, "supportedRecipeIds"), 16, "runtime_recipes_invalid");
	return Object.freeze({
		fetch: fetchValue,
		onListenerError: listenerError,
		persistenceResolver: normalizePersistenceResolver(resolverValue),
		supportedRulesetIds,
		supportedRecipeIds,
		timeoutMs: positiveSafeInteger(dataProperty$2(value, "timeoutMs"), 15e3, "runtime_timeout_invalid"),
		maximumPackageBytes: positiveSafeInteger(dataProperty$2(value, "maximumPackageBytes"), 16777216, "runtime_package_limit_invalid"),
		maximumAssetBytes: positiveSafeInteger(dataProperty$2(value, "maximumAssetBytes"), 134217728, "runtime_asset_limit_invalid")
	});
}
/** @param {unknown} value */
function normalizePersistenceResolver(value) {
	if (value === void 0) return void 0;
	if (!isPlainDataRecord(value)) throw dataError("persistence_resolver_invalid", "Persistence resolver must be a plain record");
	const loadPackage = dataProperty$2(value, "loadPackage");
	const readAsset = dataProperty$2(value, "readAsset");
	const exportPackage = dataProperty$2(value, "exportPackage");
	if ([
		loadPackage,
		readAsset,
		exportPackage
	].some((entry) => entry !== void 0 && typeof entry !== "function")) throw dataError("persistence_resolver_invalid", "Persistence resolver operations must be functions");
	return Object.freeze({
		loadPackage,
		readAsset,
		exportPackage
	});
}
/** @param {unknown} value @returns {RuntimeLoadOptions} */
function normalizeLoadOptions(value) {
	if (!isPlainDataRecord(value)) throw dataError("load_options_invalid", "Load options must be a plain data record");
	const signal = dataProperty$2(value, "signal");
	if (signal !== void 0 && !(signal instanceof AbortSignal)) throw dataError("abort_signal_invalid", "Load signal must be an AbortSignal");
	const assets = dataProperty$2(value, "assets");
	if (assets !== void 0 && !Array.isArray(assets)) throw dataError("assets_invalid", "Load assets must be an array");
	const hashes = dataProperty$2(value, "assetHashes");
	if (hashes !== void 0 && !isPlainDataRecord(hashes)) throw dataError("asset_hashes_invalid", "Asset hashes must be a plain record");
	const baseUrl = dataProperty$2(value, "baseUrl");
	if (baseUrl !== void 0 && typeof baseUrl !== "string") throw dataError("base_url_invalid", "Base URL must be a string");
	const result = Object.create(null);
	for (const key of [
		"packageHash",
		"defaultTheme",
		"playlistTheme",
		"athleteTheme",
		"hostTheme",
		"defaultBackground",
		"playlistBackground",
		"athleteBackground",
		"hostBackground"
	]) result[key] = dataProperty$2(value, key);
	Object.assign(result, {
		signal,
		assets,
		assetHashes: hashes,
		baseUrl
	});
	return Object.freeze(result);
}
/** @param {unknown} value */
function normalizeModifierSelection(value) {
	if (!isPlainDataRecord(value)) throw dataError("selection_invalid", "Variant selection must be a plain record");
	return normalizeOptionalStringArray(dataProperty$2(value, "modifierIds"), 5, "modifiers_invalid") ?? Object.freeze([]);
}
/** @param {unknown} value */
function normalizePlaybackState(value) {
	if (!isPlainDataRecord(value)) throw dataError("playback_state_invalid", "Playback state must be a plain record");
	const state = dataProperty$2(value, "state");
	const positionMs = dataProperty$2(value, "positionMs");
	if (typeof state !== "string" || ![
		"idle",
		"running",
		"paused",
		"stopped"
	].includes(state) || typeof positionMs !== "number" || !Number.isFinite(positionMs) || positionMs < 0) throw dataError("playback_state_invalid", "Playback state is invalid");
	return Object.freeze({
		state,
		positionMs,
		judgedEventIds: normalizeOptionalStringArray(dataProperty$2(value, "judgedEventIds"), 1e5, "event_ids_invalid") ?? Object.freeze([]),
		activeEventIds: normalizeOptionalStringArray(dataProperty$2(value, "activeEventIds"), 1e5, "event_ids_invalid") ?? Object.freeze([])
	});
}
/** @param {unknown} value @param {number} maximum @param {string} code */
function normalizeOptionalStringArray(value, maximum, code) {
	if (value === void 0) return void 0;
	if (!Array.isArray(value) || value.length > maximum || value.some((entry) => typeof entry !== "string" || entry.length === 0 || entry.length > 512)) throw dataError(code, "Expected a bounded string array");
	return Object.freeze([...new Set(value)]);
}
/** @param {unknown} value @param {string} code @param {number} maximum */
function requireBoundedString(value, code, maximum) {
	if (typeof value !== "string" || value.length === 0 || value.length > maximum) throw dataError(code, "Expected a bounded string");
	return value;
}
/** @param {unknown} value @param {number} fallback @param {string} code */
function positiveSafeInteger(value, fallback, code) {
	if (value === void 0) return fallback;
	if (!Number.isSafeInteger(value) || Number(value) <= 0) throw dataError(code, "Expected a positive safe integer");
	return Number(value);
}
/** @param {unknown} value */
function normalizePathList(value) {
	if (!Array.isArray(value) || value.length > 2048) throw dataError("persistence_paths_invalid", "Persistence asset paths must be a bounded array");
	const paths = value.map((entry) => normalizeAssetPath(entry));
	if (new Set(paths.map((entry) => entry.toLowerCase())).size !== paths.length) throw dataError("asset_duplicate", "Persistence asset paths must be unique");
	return paths;
}
/** @param {Promise<unknown>} promise @param {AbortSignal} signal */
async function raceAbort(promise, signal) {
	if (signal.aborted) throw dataError("operation_aborted", "Content load was cancelled");
	return new Promise((resolve, reject) => {
		const aborted = () => {
			cleanup();
			reject(dataError("operation_aborted", "Content load was cancelled"));
		};
		const cleanup = () => signal.removeEventListener("abort", aborted);
		signal.addEventListener("abort", aborted, { once: true });
		promise.then((value) => {
			cleanup();
			resolve(value);
		}, (cause) => {
			cleanup();
			reject(cause);
		});
	});
}
/** @param {RuntimeVariant} variant */
function publicVariant(variant) {
	return Object.freeze({
		variantId: variant.variantId,
		chartId: variant.chartId,
		mode: variant.mode,
		rulesetId: variant.rulesetId,
		recipeId: variant.recipeId,
		modifierIds: variant.modifierIds,
		ranked: variant.ranked,
		mapHash: variant.mapHash,
		scoreIdentityHash: variant.scoreIdentityHash,
		provenance: variant.provenance
	});
}
/** @param {RuntimeVariant} variant @param {number} bpm @returns {readonly DataRecord[]} */
function timelineFor(variant, bpm) {
	const beats = Array.isArray(variant.chart.beats) ? variant.chart.beats : [];
	return Object.freeze(beats.map((beatValue, index) => {
		const beat = beatValue;
		const eventId = typeof beat.eventId === "string" ? beat.eventId : `${variant.chartId}:event:${index}`;
		return Object.freeze({
			schema: "aerobeat/resolved_content_event",
			version: 1,
			eventId,
			variantId: variant.variantId,
			chartId: variant.chartId,
			centerTimestampMs: Number(beat.start) * 6e4 / bpm,
			authoredBeat: beat
		});
	}).sort((left, right) => left.centerTimestampMs - right.centerTimestampMs || compareCodePoints(left.eventId, right.eventId)));
}
/** @param {DataRecord} event @returns {string[]} */
function eventTargetKeys(event) {
	const beat = isPlainDataRecord(event.authoredBeat) ? event.authoredBeat : null;
	const lineage = beat && Array.isArray(beat.sourceEventIds) ? beat.sourceEventIds.filter((entry) => typeof entry === "string").map((entry) => `source:${entry}`) : [];
	return lineage.length > 0 ? lineage : [`target:${String(event.centerTimestampMs)}:${String(beat?.type ?? "")}`];
}
/** @param {unknown} value */
function extractExportBytes(value) {
	if (value instanceof Uint8Array) return Uint8Array.from(value);
	if (isPlainDataRecord(value) && value.bytes instanceof Uint8Array) return Uint8Array.from(value.bytes);
	throw dataError("aeropkg_export_invalid", "Persistence export did not provide AEROPKG1 bytes");
}
/** @param {unknown} packageValue */
function audioDeclaration(packageValue) {
	if (!isPlainDataRecord(packageValue) || !isPlainDataRecord(packageValue.song) || !isPlainDataRecord(packageValue.song.audio)) return null;
	const audio = packageValue.song.audio;
	return typeof audio.filePath === "string" && typeof audio.contentHash === "string" ? {
		path: audio.filePath,
		hash: audio.contentHash
	} : null;
}
/** @param {unknown} entry @param {{path: string, hash: string} | null} audio */
function enrichAssetHash(entry, audio) {
	if (!isPlainDataRecord(entry)) return entry;
	if (audio && typeof entry.path === "string" && entry.path.toLowerCase() === audio.path.toLowerCase() && !entry.hash) return {
		...entry,
		kind: "audio",
		hash: audio.hash
	};
	return entry;
}
/** @param {DataRecord} song @param {readonly LoadedAsset[]} loadedAssets */
function verifyPackageAudio(song, loadedAssets) {
	if (!isPlainDataRecord(song.audio) || typeof song.audio.filePath !== "string" || typeof song.audio.contentHash !== "string") throw dataError("audio_declaration_missing", "Song package must declare a hashed audio asset");
	const path = normalizeAssetPath(song.audio.filePath);
	const expected = song.audio.contentHash;
	const asset = loadedAssets.find((entry) => entry.path.toLowerCase() === path.toLowerCase());
	if (!asset || `sha256:${asset.hash}` !== expected || asset.status !== "ready") throw dataError("audio_declaration_mismatch", "Verified audio does not match the song declaration");
}
/** @param {unknown} packageValue */
function presentationSuggestion(packageValue) {
	if (!isPlainDataRecord(packageValue)) return null;
	return isPlainDataRecord(packageValue.presentationSuggestion) ? packageValue.presentationSuggestion : null;
}
/** @param {DataRecord | null} suggestion */
function backgroundFromSuggestion(suggestion) {
	if (!suggestion) return null;
	if (isBackgroundSuggestion(suggestion.background)) return suggestion.background;
	if (isBackgroundSuggestion(suggestion)) return suggestion;
	return null;
}
/** @param {DataRecord | null} suggestion @param {RuntimeLoadOptions} options */
function resolveTheme(suggestion, options) {
	const songTheme = suggestion && isThemeDescriptor(suggestion.theme) ? suggestion.theme : null;
	const candidates = [
		options.defaultTheme,
		options.playlistTheme,
		songTheme,
		options.athleteTheme,
		options.hostTheme
	];
	let selected = null;
	for (const candidate of candidates) if (isThemeDescriptor(candidate)) selected = cloneFrozenData(candidate);
	return selected;
}
/** @param {DataRecord | null} suggestion @param {RuntimeLoadOptions} options @param {readonly LoadedAsset[]} loadedAssets */
function resolveBackground(suggestion, options, loadedAssets) {
	const songBackground = backgroundFromSuggestion(suggestion);
	const candidates = [
		{
			value: options.defaultBackground,
			packageOwned: false
		},
		{
			value: options.playlistBackground,
			packageOwned: false
		},
		{
			value: songBackground,
			packageOwned: true
		},
		{
			value: options.athleteBackground,
			packageOwned: false
		},
		{
			value: options.hostBackground,
			packageOwned: false
		}
	];
	let selected = fallbackBackground();
	let packageOwned = false;
	for (const candidate of candidates) if (isBackgroundSuggestion(candidate.value)) {
		selected = cloneFrozenData(candidate.value);
		packageOwned = candidate.packageOwned;
	}
	if (packageOwned && (selected.kind === "image" || selected.kind === "video") && selected.url) {
		const matching = loadedAssets.find((entry) => entry.url === selected.url || entry.path === pathFromUrl(String(selected.url)));
		if (!matching || matching.status === "fallback") return Object.freeze({
			...fallbackBackground(),
			degradedFrom: selected,
			degradationReason: matching?.errorCode ?? "background_unreadable"
		});
	}
	return selected;
}
function fallbackBackground() {
	return Object.freeze({
		schema: "aerobeat/background_suggestion",
		version: 1,
		source: backgroundSuggestionPrecedence[0],
		kind: "css",
		url: null,
		hash: null,
		themeId: null
	});
}
/** @param {string} value */
function normalizeExternalUrl(value) {
	if (typeof value !== "string") throw dataError("package_url_invalid", "Package URL must be a string");
	let url;
	try {
		url = new URL(value);
	} catch {
		throw dataError("package_url_invalid", "Package URL is invalid");
	}
	if (url.protocol !== "https:" && !(url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost"))) throw dataError("package_url_insecure", "External packages require HTTPS or localhost HTTP");
	return url.href;
}
/** @param {string} url */
function pathFromUrl(url) {
	try {
		return new URL(url, "https://aerobeat.invalid/").pathname.split("/").filter(Boolean).at(-1) || "background.asset";
	} catch {
		return "background.asset";
	}
}
/** @param {unknown} cause */
function publicError(cause) {
	return Object.freeze({
		code: diagnosticString(cause, "code") ?? "content_load_failed",
		message: diagnosticString(cause, "message") ?? "Content load failed"
	});
}
//#endregion
//#region ../aerobeat-web-content/src/index.js
/** @type {"aero.content.library"} */
var aeroContentServiceId = serviceIds.contentLibrary;
Object.freeze({
	schema: "aero.content.runtime.descriptor",
	version: 1,
	serviceId: aeroContentServiceId,
	implementationState: "implemented"
});
//#endregion
//#region ../aerobeat-web-content-authoring/src/canonical.js
/**
* Deterministically serialize JSON-compatible data with lexically sorted object keys.
* Undefined, functions, symbols, accessors, cycles and non-finite numbers are rejected.
*
* @param {unknown} value
* @returns {string}
*/
function canonicalJson(value) {
	return serialize(value, /* @__PURE__ */ new Set());
}
/**
* @param {unknown} value
* @param {Set<object>} seen
* @returns {string}
*/
function serialize(value, seen) {
	if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new TypeError("Canonical JSON rejects non-finite numbers");
		return JSON.stringify(Object.is(value, -0) ? 0 : value);
	}
	if (Array.isArray(value)) {
		if (Object.getPrototypeOf(value) !== Array.prototype) throw new TypeError("Canonical JSON accepts ordinary arrays only");
		if (seen.has(value)) throw new TypeError("Canonical JSON rejects cycles");
		if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || key !== "length" && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw new TypeError("Canonical JSON rejects extended arrays");
		seen.add(value);
		const parts = [];
		for (let index = 0; index < value.length; index += 1) {
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
			if (!descriptor?.enumerable || !("value" in descriptor) || descriptor.value === void 0) throw new TypeError("Canonical JSON rejects sparse arrays, accessors and undefined values");
			parts.push(serialize(descriptor.value, seen));
		}
		seen.delete(value);
		return `[${parts.join(",")}]`;
	}
	if (!isPlainRecord$1(value)) throw new TypeError("Canonical JSON accepts plain data records only");
	if (seen.has(value)) throw new TypeError("Canonical JSON rejects cycles");
	seen.add(value);
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== "string")) throw new TypeError("Canonical JSON rejects symbol keys");
	const stringKeys = keys;
	stringKeys.sort();
	const parts = [];
	for (const key of stringKeys) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor?.enumerable || !("value" in descriptor) || descriptor.value === void 0) throw new TypeError("Canonical JSON rejects accessors and undefined values");
		parts.push(`${JSON.stringify(key)}:${serialize(descriptor.value, seen)}`);
	}
	seen.delete(value);
	return `{${parts.join(",")}}`;
}
/**
* @param {unknown} value
* @returns {value is Record<string, unknown>}
*/
function isPlainRecord$1(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
/**
* @param {string | Uint8Array} value
* @returns {Promise<string>}
*/
async function sha256Hex(value) {
	const bytes = typeof value === "string" ? new TextEncoder().encode(value) : Uint8Array.from(value);
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) throw new Error("SHA-256 is unavailable in this browser context");
	const digest = await subtle.digest("SHA-256", bytes.buffer);
	return [...new Uint8Array(digest)].map((entry) => entry.toString(16).padStart(2, "0")).join("");
}
/**
* @param {string | Uint8Array} value
* @returns {Promise<string>}
*/
async function prefixedSha256(value) {
	return `sha256:${await sha256Hex(value)}`;
}
/**
* @param {unknown} value
* @returns {unknown}
*/
function cloneData(value) {
	return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
/**
* @template T
* @param {T} value
* @returns {T}
*/
function deepFreeze$1(value) {
	if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
	if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const key of Reflect.ownKeys(value)) {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (descriptor && "value" in descriptor) deepFreeze$1(descriptor.value);
		}
	}
	return value;
}
//#endregion
//#region ../aerobeat-web-content-authoring/src/beatmap.js
/** @typedef {"v2" | "v3" | "v4"} BeatMapFormat */
/**
* Parse and narrow one Beat Saber Standard difficulty document.
*
* @param {Uint8Array | string} input
* @param {BeatMapFormat} format
* @returns {Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>}
*/
function parseBeatMapDifficulty(input, format) {
	const text = typeof input === "string" ? input : new TextDecoder("utf-8", { fatal: true }).decode(input);
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (cause) {
		throw new AuthoringParseError("difficulty_json_invalid", `Difficulty JSON could not be parsed${diagnostic$3(cause)}`);
	}
	if (!isPlainRecord$1(parsed)) throw new AuthoringParseError("difficulty_shape_invalid", "Difficulty root must be a plain record");
	if (format === "v4") return freezeSummary(normalizeV4(parsed));
	if (format === "v2") return freezeSummary(normalizeV2(parsed));
	return freezeSummary(normalizeV3(parsed));
}
/** @param {Record<string, unknown>} map */
function normalizeV2(map) {
	const notes = array(map._notes ?? map.notes);
	const colorNotes = [];
	const bombNotes = [];
	let colorIndex = 0;
	for (const entry of notes) {
		if (!isPlainRecord$1(entry)) continue;
		const type = integer(entry._type ?? entry.type, -1);
		const x = integer(entry._lineIndex ?? entry.lineIndex, 0);
		const y = integer(entry._lineLayer ?? entry.lineLayer, 0);
		if (type === 0 || type === 1) colorNotes.push(noteRecord(colorIndex++, number(entry._time ?? entry.b, 0), x, y, type, integer(entry._cutDirection ?? entry.cutDirection, 8), 0, false));
		else if (type === 3) bombNotes.push({
			start: number(entry._time ?? entry.b, 0),
			x,
			y,
			cell: cellFromXY(x, y)
		});
	}
	return {
		colorNotes,
		bombNotes,
		obstacles: array(map._obstacles ?? map.obstacles).flatMap((entry) => {
			if (!isPlainRecord$1(entry)) return [];
			const legacyType = integer(entry._type ?? entry.type, 0);
			return [{
				start: number(entry._time ?? entry.b, 0),
				duration: number(entry._duration ?? entry.d, 0),
				x: integer(entry._lineIndex ?? entry.x, 0),
				y: legacyType === 1 ? 2 : 0,
				width: Math.max(integer(entry._width ?? entry.w, 1), 1),
				height: legacyType === 1 ? 1 : 3
			}];
		}),
		sliders: array(map._sliders ?? map.sliders).flatMap((entry) => isPlainRecord$1(entry) ? [{
			start: number(entry._headTime ?? entry.b, 0),
			end: number(entry._tailTime ?? entry.tb ?? entry._headTime ?? entry.b, 0),
			cell: cellFromXY(integer(entry._headLineIndex ?? entry.x, 0), integer(entry._headLineLayer ?? entry.y, 0)),
			tailCell: cellFromXY(integer(entry._tailLineIndex ?? entry.tx, 0), integer(entry._tailLineLayer ?? entry.ty, 0)),
			hand: handFromColor(integer(entry._colorType ?? entry.c, 0)),
			direction: integer(entry._headCutDirection ?? entry.d, 8),
			tailDirection: integer(entry._tailCutDirection ?? entry.tc ?? entry._headCutDirection ?? entry.d, 8),
			headCurveMultiplier: number(entry._headControlPointLengthMultiplier ?? entry.mu, 1),
			tailCurveMultiplier: number(entry._tailControlPointLengthMultiplier ?? entry.tmu, 1),
			midAnchorMode: integer(entry._sliderMidAnchorMode ?? entry.m, 0)
		}] : []),
		burstSliders: []
	};
}
/** @param {Record<string, unknown>} map */
function normalizeV3(map) {
	return {
		colorNotes: array(map.colorNotes).flatMap((entry, sourceIndex) => {
			if (!isPlainRecord$1(entry)) return [];
			const x = integer(entry.x, 0);
			const y = integer(entry.y, 0);
			const color = integer(entry.c, 0);
			return [noteRecord(sourceIndex, number(entry.b, 0), x, y, color, integer(entry.d, 8), number(entry.a, 0), Object.hasOwn(entry, "a"))];
		}),
		bombNotes: array(map.bombNotes).flatMap((entry) => isPlainRecord$1(entry) ? [{
			start: number(entry.b, 0),
			x: integer(entry.x, 0),
			y: integer(entry.y, 0),
			cell: cellFromXY(integer(entry.x, 0), integer(entry.y, 0))
		}] : []),
		obstacles: array(map.obstacles).flatMap((entry) => isPlainRecord$1(entry) ? [{
			start: number(entry.b, 0),
			duration: number(entry.d, 0),
			x: integer(entry.x, 0),
			y: integer(entry.y, 0),
			width: integer(entry.w, 1),
			height: integer(entry.h, 1)
		}] : []),
		sliders: array(map.sliders).flatMap((entry) => isPlainRecord$1(entry) ? [{
			start: number(entry.b, 0),
			end: number(entry.tb ?? entry.b, 0),
			cell: cellFromXY(integer(entry.x, 0), integer(entry.y, 0)),
			tailCell: cellFromXY(integer(entry.tx, 0), integer(entry.ty, 0)),
			hand: handFromColor(integer(entry.c, 0)),
			direction: integer(entry.d, 8),
			tailDirection: integer(entry.tc ?? entry.d, 8),
			headCurveMultiplier: number(entry.mu, 1),
			tailCurveMultiplier: number(entry.tmu, 1),
			midAnchorMode: integer(entry.m, 0)
		}] : []),
		burstSliders: array(map.burstSliders).flatMap((entry) => {
			if (!isPlainRecord$1(entry)) return [];
			const result = {
				start: number(entry.b, 0),
				end: number(entry.tb ?? entry.b, 0),
				cell: cellFromXY(integer(entry.x, 0), integer(entry.y, 0)),
				tailCell: cellFromXY(integer(entry.tx, 0), integer(entry.ty, 0)),
				hand: handFromColor(integer(entry.c, 0)),
				direction: integer(entry.d, 8),
				sliceCount: Math.max(integer(entry.sc, 1), 1)
			};
			if (Object.hasOwn(entry, "s")) Object.assign(result, { spacingBias: number(entry.s, 0) });
			return [result];
		})
	};
}
/** @param {Record<string, unknown>} map */
function normalizeV4(map) {
	const noteData = records(map.colorNotesData);
	const colorNotes = array(map.colorNotes).flatMap((entry, sourceIndex) => {
		if (!isPlainRecord$1(entry)) return [];
		const metadata = metadataAt(noteData, integer(entry.i, -1));
		const x = intField(entry, metadata, "x", 0);
		const y = intField(entry, metadata, "y", 0);
		const color = intField(entry, metadata, "c", 0);
		return [noteRecord(sourceIndex, number(entry.b, 0), x, y, color, intField(entry, metadata, "d", 8), floatField(entry, metadata, "a", 0), Object.hasOwn(entry, "a") || Object.hasOwn(metadata, "a"))];
	});
	const bombData = records(map.bombNotesData);
	const bombNotes = array(map.bombNotes).flatMap((entry) => {
		if (!isPlainRecord$1(entry)) return [];
		const metadata = metadataAt(bombData, integer(entry.i, -1));
		const x = intField(entry, metadata, "x", 0);
		const y = intField(entry, metadata, "y", 0);
		return [{
			start: number(entry.b, 0),
			x,
			y,
			cell: cellFromXY(x, y)
		}];
	});
	const obstacleData = records(map.obstaclesData);
	const obstacles = array(map.obstacles).flatMap((entry) => {
		if (!isPlainRecord$1(entry)) return [];
		const metadata = metadataAt(obstacleData, integer(entry.i, -1));
		return [{
			start: number(entry.b, 0),
			duration: floatField(entry, metadata, "d", 0),
			x: intField(entry, metadata, "x", 0),
			y: intField(entry, metadata, "y", 0),
			width: intField(entry, metadata, "w", 1),
			height: intField(entry, metadata, "h", 1)
		}];
	});
	const arcData = records(map.arcsData);
	const sliders = array(map.arcs).flatMap((entry) => {
		if (!isPlainRecord$1(entry)) return [];
		const head = metadataAt(noteData, integer(entry.hi, -1));
		const tail = metadataAt(noteData, integer(entry.ti, -1));
		const metadata = metadataAt(arcData, integer(entry.ai, -1));
		return [{
			start: number(entry.hb, 0),
			end: number(entry.tb ?? entry.hb, 0),
			cell: cellFromXY(intField(head, {}, "x", 0), intField(head, {}, "y", 0)),
			tailCell: cellFromXY(intField(tail, {}, "x", 0), intField(tail, {}, "y", 0)),
			hand: handFromColor(intField(head, {}, "c", 0)),
			direction: intField(head, {}, "d", 8),
			tailDirection: intField(tail, {}, "d", 8),
			headCurveMultiplier: floatField(metadata, {}, "m", 1),
			tailCurveMultiplier: floatField(metadata, {}, "tm", 1),
			midAnchorMode: intField(metadata, {}, "a", 0)
		}];
	});
	const chainData = records(map.chainsData);
	return {
		colorNotes,
		bombNotes,
		obstacles,
		sliders,
		burstSliders: array(map.chains).flatMap((entry) => {
			if (!isPlainRecord$1(entry)) return [];
			const head = metadataAt(noteData, integer(entry.i, -1));
			const metadata = metadataAt(chainData, integer(entry.ci, -1));
			const result = {
				start: number(entry.hb, 0),
				end: number(entry.tb ?? entry.hb, 0),
				cell: cellFromXY(intField(head, {}, "x", 0), intField(head, {}, "y", 0)),
				tailCell: cellFromXY(intField(metadata, {}, "tx", 0), intField(metadata, {}, "ty", 0)),
				hand: handFromColor(intField(head, {}, "c", 0)),
				direction: intField(head, {}, "d", 8),
				sliceCount: Math.max(intField(metadata, {}, "c", 1), 1)
			};
			if (Object.hasOwn(metadata, "s")) Object.assign(result, { spacingBias: number(metadata.s, 0) });
			return [result];
		})
	};
}
/** @param {number} sourceIndex @param {number} start @param {number} x @param {number} y @param {number} color @param {number} direction @param {number} angleOffset @param {boolean} hasAngleOffset */
function noteRecord(sourceIndex, start, x, y, color, direction, angleOffset, hasAngleOffset) {
	return {
		sourceIndex,
		start,
		x,
		y,
		cell: cellFromXY(x, y),
		color,
		hand: handFromColor(color),
		direction,
		angleOffset,
		hasAngleOffset
	};
}
/** @param {number} x @param {number} y */
function cellFromXY(x, y) {
	return clampInt(y, 0, 2) * 4 + clampInt(x, 0, 3);
}
/** @param {number} color */
function handFromColor(color) {
	return color === 0 ? "left" : "right";
}
/** @param {unknown} value */
function array(value) {
	return Array.isArray(value) ? value : [];
}
/** @param {unknown} value */
function records(value) {
	return array(value).filter(isPlainRecord$1);
}
/** @param {Record<string, unknown>[]} recordsValue @param {number} index */
function metadataAt(recordsValue, index) {
	return index < 0 || index >= recordsValue.length ? {} : recordsValue[index];
}
/** @param {Record<string, unknown>} primary @param {Record<string, unknown>} fallback @param {string} key @param {number} defaultValue */
function intField(primary, fallback, key, defaultValue) {
	return integer(Object.hasOwn(primary, key) ? primary[key] : fallback[key], defaultValue);
}
/** @param {Record<string, unknown>} primary @param {Record<string, unknown>} fallback @param {string} key @param {number} defaultValue */
function floatField(primary, fallback, key, defaultValue) {
	return number(Object.hasOwn(primary, key) ? primary[key] : fallback[key], defaultValue);
}
/** @param {unknown} value @param {number} fallback */
function number(value, fallback) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
/** @param {unknown} value @param {number} fallback */
function integer(value, fallback) {
	return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}
/** @param {number} value @param {number} minimum @param {number} maximum */
function clampInt(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}
/** @param {Record<string, readonly Readonly<Record<string, unknown>>[]>} summary */
function freezeSummary(summary) {
	for (const values of Object.values(summary)) {
		for (const value of values) Object.freeze(value);
		Object.freeze(values);
	}
	return Object.freeze(summary);
}
/** @param {unknown} cause */
function diagnostic$3(cause) {
	return cause instanceof Error && cause.message ? `: ${cause.message}` : "";
}
var AuthoringParseError = class extends Error {
	/** @param {string} code @param {string} message */
	constructor(code, message) {
		super(message);
		this.name = "AuthoringParseError";
		this.code = code;
	}
};
//#endregion
//#region ../aerobeat-web-content-authoring/src/converter-profile.js
var converterProfileClass = "converter_regeneration";
deepFreeze$1({
	schema: "aerobeat/prototype_profile",
	version: 1,
	profileId: "aero.converter.canonical",
	profileVersion: "1.0.0",
	class: converterProfileClass,
	label: "Canonical Converter (Experimental)",
	experimental: true,
	settings: {
		guardRelocationRadius: 1,
		reachAllowanceSubcells: 0
	},
	contentHash: "a43b53a39c13c9e9efe59854aee0fa16efdcd3c6a29bc09f678d94b3fd8f0202"
});
deepFreeze$1({
	schema: "aerobeat/prototype_profile",
	version: 1,
	profileId: "aero.converter.prototype-reach",
	profileVersion: "1.0.0",
	class: converterProfileClass,
	label: "Prototype Reach Converter (Experimental)",
	experimental: true,
	settings: {
		guardRelocationRadius: 2,
		reachAllowanceSubcells: 1
	},
	contentHash: "e37f8b527ed5ce86738ce22007fc963f83bccd737893fb4728d3b83eaa044eea"
});
/**
* Normalize and cryptographically verify one exact experimental converter profile.
* The label is display-only; identity hashes exact schema/version/id/version/class/settings.
*
* @param {unknown} value
*/
async function normalizeConverterProfile(value) {
	if (!exactKeys(value, [
		"schema",
		"version",
		"profileId",
		"profileVersion",
		"class",
		"label",
		"experimental",
		"settings",
		"contentHash"
	])) throw profileError("converter_profile_invalid", "Converter profile must contain the exact bounded profile fields");
	const record = value;
	if (record.schema !== "aerobeat/prototype_profile" || record.version !== 1 || record.class !== "converter_regeneration" || record.experimental !== true) throw profileError("converter_profile_invalid", "Converter profile schema, version, class and experimental truth are required");
	const profileId = boundedString$2(record.profileId, "profileId", 128);
	const profileVersion = boundedString$2(record.profileVersion, "profileVersion", 64);
	const label = boundedString$2(record.label, "label", 256);
	if (!exactKeys(record.settings, ["guardRelocationRadius", "reachAllowanceSubcells"])) throw profileError("converter_profile_settings_invalid", "Converter profile settings must contain the exact supported fields");
	const sourceSettings = record.settings;
	const hashBody = deepFreeze$1({
		schema: "aerobeat/prototype_profile",
		version: 1,
		profileId,
		profileVersion,
		class: converterProfileClass,
		settings: deepFreeze$1({
			guardRelocationRadius: boundedInteger$1(sourceSettings.guardRelocationRadius, "guardRelocationRadius", 0, 8),
			reachAllowanceSubcells: boundedInteger$1(sourceSettings.reachAllowanceSubcells, "reachAllowanceSubcells", 0, 8)
		})
	});
	const contentHash = await sha256Hex(canonicalJson(hashBody));
	if (record.contentHash !== contentHash) throw profileError("converter_profile_hash_mismatch", "Converter profile content hash does not match its canonical identity and settings");
	return deepFreeze$1({
		...hashBody,
		label,
		experimental: true,
		contentHash
	});
}
/** @param {unknown} value @param {readonly string[]} keys */
function exactKeys(value, keys) {
	if (!isPlainRecord$1(value) || Reflect.ownKeys(value).length !== keys.length) return false;
	return keys.every((key) => {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		return descriptor && "value" in descriptor && descriptor.enumerable && descriptor.value !== void 0;
	});
}
/** @param {unknown} value @param {string} field @param {number} maximum */
function boundedString$2(value, field, maximum) {
	if (typeof value !== "string" || !value || value.length > maximum) throw profileError("converter_profile_invalid", `${field} must be a bounded non-empty string`);
	return value;
}
/** @param {unknown} value @param {string} field @param {number} minimum @param {number} maximum */
function boundedInteger$1(value, field, minimum, maximum) {
	if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) throw profileError("converter_profile_settings_invalid", `${field} must be an integer from ${minimum} through ${maximum}`);
	return Number(value);
}
/** @param {string} code @param {string} message */
function profileError(code, message) {
	const error = new Error(message);
	error.name = "AeroConverterProfileError";
	Object.assign(error, { code });
	return error;
}
//#endregion
//#region ../aerobeat-web-content-authoring/src/definitions.js
var boxingPrototypeContractId = "aerobeat.boxing.prototype.v1";
var rowFamilyRecipeId = "row_family_balanced_height_v1";
var cutFamilyRecipeId = "cut_family_source_height_v1";
var semanticTrackRulesetId = "boxing_semantic_track_v1";
var spatialGridRulesetId = "boxing_spatial_grid_v1";
var recipeVersion = "1.0.0";
var rulesetVersion = "1.0.0";
var guardPairs = deepFreeze$1([
	[0, 1],
	[1, 2],
	[2, 3],
	[4, 5],
	[5, 6],
	[6, 7],
	[8, 9],
	[9, 10],
	[10, 11]
]);
var reachSubcellsPerBeat = deepFreeze$1({
	Easy: 3,
	Normal: 3.5,
	Hard: 4,
	Expert: 5,
	ExpertPlus: 6
});
var recipeDefinitions = deepFreeze$1([{
	contractId: boxingPrototypeContractId,
	recipeId: rowFamilyRecipeId,
	version: recipeVersion,
	label: "Row Family / Balanced Height",
	familyRule: {
		top: "uppercut",
		middle: "straight",
		bottom: "hook"
	},
	heightRule: "balance_generated_rows",
	punchMinSpacingMs: 360,
	guardTimingWindowMs: 180,
	obstacleTimingWindowMs: 180,
	freshnessMs: 150,
	straightQualificationMs: 100,
	reachSubcellsPerBeat,
	initialWristCells: {
		left: 5,
		right: 6
	}
}, {
	contractId: boxingPrototypeContractId,
	recipeId: cutFamilyRecipeId,
	version: recipeVersion,
	label: "Cut Family / Source Height",
	familyRule: {
		up: "uppercut",
		horizontal: "hook",
		other: "straight"
	},
	heightRule: "prefer_source_row_promote_bottom_uppercut",
	normalizeOutwardHooks: true,
	punchMinSpacingMs: 360,
	guardTimingWindowMs: 180,
	obstacleTimingWindowMs: 180,
	freshnessMs: 150,
	straightQualificationMs: 100,
	reachSubcellsPerBeat,
	initialWristCells: {
		left: 5,
		right: 6
	}
}]);
var rulesetDefinitions = deepFreeze$1([{
	contractId: boxingPrototypeContractId,
	rulesetId: semanticTrackRulesetId,
	version: rulesetVersion,
	timingWindowMs: 180,
	evidenceFreshnessMs: 150,
	straightQualificationMs: 100,
	hookAndUppercutQualification: "target-cell-and-cardinal-direction",
	semanticClassifiers: "authoritative"
}, {
	contractId: boxingPrototypeContractId,
	rulesetId: spatialGridRulesetId,
	version: rulesetVersion,
	timingWindowMs: 180,
	evidenceFreshnessMs: 150,
	straightQualificationMs: 100,
	hookAndUppercutQualification: "target-cell-and-cardinal-direction",
	semanticClassifiers: "shadow-only",
	subgrid: {
		columns: 8,
		rows: 6,
		cellOrder: "top-left-row-major"
	}
}]);
var supportedModifiers = deepFreeze$1([
	"no_squats",
	"no_weaves",
	"any_punch",
	"crossed_guard",
	"cross_body"
]);
//#endregion
//#region ../aerobeat-web-content-authoring/src/converter.js
/** @typedef {"Easy" | "Normal" | "Hard" | "Expert" | "ExpertPlus"} Difficulty */
/** @typedef {Record<string, unknown>} DataRecord */
/**
* Convert one normalized difficulty into Flow plus four Boxing charts.
*
* @param {Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>} sourceSummary
* @param {{difficulty: Difficulty, songToken: string, songName: string, bpm: number, sourceProvider: string, sourceId: string, sourceVersionHash: string, sourceDifficultyPath: string, sourceBeatmapVersion: string, sourceDifficultyHash?: string, audioPath?: string, audioContentHash?: string, modifiers?: readonly string[], presentationSuggestion?: Readonly<Record<string, unknown>>, converterProfile?: Readonly<Record<string, unknown>>}} options
* @param {(progress: number, phase: string) => void} [onProgress]
* @returns {Promise<Readonly<{package: DataRecord, packageHash: string, sourceHash: string, charts: DataRecord[], traces: DataRecord[], flowTrace: DataRecord}>>}
*/
async function convertDifficulty(sourceSummary, options, onProgress = () => void 0) {
	const bpm = positive$2(options.bpm, 120);
	const difficulty = normalizeDifficulty$2(options.difficulty);
	const songToken = sanitizeToken(options.songToken || options.sourceId || "imported");
	const modifiers = normalizeModifiers(options.modifiers ?? []);
	const converterProfile = options.converterProfile ? await normalizeConverterProfile(options.converterProfile) : null;
	const converterSettings = converterProfile ? {
		...converterProfile.settings,
		profileApplied: true
	} : {
		guardRelocationRadius: 0,
		reachAllowanceSubcells: 0,
		profileApplied: false
	};
	const sourceHash = await prefixedSha256(canonicalJson(sourceSummary));
	const sourceDifficultyHash = options.sourceDifficultyHash ?? await prefixedSha256(canonicalJson(sourceSummary));
	const charts = [];
	const traces = [];
	let matrixIndex = 0;
	for (const recipe of recipeDefinitions) {
		const generated = await generateEvents(sourceSummary, difficulty, bpm, recipe, modifiers, converterSettings);
		for (const rulesetId of [semanticTrackRulesetId, spatialGridRulesetId]) {
			const chart = await chartFor(generated, difficulty, songToken, recipe, rulesetId, sourceHash, modifiers, options.presentationSuggestion, converterProfile);
			charts.push(chart);
			traces.push({
				chartId: chart.chartId,
				difficulty,
				bpm,
				recipeId: recipe.recipeId,
				rulesetId,
				sourceHash,
				contentHash: chart.prototype.contentHash,
				sourceDifficultyPath: options.sourceDifficultyPath,
				sourceBeatmapVersion: options.sourceBeatmapVersion,
				sourceDifficultyHash,
				...converterProfile ? { converterProfile: cloneData(converterProfile) } : {},
				optimizer: cloneData(generated.optimizer),
				events: cloneData(generated.trace)
			});
			matrixIndex += 1;
			onProgress(.15 + matrixIndex * .15, "converting");
		}
	}
	const flow = convertFlowChart(sourceSummary, difficulty, songToken);
	charts.push(flow.chart);
	const packageId = `ab-songpkg-${songToken}-${sanitizeToken(options.sourceVersionHash).slice(0, 12)}-${difficulty.toLowerCase()}`;
	const songId = `ab-song-${songToken}`;
	const sets = charts.map((chart) => ({
		schemaId: "aerobeat.set.v1",
		schemaVersion: 1,
		recordVersion: 1,
		setId: `ab-set-${String(chart.chartId).replace(/^ab-chart-/u, "")}`,
		setName: `${titleize(songToken)} ${difficulty} ${titleize(String(chart.mode))}`,
		songId,
		chartId: chart.chartId
	}));
	const durationSec = estimateDuration(charts, bpm);
	const packageRecord = {
		schemaId: "aerobeat.song-package.v1",
		schemaVersion: 1,
		packageVersion: "1.0.0",
		packageId,
		songId,
		songName: options.songName || titleize(songToken),
		source: {
			provider: options.sourceProvider,
			sourceId: options.sourceId,
			sourceVersionHash: options.sourceVersionHash,
			difficulty,
			sourceDifficultyPath: options.sourceDifficultyPath,
			sourceHash,
			...converterProfile ? { converterProfile: cloneData(converterProfile) } : {}
		},
		song: {
			schemaId: "aerobeat.song.v1",
			schemaVersion: 1,
			recordVersion: 1,
			songId,
			songName: options.songName || titleize(songToken),
			durationSec,
			...options.audioPath && options.audioContentHash ? { audio: {
				filePath: options.audioPath,
				contentHash: options.audioContentHash
			} } : {},
			timing: {
				anchorMs: 0,
				tempoSegments: [{
					startBeat: 0,
					bpm
				}],
				stopSegments: [],
				timeSignatureSegments: [{
					startBeat: 0,
					numerator: 4,
					denominator: 4
				}]
			}
		},
		charts,
		sets,
		recipeDefinitions: cloneData(recipeDefinitions),
		rulesetDefinitions: cloneData(rulesetDefinitions),
		conversionTrace: {
			boxing: traces,
			flow: [flow.trace],
			...converterProfile ? { converterProfile: cloneData(converterProfile) } : {}
		},
		presentationSuggestion: options.presentationSuggestion ? cloneData(options.presentationSuggestion) : null
	};
	const packageHash = await prefixedSha256(canonicalJson(packageRecord));
	onProgress(.8, "validating");
	return deepFreeze$1({
		package: packageRecord,
		packageHash,
		sourceHash,
		charts,
		traces,
		flowTrace: flow.trace
	});
}
/** @param {DataRecord} generated @param {Difficulty} difficulty @param {string} songToken @param {DataRecord} recipe @param {string} rulesetId @param {string} sourceHash @param {readonly string[]} modifiers @param {Readonly<Record<string, unknown>> | undefined} suggestion @param {Readonly<Record<string, unknown>> | null} converterProfile */
async function chartFor(generated, difficulty, songToken, recipe, rulesetId, sourceHash, modifiers, suggestion, converterProfile) {
	const recipeId = String(recipe.recipeId);
	const recipeShort = recipeId === "row_family_balanced_height_v1" ? "row-family" : "cut-family";
	const rulesetShort = rulesetId === "boxing_semantic_track_v1" ? "semantic-track" : "spatial-grid";
	const beats = cloneData(generated.beats);
	const recipeHash = await prefixedSha256(canonicalJson(recipe));
	const rulesetHash = await prefixedSha256(canonicalJson(rulesetDefinitions.find((candidate) => candidate.rulesetId === rulesetId) ?? rulesetDefinitions[0]));
	const contentHash = await prefixedSha256(canonicalJson({
		beats,
		recipeId,
		rulesetId,
		sourceHash,
		...converterProfile ? { converterProfile } : {}
	}));
	const allModifiers = [...modifiers];
	for (const beat of beats) if (typeof beat.modifier === "string" && !allModifiers.includes(beat.modifier)) allModifiers.push(beat.modifier);
	allModifiers.sort();
	const chart = {
		schemaId: "aerobeat.chart.boxing.v1",
		schemaVersion: 1,
		recordVersion: 1,
		chartId: `ab-chart-${songToken}-boxing-${difficulty.toLowerCase()}-${rulesetShort}-${recipeShort}`,
		chartName: `${titleize(songToken)} ${difficulty} Boxing - ${titleize(rulesetShort)} / ${titleize(recipeShort)}`,
		mode: "boxing",
		difficulty,
		prototype: {
			contractId: boxingPrototypeContractId,
			recipeId,
			recipeVersion,
			rulesetId,
			rulesetVersion,
			sourceHash,
			recipeHash,
			rulesetHash,
			contentHash,
			modifiers: allModifiers,
			...converterProfile ? { converterProfile: cloneData(converterProfile) } : {},
			regenerationRequiredFor: [
				"punchMinSpacingMs",
				"reachSubcellsPerBeat",
				"familyBalance",
				"guardRelocation"
			]
		},
		beats
	};
	if (suggestion) Object.assign(chart, { presentationSuggestion: cloneData(suggestion) });
	return chart;
}
/** @param {Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>} sourceSummary @param {Difficulty} difficulty @param {number} bpm @param {DataRecord} recipe @param {readonly string[]} modifiers @param {{guardRelocationRadius:number,reachAllowanceSubcells:number,profileApplied:boolean}} converterSettings */
async function generateEvents(sourceSummary, difficulty, bpm, recipe, modifiers, converterSettings) {
	const trace = [];
	const obstacleWindows = obstaclesFor(sourceSummary.obstacles ?? [], bpm);
	const groups = noteGroups(sourceSummary.colorNotes ?? []);
	const candidates = [];
	const rowCounts = [
		0,
		0,
		0
	];
	for (const [start, rawGroup] of groups) {
		const group = collapseSameHand(rawGroup);
		const sourceEventIds = sourceIds(rawGroup, "note");
		const retainedIds = sourceIds(group, "note");
		for (const sourceId of sourceEventIds) if (!retainedIds.includes(sourceId)) trace.push({
			sourceEventIds: [sourceId],
			start,
			action: "drop",
			reason: "same_hand_simultaneous_stable_tiebreak"
		});
		if (hasBothHands(group)) {
			candidates.push({
				kind: "guard",
				start,
				notes: group,
				sourceEventIds,
				stableId: sourceEventIds.join("+")
			});
			continue;
		}
		if (!group.length) continue;
		const note = group[0];
		const family = familyFor(note, String(recipe.recipeId));
		const targetRow = targetRowFor(note, family, String(recipe.recipeId), rowCounts);
		rowCounts[targetRow] += 1;
		candidates.push({
			kind: "punch",
			start,
			note,
			family,
			targetRow,
			sourceEventIds,
			stableId: sourceEventIds.join("+")
		});
	}
	candidates.sort(candidateOrder);
	const optimizer = selectSpacingOptimizedPunches(candidates, bpm, obstacleWindows, difficulty, converterSettings);
	const beats = [];
	let lastPunchMs = -1e9;
	let previousHand = "";
	const wristSubcell = {
		left: seedSubcell(5),
		right: seedSubcell(6)
	};
	const wristBeat = {
		left: 0,
		right: 0
	};
	const familyCounts = {
		straight: 0,
		hook: 0,
		uppercut: 0
	};
	for (const candidate of candidates) {
		const start = Number(candidate.start);
		const startMs = beatToMs(start, bpm);
		if (candidate.kind === "guard") {
			const emitted = await emitGuard(candidate, obstacleWindows, wristSubcell, wristBeat, difficulty, bpm, String(recipe.recipeId), converterSettings);
			trace.push(emitted.trace);
			if (emitted.ok && emitted.beat) {
				beats.push(emitted.beat);
				const target = emitted.beat.guardTarget;
				wristSubcell.left = seedSubcell(Number(target.leftCell));
				wristSubcell.right = seedSubcell(Number(target.rightCell));
				wristBeat.left = start;
				wristBeat.right = start;
			}
			continue;
		}
		if (!optimizer.selected.has(String(candidate.stableId))) {
			trace.push(dropTrace(candidate, optimizer.infeasible.get(String(candidate.stableId)) ?? "spacing_optimizer_rejected", { priorityOrder: optimizerPriority }));
			continue;
		}
		const note = candidate.note;
		const hand = String(note.hand);
		const family = String(candidate.family);
		const spatial = spatialTarget(family, hand, Number(candidate.targetRow));
		const blocked = blockedSubcellsAt(startMs, obstacleWindows);
		const safe = spatial.acceptedSubcells.filter((subcell) => !blocked.has(subcell));
		if (!safe.length) {
			trace.push(dropTrace(candidate, "spatial_target_blocked"));
			continue;
		}
		spatial.acceptedSubcells = safe;
		const deltaBeats = Math.max(start - wristBeat[hand], 0);
		const target = safe.find((subcell) => reachable(wristSubcell[hand], subcell, deltaBeats, reachSubcellsPerBeat[difficulty] + converterSettings.reachAllowanceSubcells, blocked));
		if (target === void 0) {
			trace.push(dropTrace(candidate, "unreachable_after_optimizer"));
			continue;
		}
		if (startMs - lastPunchMs < 360) {
			trace.push(dropTrace(candidate, "punch_min_spacing", {
				previousHand,
				spacingMs: startMs - lastPunchMs
			}));
			continue;
		}
		const type = `${family}_${hand}`;
		const generatedEventId = await eventId(String(recipe.recipeId), String(candidate.stableId), type);
		const beat = {
			start,
			type,
			eventId: generatedEventId,
			sourceEventIds: cloneData(candidate.sourceEventIds),
			spatialTarget: spatial,
			timingWindowMs: 180,
			evidenceFreshnessMs: 150
		};
		if (modifiers.includes("any_punch")) Object.assign(beat, { modifier: "any_punch" });
		else if (modifiers.includes("cross_body")) Object.assign(beat, { modifier: "cross_body" });
		beats.push(beat);
		lastPunchMs = startMs;
		previousHand = hand;
		familyCounts[family] += 1;
		wristSubcell[hand] = target;
		wristBeat[hand] = start;
		trace.push({
			sourceEventIds: beat.sourceEventIds,
			eventId: generatedEventId,
			start,
			action: "emit",
			kind: "punch",
			family,
			hand,
			sourceDirection: Number(note.direction ?? 8),
			generatedDirection: spatial.entryDirection ?? "semantic_straight",
			target: cloneData(spatial)
		});
	}
	for (const window of obstacleWindows) {
		const blockedCells = [...window.blockedCells];
		const type = obstacleType(blockedCells);
		const sourceId = `obstacle-${String(window.sourceIndex).padStart(3, "0")}`;
		if (type === "squat" && modifiers.includes("no_squats") || type.startsWith("weave_") && modifiers.includes("no_weaves")) {
			trace.push({
				sourceEventIds: [sourceId],
				start: window.startBeat,
				action: "drop",
				reason: "disabled_by_modifier",
				type
			});
			continue;
		}
		const safeCells = Array.from({ length: 12 }, (_, index) => index).filter((cell) => !blockedCells.includes(cell));
		const emitted = {
			start: window.startBeat,
			type,
			eventId: await eventId(String(recipe.recipeId), sourceId, type),
			sourceEventIds: [sourceId],
			checkpoint: {
				kind: "instantaneous",
				freshnessMs: 150,
				timingWindowMs: 180,
				noseSafeCells: safeCells
			},
			blockedCells
		};
		beats.push(emitted);
		trace.push({
			sourceEventIds: [sourceId],
			start: window.startBeat,
			action: "emit",
			kind: "obstacle_checkpoint",
			type,
			blockedCells,
			noseSafeCells: safeCells
		});
	}
	beats.sort((left, right) => Number(left.start) - Number(right.start) || String(left.eventId).localeCompare(String(right.eventId)));
	return {
		beats,
		trace,
		familyCounts,
		optimizer: {
			priorityOrder: optimizerPriority,
			punchMinSpacingMs: 360,
			...converterSettings.profileApplied ? {
				guardRelocationRadius: converterSettings.guardRelocationRadius,
				reachAllowanceSubcells: converterSettings.reachAllowanceSubcells
			} : {},
			selectedStableIds: [...optimizer.selected.keys()]
		}
	};
}
var optimizerPriority = [
	"retained_punches",
	"hand_alternation",
	"family_balance",
	"source_order",
	"stable_event_id"
];
/** @param {DataRecord[]} candidates @param {number} bpm @param {ObstacleWindow[]} obstacles @param {Difficulty} difficulty @param {{guardRelocationRadius:number,reachAllowanceSubcells:number,profileApplied:boolean}} converterSettings */
function selectSpacingOptimizedPunches(candidates, bpm, obstacles, difficulty, converterSettings) {
	const punches = [];
	const infeasible = /* @__PURE__ */ new Map();
	const guardTimesMs = candidates.filter((candidate) => candidate.kind === "guard").map((candidate) => beatToMs(Number(candidate.start), bpm));
	for (const candidate of candidates) {
		if (candidate.kind !== "punch") continue;
		const punchMs = beatToMs(Number(candidate.start), bpm);
		const reason = guardTimesMs.some((guardMs) => Math.abs(punchMs - guardMs) <= 180.0001) ? "guard_window_reserved_before_optimizer" : staticInfeasibility(candidate, bpm, obstacles, difficulty, converterSettings);
		if (reason) infeasible.set(String(candidate.stableId), reason);
		else punches.push(candidate);
	}
	punches.sort(candidateOrder);
	const best = [[]];
	for (let index = 0; index < punches.length; index += 1) {
		const candidate = punches[index];
		let compatible = -1;
		const candidateMs = beatToMs(Number(candidate.start), bpm);
		for (let prior = index - 1; prior >= 0; prior -= 1) if (candidateMs - beatToMs(Number(punches[prior].start), bpm) >= 360) {
			compatible = prior;
			break;
		}
		const take = [...best[compatible + 1], candidate];
		const skip = [...best[index]];
		best.push(sequenceBetter(take, skip) ? take : skip);
	}
	return {
		selected: new Map(best.at(-1).map((candidate) => [String(candidate.stableId), true])),
		infeasible
	};
}
/** @param {DataRecord} candidate @param {number} bpm @param {ObstacleWindow[]} obstacles @param {Difficulty} difficulty @param {{guardRelocationRadius:number,reachAllowanceSubcells:number,profileApplied:boolean}} converterSettings */
function staticInfeasibility(candidate, bpm, obstacles, difficulty, converterSettings) {
	const note = candidate.note;
	const hand = String(note.hand);
	const spatial = spatialTarget(String(candidate.family), hand, Number(candidate.targetRow));
	const blocked = blockedSubcellsAt(beatToMs(Number(candidate.start), bpm), obstacles);
	let safe = false;
	let reach = false;
	const seed = hand === "left" ? 5 : 6;
	for (const subcell of spatial.acceptedSubcells) {
		if (blocked.has(subcell)) continue;
		safe = true;
		if (reachable(seedSubcell(seed), subcell, Number(candidate.start), reachSubcellsPerBeat[difficulty] + converterSettings.reachAllowanceSubcells, blocked)) {
			reach = true;
			break;
		}
	}
	return !safe ? "spatial_target_blocked_before_optimizer" : !reach ? "unreachable_before_optimizer" : "";
}
/** @param {DataRecord[]} left @param {DataRecord[]} right */
function sequenceBetter(left, right) {
	if (left.length !== right.length) return left.length > right.length;
	const alternations = (sequence) => sequence.slice(1).reduce((count, candidate, index) => count + (String(
		/** @type {DataRecord} */
		candidate.note.hand
	) !== String(
		/** @type {DataRecord} */
		sequence[index].note.hand
	) ? 1 : 0), 0);
	const imbalance = (sequence) => {
		const counts = {
			straight: 0,
			hook: 0,
			uppercut: 0
		};
		for (const candidate of sequence) counts[String(candidate.family)] += 1;
		return Math.max(...Object.values(counts)) - Math.min(...Object.values(counts));
	};
	if (alternations(left) !== alternations(right)) return alternations(left) > alternations(right);
	if (imbalance(left) !== imbalance(right)) return imbalance(left) < imbalance(right);
	for (let index = 0; index < left.length; index += 1) {
		if (Number(left[index].start) !== Number(right[index].start)) return Number(left[index].start) < Number(right[index].start);
		if (String(left[index].stableId) !== String(right[index].stableId)) return String(left[index].stableId) < String(right[index].stableId);
	}
	return false;
}
/** @typedef {{startBeat:number,endBeat:number,startMs:number,endMs:number,blockedCells:number[],sourceIndex:number}} ObstacleWindow */
/** @param {readonly Readonly<Record<string, unknown>>[]} obstacles @param {number} bpm @returns {ObstacleWindow[]} */
function obstaclesFor(obstacles, bpm) {
	return obstacles.map((entry, index) => {
		const start = Number(entry.start ?? 0);
		const duration = Math.max(Number(entry.duration ?? 0), 0);
		return {
			startBeat: start,
			endBeat: start + duration,
			startMs: beatToMs(start, bpm) - 180,
			endMs: beatToMs(start + duration, bpm) + 180,
			blockedCells: cellsForObstacle(entry),
			sourceIndex: Number(entry.sourceIndex ?? index)
		};
	});
}
/** @param {Readonly<Record<string, unknown>>} obstacle */
function cellsForObstacle(obstacle) {
	const x = clamp(Number(obstacle.x ?? 0), 0, 3);
	const width = clamp(Number(obstacle.width ?? 1), 1, 4 - x);
	const y = clamp(Number(obstacle.y ?? 0), 0, 2);
	const height = clamp(Number(obstacle.height ?? 3), 1, 3 - y);
	const cells = [];
	for (let sourceRow = y; sourceRow < y + height; sourceRow += 1) for (let column = x; column < x + width; column += 1) cells.push((2 - sourceRow) * 4 + column);
	return cells.sort((a, b) => a - b);
}
/** @param {Readonly<Record<string, unknown>>} obstacle */
function sourceCellsForObstacle(obstacle) {
	const x = clamp(Number(obstacle.x ?? 0), 0, 3);
	const width = clamp(Number(obstacle.width ?? 1), 1, 4 - x);
	const y = clamp(Number(obstacle.y ?? 0), 0, 2);
	const height = clamp(Number(obstacle.height ?? 3), 1, 3 - y);
	const cells = [];
	for (let row = y; row < y + height; row += 1) for (let column = x; column < x + width; column += 1) cells.push(row * 4 + column);
	return cells.sort((a, b) => a - b);
}
/** @param {number} timeMs @param {ObstacleWindow[]} windows */
function blockedSubcellsAt(timeMs, windows) {
	const blocked = /* @__PURE__ */ new Set();
	for (const window of windows) if (timeMs >= window.startMs && timeMs <= window.endMs) for (const cell of window.blockedCells) for (const subcell of acceptedSubcells(cell, "cell", "left")) blocked.add(subcell);
	return blocked;
}
/** @param {number[]} cells */
function obstacleType(cells) {
	let left = 0;
	let right = 0;
	for (const cell of cells) cell % 4 <= 1 ? left += 1 : right += 1;
	return left > right ? "weave_right" : right > left ? "weave_left" : "squat";
}
/** @param {DataRecord} candidate @param {ObstacleWindow[]} obstacles @param {{left:number,right:number}} wristSubcell @param {{left:number,right:number}} wristBeat @param {Difficulty} difficulty @param {number} bpm @param {string} recipeIdValue @param {{guardRelocationRadius:number,reachAllowanceSubcells:number,profileApplied:boolean}} converterSettings */
async function emitGuard(candidate, obstacles, wristSubcell, wristBeat, difficulty, bpm, recipeIdValue, converterSettings) {
	const notes = candidate.notes;
	const left = noteForHand(notes, "left");
	const right = noteForHand(notes, "right");
	const crossed = Number(left.cell) % 4 > Number(right.cell) % 4;
	const sourcePair = [topLeftCell(Number(left.cell)), topLeftCell(Number(right.cell))];
	const start = Number(candidate.start);
	const pair = chooseGuardPair(sourcePair, crossed, blockedSubcellsAt(beatToMs(start, bpm), obstacles), start, wristSubcell, wristBeat, difficulty, converterSettings);
	if (!pair.length) return {
		ok: false,
		trace: dropTrace(candidate, "guard_no_legal_pair")
	};
	const leftCell = crossed ? pair[1] : pair[0];
	const rightCell = crossed ? pair[0] : pair[1];
	const sourceEventIds = cloneData(candidate.sourceEventIds);
	const id = await eventId(recipeIdValue, String(candidate.stableId), "guard");
	const beat = {
		start,
		type: "guard",
		eventId: id,
		sourceEventIds,
		guardTarget: {
			leftCell,
			rightCell,
			crossed,
			sourcePair
		},
		checkpoint: {
			kind: "instantaneous",
			freshnessMs: 150,
			timingWindowMs: 180
		},
		timingWindowMs: 180,
		evidenceFreshnessMs: 150
	};
	if (crossed) Object.assign(beat, { modifier: "crossed_guard" });
	return {
		ok: true,
		beat,
		trace: {
			sourceEventIds,
			eventId: id,
			start,
			action: "emit",
			kind: "guard",
			sourcePair,
			generatedPair: pair,
			crossed
		}
	};
}
/** @param {number[]} sourcePair @param {boolean} crossed @param {Set<number>} blocked @param {number} start @param {{left:number,right:number}} wristSubcell @param {{left:number,right:number}} wristBeat @param {Difficulty} difficulty @param {{guardRelocationRadius:number,reachAllowanceSubcells:number,profileApplied:boolean}} converterSettings */
function chooseGuardPair(sourcePair, crossed, blocked, start, wristSubcell, wristBeat, difficulty, converterSettings) {
	const sourceSorted = [...sourcePair].sort((a, b) => a - b);
	const candidates = [];
	for (const pair of guardPairs) {
		const generatedLeftCell = crossed ? pair[1] : pair[0], generatedRightCell = crossed ? pair[0] : pair[1];
		if (converterSettings.profileApplied && Math.max(subcellManhattan(seedSubcell(sourcePair[0]), seedSubcell(generatedLeftCell)), subcellManhattan(seedSubcell(sourcePair[1]), seedSubcell(generatedRightCell))) > converterSettings.guardRelocationRadius) continue;
		const subcells = [seedSubcell(pair[0]), seedSubcell(pair[1])];
		if (blocked.has(subcells[0]) || blocked.has(subcells[1])) continue;
		const leftTarget = crossed ? subcells[1] : subcells[0];
		const rightTarget = crossed ? subcells[0] : subcells[1];
		const rate = reachSubcellsPerBeat[difficulty] + converterSettings.reachAllowanceSubcells;
		if (!reachable(wristSubcell.left, leftTarget, Math.max(start - wristBeat.left, 0), rate, blocked) || !reachable(wristSubcell.right, rightTarget, Math.max(start - wristBeat.right, 0), rate, blocked)) continue;
		const sourceRow = Math.floor(sourceSorted[0] / 4) === Math.floor(sourceSorted[1] / 4) ? Math.floor(sourceSorted[0] / 4) : 1;
		const pairRow = Math.floor(pair[0] / 4);
		const sourceMid = (sourceSorted[0] + sourceSorted[1]) / 2;
		const pairMid = (pair[0] + pair[1]) / 2;
		candidates.push({
			pair: [...pair],
			row: Math.abs(pairRow - sourceRow),
			mid: Math.abs(pairMid - sourceMid),
			center: Math.abs(pairMid - 5.5),
			id: pair[0]
		});
	}
	candidates.sort((a, b) => a.row - b.row || a.mid - b.mid || a.center - b.center || a.id - b.id);
	return candidates[0]?.pair ?? [];
}
/** @param {string} family @param {string} hand @param {number} row */
function spatialTarget(family, hand, row) {
	let column = hand === "left" ? 1 : 2;
	let targetRow = clamp(row, 0, 2);
	let direction = "";
	let sourceCell = -1;
	if (family === "hook") {
		column = hand === "left" ? 2 : 1;
		direction = hand === "left" ? "right" : "left";
		sourceCell = targetRow * 4 + (hand === "left" ? 1 : 2);
	} else if (family === "uppercut") {
		targetRow = Math.min(targetRow, 1);
		direction = "up";
		sourceCell = (targetRow + 1) * 4 + column;
	}
	const targetCell = targetRow * 4 + column;
	const result = {
		targetCell,
		acceptedSubcells: acceptedSubcells(targetCell, family, hand),
		sourceCell
	};
	if (direction) Object.assign(result, { entryDirection: direction });
	if (family === "straight") Object.assign(result, {
		qualificationMs: 100,
		semanticQualification: "straight"
	});
	return result;
}
/** @param {number} cell @param {string} family @param {string} hand */
function acceptedSubcells(cell, family, hand) {
	const row = Math.floor(cell / 4), column = cell % 4, result = [];
	for (const subRow of [row * 2, row * 2 + 1]) {
		result.push(subRow * 8 + column * 2, subRow * 8 + column * 2 + 1);
		if (family === "straight") {
			const margin = hand === "left" ? column * 2 + 2 : column * 2 - 1;
			if (margin >= 0 && margin < 8) result.push(subRow * 8 + margin);
		}
	}
	return result.sort((a, b) => a - b);
}
/** @param {number} start @param {number} target @param {number} deltaBeats @param {number} rate @param {Set<number>} blocked */
function reachable(start, target, deltaBeats, rate, blocked) {
	if (target < 0 || target >= 48 || blocked.has(target)) return false;
	const distances = Array(48).fill(Infinity), visited = /* @__PURE__ */ new Set();
	distances[clamp(start, 0, 47)] = 0;
	for (let step = 0; step < 48; step += 1) {
		let current = -1, currentDistance = Infinity;
		for (let candidate = 0; candidate < 48; candidate += 1) if (!visited.has(candidate) && distances[candidate] < currentDistance) {
			current = candidate;
			currentDistance = distances[candidate];
		}
		if (current < 0 || current === target) break;
		visited.add(current);
		const x = current % 8, y = Math.floor(current / 8);
		for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
			if (!dx && !dy) continue;
			const nx = x + dx, ny = y + dy;
			if (nx < 0 || nx >= 8 || ny < 0 || ny >= 6) continue;
			const next = ny * 8 + nx;
			if (blocked.has(next)) continue;
			distances[next] = Math.min(distances[next], currentDistance + (dx && dy ? Math.SQRT2 : 1));
		}
	}
	return distances[target] <= Math.max(deltaBeats * rate, 0) + 1e-4;
}
/** @param {Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>} summary @param {Difficulty} difficulty @param {string} songToken */
function convertFlowChart(summary, difficulty, songToken) {
	const beats = [];
	const events = [];
	const lookup = buildFlowNoteLookup(summary.colorNotes ?? []);
	for (const note of summary.colorNotes ?? []) {
		const emitted = emitFlowNote(note);
		beats.push(emitted);
		events.push({
			start: Number(note.start ?? 0),
			sourceFamily: "note",
			result: {
				action: "emit",
				beat: cloneData(emitted),
				noteRef: flowNoteRef(note)
			},
			note: cloneData(note)
		});
	}
	for (const bomb of summary.bombNotes ?? []) {
		const emitted = {
			start: Number(bomb.start ?? 0),
			type: "bomb",
			placement: Number(bomb.cell ?? 0)
		};
		beats.push(emitted);
		events.push({
			start: emitted.start,
			sourceFamily: "bomb",
			result: {
				action: "emit",
				beat: cloneData(emitted)
			},
			bomb: cloneData(bomb)
		});
	}
	for (const obstacle of summary.obstacles ?? []) {
		const emitted = {
			start: Number(obstacle.start ?? 0),
			end: Number(obstacle.start ?? 0) + Number(obstacle.duration ?? 0),
			type: "obstacle",
			cells: sourceCellsForObstacle(obstacle)
		};
		beats.push(emitted);
		events.push({
			start: emitted.start,
			sourceFamily: "obstacle",
			result: {
				action: "emit",
				beat: cloneData(emitted)
			},
			obstacle: cloneData(obstacle)
		});
	}
	for (const slider of summary.sliders ?? []) {
		const emitted = emitFlowArc(slider, lookup);
		beats.push(emitted);
		events.push({
			start: Number(slider.start ?? 0),
			sourceFamily: "slider",
			result: {
				action: "emit",
				beat: cloneData(emitted)
			},
			slider: cloneData(slider)
		});
	}
	for (const burst of summary.burstSliders ?? []) {
		const emitted = {
			start: Number(burst.start ?? 0),
			end: Number(burst.end ?? burst.start ?? 0),
			type: "burst",
			hand: String(burst.hand ?? "left"),
			placement: Number(burst.cell ?? 0),
			direction: Number(burst.direction ?? 8),
			tailPlacement: Number(burst.tailCell ?? burst.cell ?? 0),
			checkpointCount: Math.max(Number(burst.sliceCount ?? 1), 1)
		};
		if (Object.hasOwn(burst, "spacingBias")) Object.assign(emitted, { spacingBias: Number(burst.spacingBias) });
		beats.push(emitted);
		events.push({
			start: emitted.start,
			sourceFamily: "burstSlider",
			result: {
				action: "emit",
				beat: cloneData(emitted)
			},
			source: cloneData(burst)
		});
	}
	const order = {
		note: 0,
		bomb: 1,
		obstacle: 2,
		arc: 3,
		burst: 4
	};
	beats.sort((a, b) => Number(a.start) - Number(b.start) || (order[a.type] ?? 99) - (order[b.type] ?? 99) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
	return {
		chart: {
			schemaId: "aerobeat.chart.flow.v1",
			schemaVersion: 1,
			recordVersion: 1,
			chartId: `ab-chart-${songToken}-flow-${difficulty.toLowerCase()}`,
			chartName: `${titleize(songToken)} ${difficulty} Flow`,
			mode: "flow",
			difficulty,
			beats
		},
		trace: {
			difficulty,
			events
		}
	};
}
/** @param {Readonly<Record<string, unknown>>} note */
function emitFlowNote(note) {
	const direction = Number(note.direction ?? 8);
	const beat = {
		start: Number(note.start ?? 0),
		type: "note",
		hand: String(note.hand ?? "left"),
		placement: Number(note.cell ?? 0),
		requiresDirection: direction !== 8,
		angleOffset: Number(note.angleOffset ?? 0)
	};
	if (direction !== 8) Object.assign(beat, { direction });
	return beat;
}
/** @param {Readonly<Record<string, unknown>>} slider @param {Map<string,string>} lookup */
function emitFlowArc(slider, lookup) {
	const arc = {
		start: Number(slider.start ?? 0),
		end: Number(slider.end ?? slider.start ?? 0),
		type: "arc",
		hand: String(slider.hand ?? "left"),
		startPlacement: Number(slider.cell ?? 0),
		endPlacement: Number(slider.tailCell ?? slider.cell ?? 0),
		startDirection: Number(slider.direction ?? 8),
		endDirection: Number(slider.tailDirection ?? slider.direction ?? 8),
		headCurveMultiplier: Number(slider.headCurveMultiplier ?? 1),
		tailCurveMultiplier: Number(slider.tailCurveMultiplier ?? 1),
		midAnchorMode: Number(slider.midAnchorMode ?? 0)
	};
	const start = lookup.get(flowNoteKey(arc.start, arc.hand, arc.startPlacement));
	const end = lookup.get(flowNoteKey(arc.end, arc.hand, arc.endPlacement));
	if (start) Object.assign(arc, { startNoteRef: start });
	if (end) Object.assign(arc, { endNoteRef: end });
	return arc;
}
/** @param {readonly Readonly<Record<string, unknown>>[]} notes */
function buildFlowNoteLookup(notes) {
	const result = /* @__PURE__ */ new Map();
	for (const note of notes) {
		const key = flowNoteKey(Number(note.start ?? 0), String(note.hand ?? "left"), Number(note.cell ?? 0));
		if (!result.has(key)) result.set(key, flowNoteRef(note));
	}
	return result;
}
/** @param {number} start @param {string} hand @param {number} cell */
function flowNoteKey(start, hand, cell) {
	return `${hand}|${start.toFixed(3)}|${cell}`;
}
/** @param {Readonly<Record<string, unknown>>} note */
function flowNoteRef(note) {
	return `flow-note-${String(Number(note.sourceIndex ?? 0)).padStart(3, "0")}-${String(note.hand ?? "left")}-${Number(note.cell ?? 0)}-${Number(note.start ?? 0).toFixed(3)}`;
}
/** @param {readonly Readonly<Record<string, unknown>>[]} notes @returns {[number, DataRecord[]][]} */
function noteGroups(notes) {
	/** @type {Map<number, DataRecord[]>} */ const result = /* @__PURE__ */ new Map();
	for (const value of notes) {
		const start = Math.round(Number(value.start ?? 0) * 1e3) / 1e3;
		if (!result.has(start)) result.set(start, []);
		result.get(start).push(cloneData(value));
	}
	return [...result.entries()].sort((a, b) => a[0] - b[0]);
}
/** @param {DataRecord[]} notes @returns {DataRecord[]} */
function collapseSameHand(notes) {
	/** @type {DataRecord[]} */ const result = [];
	for (const hand of ["left", "right"]) {
		const entries = notes.filter((note) => String(note.hand) === hand).sort((a, b) => Number(a.cell) - Number(b.cell) || Number(a.sourceIndex) - Number(b.sourceIndex));
		if (entries[0]) result.push(cloneData(entries[0]));
	}
	return result;
}
/** @param {DataRecord[]} notes @param {string} prefix */
function sourceIds(notes, prefix) {
	return notes.map((note) => `${prefix}-${String(Number(note.sourceIndex ?? 0)).padStart(3, "0")}`).sort();
}
/** @param {DataRecord[]} notes */
function hasBothHands(notes) {
	return notes.some((note) => note.hand === "left") && notes.some((note) => note.hand === "right");
}
/** @param {DataRecord[]} notes @param {string} hand */
function noteForHand(notes, hand) {
	return notes.find((note) => note.hand === hand) ?? {};
}
/** @param {DataRecord} note @param {string} recipeIdValue */
function familyFor(note, recipeIdValue) {
	if (recipeIdValue === "row_family_balanced_height_v1") {
		const row = topLeftRow(Number(note.cell));
		return row === 0 ? "uppercut" : row === 1 ? "straight" : "hook";
	}
	const direction = Number(note.direction ?? 8);
	return direction === 0 ? "uppercut" : direction === 2 || direction === 3 ? "hook" : "straight";
}
/** @param {DataRecord} note @param {string} family @param {string} recipeIdValue @param {number[]} counts */
function targetRowFor(note, family, recipeIdValue, counts) {
	const source = topLeftRow(Number(note.cell));
	if (recipeIdValue === "cut_family_source_height_v1") return family === "uppercut" && source === 2 ? 1 : source;
	return (family === "uppercut" ? [0, 1] : [
		0,
		1,
		2
	]).sort((a, b) => counts[a] - counts[b] || a - b)[0];
}
/** @param {DataRecord} left @param {DataRecord} right */
function candidateOrder(left, right) {
	return Number(left.start) - Number(right.start) || String(left.stableId).localeCompare(String(right.stableId));
}
/** @param {DataRecord} candidate @param {string} reason @param {DataRecord} [extra] */
function dropTrace(candidate, reason, extra = {}) {
	return {
		sourceEventIds: cloneData(candidate.sourceEventIds),
		start: Number(candidate.start),
		action: "drop",
		reason,
		...extra
	};
}
/** @param {string} recipeIdValue @param {string} sourceId @param {string} kind */
async function eventId(recipeIdValue, sourceId, kind) {
	const digest = await prefixedSha256(`${recipeIdValue}|${sourceId}|${kind}`);
	return `boxing-${kind.replaceAll("_", "-")}-${digest.slice(7, 19)}`;
}
/** @param {number} cell */
function topLeftRow(cell) {
	return 2 - clamp(Math.floor(cell / 4), 0, 2);
}
/** @param {number} cell */
function topLeftCell(cell) {
	return topLeftRow(cell) * 4 + clamp(cell % 4, 0, 3);
}
/** @param {number} cell */
function seedSubcell(cell) {
	const row = clamp(Math.floor(cell / 4), 0, 2), column = clamp(cell % 4, 0, 3);
	return (row * 2 + 1) * 8 + column * 2 + 1;
}
/** @param {number} left @param {number} right */
function subcellManhattan(left, right) {
	return Math.abs(Math.floor(left / 8) - Math.floor(right / 8)) + Math.abs(left % 8 - right % 8);
}
/** @param {number} beat @param {number} bpm */
function beatToMs(beat, bpm) {
	return beat * 6e4 / Math.max(bpm, 1);
}
/** @param {number} value @param {number} minimum @param {number} maximum */
function clamp(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}
/** @param {number} value @param {number} fallback */
function positive$2(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}
/** @param {unknown} value @returns {Difficulty} */
function normalizeDifficulty$2(value) {
	const result = {
		easy: "Easy",
		normal: "Normal",
		hard: "Hard",
		expert: "Expert",
		expertplus: "ExpertPlus"
	}[String(value).toLowerCase().replace(/[^a-z]/gu, "")];
	if (!result) throw new Error("Unsupported difficulty");
	return result;
}
/** @param {readonly string[]} values */
function normalizeModifiers(values) {
	const result = [...new Set(values.filter((value) => supportedModifiers.includes(value)))];
	result.sort();
	return result;
}
/** @param {string} value */
function sanitizeToken(value) {
	return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "imported";
}
/** @param {string} value */
function titleize(value) {
	return value.replaceAll("_", "-").split("-").filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}
/** @param {DataRecord[]} charts @param {number} bpm */
function estimateDuration(charts, bpm) {
	let maxBeat = 0;
	for (const chart of charts) for (const beat of chart.beats ?? []) maxBeat = Math.max(maxBeat, Number(beat.end ?? beat.start ?? 0));
	return Math.ceil(maxBeat * 60 / Math.max(bpm, 1));
}
//#endregion
//#region ../aerobeat-web-content-authoring/src/export.js
var magic = new TextEncoder().encode("AEROPKG1");
var maximumMetadataBytes = 16777216;
var maximumAssetBytes = 134217728;
var maximumTotalAssetBytes = 536870912;
var maximumAssets = 2048;
/**
* Deterministically export one validated record.
*
* @param {{package: Record<string, unknown>, packageHash: string, assets: readonly {path: string, bytes: Uint8Array}[]}} record
*/
async function exportAuthoredPackage(record) {
	if (!hasExactKeys(record, [
		"package",
		"packageHash",
		"assets"
	])) throw exportError("export_record_invalid", "Authored package record is invalid");
	const packageValue = dataValue$1(record, "package");
	const packageHash = dataValue$1(record, "packageHash");
	const assetValues = denseArray(dataValue$1(record, "assets"), maximumAssets, "export_assets_exceeded");
	if (!isPlainRecord$1(packageValue) || !validHash$2(packageHash)) throw exportError("export_record_invalid", "Authored package record is invalid");
	let canonicalPackage;
	try {
		canonicalPackage = canonicalJson(packageValue);
	} catch (cause) {
		throw exportError("export_record_invalid", diagnostic$2("Authored package must contain plain canonical data", cause));
	}
	if (await prefixedSha256(canonicalPackage) !== packageHash) throw exportError("export_package_hash_mismatch", "Authored package hash does not match package data");
	const seen = /* @__PURE__ */ new Set();
	const assets = [];
	for (const value of assetValues) {
		if (!hasExactKeys(value, ["path", "bytes"])) throw exportError("export_asset_invalid", "Authored package asset is invalid");
		const rawPath = dataValue$1(value, "path");
		const rawBytes = dataValue$1(value, "bytes");
		if (typeof rawPath !== "string" || !(rawBytes instanceof Uint8Array)) throw exportError("export_asset_invalid", "Authored package asset is invalid");
		const path = normalizePath$1(rawPath);
		if (seen.has(path)) throw exportError("export_asset_duplicate", "Authored package asset paths collide after normalization");
		seen.add(path);
		if (rawBytes.byteLength > maximumAssetBytes) throw exportError("export_asset_too_large", "Authored package asset exceeds the byte limit");
		assets.push({
			path,
			bytes: Uint8Array.from(rawBytes)
		});
	}
	assets.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
	let offset = 0;
	const table = [];
	for (const asset of assets) {
		if (!Number.isSafeInteger(offset + asset.bytes.byteLength) || offset + asset.bytes.byteLength > maximumTotalAssetBytes) throw exportError("export_size_exceeded", "Authored package assets exceed the total byte limit");
		table.push({
			path: asset.path,
			offset,
			byteLength: asset.bytes.byteLength,
			sha256: await sha256Hex(asset.bytes)
		});
		offset += asset.bytes.byteLength;
	}
	const metadata = new TextEncoder().encode(canonicalJson({
		schema: "aerobeat/authored_package_export",
		version: 1,
		packageHash,
		package: packageValue,
		assets: table
	}));
	if (metadata.byteLength <= 0 || metadata.byteLength > maximumMetadataBytes) throw exportError("export_metadata_too_large", "Authored package metadata exceeds the byte limit");
	const total = magic.byteLength + 4 + metadata.byteLength + offset;
	if (!Number.isSafeInteger(total) || total > 553648140) throw exportError("export_size_exceeded", "Authored package export exceeds the byte limit");
	const output = new Uint8Array(total);
	output.set(magic, 0);
	new DataView(output.buffer).setUint32(magic.byteLength, metadata.byteLength, true);
	output.set(metadata, magic.byteLength + 4);
	let cursor = magic.byteLength + 4 + metadata.byteLength;
	for (const asset of assets) {
		output.set(asset.bytes, cursor);
		cursor += asset.bytes.byteLength;
	}
	const packageIdValue = dataValue$1(packageValue, "packageId");
	const packageId = safeFileToken(typeof packageIdValue === "string" ? packageIdValue : "aerobeat-package");
	return Object.freeze({
		fileName: `${packageId}.aeropkg`,
		mediaType: "application/vnd.aerobeat.package",
		byteLength: output.byteLength,
		bytes: output
	});
}
/** @param {unknown} value @param {readonly string[]} keys */
function hasExactKeys(value, keys) {
	if (!isPlainRecord$1(value) || Reflect.ownKeys(value).length !== keys.length) return false;
	return keys.every((key) => {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		return descriptor && "value" in descriptor && descriptor.enumerable;
	});
}
/** @param {Record<string, unknown>} value @param {string} key */
function dataValue$1(value, key) {
	const descriptor = Object.getOwnPropertyDescriptor(value, key);
	return descriptor && "value" in descriptor ? descriptor.value : void 0;
}
/** @param {unknown} value @param {number} maximum @param {string} code */
function denseArray(value, maximum, code) {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) throw exportError(code, "Authored package array is invalid or exceeds its entry limit");
	if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || key !== "length" && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw exportError(code, "Authored package array contains unsupported fields");
	const result = [];
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || descriptor.value === void 0) throw exportError(code, "Authored package array must contain dense data properties");
		result.push(descriptor.value);
	}
	return result;
}
/** @param {string} value */
function normalizePath$1(value) {
	if (/^[\\/]|^[a-z]:/iu.test(value) || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw exportError("export_path_invalid", "Authored asset path is unsafe");
	const parts = value.replaceAll("\\", "/").normalize("NFC").split("/");
	if (parts.some((part) => !part || part === "." || part === "..")) throw exportError("export_path_invalid", "Authored asset path is unsafe");
	return parts.join("/").toLowerCase();
}
/** @param {unknown} value */
function validHash$2(value) {
	return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}
/** @param {string} value */
function safeFileToken(value) {
	return value.normalize("NFC").replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^[-.]+|[-.]+$/gu, "") || "aerobeat-package";
}
/** @param {string} message @param {unknown} cause */
function diagnostic$2(message, cause) {
	if (cause && typeof cause === "object") {
		const descriptor = Object.getOwnPropertyDescriptor(cause, "message");
		if (descriptor && "value" in descriptor && typeof descriptor.value === "string" && descriptor.value) return `${message}: ${descriptor.value.slice(0, 4096)}`;
	}
	return message;
}
/** @param {string} code @param {string} message */
function exportError(code, message) {
	const error = new Error(message);
	error.name = "AeroAuthoringExportError";
	Object.assign(error, { code });
	return error;
}
//#endregion
//#region ../aerobeat-web-content-authoring/src/parity.js
/**
* Cross-language semantic projection. Language-specific canonical hashes are excluded;
* definitions, timing, lineage, ordering, targets, checkpoints, modifiers and traces are not.
*
* @param {unknown} packageValue
*/
function semanticParityProjection(packageValue) {
	if (!isPlainRecord$1(packageValue)) throw new TypeError("Package is required for semantic parity");
	canonicalJson(packageValue);
	if (!Array.isArray(packageValue.charts)) throw new TypeError("Package charts are required for semantic parity");
	return {
		packageSchema: packageValue.schemaId,
		packageSchemaVersion: packageValue.schemaVersion,
		packageVersion: packageValue.packageVersion,
		packageId: packageValue.packageId,
		songId: packageValue.songId,
		source: isPlainRecord$1(packageValue.source) ? pick(packageValue.source, [
			"provider",
			"sourceId",
			"sourceVersionHash",
			"difficulty",
			"sourceDifficultyPath",
			"converterProfile"
		]) : null,
		song: isPlainRecord$1(packageValue.song) ? pick(packageValue.song, [
			"schemaId",
			"schemaVersion",
			"recordVersion",
			"songId",
			"songName",
			"durationSec",
			"audio",
			"timing"
		]) : null,
		sets: Array.isArray(packageValue.sets) ? packageValue.sets.map((set) => isPlainRecord$1(set) ? pick(set, [
			"schemaId",
			"schemaVersion",
			"recordVersion",
			"setId",
			"setName",
			"songId",
			"chartId"
		]) : null) : [],
		recipeDefinitions: Array.isArray(packageValue.recipeDefinitions) ? packageValue.recipeDefinitions.map(projectDefinition) : [],
		rulesetDefinitions: Array.isArray(packageValue.rulesetDefinitions) ? packageValue.rulesetDefinitions.map(projectDefinition) : [],
		presentationSuggestion: Object.hasOwn(packageValue, "presentationSuggestion") ? packageValue.presentationSuggestion : null,
		charts: packageValue.charts.map((chart) => {
			if (!isPlainRecord$1(chart)) return null;
			const prototype = isPlainRecord$1(chart.prototype) ? chart.prototype : null;
			return {
				schemaId: chart.schemaId,
				schemaVersion: chart.schemaVersion,
				recordVersion: chart.recordVersion,
				chartId: chart.chartId,
				chartName: chart.chartName,
				mode: chart.mode,
				difficulty: chart.difficulty,
				prototype: prototype ? pick(prototype, [
					"contractId",
					"recipeId",
					"recipeVersion",
					"rulesetId",
					"rulesetVersion",
					"modifiers",
					"converterProfile",
					"regenerationRequiredFor"
				]) : null,
				presentationSuggestion: Object.hasOwn(chart, "presentationSuggestion") ? chart.presentationSuggestion : null,
				beats: Array.isArray(chart.beats) ? chart.beats.map(projectBeat) : []
			};
		}),
		traces: projectTraces(packageValue.conversionTrace)
	};
}
/** @param {unknown} value */
function projectDefinition(value) {
	if (!isPlainRecord$1(value)) return null;
	const result = {};
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== "string" || /hash/iu.test(key)) continue;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor && "value" in descriptor && descriptor.enumerable) result[key] = descriptor.value;
	}
	return result;
}
/** @param {unknown} value */
function projectTraces(value) {
	if (!isPlainRecord$1(value)) return null;
	return {
		boxing: Array.isArray(value.boxing) ? value.boxing.map((trace) => isPlainRecord$1(trace) ? {
			...pick(trace, [
				"chartId",
				"difficulty",
				"bpm",
				"recipeId",
				"rulesetId",
				"sourceDifficultyPath",
				"sourceBeatmapVersion",
				"converterProfile"
			]),
			optimizer: trace.optimizer,
			events: trace.events
		} : null) : [],
		flow: Array.isArray(value.flow) ? value.flow : null,
		...value.converterProfile ? { converterProfile: value.converterProfile } : {}
	};
}
/** @param {Record<string, unknown>} value @param {readonly string[]} keys */
function pick(value, keys) {
	const result = {};
	for (const key of keys) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor && "value" in descriptor && descriptor.enumerable) result[key] = descriptor.value;
	}
	return result;
}
/** @param {unknown} beat */
function projectBeat(beat) {
	if (!isPlainRecord$1(beat)) return null;
	return pick(beat, [
		"start",
		"end",
		"type",
		"eventId",
		"sourceEventIds",
		"hand",
		"placement",
		"direction",
		"angleOffset",
		"requiresDirection",
		"cells",
		"startPlacement",
		"endPlacement",
		"startDirection",
		"endDirection",
		"tailPlacement",
		"checkpointCount",
		"modifier",
		"spatialTarget",
		"guardTarget",
		"checkpoint",
		"blockedCells"
	]);
}
/** @param {unknown} packageValue */
async function semanticParityHash(packageValue) {
	return prefixedSha256(canonicalJson(semanticParityProjection(packageValue)));
}
var authoringPersistenceNamespace = "aerobeat.authored-packages.v2";
/** @typedef {{key: string, package: Record<string, unknown>, packageHash: string, assets: readonly {path: string, bytes: Uint8Array}[], sourceCache: readonly {path: string, bytes: Uint8Array}[], createdAtMs: number, schemaVersion: number, writeToken: string, assetRefs?: readonly {path: string, contentHash: string}[]}} StoredPackageRecord */
/** @typedef {{contentHash: string, bytes: Uint8Array, byteLength: number}} SharedAssetRecord */
/** @typedef {{collectionId: string, songName: string, sourceProvider: string, sourceId: string, sourceVersionHash: string, converterProfileId: string, converterProfileHash: string, modifierIds: readonly string[], packageKeys: readonly string[], packages: readonly {packageKey: string, packageId: string, difficultyId: string, difficultyLabel: string}[], createdAtMs: number, schemaVersion: number, writeToken: string}} StoredCollectionRecord */
/**
* Deterministic in-memory persistence adapter for tests/unsupported browsers.
*
* @param {{quotaBytes?: number}} [options]
*/
function createMemoryPersistenceAdapter(options = {}) {
	const records = /* @__PURE__ */ new Map();
	const sharedAssets = /* @__PURE__ */ new Map();
	const collections = /* @__PURE__ */ new Map();
	const quotaBytes = options.quotaBytes ?? 536870912;
	let destroyed = false;
	return Object.freeze({
		kind: "memory",
		schemaVersion: 3,
		/** @param {StoredPackageRecord} record */
		async put(record) {
			assertOpen();
			const copy = copyRecord(record);
			const staged = new Map(records);
			staged.set(copy.key, copy);
			assertQuota(staged, sharedAssets, collections);
			records.set(copy.key, copy);
		},
		/** @param {string} key */
		async get(key) {
			assertOpen();
			const value = records.get(key);
			return value ? resolveRecordAssets(value, sharedAssets) : null;
		},
		async list() {
			assertOpen();
			return [...records.values()].sort((a, b) => a.key.localeCompare(b.key)).map(summaryFor);
		},
		/** @param {unknown} batch @param {{signal?: AbortSignal}} [batchOptions] */
		async putCollection(batch, batchOptions = {}) {
			assertOpen();
			assertNotAborted(batchOptions.signal);
			const copy = copyCollectionBatch(batch);
			const stagedRecords = new Map(records), stagedAssets = new Map(sharedAssets), stagedCollections = new Map(collections);
			for (const asset of copy.assets) stagedAssets.set(asset.contentHash, asset);
			for (const record of copy.packages) stagedRecords.set(record.key, record);
			stagedCollections.set(copy.collection.collectionId, copy.collection);
			assertNotAborted(batchOptions.signal);
			assertQuota(stagedRecords, stagedAssets, stagedCollections);
			replaceMap(records, stagedRecords);
			replaceMap(sharedAssets, stagedAssets);
			replaceMap(collections, stagedCollections);
			return collectionSummary(copy.collection);
		},
		async listCollections() {
			assertOpen();
			return collectionSummaries(records, collections);
		},
		/** @param {string} collectionId */
		async getCollection(collectionId) {
			assertOpen();
			const stored = collections.get(collectionId);
			if (stored) return copyCollection(stored);
			return legacyCollectionForId(records, collectionId);
		},
		/** @param {string} collectionId */
		async deleteCollection(collectionId) {
			assertOpen();
			const stored = collections.get(collectionId);
			if (!stored) {
				const legacy = legacyCollectionForId(records, collectionId);
				if (!legacy) return false;
				records.delete(legacy.packageKeys[0]);
				collectUnusedAssets(records, sharedAssets);
				return true;
			}
			for (const key of stored.packageKeys) records.delete(key);
			collections.delete(collectionId);
			collectUnusedAssets(records, sharedAssets);
			return true;
		},
		/** @param {string} key */
		async delete(key) {
			assertOpen();
			const deleted = records.delete(key);
			if (deleted) {
				removePackageFromCollections(collections, key);
				collectUnusedAssets(records, sharedAssets);
			}
			return deleted;
		},
		/** @param {string} key @param {string} writeToken */
		async deleteIfToken(key, writeToken) {
			assertOpen();
			const current = records.get(key);
			if (!current || current.writeToken !== writeToken) return false;
			records.delete(key);
			removePackageFromCollections(collections, key);
			collectUnusedAssets(records, sharedAssets);
			return true;
		},
		async estimate() {
			assertOpen();
			const usageBytes = totalUsage(records, sharedAssets, collections);
			return deepFreeze$1({
				usageBytes,
				quotaBytes,
				availableBytes: Math.max(quotaBytes - usageBytes, 0),
				persistent: false,
				schemaVersion: 3
			});
		},
		async migrate() {
			assertOpen();
			return deepFreeze$1({
				fromVersion: 3,
				toVersion: 3,
				migratedRecords: 0
			});
		},
		destroy() {
			destroyed = true;
			records.clear();
			sharedAssets.clear();
			collections.clear();
		},
		assertOpen
	});
	function assertOpen() {
		if (destroyed) throw storageError("storage_destroyed", "Persistence adapter is destroyed");
	}
	function assertQuota(nextRecords, nextAssets, nextCollections) {
		if (totalUsage(nextRecords, nextAssets, nextCollections) > quotaBytes) throw storageError("quota_exceeded", "Authored collection exceeds local quota");
	}
}
/**
* Browser IndexedDB persistence with schema migration and quota diagnostics.
*
* @param {{indexedDB?: IDBFactory, databaseName?: string, storageManager?: Pick<StorageManager, "estimate">}} [options]
*/
function createIndexedDbPersistenceAdapter(options = {}) {
	const factory = options.indexedDB ?? globalThis.indexedDB;
	if (!factory) throw storageError("indexeddb_unavailable", "IndexedDB is unavailable");
	const databaseName = options.databaseName ?? "aerobeat-web-content-authoring";
	let closed = false;
	/** @type {Promise<IDBDatabase> | null} */
	let databasePromise = null;
	const open = () => {
		if (closed) return Promise.reject(storageError("storage_destroyed", "Persistence adapter is destroyed"));
		if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
			const request = factory.open(databaseName, 3);
			request.onupgradeneeded = (event) => {
				const database = request.result;
				if (!database.objectStoreNames.contains("packages")) database.createObjectStore("packages", { keyPath: "key" });
				if (!database.objectStoreNames.contains("assets")) database.createObjectStore("assets", { keyPath: "contentHash" });
				if (!database.objectStoreNames.contains("collections")) database.createObjectStore("collections", { keyPath: "collectionId" });
				if (!database.objectStoreNames.contains("meta")) database.createObjectStore("meta", { keyPath: "key" });
				if (request.transaction) {
					request.transaction.objectStore("meta").put({
						key: "schema",
						version: 3
					});
					if (event.oldVersion > 0 && event.oldVersion < 2) {
						const cursorRequest = request.transaction.objectStore("packages").openCursor();
						cursorRequest.onsuccess = () => {
							const cursor = cursorRequest.result;
							if (!cursor) return;
							const value = cursor.value;
							cursor.update({
								...value,
								sourceCache: Array.isArray(value.sourceCache) ? value.sourceCache : [],
								writeToken: typeof value.writeToken === "string" ? value.writeToken : "",
								schemaVersion: 3
							});
							cursor.continue();
						};
					}
				}
			};
			request.onerror = () => reject(storageError("indexeddb_open_failed", request.error?.message ?? "IndexedDB could not open"));
			request.onblocked = () => reject(storageError("indexeddb_blocked", "IndexedDB migration is blocked by another page"));
			request.onsuccess = () => {
				request.result.onversionchange = () => request.result.close();
				resolve(request.result);
			};
		});
		return databasePromise;
	};
	return Object.freeze({
		kind: "indexeddb",
		schemaVersion: 3,
		/** @param {StoredPackageRecord} record */
		async put(record) {
			await transaction(await open(), "packages", "readwrite", (store) => store.put(copyRecord(record)));
		},
		/** @param {string} key */
		async get(key) {
			return getIndexedDbPackage(await open(), key);
		},
		async list() {
			return (await transaction(await open(), "packages", "readonly", (store) => store.getAll())).map((value) => summaryFor(copyRecord(value))).sort((a, b) => a.key.localeCompare(b.key));
		},
		/** @param {unknown} batch @param {{signal?: AbortSignal}} [batchOptions] */
		async putCollection(batch, batchOptions = {}) {
			const copy = copyCollectionBatch(batch);
			assertNotAborted(batchOptions.signal);
			await putIndexedDbCollection(await open(), copy, batchOptions.signal);
			return collectionSummary(copy.collection);
		},
		async listCollections() {
			return listIndexedDbCollections(await open());
		},
		/** @param {string} collectionId */
		async getCollection(collectionId) {
			return getIndexedDbCollection(await open(), collectionId);
		},
		/** @param {string} collectionId */
		async deleteCollection(collectionId) {
			return deleteIndexedDbCollection(await open(), collectionId);
		},
		/** @param {string} key */
		async delete(key) {
			return deleteExisting(await open(), key);
		},
		/** @param {string} key @param {string} writeToken */
		async deleteIfToken(key, writeToken) {
			return conditionalDelete(await open(), key, writeToken);
		},
		async estimate() {
			const estimate = await (options.storageManager ?? globalThis.navigator?.storage)?.estimate?.() ?? {};
			return deepFreeze$1({
				usageBytes: finite(estimate.usage),
				quotaBytes: finite(estimate.quota),
				availableBytes: Math.max(finite(estimate.quota) - finite(estimate.usage), 0),
				persistent: true,
				schemaVersion: 3
			});
		},
		async migrate() {
			await open();
			return deepFreeze$1({
				fromVersion: 3,
				toVersion: 3,
				migratedRecords: 0
			});
		},
		destroy() {
			closed = true;
			databasePromise?.then((database) => database.close()).catch(() => void 0);
			databasePromise = null;
		}
	});
}
/** @param {IDBDatabase} database @param {string} key */
function getIndexedDbPackage(database, key) {
	return new Promise((resolve, reject) => {
		const tx = database.transaction(["packages", "assets"], "readonly"), request = tx.objectStore("packages").get(key);
		let result = null;
		request.onsuccess = () => {
			if (!request.result) return;
			const record = copyRecord(request.result);
			if (!record.assetRefs?.length) {
				result = record;
				return;
			}
			const resolved = /* @__PURE__ */ new Map();
			for (const ref of record.assetRefs) {
				const assetRequest = tx.objectStore("assets").get(ref.contentHash);
				assetRequest.onsuccess = () => {
					if (assetRequest.result) resolved.set(ref.contentHash, copySharedAssetRecord(assetRequest.result));
				};
			}
			tx.oncomplete = () => {
				try {
					result = resolveRecordAssets(record, resolved);
					resolve(result);
				} catch (error) {
					reject(error);
				}
			};
		};
		request.onerror = () => reject(idbStorageError(request.error, "indexeddb_request_failed", "IndexedDB package lookup failed"));
		tx.oncomplete = () => resolve(result);
		tx.onerror = () => reject(idbStorageError(tx.error, "indexeddb_transaction_failed", "IndexedDB package transaction failed"));
		tx.onabort = () => reject(idbStorageError(tx.error, "indexeddb_transaction_aborted", "IndexedDB package transaction aborted"));
	});
}
/** @param {IDBDatabase} database @param {{collection:StoredCollectionRecord,packages:StoredPackageRecord[],assets:SharedAssetRecord[]}} batch @param {AbortSignal | undefined} signal */
function putIndexedDbCollection(database, batch, signal) {
	return new Promise((resolve, reject) => {
		const tx = database.transaction([
			"assets",
			"packages",
			"collections"
		], "readwrite"), abort = () => tx.abort();
		signal?.addEventListener("abort", abort, { once: true });
		for (const asset of batch.assets) tx.objectStore("assets").put(asset);
		for (const record of batch.packages) tx.objectStore("packages").put(record);
		tx.objectStore("collections").put(batch.collection);
		tx.oncomplete = () => {
			signal?.removeEventListener("abort", abort);
			resolve(void 0);
		};
		tx.onerror = () => {
			signal?.removeEventListener("abort", abort);
			reject(idbStorageError(tx.error, "indexeddb_transaction_failed", "IndexedDB collection transaction failed"));
		};
		tx.onabort = () => {
			signal?.removeEventListener("abort", abort);
			reject(signal?.aborted ? storageError("operation_aborted", "Persistence operation was cancelled") : idbStorageError(tx.error, "indexeddb_transaction_aborted", "IndexedDB collection transaction aborted"));
		};
	});
}
/** @param {IDBDatabase} database */
function listIndexedDbCollections(database) {
	return new Promise((resolve, reject) => {
		const tx = database.transaction(["packages", "collections"], "readonly"), packageRequest = tx.objectStore("packages").getAll(), collectionRequest = tx.objectStore("collections").getAll();
		let records = [], stored = [];
		packageRequest.onsuccess = () => {
			records = packageRequest.result.map((value) => copyRecord(value));
		};
		collectionRequest.onsuccess = () => {
			stored = collectionRequest.result.map((value) => copyCollection(value));
		};
		tx.oncomplete = () => resolve(collectionSummaries(new Map(records.map((record) => [record.key, record])), new Map(stored.map((collection) => [collection.collectionId, collection]))));
		tx.onerror = () => reject(idbStorageError(tx.error, "indexeddb_transaction_failed", "IndexedDB collection list failed"));
		tx.onabort = () => reject(idbStorageError(tx.error, "indexeddb_transaction_aborted", "IndexedDB collection list aborted"));
	});
}
/** @param {IDBDatabase} database @param {string} collectionId */
function getIndexedDbCollection(database, collectionId) {
	return new Promise((resolve, reject) => {
		const tx = database.transaction(["packages", "collections"], "readonly"), collectionRequest = tx.objectStore("collections").get(collectionId);
		let result = null;
		collectionRequest.onsuccess = () => {
			if (collectionRequest.result) {
				result = copyCollection(collectionRequest.result);
				return;
			}
			if (!collectionId.startsWith("legacy:")) return;
			const packageRequest = tx.objectStore("packages").get(collectionId.slice(7));
			packageRequest.onsuccess = () => {
				if (packageRequest.result) result = legacyCollection(copyRecord(packageRequest.result));
			};
		};
		tx.oncomplete = () => resolve(result);
		tx.onerror = () => reject(idbStorageError(tx.error, "indexeddb_transaction_failed", "IndexedDB collection lookup failed"));
		tx.onabort = () => reject(idbStorageError(tx.error, "indexeddb_transaction_aborted", "IndexedDB collection lookup aborted"));
	});
}
/** @param {IDBDatabase} database @param {string} collectionId */
function deleteIndexedDbCollection(database, collectionId) {
	return new Promise((resolve, reject) => {
		const tx = database.transaction([
			"packages",
			"assets",
			"collections"
		], "readwrite"), packages = tx.objectStore("packages"), collections = tx.objectStore("collections"), request = collections.get(collectionId);
		let deleted = false;
		request.onsuccess = () => {
			if (request.result) {
				const collection = copyCollection(request.result);
				for (const key of collection.packageKeys) packages.delete(key);
				collections.delete(collectionId);
				deleted = true;
				garbageCollectIndexedDbAssets(tx);
				return;
			}
			if (collectionId.startsWith("legacy:")) {
				const key = collectionId.slice(7), legacyRequest = packages.getKey(key);
				legacyRequest.onsuccess = () => {
					if (legacyRequest.result !== void 0) {
						packages.delete(key);
						deleted = true;
						garbageCollectIndexedDbAssets(tx);
					}
				};
			}
		};
		tx.oncomplete = () => resolve(deleted);
		tx.onerror = () => reject(idbStorageError(tx.error, "indexeddb_transaction_failed", "IndexedDB collection delete failed"));
		tx.onabort = () => reject(idbStorageError(tx.error, "indexeddb_transaction_aborted", "IndexedDB collection delete aborted"));
	});
}
/** @param {IDBTransaction} tx */
function garbageCollectIndexedDbAssets(tx) {
	const packageRequest = tx.objectStore("packages").getAll();
	packageRequest.onsuccess = () => {
		const used = /* @__PURE__ */ new Set();
		for (const value of packageRequest.result) {
			const record = copyRecord(value);
			for (const ref of record.assetRefs ?? []) used.add(ref.contentHash);
		}
		const cursorRequest = tx.objectStore("assets").openCursor();
		cursorRequest.onsuccess = () => {
			const cursor = cursorRequest.result;
			if (!cursor) return;
			if (typeof cursor.key === "string" && !used.has(cursor.key)) cursor.delete();
			cursor.continue();
		};
	};
}
/** @param {IDBTransaction} tx @param {string} key */
function removeIndexedDbPackageFromCollections(tx, key) {
	const store = tx.objectStore("collections"), request = store.getAll();
	request.onsuccess = () => {
		for (const value of request.result) {
			const collection = copyCollection(value);
			if (!collection.packageKeys.includes(key)) continue;
			if (collection.packageKeys.length === 1) {
				store.delete(collection.collectionId);
				continue;
			}
			store.put({
				...collection,
				packageKeys: collection.packageKeys.filter((item) => item !== key),
				packages: collection.packages.filter((entry) => entry.packageKey !== key)
			});
		}
	};
}
/** @param {unknown} value */
function copySharedAssetRecord(value) {
	if (!exactRecord(value, [
		"contentHash",
		"bytes",
		"byteLength"
	])) throw storageError("storage_record_invalid", "Stored shared asset shape is invalid");
	const contentHash = valueFor(value, "contentHash"), bytes = valueFor(value, "bytes"), byteLength = valueFor(value, "byteLength");
	if (typeof contentHash !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(contentHash) || !(bytes instanceof Uint8Array) || byteLength !== bytes.byteLength) throw storageError("storage_record_invalid", "Stored shared asset values are invalid");
	return {
		contentHash,
		bytes: Uint8Array.from(bytes),
		byteLength
	};
}
/** @param {IDBDatabase} database @param {string} key */
function deleteExisting(database, key) {
	return new Promise((resolve, reject) => {
		const tx = database.transaction([
			"packages",
			"assets",
			"collections"
		], "readwrite"), store = tx.objectStore("packages"), request = store.getKey(key);
		let deleted = false;
		request.onsuccess = () => {
			if (request.result !== void 0) {
				store.delete(key);
				deleted = true;
				removeIndexedDbPackageFromCollections(tx, key);
				garbageCollectIndexedDbAssets(tx);
			}
		};
		request.onerror = () => reject(idbStorageError(request.error, "indexeddb_request_failed", "IndexedDB delete lookup failed"));
		tx.oncomplete = () => resolve(deleted);
		tx.onerror = () => reject(idbStorageError(tx.error, "indexeddb_transaction_failed", "IndexedDB delete transaction failed"));
		tx.onabort = () => reject(idbStorageError(tx.error, "indexeddb_transaction_aborted", "IndexedDB delete transaction aborted"));
	});
}
/** @param {IDBDatabase} database @param {string} key @param {string} writeToken */
function conditionalDelete(database, key, writeToken) {
	return new Promise((resolve, reject) => {
		const tx = database.transaction([
			"packages",
			"assets",
			"collections"
		], "readwrite");
		const store = tx.objectStore("packages");
		const request = store.get(key);
		let deleted = false;
		request.onsuccess = () => {
			const value = request.result;
			if (value && value.writeToken === writeToken) {
				store.delete(key);
				removeIndexedDbPackageFromCollections(tx, key);
				garbageCollectIndexedDbAssets(tx);
				deleted = true;
			}
		};
		request.onerror = () => reject(idbStorageError(request.error, "indexeddb_request_failed", "IndexedDB request failed"));
		tx.oncomplete = () => resolve(deleted);
		tx.onerror = () => reject(idbStorageError(tx.error, "indexeddb_transaction_failed", "IndexedDB transaction failed"));
		tx.onabort = () => reject(idbStorageError(tx.error, "indexeddb_transaction_aborted", "IndexedDB transaction aborted"));
	});
}
/** @param {IDBDatabase} database @param {string} storeName @param {IDBTransactionMode} mode @param {(store: IDBObjectStore) => IDBRequest | void} operation */
function transaction(database, storeName, mode, operation) {
	return new Promise((resolve, reject) => {
		const tx = database.transaction(storeName, mode);
		const request = operation(tx.objectStore(storeName));
		let result;
		if (request) {
			request.onsuccess = () => {
				result = request.result;
			};
			request.onerror = () => reject(idbStorageError(request.error, "indexeddb_request_failed", "IndexedDB request failed"));
		}
		tx.oncomplete = () => resolve(result);
		tx.onerror = () => reject(idbStorageError(tx.error, "indexeddb_transaction_failed", "IndexedDB transaction failed"));
		tx.onabort = () => reject(idbStorageError(tx.error, "indexeddb_transaction_aborted", "IndexedDB transaction aborted"));
	});
}
/** @param {StoredPackageRecord} record */
function copyRecord(record) {
	const legacyKeys = [
		"key",
		"package",
		"packageHash",
		"assets",
		"sourceCache",
		"createdAtMs",
		"schemaVersion",
		"writeToken"
	], v3Keys = [...legacyKeys, "assetRefs"];
	if (!exactRecord(record, legacyKeys) && !exactRecord(record, v3Keys)) throw storageError("storage_record_invalid", "Stored package record shape is invalid");
	const key = valueFor(record, "key"), packageValue = valueFor(record, "package"), packageHash = valueFor(record, "packageHash"), createdAtMs = valueFor(record, "createdAtMs"), writeToken = valueFor(record, "writeToken");
	if (typeof key !== "string" || !key || key.length > 1024 || !isPlainRecord$1(packageValue) || typeof packageHash !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(packageHash) || !Number.isSafeInteger(createdAtMs) || Number(createdAtMs) < 0 || typeof writeToken !== "string" || writeToken.length > 128) throw storageError("storage_record_invalid", "Stored package record values are invalid");
	let encoded;
	try {
		encoded = canonicalJson(packageValue);
	} catch {
		throw storageError("storage_record_invalid", "Stored package must contain canonical plain data");
	}
	if (new TextEncoder().encode(encoded).byteLength > 67108864) throw storageError("storage_record_invalid", "Stored package exceeds the size limit");
	const result = {
		key,
		package: cloneData(packageValue),
		packageHash,
		assets: copyAssets(valueFor(record, "assets")),
		sourceCache: copyAssets(valueFor(record, "sourceCache")),
		createdAtMs,
		schemaVersion: 3,
		writeToken
	};
	const refs = valueFor(record, "assetRefs");
	return refs === void 0 ? result : {
		...result,
		assetRefs: copyAssetRefs(refs)
	};
}
/** @param {StoredPackageRecord} record */
function summaryFor(record) {
	const packageId = valueFor(record.package, "packageId"), songName = valueFor(record.package, "songName"), source = valueFor(record.package, "source"), difficulty = isPlainRecord$1(source) ? valueFor(source, "difficulty") : "";
	return deepFreeze$1({
		key: record.key,
		packageId: typeof packageId === "string" ? packageId : "",
		packageHash: record.packageHash,
		songName: typeof songName === "string" ? songName : "",
		difficulty: typeof difficulty === "string" ? difficulty : "",
		createdAtMs: record.createdAtMs,
		assetCount: record.assets.length,
		sourceCacheCount: record.sourceCache.length
	});
}
/** @param {Map<string, StoredPackageRecord>} records */
function usage(records) {
	let total = 0;
	for (const record of records.values()) total += recordSize(record);
	return total;
}
/** @param {StoredPackageRecord | undefined} record */
function recordSize(record) {
	if (!record) return 0;
	return new TextEncoder().encode(canonicalJson(record.package)).byteLength + record.assets.reduce((total, entry) => total + entry.bytes.byteLength, 0) + record.sourceCache.reduce((total, entry) => total + entry.bytes.byteLength, 0);
}
/** @param {unknown} value @param {readonly string[]} keys */
function exactRecord(value, keys) {
	if (!isPlainRecord$1(value) || Reflect.ownKeys(value).length !== keys.length) return false;
	return keys.every((key) => {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		return descriptor && "value" in descriptor && descriptor.enumerable && descriptor.value !== void 0;
	});
}
/** @param {unknown} value @param {string} key */
function valueFor(value, key) {
	if (!isPlainRecord$1(value)) return void 0;
	const descriptor = Object.getOwnPropertyDescriptor(value, key);
	return descriptor && "value" in descriptor ? descriptor.value : void 0;
}
/** @param {unknown} value */
function copyAssets(value) {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 2048 || Reflect.ownKeys(value).some((key) => typeof key !== "string" || key !== "length" && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw storageError("storage_record_invalid", "Stored asset array is invalid");
	const result = [];
	let total = 0;
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || !exactRecord(descriptor.value, ["path", "bytes"]) && !exactRecord(descriptor.value, [
			"path",
			"bytes",
			"contentHash"
		])) throw storageError("storage_record_invalid", "Stored asset entry is invalid");
		const path = valueFor(descriptor.value, "path"), bytes = valueFor(descriptor.value, "bytes"), contentHash = valueFor(descriptor.value, "contentHash");
		if (typeof path !== "string" || !path || path.length > 1024 || !(bytes instanceof Uint8Array) || bytes.byteLength > 134217728 || contentHash !== void 0 && (typeof contentHash !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(contentHash))) throw storageError("storage_record_invalid", "Stored asset values are invalid");
		total += bytes.byteLength;
		if (!Number.isSafeInteger(total) || total > 536870912) throw storageError("storage_record_invalid", "Stored assets exceed the size limit");
		result.push({
			path,
			bytes: Uint8Array.from(bytes)
		});
	}
	return result;
}
/** @param {unknown} value */
function copyAssetRefs(value) {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 2048) throw storageError("storage_record_invalid", "Stored asset references are invalid");
	const result = [];
	const paths = /* @__PURE__ */ new Set();
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !("value" in descriptor) || !exactRecord(descriptor.value, ["path", "contentHash"])) throw storageError("storage_record_invalid", "Stored asset reference is invalid");
		const path = valueFor(descriptor.value, "path"), contentHash = valueFor(descriptor.value, "contentHash");
		if (typeof path !== "string" || !path || path.length > 1024 || paths.has(path) || typeof contentHash !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(contentHash)) throw storageError("storage_record_invalid", "Stored asset reference values are invalid");
		paths.add(path);
		result.push({
			path,
			contentHash
		});
	}
	return result;
}
/** @param {unknown} value */
function copySharedAssets(value) {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 64) throw storageError("storage_record_invalid", "Shared assets are invalid");
	const result = [];
	const hashes = /* @__PURE__ */ new Set();
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !("value" in descriptor) || !exactRecord(descriptor.value, ["contentHash", "bytes"])) throw storageError("storage_record_invalid", "Shared asset entry is invalid");
		const contentHash = valueFor(descriptor.value, "contentHash"), bytes = valueFor(descriptor.value, "bytes");
		if (typeof contentHash !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(contentHash) || hashes.has(contentHash) || !(bytes instanceof Uint8Array) || bytes.byteLength > 134217728) throw storageError("storage_record_invalid", "Shared asset values are invalid");
		hashes.add(contentHash);
		result.push({
			contentHash,
			bytes: Uint8Array.from(bytes),
			byteLength: bytes.byteLength
		});
	}
	return result;
}
/** @param {unknown} value */
function copyCollection(value) {
	const keys = [
		"collectionId",
		"songName",
		"sourceProvider",
		"sourceId",
		"sourceVersionHash",
		"converterProfileId",
		"converterProfileHash",
		"modifierIds",
		"packageKeys",
		"packages",
		"createdAtMs",
		"schemaVersion",
		"writeToken"
	];
	if (!exactRecord(value, keys)) throw storageError("storage_record_invalid", "Stored collection shape is invalid");
	const stringKeys = keys.slice(0, 7);
	const strings = Object.fromEntries(stringKeys.map((key) => [key, valueFor(value, key)]));
	if (stringKeys.some((key) => typeof strings[key] !== "string" || !strings[key] || strings[key].length > 1024) || !Number.isSafeInteger(valueFor(value, "createdAtMs")) || Number(valueFor(value, "createdAtMs")) < 0 || typeof valueFor(value, "writeToken") !== "string" || String(valueFor(value, "writeToken")).length > 128) throw storageError("storage_record_invalid", "Stored collection values are invalid");
	const modifierIds = copyStringArray(valueFor(value, "modifierIds"), 64), packageKeys = copyStringArray(valueFor(value, "packageKeys"), 8);
	if (packageKeys.length === 0 || new Set(packageKeys).size !== packageKeys.length) throw storageError("storage_record_invalid", "Stored collection package keys are invalid");
	const entries = valueFor(value, "packages");
	if (!Array.isArray(entries) || entries.length !== packageKeys.length || Object.getPrototypeOf(entries) !== Array.prototype) throw storageError("storage_record_invalid", "Stored collection packages are invalid");
	const packages = [];
	const difficultyIds = /* @__PURE__ */ new Set();
	for (let index = 0; index < entries.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(entries, String(index));
		if (!descriptor || !("value" in descriptor) || !exactRecord(descriptor.value, [
			"packageKey",
			"packageId",
			"difficultyId",
			"difficultyLabel"
		])) throw storageError("storage_record_invalid", "Stored collection package entry is invalid");
		const entry = {
			packageKey: valueFor(descriptor.value, "packageKey"),
			packageId: valueFor(descriptor.value, "packageId"),
			difficultyId: valueFor(descriptor.value, "difficultyId"),
			difficultyLabel: valueFor(descriptor.value, "difficultyLabel")
		};
		if (Object.values(entry).some((item) => typeof item !== "string" || !item || item.length > 1024) || entry.packageKey !== packageKeys[index] || difficultyIds.has(entry.difficultyId)) throw storageError("storage_record_invalid", "Stored collection package values are invalid");
		difficultyIds.add(entry.difficultyId);
		packages.push(entry);
	}
	return {
		...strings,
		modifierIds,
		packageKeys,
		packages,
		createdAtMs: valueFor(value, "createdAtMs"),
		schemaVersion: 3,
		writeToken: valueFor(value, "writeToken")
	};
}
/** @param {unknown} value @param {number} maximum */
function copyStringArray(value, maximum) {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) throw storageError("storage_record_invalid", "Stored string array is invalid");
	const result = [];
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string" || !descriptor.value || descriptor.value.length > 1024) throw storageError("storage_record_invalid", "Stored string array value is invalid");
		result.push(descriptor.value);
	}
	return result;
}
/** @param {unknown} batch */
function copyCollectionBatch(batch) {
	if (!exactRecord(batch, [
		"collection",
		"packages",
		"assets"
	])) throw storageError("storage_record_invalid", "Collection batch shape is invalid");
	const collection = copyCollection(valueFor(batch, "collection")), assets = copySharedAssets(valueFor(batch, "assets")), packageValue = valueFor(batch, "packages");
	if (!Array.isArray(packageValue) || Object.getPrototypeOf(packageValue) !== Array.prototype || packageValue.length !== collection.packageKeys.length) throw storageError("storage_record_invalid", "Collection batch packages are invalid");
	const packages = packageValue.map((record) => copyRecord(record));
	const hashes = new Set(assets.map((asset) => asset.contentHash));
	for (let index = 0; index < packages.length; index += 1) if (packages[index].key !== collection.packageKeys[index] || !packages[index].assetRefs?.length || packages[index].assetRefs.some((ref) => !hashes.has(ref.contentHash))) throw storageError("storage_record_invalid", "Collection batch references are invalid");
	return {
		collection,
		packages,
		assets
	};
}
/** @param {AbortSignal | undefined} signal */
function assertNotAborted(signal) {
	if (signal?.aborted) throw storageError("operation_aborted", "Persistence operation was cancelled");
}
/** @param {StoredPackageRecord} record @param {Map<string, SharedAssetRecord>} assets */
function resolveRecordAssets(record, assets) {
	const copy = copyRecord(record);
	if (!copy.assetRefs?.length) return copy;
	const resolved = [...copy.assets];
	const paths = new Set(resolved.map((entry) => entry.path));
	for (const ref of copy.assetRefs) {
		const asset = assets.get(ref.contentHash);
		if (!asset || paths.has(ref.path)) throw storageError("storage_record_invalid", "Stored shared asset is unavailable");
		paths.add(ref.path);
		resolved.push({
			path: ref.path,
			bytes: Uint8Array.from(asset.bytes)
		});
	}
	return {
		...copy,
		assets: resolved
	};
}
/** @param {StoredCollectionRecord} collection */
function collectionSummary(collection) {
	return deepFreeze$1({
		collectionId: collection.collectionId,
		songName: collection.songName,
		createdAtMs: collection.createdAtMs,
		packages: collection.packages.map((entry) => ({
			packageKey: entry.packageKey,
			packageId: entry.packageId,
			difficultyId: entry.difficultyId,
			difficultyLabel: entry.difficultyLabel
		}))
	});
}
/** @param {Map<string, StoredPackageRecord>} records @param {Map<string, StoredCollectionRecord>} collections */
function collectionSummaries(records, collections) {
	const result = [...collections.values()].map(collectionSummary);
	const referenced = new Set([...collections.values()].flatMap((collection) => collection.packageKeys));
	for (const [key, record] of records) if (!referenced.has(key)) result.push(collectionSummary(legacyCollection(record)));
	return result.sort((a, b) => a.collectionId.localeCompare(b.collectionId));
}
/** @param {StoredPackageRecord} record */
function legacyCollection(record) {
	const summary = summaryFor(record);
	return {
		collectionId: `legacy:${record.key}`,
		songName: summary.songName || "Downloaded song",
		sourceProvider: "legacy",
		sourceId: record.key,
		sourceVersionHash: "legacy",
		converterProfileId: "legacy",
		converterProfileHash: "legacy",
		modifierIds: [],
		packageKeys: [record.key],
		packages: [{
			packageKey: record.key,
			packageId: summary.packageId || record.key,
			difficultyId: summary.difficulty || "default",
			difficultyLabel: summary.difficulty || "Default"
		}],
		createdAtMs: record.createdAtMs,
		schemaVersion: 3,
		writeToken: record.writeToken
	};
}
/** @param {Map<string, StoredPackageRecord>} records @param {string} collectionId */
function legacyCollectionForId(records, collectionId) {
	if (!collectionId.startsWith("legacy:")) return null;
	const record = records.get(collectionId.slice(7));
	return record ? copyCollection(legacyCollection(record)) : null;
}
/** @param {Map<string, unknown>} target @param {Map<string, unknown>} source */
function replaceMap(target, source) {
	target.clear();
	for (const [key, value] of source) target.set(key, value);
}
/** @param {Map<string, StoredPackageRecord>} records @param {Map<string, SharedAssetRecord>} assets @param {Map<string, StoredCollectionRecord>} collections */
function totalUsage(records, assets, collections) {
	let total = usage(records);
	for (const asset of assets.values()) total += asset.bytes.byteLength;
	for (const collection of collections.values()) total += new TextEncoder().encode(canonicalJson(collection)).byteLength;
	return total;
}
/** @param {Map<string, StoredPackageRecord>} records @param {Map<string, SharedAssetRecord>} assets */
function collectUnusedAssets(records, assets) {
	const used = /* @__PURE__ */ new Set();
	for (const record of records.values()) for (const ref of record.assetRefs ?? []) used.add(ref.contentHash);
	for (const hash of assets.keys()) if (!used.has(hash)) assets.delete(hash);
}
/** @param {Map<string, StoredCollectionRecord>} collections @param {string} key */
function removePackageFromCollections(collections, key) {
	for (const [id, collection] of [...collections]) {
		if (collection.packageKeys.indexOf(key) < 0) continue;
		if (collection.packageKeys.length === 1) {
			collections.delete(id);
			continue;
		}
		collections.set(id, {
			...collection,
			packageKeys: collection.packageKeys.filter((item) => item !== key),
			packages: collection.packages.filter((entry) => entry.packageKey !== key)
		});
	}
}
/** @param {unknown} value */
function finite(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
/** @param {DOMException | null} error @param {string} fallbackCode @param {string} fallbackMessage */
function idbStorageError(error, fallbackCode, fallbackMessage) {
	return storageError(error?.name === "QuotaExceededError" ? "quota_exceeded" : fallbackCode, error?.message || fallbackMessage);
}
/** @param {string} code @param {string} message */
function storageError(code, message) {
	const error = new Error(message);
	error.name = "AeroAuthoringStorageError";
	Object.assign(error, { code });
	return error;
}
//#endregion
//#region ../aerobeat-web-content-authoring/src/source-material.js
/** @typedef {{manifest: Record<string, unknown>, listEntryPaths: () => readonly string[], readEntry: (path: string) => Uint8Array}} SourceBundle */
/** @type {Readonly<Record<string, number>>} */
var defaultLimits = Object.freeze({
	difficultyBytes: 67108864,
	audioBytes: 134217728,
	selectedBytes: 201326592,
	cacheEntryBytes: 2097152,
	entryCount: 4096,
	pathChars: 1024
});
var maximumDifficulties = 100;
var maximumIdentityChars = 512;
/** Canonical Standard difficulty order shared by batch authoring and product presentation. */
var standardDifficultyOrder$1 = Object.freeze([
	"Easy",
	"Normal",
	"Hard",
	"Expert",
	"ExpertPlus"
]);
/**
* Adapt one selected Standard difficulty into a Worker-safe request plus child-local assets.
* @param {unknown} acquired
* @param {{difficulty: string, sourceProvider?: string, sourceId?: string, sourceVersionHash?: string, cacheSourceEntries?: boolean, expectedAudioContentHash?: string, expectedDifficultyContentHashes?: Readonly<Record<string, string>>, limits?: Partial<typeof defaultLimits>, signal?: AbortSignal}} options
*/
async function prepareSourceMaterial(acquired, options) {
	return (await prepareSourceMaterialSet(acquired, options, false)).materials[0];
}
/**
* Adapt every exact Standard difficulty in canonical order. Audio is read and hashed once.
* @param {unknown} acquired
* @param {{sourceProvider?: string, sourceId?: string, sourceVersionHash?: string, cacheSourceEntries?: boolean, expectedAudioContentHash?: string, expectedDifficultyContentHashes?: Readonly<Record<string, string>>, limits?: Partial<typeof defaultLimits>, signal?: AbortSignal}} options
*/
async function prepareAllStandardSourceMaterials(acquired, options) {
	return prepareSourceMaterialSet(acquired, options, true);
}
/** @param {unknown} acquired @param {Record<string, unknown>} options @param {boolean} all */
async function prepareSourceMaterialSet(acquired, options, all) {
	if (!isPlainRecord$1(acquired) || !isPlainRecord$1(options)) throw sourceError("source_invalid", "Source acquisition and options must be plain records");
	const nestedSource = dataProperty$1(acquired, "source");
	const source = isPlainRecord$1(nestedSource) ? nestedSource : acquired;
	if (!isSourceBundle(source)) throw sourceError("source_bundle_invalid", "Source must expose manifest, listEntryPaths and readEntry as data properties");
	const manifest = dataProperty$1(source, "manifest");
	const limits = normalizeLimits$1(dataProperty$1(options, "limits"));
	const signalValue = dataProperty$1(options, "signal");
	const signal = signalValue instanceof AbortSignal ? signalValue : void 0;
	if (signalValue !== void 0 && !signal) throw sourceError("source_options_invalid", "signal must be an AbortSignal");
	checkAbort$1(signal);
	const advertised = arrayData(dataProperty$1(manifest, "difficulties"), maximumDifficulties, "source_manifest_invalid");
	/** @type {{difficulty: string, path: string}[]} */
	let selected;
	if (all) {
		const byDifficulty = /* @__PURE__ */ new Map();
		for (const entry of advertised) {
			if (!isPlainRecord$1(entry) || dataProperty$1(entry, "characteristic") !== "Standard") continue;
			const candidate = dataProperty$1(entry, "difficulty");
			if (typeof candidate !== "string" || candidate.length > 64) throw sourceError("difficulty_invalid", "Standard difficulty must be a bounded supported string");
			const difficulty = normalizeDifficulty$1(candidate);
			if (byDifficulty.has(difficulty)) throw sourceError("difficulty_duplicate", `Standard ${difficulty} is advertised more than once`);
			byDifficulty.set(difficulty, entry);
		}
		selected = standardDifficultyOrder$1.filter((difficulty) => byDifficulty.has(difficulty)).map((difficulty) => {
			const pathValue = dataProperty$1(byDifficulty.get(difficulty), "path");
			if (typeof pathValue !== "string" || !pathValue) throw sourceError("difficulty_unavailable", `Standard ${difficulty} has no source path`);
			return {
				difficulty,
				path: normalizePath(pathValue, limits.pathChars)
			};
		});
	} else {
		const difficultyValue = dataProperty$1(options, "difficulty");
		if (typeof difficultyValue !== "string" || difficultyValue.length > 64) throw sourceError("difficulty_invalid", "Difficulty must be a bounded string");
		const wanted = normalizeDifficulty$1(difficultyValue);
		selected = [];
		for (const entry of advertised) {
			if (!isPlainRecord$1(entry) || dataProperty$1(entry, "characteristic") !== "Standard") continue;
			const candidate = dataProperty$1(entry, "difficulty");
			if (typeof candidate === "string" && candidate.length <= 64 && normalizeDifficulty$1(candidate) === wanted) {
				const pathValue = dataProperty$1(entry, "path");
				if (typeof pathValue !== "string" || !pathValue) break;
				selected = [{
					difficulty: wanted,
					path: normalizePath(pathValue, limits.pathChars)
				}];
				break;
			}
		}
	}
	if (!selected.length) throw sourceError("difficulty_unavailable", all ? "No supported Standard difficulty is available in this source" : "Selected Standard difficulty is not available in this source");
	const listEntryPaths = dataProperty$1(source, "listEntryPaths");
	const readEntry = dataProperty$1(source, "readEntry");
	let listedValue;
	try {
		listedValue = listEntryPaths.call(source);
	} catch (cause) {
		throw sourceError("source_paths_failed", diagnostic$1("Source entry listing failed", cause));
	}
	const listed = arrayData(listedValue, limits.entryCount, "source_paths_invalid");
	const listedByNormalized = /* @__PURE__ */ new Map();
	for (const original of listed) {
		if (typeof original !== "string") throw sourceError("source_paths_invalid", "Source entry paths must be strings");
		const normalized = normalizePath(original, limits.pathChars);
		if (listedByNormalized.has(normalized)) throw sourceError("source_paths_duplicate", "Source entry paths collide after case and Unicode normalization");
		listedByNormalized.set(normalized, original);
	}
	const prepared = [];
	let selectedByteCount = 0;
	for (const item of selected) {
		checkAbort$1(signal);
		const original = listedByNormalized.get(item.path);
		if (!original) throw sourceError("source_entry_missing", `Standard ${item.difficulty} is absent from the advertised source entries`);
		const bytes = readBounded(readEntry, source, original, limits.difficultyBytes, "difficulty");
		selectedByteCount += bytes.byteLength;
		if (!Number.isSafeInteger(selectedByteCount) || selectedByteCount > limits.selectedBytes) throw sourceError("source_selected_bytes_exceeded", "Selected source data exceeds the authoring byte limit");
		const contentHash = await verifyExpectedHash(bytes, expectedPathHash(dataProperty$1(options, "expectedDifficultyContentHashes"), item.path, limits.pathChars), "difficulty_hash_mismatch");
		checkAbort$1(signal);
		prepared.push({
			...item,
			bytes,
			contentHash
		});
	}
	const audioPathValue = dataProperty$1(manifest, "audioPath");
	const audioPath = typeof audioPathValue === "string" && audioPathValue ? normalizePath(audioPathValue, limits.pathChars) : "";
	const audioOriginal = audioPath ? listedByNormalized.get(audioPath) : void 0;
	if (audioPath && !audioOriginal) throw sourceError("source_entry_missing", "Audio is absent from the advertised source entries");
	checkAbort$1(signal);
	const audioBytes = audioOriginal ? readBounded(readEntry, source, audioOriginal, limits.audioBytes, "audio") : /* @__PURE__ */ new Uint8Array();
	if (!Number.isSafeInteger(selectedByteCount + audioBytes.byteLength) || selectedByteCount + audioBytes.byteLength > limits.selectedBytes) throw sourceError("source_selected_bytes_exceeded", "Selected source data exceeds the authoring byte limit");
	const expectedAudio = optionalExpectedHash(dataProperty$1(options, "expectedAudioContentHash"), "expectedAudioContentHash");
	if (expectedAudio && !audioBytes.byteLength) throw sourceError("audio_hash_mismatch", "Expected audio is absent from the selected source");
	const audioContentHash = audioBytes.byteLength ? await verifyExpectedHash(audioBytes, expectedAudio, "audio_hash_mismatch") : "";
	checkAbort$1(signal);
	const cache = [];
	if (dataProperty$1(options, "cacheSourceEntries") === true) {
		const infoPathValue = dataProperty$1(manifest, "infoPath");
		const infoPath = typeof infoPathValue === "string" && infoPathValue ? normalizePath(infoPathValue, limits.pathChars) : "";
		const requiredCachePaths = [...new Set([infoPath, ...prepared.map((item) => item.path)].filter(Boolean))];
		for (const path of requiredCachePaths) {
			checkAbort$1(signal);
			const original = listedByNormalized.get(path);
			if (!original) throw sourceError("source_entry_missing", "Requested cache entry is absent");
			const preparedEntry = prepared.find((item) => item.path === path);
			const cachedBytes = preparedEntry ? Uint8Array.from(preparedEntry.bytes) : readBounded(readEntry, source, original, limits.cacheEntryBytes, "cache");
			if (cachedBytes.byteLength > limits.cacheEntryBytes) throw sourceError("source_entry_too_large", "cache entry exceeds the byte limit");
			cache.push({
				path,
				bytes: cachedBytes
			});
		}
	}
	const sourceProviderOption = optionalIdentity(dataProperty$1(options, "sourceProvider"), "sourceProvider");
	const providerId = boundedDataString(dataProperty$1(acquired, "providerId"));
	const sourceProvider = sourceProviderOption || providerId || "local";
	const mapValue = dataProperty$1(acquired, "map");
	const map = isPlainRecord$1(mapValue) ? mapValue : {};
	const versionValue = dataProperty$1(acquired, "version");
	const version = isPlainRecord$1(versionValue) ? versionValue : {};
	const sourceIdOption = optionalIdentity(dataProperty$1(options, "sourceId"), "sourceId");
	const sourceVersionOption = optionalIdentity(dataProperty$1(options, "sourceVersionHash"), "sourceVersionHash");
	const sourceId = sourceIdOption || boundedDataString(dataProperty$1(map, "mapId")) || boundedDataString(dataProperty$1(manifest, "songName")) || "local-import";
	const sourceVersionHash = sourceVersionOption || boundedDataString(dataProperty$1(version, "hash")) || boundedDataString(dataProperty$1(acquired, "sourceHash")) || "local-unverified";
	const major = dataProperty$1(manifest, "sourceFormatMajor");
	if (!Number.isInteger(major) || ![
		2,
		3,
		4
	].includes(Number(major))) throw sourceError("source_format_unsupported", "Only Beat Saber v2, v3 and v4 are supported");
	const bpmValue = dataProperty$1(manifest, "bpm");
	const common = {
		schemaId: "aerobeat.authoring-source.v1",
		sourceFormatMajor: major,
		infoPath: boundedDataString(dataProperty$1(manifest, "infoPath"), limits.pathChars),
		songName: boundedDataString(dataProperty$1(manifest, "songName")) || "Imported Song",
		songAuthorName: boundedDataString(dataProperty$1(manifest, "songAuthorName")),
		levelAuthorName: boundedDataString(dataProperty$1(manifest, "levelAuthorName")),
		bpm: typeof bpmValue === "number" ? positive$1(bpmValue, 120) : 120,
		audioPath,
		audioContentHash,
		sourceProvider,
		sourceId,
		sourceVersionHash
	};
	const audio = audioPath ? [{
		path: audioPath,
		bytes: Uint8Array.from(audioBytes),
		contentHash: audioContentHash
	}] : [];
	return deepFreeze$1({
		materials: prepared.map((item) => deepFreeze$1({
			requestManifest: deepFreeze$1({
				...common,
				selectedDifficulty: {
					difficulty: item.difficulty,
					path: item.path,
					contentHash: item.contentHash
				}
			}),
			difficultyBytes: Uint8Array.from(item.bytes),
			audio,
			sourceCache: cache
		})),
		audio,
		sourceCache: cache,
		sourceProvider,
		sourceId,
		sourceVersionHash,
		songName: common.songName,
		audioPath,
		audioContentHash
	});
}
/** @param {unknown} value @returns {value is SourceBundle} */
function isSourceBundle(value) {
	return isPlainRecord$1(value) && isPlainRecord$1(dataProperty$1(value, "manifest")) && typeof dataProperty$1(value, "listEntryPaths") === "function" && typeof dataProperty$1(value, "readEntry") === "function";
}
/** @param {Record<string, unknown>} record @param {string} key */
function dataProperty$1(record, key) {
	const descriptor = Object.getOwnPropertyDescriptor(record, key);
	if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return void 0;
	return descriptor.value;
}
/** @param {string} value */
function normalizeDifficulty$1(value) {
	const result = {
		easy: "Easy",
		normal: "Normal",
		hard: "Hard",
		expert: "Expert",
		expertplus: "ExpertPlus"
	}[value.toLowerCase().replace(/[^a-z]/gu, "")];
	if (!result) throw sourceError("difficulty_invalid", "Difficulty must be Easy, Normal, Hard, Expert or ExpertPlus");
	return result;
}
/** @param {string} value @param {number} maximumChars */
function normalizePath(value, maximumChars) {
	if (!value || value.length > maximumChars || /^[\\/]|^[a-z]:/iu.test(value) || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw sourceError("source_path_invalid", "Source path is unsafe or exceeds the character limit");
	const parts = value.replaceAll("\\", "/").normalize("NFC").split("/");
	if (parts.some((part) => !part || part === "." || part === "..")) throw sourceError("source_path_invalid", "Source path is unsafe");
	return parts.join("/").toLowerCase();
}
/** @param {(path:string)=>Uint8Array} reader @param {SourceBundle} source @param {string} path @param {number} maximum @param {string} kind */
function readBounded(reader, source, path, maximum, kind) {
	let bytes;
	try {
		bytes = reader.call(source, path);
	} catch (cause) {
		throw sourceError("source_entry_read_failed", diagnostic$1(`${kind} entry read failed`, cause));
	}
	if (!(bytes instanceof Uint8Array)) throw sourceError("source_entry_invalid", `${kind} entry must be a Uint8Array copy`);
	if (bytes.byteLength > maximum) throw sourceError("source_entry_too_large", `${kind} entry exceeds the byte limit`);
	return Uint8Array.from(bytes);
}
/** @param {unknown} value */
function normalizeLimits$1(value) {
	if (value !== void 0 && !isPlainRecord$1(value)) throw sourceError("source_limits_invalid", "Source limits must be a plain record");
	const override = isPlainRecord$1(value) ? value : {};
	const allowed = new Set(Object.keys(defaultLimits));
	for (const key of Reflect.ownKeys(override)) if (typeof key !== "string" || !allowed.has(key) || dataProperty$1(override, key) === void 0) throw sourceError("source_limits_invalid", "Source limits contain an unknown or non-data field");
	const result = { ...defaultLimits };
	for (const key of Object.keys(result)) {
		const candidate = dataProperty$1(override, key);
		if (candidate !== void 0) {
			if (!Number.isSafeInteger(candidate) || Number(candidate) <= 0) throw sourceError("source_limits_invalid", `Source limit ${key} must be a positive safe integer`);
			result[key] = Number(candidate);
		}
	}
	return Object.freeze(result);
}
/** @param {unknown} value @param {string} field */
function optionalExpectedHash(value, field) {
	if (value === void 0 || value === null) return "";
	if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) throw sourceError("source_hash_invalid", `${field} must be lowercase sha256`);
	return value;
}
/** @param {unknown} value @param {string} selectedPath @param {number} maximumPathChars */
function expectedPathHash(value, selectedPath, maximumPathChars) {
	if (value === void 0 || value === null) return "";
	if (!isPlainRecord$1(value)) throw sourceError("source_hash_invalid", "expectedDifficultyContentHashes must be a plain record");
	const keys = Reflect.ownKeys(value);
	if (keys.length > maximumDifficulties) throw sourceError("source_hash_invalid", "Difficulty hash map exceeds the entry limit");
	let expected = "";
	const seen = /* @__PURE__ */ new Set();
	for (const key of keys) {
		if (typeof key !== "string") throw sourceError("source_hash_invalid", "Difficulty hash paths must be strings");
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw sourceError("source_hash_invalid", "Difficulty hash map must contain data properties only");
		const normalized = normalizePath(key, maximumPathChars);
		if (seen.has(normalized)) throw sourceError("source_hash_invalid", "Difficulty hash paths collide after normalization");
		seen.add(normalized);
		const hash = optionalExpectedHash(descriptor.value, "expectedDifficultyContentHashes");
		if (normalized === selectedPath) expected = hash;
	}
	return expected;
}
/** @param {unknown} value @param {number} maximum @param {string} code @returns {unknown[]} */
function arrayData(value, maximum, code) {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) throw sourceError(code, "Source array is invalid or exceeds its entry limit");
	if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || key !== "length" && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw sourceError(code, "Source array contains unsupported fields");
	const result = [];
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || descriptor.value === void 0) throw sourceError(code, "Source array must contain dense data properties");
		result.push(descriptor.value);
	}
	return result;
}
/** @param {unknown} value @param {number} [maximum] */
function boundedDataString(value, maximum = maximumIdentityChars) {
	if (value === void 0 || value === null) return "";
	if (typeof value !== "string" || value.length > maximum) throw sourceError("source_manifest_invalid", "Source text field must be a bounded string");
	return value;
}
/** @param {unknown} value @param {string} field */
function optionalIdentity(value, field) {
	if (value === void 0 || value === null || value === "") return "";
	if (typeof value !== "string" || value.length > maximumIdentityChars) throw sourceError("source_options_invalid", `${field} must be a bounded string`);
	return value;
}
/** @param {Uint8Array} bytes @param {string} expected @param {string} mismatchCode */
async function verifyExpectedHash(bytes, expected, mismatchCode) {
	const actual = await prefixedSha256(bytes);
	if (expected && actual !== expected) throw sourceError(mismatchCode, `Expected ${expected} but received ${actual}`);
	return actual;
}
/** @param {AbortSignal | undefined} signal */
function checkAbort$1(signal) {
	if (signal?.aborted) throw sourceError("operation_aborted", "Source preparation was cancelled");
}
/** @param {number} value @param {number} fallback */
function positive$1(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}
/** @param {string} message @param {unknown} cause */
function diagnostic$1(message, cause) {
	if (cause && typeof cause === "object") {
		const descriptor = Object.getOwnPropertyDescriptor(cause, "message");
		if (descriptor && "value" in descriptor && typeof descriptor.value === "string" && descriptor.value) return `${message}: ${descriptor.value.slice(0, 4096)}`;
	}
	return message;
}
/** @param {string} code @param {string} message */
function sourceError(code, message) {
	const error = new Error(message);
	error.name = "AeroAuthoringSourceError";
	Object.assign(error, { code });
	return error;
}
//#endregion
//#region ../aerobeat-web-content-authoring/src/validator.js
/**
* Validate the canonical browser-authored package before persistence/export.
*
* @param {unknown} packageValue
* @returns {Promise<Readonly<{valid: boolean, issues: readonly Readonly<{code: string, path: string, message: string}>[], packageHash: string | null}>>}
*/
async function validateAuthoredPackage(packageValue) {
	const issues = [];
	const issue = (code, path, message) => issues.push(Object.freeze({
		code,
		path,
		message
	}));
	if (!isPlainRecord$1(packageValue)) {
		issue("package_invalid", "", "Package must be a plain record");
		return Object.freeze({
			valid: false,
			issues: Object.freeze(issues),
			packageHash: null
		});
	}
	let canonicalPackage;
	try {
		canonicalPackage = canonicalJson(packageValue);
		if (new TextEncoder().encode(canonicalPackage).byteLength > 67108864) throw new TypeError("Package exceeds the validation size limit");
	} catch (cause) {
		issue("package_serialization_invalid", "", cause instanceof Error ? cause.message : "Package cannot be serialized");
		return Object.freeze({
			valid: false,
			issues: Object.freeze(issues),
			packageHash: null
		});
	}
	if (packageValue.schemaId !== "aerobeat.song-package.v1" || packageValue.schemaVersion !== 1) issue("package_schema_invalid", "schemaId", "Package schema must be aerobeat.song-package.v1 version 1");
	if (!nonEmpty(packageValue.packageId) || !nonEmpty(packageValue.songId)) issue("package_identity_invalid", "packageId", "Package and song identities are required");
	try {
		if (canonicalJson(packageValue.recipeDefinitions) !== canonicalJson(recipeDefinitions)) issue("recipe_definitions_invalid", "recipeDefinitions", "Recipe definitions must exactly match the frozen authoring contract");
		if (canonicalJson(packageValue.rulesetDefinitions) !== canonicalJson(rulesetDefinitions)) issue("ruleset_definitions_invalid", "rulesetDefinitions", "Ruleset definitions must exactly match the frozen authoring contract");
	} catch {
		issue("definitions_invalid", "recipeDefinitions", "Definitions must be canonical plain data");
	}
	const sourceProfile = isPlainRecord$1(packageValue.source) ? packageValue.source.converterProfile : void 0;
	const traceProfile = isPlainRecord$1(packageValue.conversionTrace) ? packageValue.conversionTrace.converterProfile : void 0;
	/** @type {Readonly<Record<string,unknown>> | null} */ let converterProfile = null;
	if (sourceProfile !== void 0 || traceProfile !== void 0) try {
		converterProfile = await normalizeConverterProfile(sourceProfile);
		if (canonicalJson(traceProfile) !== canonicalJson(converterProfile)) issue("converter_profile_trace_mismatch", "conversionTrace.converterProfile", "Conversion trace profile must exactly match package source provenance");
	} catch (cause) {
		issue("converter_profile_invalid", "source.converterProfile", cause instanceof Error ? cause.message : "Converter profile is invalid");
	}
	const conversionTrace = isPlainRecord$1(packageValue.conversionTrace) ? packageValue.conversionTrace : null;
	const boxingTraces = conversionTrace && Array.isArray(conversionTrace.boxing) ? conversionTrace.boxing : [];
	const flowTraces = conversionTrace && Array.isArray(conversionTrace.flow) ? conversionTrace.flow : [];
	for (let index = 0; index < boxingTraces.length; index += 1) {
		const trace = boxingTraces[index];
		const traceConverterProfile = isPlainRecord$1(trace) ? trace.converterProfile : void 0;
		if (converterProfile) try {
			if (canonicalJson(traceConverterProfile) !== canonicalJson(converterProfile)) issue("converter_profile_boxing_trace_mismatch", `conversionTrace.boxing[${index}].converterProfile`, "Every Boxing trace converter profile must exactly match package source provenance");
		} catch {
			issue("converter_profile_boxing_trace_mismatch", `conversionTrace.boxing[${index}].converterProfile`, "Every Boxing trace converter profile must exactly match package source provenance");
		}
		else if (traceConverterProfile !== void 0) issue("converter_profile_unbound", `conversionTrace.boxing[${index}].converterProfile`, "Boxing trace converter profile requires package source provenance");
	}
	for (let index = 0; index < flowTraces.length; index += 1) if (isPlainRecord$1(flowTraces[index]) && flowTraces[index].converterProfile !== void 0) issue("converter_profile_flow_trace_forbidden", `conversionTrace.flow[${index}].converterProfile`, "Flow traces must not carry Boxing converter profile provenance");
	const charts = Array.isArray(packageValue.charts) ? packageValue.charts : [];
	if (charts.length !== 5) issue("chart_count_invalid", "charts", "One difficulty must contain Flow plus four Boxing charts");
	const chartIds = /* @__PURE__ */ new Set();
	const matrix = /* @__PURE__ */ new Set();
	let flowCount = 0;
	for (let index = 0; index < charts.length; index += 1) {
		const chart = charts[index];
		const path = `charts[${index}]`;
		if (!isPlainRecord$1(chart)) {
			issue("chart_invalid", path, "Chart must be a plain record");
			continue;
		}
		const chartId = String(chart.chartId ?? "");
		if (!chartId || chartIds.has(chartId)) issue("chart_identity_invalid", `${path}.chartId`, "Chart IDs must be non-empty and unique");
		chartIds.add(chartId);
		if (!Array.isArray(chart.beats)) {
			issue("chart_beats_invalid", `${path}.beats`, "Chart beats must be an array");
			continue;
		}
		if (chart.mode === "flow") {
			flowCount += 1;
			for (let beatIndex = 0; beatIndex < chart.beats.length; beatIndex += 1) validateFlowBeat(chart.beats[beatIndex], `${path}.beats[${beatIndex}]`, issue);
			continue;
		}
		if (chart.mode !== "boxing" || !isPlainRecord$1(chart.prototype)) {
			issue("boxing_chart_invalid", path, "Boxing chart prototype metadata is required");
			continue;
		}
		const prototype = chart.prototype;
		if (prototype.contractId !== "aerobeat.boxing.prototype.v1") issue("prototype_contract_invalid", `${path}.prototype.contractId`, "Prototype contract mismatch");
		if (!["row_family_balanced_height_v1", "cut_family_source_height_v1"].includes(String(prototype.recipeId))) issue("prototype_recipe_invalid", `${path}.prototype.recipeId`, "Unknown recipe");
		if (!["boxing_semantic_track_v1", "boxing_spatial_grid_v1"].includes(String(prototype.rulesetId))) issue("prototype_ruleset_invalid", `${path}.prototype.rulesetId`, "Unknown ruleset");
		if (prototype.recipeVersion !== "1.0.0" || prototype.rulesetVersion !== "1.0.0") issue("prototype_version_invalid", `${path}.prototype`, "Prototype recipe/ruleset versions must match frozen definitions");
		matrix.add(`${String(prototype.recipeId)}|${String(prototype.rulesetId)}`);
		for (const hashName of [
			"sourceHash",
			"recipeHash",
			"rulesetHash",
			"contentHash"
		]) if (!validHash$1(prototype[hashName])) issue("prototype_hash_invalid", `${path}.prototype.${hashName}`, "Hash must be sha256 plus 64 lowercase hexadecimal digits");
		if (converterProfile) try {
			if (canonicalJson(prototype.converterProfile) !== canonicalJson(converterProfile)) issue("converter_profile_chart_mismatch", `${path}.prototype.converterProfile`, "Chart converter profile must exactly match package provenance");
			const expectedContentHash = await prefixedSha256(canonicalJson({
				beats: chart.beats,
				recipeId: prototype.recipeId,
				rulesetId: prototype.rulesetId,
				sourceHash: prototype.sourceHash,
				converterProfile
			}));
			if (prototype.contentHash !== expectedContentHash) issue("converter_profile_content_hash_mismatch", `${path}.prototype.contentHash`, "Chart content hash must bind converter profile identity and generated beats");
		} catch {
			issue("converter_profile_chart_mismatch", `${path}.prototype.converterProfile`, "Chart converter profile is invalid");
		}
		else if (prototype.converterProfile !== void 0) issue("converter_profile_unbound", `${path}.prototype.converterProfile`, "Chart converter profile requires package source provenance");
		const modifiers = Array.isArray(prototype.modifiers) ? prototype.modifiers.map(String) : [];
		const normalizedModifiers = [...new Set(modifiers)].sort();
		const emittedModifiers = [...new Set(chart.beats.filter(isPlainRecord$1).map((beat) => beat.modifier).filter((value) => typeof value === "string"))];
		if (!Array.isArray(prototype.modifiers) || modifiers.some((modifier) => !supportedModifiers.includes(modifier)) || canonicalJson(modifiers) !== canonicalJson(normalizedModifiers) || emittedModifiers.some((modifier) => !modifiers.includes(modifier))) issue("prototype_modifiers_invalid", `${path}.prototype.modifiers`, "Prototype modifiers must be sorted unique recognized union including emitted modifiers");
		for (let beatIndex = 0; beatIndex < chart.beats.length; beatIndex += 1) validateBeat(chart.beats[beatIndex], `${path}.beats[${beatIndex}]`, issue);
	}
	if (flowCount !== 1 || matrix.size !== 4) issue("prototype_matrix_invalid", "charts", "Charts must contain one Flow and all four recipe/ruleset combinations");
	const sets = Array.isArray(packageValue.sets) ? packageValue.sets : [];
	if (sets.length !== charts.length || new Set(sets.filter(isPlainRecord$1).map((set) => set.setId)).size !== charts.length || sets.some((set) => !isPlainRecord$1(set) || !chartIds.has(String(set.chartId)) || set.songId !== packageValue.songId)) issue("set_identity_invalid", "sets", "Every chart requires a unique correctly-linked set");
	let packageHash = null;
	try {
		packageHash = await prefixedSha256(canonicalPackage);
	} catch (cause) {
		issue("package_serialization_invalid", "", cause instanceof Error ? cause.message : "Package cannot be serialized");
	}
	return Object.freeze({
		valid: issues.length === 0,
		issues: Object.freeze(issues),
		packageHash
	});
}
/** @param {unknown} beat @param {string} path @param {(code: string, path: string, message: string) => void} issue */
function validateBeat(beat, path, issue) {
	if (!isPlainRecord$1(beat)) {
		issue("beat_invalid", path, "Beat must be a plain record");
		return;
	}
	if (!Number.isFinite(beat.start) || Number(beat.start) < 0 || !nonEmpty(beat.type)) issue("beat_shape_invalid", path, "Beat start/type are invalid");
	if (!nonEmpty(beat.eventId) || !Array.isArray(beat.sourceEventIds) || beat.sourceEventIds.some((entry) => !nonEmpty(entry))) issue("beat_lineage_invalid", path, "Boxing beat event/source IDs are required");
	if (String(beat.type) === "guard") {
		if (beat.timingWindowMs !== 180 || beat.evidenceFreshnessMs !== 150) issue("beat_timing_invalid", path, "Guard timing/freshness must match the frozen contract");
		if (!isPlainRecord$1(beat.guardTarget) || !integerRange(beat.guardTarget.leftCell, 0, 11) || !integerRange(beat.guardTarget.rightCell, 0, 11)) issue("guard_target_invalid", `${path}.guardTarget`, "Guard cells must use athlete 0..11 IDs");
		if (!isPlainRecord$1(beat.checkpoint) || beat.checkpoint.kind !== "instantaneous" || beat.checkpoint.timingWindowMs !== 180 || beat.checkpoint.freshnessMs !== 150) issue("guard_checkpoint_invalid", `${path}.checkpoint`, "Guard checkpoint must use frozen instantaneous timing");
	}
	if (/^(straight|hook|uppercut)_/u.test(String(beat.type))) {
		if (beat.timingWindowMs !== 180 || beat.evidenceFreshnessMs !== 150) issue("beat_timing_invalid", path, "Punch timing/freshness must match the frozen contract");
		if (!isPlainRecord$1(beat.spatialTarget) || !integerRange(beat.spatialTarget.targetCell, 0, 11) || !Array.isArray(beat.spatialTarget.acceptedSubcells) || beat.spatialTarget.acceptedSubcells.some((entry) => !integerRange(entry, 0, 47))) issue("spatial_target_invalid", `${path}.spatialTarget`, "Punch spatial target must use athlete grid/subgrid IDs");
	}
	if (/^(squat|weave_)/u.test(String(beat.type))) {
		if (!Array.isArray(beat.blockedCells) || beat.blockedCells.some((entry) => !integerRange(entry, 0, 11))) issue("blocked_cells_invalid", `${path}.blockedCells`, "Obstacle cells must use athlete 0..11 IDs");
		if (!isPlainRecord$1(beat.checkpoint) || beat.checkpoint.kind !== "instantaneous" || beat.checkpoint.timingWindowMs !== 180 || beat.checkpoint.freshnessMs !== 150 || !Array.isArray(beat.checkpoint.noseSafeCells)) issue("obstacle_checkpoint_invalid", `${path}.checkpoint`, "Avoidance checkpoint requires frozen timing and nose safe cells");
	}
}
/** @param {unknown} beat @param {string} path @param {(code: string, path: string, message: string) => void} issue */
function validateFlowBeat(beat, path, issue) {
	if (!isPlainRecord$1(beat) || !Number.isFinite(beat.start) || Number(beat.start) < 0 || ![
		"note",
		"bomb",
		"obstacle",
		"arc",
		"burst"
	].includes(String(beat.type))) {
		issue("flow_beat_invalid", path, "Flow beat shape/type is invalid");
		return;
	}
	if (["note", "bomb"].includes(String(beat.type)) && !integerRange(beat.placement, 0, 11)) issue("flow_placement_invalid", `${path}.placement`, "Flow placement must be 0..11");
	if (String(beat.type) === "obstacle" && (!Number.isFinite(beat.end) || !Array.isArray(beat.cells) || beat.cells.length === 0 || beat.cells.some((cell) => !integerRange(cell, 0, 11)))) issue("flow_obstacle_invalid", path, "Flow obstacle is invalid");
	if (String(beat.type) === "arc" && (!Number.isFinite(beat.end) || !integerRange(beat.startPlacement, 0, 11) || !integerRange(beat.endPlacement, 0, 11) || !Number.isInteger(beat.startDirection) || !Number.isInteger(beat.endDirection))) issue("flow_arc_invalid", path, "Flow arc is invalid");
	if (String(beat.type) === "burst" && (!Number.isFinite(beat.end) || !integerRange(beat.placement, 0, 11) || !integerRange(beat.tailPlacement, 0, 11) || !Number.isInteger(beat.checkpointCount) || Number(beat.checkpointCount) < 1)) issue("flow_burst_invalid", path, "Flow burst is invalid");
}
/** @param {unknown} value */
function nonEmpty(value) {
	return typeof value === "string" && value.trim().length > 0;
}
/** @param {unknown} value */
function validHash$1(value) {
	return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}
/** @param {unknown} value @param {number} minimum @param {number} maximum */
function integerRange(value, minimum, maximum) {
	return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}
//#endregion
//#region ../aerobeat-web-content-authoring/src/worker-protocol.js
/** @typedef {Parameters<typeof convertDifficulty>[1]} WorkerConversionOptions */
/** @typedef {"v2" | "v3" | "v4"} BeatMapFormat */
/**
* Execute one strictly narrowed structured-clone-safe conversion request.
*
* @param {unknown} request
* @param {{signal?: AbortSignal, onProgress?: (progress: number, phase: string) => void}} [runtime]
*/
async function executeWorkerConversion(request, runtime = {}) {
	const normalized = narrowRequest(request);
	if (normalized.options.converterProfile) normalized.options.converterProfile = await normalizeConverterProfile(normalized.options.converterProfile);
	checkAbort(runtime.signal);
	safeProgress(runtime.onProgress, .05, "parsing");
	const sourceSummary = parseBeatMapDifficulty(normalized.difficultyBytes, normalized.format);
	const exactDifficultyHash = await prefixedSha256(normalized.difficultyBytes);
	if (normalized.options.sourceDifficultyHash && normalized.options.sourceDifficultyHash !== exactDifficultyHash) throw workerError("difficulty_hash_mismatch", "Worker difficulty bytes do not match the verified source hash");
	normalized.options.sourceDifficultyHash = exactDifficultyHash;
	checkAbort(runtime.signal);
	const converted = await convertDifficulty(sourceSummary, normalized.options, (progress, phase) => {
		checkAbort(runtime.signal);
		safeProgress(runtime.onProgress, progress, phase);
	});
	checkAbort(runtime.signal);
	const validation = await validateAuthoredPackage(converted.package);
	if (!validation.valid) throw workerError("package_validation_failed", validation.issues.map((entry) => entry.code).join(", "));
	safeProgress(runtime.onProgress, .9, "validating");
	const parityHash = await semanticParityHash(converted.package);
	return deepFreeze$1({
		schema: "aerobeat/authoring_worker_result",
		version: 1,
		jobId: normalized.jobId,
		package: cloneData(converted.package),
		packageHash: validation.packageHash,
		sourceHash: converted.sourceHash,
		semanticParityHash: parityHash,
		traces: cloneData(converted.traces)
	});
}
function createInlineAuthoringWorkerAdapter() {
	let destroyed = false;
	return Object.freeze({
		kind: "inline",
		/** @param {unknown} request @param {{signal?: AbortSignal, onProgress?: (progress: number, phase: string) => void}} [runtime] */
		async convert(request, runtime = {}) {
			if (destroyed) throw workerError("worker_destroyed", "Worker adapter is destroyed");
			await Promise.resolve();
			if (destroyed) throw workerError("worker_destroyed", "Worker adapter is destroyed");
			return executeWorkerConversion(request, runtime);
		},
		destroy() {
			destroyed = true;
		}
	});
}
/**
* Browser module Worker adapter. Every request owns a disposable Worker.
*
* @param {{workerFactory?: () => Worker}} [options]
*/
function createBrowserAuthoringWorkerAdapter(options = {}) {
	const workerFactory = options.workerFactory ?? (() => new Worker(new URL(
		/* @vite-ignore */
		"/assets/conversion-worker-sPG0jOSc.js",
		"" + import.meta.url
	), {
		type: "module",
		name: "aerobeat-content-authoring"
	}));
	/** @type {Set<() => void>} */
	const cancelActive = /* @__PURE__ */ new Set();
	let destroyed = false;
	return Object.freeze({
		kind: "worker",
		/** @param {unknown} request @param {{signal?: AbortSignal, onProgress?: (progress: number, phase: string) => void}} [runtime] */
		convert(request, runtime = {}) {
			if (destroyed) return Promise.reject(workerError("worker_destroyed", "Worker adapter is destroyed"));
			let expectedJobId = "";
			try {
				expectedJobId = narrowRequest(request).jobId;
			} catch (error) {
				return Promise.reject(error);
			}
			return new Promise((resolve, reject) => {
				let worker;
				try {
					worker = workerFactory();
				} catch (cause) {
					reject(workerError("worker_failed", diagnostic("Worker creation failed", cause)));
					return;
				}
				let settled = false;
				const finish = (action, value) => {
					if (settled) return;
					settled = true;
					runtime.signal?.removeEventListener("abort", abort);
					cancelActive.delete(cancel);
					worker.terminate();
					action(value);
				};
				const abort = () => finish(reject, workerError("operation_aborted", "Conversion was cancelled"));
				const cancel = () => finish(reject, workerError("worker_destroyed", "Worker adapter is destroyed"));
				cancelActive.add(cancel);
				runtime.signal?.addEventListener("abort", abort, { once: true });
				worker.onmessage = (event) => {
					const message = narrowWorkerMessage(event.data, expectedJobId);
					if (!message) {
						finish(reject, workerError("worker_protocol_invalid", "Worker returned an invalid or mismatched message"));
						return;
					}
					if (message.kind === "progress") safeProgress(runtime.onProgress, Number(message.progress), String(message.phase));
					else if (message.kind === "result") finish(resolve, message.result);
					else finish(reject, workerError(String(message.code), String(message.message)));
				};
				worker.onerror = (event) => finish(reject, workerError("worker_failed", event.message || "Worker conversion failed"));
				let clone;
				try {
					clone = cloneData(request);
				} catch (cause) {
					finish(reject, workerError("worker_request_invalid", diagnostic("Worker request could not be cloned", cause)));
					return;
				}
				const bytes = isPlainRecord$1(clone) && clone.difficultyBytes instanceof Uint8Array ? clone.difficultyBytes : null;
				try {
					worker.postMessage(clone, bytes ? [bytes.buffer] : []);
				} catch (cause) {
					finish(reject, workerError("worker_failed", diagnostic("Worker request could not be posted", cause)));
					return;
				}
				if (runtime.signal?.aborted) abort();
			});
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			for (const cancel of [...cancelActive]) cancel();
			cancelActive.clear();
		}
	});
}
/** @param {unknown} request @returns {{jobId: string, difficultyBytes: Uint8Array, format: BeatMapFormat, options: WorkerConversionOptions}} */
function narrowRequest(request) {
	if (!hasExactDataKeys(request, [
		"schema",
		"version",
		"kind",
		"jobId",
		"manifest",
		"difficultyBytes",
		"options"
	])) throw workerError("worker_request_invalid", "Worker request shape is invalid");
	const record = request;
	if (record.schema !== "aerobeat/authoring_worker_request" || record.version !== 1 || record.kind !== "convert" || !boundedString$1(record.jobId, 128) || !record.jobId || !(record.difficultyBytes instanceof Uint8Array) || record.difficultyBytes.byteLength > 67108864) throw workerError("worker_request_invalid", "Worker request shape is invalid");
	if (!hasExactDataKeys(record.manifest, [
		"schemaId",
		"sourceFormatMajor",
		"infoPath",
		"songName",
		"songAuthorName",
		"levelAuthorName",
		"bpm",
		"audioPath",
		"audioContentHash",
		"selectedDifficulty",
		"sourceProvider",
		"sourceId",
		"sourceVersionHash"
	])) throw workerError("worker_request_invalid", "Worker manifest shape is invalid");
	const manifest = record.manifest;
	if (manifest.schemaId !== "aerobeat.authoring-source.v1" || !Number.isInteger(manifest.sourceFormatMajor) || ![
		2,
		3,
		4
	].includes(Number(manifest.sourceFormatMajor)) || typeof manifest.bpm !== "number" || !Number.isFinite(manifest.bpm) || manifest.bpm <= 0) throw workerError("worker_request_invalid", "Worker manifest values are invalid");
	for (const field of [
		"infoPath",
		"songName",
		"songAuthorName",
		"levelAuthorName",
		"audioPath",
		"sourceProvider",
		"sourceId",
		"sourceVersionHash"
	]) if (typeof manifest[field] !== "string" || String(manifest[field]).length > 1024) throw workerError("worker_request_invalid", "Worker manifest text is invalid");
	if (!optionalHash(manifest.audioContentHash)) throw workerError("worker_request_invalid", "Worker manifest audio hash is invalid");
	if (!hasExactDataKeys(manifest.selectedDifficulty, [
		"difficulty",
		"path",
		"contentHash"
	])) throw workerError("worker_request_invalid", "Worker selected difficulty shape is invalid");
	const selected = manifest.selectedDifficulty;
	if (!boundedString$1(selected.difficulty, 64) || !selected.difficulty || !boundedString$1(selected.path, 1024) || !selected.path || !validHash(selected.contentHash)) throw workerError("worker_request_invalid", "Worker selected difficulty values are invalid");
	const requiredOptions = [
		"difficulty",
		"songToken",
		"songName",
		"bpm",
		"sourceProvider",
		"sourceId",
		"sourceVersionHash",
		"sourceDifficultyPath",
		"sourceBeatmapVersion",
		"sourceDifficultyHash",
		"audioPath",
		"audioContentHash",
		"modifiers"
	];
	if (!hasOnlyDataKeys(record.options, requiredOptions, ["presentationSuggestion", "converterProfile"]) || !requiredOptions.every((key) => Object.hasOwn(record.options, key))) throw workerError("worker_request_invalid", "Worker conversion options are invalid");
	const conversionOptions = record.options;
	for (const field of [
		"difficulty",
		"songToken",
		"songName",
		"sourceProvider",
		"sourceId",
		"sourceVersionHash",
		"sourceDifficultyPath",
		"sourceBeatmapVersion",
		"audioPath"
	]) if (!boundedString$1(conversionOptions[field], 1024)) throw workerError("worker_request_invalid", "Worker conversion text is invalid");
	if (typeof conversionOptions.bpm !== "number" || !Number.isFinite(conversionOptions.bpm) || conversionOptions.bpm <= 0 || !validHash(conversionOptions.sourceDifficultyHash) || !optionalHash(conversionOptions.audioContentHash)) throw workerError("worker_request_invalid", "Worker conversion values are invalid");
	const modifiers = denseStringArray(conversionOptions.modifiers, supportedModifiers.length);
	if (new Set(modifiers).size !== modifiers.length || modifiers.some((value) => !supportedModifiers.includes(value))) throw workerError("worker_request_invalid", "Worker modifiers are invalid");
	const audioMatches = conversionOptions.audioPath === manifest.audioPath && conversionOptions.audioContentHash === manifest.audioContentHash || conversionOptions.audioPath === "" && conversionOptions.audioContentHash === "";
	if (conversionOptions.difficulty !== selected.difficulty || conversionOptions.sourceDifficultyPath !== selected.path || conversionOptions.sourceDifficultyHash !== selected.contentHash || conversionOptions.bpm !== manifest.bpm || conversionOptions.sourceProvider !== manifest.sourceProvider || conversionOptions.sourceId !== manifest.sourceId || conversionOptions.sourceVersionHash !== manifest.sourceVersionHash || !audioMatches) throw workerError("worker_request_invalid", "Worker options do not match the inspected manifest");
	if (Object.hasOwn(conversionOptions, "presentationSuggestion")) {
		if (!isPlainRecord$1(conversionOptions.presentationSuggestion)) throw workerError("worker_request_invalid", "Worker presentation suggestion is invalid");
		let encoded;
		try {
			encoded = canonicalJson(conversionOptions.presentationSuggestion);
		} catch {
			throw workerError("worker_request_invalid", "Worker presentation suggestion must contain plain data");
		}
		if (new TextEncoder().encode(encoded).byteLength > 65536) throw workerError("worker_request_invalid", "Worker presentation suggestion exceeds the size limit");
	}
	if (Object.hasOwn(conversionOptions, "converterProfile") && !converterProfileShape(conversionOptions.converterProfile)) throw workerError("worker_request_invalid", "Worker converter profile shape is invalid");
	const major = Number(manifest.sourceFormatMajor);
	const format = major === 2 ? "v2" : major === 3 ? "v3" : "v4";
	return {
		jobId: record.jobId,
		difficultyBytes: Uint8Array.from(record.difficultyBytes),
		format,
		options: cloneData(conversionOptions)
	};
}
/** @param {unknown} value */
function converterProfileShape(value) {
	if (!hasExactDataKeys(value, [
		"schema",
		"version",
		"profileId",
		"profileVersion",
		"class",
		"label",
		"experimental",
		"settings",
		"contentHash"
	])) return false;
	const profile = value;
	if (profile.schema !== "aerobeat/prototype_profile" || profile.version !== 1 || profile.class !== "converter_regeneration" || profile.experimental !== true || !boundedString$1(profile.profileId, 128) || !profile.profileId || !boundedString$1(profile.profileVersion, 64) || !profile.profileVersion || !boundedString$1(profile.label, 256) || !profile.label || typeof profile.contentHash !== "string" || !/^[0-9a-f]{64}$/u.test(profile.contentHash)) return false;
	if (!hasExactDataKeys(profile.settings, ["guardRelocationRadius", "reachAllowanceSubcells"])) return false;
	const settings = profile.settings;
	return Number.isInteger(settings.guardRelocationRadius) && Number(settings.guardRelocationRadius) >= 0 && Number(settings.guardRelocationRadius) <= 8 && Number.isInteger(settings.reachAllowanceSubcells) && Number(settings.reachAllowanceSubcells) >= 0 && Number(settings.reachAllowanceSubcells) <= 8;
}
/** @param {unknown} value @param {string} expectedJobId */
function narrowWorkerMessage(value, expectedJobId) {
	if (!isPlainRecord$1(value) || value.schema !== "aerobeat/authoring_worker_message" || value.version !== 1 || value.jobId !== expectedJobId || ![
		"progress",
		"result",
		"error"
	].includes(String(value.kind))) return null;
	if (value.kind === "progress") return hasExactDataKeys(value, [
		"schema",
		"version",
		"kind",
		"jobId",
		"progress",
		"phase"
	]) && Number.isFinite(value.progress) && Number(value.progress) >= 0 && Number(value.progress) <= 1 && boundedString$1(value.phase, 128) ? value : null;
	if (value.kind === "result") {
		if (!hasExactDataKeys(value, [
			"schema",
			"version",
			"kind",
			"jobId",
			"result"
		]) || !hasExactDataKeys(value.result, [
			"schema",
			"version",
			"jobId",
			"package",
			"packageHash",
			"sourceHash",
			"semanticParityHash",
			"traces"
		])) return null;
		const result = value.result;
		if (result.schema !== "aerobeat/authoring_worker_result" || result.version !== 1 || result.jobId !== expectedJobId || !isPlainRecord$1(result.package) || !validHash(result.packageHash) || !validHash(result.sourceHash) || !validHash(result.semanticParityHash)) return null;
		try {
			const encoded = canonicalJson(result);
			if (new TextEncoder().encode(encoded).byteLength > 67108864) return null;
		} catch {
			return null;
		}
		return value;
	}
	return hasExactDataKeys(value, [
		"schema",
		"version",
		"kind",
		"jobId",
		"code",
		"message"
	]) && boundedString$1(value.code, 128) && boundedString$1(value.message, 4096) ? value : null;
}
/** @param {unknown} value @param {readonly string[]} required */
function hasExactDataKeys(value, required) {
	return hasOnlyDataKeys(value, required, []) && isPlainRecord$1(value) && Reflect.ownKeys(value).length === required.length;
}
/** @param {unknown} value @param {readonly string[]} required @param {readonly string[]} optional */
function hasOnlyDataKeys(value, required, optional) {
	if (!isPlainRecord$1(value)) return false;
	const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== "string" || !allowed.has(key)) return false;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || descriptor.value === void 0) return false;
	}
	return true;
}
/** @param {unknown} value @param {number} maximum */
function boundedString$1(value, maximum) {
	return typeof value === "string" && value.length <= maximum;
}
/** @param {unknown} value */
function validHash(value) {
	return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}
/** @param {unknown} value */
function optionalHash(value) {
	return value === "" || validHash(value);
}
/** @param {unknown} value @param {number} maximum */
function denseStringArray(value, maximum) {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) throw workerError("worker_request_invalid", "Worker array is invalid");
	if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || key !== "length" && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw workerError("worker_request_invalid", "Worker array contains unsupported fields");
	const result = [];
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || typeof descriptor.value !== "string") throw workerError("worker_request_invalid", "Worker array must contain string data properties");
		result.push(descriptor.value);
	}
	return result;
}
/** @param {AbortSignal | undefined} signal */
function checkAbort(signal) {
	if (signal?.aborted) throw workerError("operation_aborted", "Conversion was cancelled");
}
/** @param {((progress:number,phase:string)=>void) | undefined} listener @param {number} progress @param {string} phase */
function safeProgress(listener, progress, phase) {
	try {
		listener?.(Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)), phase);
	} catch {}
}
/** @param {string} message @param {unknown} cause */
function diagnostic(message, cause) {
	if (cause && typeof cause === "object") {
		const descriptor = Object.getOwnPropertyDescriptor(cause, "message");
		if (descriptor && "value" in descriptor && typeof descriptor.value === "string" && descriptor.value) return `${message}: ${descriptor.value.slice(0, 4096)}`;
	}
	return message;
}
/** @param {string} code @param {string} message */
function workerError(code, message) {
	const error = new Error(message);
	error.name = "AeroAuthoringWorkerError";
	Object.assign(error, { code });
	return error;
}
//#endregion
//#region ../aerobeat-web-content-authoring/src/service.js
/** @typedef {ReturnType<typeof createMemoryPersistenceAdapter> | ReturnType<typeof createIndexedDbPersistenceAdapter>} PersistenceAdapter */
/** @typedef {{kind: string, convert: (request: unknown, runtime?: {signal?: AbortSignal, onProgress?: (progress: number, phase: string) => void}) => Promise<unknown>, destroy: () => void}} WorkerAdapter */
/** @typedef {{difficulty:string,modifiers:string[],sourceProvider?:string,sourceId?:string,sourceVersionHash?:string,expectedAudioContentHash?:string,expectedDifficultyContentHashes?:Record<string,string>,presentationSuggestion?:Record<string,unknown>,converterProfile?:Record<string,unknown>,limits?:Record<string,number>,cacheSourceEntries?:boolean,includeAudio?:boolean,signal?:AbortSignal}} NormalizedRequestOptions */
/**
* Create one reconnectable browser content-authoring service instance.
*
* @param {{worker?: WorkerAdapter, persistence?: PersistenceAdapter, useBrowserWorker?: boolean, useIndexedDb?: boolean, now?: () => number, onListenerError?: (error: unknown) => void}} [options]
*/
function createAeroWebContentAuthoringService(options = {}) {
	const ownsWorker = options.worker === void 0;
	const ownsPersistence = options.persistence === void 0;
	const worker = options.worker ?? (options.useBrowserWorker && typeof Worker !== "undefined" ? createBrowserAuthoringWorkerAdapter() : createInlineAuthoringWorkerAdapter());
	const persistence = options.persistence ?? (options.useIndexedDb && globalThis.indexedDB ? createIndexedDbPersistenceAdapter() : createMemoryPersistenceAdapter());
	const now = options.now ?? (() => Date.now());
	const listeners = /* @__PURE__ */ new Set();
	let destroyed = false;
	let sequence = 0;
	/** @type {{jobId: string, generation: number, abort: AbortController} | null} */
	let active = null;
	let snapshot = makeSnapshot("idle-0", "queued", 0, null, null, null, null, null, null);
	return Object.freeze({
		/**
		* Convert, validate and atomically persist one selected source difficulty.
		*
		* @param {unknown} acquired Provider-neutral vendor acquisition/source bundle.
		* @param {{difficulty: string, sourceProvider?: string, sourceId?: string, sourceVersionHash?: string, expectedAudioContentHash?: string, expectedDifficultyContentHashes?: Readonly<Record<string, string>>, modifiers?: readonly string[], presentationSuggestion?: Readonly<Record<string, unknown>>, converterProfile?: Readonly<Record<string, unknown>>, cacheSourceEntries?: boolean, includeAudio?: boolean, limits?: Readonly<Record<string, number>>, signal?: AbortSignal}} requestOptions
		*/
		async convertAndPersist(acquired, requestOptions) {
			assertOpen();
			const normalizedOptions = normalizeRequestOptions(requestOptions);
			const converterProfile = normalizedOptions.converterProfile ? await normalizeConverterProfile(normalizedOptions.converterProfile) : null;
			assertOpen();
			active?.abort.abort();
			const generation = ++sequence;
			const jobId = `authoring-${generation}`;
			const abort = new AbortController();
			active = {
				jobId,
				generation,
				abort
			};
			const externalAbort = () => abort.abort();
			normalizedOptions.signal?.addEventListener("abort", externalAbort, { once: true });
			let persistedKey = "";
			try {
				publish(makeSnapshot(jobId, "inspecting", .04, normalizedOptions.sourceId ?? null, normalizedOptions.sourceVersionHash ?? null, normalizedOptions.difficulty, null, null, null));
				const material = await prepareSourceMaterial(acquired, normalizedOptions);
				checkCurrent(generation, abort.signal);
				const manifest = material.requestManifest;
				const workerRequest = {
					schema: "aerobeat/authoring_worker_request",
					version: 1,
					kind: "convert",
					jobId,
					manifest: cloneData(manifest),
					difficultyBytes: Uint8Array.from(material.difficultyBytes),
					options: {
						difficulty: manifest.selectedDifficulty.difficulty,
						songToken: slug(String(manifest.songName || manifest.sourceId)),
						songName: manifest.songName,
						bpm: manifest.bpm,
						sourceProvider: manifest.sourceProvider,
						sourceId: manifest.sourceId,
						sourceVersionHash: manifest.sourceVersionHash,
						sourceDifficultyPath: manifest.selectedDifficulty.path,
						sourceBeatmapVersion: `v${manifest.sourceFormatMajor}`,
						sourceDifficultyHash: manifest.selectedDifficulty.contentHash,
						audioPath: normalizedOptions.includeAudio === false ? "" : manifest.audioPath,
						audioContentHash: normalizedOptions.includeAudio === false ? "" : manifest.audioContentHash,
						modifiers: [...normalizedOptions.modifiers],
						...converterProfile ? { converterProfile: cloneData(converterProfile) } : {},
						...normalizedOptions.presentationSuggestion ? { presentationSuggestion: cloneData(normalizedOptions.presentationSuggestion) } : {}
					}
				};
				publish(makeSnapshot(jobId, "converting", .1, String(manifest.sourceId), String(manifest.sourceVersionHash), String(manifest.selectedDifficulty.difficulty), null, null, null));
				const result = await worker.convert(workerRequest, {
					signal: abort.signal,
					onProgress(progress, phase) {
						if (!isCurrent(generation)) return;
						publish(makeSnapshot(jobId, phase === "validating" ? "validating" : "converting", bounded$1(progress), String(manifest.sourceId), String(manifest.sourceVersionHash), String(manifest.selectedDifficulty.difficulty), null, null, null));
					}
				});
				checkCurrent(generation, abort.signal);
				if (!isPlainRecord$1(result)) throw authoringError("worker_result_invalid", "Worker did not return a validated package");
				const resultPackage = dataProperty(result, "package");
				const resultPackageHash = dataProperty(result, "packageHash");
				const resultParityHash = dataProperty(result, "semanticParityHash");
				const resultSourceHash = dataProperty(result, "sourceHash");
				if (!isPlainRecord$1(resultPackage) || typeof resultPackageHash !== "string" || typeof resultParityHash !== "string" || typeof resultSourceHash !== "string") throw authoringError("worker_result_invalid", "Worker did not return a validated package");
				const trustedValidation = await validateAuthoredPackage(resultPackage);
				if (!trustedValidation.valid || trustedValidation.packageHash !== resultPackageHash || !await workerResultMatchesManifest(resultPackage, manifest, normalizedOptions.includeAudio !== false, converterProfile, resultParityHash, resultSourceHash)) throw authoringError("worker_result_invalid", "Worker package failed main-thread validation, source/profile/projection binding or hash verification");
				checkCurrent(generation, abort.signal);
				publish(makeSnapshot(jobId, "persisting", .94, String(manifest.sourceId), String(manifest.sourceVersionHash), String(manifest.selectedDifficulty.difficulty), null, null, null));
				const packageRecord = resultPackage;
				const packageIdValue = dataProperty(packageRecord, "packageId");
				if (typeof packageIdValue !== "string") throw authoringError("worker_result_invalid", "Worker package identity is invalid");
				const packageId = packageIdValue;
				persistedKey = `${packageId}@${resultPackageHash.slice(7, 19)}`;
				const assets = normalizedOptions.includeAudio === false ? [] : material.audio;
				await persistence.put({
					key: persistedKey,
					package: cloneData(packageRecord),
					packageHash: resultPackageHash,
					assets,
					sourceCache: material.sourceCache,
					createdAtMs: now(),
					schemaVersion: persistence.schemaVersion,
					writeToken: jobId
				});
				checkCurrent(generation, abort.signal);
				const handle = persistenceHandle(persistence.kind, persistedKey, packageId, resultPackageHash);
				const completed = makeSnapshot(jobId, "complete", 1, String(manifest.sourceId), String(manifest.sourceVersionHash), String(manifest.selectedDifficulty.difficulty), null, null, handle);
				publish(completed);
				active = null;
				return deepFreeze$1({
					job: completed,
					handle,
					package: cloneData(packageRecord),
					semanticParityHash: resultParityHash,
					sourceHash: resultSourceHash
				});
			} catch (cause) {
				if (persistedKey) await persistence.deleteIfToken(persistedKey, jobId).catch(() => false);
				const cancelled = abort.signal.aborted || errorCode$1(cause) === "operation_aborted" || !isCurrent(generation);
				const failed = makeSnapshot(jobId, cancelled ? "cancelled" : "failed", cancelled ? snapshot.progress : 1, snapshot.sourceId, snapshot.sourceVersionHash, normalizedOptions.difficulty, cancelled ? "operation_aborted" : errorCode$1(cause), cancelled ? "Conversion was cancelled" : errorMessage$1(cause), null);
				if (isCurrent(generation)) {
					publish(failed);
					active = null;
				}
				throw cause;
			} finally {
				normalizedOptions.signal?.removeEventListener("abort", externalAbort);
			}
		},
		/**
		* Convert every exact Standard difficulty sequentially and atomically persist one collection.
		* @param {unknown} acquired
		* @param {{sourceProvider?: string, sourceId?: string, sourceVersionHash?: string, expectedAudioContentHash?: string, expectedDifficultyContentHashes?: Readonly<Record<string, string>>, modifiers?: readonly string[], presentationSuggestion?: Readonly<Record<string, unknown>>, converterProfile?: Readonly<Record<string, unknown>>, cacheSourceEntries?: boolean, includeAudio?: boolean, limits?: Readonly<Record<string, number>>, signal?: AbortSignal}} requestOptions
		*/
		async convertAllStandardAndPersist(acquired, requestOptions) {
			assertOpen();
			const normalizedOptions = normalizeBatchRequestOptions(requestOptions);
			if (normalizedOptions.includeAudio === false) throw authoringError("request_invalid", "Batch conversion requires shared audio");
			const converterProfile = normalizedOptions.converterProfile ? await normalizeConverterProfile(normalizedOptions.converterProfile) : null;
			assertOpen();
			active?.abort.abort();
			const generation = ++sequence;
			const jobId = `authoring-${generation}`;
			const abort = new AbortController();
			active = {
				jobId,
				generation,
				abort
			};
			const externalAbort = () => abort.abort();
			normalizedOptions.signal?.addEventListener("abort", externalAbort, { once: true });
			let persistedCollectionId = "";
			try {
				publish(makeSnapshot(jobId, "inspecting", .04, normalizedOptions.sourceId ?? null, normalizedOptions.sourceVersionHash ?? null, null, null, null, null));
				const prepared = await prepareAllStandardSourceMaterials(acquired, normalizedOptions);
				checkCurrent(generation, abort.signal);
				if (!prepared.audioPath || !prepared.audioContentHash || prepared.audio.length !== 1) throw authoringError("audio_required", "Batch conversion requires one verified audio asset");
				const packageRows = [];
				const resultRows = [];
				const packageHashes = [];
				for (let index = 0; index < prepared.materials.length; index += 1) {
					checkCurrent(generation, abort.signal);
					const material = prepared.materials[index];
					const manifest = material.requestManifest;
					const difficulty = String(manifest.selectedDifficulty.difficulty);
					const workerRequest = {
						schema: "aerobeat/authoring_worker_request",
						version: 1,
						kind: "convert",
						jobId: `${jobId}-${index + 1}`,
						manifest: cloneData(manifest),
						difficultyBytes: Uint8Array.from(material.difficultyBytes),
						options: {
							difficulty,
							songToken: slug(String(manifest.songName || manifest.sourceId)),
							songName: manifest.songName,
							bpm: manifest.bpm,
							sourceProvider: manifest.sourceProvider,
							sourceId: manifest.sourceId,
							sourceVersionHash: manifest.sourceVersionHash,
							sourceDifficultyPath: manifest.selectedDifficulty.path,
							sourceBeatmapVersion: `v${manifest.sourceFormatMajor}`,
							sourceDifficultyHash: manifest.selectedDifficulty.contentHash,
							audioPath: manifest.audioPath,
							audioContentHash: manifest.audioContentHash,
							modifiers: [...normalizedOptions.modifiers],
							...converterProfile ? { converterProfile: cloneData(converterProfile) } : {},
							...normalizedOptions.presentationSuggestion ? { presentationSuggestion: cloneData(normalizedOptions.presentationSuggestion) } : {}
						}
					};
					publish(makeSnapshot(jobId, "converting", .1 + index / prepared.materials.length * .8, prepared.sourceId, prepared.sourceVersionHash, difficulty, null, null, null));
					const result = await worker.convert(workerRequest, {
						signal: abort.signal,
						onProgress(progress, phase) {
							if (!isCurrent(generation)) return;
							publish(makeSnapshot(jobId, phase === "validating" ? "validating" : "converting", .1 + (index + bounded$1(progress)) / prepared.materials.length * .8, prepared.sourceId, prepared.sourceVersionHash, difficulty, null, null, null));
						}
					});
					checkCurrent(generation, abort.signal);
					if (!isPlainRecord$1(result)) throw authoringError("worker_result_invalid", "Worker did not return a validated package");
					const resultPackage = dataProperty(result, "package"), resultPackageHash = dataProperty(result, "packageHash"), resultParityHash = dataProperty(result, "semanticParityHash"), resultSourceHash = dataProperty(result, "sourceHash");
					if (!isPlainRecord$1(resultPackage) || typeof resultPackageHash !== "string" || typeof resultParityHash !== "string" || typeof resultSourceHash !== "string") throw authoringError("worker_result_invalid", "Worker did not return a validated package");
					const trustedValidation = await validateAuthoredPackage(resultPackage);
					if (!trustedValidation.valid || trustedValidation.packageHash !== resultPackageHash || !await workerResultMatchesManifest(resultPackage, manifest, true, converterProfile, resultParityHash, resultSourceHash)) throw authoringError("worker_result_invalid", "Worker batch package failed validation or source/profile binding");
					const packageIdValue = dataProperty(resultPackage, "packageId");
					if (typeof packageIdValue !== "string") throw authoringError("worker_result_invalid", "Worker package identity is invalid");
					const key = `${packageIdValue}@${resultPackageHash.slice(7, 19)}`;
					packageRows.push({
						key,
						package: cloneData(resultPackage),
						packageHash: resultPackageHash,
						assets: [],
						sourceCache: material.sourceCache,
						createdAtMs: now(),
						schemaVersion: persistence.schemaVersion,
						writeToken: jobId,
						assetRefs: [{
							path: prepared.audioPath,
							contentHash: prepared.audioContentHash
						}]
					});
					packageHashes.push(resultPackageHash);
					resultRows.push({
						difficultyId: difficulty,
						difficultyLabel: difficulty,
						packageId: packageIdValue,
						handle: persistenceHandle(persistence.kind, key, packageIdValue, resultPackageHash)
					});
				}
				checkCurrent(generation, abort.signal);
				const profileId = converterProfile ? String(converterProfile.profileId) : "aero.converter.legacy";
				const profileHash = converterProfile ? String(converterProfile.contentHash) : "unprofiled";
				persistedCollectionId = `collection:${(await prefixedSha256(canonicalJson({
					sourceProvider: prepared.sourceProvider,
					sourceId: prepared.sourceId,
					sourceVersionHash: prepared.sourceVersionHash,
					converterProfileId: profileId,
					converterProfileHash: profileHash,
					modifierIds: [...normalizedOptions.modifiers],
					packageHashes
				}))).slice(7)}`;
				const collectionRecord = {
					collectionId: persistedCollectionId,
					songName: prepared.songName,
					sourceProvider: prepared.sourceProvider,
					sourceId: prepared.sourceId,
					sourceVersionHash: prepared.sourceVersionHash,
					converterProfileId: profileId,
					converterProfileHash: profileHash,
					modifierIds: [...normalizedOptions.modifiers],
					packageKeys: packageRows.map((row) => row.key),
					packages: resultRows.map((row, index) => ({
						packageKey: packageRows[index].key,
						packageId: row.packageId,
						difficultyId: row.difficultyId,
						difficultyLabel: row.difficultyLabel
					})),
					createdAtMs: now(),
					schemaVersion: persistence.schemaVersion,
					writeToken: jobId
				};
				publish(makeSnapshot(jobId, "persisting", .94, prepared.sourceId, prepared.sourceVersionHash, null, null, null, null));
				const collection = await persistence.putCollection({
					collection: collectionRecord,
					packages: packageRows,
					assets: [{
						contentHash: prepared.audioContentHash,
						bytes: prepared.audio[0].bytes
					}]
				}, { signal: abort.signal });
				checkCurrent(generation, abort.signal);
				const packages = resultRows.map((row) => deepFreeze$1(row));
				const defaultPackage = packages[0];
				publish(makeSnapshot(jobId, "complete", 1, prepared.sourceId, prepared.sourceVersionHash, null, null, null, defaultPackage.handle));
				active = null;
				return deepFreeze$1({
					collection,
					packages,
					defaultPackage
				});
			} catch (cause) {
				if (persistedCollectionId) {
					if ((await persistence.getCollection(persistedCollectionId).catch(() => null))?.writeToken === jobId) await persistence.deleteCollection(persistedCollectionId).catch(() => false);
				}
				const cancelled = abort.signal.aborted || errorCode$1(cause) === "operation_aborted" || !isCurrent(generation);
				const failed = makeSnapshot(jobId, cancelled ? "cancelled" : "failed", cancelled ? snapshot.progress : 1, snapshot.sourceId, snapshot.sourceVersionHash, null, cancelled ? "operation_aborted" : errorCode$1(cause), cancelled ? "Conversion was cancelled" : errorMessage$1(cause), null);
				if (isCurrent(generation)) {
					publish(failed);
					active = null;
				}
				throw cause;
			} finally {
				normalizedOptions.signal?.removeEventListener("abort", externalAbort);
			}
		},
		/** @param {string} [jobId] */
		cancel(jobId) {
			if (active && (!jobId || active.jobId === jobId)) {
				active.abort.abort();
				return true;
			}
			return false;
		},
		getSnapshot() {
			return snapshot;
		},
		/** @param {(snapshot: ReturnType<typeof makeSnapshot>) => void} listener */
		subscribe(listener) {
			assertOpen();
			if (typeof listener !== "function") throw authoringError("listener_invalid", "Listener must be a function");
			listeners.add(listener);
			notify(listener);
			return () => listeners.delete(listener);
		},
		async listPackages() {
			assertOpen();
			return deepFreeze$1(await persistence.list());
		},
		async listCollections() {
			assertOpen();
			return deepFreeze$1(await persistence.listCollections());
		},
		/** @param {string} collectionId */
		async getCollection(collectionId) {
			assertOpen();
			const id = collectionKey(collectionId);
			const collections = await persistence.listCollections();
			assertOpen();
			return collections.find((collection) => collection.collectionId === id) ?? null;
		},
		/** @param {string} collectionId */
		async deleteCollection(collectionId) {
			assertOpen();
			return persistence.deleteCollection(collectionKey(collectionId));
		},
		/** @param {Readonly<Record<string, unknown>> | string} handle */
		async loadPackage(handle) {
			assertOpen();
			const record = await requireRecord(handle);
			return deepFreeze$1({
				handle: persistenceHandle(persistence.kind, record.key, String(record.package.packageId), record.packageHash),
				package: cloneData(record.package),
				assetPaths: Object.freeze(record.assets.map((entry) => entry.path))
			});
		},
		/** @param {Readonly<Record<string, unknown>> | string} handle @param {string} path */
		async readAsset(handle, path) {
			assertOpen();
			if (typeof path !== "string" || !path || path.length > 1024) throw authoringError("asset_path_invalid", "Asset path must be a bounded string");
			const record = await requireRecord(handle);
			const normalized = path.normalize("NFC").replaceAll("\\", "/").toLowerCase();
			const asset = record.assets.find((entry) => entry.path === normalized);
			if (!asset) throw authoringError("asset_not_found", "Authored package asset was not found");
			return Uint8Array.from(asset.bytes);
		},
		/** @param {Readonly<Record<string, unknown>> | string} handle */
		async deletePackage(handle) {
			assertOpen();
			return persistence.delete(keyFor(handle));
		},
		async estimateStorage() {
			assertOpen();
			return persistence.estimate();
		},
		async migrateStorage() {
			assertOpen();
			return persistence.migrate();
		},
		/** @param {Readonly<Record<string, unknown>> | string} handle */
		async exportPackage(handle) {
			assertOpen();
			const record = await requireRecord(handle);
			const exported = await exportAuthoredPackage({
				package: record.package,
				packageHash: record.packageHash,
				assets: record.assets
			});
			return deepFreeze$1({
				fileName: exported.fileName,
				mediaType: exported.mediaType,
				byteLength: exported.byteLength,
				bytes: Uint8Array.from(exported.bytes)
			});
		},
		getCapabilities() {
			return deepFreeze$1({
				providerNeutralSourceInput: true,
				conversionWorker: worker.kind === "worker",
				inlineWorkerFallback: worker.kind === "inline",
				cancellation: true,
				localPersistence: true,
				indexedDb: persistence.kind === "indexeddb",
				packageExport: true,
				sharedArrayBufferRequired: false,
				sourceCacheOptional: true
			});
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			active?.abort.abort();
			active = null;
			if (ownsWorker) worker.destroy();
			if (ownsPersistence) persistence.destroy();
			listeners.clear();
			snapshot = makeSnapshot(`destroyed-${sequence}`, "cancelled", snapshot.progress, snapshot.sourceId, snapshot.sourceVersionHash, snapshot.difficultyId, "service_destroyed", "Authoring service is destroyed", null);
		}
	});
	/** @param {number} generation */
	function isCurrent(generation) {
		return !destroyed && active?.generation === generation;
	}
	/** @param {number} generation @param {AbortSignal} signal */
	function checkCurrent(generation, signal) {
		if (signal.aborted || !isCurrent(generation)) throw authoringError("operation_aborted", "Conversion was cancelled");
	}
	/** @param {ReturnType<typeof makeSnapshot>} next */
	function publish(next) {
		snapshot = next;
		for (const listener of [...listeners]) notify(listener);
	}
	/** @param {(snapshot: ReturnType<typeof makeSnapshot>) => void} listener */
	function notify(listener) {
		try {
			listener(snapshot);
		} catch (error) {
			try {
				options.onListenerError?.(error);
			} catch {}
		}
	}
	function assertOpen() {
		if (destroyed) throw authoringError("service_destroyed", "Authoring service is destroyed");
	}
	/** @param {Readonly<Record<string, unknown>> | string} handle */
	async function requireRecord(handle) {
		const key = keyFor(handle);
		const record = await persistence.get(key);
		assertOpen();
		if (!record) throw authoringError("package_not_found", "Authored package was not found");
		return record;
	}
}
/** @param {string} jobId @param {"queued" | "acquiring" | "inspecting" | "converting" | "validating" | "persisting" | "complete" | "cancelled" | "failed"} state @param {number} progress @param {string | null} sourceId @param {string | null} sourceVersionHash @param {string | null} difficultyId @param {string | null} errorCodeValue @param {string | null} errorMessageValue @param {Readonly<Record<string, unknown>> | null} result */
function makeSnapshot(jobId, state, progress, sourceId, sourceVersionHash, difficultyId, errorCodeValue, errorMessageValue, result) {
	return deepFreeze$1({
		schema: "aerobeat/content_import_job_snapshot",
		version: 1,
		jobId,
		state,
		progress: bounded$1(progress),
		sourceId,
		sourceVersionHash,
		difficultyId,
		errorCode: errorCodeValue,
		errorMessage: errorMessageValue,
		result
	});
}
/** @param {string} storage @param {string} key @param {string} packageId @param {string} packageHash */
function persistenceHandle(storage, key, packageId, packageHash) {
	const [algorithm, value] = packageHash.split(":");
	return deepFreeze$1({
		schema: "aerobeat/persistence_handle",
		version: 1,
		storage: storage === "indexeddb" ? "indexeddb" : "memory",
		namespace: authoringPersistenceNamespace,
		key,
		packageId,
		packageHash: {
			schema: "aerobeat/content_hash",
			version: 1,
			algorithm,
			value
		}
	});
}
/** @param {Readonly<Record<string, unknown>> | string} handle */
function keyFor(handle) {
	if (typeof handle === "string" && handle.length <= 1024 && handle) return handle;
	if (isPlainRecord$1(handle)) {
		const key = dataProperty(handle, "key");
		if (typeof key === "string" && key && key.length <= 1024) return key;
	}
	throw authoringError("handle_invalid", "Persistence handle is invalid");
}
/** @param {unknown} value */
function collectionKey(value) {
	if (typeof value !== "string" || !value || value.length > 1024) throw authoringError("collection_invalid", "Collection identity must be a bounded string");
	return value;
}
/** @param {number} value */
function bounded$1(value) {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
/** @param {string} value */
function slug(value) {
	return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "imported";
}
/** @param {unknown} cause */
function errorCode$1(cause) {
	if (cause && typeof cause === "object") {
		const descriptor = Object.getOwnPropertyDescriptor(cause, "code");
		if (descriptor && "value" in descriptor && typeof descriptor.value === "string" && descriptor.value.length <= 128) return descriptor.value;
	}
	return "authoring_failed";
}
/** @param {unknown} cause */
function errorMessage$1(cause) {
	if (cause && typeof cause === "object") {
		const descriptor = Object.getOwnPropertyDescriptor(cause, "message");
		if (descriptor && "value" in descriptor && typeof descriptor.value === "string" && descriptor.value.length <= 4096) return descriptor.value;
	}
	return "Content authoring failed";
}
/** @param {Record<string,unknown>} packageValue @param {Record<string,unknown>} manifest @param {boolean} includeAudio @param {Readonly<Record<string,unknown>> | null} converterProfile @param {string} workerParityHash @param {string} workerSourceHash */
async function workerResultMatchesManifest(packageValue, manifest, includeAudio, converterProfile, workerParityHash, workerSourceHash) {
	const source = dataProperty(packageValue, "source"), selected = dataProperty(manifest, "selectedDifficulty"), song = dataProperty(packageValue, "song");
	if (!isPlainRecord$1(source) || !isPlainRecord$1(selected) || !isPlainRecord$1(song)) return false;
	if (dataProperty(source, "provider") !== dataProperty(manifest, "sourceProvider") || dataProperty(source, "sourceId") !== dataProperty(manifest, "sourceId") || dataProperty(source, "sourceVersionHash") !== dataProperty(manifest, "sourceVersionHash") || dataProperty(source, "difficulty") !== dataProperty(selected, "difficulty") || dataProperty(source, "sourceDifficultyPath") !== dataProperty(selected, "path") || dataProperty(source, "sourceHash") !== workerSourceHash) return false;
	const charts = dataProperty(packageValue, "charts");
	if (!Array.isArray(charts) || charts.some((chart) => !isPlainRecord$1(chart) || dataProperty(chart, "difficulty") !== dataProperty(selected, "difficulty"))) return false;
	const conversionTrace = dataProperty(packageValue, "conversionTrace"), boxing = isPlainRecord$1(conversionTrace) ? dataProperty(conversionTrace, "boxing") : null, flow = isPlainRecord$1(conversionTrace) ? dataProperty(conversionTrace, "flow") : null;
	if (!Array.isArray(boxing) || boxing.length !== 4 || boxing.some((trace) => !isPlainRecord$1(trace) || dataProperty(trace, "sourceDifficultyPath") !== dataProperty(selected, "path") || dataProperty(trace, "sourceDifficultyHash") !== dataProperty(selected, "contentHash") || dataProperty(trace, "sourceBeatmapVersion") !== `v${String(dataProperty(manifest, "sourceFormatMajor"))}` || dataProperty(trace, "sourceHash") !== workerSourceHash) || !Array.isArray(flow) || flow.some((trace) => !isPlainRecord$1(trace) || dataProperty(trace, "converterProfile") !== void 0)) return false;
	const expectedProfile = converterProfile ? canonicalJson(converterProfile) : null;
	const sourceProfile = dataProperty(source, "converterProfile"), traceProfile = isPlainRecord$1(conversionTrace) ? dataProperty(conversionTrace, "converterProfile") : void 0;
	try {
		if (converterProfile) {
			if (canonicalJson(sourceProfile) !== expectedProfile || canonicalJson(traceProfile) !== expectedProfile || boxing.some((trace) => canonicalJson(dataProperty(trace, "converterProfile")) !== expectedProfile) || charts.some((chart) => dataProperty(chart, "mode") === "boxing" && (!isPlainRecord$1(dataProperty(chart, "prototype")) || canonicalJson(dataProperty(dataProperty(chart, "prototype"), "converterProfile")) !== expectedProfile))) return false;
		} else if (sourceProfile !== void 0 || traceProfile !== void 0 || boxing.some((trace) => dataProperty(trace, "converterProfile") !== void 0) || charts.some((chart) => isPlainRecord$1(dataProperty(chart, "prototype")) && dataProperty(dataProperty(chart, "prototype"), "converterProfile") !== void 0)) return false;
		if (await semanticParityHash(packageValue) !== workerParityHash) return false;
	} catch {
		return false;
	}
	const audio = dataProperty(song, "audio"), audioPath = dataProperty(manifest, "audioPath"), audioHash = dataProperty(manifest, "audioContentHash");
	if (includeAudio && typeof audioPath === "string" && audioPath && typeof audioHash === "string" && audioHash) return isPlainRecord$1(audio) && dataProperty(audio, "filePath") === audioPath && dataProperty(audio, "contentHash") === audioHash;
	return audio === void 0;
}
/** @param {unknown} value @returns {Readonly<NormalizedRequestOptions>} */
function normalizeRequestOptions(value) {
	if (!isPlainRecord$1(value)) throw authoringError("request_invalid", "Authoring options must be a plain record");
	const allowed = /* @__PURE__ */ new Set([
		"difficulty",
		"sourceProvider",
		"sourceId",
		"sourceVersionHash",
		"expectedAudioContentHash",
		"expectedDifficultyContentHashes",
		"modifiers",
		"presentationSuggestion",
		"converterProfile",
		"cacheSourceEntries",
		"includeAudio",
		"limits",
		"signal"
	]);
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== "string" || !allowed.has(key)) throw authoringError("request_invalid", "Authoring options contain an unknown field");
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || descriptor.value === void 0) throw authoringError("request_invalid", "Authoring options must contain enumerable data properties");
	}
	const difficulty = dataProperty(value, "difficulty");
	if (typeof difficulty !== "string" || !difficulty || difficulty.length > 64) throw authoringError("request_invalid", "Difficulty must be a bounded string");
	/** @type {NormalizedRequestOptions} */
	const result = {
		difficulty,
		modifiers: []
	};
	for (const field of [
		"sourceProvider",
		"sourceId",
		"sourceVersionHash",
		"expectedAudioContentHash"
	]) {
		const entry = dataProperty(value, field);
		if (entry !== void 0) {
			if (typeof entry !== "string" || entry.length > 512) throw authoringError("request_invalid", `${field} must be a bounded string`);
			Object.assign(result, { [field]: entry });
		}
	}
	for (const field of ["cacheSourceEntries", "includeAudio"]) {
		const entry = dataProperty(value, field);
		if (entry !== void 0) {
			if (typeof entry !== "boolean") throw authoringError("request_invalid", `${field} must be a boolean`);
			Object.assign(result, { [field]: entry });
		}
	}
	const modifiers = arrayStrings(dataProperty(value, "modifiers") ?? [], supportedModifiers.length, "modifiers");
	for (const modifier of modifiers) if (!supportedModifiers.includes(modifier)) throw authoringError("request_invalid", `Unsupported modifier ${modifier}`);
	result.modifiers = [...new Set(modifiers)].sort();
	for (const field of [
		"expectedDifficultyContentHashes",
		"limits",
		"presentationSuggestion",
		"converterProfile"
	]) {
		const entry = dataProperty(value, field);
		if (entry !== void 0) {
			if (!isPlainRecord$1(entry)) throw authoringError("request_invalid", `${field} must be a plain record`);
			let encoded;
			try {
				encoded = canonicalJson(entry);
			} catch {
				throw authoringError("request_invalid", `${field} must contain plain data only`);
			}
			if (new TextEncoder().encode(encoded).byteLength > 65536) throw authoringError("request_invalid", `${field} exceeds the size limit`);
			Object.assign(result, { [field]: cloneData(entry) });
		}
	}
	const signal = dataProperty(value, "signal");
	if (signal !== void 0) {
		if (typeof AbortSignal === "undefined" || !(signal instanceof AbortSignal)) throw authoringError("request_invalid", "signal must be an AbortSignal");
		Object.assign(result, { signal });
	}
	return Object.freeze(result);
}
/** @param {unknown} value @returns {Readonly<NormalizedRequestOptions>} */
function normalizeBatchRequestOptions(value) {
	if (!isPlainRecord$1(value)) throw authoringError("request_invalid", "Batch authoring options must be a plain record");
	const allowed = /* @__PURE__ */ new Set([
		"sourceProvider",
		"sourceId",
		"sourceVersionHash",
		"expectedAudioContentHash",
		"expectedDifficultyContentHashes",
		"modifiers",
		"presentationSuggestion",
		"converterProfile",
		"cacheSourceEntries",
		"includeAudio",
		"limits",
		"signal"
	]);
	/** @type {Record<string, unknown>} */ const narrowed = { difficulty: "Easy" };
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== "string" || !allowed.has(key)) throw authoringError("request_invalid", "Batch authoring options contain an unknown field");
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || descriptor.value === void 0) throw authoringError("request_invalid", "Batch authoring options must contain enumerable data properties");
		narrowed[key] = descriptor.value;
	}
	return normalizeRequestOptions(narrowed);
}
/** @param {Record<string, unknown>} record @param {string} key */
function dataProperty(record, key) {
	const descriptor = Object.getOwnPropertyDescriptor(record, key);
	return descriptor && "value" in descriptor && descriptor.enumerable ? descriptor.value : void 0;
}
/** @param {unknown} value @param {number} maximum @param {string} field */
function arrayStrings(value, maximum, field) {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) throw authoringError("request_invalid", `${field} must be a bounded ordinary array`);
	if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || key !== "length" && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw authoringError("request_invalid", `${field} contains unsupported fields`);
	const result = [];
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || typeof descriptor.value !== "string") throw authoringError("request_invalid", `${field} must contain string data properties`);
		result.push(descriptor.value);
	}
	return result;
}
/** @param {string} code @param {string} message */
function authoringError(code, message) {
	const error = new Error(message);
	error.name = "AeroContentAuthoringError";
	Object.assign(error, { code });
	return error;
}
//#endregion
//#region ../aerobeat-web-input/src/body-grid-service.js
/** @typedef {import("@aerobeat/web-contracts").AeroPoseRoutingSample} AeroPoseRoutingSample */
/** @typedef {import("@aerobeat/web-contracts").NormalizedPoseFrame} NormalizedPoseFrame */
/** @typedef {import("@aerobeat/web-contracts").NormalizedPoseLandmark} NormalizedPoseLandmark */
/** @typedef {import("@aerobeat/web-contracts").AeroUpperBodyAnchorName} AeroUpperBodyAnchorName */
/** @typedef {import("@aerobeat/web-contracts").AeroBodyGridAnchorSnapshot} AeroBodyGridAnchorSnapshot */
/** @typedef {import("@aerobeat/web-contracts").AeroBodyGridCellEntry} AeroBodyGridCellEntry */
/** @typedef {import("@aerobeat/web-contracts").AeroGameplayEvidenceSnapshot} AeroGameplayEvidenceSnapshot */
/** @typedef {import("@aerobeat/web-contracts").AeroBoxingAction} AeroBoxingAction */
/** @typedef {import("@aerobeat/web-contracts").AeroCalibratedBounds} AeroCalibratedBounds */
/** @type {"aero.input.body-grid"} */
var aeroBodyGridServiceId = "aero.input.body-grid";
/**
* @typedef {Object} AeroBodyGridPadding
* @property {number} left Non-negative fraction of calibrated base width.
* @property {number} right Non-negative fraction of calibrated base width.
* @property {number} top Non-negative fraction of calibrated base height.
* @property {number} bottom Non-negative fraction of calibrated base height.
*/
/**
* @typedef {Object} AeroBodyGridSampleContext
* @property {number} [sourceAspectRatio] Source pixel width divided by height.
* @property {string} [sourceChangeId] Media lifecycle source identity.
*/
/**
* @typedef {Object} AeroStraightQualificationSnapshot
* @property {"left" | "right"} hand Athlete hand.
* @property {number | null} semanticStartTimestampMs Start of uninterrupted measured straight pose.
* @property {number} semanticDurationMs Current semantic straight duration.
* @property {boolean} semanticQualified Whether semantic continuity reached 100ms.
* @property {number | null} spatialStartTimestampMs Start of uninterrupted measured accepted-subcell occupancy.
* @property {number} spatialDurationMs Current spatial straight duration.
* @property {boolean} spatialQualified Whether pose plus accepted-subcell occupancy reached 100ms.
* @property {readonly number[]} acceptedSubcellColumns Accepted 8x6 subcolumns.
*/
/**
* @typedef {Object} AeroBodyGridServiceSnapshot
* @property {"aerobeat/body_grid_service_snapshot"} schema Snapshot schema.
* @property {1} version Snapshot version.
* @property {"aero.input.body-grid"} serviceId Service ID.
* @property {number} timestampMs Latest service timestamp.
* @property {Readonly<Record<string, unknown>>} calibration Public calibration contract plus service display state.
* @property {Readonly<Record<string, unknown>>} tracking Public tracking-safety contract.
* @property {readonly AeroBodyGridAnchorSnapshot[]} anchors Latest measured anchors against retained geometry.
* @property {readonly AeroBodyGridCellEntry[]} entries Entries produced by the latest measurement.
* @property {AeroGameplayEvidenceSnapshot | null} latestEvidence Latest valid measured evidence.
* @property {readonly AeroStraightQualificationSnapshot[]} straightQualifications Measured continuity state.
* @property {boolean} retainedGeometryDimmed Whether retained geometry must be displayed dimmed.
* @property {boolean} countdownFrozen Whether tracking safety freezes countdown time.
* @property {string | null} sourceIdentity Current source/mirror/aspect identity.
* @property {Readonly<{sampleCount: number, latestTargetTimestampMs: number | null}>} predictedDiagnostics Separate non-scoring prediction diagnostics.
*/
/**
* @typedef {Object} AeroBodyGridService
* @property {"aero.input.body-grid"} serviceId Service ID.
* @property {(sample: AeroPoseRoutingSample | NormalizedPoseFrame, context?: AeroBodyGridSampleContext) => AeroBodyGridServiceSnapshot} processPoseSample Process one measured or explicitly predicted sample.
* @property {(timestampMs: number) => AeroBodyGridServiceSnapshot} advanceTime Detect no-frame tracking loss without inventing pose evidence.
* @property {(reason?: string) => AeroBodyGridServiceSnapshot} resetCalibration Explicitly invalidate and retain dim geometry pending replacement.
* @property {(timestampMs: number, maximumAgeMs?: number) => AeroGameplayEvidenceSnapshot | null} getFreshEvidence Return current measured evidence only when safe and fresh.
* @property {() => readonly AeroGameplayEvidenceSnapshot[]} getEvidenceHistory Return bounded immutable measured history.
* @property {() => AeroBodyGridServiceSnapshot} getSnapshot Return latest immutable snapshot.
* @property {(listener: (snapshot: AeroBodyGridServiceSnapshot) => void) => () => void} subscribe Subscribe to immutable snapshots.
* @property {() => void} destroy Destroy session-only state and subscribers.
*/
/** @typedef {{semanticStart: number | null, semanticLast: number | null, spatialStart: number | null, spatialLast: number | null}} StraightState */
/** @typedef {{point: {x: number, y: number} | null, cell: import("@aerobeat/web-contracts").AeroGridCellRef | null, subcell: import("@aerobeat/web-contracts").AeroGridCellRef | null}} AnchorHistory */
/** @typedef {{timestampMs: number, x: number, y: number}} WristMotionPoint */
var bodyGridInstanceSequence = 0;
/**
* Create one session-only calibrated body-grid service per game instance.
*
* @param {{
*   sourceAspectRatio?: number,
*   padding?: Partial<AeroBodyGridPadding>,
*   hysteresisRatio?: number,
*   historyCapacity?: number,
*   directionHistoryWindowMs?: number,
*   directionMinimumMagnitude?: number,
*   calibrationIdPrefix?: string,
*   onListenerError?: (error: unknown) => void
* }} [options] Service options.
* @returns {AeroBodyGridService} Service.
*/
function createAeroBodyGridService(options = {}) {
	const defaultAspect = positive(options.sourceAspectRatio, 16 / 9);
	const padding = normalizePadding(options.padding);
	const hysteresisRatio = bounded(options.hysteresisRatio, .025, 0, .2);
	const historyCapacity = Math.max(8, Math.trunc(positive(options.historyCapacity, 120)));
	const directionHistoryWindowMs = bounded(options.directionHistoryWindowMs, 180, 40, 500);
	const directionMinimumMagnitude = bounded(options.directionMinimumMagnitude, .12, .01, 2);
	const instanceId = options.calibrationIdPrefix ?? `body-grid-${++bodyGridInstanceSequence}`;
	const onListenerError = typeof options.onListenerError === "function" ? options.onListenerError : null;
	/** @type {Set<(snapshot: AeroBodyGridServiceSnapshot) => void>} */
	const listeners = /* @__PURE__ */ new Set();
	/** @type {AeroGameplayEvidenceSnapshot[]} */
	const evidenceHistory = [];
	/** @type {Map<AeroUpperBodyAnchorName, AnchorHistory>} */
	const anchorHistory = /* @__PURE__ */ new Map();
	/** @type {Map<"left" | "right", WristMotionPoint[]>} */
	const wristMotionHistories = /* @__PURE__ */ new Map([["left", []], ["right", []]]);
	/** @type {Map<"left" | "right", StraightState>} */
	const straightStates = /* @__PURE__ */ new Map([["left", emptyStraightState()], ["right", emptyStraightState()]]);
	/** @type {NormalizedPoseLandmark[][]} */
	let holdFrames = [];
	let holdStartedAt = null;
	let cooldownUntil = 0;
	let releaseObserved = true;
	let calibrationSequence = 0;
	let calibrationId = null;
	let bounds = null;
	let baselineNose = null;
	let calibrationState = "uncalibrated";
	let readiness = "calibration_required";
	let invalidationReason = null;
	let sourceIdentity = null;
	let sourceAspect = defaultAspect;
	let timestampMs = 0;
	let lossStartedAt = null;
	let lastMeasuredAt = null;
	let lastMeasuredSourceFrameKey = null;
	let lossDurationMs = 0;
	let allRequiredAnchorsVisible = false;
	let trackingPaused = false;
	let freshCalibrationRequired = true;
	let latestEvidence = null;
	/** @type {AeroBodyGridAnchorSnapshot[]} */
	let latestAnchors = [];
	/** @type {AeroBodyGridCellEntry[]} */
	let latestEntries = [];
	let predictedSampleCount = 0;
	let latestPredictedTimestamp = null;
	let destroyed = false;
	let latestSnapshot = buildSnapshot();
	/** @returns {AeroBodyGridServiceSnapshot} */
	function buildSnapshot() {
		const holdProgressMs = holdStartedAt === null ? 0 : Math.min(calibrationDefaults.holdDurationMs, Math.max(0, timestampMs - holdStartedAt));
		const cooldownRemainingMs = Math.max(0, cooldownUntil - timestampMs);
		const calibration = {
			schema: "aerobeat/calibration_snapshot",
			version: 1,
			state: destroyed ? "invalidated" : calibrationState,
			readiness: destroyed ? "destroyed" : readiness,
			calibrationId,
			timestampMs,
			holdDurationMs: calibrationDefaults.holdDurationMs,
			holdProgressMs,
			cooldownRemainingMs,
			releaseRequired: !releaseObserved,
			bounds,
			grid: athleteBodyGrid4x3,
			subgrid: athleteBodySubgrid8x6,
			invalidationReason
		};
		const tracking = {
			schema: "aerobeat/tracking_safety_snapshot",
			version: 1,
			timestampMs,
			lossThresholdMs: calibrationDefaults.trackingLossPauseMs,
			lossDurationMs,
			allRequiredAnchorsVisible,
			gameplayPaused: trackingPaused,
			freshCalibrationRequired
		};
		return deepFreeze({
			schema: "aerobeat/body_grid_service_snapshot",
			version: 1,
			serviceId: aeroBodyGridServiceId,
			timestampMs,
			calibration,
			tracking,
			anchors: latestAnchors,
			entries: latestEntries,
			latestEvidence,
			straightQualifications: qualificationSnapshots(timestampMs, straightStates),
			retainedGeometryDimmed: bounds !== null && (freshCalibrationRequired || calibrationState === "recalibrating" || calibrationState === "tracking_lost" || calibrationState === "invalidated"),
			countdownFrozen: trackingPaused,
			sourceIdentity,
			predictedDiagnostics: {
				sampleCount: predictedSampleCount,
				latestTargetTimestampMs: latestPredictedTimestamp
			}
		});
	}
	/** @returns {AeroBodyGridServiceSnapshot} */
	function publish() {
		latestSnapshot = buildSnapshot();
		for (const listener of [...listeners]) notifyListener(listener, latestSnapshot);
		return latestSnapshot;
	}
	/** @param {(snapshot: AeroBodyGridServiceSnapshot) => void} listener @param {AeroBodyGridServiceSnapshot} snapshot */
	function notifyListener(listener, snapshot) {
		try {
			listener(snapshot);
		} catch (error) {
			if (onListenerError !== null) try {
				onListenerError(error);
			} catch {}
		}
	}
	/** @param {string} reason */
	function invalidateCalibration(reason) {
		calibrationState = reason === "tracking_lost" ? "tracking_lost" : "invalidated";
		readiness = reason === "tracking_lost" ? "paused_tracking" : "calibration_required";
		invalidationReason = reason;
		freshCalibrationRequired = true;
		latestEvidence = null;
		latestEntries = [];
		holdStartedAt = null;
		holdFrames = [];
		releaseObserved = true;
		cooldownUntil = 0;
		resetMeasuredHistories();
	}
	/** @param {number} sampleTimestamp */
	function triggerTrackingPause(sampleTimestamp) {
		timestampMs = Math.max(timestampMs, sampleTimestamp);
		trackingPaused = true;
		lossDurationMs = Math.max(calibrationDefaults.trackingLossPauseMs, lossDurationMs);
		invalidateCalibration("tracking_lost");
	}
	/** @param {AeroPoseRoutingSample | NormalizedPoseFrame} input @param {AeroBodyGridSampleContext} context */
	function processPoseSample(input, context = {}) {
		if (destroyed) return latestSnapshot;
		const sample = normalizeSample(input);
		if (sample === null) return latestSnapshot;
		if (sample.provenance === "predicted") {
			predictedSampleCount += 1;
			latestPredictedTimestamp = sample.targetTimestampMs;
			return publish();
		}
		if (lastMeasuredAt !== null && sample.measurementTimestampMs < lastMeasuredAt) {
			resetWristMotionHistories();
			return latestSnapshot;
		}
		if (lastMeasuredAt !== null && sample.measurementTimestampMs === lastMeasuredAt || `${sample.sourceId}\u0000${sample.measuredSourceFrameId}` === lastMeasuredSourceFrameKey) return latestSnapshot;
		if (lastMeasuredAt !== null && sample.measurementTimestampMs - lastMeasuredAt >= calibrationDefaults.trackingLossPauseMs) {
			lossStartedAt = lastMeasuredAt;
			lossDurationMs = sample.measurementTimestampMs - lastMeasuredAt;
			triggerTrackingPause(sample.measurementTimestampMs);
		}
		timestampMs = Math.max(timestampMs, sample.measurementTimestampMs);
		lastMeasuredAt = sample.measurementTimestampMs;
		lastMeasuredSourceFrameKey = `${sample.sourceId}\u0000${sample.measuredSourceFrameId}`;
		const nextAspect = positive(context.sourceAspectRatio, sourceAspect);
		const nextSourceIdentity = `media:${context.sourceChangeId ?? ""}|pose:${sample.sourceId}|mirror:${sample.mirrored ? "1" : "0"}|aspect:${nextAspect}`;
		if (sourceIdentity === null) {
			sourceIdentity = nextSourceIdentity;
			sourceAspect = nextAspect;
		} else if (sourceIdentity !== nextSourceIdentity) {
			sourceIdentity = nextSourceIdentity;
			sourceAspect = nextAspect;
			trackingPaused = calibrationId !== null;
			invalidateCalibration("source_changed");
		}
		const landmarks = measuredLandmarkMap(sample);
		allRequiredAnchorsVisible = upperBodyAnchorNames.every((name) => (landmarks.get(name)?.confidence ?? 0) >= calibrationDefaults.requiredConfidence);
		if (allRequiredAnchorsVisible) {
			lossStartedAt = null;
			lossDurationMs = 0;
		} else {
			lossStartedAt ??= sample.measurementTimestampMs;
			lossDurationMs = Math.max(0, sample.measurementTimestampMs - lossStartedAt);
			latestEntries = [];
			resetWristMotionHistories();
			if (lossDurationMs >= calibrationDefaults.trackingLossPauseMs) triggerTrackingPause(sample.measurementTimestampMs);
		}
		updateCalibration(sample, landmarks);
		if (calibrationId !== null && bounds !== null) mapMeasuredAnchors(sample, landmarks);
		else {
			latestAnchors = [];
			latestEntries = [];
		}
		return publish();
	}
	/** @param {AeroPoseRoutingSample} sample @param {Map<string, NormalizedPoseLandmark>} landmarks */
	function updateCalibration(sample, landmarks) {
		const qualified = allRequiredAnchorsVisible && qualifiesTPose(landmarks);
		if (calibrationId !== null && !releaseObserved && !qualified) releaseObserved = true;
		if (calibrationId !== null && timestampMs < cooldownUntil) {
			calibrationState = "cooldown";
			readiness = trackingPaused ? "paused_tracking" : "countdown";
			return;
		}
		if (calibrationId !== null && !releaseObserved) {
			calibrationState = "cooldown";
			readiness = trackingPaused ? "paused_tracking" : "countdown";
			return;
		}
		if (calibrationId !== null && !freshCalibrationRequired && !qualified) {
			calibrationState = "calibrated";
			readiness = "countdown";
			return;
		}
		if (!qualified) {
			holdStartedAt = null;
			holdFrames = [];
			if (freshCalibrationRequired) {
				calibrationState = trackingPaused && !allRequiredAnchorsVisible ? "tracking_lost" : bounds === null ? "uncalibrated" : "recalibrating";
				readiness = trackingPaused ? "paused_tracking" : "calibration_required";
			}
			return;
		}
		if (holdStartedAt === null) {
			holdStartedAt = sample.measurementTimestampMs;
			holdFrames = [];
		}
		holdFrames.push([...landmarks.values()].map((item) => ({ ...item })));
		calibrationState = bounds === null ? "holding" : "recalibrating";
		readiness = trackingPaused ? "paused_tracking" : "calibration_required";
		if (sample.measurementTimestampMs - holdStartedAt < calibrationDefaults.holdDurationMs) return;
		const nextGeometry = calibratedGeometry(averageLandmarks(holdFrames), sourceAspect, padding);
		if (nextGeometry === null) {
			holdStartedAt = null;
			holdFrames = [];
			invalidationReason = "invalid_calibration_geometry";
			return;
		}
		calibrationSequence += 1;
		calibrationId = `${instanceId}-${calibrationSequence}`;
		bounds = nextGeometry.bounds;
		baselineNose = nextGeometry.nose;
		invalidationReason = null;
		freshCalibrationRequired = false;
		trackingPaused = false;
		calibrationState = "cooldown";
		readiness = "countdown";
		releaseObserved = false;
		cooldownUntil = sample.measurementTimestampMs + calibrationDefaults.cooldownDurationMs;
		holdStartedAt = null;
		holdFrames = [];
		resetMeasuredHistories();
	}
	/** @param {AeroPoseRoutingSample} sample @param {Map<string, NormalizedPoseLandmark>} landmarks */
	function mapMeasuredAnchors(sample, landmarks) {
		if (calibrationId === null || bounds === null) return;
		const scoringValid = allRequiredAnchorsVisible && !trackingPaused && !freshCalibrationRequired;
		/** @type {AeroBodyGridAnchorSnapshot[]} */
		const anchors = [];
		/** @type {AeroBodyGridCellEntry[]} */
		const entries = [];
		/** @type {Map<AeroUpperBodyAnchorName, AeroBodyGridAnchorSnapshot>} */
		const byName = /* @__PURE__ */ new Map();
		if (scoringValid) recordWristMotionSamples(sample.measurementTimestampMs, landmarks, bounds);
		else resetWristMotionHistories();
		for (const name of upperBodyAnchorNames) {
			const landmark = landmarks.get(name);
			if (!landmark) continue;
			const raw = normalizeAgainstBounds(cameraPreviewToAthlete(landmark), bounds);
			const history = anchorHistory.get(name) ?? {
				point: null,
				cell: null,
				subcell: null
			};
			const signalValid = scoringValid && landmark.confidence >= calibrationDefaults.requiredConfidence;
			const cell = signalValid ? hystereticGridCell(raw, athleteBodyGrid4x3, history.cell, hysteresisRatio) : null;
			const subcell = signalValid ? hystereticGridCell(raw, athleteBodySubgrid8x6, history.subcell, hysteresisRatio) : null;
			const inGrid = signalValid && normalizedPointToGridCell(raw, athleteBodyGrid4x3) !== null;
			const anchor = {
				schema: "aerobeat/body_grid_anchor_snapshot",
				version: 1,
				anchor: name,
				calibrationId,
				measurementTimestampMs: sample.measurementTimestampMs,
				valid: inGrid,
				confidence: clamp01$1(landmark.confidence),
				rawX: raw.x,
				rawY: raw.y,
				x: inGrid ? raw.x : null,
				y: inGrid ? raw.y : null,
				cell: inGrid ? cell?.id ?? null : null,
				subcell: inGrid ? subcell?.id ?? null : null
			};
			anchors.push(anchor);
			byName.set(name, anchor);
			if ((name === "nose" || name === "left_wrist" || name === "right_wrist") && inGrid && history.cell !== null && cell !== null && history.cell.id !== cell.id && history.point !== null) {
				const direction = name === "nose" ? cardinalDirection(history.point, raw) : rollingWristDirection(name === "left_wrist" ? "left" : "right", sample.measurementTimestampMs);
				const entry = {
					schema: "aerobeat/body_grid_cell_entry",
					version: 1,
					anchor: name,
					calibrationId,
					measurementTimestampMs: sample.measurementTimestampMs,
					fromCell: history.cell.id,
					toCell: cell.id
				};
				entries.push(direction === null ? {
					...entry,
					provenance: "measured"
				} : {
					...entry,
					direction,
					provenance: "measured"
				});
			}
			anchorHistory.set(name, {
				point: inGrid ? raw : null,
				cell: inGrid ? cell : null,
				subcell: inGrid ? subcell : null
			});
		}
		latestAnchors = anchors;
		latestEntries = entries;
		if (!scoringValid) {
			latestEvidence = null;
			resetStraightStates();
			return;
		}
		const actions = detectBoxingActions(sample, landmarks, byName);
		latestEvidence = deepFreeze({
			schema: "aerobeat/gameplay_evidence_snapshot",
			version: 1,
			calibrationId,
			measuredSourceFrameId: sample.measuredSourceFrameId,
			measurementTimestampMs: sample.measurementTimestampMs,
			provenance: "measured",
			activeBoxingActions: actions,
			anchors,
			entries
		});
		evidenceHistory.push(latestEvidence);
		if (evidenceHistory.length > historyCapacity) evidenceHistory.splice(0, evidenceHistory.length - historyCapacity);
	}
	/**
	* @param {AeroPoseRoutingSample} sample
	* @param {Map<string, NormalizedPoseLandmark>} landmarks
	* @param {Map<AeroUpperBodyAnchorName, AeroBodyGridAnchorSnapshot>} anchors
	* @returns {readonly AeroBoxingAction[]}
	*/
	function detectBoxingActions(sample, landmarks, anchors) {
		/** @type {AeroBoxingAction[]} */
		const actions = [];
		for (const hand of ["left", "right"]) {
			const shoulder = landmarks.get(`${hand}_shoulder`);
			const elbow = landmarks.get(`${hand}_elbow`);
			const wrist = landmarks.get(`${hand}_wrist`);
			const wristAnchor = anchors.get(`${hand}_wrist`);
			if (!shoulder || !elbow || !wrist || !wristAnchor?.valid) {
				resetStraightHand(hand);
				continue;
			}
			const elbowAngle = angleDegrees(shoulder, elbow, wrist);
			const athleteElbow = cameraPreviewToAthlete(elbow);
			const athleteWrist = cameraPreviewToAthlete(wrist);
			const dx = athleteWrist.x - athleteElbow.x;
			const dy = athleteWrist.y - athleteElbow.y;
			const straightPose = elbowAngle >= calibrationDefaults.minimumElbowAngleDeg;
			const acceptedColumns = hand === "left" ? [
				2,
				3,
				4
			] : [
				3,
				4,
				5
			];
			const spatialAccepted = straightPose && wristAnchor.subcell !== null && acceptedColumns.includes(wristAnchor.subcell % 8);
			if (updateStraightHand(hand, sample.measurementTimestampMs, straightPose, spatialAccepted).semanticQualified) actions.push(hand === "left" ? "straight_left" : "straight_right");
			else if (elbowAngle < calibrationDefaults.minimumElbowAngleDeg && Math.abs(dx) > Math.abs(dy) * 1.15) actions.push(hand === "left" ? "hook_left" : "hook_right");
			else if (elbowAngle < calibrationDefaults.minimumElbowAngleDeg && dy < 0 && Math.abs(dy) > Math.abs(dx) * 1.05) actions.push(hand === "left" ? "uppercut_left" : "uppercut_right");
		}
		const nose = anchors.get("nose");
		const left = anchors.get("left_wrist");
		const right = anchors.get("right_wrist");
		if (nose?.valid && left?.valid && right?.valid && left.x !== null && left.y !== null && right.x !== null && right.y !== null && nose.x !== null && nose.y !== null) {
			if (Math.max(Math.abs(left.x - nose.x), Math.abs(right.x - nose.x)) <= .38 && Math.max(Math.abs(left.y - nose.y), Math.abs(right.y - nose.y)) <= .34 && Math.abs(left.y - right.y) <= .24) actions.push(left.x > right.x ? "crossed_guard" : "guard");
			if (baselineNose !== null) {
				if (nose.y - baselineNose.y >= .12) actions.push("squat");
				const lateral = nose.x - baselineNose.x;
				if (lateral <= -.12) actions.push("weave_left");
				else if (lateral >= .12) actions.push("weave_right");
			}
		}
		return Object.freeze(actions);
	}
	/** @param {"left" | "right"} hand @param {number} now @param {boolean} semantic @param {boolean} spatial */
	function updateStraightHand(hand, now, semantic, spatial) {
		const state = straightStates.get(hand) ?? emptyStraightState();
		updateContinuity(state, "semanticStart", "semanticLast", now, semantic);
		updateContinuity(state, "spatialStart", "spatialLast", now, spatial);
		straightStates.set(hand, state);
		return {
			semanticQualified: state.semanticStart !== null && now - state.semanticStart >= prototypeJudgementDefaults.straightQualificationMs,
			spatialQualified: state.spatialStart !== null && now - state.spatialStart >= prototypeJudgementDefaults.straightQualificationMs
		};
	}
	/** @param {"left" | "right"} hand */
	function resetStraightHand(hand) {
		straightStates.set(hand, emptyStraightState());
	}
	function resetStraightStates() {
		resetStraightHand("left");
		resetStraightHand("right");
	}
	/** @param {number} atTimestampMs @param {Map<string, NormalizedPoseLandmark>} landmarks @param {AeroCalibratedBounds} calibratedBounds */
	function recordWristMotionSamples(atTimestampMs, landmarks, calibratedBounds) {
		for (const hand of ["left", "right"]) {
			const wrist = landmarks.get(`${hand}_wrist`);
			const shoulder = landmarks.get(`${hand}_shoulder`);
			if (!wrist || !shoulder || wrist.confidence < calibrationDefaults.requiredConfidence || shoulder.confidence < calibrationDefaults.requiredConfidence) {
				wristMotionHistories.set(hand, []);
				continue;
			}
			const wristRaw = normalizeAgainstBounds(cameraPreviewToAthlete(wrist), calibratedBounds);
			const shoulderRaw = normalizeAgainstBounds(cameraPreviewToAthlete(shoulder), calibratedBounds);
			const history = wristMotionHistories.get(hand) ?? [];
			history.push({
				timestampMs: atTimestampMs,
				x: (wristRaw.x - shoulderRaw.x) * athleteBodyGrid4x3.columns,
				y: (wristRaw.y - shoulderRaw.y) * athleteBodyGrid4x3.rows
			});
			const cutoff = atTimestampMs - directionHistoryWindowMs;
			while (history.length > 0 && history[0].timestampMs < cutoff) history.shift();
			if (history.length > 64) history.splice(0, history.length - 64);
			wristMotionHistories.set(hand, history);
		}
	}
	/** @param {"left" | "right"} hand @param {number} atTimestampMs @returns {import("@aerobeat/web-contracts").AeroBodyGridDirection | null} */
	function rollingWristDirection(hand, atTimestampMs) {
		const history = (wristMotionHistories.get(hand) ?? []).filter((point) => point.timestampMs >= atTimestampMs - directionHistoryWindowMs && point.timestampMs <= atTimestampMs);
		if (history.length < 2) return null;
		const origin = history[0].timestampMs;
		const elapsed = history.at(-1).timestampMs - origin;
		if (elapsed <= 0) return null;
		let meanTime = 0;
		let meanX = 0;
		let meanY = 0;
		for (const point of history) {
			meanTime += point.timestampMs - origin;
			meanX += point.x;
			meanY += point.y;
		}
		meanTime /= history.length;
		meanX /= history.length;
		meanY /= history.length;
		let denominator = 0;
		let numeratorX = 0;
		let numeratorY = 0;
		for (const point of history) {
			const centeredTime = point.timestampMs - origin - meanTime;
			denominator += centeredTime * centeredTime;
			numeratorX += centeredTime * (point.x - meanX);
			numeratorY += centeredTime * (point.y - meanY);
		}
		if (denominator <= Number.EPSILON) return null;
		const dx = numeratorX / denominator * elapsed;
		const dy = numeratorY / denominator * elapsed;
		if (Math.hypot(dx, dy) < directionMinimumMagnitude) return null;
		return eightWayDirection(dx, dy);
	}
	function resetWristMotionHistories() {
		wristMotionHistories.set("left", []);
		wristMotionHistories.set("right", []);
	}
	function resetMeasuredHistories() {
		anchorHistory.clear();
		resetWristMotionHistories();
		resetStraightStates();
		latestAnchors = [];
		latestEntries = [];
		latestEvidence = null;
		evidenceHistory.length = 0;
	}
	/** @param {number} nextTimestamp */
	function advanceTime(nextTimestamp) {
		if (destroyed || !Number.isFinite(nextTimestamp) || nextTimestamp < timestampMs) return latestSnapshot;
		timestampMs = nextTimestamp;
		if (lossStartedAt === null) lossStartedAt = lastMeasuredAt ?? timestampMs;
		lossDurationMs = Math.max(0, timestampMs - lossStartedAt);
		allRequiredAnchorsVisible = false;
		if (lossDurationMs >= calibrationDefaults.trackingLossPauseMs) triggerTrackingPause(timestampMs);
		return publish();
	}
	/** @param {string} reason */
	function resetCalibration(reason = "manual_reset") {
		if (destroyed) return latestSnapshot;
		trackingPaused = true;
		invalidateCalibration(reason);
		return publish();
	}
	/** @param {number} atTimestampMs @param {number} maximumAgeMs */
	function getFreshEvidence(atTimestampMs, maximumAgeMs = prototypeJudgementDefaults.checkpointFreshnessMs) {
		if (latestEvidence === null || trackingPaused || freshCalibrationRequired || !Number.isFinite(atTimestampMs)) return null;
		const age = atTimestampMs - latestEvidence.measurementTimestampMs;
		return age >= 0 && age <= Math.max(0, maximumAgeMs) ? latestEvidence : null;
	}
	function destroy() {
		if (destroyed) return;
		destroyed = true;
		calibrationState = "invalidated";
		readiness = "destroyed";
		invalidationReason = "destroyed";
		trackingPaused = true;
		freshCalibrationRequired = true;
		latestEvidence = null;
		latestAnchors = [];
		latestEntries = [];
		holdFrames = [];
		anchorHistory.clear();
		resetWristMotionHistories();
		evidenceHistory.length = 0;
		publish();
		listeners.clear();
	}
	return {
		serviceId: aeroBodyGridServiceId,
		processPoseSample,
		advanceTime,
		resetCalibration,
		getFreshEvidence,
		getEvidenceHistory() {
			return Object.freeze([...evidenceHistory]);
		},
		getSnapshot() {
			return latestSnapshot;
		},
		subscribe(listener) {
			if (destroyed || typeof listener !== "function") return () => {};
			listeners.add(listener);
			notifyListener(listener, latestSnapshot);
			return () => listeners.delete(listener);
		},
		destroy
	};
}
/** @param {AeroPoseRoutingSample | NormalizedPoseFrame} input @returns {AeroPoseRoutingSample | null} */
function normalizeSample(input) {
	try {
		if (input === null || typeof input !== "object") return null;
		if ("provenance" in input) {
			if (input.provenance !== "measured" && input.provenance !== "predicted" || !isNonEmptyString(input.sourceId) || !isNonEmptyString(input.measuredSourceFrameId) || !isNonNegativeFinite(input.measurementTimestampMs) || !isNonNegativeFinite(input.targetTimestampMs) || !Array.isArray(input.landmarks) || typeof input.mirrored !== "boolean") return null;
			return input;
		}
		if (!isNonEmptyString(input.sourceId) || !isNonNegativeFinite(input.timestampMs) || !Array.isArray(input.landmarks) || typeof input.mirrored !== "boolean") return null;
		return {
			schema: "aerobeat/pose_routing_sample",
			version: 1,
			sourceId: input.sourceId,
			routeEpoch: "measured-frame",
			measuredSourceFrameId: `measured-frame:${input.sourceId}:${input.timestampMs}`,
			targetTimestampMs: input.timestampMs,
			measurementTimestampMs: input.timestampMs,
			predictionHorizonMs: 0,
			provenance: "measured",
			landmarks: input.landmarks,
			mirrored: input.mirrored
		};
	} catch {
		return null;
	}
}
/** @param {AeroPoseRoutingSample} sample @returns {Map<string, NormalizedPoseLandmark>} */
function measuredLandmarkMap(sample) {
	/** @type {Map<string, NormalizedPoseLandmark>} */
	const map = /* @__PURE__ */ new Map();
	const rejectedNames = /* @__PURE__ */ new Set();
	for (const candidate of sample.landmarks) {
		if (candidate === null || typeof candidate !== "object") continue;
		const name = candidate.name;
		if (!upperBodyAnchorNames.includes(name) || rejectedNames.has(name)) continue;
		if (map.has(name)) {
			map.delete(name);
			rejectedNames.add(name);
			continue;
		}
		if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y) || !isNormalized(candidate.confidence)) {
			rejectedNames.add(name);
			continue;
		}
		map.set(name, candidate);
	}
	return map;
}
/** @param {Map<string, NormalizedPoseLandmark>} landmarks */
function qualifiesTPose(landmarks) {
	const leftShoulder = landmarks.get("left_shoulder");
	const rightShoulder = landmarks.get("right_shoulder");
	const leftElbow = landmarks.get("left_elbow");
	const rightElbow = landmarks.get("right_elbow");
	const leftWrist = landmarks.get("left_wrist");
	const rightWrist = landmarks.get("right_wrist");
	if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow || !leftWrist || !rightWrist) return false;
	const shoulderWidth = distance(leftShoulder, rightShoulder);
	if (shoulderWidth <= Number.EPSILON) return false;
	return [
		Math.abs(leftWrist.y - leftShoulder.y) / shoulderWidth,
		Math.abs(rightWrist.y - rightShoulder.y) / shoulderWidth,
		Math.abs(leftElbow.y - leftShoulder.y) / shoulderWidth,
		Math.abs(rightElbow.y - rightShoulder.y) / shoulderWidth
	].every((ratio) => ratio <= calibrationDefaults.wristElbowVerticalRatio) && angleDegrees(leftShoulder, leftElbow, leftWrist) >= calibrationDefaults.minimumElbowAngleDeg && angleDegrees(rightShoulder, rightElbow, rightWrist) >= calibrationDefaults.minimumElbowAngleDeg;
}
/** @param {readonly NormalizedPoseLandmark[][]} frames */
function averageLandmarks(frames) {
	/** @type {Map<string, {x: number, y: number, confidence: number, count: number}>} */
	const sums = /* @__PURE__ */ new Map();
	for (const frame of frames) for (const landmark of frame) {
		const sum = sums.get(landmark.name) ?? {
			x: 0,
			y: 0,
			confidence: 0,
			count: 0
		};
		sum.x += landmark.x;
		sum.y += landmark.y;
		sum.confidence += landmark.confidence;
		sum.count += 1;
		sums.set(landmark.name, sum);
	}
	/** @type {Map<string, NormalizedPoseLandmark>} */
	const averaged = /* @__PURE__ */ new Map();
	for (const [name, sum] of sums) averaged.set(name, {
		name,
		x: sum.x / sum.count,
		y: sum.y / sum.count,
		confidence: sum.confidence / sum.count
	});
	return averaged;
}
/** @param {Map<string, NormalizedPoseLandmark>} landmarks @param {number} aspect @param {AeroBodyGridPadding} padding */
function calibratedGeometry(landmarks, aspect, padding) {
	const leftWrist = landmarks.get("left_wrist");
	const rightWrist = landmarks.get("right_wrist");
	const leftShoulder = landmarks.get("left_shoulder");
	const rightShoulder = landmarks.get("right_shoulder");
	const nose = landmarks.get("nose");
	if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder || !nose) return null;
	const athleteLeftWrist = cameraPreviewToAthlete(leftWrist);
	const athleteRightWrist = cameraPreviewToAthlete(rightWrist);
	const athleteLeftShoulder = cameraPreviewToAthlete(leftShoulder);
	const athleteRightShoulder = cameraPreviewToAthlete(rightShoulder);
	const athleteNose = cameraPreviewToAthlete(nose);
	const baseWidth = Math.abs(athleteLeftWrist.x - athleteRightWrist.x);
	const baseHeight = baseWidth * aspect * (athleteBodyGrid4x3.rows / athleteBodyGrid4x3.columns);
	if (!(baseWidth > Number.EPSILON) || !(baseHeight > Number.EPSILON)) return null;
	const centerX = (athleteLeftWrist.x + athleteRightWrist.x) / 2;
	const centerY = (athleteLeftShoulder.y + athleteRightShoulder.y) / 2;
	const bounds = {
		left: centerX - baseWidth / 2 - baseWidth * padding.left,
		right: centerX + baseWidth / 2 + baseWidth * padding.right,
		top: centerY - baseHeight / 2 - baseHeight * padding.top,
		bottom: centerY + baseHeight / 2 + baseHeight * padding.bottom
	};
	return {
		bounds,
		nose: normalizeAgainstBounds(athleteNose, bounds)
	};
}
/** @param {{x: number, y: number}} point @param {AeroCalibratedBounds} bounds */
function normalizeAgainstBounds(point, bounds) {
	return {
		x: (point.x - bounds.left) / (bounds.right - bounds.left),
		y: (point.y - bounds.top) / (bounds.bottom - bounds.top)
	};
}
/**
* @param {{x: number, y: number}} point
* @param {import("@aerobeat/web-contracts").AeroGridDescriptor} descriptor
* @param {import("@aerobeat/web-contracts").AeroGridCellRef | null} previous
* @param {number} margin
*/
function hystereticGridCell(point, descriptor, previous, margin) {
	const direct = normalizedPointToGridCell(point, descriptor);
	if (direct === null || previous === null || direct.id === previous.id) return direct;
	const left = previous.column / descriptor.columns - margin;
	const right = (previous.column + 1) / descriptor.columns + margin;
	const top = previous.row / descriptor.rows - margin;
	const bottom = (previous.row + 1) / descriptor.rows + margin;
	return point.x >= left && point.x < right && point.y >= top && point.y < bottom ? previous : direct;
}
/** @param {{x: number, y: number}} from @param {{x: number, y: number}} to @returns {import("@aerobeat/web-contracts").AeroBodyGridDirection} */
function cardinalDirection(from, to) {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	if (Math.abs(dx) + Number.EPSILON * 8 >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
	return dy >= 0 ? "down" : "up";
}
/** @param {number} dx @param {number} dy @returns {import("@aerobeat/web-contracts").AeroBodyGridDirection} */
function eightWayDirection(dx, dy) {
	return [
		"right",
		"down-right",
		"down",
		"down-left",
		"left",
		"up-left",
		"up",
		"up-right"
	][Math.floor((Math.atan2(dy, dx) + Math.PI / 8 + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4))];
}
/** @param {StraightState} state @param {"semanticStart" | "spatialStart"} startKey @param {"semanticLast" | "spatialLast"} lastKey @param {number} now @param {boolean} active */
function updateContinuity(state, startKey, lastKey, now, active) {
	if (!active) {
		state[startKey] = null;
		state[lastKey] = null;
		return;
	}
	const last = state[lastKey];
	if (last === null || now - last > prototypeJudgementDefaults.straightContinuityGapMs || now < last) state[startKey] = now;
	state[lastKey] = now;
}
/** @returns {StraightState} */
function emptyStraightState() {
	return {
		semanticStart: null,
		semanticLast: null,
		spatialStart: null,
		spatialLast: null
	};
}
/** @param {number} now @param {Map<"left" | "right", StraightState>} states @returns {readonly AeroStraightQualificationSnapshot[]} */
function qualificationSnapshots(now, states) {
	return Object.freeze(["left", "right"].map((value) => {
		const hand = value;
		const state = states.get(hand) ?? emptyStraightState();
		const semanticDuration = state.semanticStart === null || state.semanticLast === null ? 0 : Math.max(0, state.semanticLast - state.semanticStart);
		const spatialDuration = state.spatialStart === null || state.spatialLast === null ? 0 : Math.max(0, state.spatialLast - state.spatialStart);
		return Object.freeze({
			hand,
			semanticStartTimestampMs: state.semanticStart,
			semanticDurationMs: semanticDuration,
			semanticQualified: semanticDuration >= prototypeJudgementDefaults.straightQualificationMs,
			spatialStartTimestampMs: state.spatialStart,
			spatialDurationMs: spatialDuration,
			spatialQualified: spatialDuration >= prototypeJudgementDefaults.straightQualificationMs,
			acceptedSubcellColumns: Object.freeze(hand === "left" ? [
				2,
				3,
				4
			] : [
				3,
				4,
				5
			])
		});
	}));
}
/** @param {NormalizedPoseLandmark} a @param {NormalizedPoseLandmark} b */
function distance(a, b) {
	return Math.hypot(a.x - b.x, a.y - b.y);
}
/** @param {NormalizedPoseLandmark} a @param {NormalizedPoseLandmark} vertex @param {NormalizedPoseLandmark} c */
function angleDegrees(a, vertex, c) {
	const firstX = a.x - vertex.x;
	const firstY = a.y - vertex.y;
	const secondX = c.x - vertex.x;
	const secondY = c.y - vertex.y;
	const denominator = Math.hypot(firstX, firstY) * Math.hypot(secondX, secondY);
	if (denominator <= Number.EPSILON) return 0;
	const cosine = Math.min(1, Math.max(-1, (firstX * secondX + firstY * secondY) / denominator));
	return Math.acos(cosine) * 180 / Math.PI;
}
/** @param {Partial<AeroBodyGridPadding> | undefined} value @returns {AeroBodyGridPadding} */
function normalizePadding(value) {
	return {
		left: nonNegative(value?.left, 0),
		right: nonNegative(value?.right, 0),
		top: nonNegative(value?.top, 0),
		bottom: nonNegative(value?.bottom, 0)
	};
}
/** @param {number | undefined} value @param {number} fallback */
function positive(value, fallback) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
/** @param {number | undefined} value @param {number} fallback */
function nonNegative(value, fallback) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
/** @param {number | undefined} value @param {number} fallback @param {number} minimum @param {number} maximum */
function bounded(value, fallback, minimum, maximum) {
	return typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}
/** @param {number} value */
function clamp01$1(value) {
	return Math.min(1, Math.max(0, value));
}
/** @param {unknown} value */
function isNonEmptyString(value) {
	return typeof value === "string" && value.length > 0;
}
/** @param {unknown} value */
function isNonNegativeFinite(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
/** @param {unknown} value */
function isNormalized(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
/** @template T @param {T} value @returns {Readonly<T>} */
function deepFreeze(value) {
	if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
		for (const nested of Object.values(value)) deepFreeze(nested);
		Object.freeze(value);
	}
	return value;
}
Object.freeze([
	"nose",
	"left_wrist",
	"left_elbow",
	"left_shoulder",
	"right_shoulder",
	"right_elbow",
	"right_wrist"
]);
Object.freeze({
	minimumLandmarkMeanErrorReductionRatio: .25,
	maximumLandmarkP95Regression: 0,
	minimumIntentF1Delta: .02,
	minimumIntentRecallDelta: 0,
	minimumTreatmentIntentRecall: .3,
	minimumGridAgreementDelta: 0,
	maximumIntentPrecisionLoss: .02,
	maximumFalsePositiveIncrease: 0,
	maximumFalseRepeatedEvents: 0,
	minimumTreatmentPredictionCoverage: .5,
	maximumTransitionTimingRegressionMs: 0,
	maximumTreatmentTransitionTimingMeanErrorMs: 50
});
//#endregion
//#region ../aerobeat-web-vendor-beatsaver/src/errors.js
/**
* Stable vendor error categories suitable for UI and telemetry.
*
* @typedef {"invalid_request" | "transport" | "timeout" | "aborted" | "http" | "provider_payload" | "integrity" | "archive" | "unsupported"} BeatSaverVendorErrorCode
*/
/**
* Typed public error without provider DTO or archive-library leakage.
*/
var BeatSaverVendorError = class extends Error {
	/**
	* @param {BeatSaverVendorErrorCode} code Stable category.
	* @param {string} message Human-readable message.
	* @param {{status?: number, retryAfterMs?: number, cause?: unknown, details?: Readonly<Record<string, string | number | boolean>>}} [options] Error context.
	*/
	constructor(code, message, options = {}) {
		super(message, options.cause === void 0 ? void 0 : { cause: options.cause });
		this.name = "BeatSaverVendorError";
		/** @type {BeatSaverVendorErrorCode} */
		this.code = code;
		/** @type {number | undefined} */
		this.status = options.status;
		/** @type {number | undefined} */
		this.retryAfterMs = options.retryAfterMs;
		/** @type {Readonly<Record<string, string | number | boolean>>} */
		this.details = Object.freeze({ ...options.details ?? {} });
	}
};
/**
* Convert unknown failures to the stable public error shape.
*
* @param {unknown} error Unknown thrown value.
* @returns {BeatSaverVendorError} Stable error.
*/
function toBeatSaverVendorError(error) {
	if (error instanceof BeatSaverVendorError) return error;
	if (error instanceof DOMException && error.name === "AbortError") return new BeatSaverVendorError("aborted", "BeatSaver operation was cancelled", { cause: error });
	if (error instanceof Error) return new BeatSaverVendorError("transport", error.message, { cause: error });
	return new BeatSaverVendorError("transport", "Unknown BeatSaver operation failure");
}
//#endregion
//#region ../aerobeat-web-vendor-beatsaver/src/normalize.js
/** @typedef {Readonly<{characteristic: string, difficulty: string, stars: number, notes: number, bombs: number, obstacles: number, njs: number, nps: number, durationSeconds: number, environment: string, chroma: boolean, cinema: boolean, mappingExtensions: boolean}>} BeatSaverDifficulty */
/** @typedef {Readonly<{hash: string, key: string, state: string, createdAt: string, downloadUrl: string, coverUrl: string, previewUrl: string, sageScore: number, difficulties: readonly BeatSaverDifficulty[]}>} BeatSaverVersion */
/** @typedef {Readonly<{providerId: "beatsaver", mapId: string, mapKey: string, mapName: string, description: string, tags: readonly string[], songName: string, songSubName: string, songAuthorName: string, levelAuthorName: string, bpm: number, durationSeconds: number, uploader: Readonly<{id: number, name: string, avatarUrl: string}>, stats: Readonly<{downloads: number, plays: number, upvotes: number, downvotes: number, score: number}>, versions: readonly BeatSaverVersion[], createdAt: string, updatedAt: string, uploadedAt: string, lastPublishedAt: string, ranked: boolean, qualified: boolean, automapper: boolean, declaredAi: boolean}>} BeatSaverMap */
/** @typedef {Readonly<{source: "search" | "latest", maps: readonly BeatSaverMap[], page: number, pages: number, total: number}>} BeatSaverMapCollection */
var DIFFICULTIES = /* @__PURE__ */ new Set([
	"Easy",
	"Normal",
	"Hard",
	"Expert",
	"ExpertPlus"
]);
var LATEST_SORTS = /* @__PURE__ */ new Set([
	"FIRST_PUBLISHED",
	"UPDATED",
	"LAST_PUBLISHED",
	"CREATED",
	"CURATED"
]);
var SEARCH_ORDERS = /* @__PURE__ */ new Set([
	"Latest",
	"Relevance",
	"Rating",
	"Curated",
	"Random",
	"Duration"
]);
/**
* @param {unknown} payload Provider payload.
* @returns {BeatSaverMap} Narrowed map.
*/
function normalizeMap(payload) {
	const record = requireRecord(payload, "map");
	const metadata = optionalRecord(record.metadata);
	const mapId = requireNonEmptyString(record.id, "map.id").toUpperCase();
	const versions = optionalArray(record.versions).map((entry, index) => normalizeVersion(entry, `map.versions[${index}]`));
	if (versions.length === 0) throw new BeatSaverVendorError("provider_payload", "BeatSaver map has no versions", { details: { mapId } });
	const uploader = optionalRecord(record.uploader);
	const stats = optionalRecord(record.stats);
	return Object.freeze({
		providerId: "beatsaver",
		mapId,
		mapKey: mapId,
		mapName: optionalString(record.name),
		description: optionalString(record.description),
		tags: Object.freeze(optionalArray(record.tags).map((value) => optionalString(value)).filter(Boolean)),
		songName: optionalString(metadata.songName),
		songSubName: optionalString(metadata.songSubName),
		songAuthorName: optionalString(metadata.songAuthorName),
		levelAuthorName: optionalString(metadata.levelAuthorName),
		bpm: finiteNumber$1(metadata.bpm),
		durationSeconds: nonNegativeInteger(metadata.duration),
		uploader: Object.freeze({
			id: nonNegativeInteger(uploader.id),
			name: optionalString(uploader.name),
			avatarUrl: optionalHttpsUrl(uploader.avatar, "uploader.avatar")
		}),
		stats: Object.freeze({
			downloads: nonNegativeInteger(stats.downloads),
			plays: nonNegativeInteger(stats.plays),
			upvotes: nonNegativeInteger(stats.upvotes),
			downvotes: nonNegativeInteger(stats.downvotes),
			score: finiteNumber$1(stats.score)
		}),
		versions: Object.freeze(versions),
		createdAt: optionalString(record.createdAt),
		updatedAt: optionalString(record.updatedAt),
		uploadedAt: optionalString(record.uploaded),
		lastPublishedAt: optionalString(record.lastPublishedAt),
		ranked: optionalBoolean(record.ranked),
		qualified: optionalBoolean(record.qualified),
		automapper: optionalBoolean(record.automapper),
		declaredAi: optionalBoolean(record.declaredAi)
	});
}
/**
* @param {unknown} payload Provider collection payload.
* @param {"search" | "latest"} source Collection source.
* @returns {BeatSaverMapCollection} Narrowed collection.
*/
function normalizeMapCollection(payload, source) {
	const record = requireRecord(payload, source);
	const docs = optionalArray(record.docs);
	const info = optionalRecord(record.info);
	const maps = docs.map((entry) => normalizeMap(entry));
	return Object.freeze({
		source,
		maps: Object.freeze(maps),
		page: nonNegativeInteger(info.page),
		pages: nonNegativeInteger(info.pages),
		total: info.total === void 0 ? maps.length : nonNegativeInteger(info.total)
	});
}
/**
* @param {BeatSaverMap} map Map record.
* @param {string | undefined} identifier Version hash or key; defaults latest.
* @returns {BeatSaverVersion} Selected version.
*/
function selectVersion(map, identifier) {
	if (identifier !== void 0 && typeof identifier !== "string") invalidRequest("BeatSaver version identifier must be a string");
	const normalized = (identifier ?? "").trim().toLowerCase();
	const selected = normalized.length === 0 ? map.versions[0] : map.versions.find((version) => version.hash === normalized || version.key.toLowerCase() === normalized);
	if (selected === void 0) throw new BeatSaverVendorError("invalid_request", "Requested BeatSaver version is unavailable", { details: {
		mapId: map.mapId,
		version: identifier ?? ""
	} });
	return selected;
}
/**
* @param {{text?: string, page?: number, pageSize?: number, order?: string, automapper?: boolean, tags?: readonly string[]}} query Search options.
* @returns {URLSearchParams} Safe query.
*/
function buildSearchParameters(query) {
	const parameters = new URLSearchParams();
	const text = optionalQueryString(query.text, "search text");
	parameters.set("q", text.slice(0, 256));
	parameters.set("pageSize", String(queryInteger(query.pageSize, 20, 1, 100, "search page size")));
	if (query.order !== void 0) {
		if (typeof query.order !== "string") invalidRequest("Search order must be a string");
		if (SEARCH_ORDERS.has(query.order)) parameters.set("order", query.order);
	}
	if (query.automapper !== void 0 && typeof query.automapper !== "boolean") invalidRequest("Search automapper must be boolean");
	if (typeof query.automapper === "boolean") parameters.set("automapper", String(query.automapper));
	if (query.tags !== void 0) {
		if (!Array.isArray(query.tags) || query.tags.some((tag) => typeof tag !== "string")) invalidRequest("Search tags must be an array of strings");
		const tags = query.tags.map((tag) => tag.trim().slice(0, 64)).filter(Boolean).slice(0, 16);
		if (tags.length > 0) parameters.set("tags", tags.join(","));
	}
	return parameters;
}
/**
* @param {{pageSize?: number, before?: string, after?: string, sort?: string, automapper?: boolean}} options Latest options.
* @returns {URLSearchParams} Safe query.
*/
function buildLatestParameters(options) {
	const parameters = new URLSearchParams();
	parameters.set("pageSize", String(queryInteger(options.pageSize, 20, 1, 100, "latest page size")));
	const before = optionalQueryString(options.before, "latest before");
	const after = optionalQueryString(options.after, "latest after");
	if (before) parameters.set("before", before.slice(0, 128));
	if (after) parameters.set("after", after.slice(0, 128));
	const sortValue = optionalQueryString(options.sort, "latest sort");
	const sort = sortValue === "" ? void 0 : sortValue.toUpperCase();
	if (sort !== void 0 && LATEST_SORTS.has(sort)) parameters.set("sort", sort);
	if (options.automapper !== void 0 && typeof options.automapper !== "boolean") invalidRequest("Latest automapper must be boolean");
	if (typeof options.automapper === "boolean") parameters.set("automapper", String(options.automapper));
	return parameters;
}
/**
* @param {unknown} payload Version payload.
* @param {string} context Context.
* @returns {BeatSaverVersion} Version.
*/
function normalizeVersion(payload, context) {
	const record = requireRecord(payload, context);
	const hash = requireStringPattern(record.hash, `${context}.hash`, /^[0-9a-fA-F]{40}$/u).toLowerCase();
	const downloadUrl = requireHttpsUrl(record.downloadURL, `${context}.downloadURL`);
	const difficulties = optionalArray(record.diffs).map((entry, index) => normalizeDifficulty(entry, `${context}.diffs[${index}]`));
	return Object.freeze({
		hash,
		key: optionalString(record.key).toUpperCase(),
		state: optionalString(record.state),
		createdAt: optionalString(record.createdAt),
		downloadUrl,
		coverUrl: optionalHttpsUrl(record.coverURL, `${context}.coverURL`),
		previewUrl: optionalHttpsUrl(record.previewURL, `${context}.previewURL`),
		sageScore: finiteNumber$1(record.sageScore),
		difficulties: Object.freeze(difficulties)
	});
}
/**
* @param {unknown} payload Difficulty payload.
* @param {string} context Context.
* @returns {BeatSaverDifficulty} Difficulty.
*/
function normalizeDifficulty(payload, context) {
	const record = requireRecord(payload, context);
	const difficulty = optionalString(record.difficulty);
	if (difficulty && !DIFFICULTIES.has(difficulty)) throw new BeatSaverVendorError("provider_payload", `Unsupported BeatSaver difficulty at ${context}`, { details: { difficulty } });
	return Object.freeze({
		characteristic: optionalString(record.characteristic),
		difficulty,
		stars: finiteNumber$1(record.stars),
		notes: nonNegativeInteger(record.notes),
		bombs: nonNegativeInteger(record.bombs),
		obstacles: nonNegativeInteger(record.obstacles),
		njs: finiteNumber$1(record.njs),
		nps: finiteNumber$1(record.nps),
		durationSeconds: finiteNumber$1(record.seconds),
		environment: optionalString(record.environment),
		chroma: optionalBoolean(record.chroma),
		cinema: optionalBoolean(record.cinema),
		mappingExtensions: optionalBoolean(record.me)
	});
}
/** @param {unknown} value @param {string} context @returns {Record<string, unknown>} */
function requireRecord(value, context) {
	if (!isPlainRecord(value)) throw new BeatSaverVendorError("provider_payload", `Expected plain object at ${context}`);
	return value;
}
/** @param {unknown} value @returns {Record<string, unknown>} */
function optionalRecord(value) {
	return isPlainRecord(value) ? value : {};
}
/** @param {unknown} value @returns {readonly unknown[]} */
function optionalArray(value) {
	return Array.isArray(value) ? value : [];
}
/** @param {unknown} value @returns {string} */
function optionalString(value) {
	return typeof value === "string" ? value : "";
}
/** @param {unknown} value @param {string} context @returns {string} */
function requireNonEmptyString(value, context) {
	if (typeof value !== "string" || value.trim() === "") throw new BeatSaverVendorError("provider_payload", `Expected non-empty string at ${context}`);
	return value.trim();
}
/** @param {unknown} value @param {string} context @param {RegExp} pattern @returns {string} */
function requireStringPattern(value, context, pattern) {
	const text = requireNonEmptyString(value, context);
	if (!pattern.test(text)) throw new BeatSaverVendorError("provider_payload", `Invalid string at ${context}`);
	return text;
}
/** @param {unknown} value @returns {number} */
function finiteNumber$1(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
/** @param {unknown} value @returns {number} */
function nonNegativeInteger(value) {
	return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
/** @param {unknown} value @returns {boolean} */
function optionalBoolean(value) {
	return value === true;
}
/** @param {unknown} value @returns {boolean} */
function isPlainRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
/** @param {unknown} value @param {string} label @returns {string} */
function optionalQueryString(value, label) {
	if (value === void 0) return "";
	if (typeof value !== "string") invalidRequest(`${label} must be a string`);
	return value.trim();
}
/** @param {unknown} value @param {number} fallback @param {number} minimum @param {number} maximum @param {string} label @returns {number} */
function queryInteger(value, fallback, minimum, maximum, label) {
	if (value === void 0) return fallback;
	if (typeof value !== "number" || !Number.isFinite(value)) invalidRequest(`${label} must be finite`);
	return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}
/** @param {string} message @returns {never} */
function invalidRequest(message) {
	throw new BeatSaverVendorError("invalid_request", message);
}
/** @param {unknown} value @param {string} context @returns {string} */
function requireHttpsUrl(value, context) {
	let url;
	try {
		url = new URL(requireNonEmptyString(value, context));
	} catch (error) {
		if (error instanceof BeatSaverVendorError) throw error;
		throw new BeatSaverVendorError("provider_payload", `Expected valid URL at ${context}`, { cause: error });
	}
	if (url.protocol !== "https:" || url.username !== "" || url.password !== "") throw new BeatSaverVendorError("provider_payload", `Expected credential-free HTTPS URL at ${context}`);
	return url.href;
}
/** @param {unknown} value @param {string} context @returns {string} */
function optionalHttpsUrl(value, context) {
	if (typeof value !== "string" || value.trim() === "") return "";
	return requireHttpsUrl(value, context);
}
//#endregion
//#region ../aerobeat-web-vendor-beatsaver/src/transport.js
/** @typedef {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} BeatSaverFetch */
/** @typedef {(event: Readonly<{phase: "download", loadedBytes: number, totalBytes: number | undefined}>) => void} BeatSaverProgressCallback */
/** @typedef {Readonly<{requests: number, retries: number, failures: number, downloadedBytes: number, lastStatus: number | undefined}>} BeatSaverTransportTelemetry */
/**
* Fetch transport with cancellation, deadlines and bounded retry.
*/
var BeatSaverTransport = class {
	/**
	* @param {{fetch?: BeatSaverFetch, proxyUrl?: (url: URL) => string | URL, timeoutMs?: number, maxRetries?: number, retryBaseMs?: number}} [options] Transport options.
	*/
	constructor(options = {}) {
		this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.proxyUrl = options.proxyUrl;
		this.timeoutMs = boundedInteger(options.timeoutMs, 15e3, 100, 12e4);
		this.maxRetries = boundedInteger(options.maxRetries, 2, 0, 5);
		this.retryBaseMs = boundedInteger(options.retryBaseMs, 250, 10, 1e4);
		this.metrics = {
			requests: 0,
			retries: 0,
			failures: 0,
			downloadedBytes: 0,
			lastStatus: void 0
		};
	}
	/**
	* @param {URL} directUrl Provider URL.
	* @param {{signal?: AbortSignal, accept?: string}} [options] Request options.
	* @returns {Promise<unknown>} Parsed JSON.
	*/
	async getJson(directUrl, options = {}) {
		const response = await this.request(directUrl, {
			signal: options.signal,
			accept: options.accept ?? "application/json"
		});
		try {
			return await response.json();
		} catch (error) {
			throw new BeatSaverVendorError("provider_payload", "BeatSaver response was not valid JSON", {
				status: response.status,
				cause: error
			});
		}
	}
	/**
	* @param {URL} directUrl Download URL.
	* @param {{signal?: AbortSignal, onProgress?: BeatSaverProgressCallback, maxBytes?: number}} [options] Download options.
	* @returns {Promise<Uint8Array>} Download bytes.
	*/
	async getBytes(directUrl, options = {}) {
		const maxBytes = boundedInteger(options.maxBytes, 134217728, 1, 1073741824);
		const response = await this.request(directUrl, {
			signal: options.signal,
			accept: "application/zip, application/octet-stream"
		});
		const totalBytes = parseContentLength(response.headers.get("content-length"));
		if (totalBytes !== void 0 && Number.isFinite(totalBytes) && totalBytes > maxBytes) throw new BeatSaverVendorError("archive", "BeatSaver archive exceeds download limit", { details: {
			maxBytes,
			totalBytes
		} });
		if (response.body === null) {
			const bytes = new Uint8Array(await response.arrayBuffer());
			enforceDownloadSize(bytes.byteLength, maxBytes);
			options.onProgress?.(Object.freeze({
				phase: "download",
				loadedBytes: bytes.byteLength,
				totalBytes
			}));
			this.metrics.downloadedBytes += bytes.byteLength;
			return bytes;
		}
		const reader = response.body.getReader();
		/** @type {Uint8Array[]} */
		const chunks = [];
		let loadedBytes = 0;
		try {
			while (true) {
				const result = await reader.read();
				if (result.done) break;
				if (result.value !== void 0) {
					loadedBytes += result.value.byteLength;
					enforceDownloadSize(loadedBytes, maxBytes);
					chunks.push(result.value);
					options.onProgress?.(Object.freeze({
						phase: "download",
						loadedBytes,
						totalBytes
					}));
				}
			}
		} catch (error) {
			try {
				await reader.cancel(error);
			} catch {}
			throw toBeatSaverVendorError(error);
		} finally {
			reader.releaseLock();
		}
		const bytes = concatenate(chunks, loadedBytes);
		this.metrics.downloadedBytes += loadedBytes;
		return bytes;
	}
	/** @returns {BeatSaverTransportTelemetry} Immutable telemetry. */
	snapshotTelemetry() {
		return Object.freeze({ ...this.metrics });
	}
	/**
	* @param {URL} directUrl Direct provider URL.
	* @param {{signal?: AbortSignal, accept: string}} options Options.
	* @returns {Promise<Response>} Response.
	*/
	async request(directUrl, options) {
		if (directUrl.protocol !== "https:" || directUrl.username !== "" || directUrl.password !== "") throw new BeatSaverVendorError("invalid_request", "BeatSaver transport requires credential-free HTTPS");
		let resolved;
		try {
			resolved = this.proxyUrl === void 0 ? directUrl : new URL(this.proxyUrl(new URL(directUrl.href)).toString());
		} catch (error) {
			throw new BeatSaverVendorError("invalid_request", "Configured BeatSaver proxy returned an invalid URL", { cause: error });
		}
		if (!isSecureTransportUrl(resolved) || resolved.username !== "" || resolved.password !== "") throw new BeatSaverVendorError("invalid_request", "Configured BeatSaver transport URL must use credential-free HTTPS");
		for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
			options.signal?.throwIfAborted();
			const timeoutController = new AbortController();
			const timeout = setTimeout(() => timeoutController.abort(new BeatSaverVendorError("timeout", "BeatSaver request timed out")), this.timeoutMs);
			const signal = combineSignals(options.signal, timeoutController.signal);
			this.metrics.requests += 1;
			try {
				const response = await raceWithSignal(this.fetch(resolved, {
					method: "GET",
					headers: { Accept: options.accept },
					signal,
					credentials: "omit",
					redirect: "follow",
					referrerPolicy: "no-referrer"
				}), signal);
				options.signal?.throwIfAborted();
				if (timeoutController.signal.aborted) throw new BeatSaverVendorError("timeout", "BeatSaver request timed out");
				if (response.url !== "") {
					const finalUrl = new URL(response.url);
					if (!isSecureTransportUrl(finalUrl) || finalUrl.username !== "" || finalUrl.password !== "") throw new BeatSaverVendorError("transport", "BeatSaver transport followed an insecure redirect");
				}
				this.metrics.lastStatus = response.status;
				if (response.ok) return response;
				const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
				if (attempt < this.maxRetries && isRetryableStatus(response.status)) {
					this.metrics.retries += 1;
					await response.body?.cancel();
					await delay(retryAfterMs ?? this.retryBaseMs * 2 ** attempt, options.signal);
					continue;
				}
				this.metrics.failures += 1;
				throw new BeatSaverVendorError("http", `BeatSaver request failed with HTTP ${response.status}`, {
					status: response.status,
					retryAfterMs
				});
			} catch (error) {
				if (options.signal?.aborted === true) throw new BeatSaverVendorError("aborted", "BeatSaver request was cancelled", { cause: error });
				if (timeoutController.signal.aborted) throw new BeatSaverVendorError("timeout", "BeatSaver request timed out", { cause: error });
				const stable = toBeatSaverVendorError(error);
				if (attempt < this.maxRetries && stable.code === "transport") {
					this.metrics.retries += 1;
					await delay(this.retryBaseMs * 2 ** attempt, options.signal);
					continue;
				}
				this.metrics.failures += 1;
				throw stable;
			} finally {
				clearTimeout(timeout);
			}
		}
		throw new BeatSaverVendorError("transport", "BeatSaver request exhausted retry policy");
	}
};
/** @param {Promise<Response>} request Request promise. @param {AbortSignal} signal Signal. @returns {Promise<Response>} Bounded response. */
function raceWithSignal(request, signal) {
	if (signal.aborted) return Promise.reject(signal.reason);
	return new Promise((resolve, reject) => {
		const aborted = () => reject(signal.reason);
		signal.addEventListener("abort", aborted, { once: true });
		request.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
	});
}
/** @param {URL} url URL. @returns {boolean} Whether URL is secure or an explicit loopback development seam. */
function isSecureTransportUrl(url) {
	return url.protocol === "https:" || url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
}
/** @param {string | null} value Header value. @returns {number | undefined} Valid byte length. */
function parseContentLength(value) {
	if (value === null || !/^(0|[1-9][0-9]*)$/u.test(value.trim())) return void 0;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : void 0;
}
/** @param {AbortSignal | undefined} first @param {AbortSignal} second @returns {AbortSignal} */
function combineSignals(first, second) {
	return first === void 0 ? second : AbortSignal.any([first, second]);
}
/** @param {number} status @returns {boolean} */
function isRetryableStatus(status) {
	return status === 429 || status === 502 || status === 503 || status === 504;
}
/** @param {string | null} value @returns {number | undefined} */
function parseRetryAfter(value) {
	if (value === null) return void 0;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.min(6e4, Math.max(0, Math.round(seconds * 1e3)));
	const date = Date.parse(value);
	return Number.isFinite(date) ? Math.min(6e4, Math.max(0, date - Date.now())) : void 0;
}
/** @param {number} milliseconds @param {AbortSignal | undefined} signal @returns {Promise<void>} */
function delay(milliseconds, signal) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted === true) {
			reject(new BeatSaverVendorError("aborted", "BeatSaver request was cancelled"));
			return;
		}
		const timer = setTimeout(resolve, milliseconds);
		signal?.addEventListener("abort", () => {
			clearTimeout(timer);
			reject(new BeatSaverVendorError("aborted", "BeatSaver request was cancelled"));
		}, { once: true });
	});
}
/** @param {number | undefined} value @param {number} fallback @param {number} minimum @param {number} maximum @returns {number} */
function boundedInteger(value, fallback, minimum, maximum) {
	return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? Math.trunc(value ?? fallback) : fallback));
}
/** @param {number} size @param {number} maximum @returns {void} */
function enforceDownloadSize(size, maximum) {
	if (size > maximum) throw new BeatSaverVendorError("archive", "BeatSaver archive exceeds download limit", { details: {
		maximum,
		size
	} });
}
/** @param {readonly Uint8Array[]} chunks @param {number} length @returns {Uint8Array} */
function concatenate(chunks, length) {
	const output = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}
//#endregion
//#region ../aerobeat-web-vendor-beatsaver/node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	2,
	2,
	2,
	2,
	3,
	3,
	3,
	3,
	4,
	4,
	4,
	4,
	5,
	5,
	5,
	5,
	0,
	0,
	0,
	0
]);
var fdeb = new u8([
	0,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	3,
	3,
	4,
	4,
	5,
	5,
	6,
	6,
	7,
	7,
	8,
	8,
	9,
	9,
	10,
	10,
	11,
	11,
	12,
	12,
	13,
	13,
	0,
	0
]);
var clim = new u8([
	16,
	17,
	18,
	0,
	8,
	7,
	9,
	6,
	10,
	5,
	11,
	4,
	12,
	3,
	13,
	2,
	14,
	1,
	15
]);
var freb = function(eb, start) {
	var b = new u16(31);
	for (var i = 0; i < 31; ++i) b[i] = start += 1 << eb[i - 1];
	var r = new i32(b[30]);
	for (var i = 1; i < 30; ++i) for (var j = b[i]; j < b[i + 1]; ++j) r[j] = j - b[i] << 5 | i;
	return {
		b,
		r
	};
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
_b.r;
var rev = new u16(32768);
for (var i = 0; i < 32768; ++i) {
	var x = (i & 43690) >> 1 | (i & 21845) << 1;
	x = (x & 52428) >> 2 | (x & 13107) << 2;
	x = (x & 61680) >> 4 | (x & 3855) << 4;
	rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var hMap = (function(cd, mb, r) {
	var s = cd.length;
	var i = 0;
	var l = new u16(mb);
	for (; i < s; ++i) if (cd[i]) ++l[cd[i] - 1];
	var le = new u16(mb);
	for (i = 1; i < mb; ++i) le[i] = le[i - 1] + l[i - 1] << 1;
	var co;
	if (r) {
		co = new u16(1 << mb);
		var rvb = 15 - mb;
		for (i = 0; i < s; ++i) if (cd[i]) {
			var sv = i << 4 | cd[i];
			var r_1 = mb - cd[i];
			var v = le[cd[i] - 1]++ << r_1;
			for (var m = v | (1 << r_1) - 1; v <= m; ++v) co[rev[v] >> rvb] = sv;
		}
	} else {
		co = new u16(s);
		for (i = 0; i < s; ++i) if (cd[i]) co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
	}
	return co;
});
var flt = new u8(288);
for (var i = 0; i < 144; ++i) flt[i] = 8;
for (var i = 144; i < 256; ++i) flt[i] = 9;
for (var i = 256; i < 280; ++i) flt[i] = 7;
for (var i = 280; i < 288; ++i) flt[i] = 8;
var fdt = new u8(32);
for (var i = 0; i < 32; ++i) fdt[i] = 5;
var flrm = /*#__PURE__*/ hMap(flt, 9, 1);
var fdrm = /*#__PURE__*/ hMap(fdt, 5, 1);
var max = function(a) {
	var m = a[0];
	for (var i = 1; i < a.length; ++i) if (a[i] > m) m = a[i];
	return m;
};
var bits = function(d, p, m) {
	var o = p / 8 | 0;
	return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
	var o = p / 8 | 0;
	return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
	return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
	if (s == null || s < 0) s = 0;
	if (e == null || e > v.length) e = v.length;
	return new u8(v.subarray(s, e));
};
var ec = [
	"unexpected EOF",
	"invalid block type",
	"invalid length/literal",
	"invalid distance",
	"stream finished",
	"no stream handler",
	,
	"no callback",
	"invalid UTF-8 data",
	"extra field too long",
	"date not in range 1980-2099",
	"filename too long",
	"stream finishing",
	"invalid zip data"
];
var err = function(ind, msg, nt) {
	var e = new Error(msg || ec[ind]);
	e.code = ind;
	if (Error.captureStackTrace) Error.captureStackTrace(e, err);
	if (!nt) throw e;
	return e;
};
var inflt = function(dat, st, buf, dict) {
	var sl = dat.length, dl = dict ? dict.length : 0;
	if (!sl || st.f && !st.l) return buf || new u8(0);
	var noBuf = !buf;
	var resize = noBuf || st.i != 2;
	var noSt = st.i;
	if (noBuf) buf = new u8(sl * 3);
	var cbuf = function(l) {
		var bl = buf.length;
		if (l > bl) {
			var nbuf = new u8(Math.max(bl * 2, l));
			nbuf.set(buf);
			buf = nbuf;
		}
	};
	var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
	var tbts = sl * 8;
	do {
		if (!lm) {
			final = bits(dat, pos, 1);
			var type = bits(dat, pos + 1, 3);
			pos += 3;
			if (!type) {
				var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
				if (t > sl) {
					if (noSt) err(0);
					break;
				}
				if (resize) cbuf(bt + l);
				buf.set(dat.subarray(s, t), bt);
				st.b = bt += l, st.p = pos = t * 8, st.f = final;
				continue;
			} else if (type == 1) lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
			else if (type == 2) {
				var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
				var tl = hLit + bits(dat, pos + 5, 31) + 1;
				pos += 14;
				var ldt = new u8(tl);
				var clt = new u8(19);
				for (var i = 0; i < hcLen; ++i) clt[clim[i]] = bits(dat, pos + i * 3, 7);
				pos += hcLen * 3;
				var clb = max(clt), clbmsk = (1 << clb) - 1;
				var clm = hMap(clt, clb, 1);
				for (var i = 0; i < tl;) {
					var r = clm[bits(dat, pos, clbmsk)];
					pos += r & 15;
					var s = r >> 4;
					if (s < 16) ldt[i++] = s;
					else {
						var c = 0, n = 0;
						if (s == 16) n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
						else if (s == 17) n = 3 + bits(dat, pos, 7), pos += 3;
						else if (s == 18) n = 11 + bits(dat, pos, 127), pos += 7;
						while (n--) ldt[i++] = c;
					}
				}
				var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
				lbt = max(lt);
				dbt = max(dt);
				lm = hMap(lt, lbt, 1);
				dm = hMap(dt, dbt, 1);
			} else err(1);
			if (pos > tbts) {
				if (noSt) err(0);
				break;
			}
		}
		if (resize) cbuf(bt + 131072);
		var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
		var lpos = pos;
		for (;; lpos = pos) {
			var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
			pos += c & 15;
			if (pos > tbts) {
				if (noSt) err(0);
				break;
			}
			if (!c) err(2);
			if (sym < 256) buf[bt++] = sym;
			else if (sym == 256) {
				lpos = pos, lm = null;
				break;
			} else {
				var add = sym - 254;
				if (sym > 264) {
					var i = sym - 257, b = fleb[i];
					add = bits(dat, pos, (1 << b) - 1) + fl[i];
					pos += b;
				}
				var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
				if (!d) err(3);
				pos += d & 15;
				var dt = fd[dsym];
				if (dsym > 3) {
					var b = fdeb[dsym];
					dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
				}
				if (pos > tbts) {
					if (noSt) err(0);
					break;
				}
				if (resize) cbuf(bt + 131072);
				var end = bt + add;
				if (bt < dt) {
					var shift = dl - dt, dend = Math.min(dt, end);
					if (shift + bt < 0) err(3);
					for (; bt < dend; ++bt) buf[bt] = dict[shift + bt];
				}
				for (; bt < end; ++bt) buf[bt] = buf[bt - dt];
			}
		}
		st.l = lm, st.p = lpos, st.b = bt, st.f = final;
		if (lm) final = 1, st.m = lbt, st.d = dm, st.n = dbt;
	} while (!final);
	return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /*#__PURE__*/ new u8(0);
/**
* Streaming DEFLATE decompression
*/
var Inflate = /* @__PURE__ */ function() {
	function Inflate(opts, cb) {
		if (typeof opts == "function") cb = opts, opts = {};
		this.ondata = cb;
		var dict = opts && opts.dictionary && opts.dictionary.subarray(-32768);
		this.s = {
			i: 0,
			b: dict ? dict.length : 0
		};
		this.o = new u8(32768);
		this.p = new u8(0);
		if (dict) this.o.set(dict);
	}
	Inflate.prototype.e = function(c) {
		if (!this.ondata) err(5);
		if (this.d) err(4);
		if (!this.p.length) this.p = c;
		else if (c.length) {
			var n = new u8(this.p.length + c.length);
			n.set(this.p), n.set(c, this.p.length), this.p = n;
		}
	};
	Inflate.prototype.c = function(final) {
		this.s.i = +(this.d = final || false);
		var bts = this.s.b;
		var dt = inflt(this.p, this.s, this.o);
		this.ondata(slc(dt, bts, this.s.b), this.d);
		this.o = slc(dt, this.s.b - 32768), this.s.b = this.o.length;
		this.p = slc(this.p, this.s.p / 8 | 0), this.s.p &= 7;
	};
	/**
	* Pushes a chunk to be inflated
	* @param chunk The chunk to push
	* @param final Whether this is the final chunk
	*/
	Inflate.prototype.push = function(chunk, final) {
		this.e(chunk), this.c(final);
	};
	return Inflate;
}();
var td = typeof TextDecoder != "undefined" && /*#__PURE__*/ new TextDecoder();
try {
	td.decode(et, { stream: true });
} catch (e) {}
//#endregion
//#region ../aerobeat-web-vendor-beatsaver/src/archive.js
/** @typedef {Readonly<{maxArchiveBytes: number, maxEntries: number, maxEntryBytes: number, maxExpandedBytes: number, maxCompressionRatio: number, maxInfoBytes: number}>} BeatSaverArchiveLimits */
/** @typedef {Readonly<{path: string, basename: string, extension: string, directory: boolean, compressedBytes: number, expandedBytes: number, compressionMethod: number, infoDat: boolean, audioCandidate: boolean, coverCandidate: boolean, difficultyCandidate: boolean}>} BeatSaverArchiveEntry */
/** @typedef {Readonly<{characteristic: "Standard", difficulty: string, difficultyRank: number, path: string, noteJumpMovementSpeed: number, noteJumpStartBeatOffset: number}>} BeatSaverSourceDifficulty */
/** @typedef {Readonly<{schemaId: "aerobeat.beatsaver-source-manifest.v1", sourceFormatMajor: 2 | 3 | 4, infoPath: string, hashInputPaths: readonly string[], songName: string, songSubName: string, songAuthorName: string, levelAuthorName: string, audioPath: string, coverPath: string, bpm: number, previewStartSeconds: number, previewDurationSeconds: number, difficulties: readonly BeatSaverSourceDifficulty[], entries: readonly BeatSaverArchiveEntry[], archiveBytes: number, expandedBytes: number}>} BeatSaverSourceManifest */
/** @typedef {Readonly<{manifest: BeatSaverSourceManifest, listEntryPaths: () => readonly string[], readEntry: (path: string) => Uint8Array}>} BeatSaverSourceBundle */
/** @type {BeatSaverArchiveLimits} */
var defaultBeatSaverArchiveLimits = Object.freeze({
	maxArchiveBytes: 134217728,
	maxEntries: 2048,
	maxEntryBytes: 67108864,
	maxExpandedBytes: 536870912,
	maxCompressionRatio: 200,
	maxInfoBytes: 2097152
});
/** Canonical playable order for exact Standard characteristic entries. */
var standardDifficultyOrder = Object.freeze([
	"Easy",
	"Normal",
	"Hard",
	"Expert",
	"ExpertPlus"
]);
var standardDifficultyByToken = Object.freeze({
	easy: "Easy",
	normal: "Normal",
	hard: "Hard",
	expert: "Expert",
	expertplus: "ExpertPlus"
});
/**
* Inspect untrusted BeatSaver ZIP bytes and expose provider-neutral source data.
*
* @param {Blob | ArrayBuffer | Uint8Array} input Archive input.
* @param {{limits?: Partial<BeatSaverArchiveLimits>}} [options] Limits.
* @returns {Promise<BeatSaverSourceBundle>} Safe source bundle.
*/
async function inspectBeatSaverArchive(input, options = {}) {
	const limits = normalizeLimits(options.limits);
	const archiveBytes = await readInput(input);
	if (archiveBytes.byteLength > limits.maxArchiveBytes) failArchive("Archive exceeds byte limit", {
		size: archiveBytes.byteLength,
		maximum: limits.maxArchiveBytes
	});
	const centralEntries = parseCentralDirectory(archiveBytes, limits);
	/** @type {Map<string, Uint8Array>} */
	const dataByPath = /* @__PURE__ */ new Map();
	let actualExpandedTotal = 0;
	for (const entry of centralEntries) {
		if (entry.directory) continue;
		const bytes = inflateArchiveEntry(archiveBytes, entry, limits);
		actualExpandedTotal += bytes.byteLength;
		if (actualExpandedTotal > limits.maxExpandedBytes) failArchive("Archive exceeds actual expanded byte limit", { size: actualExpandedTotal });
		if (crc32(bytes) !== entry.crc32) failArchive("ZIP entry CRC-32 does not match central directory", { path: entry.path });
		dataByPath.set(pathKey(entry.path), bytes);
	}
	const infoEntries = centralEntries.filter((entry) => entry.infoDat && !entry.directory);
	if (infoEntries.length !== 1) failArchive("Archive must contain exactly one Info.dat", { candidates: infoEntries.length });
	const infoEntry = infoEntries[0];
	if (infoEntry.expandedBytes > limits.maxInfoBytes) failArchive("Info.dat exceeds byte limit", { size: infoEntry.expandedBytes });
	const infoBytes = dataByPath.get(pathKey(infoEntry.path));
	if (infoBytes === void 0) failArchive("Info.dat could not be read");
	const manifest = buildSourceManifest(parseJson(infoBytes, "Info.dat"), infoEntry.path, centralEntries, archiveBytes.byteLength);
	const availablePaths = Object.freeze(centralEntries.filter((entry) => !entry.directory).map((entry) => entry.path));
	return Object.freeze({
		manifest,
		listEntryPaths: () => availablePaths,
		readEntry: (path) => {
			const normalized = pathKey(normalizeEntryPath(path));
			const bytes = dataByPath.get(normalized);
			if (bytes === void 0) throw new BeatSaverVendorError("invalid_request", "Archive entry does not exist", { details: { path } });
			return bytes.slice();
		}
	});
}
/**
* @param {Uint8Array} bytes Bytes.
* @returns {Promise<string>} Lowercase SHA-1.
*/
async function sha1Hex(bytes) {
	const copy = Uint8Array.from(bytes);
	const digest = await crypto.subtle.digest("SHA-1", copy.buffer);
	return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
/**
* Compute the BeatSaver/SongCore map hash. The stream starts with the raw
* downloaded Info.dat bytes. For v4 it then contains audioDataFilename bytes,
* followed by each difficulty's beatmap and lightshow bytes in metadata order,
* including repeated shared references. Legacy v2/v3 sequencing is unchanged.
*
* @param {BeatSaverSourceBundle} source Safe source bundle.
* @returns {Promise<string>} Lowercase provider map hash.
*/
async function computeBeatSaverMapHash(source) {
	const parts = [source.manifest.infoPath, ...source.manifest.hashInputPaths].map((path) => source.readEntry(path));
	const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const combined = new Uint8Array(length);
	let offset = 0;
	for (const part of parts) {
		combined.set(part, offset);
		offset += part.byteLength;
	}
	return sha1Hex(combined);
}
/** @typedef {BeatSaverArchiveEntry & Readonly<{originalPath: string, flags: number, crc32: number, localHeaderOffset: number, dataOffset: number, dataEnd: number, recordEnd: number}>} InternalArchiveEntry */
/**
* @param {Uint8Array} bytes ZIP bytes.
* @param {BeatSaverArchiveLimits} limits Limits.
* @returns {readonly InternalArchiveEntry[]} Entries.
*/
function parseCentralDirectory(bytes, limits) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocdOffset = findEndOfCentralDirectory(view);
	const diskNumber = view.getUint16(eocdOffset + 4, true);
	const centralDisk = view.getUint16(eocdOffset + 6, true);
	const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
	const entryCount = view.getUint16(eocdOffset + 10, true);
	const centralSize = view.getUint32(eocdOffset + 12, true);
	const centralOffset = view.getUint32(eocdOffset + 16, true);
	if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) failArchive("Multi-disk ZIP archives are unsupported");
	if (entryCount === 65535 || centralOffset === 4294967295 || centralSize === 4294967295) failArchive("ZIP64 archives are unsupported");
	if (entryCount > limits.maxEntries) failArchive("Archive entry count exceeds limit", {
		count: entryCount,
		maximum: limits.maxEntries
	});
	if (centralOffset + centralSize > eocdOffset) failArchive("Central directory range is invalid");
	/** @type {InternalArchiveEntry[]} */
	const entries = [];
	const seen = /* @__PURE__ */ new Set();
	let expandedTotal = 0;
	let cursor = centralOffset;
	for (let index = 0; index < entryCount; index += 1) {
		if (cursor + 46 > bytes.byteLength || view.getUint32(cursor, true) !== 33639248) failArchive("Central directory entry is malformed", { index });
		const madeBy = view.getUint16(cursor + 4, true);
		const flags = view.getUint16(cursor + 8, true);
		const method = view.getUint16(cursor + 10, true);
		const crc = view.getUint32(cursor + 16, true);
		const compressedBytes = view.getUint32(cursor + 20, true);
		const expandedBytes = view.getUint32(cursor + 24, true);
		const nameLength = view.getUint16(cursor + 28, true);
		const extraLength = view.getUint16(cursor + 30, true);
		const commentLength = view.getUint16(cursor + 32, true);
		const diskStart = view.getUint16(cursor + 34, true);
		const externalAttributes = view.getUint32(cursor + 38, true);
		const localHeaderOffset = view.getUint32(cursor + 42, true);
		const end = cursor + 46 + nameLength + extraLength + commentLength;
		if (end > bytes.byteLength) failArchive("Central directory entry extends beyond archive", { index });
		if ((flags & 1) !== 0 || (flags & 64) !== 0) failArchive("Encrypted ZIP entries are unsupported", { index });
		if (method !== 0 && method !== 8) failArchive("ZIP compression method is unsupported", {
			index,
			method
		});
		if (diskStart !== 0) failArchive("Multi-disk ZIP entries are unsupported", { index });
		if (compressedBytes === 4294967295 || expandedBytes === 4294967295 || localHeaderOffset === 4294967295) failArchive("ZIP64 entries are unsupported", { index });
		validateExtraFields(bytes.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength), index);
		const originalPath = decodeName(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
		const path = normalizeEntryPath(originalPath);
		const directory = path.endsWith("/");
		const unixHost = madeBy >>> 8 === 3;
		const unixType = externalAttributes >>> 16 & 61440;
		if (unixHost && unixType === 40960) failArchive("Symbolic links are unsupported", { path });
		if (unixHost && unixType !== 0 && unixType !== 16384 && unixType !== 32768) failArchive("Special ZIP filesystem entries are unsupported", { path });
		if (unixHost && (directory && unixType === 32768 || !directory && unixType === 16384)) failArchive("ZIP directory mode disagrees with its path", { path });
		if (!directory && (externalAttributes & 16) !== 0) failArchive("ZIP directory attributes disagree with its path", { path });
		if (!directory) {
			if (expandedBytes > limits.maxEntryBytes) failArchive("ZIP entry exceeds expanded byte limit", {
				path,
				size: expandedBytes
			});
			const ratio = compressedBytes === 0 ? expandedBytes === 0 ? 1 : Number.POSITIVE_INFINITY : expandedBytes / compressedBytes;
			if (ratio > limits.maxCompressionRatio) failArchive("ZIP entry exceeds compression-ratio limit", {
				path,
				ratio: Math.round(ratio)
			});
			expandedTotal += expandedBytes;
			if (expandedTotal > limits.maxExpandedBytes) failArchive("Archive exceeds total expanded byte limit", { size: expandedTotal });
		}
		const caseKey = pathKey(path);
		if (seen.has(caseKey)) failArchive("Archive contains duplicate normalized paths", { path });
		seen.add(caseKey);
		const basename = path.endsWith("/") ? "" : path.slice(path.lastIndexOf("/") + 1);
		const extension = basename.includes(".") ? basename.slice(basename.lastIndexOf(".") + 1).toLowerCase() : "";
		const local = validateLocalEntry(bytes, centralOffset, index, {
			originalPath,
			flags,
			method,
			crc,
			compressedBytes,
			expandedBytes,
			localHeaderOffset
		});
		entries.push(Object.freeze({
			originalPath,
			path,
			basename,
			extension,
			directory,
			compressedBytes,
			expandedBytes,
			compressionMethod: method,
			infoDat: basename.toLowerCase() === "info.dat",
			audioCandidate: [
				"egg",
				"ogg",
				"wav",
				"mp3"
			].includes(extension),
			coverCandidate: [
				"png",
				"jpg",
				"jpeg",
				"webp"
			].includes(extension),
			difficultyCandidate: ["dat", "json"].includes(extension) && basename.toLowerCase() !== "info.dat",
			flags,
			crc32: crc,
			localHeaderOffset,
			dataOffset: local.dataOffset,
			dataEnd: local.dataEnd,
			recordEnd: local.recordEnd
		}));
		cursor = end;
	}
	if (cursor !== centralOffset + centralSize) failArchive("Central directory size does not match entries");
	const ranges = [...entries].sort((left, right) => left.localHeaderOffset - right.localHeaderOffset);
	for (let index = 1; index < ranges.length; index += 1) if ((ranges[index - 1]?.recordEnd ?? 0) > (ranges[index]?.localHeaderOffset ?? 0)) failArchive("ZIP local entry ranges overlap");
	return Object.freeze(entries);
}
/**
* @param {Record<string, unknown>} info Parsed Info.dat.
* @param {string} infoPath Info path.
* @param {readonly InternalArchiveEntry[]} entries Entries.
* @param {number} archiveBytes Archive bytes.
* @returns {BeatSaverSourceManifest} Manifest.
*/
function buildSourceManifest(info, infoPath, entries, archiveBytes) {
	const sourceFormatMajor = detectFormatMajor(optionalString(info.version) || optionalString(info._version), info);
	const song = optionalRecord(info.song);
	const audio = optionalRecord(info.audio);
	const difficultyPayloads = collectDifficultyPayloads(info);
	/** @type {string[]} */
	const hashInputPaths = [];
	if (sourceFormatMajor === 4) {
		const audioDataPath = optionalString(audio.audioDataFilename);
		if (!audioDataPath) throw new BeatSaverVendorError("provider_payload", "v4 Info.dat does not reference audio data");
		hashInputPaths.push(resolveArchivePath(audioDataPath, entries, "audio data hash input"));
		for (const payload of difficultyPayloads) {
			const beatmapPath = optionalString(payload.beatmapDataFilename);
			const lightshowPath = optionalString(payload.lightshowDataFilename);
			for (const candidate of [beatmapPath, lightshowPath]) if (candidate) hashInputPaths.push(resolveArchivePath(candidate, entries, "hash input"));
		}
	} else {
		const seenHashPaths = /* @__PURE__ */ new Set();
		for (const payload of difficultyPayloads) {
			const beatmapPath = optionalString(payload.beatmapDataFilename) || optionalString(payload.beatmapFilename) || optionalString(payload._beatmapFilename);
			const lightshowPath = optionalString(payload.lightshowDataFilename);
			for (const candidate of [beatmapPath, lightshowPath]) {
				if (!candidate) continue;
				const resolved = resolveArchivePath(candidate, entries, "hash input");
				const key = pathKey(resolved);
				if (!seenHashPaths.has(key)) {
					hashInputPaths.push(resolved);
					seenHashPaths.add(key);
				}
			}
		}
	}
	/** @type {BeatSaverSourceDifficulty[]} */
	const difficulties = [];
	const seenStandardDifficulties = /* @__PURE__ */ new Set();
	for (const payload of difficultyPayloads) {
		if ((optionalString(payload.characteristic) || optionalString(payload.beatmapCharacteristicName) || optionalString(payload._beatmapCharacteristicName)) !== "Standard") continue;
		const difficultyValue = optionalString(payload.difficulty) || optionalString(payload._difficulty);
		const path = optionalString(payload.beatmapDataFilename) || optionalString(payload.beatmapFilename) || optionalString(payload._beatmapFilename);
		if (!difficultyValue || !path) throw new BeatSaverVendorError("provider_payload", "Standard difficulty entry is missing difficulty or path");
		const difficulty = canonicalStandardDifficulty(difficultyValue);
		if (seenStandardDifficulties.has(difficulty)) throw new BeatSaverVendorError("provider_payload", `Standard difficulty ${difficulty} is duplicated`);
		seenStandardDifficulties.add(difficulty);
		const resolvedPath = resolveArchivePath(path, entries, "difficulty");
		difficulties.push(Object.freeze({
			characteristic: "Standard",
			difficulty,
			difficultyRank: Math.trunc(finiteNumber$1(payload.difficultyRank ?? payload._difficultyRank)),
			path: resolvedPath,
			noteJumpMovementSpeed: finiteNumber$1(payload.noteJumpMovementSpeed ?? payload._noteJumpMovementSpeed),
			noteJumpStartBeatOffset: finiteNumber$1(payload.noteJumpStartBeatOffset ?? payload._noteJumpStartBeatOffset)
		}));
	}
	if (difficulties.length === 0) throw new BeatSaverVendorError("unsupported", "BeatSaver archive has no supported Standard difficulties");
	difficulties.sort((left, right) => standardDifficultyOrder.indexOf(left.difficulty) - standardDifficultyOrder.indexOf(right.difficulty));
	const audioName = optionalString(audio.songFilename) || optionalString(info.songFilename) || optionalString(info._songFilename);
	if (!audioName) throw new BeatSaverVendorError("provider_payload", "Info.dat does not reference song audio");
	const coverName = optionalString(info.coverImageFilename) || optionalString(info._coverImageFilename);
	const audioPath = resolveArchivePath(audioName, entries, "audio");
	const coverPath = coverName ? resolveArchivePath(coverName, entries, "cover") : "";
	const publicEntries = entries.map(({ originalPath: _originalPath, flags: _flags, crc32: _crc32, localHeaderOffset: _localHeaderOffset, dataOffset: _dataOffset, dataEnd: _dataEnd, recordEnd: _recordEnd, ...entry }) => Object.freeze(entry));
	const expandedBytes = entries.reduce((sum, entry) => sum + (entry.directory ? 0 : entry.expandedBytes), 0);
	return Object.freeze({
		schemaId: "aerobeat.beatsaver-source-manifest.v1",
		sourceFormatMajor,
		infoPath,
		hashInputPaths: Object.freeze(hashInputPaths),
		songName: optionalString(song.title) || optionalString(info.songName) || optionalString(info._songName),
		songSubName: optionalString(song.subTitle) || optionalString(info.songSubName) || optionalString(info._songSubName),
		songAuthorName: optionalString(song.author) || optionalString(info.songAuthorName) || optionalString(info._songAuthorName),
		levelAuthorName: optionalString(info.levelAuthorName) || optionalString(info._levelAuthorName),
		audioPath,
		coverPath,
		bpm: finiteNumber$1(audio.bpm ?? info.beatsPerMinute ?? info._beatsPerMinute),
		previewStartSeconds: finiteNumber$1(audio.previewStartTime ?? info.previewStartTime ?? info._previewStartTime),
		previewDurationSeconds: finiteNumber$1(audio.previewDuration ?? info.previewDuration ?? info._previewDuration),
		difficulties: Object.freeze(difficulties),
		entries: Object.freeze(publicEntries),
		archiveBytes,
		expandedBytes
	});
}
/** @param {Record<string, unknown>} info @returns {readonly Record<string, unknown>[]} */
function collectDifficultyPayloads(info) {
	const direct = optionalArray(info.difficultyBeatmaps).map((entry) => requireRecord(entry, "difficultyBeatmaps[]"));
	if (direct.length > 0) return direct;
	const sets = optionalArray(info.difficultyBeatmapSets ?? info._difficultyBeatmapSets);
	/** @type {Record<string, unknown>[]} */
	const results = [];
	for (const setValue of sets) {
		const set = requireRecord(setValue, "difficultyBeatmapSets[]");
		const characteristic = optionalString(set.beatmapCharacteristicName) || optionalString(set._beatmapCharacteristicName);
		for (const difficultyValue of optionalArray(set.difficultyBeatmaps ?? set._difficultyBeatmaps)) {
			const difficulty = { ...requireRecord(difficultyValue, "difficultyBeatmaps[]") };
			if (difficulty.characteristic === void 0 && difficulty.beatmapCharacteristicName === void 0 && difficulty._beatmapCharacteristicName === void 0) difficulty.characteristic = characteristic;
			results.push(difficulty);
		}
	}
	return results;
}
/**
* Normalize only the five supported Beat Saber Standard difficulty identities.
* Separators and a literal plus sign are accepted solely to reject aliases as
* duplicate canonical identities instead of making archive order meaningful.
*
* @param {string} value Raw Standard difficulty label.
* @returns {string} Canonical difficulty.
*/
function canonicalStandardDifficulty(value) {
	const difficulty = standardDifficultyByToken[value.toLowerCase().replace(/\+/gu, "plus").replace(/[^a-z]/gu, "")];
	if (!difficulty) throw new BeatSaverVendorError("unsupported", "Standard difficulty label is unsupported");
	return difficulty;
}
/** @param {string} version @param {Record<string, unknown>} info @returns {2 | 3 | 4} */
function detectFormatMajor(version, info) {
	const major = Number.parseInt(version.split(".")[0] ?? "", 10);
	if (major === 2 || major === 3 || major === 4) return major;
	if (info._version !== void 0 || info._difficultyBeatmapSets !== void 0) return 2;
	if (info.song !== void 0 || info.audio !== void 0 || info.difficultyBeatmaps !== void 0) return 4;
	if (info.version !== void 0 || info.difficultyBeatmapSets !== void 0) return 3;
	throw new BeatSaverVendorError("unsupported", "Unsupported or missing Beat Saber metadata version", { details: { version } });
}
/** @param {string} requested @param {readonly InternalArchiveEntry[]} entries @param {string} role @returns {string} */
function resolveArchivePath(requested, entries, role) {
	const normalized = pathKey(normalizeEntryPath(requested));
	const match = entries.find((entry) => !entry.directory && pathKey(entry.path) === normalized);
	if (match === void 0) throw new BeatSaverVendorError("provider_payload", `Info.dat ${role} path is absent from archive`, { details: { path: requested } });
	return match.path;
}
/** @param {string} value @returns {string} */
function normalizeEntryPath(value) {
	if (typeof value !== "string" || value.length === 0 || /[\p{Cc}\p{Cf}]/u.test(value)) failArchive("ZIP entry path contains forbidden control characters");
	const path = value.replaceAll("\\", "/").normalize("NFC");
	if (path.startsWith("/") || /^[a-zA-Z]:\//u.test(path)) failArchive("Absolute ZIP entry paths are forbidden", { path });
	const directory = path.endsWith("/");
	const parts = path.split("/").filter((part) => part !== "" && part !== ".");
	if (parts.length === 0 && !directory) failArchive("ZIP entry path is empty");
	if (parts.some((part) => part === "..")) failArchive("Parent ZIP entry paths are forbidden", { path });
	const normalized = parts.join("/") + (directory ? "/" : "");
	if (normalized.length > 1024) failArchive("ZIP entry path exceeds length limit");
	return normalized;
}
/** @param {string} path @returns {string} */
function pathKey(path) {
	return path.normalize("NFC").toLowerCase();
}
/**
* @param {Uint8Array} bytes Archive bytes.
* @param {number} centralOffset Central directory offset.
* @param {number} index Entry index.
* @param {Readonly<{originalPath: string, flags: number, method: number, crc: number, compressedBytes: number, expandedBytes: number, localHeaderOffset: number}>} entry Central metadata.
* @returns {Readonly<{dataOffset: number, dataEnd: number, recordEnd: number}>} Validated local range.
*/
function validateLocalEntry(bytes, centralOffset, index, entry) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const offset = entry.localHeaderOffset;
	if (offset + 30 > centralOffset || view.getUint32(offset, true) !== 67324752) failArchive("ZIP local header is malformed", { index });
	const flags = view.getUint16(offset + 6, true);
	const method = view.getUint16(offset + 8, true);
	const localCrc = view.getUint32(offset + 14, true);
	const localCompressed = view.getUint32(offset + 18, true);
	const localExpanded = view.getUint32(offset + 22, true);
	const nameLength = view.getUint16(offset + 26, true);
	const extraLength = view.getUint16(offset + 28, true);
	const dataOffset = offset + 30 + nameLength + extraLength;
	const dataEnd = dataOffset + entry.compressedBytes;
	if (dataOffset > centralOffset || dataEnd > centralOffset) failArchive("ZIP local entry extends into the central directory", { index });
	if (flags !== entry.flags) failArchive("ZIP local and central flags disagree", { index });
	if (method !== entry.method) failArchive("ZIP local and central compression methods disagree", { index });
	if (decodeName(bytes.subarray(offset + 30, offset + 30 + nameLength)) !== entry.originalPath) failArchive("ZIP local and central filenames disagree", { index });
	validateExtraFields(bytes.subarray(offset + 30 + nameLength, dataOffset), index);
	if (!((flags & 8) !== 0)) {
		if (localCrc !== entry.crc || localCompressed !== entry.compressedBytes || localExpanded !== entry.expandedBytes) failArchive("ZIP local and central sizes or CRC disagree", { index });
		return Object.freeze({
			dataOffset,
			dataEnd,
			recordEnd: dataEnd
		});
	}
	if (localCrc !== 0 && localCrc !== entry.crc || localCompressed !== 0 && localCompressed !== entry.compressedBytes || localExpanded !== 0 && localExpanded !== entry.expandedBytes) failArchive("ZIP descriptor entry has conflicting local metadata", { index });
	const recordEnd = validateDataDescriptor(view, dataEnd, centralOffset, entry, index);
	return Object.freeze({
		dataOffset,
		dataEnd,
		recordEnd
	});
}
/**
* @param {DataView} view Archive view.
* @param {number} offset Descriptor offset.
* @param {number} centralOffset Central directory offset.
* @param {Readonly<{crc: number, compressedBytes: number, expandedBytes: number}>} entry Entry metadata.
* @param {number} index Entry index.
* @returns {number} Descriptor end.
*/
function validateDataDescriptor(view, offset, centralOffset, entry, index) {
	if (offset + 12 <= centralOffset && view.getUint32(offset, true) === entry.crc && view.getUint32(offset + 4, true) === entry.compressedBytes && view.getUint32(offset + 8, true) === entry.expandedBytes) return offset + 12;
	if (offset + 16 <= centralOffset && view.getUint32(offset, true) === 134695760 && view.getUint32(offset + 4, true) === entry.crc && view.getUint32(offset + 8, true) === entry.compressedBytes && view.getUint32(offset + 12, true) === entry.expandedBytes) return offset + 16;
	failArchive("ZIP data descriptor disagrees with central directory", { index });
}
/** @param {Uint8Array} extra Extra field bytes. @param {number} index Entry index. @returns {void} */
function validateExtraFields(extra, index) {
	const view = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
	let cursor = 0;
	while (cursor < extra.byteLength) {
		if (cursor + 4 > extra.byteLength) failArchive("ZIP extra field is malformed", { index });
		const id = view.getUint16(cursor, true);
		const length = view.getUint16(cursor + 2, true);
		cursor += 4;
		if (cursor + length > extra.byteLength) failArchive("ZIP extra field extends beyond its record", { index });
		if (id === 1) failArchive("ZIP64 entries are unsupported", { index });
		cursor += length;
	}
}
/** @param {Uint8Array} archive Archive bytes. @param {InternalArchiveEntry} entry Entry. @param {BeatSaverArchiveLimits} limits Limits. @returns {Uint8Array} Expanded bytes. */
function inflateArchiveEntry(archive, entry, limits) {
	const compressed = archive.subarray(entry.dataOffset, entry.dataEnd);
	if (entry.compressionMethod === 0) {
		if (compressed.byteLength !== entry.expandedBytes) failArchive("Stored ZIP entry size differs from central directory", { path: entry.path });
		return Uint8Array.from(compressed);
	}
	/** @type {Uint8Array[]} */
	const chunks = [];
	let actualBytes = 0;
	const inflater = new Inflate((chunk) => {
		actualBytes += chunk.byteLength;
		if (actualBytes > entry.expandedBytes || actualBytes > limits.maxEntryBytes) failArchive("DEFLATE output exceeds declared or configured size", {
			path: entry.path,
			size: actualBytes
		});
		chunks.push(Uint8Array.from(chunk));
	});
	try {
		const chunkSize = 16384;
		if (compressed.byteLength === 0) inflater.push(compressed, true);
		for (let offset = 0; offset < compressed.byteLength; offset += chunkSize) inflater.push(compressed.subarray(offset, Math.min(compressed.byteLength, offset + chunkSize)), offset + chunkSize >= compressed.byteLength);
	} catch (error) {
		if (error instanceof BeatSaverVendorError) throw error;
		throw new BeatSaverVendorError("archive", "ZIP DEFLATE decompression failed", {
			cause: error,
			details: { path: entry.path }
		});
	}
	if (actualBytes !== entry.expandedBytes) failArchive("DEFLATE output size differs from central directory", {
		path: entry.path,
		size: actualBytes
	});
	return concatenateBytes(chunks, actualBytes);
}
/** @param {readonly Uint8Array[]} chunks Chunks. @param {number} length Length. @returns {Uint8Array} Bytes. */
function concatenateBytes(chunks, length) {
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}
var CRC32_TABLE = (() => {
	const table = /* @__PURE__ */ new Uint32Array(256);
	for (let index = 0; index < 256; index += 1) {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) value = (value & 1) !== 0 ? 3988292384 ^ value >>> 1 : value >>> 1;
		table[index] = value >>> 0;
	}
	return table;
})();
/** @param {Uint8Array} bytes Bytes. @returns {number} Unsigned CRC-32. */
function crc32(bytes) {
	let value = 4294967295;
	for (const byte of bytes) value = (CRC32_TABLE[(value ^ byte) & 255] ?? 0) ^ value >>> 8;
	return (value ^ 4294967295) >>> 0;
}
/** @param {DataView} view @returns {number} */
function findEndOfCentralDirectory(view) {
	const minimum = Math.max(0, view.byteLength - 65557);
	for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
		if (view.getUint32(offset, true) !== 101010256) continue;
		const commentLength = view.getUint16(offset + 20, true);
		if (offset + 22 + commentLength === view.byteLength) {
			if (offset >= 20 && view.getUint32(offset - 20, true) === 117853008) failArchive("ZIP64 archives are unsupported");
			return offset;
		}
	}
	failArchive("ZIP end-of-central-directory record was not found");
}
/** @param {Uint8Array} bytes @returns {string} */
function decodeName(bytes) {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch (error) {
		throw new BeatSaverVendorError("archive", "ZIP entry name is not valid UTF-8", { cause: error });
	}
}
/** @param {Uint8Array} bytes @param {string} context @returns {Record<string, unknown>} */
function parseJson(bytes, context) {
	try {
		return requireRecord(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), context);
	} catch (error) {
		if (error instanceof BeatSaverVendorError) throw error;
		throw new BeatSaverVendorError("provider_payload", `${context} is not valid UTF-8 JSON`, { cause: error });
	}
}
/** @param {Blob | ArrayBuffer | Uint8Array} input @returns {Promise<Uint8Array>} */
async function readInput(input) {
	if (input instanceof Uint8Array) return input.slice();
	if (input instanceof ArrayBuffer) return new Uint8Array(input.slice(0));
	if (input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
	throw new BeatSaverVendorError("invalid_request", "Archive input must be Blob, ArrayBuffer, or Uint8Array");
}
/** @param {Partial<BeatSaverArchiveLimits> | undefined} override @returns {BeatSaverArchiveLimits} */
function normalizeLimits(override) {
	const merged = {
		...defaultBeatSaverArchiveLimits,
		...override ?? {}
	};
	for (const [key, value] of Object.entries(merged)) if (!Number.isFinite(value) || value <= 0) throw new BeatSaverVendorError("invalid_request", `Archive limit ${key} must be positive`);
	return Object.freeze(merged);
}
/** @param {string} message @param {Record<string, string | number | boolean>} [details] @returns {never} */
function failArchive(message, details = {}) {
	throw new BeatSaverVendorError("archive", message, { details });
}
//#endregion
//#region ../aerobeat-web-vendor-beatsaver/src/service.js
/** @typedef {import("./normalize.js").BeatSaverMap} BeatSaverMap */
/** @typedef {import("./normalize.js").BeatSaverVersion} BeatSaverVersion */
/** @typedef {import("./archive.js").BeatSaverSourceBundle} BeatSaverSourceBundle */
/** @typedef {Readonly<{serviceId: "aero.vendor.beatsaver", providerId: "beatsaver", phase: string, operation: string, lastErrorCode: string, lastMapId: string, capabilities: typeof beatSaverVendorCapabilities, transport: import("./transport.js").BeatSaverTransportTelemetry}>} BeatSaverVendorSnapshot */
/**
* Browser BeatSaver vendor facade.
*/
var AeroBeatSaverVendorService = class {
	/**
	* @param {{apiBaseUrl?: string, transport?: BeatSaverTransport, fetch?: import("./transport.js").BeatSaverFetch, proxyUrl?: (url: URL) => string | URL, timeoutMs?: number, maxRetries?: number, retryBaseMs?: number, maxDownloadBytes?: number, archiveLimits?: Partial<import("./archive.js").BeatSaverArchiveLimits>}} [options] Options.
	*/
	constructor(options = {}) {
		let apiBaseUrl;
		try {
			apiBaseUrl = new URL(options.apiBaseUrl ?? "https://api.beatsaver.com/");
		} catch (error) {
			throw new BeatSaverVendorError("invalid_request", "BeatSaver API base URL must be a valid URL", { cause: error });
		}
		if (apiBaseUrl.protocol !== "https:" || apiBaseUrl.username !== "" || apiBaseUrl.password !== "") throw new BeatSaverVendorError("invalid_request", "BeatSaver API base URL must use credential-free HTTPS");
		this.apiBaseUrl = apiBaseUrl;
		this.transport = options.transport ?? new BeatSaverTransport({
			fetch: options.fetch,
			proxyUrl: options.proxyUrl,
			timeoutMs: options.timeoutMs,
			maxRetries: options.maxRetries,
			retryBaseMs: options.retryBaseMs
		});
		this.maxDownloadBytes = Number.isFinite(options.maxDownloadBytes) ? Math.max(1, Math.trunc(options.maxDownloadBytes ?? 0)) : 134217728;
		this.archiveLimits = options.archiveLimits;
		/** @type {Map<string, number>} */
		this.activeOperations = /* @__PURE__ */ new Map();
		this.state = {
			lastErrorCode: "",
			lastMapId: ""
		};
	}
	/**
	* @param {{text?: string, page?: number, pageSize?: number, order?: string, automapper?: boolean, tags?: readonly string[], difficulty?: string}} [query] Search query.
	* @param {{signal?: AbortSignal}} [options] Operation options.
	* @returns {Promise<import("./normalize.js").BeatSaverMapCollection>} Result.
	*/
	async searchMaps(query = {}, options = {}) {
		return this.run("search", async () => {
			const page = normalizePage(query.page);
			const wanted = normalizeDifficultyName(query.difficulty);
			const url = new URL(`search/text/${page}`, this.apiBaseUrl);
			url.search = buildSearchParameters(query).toString();
			const result = normalizeMapCollection(await this.transport.getJson(url, { signal: options.signal }), "search");
			return wanted === "" ? result : Object.freeze({
				...result,
				maps: Object.freeze(result.maps.filter((map) => map.versions.some((version) => version.difficulties.some((difficulty) => difficulty.characteristic === "Standard" && difficulty.difficulty === wanted))))
			});
		});
	}
	/**
	* @param {{pageSize?: number, before?: string, after?: string, sort?: string, automapper?: boolean}} [latest] Latest options.
	* @param {{signal?: AbortSignal}} [options] Operation options.
	* @returns {Promise<import("./normalize.js").BeatSaverMapCollection>} Result.
	*/
	async listLatestMaps(latest = {}, options = {}) {
		return this.run("latest", async () => {
			const url = new URL("maps/latest", this.apiBaseUrl);
			url.search = buildLatestParameters(latest).toString();
			return normalizeMapCollection(await this.transport.getJson(url, { signal: options.signal }), "latest");
		});
	}
	/**
	* @param {string} mapId Map ID.
	* @param {{signal?: AbortSignal}} [options] Options.
	* @returns {Promise<BeatSaverMap>} Map.
	*/
	async getMapById(mapId, options = {}) {
		const safeId = requireIdentifier(mapId, "map ID", /^[0-9a-zA-Z]+$/u);
		return this.run("detail-id", async () => normalizeMap(await this.transport.getJson(new URL(`maps/id/${encodeURIComponent(safeId)}`, this.apiBaseUrl), { signal: options.signal })));
	}
	/**
	* @param {string} hash Version hash.
	* @param {{signal?: AbortSignal}} [options] Options.
	* @returns {Promise<BeatSaverMap>} Map.
	*/
	async getMapByHash(hash, options = {}) {
		const safeHash = requireIdentifier(hash, "version hash", /^[0-9a-fA-F]{40}$/u).toLowerCase();
		return this.run("detail-hash", async () => normalizeMap(await this.transport.getJson(new URL(`maps/hash/${safeHash}`, this.apiBaseUrl), { signal: options.signal })));
	}
	/**
	* Download, verify and inspect a selected provider version.
	*
	* @param {BeatSaverMap} map Normalized map.
	* @param {string | undefined} versionIdentifier Version hash/key; latest by default.
	* @param {{signal?: AbortSignal, onProgress?: import("./transport.js").BeatSaverProgressCallback}} [options] Options.
	* @returns {Promise<Readonly<{providerId: "beatsaver", map: BeatSaverMap, version: BeatSaverVersion, sourceHash: string, archiveSha1: string, source: BeatSaverSourceBundle}>>} Acquired source.
	*/
	async acquireVersion(map, versionIdentifier, options = {}) {
		const version = selectVersion(map, versionIdentifier);
		return this.run("acquire", async () => {
			this.state.lastMapId = map.mapId;
			const bytes = await this.transport.getBytes(new URL(version.downloadUrl), {
				signal: options.signal,
				onProgress: options.onProgress,
				maxBytes: this.maxDownloadBytes
			});
			options.signal?.throwIfAborted();
			const archiveSha1 = await sha1Hex(bytes);
			const source = await inspectBeatSaverArchive(bytes, { limits: this.archiveLimits });
			const sourceHash = await computeBeatSaverMapHash(source);
			if (sourceHash !== version.hash) throw new BeatSaverVendorError("integrity", "BeatSaver map-content hash does not match selected provider version", { details: {
				expectedHash: version.hash,
				actualHash: sourceHash,
				archiveSha1,
				mapId: map.mapId
			} });
			return Object.freeze({
				providerId: "beatsaver",
				map,
				version,
				sourceHash,
				archiveSha1,
				source
			});
		});
	}
	/**
	* Inspect a local ZIP/File without provider metadata.
	*
	* @param {Blob | ArrayBuffer | Uint8Array} input Local archive.
	* @param {{signal?: AbortSignal}} [options] Options.
	* @returns {Promise<Readonly<{providerId: "beatsaver", sourceHash: string, archiveSha1: string, source: BeatSaverSourceBundle}>>} Local source.
	*/
	async importLocalArchive(input, options = {}) {
		return this.run("local-import", async () => {
			options.signal?.throwIfAborted();
			const bytes = await inputBytes(input);
			if (bytes.byteLength > this.maxDownloadBytes) throw new BeatSaverVendorError("archive", "Local BeatSaver archive exceeds byte limit", { details: {
				size: bytes.byteLength,
				maximum: this.maxDownloadBytes
			} });
			const archiveSha1 = await sha1Hex(bytes);
			options.signal?.throwIfAborted();
			const source = await inspectBeatSaverArchive(bytes, { limits: this.archiveLimits });
			const sourceHash = await computeBeatSaverMapHash(source);
			return Object.freeze({
				providerId: "beatsaver",
				sourceHash,
				archiveSha1,
				source
			});
		});
	}
	/** @returns {BeatSaverVendorSnapshot} Snapshot. */
	snapshot() {
		const operations = [...this.activeOperations.keys()].sort();
		return Object.freeze({
			serviceId: "aero.vendor.beatsaver",
			providerId: "beatsaver",
			phase: operations.length === 0 ? "idle" : "busy",
			operation: operations.join(","),
			...this.state,
			capabilities: beatSaverVendorCapabilities,
			transport: this.transport.snapshotTelemetry()
		});
	}
	/** @template T @param {string} operation @param {() => Promise<T>} action @returns {Promise<T>} */
	async run(operation, action) {
		this.activeOperations.set(operation, (this.activeOperations.get(operation) ?? 0) + 1);
		this.state.lastErrorCode = "";
		try {
			return await action();
		} catch (error) {
			const stable = toBeatSaverVendorError(error);
			this.state.lastErrorCode = stable.code;
			throw stable;
		} finally {
			const remaining = (this.activeOperations.get(operation) ?? 1) - 1;
			if (remaining === 0) this.activeOperations.delete(operation);
			else this.activeOperations.set(operation, remaining);
		}
	}
};
/** Complete implemented capability truth. */
var beatSaverVendorCapabilities = Object.freeze({
	transport: true,
	dtoNormalization: true,
	search: true,
	latest: true,
	detailById: true,
	detailByHash: true,
	directCorsAcquisition: true,
	proxyTransport: true,
	localArchiveImport: true,
	integrityVerification: true,
	archiveInspection: true,
	sourceManifest: true,
	cancellation: true,
	progress: true
});
/** @param {unknown} value @param {string} label @param {RegExp} pattern @returns {string} */
function requireIdentifier(value, label, pattern) {
	if (typeof value !== "string") throw new BeatSaverVendorError("invalid_request", `Invalid BeatSaver ${label}`);
	const normalized = value.trim();
	if (!pattern.test(normalized)) throw new BeatSaverVendorError("invalid_request", `Invalid BeatSaver ${label}`);
	return normalized;
}
/** @param {unknown} value @returns {string} */
function normalizeDifficultyName(value) {
	if (value === void 0) return "";
	if (typeof value !== "string") throw new BeatSaverVendorError("invalid_request", "BeatSaver difficulty filter must be a string");
	if (value.trim() === "") return "";
	const normalized = {
		easy: "Easy",
		normal: "Normal",
		hard: "Hard",
		expert: "Expert",
		expertplus: "ExpertPlus"
	}[value.toLowerCase().replaceAll(/[^a-z]/gu, "")];
	if (normalized === void 0) throw new BeatSaverVendorError("invalid_request", "Unsupported BeatSaver difficulty filter");
	return normalized;
}
/** @param {unknown} value @returns {number} */
function normalizePage(value) {
	if (value === void 0) return 0;
	if (typeof value !== "number" || !Number.isFinite(value)) throw new BeatSaverVendorError("invalid_request", "BeatSaver search page must be finite");
	return Math.min(1e5, Math.max(0, Math.trunc(value)));
}
/** @param {Blob | ArrayBuffer | Uint8Array} input @returns {Promise<Uint8Array>} */
async function inputBytes(input) {
	if (input instanceof Uint8Array) return input.slice();
	if (input instanceof ArrayBuffer) return new Uint8Array(input.slice(0));
	if (input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
	throw new BeatSaverVendorError("invalid_request", "Local archive must be Blob, ArrayBuffer, or Uint8Array");
}
Object.freeze({
	serviceId: "aero.vendor.beatsaver",
	providerId: "beatsaver",
	contractId: "aero.web-vendor-beatsaver.v1",
	implementationStatus: "implemented",
	capabilities: beatSaverVendorCapabilities
});
/**
* Create one vendor service for an `aero-game` instance.
*
* @param {ConstructorParameters<typeof AeroBeatSaverVendorService>[0]} [options] Service options.
* @returns {AeroBeatSaverVendorService} Service.
*/
function createAeroBeatSaverVendorService(options) {
	return new AeroBeatSaverVendorService(options);
}
//#endregion
//#region ../aerobeat-web-vendor-mediapipe/src/mediapipe-normalize.js
/** @typedef {import("@aerobeat/web-contracts/pose-shapes").NormalizedPoseLandmark} NormalizedLandmark */
/** @typedef {import("@aerobeat/web-contracts/pose-shapes").NormalizedPoseFrame} NormalizedPoseFrame */
/**
* @typedef {Object} MediaPipeLandmarkLike
* @property {number} [x] Normalized horizontal coordinate.
* @property {number} [y] Normalized vertical coordinate.
* @property {number} [visibility] Landmark visibility diagnostic.
* @property {number} [presence] Landmark presence diagnostic.
*/
/**
* @typedef {Object} MediaPipePoseResultLike
* @property {readonly (readonly MediaPipeLandmarkLike[])[]} [landmarks] Detected normalized landmark sets.
*/
/**
* @typedef {Object} FrameSourceLike
* @property {number} [currentTime] Media current time in seconds.
*/
/**
* @typedef {Object} MediaPipeFrameMetadata
* @property {string} [sourceId] Output source identifier.
* @property {number} [timestampMs] Capture/source timestamp in milliseconds.
* @property {boolean} [mirrored] Display-mirror metadata.
* @property {() => number} now Monotonic fallback timestamp provider.
*/
/** @type {ReadonlyArray<Readonly<{ index: number, name: string }>>} */
var aeroBeatLandmarks = Object.freeze([
	Object.freeze({
		index: 0,
		name: "nose"
	}),
	Object.freeze({
		index: 11,
		name: "left_shoulder"
	}),
	Object.freeze({
		index: 12,
		name: "right_shoulder"
	}),
	Object.freeze({
		index: 13,
		name: "left_elbow"
	}),
	Object.freeze({
		index: 14,
		name: "right_elbow"
	}),
	Object.freeze({
		index: 15,
		name: "left_wrist"
	}),
	Object.freeze({
		index: 16,
		name: "right_wrist"
	})
]);
/**
* Converts MediaPipe Pose Landmarker output into the AeroBeat seven-landmark
* structural frame. No MediaPipe result object crosses this function boundary.
*
* @param {MediaPipePoseResultLike | undefined} result Raw MediaPipe result.
* @param {FrameSourceLike} frameSource Source passed to inference.
* @param {MediaPipeFrameMetadata} metadata Output metadata.
* @returns {NormalizedPoseFrame}
*/
function normalizeMediaPipePoseFrame(result, frameSource, metadata) {
	const pose = result?.landmarks?.[0];
	const timestampMs = finiteNumber(metadata.timestampMs) ?? getMediaTimestampMs(frameSource) ?? finiteNumber(metadata.now()) ?? Date.now();
	return {
		sourceId: metadata.sourceId ?? "aero.mediapipe.live",
		timestampMs,
		mirrored: metadata.mirrored ?? true,
		landmarks: pose ? normalizeRequiredLandmarks(pose) : []
	};
}
/**
* @param {readonly MediaPipeLandmarkLike[]} pose
* @returns {NormalizedLandmark[]}
*/
function normalizeRequiredLandmarks(pose) {
	/** @type {NormalizedLandmark[]} */
	const normalized = [];
	for (const definition of aeroBeatLandmarks) {
		const landmark = pose[definition.index];
		if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) continue;
		normalized.push({
			name: definition.name,
			x: clamp01(landmark.x ?? 0),
			y: clamp01(landmark.y ?? 0),
			confidence: clamp01(landmark.visibility ?? landmark.presence ?? 0)
		});
	}
	return normalized;
}
/**
* @param {FrameSourceLike} frameSource
* @returns {number | undefined}
*/
function getMediaTimestampMs(frameSource) {
	return typeof frameSource.currentTime === "number" && Number.isFinite(frameSource.currentTime) ? frameSource.currentTime * 1e3 : void 0;
}
/**
* @param {number | undefined} value
* @returns {number | undefined}
*/
function finiteNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/**
* @param {number} value
* @returns {number}
*/
function clamp01(value) {
	return Math.min(1, Math.max(0, value));
}
//#endregion
//#region \0vite/preload-helper.js
var scriptRel = "modulepreload";
var assetsURL = function(dep) {
	return "/" + dep;
};
var seen = {};
var __vitePreload = function preload(baseModule, deps, importerUrl) {
	let promise = Promise.resolve();
	if (deps && deps.length > 0) {
		const links = document.getElementsByTagName("link");
		const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
		const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
		function allSettled(promises) {
			return Promise.all(promises.map((p) => Promise.resolve(p).then((value) => ({
				status: "fulfilled",
				value
			}), (reason) => ({
				status: "rejected",
				reason
			}))));
		}
		function importMetaResolve(specifier) {
			if (import.meta.resolve) return import.meta.resolve(specifier);
			return new URL(
				specifier,
				/** #__KEEP__ */
				import.meta.url
			).href;
		}
		promise = allSettled(deps.map((dep) => {
			dep = assetsURL(dep, importerUrl);
			dep = importMetaResolve(dep);
			if (dep in seen) return;
			seen[dep] = true;
			const isCss = dep.endsWith(".css");
			for (let i = links.length - 1; i >= 0; i--) {
				const link = links[i];
				if (link.href === dep && (!isCss || link.rel === "stylesheet")) return;
			}
			const link = document.createElement("link");
			link.rel = isCss ? "stylesheet" : scriptRel;
			if (!isCss) link.as = "script";
			link.crossOrigin = "";
			link.href = dep;
			if (cspNonce) link.setAttribute("nonce", cspNonce);
			document.head.appendChild(link);
			if (isCss) return new Promise((res, rej) => {
				link.addEventListener("load", res);
				link.addEventListener("error", () => rej(/* @__PURE__ */ new Error(`Unable to preload CSS for ${dep}`)));
			});
		}));
	}
	function handlePreloadError(err) {
		const e = new Event("vite:preloadError", { cancelable: true });
		e.payload = err;
		window.dispatchEvent(e);
		if (!e.defaultPrevented) throw err;
	}
	return promise.then((res) => {
		for (const item of res || []) {
			if (item.status !== "rejected") continue;
			handlePreloadError(item.reason);
		}
		return baseModule().catch(handlePreloadError);
	});
};
//#endregion
//#region ../aerobeat-web-vendor-mediapipe/src/mediapipe-adapter.js
/** @type {"mediapipe"} */
var mediaPipeVendorId = "mediapipe";
/** @type {"1.0.1"} */
var mediaPipePackageVersion = "1.0.1";
/** @type {"aero.mediapipe.live"} */
var mediaPipeLiveSourceId = "aero.mediapipe.live";
/** @type {Readonly<{ cpuWasm: "cpu-wasm", gpuWebgl: "gpu-webgl" }>} */
var mediaPipeDelegates = Object.freeze({
	cpuWasm: "cpu-wasm",
	gpuWebgl: "gpu-webgl"
});
/** @type {Readonly<import("@aerobeat/web-contracts/pose-adapter").AeroPoseModelIdentity>} */
var mediaPipeDefaultModel = Object.freeze({
	vendorId: mediaPipeVendorId,
	modelId: "pose-landmarker-lite",
	modelVersion: "float16/1",
	runtimeId: "@mediapipe/tasks-vision",
	runtimeVersion: mediaPipePackageVersion
});
Object.freeze({
	vendorId: mediaPipeVendorId,
	modelId: "deterministic-replay",
	modelVersion: "basic-upper-body/1",
	runtimeId: "aerobeat-replay",
	runtimeVersion: "1"
});
/** @type {Readonly<{ idle: "idle", loading: "loading", ready: "ready", failed: "failed", disposed: "disposed" }>} */
var mediaPipeAdapterStatuses = Object.freeze({
	idle: "idle",
	loading: "loading",
	ready: "ready",
	failed: "failed",
	disposed: "disposed"
});
var mediaPipeCapabilities = Object.freeze({
	supportsMainThread: true,
	supportsWorker: false,
	supportsMirroring: true,
	supportsFrameSizeOverride: false,
	executionProviders: Object.freeze(["wasm", "webgl"]),
	delegates: Object.freeze([mediaPipeDelegates.cpuWasm, mediaPipeDelegates.gpuWebgl]),
	runningMode: "VIDEO",
	numPoses: 1,
	segmentationMasks: false,
	synchronousInference: true,
	workerInference: false,
	normalizedLandmarkNames: Object.freeze([
		"nose",
		"left_shoulder",
		"right_shoulder",
		"left_elbow",
		"right_elbow",
		"left_wrist",
		"right_wrist"
	])
});
Object.freeze({
	supportsMainThread: true,
	supportsWorker: false,
	supportsMirroring: false,
	supportsFrameSizeOverride: false,
	executionProviders: Object.freeze(["replay"]),
	deterministicReplay: true,
	normalizedLandmarkNames: mediaPipeCapabilities.normalizedLandmarkNames
});
/** @typedef {import("@aerobeat/web-contracts/pose-shapes").NormalizedPoseFrame} NormalizedPoseFrame */
/** @typedef {import("@aerobeat/web-contracts/pose-adapter").AeroPoseFrameSource} MediaPipeFrameSource */
/** @typedef {import("@aerobeat/web-contracts/pose-adapter").AeroPoseEstimateOptions} MediaPipeEstimateOptions */
/**
* @typedef {Object} MediaPipeAdapterOptions
* @property {string} [sourceId] Default output source identifier.
* @property {boolean} [mirrored] Default display-mirror metadata.
* @property {"cpu-wasm" | "gpu-webgl"} [delegate] Explicit delegate selection.
* @property {string} [modelUrl] Injectable task model URL.
* @property {string} [modelId] Stable identity for a custom model artifact; defaults to its URL.
* @property {string} [modelVersion] Optional custom model version detail.
* @property {string} [wasmRootUrl] Injectable Tasks Vision WASM root URL.
* @property {string} [modelName] Injectable telemetry display name.
* @property {string} [modelSha256] Injectable telemetry checksum.
* @property {number} [modelSizeBytes] Injectable telemetry asset size.
* @property {number} [minPoseDetectionConfidence] Minimum detector confidence in [0,1]; defaults to 0.5.
* @property {number} [minPosePresenceConfidence] Minimum landmark presence confidence in [0,1]; defaults to 0.5.
* @property {number} [minTrackingConfidence] Minimum tracking confidence in [0,1]; defaults to 0.5.
* @property {() => number} [now] Monotonic clock used by detectForVideo.
*/
/**
* @typedef {Object} MediaPipeExecutionStatus
* @property {"main-thread" | "replay"} mode Execution location.
* @property {"cpu-wasm" | "gpu-webgl" | "replay"} delegate Actual delegate.
* @property {string} detail Human-readable execution detail.
*/
/**
* @typedef {Object} MediaPipeTelemetryStatus
* @property {"mediapipe"} vendorId Vendor identifier.
* @property {"@mediapipe/tasks-vision" | "replay"} provider Runtime provider.
* @property {string} packageVersion Package version.
* @property {string} model Model display name.
* @property {string} modelId Stable model identity matching the generic adapter model.
* @property {string | undefined} modelVersion Model version matching the generic adapter model.
* @property {string} modelUrl Model asset URL.
* @property {string} modelSha256 Expected model checksum.
* @property {number} modelSizeBytes Published model asset size.
* @property {string} wasmRootUrl Tasks Vision WASM root.
* @property {"cpu-wasm" | "gpu-webgl" | "replay"} selectedDelegate Requested delegate.
* @property {"cpu-wasm" | "gpu-webgl" | "replay" | undefined} actualDelegate Actual delegate after successful load.
* @property {"idle" | "loading" | "ready" | "failed" | "disposed"} loadState Current lifecycle state.
* @property {boolean} fallback Whether a fallback occurred.
* @property {boolean} disposed Whether dispose was called since the last load.
* @property {number | undefined} loadDurationMs Most recent load duration.
* @property {number | undefined} lastInferenceDurationMs Last end-to-end adapter estimate duration.
* @property {number} [runtimeInferenceDurationMs] Most recent synchronous MediaPipe runtime duration.
* @property {number} [postprocessDurationMs] Most recent seven-point normalization duration.
* @property {number} [minPoseDetectionConfidence] Configured detector confidence threshold.
* @property {number} [minPosePresenceConfidence] Configured landmark presence threshold.
* @property {number} [minTrackingConfidence] Configured tracking threshold.
* @property {string} confidenceSemantics Confidence interpretation.
* @property {string | undefined} error Last failure message.
*/
/**
* @typedef {import("@aerobeat/web-contracts/pose-adapter").AeroPoseAdapter & {
*   vendorId: "mediapipe",
*   model: Readonly<import("@aerobeat/web-contracts/pose-adapter").AeroPoseModelIdentity>,
*   capabilities: typeof mediaPipeCapabilities | typeof mediaPipeReplayCapabilities,
*   getExecutionTelemetry: () => import("@aerobeat/web-contracts/pose-adapter").AeroPoseExecutionTelemetry,
*   getExecutionStatus: () => MediaPipeExecutionStatus,
*   getTelemetryStatus: () => MediaPipeTelemetryStatus,
*   dispose: () => void
* }} MediaPipePoseAdapter
*/
/**
* @typedef {Object} PoseLandmarkerLike
* @property {(frameSource: MediaPipeFrameSource, timestampMs: number) => import("./mediapipe-normalize.js").MediaPipePoseResultLike} detectForVideo Runs synchronous video inference.
* @property {() => void} close Releases MediaPipe resources.
*/
/**
* @typedef {Object} MediaPipeRuntime
* @property {(wasmRootUrl: string) => Promise<unknown>} resolveVisionFiles Resolves Tasks Vision WASM files.
* @property {(visionFiles: unknown, options: { baseOptions: { modelAssetPath: string, delegate: "CPU" | "GPU" }, runningMode: "VIDEO", numPoses: 1, outputSegmentationMasks: false, minPoseDetectionConfidence: number, minPosePresenceConfidence: number, minTrackingConfidence: number }) => Promise<PoseLandmarkerLike>} createPoseLandmarker Creates a pose task.
*/
/** @typedef {() => Promise<MediaPipeRuntime>} MediaPipeRuntimeLoader */
/**
* @typedef {Object} MediaPipeReplayPoseSource
* @property {"replay-fixture"} sourceKind Replay source kind.
* @property {string} sourceId Replay identifier.
* @property {readonly NormalizedPoseFrame[]} frames Normalized frames.
*/
/**
* Creates the real browser MediaPipe adapter. Runtime objects remain private.
*
* @param {MediaPipeAdapterOptions} [options]
* @returns {MediaPipePoseAdapter}
*/
function createMediaPipePoseAdapter(options = {}) {
	return createMediaPipePoseAdapterFromRuntime(loadDefaultMediaPipeRuntime, options);
}
/**
* Internal runtime-injection factory for deterministic package validation.
* It is deliberately not exported from the public package index.
*
* @param {MediaPipeRuntimeLoader} loadRuntime
* @param {MediaPipeAdapterOptions} [options]
* @returns {MediaPipePoseAdapter}
*/
function createMediaPipePoseAdapterFromRuntime(loadRuntime, options = {}) {
	const sourceId = options.sourceId ?? "aero.mediapipe.live";
	const mirrored = options.mirrored ?? true;
	const delegate = validateDelegate(options.delegate ?? mediaPipeDelegates.cpuWasm);
	const executionProvider = delegate === mediaPipeDelegates.cpuWasm ? "wasm" : "webgl";
	const modelUrl = options.modelUrl ?? "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
	const usesDefaultModelIdentity = modelUrl === "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" && options.modelId === void 0 && options.modelVersion === void 0;
	/** @type {Readonly<import("@aerobeat/web-contracts/pose-adapter").AeroPoseModelIdentity>} */
	const model = usesDefaultModelIdentity ? mediaPipeDefaultModel : Object.freeze({
		vendorId: mediaPipeVendorId,
		modelId: options.modelId ?? modelUrl,
		...options.modelVersion === void 0 ? {} : { modelVersion: options.modelVersion },
		runtimeId: "@mediapipe/tasks-vision",
		runtimeVersion: mediaPipePackageVersion
	});
	const wasmRootUrl = options.wasmRootUrl ?? "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
	const modelName = options.modelName ?? (usesDefaultModelIdentity ? "Pose Landmarker Lite float16 /1/" : model.modelId);
	const modelSha256 = options.modelSha256 ?? (modelUrl === "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" ? "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a" : "");
	const modelSizeBytes = options.modelSizeBytes ?? (modelUrl === "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" ? 5777746 : 0);
	const minPoseDetectionConfidence = validateConfidenceThreshold(options.minPoseDetectionConfidence ?? .5, "minPoseDetectionConfidence");
	const minPosePresenceConfidence = validateConfidenceThreshold(options.minPosePresenceConfidence ?? .5, "minPosePresenceConfidence");
	const minTrackingConfidence = validateConfidenceThreshold(options.minTrackingConfidence ?? .5, "minTrackingConfidence");
	const now = options.now ?? defaultNow;
	/** @type {"idle" | "loading" | "ready" | "failed" | "disposed"} */
	let status = mediaPipeAdapterStatuses.idle;
	/** @type {PoseLandmarkerLike | undefined} */
	let poseLandmarker;
	/** @type {Promise<void> | undefined} */
	let loading;
	let lastVideoTimestampMs = Number.NEGATIVE_INFINITY;
	/** @type {"cpu-wasm" | "gpu-webgl" | undefined} */
	let actualDelegate;
	/** @type {number | undefined} */
	let loadDurationMs;
	/** @type {number | undefined} */
	let lastInferenceDurationMs;
	/** @type {number | undefined} */
	let runtimeInferenceDurationMs;
	/** @type {number | undefined} */
	let postprocessDurationMs;
	let disposed = false;
	/** @type {string | undefined} */
	let lastError;
	const executionStatus = Object.freeze({
		mode: "main-thread",
		delegate,
		detail: `${delegate === mediaPipeDelegates.cpuWasm ? "MediaPipe Tasks Vision CPU delegate via synchronous WASM" : "MediaPipe Tasks Vision GPU delegate via synchronous WebGL"} / thresholds detection ${minPoseDetectionConfidence} presence ${minPosePresenceConfidence} tracking ${minTrackingConfidence}`
	});
	return {
		vendorId: mediaPipeVendorId,
		model,
		get status() {
			return status;
		},
		capabilities: mediaPipeCapabilities,
		getExecutionTelemetry() {
			return {
				location: "main-thread",
				provider: actualDelegate ? executionProvider : void 0,
				detail: lastError ?? executionStatus.detail,
				fallback: false,
				loadDurationMs,
				estimateDurationMs: lastInferenceDurationMs,
				runtimeInferenceDurationMs,
				postprocessDurationMs
			};
		},
		getExecutionStatus() {
			return executionStatus;
		},
		getTelemetryStatus() {
			return {
				vendorId: mediaPipeVendorId,
				provider: "@mediapipe/tasks-vision",
				packageVersion: mediaPipePackageVersion,
				model: modelName,
				modelId: model.modelId,
				modelVersion: model.modelVersion,
				modelUrl,
				modelSha256,
				modelSizeBytes,
				wasmRootUrl,
				selectedDelegate: delegate,
				actualDelegate,
				loadState: status,
				fallback: false,
				disposed,
				loadDurationMs,
				lastInferenceDurationMs,
				runtimeInferenceDurationMs,
				postprocessDurationMs,
				minPoseDetectionConfidence,
				minPosePresenceConfidence,
				minTrackingConfidence,
				confidenceSemantics: "MediaPipe landmark visibility (presence fallback), vendor-specific and uncalibrated",
				error: lastError
			};
		},
		async load() {
			if (disposed || status === mediaPipeAdapterStatuses.disposed) throw new Error("Disposed MediaPipe adapter cannot be loaded.");
			if (status === mediaPipeAdapterStatuses.ready) return;
			if (loading) return loading;
			lastError = void 0;
			actualDelegate = void 0;
			loadDurationMs = void 0;
			const loadStartedAtMs = now();
			status = mediaPipeAdapterStatuses.loading;
			loading = (async () => {
				try {
					const runtime = await loadRuntime();
					const visionFiles = await runtime.resolveVisionFiles(wasmRootUrl);
					const loadedPoseLandmarker = await runtime.createPoseLandmarker(visionFiles, {
						baseOptions: {
							modelAssetPath: modelUrl,
							delegate: delegate === mediaPipeDelegates.cpuWasm ? "CPU" : "GPU"
						},
						runningMode: "VIDEO",
						numPoses: 1,
						outputSegmentationMasks: false,
						minPoseDetectionConfidence,
						minPosePresenceConfidence,
						minTrackingConfidence
					});
					if (disposed) {
						loadedPoseLandmarker.close();
						throw new Error("MediaPipe adapter was disposed while loading.");
					}
					poseLandmarker = loadedPoseLandmarker;
					actualDelegate = delegate;
					status = mediaPipeAdapterStatuses.ready;
				} catch (error) {
					if (!disposed) {
						status = mediaPipeAdapterStatuses.failed;
						lastError = readErrorMessage(error);
					}
					throw error;
				} finally {
					if (!disposed) loadDurationMs = Math.max(0, now() - loadStartedAtMs);
					loading = void 0;
				}
			})();
			return loading;
		},
		async estimateNormalizedPoseFrame(frameSource, estimateOptions = {}) {
			if (disposed || status === mediaPipeAdapterStatuses.disposed) throw new Error("Disposed MediaPipe adapter cannot estimate pose.");
			if (!frameSource) throw new Error("MediaPipe pose estimation requires a browser frame source.");
			if (status !== mediaPipeAdapterStatuses.ready) await this.load();
			if (!poseLandmarker) {
				status = mediaPipeAdapterStatuses.failed;
				lastError = "Pose Landmarker unavailable after load";
				throw new Error(lastError);
			}
			const inferenceTimestampMs = nextMonotonicTimestamp(now(), lastVideoTimestampMs);
			lastVideoTimestampMs = inferenceTimestampMs;
			const startedAtMs = now();
			/** @type {number | undefined} */
			let runtimeFinishedAtMs;
			try {
				const result = poseLandmarker.detectForVideo(frameSource, inferenceTimestampMs);
				runtimeFinishedAtMs = now();
				runtimeInferenceDurationMs = Math.max(0, runtimeFinishedAtMs - startedAtMs);
				const frame = normalizeMediaPipePoseFrame(result, { currentTime: readMediaCurrentTime(frameSource) }, {
					sourceId: estimateOptions.sourceId ?? sourceId,
					timestampMs: estimateOptions.timestampMs,
					mirrored: estimateOptions.mirrored ?? mirrored,
					now
				});
				const finishedAtMs = now();
				postprocessDurationMs = Math.max(0, finishedAtMs - runtimeFinishedAtMs);
				lastInferenceDurationMs = Math.max(0, finishedAtMs - startedAtMs);
				return frame;
			} catch (error) {
				const failedAtMs = now();
				if (runtimeFinishedAtMs === void 0) {
					runtimeInferenceDurationMs = Math.max(0, failedAtMs - startedAtMs);
					postprocessDurationMs = void 0;
				} else postprocessDurationMs = Math.max(0, failedAtMs - runtimeFinishedAtMs);
				lastInferenceDurationMs = Math.max(0, failedAtMs - startedAtMs);
				status = mediaPipeAdapterStatuses.failed;
				lastError = readErrorMessage(error);
				throw error;
			}
		},
		dispose() {
			if (disposed) return;
			poseLandmarker?.close();
			poseLandmarker = void 0;
			loading = void 0;
			lastVideoTimestampMs = Number.NEGATIVE_INFINITY;
			actualDelegate = void 0;
			loadDurationMs = void 0;
			lastInferenceDurationMs = void 0;
			runtimeInferenceDurationMs = void 0;
			postprocessDurationMs = void 0;
			lastError = void 0;
			disposed = true;
			status = mediaPipeAdapterStatuses.disposed;
		}
	};
}
/**
* @returns {Promise<MediaPipeRuntime>}
*/
async function loadDefaultMediaPipeRuntime() {
	const tasksVision = await __vitePreload(() => import("./vision_bundle-CPgxPL03.js"), []);
	return {
		resolveVisionFiles: (wasmRootUrl) => tasksVision.FilesetResolver.forVisionTasks(wasmRootUrl),
		async createPoseLandmarker(visionFiles, options) {
			const files = visionFiles;
			const task = await tasksVision.PoseLandmarker.createFromOptions(files, options);
			return {
				detectForVideo(frameSource, timestampMs) {
					return task.detectForVideo(frameSource, timestampMs);
				},
				close() {
					task.close();
				}
			};
		}
	};
}
/**
* @param {MediaPipeFrameSource} frameSource
* @returns {number | undefined}
*/
function readMediaCurrentTime(frameSource) {
	return "currentTime" in frameSource && typeof frameSource.currentTime === "number" ? frameSource.currentTime : void 0;
}
/**
* @param {"cpu-wasm" | "gpu-webgl"} delegate
* @returns {"cpu-wasm" | "gpu-webgl"}
*/
function validateDelegate(delegate) {
	if (delegate !== mediaPipeDelegates.cpuWasm && delegate !== mediaPipeDelegates.gpuWebgl) throw new Error(`Unsupported MediaPipe delegate: ${delegate}`);
	return delegate;
}
/**
* @param {number} value
* @param {string} name
* @returns {number}
*/
function validateConfidenceThreshold(value, name) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${name} must be a finite number in [0,1].`);
	return value;
}
/**
* @param {number} candidate
* @param {number} previous
* @returns {number}
*/
function nextMonotonicTimestamp(candidate, previous) {
	const safeCandidate = Number.isFinite(candidate) ? candidate : defaultNow();
	return safeCandidate > previous ? safeCandidate : previous + .001;
}
/**
* @returns {number}
*/
function defaultNow() {
	return globalThis.performance?.now?.() ?? Date.now();
}
/**
* @param {unknown} error
* @returns {string}
*/
function readErrorMessage(error) {
	if (error instanceof Error) return error.message;
	return typeof error === "string" ? error : "unknown MediaPipe error";
}
Object.freeze({
	supportsMainThread: false,
	supportsWorker: true,
	supportsMirroring: true,
	supportsFrameSizeOverride: false,
	executionProviders: Object.freeze(["wasm", "webgl"]),
	delegates: Object.freeze([mediaPipeDelegates.cpuWasm, mediaPipeDelegates.gpuWebgl]),
	runningMode: "VIDEO",
	numPoses: 1,
	segmentationMasks: false,
	synchronousInference: false,
	workerInference: true,
	transferableFrameTypes: Object.freeze(["ImageBitmap", "VideoFrame"]),
	normalizedLandmarkNames: Object.freeze([
		"nose",
		"left_shoulder",
		"right_shoulder",
		"left_elbow",
		"right_elbow",
		"left_wrist",
		"right_wrist"
	])
});
//#endregion
//#region src/production-cv-profile.js
/** Immutable production CV route; diagnostics cannot change this selection. */
var lockedProductionCvProfile = Object.freeze({
	backendId: "mediapipe",
	vendorId: "mediapipe-tasks-vision",
	model: "Pose Landmarker Lite float16 /1/",
	runtimeVersion: "1.0.1",
	providerId: "gpu-webgl",
	minPoseDetectionConfidence: .5,
	minPosePresenceConfidence: .5,
	minTrackingConfidence: .5,
	trackingProfile: "fast",
	performancePresetId: "full",
	resizePath: "none",
	gameplaySource: "measured",
	submissionCadenceTargetFps: 15
});
//#endregion
//#region src/service-graph.js
/** @typedef {ReturnType<typeof createAeroGameServiceGraph>} AeroGameServiceGraph */
/** Create a complete, isolated service graph for one connected game instance. */
function createAeroGameServiceGraph(options = {}) {
	const instanceId = typeof options.instanceId === "string" ? options.instanceId : "aero-game";
	const authoring = createAeroWebContentAuthoringService({
		useBrowserWorker: true,
		useIndexedDb: true
	});
	const content = createAeroContentRuntime({ persistenceResolver: {
		loadPackage: (handle) => authoring.loadPackage(handle),
		readAsset: (handle, path) => authoring.readAsset(handle, path),
		exportPackage: (handle) => authoring.exportPackage(handle)
	} });
	const poseAdapter = createMediaPipePoseAdapter({
		sourceId: mediaPipeLiveSourceId,
		mirrored: true,
		delegate: mediaPipeDelegates.gpuWebgl,
		minPoseDetectionConfidence: .5,
		minPosePresenceConfidence: .5,
		minTrackingConfidence: .5
	});
	const video = createBrowserVideoMediaFacade();
	const audio = createAeroWebAudioService({ initialLeaseActive: false });
	const cv = createLockedProductionCvService({
		poseAdapter,
		submissionCadenceTargetFps: 15
	});
	return Object.freeze({
		instanceId,
		vendor: createAeroBeatSaverVendorService(),
		authoring,
		content,
		video,
		cv,
		input: createAeroBodyGridService({ calibrationIdPrefix: `${instanceId}-calibration` }),
		audio,
		profiles: createAeroPrototypeProfileRegistry(),
		gameplay: createAeroGameplaySessionCoordinator({ instanceId }),
		renderer: createAeroWebGl2Renderer()
	});
}
//#endregion
//#region src/index.js
var GAME_EVENT_NAME = "aero-game-event";
var AERO_BACKGROUND_PROJECTION = Object.freeze({
	kind: "linear-gradient",
	colors: Object.freeze(["#071426", "#153b5d"]),
	angleDeg: 180
});
var CAMERA_BACKGROUND_PROJECTION = Object.freeze({
	kind: "solid",
	colors: Object.freeze(["#00000000"]),
	angleDeg: 180
});
var instanceSequence = 0;
defineAeroUiElements();
/** Full-container, reconnectable AeroBeat game root. */
var AeroGame = class extends HTMLElement {
	constructor() {
		super();
		this.instanceId = this.getAttribute("instance-id") || `aero-game-${++instanceSequence}`;
		/** Injectable before connection for deterministic integration tests. */
		this.serviceGraphFactory = createAeroGameServiceGraph;
		this.graph = null;
		this.bridge = null;
		this.connectedGeneration = 0;
		this.lifecycle = "disconnected";
		this.eventSequence = 0;
		this.configuration = Object.freeze({});
		this.activeAbort = new AbortController();
		this.resizeObserver = null;
		this.unsubscribe = [];
		this.frameTimer = 0;
		this.frameLoop = null;
		this.visibilityGeneration = 0;
		this.audioSyncPending = false;
		this.latestPoseTimestampMs = -1;
		this.lastFreshPoseAtMs = -Infinity;
		this.lastInputAdvanceAtMs = -Infinity;
		this.lastContentSyncAtMs = -Infinity;
		this.cadenceStartedAtMs = 0;
		this.cadenceLatestFrameAtMs = 0;
		this.displayFrameCount = 0;
		this.freshPoseConsumptionCount = 0;
		this.inputAdvanceCount = 0;
		this.presenterCommitCount = 0;
		this.runtimeUiCommitCount = 0;
		this.runtimeUiSignature = "";
		this.activeCvSource = null;
		this.lastCameraIdentity = "";
		this.browsedMaps = /* @__PURE__ */ new Map();
		this.beatSaverView = emptyBeatSaverView();
		this.libraryView = Object.freeze({
			collections: Object.freeze([]),
			selectedCollectionId: null,
			selectedPackageId: null,
			storage: null
		});
		this.librarySelectionGeneration = 0;
		this.librarySelectionTail = Promise.resolve(null);
		this.desiredLibrarySelection = null;
		this.leaseParticipant = null;
		this.unregisterLease = null;
		this.fullscreenPending = false;
		this.fullscreenError = null;
		this.container = containerSnapshot(0, 0, 1, true, false);
		this.lastError = null;
		this.menuOpen = false;
		this.menuPauseArmed = false;
		this.menuStarting = false;
		this.sessionStartRequested = false;
		this.environmentMode = "aero";
		this.cameraCompositeMode = null;
		this.musicPrerequisite = "";
		this.pendingLibrarySelection = null;
		this.menuFocusRestore = null;
		this.previewView = emptyPreviewView();
		this.previewGeneration = 0;
		this.previewTimer = 0;
		this.previewObjectUrl = null;
		this.previewListeners = null;
		this.boundVisibility = () => {
			this.applyVisibility();
		};
		this.boundFullscreen = () => {
			this.fullscreenPending = false;
			this.fullscreenError = null;
			this.measureContainer();
			this.publish("fullscreen_changed");
		};
		this.boundUiIntent = (event) => this.handleUiIntent(event);
		this.boundLocalZip = (event) => {
			this.handleLocalZip(event);
		};
		this.boundInteractionClick = (event) => {
			this.handleInteractionClick(event);
		};
		this.boundInteractionKeydown = (event) => this.handleInteractionKeydown(event);
		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = template();
		this.localZipPicker = document.createElement("input");
		this.localZipPicker.type = "file";
		this.localZipPicker.accept = ".zip,application/zip";
		this.localZipPicker.hidden = true;
		root.prepend(this.localZipPicker);
	}
	connectedCallback() {
		if (this.lifecycle === "connected") return;
		this.instanceId = this.getAttribute("instance-id") || this.instanceId;
		this.connectedGeneration += 1;
		this.lifecycle = "connected";
		this.activeAbort = new AbortController();
		this.audioSyncPending = false;
		this.latestPoseTimestampMs = -1;
		this.lastFreshPoseAtMs = -Infinity;
		this.lastInputAdvanceAtMs = -Infinity;
		this.lastContentSyncAtMs = -Infinity;
		this.runtimeUiSignature = "";
		this.menuOpen = true;
		this.menuPauseArmed = false;
		this.menuStarting = false;
		this.sessionStartRequested = false;
		this.environmentMode = "aero";
		this.cameraCompositeMode = null;
		this.musicPrerequisite = "";
		this.pendingLibrarySelection = null;
		this.menuFocusRestore = null;
		this.stopPreview({ render: false });
		this.browsedMaps.clear();
		this.beatSaverView = emptyBeatSaverView();
		this.libraryView = Object.freeze({
			collections: Object.freeze([]),
			selectedCollectionId: null,
			selectedPackageId: null,
			storage: null
		});
		this.librarySelectionGeneration += 1;
		this.librarySelectionTail = Promise.resolve(null);
		this.desiredLibrarySelection = null;
		try {
			this.graph = this.serviceGraphFactory({ instanceId: this.instanceId });
			this.attachStableSurfaces();
			this.bindGraph();
			this.bindLease();
			this.bindHostLifecycle();
			this.createBridge();
			this.measureContainer();
			this.renderPresenters();
			queueMicrotask(() => {
				if (this.isConnected && this.menuOpen) this.menuButtonElement()?.focus();
			});
			this.publish("ready");
			this.refreshLibrary(this.connectedGeneration);
		} catch (error) {
			this.handleError(error);
			this.teardown("error");
		}
	}
	disconnectedCallback() {
		this.teardown("disconnected");
	}
	/** Configure plain host-owned options without starting media. */
	configure(options = {}) {
		this.assertConnected();
		this.configuration = safeData(options, 0, 64);
		const theme = dataValue(this.configuration, "theme");
		if (theme !== void 0) this.setTheme(theme);
		this.publish("capabilities_changed");
		return this.getSnapshot();
	}
	/** Direct-embed-only stream injection; stream never enters snapshots or iframe messages. */
	injectCameraStream(stream, options = {}) {
		this.assertConnected();
		if (!(stream instanceof MediaStream)) throw new TypeError("injectCameraStream requires a MediaStream");
		const source = createLiveCameraSourceDescriptor({
			sourceId: boundedString(dataValue(options, "sourceId"), "host-camera"),
			mirrored: dataValue(options, "mirrored") !== false
		});
		this.graph.video.injectCameraStream(stream, {
			source,
			ownership: "host-owned"
		});
		this.attachRetainedCamera();
		return this.getSnapshot();
	}
	async start() {
		this.assertConnected();
		this.stopPreview();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		const participant = this.leaseParticipant;
		await aeroGameMediaLeaseCoordinator.request(participant);
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
		if (!graph.video.getRetainedCameraStream()) {
			const result = await graph.video.requestCamera(createLiveCameraSourceDescriptor({
				sourceId: "aero.mediapipe.live",
				mirrored: true
			}), { signal: this.activeAbort.signal });
			if (!this.isCurrent(generation, graph)) return this.getSnapshot();
			if (result.status !== "granted") throw new Error(result.message);
		}
		this.attachRetainedCamera();
		await graph.video.play(this.videoElement());
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		await this.startCv();
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
		this.sessionStartRequested = true;
		try {
			graph.gameplay.requestStart(performance.now());
		} catch {}
		this.startFrameLoop();
		this.syncAudioForGameplay();
		this.syncContentPlayback();
		this.publish("session_changed");
		return this.getSnapshot();
	}
	async pause(reason = "manual") {
		this.assertConnected();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		this.stopFrameLoop();
		await Promise.allSettled([graph.audio.pause(), graph.cv.stop()]);
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		graph.video.pause(this.videoElement());
		try {
			graph.gameplay.pause(performance.now(), boundedString(reason, "manual"));
			this.synchronizePausedClock(graph);
		} catch {}
		this.syncContentPlayback();
		this.publish("session_changed");
		return this.getSnapshot();
	}
	async resume() {
		this.assertConnected();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		const participant = this.leaseParticipant;
		await aeroGameMediaLeaseCoordinator.request(participant);
		if (!this.isCurrent(generation, graph) || document.hidden) return this.getSnapshot();
		graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
		if (graph.video.getRetainedCameraStream()) {
			this.attachRetainedCamera();
			await graph.video.play(this.videoElement());
		}
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		await this.startCv();
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		try {
			graph.gameplay.resume(performance.now());
		} catch {}
		this.startFrameLoop();
		this.syncAudioForGameplay();
		this.syncContentPlayback();
		this.publish("session_changed");
		return this.getSnapshot();
	}
	async stop() {
		this.assertConnected();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		const participant = this.leaseParticipant;
		this.sessionStartRequested = false;
		this.stopFrameLoop();
		await Promise.allSettled([graph.audio.stop(), graph.cv.stop()]);
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		graph.video.pause(this.videoElement());
		try {
			graph.gameplay.stop(performance.now());
		} catch {}
		await aeroGameMediaLeaseCoordinator.release(participant);
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
		this.syncContentPlayback();
		this.publish("session_changed");
		return this.getSnapshot();
	}
	reset() {
		this.assertConnected();
		this.graph.input.resetCalibration("explicit_reset");
		try {
			this.graph.gameplay.reset(performance.now());
		} catch {}
		this.publish("calibration_changed");
		return this.getSnapshot();
	}
	/** @param {unknown} source */
	async selectContent(source) {
		this.assertConnected();
		this.stopPreview();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		const normalized = contentSource(source);
		const kind = normalized.kind;
		let profilePackage = kind === "direct" ? packageFromEnvelope(normalized.package) : null;
		try {
			if (kind === "persistence") {
				profilePackage = (await graph.authoring.loadPackage(normalized.handle)).package;
				await graph.content.loadPersistenceHandle(normalized.handle, this.contentLoadOptions());
			} else if (kind === "external") await graph.content.loadExternalPackage(normalized.url, this.contentLoadOptions());
			else if (kind === "direct") await graph.content.loadPackage(normalized.package, this.contentLoadOptions());
			else throw new TypeError("Unsupported content source kind");
		} catch (error) {
			if (!this.isCurrent(generation, graph)) return this.getSnapshot();
			throw error;
		}
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		try {
			await this.loadSelectedAudio(graph);
		} catch (error) {
			if (!this.isCurrent(generation, graph)) return this.getSnapshot();
			throw error;
		}
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		if (profilePackage) this.synchronizeConverterProvenance(profilePackage);
		this.configureGameplayFromContent(false);
		this.syncContentPlayback();
		this.publish("content_changed");
		return this.getSnapshot();
	}
	async selectVariant(variantId, modifierIds = []) {
		this.assertConnected();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		this.syncContentPlayback();
		const gameplay = graph.gameplay.getSnapshot();
		const futureOnly = gameplay.session?.packageId === graph.content.getSnapshot().packageId && [
			"calibrating",
			"paused_manual",
			"paused_tracking"
		].includes(gameplay.session.state);
		try {
			if (futureOnly) await graph.content.swapFutureVariant(boundedString(variantId, ""), { modifierIds: stringList(modifierIds, 16) });
			else await graph.content.selectVariant(boundedString(variantId, ""), { modifierIds: stringList(modifierIds, 16) });
		} catch (error) {
			if (!this.isCurrent(generation, graph)) return this.getSnapshot();
			throw error;
		}
		if (!this.isCurrent(generation, graph)) return this.getSnapshot();
		this.configureGameplayFromContent(futureOnly);
		this.syncContentPlayback();
		this.publish("content_changed");
		return this.getSnapshot();
	}
	/** Select one registered experimental profile by bounded ID. */
	selectPrototypeProfile(profileId) {
		this.assertConnected();
		const id = boundedProfileIdentifier(profileId);
		if (!this.graph.profiles.getSnapshot().profiles.find((profile) => profile.profileId === id)) throw new Error("Prototype profile is not registered");
		const sessionState = profileSessionState(this.graph.gameplay.getSnapshot());
		if (this.graph.profiles.select(id, { sessionState }).identity.class === "between_run_ruleset") this.applyActiveScoringProfile();
		this.publish("profiles_changed");
		return this.getSnapshot();
	}
	/** Atomically import one direct-host profile bundle. Bundles never cross iframe messaging. */
	importPrototypeProfiles(bundle) {
		this.assertConnected();
		const before = this.graph.profiles.getSnapshot();
		this.graph.profiles.importProfiles(bundle, { sessionState: profileSessionState(this.graph.gameplay.getSnapshot()) });
		const after = this.graph.profiles.getSnapshot();
		if (before.active.scoring.identity.contentHash !== after.active.scoring.identity.contentHash) this.applyActiveScoringProfile();
		this.publish("profiles_changed");
		return this.getSnapshot();
	}
	/** Export an immutable direct-host bundle. Callers keep it outside snapshots and iframe traffic. */
	exportPrototypeProfiles() {
		this.assertConnected();
		return this.graph.profiles.exportProfiles();
	}
	resetPrototypeProfiles() {
		this.assertConnected();
		const state = profileSessionState(this.graph.gameplay.getSnapshot());
		if (![
			"idle",
			"calibrating",
			"paused_manual",
			"paused_tracking",
			"completed",
			"stopped"
		].includes(state)) throw new Error("Profile reset requires an idle, paused, or between-run session");
		const appliedHash = this.graph.profiles.getSnapshot().appliedConverterHash;
		this.graph.profiles.reset();
		this.restoreAppliedConverterSelection(appliedHash);
		this.applyActiveScoringProfile();
		this.publish("profiles_changed");
		return this.getSnapshot();
	}
	async browseBeatSaver(query = {}) {
		this.assertConnected();
		this.stopPreview();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		const normalized = safeData(query, 0, 32);
		const latest = dataValue(normalized, "latest") === true;
		const vendorQuery = Object.freeze(Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== "latest")));
		this.beatSaverView = Object.freeze({
			...this.beatSaverView,
			state: "loading",
			query: boundedString(dataValue(normalized, "text"), ""),
			errorMessage: ""
		});
		this.renderPresenters();
		try {
			const results = latest ? await graph.vendor.listLatestMaps(vendorQuery, { signal: this.activeAbort.signal }) : await graph.vendor.searchMaps(vendorQuery, { signal: this.activeAbort.signal });
			if (!this.isCurrent(generation, graph)) return results;
			const previousMapId = this.beatSaverView.selectedMap?.mapId;
			const compatibleMaps = Object.freeze(results.maps.filter((map) => playableVersions(map).length > 0).slice(0, 20));
			this.browsedMaps.clear();
			for (const map of compatibleMaps) this.browsedMaps.set(map.mapId.toUpperCase(), map);
			const summaries = Object.freeze(compatibleMaps.map(mapSummary));
			this.beatSaverView = Object.freeze({
				...emptyBeatSaverView(),
				state: summaries.length ? "ready" : "empty",
				query: boundedString(dataValue(normalized, "text"), ""),
				results: summaries
			});
			const deterministicSelection = summaries.find((summary) => summary.mapId === previousMapId) ?? summaries[0];
			if (deterministicSelection) this.selectBrowsedMap(deterministicSelection.mapId);
			else this.renderPresenters();
			this.emitGameEvent("beatsaver_results", {
				resultCount: summaries.length,
				maps: summaries
			});
			return Object.freeze({
				...results,
				maps: compatibleMaps
			});
		} catch (error) {
			if (!this.isCurrent(generation, graph)) return null;
			this.beatSaverView = Object.freeze({
				...this.beatSaverView,
				state: "error",
				errorMessage: errorMessage(error)
			});
			this.renderPresenters();
			throw error;
		}
	}
	async browseLatestBeatSaver(options = {}) {
		return this.browseBeatSaver({
			...safeData(options, 0, 32),
			latest: true
		});
	}
	async importBeatSaver(map, versionIdentifier, authoringOptions) {
		this.assertConnected();
		this.stopPreview();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		let acquired;
		try {
			acquired = await graph.vendor.acquireVersion(safeData(map, 0, 64), typeof versionIdentifier === "string" ? versionIdentifier : void 0, {
				signal: this.activeAbort.signal,
				onProgress: (progress) => {
					if (this.isCurrent(generation, graph)) this.emitGameEvent("import_changed", {
						phase: progress.phase,
						loadedBytes: progress.loadedBytes,
						totalBytes: progress.totalBytes ?? null
					});
				}
			});
		} catch (error) {
			if (!this.isCurrent(generation, graph)) return null;
			throw error;
		}
		if (!this.isCurrent(generation, graph)) return null;
		return this.convertAcquired(acquired, authoringOptions);
	}
	async importBeatSaverById(mapId, versionIdentifier, authoringOptions, requireBrowsed = false) {
		this.assertConnected();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		const safeMapId = boundedIdentifier(mapId, "BeatSaver map ID");
		let map = this.browsedMaps.get(safeMapId.toUpperCase());
		if (!map && requireBrowsed) throw new Error("Iframe import must reference a child-browsed BeatSaver map");
		if (!map) try {
			map = await graph.vendor.getMapById(safeMapId, { signal: this.activeAbort.signal });
		} catch (error) {
			if (!this.isCurrent(generation, graph)) return null;
			throw error;
		}
		if (!this.isCurrent(generation, graph)) return null;
		return this.importBeatSaver(map, versionIdentifier, authoringOptions);
	}
	async importLocalZip(input, authoringOptions) {
		this.assertConnected();
		this.stopPreview();
		if (!(input instanceof Blob || input instanceof ArrayBuffer || input instanceof Uint8Array)) throw new TypeError("Local import requires Blob, ArrayBuffer, or Uint8Array");
		const generation = this.connectedGeneration;
		const graph = this.graph;
		let acquired;
		try {
			acquired = await graph.vendor.importLocalArchive(input, { signal: this.activeAbort.signal });
		} catch (error) {
			if (!this.isCurrent(generation, graph)) return null;
			throw error;
		}
		if (!this.isCurrent(generation, graph)) return null;
		return this.convertAcquired(acquired, authoringOptions);
	}
	cancelImport() {
		this.assertConnected();
		return this.graph.authoring.cancel();
	}
	async deletePackage(handle) {
		this.assertConnected();
		this.stopPreview();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		const deleted = await graph.authoring.deletePackage(safeData(handle, 0, 16));
		if (this.isCurrent(generation, graph)) {
			this.desiredLibrarySelection = null;
			await this.refreshLibrary(generation);
			if (this.isCurrent(generation, graph)) this.publish("content_changed");
		}
		return deleted;
	}
	async deleteLibraryCollection(collectionIdValue) {
		this.assertConnected();
		this.stopPreview();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		const collectionId = boundedString(collectionIdValue, "");
		if (!collectionId) throw new Error("Downloaded song is unavailable");
		this.librarySelectionGeneration += 1;
		this.desiredLibrarySelection = null;
		const legacyTarget = this.libraryView.collections.find((entry) => entry.collectionId === collectionId)?.difficulties[0];
		const deleted = typeof graph.authoring.deleteCollection === "function" ? await graph.authoring.deleteCollection(collectionId) : legacyTarget ? await graph.authoring.deletePackage({
			key: legacyTarget.packageKey,
			packageId: legacyTarget.packageId
		}) : false;
		if (this.isCurrent(generation, graph)) {
			await this.refreshLibrary(generation);
			if (this.isCurrent(generation, graph)) this.publish("content_changed");
		}
		return deleted;
	}
	setTheme(theme) {
		this.assertConnected();
		const normalized = safeData(theme, 0, 32);
		this.configuration = Object.freeze({
			...this.configuration,
			hostTheme: normalized
		});
		this.graph.renderer.setTheme(normalized);
		this.renderPresenters();
		this.publish("capabilities_changed");
		return this.getSnapshot();
	}
	async enterFullscreen() {
		this.assertConnected();
		if (!this.requestFullscreen) throw new Error("Fullscreen is unavailable");
		this.fullscreenPending = true;
		this.fullscreenError = null;
		this.renderPresenters();
		try {
			await this.requestFullscreen();
		} catch (error) {
			this.fullscreenPending = false;
			this.fullscreenError = errorCode(error, "fullscreen_request_failed");
			this.publish("fullscreen_changed");
			throw error;
		}
		return this.getSnapshot();
	}
	async exitFullscreen() {
		this.assertConnected();
		if (document.fullscreenElement !== this || !document.exitFullscreen) return this.getSnapshot();
		this.fullscreenPending = true;
		this.renderPresenters();
		try {
			await document.exitFullscreen();
		} catch (error) {
			this.fullscreenPending = false;
			this.fullscreenError = errorCode(error, "fullscreen_exit_failed");
			throw error;
		}
		return this.getSnapshot();
	}
	/** Execute one validated public host command. */
	executeCommand(command) {
		this.assertConnected();
		if (!isGameCommand(command) || !isSafeIframePayload(command.payload)) throw new TypeError("Invalid game command");
		const payload = command.payload ?? {};
		switch (command.type) {
			case "configure": return this.configure(payload);
			case "start": return this.start();
			case "pause": return this.pause("host_command");
			case "resume": return this.resume();
			case "stop": return this.stop();
			case "reset_calibration": return this.reset();
			case "request_fullscreen": throw new Error("Fullscreen commands require a child user gesture");
			case "select_content": return this.selectContent(payload);
			case "select_variant": return this.selectVariant(boundedString(dataValue(payload, "variantId"), ""), dataValue(payload, "modifierIds") ?? []);
			case "browse_beatsaver": return this.browseBeatSaver(payload);
			case "cancel_import": return this.cancelImport();
			case "delete_package": return this.deletePackage(dataValue(payload, "handle"));
			case "set_theme": return this.setTheme(dataValue(payload, "theme"));
			case "destroy": return this.destroy();
			case "import_beatsaver": return this.importBeatSaverById(dataValue(payload, "mapId"), dataValue(payload, "versionHash"), {
				difficulty: dataValue(payload, "difficultyId"),
				sourceId: dataValue(payload, "mapId"),
				modifiers: dataValue(payload, "modifierIds") ?? []
			}, true);
			case "import_local_zip": throw new Error("Raw local archives cannot cross iframe commands");
			default: throw new Error("Unsupported command");
		}
	}
	getSnapshot() {
		const graph = this.graph;
		return safeData({
			schema: "aerobeat/game_snapshot",
			version: 1,
			instanceId: this.instanceId,
			app: {
				version: appMetadata.packageVersion,
				buildStamp: appMetadata.buildStamp,
				cacheBust: appMetadata.cacheBust
			},
			lifecycle: this.lifecycle,
			generation: this.connectedGeneration,
			container: this.container,
			capabilities: this.capabilities(),
			fullscreen: this.fullscreenSnapshot(),
			interaction: {
				menuOpen: this.menuOpen,
				menuPauseArmed: this.menuPauseArmed,
				menuStarting: this.menuStarting
			},
			iframe: this.bridge?.getSnapshot() ?? {
				schema: "aerobeat/iframe_bridge_snapshot",
				version: 1,
				framed: false,
				connected: false,
				parentOrigin: null
			},
			lease: aeroGameMediaLeaseCoordinator.snapshot(),
			cvProfile: lockedProductionCvProfile,
			services: graph ? {
				vendor: graph.vendor.snapshot(),
				authoring: graph.authoring.getSnapshot(),
				content: contentTelemetry(graph.content.getSnapshot()),
				video: graph.video.describeStatus(),
				cv: graph.cv.getStatus(),
				input: graph.input.getSnapshot(),
				audio: graph.audio.getStatus(),
				profiles: profileTelemetry(graph.profiles.getSnapshot()),
				gameplay: gameplayTelemetry(graph.gameplay.getSnapshot()),
				renderer: rendererTelemetry(graph.renderer.describe()),
				cadence: this.cadenceSnapshot()
			} : null,
			error: this.lastError
		}, 0, 2048);
	}
	/** Terminal until a disconnect/reconnect creates a fresh graph. */
	destroy() {
		this.teardown("destroyed");
		return this.getSnapshot();
	}
	attachStableSurfaces() {
		this.graph.renderer.attach(this.canvasElement());
		this.graph.renderer.clear({ color: [
			0,
			0,
			0,
			0
		] });
		const video = this.videoElement();
		video.muted = true;
		video.playsInline = true;
	}
	bindGraph() {
		if (typeof this.graph.input.subscribe === "function") this.unsubscribe.push(this.graph.input.subscribe(() => {
			this.renderRuntimePresentation();
			this.emitGameEvent("calibration_changed", { snapshot: this.snapshotForType("calibration_changed") });
		}));
		for (const [service, type] of [[this.graph.content, "content_changed"], [this.graph.authoring, "import_changed"]]) if (typeof service.subscribe === "function") this.unsubscribe.push(service.subscribe(() => {
			if (this.menuOpen) this.renderPresenters();
			else this.renderRuntimePresentation();
			this.emitGameEvent(type, { snapshot: this.snapshotForType(type) });
		}));
		this.unsubscribe.push(this.graph.profiles.subscribe(() => {
			this.applyActiveVisualProfile();
			if (this.menuOpen) this.renderPresenters();
			else this.renderRuntimePresentation();
			this.emitGameEvent("profiles_changed", { snapshot: profileTelemetry(this.graph.profiles.getSnapshot()) });
		}));
	}
	bindLease() {
		const graph = this.graph;
		const generation = this.connectedGeneration;
		const participant = {
			instanceId: this.instanceId,
			pauseForLease: async () => {
				if (!this.isCurrent(generation, graph)) return;
				this.stopFrameLoop();
				await Promise.allSettled([graph.audio.pauseForLease(), graph.cv.stop()]);
				if (!this.isCurrent(generation, graph)) return;
				graph.video.pauseForLease();
				graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
				try {
					graph.gameplay.pause(performance.now(), "media_lease_transferred");
					this.synchronizePausedClock(graph);
				} catch {}
				this.syncContentPlayback();
			},
			activateLease: async () => {
				if (!this.isCurrent(generation, graph)) return;
				graph.video.activateLease();
				await graph.audio.activateLease();
			},
			releaseLease: async () => {
				graph.video.releaseLease({ releaseStream: false });
				await graph.audio.releaseLease();
			}
		};
		this.leaseParticipant = participant;
		this.unregisterLease = aeroGameMediaLeaseCoordinator.register(participant);
	}
	bindHostLifecycle() {
		document.addEventListener("visibilitychange", this.boundVisibility);
		document.addEventListener("fullscreenchange", this.boundFullscreen);
		this.shadowRoot?.addEventListener(aeroUiIntentEventName, this.boundUiIntent);
		this.shadowRoot?.addEventListener("click", this.boundInteractionClick);
		this.shadowRoot?.addEventListener("keydown", this.boundInteractionKeydown);
		this.localZipInput().addEventListener("change", this.boundLocalZip);
		this.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.measureContainer()) : null;
		this.resizeObserver?.observe(this);
		globalThis.addEventListener("resize", this.boundFullscreen);
	}
	createBridge() {
		if (globalThis.parent === globalThis) return;
		const expectedOrigin = this.getAttribute("parent-origin") || referrerOrigin();
		if (!expectedOrigin) return;
		this.bridge = createAeroGameIframeBridge({
			parentWindow: globalThis.parent,
			instanceId: this.instanceId,
			expectedOrigin,
			onConnect: () => this.emitGameEvent("ready", { snapshot: this.getSnapshot() }),
			onCommand: (command) => {
				Promise.resolve(this.executeCommand(command)).catch((error) => this.handleError(error));
			},
			onError: (error) => this.handleError(error)
		});
	}
	async convertAcquired(acquired, options) {
		const generation = this.connectedGeneration;
		const graph = this.graph;
		const raw = options === void 0 ? Object.freeze({}) : safeData(options, 0, 32);
		const converter = graph.profiles.getActive("converter_regeneration");
		let result;
		try {
			result = await graph.authoring.convertAllStandardAndPersist(acquired.source, {
				sourceProvider: "beatsaver",
				sourceId: boundedString(dataValue(raw, "sourceId"), boundedString(acquired.map?.mapId, "local")),
				sourceVersionHash: acquired.sourceHash,
				modifiers: stringList(dataValue(raw, "modifiers") ?? [], 5),
				includeAudio: true,
				converterProfile: converter.profile,
				signal: this.activeAbort.signal
			});
		} catch (error) {
			if (!this.isCurrent(generation, graph)) return null;
			throw error;
		}
		if (!this.isCurrent(generation, graph)) return null;
		const defaultLoaded = await graph.authoring.loadPackage(result.defaultPackage.handle);
		if (!this.isCurrent(generation, graph)) return null;
		if (!packageCarriesConverterProfile(defaultLoaded.package, converter.profile)) throw new Error("Authored package converter provenance is incomplete");
		graph.profiles.select(converter.profile.profileId, {
			sessionState: profileSessionState(graph.gameplay.getSnapshot()),
			regeneratedPackageProfileHash: converter.profile.contentHash
		});
		this.emitGameEvent("import_changed", {
			collectionId: result.collection.collectionId,
			packageCount: result.packages.length
		});
		await this.refreshLibrary(generation, {
			preferredCollectionId: result.collection.collectionId,
			preferredPackageId: result.defaultPackage.packageId
		});
		return result;
	}
	contentLoadOptions() {
		return {
			defaultTheme: dataValue(this.configuration, "defaultTheme"),
			playlistTheme: dataValue(this.configuration, "playlistTheme"),
			athleteTheme: dataValue(this.configuration, "athleteTheme"),
			hostTheme: dataValue(this.configuration, "hostTheme") ?? dataValue(this.configuration, "theme"),
			defaultBackground: dataValue(this.configuration, "defaultBackground"),
			playlistBackground: dataValue(this.configuration, "playlistBackground"),
			athleteBackground: dataValue(this.configuration, "athleteBackground"),
			hostBackground: dataValue(this.configuration, "hostBackground")
		};
	}
	async loadSelectedAudio(graph = this.graph) {
		const content = graph.content.getSnapshot();
		const audio = content.song?.audio;
		if (!audio || typeof audio.filePath !== "string") return;
		const bytes = graph.content.readAsset(audio.filePath);
		const hash = typeof audio.contentHash === "string" ? audio.contentHash.replace(/^sha256:/u, "") : "";
		await graph.audio.load({
			id: `${content.packageId}:audio`,
			kind: "array-buffer",
			label: content.song?.name ?? "AeroBeat song",
			arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
			contentType: "application/octet-stream",
			...hash ? { expectedHash: {
				algorithm: "SHA-256",
				value: hash
			} } : {}
		}, { signal: this.activeAbort.signal });
	}
	configureGameplayFromContent(futureOnly) {
		const content = this.graph.content.getSnapshot();
		if (content.state !== "ready" || !content.selectedVariant) return;
		const scoring = this.graph.profiles.getActive("between_run_ruleset");
		const configuration = {
			packageId: content.packageId,
			selectedVariant: content.selectedVariant,
			resolvedEvents: content.resolvedEvents,
			profileIdentity: scoring.identity,
			scoringSettings: scoring.settings
		};
		if (futureOnly) this.graph.gameplay.applyFutureContent(configuration);
		else this.graph.gameplay.configureContent(configuration);
	}
	applyActiveVisualProfile() {
		if (!this.graph) return;
		const visual = this.graph.profiles.getActive("live_visual");
		this.graph.renderer.importTuning({
			identity: visual.identity,
			settings: visual.settings
		});
	}
	setEnvironmentMode(mode) {
		if (mode !== "aero" && mode !== "camera") throw new TypeError("Environment choice is invalid");
		this.environmentMode = mode;
		this.renderInteractionShell();
		this.syncCameraPresentation();
	}
	cameraPreviewForced() {
		if (!this.graph || !this.sessionStartRequested || this.menuOpen) return false;
		const gameplay = this.graph.gameplay.getSnapshot();
		const state = gameplay.session.state;
		return state === "calibrating" && !gameplay.safety.ready || state === "paused_tracking" || gameplay.safety.freshCalibrationRequired === true;
	}
	syncCameraPresentation() {
		if (!this.graph) return;
		const retained = Boolean(this.graph.video.getRetainedCameraStream());
		const visible = !document.hidden && retained && (this.environmentMode === "camera" || this.cameraPreviewForced());
		const video = this.videoElement();
		video.dataset.previewVisible = visible ? "true" : "false";
		video.setAttribute("aria-hidden", "true");
		const compositeMode = visible ? "camera" : "aero";
		if (this.cameraCompositeMode !== compositeMode) {
			this.graph.renderer.setBackgroundProjection(visible ? CAMERA_BACKGROUND_PROJECTION : AERO_BACKGROUND_PROJECTION);
			this.cameraCompositeMode = compositeMode;
		}
	}
	applyActiveScoringProfile() {
		if (!this.graph) return;
		const content = this.graph.content.getSnapshot();
		if (content.state !== "ready" || !content.selectedVariant) return;
		const session = this.graph.gameplay.getSnapshot().session;
		const futureOnly = session.packageId === content.packageId && [
			"calibrating",
			"paused_manual",
			"paused_tracking"
		].includes(session.state);
		this.configureGameplayFromContent(futureOnly);
	}
	synchronizeConverterProvenance(packageValue) {
		const profile = converterProfileFromPackage(packageValue);
		if (!profile || !packageCarriesConverterProfile(packageValue, profile)) return;
		const snapshot = this.graph.profiles.getSnapshot();
		const applied = snapshot.profiles.find((entry) => entry.class === "converter_regeneration" && entry.contentHash === profile.contentHash);
		if (!applied) return;
		const desiredId = snapshot.active.converter.profile.profileId;
		this.graph.profiles.select(applied.profileId, { regeneratedPackageProfileHash: applied.contentHash });
		if (desiredId !== applied.profileId) this.graph.profiles.select(desiredId);
	}
	restoreAppliedConverterSelection(appliedHash) {
		const profile = dataValue(this.graph.content.getSnapshot().lineage, "converterProfile");
		if (!profile || dataValue(profile, "contentHash") !== appliedHash) return;
		const snapshot = this.graph.profiles.getSnapshot();
		const desiredId = snapshot.active.converter.profile.profileId;
		const applied = snapshot.profiles.find((entry) => entry.class === "converter_regeneration" && entry.contentHash === appliedHash);
		if (!applied) return;
		this.graph.profiles.select(applied.profileId, { regeneratedPackageProfileHash: appliedHash });
		if (desiredId !== applied.profileId) this.graph.profiles.select(desiredId);
	}
	syncContentPlayback() {
		if (!this.graph || this.graph.content.getSnapshot().state !== "ready") return;
		const gameplay = this.graph.gameplay.getSnapshot();
		const session = gameplay.session;
		const state = session.state === "playing" ? "running" : session.state === "completed" || session.state === "destroyed" ? "stopped" : session.packageId ? "paused" : "idle";
		this.graph.content.setPlaybackState({
			state,
			positionMs: session.timelinePositionMs,
			judgedEventIds: gameplay.judgedEventIds,
			activeEventIds: gameplay.activeEventIds
		});
	}
	synchronizePausedClock(graph = this.graph) {
		if (!graph) return;
		graph.gameplay.synchronizePausedClock({
			timestampMs: Math.max(performance.now(), graph.gameplay.getSnapshot().session.timestampMs),
			clock: graph.audio.getClockSnapshot()
		});
	}
	syncAudioForGameplay() {
		const generation = this.connectedGeneration;
		const graph = this.graph;
		if (!graph || this.audioSyncPending || document.hidden) return;
		const session = graph.gameplay.getSnapshot().session;
		const shouldPlay = session.state === "playing";
		const isPlaying = graph.audio.getStatus().state === "playing";
		const freezeAtGameplayTimeline = [
			"calibrating",
			"paused_tracking",
			"countdown"
		].includes(session.state);
		const clockAligned = audioClockAlignedWithGameplay(session, graph.audio.getClockSnapshot());
		if (shouldPlay === isPlaying && (!freezeAtGameplayTimeline || clockAligned)) return;
		this.audioSyncPending = true;
		(shouldPlay ? graph.audio.play() : this.pauseAudioForGameplay(graph, session, freezeAtGameplayTimeline)).then(() => {
			if (!this.isCurrent(generation, graph) || shouldPlay || freezeAtGameplayTimeline) return;
			if (graph.gameplay.getSnapshot().session.state === "paused_manual") this.synchronizePausedClock(graph);
		}).catch((error) => {
			if (this.isCurrent(generation, graph)) this.handleError(error);
		}).finally(() => {
			if (this.isCurrent(generation, graph)) this.audioSyncPending = false;
		});
	}
	async pauseAudioForGameplay(graph, session, freezeAtGameplayTimeline) {
		if (graph.audio.getStatus().state === "playing") await graph.audio.pause();
		if (!freezeAtGameplayTimeline || !this.isCurrent(this.connectedGeneration, graph)) return;
		if (audioClockAlignedWithGameplay(session, graph.audio.getClockSnapshot())) return;
		if (typeof graph.audio.seek !== "function") throw new Error("Audio service cannot align a frozen gameplay countdown");
		await graph.audio.seek(Number(session.timelinePositionMs ?? 0) / 1e3);
	}
	attachRetainedCamera() {
		const surface = this.graph.video.attachCameraStream(this.videoElement());
		this.updateCameraIdentity(surface);
		this.activeCvSource = createLockedVideoFrameSource(this.videoElement(), surface);
	}
	updateCameraIdentity(surface) {
		const aspect = Number.isFinite(surface.sourceAspectRatio) ? Number(surface.sourceAspectRatio).toFixed(8) : "unknown";
		const identity = `${surface.sourceChangeId}|${surface.sourceId}|${surface.mirrored === true}|${aspect}`;
		if (identity === this.lastCameraIdentity) return;
		this.lastCameraIdentity = identity;
		this.graph.input.resetCalibration("media_source_changed");
	}
	async startCv() {
		if (this.activeCvSource && !document.hidden) await this.graph.cv.start(this.activeCvSource);
	}
	startFrameLoop() {
		this.stopFrameLoop();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		this.cadenceStartedAtMs = performance.now();
		this.cadenceLatestFrameAtMs = 0;
		this.displayFrameCount = 0;
		this.freshPoseConsumptionCount = 0;
		this.inputAdvanceCount = 0;
		const loop = createAeroDisplayLoop({ callback: () => {
			if (!this.isCurrent(generation, graph) || document.hidden) {
				if (this.frameLoop === loop) this.stopFrameLoop();
				else loop.stop();
				return;
			}
			this.runDisplayFrame(graph);
		} });
		this.frameLoop = loop;
		this.frameTimer = 1;
		loop.start();
	}
	runDisplayFrame(graph = this.graph) {
		if (!graph) return;
		try {
			const frameNow = performance.now();
			const surface = graph.video.describeSurface(this.videoElement());
			this.updateCameraIdentity(surface);
			const frame = graph.cv.getLatestPoseFrame();
			if (frame && frame.timestampMs !== this.latestPoseTimestampMs) {
				this.latestPoseTimestampMs = frame.timestampMs;
				this.lastFreshPoseAtMs = frameNow;
				this.lastInputAdvanceAtMs = frameNow;
				this.freshPoseConsumptionCount += 1;
				if (!this.menuOpen) graph.input.processPoseSample(frame, {
					sourceAspectRatio: surface.sourceAspectRatio,
					sourceChangeId: this.lastCameraIdentity
				});
			} else if (!this.menuOpen && frameNow - this.lastFreshPoseAtMs >= 100 && frameNow - this.lastInputAdvanceAtMs >= 1e3 / 15) {
				this.lastInputAdvanceAtMs = frameNow;
				this.inputAdvanceCount += 1;
				graph.input.advanceTime(frameNow);
			}
			try {
				const beforeAdvance = graph.gameplay.getSnapshot().session;
				const audioClock = graph.audio.getClockSnapshot();
				const awaitingAudioStart = beforeAdvance.state === "playing" && this.audioSyncPending && graph.audio.getStatus().state !== "playing";
				const awaitingAudioFreeze = [
					"calibrating",
					"paused_tracking",
					"countdown"
				].includes(beforeAdvance.state) && (this.audioSyncPending || !audioClockAlignedWithGameplay(beforeAdvance, audioClock));
				if (!awaitingAudioStart && !awaitingAudioFreeze) {
					graph.gameplay.advance({
						timestampMs: frameNow,
						clock: audioClock,
						input: graph.input.getSnapshot(),
						lease: this.leaseSnapshotForGameplay()
					});
					if (this.sessionStartRequested && graph.gameplay.getSnapshot().session.state === "calibrating" && graph.gameplay.getSnapshot().safety.ready) graph.gameplay.requestStart(frameNow);
				}
				this.syncAudioForGameplay();
				if (frameNow - this.lastContentSyncAtMs >= 1e3 / 15) {
					this.lastContentSyncAtMs = frameNow;
					this.syncContentPlayback();
				}
			} catch {}
			this.syncCameraPresentation();
			this.renderGameplay(graph);
			this.displayFrameCount += 1;
			this.cadenceLatestFrameAtMs = frameNow;
			if (this.container.devicePixelRatio !== currentDpr()) this.measureContainer();
			this.renderRuntimePresentation();
		} catch (error) {
			this.handleError(error);
		}
	}
	stopFrameLoop() {
		const loop = this.frameLoop;
		this.frameLoop = null;
		this.frameTimer = 0;
		loop?.stop();
	}
	async applyVisibility() {
		if (!this.graph) return;
		const generation = this.connectedGeneration;
		const visibilityGeneration = ++this.visibilityGeneration;
		const graph = this.graph;
		const hidden = document.hidden;
		graph.video.setDocumentHidden(hidden);
		await graph.audio.setDocumentHidden(hidden);
		if (!this.isCurrent(generation, graph) || visibilityGeneration !== this.visibilityGeneration) return;
		if (hidden) {
			this.stopPreview();
			this.stopFrameLoop();
			await graph.cv.stop();
			if (!this.isCurrent(generation, graph) || visibilityGeneration !== this.visibilityGeneration) return;
			try {
				graph.gameplay.pause(Math.max(performance.now(), graph.gameplay.getSnapshot().session.timestampMs), "document_hidden");
				this.synchronizePausedClock(graph);
			} catch {}
		} else if (aeroGameMediaLeaseCoordinator.snapshot().ownerInstanceId === this.instanceId) {
			graph.gameplay.setLeaseSnapshot(aeroGameMediaLeaseCoordinator.snapshot());
			if (graph.video.getRetainedCameraStream()) {
				this.attachRetainedCamera();
				await graph.video.play(this.videoElement());
			}
			if (!this.isCurrent(generation, graph) || visibilityGeneration !== this.visibilityGeneration) return;
			await this.startCv();
			if (!this.isCurrent(generation, graph) || visibilityGeneration !== this.visibilityGeneration) return;
			try {
				graph.gameplay.resume(performance.now());
			} catch {}
			this.startFrameLoop();
			this.syncAudioForGameplay();
		}
		this.syncContentPlayback();
		this.measureContainer();
		this.publish("session_changed");
	}
	measureContainer() {
		if (!this.isConnected) return;
		const style = getComputedStyle(this);
		const horizontalPadding = cssPixels(style.paddingLeft) + cssPixels(style.paddingRight);
		const verticalPadding = cssPixels(style.paddingTop) + cssPixels(style.paddingBottom);
		const width = Math.max(0, this.clientWidth - horizontalPadding);
		const height = Math.max(0, this.clientHeight - verticalPadding);
		const dpr = currentDpr();
		this.container = containerSnapshot(width, height, dpr, !document.hidden, document.fullscreenElement === this);
		this.graph?.renderer.resize({
			widthCssPx: width,
			heightCssPx: height,
			devicePixelRatio: dpr
		});
		this.renderPresenters();
	}
	rendererFrame() {
		const content = this.graph.content.getSnapshot();
		const session = this.graph.gameplay.getSnapshot().session;
		const selected = content.selectedVariant;
		const nowMs = Number(session.timelinePositionMs ?? 0);
		const ruleset = String(selected?.rulesetId ?? "");
		return {
			presentation: selected?.mode === "flow" ? "flow" : ruleset.includes("semantic") ? "boxing_semantic_track" : "boxing_spatial_grid",
			nowMs,
			targets: (content.resolvedEvents ?? []).filter((event) => event.centerTimestampMs >= nowMs - 500 && event.centerTimestampMs <= nowMs + 2500).slice(0, 128).map(renderTarget),
			countdown: null,
			overlay: "none",
			calibrationDim: 0
		};
	}
	renderGameplay(graph = this.graph) {
		if (!graph) return null;
		const result = graph.renderer.renderGameplayFrame(this.rendererFrame());
		const grid = result?.plan?.grid;
		if (!grid || typeof graph.renderer.renderGameplayCursors !== "function") return result;
		const cursors = gameplayCursorRecords(this.menuOpen, graph.gameplay.getSnapshot().session, graph.input.getSnapshot());
		graph.renderer.renderGameplayCursors(cursors, {
			grid,
			minConfidence: .5,
			sizeCssPx: 18
		});
		return result;
	}
	renderPresenters() {
		if (!this.graph) return;
		this.renderInteractionShell();
		this.syncCameraPresentation();
		const content = this.graph.content.getSnapshot();
		const gameplay = this.graph.gameplay.getSnapshot();
		const input = this.graph.input.getSnapshot();
		const session = gameplay.session;
		setPresenter(this, "aero-calibration-badge", input.calibration);
		setPresenter(this, "aero-tracking-pause", { active: false });
		setPresenter(this, "aero-resume-countdown", { active: false });
		const selectorSnapshot = profilePresenterSnapshot(this.graph.profiles.getSnapshot(), content.selectedVariant, session.state);
		setPresenter(this, "aero-prototype-selector[scope='gameplay']", selectorSnapshot);
		setPresenter(this, "aero-prototype-selector[scope='visuals']", selectorSnapshot);
		setPresenter(this, "aero-content-import-progress", this.graph.authoring.getSnapshot());
		setPresenter(this, "aero-content-library", {
			...this.libraryView,
			selectedPackageId: this.libraryView.selectedPackageId,
			preview: this.previewView
		});
		setPresenter(this, "aero-beatsaver-browser", {
			...this.beatSaverView,
			preview: this.previewView
		});
		setPresenter(this, "aero-background-environment", content.background ?? { kind: "css-fallback" });
		setPresenter(this, "aero-fullscreen-button", this.fullscreenSnapshot());
		this.presenterCommitCount += 10;
		this.runtimeUiSignature = "";
		this.renderRuntimePresentation();
	}
	renderRuntimePresentation() {
		if (!this.graph) return;
		this.syncCameraPresentation();
		const content = this.graph.content.getSnapshot();
		const gameplay = this.graph.gameplay.getSnapshot();
		const input = this.graph.input.getSnapshot();
		const session = gameplay.session;
		const runtimeMessage = runtimeStatus(content, session, input);
		const cueMessage = transientCue(this.menuOpen, this.sessionStartRequested, session, gameplay, input);
		const action = actionableRuntimeMessage(this.lastError, this.capabilities().limitations);
		const signature = JSON.stringify([
			runtimeMessage,
			cueMessage,
			action,
			this.musicPrerequisite
		]);
		if (signature === this.runtimeUiSignature) return;
		this.runtimeUiSignature = signature;
		this.runtimeUiCommitCount += 1;
		const status = this.shadowRoot?.querySelector("[data-role='status']");
		if (status && status.textContent !== runtimeMessage) status.textContent = runtimeMessage;
		const cue = this.shadowRoot?.querySelector("[data-role='transient-cue']");
		if (cue instanceof HTMLElement) {
			if (cue.textContent !== cueMessage) cue.textContent = cueMessage;
			cue.hidden = cueMessage === "";
		}
		const infoAction = this.shadowRoot?.querySelector("[data-role='info-action']");
		if (infoAction instanceof HTMLElement) {
			if (infoAction.textContent !== action) infoAction.textContent = action;
			infoAction.hidden = action === "";
		}
		const prerequisite = this.shadowRoot?.querySelector("[data-role='music-prerequisite']");
		if (prerequisite instanceof HTMLElement) {
			if (prerequisite.textContent !== this.musicPrerequisite) prerequisite.textContent = this.musicPrerequisite;
			prerequisite.hidden = this.musicPrerequisite === "";
		}
	}
	renderInteractionShell() {
		const button = this.menuButtonElement();
		const drawer = this.drawerElement();
		const backdrop = this.shadowRoot?.querySelector("[data-role='menu-backdrop']");
		if (button) {
			button.setAttribute("aria-expanded", this.menuOpen ? "true" : "false");
			button.setAttribute("aria-label", this.menuOpen ? "Close configuration menu" : "Open configuration menu");
			button.dataset.menuState = this.menuOpen ? "open" : "closed";
		}
		for (const input of this.shadowRoot?.querySelectorAll("input[data-action='environment-select']") ?? []) if (input instanceof HTMLInputElement) input.checked = input.value === this.environmentMode;
		if (drawer) {
			drawer.hidden = !this.menuOpen;
			drawer.setAttribute("aria-hidden", this.menuOpen ? "false" : "true");
		}
		if (backdrop instanceof HTMLElement) backdrop.hidden = !this.menuOpen;
		for (const presenter of this.shadowRoot?.querySelectorAll("[data-role='drawer'] aero-prototype-selector,[data-role='drawer'] aero-beatsaver-browser,[data-role='drawer'] aero-content-import-progress,[data-role='drawer'] aero-content-library,[data-role='drawer'] aero-capabilities-panel,[data-role='drawer'] aero-error-panel,[data-role='drawer'] aero-fullscreen-button") ?? []) presenter.toggleAttribute("compact", this.menuOpen);
		const start = this.shadowRoot?.querySelector("[data-action='calibrate-start']");
		if (start instanceof HTMLButtonElement) {
			start.disabled = this.menuStarting;
			start.textContent = this.menuStarting ? "Preparing…" : "Calibrate / Start";
		}
	}
	selectBrowsedMap(mapId) {
		this.stopPreview();
		const map = this.browsedMaps.get(boundedIdentifier(mapId, "BeatSaver map ID").toUpperCase());
		if (!map) throw new Error("Selected BeatSaver map is unavailable");
		const version = playableVersions(map)[0];
		if (!version) throw new Error("Selected BeatSaver map has no playable Standard difficulty");
		const summary = mapSummary(map);
		const difficulties = standardDifficulties(version);
		this.beatSaverView = Object.freeze({
			...this.beatSaverView,
			selectedMap: summary,
			versions: summary.versions,
			selectedVersionHash: version.hash,
			difficulties,
			selectedDifficulty: difficulties[0]
		});
		this.renderPresenters();
		return summary;
	}
	selectBrowsedVersion(versionHash) {
		this.stopPreview();
		const mapId = this.beatSaverView.selectedMap?.mapId;
		const map = typeof mapId === "string" ? this.browsedMaps.get(mapId.toUpperCase()) : null;
		if (!map) throw new Error("Select a BeatSaver map first");
		const version = playableVersions(map).find((entry) => entry.hash === versionHash);
		if (!version) throw new Error("Selected BeatSaver version has no playable Standard difficulty");
		const difficulties = standardDifficulties(version);
		this.beatSaverView = Object.freeze({
			...this.beatSaverView,
			selectedVersionHash: version.hash,
			difficulties,
			selectedDifficulty: difficulties[0]
		});
		this.renderPresenters();
	}
	async selectLibraryPackage(target, selectionGeneration) {
		this.assertConnected();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		if (selectionGeneration !== this.librarySelectionGeneration) return null;
		const before = graph.content.getSnapshot();
		const presentationId = before.selectedVariant ? profilePresentationId(before.selectedVariant) : "flow";
		const modifierIds = stringList(before.selectedVariant?.modifierIds ?? [], 16);
		let loaded;
		try {
			loaded = await graph.authoring.loadPackage({
				key: target.packageKey,
				packageId: target.packageId
			});
		} catch (error) {
			if (!this.isCurrent(generation, graph) || selectionGeneration !== this.librarySelectionGeneration) return null;
			throw error;
		}
		if (!this.isCurrent(generation, graph) || selectionGeneration !== this.librarySelectionGeneration) return null;
		await this.selectContent({
			kind: "persistence",
			handle: loaded.handle
		});
		if (!this.isCurrent(generation, graph) || selectionGeneration !== this.librarySelectionGeneration) return null;
		const content = graph.content.getSnapshot();
		const equivalent = content.variants.find((variant) => profilePresentationId(variant) === presentationId);
		const fallback = content.variants.find((variant) => profilePresentationId(variant) === "flow") ?? content.variants[0];
		const selected = equivalent ?? fallback;
		if (selected?.variantId && (content.selectedVariant?.variantId !== selected.variantId || modifierIds.length > 0)) await this.selectVariant(selected.variantId, modifierIds);
		if (!this.isCurrent(generation, graph) || selectionGeneration !== this.librarySelectionGeneration) return null;
		return Object.freeze({
			collectionId: target.collectionId,
			packageId: target.packageId,
			generation: selectionGeneration
		});
	}
	requestLibrarySelection(collectionIdValue, packageIdValue) {
		this.assertConnected();
		const target = librarySelectionTarget(this.libraryView.collections, collectionIdValue, packageIdValue);
		if (!target) return Promise.reject(/* @__PURE__ */ new Error("Downloaded difficulty is unavailable"));
		const selectionGeneration = ++this.librarySelectionGeneration;
		this.desiredLibrarySelection = Object.freeze({
			collectionId: target.collectionId,
			packageId: target.packageId,
			generation: selectionGeneration
		});
		const activatedCollections = activateLibraryCollection(this.libraryView.collections, target.collectionId, target.packageId);
		this.libraryView = Object.freeze({
			...this.libraryView,
			selectedCollectionId: target.collectionId,
			selectedPackageId: target.packageId,
			collections: activatedCollections,
			songs: publicLibrarySongs(activatedCollections)
		});
		this.stopPreview();
		this.renderPresenters();
		const selection = this.librarySelectionTail.catch(() => null).then(() => this.selectLibraryPackage(target, selectionGeneration));
		this.librarySelectionTail = selection;
		this.pendingLibrarySelection = selection;
		selection.catch((error) => {
			if (selectionGeneration === this.librarySelectionGeneration) this.handleError(error);
		}).finally(() => {
			if (this.pendingLibrarySelection === selection) this.pendingLibrarySelection = null;
		});
		return selection;
	}
	async refreshLibrary(generation = this.connectedGeneration, preferences = {}) {
		const graph = this.graph;
		if (!graph) return;
		const collectionsRequest = typeof graph.authoring.listCollections === "function" ? graph.authoring.listCollections() : Promise.resolve(null);
		const [listedPackages, listedCollectionsValue, storage] = await Promise.all([
			graph.authoring.listPackages(),
			collectionsRequest,
			graph.authoring.estimateStorage()
		]);
		if (!this.isCurrent(generation, graph)) return;
		const packages = productLibraryPackages(listedPackages);
		const listedCollections = listedCollectionsValue ?? legacyLibraryCollections(packages);
		const requestedPackageId = boundedString(preferences.preferredPackageId, this.desiredLibrarySelection?.packageId ?? this.libraryView.selectedPackageId ?? "");
		const requestedCollectionId = boundedString(preferences.preferredCollectionId, this.desiredLibrarySelection?.collectionId ?? this.libraryView.selectedCollectionId ?? "");
		const collections = productLibraryCollections(listedCollections, requestedCollectionId, requestedPackageId);
		const selectedCollection = collections.find((entry) => entry.collectionId === requestedCollectionId) ?? collections.find((entry) => entry.difficulties.some((difficulty) => difficulty.packageId === requestedPackageId)) ?? collections[0] ?? null;
		const selectedPackageId = selectedCollection?.difficulties.some((entry) => entry.packageId === requestedPackageId) ? requestedPackageId : selectedCollection?.activePackageId ?? null;
		this.libraryView = Object.freeze({
			packages,
			collections,
			songs: publicLibrarySongs(collections),
			selectedCollectionId: selectedCollection?.collectionId ?? null,
			selectedPackageId,
			usedBytes: storage.usageBytes,
			quotaBytes: storage.quotaBytes,
			storage
		});
		this.renderPresenters();
		if (!selectedCollection || !selectedPackageId) return;
		if (graph.content.getSnapshot().packageId === selectedPackageId) return;
		return this.requestLibrarySelection(selectedCollection.collectionId, selectedPackageId);
	}
	async exportLibraryPackage(target) {
		this.assertConnected();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		const exported = await graph.authoring.exportPackage({
			key: target.packageKey,
			packageId: target.packageId
		});
		if (!this.isCurrent(generation, graph)) return null;
		const url = URL.createObjectURL(new Blob([exported.bytes], { type: exported.mediaType }));
		try {
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = exported.fileName;
			anchor.hidden = true;
			this.shadowRoot?.append(anchor);
			anchor.click();
			anchor.remove();
		} finally {
			URL.revokeObjectURL(url);
		}
		return Object.freeze({
			fileName: exported.fileName,
			byteLength: exported.byteLength
		});
	}
	async toggleBeatSaverPreview(mapIdValue, versionHashValue) {
		this.assertConnected();
		const mapId = boundedIdentifier(mapIdValue, "BeatSaver map ID");
		const versionHash = boundedIdentifier(versionHashValue, "BeatSaver version hash");
		const target = Object.freeze({
			mapId,
			versionHash,
			packageId: ""
		});
		if (activePreview(this.previewView, target)) {
			this.stopPreview();
			return;
		}
		if (this.beatSaverView.selectedMap?.mapId !== mapId || this.beatSaverView.selectedVersionHash !== versionHash) throw new Error("Select this song version before previewing it");
		const rawUrl = playableVersions(this.browsedMaps.get(mapId.toUpperCase())).find((entry) => entry.hash === versionHash)?.previewUrl;
		if (typeof rawUrl !== "string" || rawUrl.length > 2048) throw new Error("Preview is unavailable for this song");
		let url;
		try {
			url = new URL(rawUrl);
		} catch {
			throw new Error("Preview is unavailable for this song");
		}
		if (url.protocol !== "https:") throw new Error("Preview is unavailable for this song");
		await this.startPreview(url.href, target, 0);
	}
	async toggleLibraryPreview(packageIdValue) {
		this.assertConnected();
		const packageId = boundedString(packageIdValue, "");
		const collectionId = this.libraryView.selectedCollectionId;
		const selectionTarget = librarySelectionTarget(this.libraryView.collections, collectionId, packageId);
		if (!selectionTarget || this.libraryView.selectedPackageId !== packageId) throw new Error("Select this downloaded song before previewing it");
		const target = Object.freeze({
			mapId: "",
			versionHash: "",
			packageId
		});
		if (activePreview(this.previewView, target)) {
			this.stopPreview();
			return;
		}
		const desired = this.desiredLibrarySelection;
		if (!desired || desired.collectionId !== selectionTarget.collectionId || desired.packageId !== packageId || this.graph.content.getSnapshot().packageId !== packageId) await this.requestLibrarySelection(selectionTarget.collectionId, packageId);
		const exactGeneration = this.librarySelectionGeneration;
		if (this.pendingLibrarySelection) await this.pendingLibrarySelection;
		if (exactGeneration !== this.librarySelectionGeneration || this.desiredLibrarySelection?.packageId !== packageId || this.graph.content.getSnapshot().packageId !== packageId) return;
		this.stopPreview({ render: false });
		const token = this.previewGeneration;
		this.setPreviewView("loading", target, "");
		try {
			const audio = this.graph.content.getSnapshot().song?.audio;
			if (!audio || typeof audio.filePath !== "string") throw new Error("Downloaded song is still loading");
			const bytes = this.graph.content.readAsset(audio.filePath);
			const mimeType = previewMimeType(audio.filePath);
			const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
			if (token !== this.previewGeneration || exactGeneration !== this.librarySelectionGeneration) {
				URL.revokeObjectURL(objectUrl);
				return;
			}
			this.previewObjectUrl = objectUrl;
			await this.playPreview(objectUrl, target, token, 1e4);
		} catch (error) {
			if (token === this.previewGeneration) this.failPreview(token, target, error);
		}
	}
	async startPreview(sourceUrl, target, maximumMs) {
		this.stopPreview({ render: false });
		const token = this.previewGeneration;
		this.setPreviewView("loading", target, "");
		try {
			await this.playPreview(sourceUrl, target, token, maximumMs);
		} catch (error) {
			if (token === this.previewGeneration) this.failPreview(token, target, error);
		}
	}
	async playPreview(sourceUrl, target, token, maximumMs) {
		const audio = this.previewAudioElement();
		const playing = () => {
			if (token === this.previewGeneration) this.setPreviewView("playing", target, "");
		};
		const ended = () => {
			if (token === this.previewGeneration) this.finishPreview(token, target, "ended");
		};
		const failed = () => {
			if (token === this.previewGeneration) this.failPreview(token, target, /* @__PURE__ */ new Error("Preview playback failed"));
		};
		this.previewListeners = Object.freeze({
			playing,
			ended,
			failed
		});
		audio.addEventListener("playing", playing);
		audio.addEventListener("ended", ended);
		audio.addEventListener("error", failed);
		audio.preload = "auto";
		audio.src = sourceUrl;
		audio.currentTime = 0;
		audio.load();
		await Promise.resolve(audio.play());
		if (token !== this.previewGeneration) return;
		if (this.previewView.state === "loading") this.setPreviewView("playing", target, "");
		if (maximumMs > 0) this.previewTimer = globalThis.setTimeout(() => {
			if (token === this.previewGeneration) this.finishPreview(token, target, "ended");
		}, maximumMs);
	}
	finishPreview(token, target, state) {
		if (token !== this.previewGeneration) return;
		this.cleanupPreviewMedia();
		this.previewGeneration += 1;
		this.previewView = previewView(state, target, "");
		this.renderPresenters();
	}
	failPreview(token, target, _error) {
		if (token !== this.previewGeneration) return;
		this.cleanupPreviewMedia();
		this.previewGeneration += 1;
		this.previewView = previewView("error", target, "Preview unavailable. Try again.");
		this.renderPresenters();
	}
	stopPreview(options = {}) {
		this.previewGeneration += 1;
		this.cleanupPreviewMedia();
		this.previewView = emptyPreviewView();
		if (options.render !== false && this.lifecycle === "connected") this.renderPresenters();
	}
	cleanupPreviewMedia() {
		if (this.previewTimer) globalThis.clearTimeout(this.previewTimer);
		this.previewTimer = 0;
		const audio = this.shadowRoot?.querySelector("audio[data-role='preview']");
		if (audio instanceof HTMLAudioElement) {
			const listeners = this.previewListeners;
			if (listeners) {
				audio.removeEventListener("playing", listeners.playing);
				audio.removeEventListener("ended", listeners.ended);
				audio.removeEventListener("error", listeners.failed);
			}
			try {
				audio.pause();
			} catch {}
			audio.removeAttribute("src");
			try {
				audio.load();
			} catch {}
		}
		this.previewListeners = null;
		const objectUrl = this.previewObjectUrl;
		this.previewObjectUrl = null;
		if (objectUrl) URL.revokeObjectURL(objectUrl);
	}
	setPreviewView(state, target, errorMessage) {
		this.previewView = previewView(state, target, errorMessage);
		this.renderPresenters();
	}
	previewAudioElement() {
		const value = this.shadowRoot?.querySelector("audio[data-role='preview']");
		if (!(value instanceof HTMLAudioElement)) throw new Error("Preview audio surface missing");
		return value;
	}
	async handleLocalZip(event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
		const file = input.files[0];
		input.value = "";
		const options = {
			difficulty: this.beatSaverView.selectedDifficulty || "Expert",
			sourceId: file.name.replace(/\.zip$/iu, "").slice(0, 256) || "local"
		};
		try {
			await this.importLocalZip(file, options);
		} catch (error) {
			this.handleError(error);
		}
	}
	async handleInteractionClick(event) {
		const path = typeof event.composedPath === "function" ? event.composedPath() : [];
		const action = path.find((entry) => entry instanceof HTMLElement && entry.dataset?.action)?.dataset?.action;
		if (action === "menu-toggle") this.setMenuOpen(!this.menuOpen);
		else if (action === "menu-close" || action === "menu-backdrop") this.setMenuOpen(false);
		else if (action === "calibrate-start") await this.startFromMenu();
		else if (action === "environment-select") {
			const input = path.find((entry) => entry instanceof HTMLInputElement && entry.dataset.action === "environment-select");
			if (input instanceof HTMLInputElement && input.checked) this.setEnvironmentMode(input.value);
		}
	}
	handleInteractionKeydown(event) {
		if (!(event instanceof KeyboardEvent)) return;
		if (event.key === "Escape" && this.menuOpen) {
			event.preventDefault();
			this.setMenuOpen(false);
			return;
		}
		if (event.key !== "Tab" || !this.menuOpen) return;
		const drawer = this.shadowRoot?.querySelector("[data-role='drawer']");
		const menuButton = this.menuButtonElement();
		if (!(drawer instanceof HTMLElement) || !menuButton) return;
		const focusable = [menuButton, ...deepFocusable(drawer)];
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = deepActiveElement(this.shadowRoot);
		if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}
	setMenuOpen(open) {
		if (!this.graph || this.menuOpen === open) return;
		if (open) {
			this.menuFocusRestore = this.menuButtonElement();
			this.menuOpen = true;
			this.menuPauseArmed = true;
			const now = Math.max(performance.now(), Number(this.graph.gameplay.getSnapshot().session.timestampMs ?? 0));
			this.graph.input.resetCalibration("menu_open");
			try {
				this.graph.gameplay.pause(now, "configuration_menu");
				this.synchronizePausedClock(this.graph);
			} catch {}
			this.graph.audio.pause().catch((error) => this.handleError(error));
		} else {
			this.stopPreview();
			this.menuOpen = false;
			this.menuPauseArmed = true;
			this.graph.input.resetCalibration("menu_closed_recalibration_required");
		}
		this.renderPresenters();
		this.publish("session_changed");
		queueMicrotask(() => requestAnimationFrame(() => {
			if (!this.isConnected) return;
			if (this.menuOpen) this.menuButtonElement()?.focus();
			else (this.menuFocusRestore?.isConnected ? this.menuFocusRestore : this.menuButtonElement())?.focus();
		}));
	}
	async startFromMenu() {
		if (!this.graph || this.menuStarting) return;
		this.stopPreview();
		const generation = this.connectedGeneration;
		const graph = this.graph;
		this.menuStarting = true;
		this.lastError = null;
		this.musicPrerequisite = "";
		this.renderPresenters();
		try {
			if (this.pendingLibrarySelection) await this.pendingLibrarySelection;
			let playable = await this.ensurePlayableMusicSelection();
			if (!playable && this.beatSaverView.selectedMap) {
				const mapId = this.beatSaverView.selectedMap.mapId;
				const versionHash = this.beatSaverView.selectedVersionHash;
				const difficulty = this.beatSaverView.selectedDifficulty;
				if (!versionHash || !difficulty) throw new Error("Choose a playable song version and difficulty");
				await this.importBeatSaverById(mapId, versionHash, {
					difficulty,
					sourceId: mapId
				});
				if (!this.isCurrent(generation, graph)) return;
				playable = await this.ensurePlayableMusicSelection();
			}
			if (!playable) {
				this.musicPrerequisite = "Choose or import a song to start.";
				this.menuOpen = true;
				this.renderPresenters();
				this.focusMusicSection();
				return;
			}
			await this.start();
			if (!this.isCurrent(generation, graph)) return;
			this.menuPauseArmed = true;
			this.setMenuOpen(false);
		} catch (error) {
			if (this.isCurrent(generation, graph)) {
				this.handleError(error);
				this.menuOpen = true;
				this.renderPresenters();
			}
		} finally {
			this.menuStarting = false;
			if (this.isCurrent(generation, graph)) this.renderPresenters();
		}
	}
	async ensurePlayableMusicSelection() {
		if (!this.graph) return false;
		let content = this.graph.content.getSnapshot();
		if (playableContent(content)) {
			this.configureGameplayFromContent(false);
			return true;
		}
		const firstVariant = content.state === "ready" && content.packageId ? content.variants?.[0] : null;
		if (firstVariant?.variantId) {
			await this.selectVariant(firstVariant.variantId);
			content = this.graph?.content.getSnapshot();
			if (playableContent(content)) {
				this.configureGameplayFromContent(false);
				return true;
			}
		}
		return false;
	}
	focusMusicSection() {
		queueMicrotask(() => requestAnimationFrame(() => {
			const section = this.shadowRoot?.querySelector("[data-section='music']");
			if (section instanceof HTMLElement) section.focus();
		}));
	}
	drawerElement() {
		const value = this.shadowRoot?.querySelector("[data-role='drawer']");
		return value instanceof HTMLElement ? value : null;
	}
	menuButtonElement() {
		const value = this.shadowRoot?.querySelector("[data-role='menu-button']");
		return value instanceof HTMLButtonElement ? value : null;
	}
	handleUiIntent(event) {
		const detail = event instanceof CustomEvent ? event.detail : null;
		if (!detail || typeof detail.type !== "string") return;
		if (detail.type === "fullscreen-request") this.enterFullscreen().catch((error) => this.handleError(error));
		else if (detail.type === "fullscreen-exit") this.exitFullscreen().catch((error) => this.handleError(error));
		else if (detail.type === "beatsaver-search") this.browseBeatSaver({ text: dataValue(detail.payload, "query") ?? "" }).catch((error) => this.handleError(error));
		else if (detail.type === "beatsaver-latest") this.browseLatestBeatSaver().catch((error) => this.handleError(error));
		else if (detail.type === "beatsaver-select-map") try {
			this.selectBrowsedMap(dataValue(detail.payload, "mapId"));
		} catch (error) {
			this.handleError(error);
		}
		else if (detail.type === "beatsaver-version-select") try {
			this.selectBrowsedVersion(dataValue(detail.payload, "versionHash"));
		} catch (error) {
			this.handleError(error);
		}
		else if (detail.type === "beatsaver-difficulty-select") {
			const difficulty = dataValue(detail.payload, "difficultyId");
			if (typeof difficulty === "string" && this.beatSaverView.difficulties.includes(difficulty)) {
				this.stopPreview();
				this.beatSaverView = Object.freeze({
					...this.beatSaverView,
					selectedDifficulty: difficulty
				});
				this.renderPresenters();
			}
		} else if (detail.type === "beatsaver-preview-toggle") this.toggleBeatSaverPreview(dataValue(detail.payload, "mapId"), dataValue(detail.payload, "versionHash")).catch((error) => this.handleError(error));
		else if (detail.type === "beatsaver-import") this.importBeatSaverById(dataValue(detail.payload, "mapId"), dataValue(detail.payload, "versionHash"), {
			difficulty: dataValue(detail.payload, "difficultyId"),
			sourceId: dataValue(detail.payload, "mapId")
		}).catch((error) => this.handleError(error));
		else if (detail.type === "local-zip-request") {
			this.stopPreview();
			this.localZipInput().click();
		} else if (detail.type === "content-import-cancel") this.cancelImport();
		else if (detail.type === "library-select") {
			const collectionId = dataValue(detail.payload, "collectionId");
			const collection = this.libraryView.collections.find((entry) => entry.collectionId === collectionId);
			if (collection) this.requestLibrarySelection(collection.collectionId, collection.activePackageId);
		} else if (detail.type === "library-difficulty-select") {
			const collectionId = dataValue(detail.payload, "collectionId");
			const packageId = dataValue(detail.payload, "packageId");
			this.requestLibrarySelection(collectionId, packageId);
		} else if (detail.type === "library-preview-toggle") this.toggleLibraryPreview(dataValue(detail.payload, "packageId")).catch((error) => this.handleError(error));
		else if (detail.type === "library-export") {
			const target = librarySelectionTarget(this.libraryView.collections, this.libraryView.selectedCollectionId, dataValue(detail.payload, "packageId"));
			if (target) this.exportLibraryPackage(target).catch((error) => this.handleError(error));
		} else if (detail.type === "library-delete") this.deleteLibraryCollection(dataValue(detail.payload, "collectionId")).catch((error) => this.handleError(error));
		else if (detail.type === "prototype-select") {
			const target = this.variantForPresentation(dataValue(detail.payload, "profileId"));
			if (target) this.selectVariant(target.variantId).catch((error) => this.handleError(error));
		} else if (detail.type === "prototype-profile-select") try {
			this.selectProfileFromIntent(detail.payload);
		} catch (error) {
			this.handleError(error);
		}
		else if (detail.type === "tuning-import-request") this.emitGameEvent("profile_bundle_import_requested", {});
		else if (detail.type === "tuning-export") try {
			const bundle = this.exportPrototypeProfiles();
			this.emitGameEvent("profile_bundle_exported", {
				bundleVersion: bundle.bundleVersion,
				bundleHash: bundle.bundleHash,
				profileCount: bundle.profiles.length
			});
		} catch (error) {
			this.handleError(error);
		}
		else if (detail.type === "tuning-reset") try {
			this.resetPrototypeProfiles();
		} catch (error) {
			this.handleError(error);
		}
		else if (detail.type === "calibration-reset") this.reset();
	}
	variantForPresentation(value) {
		if (typeof value !== "string") return null;
		return this.graph.content.getSnapshot().variants.find((variant) => profilePresentationId(variant) === value) ?? null;
	}
	selectProfileFromIntent(payload) {
		const profileId = dataValue(payload, "profileId");
		const profileVersion = dataValue(payload, "profileVersion");
		const contentHash = dataValue(payload, "contentHash");
		const profileClass = dataValue(payload, "profileClass");
		if (![
			profileId,
			profileVersion,
			contentHash,
			profileClass
		].every((value) => typeof value === "string")) throw new TypeError("Profile selection intent is invalid");
		const profile = this.graph.profiles.getSnapshot().profiles.find((entry) => entry.profileId === profileId);
		if (!profile || profile.profileVersion !== profileVersion || profile.contentHash !== contentHash || profile.class !== profileClass) throw new TypeError("Profile selection intent does not match the host registry");
		return this.selectPrototypeProfile(profileId);
	}
	publish(type) {
		this.renderPresenters();
		this.emitGameEvent(type, { snapshot: this.snapshotForType(type) });
	}
	emitGameEvent(type, payload) {
		const event = Object.freeze({
			schema: "aerobeat/game_event",
			version: 1,
			eventId: `${this.instanceId}-${++this.eventSequence}`,
			type,
			timestampMs: Math.max(0, performance.now()),
			payload: safeData(payload, 0, 96)
		});
		this.dispatchEvent(new CustomEvent(GAME_EVENT_NAME, {
			bubbles: true,
			composed: true,
			detail: event
		}));
		this.bridge?.sendEvent(event);
		return event;
	}
	snapshotForType(type) {
		const snapshot = this.getSnapshot();
		if (type === "content_changed") return snapshot.services?.content ?? null;
		if (type === "import_changed") return snapshot.services?.authoring ?? null;
		if (type === "calibration_changed" || type === "tracking_changed") return snapshot.services?.input ?? null;
		if (type === "session_changed" || type === "score_changed") return snapshot.services?.gameplay ?? null;
		if (type === "profiles_changed") return snapshot.services?.profiles ?? null;
		if (type === "fullscreen_changed") return snapshot.fullscreen;
		return snapshot;
	}
	handleError(error) {
		this.lastError = Object.freeze({
			code: errorCode(error, "assembly_error"),
			message: errorMessage(error)
		});
		if (this.lifecycle === "connected") this.emitGameEvent("error", this.lastError);
		this.renderPresenters();
	}
	leaseSnapshotForGameplay() {
		return aeroGameMediaLeaseCoordinator.snapshot();
	}
	cadenceSnapshot() {
		const elapsedMs = this.displayFrameCount > 1 && this.cadenceLatestFrameAtMs > this.cadenceStartedAtMs ? this.cadenceLatestFrameAtMs - this.cadenceStartedAtMs : 0;
		const displayRateFps = elapsedMs > 0 ? Math.round((this.displayFrameCount - 1) * 1e4 / elapsedMs) / 10 : null;
		return Object.freeze({
			schema: "aerobeat/runtime_cadence",
			version: 1,
			active: this.frameTimer !== 0,
			displayFrameCount: this.displayFrameCount,
			displayRateFps,
			freshPoseConsumptionCount: this.freshPoseConsumptionCount,
			inputAdvanceCount: this.inputAdvanceCount,
			presenterCommitCount: this.presenterCommitCount,
			runtimeUiCommitCount: this.runtimeUiCommitCount
		});
	}
	capabilities() {
		const webgl2 = Boolean(this.graph?.renderer.getCapabilities().webgl2);
		const camera = Boolean(navigator.mediaDevices?.getUserMedia);
		const fullscreen = typeof this.requestFullscreen === "function";
		const limitations = [];
		if (!camera) limitations.push("camera_unavailable");
		if (!fullscreen) limitations.push("fullscreen_unavailable");
		if (!webgl2) limitations.push("webgl2_unavailable");
		return Object.freeze({
			schema: "aerobeat/game_capabilities",
			version: 1,
			secureContext: globalThis.isSecureContext,
			camera,
			fullscreen,
			autoplay: true,
			webgl2,
			indexedDb: typeof indexedDB !== "undefined",
			worker: typeof Worker !== "undefined",
			directBeatSaverCors: true,
			localZipImport: typeof Blob !== "undefined",
			limitations: Object.freeze(limitations)
		});
	}
	fullscreenSnapshot() {
		return Object.freeze({
			schema: "aerobeat/fullscreen_snapshot",
			version: 1,
			supported: typeof this.requestFullscreen === "function",
			active: document.fullscreenElement === this,
			requestPending: this.fullscreenPending,
			errorCode: this.fullscreenError
		});
	}
	teardown(finalState) {
		if (this.lifecycle !== "connected") {
			this.lifecycle = finalState;
			return;
		}
		this.stopPreview({ render: false });
		this.connectedGeneration += 1;
		this.visibilityGeneration += 1;
		this.lifecycle = finalState;
		this.activeAbort.abort();
		this.stopFrameLoop();
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		document.removeEventListener("visibilitychange", this.boundVisibility);
		document.removeEventListener("fullscreenchange", this.boundFullscreen);
		globalThis.removeEventListener("resize", this.boundFullscreen);
		this.shadowRoot?.removeEventListener(aeroUiIntentEventName, this.boundUiIntent);
		this.shadowRoot?.removeEventListener("click", this.boundInteractionClick);
		this.shadowRoot?.removeEventListener("keydown", this.boundInteractionKeydown);
		this.localZipInput().removeEventListener("change", this.boundLocalZip);
		for (const stop of this.unsubscribe.splice(0)) try {
			stop();
		} catch {}
		if (finalState === "destroyed") this.emitGameEvent("destroyed", { instanceId: this.instanceId });
		this.bridge?.destroy();
		this.bridge = null;
		this.unregisterLease?.();
		this.unregisterLease = null;
		const graph = this.graph;
		this.graph = null;
		if (graph) {
			try {
				graph.content.destroy();
			} catch {}
			try {
				graph.authoring.destroy();
			} catch {}
			try {
				graph.input.destroy();
			} catch {}
			try {
				graph.profiles.destroy();
			} catch {}
			try {
				graph.gameplay.destroy();
			} catch {}
			try {
				graph.renderer.destroy();
			} catch {}
			try {
				graph.video.destroy();
			} catch {}
			graph.cv.dispose().catch(() => {});
			graph.audio.destroy().catch(() => {});
		}
		this.activeCvSource = null;
		this.lastCameraIdentity = "";
		this.leaseParticipant = null;
		this.cameraCompositeMode = null;
		this.videoElement().dataset.previewVisible = "false";
	}
	assertConnected() {
		if (this.lifecycle !== "connected" || !this.graph) throw new Error("aero-game is not connected");
	}
	isCurrent(generation, graph = this.graph) {
		return this.lifecycle === "connected" && this.graph === graph && this.connectedGeneration === generation;
	}
	canvasElement() {
		const value = this.shadowRoot?.querySelector("canvas[data-role='renderer']");
		if (!(value instanceof HTMLCanvasElement)) throw new Error("Renderer surface missing");
		return value;
	}
	videoElement() {
		const value = this.shadowRoot?.querySelector("video[data-role='media']");
		if (!(value instanceof HTMLVideoElement)) throw new Error("Media surface missing");
		return value;
	}
	localZipInput() {
		return this.localZipPicker;
	}
};
/** Define the public root without an aerobeat-app alias. */
function defineAeroGame() {
	if (!customElements.get(elementNames.game)) customElements.define(elementNames.game, AeroGame);
}
defineAeroGame();
function template() {
	return `<style>
:host{box-sizing:border-box;display:block;inline-size:100%;block-size:100%;min-inline-size:0;min-block-size:0;overflow:hidden;contain:layout paint style;color:var(--aero-color-ink,#eaf9ff);background:#06141f;font-family:var(--aero-font-family,system-ui,sans-serif)}
*,*::before,*::after{box-sizing:border-box}[hidden]{display:none!important}.game{position:relative;inline-size:100%;block-size:100%;overflow:hidden}.environment,.media,.renderer{position:absolute;inset:0;inline-size:100%;block-size:100%}.environment{z-index:0}.media{z-index:1;object-fit:cover;transform:scaleX(-1);opacity:0;visibility:hidden}.media[data-preview-visible="true"]{opacity:1;visibility:visible}.renderer{z-index:2}.hud{position:absolute;z-index:10;inset:0;pointer-events:none}.hud>*{pointer-events:auto}.status{position:absolute;z-index:24;inset-inline-start:max(8px,env(safe-area-inset-left));inset-block-end:max(8px,env(safe-area-inset-bottom));max-inline-size:calc(100% - 72px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(0,0,0,.72);border-radius:999px;padding:7px 11px;font:700 12px system-ui}.menu-button,.start-action{min-inline-size:44px;min-block-size:44px;border:1px solid rgba(255,255,255,.34);border-radius:12px;background:rgba(3,19,31,.92);color:inherit;font:700 16px system-ui;touch-action:manipulation}.menu-button{position:absolute;z-index:60;inset-inline-end:max(8px,env(safe-area-inset-right));inset-block-start:max(8px,env(safe-area-inset-top));inline-size:48px;block-size:48px;background:#03131f;color:#fff;font-size:0}.menu-icon{display:block;inline-size:24px;block-size:20px;position:absolute;inset:0;margin:auto}.menu-icon::before,.menu-icon::after,.menu-icon-line{background:#fff;border-radius:999px;content:"";display:block;inline-size:24px;block-size:4px;position:absolute;inset-inline-start:0;transform-origin:center}.menu-icon::before{inset-block-start:0}.menu-icon-line{inset-block-start:8px}.menu-icon::after{inset-block-start:16px}.menu-button[data-menu-state="open"] .menu-icon::before{inset-block-start:8px;transform:rotate(45deg)}.menu-button[data-menu-state="open"] .menu-icon::after{inset-block-start:8px;transform:rotate(-45deg)}.menu-button[data-menu-state="open"] .menu-icon-line{opacity:0}.backdrop{position:absolute;z-index:30;inset:0;border:0;background:rgba(0,8,15,.58)}.drawer{position:absolute;z-index:50;inset-block:0;inset-inline-end:0;inline-size:min(420px,calc(100% - 24px));overflow:auto;overscroll-behavior:contain;background:transparent;padding:max(68px,calc(env(safe-area-inset-top) + 60px)) max(12px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) 12px}.drawer-surface{--aero-color-ink:#08202c;--aero-color-focus:#00677f;background:#f3f8fa;border:1px solid #9bb8c5;border-radius:16px;box-shadow:-12px 0 32px rgba(0,0,0,.42);color:#08202c;display:grid;gap:10px;padding:14px}.start-action{inline-size:100%;margin:0;background:#00566b;border-color:#00566b;color:#fff}.drawer-content{display:grid;gap:8px}.drawer-content>*{min-inline-size:0}@media(min-width:800px){.drawer{inline-size:min(400px,42%)}.menu-button{inset-inline-end:12px;inset-block-start:12px}}
.drawer-section{display:grid;gap:8px;border-block-start:1px solid rgba(8,32,44,.22);padding-block-start:12px}.drawer-section:first-child{border-block-start:0;padding-block-start:0}.drawer-section>h2{margin:0;font:800 18px system-ui}.environment-choice{border:0;display:grid;gap:4px;margin:0;min-inline-size:0;padding:0}.environment-choice legend{font:700 13px system-ui;padding:0}.environment-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.environment-option{align-items:center;border:1px solid rgba(8,32,44,.28);border-radius:10px;display:flex;font:700 14px system-ui;gap:8px;min-block-size:42px;padding:6px 9px}.environment-option:has(input:checked){background:#d5f3fb;border-color:#00677f}.environment-option input{accent-color:#00677f;block-size:20px;inline-size:20px;margin:0}.drawer-section:focus{outline:2px solid var(--aero-color-focus,#72dcff);outline-offset:3px}.drawer-action{margin:0;padding:9px 11px;border-radius:10px;background:#fff0cf;color:#4a3000;font-weight:700}.hud-presenter{display:none!important}.transient-cue{position:absolute;z-index:25;inset-inline:0;inset-block-start:18%;margin:auto;inline-size:max-content;max-inline-size:calc(100% - 32px);background:#03131f;border:1px solid rgba(255,255,255,.34);border-radius:12px;color:#fff;font:900 clamp(24px,8vw,52px)/1 system-ui;padding:8px 10px;text-align:center;text-shadow:0 2px 8px #000}.status{position:absolute!important;block-size:1px!important;inline-size:1px!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;overflow:hidden!important;white-space:nowrap!important;margin:-1px!important;padding:0!important;border:0!important;background:transparent!important}
</style><div class="game"><aero-background-environment class="environment"></aero-background-environment><video data-role="media" class="media"></video><audio data-role="preview" preload="none" hidden></audio><canvas data-role="renderer" class="renderer"></canvas><div class="hud"><aero-calibration-badge class="hud-presenter" aria-hidden="true"></aero-calibration-badge><aero-tracking-pause class="hud-presenter" aria-hidden="true"></aero-tracking-pause><aero-resume-countdown class="hud-presenter" aria-hidden="true"></aero-resume-countdown><div data-role="transient-cue" class="transient-cue" role="status" aria-live="polite" hidden></div></div><span data-role="status" class="status" aria-live="polite">Connecting…</span><button data-role="menu-button" data-action="menu-toggle" data-menu-state="closed" class="menu-button" type="button" aria-label="Open configuration menu" aria-controls="aero-game-drawer" aria-expanded="false"><span class="menu-icon" aria-hidden="true"><span class="menu-icon-line"></span></span></button><button data-role="menu-backdrop" data-action="menu-backdrop" class="backdrop" type="button" aria-label="Close configuration menu" hidden></button><section id="aero-game-drawer" data-role="drawer" class="drawer" role="dialog" aria-modal="true" aria-label="Game configuration" tabindex="-1" hidden><div data-role="drawer-surface" class="drawer-surface"><button data-action="calibrate-start" class="start-action" type="button">Calibrate / Start</button><div class="drawer-content"><section class="drawer-section" data-section="gameplay" aria-labelledby="drawer-gameplay-heading"><h2 id="drawer-gameplay-heading">Gameplay</h2><aero-prototype-selector compact scope="gameplay"></aero-prototype-selector></section><section class="drawer-section" data-section="visuals" aria-labelledby="drawer-visuals-heading"><h2 id="drawer-visuals-heading">Visuals</h2><aero-prototype-selector compact scope="visuals"></aero-prototype-selector><fieldset class="environment-choice"><legend>Environment</legend><div class="environment-options" role="radiogroup" aria-label="Environment"><label class="environment-option"><input data-action="environment-select" type="radio" name="environment" value="aero" checked> <span>Aero</span></label><label class="environment-option"><input data-action="environment-select" type="radio" name="environment" value="camera"> <span>Camera</span></label></div></fieldset></section><section class="drawer-section" data-section="music" aria-labelledby="drawer-music-heading" tabindex="-1"><h2 id="drawer-music-heading">Music</h2><p data-role="music-prerequisite" class="drawer-action" role="alert" hidden></p><aero-beatsaver-browser compact></aero-beatsaver-browser><aero-content-import-progress compact></aero-content-import-progress><aero-content-library compact></aero-content-library></section><section class="drawer-section" data-section="info" aria-labelledby="drawer-info-heading"><h2 id="drawer-info-heading">Info</h2><p data-role="info-action" class="drawer-action" role="alert" hidden></p><aero-fullscreen-button compact></aero-fullscreen-button></section></div></div></section></div>`;
}
/** @param {AeroGame} host @param {string} selector @param {unknown} snapshot */
function setPresenter(host, selector, snapshot) {
	const element = host.shadowRoot?.querySelector(selector);
	if (element && typeof element.setSnapshot === "function") element.setSnapshot(snapshot && typeof snapshot === "object" ? snapshot : {});
}
function containerSnapshot(widthCssPx, heightCssPx, devicePixelRatio, visible, fullscreen) {
	return Object.freeze({
		schema: "aerobeat/container_snapshot",
		version: 1,
		widthCssPx,
		heightCssPx,
		devicePixelRatio,
		visible,
		fullscreen
	});
}
function referrerOrigin() {
	try {
		return document.referrer ? new URL(document.referrer).origin : "";
	} catch {
		return "";
	}
}
function dataValue(record, key) {
	if (!record || typeof record !== "object") return void 0;
	const descriptor = Object.getOwnPropertyDescriptor(record, key);
	return descriptor && "value" in descriptor && descriptor.enumerable ? descriptor.value : void 0;
}
function contentSource(value) {
	if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("Content source must be a plain record");
	if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || ![
		"kind",
		"package",
		"url",
		"handle"
	].includes(key))) throw new TypeError("Content source contains unknown fields");
	const kind = dataValue(value, "kind");
	if (kind === "direct") return Object.freeze({
		kind,
		package: dataValue(value, "package")
	});
	if (kind === "external") return Object.freeze({
		kind,
		url: boundedString(dataValue(value, "url"), "")
	});
	if (kind === "persistence") return Object.freeze({
		kind,
		handle: safeData(dataValue(value, "handle"), 0, 32)
	});
	throw new TypeError("Unsupported content source kind");
}
function boundedString(value, fallback) {
	return typeof value === "string" && value.length > 0 && value.length <= 1024 ? value : fallback;
}
function boundedIdentifier(value, label) {
	if (typeof value !== "string" || !/^[0-9a-zA-Z_-]{1,256}$/u.test(value)) throw new TypeError(`${label} is invalid`);
	return value;
}
function boundedProfileIdentifier(value) {
	if (typeof value !== "string" || value.length < 1 || value.length > 256) throw new TypeError("Prototype profile ID is invalid");
	return value;
}
function stringList(value, maximum) {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) throw new TypeError("Expected bounded string array");
	const keys = Reflect.ownKeys(value);
	if (keys.length !== value.length + 1 || keys.some((key) => key !== "length" && (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw new TypeError("String arrays cannot contain extra fields");
	return Object.freeze(Array.from({ length: value.length }, (_, index) => {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || typeof descriptor.value !== "string" || descriptor.value.length > 256) throw new TypeError("Invalid string entry");
		return descriptor.value;
	}));
}
function errorCode(error, fallback) {
	const code = ownDataValue(error, "code");
	return typeof code === "string" && code.length <= 128 ? code : fallback;
}
function errorMessage(error) {
	const message = ownDataValue(error, "message");
	return typeof message === "string" ? message.slice(0, 2048) : "AeroBeat operation failed";
}
function ownDataValue(record, key) {
	if (!record || typeof record !== "object") return void 0;
	const descriptor = Object.getOwnPropertyDescriptor(record, key);
	return descriptor && "value" in descriptor ? descriptor.value : void 0;
}
function contentTelemetry(snapshot) {
	const result = {};
	for (const key of Object.keys(snapshot)) if (key !== "resolvedEvents") result[key] = snapshot[key];
	result.resolvedEventCount = Array.isArray(snapshot.resolvedEvents) ? snapshot.resolvedEvents.length : 0;
	return Object.freeze(result);
}
function gameplayTelemetry(snapshot) {
	return Object.freeze({
		schema: snapshot.schema,
		version: snapshot.version,
		serviceId: snapshot.serviceId,
		generation: snapshot.generation,
		session: snapshot.session,
		countdown: snapshot.countdown,
		safety: snapshot.safety,
		lease: snapshot.lease,
		selectedVariant: snapshot.selectedVariant,
		profileIdentity: snapshot.profileIdentity,
		activeEventIds: snapshot.activeEventIds.slice(0, 128),
		judgedEventCount: snapshot.judgedEventIds.length,
		latestJudgement: snapshot.judgements.at(-1) ?? null,
		latestShadowJudgement: snapshot.shadowJudgements.at(-1) ?? null,
		scorePartitions: snapshot.scorePartitions,
		error: snapshot.error
	});
}
function emptyBeatSaverView() {
	return Object.freeze({
		state: "idle",
		query: "",
		results: Object.freeze([]),
		selectedMap: null,
		versions: Object.freeze([]),
		difficulties: Object.freeze([]),
		selectedVersionHash: "",
		selectedDifficulty: "",
		errorMessage: ""
	});
}
function emptyPreviewView() {
	return previewView("idle", {
		mapId: "",
		versionHash: "",
		packageId: ""
	}, "");
}
function previewView(state, target, errorMessage) {
	const safeState = [
		"idle",
		"loading",
		"playing",
		"ended",
		"error"
	].includes(state) ? state : "idle";
	return Object.freeze({
		state: safeState,
		mapId: boundedString(target?.mapId, "").slice(0, 256),
		versionHash: boundedString(target?.versionHash, "").slice(0, 256),
		packageId: boundedString(target?.packageId, "").slice(0, 1024),
		errorMessage: boundedString(errorMessage, "").slice(0, 256)
	});
}
function activePreview(view, target) {
	return (view.state === "loading" || view.state === "playing") && view.mapId === target.mapId && view.versionHash === target.versionHash && view.packageId === target.packageId;
}
function previewMimeType(path) {
	const extension = String(path).split(".").at(-1)?.toLowerCase() ?? "";
	return Object.freeze({
		egg: "audio/ogg",
		ogg: "audio/ogg",
		mp3: "audio/mpeg",
		wav: "audio/wav",
		m4a: "audio/mp4",
		aac: "audio/aac",
		flac: "audio/flac",
		webm: "audio/webm"
	})[extension] ?? "application/octet-stream";
}
function playableContent(content) {
	return content?.state === "ready" && typeof content.packageId === "string" && content.packageId.length > 0 && typeof content.selectedVariant?.variantId === "string" && content.selectedVariant.variantId.length > 0;
}
function runtimeStatus(content, session, input) {
	if (!playableContent(content)) return "Choose a song in Music.";
	if (session.state === "playing") return "Workout in progress.";
	if (session.state === "countdown") return "Get ready.";
	if (session.state === "paused_tracking") return "Recalibrate to continue.";
	if (input.calibration?.state === "holding") return "Hold the T-pose.";
	if (session.state === "calibrating") return "T-pose calibration ready.";
	return "Ready to calibrate.";
}
function transientCue(menuOpen, sessionStartRequested, session, gameplay, input) {
	if (menuOpen || !sessionStartRequested) return "";
	if (session.state === "paused_tracking") return "Tracking lost";
	if (Number.isFinite(gameplay.countdown?.value)) return String(gameplay.countdown.value);
	if (input.calibration?.state === "cooldown") return "Release";
	if (session.state !== "calibrating") return "";
	if (input.calibration?.state === "holding") return "Hold T-pose";
	return "T-pose";
}
function actionableRuntimeMessage(error, limitations) {
	if (error?.message) return boundedString(error.message, "AeroBeat needs attention.");
	if (limitations.includes("camera_unavailable")) return "Camera access is unavailable in this browser.";
	if (limitations.includes("webgl2_unavailable")) return "WebGL2 is unavailable; try a current browser.";
	if (limitations.includes("fullscreen_unavailable")) return "Fullscreen is unavailable here.";
	return "";
}
function mapSummary(map) {
	const versions = playableVersions(map);
	return Object.freeze({
		mapId: map.mapId,
		name: map.mapName || map.songName,
		songAuthorName: map.songAuthorName,
		levelAuthorName: map.levelAuthorName,
		versionCount: versions.length,
		versions: Object.freeze(versions.slice(0, 8).map((version, index) => Object.freeze({
			versionHash: version.hash,
			label: String(index + 1)
		})))
	});
}
function standardDifficulties(version) {
	return Object.freeze((version?.difficulties ?? []).filter((entry) => entry.characteristic === "Standard").map((entry) => entry.difficulty).filter((entry, index, all) => all.indexOf(entry) === index));
}
function playableVersions(map) {
	return Object.freeze((map?.versions ?? []).filter((version) => standardDifficulties(version).length > 0));
}
function productLibraryPackages(packages) {
	const byId = /* @__PURE__ */ new Map();
	for (const summary of packages) {
		const id = typeof summary?.packageId === "string" ? summary.packageId : "";
		if (!id) continue;
		const prior = byId.get(id);
		if (!prior || Number(summary.createdAtMs ?? 0) >= Number(prior.createdAtMs ?? 0)) byId.set(id, summary);
	}
	return Object.freeze([...byId.values()].sort((left, right) => Number(right.createdAtMs ?? 0) - Number(left.createdAtMs ?? 0) || String(left.songName ?? "").localeCompare(String(right.songName ?? "")) || String(left.difficulty ?? "").localeCompare(String(right.difficulty ?? "")) || String(left.packageId ?? "").localeCompare(String(right.packageId ?? ""))));
}
function legacyLibraryCollections(packages) {
	return Object.freeze(packages.map((entry) => Object.freeze({
		collectionId: `legacy:${boundedString(entry?.key, boundedString(entry?.packageId, ""))}`,
		songName: boundedString(entry?.songName, "Downloaded song"),
		packages: Object.freeze([Object.freeze({
			packageKey: boundedString(entry?.key, ""),
			packageId: boundedString(entry?.packageId, ""),
			difficultyId: boundedString(entry?.difficulty, "Downloaded"),
			difficultyLabel: boundedString(entry?.difficulty, "Downloaded")
		})])
	})));
}
function productLibraryCollections(collections, selectedCollectionId, selectedPackageId) {
	const normalized = [];
	for (const collection of Array.isArray(collections) ? collections : []) {
		const collectionId = boundedString(collection?.collectionId, "");
		const songName = boundedString(collection?.songName, "Downloaded song");
		const difficulties = [];
		for (const entry of Array.isArray(collection?.packages) ? collection.packages : []) {
			const packageKey = boundedString(entry?.packageKey, ""), packageId = boundedString(entry?.packageId, ""), difficultyId = boundedString(entry?.difficultyId, ""), label = boundedString(entry?.difficultyLabel, difficultyId);
			if (packageKey && packageId && difficultyId && label) difficulties.push(Object.freeze({
				packageKey,
				packageId,
				difficultyId,
				label
			}));
		}
		if (!collectionId || difficulties.length === 0) continue;
		const retained = collectionId === selectedCollectionId && difficulties.some((entry) => entry.packageId === selectedPackageId) ? selectedPackageId : difficulties[0].packageId;
		normalized.push(Object.freeze({
			collectionId,
			songName,
			activePackageId: retained,
			difficulties: Object.freeze(difficulties)
		}));
	}
	return Object.freeze(normalized);
}
function publicLibrarySongs(collections) {
	return Object.freeze(collections.map((collection) => Object.freeze({
		collectionId: collection.collectionId,
		songName: collection.songName,
		activePackageId: collection.activePackageId,
		difficulties: Object.freeze(collection.difficulties.map((entry) => Object.freeze({
			difficultyId: entry.difficultyId,
			label: entry.label,
			packageId: entry.packageId
		})))
	})));
}
function librarySelectionTarget(collections, collectionIdValue, packageIdValue) {
	const collectionId = boundedString(collectionIdValue, ""), packageId = boundedString(packageIdValue, "");
	const collection = collections.find((entry) => entry.collectionId === collectionId);
	const difficulty = collection?.difficulties.find((entry) => entry.packageId === packageId);
	return collection && difficulty ? Object.freeze({
		collectionId,
		packageId,
		packageKey: difficulty.packageKey,
		difficultyId: difficulty.difficultyId
	}) : null;
}
function activateLibraryCollection(collections, collectionId, packageId) {
	return Object.freeze(collections.map((collection) => collection.collectionId === collectionId && collection.difficulties.some((entry) => entry.packageId === packageId) ? Object.freeze({
		...collection,
		activePackageId: packageId
	}) : collection));
}
function currentDpr() {
	return Number.isFinite(globalThis.devicePixelRatio) && globalThis.devicePixelRatio > 0 ? globalThis.devicePixelRatio : 1;
}
function audioClockAlignedWithGameplay(session, clock) {
	return clock?.playing === false && Number(clock.positionSeconds) * 1e3 === Number(session?.timelinePositionMs ?? 0);
}
function cssPixels(value) {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}
function gameplayCursorRecords(menuOpen, session, input) {
	if (menuOpen || !["countdown", "playing"].includes(String(session?.state ?? ""))) return Object.freeze([]);
	const tracking = input?.tracking;
	if (!tracking || tracking.gameplayPaused === true || tracking.freshCalibrationRequired === true || tracking.allRequiredAnchorsVisible !== true || input?.retainedGeometryDimmed === true || input?.countdownFrozen === true) return Object.freeze([]);
	const roles = [
		"nose",
		"left_wrist",
		"right_wrist"
	];
	const byRole = new Map((Array.isArray(input?.anchors) ? input.anchors : []).map((anchor) => [anchor?.anchor, anchor]));
	return Object.freeze(roles.flatMap((role) => {
		const anchor = byRole.get(role);
		if (anchor?.valid !== true || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || !Number.isFinite(anchor.confidence) || anchor.confidence < .5) return [];
		return [Object.freeze({
			role,
			x: anchor.x,
			y: anchor.y,
			confidence: anchor.confidence
		})];
	}));
}
function renderTarget(event) {
	const beat = event.authoredBeat ?? {};
	const type = String(beat.type ?? "note");
	if (type === "note") return {
		id: event.eventId,
		kind: "flow",
		hand: beat.hand === "right" ? "right" : "left",
		family: "flow",
		cell: Number.isInteger(beat.placement) ? beat.placement : null,
		cells: [],
		lane: null,
		beatCenterMs: event.centerTimestampMs,
		direction: flowDirection(beat.direction)
	};
	if (type === "guard") {
		const crossed = beat.modifier === "crossed_guard";
		return {
			id: event.eventId,
			kind: "guard",
			hand: "both",
			family: crossed ? "crossed_guard" : "guard",
			cell: null,
			cells: [beat.guardTarget?.leftCell, beat.guardTarget?.rightCell].filter(Number.isInteger),
			lane: null,
			beatCenterMs: event.centerTimestampMs
		};
	}
	if (type === "squat" || type.startsWith("weave")) return {
		id: event.eventId,
		kind: "obstacle",
		hand: "neutral",
		family: type === "squat" ? "squat" : "weave",
		cell: null,
		cells: Array.isArray(beat.blockedCells) ? beat.blockedCells : [],
		lane: null,
		beatCenterMs: event.centerTimestampMs
	};
	const hand = type.endsWith("right") ? "right" : "left";
	const family = type.startsWith("hook") ? "hook" : type.startsWith("uppercut") ? "uppercut" : "straight";
	return {
		id: event.eventId,
		kind: "punch",
		hand,
		family,
		cell: Number.isInteger(beat.spatialTarget?.targetCell) ? beat.spatialTarget.targetCell : null,
		cells: [],
		lane: hand,
		beatCenterMs: event.centerTimestampMs,
		direction: beat.spatialTarget?.entryDirection ?? null
	};
}
var beatSaberFlowDirections = Object.freeze([
	"up",
	"down",
	"left",
	"right",
	"up-left",
	"up-right",
	"down-left",
	"down-right"
]);
function flowDirection(value) {
	if (Number.isInteger(value) && Number(value) >= 0 && Number(value) < beatSaberFlowDirections.length) return beatSaberFlowDirections[Number(value)] ?? null;
	return typeof value === "string" && beatSaberFlowDirections.includes(value) ? value : null;
}
function profileSessionState(gameplay) {
	const countdown = dataValue(gameplay, "countdown");
	const session = dataValue(gameplay, "session");
	if (dataValue(countdown, "value") !== null && dataValue(countdown, "value") !== void 0) return "countdown";
	return typeof dataValue(session, "state") === "string" ? dataValue(session, "state") : "idle";
}
function profilePresentationId(variant) {
	if (dataValue(variant, "mode") === "flow") return "flow";
	const semantic = String(dataValue(variant, "rulesetId") ?? "").includes("semantic");
	const row = String(dataValue(variant, "recipeId") ?? "").includes("row_family");
	return `${semantic ? "semantic" : "spatial"}-${row ? "row" : "cut"}`;
}
function tuningIdentity(profile, regenerationRequired) {
	return Object.freeze({
		schema: "aerobeat/prototype_tuning_identity",
		version: 1,
		profileId: profile.profileId,
		profileVersion: profile.profileVersion,
		contentHash: profile.contentHash,
		class: profile.class,
		regenerationRequired
	});
}
function profileTelemetry(snapshot) {
	return Object.freeze({
		schema: snapshot.schema,
		version: snapshot.version,
		generation: snapshot.generation,
		destroyed: snapshot.destroyed,
		bundleVersion: snapshot.bundleVersion,
		profileCount: snapshot.profiles.length,
		active: Object.freeze({
			visual: snapshot.active.visual.identity,
			scoring: snapshot.active.scoring.identity,
			converter: snapshot.active.converter.identity
		}),
		appliedConverterHash: snapshot.appliedConverterHash,
		pendingConverterHash: snapshot.pendingConverterHash,
		regenerationRequired: snapshot.regenerationRequired,
		experimental: true
	});
}
function rendererTelemetry(snapshot) {
	return Object.freeze({
		serviceId: dataValue(snapshot, "serviceId"),
		state: dataValue(snapshot, "state"),
		supported: dataValue(snapshot, "supported"),
		attached: dataValue(snapshot, "attached"),
		contextLost: dataValue(snapshot, "contextLost"),
		widthCssPx: dataValue(snapshot, "widthCssPx"),
		heightCssPx: dataValue(snapshot, "heightCssPx"),
		devicePixelRatio: dataValue(snapshot, "devicePixelRatio"),
		visualProfileIdentity: dataValue(snapshot, "visualProfileIdentity"),
		tuningRequiresRegeneration: false,
		experimental: true,
		errorMessage: dataValue(snapshot, "errorMessage")
	});
}
function profilePresenterSnapshot(snapshot, selectedVariant, sessionState) {
	const classes = [
		"live_visual",
		"between_run_ruleset",
		"converter_regeneration"
	].map((profileClass) => {
		const key = profileClass === "live_visual" ? "visual" : profileClass === "between_run_ruleset" ? "scoring" : "converter";
		const active = snapshot.active[key];
		const profiles = Object.freeze(snapshot.profiles.filter((profile) => profile.class === profileClass).map((profile) => tuningIdentity(profile, profileClass === "converter_regeneration" && profile.contentHash !== snapshot.appliedConverterHash)));
		if (profileClass !== "converter_regeneration") return Object.freeze({
			class: profileClass,
			active: active.identity,
			profiles,
			experimental: true
		});
		return Object.freeze({
			class: profileClass,
			active: active.identity,
			profiles,
			experimental: true,
			selectedContentHash: active.identity.contentHash,
			appliedContentHash: snapshot.appliedConverterHash,
			pendingContentHash: snapshot.pendingConverterHash,
			regenerationRequired: snapshot.regenerationRequired
		});
	});
	return Object.freeze({
		selectedProfileId: selectedVariant ? profilePresentationId(selectedVariant) : "flow",
		sessionState: String(sessionState ?? "idle"),
		profileClasses: Object.freeze(classes)
	});
}
function packageFromEnvelope(envelope) {
	const value = dataValue(envelope, "package");
	return value && typeof value === "object" ? value : null;
}
function converterProfileFromPackage(packageValue) {
	const profile = dataValue(dataValue(packageValue, "source"), "converterProfile");
	return profile && typeof profile === "object" ? profile : null;
}
function packageCarriesConverterProfile(packageValue, profile) {
	try {
		const expected = canonicalPrototypeProfileJson(profile);
		const source = dataValue(packageValue, "source");
		const trace = dataValue(packageValue, "conversionTrace");
		if (canonicalPrototypeProfileJson(dataValue(source, "converterProfile")) !== expected || canonicalPrototypeProfileJson(dataValue(trace, "converterProfile")) !== expected) return false;
		const boxing = dataValue(trace, "boxing");
		const flow = dataValue(trace, "flow");
		const charts = dataValue(packageValue, "charts");
		if (!Array.isArray(boxing) || boxing.length !== 4 || boxing.some((entry) => canonicalPrototypeProfileJson(dataValue(entry, "converterProfile")) !== expected)) return false;
		if (!Array.isArray(flow) || flow.some((entry) => dataValue(entry, "converterProfile") !== void 0)) return false;
		const boxingCharts = Array.isArray(charts) ? charts.filter((chart) => dataValue(chart, "mode") === "boxing") : [];
		return boxingCharts.length === 4 && boxingCharts.every((chart) => canonicalPrototypeProfileJson(dataValue(dataValue(chart, "prototype"), "converterProfile")) === expected);
	} catch {
		return false;
	}
}
/** Return keyboard-focusable controls in composed tree order, including open presenter roots. @param {Element | ShadowRoot} root @returns {HTMLElement[]} */
function deepFocusable(root) {
	const controls = [];
	for (const element of root.querySelectorAll("*")) {
		if (!(element instanceof HTMLElement) || element.hidden) continue;
		if (element.matches("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])")) controls.push(element);
		if (element.shadowRoot) controls.push(...deepFocusable(element.shadowRoot));
	}
	return controls;
}
/** Resolve the innermost focused element across open shadow roots. @param {ShadowRoot | null} root @returns {Element | null} */
function deepActiveElement(root) {
	let active = root?.activeElement ?? null;
	while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
	return active;
}
/** Descriptor-safe bounded clone for public snapshots/commands. */
function safeData(value, depth, maximumItems) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return value;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new TypeError("Non-finite public data");
		return Object.is(value, -0) ? 0 : value;
	}
	if (depth >= 12) throw new TypeError("Public data exceeds depth limit");
	if (Array.isArray(value)) {
		if (Object.getPrototypeOf(value) !== Array.prototype || value.length > maximumItems) throw new TypeError("Invalid public array");
		const keys = Reflect.ownKeys(value);
		if (keys.length !== value.length + 1 || keys.some((key) => key !== "length" && (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw new TypeError("Public arrays cannot contain extra fields");
		return Object.freeze(Array.from({ length: value.length }, (_, index) => {
			const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
			if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new TypeError("Sparse or accessor array");
			return safeData(descriptor.value, depth + 1, maximumItems);
		}));
	}
	if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
		const prototype = value && typeof value === "object" ? Object.getPrototypeOf(value) : null;
		const constructor = prototype ? Object.getOwnPropertyDescriptor(prototype, "constructor") : null;
		const name = constructor && "value" in constructor && typeof constructor.value?.name === "string" ? constructor.value.name : typeof value;
		throw new TypeError(`Public data must be plain serializable data (${name})`);
	}
	const keys = Reflect.ownKeys(value);
	if (keys.length > maximumItems || keys.some((key) => typeof key !== "string")) throw new TypeError("Public record exceeds limits");
	const result = {};
	for (const key of keys) {
		if (key.length > 256) throw new TypeError("Public key exceeds limit");
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new TypeError("Public accessors are forbidden");
		if (descriptor.value !== void 0) Object.defineProperty(result, key, {
			value: safeData(descriptor.value, depth + 1, maximumItems),
			enumerable: true,
			writable: true,
			configurable: true
		});
	}
	return Object.freeze(result);
}
//#endregion
export { __vitePreload as t };

//# sourceMappingURL=index.js.map