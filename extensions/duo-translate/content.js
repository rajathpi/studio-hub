// Duo Translate: runs in every page.
// Finds blocks of text, translates the ones that scroll into view, and shows the
// translation under each block (dual) or in its place (replace). Short UI labels
// (buttons, tabs, menu items) are swapped in place so layouts don't break.

(() => {
  if (window.__duoTranslate) return;
  window.__duoTranslate = true;

  const DEFAULTS = { mode: 'dual', engine: 'auto', target: 'en', sites: {} };
  const SKIP_SEL = 'script,style,noscript,textarea,input,select,option,code,pre,kbd,samp,svg,math,canvas,template,' +
    '[contenteditable=""],[contenteditable="true"],.notranslate,[translate="no"],duo-t';
  const PARA_TAGS = /^(P|H[1-6]|BLOCKQUOTE|DD|DT|FIGCAPTION|CAPTION|LEGEND)$/;
  const LETTERS = /\p{L}.*\p{L}/su;
  const MAX_LEN = 4000;
  const BATCH = 40;

  let settings = { ...DEFAULTS };
  let active = false;
  let io = null;
  let mo = null;
  let flushTimer = 0;
  let scanTimer = 0;
  const pendingRoots = new Set();

  const units = new Map();        // block element -> unit
  const nodeUnit = new WeakMap(); // text node we changed -> unit
  const queue = new Set();        // units waiting for translation
  const memo = new Map();         // `${target}\u0001${text}` -> [translation, lang]
  let display = new WeakMap();    // element -> computed display (reset per scan)

  // ---------- settings ----------

  chrome.storage.sync.get(DEFAULTS).then((s) => {
    settings = s;
    if (window === window.top && settings.sites[location.hostname]) start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const prev = settings;
    settings = { ...settings };
    for (const k in changes) settings[k] = changes[k].newValue;
    if (!active) return;
    if (prev.target !== settings.target || prev.engine !== settings.engine) { stop(); start(); return; }
    if (prev.mode !== settings.mode) {
      document.documentElement.dataset.duoMode = settings.mode;
      for (const u of units.values()) if (u.state === 'done') render(u);
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg.type === 'state') {
      reply({ active, host: location.hostname, lang: pageLang() });
    } else if (msg.type === 'set') {
      msg.on ? start() : stop();
      reply({ active });
    }
  });

  // ---------- start / stop ----------

  function start() {
    if (active || !document.body) return;
    active = true;
    document.documentElement.dataset.duoMode = settings.mode;
    io = new IntersectionObserver(onVisible, { rootMargin: '600px 0px' });
    mo = new MutationObserver(onMutations);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    scan(document.body);
    if (document.title && window === window.top) translateTitle();
  }

  function stop() {
    if (!active) return;
    active = false;
    io.disconnect(); mo.disconnect();
    io = mo = null;
    clearTimeout(flushTimer); clearTimeout(scanTimer);
    queue.clear(); pendingRoots.clear();
    for (const u of units.values()) restore(u);
    units.clear();
    if (titleOrig != null) { document.title = titleOrig; titleOrig = null; }
    delete document.documentElement.dataset.duoMode;
  }

  // ---------- finding text blocks ----------

  function disp(el) {
    let d = display.get(el);
    if (d === undefined) { d = getComputedStyle(el).display; display.set(el, d); }
    return d;
  }

  // nearest ancestor that is not plain inline: that's the block that owns this text
  function blockOf(node) {
    let el = node.parentElement;
    while (el && el !== document.body) {
      const d = disp(el);
      if (d !== 'inline' && d !== 'contents') return el;
      el = el.parentElement;
    }
    return el;
  }

  function usable(text) {
    const p = text.parentElement;
    return p && LETTERS.test(text.nodeValue) && !p.closest(SKIP_SEL);
  }

  function scan(root) {
    if (!active || !root.isConnected) return;
    display = new WeakMap();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (nodeUnit.has(n) || !usable(n)) continue;
      const block = blockOf(n);
      if (!block || seen.has(block)) continue;
      seen.add(block);
      if (block.closest(SKIP_SEL)) continue;
      const old = units.get(block);
      if (old) { if (old.state === 'done') reset(old); continue; }
      const u = { el: block, state: 'idle', saved: [], tr: null, box: null, kind: null };
      units.set(block, u);
      io.observe(block);
    }
  }

  // text nodes that belong to this block (not to a nested block)
  function ownTexts(block) {
    const out = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue.trim() && blockOf(n) === block && !n.parentElement.closest(SKIP_SEL)) out.push(n);
    }
    return out;
  }

  // ---------- translating ----------

  function onVisible(entries) {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const u = units.get(e.target);
      if (u && u.state === 'idle') { u.state = 'queued'; queue.add(u); }
    }
    schedule();
  }

  function schedule() {
    if (!flushTimer && queue.size) flushTimer = setTimeout(flush, 60);
  }

  async function flush() {
    flushTimer = 0;
    if (!active) return;
    const batch = [];
    display = new WeakMap();
    for (const u of queue) {
      queue.delete(u);
      if (!u.el.isConnected) { units.delete(u.el); continue; }
      const nodes = ownTexts(u.el);
      // footnote markers stay with the block (hidden in replace mode) but aren't sent
      const text = nodes.filter((n) => !n.parentElement.closest('sup')).map((n) => n.nodeValue).join('').replace(/\s+/g, ' ').trim();
      if (!LETTERS.test(text) || text.length > MAX_LEN) { u.state = 'skip'; continue; }
      u.nodes = nodes; u.text = text; u.state = 'pending';
      batch.push(u);
      if (batch.length >= BATCH) break;
    }
    if (queue.size) schedule();
    if (!batch.length) return;

    let results;
    try {
      results = await translate(batch.map((u) => u.text));
    } catch (err) {
      console.warn('[Duo Translate]', err);
      batch.forEach((u) => { u.state = 'idle'; io && io.observe(u.el); });
      return;
    }
    if (!active) return;
    batch.forEach((u, i) => apply(u, results[i]));
  }

  async function translate(texts) {
    const target = settings.target;
    const out = new Array(texts.length);
    const todo = [];
    texts.forEach((t, i) => {
      const hit = memo.get(target + '\u0001' + t);
      if (hit) out[i] = hit; else todo.push(i);
    });
    if (todo.length) {
      const fresh = await engineTranslate(todo.map((i) => texts[i]), target);
      todo.forEach((i, k) => { out[i] = fresh[k]; memo.set(target + '\u0001' + texts[i], fresh[k]); });
    }
    return out;
  }

  async function engineTranslate(texts, target) {
    if (settings.engine !== 'google') {
      try {
        return await onDevice(texts, target);
      } catch (err) {
        if (settings.engine === 'chrome') throw err;
      }
    }
    const r = await chrome.runtime.sendMessage({ type: 'google', texts, target });
    if (!r || !r.ok) throw new Error(r ? r.error : 'no reply from background');
    return r.out;
  }

  // ---------- on-device (Chrome's built-in Translator API) ----------

  const translators = new Map();
  let detectedLang = null;

  function pageLang() {
    return (document.documentElement.lang || '').split('-')[0].toLowerCase() || detectedLang || '';
  }

  async function sourceLang() {
    if (detectedLang) return detectedLang;
    if (self.LanguageDetector) {
      try {
        if ((await LanguageDetector.availability()) === 'available') {
          const det = await LanguageDetector.create();
          const sample = document.body.innerText.slice(0, 3000);
          const [best] = await det.detect(sample);
          if (best && best.confidence > 0.6) detectedLang = best.detectedLanguage.split('-')[0];
        }
      } catch (e) { /* fall through to the lang attribute */ }
    }
    detectedLang = detectedLang || pageLang();
    return detectedLang;
  }

  async function onDevice(texts, target) {
    if (!self.Translator) throw new Error('no on-device translator in this browser');
    const src = await sourceLang();
    if (!src) throw new Error('page language unknown');
    if (src === target) return texts.map((t) => [t, src]);
    let tr = translators.get(src + '>' + target);
    if (!tr) {
      const a = await Translator.availability({ sourceLanguage: src, targetLanguage: target });
      if (a !== 'available') throw new Error('on-device model ' + src + '>' + target + ' is ' + a);
      tr = await Translator.create({ sourceLanguage: src, targetLanguage: target });
      translators.set(src + '>' + target, tr);
    }
    return Promise.all(texts.map(async (t) => [await tr.translate(t), src]));
  }

  // ---------- showing results ----------

  const bare = (s) => s.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
  const same = (a, b) => bare(a) === bare(b);

  function apply(u, res) {
    if (!u.el.isConnected || u.state !== 'pending') return;
    const [tr, lang] = res || [];
    if (!tr || lang === settings.target || same(tr, u.text)) { u.state = 'skip'; return; }
    u.tr = tr;
    const words = u.text.split(' ').length;
    u.kind = u.nodes.length === 1 && words <= 4 && !PARA_TAGS.test(u.el.tagName) ? 'label' : 'para';
    u.saved = u.nodes.map((n) => [n, n.nodeValue]);
    u.state = 'done';
    render(u);
  }

  function setText(u, node, value) {
    nodeUnit.set(node, u);
    if (node.nodeValue !== value) node.nodeValue = value;
  }

  function render(u) {
    if (u.kind === 'label') {
      const [node, orig] = u.saved[0];
      const lead = orig.match(/^\s*/)[0], trail = orig.match(/\s*$/)[0];
      setText(u, node, lead + u.tr + trail);
      return;
    }
    if (!u.box) {
      u.box = document.createElement('duo-t');
      u.box.className = 'notranslate';
      u.box.setAttribute('translate', 'no');
      u.box.textContent = u.tr;
    }
    // place it after the last piece of text this block owns
    let anchor = u.saved[u.saved.length - 1][0];
    while (anchor.parentNode && anchor.parentNode !== u.el) anchor = anchor.parentNode;
    if (anchor.parentNode === u.el) anchor.after(u.box); else u.el.append(u.box);

    const replace = settings.mode === 'replace';
    for (const [node, orig] of u.saved) setText(u, node, replace ? '' : orig);
  }

  function restore(u) {
    for (const [node, orig] of u.saved) {
      if (node.isConnected) node.nodeValue = orig;
      nodeUnit.delete(node);
    }
    if (u.box) u.box.remove();
    u.saved = []; u.box = null;
  }

  // page changed text we had translated: put it back and translate again
  function reset(u, changed) {
    for (const [node, orig] of u.saved) {
      if (node !== changed && node.isConnected) node.nodeValue = orig;
      nodeUnit.delete(node);
    }
    if (u.box) u.box.remove();
    u.saved = []; u.box = null; u.tr = null; u.state = 'idle';
    io.observe(u.el);
  }

  // ---------- reacting to page changes ----------

  function expected(u, node) {
    if (u.state !== 'done') return null;
    const s = u.saved.find(([n]) => n === node);
    if (!s) return null;
    if (u.kind === 'label') return node.nodeValue.trim() === u.tr.trim() ? node.nodeValue : null;
    return settings.mode === 'replace' ? '' : s[1];
  }

  function onMutations(records) {
    for (const r of records) {
      if (r.type === 'characterData') {
        const u = nodeUnit.get(r.target);
        if (u) {
          if (expected(u, r.target) !== r.target.nodeValue) reset(u, r.target);
          continue;
        }
        if (r.target.parentElement) pendingRoots.add(r.target.parentElement);
        continue;
      }
      for (const n of r.addedNodes) {
        if (n.nodeName === 'DUO-T') continue;
        if (n.nodeType === 1) pendingRoots.add(n);
        else if (n.nodeType === 3 && n.parentElement) pendingRoots.add(n.parentElement);
      }
    }
    if (pendingRoots.size && !scanTimer) {
      scanTimer = setTimeout(() => {
        scanTimer = 0;
        const roots = [...pendingRoots];
        pendingRoots.clear();
        for (const r of roots) {
          if (!r.isConnected) continue;
          // a changed block that was already translated gets redone
          const block = r.nodeType === 1 && disp(r) !== 'inline' ? r : blockOf(r);
          const u = block && units.get(block);
          if (u && u.state === 'done') {
            const now = ownTexts(block).map((n) => n.nodeValue).join('').replace(/\s+/g, ' ').trim();
            if (u.kind === 'para' && settings.mode !== 'replace' && now !== u.text) reset(u);
          }
          scan(r);
        }
      }, 250);
    }
  }

  // ---------- tab title ----------

  let titleOrig = null;
  async function translateTitle() {
    try {
      const [[tr, lang]] = await translate([document.title]);
      if (active && tr && lang !== settings.target && !same(tr, document.title)) {
        titleOrig = document.title;
        document.title = tr;
      }
    } catch (e) { /* title is a nice-to-have */ }
  }
})();
