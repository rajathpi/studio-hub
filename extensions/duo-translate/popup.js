const DEFAULTS = { mode: 'dual', engine: 'auto', target: 'en', sites: {} };
const $ = (id) => document.getElementById(id);

let settings = { ...DEFAULTS };
let tab = null;
let page = null; // { active, host, lang } from the top frame

try { if (localStorage.getItem('hubTheme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch (e) {}
$('theme').onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('hubTheme', dark ? 'dark' : 'light'); } catch (e) {}
};

init();

async function init() {
  settings = await chrome.storage.sync.get(DEFAULTS);
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { page = await chrome.tabs.sendMessage(tab.id, { type: 'state' }, { frameId: 0 }); } catch (e) { page = null; }

  chrome.commands.getAll((cmds) => {
    const c = cmds.find((x) => x.name === 'toggle');
    if (c && c.shortcut) $('keys').textContent = c.shortcut; else document.querySelector('footer').textContent = 'No shortcut set. Add one on the extensions shortcuts page.';
  });

  $('target').value = settings.target;
  $('engine').value = settings.engine;
  paint();
  checkDevice();
}

function paint() {
  const go = $('go');
  if (!page) {
    go.disabled = true;
    go.textContent = 'Can’t translate this page';
    $('host').textContent = 'Browser pages and the extension store are off limits. Reload the tab if it was open before the extension was installed.';
    $('always').disabled = true;
  } else {
    go.textContent = page.active ? 'Show original' : 'Translate this page';
    $('host').textContent = '';
    $('always-label').textContent = 'Always translate ' + page.host;
    $('always').checked = !!settings.sites[page.host];
  }
  for (const b of $('mode').children) b.setAttribute('aria-pressed', String(b.dataset.v === settings.mode));
}

$('go').onclick = async () => {
  await chrome.tabs.sendMessage(tab.id, { type: 'set', on: !page.active }).catch(() => {});
  page.active = !page.active;
  paint();
};

$('mode').onclick = (e) => {
  const v = e.target.dataset && e.target.dataset.v;
  if (!v) return;
  settings.mode = v;
  chrome.storage.sync.set({ mode: v });
  paint();
};

$('target').onchange = () => { settings.target = $('target').value; chrome.storage.sync.set({ target: settings.target }); checkDevice(); };
$('engine').onchange = () => { settings.engine = $('engine').value; chrome.storage.sync.set({ engine: settings.engine }); checkDevice(); };

$('always').onchange = async () => {
  const sites = { ...settings.sites };
  if ($('always').checked) sites[page.host] = true; else delete sites[page.host];
  settings.sites = sites;
  await chrome.storage.sync.set({ sites });
  if ($('always').checked && !page.active) $('go').click();
};

// ---------- on-device model status ----------

async function checkDevice() {
  const status = $('device-status');
  const dl = $('download');
  dl.hidden = true;
  if (settings.engine === 'google') { $('device').hidden = true; return; }
  $('device').hidden = false;
  if (!self.Translator) {
    status.textContent = 'No on-device translator in this browser. Using Google.';
    return;
  }
  const src = page && page.lang;
  if (!src) { status.textContent = 'On-device model: page language unknown, using Google.'; return; }
  if (src === settings.target) { status.textContent = 'This page is already in that language.'; return; }
  let a;
  try { a = await Translator.availability({ sourceLanguage: src, targetLanguage: settings.target }); }
  catch (e) { a = 'unavailable'; }
  const pair = src + ' → ' + settings.target;
  if (a === 'available') status.textContent = 'On-device ' + pair + ': ready, works offline.';
  else if (a === 'unavailable') status.textContent = 'On-device ' + pair + ': not supported. Using Google.';
  else {
    status.textContent = 'On-device ' + pair + ': not downloaded. Using Google for now.';
    dl.hidden = false;
    dl.onclick = () => download(src);
  }
}

async function download(src) {
  const status = $('device-status');
  const dl = $('download');
  dl.disabled = true;
  try {
    await Translator.create({
      sourceLanguage: src,
      targetLanguage: settings.target,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          status.textContent = 'Downloading… ' + Math.round(e.loaded * 100) + '%';
        });
      },
    });
    checkDevice();
  } catch (e) {
    status.textContent = 'Download failed: ' + e.message;
  }
  dl.disabled = false;
}
