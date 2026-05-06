const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..", "..");
const contractPath = path.join(rootDir, "claw-contract.js");
const settingsPath = path.join(rootDir, "custom-provider-settings.js");
const optionsEnhancerPath = path.join(rootDir, "options-update-enhancer.js");
const permissionManagerPath = path.join(
  rootDir,
  "assets",
  "PermissionManager-9s959502.js",
);
const sidepanelPath = path.join(rootDir, "assets", "sidepanel-BoLm9pmH.js");
const sidepanelLoggerPath = path.join(rootDir, "sidepanel-debug-logger.js");
const zhCustomI18nPath = path.join(rootDir, "i18n", "custom", "zh-CN.js");
const zhTwCustomI18nPath = path.join(rootDir, "i18n", "custom", "zh-TW.js");

function main() {
  const contractSource = fs.readFileSync(contractPath, "utf8");
  const settingsSource = fs.readFileSync(settingsPath, "utf8");
  const optionsEnhancerSource = fs.readFileSync(optionsEnhancerPath, "utf8");
  const permissionManagerSource = fs.readFileSync(permissionManagerPath, "utf8");
  const sidepanelSource = fs.readFileSync(sidepanelPath, "utf8");
  const sidepanelLoggerSource = fs.readFileSync(sidepanelLoggerPath, "utf8");
  const zhCustomI18nSource = fs.readFileSync(zhCustomI18nPath, "utf8");
  const zhTwCustomI18nSource = fs.readFileSync(zhTwCustomI18nPath, "utf8");

  assert.match(
    contractSource,
    /DEBUG_MODE_STORAGE_KEY:\s*"debugMode"/,
    "shared contract should expose the debug mode storage key",
  );

  assert.match(
    contractSource,
    /SHOW_TRACE_IDS_STORAGE_KEY:\s*"showTraceIds"/,
    "shared contract should expose the trace ID storage key",
  );

  assert.match(
    contractSource,
    /SHOW_SYSTEM_REMINDERS_STORAGE_KEY:\s*"showSystemReminders"/,
    "shared contract should expose the system reminders storage key",
  );

  assert.match(
    contractSource,
    /INCOGNITO_MODE_STORAGE_KEY:\s*"incognitoMode"/,
    "shared contract should expose the incognito mode storage key",
  );

  assert.match(
    settingsSource,
    /const DEBUG_MODE_STORAGE_KEY =\s*uiContract\.DEBUG_MODE_STORAGE_KEY \|\|\s*"debugMode";/s,
    "settings page should read the shared debug mode storage key",
  );

  assert.match(
    settingsSource,
    /const SHOW_TRACE_IDS_STORAGE_KEY =\s*uiContract\.SHOW_TRACE_IDS_STORAGE_KEY \|\|\s*"showTraceIds";/s,
    "settings page should read the shared trace IDs storage key",
  );

  assert.match(
    settingsSource,
    /const SHOW_SYSTEM_REMINDERS_STORAGE_KEY =\s*uiContract\.SHOW_SYSTEM_REMINDERS_STORAGE_KEY \|\|\s*"showSystemReminders";/s,
    "settings page should read the shared system reminders storage key",
  );

  assert.doesNotMatch(
    settingsSource,
    /INCOGNITO_MODE_STORAGE_KEY/,
    "custom provider settings should no longer own the incognito mode switch",
  );

  assert.match(
    optionsEnhancerSource,
    /const INCOGNITO_MODE_STORAGE_KEY =\s*uiContract\.INCOGNITO_MODE_STORAGE_KEY \|\|\s*"incognitoMode";/s,
    "options enhancer should read the shared incognito mode storage key",
  );

  assert.match(
    optionsEnhancerSource,
    /const INCOGNITO_PANEL_ID = "cp-options-incognito-mode-panel";/,
    "options enhancer should reserve a standalone incognito mode panel",
  );

  assert.match(
    settingsSource,
    /debugTitle:\s*"Developer \/ debug"/,
    "settings page should expose a dedicated developer/debug section title",
  );

  assert.match(
    settingsSource,
    /traceIdsTitle:\s*"Show trace IDs"/,
    "settings page should define a trace IDs toggle label",
  );

  assert.match(
    settingsSource,
    /systemRemindersTitle:\s*"Show system reminders"/,
    "settings page should define a system reminders toggle label",
  );

  assert.match(
    optionsEnhancerSource,
    /incognitoCardTitle:\s*"Incognito mode"[\s\S]*incognitoCardSubtitle:\s*"Each chat starts without previous context and is never written to local history\."[\s\S]*incognitoToggleHelp:\s*"Useful when questions keep changing: avoid sending irrelevant prior context to save tokens\."/,
    "options enhancer should explain no previous context, no local history, and token savings",
  );

  assert.doesNotMatch(
    settingsSource,
    /debugStack\.appendChild\(debugModeRow\);/,
    "settings page should no longer surface a manual debug mode row",
  );

  assert.match(
    settingsSource,
    /const traceIdsToggle = createNode\(\s*"button",\s*"cp-page-toggle cp-update-enhancer-toggle",\s*\);/s,
    "settings page should render the trace IDs switch with the shared toggle styling",
  );

  assert.match(
    settingsSource,
    /const systemRemindersToggle = createNode\(\s*"button",\s*"cp-page-toggle cp-update-enhancer-toggle",\s*\);/s,
    "settings page should render the system reminders switch with the shared toggle styling",
  );

  assert.match(
    optionsEnhancerSource,
    /function renderIncognitoPanel\(panel\) \{[\s\S]*toggle\.className = "cp-page-toggle cp-update-enhancer-toggle";/s,
    "options enhancer should render the incognito mode switch with the shared toggle styling",
  );

  assert.match(
    settingsSource,
    /const createToggleMetaNode = function \(\) \{[\s\S]*metaNode\.hidden = true;[\s\S]*metaNode\.setAttribute\("aria-hidden", "true"\);[\s\S]*return metaNode;[\s\S]*\};/s,
    "settings page should create hidden toggle meta nodes so the row no longer shows enabled or disabled text",
  );

  assert.match(
    settingsSource,
    /function renderDebugToggle\(metaNode, toggleNode, enabled, pending\) \{[\s\S]*metaNode\.textContent = "";[\s\S]*metaNode\.hidden = true;[\s\S]*metaNode\.setAttribute\("aria-hidden", "true"\);/s,
    "settings page should keep toggle status copy hidden during re-renders",
  );

  assert.match(
    settingsSource,
    /if \(stored\[DEBUG_MODE_STORAGE_KEY\] !== true\) \{[\s\S]*\[DEBUG_MODE_STORAGE_KEY\]: true,/s,
    "settings page should auto-correct the persisted debug mode flag to true",
  );

  assert.match(
    settingsSource,
    /storageKey:\s*SHOW_TRACE_IDS_STORAGE_KEY/,
    "settings page should persist the trace IDs preference",
  );

  assert.match(
    settingsSource,
    /storageKey:\s*SHOW_SYSTEM_REMINDERS_STORAGE_KEY/,
    "settings page should persist the system reminders preference",
  );

  assert.match(
    optionsEnhancerSource,
    /chrome\.storage\.local\.set\(\{[\s\S]*\[INCOGNITO_MODE_STORAGE_KEY\]: nextEnabled,/s,
    "options enhancer should persist the incognito mode preference",
  );

  assert.match(
    settingsSource,
    /DEBUG_MODE_STORAGE_KEY in changes[\s\S]*SHOW_TRACE_IDS_STORAGE_KEY in changes[\s\S]*SHOW_SYSTEM_REMINDERS_STORAGE_KEY in changes[\s\S]*SHOW_TOOL_RESULT_DETAILS_STORAGE_KEY in changes[\s\S]*refreshDebug\(\)\.catch/s,
    "settings page should refresh the debug section when hidden debug preferences change",
  );

  assert.match(
    optionsEnhancerSource,
    /renderIncognitoPanel\(panel\);\s*renderHttpPanel\(panel\);/s,
    "options enhancer should place incognito mode before the HTTP panel",
  );

  assert.match(
    optionsEnhancerSource,
    /changes\[INCOGNITO_MODE_STORAGE_KEY\]/,
    "options enhancer should refresh when incognito mode changes",
  );

  assert.match(
    permissionManagerSource,
    /t\.DEBUG_MODE = "debugMode";/,
    "permission manager bundle should expose the debug mode key",
  );

  assert.match(
    permissionManagerSource,
    /t\.SHOW_TRACE_IDS = "showTraceIds";/,
    "permission manager bundle should expose the trace IDs key",
  );

  assert.match(
    permissionManagerSource,
    /t\.SHOW_SYSTEM_REMINDERS = "showSystemReminders";/,
    "permission manager bundle should expose the system reminders key",
  );

  assert.match(
    sidepanelSource,
    /const \[k, C\] = a\.useState\(true\);/,
    "sidepanel bundle should default debug mode to enabled",
  );

  assert.doesNotMatch(
    sidepanelSource,
    /y\(v\.DEBUG_MODE\)\.then\(e => \{/,
    "sidepanel bundle should no longer hydrate debug mode from storage",
  );

  assert.match(
    sidepanelSource,
    /y\(v\.SHOW_TRACE_IDS\)\.then\(e => \{/,
    "sidepanel bundle should read the trace IDs preference from storage",
  );

  assert.match(
    sidepanelSource,
    /y\(v\.SHOW_SYSTEM_REMINDERS\)\.then\(e => \{/,
    "sidepanel bundle should read the system reminders preference from storage",
  );

  assert.match(
    sidepanelLoggerSource,
    /const DEBUG_MODE_STORAGE_KEY = uiContract\.DEBUG_MODE_STORAGE_KEY \|\| "debugMode";/,
    "sidepanel debug logger should reuse the shared debug mode storage key",
  );

  assert.match(
    sidepanelLoggerSource,
    /const INCOGNITO_MODE_STORAGE_KEY = uiContract\.INCOGNITO_MODE_STORAGE_KEY \|\| "incognitoMode";/,
    "sidepanel debug logger should reuse the shared incognito mode storage key",
  );

  assert.match(
    sidepanelLoggerSource,
    /function installIncognitoStorageGuard\(\) \{/,
    "sidepanel debug logger should install the incognito storage guard before the sidepanel app loads",
  );

  assert.match(
    sidepanelLoggerSource,
    /filterMessagesForRequest\(messages, sessionKey\) \{[\s\S]*filterMessagesForIncognitoRequest\(visibleMessages, incognitoModeEnabled\);/,
    "sidepanel debug logger should expose a request filter for incognito mode",
  );

  assert.match(
    sidepanelLoggerSource,
    /beginTemporaryMessages[\s\S]*endTemporaryMessages[\s\S]*filterMessagesForPersistence\(messages, sessionKey\)/,
    "sidepanel debug logger should track and discard temporary incognito message ranges",
  );

  assert.match(
    sidepanelSource,
    /filterMessagesForRequest\?\.\(y\.messages, s\) \|\| y\.messages/,
    "sidepanel small-model helper requests should filter prior context in incognito mode",
  );

  assert.match(
    sidepanelSource,
    /calculateProjectedMetricsFromMessages\(__cpFilterIncognitoRequestMessages\(L\), __cpMaxOutputTokens, __cpContextWindow\)/,
    "sidepanel standard chat metrics should use incognito-filtered request context",
  );

  assert.match(
    sidepanelSource,
    /let p = be\(__cpFilterIncognitoRequestMessages\(L\)\);/,
    "sidepanel standard chat requests should not send previous turns in incognito mode",
  );

  assert.match(
    sidepanelSource,
    /let f = AQ\(__cpIncognitoRuntime\?\.filterMessagesForRequest\?\.\(r, I\.current\) \|\| r\);/,
    "sidepanel quick-mode requests should not send previous turns in incognito mode",
  );

  assert.match(
    sidepanelSource,
    /incognito\.boundary_started[\s\S]*incognito\.boundary_discarded/,
    "sidepanel should start a temporary incognito boundary on enable and discard it on disable",
  );

  assert.match(
    sidepanelSource,
    /const __cpPersistentMessages = __cpIncognitoRuntime\?\.filterMessagesForPersistence\?\.\(dt, o\.sessionId\) \|\| dt;/,
    "sidepanel persistence should exclude temporary incognito messages before writing session snapshots",
  );

  assert.match(
    sidepanelLoggerSource,
    /let debugEnabled = true;/,
    "sidepanel debug logger should default to enabled",
  );

  assert.match(
    sidepanelLoggerSource,
    /if \(stored\[DEBUG_MODE_STORAGE_KEY\] !== true\) \{[\s\S]*\[DEBUG_MODE_STORAGE_KEY\]: true/s,
    "sidepanel debug logger should auto-correct the persisted debug mode flag to true",
  );

  assert.match(
    sidepanelLoggerSource,
    /if \(DEBUG_MODE_STORAGE_KEY in changes\) \{[\s\S]*debugEnabled = true;[\s\S]*\[DEBUG_MODE_STORAGE_KEY\]: true/s,
    "sidepanel debug logger should ignore attempts to disable debug mode",
  );

  assert.match(
    zhCustomI18nSource,
    /"debugTitle": "开发 \/ 调试"/,
    "zh-CN custom strings should translate the developer/debug section",
  );

  assert.match(
    zhCustomI18nSource,
    /"traceIdsTitle": "显示追踪 ID"/,
    "zh-CN custom strings should translate the trace IDs toggle",
  );

  assert.match(
    zhCustomI18nSource,
    /"systemRemindersTitle": "显示系统提醒"/,
    "zh-CN custom strings should translate the system reminders toggle",
  );

  assert.match(
    zhCustomI18nSource,
    /"optionsUpdateEnhancer": \{[\s\S]*"incognitoCardTitle": "无痕模式"[\s\S]*"incognitoCardSubtitle": "每次对话都不携带之前上下文，也不会写入本地历史。"[\s\S]*"incognitoToggleHelp": "适合问题不断变化的场景：避免反复携带无关历史上下文，从而节省 token。"/,
    "zh-CN custom strings should describe incognito mode context and token behavior",
  );

  assert.match(
    zhTwCustomI18nSource,
    /"debugTitle": "開發 \/ 偵錯"/,
    "zh-TW custom strings should translate the developer/debug section",
  );

  assert.match(
    zhTwCustomI18nSource,
    /"traceIdsTitle": "顯示追蹤 ID"/,
    "zh-TW custom strings should translate the trace IDs toggle",
  );

  assert.match(
    zhTwCustomI18nSource,
    /"systemRemindersTitle": "顯示系統提醒"/,
    "zh-TW custom strings should translate the system reminders toggle",
  );

  assert.match(
    zhTwCustomI18nSource,
    /"optionsUpdateEnhancer": \{[\s\S]*"incognitoCardTitle": "無痕模式"[\s\S]*"incognitoCardSubtitle": "每次對話都不攜帶先前上下文，也不會寫入本機歷史。"[\s\S]*"incognitoToggleHelp": "適合問題不斷變化的場景：避免反覆攜帶無關歷史上下文，從而節省 token。"/,
    "zh-TW custom strings should describe incognito mode context and token behavior",
  );

  assert.match(
    zhTwCustomI18nSource,
    /"toolResultDetailsTitle": "顯示工具結果詳情"/,
    "zh-TW custom strings should translate the tool result details toggle",
  );

  console.log("debug visibility settings regression test passed");
}

main();
