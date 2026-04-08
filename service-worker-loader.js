import "./provider-format-adapter.js";
import "./assets/service-worker.ts-H0DVM1LS.js";
import "./github-update-shared.js";
import "./github-update-worker.js";

const CHAT_SCOPE_PREFIX = "claw.chat.scopes.";
const CHAT_CLEANUP_AUDIT_KEY = "claw.chat.cleanup.audit";
const CHAT_CLEANUP_AUDIT_LIMIT = 40;

const normalizeStorageScopeId = value => typeof value === "string" ? value.trim() : "";

const extractScopeIdFromStorageKey = key => {
  const rawKey = String(key || "");
  if (!rawKey.startsWith(CHAT_SCOPE_PREFIX)) {
    return "";
  }
  const suffix = rawKey.slice(CHAT_SCOPE_PREFIX.length);
  const separatorIndex = suffix.indexOf(".");
  return separatorIndex > 0 ? suffix.slice(0, separatorIndex) : "";
};

const getGroupIdFromScopeId = scopeId => {
  const normalizedScopeId = normalizeStorageScopeId(scopeId);
  if (!normalizedScopeId.startsWith("chrome-group:")) {
    return null;
  }
  const groupId = Number(normalizedScopeId.slice("chrome-group:".length));
  return Number.isFinite(groupId) && groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ? groupId : null;
};

const isChromeGroupScopeId = scopeId => normalizeStorageScopeId(scopeId).startsWith("chrome-group:");

const getMainTabIdFromScopeId = scopeId => {
  const normalizedScopeId = normalizeStorageScopeId(scopeId);
  if (!normalizedScopeId.startsWith("group:")) {
    return null;
  }
  const mainTabId = Number(normalizedScopeId.slice("group:".length));
  return Number.isFinite(mainTabId) && mainTabId > 0 ? mainTabId : null;
};

const collectGroupIdsFromStorageValue = value => {
  const groupIds = new Set();
  const addGroupId = candidate => {
    const groupId = Number(candidate);
    if (Number.isFinite(groupId) && groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      groupIds.add(groupId);
    }
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      addGroupId(item?.chromeGroupId);
    }
    return groupIds;
  }

  if (value && typeof value === "object") {
    addGroupId(value.chromeGroupId);
    addGroupId(value?.meta?.chromeGroupId);
  }

  return groupIds;
};

const collectMainTabIdsFromStorageValue = value => {
  const mainTabIds = new Set();
  const addMainTabId = candidate => {
    const mainTabId = Number(candidate);
    if (Number.isFinite(mainTabId) && mainTabId > 0) {
      mainTabIds.add(mainTabId);
    }
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      addMainTabId(item?.mainTabId);
    }
    return mainTabIds;
  }

  if (value && typeof value === "object") {
    addMainTabId(value.mainTabId);
    addMainTabId(value?.meta?.mainTabId);
  }

  return mainTabIds;
};

const collectStoredScopeEntries = storageSnapshot => {
  const scopeEntries = new Map();
  for (const [storageKey, storageValue] of Object.entries(storageSnapshot || {})) {
    const scopeId = extractScopeIdFromStorageKey(storageKey);
    if (!scopeId) {
      continue;
    }
    if (!scopeEntries.has(scopeId)) {
      scopeEntries.set(scopeId, {
        keys: [],
        groupIds: new Set(),
        mainTabIds: new Set()
      });
    }
    const entry = scopeEntries.get(scopeId);
    entry.keys.push(storageKey);
    const scopeGroupId = getGroupIdFromScopeId(scopeId);
    if (scopeGroupId !== null) {
      entry.groupIds.add(scopeGroupId);
    }
    const scopeMainTabId = getMainTabIdFromScopeId(scopeId);
    if (scopeMainTabId !== null) {
      entry.mainTabIds.add(scopeMainTabId);
    }
    for (const groupId of collectGroupIdsFromStorageValue(storageValue)) {
      entry.groupIds.add(groupId);
    }
    for (const mainTabId of collectMainTabIdsFromStorageValue(storageValue)) {
      entry.mainTabIds.add(mainTabId);
    }
  }
  return scopeEntries;
};

