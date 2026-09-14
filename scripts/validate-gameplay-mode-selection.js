// @ts-check

import assert from "node:assert/strict";
import {
  boxingGameplayRulesetIds,
  boxingRecipeIds,
  exactGameplayVariant,
  firstUseBoxingRecipeId,
  gameplayRulesetIds,
  hiddenBoxingGameplayRulesetIds,
  readBoxingRecipeIntent,
  readGameplayRulesetIntent,
  rendererPresentationForVariant,
  selectedGameplayProfileId,
  visibleGameplayRulesetIds
} from "../src/gameplay-mode-selection.js";

const variants = Object.freeze([
  variant("flow", gameplayRulesetIds.flow, null),
  variant("boxing", gameplayRulesetIds.boxingCollider, null),
  variant("semantic-row", gameplayRulesetIds.boxingLanes, boxingRecipeIds.balancedHeight),
  variant("spatial-row", gameplayRulesetIds.boxingGrid, boxingRecipeIds.balancedHeight),
  variant("semantic-cut", gameplayRulesetIds.boxingLanes, boxingRecipeIds.sourceHeight),
  variant("spatial-cut", gameplayRulesetIds.boxingGrid, boxingRecipeIds.sourceHeight)
]);

// z2tx: exactly two visible product modes (Flow + Boxing collider); the legacy
// Lanes/Grid rulesets are hidden but still resolvable for stored packages.
assert.deepEqual(visibleGameplayRulesetIds, [gameplayRulesetIds.flow, gameplayRulesetIds.boxingCollider], "visible modes are exactly Flow and Boxing");
assert.deepEqual(hiddenBoxingGameplayRulesetIds, [gameplayRulesetIds.boxingLanes, gameplayRulesetIds.boxingGrid], "hidden legacy modes are exactly Lanes + Grid");
assert.deepEqual(boxingGameplayRulesetIds, [gameplayRulesetIds.boxingCollider, gameplayRulesetIds.boxingLanes, gameplayRulesetIds.boxingGrid], "all boxing resolvable modes = collider + hidden pair");

assert.equal(firstUseBoxingRecipeId, boxingRecipeIds.balancedHeight, "Balanced Height is only the neutral first-use experimental default");
const matrix = [
  [gameplayRulesetIds.flow, null, "flow", "flow"],
  [gameplayRulesetIds.boxingCollider, null, "boxing", "boxing_collider"],
  [gameplayRulesetIds.boxingLanes, boxingRecipeIds.balancedHeight, "semantic-row", "boxing_lanes"],
  [gameplayRulesetIds.boxingLanes, boxingRecipeIds.sourceHeight, "semantic-cut", "boxing_lanes"],
  [gameplayRulesetIds.boxingGrid, boxingRecipeIds.balancedHeight, "spatial-row", "boxing_spatial_grid"],
  [gameplayRulesetIds.boxingGrid, boxingRecipeIds.sourceHeight, "spatial-cut", "boxing_spatial_grid"]
];
for (const [rulesetId, recipeId, expectedId, expectedPresentation] of matrix) {
  const selected = exactGameplayVariant(variants, rulesetId, recipeId);
  assert.ok(selected?.variantId, `${rulesetId} resolves an authored variant`);
  assert.equal(selected.variantId, expectedId, `${rulesetId}+${recipeId} → profile ${expectedId}`);
  assert.equal(selectedGameplayProfileId(selected), expectedId, `${selected.variantId} maps back to profile ID ${expectedId}`);
  assert.equal(rendererPresentationForVariant(selected), expectedPresentation, `${selected.variantId} maps to presentation ${expectedPresentation}`);
}
// The new Boxing collider mode resolves on ruleset alone regardless of any supplied
// recipe (single-variant packages carry no conversion recipe).
assert.equal(exactGameplayVariant(variants, gameplayRulesetIds.boxingCollider, boxingRecipeIds.balancedHeight)?.variantId, "boxing", "boxing collider resolution ignores any retained recipe");
assert.equal(exactGameplayVariant(variants.filter((entry) => entry.variantId !== "spatial-cut"), gameplayRulesetIds.boxingGrid, boxingRecipeIds.sourceHeight), null, "selection never fabricates a missing variant");
assert.throws(() => readGameplayRulesetIntent({ rulesetId: "flow_grid_v2" }), /invalid/u, "the retired Flow Grid ID is no longer an accepted selection intent");
assert.equal(readGameplayRulesetIntent({ rulesetId: gameplayRulesetIds.flow }), gameplayRulesetIds.flow);
assert.equal(readGameplayRulesetIntent({ rulesetId: gameplayRulesetIds.boxingCollider }), gameplayRulesetIds.boxingCollider, "the Boxing collider ID is an accepted selection intent");
assert.equal(readGameplayRulesetIntent({ rulesetId: gameplayRulesetIds.boxingLanes }), gameplayRulesetIds.boxingLanes, "hidden Lanes ID still resolvable for stored-package playback");
assert.equal(exactGameplayVariant(variants.filter((entry) => entry.variantId !== "flow"), gameplayRulesetIds.flow, null), null, "Flow selection never synthesizes a missing variant");
assert.equal(readBoxingRecipeIntent({ recipeId: boxingRecipeIds.sourceHeight }), boxingRecipeIds.sourceHeight);
for (const hostile of [
  { rulesetId: gameplayRulesetIds.flow, recipeId: boxingRecipeIds.balancedHeight },
  Object.create({ rulesetId: gameplayRulesetIds.flow }),
  Object.assign(Object.create(null), { rulesetId: gameplayRulesetIds.flow }),
  { rulesetId: "semantic-row" }
]) assert.throws(() => readGameplayRulesetIntent(hostile), /invalid/u);
let getterCalls = 0; const accessor = {}; Object.defineProperty(accessor, "recipeId", { enumerable: true, get() { getterCalls += 1; return boxingRecipeIds.balancedHeight; } });
assert.throws(() => readBoxingRecipeIntent(accessor), /invalid/u); assert.equal(getterCalls, 0, "scalar intent validation never executes accessors");
assert.throws(() => readBoxingRecipeIntent({ recipeId: boxingRecipeIds.balancedHeight, bundle: { private: true } }), /invalid/u, "objects cannot cross the scalar UI boundary");
console.log("Exact z2tx five-resolved-variant matrix (two visible + three hidden storage modes) with scalar privacy validation passed.");

function variant(variantId, rulesetId, recipeId) { return Object.freeze({ variantId, rulesetId, recipeId }); }
