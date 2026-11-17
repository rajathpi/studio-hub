import { test, expect } from '@playwright/test';

// Board Studio on Swedish keyboards, plus how the view follows the selection.
// Each key is sent as the exact event that layout produces: the character (key),
// the physical key (code) and the modifiers. On Swedish Windows, AltGr arrives as
// Ctrl+Alt; on a Swedish Mac the same symbols come from Option.
type K = { key: string; code: string; shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean };
const LAYOUTS: Record<string, Record<string, K>> = {
  'Swedish Windows': {
    '[': { key: '[', code: 'Digit8', ctrlKey: true, altKey: true },
    ']': { key: ']', code: 'Digit9', ctrlKey: true, altKey: true },
    '/': { key: '/', code: 'Digit7', shiftKey: true },
    '?': { key: '?', code: 'Minus', shiftKey: true },
    '+': { key: '+', code: 'Minus' },
    '-': { key: '-', code: 'Slash' },
    newBoard: { key: 'n', code: 'KeyN', altKey: true },
    rename: { key: 'r', code: 'KeyR', altKey: true },
  },
  'Swedish Mac': {
    '[': { key: '[', code: 'Digit8', altKey: true },
    ']': { key: ']', code: 'Digit9', altKey: true },
    '/': { key: '/', code: 'Digit7', shiftKey: true },
    '?': { key: '?', code: 'Minus', shiftKey: true },
    '+': { key: '+', code: 'Minus' },
    '-': { key: '-', code: 'Slash' },
    newBoard: { key: 'Dead', code: 'KeyN', altKey: true },  // Option+N is a dead key (tilde) on a Mac
    rename: { key: '®', code: 'KeyR', altKey: true },        // Option+R types ®
  },
};

async function fresh(page, boards = 2) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript((n) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const ex = (window as any).__seedBoards;
    localStorage.removeItem('board-studio-v1');
    localStorage.setItem('__boards', String(n));
  }, boards);
  await page.goto('/board-studio.html');
  await page.evaluate((n) => {
    const ex = (window as any).__board.examples, names = Object.keys(ex).slice(0, n), boards = {};
    names.forEach((k) => (boards[k] = ex[k]));
    localStorage.setItem('board-studio-v1', JSON.stringify({ current: names[0], boards }));
  }, boards);
  await page.reload();
  await page.waitForTimeout(300);
}
const send = (page, k: K) => page.evaluate((k) => document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, k))), k);
const board = (page) => page.inputValue('#boardSel');

for (const [layout, keys] of Object.entries(LAYOUTS)) {
  test(`${layout}: every symbol shortcut works`, async ({ page }) => {
    await fresh(page);
    const b0 = await board(page);
    await send(page, keys[']']); const b1 = await board(page);
    expect(b1, '] next board').not.toBe(b0);
    await send(page, keys['[']); expect(await board(page), '[ previous board').toBe(b0);

    const k0 = await page.evaluate(() => (window as any).__board.view().k);
    await send(page, keys['+']); const k1 = await page.evaluate(() => (window as any).__board.view().k);
    expect(k1, '+ zooms in').toBeGreaterThan(k0);
    await send(page, keys['-']); expect(await page.evaluate(() => (window as any).__board.view().k), '- zooms out').toBeLessThan(k1);

    await send(page, keys['?']); expect(await page.isVisible('#help'), '? opens the key list').toBe(true);
    await page.keyboard.press('Escape');
    await send(page, keys['/']); expect(await page.isVisible('#edit'), '/ opens the chain box').toBe(true);
    await page.keyboard.press('Escape');

    let asked = '';
    page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
    await send(page, keys.newBoard); await page.waitForTimeout(100);
    expect(asked, 'Alt/Option+N asks for a new board name').toMatch(/new board/i);
    page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
    await send(page, keys.rename); await page.waitForTimeout(100);
    expect(asked, 'Alt/Option+R asks to rename').toMatch(/rename/i);
  });
}

test('keys that sit in the same place on every layout', async ({ page }) => {
  await fresh(page);
  const b0 = await board(page);
  await page.keyboard.press('PageDown'); expect(await board(page), 'PageDown next board').not.toBe(b0);
  await page.keyboard.press('PageUp'); expect(await board(page), 'PageUp previous board').toBe(b0);
  await page.keyboard.press('k'); expect(await page.isVisible('#edit'), 'K opens the chain box').toBe(true);
  await page.keyboard.press('Escape');
  await page.keyboard.press('F1'); expect(await page.isVisible('#help'), 'F1 opens the key list').toBe(true);
});

