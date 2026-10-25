import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';

// Hosts a page may contact. Everything else breaks the "nothing leaves your machine" claim.
// jsdelivr serves the Hubot/Mona Sans web fonts (and Mermaid Studio's libraries).
// api.frankfurter.dev is the ECB exchange-rate feed Time and Convert Studio read; no data goes out with the request.
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'cdn.jsdelivr.net', 'api.frankfurter.dev']);
// PDF Studio ships its libraries from vendor/, so it must not touch any third party at all.
const NO_THIRD_PARTY_SCRIPTS = new Set(['pdf-studio.html']);

const PAGES = [
  'index.html', 'diff-studio.html', 'regex-studio.html', 'merge-studio.html', 'blob-studio.html',
  'pattern-studio.html', 'mermaid-live.html', 'pdf-studio.html', 'markdown-studio.html', 'wallpaper-studio.html',
  'snap-studio.html', 'color-studio.html', 'qr-studio.html', 'time-studio.html', 'convert-studio.html',
  // ocr-studio and outfit-studio stream language data and figures from other hosts, so they sit outside this check
];

for (const page of PAGES.filter(p => existsSync(p))) {
  test(`${page} loads cleanly`, async ({ page: pg }) => {
    const problems: string[] = [];
    pg.on('pageerror', e => problems.push('exception: ' + e.message));
    pg.on('console', m => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console.error: ' + m.text());
    });
    pg.on('request', r => {
      const u = new URL(r.url());
      if (!/^https?:$/.test(u.protocol)) return;
      const ok = ALLOWED_HOSTS.has(u.hostname) && (u.hostname === '127.0.0.1' || !NO_THIRD_PARTY_SCRIPTS.has(page) || r.resourceType() === 'font' || r.resourceType() === 'stylesheet');
      if (!ok) problems.push('request to ' + u.hostname + ': ' + r.url());
    });
    await pg.goto('/' + page, { waitUntil: 'networkidle' });
    expect(problems).toEqual([]);
  });
}

test('PDF Studio libraries are all present', async ({ page }) => {
  await page.goto('/pdf-studio.html', { waitUntil: 'networkidle' });
  const libs = await page.evaluate(() => ({
    PDFLib: typeof (window as any).PDFLib, pdfjs: typeof (window as any).pdfjsLib, mammoth: typeof (window as any).mammoth,
    XLSX: typeof (window as any).XLSX, JSZip: typeof (window as any).JSZip, jspdf: typeof (window as any).jspdf,
    html2canvas: typeof (window as any).html2canvas, docx: typeof (window as any).docx,
  }));
  for (const [k, v] of Object.entries(libs)) expect(v, k).not.toBe('undefined');
});

for (const [pg, steps] of [['merge-studio.html', 7], ['pdf-studio.html', 5], ['mermaid-live.html', 5], ['regex-studio.html', 5]] as const) {
  test(`${pg} tour walks through every step`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/' + pg, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Take the tour' }).first().click();
    for (let n = 1; n < steps; n++) {
      await expect(page.locator('.hub-tour-card .row span')).toHaveText(`${n} / ${steps}`);
      await page.keyboard.press('ArrowRight');
    }
    await expect(page.locator('.hub-tour-card .row span')).toHaveText(`${steps} / ${steps}`);
    await page.keyboard.press('Escape');
    await expect(page.locator('.hub-tour-card')).toHaveCount(0);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.hub-tour-toast')).toHaveCount(0); // seen once, not offered again
    expect(errors).toEqual([]);
  });
}
