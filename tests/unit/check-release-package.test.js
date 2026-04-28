const assert = require("node:assert/strict");

const {
  getTemplateLiteralDependencyTarget,
  scanJavaScriptDependencies
} = require("../../scripts/check-release-package.js");

function collectJavaScriptDependencies(source, fromFile = "assets/example.js") {
  const dependencyMap = new Map();
  scanJavaScriptDependencies(source, fromFile, dependencyMap);
  return new Set([...dependencyMap.keys()].sort());
}

function testTemplateLiteralDependencyTargetFallsBackToStableFileOrDirectory() {
  assert.equal(
    getTemplateLiteralDependencyTarget("options.html#permissions?requestMicrophone=true&returnTabId=${tabId}"),
    "options.html",
    "template literals with hash/query should still resolve to the underlying file"
  );
  assert.equal(
    getTemplateLiteralDependencyTarget("i18n/${locale}.json"),
    "i18n",
    "template literals with dynamic leaf names should fall back to the containing directory"
  );
  assert.equal(
    getTemplateLiteralDependencyTarget("./chunks/${chunkId}.js"),
    "./chunks",
    "relative template literals should keep enough static prefix to require the containing directory"
  );
}

function testScanJavaScriptDependenciesFindsDynamicImportsAndTemplateRuntimeUrls() {
  const dependencies = collectJavaScriptDependencies(`
    await import("./index-umd.js");
    const panelUrl = chrome.runtime.getURL(\`options.html#permissions?requestMicrophone=true&returnTabId=\${tabId}\`);
    const localeUrl = chrome.runtime.getURL(\`i18n/\${locale}.json\`);
    const chunkUrl = chrome.runtime.getURL(\`assets/\${chunkName}.js\`);
    const worker = new Worker("./workers/encoder.js");
    const namedWorker = new SharedWorker(\`./workers/\${workerName}.js\`);
  `);

  assert.deepEqual(
    [...dependencies],
    [
      "assets",
      "assets/index-umd.js",
      "assets/workers",
      "assets/workers/encoder.js",
      "i18n",
      "options.html"
    ].sort(),
    "scanner should retain dynamic runtime dependencies that can only be validated at directory granularity"
  );
}

function main() {
  testTemplateLiteralDependencyTargetFallsBackToStableFileOrDirectory();
  testScanJavaScriptDependenciesFindsDynamicImportsAndTemplateRuntimeUrls();
  console.log("check release package tests passed");
}

main();
