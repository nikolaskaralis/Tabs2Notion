import { connectWorkspace } from "./auth.js";
import { startOperation } from "./operations.js";
import { getSettings, removeExcludedHost } from "./storage.js";

const workspaceList = document.getElementById("workspaceList");
const excludedList = document.getElementById("excludedList");
const status = document.getElementById("status");

function workspaceCard(ws) {
  const row = document.createElement("div");
  row.className = "setting-row";

  const icon = document.createElement("div");
  icon.className = "workspace-icon setting-icon";
  const workspaceIcon = ws.workspace_icon || "";
  if (/^https?:\/\//i.test(workspaceIcon)) {
    const img = document.createElement("img");
    img.src = workspaceIcon;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => {
      img.remove();
      icon.textContent = "🌐";
    }, { once: true });
    icon.append(img);
  } else if (workspaceIcon) {
    icon.textContent = workspaceIcon;
  } else {
    icon.textContent = "🌐";
  }

  const copy = document.createElement("div");
  copy.className = "setting-copy";
  copy.innerHTML = `<div class="setting-title">${ws.workspace_name || 'Notion workspace'}</div><div class="subtle">${ws.workspace_id}</div>`;

  const state = document.createElement("span");
  state.className = "badge connected";
  state.innerHTML = '<span class="badge-dot"></span><span>Connected</span>';

  row.append(icon, copy, state);
  return row;
}

async function render() {
  const settings = await getSettings();
  const workspaces = Object.values(settings.workspaces);
  workspaceList.replaceChildren();
  if (!workspaces.length) {
    const p = document.createElement("div"); p.className = "status"; p.textContent = "No workspaces connected."; workspaceList.append(p);
  } else {
    workspaceList.append(...workspaces.map(workspaceCard));
  }

  excludedList.replaceChildren();
  if (!settings.excludedHosts.length) {
    const p = document.createElement("div"); p.className = "subtle"; p.textContent = "No sites excluded."; excludedList.append(p);
  } else {
    for (const host of settings.excludedHosts) {
      const row = document.createElement("div"); row.className = "setting-row";
      row.style.gridTemplateColumns = '40px 1fr auto';
      row.innerHTML = `<div class="setting-icon">⊘</div><div class="setting-copy"><div class="setting-title">${host}</div><div class="subtle">Excluded from tab collection</div></div>`;
      const remove = document.createElement("button"); remove.className = "secondary"; remove.textContent = "Remove";
      remove.addEventListener("click", async () => { await removeExcludedHost(host); await render(); });
      row.append(remove);
      excludedList.append(row);
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