const findScopeIdsByGroupId = (scopeEntries, groupId) => {
  const matchedScopeIds = [];
  for (const [scopeId, entry] of scopeEntries.entries()) {
    if (entry.groupIds.has(groupId)) {
      matchedScopeIds.push(scopeId);
    }
  }
  return matchedScopeIds;
};

const appendCleanupAudit = async (type, payload = {}) => {
  try {
    const existing = await chrome.storage.local.get(CHAT_CLEANUP_AUDIT_KEY);
    const currentItems = Array.isArray(existing[CHAT_CLEANUP_AUDIT_KEY]) ? existing[CHAT_CLEANUP_AUDIT_KEY] : [];
    const nextItems = [...currentItems, {
      ts: new Date().toISOString(),
      type,
      payload
    }].slice(-CHAT_CLEANUP_AUDIT_LIMIT);
    await chrome.storage.local.set({
      [CHAT_CLEANUP_AUDIT_KEY]: nextItems
    });
  } catch {}
};

const removeScopeEntries = async (scopeIds, storageSnapshot = null) => {
  const normalizedScopeIds = [...new Set((Array.isArray(scopeIds) ? scopeIds : []).map(normalizeStorageScopeId).filter(Boolean))];
  if (normalizedScopeIds.length === 0) {
    return {
      removedScopeIds: [],
      removedKeyCount: 0
    };
  }

  const scopeIdSet = new Set(normalizedScopeIds);
  const snapshot = storageSnapshot ?? await chrome.storage.local.get(null);
  const keysToRemove = [];
  for (const storageKey of Object.keys(snapshot)) {
    const scopeId = extractScopeIdFromStorageKey(storageKey);
    if (scopeId && scopeIdSet.has(scopeId)) {
      keysToRemove.push(storageKey);
    }
  }

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }

  console.debug("[session-cleanup] removed scopes", {
    scopeIds: normalizedScopeIds,
    removedKeyCount: keysToRemove.length
  });
  await appendCleanupAudit("removed_scopes", {
    scopeIds: normalizedScopeIds,
    removedKeyCount: keysToRemove.length
  });

  return {
    removedScopeIds: normalizedScopeIds,
    removedKeyCount: keysToRemove.length
  };
};

const cleanupClosedGroupScopes = async groupIdValue => {
  const groupId = Number(groupIdValue);
  if (!Number.isFinite(groupId) || groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
    return {
      removedScopeIds: [],
      removedKeyCount: 0
    };
  }

  const storageSnapshot = await chrome.storage.local.get(null);
  const scopeEntries = collectStoredScopeEntries(storageSnapshot);
  const scopeIds = findScopeIdsByGroupId(scopeEntries, groupId);

  if (scopeIds.length === 0) {
    console.debug("[session-cleanup] no scopes matched closed group", {
      groupId
    });
    await appendCleanupAudit("closed_group_no_match", {
      groupId
    });
    return {
      removedScopeIds: [],
      removedKeyCount: 0
    };
  }

  const relatedMainTabIds = new Set();
  for (const scopeId of scopeIds) {
    const entry = scopeEntries.get(scopeId);
    if (!entry) {
      continue;
    }
    for (const mainTabId of entry.mainTabIds) {
      relatedMainTabIds.add(mainTabId);
    }
  }

  const relatedScopeIds = new Set(scopeIds);
  if (relatedMainTabIds.size > 0) {
    for (const [scopeId, entry] of scopeEntries.entries()) {
      if ([...entry.mainTabIds].some(mainTabId => relatedMainTabIds.has(mainTabId))) {
        relatedScopeIds.add(scopeId);
      }
    }
  }

  return removeScopeEntries([...relatedScopeIds], storageSnapshot);
};

