# Duo Translate

A browser extension that translates web pages and shows the translation under each paragraph. Short labels like buttons, tabs and menu items are swapped in place so layouts don't break. Free and needs no account.

- **Alt+A** (Control+Shift+A on a Mac), or right-click and choose **Translate page**, turns it on and off.
- It only translates what's on screen, so long pages stay fast. New content gets translated as it loads.
- The popup lets you pick **Both** (original + translation) or **Translation** only, set the target language, and choose **Always translate** for a site.

## Engines

| Engine | Where | Notes |
|---|---|---|
| On-device | Chrome 138+ (Windows, Mac) | Chrome's built-in Translator. Runs on your machine and works offline. Download a language pair once from the popup. |
| Google | Every browser | Google's free endpoint. No key needed. |

**Auto** (the default) uses the on-device model when it's ready and Google otherwise. Brave, Edge and Firefox don't ship the on-device translator, so they always use Google.

## Install

Get the folder onto the machine first:

```
git clone https://github.com/rajathpi/duo-translate.git
```

**Chrome, Brave, Edge (Windows or Mac)**
1. Open `chrome://extensions` (Brave: `brave://extensions`, Edge: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick the `duo-translate` folder.
4. Reload any tabs that were already open.

After a `git pull`, click the reload icon on the extension's card.

**Firefox (Windows or Mac)**
Open `about:debugging#/runtime/this-firefox` and click **Load Temporary Add-on**, then pick `manifest.json`. It stays loaded until Firefox restarts. Firefox asks for site access the first time, so allow it on all sites.

**Shortcut**: change it at `chrome://extensions/shortcuts`. If another extension already uses the key, the browser leaves it unset; pick one there.

## Files

- `content.js`: finds text blocks, translates them as they scroll into view, and handles page changes
- `background.js`: Google requests (batched, cached), the shortcut and the right-click menu
- `popup.*`: settings
- `content.css`: how translations look
