# Tabs2Notion

A Chrome Manifest V3 extension for sending open browser tabs to a Notion database. It is designed as a bulk companion to Notion's normal single-page web clipper.

## What it does

The toolbar popup and right-click context menu expose OneTab-like tab-selection commands:

- all tabs in the current window
- all tabs in the current Chrome tab group
- selected/highlighted tabs
- only the current tab
- all tabs except the current tab
- tabs to the left
- tabs to the right
- all tabs from all windows
- exclude/include the current domain

After choosing a tab set, Tabs2Notion opens a compact destination window where you choose:

- **Notion workspace**
- **Notion database/data source**
- whether to **close successfully saved tabs**

Each tab becomes one new database row. The row's title is the browser tab title. If the database has a URL property, Tabs2Notion automatically uses it; otherwise it puts the URL as a clickable link in the page body.

## Authentication architecture

Tabs2Notion uses Notion's **public OAuth connection + REST API** architecture.

A tiny OAuth backend is required because Notion's public OAuth token exchange and refresh requests require the connection's client secret. That secret must not be embedded in a public Chrome extension. The backend only performs OAuth code exchange / token refresh; it does **not** proxy normal Notion database traffic. After login, the extension calls `api.notion.com` directly with the user's workspace-scoped bearer token.

Why not connect directly to Notion MCP from the extension? Notion's hosted MCP endpoint rejects Chrome extension origins (`chrome-extension://...`) and Notion's own MCP troubleshooting guidance says browser clients should perform token exchange server-side. Therefore direct MCP from a Chrome extension is not a supported backendless path for Tabs2Notion.

The project therefore has two pieces:

1. `extension/` — captures tabs, presents the workspace/database picker, and calls the Notion REST API.
2. `backend/cloudflare-worker/` — a minimal OAuth helper that holds the Notion client secret and performs only authorization-code exchange and refresh.

For a **public release**, you deploy this Worker once as the extension publisher. End users should not deploy anything themselves: they install Tabs2Notion, click **Connect Notion**, authorize the workspace, and use the extension.

## 1. Create a Notion public connection

In the Notion Creator dashboard:

1. Create a **Public connection**.
2. For a public Chrome Web Store release choose the installation scope that allows **Any workspace**.
3. Give the connection at least the capabilities needed to **read content** and **insert content**.
4. You will add the exact OAuth redirect URI after deploying the Worker in the next section.
5. Copy the connection's **client ID** and **client secret**.

During authorization, Notion presents its page picker. Users grant Tabs2Notion access only to the pages/databases they choose.

## 2. Deploy the OAuth Worker

The backend is intentionally small and does not store Notion page/database content. The access and refresh tokens are returned to the extension through Chrome's OAuth redirect and stored in `chrome.storage.local` for that extension profile.

Using Cloudflare Wrangler:

```bash
cd backend/cloudflare-worker
cp wrangler.toml.example wrangler.toml
npx wrangler deploy
```

After the first deployment, note the Worker URL, for example:

```text
https://tabs2notion-oauth.<your-subdomain>.workers.dev
```

Set the redirect URI in `wrangler.toml`:

```toml
[vars]
OAUTH_REDIRECT_URI = "https://tabs2notion-oauth.<your-subdomain>.workers.dev/oauth/callback"
```

Add the **same exact URI** to the Notion public connection's OAuth redirect URIs.

Then set the Worker secrets:

```bash
npx wrangler secret put NOTION_CLIENT_ID
npx wrangler secret put NOTION_CLIENT_SECRET
npx wrangler secret put STATE_SECRET
```

For `STATE_SECRET`, use a long random value, for example:

```bash
openssl rand -base64 48
```

Deploy once more:

```bash
npx wrangler deploy
```

Optional health check:

```text
https://tabs2notion-oauth.<your-subdomain>.workers.dev/health
```

## 3. Configure the extension build

During local development, the onboarding page can accept the Worker URL manually.

Before publishing to the Chrome Web Store, set the production Worker URL as `DEFAULT_OAUTH_BACKEND` in `extension/js/config.js`. This removes infrastructure setup from the end-user workflow. A public release should use one stable publisher-controlled backend URL.

## 4. Load the Chrome extension locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` directory.
5. Tabs2Notion opens its setup page automatically.
6. During development, paste your Worker base URL if `DEFAULT_OAUTH_BACKEND` has not yet been set.
7. Click **Connect Notion**.
8. Complete Notion's authorization flow and page/database picker.

To connect another Notion workspace, click **Connect Notion** again from settings or **Connect another** in the Tabs2Notion dashboard. Authorizations are stored separately by Notion `workspace_id`.

## 5. Use Tabs2Notion

### Toolbar

Click the Tabs2Notion icon in Chrome's extensions toolbar. Choose one of the tab-selection commands.

### Context menu

Right-click a web page, browser tab, or the extension action. Chrome may place the commands under a **Send tabs to Notion** submenu because Chrome limits top-level items in an extension action context menu.

### Destination window

The selector opens with:

- a workspace dropdown
- recent databases
- all accessible databases
- database search
- a **Close successfully saved tabs** checkbox

The most recently used destination is preselected for convenience, but the picker remains available for every send.

## Database compatibility

Tabs2Notion retrieves the target data source schema before saving.

- It automatically locates the data source's `title` property.
- It prefers a URL property named `URL`, `Link`, `Website`, or `Source`; otherwise it uses the first URL property.
- If there is no URL property, the link is placed into the new page body.
- Other database properties are left unchanged so Tabs2Notion can work across heterogeneous databases without guessing statuses, tags, relations, etc.

## Rate limiting and bulk sends

Tabs2Notion saves pages sequentially with spacing between creates and respects `Retry-After` on HTTP 429/529 responses. This makes large tab dumps slower than a local bookmark operation, but substantially more reliable.

## Privacy/security notes

- The extension requests the Chrome `tabs` permission because it must read tab titles and URLs.
- Only ordinary `http://` and `https://` tabs are sent. Browser-internal pages such as `chrome://extensions` are skipped.
- Excluded domains are stored locally in the extension profile.
- OAuth tokens are stored in the local Chrome extension profile and are not intentionally synced through Chrome Sync.
- The Notion OAuth client secret lives only in the Worker environment.
- Normal Notion content/API traffic goes directly between the extension and `api.notion.com`; the OAuth Worker is not a Notion-content proxy.
- OAuth `state` is HMAC-signed and expires after 10 minutes.
- The Worker only accepts OAuth return URLs on Chrome's `*.chromiumapp.org` redirect domain (plus localhost for development).

## Development checks

From the project root:

```bash
npm test
npm run check
```

No build system is required for the extension; all JavaScript is bundled locally as ES modules to comply with Manifest V3's no-remotely-hosted-code model.

## Project layout

```text
Tabs2Notion/
├── extension/
│   ├── manifest.json
│   ├── service-worker.js
│   ├── popup.html
│   ├── selector.html
│   ├── onboarding.html
│   ├── dashboard.html
│   ├── help.html
│   ├── styles.css
│   ├── icons/
│   └── js/
├── backend/
│   └── cloudflare-worker/
│       ├── worker.js
│       └── wrangler.toml.example
├── tests/
├── package.json
└── README.md
```

## Current version

`0.1.0` — functional first implementation intended for local testing. Before publishing in the Chrome Web Store: deploy a stable publisher-controlled OAuth backend, set that URL as `DEFAULT_OAUTH_BACKEND`, add a privacy policy, finalize branding/store assets, review permission disclosures, and run an interactive multi-workspace smoke test.