const canResolveTabGroup = async groupId => {
  if (typeof chrome.tabGroups?.get !== "function") {
    return false;
  }
  try {
    await chrome.tabGroups.get(groupId);
    return true;
  } catch {
    return false;
  }
};

const cleanupOrphanGroupScopes = async () => {
  const storageSnapshot = await chrome.storage.local.get(null);
  const scopeEntries = collectStoredScopeEntries(storageSnapshot);
  const candidateGroupIds = new Set();

  for (const entry of scopeEntries.values()) {
    for (const groupId of entry.groupIds) {
      candidateGroupIds.add(groupId);
    }
  }

  if (candidateGroupIds.size === 0) {
    await appendCleanupAudit("orphan_scan_no_groups", {});
    return {
      removedScopeIds: [],
      removedKeyCount: 0
    };
  }

  const orphanScopeIds = new Set();
  for (const groupId of candidateGroupIds) {
    const exists = await canResolveTabGroup(groupId);
    if (!exists) {
      for (const scopeId of findScopeIdsByGroupId(scopeEntries, groupId)) {
        if (isChromeGroupScopeId(scopeId)) {
          orphanScopeIds.add(scopeId);
        }
      }
    }
  }

  if (orphanScopeIds.size === 0) {
    console.debug("[session-cleanup] orphan scope scan found nothing to remove");
    await appendCleanupAudit("orphan_scan_noop", {
      groupIds: [...candidateGroupIds]
    });
    return {
      removedScopeIds: [],
      removedKeyCount: 0
    };
  }

  return removeScopeEntries([...orphanScopeIds], storageSnapshot);
};

const DETACHED_WINDOW_SIZE = Object.freeze({
  width: 500,
  height: 768,
  left: 100,
  top: 100
});
const DETACHED_WINDOW_LOCKS_KEY = "claw.detachedWindowLocks";
const DETACHED_WINDOW_PAGE_PATH = "sidepanel.html";
const DETACHED_WINDOW_PAGE_URL = chrome.runtime.getURL(DETACHED_WINDOW_PAGE_PATH);
const DETACHED_WINDOW_PAGE_META = new URL(DETACHED_WINDOW_PAGE_URL);

const normalizePositiveNumber = value => {
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) && normalizedValue > 0 ? Math.trunc(normalizedValue) : null;
};

const normalizeWindowGroupId = value => {
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) && normalizedValue !== chrome.tabGroups.TAB_GROUP_ID_NONE ? Math.trunc(normalizedValue) : null;
};

const normalizeDetachedWindowLockEntry = value => {
  const groupId = normalizeWindowGroupId(value?.groupId);
  const windowId = normalizePositiveNumber(value?.windowId);
  if (groupId === null || windowId === null) {
    return null;
  }

  return {
    groupId,
    windowId,
    popupTabId: normalizePositiveNumber(value?.popupTabId),
    mainTabId: normalizePositiveNumber(value?.mainTabId),
    hostWindowId: normalizePositiveNumber(value?.hostWindowId),
    updatedAt: Number.isFinite(Number(value?.updatedAt)) ? Math.trunc(Number(value.updatedAt)) : Date.now()
  };
};

const readDetachedWindowLocks = async () => {
  try {
    const stored = await chrome.storage.local.get(DETACHED_WINDOW_LOCKS_KEY);
    const rawLocks = stored?.[DETACHED_WINDOW_LOCKS_KEY];
    const normalizedLocks = {};
    if (!rawLocks || typeof rawLocks !== "object") {
      return normalizedLocks;
    }
    for (const [rawGroupId, rawEntry] of Object.entries(rawLocks)) {
      const normalizedEntry = normalizeDetachedWindowLockEntry(rawEntry);
      if (!normalizedEntry) {
        continue;
      }
      normalizedLocks[String(normalizedEntry.groupId || rawGroupId)] = normalizedEntry;
    }
    return normalizedLocks;
  } catch {
    return {};
  }
};

