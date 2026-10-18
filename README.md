# Studio Hub

**Small tools that run in your browser.** PDFs, markdown, diagrams, diffs, regex, mail merge, generative art and avatars, each one a single file: no install, no accounts, no server, and nothing you open ever leaves your machine.

### → [Open Studio Hub](https://rajathpi.github.io/studio-hub/)

Every browser-only tool runs straight from that link, with no clone and no build step. Or download the files and open `index.html` from disk; they behave the same, offline included.

![Studio Hub](docs/hub.png)

> **Tip:** Merge, PDF, Mermaid and Regex Studio have a **?** button (bottom left) that starts a short guided tour. It is also offered once on your first visit.

## Why single files?

Every tool here is one self-contained `.html` file: open it from disk, it works — even offline. That's not a gimmick, it's the point:

- **Privacy by architecture.** You can't responsibly paste work code, internal configs, or secrets into an online diff checker or regex tester. A local file with no network calls removes the question entirely.
- **Nothing to break.** No dependencies to update, no service to shut down, no subscription to lapse. These files will open in 2040.
- **Trivially portable.** Email a tool to a colleague; it still works.

## The tools

### PDF Studio — [`pdf-studio.html`](pdf-studio.html)

Fifteen PDF operations behind one file manager: merge, split, remove, extract, reorder, rotate, page numbers, watermark, metadata, images ↔ PDF, and an Office bridge for Word, PowerPoint and Excel. Drop in a mix of PDFs, images and Office files and every operation that applies to them lights up.

![PDF Studio](docs/pdf-studio.png)

**Pages are edited visually, not by typing ranges.** Merge, reorder, remove, extract, rotate and split all share one thumbnail grid: drag a page to move it — across files, not just within one — click to select, rotate individual pages or a whole selection, and drop pages you don't want. Removed pages stay greyed out rather than vanishing, so you can put them back before saving. Nothing is written until you hit save.

![Page organiser](docs/pdf-studio-organizer.gif)

The same grid is what every page operation opens onto — here it is mid-edit, with one page turned a quarter-turn, one flipped upside down, one dropped, and one selected:

![The page grid, mid-edit](docs/pdf-studio-organizer.png)

Split builds on it too: give it ranges (`1-3, 5, 8-10`, shown as removable chips), a fixed chunk size, one file per page, or a visual pick — and get either separate PDFs in a zip or one merged document.

**Stamping shows you the result before you commit.** Page numbers offer six positions, four formats (`1`, `i`, `Page 1`, `1 of 10`), a start-at offset, skip-the-cover, colour and weight — rendered live onto page one as you change them.

![Page numbers](docs/pdf-studio-page-numbers.png)

Watermarks come as a single stamp, a diagonal run, or a tiled grid, with size, opacity, rotation and colour on live sliders.

![Watermark](docs/pdf-studio-watermark.gif)

**The Office bridge writes real PDFs.** Word documents are laid out with their own page size, margins, styles, tables and images and then written directly to a PDF — no print dialog, no "save as PDF" detour. PowerPoint decks are rebuilt at the deck's real slide size with their text and embedded pictures. Excel renders each sheet you tick as a paginated table with repeated headers.

![Word to PDF](docs/pdf-studio-word.png)

Going the other way, **PDF → Word** produces a genuine `.docx`: heading levels are inferred from font sizes, bold runs and font families are carried over, and each PDF page becomes a page break. **PDF → images** renders JPG, PNG or WebP at DPI presets from screen (150) to archival (600), for all pages, the first page, a custom range, or a visual selection.

### Markdown Studio — [`markdown-studio.html`](markdown-studio.html)

Paste or type markdown on the left and it renders on the right as you type: GitHub-flavoured tables, task lists, strikethrough, fenced code. **Download PDF** makes a clean, text-selectable PDF in one click: type a file name, press Enter, done (A4 or Letter, page numbers, headings never stranded at a page bottom). It also opens and saves `.md` files (or drop one on the page), copies or exports the rendered HTML, prints, and keeps your draft between visits. Pasted HTML is sanitized, so scripts never run.

![Markdown Studio](docs/markdown-studio.png)

