// Duo Translate: background worker.
// Owns the Google requests (content scripts can't make cross-origin calls in MV3),
// the shortcut and the right-click menu.

const DEFAULTS = { mode: 'dual', engine: 'auto', target: 'en', sites: {} };
const ENDPOINT = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex';
const MAX_ITEMS = 50;
const MAX_CHARS = 4500;

const cache = new Map(); // `${target}\u0001${text}` -> [translation, lang]

chrome.runtime.onInstalled.addListener(async () => {
  const s = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set(s);
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'duo-toggle', title: 'Translate page (Alt+A)', contexts: ['page', 'selection', 'link'] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'duo-toggle' && tab) toggleTab(tab.id);
});

chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd !== 'toggle') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) toggleTab(tab.id);
});

// The top frame decides; every frame then gets the same on/off.
async function toggleTab(tabId) {
  let state = null;
  try { state = await chrome.tabs.sendMessage(tabId, { type: 'state' }, { frameId: 0 }); } catch (e) { return; }
  chrome.tabs.sendMessage(tabId, { type: 'set', on: !(state && state.active) }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'google') {
    translateGoogle(msg.texts, msg.target).then(
      (out) => reply({ ok: true, out }),
      (err) => reply({ ok: false, error: String(err && err.message || err) })
    );
    return true;
  }
  if (msg.type === 'toggle-tab') {
    toggleTab(msg.tabId);
  }
});

async function translateGoogle(texts, target) {
  const out = new Array(texts.length);
  const todo = [];
  texts.forEach((t, i) => {
    const hit = cache.get(target + '\u0001' + t);
    if (hit) out[i] = hit; else todo.push(i);
  });

  // pack into requests of at most MAX_ITEMS items / MAX_CHARS characters
  let batch = [], chars = 0;
  const batches = [];
  for (const i of todo) {
    const len = texts[i].length;
    if (batch.length && (batch.length >= MAX_ITEMS || chars + len > MAX_CHARS)) {
      batches.push(batch); batch = []; chars = 0;
    }
    batch.push(i); chars += len;
  }
  if (batch.length) batches.push(batch);

  await Promise.all(batches.map(async (idx) => {
    const res = await request(idx.map((i) => texts[i]), target);
    idx.forEach((i, k) => {
      out[i] = res[k];
      cache.set(target + '\u0001' + texts[i], res[k]);
    });
  }));

  if (cache.size > 20000) {
    const drop = cache.size - 15000;
    let n = 0;
    for (const key of cache.keys()) { if (n++ >= drop) break; cache.delete(key); }
  }
  return out;
}

async function request(list, target, attempt = 0) {
  const body = new URLSearchParams();
  for (const t of list) body.append('q', t);
  const url = ENDPOINT + '&sl=auto&tl=' + encodeURIComponent(target);
  const r = await fetch(url, { method: 'POST', body });
  if (r.status === 429 && attempt < 3) {
    await new Promise((ok) => setTimeout(ok, 800 * (attempt + 1)));
    return request(list, target, attempt + 1);
  }
  if (!r.ok) throw new Error('Google returned ' + r.status);
  const data = await r.json();
  // one item comes back as ["text","sv"] (or a bare string); several as [["text","sv"], ...]
  if (list.length === 1) {
    if (typeof data === 'string') return [[data, '']];
    if (typeof data[0] === 'string') return [[data[0], data[1] || '']];
  }
  return data.map((d) => (typeof d === 'string' ? [d, ''] : [d[0], d[1] || '']));
}
