const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..", "..");
const intlRuntimePath = path.join(rootDir, "assets", "index-5uYI7rOK.js");
const sidepanelBundlePath = path.join(rootDir, "assets", "sidepanel-BoLm9pmH.js");
const zhMessagesPath = path.join(rootDir, "i18n", "zh-CN.json");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function testSidepanelLocaleFallsBackToBrowserLanguage() {
  const source = read(intlRuntimePath);

  assert.match(
    source,
    /const kn = \["en-US", "zh-CN", "de-DE", "fr-FR", "ko-KR", "ja-JP", "es-419", "es-ES", "it-IT", "hi-IN", "pt-BR", "id-ID"\];/,
    "sidepanel intl runtime should register zh-CN as a supported locale"
  );

  assert.match(
    source,
    /function Pn\(\) \{\s*const e = navigator\.language;\s*if \(kn\.includes\(e\)\) \{\s*return e;\s*\}\s*const t = e\.split\("-"\)\[0\];\s*return kn\.find\(e => e\.startsWith\(t \+ "-"\)\) \|\| wn;\s*\}/s,
    "sidepanel intl runtime should fall back from navigator.language to a matching locale family such as zh-CN"
  );

  assert.match(
    source,
    /if \(e && kn\.includes\(e\)\) \{\s*t\(e\);\s*\} else \{\s*t\(Pn\(\)\);\s*\}/s,
    "sidepanel locale store should use the browser language when preferred_locale is not set"
  );
}

function testOnboardingCardsReferenceLocalizedMessageIds() {
  const source = read(sidepanelBundlePath);

  for (const messageId of [
    "/06n65wN4J",
    "RWrtnxjH8o",
    "Ddc1eapnSI",
    "DvXQDnOGPc",
    "p5wxjR3WJg",
    "5U/pkz4osv",
    "yLeYIHrySb",
    "9+DdtuCqLw",
    "RuX+iObJu9",
    "jN7b0qJSmv",
    "sDX6Oo6Pj4",
    "oCBOPo+ZDe",
    "wVu1FLTwAn"
  ]) {
    assert.ok(
      source.includes(`id: "${messageId}"`),
      `onboarding should render message id ${messageId} through react-intl`
    );
  }
}

function testChineseLocaleContainsOnboardingTranslations() {
  const messages = JSON.parse(read(zhMessagesPath));

  assert.equal(messages["/06n65wN4J"], "这是一个 Beta 功能");
  assert.equal(messages.RWrtnxjH8o, "这个 Beta 功能具有与其他 Claw 产品不同的独特风险。使用本产品所带来的全部风险需由你自行承担。");
  assert.equal(messages.Ddc1eapnSI, "Claw 在响应时可以截图。出于隐私考虑，请避免在医疗、交友等敏感网站上使用 Claw。");
  assert.equal(messages.DvXQDnOGPc, "恶意行为者可能会把指令隐藏在网站、邮件和文档中，诱导 AI 在你不知情的情况下执行有害操作。<link>了解更多</link>");
  assert.equal(messages.p5wxjR3WJg, "我明白");
  assert.equal(messages["5U/pkz4osv"], "自动化你的重复任务");
  assert.equal(messages.yLeYIHrySb, "Claw 可以承担多步骤工作，例如 QA 测试、销售线索调研，以及跨多个网站的数据录入。你可以放心去处理别的事情，Claw 会在后台工作。");
  assert.equal(messages["9+DdtuCqLw"], "下一步");
  assert.equal(messages["RuX+iObJu9"], "Claw 已获得标签组访问权限");
  assert.equal(messages.jN7b0qJSmv, "如果 Claw 在某个标签组中打开，它可以访问该组内所有标签页的 URL、上下文和信息。");
  assert.equal(messages["sDX6Oo6Pj4"], "使用快捷方式节省时间");
  assert.equal(messages["oCBOPo+ZDe"], "快捷方式可以帮助你快速向 Claw 发送指令，非常适合重复性任务！在聊天中输入 / 即可查找并创建快捷方式。");
  assert.equal(messages["wVu1FLTwAn"], "开始吧");
}

function main() {
  testSidepanelLocaleFallsBackToBrowserLanguage();
  testOnboardingCardsReferenceLocalizedMessageIds();
  testChineseLocaleContainsOnboardingTranslations();
  console.log("sidepanel onboarding locale regression test passed");
}

main();
