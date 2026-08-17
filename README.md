# Tabs2Notion

Tabs2Notion is a Chrome Manifest V3 extension that sends one tab, a tab group, a window, or many open tabs directly into a Notion database.

It is intended as a bulk companion to Notion's normal single-page web clipper: capture individual pages normally, and use Tabs2Notion when a browser window has accumulated a set of links worth keeping.

## Features

The toolbar popup and right-click context menu expose OneTab-style commands:

- all tabs in the current window
- all tabs in the current Chrome tab group
- selected/highlighted tabs
- only the current tab
- all tabs except the current tab
- tabs to the left
- tabs to the right
- all tabs from all windows
- exclude/include the current domain

After choosing tabs, Tabs2Notion opens a compact destination window where the user can choose:

- a connected **Notion workspace**
- a **Notion database** (recent destinations or search by name)
- whether to **close only successfully saved tabs**

Each browser tab becomes a database page. Tabs2Notion uses the database's actual title property, fills a URL property when one exists, and also preserves the source URL in the page content.

## Backendless Notion authentication

Version 0.2 uses **Notion's hosted MCP server** directly. There is no Tabs2Notion backend, Cloudflare Worker, developer API key, or shared client secret.

The connection flow is:

```text
Chrome extension
    │
    ├─ OAuth discovery
    ├─ dynamic client registration
    ├─ Authorization Code + PKCE
    │
    ▼
Notion login / consent
    │
    ▼
https://mcp.notion.com/mcp
```

Chrome's `chrome.identity.launchWebAuthFlow()` handles the interactive browser authorization and returns to an extension-specific `*.chromiumapp.org` callback URL. The extension performs OAuth discovery, dynamic client registration, PKCE code exchange, and refresh itself.

Notion MCP access tokens are then used only against the official Notion MCP endpoint. The extension uses MCP tools to search/fetch databases and create pages; it does **not** try to reuse MCP tokens with the Notion REST API.

### Credential storage

- OAuth access and refresh tokens stay in the local Chrome extension profile.
- Tokens are encrypted before being placed in `chrome.storage.local`.
- The encryption key is generated as a non-extractable WebCrypto AES-GCM key and kept in the extension origin's IndexedDB.
- Dynamic client registration credentials are persisted so existing OAuth grants are not orphaned.
- Refreshes are serialized per workspace to handle refresh-token rotation safely.
- No credentials are sent to a Tabs2Notion-operated server because there is no such server.

This is local application storage, not an operating-system keychain; users with full control of a browser profile/computer should be assumed capable of accessing extension data.

## Database picker behavior

Notion MCP currently exposes search and fetch tools rather than a simple "list every database in this workspace" operation. Tabs2Notion therefore uses a two-level picker:

1. **Recent** databases appear immediately.
2. Typing in the search box performs a Notion workspace search.

When a result is chosen, Tabs2Notion fetches it and verifies that it resolves to a Notion database/data source before writing. The concrete data source is fetched again so Tabs2Notion can read its exact schema.

This is intentionally different from preloading an entire workspace and scales better for large workspaces.

## Database compatibility

Before creating pages, Tabs2Notion resolves the destination to a Notion data source and reads the schema returned by `notion-fetch`.

- The exact `TITLE` property is detected; it does not assume the property is named `Name` or `Title`.
- If a `URL` property exists, it is populated automatically.
- Notion MCP's special `userDefined:` prefix is used for properties literally named `URL` or `id` when required.
- The source URL is also retained in page content.
- Other database properties are left untouched.

## Install locally

No Notion developer setup is required.

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension/` directory.
6. Tabs2Notion opens its setup page.
7. Click **Connect Notion**.
8. Complete the real Notion login/consent flow.

To connect another workspace, click **Connect Notion** again from settings or the dashboard.

## Use

### Toolbar

Click the Tabs2Notion icon and choose a tab-selection command.

### Context menu

Right-click a web page or browser tab and open **Send tabs to Notion**. The available options mirror the toolbar commands.

### Destination window

Choose a workspace, select a recent database or type its name into the search field, and click **Save tabs**.

If **Close successfully saved tabs** is enabled, Tabs2Notion closes only tabs for which Notion confirmed successful creation.

## Permissions

Tabs2Notion requests:

- `tabs` — read the titles and URLs of the tabs the user explicitly chooses to send
- `storage` — save settings, encrypted credentials, recent destinations, and exclusions
- `contextMenus` — expose the right-click commands
- `identity` — run the Notion OAuth flow using Chrome's extension redirect mechanism
- host access to `https://mcp.notion.com/*` — OAuth discovery and Notion MCP requests

Optional Notion-domain host permissions are declared only as a fallback if OAuth discovery points to another official Notion host.

Tabs2Notion does not request permission to read arbitrary web-page contents. It works from Chrome's tab metadata (title and URL).

## Development

The extension is plain JavaScript/HTML/CSS; there is no bundler and no remotely hosted executable code.

Run the local checks from the project root:

```bash
npm test
npm run check
```

Then perform an interactive smoke test in Chrome because OAuth cannot be validated by the unit test suite:

1. load `extension/` unpacked
2. Connect Notion
3. verify the workspace name appears
4. search for a known database
5. save one tab
6. verify title + URL in Notion
7. test a 5–10 tab batch
8. test reconnect/token refresh behavior when possible

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
│       ├── auth.js
│       ├── crypto-storage.js
│       ├── mcp.js
│       ├── notion.js
│       └── ...
├── tests/
├── package.json
└── README.md
```

## Public release checklist

Before submitting to the Chrome Web Store:

- complete the interactive OAuth/database smoke tests on the packaged build
- add/host the final privacy policy and link it from the store listing
- prepare Chrome Web Store screenshots and promotional assets
- review Chrome Web Store permission disclosures
- finalize license and contributor policy
- add release packaging/versioning
- test install/update behavior using the stable Web Store extension ID

## Current version

`0.2.0` — backendless Notion MCP OAuth/PKCE architecture. The code is suitable for local testing, but the OAuth path still requires an interactive Chrome + Notion smoke test before merging/releasing publicly.
