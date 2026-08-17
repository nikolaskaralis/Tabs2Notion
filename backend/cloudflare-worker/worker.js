const NOTION_AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";
const NOTION_VERSION = "2026-03-11";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (url.pathname === "/health") return json({ ok: true, service: "tabs2notion-oauth" });
    if (url.pathname === "/oauth/start" && request.method === "GET") return oauthStart(url, env);
    if (url.pathname === "/oauth/callback" && request.method === "GET") return oauthCallback(url, env);
    if (url.pathname === "/oauth/refresh" && request.method === "POST") return oauthRefresh(request, env);

    return new Response("Tabs2Notion OAuth backend", { status: 200 });
  }
};

async function oauthStart(url, env) {
  requireEnv(env, ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET", "OAUTH_REDIRECT_URI", "STATE_SECRET"]);
  const returnTo = url.searchParams.get("return_to");
  if (!isAllowedExtensionReturnUrl(returnTo)) return json({ error: "invalid_return_to" }, 400);

  const state = await signState({
    returnTo,
    nonce: crypto.randomUUID(),
    exp: Date.now() + 10 * 60 * 1000
  }, env.STATE_SECRET);

  const auth = new URL(NOTION_AUTHORIZE_URL);
  auth.searchParams.set("owner", "user");
  auth.searchParams.set("client_id", env.NOTION_CLIENT_ID);
  auth.searchParams.set("redirect_uri", env.OAUTH_REDIRECT_URI);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("state", state);

  return Response.redirect(auth.toString(), 302);
}

async function oauthCallback(url, env) {
  requireEnv(env, ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET", "OAUTH_REDIRECT_URI", "STATE_SECRET"]);
  const stateRaw = url.searchParams.get("state");
  const state = await verifyState(stateRaw, env.STATE_SECRET).catch(() => null);
  if (!state || state.exp < Date.now() || !isAllowedExtensionReturnUrl(state.returnTo)) {
    return new Response("Invalid or expired OAuth state.", { status: 400 });
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return redirectFragment(state.returnTo, {
      error: oauthError,
      error_description: url.searchParams.get("error_description") || "Notion authorization was cancelled or denied."
    });
  }

  const code = url.searchParams.get("code");
  if (!code) return redirectFragment(state.returnTo, { error: "missing_code", error_description: "Notion did not return an authorization code." });

  const tokenResponse = await notionTokenRequest(env, {
    grant_type: "authorization_code",
    code,
    redirect_uri: env.OAUTH_REDIRECT_URI
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.json().catch(() => ({}));
    return redirectFragment(state.returnTo, {
      error: body.error || "token_exchange_failed",
      error_description: body.error_description || body.message || `Notion token exchange failed (${tokenResponse.status}).`
    });
  }

  const token = await tokenResponse.json();
  const payload = base64UrlEncodeJson({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    bot_id: token.bot_id,
    workspace_id: token.workspace_id,
    workspace_name: token.workspace_name,
    workspace_icon: token.workspace_icon,
    owner: token.owner
  });

  return redirectFragment(state.returnTo, { payload });
}

async function oauthRefresh(request, env) {
  requireEnv(env, ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET"]);
  const body = await request.json().catch(() => ({}));
  if (!body.refresh_token || typeof body.refresh_token !== "string") return json({ error: "missing_refresh_token" }, 400);

  const response = await notionTokenRequest(env, {
    grant_type: "refresh_token",
    refresh_token: body.refresh_token
  });
  const tokenBody = await response.json().catch(() => ({}));
  return cors(json(tokenBody, response.status));
}

async function notionTokenRequest(env, body) {
  const basic = btoa(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`);
  return fetch(NOTION_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${basic}`,
      "Notion-Version": NOTION_VERSION
    },
    body: JSON.stringify(body)
  });
}

function requireEnv(env, keys) {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing Worker configuration: ${missing.join(", ")}`);
}

function isAllowedExtensionReturnUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname.endsWith(".chromiumapp.org")) return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function redirectFragment(returnTo, values) {
  const fragment = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value != null) fragment.set(key, String(value));
  }
  return Response.redirect(`${returnTo}#${fragment.toString()}`, 302);
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function cors(response) {
  const next = new Response(response.body, response);
  next.headers.set("Access-Control-Allow-Origin", "*");
  next.headers.set("Access-Control-Allow-Headers", "Content-Type");
  next.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return next;
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64UrlEncodeJson(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signState(value, secret) {
  const payload = base64UrlEncodeJson(value);
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function verifyState(signed, secret) {
  if (!signed || !signed.includes(".")) throw new Error("Missing OAuth state");
  const [payload, signature] = signed.split(".");
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecodeBytes(signature),
    new TextEncoder().encode(payload)
  );
  if (!ok) throw new Error("Invalid OAuth state signature");
  return JSON.parse(new TextDecoder().decode(base64UrlDecodeBytes(payload)));
}
