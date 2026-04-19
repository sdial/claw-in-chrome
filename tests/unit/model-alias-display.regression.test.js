const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..", "..");
const storageChunkPath = path.join(rootDir, "assets", "useStorageState-hbwNMVUA.js");
const sidepanelBundlePath = path.join(rootDir, "assets", "sidepanel-BoLm9pmH.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assertMatches(source, pattern, label) {
  assert.match(source, pattern, label);
}

function testModelsConfigReaderSupportsValueLabelAliases() {
  const source = read(storageChunkPath);
  assertMatches(source, /function __cpNormalizeModelsConfigOptionEntry\(e, t = \{\}\) \{[\s\S]*?String\(e\?\.model \|\| e\?\.value \|\| ""\)\.trim\(\)/, "models config reader should normalize value/model ids");
  assertMatches(source, /name: r \|\| EU\(n, t\)/, "models config reader should normalize label/name aliases");
  assertMatches(source, /const O = \(R\?\.options \|\| \[\]\)\.map\(e => __cpNormalizeModelsConfigOptionEntry\(e, R \|\| \{\}\)\)\.filter\(Boolean\);/, "scheduler model selector should reuse normalized alias entries");
}

function testSidepanelNormalizesAliasOptionsBeforeBootstrap() {
  const source = read(sidepanelBundlePath);
  assertMatches(source, /function __cpNormalizeSelectableModelOption\(e, t\) \{[\s\S]*?String\(e\?\.model \|\| e\?\.value \|\| ""\)\.trim\(\)/, "sidepanel should normalize value/model ids");
  assertMatches(source, /name: String\(e\?\.name \|\| e\?\.label \|\| s\)\.trim\(\) \|\| s/, "sidepanel should normalize label/name aliases");
  assertMatches(source, /const __cpNormalizedAvailableModelOptions = a\.useMemo\(\(\) => __cpNormalizeSelectableModelOptions\(__cpResolvedModelConfig\.options, __cpResolvedModelConfig\), \[__cpResolvedModelConfig\]\);/, "sidepanel should normalize options before sticky model bootstrap");
  assertMatches(source, /modelConfig: \{\s*\.\.\.__cpResolvedModelConfig,\s*options: __cpNormalizedAvailableModelOptions\s*\}/, "sidepanel should expose normalized options to the dropdown");
}

function main() {
  testModelsConfigReaderSupportsValueLabelAliases();
  testSidepanelNormalizesAliasOptionsBeforeBootstrap();
  console.log("model alias display regression tests passed");
}

main();
