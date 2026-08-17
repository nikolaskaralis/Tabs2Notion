import {
  APP_NAME,
  NOTION_MCP_ENDPOINT,
  OAUTH_CLIENT_URI,
  TOKEN_REFRESH_SKEW_MS
} from "./config.js";
import { NotionMcpClient, contentJson, contentText } from "./mcp.js";
import {
  getOAuthClient,
  getWorkspace,
  markWorkspaceNeedsReauth,
  setOAuthClient,
  upsertWorkspace
} from "./storage.js";

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomBase64Url(byteLength = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) }
  });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    const detail = body.error_description || body.error || body.message || body.raw || `HTTP ${response.status}`;
    throw new Error(`${detail}`);
  }
  return body;
}

function protectedResourceCandidates(endpoint) {
  const url = new URL(endpoint);
  const path = url.pathname.replace(/^\//, "").replace(/\/$/, "");
  const candidates = [];
  if (path) {
    // Notion documents the resource-specific form for its /mcp endpoint.
    candidates.push(`${url.origin}/${path}/.well-known/oauth-protected-resource`);
    candidates.push(`${url.origin}/.well-known/oauth-protected-resource/${path}`);
  }
  candidates.push(`${url.origin}/.well-known/oauth-protected-resource`);
  return [...new Set(candidates)];
}

async function discoverOAuthMetadata() {
  let protectedResource = null;
  let lastError = null;
  for (const candidate of protectedResourceCandidates(NOTION_MCP_ENDPOINT)) {
    try {
      protectedResource = await fetchJson(candidate);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!protectedResource) throw new Error(`Could not discover Notion MCP OAuth metadata. ${lastError?.message || ""}`.trim());

  const authServer = protectedResource.authorization_servers?.[0];
  if (!authServer) throw new Error("Notion MCP did not advertise an authorization server.");
  const authUrl = new URL(authServer);
  const metadataCandidates = [`${authUrl.origin}/.well-known/oauth-authorization-server`];
  if (authUrl.pathname && authUrl.pathname !== "/") {
    const path = authUrl.pathname.replace(/^\//, "").replace(/\/$/, "");
    metadataCandidates.push(`${authUrl.origin}/.well-known/oauth-authorization-server/${path}`);
  }

  let metadata = null;
  lastError = null;
  for (const candidate of metadataCandidates) {
    try {
      metadata = await fetchJson(candidate);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!metadata) throw new Error(`Could not discover Notion OAuth endpoints. ${lastError?.message || ""}`.trim());
  if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.registration_endpoint) {
    throw new Error("Notion OAuth metadata is missing an authorization, token, or registration endpoint.");
  }
  return { ...metadata, protected_resource: protectedResource };
}

async function ensureOptionalHostAccess(url) {
  const origin = new URL(url).origin;
  if (origin === "https://mcp.notion.com") return;
  const pattern = `${origin}/*`;
  const already = await chrome.permissions.contains({ origins: [pattern] }).catch(() => false);
  if (already) return;
  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) throw new Error(`Tabs2Notion needs permission to contact Notion's OAuth endpoint at ${origin}.`);
}

async function getOrRegisterClient(metadata, redirectUri) {
  const existing = await getOAuthClient();
  if (
    existing?.client_id &&
    existing.redirect_uri === redirectUri &&
    existing.registration_endpoint === metadata.registration_endpoint
  ) return existing;

  await ensureOptionalHostAccess(metadata.registration_endpoint);
  const registration = await fetchJson(metadata.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: APP_NAME,
      client_uri: OAUTH_CLIENT_URI,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    })
  });
  if (!registration.client_id) throw new Error("Notion did not return an OAuth client ID.");

  const client = {
    client_id: registration.client_id,
    client_secret: registration.client_secret || null,
    client_id_issued_at: registration.client_id_issued_at || null,
    client_secret_expires_at: registration.client_secret_expires_at || null,
    redirect_uri: redirectUri,
    registration_endpoint: metadata.registration_endpoint
  };
  await setOAuthClient(client);
  return client;
}

function parseCallback(finalUrl, expectedState) {
  const url = new URL(finalUrl);
  const params = url.searchParams;
  if (params.get("error")) throw new Error(params.get("error_description") || params.get("error"));
  if (params.get("state") !== expectedState) throw new Error("Notion OAuth state mismatch. Please try connecting again.");
  const code = params.get("code");
  if (!code) throw new Error("Notion authorization completed without an authorization code.");
  return code;
}

async function exchangeCode(code, verifier, metadata, client, redirectUri) {
  await ensureOptionalHostAccess(metadata.token_endpoint);
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: client.client_id,
    redirect_uri: redirectUri,
    code_verifier: verifier
  });
  if (client.client_secret) params.set("client_secret", client.client_secret);
  return fetchJson(metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
}

