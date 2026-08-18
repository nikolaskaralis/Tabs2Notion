const DEFAULTS = {
  workspaces: {},
  recentTargets: {},
  lastTargetByWorkspace: {},
  lastWorkspaceId: null,
  excludedHosts: [],
  closeTabsAfterSave: false,
  defaultWorkspaceId: null,
  defaultTarget: null,
  useDefaultsWithoutDialog: false,
  toolbarAction: "menu"
};

export async function ensureStoragePrivacy() {
  if (chrome.storage?.local?.setAccessLevel) {
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  }
}

export async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(patch) {
  await chrome.storage.local.set(patch);
}

export async function getWorkspace(workspaceId) {
  const { workspaces } = await getSettings();
  return workspaces[workspaceId] || null;
}

export async function upsertWorkspace(workspace) {
  const { workspaces } = await getSettings();
  const next = { ...workspaces, [workspace.workspace_id]: workspace };
  await setSettings({ workspaces: next, lastWorkspaceId: workspace.workspace_id });
  return workspace;
}

export async function removeWorkspace(workspaceId) {
  const settings = await getSettings();
  const nextWorkspaces = { ...settings.workspaces };
  delete nextWorkspaces[workspaceId];

  const nextRecent = { ...settings.recentTargets };
  delete nextRecent[workspaceId];

  const nextLast = { ...settings.lastTargetByWorkspace };
  delete nextLast[workspaceId];

  const remainingIds = Object.keys(nextWorkspaces);
  const removingDefault = settings.defaultWorkspaceId === workspaceId;

  await setSettings({
    workspaces: nextWorkspaces,
    recentTargets: nextRecent,
    lastTargetByWorkspace: nextLast,
    lastWorkspaceId: settings.lastWorkspaceId === workspaceId ? (remainingIds[0] || null) : settings.lastWorkspaceId,
    defaultWorkspaceId: removingDefault ? null : settings.defaultWorkspaceId,
    defaultTarget: removingDefault ? null : settings.defaultTarget
  });
}

export async function rememberTarget(workspaceId, target) {
  const settings = await getSettings();
  const current = settings.recentTargets[workspaceId] || [];
  const deduped = current.filter((item) => item.id !== target.id);
  const recentTargets = {
    ...settings.recentTargets,
    [workspaceId]: [target, ...deduped].slice(0, 8)
  };
  const lastTargetByWorkspace = {
    ...settings.lastTargetByWorkspace,
    [workspaceId]: target
  };
  await setSettings({ recentTargets, lastTargetByWorkspace, lastWorkspaceId: workspaceId });
}

export async function toggleExcludedHost(host) {
  if (!host) return false;
  const { excludedHosts } = await getSettings();
  const exists = excludedHosts.includes(host);
  const next = exists ? excludedHosts.filter((x) => x !== host) : [...excludedHosts, host].sort();
  await setSettings({ excludedHosts: next });
  return !exists;
}

export async function removeExcludedHost(host) {
  const { excludedHosts } = await getSettings();
  await setSettings({ excludedHosts: excludedHosts.filter((x) => x !== host) });
}

export async function savePendingOperation(operation) {
  const { pendingOps = {} } = await chrome.storage.session.get("pendingOps");
  pendingOps[operation.id] = operation;
  await chrome.storage.session.set({ pendingOps });
}

export async function getPendingOperation(id) {
  const { pendingOps = {} } = await chrome.storage.session.get("pendingOps");
  return pendingOps[id] || null;
}

export async function deletePendingOperation(id) {
  const { pendingOps = {} } = await chrome.storage.session.get("pendingOps");
  delete pendingOps[id];
  await chrome.storage.session.set({ pendingOps });
}
