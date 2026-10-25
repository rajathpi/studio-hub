"""Inline the studio-hub theme kit into tool pages and move their palettes onto theme tokens.

    python _theme/apply.py            # every page in PAGES
    python _theme/apply.py diff-studio.html

Safe to re-run: the kit and slider sit between marker comments and are replaced
each time, and colours already turned into var(--h-*) are not touched again.
Only each page's own stylesheet (its first <style> that styles `body`) is
remapped; colours inside scripts, SVG art and pattern palettes are left alone.
"""
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
PAGES = ["index.html", "diff-studio.html", "regex-studio.html", "merge-studio.html",
         "blob-studio.html", "pattern-studio.html", "code-studio.html", "mermaid-live.html", "pdf-studio.html", "markdown-studio.html", "wallpaper-studio.html", "snap-studio.html", "snap-studio-v2.html", "ocr-studio.html", "qr-studio.html", "color-studio.html", "time-studio.html", "time-studio-v2.html", "convert-studio.html", "outfit-studio.html", "outfit-studio-v2.html", "outfit-studio-v3.html", "outfit-models-v2.html", "outfit-research.html", "outfit-studio-v4.html"]

# The tool pages share one dark palette; each colour becomes a token whose dark
# value is that same colour (see kit.html), so dark mode looks exactly as before.
TOKENS = {
    "bg": ["#1e1f24"], "panel": ["#26272e"], "panel2": ["#2e2f37", "#2a2b33", "#2c2d35", "#2b2c34"],
    "deep": ["#1b1c21", "#1a1b20", "#17181c", "#191a1f", "#1b1f24"], "deep2": ["#22232a", "#24252c", "#202128"],
    "border": ["#3a3b44"], "border2": ["#3a3b46", "#383947"],
    "btn": ["#33343d"], "btn-border": ["#4a4b55"], "btn-hover": ["#41424d"],
    "text": ["#e6e6e6", "#e9eaee"], "text2": ["#b9bac2", "#c9cad1", "#9a9ba3", "#b8bcc4", "#9aa0aa", "#d8d8de"],
    "muted": ["#8a8b94"], "muted2": ["#6f7078", "#5c5d66", "#666c76", "#6a707a"], "faint": ["#565761", "#444a54"],
    "code": ["#d8dee9"], "accent": ["#ff5c8a"], "accent-h": ["#ff7ba0"], "accent2": ["#7f77dd"], "accent-bg": ["#3d2a33", "#3a2b33"],
    "yellow": ["#e8d3a8"], "blue": ["#9ecbff"], "blue2": ["#9db3d8"], "purple": ["#c4a7e7"], "green2": ["#a8d5b5"], "ok": ["#8fd19e"],
    "green": ["#3fb950"], "red": ["#f85149"], "amber": ["#e3b341", "#d29922"],
    "err-bg": ["#5c1f2b"], "err-bg2": ["#7a2938"], "err-text": ["#ffb3c0"],
}
HEX2TOK = {h: t for t, hs in TOKENS.items() for h in hs}
SYS_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
# Pages whose top <header> is a toolbar: the slider docks at its end instead of floating over it.
DOCK = {"markdown-studio.html", "diff-studio.html", "regex-studio.html", "merge-studio.html", "mermaid-live.html", "pdf-studio.html", "code-studio.html", "snap-studio.html", "snap-studio-v2.html", "ocr-studio.html", "qr-studio.html", "color-studio.html", "time-studio.html", "time-studio-v2.html", "convert-studio.html", "outfit-studio.html", "outfit-studio-v2.html", "outfit-studio-v3.html", "outfit-models-v2.html", "outfit-studio-v4.html"}
SLOT = '<span data-hub-theme-slot></span>'

KIT_RE = re.compile(r"<!-- studio-hub theme kit v\d.*?<!-- /studio-hub theme kit -->\n?", re.S)
TOUR_RE = re.compile(r"<!-- studio-hub tour -->.*?<!-- /studio-hub tour -->\n?", re.S)
SLIDER_RE = re.compile(r"<!-- studio-hub theme slider -->.*?<!-- /studio-hub theme slider -->\n?", re.S)