function parseSelfIdentity(result) {
  const json = contentJson(result);
  if (json?.self) return json.self;
  const text = contentText(result);
  const workspaceName = text.match(/"workspace"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/s)?.[1];
  const userName = text.match(/"user"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/s)?.[1];
  return {
    workspace: workspaceName ? { name: workspaceName } : null,
    user: userName ? { name: userName } : null
  };
}

async function fetchIdentity(accessToken) {
  try {
    const client = new NotionMcpClient(accessToken);
    const tool = await client.findTool("notion-fetch", "fetch");
    const result = await client.callTool(tool.name, { id: "self" });
    return parseSelfIdentity(result);
  } catch (error) {
    console.warn("Could not read Notion workspace identity", error);
    return null;
  }
}

export async function connectWorkspace() {
  const metadata = await discoverOAuthMetadata();
  await Promise.all([
    ensureOptionalHostAccess(metadata.token_endpoint),
    ensureOptionalHostAccess(metadata.registration_endpoint)
  ]);

  const redirectUri = chrome.identity.getRedirectURL("notion");
  const oauthClient = await getOrRegisterClient(metadata, redirectUri);
  const verifier = randomBase64Url(32);
  const challenge = await pkceChallenge(verifier);
  const state = randomBase64Url(32);

  const authUrl = new URL(metadata.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", oauthClient.client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("prompt", "consent");


  const finalUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
  if (!finalUrl) throw new Error("Notion authorization did not return a result.");
  const code = parseCallback(finalUrl, state);
  const tokens = await exchangeCode(code, verifier, metadata, oauthClient, redirectUri);
  if (!tokens.access_token || !tokens.workspace_id) throw new Error("Notion returned incomplete OAuth credentials.");

  const identity = await fetchIdentity(tokens.access_token);
  const expiresAt = Number.isFinite(Number(tokens.expires_in))
    ? Date.now() + Number(tokens.expires_in) * 1000
    : null;

  const workspace = {
    workspace_id: tokens.workspace_id,
    workspace_name: identity?.workspace?.name || "Notion workspace",
    workspace_icon: null,
    user_id: tokens.user_id || identity?.user?.id || null,
    user_name: identity?.user?.name || null,
    email_domain: tokens.email_domain || null,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    token_type: tokens.token_type || "Bearer",
    scope: tokens.scope || null,
    expires_at: expiresAt,
    oauth_token_endpoint: metadata.token_endpoint,
    connected_at: new Date().toISOString(),
    needs_reauth: false
  };
  await upsertWorkspace(workspace);
  return workspace;
}

const refreshInFlight = new Map();

async function refreshWorkspaceTokenOnce(workspaceId) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Workspace is not connected.");
  if (!workspace.refresh_token) throw new Error("REAUTH_REQUIRED");

  const metadata = await discoverOAuthMetadata();
  const oauthClient = await getOrRegisterClient(metadata, chrome.identity.getRedirectURL("notion"));
  await ensureOptionalHostAccess(metadata.token_endpoint);

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: workspace.refresh_token,
    client_id: oauthClient.client_id
  });
  if (oauthClient.client_secret) params.set("client_secret", oauthClient.client_secret);

  let tokens;
  try {
    tokens = await fetchJson(metadata.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
  } catch (error) {
    if (/invalid_grant|invalid_client/i.test(error.message || "")) {
      await markWorkspaceNeedsReauth(workspaceId);
      throw new Error("REAUTH_REQUIRED");
    }
    throw error;
  }

  const expiresAt = Number.isFinite(Number(tokens.expires_in))
    ? Date.now() + Number(tokens.expires_in) * 1000
    : workspace.expires_at || null;
  const updated = {
    ...workspace,
    access_token: tokens.access_token || workspace.access_token,
    refresh_token: tokens.refresh_token || workspace.refresh_token,
    token_type: tokens.token_type || workspace.token_type,
    scope: tokens.scope || workspace.scope,
    expires_at: expiresAt,
    oauth_token_endpoint: metadata.token_endpoint,
    refreshed_at: new Date().toISOString(),
    needs_reauth: false
  };
  await upsertWorkspace(updated);
  return updated;
}

export async function refreshWorkspaceToken(workspaceId) {
  if (refreshInFlight.has(workspaceId)) return refreshInFlight.get(workspaceId);
  const promise = refreshWorkspaceTokenOnce(workspaceId).finally(() => refreshInFlight.delete(workspaceId));
  refreshInFlight.set(workspaceId, promise);
  return promise;
}

export async function getValidWorkspace(workspaceId) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Notion workspace is not connected.");
  if (workspace.needs_reauth || !workspace.access_token) throw new Error("REAUTH_REQUIRED");
  if (workspace.expires_at && Date.now() + TOKEN_REFRESH_SKEW_MS >= workspace.expires_at) {
    return refreshWorkspaceToken(workspaceId);
  }
  return workspace;
}
