# Studio Hub

**Small tools that run in your browser.** Screenshots, OCR, colours, QR codes, PDFs, markdown, diagrams, diffs, regex, mail merge, time zones, unit conversion, generative art, wallpapers, avatars and a dressed 3D figure, each one a single file: no install, no accounts, no server, and nothing you open ever leaves your machine.

### → [Open Studio Hub](https://rajathpi.github.io/studio-hub/)

Every browser-only tool runs straight from that link, with no clone and no build step. Or download the files and open `index.html` from disk; they behave the same, offline included.

![Studio Hub](docs/hub.png)

The hub shows the three tools reached for most as big cards with their line figures and the rest as a quiet grid; every tool is one line in [`_theme/tools.js`](_theme/tools.js).

> **Tip:** Merge, PDF, Mermaid and Regex Studio have a **?** button (bottom left) that starts a short guided tour. It is also offered once on your first visit.

## Why single files?

Every tool here is one self-contained `.html` file: open it from disk, it works — even offline. That's not a gimmick, it's the point:

- **Privacy by architecture.** You can't responsibly paste work code, internal configs, or secrets into an online diff checker or regex tester. A local file with no network calls removes the question entirely.
- **Nothing to break.** No dependencies to update, no service to shut down, no subscription to lapse. These files will open in 2040.
- **Trivially portable.** Email a tool to a colleague; it still works.

## The tools

### Snap Studio — [`snap-studio.html`](snap-studio.html)

Take a screenshot (Win+Shift+S or ⌘⇧4), press Ctrl/⌘+V on the page, and mark it up: pen, see-through marker, box (Shift for a square) and arrow, in six colours and three weights. Marks stay editable: pick the Move tool, drag a box or an arrow somewhere else, pull its corner dots to resize it, recolour or delete it; everything undoes. Ctrl/⌘+C puts the finished picture back on the clipboard at full resolution, Ctrl/⌘+S saves a PNG.

### OCR Studio — [`ocr-studio.html`](ocr-studio.html)

Paste a screenshot and get selectable text back. The engine is PaddleOCR (PP-OCRv5 detection and Latin recognition, ONNX) running in the browser through onnxruntime-web, on the GPU where the browser has WebGPU; it reads small grey UI text, dark themes and å ä ö where Tesseract stumbled, and in a side-by-side test found every word of a real screenshot where Tesseract found 89%. The models (about 20 MB) download once and are cached; Tesseract.js (English + Swedish) stays as the fallback and as a choice. Line boxes can be shown on the image, a dragged rectangle reads only that part, and a Table tab rebuilds rows and columns from the box positions so a screenshot of a table pastes into Excel or Sheets as cells (or as Markdown).

### Color Studio — [`color-studio.html`](color-studio.html)

Paste a screenshot, hover for a magnified pixel grid with the exact hex, click to keep a colour (hex, RGB, HSL, nearest CSS name, all click-to-copy), or pick from anywhere on screen with the eyedropper. An automatic palette pulls the dominant colours with their share of the image; two picked colours get a WCAG contrast check; palettes export as CSS variables, JSON, a Tailwind object or a PNG strip.

### QR Studio — [`qr-studio.html`](qr-studio.html)

