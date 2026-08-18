# Chrome Web Store submission copy

This file contains the text and answers to use when preparing the Tabs2Notion Chrome Web Store listing. Re-check the Developer Dashboard wording at submission time because Google may rename fields.

## Listing

**Name**

Tabs2Notion

**Category**

Productivity

**Summary / short description**

> Send one tab, selected tabs, tab groups, windows, or all open tabs directly to a Notion database.

**Detailed description**

> Tabs2Notion turns tab cleanup into a one-click Notion workflow.
>
> Save the current tab, selected tabs, a Chrome tab group, every tab in the current window, tabs to the left or right, or all open tabs across windows. Tabs2Notion creates one Notion page per tab using the tab title and URL.
>
> You can choose a destination each time, or configure a default workspace and database for instant saving. You can also choose whether successfully saved tabs should be closed and what clicking the pinned Tabs2Notion icon should do.
>
> Key features:
>
> - Save one tab or many tabs to Notion.
> - Flat right-click commands for fast access.
> - Works with selected tabs, tab groups, windows, and all windows.
> - Configurable default workspace and database.
> - Optional one-click saving without a destination dialog.
> - Optional close-after-save behavior; only successfully saved tabs are closed.
> - Exclude domains you do not want to send.
> - Notion OAuth login; no Notion API key to copy or paste.
>
> Tabs2Notion has one purpose: helping you move browser tabs you explicitly select into your own Notion workspace.

## Single-purpose statement

Tabs2Notion's single purpose is to save browser-tab metadata selected by the user (tab title and URL) into a Notion database chosen by the user.

## Permission justifications

### `tabs`

Required to read the title and URL of the tabs selected by a Tabs2Notion command; determine tab position, group, window, highlighted state, and active state; and optionally close tabs after Notion confirms they were saved.

Tabs2Notion does not continuously monitor or upload browsing activity.

### `storage`

Required to keep Notion connection tokens and local preferences, including connected workspace metadata, recent/default destinations, excluded domains, close-after-save preference, and toolbar behavior.

Local storage is restricted to trusted extension contexts.

### `contextMenus`

Required to provide the right-click commands for saving the current tab, tab groups, selected tabs, windows, tabs to the left/right, and other supported tab sets.

### `identity`

Required to complete Notion OAuth using Chrome's extension redirect URL through `chrome.identity.launchWebAuthFlow()`.

## Host permission justifications

### `https://api.notion.com/*`

Required to list accessible Notion databases, inspect the selected database schema, create pages for explicitly selected tabs, and use the user's Notion OAuth token.

### `https://tabs2notion-oauth.nikolaskaralis.workers.dev/*`

Required only for Notion OAuth authorization-code exchange and token refresh. Tab titles, tab URLs, and Notion database content are not proxied through this service.

## Privacy Practices / user data

Use the actual Developer Dashboard wording at submission time. Based on the current implementation, disclose at least:

- **Web history / browsing data:** YES — Tabs2Notion reads URLs and titles of the open tabs that are part of a user-invoked command.
- **Authentication information:** YES — the extension handles Notion OAuth access and refresh tokens.
- **Website content:** NO for page bodies/content — Tabs2Notion does not read page DOM/content. If the Dashboard groups page titles with website content, answer conservatively and disclose it.
- **Personally identifiable information:** Tabs2Notion does not intentionally collect a user's name, email, address, or similar profile fields for its own purposes. Notion workspace names/icons and OAuth identifiers may be processed as necessary to display and maintain the connection.
- **Location, health, financial/payment information, personal communications:** NO.
- **User activity:** do not claim behavioral analytics; Tabs2Notion does not track clicks, keystrokes, or browsing behavior for analytics.

For every applicable category, the use is limited to the extension's user-facing single purpose. Tabs2Notion does not sell data, use it for ads, or transfer it to data brokers.

## Privacy policy URL

After GitHub Pages is enabled from the repository's `docs/` folder:

`https://nikolaskaralis.github.io/Tabs2Notion/privacy.html`

## Support URL

`https://github.com/nikolaskaralis/Tabs2Notion/issues`

## Homepage

`https://nikolaskaralis.github.io/Tabs2Notion/`

or, until GitHub Pages is enabled:

`https://github.com/nikolaskaralis/Tabs2Notion`

## Store assets

Prepare actual screenshots from the production extension rather than mockups.

Recommended screenshot set:

1. **Flat right-click menu** — show the main tab-saving commands without a submenu.
2. **Destination picker** — show workspace/database selection.
3. **Defaults settings** — show default database, close-after-save, instant-save, and pinned-icon behavior.
4. **Notion result** — show several tabs successfully created in a Notion database.
5. **Toolbar workflow** — optional; demonstrate a one-click direct save and success badge.

Keep screenshots free of sensitive tab titles, private URLs, email addresses, workspace names, or authentication data. Use a clean demo workspace/database.

Google's current listing documentation should be checked immediately before upload for required dimensions and asset limits:
https://developer.chrome.com/docs/webstore/cws-dashboard-listing/
