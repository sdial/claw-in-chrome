const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.join(__dirname, "..", "..");
const sourcePath = path.join(rootDir, "custom-provider-settings.js");
const sidepanelPath = path.join(rootDir, "assets", "sidepanel-BoLm9pmH.js");

function extractSourceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `source should include ${startNeedle}`);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `source should include ${endNeedle}`);
  return source.slice(start, end);
}

function testPromptRulePayloadRoutesByContext(source) {
  const helpersSource = extractSourceBetween(
    source,
    "function normalizePromptRuleScopes",
    "function normalizePromptProfile",
  );
  const { normalizePromptRuleScopes, buildPromptRulePayload } =
    vm.runInNewContext(
      `
        const PROMPT_RULE_CONTEXTS = Object.freeze(["main", "relaxed", "quick"]);
        const DEFAULT_PROMPT_RULE_CONTEXTS = PROMPT_RULE_CONTEXTS.slice();
        const PROMPT_RULE_CONTEXT_SET = new Set(PROMPT_RULE_CONTEXTS);
        ${helpersSource}
        ({ normalizePromptRuleScopes, buildPromptRulePayload });
      `,
      {},
    );

  assert.deepEqual(
    Array.from(normalizePromptRuleScopes([])),
    ["main", "relaxed", "quick"],
    "empty legacy scopes should migrate to every prompt branch",
  );

  const rules = [
    {
      name: "Language & tone",
      prompt: "规则：\n- 始终使用简体中文。",
      scopes: ["main", "quick"],
      enabled: true,
    },
    {
      name: "Relaxed only",
      prompt: "规则：\n- 自动批准时更谨慎。",
      scopes: ["relaxed"],
      enabled: true,
    },
    {
      name: "Disabled",
      prompt: "SHOULD_NOT_BE_SENT",
      scopes: ["main", "relaxed", "quick"],
      enabled: false,
    },
  ];

  const mainPayload = buildPromptRulePayload(rules, "main");
  assert.match(mainPayload, /<claw_user_rules context="main">/);
  assert.match(mainPayload, /name="Language &amp; tone"/);
  assert.match(mainPayload, /scopes="main,quick"/);
  assert.match(mainPayload, /始终使用简体中文/);
  assert.doesNotMatch(mainPayload, /自动批准时更谨慎/);
  assert.doesNotMatch(mainPayload, /SHOULD_NOT_BE_SENT/);

  const relaxedPayload = buildPromptRulePayload(rules, "relaxed");
  assert.match(relaxedPayload, /<claw_user_rules context="relaxed">/);
  assert.match(relaxedPayload, /自动批准时更谨慎/);
  assert.doesNotMatch(relaxedPayload, /始终使用简体中文/);

  const quickPayload = buildPromptRulePayload(rules, "quick");
  assert.match(quickPayload, /<claw_user_rules context="quick">/);
  assert.match(quickPayload, /始终使用简体中文/);
  assert.doesNotMatch(quickPayload, /自动批准时更谨慎/);
}

