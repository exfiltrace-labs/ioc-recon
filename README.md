# IOC Recon - Context Menu Search

A Chrome (Manifest V3) extension that adds a right-click menu to search selected
text across as many configurable sources as you want, all at once. Each source
is a URL or request template, so you can open a search page, hit a REST API, or
POST to a form endpoint. Built for security analysts looking up IOCs, and useful
for any workflow where you select text and look it up somewhere.

---

## Features

- **Right-click search** any selection across every matching source at once.
- **Templates** with a configurable `%s` placeholder: GET / POST to APIs and search endpoints.
- **Indicator detection** (IPv4/IPv6, domain, URL, email, MD5/SHA1/SHA256, etc.)
  with a "Search all" feature to quickly open all relevant sources.
- **Refang and defang**: auto-refang IOCs before searching, or copy a selection
  refanged/defanged straight from the menu.
- **Per-source options**: encoding (none, URL, Base64), categories as submenus,
  and background-tab opening.
- **Import / Export** as JSON, or **sync** from a remote JSON URL with
  per-user overrides on top.

## Install (development)

```bash
npm install
npm run dev
```

To load a production build manually:

```bash
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load
unpacked**, and select `.output/chrome-mv3`.

Firefox builds are available too: `npm run dev:firefox` and `npm run build:firefox`.

## Usage

1. Select text on any page.
2. Right-click and choose **Lookup "..."**.
3. Pick a single source, **Search all matching sources**, or **Copy refanged /
   defanged**.

Manage everything from the options page: **Sources**,
**Import / Export**, **Settings**.

## Remote config (centralised, version-controlled)

1. Commit a JSON file like [`examples/config.example.json`](examples/config.example.json)
   to a repo.
2. In the extension, under **Remote sync**, paste the **raw** file URL and click
   **Grant & sync**.
3. After that it refreshes automatically once per browser start.

The file is the same format that the **Export** feature produces, so an analyst 
can build a set locally, export it, and commit it as a shared baseline. Every 
entry is validated before it is applied.

## How configuration is stored

| Layer | Storage | Roams across devices | Notes |
|-------|---------|----------------------|-------|
| Personal sources + settings | `chrome.storage.sync` | yes | User's own local setup |
| Local overrides (disable a synced source) | `chrome.storage.sync` | yes | Keyed by synced-source id |
| Cached remote config | `chrome.storage.local` | no | Fetched from the remote URL |

**Effective sources** are the synced sources (with your overrides applied) plus
your personal sources.

## Permissions

- `contextMenus`, `storage`: requested at install.
- `scripting`, `activeTab`: used only by **Copy refanged / defanged**. A
  context-menu click grants temporary access to the current tab so a one-shot
  clipboard copy can run.
- **Host access is requested at runtime**, per-origin, only for the remote config
  URL you set.