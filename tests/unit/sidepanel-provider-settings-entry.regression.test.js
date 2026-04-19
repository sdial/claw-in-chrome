const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..", "..");
const inlineProviderPath = path.join(rootDir, "sidepanel-inline-provider.js");
const sidepanelBundlePath = path.join(rootDir, "assets", "sidepanel-BoLm9pmH.js");
const onboardingBundlePath = path.join(rootDir, "assets", "useStorageState-hbwNMVUA.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function testInlineProviderOverlayIsRetired() {
  const source = read(inlineProviderPath);

  assert.doesNotMatch(
    source,
    /直接配置模型供应商|保存并应用|获取模型/,
    "sidepanel inline provider script should no longer inject the legacy inline configuration form"
  );

  assert.match(
    source,
    /统一引导用户前往设置页的“模型供应商”子界面完成配置/,
    "sidepanel inline provider script should document the settings-page handoff"
  );
}

function testSidepanelPromptOpensProviderSettingsSubview() {
  const source = read(sidepanelBundlePath);

  assert.match(
    source,
    /function __cpGetLocalizedProviderPromptDescription\(e\) \{\s*return __cpIsChineseLocale\(e\) \? "请前往设置页的“模型供应商”界面完成配置。填写 Base URL、API Key 和默认模型后再继续。" : "Open the Model Providers settings page and finish configuring your provider before continuing. Fill in the Base URL, API Key, and default model first\.";\s*\}/,
    "sidepanel prompt should localize the provider settings guidance from the current browser locale"
  );

  assert.match(
    source,
    /onClick: \(\) => chrome\.tabs\.create\(\{\s*url: chrome\.runtime\.getURL\("options\.html#options\?provider=true"\)\s*\}\),\s*children: __cpGetLocalizedProviderPromptActionText\(ye\?\.locale\)/,
    "sidepanel prompt should deep-link into the provider settings subview"
  );

  assert.match(
    source,
    /__cpGetLocalizedProviderPromptDescription\(ye\?\.locale\)[\s\S]{0,500}l\.jsx\("button", \{\s*className: "px-4 py-2\.5 rounded-\[14px\] bg-text-100 hover:bg-text-200 active:bg-text-000 text-bg-100/,
    "provider settings prompt should reuse the existing black primary button token"
  );

  assert.match(
    source,
    /children: __cpGetLocalizedProviderPromptTitle\(n\?\.locale\)/,
    "secondary sidepanel entry should reuse the localized provider prompt title"
  );

  assert.match(
    source,
    /children: __cpGetLocalizedProviderPromptDescription\(n\?\.locale\)/,
    "secondary sidepanel entry should reuse the localized provider prompt description"
  );

  assert.match(
    source,
    /children: __cpGetLocalizedProviderPromptActionText\(n\?\.locale\)/,
    "secondary sidepanel entry should reuse the localized provider prompt action label"
  );

  assert.match(
    source,
    /children: __cpGetLocalizedProviderPromptRetryText\(n\?\.locale\)/,
    "secondary sidepanel entry should reuse the same localized provider prompt copy"
  );

  assert.doesNotMatch(
    source,
    /__cpGetLocalizedProviderPromptDescription\(ye\?\.locale\)[\s\S]{0,500}l\.jsx\(Q, \{/,
    "provider settings prompt should not render through the local Q symbol because that name is shadowed inside the sidepanel scope"
  );

  assert.doesNotMatch(
    source,
    /当前还没有可用的供应商配置。/,
    "provider settings prompt should no longer render the redundant helper footnote"
  );
}

function testOnboardingPromptUsesLocalizedProviderSettingsCopy() {
  const source = read(onboardingBundlePath);

  assert.match(
    source,
    /function __cpGetLocalizedProviderOnboardingDescription\(e, t\) \{[\s\S]*Open settings, fill in the Base URL, API Key, and default model, then reopen the side panel\./,
    "first-run onboarding should localize its provider guidance from the browser locale"
  );

  assert.match(
    source,
    /onClick: \(\) => chrome\.tabs\.create\(\{\s*url: chrome\.runtime\.getURL\("options\.html#options\?provider=true"\)\s*\}\),\s*children: __cpGetLocalizedProviderOnboardingActionText\(\)/,
    "first-run onboarding should deep-link into the provider settings subview"
  );

  assert.match(
    source,
    /children: __cpGetLocalizedProviderOnboardingTitle\(\)/,
    "first-run onboarding should render through the localized provider onboarding title helper"
  );

  assert.match(
    source,
    /children: __cpGetLocalizedProviderOnboardingDescription\(void 0, e\)/,
    "first-run onboarding should render through the localized provider onboarding description helper"
  );

  assert.match(
    source,
    /children: __cpGetLocalizedProviderOnboardingActionText\(\)/,
    "first-run onboarding should render through the localized provider onboarding action helper"
  );

  assert.match(
    source,
    /children: __cpGetLocalizedProviderOnboardingRetryText\(\)/,
    "first-run onboarding should render through the localized provider onboarding helpers"
  );
}

function main() {
  testInlineProviderOverlayIsRetired();
  testSidepanelPromptOpensProviderSettingsSubview();
  testOnboardingPromptUsesLocalizedProviderSettingsCopy();
  console.log("sidepanel provider settings entry regression test passed");
}

main();
