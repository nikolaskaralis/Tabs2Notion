import { startOperation } from "./operations.js";
import { hostnameForUrl } from "./tabs.js";
import { getSettings, toggleExcludedHost } from "./storage.js";

const stateEl = document.getElementById("connectionState");
const groupBtn = document.getElementById("groupBtn");
const selectedBtn = document.getElementById("selectedBtn");
const leftBtn = document.getElementById("leftBtn");
const excludeBtn = document.getElementById("excludeBtn");

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const highlighted = tab ? await chrome.tabs.query({ windowId: tab.windowId, highlighted: true }) : [];
  const settings = await getSettings();
  const workspaceCount = Object.keys(settings.workspaces).length;
  stateEl.textContent = workspaceCount ? `${workspaceCount} Notion workspace${workspaceCount === 1 ? "" : "s"} connected` : "Not connected to Notion";

  groupBtn.disabled = !(tab && tab.groupId != null && tab.groupId >= 0);
  selectedBtn.disabled = highlighted.length <= 1;
  leftBtn.disabled = !(tab && tab.index > 0);

  const host = hostnameForUrl(tab?.url || "");
  if (!host) {
    excludeBtn.disabled = true;
  } else {
    const excluded = settings.excludedHosts.includes(host);
    excludeBtn.textContent = `${excluded ? "Include" : "Exclude"} ${host} ${excluded ? "in" : "from"} Tabs2Notion`;
  }

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await startOperation(button.dataset.action, tab || null);
        window.close();
      } catch (error) {
        stateEl.textContent = error.message || String(error);
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

init().catch((error) => { stateEl.textContent = error.message || String(error); });