const writeDetachedWindowLocks = async locks => {
  await chrome.storage.local.set({
    [DETACHED_WINDOW_LOCKS_KEY]: locks
  });
  return locks;
};

const upsertDetachedWindowLock = async entry => {
  const normalizedEntry = normalizeDetachedWindowLockEntry({
    ...entry,
    updatedAt: Date.now()
  });
  if (!normalizedEntry) {
    return null;
  }

  const locks = await readDetachedWindowLocks();
  locks[String(normalizedEntry.groupId)] = normalizedEntry;
  await writeDetachedWindowLocks(locks);
  return normalizedEntry;
};

const removeDetachedWindowLockByWindowId = async windowIdValue => {
  const windowId = normalizePositiveNumber(windowIdValue);
  if (windowId === null) {
    return [];
  }

  const locks = await readDetachedWindowLocks();
  const removedLocks = [];
  let changed = false;
  for (const [groupId, lockEntry] of Object.entries(locks)) {
    if (lockEntry?.windowId !== windowId) {
      continue;
    }
    removedLocks.push(lockEntry);
    delete locks[groupId];
    changed = true;
  }

  if (changed) {
    await writeDetachedWindowLocks(locks);
  }
  return removedLocks;
};

const sweepDetachedWindowLocks = async () => {
  const existingLocks = await readDetachedWindowLocks();
  const nextLocks = {};

  for (const lockEntry of Object.values(existingLocks)) {
    const activeDetachedWindow = await findDetachedWindowByGroupId(lockEntry.groupId);
    if (!activeDetachedWindow?.windowId) {
      continue;
    }
    let hostWindowId = lockEntry.hostWindowId;
    if (lockEntry.mainTabId) {
      try {
        hostWindowId = normalizePositiveNumber((await chrome.tabs.get(lockEntry.mainTabId)).windowId) ?? hostWindowId;
      } catch {}
    }
    const normalizedLock = normalizeDetachedWindowLockEntry({
      groupId: lockEntry.groupId,
      windowId: activeDetachedWindow.windowId,
      popupTabId: activeDetachedWindow.tabId,
      mainTabId: lockEntry.mainTabId ?? activeDetachedWindow.meta?.tabId,
      hostWindowId,
      updatedAt: Date.now()
    });
    if (!normalizedLock) {
      continue;
    }
    nextLocks[String(normalizedLock.groupId)] = normalizedLock;
  }

  const existingEntries = Object.entries(existingLocks);
  const nextEntries = Object.entries(nextLocks);
  const hasChanged = existingEntries.length !== nextEntries.length || nextEntries.some(([groupId, lockEntry]) => {
    const existingLock = existingLocks[groupId];
    return !existingLock || existingLock.windowId !== lockEntry.windowId || existingLock.popupTabId !== lockEntry.popupTabId || existingLock.mainTabId !== lockEntry.mainTabId || existingLock.hostWindowId !== lockEntry.hostWindowId;
  });

  if (hasChanged) {
    await writeDetachedWindowLocks(nextLocks);
  }

  return nextLocks;
};

const buildDetachedWindowUrl = ({
  tabId,
  groupId
}) => chrome.runtime.getURL(`${DETACHED_WINDOW_PAGE_PATH}?mode=window&tabId=${encodeURIComponent(tabId)}&groupId=${encodeURIComponent(groupId)}`);

const parseDetachedWindowUrl = url => {
  try {
    const parsedUrl = new URL(String(url || ""));
    if (parsedUrl.origin !== DETACHED_WINDOW_PAGE_META.origin || parsedUrl.pathname !== DETACHED_WINDOW_PAGE_META.pathname) {
      return null;
    }
    if (parsedUrl.searchParams.get("mode") !== "window") {
      return null;
    }
    const groupId = normalizeWindowGroupId(parsedUrl.searchParams.get("groupId"));
    if (groupId === null) {
      return null;
    }
    return {
      groupId,
      tabId: normalizePositiveNumber(parsedUrl.searchParams.get("tabId"))
    };
  } catch {
    return null;
  }
};

