const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.join(__dirname, "..", "..");
const contractPath = path.join(rootDir, "claw-contract.js");
const mcpPermissionsPath = path.join(rootDir, "assets", "mcpPermissions-qqAoJjJ8.js");
const sidepanelPath = path.join(rootDir, "assets", "sidepanel-BoLm9pmH.js");
const optionsPath = path.join(rootDir, "assets", "options-Hyb_OzME.js");
const zhCnPath = path.join(rootDir, "i18n", "zh-CN.json");
const zhTwPath = path.join(rootDir, "i18n", "zh-TW.json");

const contractSource = fs.readFileSync(contractPath, "utf8");
const mcpPermissionsSource = fs.readFileSync(mcpPermissionsPath, "utf8");
const sidepanelSource = fs.readFileSync(sidepanelPath, "utf8");
const optionsSource = fs.readFileSync(optionsPath, "utf8");
const zhCnStrings = JSON.parse(fs.readFileSync(zhCnPath, "utf8"));
const zhTwStrings = JSON.parse(fs.readFileSync(zhTwPath, "utf8"));

function assertIncludes(source, needle, label) {
  assert.equal(source.includes(needle), true, `${label} should include ${needle}`);
}

function extractFunction(source, name) {
  const asyncSignature = `async function ${name}`;
  const signature = `function ${name}`;
  const start = source.indexOf(asyncSignature) >= 0 ? source.indexOf(asyncSignature) : source.indexOf(signature);

  assert.ok(start >= 0, `expected to find ${name}`);

  const parenStart = source.indexOf("(", start);
  assert.ok(parenStart >= 0, `expected ${name} to have parameters`);

  let parenDepth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  let braceStart = -1;

  for (let index = parenStart; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && char === "'" && source[index - 1] !== "\\") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && char === '"' && source[index - 1] !== "\\") {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && char === "`" && source[index - 1] !== "\\") {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) {
      continue;
    }
    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        braceStart = source.indexOf("{", index);
        break;
      }
    }
  }

  assert.ok(braceStart >= 0, `expected ${name} to have a body`);

  let depth = 0;
  inSingle = false;
  inDouble = false;
  inTemplate = false;
  escaped = false;

  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && char === "'" && source[index - 1] !== "\\") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && char === '"' && source[index - 1] !== "\\") {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && char === "`" && source[index - 1] !== "\\") {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) {
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`failed to extract ${name}`);
}

function testContractExposesAutoApproveStorageKey() {
  assertIncludes(
    contractSource,
    "AUTO_APPROVE_ALL_REQUESTS_STORAGE_KEY",
    "contract",
  );
  assertIncludes(
    contractSource,
    '"autoApprovePermissionRequests"',
    "contract",
  );
}

function testBackgroundBundleKeepsAutoApproveShortCircuit() {
  assertIncludes(
    mcpPermissionsSource,
    "__cpAutoApproveAllPermissionRequestsStorageKey",
    "mcp permissions bundle",
  );
  assertIncludes(
    mcpPermissionsSource,
    "auto_approved: true",
    "mcp permissions bundle",
  );
  assertIncludes(
    mcpPermissionsSource,
    'resolution: "auto_approved"',
    "mcp permissions bundle",
  );
}

function testSidepanelBundleKeepsAutoApproveUiHooks() {
  assertIncludes(
    sidepanelSource,
    "const __cpSidepanelPermissionManagerContract =",
    "sidepanel bundle",
  );
  assertIncludes(
    sidepanelSource,
    "__cpSidepanelAutoApproveAllPermissionRequestsStorageKey",
    "sidepanel bundle",
  );
  assertIncludes(
    sidepanelSource,
    "Always auto-approve future permission requests",
    "sidepanel bundle",
  );
  assertIncludes(
    sidepanelSource,
    "Turn on global automatic approval and allow this request now",
    "sidepanel bundle",
  );
  assertIncludes(
    sidepanelSource,
    "const __cpEnableAutoApproveAndAllowCurrentPermission = a.useCallback(async () => {",
    "sidepanel bundle",
  );
}

function testOptionsBundleKeepsAutoApproveSettingsToggle() {
  assertIncludes(
    optionsSource,
    "const __cpOptionsAutoApproveAllPermissionRequestsStorageKey =",
    "options bundle",
  );
  assertIncludes(
    optionsSource,
    "const __cpOptionsLastPermissionModePreferenceStorageKey =",
    "options bundle",
  );
  assertIncludes(
    optionsSource,
    "const __cpHandleOptionsAutoApproveToggle = s.useCallback(",
    "options bundle",
  );
  assertIncludes(
    optionsSource,
    "Automatically approve future permission requests",
    "options bundle",
  );
  assertIncludes(
    optionsSource,
    "Turning this on also sets the default permission mode to skip permission checks.",
    "options bundle",
  );
  assert.equal(
    optionsSource.indexOf("n.jsx(ee, {") <
      optionsSource.indexOf('id: "Ik6gCYf6Og"'),
    true,
    "options bundle should render the permission prompts card below the microphone card",
  );
}

function testChineseLocaleFilesCoverAutoApproveSettingsCopy() {
  const ids = [
    "Ik6gCYf6Og",
    "gJsw6oh4TA",
    "lA0hYw8dJm",
    "PQK4NNXwVt",
    "Rr4v7Xc1iT",
    "BvsF9JQ8oT",
  ];
  for (const id of ids) {
    assert.equal(typeof zhCnStrings[id], "string", `zh-CN should include ${id}`);
    assert.equal(zhCnStrings[id].trim().length > 0, true, `zh-CN ${id} should not be empty`);
    assert.equal(typeof zhTwStrings[id], "string", `zh-TW should include ${id}`);
    assert.equal(zhTwStrings[id].trim().length > 0, true, `zh-TW ${id} should not be empty`);
  }
}

function testEditedFunctionsStillParse() {
  const snSource = extractFunction(mcpPermissionsSource, "Sn");
  const dxSource = extractFunction(sidepanelSource, "dX");

  assert.doesNotThrow(() => {
    new vm.Script(`${snSource}\nSn;`, {
      filename: "permission-auto-approve-sn.js",
    });
    new vm.Script(`${dxSource}\ndX;`, {
      filename: "permission-auto-approve-dx.js",
    });
  }, "edited permission functions should remain syntactically valid");
}

function main() {
  testContractExposesAutoApproveStorageKey();
  testBackgroundBundleKeepsAutoApproveShortCircuit();
  testSidepanelBundleKeepsAutoApproveUiHooks();
  testOptionsBundleKeepsAutoApproveSettingsToggle();
  testChineseLocaleFilesCoverAutoApproveSettingsCopy();
  testEditedFunctionsStillParse();
  console.log("permission auto approve regression test passed");
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
}
