const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modelsPath = path.join(__dirname, "..", "custom-provider-models.js");
const modelsSource = fs.readFileSync(modelsPath, "utf8");

function createProfile(overrides = {}) {
  return {
    id: "provider_a",
    name: "Provider A",
    format: "openai_chat",
    baseUrl: "https://provider-a.example/v1",
    apiKey: "key-a",
    defaultModel: "gpt-5.4",
    fastModel: "gpt-5.4-mini",
    reasoningEffort: "medium",
    maxOutputTokens: 10000,
    contextWindow: 200000,
    fetchedModels: [],
    ...overrides
  };
}

function projectProfileToConfig(profile) {
  return {
    name: profile.name,
    format: profile.format,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    defaultModel: profile.defaultModel,
    fastModel: profile.fastModel,
    reasoningEffort: profile.reasoningEffort,
    maxOutputTokens: profile.maxOutputTokens,
    contextWindow: profile.contextWindow,
    fetchedModels: profile.fetchedModels
  };
}

function buildStandardSyncSignature(profile) {
  return JSON.stringify({
    provider: JSON.stringify({
      id: profile.id,
      format: profile.format,
      baseUrl: profile.baseUrl
    }),
    model: profile.defaultModel
  });
}

function buildQuickSyncSignature(profile) {
  return JSON.stringify({
    provider: JSON.stringify({
      id: profile.id,
      format: profile.format,
      baseUrl: profile.baseUrl
    }),
    model: profile.fastModel || profile.defaultModel
  });
}

function createStorageArea(initialState) {
  const state = {
    ...initialState
  };
  return {
    state,
    async get(keys) {
      if (keys == null) {
        return {
          ...state
        };
      }
      if (typeof keys === "string") {
        return {
          [keys]: state[keys]
        };
      }
      if (Array.isArray(keys)) {
        const output = {};
        for (const key of keys) {
          output[key] = state[key];
        }
        return output;
      }
      if (typeof keys === "object") {
        const output = {};
        for (const [key, fallbackValue] of Object.entries(keys)) {
          output[key] = Object.prototype.hasOwnProperty.call(state, key) ? state[key] : fallbackValue;
        }
        return output;
      }
      return {};
    },
    async set(next) {
      Object.assign(state, next);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) {
        delete state[key];
      }
    }
  };
}