test('chain labels with a colon: no AltGr needed', async ({ page }) => {
  await fresh(page, 1);
  await page.keyboard.press('k');
  await page.keyboard.type('Orders -> Payments : charge');
  await page.keyboard.press('Enter');
  const s = await page.evaluate(() => (window as any).__board.state);
  const id = (t) => s.nodes.find((n) => n.title === t)?.id;
  const e = s.edges.find((e) => e.a === id('Orders') && e.b === id('Payments'));
  expect(e?.label).toBe('charge');
  expect(s.nodes.some((n) => /:/.test(n.title)), 'no block named with the colon').toBe(false);
});

test('Esc while naming a new block removes it', async ({ page }) => {
  await fresh(page, 1);
  const n0 = (await page.evaluate(() => (window as any).__board.state)).nodes.length;
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab'); await page.keyboard.press('Escape');
  await page.keyboard.press('n'); await page.keyboard.press('Escape');
  const s = await page.evaluate(() => (window as any).__board.state);
  expect(s.nodes.length).toBe(n0);
  expect(s.nodes.every((n) => n.title), 'no nameless blocks').toBe(true);
});

test('moving to a block near the edge scrolls only as far as needed', async ({ page }) => {
  await fresh(page, 1);
  // a tall column of blocks, taller than the screen
  await page.evaluate(() => {
    const B = (window as any).__board.state;
    B.nodes.length = 0; B.edges.length = 0; B.groups.length = 0;
    for (let i = 0; i < 8; i++) B.nodes.push({ id: 'c' + i, type: 'service', title: 'Step ' + (i + 1), x: 400, y: i * 150 });
    (window as any).__board.view().k = 1;
  });
  await page.evaluate(() => { const v = (window as any).__board.view(); v.x = 300; v.y = 140; (window as any).__board.fit && 0; });
  await page.keyboard.press('Escape');
  const rectOf = (t) => page.evaluate((t) => {
    const B = (window as any).__board.state, n = B.nodes.find((q) => q.title === t);
    const g = document.querySelector(`#world [data-node="${n.id}"] rect`)!.getBoundingClientRect();
    return { top: g.top, bottom: g.bottom };
  }, t);
  // walk down one block at a time and check every step
  await page.keyboard.press('ArrowDown');
  for (let i = 1; i < 8; i++) {
    const before = await page.evaluate(() => (window as any).__board.view().y);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(450); // the glide takes about 0.2 s
    const r = await rectOf('Step ' + (i + 1));
    const after = await page.evaluate(() => (window as any).__board.view().y);
    expect(r.top, `step ${i + 1} below the toolbar`).toBeGreaterThanOrEqual(70);
    expect(r.bottom, `step ${i + 1} above the hint bar`).toBeLessThanOrEqual(800 - 50);
    expect(Math.abs(after - before), `step ${i + 1}: scrolled at most one block`).toBeLessThanOrEqual(200);
  }
});

for (const mod of ['Control', 'Meta']) {
  test(`copy and paste blocks with ${mod === 'Meta' ? 'Cmd' : 'Ctrl'}+C / V, also into another board`, async ({ page }) => {
    await fresh(page, 2);
    const s0 = await page.evaluate(() => (window as any).__board.state);
    // select two connected blocks: the first arrow's ends
    const e0 = s0.edges[0];
    await page.evaluate(([a, b]) => { (window as any).__board.select([a, b]); }, [e0.a, e0.b]);
    await page.keyboard.press(`${mod}+c`);
    await page.keyboard.press(`${mod}+v`);
    let s = await page.evaluate(() => (window as any).__board.state);
    expect(s.nodes.length, 'two blocks pasted').toBe(s0.nodes.length + 2);
    expect(s.edges.length, 'their arrow came along').toBe(s0.edges.length + 1);
    const pasted = s.nodes.slice(-2), orig = s0.nodes.filter((n) => n.id === e0.a || n.id === e0.b);
    expect(pasted.map((n) => n.title).sort()).toEqual(orig.map((n) => n.title).sort());
    expect(pasted[0].x, 'pasted beside, not on top').not.toBe(orig.find((o) => o.title === pasted[0].title).x);
    await page.keyboard.press('PageDown');
    const n1 = (await page.evaluate(() => (window as any).__board.state)).nodes.length;
    await page.keyboard.press(`${mod}+v`);
    s = await page.evaluate(() => (window as any).__board.state);
    expect(s.nodes.length, 'paste into the other board').toBe(n1 + 2);
    await page.keyboard.press(`${mod}+z`);
    expect((await page.evaluate(() => (window as any).__board.state)).nodes.length, 'undo the paste').toBe(n1);
  });
}
