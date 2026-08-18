# Tabs2Notion

Tabs2Notion is a Chrome Manifest V3 extension for sending one or many open browser tabs directly to a Notion database. It is a bulk companion to Notion's normal single-page clipping workflow.

## Features

From the toolbar or flat right-click menu you can send:

- all tabs in the current window;
- all tabs in the current Chrome tab group;
- selected/highlighted tabs;
- only the current tab;
- all tabs except the current tab;
- tabs to the left or right;
- all tabs from all windows.

You can also exclude domains from Tabs2Notion actions.

Each tab becomes a new Notion page/database row using the browser tab title. If the destination has a URL property, Tabs2Notion writes the tab URL there; otherwise the URL is preserved as a clickable link in the page body.

## Defaults and one-click saving

Settings let you configure:

- a default Notion workspace;
- a default database/data source;
- whether successfully saved tabs should close;
- whether actions should skip the destination dialog and save immediately;
- what happens when the pinned Tabs2Notion toolbar icon is clicked.

If instant saving is enabled and a valid default destination exists, the selected tab action is executed without opening the database picker.

## Authentication and architecture

Tabs2Notion uses Notion public OAuth plus the Notion REST API.

The public extension cannot safely contain Notion's OAuth client secret, so the publisher operates a small Cloudflare Worker at the bundled production backend URL. The Worker is used only for OAuth authorization-code exchange and token refresh. Normal database search, schema inspection, and tab-saving requests go directly from the extension to `https://api.notion.com`.

End users do not configure the backend. They install Tabs2Notion, click **Connect Notion**, authorize a workspace/pages in Notion, and use the extension.

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension/` directory.
6. Open Tabs2Notion Settings and click **Connect Notion**.
7. In Notion's authorization picker, grant access to the databases/pages you want Tabs2Notion to use.

## Notion database compatibility

Before saving, Tabs2Notion reads the selected data-source schema:

- it locates the actual title property;
- it prefers a URL property named `URL`, `Link`, `Website`, or `Source`, otherwise the first URL property;
- if no URL property exists, it puts the source URL into the page body;
- it leaves other properties untouched rather than guessing statuses, tags, relations, or custom fields.

Only ordinary `http://` and `https://` tabs are sendable. Browser-internal pages such as `chrome://extensions` are skipped.

## Privacy

Tabs2Notion processes the titles and URLs of the tabs explicitly selected by the user. Normal save traffic goes directly to Notion. The publisher-hosted backend is authentication-only and does not proxy normal tab-saving payloads.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy and Chrome Web Store Limited Use disclosure.

## Development and validation

The extension has no bundler and uses locally shipped ES modules only.

```bash
npm test
npm run check
npm run validate:release
```

## Build the Chrome Web Store ZIP

From the repository root:

```bash
npm run package
```

This runs tests and release validation, then creates:

```text
dist/Tabs2Notion-<version>.zip
```

The ZIP contains only the contents of `extension/`, with `manifest.json` at the archive root. Backend source, tests, repository documentation, and development files are not included in the Chrome Web Store package.

See [CHROME_WEB_STORE.md](CHROME_WEB_STORE.md) for prepared store copy, privacy-practice answers, permission justifications, reviewer test instructions, screenshot guidance, and the submission checklist.

## Publisher OAuth backend

The backend source is in `backend/cloudflare-worker/`. A publisher configuring a fresh deployment should:

1. create a Notion Public connection with the required read/insert capabilities;
2. deploy the Cloudflare Worker;
3. register `https://<worker-host>/oauth/callback` as the Notion redirect URI;
4. configure `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, and `STATE_SECRET` as Worker secrets;
5. keep the production Worker URL synchronized with `extension/js/config.js` and `extension/manifest.json`.

The deployed production Worker currently used by the extension is:

```text
https://tabs2notion-oauth.nikolaskaralis.workers.dev
```

## Project layout

```text
Tabs2Notion/
├── extension/                 # Chrome Web Store package source
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
├── backend/cloudflare-worker/ # publisher OAuth helper
├── scripts/                   # validation + packaging
├── store/assets/              # Chrome Web Store graphics
├── tests/
├── PRIVACY.md
├── CHROME_WEB_STORE.md
├── LICENSE
└── README.md
```

## License

MIT. See [LICENSE](LICENSE).
