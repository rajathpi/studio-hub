import { test, expect } from '@playwright/test';

// The index shows every tool on a shelf for its group, with a "Your usual" row on top that follows what
// you open: your most-used tools first, recent opens counting more, then the defaults. Search narrows the shelves.
const usual = (page) => page.$$eval('#usual a', (as) => as.map((a) => a.getAttribute('data-id')));
const days = (n) => Date.now() - n * 864e5;

async function open(page, uses?: Record<string, number[]>) {
  await page.addInitScript((u) => { localStorage.clear(); if (u) localStorage.setItem('hubUses', JSON.stringify(u)); }, uses || null);
  await page.goto('/index.html', { waitUntil: 'networkidle' });
}

test('no history: Snap, PDF and Transcribe', async ({ page }) => {
  await open(page);
  expect(await usual(page)).toEqual(['snap', 'pdf', 'transcribe']);
});

test('your most used tools lead the row', async ({ page }) => {
  await open(page, { board: [days(1), days(2), days(3)], regex: [days(1), days(2)], time: [days(1)], diff: [days(9)], qr: [days(30)] });
  expect(await usual(page)).toEqual(['board', 'regex', 'time', 'diff']);
});

test('old opens fade: five opens 4 months ago lose to two this week', async ({ page }) => {
  const old = [120, 121, 122, 123, 124].map(days);
  await open(page, { time: old, board: [days(1), days(2)], regex: [days(1), days(3)], diff: [days(2), days(3)], qr: [days(2), days(4)] });
  expect(await usual(page)).not.toContain('time');
});

test('every tool sits once on its group shelf, and clicking one counts it', async ({ page }) => {
  await open(page);
  const placed = await page.$$eval('.shelf', (ss) => ss.flatMap((s) => [...s.querySelectorAll('.card')].map((c) => `${s.querySelector('h2')!.textContent}|${c.getAttribute('data-id')}`)));
  const want = await page.evaluate(() => (window as any).TOOLS.map((t) => `${t.group}|${t.id}`));
  expect([...placed].sort()).toEqual([...want].sort());
  await page.evaluate(() => document.querySelector('.card[data-id="regex"]')!.addEventListener('click', (e) => e.preventDefault()));
  await page.click('.card[data-id="regex"]');
  const uses = await page.evaluate(() => JSON.parse(localStorage.getItem('hubUses') || '{}'));
  expect(uses.regex?.length).toBe(1);
});

test('search narrows the shelves and says when nothing matches', async ({ page }) => {
  await open(page);
  const visible = () => page.$$eval('.card', (cs) => cs.filter((c) => (c as HTMLElement).offsetParent).map((c) => c.getAttribute('data-id')));
  await page.keyboard.press('/');
  await page.keyboard.type('pdf');
  expect(await visible()).toContain('pdf');
  expect(await visible()).not.toContain('snap');
  await expect(page.locator('#usual')).toBeHidden();
  await page.fill('#q', 'zzzz');
  expect(await visible()).toEqual([]);
  await expect(page.locator('#none')).toBeVisible();
  await page.fill('#q', '');
  expect((await visible()).length).toBe(await page.evaluate(() => (window as any).TOOLS.length));
});
