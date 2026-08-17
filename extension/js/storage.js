import { decryptString, encryptString } from "./crypto-storage.js";

const DEFAULTS = {
  oauthClient: null,
  workspaces: {},
  recentTargets: {},
  lastTargetByWorkspace: {},
  lastWorkspaceId: null,
  excludedHosts: [],
  closeTabsAfterSave: false
};

export async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

export async function setSettings(patch) {
  await chrome.storage.local.set(patch);
}

export async function getOAuthClient() {
  const { oauthClient } = await getSettings();
  if (!oauthClient) return null;
  return {
    ...oauthClient,
    client_secret: oauthClient.client_secret_encrypted
      ? await decryptString(oauthClient.client_secret_encrypted)
      : null
  };
}

export async function setOAuthClient(client) {
  if (!client) {
    await setSettings({ oauthClient: null });
    return;
  }
  const stored = { ...client };
  delete stored.client_secret;
  stored.client_secret_encrypted = client.client_secret ? await encryptString(client.client_secret) : null;
  await setSettings({ oauthClient: stored });
}

export async function getWorkspace(workspaceId) {
  const { workspaces } = await getSettings();
  const stored = workspaces[workspaceId];
  if (!stored) return null;
  return {
    ...stored,
    access_token: await decryptString(stored.access_token_encrypted || stored.access_token),
    refresh_token: await decryptString(stored.refresh_token_encrypted || stored.refresh_token)
  };
}

export async function upsertWorkspace(workspace) {
  const settings = await getSettings();
  const previous = settings.workspaces[workspace.workspace_id] || {};
  const stored = {
    ...previous,
    ...workspace,
    access_token_encrypted: workspace.access_token
      ? await encryptString(workspace.access_token)
      : previous.access_token_encrypted || null,
    refresh_token_encrypted: workspace.refresh_token
      ? await encryptString(workspace.refresh_token)
      : previous.refresh_token_encrypted || null
  };
  delete stored.access_token;
  delete stored.refresh_token;

  const next = { ...settings.workspaces, [workspace.workspace_id]: stored };
  await setSettings({ workspaces: next, lastWorkspaceId: workspace.workspace_id });
  return { ...workspace };
}

export async function markWorkspaceNeedsReauth(workspaceId) {
  const settings = await getSettings();
  const current = settings.workspaces[workspaceId];
  if (!current) return;
  const updated = { ...current, needs_reauth: true, access_token_encrypted: null, refresh_token_encrypted: null };
  await setSettings({ workspaces: { ...settings.workspaces, [workspaceId]: updated } });
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
  await setSettings({
    workspaces: nextWorkspaces,
    recentTargets: nextRecent,
    lastTargetByWorkspace: nextLast,
    lastWorkspaceId: settings.lastWorkspaceId === workspaceId ? (remainingIds[0] || null) : settings.lastWorkspaceId
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
