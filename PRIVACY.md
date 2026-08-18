# Tabs2Notion Privacy Policy

**Effective date: 18 August 2026**

Tabs2Notion is a Chrome extension that lets you send user-selected browser tabs to a Notion database. This policy explains what data Tabs2Notion handles, why it is needed, and where it goes.

## Data Tabs2Notion handles

Tabs2Notion may handle the following data when you use the extension:

- **Browser tab information:** the titles and URLs of the tabs selected by the action you invoke (for example, the current tab, selected tabs, a tab group, a window, or all windows).
- **Notion authentication information:** OAuth access and refresh tokens, workspace identifiers, and basic workspace metadata returned by Notion after you authorize Tabs2Notion.
- **Notion destination metadata:** database/data-source identifiers and names needed to let you choose where tabs are saved.
- **Local settings:** your selected defaults, recent destinations, excluded domains, toolbar action, and whether successfully saved tabs should be closed.

Tabs2Notion does **not** read the body content of webpages, passwords entered into webpages, cookies, form contents, or your full browsing history. It only processes the tabs selected by a Tabs2Notion action.

## How the data is used

The data above is used only to provide Tabs2Notion's user-facing functionality:

- Tab titles and URLs are converted into new pages/rows in the Notion database you select.
- Notion credentials are used to authenticate requests to your authorized Notion workspace.
- Database metadata is used to display and remember destinations.
- Local settings are used to apply your chosen behavior.

Tabs2Notion does not use this data for advertising, profiling, creditworthiness, analytics, or unrelated purposes.

## Where data is sent

Normal saving traffic goes **directly from the Chrome extension to Notion's API over HTTPS**. When you save tabs, Notion receives the tab titles and URLs needed to create the requested pages.

Tabs2Notion also uses a small publisher-operated OAuth service hosted on Cloudflare Workers. That service is used only for Notion OAuth authorization-code exchange and token refresh. It transiently processes OAuth authorization codes and token responses so that the Notion client secret does not need to be embedded in the public extension. It does not proxy tab titles, tab URLs, database contents, or normal Notion API traffic, and Tabs2Notion does not intentionally persist OAuth tokens on that backend.

Cloudflare provides the infrastructure on which the OAuth service runs, and Notion provides the destination service chosen by the user. Their own terms and privacy practices apply to their processing of data. Cloudflare may process standard network and operational metadata required to deliver and secure the Worker service.

## Storage and retention

OAuth credentials and extension settings are stored in `chrome.storage.local` in the user's Chrome profile. They remain there until the user disconnects the workspace, removes the extension, clears the extension's storage, or Chrome removes that profile data.

The Tabs2Notion OAuth backend does not intentionally maintain a database of users, browsing activity, saved tabs, Notion pages, or OAuth tokens.

## Data sharing and sale

Tabs2Notion does not sell user data. It does not transfer user data for advertising, retargeting, data brokerage, or other unrelated purposes. Data is transferred only as necessary to provide the extension's single purpose, to the services described above, or where required by law or necessary for security.

## Security

Tabs2Notion uses HTTPS for communications with Notion and the OAuth service. The Notion OAuth client secret is kept on the publisher-operated backend and is not embedded in the Chrome extension. Browser-internal URLs such as `chrome://` pages are not sent to Notion.

## Limited Use disclosure

Tabs2Notion's use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including its Limited Use requirements. Data obtained through Chrome permissions is used only to provide or improve Tabs2Notion's user-facing tab-to-Notion functionality and is not used for personalized advertising or unrelated purposes.

## Your controls

You can:

- choose exactly which tab set to send;
- choose which Notion workspace/pages/databases to authorize through Notion;
- disconnect a Notion workspace from Tabs2Notion settings;
- exclude domains from tab-saving actions;
- choose whether saved tabs remain open or are closed;
- remove the extension to delete its locally stored extension data from that Chrome profile.

## Contact

For privacy questions, bug reports, or data-handling concerns, open an issue in the Tabs2Notion GitHub repository:

https://github.com/nikolaskaralis/Tabs2Notion/issues