Built on [marked](https://github.com/markedjs/marked) (MIT), [DOMPurify](https://github.com/cure53/DOMPurify) (Apache-2.0/MPL-2.0) and [pdfmake](https://github.com/bpampuch/pdfmake) (MIT) with Roboto, all inlined, so it works offline.

### Mermaid Studio — [`mermaid-live.html`](mermaid-live.html)

Live Mermaid diagram editor with 8 hand-tuned themes, high-resolution PNG/SVG/clipboard export, and a file explorer that saves real `.mmd` files to a folder on disk. The diagram sits on a pan-and-zoom canvas: scroll to zoom around the pointer, drag to move, double-click (or **Fit**) to frame the whole thing, and go fullscreen for presenting. Zoom re-renders the vector, so it stays sharp at any magnification and exports are unaffected. Editor and preview are split by draggable seams, so you can give either side the room it needs. Also maintained standalone at [rajathpi/mermaid-studio](https://github.com/rajathpi/mermaid-studio).

![Mermaid Studio](docs/mermaid-studio.png)

### Diff Studio — [`diff-studio.html`](diff-studio.html)

Compare two texts with a patience diff (the same algorithm family git uses) and **word-level highlighting** inside changed lines. Side-by-side or unified view, ignore-whitespace/case options, "changes only" collapsing for long files, drag-and-drop file loading, and one-click export as a unified `.patch`.

![Diff Studio](docs/diff-studio.png)

### Regex Studio — [`regex-studio.html`](regex-studio.html)

Live match highlighting, numbered and named capture groups, a replace preview, and a **plain-English explanation** of your pattern generated by a built-in regex parser. Keep a table of test cases with should-match / should-not-match expectations and live PASS/FAIL badges. Runaway patterns (catastrophic backtracking) are killed after 1.5 s instead of freezing the tab.

![Regex Studio demo](docs/regex-demo.gif)

### Merge Studio — [`merge-studio.html`](merge-studio.html)

Mail merge without the cloud. Drop a **CSV/XLSX** (or paste cells straight from Excel), write a document template with `{{placeholders}}`, and get **one personalized PDF per row** — or one per person, with `{{#each}}` tables and `{{sum:…}}` totals when several rows belong to the same record. Everything renders locally; salary data, client lists, and HR files never touch a server.

![Merge Studio](docs/merge-studio.png)

The template language covers real documents, not just letters: filters (`{{Salary | currency:EUR}}`, `date:`, `number:`, `blank:`), conditional blocks (`{{#if Status = "Active"}}…{{else}}…{{/if}}`), tables, page breaks, headers/footers with page numbers, a logo, and custom fonts (drop a `.ttf` for full Unicode). A live preview shows each record as you type — switch to the PDF tab for the real rendered output — and a checks panel flags typo'd field names (with did-you-mean), empty values, and filename collisions before you generate.

The whole flow — load the built-in sample, flip through records, edit the template with the preview following along, check the real PDF, download everything as a zip:

![Merge Studio demo](docs/merge-demo.gif)

Output: individual PDFs zipped, one combined PDF, or **`.eml` email drafts** (with the PDF attached) that open ready-to-send in Outlook / Apple Mail — review each one, hit send. Nothing is ever sent for you. Row filters (`Amount > 0 and Status = Active`), per-row include checkboxes, EU/US number-format handling, and project export/import round it out.

![Email drafts demo](docs/merge-email.gif)

### Pattern Studio — [`pattern-studio.html`](pattern-studio.html)

A gallery of 53 generative patterns you can tune and export, including math and physics: Chladni plates, electric field lines, wave interference, orbit trails, a double pendulum, the Lorenz and Clifford attractors, the times-table circle, the Apollonian gasket and Julia-set contours. The rest span tiles (Truchet and hex weaves, shape tiles, basket weave, warped checkerboard), cells (relaxed Voronoi, low-poly terrain, recursive split), lines (flow fields, topographic contours, wave lines, circuit traces, sunburst), curves (rose, Lissajous, harmonograph, spirograph, supershape), fractals (Hilbert, dragon, Koch, fractal tree, Barnsley fern) and op-art (moiré, perspective tunnel, pursuit and hypnotic squares). The gallery can be searched, filtered by tag, or sent somewhere random with **Surprise me**. Every pattern has its own sliders, a **Randomise** button (<kbd>S</kbd>) and a seed (press <kbd>R</kbd> to roll a new one), nine ink/paper palettes plus custom colours, five print and screen formats, and export as SVG or a 3000 px PNG. Each pattern has a deep link (`pattern-studio.html#flow`). All generators are original code, and whatever you export is yours.

![Pattern Studio](docs/pattern-studio.png)

Patterns built around a centre have a **Composition** setting for wide and multi-screen sheets: *Fill* grows a radiating motif (a sunburst, rings) to cover the whole sheet around a centre you can move, *Repeat* gives each screen its own copy of a closed shape (a flower, a rosette, a tree), and *Auto* picks for you.

The **Desk · multi-monitor** format turns any pattern into one wallpaper that runs across several screens. **Detect my screens** reads your monitors and exactly where Windows places them (Chrome and Edge ask permission once; other browsers see one screen, and you add the rest by hand). Then drag them into the order they stand on your desk and check each diagonal, since browsers can't read inches. The pattern is laid out in real centimetres over the whole desk, so a line keeps its size and carries on across the bezels even when the screens have different pixel densities. Export a Windows **Span** PNG placed exactly where Windows shows each screen, a zip with one PNG per screen (for macOS or per-monitor wallpapers), or a preview of the desk. After a Span export a short card walks through the last step: Settings › Personalization › Background, Picture, fit **Span**. Setting it from Photos or a right-click uses Fill instead, which squeezes the whole picture onto every screen.

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
- PDF Studio loads its PDF, Office and rasterising libraries from a CDN on first open, so that one needs a connection the first time (the page is cached afterwards). Every other browser tool is fully self-contained.
- Code Studio requires Python 3 (preinstalled on macOS and most Linux distros) for its local runner. It is the one tool the hosted hub can't run, since it needs a compiler on your machine.

## License

[MIT](LICENSE)
