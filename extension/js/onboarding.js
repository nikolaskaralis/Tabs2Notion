import {
  connectWorkspace,
  getOAuthBackendUrl,
  hasBundledOAuthBackend,
  setOAuthBackendUrl
} from "./auth.js";
import { listDataSources } from "./notion.js";
import { getSettings, removeWorkspace, setSettings } from "./storage.js";

const pinPromptCard = document.getElementById("pinPromptCard");
const checkPinBtn = document.getElementById("checkPinBtn");
const pinStatus = document.getElementById("pinStatus");
const developerBackendCard = document.getElementById("developerBackendCard");
const backendUrl = document.getElementById("backendUrl");
const backendStatus = document.getElementById("backendStatus");
const connectStatus = document.getElementById("connectStatus");
const workspaceList = document.getElementById("workspaceList");
const connectBtn = document.getElementById("connectBtn");
const saveBackendBtn = document.getElementById("saveBackendBtn");
const defaultWorkspaceSelect = document.getElementById("defaultWorkspaceSelect");
const defaultDatabaseSelect = document.getElementById("defaultDatabaseSelect");
const closeTabsDefault = document.getElementById("closeTabsDefault");
const skipDialogDefault = document.getElementById("skipDialogDefault");
const toolbarActionSelect = document.getElementById("toolbarActionSelect");
const defaultStatus = document.getElementById("defaultStatus");

let currentSettings;
let databasesByWorkspace = new Map();

async function renderPinPrompt() {
  try {
    const userSettings = await chrome.action.getUserSettings();
    const isPinned = Boolean(userSettings?.isOnToolbar);
    pinPromptCard.hidden = isPinned;
    pinStatus.textContent = isPinned ? "" : "Not pinned yet.";
    return isPinned;
  } catch (error) {
    console.warn("Could not read Tabs2Notion pin status", error);
    pinPromptCard.hidden = false;
    pinStatus.textContent = "Pin status could not be detected automatically.";
    return false;
  }
}

async function loadDatabases(workspaceId) {
  if (!workspaceId) return [];
  if (databasesByWorkspace.has(workspaceId)) return databasesByWorkspace.get(workspaceId);
  defaultDatabaseSelect.disabled = true;
  defaultStatus.textContent = "Loading accessible databases…";
  try {
    const databases = await listDataSources(workspaceId);
    databasesByWorkspace.set(workspaceId, databases);
    defaultStatus.textContent = "";
    return databases;
  } catch (error) {
    defaultStatus.textContent = error.message || String(error);
    return [];
  } finally {
    defaultDatabaseSelect.disabled = false;
  }
}

async function renderDefaultControls() {
  currentSettings = await getSettings();
  const workspaces = Object.values(currentSettings.workspaces);

  defaultWorkspaceSelect.replaceChildren();
  const noneWorkspace = document.createElement("option");
  noneWorkspace.value = "";
  noneWorkspace.textContent = workspaces.length ? "Choose a workspace" : "Connect Notion first";
  defaultWorkspaceSelect.append(noneWorkspace);
  for (const workspace of workspaces) {
    const option = document.createElement("option");
    option.value = workspace.workspace_id;
    option.textContent = workspace.workspace_name || "Notion workspace";
    defaultWorkspaceSelect.append(option);
  }

  const workspaceId = currentSettings.defaultWorkspaceId && currentSettings.workspaces[currentSettings.defaultWorkspaceId]
    ? currentSettings.defaultWorkspaceId
    : "";
  defaultWorkspaceSelect.value = workspaceId;
  closeTabsDefault.checked = Boolean(currentSettings.closeTabsAfterSave);
  skipDialogDefault.checked = Boolean(currentSettings.useDefaultsWithoutDialog);
  toolbarActionSelect.value = currentSettings.toolbarAction || "menu";

  defaultDatabaseSelect.replaceChildren();
  const noneDatabase = document.createElement("option");
  noneDatabase.value = "";
  noneDatabase.textContent = workspaceId ? "Choose a database" : "Choose a workspace first";
  defaultDatabaseSelect.append(noneDatabase);

  if (!workspaceId) {
    defaultDatabaseSelect.disabled = true;
    return;
  }

  const databases = await loadDatabases(workspaceId);
  defaultDatabaseSelect.disabled = false;
  for (const database of databases) {
    const option = document.createElement("option");
    option.value = database.id;
    option.textContent = database.title;
    defaultDatabaseSelect.append(option);
  }
  if (currentSettings.defaultTarget?.id && databases.some((item) => item.id === currentSettings.defaultTarget.id)) {
    defaultDatabaseSelect.value = currentSettings.defaultTarget.id;
  }
}

async function render() {
  await renderPinPrompt();
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
  } else {
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
        databasesByWorkspace.delete(workspace.workspace_id);
        await render();
      });

      row.append(left, remove);
      workspaceList.append(row);
    }
  }

  await renderDefaultControls();
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
    databasesByWorkspace.clear();
    connectStatus.textContent = `Connected ${workspace.workspace_name || "Notion workspace"}.`;
    await render();
  } catch (error) {
    connectStatus.textContent = error.message || String(error);
  } finally {
    connectBtn.disabled = false;
  }
});

defaultWorkspaceSelect.addEventListener("change", async () => {
  const workspaceId = defaultWorkspaceSelect.value || null;
  await setSettings({ defaultWorkspaceId: workspaceId, defaultTarget: null });
  await renderDefaultControls();
});

defaultDatabaseSelect.addEventListener("change", async () => {
  const workspaceId = defaultWorkspaceSelect.value;
  const databases = databasesByWorkspace.get(workspaceId) || [];
  const target = databases.find((item) => item.id === defaultDatabaseSelect.value) || null;
  await setSettings({ defaultWorkspaceId: workspaceId || null, defaultTarget: target });
  defaultStatus.textContent = target ? `Default destination: ${target.title}` : "Default database cleared.";
});

closeTabsDefault.addEventListener("change", async () => {
  await setSettings({ closeTabsAfterSave: closeTabsDefault.checked });
  defaultStatus.textContent = closeTabsDefault.checked ? "Saved tabs will be closed." : "Saved tabs will stay open.";
});

skipDialogDefault.addEventListener("change", async () => {
  await setSettings({ useDefaultsWithoutDialog: skipDialogDefault.checked });
  defaultStatus.textContent = skipDialogDefault.checked
    ? "Actions will save immediately when a valid default database is set."
    : "Actions will open the destination picker.";
});

toolbarActionSelect.addEventListener("change", async () => {
  await setSettings({ toolbarAction: toolbarActionSelect.value });
  defaultStatus.textContent = toolbarActionSelect.value === "menu"
    ? "Clicking the pinned icon will open the action menu."
    : "Clicking the pinned icon will run the selected action.";
});

checkPinBtn.addEventListener("click", () => {
  renderPinPrompt().catch(console.warn);
});

window.addEventListener("focus", () => {
  renderPinPrompt().catch(console.warn);
});

document.getElementById("openDashboardBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

render().catch((error) => { connectStatus.textContent = error.message || String(error); });