Make a QR code for a link, Wi-Fi network, contact, email, SMS or phone number and see it in nineteen styles at once: classic to dots, gradients and captioned cards, four **mosaics** where every module is a tile in a seasonal palette (spring, summer, autumn, or one of Sanzo Wada's 348 combinations), and three **gardens**, an isometric plot with a tree growing on it that flattens, viewed straight down, into the code (scene after [voxel-qr-tree](https://github.com/nguyenhanhatminh0105-hue/voxel-qr-tree), MIT). Every flat style is read back to confirm it still scans. Customise one and export it as a 2048 px PNG, an SVG, a clipboard image or a printable Wi-Fi card. The Scan tab reads a code from a pasted screenshot, a file or the camera and shows what it says, with copy buttons for Wi-Fi passwords. Rendering by [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) (MIT), reading by [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0).

### Time Studio — [`time-studio.html`](time-studio.html)

The same instant in several cities, hour by hour. Rows for Gothenburg, Mangalore, New York and San Francisco by default (add any of ~175 cities or an IANA zone, rename them, mark each as work or family), aligned to the home row so one column is one moment, coloured for night, morning/evening and working hours. Hover to read every zone, click to pin a time, pick another date (DST-correct), and the board lists the hours that suit everyone. Copy puts a one-line summary on the clipboard; .ics downloads a meeting at the pinned time.

### Convert Studio — [`convert-studio.html`](convert-studio.html)

Type it the way you'd say it: `175 cm in ft`, `100 sqm to sq ft`, `5 lakh to million`, `20 c`, `5'10`, `5:30 min/km in mph`. The answer appears big, every other unit of that kind sits under it, and Enter keeps the line in a short history. Spelling is forgiving: `sqm`, `square meters`, `m2`, `m^2` and `metre square` all mean m²; plurals, `kilos`, `rupees`, `kronor`, typos like `celcius` and `farenheit` all land. Suggestions appear as you type a unit (Tab takes the first), and **All units** lists everything by group. **Browse** is the other way round: pick a group and a unit on the left, type an amount, see it in every other unit. Eighteen groups: currency (SEK, INR, USD, EUR, GBP, NOK, DKK, CHF, JPY, AED, live ECB rates kept for offline use), big numbers with lakh and crore, length, area (with cent and gunta), volume, weight (with tola), temperature, speed, running pace, fuel economy, data, internet speed, time, energy, power, pressure and angle.

### Wallpaper Studio — [`wallpaper-studio.html`](wallpaper-studio.html)

One wallpaper across several screens. Detect your monitors (or add them by hand), drag them into the order they stand on your desk, and the scene is laid out over the whole desk in real centimetres, so horizons, contour lines and grids carry on across the bezels. Fourteen quiet scenes, each with a few variants: dusk mountains, soft gradient, ink mist, night sky, sea sunrise, desert dunes, foggy pines, aurora snow, mirror lake, rolling hills, doodle wall, mesh gradient, misty archipelago, window light, contour map and graph paper (a true 1 cm grid). Export a Windows Span PNG, one PNG per screen for macOS, or a preview of the desk.

### Outfit Studio — [`outfit-studio.html`](outfit-studio.html)

Sanzo Wada's 348 colour combinations from *A Dictionary of Color Combinations* (1933), worn by real people. Pick one of 111 figures from Microsoft's [Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) library (MIT) — they stand, look around, talk, wave and dance on their own — then pick a combination and each garment is recoloured to it while skin and hair stay as they are; folds and shading survive because only the hue changes. Swap colours between garments, filter combinations by a colour, save a PNG. Figures and motions stream from GitHub, so this one needs a connection. Colour data from [dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations) (MIT).

### Blob Studio — [`blob-studio.html`](blob-studio.html)

Type any string — a username, an email, a repo — and get a deterministic blob avatar: the same name always gives the same creature. Pick one of 14 moods, pin the shape, hue or tone, add a backdrop, and export a 512 px SVG or PNG. The big preview idles and follows your cursor; the crowd below shows variations on the name.

![Blob Studio](docs/blob-studio.png)

The generator is [blobatar](https://github.com/Alain00/blobatar) 2.7.0 by Alain (MIT), bundled inline unmodified with its license notice, so the page still works offline.

### Code Studio — [`code-studio.py`](code-studio.py) + [`code-studio.html`](code-studio.html)

A competitive-programming workbench: editor with tabs and per-language templates, a file explorer over a real workspace folder, and a **multi-test-case runner** with AC / WA / TLE / RE verdicts and per-test timing.

This is the one tool that isn't browser-only — browsers can't run compilers — so it ships with a tiny local runner (pure Python stdlib, nothing to install) that detects the toolchains on your machine (C++, C, Python, Node, Java, Go, Rust), compiles and runs your code with time limits, and serves the UI at `http://127.0.0.1:8137`. It binds to localhost only and requires a per-session token. On macOS it also ships a `bits/stdc++.h` shim so classic CP code compiles under Apple clang.

```bash
./code-studio.command                              # macOS: double-click works too
python3 code-studio.py                             # any OS
python3 code-studio.py ~/path/to/your/cp-folder    # use an existing folder as workspace
```

![Code Studio](docs/code-studio.png)

## Look and feel

Every page opens light, with a small light/dark slider in the top right (or at the end of the toolbar), and the choice carries across all the tools. Titles are set in Hubot Sans and text in Mona Sans, loaded from jsDelivr; offline, pages fall back to the system font and keep working. Everything respects your system's reduced-motion setting.

The shared theme lives in [`_theme/`](_theme): edit `kit.html` or `slider.html`, then run `python _theme/apply.py` to re-inline it into every page, so each tool stays a single file.

## Getting started

The quickest path is the hosted hub — [rajathpi.github.io/studio-hub](https://rajathpi.github.io/studio-hub/) — which serves the same files straight from `main`.

To run them locally instead:

```bash
git clone https://github.com/rajathpi/studio-hub.git
cd studio-hub
open index.html        # or just double-click it
```

Each tool remembers its inputs between sessions (localStorage). Every tool except Code Studio is pure browser code, so once a page has loaded it keeps working with the network off.

### Browser notes

- Everything works in any modern browser.
- Mermaid Studio's **Open folder…** (real files on disk) uses the File System Access API: Chrome, Edge, and Arc have it enabled; **Brave** ships it disabled — enable `brave://flags/#file-system-access-api` and relaunch. Safari/Firefox fall back to an in-browser project.
- PDF Studio loads its PDF, Office and rasterising libraries from a CDN on first open, so that one needs a connection the first time (the page is cached afterwards). OCR Studio fetches its language data once, QR Studio its two small libraries, and Outfit Studio streams its figures from GitHub every time. Every other browser tool is fully self-contained.
- Time and Convert Studio fetch the day's exchange rates from the European Central Bank feed at api.frankfurter.dev when online, and keep the last rates for offline use. Nothing about you goes with the request.
- Code Studio requires Python 3 (preinstalled on macOS and most Linux distros) for its local runner. It is the one tool the hosted hub can't run, since it needs a compiler on your machine.

## License

[MIT](LICENSE)
