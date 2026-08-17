import { connectWorkspace } from "./auth.js";
import { getSettings, removeWorkspace } from "./storage.js";

const connectStatus = document.getElementById("connectStatus");
const workspaceList = document.getElementById("workspaceList");
const connectBtn = document.getElementById("connectBtn");

async function render() {
  const settings = await getSettings();
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
    icon.textContent = "🌐";
    const text = document.createElement("div");
    const name = document.createElement("div");
    name.className = "workspace-name";
    name.textContent = workspace.workspace_name || "Notion workspace";
    const meta = document.createElement("div");
    meta.className = "subtle";
    meta.textContent = workspace.needs_reauth
      ? "Connection expired — connect Notion again"
      : (workspace.user_name ? `Connected as ${workspace.user_name}` : "Connected");
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

connectBtn.addEventListener("click", async () => {
  connectBtn.disabled = true;
  connectStatus.textContent = "Opening Notion authorization…";
  try {
    const workspace = await connectWorkspace();
    connectStatus.textContent = `Connected ${workspace.workspace_name || "Notion workspace"}.`;
    await render();
  } catch (error) {
    connectStatus.textContent = error.message === "REAUTH_REQUIRED"
      ? "The Notion connection expired. Connect again."
      : (error.message || String(error));
  } finally {
    connectBtn.disabled = false;
  }
});

document.getElementById("openDashboardBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

render().catch((error) => { connectStatus.textContent = error.message || String(error); });
