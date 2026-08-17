import { MIN_DATABASE_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS } from "./config.js";
import { searchDataSources, saveTabs } from "./notion.js";
import {
  deletePendingOperation,
  getPendingOperation,
  getSettings,
  rememberTarget,
  setSettings
} from "./storage.js";

const params = new URLSearchParams(location.search);
const opId = params.get("op");
const externalError = params.get("error");

const workspaceSelect = document.getElementById("workspaceSelect");
const targetName = document.getElementById("targetName");
const opSummary = document.getElementById("opSummary");
const searchInput = document.getElementById("searchInput");
const loading = document.getElementById("loading");
const recentSection = document.getElementById("recentSection");
const recentList = document.getElementById("recentList");
const allSection = document.getElementById("allSection");
const databaseList = document.getElementById("databaseList");
const emptyState = document.getElementById("emptyState");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const closeTabs = document.getElementById("closeTabs");
const saveStatus = document.getElementById("saveStatus");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const resultStatus = document.getElementById("resultStatus");

let settings;
let operation;
let currentWorkspaceId;
let searchResults = [];
let selectedTarget = null;
let saving = false;
let searchTimer = null;
let searchGeneration = 0;
let searching = false;

function databaseButton(item, isSelected = false) {
  const button = document.createElement("button");
  button.className = `db-item${isSelected ? " selected" : ""}`;
  button.type = "button";

  const icon = document.createElement("div");
  icon.className = "db-icon";
  icon.textContent = "◫";

  const info = document.createElement("div");
  const title = document.createElement("div");
  title.className = "db-title";
  title.textContent = item.title;
  const meta = document.createElement("div");
  meta.className = "db-meta";
  meta.textContent = item.dataSourceId ? "Notion database" : "Notion result";
  info.append(title, meta);

  const mark = document.createElement("div");
  mark.className = "checkmark";
  mark.textContent = isSelected ? "✓" : "";

  button.append(icon, info, mark);
  button.addEventListener("click", () => selectTarget(item));
  return button;
}

function sameTarget(a, b) {
  if (!a || !b) return false;
  return (a.dataSourceId && b.dataSourceId && a.dataSourceId === b.dataSourceId)
    || (a.url && b.url && a.url === b.url)
    || a.id === b.id;
}

function selectTarget(item) {
  selectedTarget = item;
  targetName.textContent = item.title;
  saveBtn.disabled = saving || !operation?.tabs?.length;
  renderLists();
}

function renderLists() {
  const query = searchInput.value.trim().toLowerCase();
  const recents = (settings.recentTargets[currentWorkspaceId] || [])
    .filter((item) => !query || item.title.toLowerCase().includes(query));

  recentList.replaceChildren(...recents.map((item) => databaseButton(item, sameTarget(item, selectedTarget))));
  recentSection.hidden = recents.length === 0;
  databaseList.replaceChildren(...searchResults.map((item) => databaseButton(item, sameTarget(item, selectedTarget))));
  allSection.hidden = searchResults.length === 0;

  loading.hidden = !searching;
  if (searching) loading.textContent = "Searching Notion…";

  const hasItems = recents.length > 0 || searchResults.length > 0;
  emptyState.hidden = searching || hasItems;
  emptyState.className = "status";
  if (!emptyState.hidden) {
    if (query.length >= MIN_DATABASE_SEARCH_LENGTH) {
      emptyState.textContent = "No matching results. Try the database's exact name.";
    } else if (recents.length) {
      emptyState.textContent = "";
    } else {
      emptyState.textContent = "Type a database name to search this workspace.";
    }
  }

  saveBtn.disabled = saving || !selectedTarget || !operation?.tabs?.length;
}

async function runSearch() {
  const query = searchInput.value.trim();
  const generation = ++searchGeneration;
  if (query.length < MIN_DATABASE_SEARCH_LENGTH) {
    searchResults = [];
    searching = false;
    renderLists();
    return;
  }

  searching = true;
  renderLists();
  try {
    const results = await searchDataSources(currentWorkspaceId, query);
    if (generation !== searchGeneration) return;
    searchResults = results;
  } catch (error) {
    if (generation !== searchGeneration) return;
    searchResults = [];
    emptyState.hidden = false;
    emptyState.className = "status error";
    emptyState.textContent = error.message === "REAUTH_REQUIRED"
      ? "Your Notion connection expired. Reconnect from Tabs2Notion settings."
      : (error.message || String(error));
  } finally {
    if (generation === searchGeneration) {
      searching = false;
      renderLists();
    }
  }
}

function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, SEARCH_DEBOUNCE_MS);
}

async function loadWorkspace(workspaceId) {
  currentWorkspaceId = workspaceId;
  selectedTarget = settings.lastTargetByWorkspace[workspaceId] || null;
  targetName.textContent = selectedTarget?.title || "Choose a database";
  searchInput.value = "";
  searchResults = [];
  searching = false;
  searchGeneration += 1;
  renderLists();
}

