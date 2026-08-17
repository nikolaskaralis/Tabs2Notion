import { ACTIONS, hostnameForUrl } from "./js/tabs.js";
import { startOperation } from "./js/operations.js";
import { getSettings, toggleExcludedHost } from "./js/storage.js";

const MENU = {
  OPEN: "t2n-open",
  SEND_PARENT: "t2n-send-parent",
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

async function createMenus() {
  await chrome.contextMenus.removeAll();
  const contexts = ["action", "page", "tab"];

  chrome.contextMenus.create({ id: MENU.OPEN, title: "Open Tabs2Notion", contexts });
  chrome.contextMenus.create({ id: MENU.SEND_PARENT, title: "Send tabs to Notion", contexts });
  chrome.contextMenus.create({ id: MENU.CURRENT_WINDOW, parentId: MENU.SEND_PARENT, title: "All tabs in this window", contexts });
  chrome.contextMenus.create({ id: MENU.CURRENT_GROUP, parentId: MENU.SEND_PARENT, title: "Tabs in this tab group", contexts });
  chrome.contextMenus.create({ id: MENU.SELECTED, parentId: MENU.SEND_PARENT, title: "Selected tabs", contexts });
  chrome.contextMenus.create({ id: "t2n-sep-1", parentId: MENU.SEND_PARENT, type: "separator", contexts });
  chrome.contextMenus.create({ id: MENU.CURRENT_TAB, parentId: MENU.SEND_PARENT, title: "Only this tab", contexts });
  chrome.contextMenus.create({ id: MENU.EXCEPT_CURRENT, parentId: MENU.SEND_PARENT, title: "All tabs except this tab", contexts });
  chrome.contextMenus.create({ id: MENU.LEFT, parentId: MENU.SEND_PARENT, title: "Tabs on the left", contexts });
  chrome.contextMenus.create({ id: MENU.RIGHT, parentId: MENU.SEND_PARENT, title: "Tabs on the right", contexts });
  chrome.contextMenus.create({ id: MENU.ALL_WINDOWS, parentId: MENU.SEND_PARENT, title: "All tabs from all windows", contexts });
  chrome.contextMenus.create({ id: "t2n-sep-2", type: "separator", contexts });
  chrome.contextMenus.create({ id: MENU.EXCLUDE, title: "Exclude current site from Tabs2Notion", contexts });
  chrome.contextMenus.create({ id: "t2n-sep-3", type: "separator", contexts });
  chrome.contextMenus.create({ id: MENU.HELP, title: "Help", contexts });

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
  await createMenus();
  if (reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html?first=1") });
  }
});

chrome.runtime.onStartup.addListener(createMenus);
chrome.tabs.onActivated.addListener(async () => refreshContextMenuState());
chrome.tabs.onHighlighted.addListener(async () => refreshContextMenuState());
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === "complete")) await refreshContextMenuState(tab);
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
