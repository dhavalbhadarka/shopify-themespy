# Shopify Theme Inspector

A tiny MV3 Chrome extension. Click it on any Shopify storefront to read the
active theme's details straight from the page's `Shopify.theme` object.

## What it shows

| Field         | Source                                              |
| ------------- | --------------------------------------------------- |
| Theme         | `Shopify.theme.name` (e.g. `Foxly \| main`)          |
| Base theme    | `Shopify.theme.schema_name` (e.g. `Dawn`) + fork/store tag |
| Installed     | `Shopify.theme.schema_version` (e.g. `15.4.0`)      |
| Latest        | `Shopify/dawn` GitHub latest release (Dawn only)    |
| Store URL     | `Shopify.shop` (e.g. `livefoxly.myshopify.com`)     |
| Role          | `Shopify.theme.role` (e.g. `main`)                  |
| Detected apps | Script/link tag domains matched against a known fingerprint list |

`theme_store_id: null` means it's a fork (custom theme) rather than the
unmodified store theme — shown as a `fork` tag next to the base theme.

## Install (load unpacked)

1. Unzip this folder somewhere permanent.
2. Go to `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Pin the extension, open a Shopify storefront, and click the icon.

## How it works

- `chrome.scripting.executeScript({ world: "MAIN" })` reads `window.Shopify`
  directly. (Content scripts run in an isolated world and can't see page globals,
  which is the usual gotcha — MAIN world avoids it.)
- `activeTab` permission grants temporary access to the current tab on the
  click, so no broad storefront host permissions are needed.
- The "Latest" lookup hits `api.github.com` (declared in `host_permissions`).

## Notes / limits

- **Latest version** is resolved for **Dawn** via the public `Shopify/dawn`
  repo — the only Shopify reference theme with a public GitHub source. Sense,
  Craft, Refresh, Ride, etc. aren't open source, so "Latest" shows `—` for
  them with a link to the theme store listing instead.
- **Detected apps** only catches apps that load a `<script src>` or
  `<link href>` from a known CDN domain by the time the popup runs. Apps that
  are server-side only (pure Liquid snippets, no client asset) or that
  lazy-load after this scan won't show up. Add more entries to the
  `FINGERPRINTS` list in `popup.js` to extend coverage.
- `schema_version` reflects the `theme_version` the developer stamped in
  `config/settings_schema.json`, so on a heavily customized fork it's whatever
  base version they last synced from.
- Headless (Hydrogen) and password‑protected stores won't expose `Shopify.theme`.

## Recently inspected

The popup keeps the last 8 stores you've inspected (`chrome.storage.local`,
deduped by shop domain, most recent first). Click the clock icon in the
header to open the full list in its own tab (`history.html`) — click any
entry there to open that store's homepage in a new tab, remove one with the
`×`, or wipe everything with **Clear all**.

## Ideas to extend

- Options page for custom GitHub repo mappings, so "Latest" works on private/custom theme forks.
