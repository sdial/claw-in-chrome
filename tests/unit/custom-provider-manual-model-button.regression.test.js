const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..", "..");
const sourcePath = path.join(rootDir, "custom-provider-settings.js");

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(
    source,
    /const addModelButton = createNode\("button", "cp-model-action-btn cp-model-action-btn-add [^"]+", strings\.manualAddModelTitle\);/,
    "manual add model button should render the localized manualAddModelTitle text"
  );

  assert.match(
    source,
    /addModelAria: "手动添加模型"/,
    "manual add model button should keep the Chinese accessibility label"
  );

  assert.doesNotMatch(
    source,
    /const addModelButton = createNode\("button", "cp-model-action-btn cp-model-action-btn-add [^"]+", "\+"\);/,
    "manual add model button should no longer render as a plus sign"
  );

  console.log("custom provider manual model button regression test passed");
}

main();