const ensureDetachedWindowGroupContext = async preferredTabId => {
  const tabId = normalizePositiveNumber(preferredTabId);
  if (tabId === null) {
    throw new Error("Missing target tab id");
  }

  const tab = await chrome.tabs.get(tabId);
  let groupId = normalizeWindowGroupId(tab?.groupId);
  if (groupId === null) {
    groupId = normalizeWindowGroupId(await chrome.tabs.group({
      tabIds: [tabId]
    }));
  }
  if (groupId === null) {
    throw new Error("Failed to resolve tab group");
  }

  return {
    tabId,
    groupId,
    hostWindowId: normalizePositiveNumber(tab?.windowId)
  };
};

const closeDetachedWindowForLockEntry = async lockEntryValue => {
  const lockEntry = normalizeDetachedWindowLockEntry(lockEntryValue);
  if (!lockEntry) {
    return false;
  }

  const locks = await readDetachedWindowLocks();
  delete locks[String(lockEntry.groupId)];
  await writeDetachedWindowLocks(locks);

  try {
    await chrome.windows.remove(lockEntry.windowId);
  } catch {}
  return true;
};

const findDetachedWindowByGroupId = async groupIdValue => {
  const groupId = normalizeWindowGroupId(groupIdValue);
  if (groupId === null) {
    return null;
  }

  const popupWindows = await chrome.windows.getAll({
    populate: true
  });
  for (const popupWindow of popupWindows) {
    if (popupWindow?.type !== "popup") {
      continue;
    }
    for (const popupTab of popupWindow.tabs || []) {
      const detachedWindowMeta = parseDetachedWindowUrl(popupTab?.url);
      if (detachedWindowMeta?.groupId === groupId) {
        return {
          windowId: normalizePositiveNumber(popupWindow.id),
          tabId: normalizePositiveNumber(popupTab.id),
          meta: detachedWindowMeta
        };
      }
    }
  }

  return null;
};

const focusDetachedWindow = async ({
  windowId,
  tabId
}) => {
  const normalizedWindowId = normalizePositiveNumber(windowId);
  if (tabId) {
    await chrome.tabs.update(tabId, {
      active: true
    });
  }
  if (normalizedWindowId !== null) {
    await chrome.windows.update(normalizedWindowId, {
      focused: true
    });
  }
};

const createDetachedWindow = async ({
  tabId,
  groupId
}) => {
  const detachedWindow = await chrome.windows.create({
    url: buildDetachedWindowUrl({
      tabId,
      groupId
    }),
    type: "popup",
    width: DETACHED_WINDOW_SIZE.width,
    height: DETACHED_WINDOW_SIZE.height,
    left: DETACHED_WINDOW_SIZE.left,
    top: DETACHED_WINDOW_SIZE.top,
    focused: true
  });
  return {
    success: true,
    reused: false,
    groupId,
    windowId: normalizePositiveNumber(detachedWindow?.id),
    popupTabId: normalizePositiveNumber(detachedWindow?.tabs?.[0]?.id)
  };
};

