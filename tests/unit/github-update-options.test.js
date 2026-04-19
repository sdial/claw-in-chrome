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
  FakeMutationObserver,
  findElementByText
} = require("../helpers/fake-dom");

const scriptPath = path.join(__dirname, "..", "..", "github-update-options.js");

function createOptionsHarness(options = {}) {
  const chromeMock = createChromeMock({
    storageState: options.storageState || {}
  });
  const rafQueue = [];
  const windowListeners = new Map();
  const runtimeMessages = [];
  const releaseCalls = [];
  const downloadCalls = [];
  const document = new FakeDocument({
    readyState: "complete"
  });
  const anchor = document.createElement("div");
  anchor.id = "cp-github-update-options-anchor";
  document.body.appendChild(anchor);

  const state = options.state || {
    info: {
      currentVersion: "1.0.0.0",
      latestVersion: "1.1.0.0",
      hasUpdate: true,
      lastCheckedAt: "2026-04-19T00:00:00.000Z",
      notes: "Release notes"
    },
    autoCheckEnabled: true
  };
  const shared = {
    STORAGE_KEYS: {
      INFO: "githubUpdateInfo",
      AUTO_CHECK_ENABLED: "githubUpdateAutoCheckEnabled"
    },
    MESSAGE_TYPES: {
      CHECK_NOW: "CP_GITHUB_UPDATE_CHECK_NOW"
    },
    formatTimestamp(value) {
      return `fmt:${value}`;
    },
    summarizeNotes(value) {
      return String(value || "");
    },
    async readStoredState() {
      return JSON.parse(JSON.stringify(state));
    },
    async openReleasePage(info) {
      releaseCalls.push(JSON.parse(JSON.stringify(info)));
      return true;
    },
    async openDownloadPage(info) {
      downloadCalls.push(JSON.parse(JSON.stringify(info)));
      return true;
    }
  };

  chromeMock.chrome.runtime.sendMessage = (message, callback) => {
    runtimeMessages.push(JSON.parse(JSON.stringify(message)));
    chromeMock.chrome.runtime.lastError = options.runtimeLastError ? {
      message: options.runtimeLastError
    } : undefined;
    if (typeof callback === "function") {
      callback(options.runtimeResponse || {
        ok: true
      });
    }
    chromeMock.chrome.runtime.lastError = undefined;
  };

  const sandbox = {
    console,
    chrome: chromeMock.chrome,
    document,
    Element: FakeElement,
    MutationObserver: FakeMutationObserver,
    navigator: {
      language: options.language || "en-US"
    },
    requestAnimationFrame(callback) {
      rafQueue.push(callback);
      return rafQueue.length;
    },
    setTimeout(callback) {
      rafQueue.push(callback);
      return rafQueue.length;
    },
    URLSearchParams,
    window: {
      location: {
        hash: options.hash || "#options"
      },
      addEventListener(type, listener) {
        const current = windowListeners.get(type) || [];
        current.push(listener);
        windowListeners.set(type, current);
      }
    },
    __CP_GITHUB_UPDATE_SHARED__: shared
  };
  sandbox.globalThis = sandbox;

  runScriptInSandbox(scriptPath, sandbox);

  async function flushRenders() {
    await flushMicrotasks();
    await flushMicrotasks();
    let guard = 30;
    while (rafQueue.length > 0 && guard > 0) {
      guard -= 1;
      const batch = rafQueue.splice(0);
      for (const callback of batch) {
        callback();
        await flushMicrotasks();
        await flushMicrotasks();
      }
    }
  }

  return {
    chromeMock,
    document,
    runtimeMessages,
    downloadCalls,
    releaseCalls,
    root() {
      return document.getElementById("cp-github-update-options-root");
    },
    async dispatchHashChange(nextHash) {
      sandbox.window.location.hash = nextHash;
      for (const listener of windowListeners.get("hashchange") || []) {
        listener();
      }
      await flushRenders();
    },
    async flushRenders() {
      await flushRenders();
    }
  };
}

async function testOptionsCardSupportsCheckNowAndAutoToggle() {
  const harness = createOptionsHarness({});
  await harness.flushRenders();

  const root = harness.root();
  assert.ok(root, "options update card should render");
  assert.equal(String(root.textContent || "").includes("Extension updates"), true);

  const checkNowButton = findElementByText(root, "button", "Check now");
  assert.ok(checkNowButton, "check now button should exist");
  checkNowButton.click();
  await harness.flushRenders();

  assert.deepEqual(harness.runtimeMessages, [{
    type: "CP_GITHUB_UPDATE_CHECK_NOW"
  }]);
  assert.equal(String(root.textContent || "").includes("Release metadata refreshed."), true);

  const toggleButton = root.querySelector("[aria-label='Auto-check updates']");
  assert.ok(toggleButton, "auto-check toggle should exist");
  toggleButton.click();
  await harness.flushRenders();

  assert.equal(harness.chromeMock.storageMock.state.githubUpdateAutoCheckEnabled, false);
  assert.equal(String(root.textContent || "").includes("Automatic update checks disabled."), true);
}

async function testOptionsCardSupportsReleaseDownloadAndHashRemoval() {
  const harness = createOptionsHarness({});
  await harness.flushRenders();

  const root = harness.root();
  findElementByText(root, "button", "Download ZIP").click();
  findElementByText(root, "button", "Open release").click();

  assert.equal(harness.downloadCalls.length, 1);
  assert.equal(harness.releaseCalls.length, 1);
  assert.equal(harness.downloadCalls[0].latestVersion, "1.1.0.0");

  await harness.dispatchHashChange("#permissions");
  assert.equal(harness.root(), null);
}

async function main() {
  await testOptionsCardSupportsCheckNowAndAutoToggle();
  await testOptionsCardSupportsReleaseDownloadAndHashRemoval();
  console.log("github update options tests passed");
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
