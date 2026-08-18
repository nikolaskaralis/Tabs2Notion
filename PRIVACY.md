# Tabs2Notion Privacy Policy

**Effective date: 18 August 2026**

Tabs2Notion is a Chrome extension that sends browser tabs to a Notion database selected by the user.

## Data Tabs2Notion handles

Tabs2Notion handles only the information needed to provide its tab-to-Notion functionality:

- **Tab metadata:** the title and URL of tabs selected by a Tabs2Notion command.
- **Notion authentication information:** OAuth access and refresh tokens issued by Notion.
- **Notion workspace metadata:** workspace identifiers, workspace names/icons, and database identifiers/titles needed to show destinations.
- **Extension settings:** default workspace/database, close-tabs preference, toolbar action, recent destinations, and explicitly excluded domains.

## How data is used

When you invoke a save command, the extension sends the selected tab titles and URLs **directly to the Notion API** so that Notion can create pages in the database you chose.

Tabs2Notion does not continuously collect browsing activity and does not send your full browsing history anywhere. It reads open-tab metadata only as needed to execute commands you initiate.

## OAuth service

Notion's public OAuth flow requires a confidential client secret, which cannot safely be embedded in a Chrome extension. Tabs2Notion therefore uses a small publisher-operated OAuth service hosted on Cloudflare Workers.

The OAuth service is used only to:

1. start the Notion authorization flow;
2. exchange Notion authorization codes for OAuth tokens; and
3. refresh OAuth tokens.

The OAuth service is **not used as a proxy for saved tab titles, tab URLs, or Notion database content**. The service does not maintain an application database of users or saved tabs.

Cloudflare may process standard network and security metadata as part of operating its infrastructure, subject to Cloudflare's own policies.

## Local storage

Notion tokens and Tabs2Notion settings are stored in the extension's local Chrome storage. The extension restricts its local storage to trusted extension contexts.

Stored connection data remains in your Chrome profile until you disconnect the workspace, clear the extension's data, or uninstall Tabs2Notion.

## Third parties

Tabs2Notion relies on:

- **Notion**, to authenticate your account and store the pages you explicitly send.
- **Cloudflare Workers**, to host the OAuth code-exchange/refresh service.

Your use of those services is also governed by their respective privacy policies.

## Data sale, advertising, analytics, and profiling

Tabs2Notion:

- does **not** sell user data;
- does **not** use user data for advertising;
- does **not** use tab data for analytics or profiling;
- does **not** transfer tab data to data brokers;
- does **not** use browsing data for purposes unrelated to the extension's single purpose.

## Security

The Notion OAuth client secret is kept only as a server-side Cloudflare Worker secret and is never included in the extension package. Tabs2Notion requests only the browser and Notion permissions required for its functionality.

## Changes to this policy

Material changes to this policy will be published in this repository and on the hosted privacy-policy page.

## Contact and support

For questions, privacy requests, or bug reports, use the project's GitHub issue tracker:

https://github.com/nikolaskaralis/Tabs2Notion/issues
