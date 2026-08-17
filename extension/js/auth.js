import { getSettings, setSettings, upsertWorkspace } from "./storage.js";

function normalizeBackendUrl(value) {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const url = new URL(trimmed);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("OAuth backend must use http:// or https://");
  return url.origin + url.pathname.replace(/\/$/, "");
}

function decodeBase64UrlJson(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function setOAuthBackendUrl(value) {
  const normalized = normalizeBackendUrl(value);
  await setSettings({ oauthBackendUrl: normalized });
  return normalized;
}

export async function connectWorkspace() {
  const { oauthBackendUrl } = await getSettings();
  const backend = normalizeBackendUrl(oauthBackendUrl);
  if (!backend) throw new Error("Configure the Tabs2Notion OAuth backend first.");

  const returnTo = chrome.identity.getRedirectURL("notion");
  const startUrl = `${backend}/oauth/start?return_to=${encodeURIComponent(returnTo)}`;
  const finalUrl = await chrome.identity.launchWebAuthFlow({ url: startUrl, interactive: true });
  if (!finalUrl) throw new Error("Notion authorization did not return a result.");

  const parsed = new URL(finalUrl);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const error = hash.get("error");
  if (error) throw new Error(hash.get("error_description") || error);
  const encodedPayload = hash.get("payload");
  if (!encodedPayload) throw new Error("Notion authorization completed without credentials.");

  const payload = decodeBase64UrlJson(encodedPayload);
  if (!payload.workspace_id || !payload.access_token || !payload.refresh_token) {
    throw new Error("Notion returned an incomplete authorization payload.");
  }

  const workspace = {
    workspace_id: payload.workspace_id,
    workspace_name: payload.workspace_name || "Notion workspace",
    workspace_icon: payload.workspace_icon || null,
    bot_id: payload.bot_id || null,
    owner: payload.owner || null,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    connected_at: new Date().toISOString()
  };
  await upsertWorkspace(workspace);
  return workspace;
}

export async function refreshWorkspaceToken(workspaceId) {
  const settings = await getSettings();
  const workspace = settings.workspaces[workspaceId];
  if (!workspace) throw new Error("Workspace is not connected.");
  const backend = normalizeBackendUrl(settings.oauthBackendUrl);
  if (!backend) throw new Error("OAuth backend is not configured.");

  const response = await fetch(`${backend}/oauth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: workspace.refresh_token })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error_description || body.error || `Token refresh failed (${response.status}).`);

  const updated = {
    ...workspace,
    access_token: body.access_token || workspace.access_token,
    refresh_token: body.refresh_token || workspace.refresh_token,
    refreshed_at: new Date().toISOString()
  };
  const workspaces = { ...settings.workspaces, [workspaceId]: updated };
  await setSettings({ workspaces });
  return updated;
}
