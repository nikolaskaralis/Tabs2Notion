import { saveTabs } from "./notion.js";
import { collectTabs } from "./tabs.js";
import { showSavedNotification } from "./feedback.js";
import { getSettings, rememberTarget, savePendingOperation } from "./storage.js";

function makeOperation(action, collected) {
  return {
    id: crypto.randomUUID(),
    action,
    createdAt: new Date().toISOString(),
    tabs: collected.tabs,
    skipped: collected.skipped,
    error: collected.error
  };
}

export async function prepareOperation(action, contextTab = null) {
  const collected = await collectTabs(action, contextTab);
  const operation = makeOperation(action, collected);
  await savePendingOperation(operation);
  return operation;
}

export async function openSelectorForOperation(operation) {
  const url = chrome.runtime.getURL(`selector.html?op=${encodeURIComponent(operation.id)}`);
  await chrome.windows.create({ url, type: "popup", width: 460, height: 680, focused: true });
}

async function showBadge(text, timeout = 1800, color = "#1d6fff") {
  try {
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }).catch(() => {}), timeout);
  } catch {
    // Badge feedback is optional.
  }
}

async function saveWithDefaults(operation, settings) {
  const workspaceId = settings.defaultWorkspaceId;
  const target = settings.defaultTarget;
  if (!workspaceId || !settings.workspaces[workspaceId] || !target?.id) return null;

  const result = await saveTabs(workspaceId, target.id, operation.tabs);
  await rememberTarget(workspaceId, target);

  if (settings.closeTabsAfterSave && result.successes.length) {
    const ids = result.successes.map((item) => item.tab.id).filter(Number.isInteger);
    if (ids.length) {
      try { await chrome.tabs.remove(ids); } catch (error) { console.warn("Could not close one or more saved tabs", error); }
    }
  }

  await showBadge(result.failures.length ? "!" : "✓", 1800, result.failures.length ? "#b42318" : "#0f9d58");
  await showSavedNotification({
    title: result.failures.length ? "Tabs saved with some issues" : "Tabs saved to Notion",
    message: `${result.successes.length} tab${result.successes.length === 1 ? "" : "s"} ${result.failures.length ? `saved · ${result.failures.length} failed` : `saved to ${target.title}`}` ,
    isError: Boolean(result.failures.length)
  });
  if (result.failures.length) {
    console.warn("Tabs2Notion default save completed with failures", result.failures);
  }
  return result;
}

export async function startOperation(action, contextTab = null) {
  const collected = await collectTabs(action, contextTab);
  const operation = makeOperation(action, collected);
  const settings = await getSettings();

  if (settings.useDefaultsWithoutDialog && !operation.error && operation.tabs.length) {
    try {
      const result = await saveWithDefaults(operation, settings);
      if (result) return { ...operation, direct: true, result };
    } catch (error) {
      console.error("Tabs2Notion default save failed; falling back to selector", error);
      await showBadge("!");
    }
  }

  await savePendingOperation(operation);
  await openSelectorForOperation(operation);
  return operation;
}
