export const APP_NAME = "Tabs2Notion";
export const NOTION_API_BASE = "https://api.notion.com/v1";
export const NOTION_VERSION = "2026-03-11";

// For a private/local install, you can either paste the deployed Worker URL in
// the onboarding screen, or hard-code it here before loading the extension.
export const DEFAULT_OAUTH_BACKEND = "https://tabs2notion-oauth.nikolaskaralis.workers.dev";

export const MAX_DATABASES_TO_LOAD = 500;
export const CREATE_REQUEST_SPACING_MS = 380;
export const MAX_RETRIES = 5;
