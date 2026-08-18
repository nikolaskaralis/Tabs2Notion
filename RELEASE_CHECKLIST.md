# Tabs2Notion release checklist

## Repository / code

- [x] Manifest V3.
- [x] Production OAuth Worker URL bundled in the extension.
- [x] Production host permissions narrowed to Notion API + the exact Tabs2Notion OAuth Worker.
- [x] Localhost and wildcard `workers.dev` host permissions removed.
- [x] 16, 32, 48, and 128 px manifest icons included.
- [x] Small toolbar icon is redrawn at runtime with a bold 16/32 px design so it does not appear undersized.
- [x] Notion tokens/settings stored only in local Chrome storage and local storage restricted to trusted extension contexts.
- [x] Flat context menu.
- [x] Default workspace/database and one-click behavior.
- [x] Close-after-success behavior.
- [x] Configurable pinned-icon action.
- [x] Privacy policy committed.
- [x] Chrome Web Store listing/permission copy committed.
- [x] Release packaging script committed.
- [ ] Final interactive Chrome smoke test.
- [ ] Final Notion OAuth + save test using the exact production package.

## Interactive smoke test

Test with a fresh unpacked installation:

1. Install the `extension/` directory using **Load unpacked**.
2. Confirm the icon appears correctly in `chrome://extensions`, the pinned toolbar, Settings, and Help.
3. Connect Notion from a clean extension profile.
4. Verify accessible databases load.
5. Save one tab using the destination picker.
6. Save 5–10 tabs using the destination picker.
7. Configure a default database and enable instant saving.
8. Verify direct saving does not open the picker.
9. Test close-after-save OFF.
10. Test close-after-save ON and confirm only successfully saved tabs close.
11. Test the flat right-click menu.
12. Test each pinned-icon action you intend to expose.
13. Test an excluded domain.
14. Test a `chrome://` page is skipped safely.
15. Disconnect/reconnect Notion and verify the extension recovers cleanly.

## Public web pages

- [ ] Enable GitHub Pages for this repository, publishing from the `docs/` folder.
- [ ] Confirm `https://nikolaskaralis.github.io/Tabs2Notion/` loads.
- [ ] Confirm `https://nikolaskaralis.github.io/Tabs2Notion/privacy.html` loads.
- [ ] Put that privacy URL into the Chrome Web Store Privacy Practices section.

## Chrome Web Store account

- [ ] Register/verify the Chrome Web Store developer account.
- [ ] Complete publisher contact details.
- [ ] Upload the ZIP produced by `bash scripts/package-release.sh`.
- [ ] Use `CHROME_WEB_STORE.md` for listing and permission/privacy answers.
- [ ] Upload real screenshots from the production extension.
- [ ] Choose initial visibility (unlisted is useful for a small external test before public launch).
- [ ] Submit for review.

## Before every future release

1. Increase `version` in `extension/manifest.json`.
2. Run:
   ```bash
   npm test
   npm run check
   bash scripts/package-release.sh
   ```
3. Load the generated ZIP/unpacked source into Chrome and smoke-test.
4. Update privacy disclosures if permissions, data handling, analytics, or third parties changed.
5. Upload the new ZIP to the Developer Dashboard.
