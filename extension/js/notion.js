import {
  CREATE_REQUEST_SPACING_MS,
  MAX_DATABASES_TO_LOAD,
  MAX_RETRIES,
  NOTION_API_BASE,
  NOTION_VERSION
} from "./config.js";
import { getWorkspace } from "./storage.js";
import { refreshWorkspaceToken } from "./auth.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function richTextToPlain(value) {
  if (!Array.isArray(value)) return "";
  return value.map((item) => item.plain_text || item.text?.content || "").join("");
}

async function notionRequest(workspaceId, path, options = {}, canRefresh = true) {
  let workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Notion workspace is not connected.");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(`${NOTION_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${workspace.access_token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    if (response.status === 401 && canRefresh) {
      workspace = await refreshWorkspaceToken(workspaceId);
      return notionRequest(workspaceId, path, options, false);
    }

    if ((response.status === 429 || response.status === 529) && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 500 * (2 ** attempt));
      await sleep(waitMs);
      continue;
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message || body.error || `Notion API request failed (${response.status}).`);
      error.status = response.status;
      error.code = body.code;
      throw error;
    }
    return body;
  }

  throw new Error("Notion API request failed after repeated retries.");
}

export async function listDataSources(workspaceId) {
  const results = [];
  let cursor = null;

  while (results.length < MAX_DATABASES_TO_LOAD) {
    const payload = {
      filter: { property: "object", value: "data_source" },
      page_size: Math.min(100, MAX_DATABASES_TO_LOAD - results.length),
      sort: { direction: "descending", timestamp: "last_edited_time" }
    };
    if (cursor) payload.start_cursor = cursor;

    const body = await notionRequest(workspaceId, "/search", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    for (const item of body.results || []) {
      if (item.object !== "data_source") continue;
      results.push({
        id: item.id,
        title: richTextToPlain(item.title) || "Untitled database",
        databaseId: item.parent?.database_id || null,
        url: item.url || null,
        lastEditedTime: item.last_edited_time || null
      });
    }

    if (!body.has_more || !body.next_cursor) break;
    cursor = body.next_cursor;
  }

  const seen = new Set();
  return results.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function getDataSourceSchema(workspaceId, dataSourceId) {
  return notionRequest(workspaceId, `/data_sources/${encodeURIComponent(dataSourceId)}`, { method: "GET" });
}

function pickProperty(schema, type, preferredNames = []) {
  const entries = Object.entries(schema.properties || {}).filter(([, value]) => value.type === type);
  if (!entries.length) return null;
  for (const preferred of preferredNames) {
    const found = entries.find(([name]) => name.toLowerCase() === preferred.toLowerCase());
    if (found) return found[0];
  }
  return entries[0][0];
}

function buildPagePayload(tab, dataSourceId, schema) {
  const titleProperty = pickProperty(schema, "title", ["Name", "Title"]);
  if (!titleProperty) throw new Error("The selected Notion data source has no title property.");

  const urlProperty = pickProperty(schema, "url", ["URL", "Url", "Link", "Website", "Source"]);
  const properties = {
    [titleProperty]: {
      title: [{ type: "text", text: { content: (tab.title || tab.url || "Untitled tab").slice(0, 2000) } }]
    }
  };

  if (urlProperty) {
    properties[urlProperty] = { url: tab.url.slice(0, 2000) };
  }

  const payload = {
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties
  };

  // If the database has no URL column, preserve the link in the new page body.
  if (!urlProperty) {
    payload.children = [{
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{
          type: "text",
          text: { content: tab.url.slice(0, 2000), link: { url: tab.url.slice(0, 2000) } }
        }]
      }
    }];
  }

  return payload;
}

export async function saveTabs(workspaceId, dataSourceId, tabs, onProgress = () => {}) {
  const schema = await getDataSourceSchema(workspaceId, dataSourceId);
  const successes = [];
  const failures = [];

  for (let i = 0; i < tabs.length; i += 1) {
    const tab = tabs[i];
    try {
      const page = await notionRequest(workspaceId, "/pages", {
        method: "POST",
        body: JSON.stringify(buildPagePayload(tab, dataSourceId, schema))
      });
      successes.push({ tab, pageId: page.id, pageUrl: page.url || null });
    } catch (error) {
      failures.push({ tab, error: error.message || String(error) });
    }
    onProgress({ completed: i + 1, total: tabs.length, successes: successes.length, failures: failures.length });
    if (i < tabs.length - 1) await sleep(CREATE_REQUEST_SPACING_MS);
  }

  return { successes, failures };
}
