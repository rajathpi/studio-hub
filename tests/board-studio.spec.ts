import { test, expect } from '@playwright/test';
import { statSync } from 'fs';

// Board Studio: every starter example lays out cleanly (no text overlap, no label spilling out of
// its block, no arrow through a block it doesn't connect, nothing off screen), the mouse flow and
// a mouse-free keyboard flow both work, and exports download.
async function layout(p: any) {
  return p.evaluate(() => {
    const R = (e) => e.getBoundingClientRect();
    const hitBox = (a, b, m = 1) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > m && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > m;
    const texts = [...document.querySelectorAll('#world text')].map((t) => ({ t: t.textContent, b: R(t), node: t.closest('[data-node]'), edge: t.closest('[data-edge]') }));
    const nodes = [...document.querySelectorAll('#world [data-node]')].map((g) => ({ id: g.dataset.node, b: R(g.querySelector('rect')) }));
    const out = { spill: [], textOverlap: [], blockOverlap: [], labelOnBlock: [], edgeThroughBlock: [], shortEdge: [] };
    // An arrow must not cross a block it doesn't connect, and must be long enough to read.
    const segHits = (x1, y1, x2, y2, r) => { for (let k = 1; k < 40; k++) { const x = x1 + (x2 - x1) * k / 40, y = y1 + (y2 - y1) * k / 40; if (x > r.left + 2 && x < r.right - 2 && y > r.top + 2 && y < r.bottom - 2) return true; } return false; };
    document.querySelectorAll('#world [data-edge]').forEach((g) => {
      const ln = g.querySelectorAll('line'), l = ln[ln.length - 1], m = l.getScreenCTM();
      const P = (x, y) => { const q = new DOMPoint(+x, +y).matrixTransform(m); return [q.x, q.y]; };
      const [x1, y1] = P(l.getAttribute('x1'), l.getAttribute('y1')), [x2, y2] = P(l.getAttribute('x2'), l.getAttribute('y2'));
      if (Math.hypot(l.getAttribute('x2') - l.getAttribute('x1'), l.getAttribute('y2') - l.getAttribute('y1')) < 40) out.shortEdge.push(g.dataset.edge); // board units, not zoomed pixels
      document.querySelectorAll('#world [data-node] rect').forEach((r) => { if (segHits(x1, y1, x2, y2, R(r))) out.edgeThroughBlock.push(g.dataset.edge + ' through ' + r.parentNode.dataset.node); });
    });
    texts.forEach((x) => { if (x.node) { const r = R(x.node.querySelector('rect')); if (x.b.left < r.left - 1 || x.b.right > r.right + 1 || x.b.top < r.top - 1 || x.b.bottom > r.bottom + 1) out.spill.push(x.t); } });
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.node && a.node === b.node) continue;
      if (hitBox(a.b, b.b)) out.textOverlap.push(a.t + ' × ' + b.t);
    }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (hitBox(nodes[i].b, nodes[j].b)) out.blockOverlap.push(nodes[i].id + ' × ' + nodes[j].id);
    texts.filter((x) => x.edge).forEach((x) => nodes.forEach((n) => { if (hitBox(x.b, n.b)) out.labelOnBlock.push(x.t); }));
    return out;
  });
}