function testPromptRuleSettingsAnchors(source) {
  assert.match(
    source,
    /const PROMPT_RULE_CONTEXTS = Object\.freeze\(\["main", "relaxed", "quick"\]\);/,
    "settings should define the three rule carry contexts",
  );

  assert.match(
    source,
    /current\.systemPrompt = mainPrompt;[\s\S]*current\.relaxedSystemPrompt = relaxedPrompt;[\s\S]*current\.quickSystemPrompt = quickPrompt;/,
    "settings should persist separate rule payloads for normal, relaxed, and quick branches",
  );

  assert.match(
    source,
    /const PROMPT_BASE_PROMPT_FIELDS = Object\.freeze\(\{[\s\S]*main: "baseSystemPrompt",[\s\S]*relaxed: "relaxedBaseSystemPrompt",[\s\S]*quick: "quickBaseSystemPrompt",[\s\S]*\}\);/,
    "settings should store built-in prompt overrides separately from rule payload fields",
  );

  assert.match(
    source,
    /async function readPromptBasePromptState\(\)[\s\S]*normalizePromptBaseOverrides\(record\)/,
    "settings should read built-in prompt override state from the shared prompt record",
  );

  assert.match(
    source,
    /function getPromptBaseDefinitions\(\)[\s\S]*promptBuiltInMainName[\s\S]*promptBuiltInRelaxedName[\s\S]*promptBuiltInQuickName/,
    "settings should render the three built-in prompts as first-class editable cards",
  );

  assert.match(
    source,
    /promptBuiltInPlatformName[\s\S]*promptBuiltInTurnAnswerName[\s\S]*promptBuiltInMultipleTabsName[\s\S]*promptBuiltInStatusName[\s\S]*promptBuiltInConversationTitleName[\s\S]*promptBuiltInShortcutNameName[\s\S]*promptBuiltInWorkflowStepName[\s\S]*promptBuiltInWorkflowSummaryName[\s\S]*promptBuiltInCompactionSystemName[\s\S]*promptBuiltInScheduledTaskName/,
    "settings should define editable runtime add-on and internal task prompt slots, not only the three main branches",
  );

  assert.match(
    source,
    /function getRenderablePromptBaseDefinitions\(\) \{[\s\S]*definition\.editable === false[\s\S]*return false;[\s\S]*getPromptBaseEffectivePrompt\(definition\.id\)\.trim\(\)/,
    "built-in prompt cards should hide read-only slots and slots whose effective preview content is empty",
  );

  assert.match(
    source,
    /function renderPromptProfileCards\(\)[\s\S]*getRenderablePromptBaseDefinitions\(\)\.forEach/,
    "settings should render only visible built-in prompt definitions",
  );

  assert.match(
    source,
    /function renderPromptProfileCards\(\)[\s\S]*const profiles = getRenderablePromptProfiles\(\);[\s\S]*promptEmptyState\.hidden = false;[\s\S]*const builtInHeader = createNode/,
    "empty user-rule state should appear in the rule section before the built-in prompt section",
  );

  assert.match(
    source,
    /const builtInHeader = createNode\([\s\S]*cp-provider-toolbar-copy cp-prompt-section-header[\s\S]*"h3",[\s\S]*cp-page-heading text-text-100 font-xl-bold/,
    "built-in prompt section heading should reuse the same heading size as the rule-add page header",
  );

  assert.match(
    source,
    /\.cp-prompt-empty \{[\s\S]*padding-block: 1\.5rem;[\s\S]*const promptEmptyState = createNode\("div", "cp-provider-empty cp-prompt-empty"\);/,
    "empty user-rule notice should use explicit balanced vertical padding",
  );

  assert.match(
    source,
    /function getRenderablePromptProfiles\(\) \{\s*return promptProfilesState\.profiles\.slice\(\);\s*\}/,
    "user rule cards should not masquerade the built-in base prompt as a user rule",
  );

  assert.match(
    source,
    /const DEFAULT_WORKFLOW_SUMMARY_PROMPT =[\s\S]*EXAMPLES:[\s\S]*BAD OUTPUTS \(too specific - DO NOT DO THIS\):[\s\S]*Remember: The workflow should be reusable with DIFFERENT inputs each time\./,
    "settings workflow-summary default should mirror the full sidepanel runtime prompt",
  );

  assert.match(
    source,
    /const addProfileButton = createNode\([\s\S]*strings\.newProfile,[\s\S]*listButtonRow\.appendChild\(addProfileButton\);/,
    "model provider add button should keep the provider-profile label",
  );

  assert.match(
    source,
    /const addPromptProfileButton = createNode\([\s\S]*strings\.promptNewRule,[\s\S]*promptHeaderButtons\.appendChild\(addPromptProfileButton\);/,
    "rule-injection add button should use the rule label",
  );

  assert.match(
    source,
    /function openPromptBuiltinEditor\(context\)[\s\S]*promptProfilesState\.editingBuiltinPromptId = normalizedContext;[\s\S]*getPromptBaseEffectivePrompt\(normalizedContext\)/,
    "built-in prompt cards should open an editor seeded with the effective base prompt",
  );

  assert.match(
    source,
    /async function handleRestorePromptBasePrompt\(context\)[\s\S]*restorePromptBasePromptOverride\(context\)/,
    "built-in prompt cards should be able to restore the bundled default",
  );

  assert.match(
    source,
    /promptNameField\.hidden = isEditingBuiltin;[\s\S]*promptScopeField\.hidden = isEditingBuiltin;[\s\S]*promptTextareaLabel\.textContent = strings\.agentRoleLabel;[\s\S]*promptTextareaLabel\.hidden = isEditingBuiltin;/,
    "built-in prompt editing should reuse the prompt editor while hiding rule-only fields and the rule label",
  );

  assert.doesNotMatch(
    source,
    /promptTextareaLabel\.textContent = isEditingBuiltin[\s\S]*strings\.promptBuiltInPromptLabel/,
    "built-in prompt editor should not render a duplicate small built-in prompt override label",
  );

  assert.match(
    source,
    /\.cp-prompt-header\[data-mode="edit"\] \.cp-page-subheading \{[\s\S]*margin-right: 0;[\s\S]*promptHeader\.dataset\.mode = isEditing \? "edit" : "list";/,
    "rule editor header subtitle should use the full width when the add button is hidden",
  );

  assert.match(
    source,
    /promptTextareaHelp\.textContent = isEditingBuiltin[\s\S]*: "";[\s\S]*promptTextareaHelp\.hidden = !isEditingBuiltin;[\s\S]*promptTextarea\.placeholder = "";/,
    "rule body editor should not show helper or placeholder text under the rule label",
  );

  assert.match(
    source,
    /const promptNameInput = createNode\([\s\S]*`cp-page-input \$\{SHARED_FRAME_CLASS\}`[\s\S]*promptNameInput\.placeholder = "";/,
    "rule name input should not show placeholder helper text",
  );

  assert.match(
    source,
    /const promptScopeInputs = \{\};[\s\S]*input\.type = "checkbox";[\s\S]*promptScopeInputs\[entry\[0\]\] = input;/,
    "settings UI should render checkbox scopes for rule carry contexts",
  );

  assert.match(
    source,
    /\.cp-prompt-scope-option \{[\s\S]*transition: background-color 0\.15s ease;[\s\S]*const option = createNode\([\s\S]*`cp-prompt-scope-option \$\{SHARED_FRAME_CLASS\}`/,
    "rule scope checkbox cards should use the same shared frame border as other controls",
  );

  assert.match(
    source,
    /async function handleActivatePromptProfile\(profileId, enabled\)[\s\S]*setActivePromptProfile\([\s\S]*enabled,\s*\);/,
    "rule enable and disable buttons should pass the intended target state",
  );

  assert.match(
    source,
    /Rule:\\n- Always answer in Simplified Chinese\.[\s\S]*Applies when:[\s\S]*Requirements:[\s\S]*Exceptions:/,
    "rule editor should guide users to write rules in a stable structured format",
  );
}

function testSidepanelPromptRuleBranches() {
  const source = fs.readFileSync(sidepanelPath, "utf8");

  assert.match(
    source,
    /function __cpUseChromeStorageValue\(e, t\)[\s\S]*y\(e, t\)[\s\S]*chrome\.storage\.onChanged\.addListener\(r\)/,
    "sidepanel should read prompt records from chrome.storage.local and subscribe to storage changes",
  );

  assert.match(
    source,
    /const e = __cpUseChromeStorageValue\(__cpSidepanelStorageKeySystemPrompt, __cpStableEmptyObject\);[\s\S]*const t = __cpUseChromeStorageValue\(__cpSidepanelStorageKeySkipPermissionsSystemPrompt, __cpStableEmptyObject\);/,
    "normal chat prompt records should come from extension storage rather than feature defaults",
  );

  assert.doesNotMatch(
    source,
    /const e = g\(__cpSidepanelStorageKeySystemPrompt, __cpStableEmptyObject\);/,
    "normal chat must not read saved prompt rules through the feature flag hook",
  );

  assert.match(
    source,
    /const __cpHasRuleRecord = Array\.isArray\(e\.rules\);[\s\S]*const __cpMainRulePrompt = typeof e\.systemPrompt == "string"[\s\S]*const __cpRelaxedRulePrompt = typeof e\.relaxedSystemPrompt == "string"/,
    "sidepanel normal chat should detect rule records and split main vs relaxed rule payloads",
  );

  assert.match(
    source,
    /const __cpMainBasePrompt = typeof e\.baseSystemPrompt == "string"[\s\S]*const o = __cpHasRuleRecord \? \[__cpMainBasePrompt, __cpMainRulePrompt\]/,
    "sidepanel normal chat should prepend the editable built-in base prompt before enabled rules",
  );

  assert.match(
    source,
    /const __cpRelaxedBasePrompt = typeof e\.relaxedBaseSystemPrompt == "string"[\s\S]*t\.skipPermissionsSystemPrompt[\s\S]*__cpFallbackSkipPermissionsSystemPrompt/,
    "sidepanel relaxed mode should prefer the editable built-in override before the legacy relaxed prompt",
  );

  assert.match(
    source,
    /quickSystemPrompt: typeof e\.quickSystemPrompt == "string"[\s\S]*\[e\.baseSystemPrompt, e\.relaxedBaseSystemPrompt,[\s\S]*e\.systemPrompt, e\.relaxedSystemPrompt, e\.quickSystemPrompt, e\.rules/,
    "sidepanel prompt memo should expose quick rule payloads and refresh when base overrides change",
  );

  assert.match(
    source,
    /const __cpQuickRulePromptRecord = __cpUseChromeStorageValue\(__cpSidepanelStorageKeySystemPrompt, __cpStableEmptyObject\);[\s\S]*text: __cpQuickRulePrompt/,
    "quick mode should append quickSystemPrompt from the shared rule storage record",
  );

  assert.match(
    source,
    /typeof __cpQuickRulePromptRecord\.quickBaseSystemPrompt == "string"[\s\S]*__cpQuickRulePromptRecord\.quickBaseSystemPrompt[\s\S]*r\?\.systemPrompt \|\| B/,
    "quick mode should prefer the editable quick built-in prompt before PURL legacy prompt sources",
  );

  assert.match(
    source,
    /platformInfoPrompt[\s\S]*turnAnswerStartPrompt[\s\S]*__cpFallbackPlatformInfoPrompt[\s\S]*__cpFallbackTurnAnswerStartPrompt/,
    "normal chat should expose editable platform and answer-start prompt blocks",
  );

  [
    "statusPrompt",
    "conversationTitlePrompt",
    "shortcutNamePrompt",
    "workflowStepPrompt",
    "workflowSummaryPrompt",
    "compactionSystemPrompt",
    "scheduledTaskPrompt",
  ].forEach((field) => {
    assert.match(
      source,
      new RegExp(`__cpReadBuiltInPromptOverride\\("${field}"\\)`),
      `internal model task should consume ${field}`,
    );
  });
}

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(
    source,
    /const uiContract = rootContract\.ui \|\| \{\};/,
    "custom provider settings should read the shared UI contract"
  );

  assert.match(
    source,
    /const PREFERRED_LOCALE_STORAGE_KEY =\s*uiContract\.PREFERRED_LOCALE_STORAGE_KEY \|\| "preferred_locale";/s,
    "custom provider settings should use the shared preferred locale storage key"
  );

  assert.match(
    source,
    /async function readStoredPreferredUiLocaleKey\(\) \{/,
    "custom provider settings should load the preferred locale from storage before rendering"
  );

  assert.match(
    source,
    /function getUiLocaleKey\(\) \{\s*return preferredUiLocaleKey \|\| detectDocumentUiLocaleKey\(\);\s*\}/s,
    "custom provider settings should prioritize the stored preferred locale and only fall back to document detection"
  );

  assert.match(
    source,
    /document\?\.documentElement\?\.dataset\?\.cpUiLocale/,
    "custom provider settings should honor the explicit options page locale marker before guessing from browser language"
  );

  assert.match(
    source,
    /resolveCustomI18nSection\(\s*"customProvider",/s,
    "custom provider settings should load its copy from the custom language pack section"
  );

  assert.match(
    source,
    /if \(\s*PREFERRED_LOCALE_STORAGE_KEY in changes &&\s*applyPreferredUiLocaleKey\(\s*changes\[PREFERRED_LOCALE_STORAGE_KEY\]\?\.newValue,\s*\)\s*\) \{\s*scheduleUiRebuild\(\);\s*return;\s*\}/s,
    "preferred locale changes should trigger a full UI rebuild"
  );

  assert.match(
    source,
    /async function bootstrapUi\(\) \{[\s\S]*applyPreferredUiLocaleKey\(await readStoredPreferredUiLocaleKey\(\)\);[\s\S]*await buildUiForCurrentLocale\(\);/s,
    "bootstrap should resolve the preferred locale before the first render"
  );

  assert.match(
    source,
    /window\.addEventListener\("cp:ui-locale-changed", handleExternalUiLocaleChanged\);/,
    "custom provider settings should listen for explicit options locale change events"
  );

  assert.match(
    source,
    /scheduleDeferredUiLocaleCheck\(20\);/,
    "custom provider settings should probe for a late-resolved locale after bootstrap to avoid mixed-language first paint"
  );

  assert.doesNotMatch(
    source,
    /document\.addEventListener\("DOMContentLoaded", buildUi, \{\s*once: true\s*\}\);/s,
    "custom provider settings should no longer render immediately on DOMContentLoaded without loading the preferred locale first"
  );

  testPromptRulePayloadRoutesByContext(source);
  testPromptRuleSettingsAnchors(source);
  testSidepanelPromptRuleBranches();

  console.log("custom provider locale regression test passed");
}

main();
