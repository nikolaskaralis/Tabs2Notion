import { collectTabs } from "./tabs.js";
import { savePendingOperation } from "./storage.js";

export async function prepareOperation(action, contextTab = null) {
  const collected = await collectTabs(action, contextTab);
  const operation = {
    id: crypto.randomUUID(),
    action,
    createdAt: new Date().toISOString(),
    tabs: collected.tabs,
    skipped: collected.skipped,
    error: collected.error
  };
  await savePendingOperation(operation);
  return operation;
}

export async function openSelectorForOperation(operation) {
  const url = chrome.runtime.getURL(`selector.html?op=${encodeURIComponent(operation.id)}`);
  await chrome.windows.create({ url, type: "popup", width: 460, height: 680, focused: true });
}

export async function startOperation(action, contextTab = null) {
  const operation = await prepareOperation(action, contextTab);
  await openSelectorForOperation(operation);
  return operation;
}