for (const [w, h] of [[1440, 900], [1024, 640]]) {
  test(`board studio · ${w}px`, async ({ browser }) => {
    test.setTimeout(180_000);
    const check = (ok: boolean, what: string) => expect.soft(ok, what).toBe(true);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true, baseURL: test.info().project.use.baseURL });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('/board-studio.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
    const first = await p.evaluate(() => [window.__board.state.nodes.length, Object.keys(window.__board.examples).includes(document.getElementById('boardSel').value)]);
    check(first[0] > 0 && first[1], `${w}px · first open shows one of the examples`);

    const names = await p.evaluate(() => Object.keys(window.__board.examples));
    for (const name of names) {
      await p.evaluate((n) => localStorage.setItem('board-studio-v1', JSON.stringify({ current: n, boards: { [n]: window.__board.examples[n] } })), name);
      await p.reload(); await p.waitForTimeout(400);
      const L = await layout(p);
      check(Object.values(L).every((v) => !v.length), `${w}px · ${name}: clean ${JSON.stringify(L)}`);
      const inView = await p.evaluate(() => [...document.querySelectorAll('#world [data-node] rect, #world [data-group] rect')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.top >= 60 && r.right <= innerWidth && r.bottom <= innerHeight; }));
      check(inView, `${w}px · ${name}: fits the screen`);
      await p.screenshot({ path: `test-results/board-studio/shot-${name.replace(/ /g, '-')}-${w}.png` });
    }

    if (w === 1440) {
      // Keyboard flow on a fresh board.
      p.once('dialog', (d) => d.accept('Test board'));
      await p.click('#newBtn'); await p.waitForTimeout(150);
      await p.mouse.dblclick(300, 400);
      await p.keyboard.type('Users'); await p.keyboard.press('Enter');
      await p.keyboard.press('Tab'); await p.keyboard.type('API Gateway'); await p.keyboard.press('Enter');
      await p.keyboard.press('Tab'); await p.keyboard.type('Orders service'); await p.keyboard.down('Shift'); await p.keyboard.press('Enter'); await p.keyboard.up('Shift'); await p.keyboard.type('Python, Lambda'); await p.keyboard.press('Enter');
      await p.keyboard.press('Shift+Tab'); await p.keyboard.type('Orders table'); await p.keyboard.press('Enter');
      await p.keyboard.press('2');
      let s = await p.evaluate(() => window.__board.state);
      check(s.nodes.length === 4 && s.edges.length === 3, `typing flow made 4 blocks + 3 arrows (${s.nodes.length}/${s.edges.length})`);
      check(s.nodes.find((n) => n.title === 'Orders service')?.sub === 'Python, Lambda', 'Shift+Enter gives a subtitle');
      check(s.nodes.find((n) => n.title === 'Orders table')?.type === 'database', 'key 2 makes a database');
      // double-click an existing block edits it rather than adding a new one
      const box = await p.locator('#world [data-node] rect').first().boundingBox();
      await p.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2); await p.keyboard.press('Escape');
      s = await p.evaluate(() => window.__board.state);
      check(s.nodes.length === 4, 'double-click on a block edits it, adds nothing');
      // Shift+click connects the selected block to another
      const rects = p.locator('#world [data-node] rect');
      const a = await rects.nth(0).boundingBox(), c = await rects.nth(3).boundingBox();
      await p.mouse.click(a.x + 20, a.y + 20); await p.keyboard.down('Shift'); await p.mouse.click(c.x + 20, c.y + 20); await p.keyboard.up('Shift');
      s = await p.evaluate(() => window.__board.state);
      check(s.edges.length === 4, 'Shift+click connects');
      // group, then undo it
      await p.mouse.click(a.x + 20, a.y + 20); await p.keyboard.down('Control'); await p.mouse.click(c.x + 20, c.y + 20); await p.keyboard.up('Control');
      await p.keyboard.press('g'); await p.keyboard.type('Customer side'); await p.keyboard.press('Enter');
      s = await p.evaluate(() => window.__board.state);
      check(s.groups.length === 1 && s.groups[0].label === 'Customer side' && s.groups[0].members.length === 2, 'G frames the selection');
      await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z');
      s = await p.evaluate(() => window.__board.state);
      check(s.groups.length === 0, 'Ctrl+Z undoes the frame');
      const L = await layout(p);
      check(!L.spill.length && !L.textOverlap.length && !L.blockOverlap.length, 'typed board is clean ' + JSON.stringify(L));
      // survives a reload
      await p.reload(); await p.waitForTimeout(400);
      s = await p.evaluate(() => window.__board.state);
      check(s.nodes.length === 4 && (await p.inputValue('#boardSel')) === 'Test board', 'autosaved across reload');
      const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pngBtn')]);
      const size = statSync(await dl.path()).size;
      check(dl.suggestedFilename() === 'Test-board.png' && size > 5000, `PNG export (${size} bytes)`);
      await p.screenshot({ path: `test-results/board-studio/shot-typed.png` });
    }
    if (w === 1440) {
      // ---------- keyboard only: no mouse from here on ----------
      const st = () => p.evaluate(() => window.__board.state);
      const selTitle = () => p.evaluate(() => { const g = document.querySelector('#world [data-node] rect[stroke="#2f6fde"]'); return g ? window.__board.state.nodes.find((n) => n.id === g.parentNode.dataset.node).title : null; });
      const key = (k) => p.keyboard.press(k);
      async function goTo(title) { // steer with arrow keys only
        for (let i = 0; i < 12; i++) {
          const s = await st(), cur = await selTitle(), t = s.nodes.find((n) => n.title === title);
          if (cur === title) return true;
          const c = cur ? s.nodes.find((n) => n.title === cur) : null;
          if (!c) { await key('ArrowRight'); continue; }
          const dx = t.x - c.x, dy = t.y - c.y;
          await key(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'));
        }
        return (await selTitle()) === title;
      }
      p.once('dialog', (d) => d.accept('Keyboard board'));
      await key('Alt+n'); await p.waitForTimeout(150);
      check((await p.inputValue('#boardSel')) === 'Keyboard board', 'Alt+N makes a new board');
      await key('n'); await p.keyboard.type('Users'); await key('Enter');
      await key('Tab'); await p.keyboard.type('API Gateway'); await key('Enter');
      await key('Tab'); await p.keyboard.type('Orders service'); await key('Shift+Enter'); await p.keyboard.type('Lambda'); await key('Enter');
      await key('Shift+Tab'); await p.keyboard.type('Orders DB'); await key('Enter');
      await key('/'); await p.keyboard.type('Orders service -> Kafka topic -->|events| Email worker'); await key('Enter');
      let s = await st();
      const type = (t) => s.nodes.find((n) => n.title === t)?.type;
      check(s.nodes.length === 6 && s.edges.length === 5, `N, Tab, Shift+Tab and / built 6 blocks + 5 arrows (${s.nodes.length}/${s.edges.length})`);
      check(type('Users') === 'person' && type('API Gateway') === 'gateway' && type('Orders service') === 'service' && type('Orders DB') === 'database' && type('Kafka topic') === 'queue' && type('Email worker') === 'service',
        'the name picks the type: ' + s.nodes.map((n) => n.title + '=' + n.type).join(', '));
      const ev = s.edges.find((e) => e.label === 'events');
      check(ev && ev.dashed, '/ chain: -->|events| makes a dashed, labelled arrow');
      check(s.nodes.filter((n) => n.title === 'Orders service').length === 1, '/ chain reuses an existing block by name');
      check(await goTo('Users'), 'arrow keys reach Users');
      check(await goTo('Orders DB'), 'arrow keys reach Orders DB');
      // connect with C
      await key('c'); check(await goTo('Kafka topic'), 'arrow keys pick the other end'); await key('Enter');
      s = await st();
      const ids = Object.fromEntries(s.nodes.map((n) => [n.title, n.id]));
      check(s.edges.some((e) => e.a === ids['Orders DB'] && e.b === ids['Kafka topic']), 'C … Enter connects');
      // arrows of a block: E, D, Esc
      await goTo('Orders service'); await key('e');
      let selEdge = await p.evaluate(() => !!document.querySelector('#world [data-edge] line[stroke="#2f6fde"]'));
      check(selEdge, 'E selects one of the block\'s arrows');
      const before = (await st()).edges.filter((e) => e.dashed).length; await key('d');
      check((await st()).edges.filter((e) => e.dashed).length === before + 1, 'D makes it dashed');
      await key('Escape'); check((await selTitle()) === 'Orders service', 'Esc goes back to the block');
      // multi-select + frame
      await goTo('Kafka topic'); await key('Shift+ArrowRight');
      await key('g'); await p.keyboard.type('Async'); await key('Enter');
      s = await st();
      check(s.groups.length === 1 && s.groups[0].label === 'Async' && s.groups[0].members.length === 2, 'Shift+arrow then G frames two blocks');
      await goTo('Kafka topic'); await key('Shift+g'); await key('Enter'); await p.keyboard.type('Async jobs'); await key('Enter');
      check((await st()).groups[0].label === 'Async jobs', 'Shift+G selects the frame, Enter renames it');
      await key('Shift+g'); await key('Delete');
      s = await st();
      check(s.groups.length === 0 && s.nodes.length === 6, 'Delete on a frame removes only the frame');
      // move, duplicate, undo, zoom, boards, export, help
      await goTo('Users'); const x0 = (await st()).nodes.find((n) => n.title === 'Users').x;
      await key('Alt+ArrowLeft'); check((await st()).nodes.find((n) => n.title === 'Users').x === x0 - 10, 'Alt+arrow moves a block');
      await key('Control+d'); check((await st()).nodes.length === 7, 'Ctrl+D duplicates');
      await key('Control+z'); check((await st()).nodes.length === 6, 'Ctrl+Z undoes it');
      const k0 = await p.evaluate(() => window.__board.view().k); await key('+');
      check(await p.evaluate((k) => window.__board.view().k > k, k0), '+ zooms in');
      await key('0');
      const b0 = await p.inputValue('#boardSel'); await key(']'); const b1 = await p.inputValue('#boardSel'); await key('[');
      check(b1 !== b0 && (await p.inputValue('#boardSel')) === b0, '[ and ] switch boards');
      const [dl] = await Promise.all([p.waitForEvent('download'), key('Control+e')]);
      check(/\.png$/.test(dl.suggestedFilename()), 'Ctrl+E exports PNG');
      await key('?'); check(await p.isVisible('#help'), '? opens the key list'); await key('Escape');
      check(!(await p.isVisible('#help')), 'Esc closes it');
      await key('f'); check(await p.evaluate(() => document.body.classList.contains('present')), 'F: presenter mode'); await key('Escape');
      await key('Control+a'); check((await p.evaluate(() => document.querySelectorAll('#world [data-node] rect[stroke="#2f6fde"]').length)) === 6, 'Ctrl+A selects all');
      await key('Escape'); await key('0');
      const L = await layout(p);
      check(!L.spill.length && !L.textOverlap.length && !L.blockOverlap.length, 'keyboard-built board is clean ' + JSON.stringify(L));
      await p.screenshot({ path: `test-results/board-studio/shot-keyboard.png` });
    }
    expect(errs, 'no script errors').toEqual([]);
    await ctx.close();
  });
}
