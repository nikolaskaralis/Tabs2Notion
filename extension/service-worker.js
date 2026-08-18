import { ACTIONS, hostnameForUrl } from "./js/tabs.js";
import { startOperation } from "./js/operations.js";
import { applyActionIcon } from "./js/icon.js";
import { ensureStoragePrivacy, getSettings, toggleExcludedHost } from "./js/storage.js";

const MENU = {
  OPEN: "t2n-open",
  CURRENT_WINDOW: "t2n-current-window",
  CURRENT_GROUP: "t2n-current-group",
  SELECTED: "t2n-selected",
  CURRENT_TAB: "t2n-current-tab",
  EXCEPT_CURRENT: "t2n-except-current",
  LEFT: "t2n-left",
  RIGHT: "t2n-right",
  ALL_WINDOWS: "t2n-all-windows",
  EXCLUDE: "t2n-exclude",
  HELP: "t2n-help"
};

const actionMap = {
  [MENU.CURRENT_WINDOW]: ACTIONS.CURRENT_WINDOW,
  [MENU.CURRENT_GROUP]: ACTIONS.CURRENT_GROUP,
  [MENU.SELECTED]: ACTIONS.SELECTED,
  [MENU.CURRENT_TAB]: ACTIONS.CURRENT_TAB,
  [MENU.EXCEPT_CURRENT]: ACTIONS.EXCEPT_CURRENT,
  [MENU.LEFT]: ACTIONS.LEFT,
  [MENU.RIGHT]: ACTIONS.RIGHT,
  [MENU.ALL_WINDOWS]: ACTIONS.ALL_WINDOWS
};

async function applyToolbarBehavior() {
  const settings = await getSettings();
  const popup = settings.toolbarAction === "menu" ? "popup.html" : "";
  await chrome.action.setPopup({ popup });
}

async function createMenus() {
  await chrome.contextMenus.removeAll();
  const pageContexts = ["page", "tab"];
  const allContexts = ["action", "page", "tab"];

  chrome.contextMenus.create({ id: MENU.OPEN, title: "Open Tabs2Notion", contexts: allContexts });
  chrome.contextMenus.create({ id: MENU.CURRENT_WINDOW, title: "Send all tabs in this window to Notion", contexts: pageContexts });
  chrome.contextMenus.create({ id: MENU.CURRENT_GROUP, title: "Send all tabs in this tab group to Notion", contexts: pageContexts });
  chrome.contextMenus.create({ id: MENU.SELECTED, title: "Send selected tabs to Notion", contexts: pageContexts });
  chrome.contextMenus.create({ id: "t2n-sep-1", type: "separator", contexts: pageContexts });
  chrome.contextMenus.create({ id: MENU.CURRENT_TAB, title: "Send only this tab to Notion", contexts: pageContexts });
  chrome.contextMenus.create({ id: MENU.EXCEPT_CURRENT, title: "Send all tabs except this tab to Notion", contexts: pageContexts });
  chrome.contextMenus.create({ id: MENU.LEFT, title: "Send tabs on the left to Notion", contexts: pageContexts });
  chrome.contextMenus.create({ id: MENU.RIGHT, title: "Send tabs on the right to Notion", contexts: pageContexts });
  chrome.contextMenus.create({ id: MENU.ALL_WINDOWS, title: "Send all tabs from all windows to Notion", contexts: pageContexts });
  chrome.contextMenus.create({ id: "t2n-sep-2", type: "separator", contexts: pageContexts });
  chrome.contextMenus.create({ id: MENU.EXCLUDE, title: "Exclude current site from Tabs2Notion", contexts: pageContexts });
  chrome.contextMenus.create({ id: "t2n-sep-3", type: "separator", contexts: pageContexts });
  chrome.contextMenus.create({ id: MENU.HELP, title: "Help", contexts: allContexts });

  await refreshContextMenuState();
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function refreshContextMenuState(tab = null) {
  try {
    const current = tab || await getCurrentTab();
    const highlighted = current ? await chrome.tabs.query({ windowId: current.windowId, highlighted: true }) : [];
    const windowTabs = current ? await chrome.tabs.query({ windowId: current.windowId }) : [];
    const maxIndex = windowTabs.reduce((max, item) => Math.max(max, item.index ?? -1), -1);
    const host = hostnameForUrl(current?.url || "");
    const { excludedHosts } = await getSettings();
    const isExcluded = host ? excludedHosts.includes(host) : false;

    await Promise.all([
      chrome.contextMenus.update(MENU.CURRENT_GROUP, { enabled: Boolean(current && current.groupId != null && current.groupId >= 0) }),
      chrome.contextMenus.update(MENU.SELECTED, { enabled: highlighted.length > 1 }),
      chrome.contextMenus.update(MENU.EXCEPT_CURRENT, { enabled: windowTabs.length > 1 }),
      chrome.contextMenus.update(MENU.LEFT, { enabled: Boolean(current && current.index > 0) }),
      chrome.contextMenus.update(MENU.RIGHT, { enabled: Boolean(current && current.index < maxIndex) }),
      chrome.contextMenus.update(MENU.EXCLUDE, {
        enabled: Boolean(host),
        title: host ? `${isExcluded ? "Include" : "Exclude"} ${host} ${isExcluded ? "in" : "from"} Tabs2Notion` : "Exclude current site from Tabs2Notion"
      })
    ]);
  } catch (error) {
    console.warn("Could not refresh Tabs2Notion context menu state", error);
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await Promise.all([ensureStoragePrivacy(), createMenus(), applyToolbarBehavior(), applyActionIcon()]);
  if (reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html?first=1") });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await Promise.all([ensureStoragePrivacy(), createMenus(), applyToolbarBehavior(), applyActionIcon()]);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.toolbarAction) applyToolbarBehavior().catch(console.warn);
});

chrome.tabs.onActivated.addListener(async () => refreshContextMenuState());
chrome.tabs.onHighlighted.addListener(async () => refreshContextMenuState());
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === "complete")) await refreshContextMenuState(tab);
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    const settings = await getSettings();
    if (settings.toolbarAction && settings.toolbarAction !== "menu") {
      await startOperation(settings.toolbarAction, tab || null);
    }
  } catch (error) {
    console.error("Tabs2Notion toolbar action failed", error);
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU.OPEN) {
      await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
      return;
    }
    if (info.menuItemId === MENU.HELP) {
      await chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
      return;
    }
    if (info.menuItemId === MENU.EXCLUDE) {
      const host = hostnameForUrl(tab?.url || (await getCurrentTab())?.url || "");
      if (host) await toggleExcludedHost(host);
      await refreshContextMenuState(tab || null);
      return;
    }
    const action = actionMap[info.menuItemId];
    if (action) await startOperation(action, tab || null);
  } catch (error) {
    console.error("Tabs2Notion context-menu action failed", error);
    const operationUrl = chrome.runtime.getURL(`selector.html?error=${encodeURIComponent(error.message || String(error))}`);
    await chrome.windows.create({ url: operationUrl, type: "popup", width: 460, height: 440, focused: true });
  }
});

applyToolbarBehavior().catch(console.warn);
ensureStoragePrivacy().catch(console.warn);
applyActionIcon().catch(console.warn);