def remap(css: str) -> tuple[str, int]:
    n = 0

    def sub(m):
        nonlocal n
        tok = HEX2TOK.get(m.group(0).lower())
        if not tok:
            return m.group(0)
        n += 1
        return f"var(--h-{tok})"

    def sub_alpha(m):  # #rrggbbaa: same token, alpha kept via color-mix
        nonlocal n
        tok = HEX2TOK.get("#" + m.group(1).lower())
        if not tok:
            return m.group(0)
        n += 1
        return f"color-mix(in srgb, var(--h-{tok}) {round(int(m.group(2), 16) / 2.55)}%, transparent)"

    css = re.sub(r"#([0-9a-fA-F]{6})([0-9a-fA-F]{2})\b", sub_alpha, css)
    css = re.sub(r"#[0-9a-fA-F]{6}\b", sub, css)
    # White text: on an accent-filled control it means "text on accent"; anywhere
    # else it meant "brightest text", which has to flip to near-black when light.
    lines = []
    for line in css.split("\n"):
        if re.search(r"(?<![-\w])color: #fff\b", line):
            tok = "on-accent" if re.search(r"background:\s*var\(--h-accent", line) else "strong"
            line = re.sub(r"(?<![-\w])color: #fff\b", f"color: var(--h-{tok})", line)
            n += 1
        lines.append(line)
    return "\n".join(lines).replace(SYS_FONT, "var(--h-font)"), n


def apply(page: pathlib.Path) -> str:
    s = page.read_text(encoding="utf-8")
    s = KIT_RE.sub("", s)
    s = SLIDER_RE.sub("", s)
    s = TOUR_RE.sub("", s)
    kit = (HERE / "kit.html").read_text(encoding="utf-8").rstrip() + "\n"
    slider = (HERE / "slider.html").read_text(encoding="utf-8").rstrip() + "\n"

    mapped = 0
    if page.name != "pdf-studio.html":  # PDF Studio already runs on its own variables
        m = next((m for m in re.finditer(r"(<style[^>]*>)(.*?)(</style>)", s, re.S) if re.search(r"\bbody\s*\{", m.group(2))), None)
        if not m:
            raise SystemExit(f"{page.name}: no page stylesheet found")
        css, mapped = remap(m.group(2))
        s = s[:m.start(2)] + css + s[m.end(2):]
    else:
        s = s.replace(SYS_FONT, "var(--h-font)", 1)

    s = s.replace("  " + SLOT + "\n", "")
    if page.name in DOCK:
        h = s.index("</header>", s.index("<body"))
        s = s[:h] + "  " + SLOT + "\n" + s[h:]
    s = s.replace('style="font-size:12px;color:#8a8b94"', 'style="font-size:12px;color:var(--h-muted)"')
    i = s.index("</head>")
    s = s[:i] + kit + s[i:]
    j = s.rindex("</body>")
    s = s[:j] + slider + s[j:]
    tours = json.loads((HERE / "tours.json").read_text(encoding="utf-8"))  # in-page walkthroughs
    if page.name in tours:
        key, steps = tours[page.name]
        tour = (HERE / "tour.html").read_text(encoding="utf-8").rstrip()
        call = "<script>hubTour(%s, %s);</script>\n" % (json.dumps(key), json.dumps(steps).replace("</", "<\\/"))
        j = s.rindex("</body>")
        s = s[:j] + tour.replace("<!-- /studio-hub tour -->", call + "<!-- /studio-hub tour -->") + "\n" + s[j:]
    page.write_text(s, encoding="utf-8", newline="\n")
    return f"{page.name}: {mapped} colours -> tokens"


if __name__ == "__main__":
    for name in sys.argv[1:] or PAGES:
        print(apply(ROOT / name))
