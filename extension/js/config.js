export const APP_NAME = "Tabs2Notion";
export const NOTION_API_BASE = "https://api.notion.com/v1";
export const NOTION_VERSION = "2026-03-11";

// Publisher-hosted OAuth backend used by release builds. End users should not
// need to know about or configure this URL.
// For private/local installs, developers can clear this value and configure a
// backend URL during onboarding.
export const DEFAULT_OAUTH_BACKEND = "https://tabs2notion-oauth.nikolaskaralis.workers.dev";

export const MAX_DATABASES_TO_LOAD = 500;
export const CREATE_REQUEST_SPACING_MS = 380;
export const MAX_RETRIES = 5;
