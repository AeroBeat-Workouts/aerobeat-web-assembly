// @ts-check

import assert from "node:assert/strict";
import {
  boxingRecipeIds,
  exactGameplayVariant,
  firstUseBoxingRecipeId,
  gameplayRulesetIds,
  readBoxingRecipeIntent,
  readGameplayRulesetIntent,
  rendererPresentationForVariant,
  selectedGameplayProfileId
} from "../src/gameplay-mode-selection.js";

const variants = Object.freeze([
  variant("flow", gameplayRulesetIds.flow, null),
  variant("semantic-row", gameplayRulesetIds.boxingLanes, boxingRecipeIds.balancedHeight),
  variant("spatial-row", gameplayRulesetIds.boxingGrid, boxingRecipeIds.balancedHeight),
  variant("semantic-cut", gameplayRulesetIds.boxingLanes, boxingRecipeIds.sourceHeight),
  variant("spatial-cut", gameplayRulesetIds.boxingGrid, boxingRecipeIds.sourceHeight)
]);

assert.equal(firstUseBoxingRecipeId, boxingRecipeIds.balancedHeight, "Balanced Height is only the neutral first-use experimental default");
const matrix = [
  [gameplayRulesetIds.flow, boxingRecipeIds.balancedHeight, "flow", "flow"],
  [gameplayRulesetIds.flow, boxingRecipeIds.sourceHeight, "flow", "flow"],
  [gameplayRulesetIds.boxingLanes, boxingRecipeIds.balancedHeight, "semantic-row", "boxing_lanes"],
  [gameplayRulesetIds.boxingLanes, boxingRecipeIds.sourceHeight, "semantic-cut", "boxing_lanes"],
  [gameplayRulesetIds.boxingGrid, boxingRecipeIds.balancedHeight, "spatial-row", "boxing_spatial_grid"],
  [gameplayRulesetIds.boxingGrid, boxingRecipeIds.sourceHeight, "spatial-cut", "boxing_spatial_grid"]
];
for (const [rulesetId, recipeId, expectedId, expectedPresentation] of matrix) {
  const selected = exactGameplayVariant(variants, rulesetId, recipeId);
  assert.equal(selected?.variantId, expectedId);
  assert.equal(selectedGameplayProfileId(selected), expectedId);
  assert.equal(rendererPresentationForVariant(selected), expectedPresentation);
}
assert.equal(exactGameplayVariant(variants.slice(0, 4), gameplayRulesetIds.boxingGrid, boxingRecipeIds.sourceHeight), null, "selection never fabricates a missing variant");
assert.equal(readGameplayRulesetIntent({ rulesetId: gameplayRulesetIds.boxingLanes }), gameplayRulesetIds.boxingLanes);
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
console.log("Exact five-variant mode/conversion matrix, retention default, presentation, and scalar privacy validation passed.");

function variant(variantId, rulesetId, recipeId) { return Object.freeze({ variantId, rulesetId, recipeId }); }
