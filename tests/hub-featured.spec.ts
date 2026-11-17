import { test, expect } from '@playwright/test';

// The index's three big cards follow what you open: defaults first, then your most-used tools,
// with recent opens counting more than old ones. Every tool appears exactly once on the page.
const big = (page) => page.$$eval('#big a', (as) => as.map((a) => a.getAttribute('data-id')));
const days = (n) => Date.now() - n * 864e5;

async function open(page, uses?: Record<string, number[]>) {
  await page.addInitScript((u) => { localStorage.clear(); if (u) localStorage.setItem('hubUses', JSON.stringify(u)); }, uses || null);
  await page.goto('/index.html', { waitUntil: 'networkidle' });
}

test('no history: Snap, PDF and Transcribe', async ({ page }) => {
  await open(page);
  expect(await big(page)).toEqual(['snap', 'pdf', 'transcribe']);
});

test('your most used tools take the big cards', async ({ page }) => {
  await open(page, { board: [days(1), days(2), days(3)], regex: [days(1), days(2)], time: [days(1)] });
  expect(await big(page)).toEqual(['board', 'regex', 'time']);
});

test('old opens fade: five opens 4 months ago lose to two this week', async ({ page }) => {
  const old = [120, 121, 122, 123, 124].map(days);
  await open(page, { time: old, board: [days(1), days(2)], regex: [days(1), days(3)], diff: [days(2), days(3)] });
  expect(await big(page)).not.toContain('time');
});

test('one used tool, the rest from the defaults', async ({ page }) => {
  await open(page, { board: [days(1)] });
  expect(await big(page)).toEqual(['board', 'snap', 'pdf']);
});

test('every tool shows once, and clicking one counts it', async ({ page }) => {
  await open(page);
  const ids = await page.$$eval('#big a, #small a', (as) => as.map((a) => a.getAttribute('data-id')));
  const all = await page.evaluate(() => (window as any).TOOLS.map((t) => t.id));
  expect([...ids].sort()).toEqual([...all].sort());
  await page.evaluate(() => document.querySelector('#small a[data-id="regex"]')!.addEventListener('click', (e) => e.preventDefault()));
  await page.click('#small a[data-id="regex"]');
  const uses = await page.evaluate(() => JSON.parse(localStorage.getItem('hubUses') || '{}'));
  expect(uses.regex?.length).toBe(1);
});

test('big cards: figure or large icon, never covering the name', async ({ page }) => {
  await open(page, { board: [days(1)] }); // Board has no figure, Snap and PDF do
  await page.waitForTimeout(500);
  const report = await page.$$eval('#big a', (as) => as.map((a) => {
    const f = a.querySelector('.fig')!.getBoundingClientRect(), t = a.querySelector('.txt')!.getBoundingClientRect(), svg = a.querySelector('.fig svg');
    return { id: a.getAttribute('data-id'), drawn: !!svg && svg.getBoundingClientRect().width > 40, clear: f.bottom <= t.top + 2, inside: t.right <= a.getBoundingClientRect().right };
  }));
  for (const r of report) expect(r, r.id!).toEqual({ id: r.id, drawn: true, clear: true, inside: true });
});
