# Chrome Web Store submission guide

This file contains the copy and answers prepared for the first Tabs2Notion Chrome Web Store submission.

## Store listing

**Name**  
Tabs2Notion

**Category**  
Productivity

**Primary language**  
English

**Short description**  
Send one tab, selected tabs, tab groups, windows, or all open tabs directly to a Notion database.

**Detailed description**

Tabs2Notion turns open browser tabs into organized Notion database entries without making you save pages one at a time.

Choose exactly what to send: the current tab, selected tabs, the current tab group, tabs to the left or right, the active window, or all open windows. Tabs2Notion saves each tab as a Notion page using the tab title and URL.

You can choose a destination each time or configure a default workspace and database for one-click saving. You can also choose whether successfully saved tabs stay open or close automatically, set the action performed by the pinned toolbar icon, and exclude domains you never want to send.

Authentication uses Notion OAuth. Normal tab-saving traffic goes directly from the extension to Notion's API; the publisher-hosted authentication service is used only for OAuth code exchange and token refresh.

**Homepage URL**  
https://github.com/nikolaskaralis/Tabs2Notion

**Support URL**  
https://github.com/nikolaskaralis/Tabs2Notion/issues

**Privacy policy URL**  
https://nikolaskaralis.github.io/Tabs2Notion/privacy.html

## Single purpose

> Tabs2Notion saves user-selected sets of open Chrome tabs as pages in a Notion database chosen by the user.

Use that wording, or a close equivalent, in the Chrome Web Store Privacy tab.

## Permission justifications

### `tabs`
Required to read the titles and URLs of the tabs selected by the user, determine their position/group/window for the available tab-selection commands, and close only those tabs that were successfully saved when the user enables that behavior.

### `storage`
Required to store Notion workspace authorization information and local preferences such as default destination, recent destinations, excluded domains, close-tabs behavior, and pinned-icon behavior.

### `contextMenus`
Required to expose Tabs2Notion's tab-selection actions from Chrome's right-click menu.

### `identity`
Required to complete the Notion OAuth login flow using Chrome's extension-specific redirect URL.

### Host access: `https://api.notion.com/*`
Required to search the user's authorized Notion destinations, inspect the selected database/data-source schema, create pages, and refresh normal Notion data shown by the extension.

### Host access: `https://tabs2notion-oauth.nikolaskaralis.workers.dev/*`
Required only for the publisher-operated OAuth helper used for Notion authorization-code exchange and refresh. Normal tab titles, tab URLs, and Notion page creation requests are not proxied through this service.

## Privacy Practices questionnaire

The dashboard wording can change over time, so answer according to the actual categories shown. Based on the current implementation:

- Declare **authentication information** because the extension handles Notion OAuth access/refresh credentials.
- Declare **web browsing activity / URLs** (often labelled **Web history**) because selected tab URLs and titles are processed even though the extension does not build a browsing-history profile.
- Do **not** claim that no user data is handled merely because much of it is local; Chrome Web Store policy treats locally processed user data as data handling too.
- Do not declare webpage body/content collection: Tabs2Notion does not scrape or read page bodies.
- Data is used for **app functionality** only.
- Data is not sold and is not used for advertising, retargeting, creditworthiness, or unrelated personalization.
- Data is transferred to **Notion** only as needed to save the user-selected tabs.
- The Cloudflare-hosted OAuth service transiently processes OAuth exchange/refresh data; it does not receive normal tab-saving payloads.
- Certify compliance with the Chrome Web Store **Limited Use** requirements.

Keep the dashboard answers consistent with `PRIVACY.md`.

## Reviewer test instructions

No publisher test account is required. The reviewer can use any Notion account/workspace to which they have access.

1. Install the extension and open **Settings**.
2. Click **Connect Notion** and authorize a workspace.
3. In Notion's authorization picker, grant access to at least one database/data source.
4. Open one or more ordinary `http://` or `https://` webpages.
5. Use the toolbar or right-click menu and choose **Send only this tab to Notion** (or another action).
6. Choose the authorized database and save.
7. Confirm a Notion page is created with the tab title and URL.
8. Optional: configure a default database and enable **Use defaults without showing the destination dialog** to test one-click saving.

Browser-internal URLs such as `chrome://extensions` are intentionally skipped.

## Graphic assets

Prepared in `store/assets/`:

- `store-icon-128.png` — 128×128, with the visible artwork sized to Chrome Web Store guidance.
- `promo-440x280.png` — required small promotional tile.
- `marquee-1400x560.png` — optional marquee promotional image.

Capture real extension screenshots after the final browser smoke test. Chrome accepts 1280×800 or 640×400 screenshots and requires at least one; five are recommended.

Suggested screenshot set:

1. Flat right-click menu showing the tab-selection actions.
2. Destination picker showing workspace/database selection.
3. Settings showing default workspace/database, close-tabs behavior, skip-dialog option, and pinned-icon behavior.
4. A Notion database showing several tabs successfully saved as rows/pages.
5. One-click/default flow, ideally showing the toolbar icon and success badge.

Screenshots should show the actual current extension UI, use square corners/no padding, and avoid exposing private workspace data.

## Distribution

For the first external test, use **Unlisted** visibility. Unlisted items still go through Chrome Web Store review but can be installed only by users who have the item URL. After testing, switch to Public and submit the production version for review.

## Before pressing Submit for Review

- Run `npm run package` from the repository root.
- Upload the resulting `dist/Tabs2Notion-<version>.zip`.
- Confirm the ZIP opens with `manifest.json` at its root.
- Verify the Store Listing, Privacy, Distribution, and Test instructions tabs.
- Upload at least one real 1280×800 screenshot and the small promo tile.
- Use the public privacy-policy URL above.
- Test the exact uploaded build once more locally before submission.