async function init() {
  settings = await getSettings();
  closeTabs.checked = Boolean(settings.closeTabsAfterSave);

  if (externalError) {
    loading.hidden = true;
    emptyState.hidden = false;
    emptyState.textContent = externalError;
    emptyState.className = "status error";
    document.querySelector(".selector-header").style.display = "none";
    document.querySelector(".selector-footer").style.display = "none";
    return;
  }

  operation = opId ? await getPendingOperation(opId) : null;
  if (!operation) {
    loading.hidden = true;
    emptyState.hidden = false;
    emptyState.textContent = "This tab-selection request has expired. Start again from the Tabs2Notion icon or context menu.";
    emptyState.className = "status error";
    saveBtn.disabled = true;
    return;
  }

  const skippedSuffix = operation.skipped?.length ? ` · ${operation.skipped.length} skipped` : "";
  opSummary.textContent = `${operation.tabs.length} tab${operation.tabs.length === 1 ? "" : "s"} ready${skippedSuffix}`;
  if (operation.error) {
    emptyState.hidden = false;
    emptyState.textContent = operation.error;
    emptyState.className = "status error";
  }

  const workspaces = Object.values(settings.workspaces);
  if (!workspaces.length) {
    loading.hidden = true;
    workspaceSelect.innerHTML = '<option value="">Not connected</option>';
    emptyState.hidden = false;
    emptyState.className = "status error";
    emptyState.textContent = "Connect a Notion workspace before saving tabs.";
    const connect = document.createElement("button");
    connect.className = "primary";
    connect.textContent = "Connect Notion";
    connect.style.marginTop = "10px";
    connect.addEventListener("click", () => chrome.runtime.openOptionsPage());
    emptyState.after(connect);
    saveBtn.disabled = true;
    return;
  }

  workspaceSelect.replaceChildren(...workspaces.map((workspace) => {
    const option = document.createElement("option");
    option.value = workspace.workspace_id;
    option.textContent = workspace.workspace_name || "Notion workspace";
    return option;
  }));

  const initialWorkspace = settings.lastWorkspaceId && settings.workspaces[settings.lastWorkspaceId]
    ? settings.lastWorkspaceId
    : workspaces[0].workspace_id;
  workspaceSelect.value = initialWorkspace;
  await loadWorkspace(initialWorkspace);
}

workspaceSelect.addEventListener("change", async () => {
  await setSettings({ lastWorkspaceId: workspaceSelect.value });
  await loadWorkspace(workspaceSelect.value);
});
searchInput.addEventListener("input", scheduleSearch);
closeTabs.addEventListener("change", () => setSettings({ closeTabsAfterSave: closeTabs.checked }));
cancelBtn.addEventListener("click", async () => {
  if (opId) await deletePendingOperation(opId);
  window.close();
});

saveBtn.addEventListener("click", async () => {
  if (saving || !selectedTarget || !operation?.tabs?.length) return;
  saving = true;
  saveBtn.disabled = true;
  cancelBtn.disabled = true;
  workspaceSelect.disabled = true;
  searchInput.disabled = true;
  saveStatus.hidden = false;
  resultStatus.hidden = true;
  progressBar.style.width = "0%";
  progressText.textContent = `Saving 0 of ${operation.tabs.length}…`;

  try {
    const result = await saveTabs(currentWorkspaceId, selectedTarget, operation.tabs, ({ completed, total, successes, failures }) => {
      progressBar.style.width = `${Math.round((completed / total) * 100)}%`;
      progressText.textContent = `Saving ${completed} of ${total} · ${successes} saved${failures ? ` · ${failures} failed` : ""}`;
    });

    const rememberedTarget = result.target || selectedTarget;
    selectedTarget = rememberedTarget;
    await rememberTarget(currentWorkspaceId, rememberedTarget);

    if (closeTabs.checked && result.successes.length) {
      const ids = result.successes.map((item) => item.tab.id).filter((id) => Number.isInteger(id));
      if (ids.length) {
        try { await chrome.tabs.remove(ids); } catch (error) { console.warn("Could not close one or more saved tabs", error); }
      }
    }

    resultStatus.hidden = false;
    if (result.failures.length) {
      resultStatus.className = "status error";
      resultStatus.textContent = `${result.successes.length} saved; ${result.failures.length} failed. ${result.failures[0].error}`;
      cancelBtn.disabled = false;
      cancelBtn.textContent = "Close";
    } else {
      resultStatus.className = "status success";
      resultStatus.textContent = `${result.successes.length} tab${result.successes.length === 1 ? "" : "s"} saved to ${rememberedTarget.title}.`;
      if (opId) await deletePendingOperation(opId);
      setTimeout(() => window.close(), 900);
    }
  } catch (error) {
    resultStatus.hidden = false;
    resultStatus.className = "status error";
    resultStatus.textContent = error.message === "REAUTH_REQUIRED"
      ? "Your Notion connection expired. Reconnect from Tabs2Notion settings."
      : (error.message || String(error));
    cancelBtn.disabled = false;
    cancelBtn.textContent = "Close";
  } finally {
    saving = false;
    workspaceSelect.disabled = false;
    searchInput.disabled = false;
  }
});

init().catch((error) => {
  loading.hidden = true;
  emptyState.hidden = false;
  emptyState.className = "status error";
  emptyState.textContent = error.message || String(error);
});
