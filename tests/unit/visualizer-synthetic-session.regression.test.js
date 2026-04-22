const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const bundlePath = path.join(__dirname, "..", "..", "assets", "sidepanel-BoLm9pmH.js");
const source = fs.readFileSync(bundlePath, "utf8");

function main() {
  assert.match(
    source,
    /t\.role !== "user" \|\|[\s\S]*t\._synthetic[\s\S]*t\._syntheticResult[\s\S]*t\.isCompactSummary/,
    "session title builder should skip synthetic and compact summary user messages"
  );
  assert.match(
    source,
    /n\._synthetic[\s\S]*n\._syntheticResult[\s\S]*n\.isCompactSummary[\s\S]*n\.isCompactionMessage/,
    "session preview builder should skip synthetic and compaction messages"
  );
  assert.match(
    source,
    /if \(e\._synthetic === true\) \{\s*s\._synthetic = true;\s*\}/,
    "session serializer should preserve synthetic message flags"
  );
  assert.match(
    source,
    /if \(e\._syntheticResult === true\) \{\s*s\._syntheticResult = true;\s*\}/,
    "session serializer should preserve synthetic result flags"
  );
  console.log("visualizer synthetic session regression test passed");
}

main();