function loadModels(storageArea) {
  const sandbox = {
    console,
    AbortController,
    clearTimeout,
    setTimeout,
    fetch: async () => {
      throw new Error("fetch should not be called in this test");
    },
    chrome: {
      storage: {
        local: storageArea
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(modelsSource, sandbox, {
    filename: "custom-provider-models.js"
  });
  return sandbox.CustomProviderModels;
}

async function waitForMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function testSavingActiveProfileSyncsSelectedModels() {
  const activeProfile = createProfile();
  const storageArea = createStorageArea({
    customProviderProfiles: [activeProfile],
    customProviderActiveProfileId: activeProfile.id,
    customProviderConfig: projectProfileToConfig(activeProfile),
    selectedModel: "gpt-old-sticky",
    selectedModelQuickMode: "gpt-old-quick"
  });
  const models = loadModels(storageArea);
  await waitForMicrotasks();

  await models.saveProviderProfile({
    ...activeProfile,
    defaultModel: "gpt-5.5",
    fastModel: "gpt-5.5-mini"
  }, {
    profileId: activeProfile.id,
    storageArea
  });

  assert.equal(storageArea.state.selectedModel, "gpt-5.5");
  assert.equal(storageArea.state.selectedModelQuickMode, "gpt-5.5-mini");
  assert.equal(storageArea.state.customProviderConfig.defaultModel, "gpt-5.5");
  assert.equal(storageArea.state.customProviderConfig.fastModel, "gpt-5.5-mini");
  assert.ok(storageArea.state.customProviderSelectedModelSyncSignature, "standard sync signature should be stored");
  assert.ok(storageArea.state.customProviderSelectedModelQuickModeSyncSignature, "quick sync signature should be stored");
}

async function testSavingNonModelFieldsKeepsExistingStickySelection() {
  const activeProfile = createProfile();
  const storageArea = createStorageArea({
    customProviderProfiles: [activeProfile],
    customProviderActiveProfileId: activeProfile.id,
    customProviderConfig: projectProfileToConfig(activeProfile),
    selectedModel: "manual-standard-choice",
    selectedModelQuickMode: "manual-quick-choice",
    customProviderSelectedModelSyncSignature: buildStandardSyncSignature(activeProfile),
    customProviderSelectedModelQuickModeSyncSignature: buildQuickSyncSignature(activeProfile)
  });
  const models = loadModels(storageArea);
  await waitForMicrotasks();

  await models.saveProviderProfile({
    ...activeProfile,
    contextWindow: 240000,
    maxOutputTokens: 12000
  }, {
    profileId: activeProfile.id,
    storageArea
  });

  assert.equal(storageArea.state.selectedModel, "manual-standard-choice");
  assert.equal(storageArea.state.selectedModelQuickMode, "manual-quick-choice");
}

async function testEditingInactiveProfileDoesNotResyncActiveSelection() {
  const activeProfile = createProfile();
  const inactiveProfile = createProfile({
    id: "provider_b",
    name: "Provider B",
    baseUrl: "https://provider-b.example/v1",
    apiKey: "key-b",
    defaultModel: "gpt-4.1",
    fastModel: "gpt-4.1-mini"
  });
  const storageArea = createStorageArea({
    customProviderProfiles: [activeProfile, inactiveProfile],
    customProviderActiveProfileId: activeProfile.id,
    customProviderConfig: projectProfileToConfig(activeProfile),
    selectedModel: "manual-standard-choice",
    selectedModelQuickMode: "manual-quick-choice",
    customProviderSelectedModelSyncSignature: buildStandardSyncSignature(activeProfile),
    customProviderSelectedModelQuickModeSyncSignature: buildQuickSyncSignature(activeProfile)
  });
  const models = loadModels(storageArea);
  await waitForMicrotasks();

  await models.saveProviderProfile({
    ...inactiveProfile,
    defaultModel: "gpt-4.2"
  }, {
    profileId: inactiveProfile.id,
    storageArea,
    activateOnSave: false
  });

  assert.equal(storageArea.state.selectedModel, "manual-standard-choice");
  assert.equal(storageArea.state.selectedModelQuickMode, "manual-quick-choice");
  assert.equal(storageArea.state.customProviderActiveProfileId, activeProfile.id);
}

async function testActivatingAnotherProfileSyncsSelectedModels() {
  const activeProfile = createProfile();
  const inactiveProfile = createProfile({
    id: "provider_b",
    name: "Provider B",
    baseUrl: "https://provider-b.example/v1",
    apiKey: "key-b",
    defaultModel: "gpt-4.1",
    fastModel: "gpt-4.1-mini"
  });
  const storageArea = createStorageArea({
    customProviderProfiles: [activeProfile, inactiveProfile],
    customProviderActiveProfileId: activeProfile.id,
    customProviderConfig: projectProfileToConfig(activeProfile),
    selectedModel: "manual-standard-choice",
    selectedModelQuickMode: "manual-quick-choice"
  });
  const models = loadModels(storageArea);
  await waitForMicrotasks();

  await models.setActiveProviderProfile(inactiveProfile.id, {
    storageArea
  });

  assert.equal(storageArea.state.customProviderActiveProfileId, inactiveProfile.id);
  assert.equal(storageArea.state.selectedModel, inactiveProfile.defaultModel);
  assert.equal(storageArea.state.selectedModelQuickMode, inactiveProfile.fastModel);
}

async function testReconcileRepairsExistingStaleSelectionWithoutResave() {
  const activeProfile = createProfile({
    defaultModel: "gpt-5.4",
    fastModel: "gpt-5.4-mini"
  });
  const storageArea = createStorageArea({
    customProviderProfiles: [activeProfile],
    customProviderActiveProfileId: activeProfile.id,
    customProviderConfig: projectProfileToConfig(activeProfile),
    selectedModel: "stale-sticky-model",
    selectedModelQuickMode: "stale-quick-model"
  });
  const models = loadModels(storageArea);
  await waitForMicrotasks();

  assert.equal(storageArea.state.selectedModel, activeProfile.defaultModel);
  assert.equal(storageArea.state.selectedModelQuickMode, activeProfile.fastModel);

  storageArea.state.selectedModel = "manual-standard-choice";
  storageArea.state.selectedModelQuickMode = "manual-quick-choice";

  const reconciled = await models.reconcileActiveProviderModelSelection({
    storageArea
  });

  assert.equal(reconciled, false, "matching sync signatures should not overwrite later manual model choices");
  assert.equal(storageArea.state.selectedModel, "manual-standard-choice");
  assert.equal(storageArea.state.selectedModelQuickMode, "manual-quick-choice");
}

async function testLoadingLegacyStorageCleansDeprecatedFields() {
  const activeProfile = createProfile();
  const legacyProfile = {
    ...activeProfile,
    enabled: true,
    notes: "legacy note"
  };
  const storageArea = createStorageArea({
    customProviderProfiles: [legacyProfile],
    customProviderActiveProfileId: activeProfile.id,
    customProviderConfig: {
      ...projectProfileToConfig(activeProfile),
      enabled: true,
      notes: "legacy config note"
    }
  });

  loadModels(storageArea);
  await waitForMicrotasks();

  assert.equal(Object.prototype.hasOwnProperty.call(storageArea.state.customProviderConfig, "enabled"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(storageArea.state.customProviderConfig, "notes"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(storageArea.state.customProviderProfiles[0], "enabled"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(storageArea.state.customProviderProfiles[0], "notes"), false);
}

async function main() {
  await testSavingActiveProfileSyncsSelectedModels();
  await testSavingNonModelFieldsKeepsExistingStickySelection();
  await testEditingInactiveProfileDoesNotResyncActiveSelection();
  await testActivatingAnotherProfileSyncsSelectedModels();
  await testReconcileRepairsExistingStaleSelectionWithoutResave();
  await testLoadingLegacyStorageCleansDeprecatedFields();
  console.log("custom-provider-models sync regression tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
