# Patotube — browser companion

A thin browser extension (Manifest V3) that lives in the toolbar:
click the duck icon, the popup picks up the active tab's URL (or
takes a manual paste), and fires the `patotube://` URL scheme.
The desktop app catches the scheme and opens its download preview.

No content scripts, no DOM injection, no broad host access. The
only permission is `activeTab` — granted by Chrome on click,
revoked the moment the popup closes.

The extension itself does **no downloading** — it's a glorified URL
forwarder. All the platform-extraction logic lives in the desktop
app, so there's nothing to maintain in two places.

A userscript twin lives at [`landing/public/patotube.user.js`][us]
for users who prefer Tampermonkey / Violentmonkey / Greasemonkey.

[us]: ../landing/public/patotube.user.js

---

## Install — Chromium browsers (Chrome / Edge / Brave / Opera / Vivaldi)

Chrome refuses to install self-hosted `.crx` files directly since
2018. The supported off-store path is **developer mode + load unpacked**:

1. Download `patotube-extension-<VERSION>.zip` from the GitHub
   release and **extract it** somewhere stable (e.g. `~/Patotube/`).
   *Don't delete this folder — Chrome reads from it on every start.*
2. Open `chrome://extensions` (or `edge://extensions`,
   `brave://extensions`, …).
3. Toggle **"Developer mode"** in the top-right corner.
4. Click **"Load unpacked"** and pick the extracted folder.
5. The Patotube duck appears in your extensions toolbar.

To update: download the new `.zip`, replace the folder contents,
click the refresh icon on the Patotube card in `chrome://extensions`.

## Install — Firefox

Firefox accepts signed `.xpi` files self-hosted, with a clean
one-click install:

1. Download `patotube-<VERSION>.xpi` from the GitHub release.
2. Drag-and-drop it onto a Firefox window (or open the file).
3. Confirm the install prompt.

Updates are checked automatically by Firefox via the manifest's
`browser_specific_settings.gecko.update_url` once that's wired up;
otherwise grab a new `.xpi`.

## Install — Safari

Not supported yet. Safari extensions need an Xcode build + an Apple
Developer account, which is out of scope for this side-project.

---

## Build

```bash
cd extension
zip -r ../release-assets/patotube-extension-0.4.0.zip . -x '*.DS_Store' '*.git*'
```

The `.zip` is what you upload to the GitHub release for Chromium
users.

### Firefox `.xpi` (signed)

Mozilla's "unlisted self-distribution" channel signs add-ons for
sideload without a content review. One-time setup:

1. Get an API key + secret at
   <https://addons.mozilla.org/en-US/developers/addon/api/key/>.
2. Install [`web-ext`](https://github.com/mozilla/web-ext):
   ```bash
   pnpm add -g web-ext
   ```

Then from `extension/`:

```bash
web-ext sign \
  --api-key=$AMO_JWT_ISSUER \
  --api-secret=$AMO_JWT_SECRET \
  --channel=unlisted \
  --artifacts-dir=../release-assets
```

Mozilla returns a signed `patotube-0.4.0.xpi` in
`release-assets/` within ~30 s. That file is what Firefox users
install.

---

## Permissions explained

- `activeTab` — only used by the popup to read the current tab's
  URL when the user clicks the toolbar icon. Granted on click,
  revoked when the popup closes.

That's the only permission. No `host_permissions`, no `tabs`, no
`webRequest`, no `storage`. The content script reaches DOM only on
the five `@match` patterns explicitly listed in `manifest.json`.

## Architecture

```
extension/
├── manifest.json       # MV3, popup action only
├── popup.html          # popup chrome
├── popup.js            # reads activeTab URL + manual paste
└── icons/              # 32 / 48 / 128 px duck
```

The platform-detection regex in `popup.js` matches the one in the
userscript twin (`landing/public/patotube.user.js`), so the
"this URL is supported" check is consistent across both deliveries.

## Privacy

- No analytics, no telemetry, no remote calls.
- The only network it can do is what the page already allows
  (the content script runs in the page's origin); the extension
  itself never opens a connection.
- Data flows in one direction only: browser → desktop, via the
  local OS-level `patotube://` URL handler.
