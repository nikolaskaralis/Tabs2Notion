import { getSettings } from "./storage.js";

export const ACTIONS = Object.freeze({
  CURRENT_WINDOW: "current-window",
  CURRENT_GROUP: "current-group",
  SELECTED: "selected",
  CURRENT_TAB: "current-tab",
  EXCEPT_CURRENT: "except-current",
  LEFT: "left",
  RIGHT: "right",
  ALL_WINDOWS: "all-windows"
});

export function hostnameForUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

export function isSendableUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeTab(tab) {
  return {
    id: tab.id,
    windowId: tab.windowId,
    index: tab.index,
    groupId: tab.groupId,
    active: Boolean(tab.active),
    highlighted: Boolean(tab.highlighted),
    pinned: Boolean(tab.pinned),
    title: tab.title || tab.url || "Untitled tab",
    url: tab.url || "",
    favIconUrl: tab.favIconUrl || null
  };
}

async function activeTab(fallbackTab) {
  if (fallbackTab?.id != null) return fallbackTab;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

export async function collectTabs(action, contextTab = null) {
  const current = await activeTab(contextTab);
  let rawTabs = [];

  switch (action) {
    case ACTIONS.CURRENT_WINDOW:
      rawTabs = current ? await chrome.tabs.query({ windowId: current.windowId }) : [];
      break;
    case ACTIONS.CURRENT_GROUP: {
      if (!current || current.groupId == null || current.groupId < 0) return { tabs: [], skipped: [], error: "The current tab is not in a tab group." };
      const windowTabs = await chrome.tabs.query({ windowId: current.windowId });
      rawTabs = windowTabs.filter((tab) => tab.groupId === current.groupId);
      break;
    }
    case ACTIONS.SELECTED:
      rawTabs = current ? await chrome.tabs.query({ windowId: current.windowId, highlighted: true }) : [];
      break;
    case ACTIONS.CURRENT_TAB:
      rawTabs = current ? [current] : [];
      break;
    case ACTIONS.EXCEPT_CURRENT: {
      const windowTabs = current ? await chrome.tabs.query({ windowId: current.windowId }) : [];
      rawTabs = windowTabs.filter((tab) => tab.id !== current?.id);
      break;
    }
    case ACTIONS.LEFT: {
      const windowTabs = current ? await chrome.tabs.query({ windowId: current.windowId }) : [];
      rawTabs = windowTabs.filter((tab) => tab.index < current.index);
      break;
    }
    case ACTIONS.RIGHT: {
      const windowTabs = current ? await chrome.tabs.query({ windowId: current.windowId }) : [];
      rawTabs = windowTabs.filter((tab) => tab.index > current.index);
      break;
    }
    case ACTIONS.ALL_WINDOWS:
      rawTabs = await chrome.tabs.query({});
      break;
    default:
      return { tabs: [], skipped: [], error: `Unknown tab action: ${action}` };
  }

  const { excludedHosts } = await getSettings();
  const tabs = [];
  const skipped = [];

  for (const raw of rawTabs) {
    const tab = normalizeTab(raw);
    const host = hostnameForUrl(tab.url);
    if (!isSendableUrl(tab.url)) {
      skipped.push({ tab, reason: "Unsupported browser/internal URL" });
      continue;
    }
    if (host && excludedHosts.includes(host)) {
      skipped.push({ tab, reason: `Excluded domain: ${host}` });
      continue;
    }
    tabs.push(tab);
  }

  return { tabs, skipped, error: tabs.length ? null : (skipped.length ? "All matching tabs were excluded or unsupported." : "No matching tabs found.") };
}
