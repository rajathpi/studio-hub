import { test, expect } from '@playwright/test';

// Arrow mode: A enters it on the arrow nearest the selected block, the arrow keys jump
// between arrows, D/B/R/Enter/Delete act on the arrow, Esc goes back to its start block.
// The mouse is unaffected: any click leaves the mode.
async function shop(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/board-studio.html');
  await page.evaluate(() => {
    const ex = (window as any).__board.examples, n = 'Online shop checkout';
    localStorage.setItem('board-studio-v1', JSON.stringify({ current: n, boards: { [n]: ex[n] } }));
  });
  await page.reload(); await page.waitForTimeout(300);
}
const st = (page) => page.evaluate(() => (window as any).__board.state);
const id = async (page, title) => (await st(page)).nodes.find((n) => n.title === title).id;
const selected = (page) => page.evaluate(() => {
  const B = (window as any).__board.state, sel = (window as any).__board.selection();
  const e = sel.edge && B.edges.find((q) => q.id === sel.edge);
  const t = (nid) => B.nodes.find((n) => n.id === nid)?.title;
  return { edge: e ? `${t(e.a)}→${t(e.b)}` : null, nodes: [...sel.nodes].map(t), mode: !!(window as any).__board.arrowMode() };
});

test('A picks the arrow nearest the selected block, arrows keys move along', async ({ page }) => {
  await shop(page);
  await page.evaluate((i) => (window as any).__board.select([i]), await id(page, 'Shopper'));
  await page.keyboard.press('a');
  let s = await selected(page);
  expect(s.mode).toBe(true);
  expect(s.edge).toBe('Shopper→Web shop');
  expect(await page.isVisible('#mode'), 'a banner says you are in arrow mode').toBe(true);
  await page.keyboard.press('ArrowRight'); expect((await selected(page)).edge).toBe('Web shop→Orders');
  await page.keyboard.press('ArrowRight'); expect((await selected(page)).edge).toBe('Orders→Payments');
  await page.keyboard.press('ArrowLeft'); expect((await selected(page)).edge).toBe('Web shop→Orders');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
  s = await selected(page);
  expect(s.edge, 'down from Orders→Payments reaches an arrow below').not.toBe('Orders→Payments');
});

test('D, B, R and Enter act on the arrow; Esc goes back to its start block', async ({ page }) => {
  await shop(page);
  await page.evaluate((i) => (window as any).__board.select([i]), await id(page, 'Shopper'));
  await page.keyboard.press('a');
  await page.keyboard.press('d'); await page.keyboard.press('b');
  await page.keyboard.press('Enter'); await page.keyboard.type('browse'); await page.keyboard.press('Enter');
  let e = (await st(page)).edges.find((q) => q.label === 'browse');
  expect(e && e.dashed && e.two, 'dashed, two-way, labelled').toBeTruthy();
  expect((await selected(page)).mode, 'still in arrow mode after labelling').toBe(true);
  await page.keyboard.press('r');
  e = (await st(page)).edges.find((q) => q.label === 'browse');
  expect(e.a, 'reversed').toBe(await id(page, 'Web shop'));
  await page.keyboard.press('Escape');
  const s = await selected(page);
  expect(s.mode).toBe(false);
  expect(s.nodes).toEqual(['Web shop']);
  expect(await page.isVisible('#mode')).toBe(false);
});

test('Delete removes the arrow and stays in arrow mode on the next one', async ({ page }) => {
  await shop(page);
  const n0 = (await st(page)).edges.length;
  await page.evaluate((i) => (window as any).__board.select([i]), await id(page, 'Shopper'));
  await page.keyboard.press('a'); await page.keyboard.press('Delete');
  expect((await st(page)).edges.length).toBe(n0 - 1);
  const s = await selected(page);
  expect(s.mode).toBe(true);
  expect(s.edge).not.toBeNull();
});

test('a click leaves arrow mode; the mouse works as before', async ({ page }) => {
  await shop(page);
  await page.evaluate((i) => (window as any).__board.select([i]), await id(page, 'Shopper'));
  await page.keyboard.press('a');
  const r = await page.locator(`#world [data-node="${await id(page, 'Orders DB')}"] rect`).boundingBox();
  await page.mouse.click(r!.x + 20, r!.y + 20);
  const s = await selected(page);
  expect(s.mode).toBe(false);
  expect(s.nodes).toEqual(['Orders DB']);
  expect(await page.isVisible('#mode')).toBe(false);
});

test('A with nothing selected picks the arrow nearest the middle of the screen', async ({ page }) => {
  await shop(page);
  await page.keyboard.press('Escape'); await page.keyboard.press('a');
  const s = await selected(page);
  expect(s.mode).toBe(true);
  expect(s.edge).not.toBeNull();
});
