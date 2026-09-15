// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("../..", import.meta.url).pathname);

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

// 0.0.54 W2 supportedRecipeIds audit — assembly side:
//   (a) service-graph.js constructs createAeroContentRuntime with ONLY a
//       persistenceResolver — NO supportedRecipeIds/supportedRulesetIds option
//       is ever passed from the assembly (verified structurally below against
//       every call site in src/);
//   (b) the rebaselined 3C9D successor fixture (aerobeat-web-content/fixtures/
//       flow-colliders-3c9d-successor-v1.json) is the new-shape reference:
//       its raw chart omits any recipe identity on the collider mode and
//       carries no other boxing chart, and exactGameplayVariant resolves the
//       collider variant from that shape.
//   The c66a7de content-runtime `supportedRecipeIds` skip for
//   boxing_collider_v1 variants lives in the content repo (its own oracle set);
//   combining (a)+(b)+that, the no-recipe collider variant is both accepted by
//   the real runtime and resolvable by selectGameplayAxes for BOTH shapes.
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const callSites = [];
  const walkTree = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walkTree(full); else if (/\.js$/u.test(entry.name)) callSites.push({ file: full, source: fs.readFileSync(full, "utf8") }); } };
  walkTree(path.resolve(new URL("..", import.meta.url).pathname, "src"));
  const constructCalls = callSites.filter(({ source }) => source.includes("createAeroContentRuntime(")).map(({ file, source }) => ({ file, source: source.slice(source.indexOf("createAeroContentRuntime("), source.indexOf("createAeroContentRuntime(") + 2000) }));
  assert.ok(constructCalls.length >= 1, "service graph constructs the content runtime");
  for (const { file, source } of constructCalls) {
    assert.doesNotMatch(source, /supportedRecipeIds|supportedRulesetIds/u, `${file}: assembly must not pass restrictive recipe/ruleset restriction options into createAeroContentRuntime`);
  }
  const fixture = JSON.parse(readFileSync(resolve(repoRoot, "aerobeat-web-content", "fixtures", "flow-colliders-3c9d-successor-v1.json"), "utf8"));
  const charts = Array.isArray(fixture.package.charts) ? fixture.package.charts : [];
  const colliderChart = charts.find((chart) => chart.mode === "boxing");
  assert.ok(colliderChart, "new-shape successor fixture carries the boxing (collider) chart");
  assert.equal(colliderChart.recipeId, undefined, "the raw collider chart omits the recipeId key entirely (no recipe identity authored)");
  assert.equal(charts.filter((chart) => chart.mode === "boxing").length, 1, "the new-shape package carries exactly one boxing chart (sole boxing_collider_v1 variant; no Lanes/Grid pair)");
  const projectionVariants = [
    Object.freeze({ variantId: "fixture-flow", rulesetId: "flow_colliders_v1", recipeId: null }),
    Object.freeze({ variantId: "fixture-boxing-collider", rulesetId: "boxing_collider_v1" })
  ];
  const target = exactGameplayVariant(projectionVariants, gameplayRulesetIds.boxingCollider, null);
  assert.equal(target?.variantId, "fixture-boxing-collider", "selectGameplayAxes resolution picks the sole no-recipe collider variant for a new-import package shape");
}

console.log("Exact z2tx five-resolved-variant matrix (two visible + three hidden storage modes) with scalar privacy validation + 0.0.54 supportedRecipeIds audit / new-shape collider selection passed.");

function variant(variantId, rulesetId, recipeId) { return Object.freeze({ variantId, rulesetId, recipeId }); }
