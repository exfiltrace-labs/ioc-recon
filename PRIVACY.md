# Privacy Policy for IOC Recon

_Last updated: 2 July 2026_

IOC Recon ("the extension") is a browser extension that adds a right-click menu
to search selected text across sources you configure. This policy explains what
the extension does and does not do with your data.

## What we collect

Nothing. The developer does not collect, receive, store, sell, or transmit any
of your data. There are no analytics, no telemetry, no tracking, no ads, and no
remote code. The extension runs entirely on your device.

## What the extension does with data

- **Selected text.** When you invoke a lookup, the text you selected is inserted
  into the source template you configured and sent to that destination (a browser
  tab or a form POST) so the search can run. It is sent only to the source you
  chose, only when you explicitly trigger a lookup, and never to the developer.
- **Copy refanged / defanged.** When you use these menu items, the selected text
  is transformed and written to your clipboard on the active page. It is not sent
  anywhere.
- **Your configuration.** Your sources and settings are stored in the browser's
  own `chrome.storage.sync` (so they can roam with your browser profile) and
  `chrome.storage.local`. This data stays within your browser and your account's
  own sync; the developer has no access to it.
- **Remote config sync (optional).** If you set a remote config URL, the
  extension fetches that URL to load a shared set of sources. The request goes
  only to the URL you provide. Host access is requested at runtime for that
  single origin and for nothing else.

## Permissions

- `contextMenus`, `storage`: to build the right-click menu and store your
  configuration locally.
- `scripting`, `activeTab`: used only by the "Copy refanged / defanged" items to
  write to the clipboard on the current tab after you click. No standing access
  to any site is requested or retained.
- Host access: requested at runtime, per origin, only for a remote config URL you
  choose to set. A fresh install requests no host access at all.

## Data sharing

The extension shares no data with the developer or any third party. Any data
leaves your browser only as the direct result of a lookup you trigger, and only
to the destination you configured.

## Changes

If this policy changes, the updated version will be posted at this location with
a new "Last updated" date.

## Contact

Questions: https://github.com/exfiltrace-labs/ioc-recon
