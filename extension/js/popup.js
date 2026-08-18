import { startOperation } from "./operations.js";
import { hostnameForUrl } from "./tabs.js";
import { getSettings, toggleExcludedHost } from "./storage.js";

const stateEl = document.getElementById("connectionState");
const defaultsSummary = document.getElementById("defaultsSummary");
const defaultsList = document.getElementById("defaultsList");
const groupBtn = document.getElementById("groupBtn");
const selectedBtn = document.getElementById("selectedBtn");
const leftBtn = document.getElementById("leftBtn");
const excludeBtn = document.getElementById("excludeBtn");

function setConnectionBadge(connected, text) {
  stateEl.className = connected ? "badge connected" : "badge neutral";
  stateEl.innerHTML = `<span class="badge-dot"></span><span>${text}</span>`;
}

function renderDefaultsSummary(settings) {
  const hasDefaults = Boolean(settings.useDefaultsWithoutDialog && settings.defaultWorkspaceId && settings.defaultTarget?.id);
  defaultsSummary.hidden = !hasDefaults;
  defaultsList.replaceChildren();
  if (!hasDefaults) return;

  const workspace = settings.workspaces[settings.defaultWorkspaceId];
  const items = [
    { icon: "🌐", text: workspace?.workspace_name || "Workspace" },
    { icon: "🗂", text: settings.defaultTarget?.title || "Database" },
    { icon: settings.closeTabsAfterSave ? "✓" : "•", text: `Close tabs: ${settings.closeTabsAfterSave ? "On" : "Off"}` }
  ];

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "summary-item";
    row.innerHTML = `<span class="summary-icon">${item.icon}</span><span>${item.text}</span>`;
    defaultsList.append(row);
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const highlighted = tab ? await chrome.tabs.query({ windowId: tab.windowId, highlighted: true }) : [];
  const settings = await getSettings();
  const workspaceCount = Object.keys(settings.workspaces).length;
  setConnectionBadge(workspaceCount > 0, workspaceCount ? `${workspaceCount} Notion workspace${workspaceCount === 1 ? "" : "s"} connected` : "Not connected to Notion");
  renderDefaultsSummary(settings);

  groupBtn.disabled = !(tab && tab.groupId != null && tab.groupId >= 0);
  selectedBtn.disabled = highlighted.length <= 1;
  leftBtn.disabled = !(tab && tab.index > 0);

  const host = hostnameForUrl(tab?.url || "");
  if (!host) {
    excludeBtn.disabled = true;
  } else {
    const excluded = settings.excludedHosts.includes(host);
    excludeBtn.querySelector('.menu-label').textContent = `${excluded ? "Include" : "Exclude"} ${host} ${excluded ? "in" : "from"} Tabs2Notion`;
  }

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const result = await startOperation(button.dataset.action, tab || null);
        if (result?.direct && result?.result) {
          const saved = result.result.successes.length;
          const failed = result.result.failures.length;
          setConnectionBadge(!failed, failed ? `${saved} saved · ${failed} failed` : `Sent ${saved} tab${saved === 1 ? '' : 's'} to Notion`);
          setTimeout(() => window.close(), failed ? 1500 : 850);
        } else {
          window.close();
        }
      } catch (error) {
        setConnectionBadge(false, error.message || String(error));
      } finally {
        button.disabled = false;
      }
    });
  });

  excludeBtn.addEventListener("click", async () => {
    if (!host) return;
    await toggleExcludedHost(host);
    window.close();
  });

  document.getElementById("settingsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());
  document.getElementById("dashboardBtn").addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    window.close();
  });
}

init().catch((error) => { setConnectionBadge(false, error.message || String(error)); });
