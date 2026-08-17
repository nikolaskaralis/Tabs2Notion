import { APP_NAME, APP_VERSION, MCP_PROTOCOL_VERSION, NOTION_MCP_ENDPOINT } from "./config.js";

let nextRequestId = 1;

export class McpHttpError extends Error {
  constructor(message, status = null, body = null) {
    super(message);
    this.name = "McpHttpError";
    this.status = status;
    this.body = body;
  }
}

function parseSse(text) {
  const messages = [];
  for (const event of text.split(/\r?\n\r?\n/)) {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) continue;
    try { messages.push(JSON.parse(data)); } catch { /* ignore keepalive/non-JSON events */ }
  }
  return messages;
}

async function parseResponse(response, requestId = undefined) {
  if (response.status === 202 || response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const messages = parseSse(text);
    if (requestId !== undefined) {
      const matching = messages.findLast?.((message) => message?.id === requestId)
        || [...messages].reverse().find((message) => message?.id === requestId);
      if (matching) return matching;
    }
    return messages.length ? messages[messages.length - 1] : null;
  }
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export class NotionMcpClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.sessionId = null;
    this.initialized = false;
    this.protocolVersion = MCP_PROTOCOL_VERSION;
    this.tools = null;
  }

  async request(method, params = undefined, { notification = false } = {}) {
    const id = notification ? undefined : nextRequestId++;
    const payload = { jsonrpc: "2.0", method };
    if (id !== undefined) payload.id = id;
    if (params !== undefined) payload.params = params;

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    };
    // MCP requires the negotiated protocol version on requests after initialize.
    if (method !== "initialize") headers["MCP-Protocol-Version"] = this.protocolVersion;
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;

    const response = await fetch(NOTION_MCP_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const body = await parseResponse(response, id);
    if (!response.ok) {
      const detail = body?.error?.message || body?.message || body?.raw || `HTTP ${response.status}`;
      throw new McpHttpError(`Notion MCP request failed: ${detail}`, response.status, body);
    }

    const session = response.headers.get("Mcp-Session-Id");
    if (session) this.sessionId = session;
    if (notification) return null;
    if (body?.error) throw new Error(body.error.message || "Notion MCP returned an error.");
    return body?.result ?? body;
  }

  async initialize() {
    if (this.initialized) return;
    const result = await this.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: APP_NAME, version: APP_VERSION }
    });
    if (result?.protocolVersion) this.protocolVersion = result.protocolVersion;
    await this.request("notifications/initialized", undefined, { notification: true });
    this.initialized = true;
  }

  async listTools() {
    await this.initialize();
    if (!this.tools) {
      const tools = [];
      let cursor;
      do {
        const params = cursor ? { cursor } : {};
        const result = await this.request("tools/list", params);
        tools.push(...(result?.tools || []));
        cursor = result?.nextCursor || result?.next_cursor || null;
      } while (cursor);
      this.tools = tools;
    }
    return this.tools;
  }

  async findTool(...preferredNames) {
    const tools = await this.listTools();
    for (const name of preferredNames) {
      const exact = tools.find((tool) => tool.name === name);
      if (exact) return exact;
    }
    for (const name of preferredNames) {
      const suffix = name.replace(/^notion-/, "");
      const match = tools.find((tool) => tool.name === suffix || tool.name.endsWith(`-${suffix}`));
      if (match) return match;
    }
    throw new Error(`Required Notion MCP tool is unavailable: ${preferredNames[0]}`);
  }

  async callTool(name, args = {}) {
    await this.initialize();
    const result = await this.request("tools/call", { name, arguments: args });
    if (result?.isError) {
      const text = contentText(result);
      throw new Error(text || `${name} failed.`);
    }
    return result;
  }
}

export function contentText(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  const blocks = Array.isArray(result.content) ? result.content : [];
  return blocks
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

export function contentJson(result) {
  if (result?.structuredContent && typeof result.structuredContent === "object") return result.structuredContent;
  const text = contentText(result).trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}
