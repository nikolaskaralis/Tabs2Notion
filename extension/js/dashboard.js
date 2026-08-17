import { connectWorkspace } from "./auth.js";
import { startOperation } from "./operations.js";
import { getSettings, removeExcludedHost } from "./storage.js";

const workspaceList = document.getElementById("workspaceList");
const excludedList = document.getElementById("excludedList");
const status = document.getElementById("status");

async function render() {
  const settings = await getSettings();
  const workspaces = Object.values(settings.workspaces);
  workspaceList.replaceChildren();
  if (!workspaces.length) {
    const p = document.createElement("div"); p.className = "status"; p.textContent = "No workspaces connected."; workspaceList.append(p);
  } else {
    for (const ws of workspaces) {
      const row = document.createElement("div"); row.className = "row-between"; row.style.padding = "8px 0";
      const name = document.createElement("div"); name.textContent = ws.workspace_name || "Notion workspace";
      const meta = document.createElement("div"); meta.className = "subtle"; meta.textContent = ws.workspace_id;
      const left = document.createElement("div"); left.append(name, meta);
      row.append(left);
      workspaceList.append(row);
    }
  }

  excludedList.replaceChildren();
  if (!settings.excludedHosts.length) {
    const p = document.createElement("div"); p.className = "subtle"; p.textContent = "No sites excluded."; excludedList.append(p);
  } else {
    for (const host of settings.excludedHosts) {
      const row = document.createElement("div"); row.className = "row-between"; row.style.padding = "7px 0";
      const label = document.createElement("code"); label.textContent = host;
      const remove = document.createElement("button"); remove.className = "secondary"; remove.textContent = "Remove";
      remove.addEventListener("click", async () => { await removeExcludedHost(host); await render(); });
      row.append(label, remove); excludedList.append(row);
    }
  }
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    try { await startOperation(button.dataset.action); }
    catch (error) { status.textContent = error.message || String(error); }
  });
});

document.getElementById("settingsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());
document.getElementById("connectBtn").addEventListener("click", async () => {
  try { const ws = await connectWorkspace(); status.textContent = `Connected ${ws.workspace_name}.`; await render(); }
  catch (error) { status.textContent = error.message || String(error); }
});

render().catch((error) => { status.textContent = error.message || String(error); });
