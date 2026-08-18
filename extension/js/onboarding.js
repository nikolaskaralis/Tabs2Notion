import {
  connectWorkspace,
  getOAuthBackendUrl,
  hasBundledOAuthBackend,
  setOAuthBackendUrl
} from "./auth.js";
import { getSettings, removeWorkspace } from "./storage.js";

const developerBackendCard = document.getElementById("developerBackendCard");
const backendUrl = document.getElementById("backendUrl");
const backendStatus = document.getElementById("backendStatus");
const connectStatus = document.getElementById("connectStatus");
const workspaceList = document.getElementById("workspaceList");
const connectBtn = document.getElementById("connectBtn");
const saveBackendBtn = document.getElementById("saveBackendBtn");

async function render() {
  const settings = await getSettings();
  const bundledBackend = hasBundledOAuthBackend();
  developerBackendCard.hidden = bundledBackend;
  backendUrl.value = bundledBackend ? await getOAuthBackendUrl() : (settings.oauthBackendUrl || "");

  const workspaces = Object.values(settings.workspaces);
  workspaceList.replaceChildren();

  if (!workspaces.length) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = "No Notion workspaces connected yet.";
    workspaceList.append(empty);
    return;
  }

  for (const workspace of workspaces) {
    const row = document.createElement("div");
    row.className = "row-between";
    row.style.padding = "8px 0";

    const left = document.createElement("div");
    left.className = "workspace-pill";
    const icon = document.createElement("div");
    icon.className = "workspace-icon";
    if (workspace.workspace_icon) {
      const img = document.createElement("img");
      img.src = workspace.workspace_icon;
      img.alt = "";
      icon.append(img);
    } else {
      icon.textContent = "🌐";
    }
    const text = document.createElement("div");
    const name = document.createElement("div");
    name.className = "workspace-name";
    name.textContent = workspace.workspace_name || "Notion workspace";
    const meta = document.createElement("div");
    meta.className = "subtle";
    meta.textContent = "Connected";
    text.append(name, meta);
    left.append(icon, text);

    const remove = document.createElement("button");
    remove.className = "danger-button";
    remove.textContent = "Disconnect";
    remove.addEventListener("click", async () => {
      await removeWorkspace(workspace.workspace_id);
      await render();
    });

    row.append(left, remove);
    workspaceList.append(row);
  }
}

saveBackendBtn.addEventListener("click", async () => {
  try {
    const saved = await setOAuthBackendUrl(backendUrl.value);
    backendStatus.textContent = saved ? `Saved ${saved}` : "Backend URL cleared.";
  } catch (error) {
    backendStatus.textContent = error.message || String(error);
  }
});

connectBtn.addEventListener("click", async () => {
  connectBtn.disabled = true;
  connectStatus.textContent = "Opening Notion authorization…";
  try {
    if (!hasBundledOAuthBackend()) await setOAuthBackendUrl(backendUrl.value);
    const workspace = await connectWorkspace();
    connectStatus.textContent = `Connected ${workspace.workspace_name || "Notion workspace"}.`;
    await render();
  } catch (error) {
    connectStatus.textContent = error.message || String(error);
  } finally {
    connectBtn.disabled = false;
  }
});

document.getElementById("openDashboardBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

render().catch((error) => { connectStatus.textContent = error.message || String(error); });
