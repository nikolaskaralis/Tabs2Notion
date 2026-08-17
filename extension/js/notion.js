import {
  CREATE_BATCH_SIZE,
  CREATE_REQUEST_SPACING_MS,
  MAX_RETRIES
} from "./config.js";
import { getValidWorkspace, refreshWorkspaceToken } from "./auth.js";
import { McpHttpError, NotionMcpClient, contentJson, contentText } from "./mcp.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeId(value) {
  return String(value || "").replace(/^collection:\/\//, "").trim();
}

function safeJsonParse(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function walk(value, visit, path = []) {
  if (value == null) return;
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, [...path, index]));
  } else if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walk(item, visit, [...path, key]));
  }
}

export function extractDataSourceIdFromText(text) {
  if (!text) return null;
  const collection = String(text).match(/collection:\/\/([0-9a-f-]{32,36})/i)?.[1];
  if (collection) return collection;
  return String(text).match(/"data_source_id"\s*:\s*"([0-9a-f-]{32,36})"/i)?.[1] || null;
}

function extractDataSourceId(value) {
  let found = null;
  walk(value, (node, path) => {
    if (found || typeof node !== "string") return;
    const key = String(path[path.length - 1] || "").toLowerCase();
    if (key === "data_source_id") found = normalizeId(node);
    else if (node.startsWith("collection://")) found = normalizeId(node);
  });
  return found;
}

function propertyKey(name) {
  return /^(id|url)$/i.test(String(name || "")) ? `userDefined:${name}` : name;
}

export function extractSchemaPropertiesFromText(text) {
  const source = String(text || "");
  let titlePropertyName = null;
  let urlPropertyName = null;

  // Notion MCP fetch returns the data-source schema as SQLite-like DDL, e.g.
  // CREATE TABLE ("Name" TITLE, "URL" URL, ...).
  const regex = /"((?:[^"]|"")+)"\s+(TITLE|URL)\b/gi;
  let match;
  while ((match = regex.exec(source))) {
    const name = match[1].replace(/""/g, '"');
    const type = match[2].toUpperCase();
    if (type === "TITLE" && !titlePropertyName) titlePropertyName = propertyKey(name);
    if (type === "URL" && !urlPropertyName) urlPropertyName = propertyKey(name);
  }
  return { titlePropertyName, urlPropertyName };
}

function extractSchemaProperties(value) {
  let titlePropertyName = null;
  let urlPropertyName = null;
  walk(value, (node, path) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const type = String(node.type || node.property_type || "").toLowerCase();
    const fallbackName = typeof path[path.length - 1] === "string" ? path[path.length - 1] : null;
    const name = node.name || fallbackName;
    if (!name) return;
    if (type === "title" && !titlePropertyName) titlePropertyName = propertyKey(String(name));
    if (type === "url" && !urlPropertyName) urlPropertyName = propertyKey(String(name));
  });
  return { titlePropertyName, urlPropertyName };
}

function resultPayload(result) {
  return contentJson(result) || safeJsonParse(contentText(result)) || contentText(result);
}

function candidateFromObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const title = obj.title || obj.name || obj?.properties?.title || obj?.highlight;
  const url = obj.url || obj.href || obj.page_url || obj.database_url || null;
  const id = obj.id || obj.page_id || obj.database_id || obj.data_source_id || url;
  if (!id || !title) return null;
  return {
    id: String(id),
    title: typeof title === "string" ? title : String(title?.plain_text || title?.text || "Untitled Notion item"),
    url: url ? String(url) : null,
    type: String(obj.type || obj.object || obj.kind || "result"),
    dataSourceId: obj.data_source_id ? normalizeId(obj.data_source_id) : null
  };
}

export function parseSearchCandidates(payload, query = "") {
  const candidates = [];
  const seen = new Set();
  if (typeof payload === "string") {
    const parsed = safeJsonParse(payload);
    if (parsed) return parseSearchCandidates(parsed, query);
    const urlRegex = /https:\/\/(?:www\.)?notion\.(?:so|com)\/[^\s)\]}>"']+/gi;
    for (const url of payload.match(urlRegex) || []) {
      if (seen.has(url)) continue;
      seen.add(url);
      candidates.push({ id: url, title: query || "Notion result", url, type: "result", dataSourceId: null });
    }
    return candidates;
  }

  walk(payload, (node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const candidate = candidateFromObject(node);
    if (!candidate) return;
    const key = candidate.url || candidate.id;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  });
  return candidates;
}

async function createClient(workspaceId, canRefresh = true) {
  let workspace = await getValidWorkspace(workspaceId);
  let client = new NotionMcpClient(workspace.access_token);
  try {
    await client.initialize();
    return { client, workspace };
  } catch (error) {
    if (canRefresh && error instanceof McpHttpError && error.status === 401) {
      workspace = await refreshWorkspaceToken(workspaceId);
      client = new NotionMcpClient(workspace.access_token);
      await client.initialize();
      return { client, workspace };
    }
    throw error;
  }
}

async function callWithRetries(client, toolName, args) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await client.callTool(toolName, args);
    } catch (error) {
      const retryable = /rate|429|529|temporar|overloaded|timeout/i.test(error.message || "");
      if (!retryable || attempt >= MAX_RETRIES) throw error;
      await sleep(Math.min(8000, 500 * (2 ** attempt)));
    }
  }
  throw new Error("Notion MCP request failed after repeated retries.");
}