const openDetachedWindowForGroup = async payload => {
  await sweepDetachedWindowLocks();
  const preferredTabId = normalizePositiveNumber(payload?.mainTabId) ?? normalizePositiveNumber(payload?.tabId);
  const {
    tabId,
    groupId,
    hostWindowId
  } = await ensureDetachedWindowGroupContext(preferredTabId);
  const existingDetachedWindow = await findDetachedWindowByGroupId(groupId);

  if (existingDetachedWindow && existingDetachedWindow.windowId !== null) {
    try {
      if (existingDetachedWindow.tabId && existingDetachedWindow.meta?.tabId !== tabId) {
        await chrome.tabs.update(existingDetachedWindow.tabId, {
          url: buildDetachedWindowUrl({
            tabId,
            groupId
          }),
          active: true
        });
      }
      await focusDetachedWindow(existingDetachedWindow);
      await upsertDetachedWindowLock({
        groupId,
        windowId: existingDetachedWindow.windowId,
        popupTabId: existingDetachedWindow.tabId,
        mainTabId: tabId,
        hostWindowId
      });
      return {
        success: true,
        reused: true,
        groupId,
        windowId: existingDetachedWindow.windowId,
        popupTabId: existingDetachedWindow.tabId
      };
    } catch (error) {
      console.warn("[detached-window] failed to reuse popup", {
        groupId,
        message: error instanceof Error ? error.message : String(error || "")
      });
    }
  }

  const createdDetachedWindow = await createDetachedWindow({
    tabId,
    groupId
  });
  await upsertDetachedWindowLock({
    groupId,
    windowId: createdDetachedWindow.windowId,
    popupTabId: createdDetachedWindow.popupTabId,
    mainTabId: tabId,
    hostWindowId
  });
  return createdDetachedWindow;
};

// Clear the uninstall survey URL registered by the bundled worker.
const clearUninstallUrl = async () => {
  try {
    await chrome.runtime.setUninstallURL("");
  } catch {}
};

const runBackgroundMaintenance = async () => {
  await clearUninstallUrl();
  await cleanupOrphanGroupScopes();
  await sweepDetachedWindowLocks();
};

clearUninstallUrl();

chrome.runtime.onInstalled.addListener(() => {
  runBackgroundMaintenance();
});

chrome.runtime.onStartup.addListener(() => {
  runBackgroundMaintenance();
});

chrome.tabGroups?.onRemoved?.addListener(group => {
  cleanupClosedGroupScopes(group?.id).catch(error => {
    console.warn("[session-cleanup] closed group cleanup failed", error);
    appendCleanupAudit("closed_group_failed", {
      groupId: Number(group?.id),
      message: error instanceof Error ? error.message : String(error || "")
    });
  });
});

chrome.windows?.onRemoved?.addListener(windowId => {
  (async () => {
    const locks = await readDetachedWindowLocks();
    const hostWindowLocks = Object.values(locks).filter(lockEntry => lockEntry?.hostWindowId === normalizePositiveNumber(windowId) && lockEntry?.windowId !== normalizePositiveNumber(windowId));
    for (const lockEntry of hostWindowLocks) {
      await closeDetachedWindowForLockEntry(lockEntry);
    }
    await removeDetachedWindowLockByWindowId(windowId);
  })().catch(error => {
    console.warn("[detached-window] failed to cleanup popup lock", {
      windowId,
      message: error instanceof Error ? error.message : String(error || "")
    });
  });
});

chrome.tabs?.onRemoved?.addListener(tabId => {
  (async () => {
    const locks = await readDetachedWindowLocks();
    for (const lockEntry of Object.values(locks)) {
      if (lockEntry?.mainTabId !== normalizePositiveNumber(tabId)) {
        continue;
      }
      await closeDetachedWindowForLockEntry(lockEntry);
    }
  })().catch(error => {
    console.warn("[detached-window] failed to cleanup popup after main tab removed", {
      tabId,
      message: error instanceof Error ? error.message : String(error || "")
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "OPEN_GROUP_DETACHED_WINDOW") {
    return false;
  }

  openDetachedWindowForGroup({
    ...message,
    tabId: normalizePositiveNumber(message?.tabId) ?? normalizePositiveNumber(sender?.tab?.id),
    mainTabId: normalizePositiveNumber(message?.mainTabId)
  }).then(result => {
    sendResponse(result);
  }).catch(error => {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error || "Unknown detached window error")
    });
  });

  return true;
});
