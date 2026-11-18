# GTA6 Filter

![afraid of spoilers? this extension is for you](docs/banner.png)

[Русский](README.md)

GTA6 Filter hides content explicitly related to GTA 6 in desktop Chrome, Edge, and Firefox. It covers YouTube, Reddit, and X feeds, searches, and individual posts and videos.

Developed by [@hexdm09](https://github.com/hexdm09).

## Installation

### Firefox 140+

1. [Download the Firefox ZIP](https://github.com/hexdm09/Gta-6-filter/releases/latest/download/gta6-filter-firefox.zip).
2. Enter `about:debugging#/runtime/this-firefox` in the Firefox address bar.
3. Select **Load Temporary Add-on** and choose the downloaded ZIP.

The temporary add-on stays active until Firefox restarts. Permanent installation requires a Mozilla-signed build.

### Chrome and Edge

1. [Download the Chrome and Edge ZIP](https://github.com/hexdm09/Gta-6-filter/releases/latest/download/gta6-filter-chromium.zip) and extract it.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge and enable **Developer mode**.
3. Select **Load unpacked** and choose the folder containing `manifest.json`.

Refresh any open YouTube, Reddit, or X tabs after installing. Open GTA6 Filter from the extensions toolbar to change settings.

## How protection works

The extension covers the entire item when it detects GTA 6 in the title, text, available media labels, tags, or a dedicated community. This includes ordinary news and trailers. **Show once** reveals an item until you refresh or navigate to another item. Settings include a switch for each platform and a list of extra words or phrases, one per line.

Direct links are covered while the extension checks the item. If it cannot check the item, it offers a manual reveal. Layout changes, pictures without labels, audio, and indirect references can escape detection. Settings and page processing stay on your device.