export async function searchDataSources(workspaceId, query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return [];
  const { client } = await createClient(workspaceId);
  const searchTool = await client.findTool("notion-search", "search");
  const result = await callWithRetries(client, searchTool.name, {
    query: trimmed,
    query_type: "internal",
    content_search_mode: "workspace_search",
    page_size: 25,
    max_highlight_length: 0
  });
  return parseSearchCandidates(resultPayload(result), trimmed).slice(0, 25);
}

async function fetchTarget(client, id) {
  const fetchTool = await client.findTool("notion-fetch", "fetch");
  return callWithRetries(client, fetchTool.name, { id });
}

async function resolveTarget(client, target) {
  let dataSourceId = target.dataSourceId ? normalizeId(target.dataSourceId) : null;
  let initialResult = null;

  if (!dataSourceId) {
    initialResult = await fetchTarget(client, target.url || target.id);
    const payload = resultPayload(initialResult);
    dataSourceId = extractDataSourceId(payload) || extractDataSourceIdFromText(contentText(initialResult));
  }
  if (!dataSourceId) throw new Error(`“${target.title}” is not a Notion database/data source. Choose a database result.`);

  // Fetch the concrete data source so that we use its exact title/URL property names.
  let schemaResult;
  try {
    schemaResult = await fetchTarget(client, `collection://${dataSourceId}`);
  } catch (error) {
    // Some responses already contain the schema; retain a useful fallback.
    if (!initialResult) throw error;
    schemaResult = initialResult;
  }

  const schemaPayload = resultPayload(schemaResult);
  const fromObject = extractSchemaProperties(schemaPayload);
  const fromText = extractSchemaPropertiesFromText(contentText(schemaResult));
  const titlePropertyName = fromObject.titlePropertyName || fromText.titlePropertyName;
  const urlPropertyName = fromObject.urlPropertyName || fromText.urlPropertyName;
  if (!titlePropertyName) {
    throw new Error(`Could not identify the title property in “${target.title}”. The database schema may be unavailable.`);
  }

  return {
    ...target,
    dataSourceId,
    titlePropertyName,
    urlPropertyName: urlPropertyName || null
  };
}

function buildPage(tab, titlePropertyName, urlPropertyName = null) {
  const title = (tab.title || tab.url || "Untitled tab").slice(0, 2000);
  const url = String(tab.url || "").slice(0, 2000);
  const properties = { [titlePropertyName]: title };
  if (urlPropertyName) properties[urlPropertyName] = url;
  // Notion-flavored Markdown uses standard [text](URL) links. Encode literal
  // parentheses so unusual URLs cannot terminate the link destination early.
  const markdownUrl = url.replace(/\(/g, "%28").replace(/\)/g, "%29");
  return {
    properties,
    // Keep a clickable link in page content even when a URL database property exists.
    content: `[Source](${markdownUrl})`
  };
}

function extractCreatedPageRefs(result) {
  const payload = resultPayload(result);
  const refs = [];
  const seen = new Set();
  walk(payload, (node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const id = node.id || node.page_id;
    const url = node.url || node.page_url || null;
    if (!id || seen.has(String(id))) return;
    seen.add(String(id));
    refs.push({ pageId: String(id), pageUrl: url ? String(url) : null });
  });
  return refs;
}

async function createPages(client, createTool, resolved, tabs, includeUrlProperty = true) {
  const args = {
    parent: { data_source_id: resolved.dataSourceId },
    pages: tabs.map((tab) => buildPage(
      tab,
      resolved.titlePropertyName,
      includeUrlProperty ? resolved.urlPropertyName : null
    ))
  };
  return callWithRetries(client, createTool.name, args);
}

export async function saveTabs(workspaceId, target, tabs, onProgress = () => {}) {
  const { client } = await createClient(workspaceId);
  const createTool = await client.findTool("notion-create-pages", "create-pages");
  const resolved = await resolveTarget(client, target);
  const successes = [];
  const failures = [];

  for (let start = 0; start < tabs.length; start += CREATE_BATCH_SIZE) {
    const batch = tabs.slice(start, start + CREATE_BATCH_SIZE);
    try {
      const result = await createPages(client, createTool, resolved, batch, true);
      const refs = extractCreatedPageRefs(result);
      batch.forEach((tab, index) => successes.push({ tab, ...(refs[index] || {}) }));
    } catch (batchError) {
      // Fall back to one-at-a-time so one problematic tab/property does not lose the whole batch.
      for (const tab of batch) {
        try {
          let result;
          try {
            result = await createPages(client, createTool, resolved, [tab], true);
          } catch (errorWithUrlProperty) {
            if (!resolved.urlPropertyName) throw errorWithUrlProperty;
            // Retry without an inferred URL property, while retaining the URL in page content.
            result = await createPages(client, createTool, resolved, [tab], false);
          }
          const [ref] = extractCreatedPageRefs(result);
          successes.push({ tab, ...(ref || {}) });
        } catch (error) {
          failures.push({ tab, error: error.message || String(error) });
        }
        onProgress({
          completed: successes.length + failures.length,
          total: tabs.length,
          successes: successes.length,
          failures: failures.length
        });
        await sleep(CREATE_REQUEST_SPACING_MS);
      }
      continue;
    }

    onProgress({
      completed: successes.length + failures.length,
      total: tabs.length,
      successes: successes.length,
      failures: failures.length
    });
    if (start + batch.length < tabs.length) await sleep(CREATE_REQUEST_SPACING_MS);
  }

  return {
    successes,
    failures,
    target: {
      ...target,
      dataSourceId: resolved.dataSourceId,
      titlePropertyName: resolved.titlePropertyName,
      urlPropertyName: resolved.urlPropertyName
    }
  };
}
