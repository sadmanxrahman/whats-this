/* What's this? — snap or upload a photo, get an identification, keep an archive. */
(() => {
'use strict';

/* ---------- constants ---------- */
const TYPES = [
  ['animal', 'Animal', 'M8 10.5a1.5 2 0 1 0 0-4 1.5 2 0 1 0 0 4zM16 10.5a1.5 2 0 1 0 0-4 1.5 2 0 1 0 0 4zM4.5 14a1.5 2 0 1 0 0-4 1.5 2 0 1 0 0 4zM19.5 14a1.5 2 0 1 0 0-4 1.5 2 0 1 0 0 4zM12 13c-3 0-5 3.5-5 5.5 0 1.5 1.5 2 2.5 1.7 1-.3 1.7-.7 2.5-.7s1.5.4 2.5.7c1 .3 2.5-.2 2.5-1.7 0-2-2-5.5-5-5.5z'],
  ['bird', 'Bird', 'M4 14c3 0 5-2 6-5 1-3 3-4 5-4s3.5 1.5 3.5 3L21 9l-2.5 1c0 5-4 9-9.5 9H4l3-2.5C5 16 4 15 4 14z'],
  ['insect', 'Insect', 'M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 7c-3 0-4 3-4 6s1.5 7 4 7 4-4 4-7-1-6-4-6zM8 11H4M16 11h4M8 15l-3.5 2M16 15l3.5 2'],
  ['plant', 'Plant', 'M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l8-8'],
  ['mushroom', 'Mushroom', 'M3 12a9 7 0 0 1 18 0H3zM9.5 12v6.5a2.5 2.5 0 0 0 5 0V12'],
  ['food', 'Food', 'M12 7c-1.5-1-5-1.5-6.5 1.5S5 16 7 18.5 10.5 21 12 20c1.5 1 3 .5 5-1.5s2-7.5.5-10S13.5 6 12 7zM12 7c0-2 1-3.5 3-4'],
  ['toy', 'Toy', 'M12 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM8 6a2 2 0 1 1-2.5-1.5M16 6a2 2 0 1 0 2.5-1.5M7.5 12.5C5.5 14 5 16 5 17.5 5 19.5 8 21 12 21s7-1.5 7-3.5c0-1.5-.5-3.5-2.5-5'],
  ['tool', 'Tool', 'M14.5 3.5a5 5 0 0 0-4.6 6.9L3.5 16.8a1.8 1.8 0 0 0 2.6 2.6l6.4-6.4a5 5 0 0 0 6.9-4.6l-3 3-2.8-.7-.7-2.8z'],
  ['vehicle', 'Vehicle', 'M3 16v-3l2-5h14l2 5v3H3zM4 16v2.5h3V16M17 16v2.5h3V16M3 13h18'],
  ['electronics', 'Electronics', 'M3 5h18v11H3zM8 20h8M12 16v4'],
  ['clothing', 'Clothing', 'M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c0 1.7-1.3 3-3 3S9 4.7 8 3z'],
  ['art', 'Art', 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M15.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'],
  ['rock', 'Rock', 'M6 3h12l4 6-10 12L2 9zM2 9h20M9 3 7 9l5 12 5-12-2-6'],
  ['landmark', 'Landmark', 'M3 21h18M12 3 3 9h18zM5 10v8M9.7 10v8M14.3 10v8M19 10v8M4 18h16'],
  ['household', 'Household', 'M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5'],
];
const TYPE_NAME = Object.fromEntries(TYPES.map(([id, name]) => [id, name]));
const ICON = {
  menu: 'M4 7h16M4 12h16M4 17h10',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  check: 'M4 12.5l5 5L20 6.5',
  retry: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  camera: 'M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.5-2h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5zM12 16.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6z',
  alert: 'M12 3 2 20h20L12 3zM12 10v4M12 17h.01',
};
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'de', 'du', 'la', 'le', 'von', 'van']);
const MAX_SIDE = 1024;   // photo size sent to the AI (smaller = cheaper)
const THUMB_SIDE = 480;  // photo size kept in the archive

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : String(kid));
  }
  return el;
}
function icon(d) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  s.append(p);
  return s;
}
const str = (v) => (typeof v === 'string' ? v.trim() : '');
function titleCase(s) {
  return str(s).split(/\s+/).map((w, i) => {
    if (!w) return w;
    if (i > 0 && SMALL_WORDS.has(w.toLowerCase())) return w.toLowerCase();
    if (/[A-Z].*[A-Z]/.test(w.slice(1)) || /\d/.test(w)) return w; // keep things like "iPhone", "F-150"
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}
function fmtDate(t) {
  const d = new Date(t), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}

/* ---------- storage ---------- */
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const DB = (() => {
  let dbp = null;
  const memory = new Map();
  function open() {
    if (!dbp) {
      dbp = new Promise((resolve) => {
        try {
          const r = indexedDB.open('whats-this', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('finds', { keyPath: 'id' });
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => resolve(null);
        } catch { resolve(null); }
      });
    }
    return dbp;
  }
  async function run(mode, fn) {
    const db = await open();
    if (!db) return fn(null);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('finds', mode);
      const req = fn(tx.objectStore('finds'));
      tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  return {
    all: () => run('readonly', (s) => (s ? s.getAll() : { result: [...memory.values()] })),
    put: (rec) => run('readwrite', (s) => (s ? s.put(rec) : (memory.set(rec.id, rec), null))),
    del: (id) => run('readwrite', (s) => (s ? s.delete(id) : (memory.delete(id), null))),
    clear: () => run('readwrite', (s) => (s ? s.clear() : (memory.clear(), null))),
  };
})();

/* ---------- state ---------- */
const S = {
  settings: Object.assign({ detail: 'detailed', rememberType: false, save: true, theme: 'dark' }, store.get('wt.settings', {})),
  type: null,
  view: 'home',       // home | result | error | archive | settings
  current: null,      // the find shown on the result screen
  error: null,        // { message, rec, exclude }
  finds: [],
  filter: 'all',
  q: '',
  ctl: null,
  timer: null,
  clearArmed: false,
  usage: null,        // free photos used/left, from the server
};
const DEVICE_ID = (() => {
  let id = store.get('wt.device', null);
  if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    id = (crypto.randomUUID ? crypto.randomUUID() : uid() + uid());
    store.set('wt.device', id);
  }
  return id;
})();
async function refreshUsage() {
  try {
    const r = await fetch('/api/identify', { headers: { 'X-Device-Id': DEVICE_ID, 'X-TZ-Offset': String(new Date().getTimezoneOffset()) } });
    const d = await r.json();
    if (d && d.usage) { S.usage = d.usage; if (['settings', 'home'].includes(S.view)) render(); }
  } catch { /* offline: ignore */ }
}
function leftToday() { return S.usage && S.usage.day ? Math.max(0, S.usage.day.limit - S.usage.day.used) : null; }
function whenResets(t) {
  const d = new Date(t), now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const midnight = d.getHours() === 0 && d.getMinutes() === 0;
  const time = midnight ? '' : ' at ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'today' + time;
  if (d.toDateString() === tomorrow.toDateString()) return 'tomorrow' + time;
  return 'on ' + d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) + time;
}
if (S.settings.rememberType) S.type = store.get('wt.type', null);
function saveSettings() { store.set('wt.settings', S.settings); }
function applyTheme() { document.documentElement.setAttribute('data-theme', S.settings.theme === 'system' ? 'system' : 'dark'); }

async function loadFinds() {
  try { S.finds = (await DB.all()) || []; } catch { S.finds = []; }
  S.finds.sort((a, b) => b.createdAt - a.createdAt);
  $('nav-count').textContent = S.finds.length;
}

/* ---------- navigation ---------- */
function go(view, extra = {}, replace = false) {
  Object.assign(S, extra, { view });
  const state = { view, id: S.current && S.current.id };
  if (replace) history.replaceState(state, ''); else history.pushState(state, '');
  render();
}
window.addEventListener('popstate', (e) => {
  if (!$('sheet').hidden) { closeLayer('sheet'); return; }
  if (!$('drawer').hidden) { closeLayer('drawer'); return; }
  if (!$('scan').hidden) { cancelScan(); return; }
  const st = e.state || { view: 'home' };
  if (st.view === S.view && (st.view !== 'result' || (S.current && st.id === S.current.id))) return; // closing a layer: nothing to redraw
  if (st.view === 'result') {
    const rec = S.finds.find((f) => f.id === st.id) || (S.current && S.current.id === st.id ? S.current : null);
    if (rec) { S.current = rec; S.view = 'result'; render(); return; }
  }
  S.view = ['archive', 'settings'].includes(st.view) ? st.view : 'home';
  if (S.view === 'home') S.current = null;
  render();
});

/* ---------- rendering ---------- */
function render() {
  const screen = $('screen');
  screen.replaceChildren();
  screen.scrollTop = 0;
  const dockVisible = ['home', 'result', 'error'].includes(S.view);
  $('dock').hidden = !dockVisible;
  $('dock').classList.toggle('bordered', S.view === 'result');
  updateTypeButton();
  if (S.view === 'result' && S.current) screen.append(...renderResult(S.current));
  else if (S.view === 'error') screen.append(...renderError());
  else if (S.view === 'archive') screen.append(renderArchive());
  else if (S.view === 'settings') screen.append(renderSettings());
  else screen.append(...renderHome());
  document.querySelectorAll('.nav-item').forEach((b) => {
    const target = b.dataset.go;
    const on = target === S.view || (target === 'home' && ['home', 'result', 'error'].includes(S.view));
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

function topbar() {
  return h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Open menu', onclick: () => openLayer('drawer') }, icon(ICON.menu)),
    h('span', { class: 'title' }, "What's this?"),
    h('span', { class: 'spacer' }));
}

function renderHome() {
  const vf = h('section', { class: 'viewfinder' },
    h('i', { class: 'corner c1' }), h('i', { class: 'corner c2' }), h('i', { class: 'corner c3' }), h('i', { class: 'corner c4' }),
    icon(ICON.camera),
    h('h1', null, 'Snap it or upload it.', h('br'), "We'll name it."),
    h('p', null, 'Animals, plants, tools, toys, cars and more.'));
  const left = leftToday();
  const hint = h('div', { class: 'hint' }, 'Type: ' + (S.type ? TYPE_NAME[S.type] : 'Any'),
    S.type ? h('button', { type: 'button', onclick: () => setType(null) }, 'Clear') : null,
    left !== null && left <= 3 ? h('span', { class: 'left' }, ` · ${left} free ${left === 1 ? 'photo' : 'photos'} left today`) : null);
  return [topbar(), vf, hint];
}

function renderError() {
  const e = S.error || {};
  return [topbar(), h('section', { class: 'problem' },
    icon(ICON.alert),
    h('h1', null, e.limit ? 'Free limit reached' : "Couldn't identify that"),
    h('p', null, e.message || 'Something went wrong. Try again.'),
    e.rec ? h('button', { class: 'btn', type: 'button', onclick: () => runIdentify(e.rec, e.exclude || [], !!e.retry) }, 'Try again') : null)];
}

function confBlock(c) {
  const n = { high: 3, medium: 2, low: 1 }[c] || 2;
  return h('span', { class: 'conf ' + (c || 'medium') },
    h('i', null, [1, 2, 3].map((k) => h('span', { class: k <= n ? 'on' : '' }))),
    (c || 'medium') + ' confidence');
}

function renderResult(rec) {
  const r = rec.result || {};
  const ok = r.identified !== false;
  const kind = TYPE_NAME[r.category] || TYPE_NAME[rec.type] || (r.category === 'other' ? 'Other' : '');
  const photo = h('div', { class: 'photo' },
    h('img', { src: rec.image || rec.thumb, alt: ok ? r.name : 'Your photo' }),
    h('button', { class: 'glass', type: 'button', 'aria-label': 'Open menu', onclick: () => openLayer('drawer') }, icon(ICON.menu)),
    rec.saved ? h('span', { class: 'saved-pill' }, icon(ICON.check), 'Saved') : null);

  const body = h('article', { class: 'sheet-body' });
  body.append(h('div', { class: 'meta' },
    kind ? h('span', { class: 'kind' }, kind) : null,
    kind && ok ? h('span', { class: 'sep' }, '/') : null,
    ok ? confBlock(r.confidence) : null));
  body.append(h('div', { class: 'name' },
    h('h1', null, ok ? r.name : "Couldn't tell"),
    ok && r.specific ? h('span', { class: 'specific' }, r.specific) : null));
  if (r.summary) body.append(h('p', { class: 'summary' }, r.summary));
  if (!ok && r.reason_if_not) body.append(h('p', { class: 'summary' }, r.reason_if_not));
  body.append(h('button', { class: 'retry', type: 'button', onclick: () => tryAgain(rec) }, icon(ICON.retry), ok ? 'Not it? Try again' : 'Try again'));
  if (r.caution) body.append(h('div', { class: 'caution' }, h('b', null, 'Caution'), r.caution));
  if (r.facts && r.facts.length) {
    body.append(h('div', { class: 'facts' }, r.facts.map((f) => h('div', { class: 'fact' }, h('span', null, f.label), h('strong', null, f.value)))));
  }
  if (r.lookalikes && r.lookalikes.length) {
    body.append(h('section', { class: 'block' }, h('div', { class: 'label' }, "Don't confuse with"),
      h('div', { class: 'rows' }, r.lookalikes.map((l) => h('div', null, h('b', null, l.name), h('span', null, l.tell))))));
  }
  if (r.notes && r.notes.length) {
    body.append(h('section', { class: 'block' }, h('div', { class: 'label' }, 'Good to know'),
      h('ul', { class: 'notes' }, r.notes.map((n) => h('li', null, n)))));
  }
  if (rec.saved) {
    const del = h('button', { class: 'link-danger', type: 'button' }, 'Delete from archive');
    let armed = false;
    del.addEventListener('click', async () => {
      if (!armed) { armed = true; del.textContent = 'Tap again to delete'; setTimeout(() => { armed = false; del.textContent = 'Delete from archive'; }, 3500); return; }
      await DB.del(rec.id).catch(() => {});
      await loadFinds();
      S.current = null;
      toast('Deleted from your archive.');
      go('home', {}, true);
    });
    body.append(del);
  }
  return [photo, body];
}

function renderArchive() {
  const page = h('section', { class: 'page' });
  page.append(h('div', { class: 'page-head' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', onclick: () => history.back() }, icon(ICON.back)),
    h('h1', null, 'Archive'),
    h('small', null, S.finds.length + (S.finds.length === 1 ? ' find' : ' finds'))));
  if (!S.finds.length) {
    page.append(h('div', { class: 'empty' }, h('h2', null, 'Nothing here yet'),
      h('p', null, 'Every photo you identify is saved here with its answer, so you can look it up again later.')));
    return page;
  }
  const input = h('input', { type: 'search', placeholder: 'Search your finds', 'aria-label': 'Search your finds', value: S.q });
  const list = h('div', { class: 'list' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by type' });
  const used = [...new Set(S.finds.map(kindOf))].filter(Boolean);
  const drawList = () => {
    const q = S.q.toLowerCase();
    const items = S.finds.filter((f) => (S.filter === 'all' || kindOf(f) === S.filter) &&
      (!q || [f.result && f.result.name, f.result && f.result.specific, TYPE_NAME[kindOf(f)]].join(' ').toLowerCase().includes(q)));
    list.replaceChildren(...items.map((f) => h('button', { class: 'row', type: 'button', onclick: () => openFind(f) },
      f.thumb ? h('img', { src: f.thumb, alt: '' }) : h('span', { class: 'ph' }),
      h('span', { class: 'txt' },
        h('b', null, f.result && f.result.identified !== false ? f.result.name : 'Unidentified'),
        h('span', null, [TYPE_NAME[kindOf(f)], fmtDate(f.createdAt)].filter(Boolean).join(' · '))),
      icon(ICON.chevron))));
    if (!items.length) list.append(h('p', { class: 'empty' }, 'No finds match.'));
  };
  const drawChips = () => {
    chips.replaceChildren(...[['all', 'All'], ...used.map((k) => [k, TYPE_NAME[k]])].map(([k, name]) =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.filter === k), onclick: () => { S.filter = k; drawChips(); drawList(); } }, name)));
  };
  input.addEventListener('input', () => { S.q = input.value; drawList(); });
  page.append(h('label', { class: 'search' }, icon(ICON.search), input));
  if (used.length > 1) page.append(chips);
  page.append(list);
  drawChips(); drawList();
  return page;
}
function kindOf(f) { const r = f.result || {}; return TYPE_NAME[r.category] ? r.category : (TYPE_NAME[f.type] ? f.type : ''); }

function renderSettings() {
  const st = S.settings;
  const page = h('section', { class: 'page' });
  page.append(h('div', { class: 'page-head' },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', onclick: () => history.back() }, icon(ICON.back)),
    h('h1', null, 'Settings')));
  const seg = (options, value, onPick) => h('div', { class: 'seg' }, options.map(([v, label]) =>
    h('button', { type: 'button', 'aria-pressed': String(value === v), onclick: () => { onPick(v); saveSettings(); render(); } }, label)));
  const toggle = (label, sub, key) => h('button', { class: 'setting', type: 'button', role: 'switch', 'aria-checked': String(!!st[key]),
    onclick: () => { st[key] = !st[key]; if (key === 'rememberType') store.set('wt.type', st[key] ? S.type : null); saveSettings(); render(); } },
    h('span', { class: 'txt' }, h('b', null, label), h('small', null, sub)), h('span', { class: 'switch', 'aria-hidden': 'true' }));

  if (S.usage) {
    const row = (label, u) => h('div', { class: 'setting' }, h('span', { class: 'txt' }, h('b', null, label), h('small', null, 'Resets ' + whenResets(u.resetsAt))),
      h('span', { class: 'count' }, h('strong', null, String(Math.max(0, u.limit - u.used))), ` of ${u.limit} left`));
    page.append(h('div', { class: 'group' }, h('div', { class: 'label' }, 'Free photos'),
      h('div', { class: 'card' }, row('Today', S.usage.day), row('This week', S.usage.week), row('This month', S.usage.month))));
  }
  page.append(h('div', { class: 'group' }, h('div', { class: 'label' }, 'Answers'),
    h('div', { class: 'card' },
      h('div', { class: 'setting' }, h('span', { class: 'txt' }, h('b', null, 'Answer length')),
        seg([['quick', 'Quick'], ['detailed', 'Detailed']], st.detail, (v) => { st.detail = v; })),
      toggle('Remember last type', 'Keep your + choice for the next photo', 'rememberType'))));

  const clear = h('button', { class: 'setting danger', type: 'button' }, 'Clear archive…');
  clear.addEventListener('click', async () => {
    if (!S.finds.length) { toast('Your archive is already empty.'); return; }
    if (!S.clearArmed) { S.clearArmed = true; clear.textContent = `Tap again to delete all ${S.finds.length} finds`; setTimeout(() => { S.clearArmed = false; clear.textContent = 'Clear archive…'; }, 4000); return; }
    S.clearArmed = false;
    await DB.clear().catch(() => {});
    await loadFinds();
    toast('Archive cleared.');
    render();
  });
  page.append(h('div', { class: 'group' }, h('div', { class: 'label' }, 'Archive'),
    h('div', { class: 'card' }, toggle('Save every result', 'Keeps the answer and the photo on this device', 'save'), clear)));

  page.append(h('div', { class: 'group' }, h('div', { class: 'label' }, 'Appearance'),
    h('div', { class: 'card' }, h('div', { class: 'setting' }, h('span', { class: 'txt' }, h('b', null, 'Theme')),
      seg([['dark', 'Dark'], ['system', 'Match phone']], st.theme, (v) => { st.theme = v; applyTheme(); })))));
  page.append(h('p', { class: 'version' }, "What's this? · version 1.0 · your archive stays on this device"));
  return page;
}

/* ---------- type picker ---------- */
function renderTypeGrid() {
  $('type-grid').replaceChildren(...TYPES.map(([id, name, d]) => h('button', {
    class: 'tile', type: 'button', 'aria-pressed': String(S.type === id),
    onclick: () => { setType(id); closeLayerViaHistory('sheet'); },
  }, icon(d), name)));
}
function setType(id) {
  S.type = id;
  if (S.settings.rememberType) store.set('wt.type', id);
  updateTypeButton();
  if (S.view === 'home') render();
}
function updateTypeButton() {
  const set = !!S.type;
  $('btn-type').classList.toggle('set', set);
  $('btn-type').setAttribute('aria-label', set ? `Type: ${TYPE_NAME[S.type]}. Change type` : 'Choose what type of thing it is');
  const lab = $('type-label');
  lab.textContent = set ? TYPE_NAME[S.type] : 'Type';
  lab.classList.toggle('set', set);
}

/* ---------- layers ---------- */
function openLayer(id) {
  if (id === 'sheet') renderTypeGrid();
  if (id === 'drawer') renderRecent();
  $(id).hidden = false;
  history.pushState({ view: S.view, id: S.current && S.current.id, layer: id }, '');
  const first = $(id).querySelector('.tile[aria-pressed="true"], .nav-item, .tile, button:not(.scrim)');
  if (first) first.focus({ preventScroll: true });
}
function closeLayer(id) { $(id).hidden = true; }
function closeLayerViaHistory(id) {
  if ($(id).hidden) return;
  closeLayer(id);
  if (history.state && history.state.layer === id) history.back();
}
document.querySelectorAll('.layer [data-close]').forEach((b) => b.addEventListener('click', () => closeLayerViaHistory(b.closest('.layer').id)));
$('type-any').addEventListener('click', () => { setType(null); closeLayerViaHistory('sheet'); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  ['sheet', 'drawer'].forEach(closeLayerViaHistory);
});
function renderRecent() {
  const box = $('recent');
  box.replaceChildren();
  const recent = S.finds.slice(0, 3);
  if (!recent.length) return;
  box.append(h('div', { class: 'label' }, 'Recent'));
  recent.forEach((f) => box.append(h('button', { type: 'button', onclick: () => { closeLayer('drawer'); openFind(f, true); } },
    f.thumb ? h('img', { src: f.thumb, alt: '' }) : h('span'),
    h('span', { class: 'txt' },
      h('b', null, f.result && f.result.identified !== false ? f.result.name : 'Unidentified'),
      h('span', null, [TYPE_NAME[kindOf(f)], fmtDate(f.createdAt)].filter(Boolean).join(' · '))))));
}
document.querySelectorAll('.nav-item').forEach((b) => b.addEventListener('click', () => {
  closeLayer('drawer');
  const target = b.dataset.go;
  if (target === 'home') { S.current = null; go('home', {}, true); }
  else go(target, {}, true);
  if (target === 'settings') refreshUsage();
}));
function openFind(f, replace = false) { S.current = f; go('result', {}, replace); }

/* ---------- photo intake ---------- */
$('btn-camera').addEventListener('click', () => $('file-camera').click());
$('btn-upload').addEventListener('click', () => $('file-upload').click());
$('btn-type').addEventListener('click', () => openLayer('sheet'));
['file-camera', 'file-upload'].forEach((id) => $(id).addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) handleFile(file);
}));

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
function toJpeg(src, max, quality) {
  const w = src.width || src.naturalWidth, hgt = src.height || src.naturalHeight;
  const scale = Math.min(1, max / Math.max(w, hgt));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(hgt * scale));
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

async function handleFile(file) {
  showScan(null);
  let img;
  try { img = await decode(file); } catch {
    hideScan();
    S.error = { message: "This photo couldn't be opened. Try a JPEG or PNG, or take a new photo." };
    go('error');
    return;
  }
  const rec = {
    id: uid(), createdAt: Date.now(), type: S.type,
    image: toJpeg(img, MAX_SIDE, 0.82), thumb: toJpeg(img, THUMB_SIDE, 0.72),
    result: null, saved: false, excluded: [],
  };
  if (img.close) img.close();
  runIdentify(rec, []);
}

/* ---------- identifying ---------- */
function showScan(src) {
  const img = $('scan-img');
  if (src) { img.src = src; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
  $('scan-msg').textContent = 'Identifying…';
  $('scan-meta').textContent = '';
  $('scan').hidden = false;
}
function hideScan() {
  $('scan').hidden = true;
  clearInterval(S.timer);
}
function cancelScan() { if (S.ctl) S.ctl.abort(); hideScan(); }
$('scan-cancel').addEventListener('click', cancelScan);

async function runIdentify(rec, exclude, retry = false) {
  showScan(rec.image);
  const t0 = Date.now();
  const label = TYPE_NAME[rec.type] ? TYPE_NAME[rec.type].toUpperCase() + ' · ' : '';
  const msgs = retry ? ['Taking another look…', 'Checking other options…', 'Almost there…'] : ['Identifying…', 'Checking the details…', 'Almost there…'];
  clearInterval(S.timer);
  S.timer = setInterval(() => {
    const s = Math.round((Date.now() - t0) / 1000);
    $('scan-meta').textContent = label + s + 's';
    $('scan-msg').textContent = msgs[Math.min(msgs.length - 1, Math.floor(s / 5))];
  }, 250);

  if (S.ctl) S.ctl.abort();
  const ctl = new AbortController();
  S.ctl = ctl;
  const timeout = setTimeout(() => ctl.abort('timeout'), 60000);
  try {
    const res = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': DEVICE_ID, 'X-TZ-Offset': String(new Date().getTimezoneOffset()) },
      body: JSON.stringify({ image: rec.image.split(',')[1], type: rec.type, detail: S.settings.detail, exclude, retry }),
      signal: ctl.signal,
    });
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (data && data.usage) S.usage = data.usage;
    if (data && data.error === 'limit_reached') throw { limit: true, message: `${data.message} More free photos ${whenResets(data.resetsAt)}.` };
    if (!res.ok || !data || !data.result) throw { message: (data && data.message) || errorFor(res.status) };
    rec.result = clean(data.result);
    rec.excluded = exclude;
    rec.attempts = (rec.attempts || 0) + 1;
    if (S.settings.save) {
      try { rec.saved = true; await DB.put(rec); } catch { rec.saved = false; toast("Couldn't save to your archive. The storage on this device may be full."); }
      await loadFinds();
    }
    if (!S.settings.rememberType) setType(null);
    hideScan();
    S.current = rec;
    S.error = null;
    go('result', {}, S.view === 'result' || S.view === 'error');
  } catch (e) {
    hideScan();
    if (ctl.signal.aborted && ctl.signal.reason !== 'timeout') return; // user cancelled
    const message = ctl.signal.aborted ? 'That took too long. Check your connection and try again.'
      : (e && e.message && !(e instanceof TypeError)) ? e.message
      : "Couldn't reach the server. Check your connection and try again.";
    S.error = e && e.limit ? { message: e.message, limit: true } : { message, rec, exclude, retry };
    go('error', {}, S.view === 'error');
  } finally {
    clearTimeout(timeout);
    if (S.ctl === ctl) S.ctl = null;
  }
}
function errorFor(status) {
  if (status === 429 || status === 503) return 'Lots of people are asking right now. Wait a moment and try again.';
  if (status === 413) return 'That photo is too large. Try another one.';
  return 'Something went wrong on our side. Try again.';
}
function tryAgain(rec) {
  const name = rec.result && rec.result.identified !== false ? rec.result.name : null;
  const exclude = [...new Set([...(rec.excluded || []), ...(name ? [name] : [])])];
  runIdentify(rec, exclude, true);
}
function clean(r) {
  const arr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
  return {
    identified: r.identified !== false,
    name: titleCase(r.name) || 'Unknown',
    specific: str(r.specific),
    confidence: ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : 'medium',
    category: str(r.category),
    summary: str(r.summary),
    facts: arr(r.facts, 6).map((f) => ({ label: str(f && f.label), value: str(f && f.value) })).filter((f) => f.label && f.value),
    lookalikes: arr(r.lookalikes, 3).map((l) => ({ name: titleCase(l && l.name), tell: str(l && l.tell) })).filter((l) => l.name),
    notes: arr(r.notes, 4).map(str).filter(Boolean),
    caution: str(r.caution),
    reason_if_not: str(r.reason_if_not),
  };
}

/* ---------- start ---------- */
applyTheme();
history.replaceState({ view: 'home' }, '');
render();
loadFinds().then(() => { if (S.view === 'archive') render(); });
refreshUsage();
if ('serviceWorker' in navigator) {
  // No offline cache yet; unregister any old worker so updates always show.
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
}
})();
