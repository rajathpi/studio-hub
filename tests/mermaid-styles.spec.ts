import { test, expect } from '@playwright/test';

// Mermaid Live's Style picker: every style must render, keep text readable (no label overlaps a
// label, no label spills out of its box), stay inside the frame, and still export.
const DIAGRAMS: Record<string, string> = {
  flowTD: `graph TD
    A[Start] --> B{Is it a long decision label?}
    B -->|Yes| C[Do the thing with a fairly long name]
    B -->|No| D[Skip]
    C --> E[Done]
    D --> E`,
  flowLR: `flowchart LR
    subgraph Ingest
      A[Fetch replays] --> B[Parse 3,322 games]
    end
    B --> C[(Knowledge base)]
    C --> D([Agent])
    D --> E[Submit]`,
  multiline: `graph TD
    A["Line one<br/>line two<br/>line three"] --> B["Short"]
    A --> C["Another<br/>two lines"]`,
  state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Running: start
    Running --> Idle: stop
    Running --> [*]`,
  sequence: `sequenceDiagram
    Alice->>Bob: Hello Bob
    Bob-->>Alice: Hi Alice`,
};
const STYLES = ['mermaid', 'flat', 'iso'];
const THEMES = ['porcelain', 'midnight'];

type Box = { x: number; y: number; w: number; h: number; text: string; owner: number };

for (const [name, code] of Object.entries(DIAGRAMS)) {
  for (const style of STYLES) {
    for (const theme of THEMES) {
      test(`mermaid style ${style} · ${theme} · ${name}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.addInitScript(([c, s, t]) => {
          localStorage.setItem('mermaid-live-code', c);
          localStorage.setItem('mermaid-live-style', s);
          localStorage.setItem('mermaid-live-theme', t);
          localStorage.setItem('mermaid-live-backend', '');
        }, [code, style, theme]);
        await page.emulateMedia({ reducedMotion: 'reduce' }); // check the finished frame
        await page.goto('/mermaid-live.html', { waitUntil: 'networkidle' });
        const svg = page.locator('#canvas svg');
        await expect(svg).toHaveCount(1);
        await page.waitForTimeout(300);

        const isoFallback = style === 'iso' && name === 'sequence';
        if (isoFallback) await expect(page.locator('#error')).toContainText('Isometric works for');
        else await expect(page.locator('#error')).not.toHaveClass(/show/);

        const report = await page.evaluate(() => {
          const svg = document.querySelector('#canvas svg') as SVGSVGElement;
          const r = svg.getBoundingClientRect();
          const boxes: Box[] = [];
          const owners = [...svg.querySelectorAll('g.node, g.ml-iso-node, g.edgeLabel, g.ml-iso-elabel, g.cluster, g.actor, text.messageText')];
          svg.querySelectorAll('text, foreignObject p, foreignObject span.nodeLabel:not(:has(p)), foreignObject span.edgeLabel:not(:has(p))').forEach((t) => {
            const b = t.getBoundingClientRect();
            if (!t.textContent!.trim() || b.width < 1) return;
            const owner = owners.findIndex((o) => o.contains(t));
            boxes.push({ x: b.x, y: b.y, w: b.width, h: b.height, text: t.textContent!.trim(), owner });
          });
          const overlaps: string[] = [];
          for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            if (a.owner === b.owner && a.owner !== -1) continue; // lines of one label
            const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
            const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
            if (ox > 2 && oy > 2) overlaps.push(`"${a.text}" × "${b.text}"`);
          }
          const outside = boxes.filter((b) => b.x < r.x - 1 || b.y < r.y - 1 || b.x + b.w > r.x + r.width + 1 || b.y + b.h > r.y + r.height + 1).map((b) => b.text);
          // Isometric: each node label must sit inside its box's top face.
          const spill: string[] = [];
          svg.querySelectorAll('g.ml-iso-node').forEach((g) => {
            const faces = g.querySelectorAll('polygon');
            const top = faces[faces.length - 1].getBoundingClientRect();
            g.querySelectorAll('text').forEach((t) => {
              const b = t.getBoundingClientRect();
              if (b.x < top.x - 1 || b.x + b.width > top.x + top.width + 1 || b.y < top.y - 1 || b.y + b.height > top.y + top.height + 1) spill.push(t.textContent!);
            });
          });
          return { overlaps, outside, spill, count: boxes.length };
        });
        expect(report.count, 'some text rendered').toBeGreaterThan(0);
        expect(report.overlaps, 'labels overlapping').toEqual([]);
        expect(report.outside, 'labels outside the frame').toEqual([]);
        expect(report.spill, 'labels spilling off their box').toEqual([]);

        // Exports still work.
        const [png] = await Promise.all([page.waitForEvent('download'), page.click('#pngBtn')]);
        expect(png.suggestedFilename()).toMatch(/\.png$/);
        const [svgDl] = await Promise.all([page.waitForEvent('download'), page.click('#svgBtn')]);
        const text = await (await svgDl.createReadStream())!.toArray().then((c) => Buffer.concat(c).toString('utf8'));
        if (style !== 'mermaid' && !isoFallback) expect(text).toContain('ml-anim');

        await page.locator('#right').screenshot({ path: `test-results/mermaid-styles/${name}-${style}-${theme}.png` });
        expect(errors).toEqual([]);
      });
    }
  }
}

// The build animation must actually play, and end with every node exactly where it started.
for (const style of ['flat', 'iso']) {
  test(`mermaid style ${style} animates and settles in place`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.addInitScript(([c, s]) => {
      localStorage.setItem('mermaid-live-code', c); localStorage.setItem('mermaid-live-style', s);
      localStorage.setItem('mermaid-live-theme', 'porcelain'); localStorage.setItem('mermaid-live-backend', '');
    }, [DIAGRAMS.flowTD, style]);
    await page.goto('/mermaid-live.html');
    const sel = style === 'flat' ? '#canvas svg .ml-n' : '#canvas svg .ml-iso-node';
    await page.waitForSelector(sel);
    const early = await page.$$eval(sel, (els) => els.map((e) => +getComputedStyle(e).opacity));
    expect(Math.min(...early), 'something is still fading in').toBeLessThan(1);
    await page.waitForTimeout(2500);
    const settled = await page.$$eval(sel, (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [+getComputedStyle(e).opacity, Math.round(r.x), Math.round(r.y)]; }));
    expect(settled.every((s) => s[0] === 1), 'all visible at the end').toBe(true);
    // Same positions as with motion off.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const still = await page.$$eval(sel, (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [1, Math.round(r.x), Math.round(r.y)]; }));
    expect(settled).toEqual(still);
  });
}
