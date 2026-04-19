const assert = require("node:assert/strict");
const path = require("node:path");

const {
  createChromeMock,
  flushMicrotasks,
  runScriptInSandbox
} = require("../helpers/chrome-test-utils");
const {
  FakeDocument,
  FakeElement,
  FakeMutationObserver
} = require("../helpers/fake-dom");

const corePath = path.join(__dirname, "..", "..", "visualizer-core.js");
const scriptPath = path.join(__dirname, "..", "..", "visualizer.js");

function createStorageState(snapshot, scopeId, sessionId) {
  return {
    [`claw.chat.scopes.${scopeId}.activeSession`]: snapshot,
    [`claw.chat.scopes.${scopeId}.index`]: [{
      id: sessionId,
      scopeId,
      updatedAt: snapshot.meta.updatedAt
    }],
    [`claw.chat.scopes.${scopeId}.byId.${sessionId}`]: snapshot
  };
}

function createVisualizerHarness(snapshot, options = {}) {
  const scopeId = options.scopeId || "scope-modal";
  const sessionId = options.sessionId || "session-modal";
  const chromeMock = createChromeMock({
    storageState: createStorageState(snapshot, scopeId, sessionId)
  });
  const document = new FakeDocument({
    readyState: "complete",
    lang: options.lang || "zh-CN"
  });
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);

  const sandbox = {
    console,
    chrome: chromeMock.chrome,
    document,
    Element: FakeElement,
    MutationObserver: FakeMutationObserver,
    navigator: {
      language: options.language || "zh-CN"
    },
    location: {
      search: options.search || ""
    },
    URLSearchParams,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;

  runScriptInSandbox(corePath, sandbox);
  runScriptInSandbox(scriptPath, sandbox);

  return {
    root,
    document,
    async flush() {
      await flushMicrotasks();
      await flushMicrotasks();
    },
    openNode(nodeId) {
      const trigger = new FakeElement("button", document);
      trigger.setAttribute("data-cpv-open-node", "true");
      trigger.setAttribute("data-node-id", nodeId);
      root.dispatchEvent({
        type: "click",
        target: trigger
      });
    },
    getHtml() {
      return String(root.innerHTML || "");
    }
  };
}

function createPlainTextSnapshot(messages) {
  return {
    meta: {
      id: "session-modal",
      scopeId: "scope-modal",
      title: "Modal content test",
      updatedAt: 300,
      createdAt: 200,
      selectedModel: "gpt-5.4"
    },
    messages
  };
}

async function testUserInputAndFinalAnswerModalShowContent() {
  const harness = createVisualizerHarness(createPlainTextSnapshot([{
    role: "user",
    content: [{
      type: "text",
      text: "这是用户输入正文"
    }]
  }, {
    role: "assistant",
    content: [{
      type: "text",
      text: "这是最终答复正文"
    }]
  }]));
  await harness.flush();

  harness.openNode("node_message_0_text_0");
  await harness.flush();
  assert.match(harness.getHtml(), /cpv-modal-section-title">内容<\/div>/);
  assert.match(harness.getHtml(), /这是用户输入正文/);

  harness.openNode("node_message_1_text_0");
  await harness.flush();
  assert.match(harness.getHtml(), /cpv-modal-section-title">内容<\/div>/);
  assert.match(harness.getHtml(), /这是最终答复正文/);
}

async function testAssistantPlanningModalShowContent() {
  const harness = createVisualizerHarness(createPlainTextSnapshot([{
    role: "user",
    content: [{
      type: "text",
      text: "先检查页面结构"
    }]
  }, {
    role: "assistant",
    content: [{
      type: "text",
      text: "我先读取页面结构。"
    }, {
      type: "tool_use",
      id: "tool-read",
      name: "read_page",
      input: {
        depth: 1
      }
    }]
  }]));
  await harness.flush();

  harness.openNode("node_message_1_text_0");
  await harness.flush();
  assert.match(harness.getHtml(), /cpv-modal-section-title">内容<\/div>/);
  assert.match(harness.getHtml(), /我先读取页面结构。/);
}

async function main() {
  await testUserInputAndFinalAnswerModalShowContent();
  await testAssistantPlanningModalShowContent();
  console.log("visualizer modal content tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
