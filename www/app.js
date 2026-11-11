import { initEngine, isReady, startListening, stopListening, inferNow, refSkeleton, heardSkeleton, alignWords } from './recite.js';
import { parseAyah, splitChunks, buildStages, LEGEND } from './quran.js';

const RECITERS = [
  { id: 'Minshawy_Murattal_128kbps', name: 'محمد صديق المنشاوي' },
  { id: 'Husary_64kbps', name: 'محمود خليل الحصري' },
  { id: 'Husary_Muallim_128kbps', name: 'الحصري (المصحف المعلّم)' },
  { id: 'Alafasy_128kbps', name: 'مشاري العفاسي' }
];
const REPEATS = [1, 3, 5, 7, 10];
const GOALS = [1, 3, 5, 10, 20];
const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120];
const STEP_LABEL = { listen: 'استمع', read: 'اقرأ', memory: 'من الذاكرة' };
const PRAISE = ['ممتاز!', 'برافو عليك!', 'ما شاء الله!'];
const KEY = 'muddakir-data-v1';
const STAR = 'M880 512L772 619.7L772 772L619.7 772L512 880L404.3 772L252 772L252 619.7L144 512L252 404.3L252 252L404.3 252L512 144L619.7 252L772 252L772 404.3Z';
const STAR8 = 'M12 2l2.9 4.1L20 4l-2.1 5.1L22 12l-4.1 2.9L20 20l-5.1-2.1L12 22l-2.9-4.1L4 20l2.1-5.1L2 12l4.1-2.9L4 4l5.1 2.1z';

const ICONS = {
  home: 'M5 12l-2 0l9 -9l9 9l-2 0 M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7 M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6',
  book: 'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0 M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0 M3 6l0 13 M12 6l0 13 M21 6l0 13',
  refresh: 'M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4 M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4',
  puzzle: 'M4 7h3a1 1 0 0 0 1 -1v-1a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0 -1 1v3a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-1a2 2 0 0 0 -4 0v1a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h1a2 2 0 0 0 0 -4h-1a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1',
  mic: 'M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1 -6 0z M5 10a7 7 0 0 0 14 0 M8 21l8 0 M12 17l0 4',
  pause: 'M6 5h4v14h-4z M14 5h4v14h-4z',
  volume: 'M15 8a5 5 0 0 1 0 8 M17.7 5a9 9 0 0 1 0 14 M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5',
  arrowRight: 'M5 12l14 0 M13 18l6 -6 M13 6l6 6',
  chevronRight: 'M9 6l6 6l-6 6',
  chevronLeft: 'M15 6l-6 6l6 6',
  sliders: 'M4 8h4 M12 8h8 M10 6v4 M4 16h10 M18 16h2 M16 14v4',
  check: 'M5 12l5 5l10 -10',
  play: 'M7 4v16l13 -8z',
  shuffle: 'M4 6h4l8 12h4 M4 18h4l2.5 -3.7 M13.5 9.7l2.5 -3.7h4 M18 4l2 2l-2 2 M18 16l2 2l-2 2',
  pencil: 'M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4 M13.5 6.5l4 4',
  link: 'M9 15l6 -6 M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464 M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463',
  lock: 'M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0 M8 11v-4a4 4 0 1 1 8 0v4',
  bulb: 'M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7 M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3 M9.7 17l4.6 0',
  sparkle: 'M12 3l2 5l5 2l-5 2l-2 5l-2 -5l-5 -2l5 -2z'
};

function icon(name, size = 22) {
  return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ICONS[name] + '"/></svg>';
}

function brandMark(size) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 1024 1024" aria-hidden="true"><rect width="1024" height="1024" rx="230" fill="#1C2B45"/>' +
    '<g transform="translate(512 512) scale(0.95) translate(-512 -512)"><path d="' + STAR + '" fill="#26385A" stroke="#C7A55A" stroke-width="26" stroke-linejoin="round"/>' +
    '<path d="M512 640C452 605 385 600 335 615L335 480C385 465 452 470 512 500Z" fill="#F6F4EF"/><path d="M512 640C572 605 639 600 689 615L689 480C639 465 572 470 512 500Z" fill="#E9E1CF"/>' +
    '<path d="M512 500L512 640" stroke="#C7A55A" stroke-width="8" stroke-linecap="round"/><g fill="none" stroke="#C7A55A" stroke-width="20" stroke-linecap="round">' +
    '<path d="M487 426.7A50 50 0 0 1 537 426.7"/><path d="M468 393.8A88 88 0 0 1 556 393.8"/><path d="M449 360.9A126 126 0 0 1 575 360.9"/></g></g></svg>';
}

const starBadge = (n, full) => '<span class="badge' + (full ? ' full' : '') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR8 + '"/></svg><span>' + n + '</span></span>';
const divider = () => '<div class="divider"><i></i><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR8 + '" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><i></i></div>';

const app = document.getElementById('app');
const $ = (sel) => app.querySelector(sel);
const $$ = (sel) => Array.from(app.querySelectorAll(sel));
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad3 = (n) => String(n).padStart(3, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const arDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function ayatWord(n) {
  if (n === 1) return 'آية';
  if (n === 2) return 'آيتين';
  if (n >= 3 && n <= 10) return n + ' آيات';
  return n + ' آية';
}

function ayatTimes(n) {
  if (n === 1) return 'مرة';
  if (n === 2) return 'مرتين';
  if (n >= 3 && n <= 10) return n + ' مرات';
  return n + ' مرة';
}

let QURAN = [];
let db = loadDb();
let renderSeq = 0;
let tafsirData;
const skipped = new Set();
const tokenCache = new Map();
const timingCache = {};

function loadDb() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && Array.isArray(v.profiles)) return v;
  } catch (e) { /* ignore */ }
  return { profiles: [], current: null };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('تعذر حفظ البيانات'); }
}

const profile = () => db.profiles.find((p) => p.id === db.current) || null;
const key = (s, a) => s + ':' + a;
const passMark = (p) => (p.mode === 'kids' ? 70 : 80);
const reciterId = (p) => (RECITERS.some((r) => r.id === p.reciter) ? p.reciter : RECITERS[0].id);

function newProfile(name, mode) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, mode,
    reciter: RECITERS[0].id,
    repeat: mode === 'kids' ? 5 : 3,
    goal: mode === 'kids' ? 3 : 5,
    tajweed: true,
    daily: { d: '', n: 0 },
    attempts: 0, scoreSum: 0,
    lastPos: null, lastStage: null,
    ayat: {}, mistakes: {}
  };
}

function ayahTokens(s, a) {
  const k = key(s, a);
  if (!tokenCache.has(k)) tokenCache.set(k, parseAyah(QURAN[s - 1].ayat[a - 1]));
  return tokenCache.get(k);
}

function memorizedAyat(s) {
  const p = profile();
  const out = [];
  const len = QURAN[s - 1].ayat.length;
  for (let a = 1; a <= len; a++) {
    const st = p.ayat[key(s, a)];
    if (st && st.lvl >= 1) out.push(a);
  }
  return out;
}

const memCount = (s) => memorizedAyat(s).length;

function firstUnmemorized(s) {
  const p = profile();
  const len = QURAN[s - 1].ayat.length;
  for (let a = 1; a <= len; a++) {
    const st = p.ayat[key(s, a)];
    if (!st || st.lvl < 1) return a;
  }
  return 1;
}

const todayCount = (p) => (p.daily && p.daily.d === dayKey() ? p.daily.n : 0);

function applyResult(s, a, score, review) {
  const p = profile();
  const k = key(s, a);
  const st = p.ayat[k] || { lvl: 0, due: '', ok: 0, bad: 0 };
  p.attempts = (p.attempts || 0) + 1;
  p.scoreSum = (p.scoreSum || 0) + score;
  if (score >= passMark(p)) {
    st.ok++;
    if (review) {
      st.lvl = Math.min(INTERVALS.length - 1, st.lvl + 1);
      st.due = dayKey(INTERVALS[st.lvl]);
    } else if (st.lvl < 1) {
      st.lvl = 1;
      st.due = dayKey(1);
      p.daily = { d: dayKey(), n: todayCount(p) + 1 };
    }
  } else {
    st.bad++;
    p.mistakes[k] = (p.mistakes[k] || 0) + 1;
    if (review && st.lvl > 0) { st.lvl = 1; st.due = dayKey(1); }
  }
  st.last = dayKey();
  p.ayat[k] = st;
  save();
}

function dueList() {
  const p = profile();
  const t = dayKey();
  return Object.entries(p.ayat)
    .filter(([, v]) => v.lvl >= 1 && v.due && v.due <= t)
    .map(([k, v]) => { const [s, a] = k.split(':').map(Number); return { k, s, a, due: v.due }; })
    .sort((x, y) => (x.due < y.due ? -1 : x.due > y.due ? 1 : (x.s - y.s) || (x.a - y.a)));
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3200);
}

function showError(e) {
  console.error(e);
  toast((e && e.message) || 'حصلت مشكلة، جرّب تاني');
}

async function getTafsir() {
  if (tafsirData !== undefined) return tafsirData;
  try {
    const r = await fetch('data/tafsir.json');
    tafsirData = r.ok ? await r.json() : null;
  } catch (e) {
    tafsirData = null;
  }
  return tafsirData;
}

let player = null;
let playToken = 0;
let pendingStop = null;

function stopAudio() {
  playToken++;
  if (pendingStop) { const f = pendingStop; pendingStop = null; f(); }
  if (player) {
    try { player.pause(); } catch (e) { /* ignore */ }
    player.removeAttribute('src');
    player = null;
  }
}

function audioUrl(s, a) {
  return 'https://everyayah.com/data/' + reciterId(profile()) + '/' + pad3(s) + pad3(a) + '.mp3';
}

async function getTimings(id) {
  if (timingCache[id] !== undefined) return timingCache[id];
  try {
    const r = await fetch('data/timings/' + id + '.json');
    timingCache[id] = r.ok ? await r.json() : null;
  } catch (e) {
    timingCache[id] = null;
  }
  return timingCache[id];
}

function pausesFor(row, tokens) {
  if (!row || row[0] !== tokens.length || row.length < 1 + 2 * row[0]) return null;
  const n = row[0];
  const st = row.slice(1, 1 + n);
  const en = row.slice(1 + n, 1 + 2 * n);
  const out = new Array(n).fill(null);
  let prevWord = -1;
  for (let i = 0; i < n; i++) {
    if (!tokens[i].c) continue;
    if (prevWord >= 0) out[prevWord] = st[i] - en[prevWord];
    prevWord = i;
  }
  return out;
}

function clipFor(row, tokens, from, to) {
  const full = from === 0 && to === tokens.length - 1;
  let fw = from;
  while (fw <= to && !tokens[fw].c) fw++;
  let lw = to;
  while (lw >= from && !tokens[lw].c) lw--;
  if (row && fw <= lw) {
    const n = row[0];
    const st = row.slice(1, 1 + n);
    const en = row.length >= 1 + 2 * n ? row.slice(1 + n, 1 + 2 * n) : null;
    const map = (i) => (n === tokens.length ? i : Math.min(n - 1, Math.round((i * n) / tokens.length)));
    const words = [];
    for (let i = from; i <= to; i++) if (tokens[i].c) words.push({ i, t: st[map(i)] / 1000 });
    const li = map(lw);
    const endMs = en ? en[li] : (li + 1 < n ? st[li + 1] : null);
    const startS = full ? 0 : Math.max(0, st[map(fw)] / 1000 - 0.08);
    const endS = endMs !== null && endMs !== undefined ? endMs / 1000 + 0.3 : null;
    return () => ({ start: startS, end: endS, words });
  }
  return (duration) => {
    if (!isFinite(duration) || duration <= 0) return { start: 0, end: null, words: [] };
    const lens = tokens.map((t) => Math.max(1, t.c.length));
    const sum = lens.reduce((x, y) => x + y, 0);
    const at = (i) => (lens.slice(0, i).reduce((x, y) => x + y, 0) / sum) * duration;
    const words = [];
    for (let i = from; i <= to; i++) if (tokens[i].c) words.push({ i, t: at(i) });
    return { start: full ? 0 : Math.max(0, at(from) - 0.2), end: full ? null : Math.min(duration, at(to + 1) + 0.3), words };
  };
}

function playClip(url, clip, onWord, token) {
  return new Promise((resolve) => {
    const au = new Audio();
    player = au;
    let finished = false;
    let raf = 0;
    let range = null;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      au.onended = null;
      au.onerror = null;
      au.onloadedmetadata = null;
      try { au.pause(); } catch (e) { /* ignore */ }
      if (pendingStop === stopper) pendingStop = null;
      resolve(ok);
    };
    const stopper = () => done(false);
    pendingStop = stopper;
    const tick = () => {
      if (finished) return;
      const t = au.currentTime;
      if (range) {
        if (range.words && range.words.length) {
          let cur = -1;
          for (const w of range.words) if (t + 0.05 >= w.t) cur = w.i;
          onWord(cur);
        }
        if (range.end && t >= range.end) { done(true); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    au.onloadedmetadata = () => {
      range = clip(au.duration);
      if (range && range.start > 0) { try { au.currentTime = range.start; } catch (e) { /* ignore */ } }
      au.play().then(() => { raf = requestAnimationFrame(tick); }).catch(() => done(false));
    };
    au.onended = () => done(true);
    au.onerror = () => {
      if (token === playToken) toast('تعذر تشغيل الصوت، اتأكد من الإنترنت');
      done(false);
    };
    au.preload = 'auto';
    au.src = url;
    au.load();
  });
}

async function playRepeat(s, a, clip, times, onWord, onStep) {
  stopAudio();
  const token = playToken;
  for (let i = 1; i <= times; i++) {
    if (token !== playToken) return false;
    onStep(i);
    const ok = await playClip(audioUrl(s, a), clip, onWord, token);
    onWord(-1);
    if (!ok || token !== playToken) return false;
    if (i < times) await sleep(500);
  }
  player = null;
  return true;
}

function cleanup() {
  stopAudio();
  stopListening();
}

function topBar(title, back) {
  return '<header class="top">' +
    (back ? '<button class="ibtn" data-back aria-label="رجوع">' + icon('arrowRight') + '</button>' : '<span class="logo">' + brandMark(34) + '</span>') +
    '<div class="ttl' + (back ? ' center' : '') + '"><b>' + esc(title) + '</b></div>' + (back ? brandMark(28) : '') + '</header>';
}

function navBar(active) {
  const items = [['home', 'home', 'الرئيسية'], ['surahs', 'book', 'السور'], ['reviewHub', 'refresh', 'المراجعة'], ['activities', 'puzzle', 'أنشطة']];
  return '<nav class="nav">' + items.map(([id, ic, label]) =>
    '<button data-tab="' + id + '" class="' + (id === active ? 'on' : '') + '" aria-label="' + label + '">' + icon(ic, 20) + '</button>').join('') + '</nav>';
}

const curDepth = () => (history.state && history.state.depth) || 0;
const capPlugin = (name) => {
  const C = window.Capacitor;
  if (!C) return null;
  if (C.Plugins && C.Plugins[name]) return C.Plugins[name];
  try { return C.registerPlugin ? C.registerPlugin(name) : null; } catch (e) { return null; }
};

function goBack() {
  const st = history.state || {};
  if ((st.depth || 0) > 0) { history.back(); return; }
  if (profile() && st.screen && st.screen !== 'home' && st.screen !== 'profiles') { go('home', {}, true); return; }
  const CapApp = capPlugin('App');
  if (CapApp && CapApp.exitApp) CapApp.exitApp();
}

function tab(target) {
  const cur = (history.state && history.state.screen) || 'home';
  if (target === cur) return;
  if (target === 'home') { goBack(); return; }
  go(target, {}, cur !== 'home');
}

function renderAyah(tokens, o) {
  const parts = tokens.map((t, i) => {
    const inRange = i >= o.from && i <= o.to;
    if (!t.c) return '<span class="mark' + (inRange ? '' : ' dim') + '">' + esc(t.plain) + '</span>';
    if (!inRange) return '<span class="w dim">' + t.html + '</span>';
    const st = o.statuses[i];
    if (st && st !== 'pending') return '<span class="w ' + st + '" data-i="' + i + '">' + esc(t.plain) + '</span>';
    if (o.hidden) {
      const width = Math.min(5, Math.max(1.4, t.c.length * 0.5));
      return '<span class="w" data-i="' + i + '"><span class="blank" style="width:' + width + 'em"></span></span>';
    }
    return '<span class="w" data-i="' + i + '">' + t.html + '</span>';
  });
  return parts.join(' ') + ' <span class="anum">﴿' + arDigits(o.a) + '﴾</span>';
}

function resultCard(pass, score, statuses, ref, extra) {
  const c = { ok: 0, near: 0, bad: 0, miss: 0, hint: 0 };
  ref.forEach((ti) => { const x = statuses[ti]; if (c[x] !== undefined) c[x]++; });
  return '<div class="result ' + (pass ? 'pass' : 'fail') + '"><div class="score">' + score + '%</div>' +
    '<div class="counts"><span class="ok">' + c.ok + ' صح</span>' + (c.near ? '<span class="near">' + c.near + ' قريبة</span>' : '') +
    (c.bad ? '<span class="bad">' + c.bad + ' غلط</span>' : '') + (c.miss ? '<span class="miss">' + c.miss + ' ناقصة</span>' : '') +
    (c.hint ? '<span class="gold">' + c.hint + ' مساعدة</span>' : '') + '</div>' + (extra || '') + '</div>';
}

function lockedScreen(title, msg) {
  app.innerHTML = topBar(title, true) + '<main class="wrap"><div class="card empty">' + icon('lock', 36) + '<b>' + esc(msg) + '</b>' +
    '<button class="primary" data-back>رجوع</button></div></main>';
}

function screenProfiles() {
  app.innerHTML = '<main class="wrap"><div class="hero-brand">' + brandMark(84) + '<b>مُدَّكِر</b><small>﴿فَهَلْ مِن مُّدَّكِرٍ﴾</small></div>' +
    (db.profiles.length ? '<div class="profiles">' + db.profiles.map((p) =>
      '<button class="card prof" data-id="' + p.id + '"><span class="initial">' + esc(p.name.charAt(0)) + '</span><b>' + esc(p.name) +
      '</b><small>' + (p.mode === 'kids' ? 'وضع الطفل' : 'وضع الكبار') + '</small></button>').join('') + '</div>' : '') +
    '<section class="card"><h2>' + (db.profiles.length ? 'ملف جديد' : 'ابدأ بملفك') + '</h2><input class="field" id="pName" maxlength="20" placeholder="الاسم">' +
    '<div class="seg" id="modeSeg"><button class="on" data-mode="adult">كبير</button><button data-mode="kids">طفل</button></div>' +
    '<button class="primary" id="pAdd">ابدأ</button></section></main>';
  let mode = 'adult';
  $$('.prof').forEach((b) => { b.onclick = () => { db.current = b.dataset.id; save(); go('home', {}, true); }; });
  $$('#modeSeg button').forEach((b) => { b.onclick = () => { mode = b.dataset.mode; $$('#modeSeg button').forEach((x) => x.classList.toggle('on', x === b)); }; });
  $('#pAdd').onclick = () => {
    const name = $('#pName').value.trim();
    if (!name) { toast('اكتب الاسم الأول'); return; }
    const p = newProfile(name, mode);
    db.profiles.push(p);
    db.current = p.id;
    save();
    go('home', {}, true);
  };
}

function screenHome() {
  const p = profile();
  const due = dueList().length;
  const mem = Object.values(p.ayat).filter((x) => x.lvl >= 1).length;
  const done = todayCount(p);
  const goal = p.goal || 5;
  const pos = p.lastPos && QURAN[p.lastPos.s - 1] ? p.lastPos : null;
  const segs = goal <= 10
    ? '<div class="segs">' + Array.from({ length: goal }, (_, i) => '<i class="' + (i < done ? 'on' : '') + '"></i>').join('') + '</div>'
    : '<div class="segs"><i class="on" style="flex:' + Math.min(done, goal) + '"></i><i style="flex:' + Math.max(0, goal - done) + '"></i></div>';
  app.innerHTML = '<header class="top"><span class="logo">' + brandMark(38) + '</span><div class="hello grow"><small>السلام عليكم</small><b>' + esc(p.name) + '</b></div>' +
    '<button class="ibtn" id="settings" aria-label="الإعدادات">' + icon('sliders') + '</button></header><main class="wrap">' +
    '<section class="wird"><div class="wird-in"><div class="wird-top"><span>وِرد اليوم</span><span>' + arDigits(Math.min(done, goal)) + ' / ' + arDigits(goal) + '</span></div>' +
    '<b>' + (pos ? 'سورة ' + esc(QURAN[pos.s - 1].name) + ' · من آية ' + arDigits(pos.a) : 'ابدأ وِردك من أي سورة') + '</b>' +
    (done >= goal ? '<p>خلّصت وِرد النهارده، ما شاء الله</p>' : '') + segs +
    '<button class="gold-btn" id="cont">' + (pos ? 'كمّل الحفظ' : 'ابدأ الحفظ') + '</button></div></section>' +
    divider() +
    '<div class="tiles"><button class="tile" id="rev"><b>' + arDigits(due) + '</b><small>للمراجعة</small></button>' +
    '<button class="tile" id="memT"><b>' + arDigits(mem) + '</b><small>آية محفوظة</small></button>' +
    '<button class="tile wide" id="acts">' + icon('puzzle', 20) + '<span>الأنشطة</span>' + icon('chevronLeft', 18) + '</button></div>' +
    '</main>' + navBar('home');
  $('#cont').onclick = () => { if (pos) go('practice', { s: pos.s, a: pos.a }); else tab('surahs'); };
  $('#rev').onclick = () => tab('reviewHub');
  $('#memT').onclick = () => tab('surahs');
  $('#acts').onclick = () => tab('activities');
  $('#settings').onclick = () => go('settings');
}

function screenSurahs() {
  const p = profile();
  let filter = p.mode === 'kids' ? 'amma' : 'all';
  const base = p.mode === 'kids' ? QURAN.slice().reverse() : QURAN;
  app.innerHTML = topBar('السور', false) + '<main class="wrap">' +
    '<div class="chips" id="chips"><button class="chip" data-f="amma">جزء عمّ</button><button class="chip" data-f="tabarak">جزء تبارك</button><button class="chip" data-f="all">الكل</button></div>' +
    '<input class="field" id="q" placeholder="ابحث عن سورة"><div id="slist"></div></main>' + navBar('surahs');
  const inFilter = (n) => (filter === 'amma' ? n >= 78 : filter === 'tabarak' ? n >= 67 && n <= 77 : true);
  const draw = () => {
    $$('#chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.f === filter));
    const q = $('#q').value.trim();
    const list = base.filter((s) => (q ? s.name.includes(q) || String(s.n) === q : inFilter(s.n)));
    $('#slist').innerHTML = list.map((s) => {
      const m = memCount(s.n);
      const total = s.ayat.length;
      const full = m === total;
      return '<button class="row" data-s="' + s.n + '">' + starBadge(s.n, full) + '<div class="grow"><span class="qf sname">' + esc(s.name) +
        '</span><div class="track"><i class="' + (full ? 'full' : '') + '" style="width:' + Math.round((m * 100) / total) + '%"></i></div></div>' +
        (full ? '<span class="done">' + icon('check', 18) + '</span>' : '<span class="muted small">' + m + '/' + total + '</span>') + '</button>';
    }).join('');
    $$('#slist .row').forEach((b) => { b.onclick = () => { const s = +b.dataset.s; go('practice', { s, a: firstUnmemorized(s) }); }; });
  };
  $$('#chips .chip').forEach((c) => { c.onclick = () => { filter = c.dataset.f; $('#q').value = ''; draw(); }; });
  $('#q').oninput = draw;
  draw();
}

function screenPractice(params) {
  const sura = QURAN[params.s - 1];
  if (!sura) { go('home', {}, true); return; }
  const rid = renderSeq;
  app.innerHTML = topBar('سورة ' + sura.name, true) + '<main class="wrap"><p class="muted center">جاري التحضير…</p></main>';
  initEngine().catch(() => {});
  getTimings(reciterId(profile())).then((T) => { if (rid === renderSeq) buildPractice(params, T, rid); });
}

function buildPractice(params, T, rid) {
  const s = params.s;
  const sura = QURAN[s - 1];
  const mode = params.mode || 'learn';
  const a = Math.min(Math.max(1, params.a || 1), sura.ayat.length);
  const p = profile();
  const kids = p.mode === 'kids';
  const alive = () => rid === renderSeq;
  const tokens = ayahTokens(s, a);
  const skel = tokens.map((t) => (t.c ? refSkeleton(t.plain) : ''));
  const row = T && T[s + ':' + a];
  const st0 = p.ayat[key(s, a)];
  const last = a === sura.ayat.length;
  const stages = mode === 'learn' ? buildStages(splitChunks(tokens, pausesFor(row, tokens))) : [{ from: 0, to: tokens.length - 1, kind: 'review' }];
  const stepsOf = (stg) => (stg.kind === 'learn' ? ['listen', 'read', 'memory'] : stg.kind === 'link' ? ['listen', 'memory'] : ['memory']);
  let si = 0;
  if (mode === 'learn' && p.lastStage && p.lastStage.s === s && p.lastStage.a === a) si = Math.min(p.lastStage.si || 0, stages.length - 1);
  let step = stepsOf(stages[si])[0];
  let statuses = {};
  let busy = false;
  let playing = false;
  let listening = false;
  let finished = false;
  let lastScript = '';
  const times = p.repeat;
  if (mode === 'learn') { p.lastPos = { s, a }; save(); }
  const remaining = mode === 'review' ? dueList().filter((x) => !skipped.has(x.k)).length : 0;
  const title = mode === 'review' ? 'المراجعة' : 'سورة ' + sura.name;

  app.innerHTML = '<header class="top"><button class="ibtn" data-back aria-label="رجوع">' + icon('arrowRight') + '</button>' +
    '<div class="ttl center"><b class="qf">' + esc(title) + '</b><small id="sub"></small></div>' + brandMark(28) + '</header>' +
    '<main class="wrap">' + (stages.length > 1 ? '<div class="stagebar" id="stagebar">' + stages.map(() => '<i></i>').join('') + '</div>' : '') +
    '<div class="frame"><div class="frame-in q" id="ayah"></div></div>' +
    '<div class="steps" id="steps"></div><p class="status-line" id="statusLine"></p>' +
    '<div class="ctrls" id="ctrls"></div><div id="result"></div>' +
    '<details class="tafsir"><summary>' + icon('book', 16) + ' التفسير الميسر</summary><p id="tafsirText">جاري التحميل…</p></details></main>';
  getTafsir().then((tf) => {
    const el = $('#tafsirText');
    if (!el || !alive()) return;
    const txt = tf && tf[s - 1] && tf[s - 1][a - 1];
    el.textContent = txt || 'التفسير مش متاح في النسخة دي';
  });

  const stage = () => stages[si];
  const isWhole = () => stage().from === 0 && stage().to === tokens.length - 1;
  const unit = () => (isWhole() ? 'الآية' : 'المقطع');
  const listenTimes = () => (stage().kind === 'learn' ? times : Math.max(1, Math.ceil(times / 2)));
  const refIdx = () => { const r = []; for (let i = stage().from; i <= stage().to; i++) if (tokens[i].c) r.push(i); return r; };
  const setStatus = (t, live) => { const el = $('#statusLine'); if (el) { el.textContent = t; el.classList.toggle('live', !!live); } };
  const drawAyah = () => { $('#ayah').innerHTML = renderAyah(tokens, { from: stage().from, to: stage().to, hidden: step === 'memory', statuses, a }); };
  const keepHints = () => { const k = {}; Object.keys(statuses).forEach((i) => { if (statuses[i] === 'hint') k[i] = 'hint'; }); return k; };

  function highlight(i) {
    $$('#ayah .w.cur').forEach((x) => x.classList.remove('cur'));
    if (i >= 0) { const el = $('#ayah [data-i="' + i + '"]'); if (el) el.classList.add('cur'); }
  }

  function drawMeta() {
    const stg = stage();
    let sub;
    if (mode === 'learn') sub = 'آية ' + arDigits(a) + (stages.length > 1 ? ' · المرحلة ' + arDigits(si + 1) + ' من ' + arDigits(stages.length) + (stg.kind === 'link' ? ' · ربط' : stg.kind === 'full' ? ' · الآية كاملة' : '') : '');
    else if (mode === 'review') sub = 'سورة ' + sura.name + ' · آية ' + arDigits(a) + ' · باقي ' + arDigits(remaining);
    else sub = 'تسميع السورة · آية ' + arDigits(a) + ' من ' + arDigits(sura.ayat.length);
    $('#sub').textContent = sub;
    const bar = $('#stagebar');
    if (bar) Array.from(bar.children).forEach((x, i) => { x.className = i < si ? 'd' : i === si ? 'c' : ''; });
    const steps = stepsOf(stg);
    const idx = steps.indexOf(step);
    $('#steps').innerHTML = steps.length > 1 ? steps.map((x, i) => '<button data-step="' + x + '" class="' + (i === idx ? 'on' : i < idx ? 'ok' : '') + '">' + STEP_LABEL[x] + (i < idx ? ' ✓' : '') + '</button>').join('') : '';
    $$('#steps button').forEach((b) => { b.onclick = () => { if (busy) return; setStep(b.dataset.step, true); }; });
  }

  function defaultStatus() {
    if (step === 'listen') return 'استمع لـ' + unit() + ' ' + ayatTimes(listenTimes()) + '، أو دوس سمّع لو جاهز';
    if (step === 'read') return 'اقرأ ' + unit() + ' وانت شايف الكلمات';
    return 'اقرأ من الذاكرة، والكلمة هتظهر لما تقولها';
  }

  const btn = (id, ic, label, cls, dis) => '<div class="bt ' + (cls || '') + '"><button id="' + id + '" aria-label="' + label + '"' + (dis ? ' disabled' : '') + '>' + icon(ic, 19) + '</button><small id="' + id + 'Lbl">' + label + '</small></div>';

  function drawControls() {
    let html = '';
    if (mode === 'review') html += btn('aux', 'volume', 'استمع');
    else html += btn('prevA', 'chevronRight', 'السابقة', '', a === 1) + btn('play', 'play', 'استمع', 'play');
    html += btn('mic', listening ? 'pause' : 'mic', listening ? 'بسمعك' : 'سمّع', 'mic' + (listening ? ' listening' : ''));
    if (step === 'memory') html += btn('hint', 'bulb', 'مساعدة', 'hint');
    html += mode === 'review' ? btn('nextA', 'chevronLeft', finished ? 'التالي' : 'تخطي') : btn('nextA', 'chevronLeft', last ? 'إنهاء' : 'التالية');
    $('#ctrls').innerHTML = html;
    const pl = $('#play'); if (pl) pl.onclick = onListen;
    $('#mic').onclick = onMic;
    const prev = $('#prevA'); if (prev) prev.onclick = () => go('practice', { s, a: a - 1, mode }, true);
    $('#nextA').onclick = onNext;
    const aux = $('#aux'); if (aux) aux.onclick = onAux;
    const hint = $('#hint'); if (hint) hint.onclick = onHint;
  }

  function drawMic() {
    const wrap = $('#mic') && $('#mic').parentElement;
    if (!wrap) return;
    wrap.classList.toggle('listening', listening);
    $('#mic').innerHTML = icon(listening ? 'pause' : 'mic', 19);
    $('#micLbl').textContent = listening ? 'بسمعك' : 'سمّع';
  }

  function drawAll() { drawMeta(); drawAyah(); drawControls(); setStatus(defaultStatus()); }

  function setStep(x, manual) {
    stopListen(false);
    stopAudio();
    statuses = {};
    step = x;
    finished = false;
    $('#result').innerHTML = '';
    drawAll();
    if (manual && x !== 'listen') setTimeout(() => { if (alive() && step === x) startListen(); }, 300);
  }

  function onNext() {
    stopListen(false);
    if (mode === 'review') { if (!finished) skipped.add(key(s, a)); go('review', {}, true); return; }
    if (!last) go('practice', { s, a: a + 1, mode }, true);
    else { toast('ما شاء الله، خلّصت سورة ' + sura.name); goBack(); }
  }

  async function onAux() {
    if (busy) return;
    const was = listening;
    stopListen(false);
    await playRepeat(s, a, clipFor(row, tokens, 0, tokens.length - 1), 1, highlight, () => {});
    highlight(-1);
    if (was && alive() && !finished) startListen();
  }

  function onHint() {
    const ti = refIdx().find((i) => !statuses[i] || statuses[i] === 'pending');
    if (ti === undefined) return;
    statuses[ti] = 'hint';
    drawAyah();
    checkComplete();
  }

  async function onListen() {
    if (busy) return;
    const b = $('#play');
    if (playing) { stopAudio(); return; }
    const wasListen = step === 'listen';
    const resume = listening;
    stopListen(false);
    playing = true;
    const n = wasListen ? listenTimes() : 1;
    b.classList.add('playing');
    b.innerHTML = icon('pause', 19);
    const stg = stage();
    const ok = await playRepeat(s, a, clipFor(row, tokens, stg.from, stg.to), n, highlight, (k) => { const l = $('#playLbl'); if (l) l.textContent = n > 1 ? arDigits(k) + ' من ' + arDigits(n) : 'بيشتغل'; });
    playing = false;
    if (!b.isConnected) return;
    highlight(-1);
    b.classList.remove('playing');
    b.innerHTML = icon('play', 19);
    const l = $('#playLbl'); if (l) l.textContent = 'استمع';
    if (ok && wasListen && step === 'listen') {
      const steps = stepsOf(stage());
      const nx = steps[steps.indexOf('listen') + 1];
      if (nx) setTimeout(() => { if (alive() && step === 'listen' && !playing) { setStep(nx); startListen(); } }, 500);
    } else if (resume && step !== 'listen' && !finished) {
      startListen();
    }
  }

  async function onMic() {
    if (busy) return;
    if (listening) { stopListen(true); return; }
    if (step === 'listen') {
      const steps = stepsOf(stage());
      setStep(steps[steps.indexOf('listen') + 1] || 'memory');
    }
    startListen();
  }

  async function startListen() {
    if (listening || busy || step === 'listen' || step === 'done' || !alive()) return;
    busy = true;
    if (!isReady()) setStatus('بجهّز المصحح…');
    try {
      await initEngine();
    } catch (e) {
      busy = false;
      setStatus('تعذر تشغيل المصحح على الموبايل ده');
      showError(e);
      return;
    }
    busy = false;
    if (!alive() || step === 'listen' || step === 'done') return;
    stopAudio();
    statuses = keepHints();
    finished = false;
    lastScript = '';
    $('#result').innerHTML = '';
    drawAyah();
    try {
      await startListening(onScript);
    } catch (e) {
      setStatus(defaultStatus());
      toast('محتاجين إذن المايك عشان نسمع التلاوة');
      return;
    }
    if (!alive()) { stopListening(); return; }
    listening = true;
    drawMic();
    setStatus(step === 'read' ? 'بسمعك… الكلمات بتنوّر وانت بتقرأ' : 'كمّل… الكلمة بتظهر أول ما تقولها صح', true);
  }

  function onScript(script) {
    if (!listening || !alive()) return;
    lastScript = script;
    const ref = refIdx();
    const res = alignWords(ref.map((i) => skel[i]), heardSkeleton(script), false);
    let changed = false;
    ref.forEach((ti, k) => {
      const r = res[k];
      if (!r.done) return;
      const st = r.ratio >= 0.7 ? 'ok' : r.ratio >= 0.5 ? 'near' : null;
      if (st && statuses[ti] !== 'ok' && statuses[ti] !== 'hint' && statuses[ti] !== st) { statuses[ti] = st; changed = true; }
    });
    if (changed) drawAyah();
    checkComplete();
  }

  function checkComplete() {
    if (!listening) return;
    const ref = refIdx();
    if (ref.every((ti) => statuses[ti] && statuses[ti] !== 'pending')) {
      stopListen(false);
      evaluate();
    }
  }

  async function stopListen(final) {
    if (!listening) return;
    listening = false;
    stopListening();
    drawMic();
    if (!final) return;
    busy = true;
    setStatus('لحظة…');
    const sc = await inferNow();
    busy = false;
    if (!alive()) return;
    if (sc) lastScript = sc;
    const ref = refIdx();
    const res = alignWords(ref.map((i) => skel[i]), heardSkeleton(lastScript), true);
    ref.forEach((ti, k) => {
      if (statuses[ti] === 'ok' || statuses[ti] === 'hint') return;
      const r = res[k].ratio;
      statuses[ti] = r >= 0.7 ? 'ok' : r >= 0.45 ? 'near' : r > 0 ? 'bad' : 'miss';
    });
    evaluate();
  }

  function evaluate() {
    const ref = refIdx();
    let pts = 0;
    ref.forEach((ti) => {
      const x = statuses[ti];
      if (x === 'ok') pts += 1;
      else if (x === 'near') pts += 0.75;
      else if (x === 'hint') pts += 0.5;
      else if (!x || x === 'pending') statuses[ti] = 'miss';
    });
    const score = ref.length ? Math.round((pts * 100) / ref.length) : 0;
    const pass = score >= passMark(p);
    drawAyah();
    if (mode === 'learn') {
      if (pass) { stepPassed(score); return; }
      const canListen = stepsOf(stage()).includes('listen');
      $('#result').innerHTML = resultCard(false, score, statuses, ref,
        '<button class="primary" id="again">جرّب تاني</button>' + (canListen ? '<button class="light-btn" id="hear">اسمع ' + unit() + ' تاني</button>' : ''));
      $('#again').onclick = () => { $('#result').innerHTML = ''; startListen(); };
      const hr = $('#hear'); if (hr) hr.onclick = () => setStep('listen');
      setStatus(kids ? 'قربت! جرّب تاني' : 'راجع الكلمات الملونة وجرّب تاني');
      return;
    }
    applyResult(s, a, score, mode === 'review' || !!(st0 && st0.lvl >= 1));
    finished = true;
    $('#result').innerHTML = resultCard(pass, score, statuses, ref, pass ? '' : '<button class="primary" id="again">جرّب تاني</button>');
    const ag = $('#again'); if (ag) ag.onclick = () => { $('#result').innerHTML = ''; finished = false; drawControls(); startListen(); };
    drawControls();
    setStatus(pass ? (kids ? pick(PRAISE) : 'أحسنت') : (kids ? 'قربت!' : 'راجع الكلمات الملونة'));
    if (pass) setTimeout(() => { if (alive() && finished) onNext(); }, 1500);
  }

  function stepPassed(score) {
    const steps = stepsOf(stage());
    const idx = steps.indexOf(step);
    setStatus(kids ? pick(PRAISE) : 'أحسنت');
    if (idx < steps.length - 1) {
      setTimeout(() => { if (!alive()) return; setStep(steps[idx + 1]); startListen(); }, 900);
      return;
    }
    if (si < stages.length - 1) {
      setTimeout(() => {
        if (!alive()) return;
        si++;
        p.lastStage = { s, a, si };
        save();
        const first = stepsOf(stage())[0];
        setStep(first);
        toast(stage().kind === 'learn' ? 'المقطع التالي' : stage().kind === 'link' ? 'نربط المقاطع مع بعض' : 'دلوقتي الآية كاملة');
        if (first === 'listen') setTimeout(() => { if (alive() && step === 'listen') onListen(); }, 600);
        else startListen();
      }, 1000);
      return;
    }
    p.lastStage = null;
    applyResult(s, a, score, false);
    showComplete(score);
  }

  function showComplete(score) {
    step = 'done';
    statuses = {};
    tokens.forEach((t, i) => { if (t.c) statuses[i] = 'ok'; });
    $('#ayah').innerHTML = renderAyah(tokens, { from: 0, to: tokens.length - 1, hidden: false, statuses, a });
    const bar = $('#stagebar');
    if (bar) Array.from(bar.children).forEach((x) => { x.className = 'd'; });
    $('#steps').innerHTML = '';
    $('#ctrls').innerHTML = '';
    setStatus('');
    $('#result').innerHTML = '<div class="result pass"><div class="score">' + score + '%</div><b>' + (kids ? 'ما شاء الله! حفظت الآية' : 'حفظت الآية كاملة') + '</b>' +
      '<small>هترجعلك للمراجعة بكرة</small><button class="primary" id="nextAy">' + (last ? 'خلّصت السورة' : 'الآية التالية') + '</button>' +
      '<button class="light-btn" id="acts">أنشطة على الآية</button>' +
      (a > 1 ? '<button class="link-btn" id="prevAy">الآية السابقة</button>' : '') + '</div>';
    $('#acts').onclick = () => go('game', { s, a, kind: 'arrange', chain: true });
    $('#nextAy').onclick = onNext;
    const pv = $('#prevAy'); if (pv) pv.onclick = () => go('practice', { s, a: a - 1, mode }, true);
  }

  drawAll();
  if (mode !== 'learn') setTimeout(() => { if (alive()) startListen(); }, 500);
}

function screenReviewHub() {
  const p = profile();
  const due = dueList().length;
  const mistakes = Object.entries(p.mistakes).sort((x, y) => y[1] - x[1]).slice(0, 30);
  app.innerHTML = topBar('المراجعة', false) + '<main class="wrap">' +
    (due
      ? '<section class="wird"><div class="wird-in"><div class="wird-top"><span>مراجعة اليوم</span><span>' + arDigits(due) + '</span></div><b>' + ayatWord(due) + ' مستحقة</b><p>كل آية بترجعلك في وقتها قبل ما تنساها</p><button class="gold-btn" id="start">ابدأ المراجعة</button></div></section>'
      : '<div class="card empty">' + icon('sparkle', 34) + '<b>مفيش مراجعة النهارده</b><p class="muted small">الآيات اللي بتحفظها بترجعلك هنا بعد يوم، ثم 3، ثم أسبوع، وهكذا.</p></div>') +
    divider() + '<div class="section-title">أخطائي</div>' +
    (mistakes.length
      ? mistakes.map(([k, c]) => {
        const [s, a] = k.split(':').map(Number);
        const sura = QURAN[s - 1];
        const words = ayahTokens(s, a).filter((t) => t.c).slice(0, 5).map((t) => t.plain).join(' ');
        return '<button class="row" data-s="' + s + '" data-a="' + a + '"><span class="count">' + c + '</span><div class="grow"><b class="qf">' + esc(sura.name) + ' · آية ' + arDigits(a) +
          '</b><small>' + esc(words) + '…</small></div>' + icon('chevronLeft', 18) + '</button>';
      }).join('') + '<button class="light-btn" id="clearM">مسح سجل الأخطاء</button>'
      : '<div class="card center muted small">الآيات اللي بتغلط فيها هتظهر هنا عشان تركّز عليها.</div>') +
    '</main>' + navBar('reviewHub');
  const start = $('#start'); if (start) start.onclick = () => { skipped.clear(); go('review'); };
  $$('[data-s]').forEach((b) => { b.onclick = () => go('practice', { s: +b.dataset.s, a: +b.dataset.a }); });
  const clear = $('#clearM'); if (clear) clear.onclick = () => { if (confirm('مسح سجل الأخطاء؟')) { p.mistakes = {}; save(); render(history.state); } };
}

function screenReview() {
  const list = dueList().filter((x) => !skipped.has(x.k));
  if (!list.length) {
    const hadSkips = skipped.size > 0;
    skipped.clear();
    app.innerHTML = topBar('المراجعة', true) + '<main class="wrap"><div class="card empty">' + icon('sparkle', 38) + '<b>' +
      (hadSkips ? 'خلّصت المراجعة المتاحة' : 'خلّصت مراجعة النهارده') +
      '</b><p class="muted small">ارجع بكرة، أو احفظ آيات جديدة.</p><button class="primary" data-back>رجوع</button></div></main>';
    return;
  }
  screenPractice({ s: list[0].s, a: list[0].a, mode: 'review' });
}

function screenActivities() {
  const p = profile();
  const base = p.mode === 'kids' ? QURAN.slice().reverse() : QURAN;
  const list = base.map((s) => ({ s, m: memCount(s.n) })).filter((x) => x.m > 0);
  app.innerHTML = topBar('أنشطة', false) + '<main class="wrap"><p class="muted small">الأنشطة بتتفتح على الآيات اللي حفظتها، عشان تثبّتها.</p>' +
    (list.length
      ? list.map((x) => '<button class="row" data-s="' + x.s.n + '">' + starBadge(x.s.n, x.m === x.s.ayat.length) + '<div class="grow"><span class="qf sname">' + esc(x.s.name) +
        '</span><small>محفوظ ' + x.m + ' من ' + x.s.ayat.length + '</small></div>' + icon('chevronLeft', 18) + '</button>').join('')
      : '<div class="card empty">' + icon('lock', 34) + '<b>لسه مفيش أنشطة مفتوحة</b><p class="muted small">احفظ أول آية، والأنشطة هتتفتح عليها.</p><button class="primary" id="goSurahs">ابدأ الحفظ</button></div>') +
    '</main>' + navBar('activities');
  $$('[data-s]').forEach((b) => { b.onclick = () => go('surahActs', { s: +b.dataset.s }); });
  const gs = $('#goSurahs'); if (gs) gs.onclick = () => tab('surahs');
}

function screenSurahActs(params) {
  const s = params.s;
  const sura = QURAN[s - 1];
  if (!sura) { go('home', {}, true); return; }
  const mem = memorizedAyat(s);
  const connectOk = mem.filter((a) => ayahTokens(s, a).filter((t) => t.c).length >= 2).length >= 3;
  const card = (kind, ic, title, sub, locked) => '<button class="row' + (locked ? ' locked' : '') + '" data-kind="' + kind + '"' + (locked ? ' data-locked="1"' : '') + '><span class="act-ic">' +
    icon(locked ? 'lock' : ic, 22) + '</span><div class="grow"><b>' + title + '</b><small>' + sub + '</small></div>' + icon('chevronLeft', 18) + '</button>';
  app.innerHTML = topBar('أنشطة سورة ' + sura.name, true) + '<main class="wrap"><p class="muted small">محفوظ ' + mem.length + ' من ' + sura.ayat.length + ' آية</p>' +
    card('arrange', 'shuffle', 'رتّب الآية', 'كلمات آية من محفوظك متلخبطة، رتّبها', !mem.length) +
    card('complete', 'pencil', 'أكمل الكلمة', 'اختار الكلمة الناقصة من الآية', !mem.length) +
    card('connect', 'link', 'وصّل', connectOk ? 'وصّل بداية كل آية بنهايتها' : 'محتاج 3 آيات محفوظة على الأقل', !connectOk) +
    card('recite', 'mic', 'سمّع السورة من الذاكرة', 'الكلمات بتظهر وانت بتسمّع آية ورا آية', false) + '</main>';
  $$('[data-kind]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.locked) { toast(b.dataset.kind === 'connect' ? 'احفظ 3 آيات من السورة الأول' : 'احفظ آيات من السورة الأول'); return; }
      if (b.dataset.kind === 'recite') go('practice', { s, a: 1, mode: 'recite' });
      else go('game', { s, kind: b.dataset.kind });
    };
  });
}

function screenGame(params) {
  const s = params.s;
  const sura = QURAN[s - 1];
  if (!sura) { go('home', {}, true); return; }
  if (params.kind === 'connect') { gameConnect(sura, s); return; }
  let a = params.a;
  if (!a) {
    const mem = memorizedAyat(s);
    if (!mem.length) { lockedScreen('أنشطة', 'احفظ آيات من سورة ' + sura.name + ' الأول، والأنشطة هتتفتح عليها'); return; }
    a = pick(mem);
  }
  const ws = ayahTokens(s, a).filter((t) => t.c);
  if (params.kind === 'complete') gameComplete(sura, s, a, ws, !!params.chain);
  else gameArrange(sura, s, a, ws, !!params.chain);
}

function gameArrange(sura, s, a, ws, chain) {
  let target = ws;
  if (ws.length > 9) {
    const start = Math.floor(Math.random() * (ws.length - 8));
    target = ws.slice(start, start + 8);
  }
  const chips = shuffle(target);
  let pos = 0;
  let errors = 0;
  app.innerHTML = topBar('رتّب الآية', true) + '<main class="wrap"><p class="muted small center">سورة ' + esc(sura.name) + ' · آية ' + arDigits(a) +
    (chain ? ' · نشاط ١ من ٢' : target.length < ws.length ? ' · جزء من الآية' : '') + '</p>' +
    '<div class="frame"><div class="frame-in q answer" id="answer"></div></div><div class="wchips">' +
    chips.map((w, j) => '<button class="wchip" data-j="' + j + '">' + w.html + '</button>').join('') +
    '</div><div id="result"></div><button class="light-btn" id="hint">اسمع الآية</button></main>';
  $$('.wchip').forEach((b) => {
    b.onclick = () => {
      if (pos >= target.length) return;
      const w = chips[+b.dataset.j];
      if (w.c === target[pos].c) {
        b.disabled = true;
        b.classList.add('used');
        $('#answer').insertAdjacentHTML('beforeend', '<span class="w">' + w.html + '</span> ');
        pos++;
        if (pos === target.length) finish();
      } else {
        errors++;
        b.classList.add('wrong');
        setTimeout(() => b.classList.remove('wrong'), 500);
      }
    };
  });
  function finish() {
    $('#result').innerHTML = '<div class="result pass"><b>' + (errors === 0 ? 'ممتاز، من غير ولا غلطة' : 'أحسنت، رتّبتها') + '</b>' +
      (errors ? '<div class="counts"><span class="miss">' + errors + ' محاولة غلط</span></div>' : '') +
      (chain ? '<button class="primary" id="nx">التالي: أكمل الكلمة</button>' : '<button class="primary" id="again">آية تانية</button>') + '</div>';
    const nx = $('#nx'); if (nx) nx.onclick = () => go('game', { s, a, kind: 'complete', chain: true }, true);
    const again = $('#again'); if (again) again.onclick = () => go('game', { s, kind: 'arrange' }, true);
  }
  $('#hint').onclick = async () => {
    const tokens = ayahTokens(s, a);
    const T = await getTimings(reciterId(profile()));
    playRepeat(s, a, clipFor(T && T[s + ':' + a], tokens, 0, tokens.length - 1), 1, () => {}, () => {});
  };
}

function gameComplete(sura, s, a, ws, chain) {
  const cand = ws.map((w, i) => i).filter((i) => ws[i].c.length >= 2);
  const mi = cand.length ? pick(cand) : 0;
  const answer = ws[mi];
  const pool = new Map();
  const addFrom = (ss) => {
    const len = QURAN[ss - 1].ayat.length;
    for (let ai = 1; ai <= len; ai++) {
      ayahTokens(ss, ai).forEach((w) => {
        if (w.c && w.c.length >= 2 && w.c !== answer.c && !pool.has(w.c)) pool.set(w.c, w);
      });
    }
  };
  addFrom(s);
  if (pool.size < 3) addFrom(s === 114 ? 113 : s + 1);
  if (pool.size < 3) addFrom(1);
  const options = shuffle([answer].concat(shuffle(Array.from(pool.values())).slice(0, 3)));
  app.innerHTML = topBar('أكمل الكلمة', true) + '<main class="wrap"><p class="muted small center">سورة ' + esc(sura.name) + ' · آية ' + arDigits(a) + (chain ? ' · نشاط ٢ من ٢' : '') + '</p>' +
    '<div class="frame"><div class="frame-in q answer">' + ws.map((w, i) => (i === mi ? '<span class="blank" style="width:3em"></span>' : '<span class="w">' + w.html + '</span>')).join(' ') + '</div></div>' +
    '<div class="opts">' + options.map((o, i) => '<button class="opt-btn" data-i="' + i + '">' + o.html + '</button>').join('') + '</div><div id="result"></div></main>';
  let answered = false;
  $$('.opt-btn').forEach((b) => {
    b.onclick = () => {
      if (answered) return;
      answered = true;
      const right = options[+b.dataset.i].c === answer.c;
      $$('.opt-btn').forEach((x) => { if (options[+x.dataset.i].c === answer.c) x.classList.add('right'); });
      if (!right) b.classList.add('wrong');
      const lastAyah = a === sura.ayat.length;
      $('#result').innerHTML = '<div class="result ' + (right ? 'pass' : 'fail') + '"><b>' + (right ? 'إجابة صح' : 'الإجابة الصح باللون الأخضر') + '</b>' +
        (chain ? '<button class="primary" id="nx">' + (lastAyah ? 'خلّصت السورة' : 'احفظ الآية التالية') + '</button>' : '<button class="primary" id="again">سؤال تاني</button>') + '</div>';
      const nx = $('#nx');
      if (nx) nx.onclick = () => { if (lastAyah) { toast('ما شاء الله، خلّصت سورة ' + sura.name); goBack(); } else go('practice', { s, a: a + 1 }, true); };
      const again = $('#again'); if (again) again.onclick = () => go('game', { s, kind: 'complete' }, true);
    };
  });
}

function gameConnect(sura, s) {
  const elig = memorizedAyat(s).filter((a) => ayahTokens(s, a).filter((t) => t.c).length >= 2);
  if (elig.length < 3) { lockedScreen('وصّل', 'محتاج تحفظ 3 آيات على الأقل من سورة ' + sura.name + ' عشان تلعب وصّل'); return; }
  const chosen = shuffle(elig).slice(0, 4).sort((x, y) => x - y);
  const pairs = chosen.map((a, k) => {
    const ws = ayahTokens(s, a).filter((t) => t.c);
    const half = Math.ceil(ws.length / 2);
    const start = ws.slice(0, Math.min(half, 5)).map((t) => t.plain).join(' ') + (half > 5 ? ' …' : '');
    const rest = ws.slice(half);
    const end = (rest.length > 5 ? '… ' : '') + rest.slice(-5).map((t) => t.plain).join(' ');
    return { k, a, start, end };
  });
  const ends = shuffle(pairs);
  let sel = -1;
  let done = 0;
  let errors = 0;
  app.innerHTML = topBar('وصّل', true) + '<main class="wrap"><p class="muted small center">اختار بداية الآية، وبعدين اختار نهايتها</p><div class="connect"><div class="col" id="starts">' +
    pairs.map((x) => '<button class="cbox" data-k="' + x.k + '">' + esc(x.start) + '</button>').join('') + '</div><div class="col" id="ends">' +
    ends.map((x) => '<button class="cbox" data-k="' + x.k + '">' + esc(x.end) + '</button>').join('') + '</div></div><div id="result"></div></main>';
  $$('#starts .cbox').forEach((b) => {
    b.onclick = () => {
      if (b.classList.contains('right')) return;
      sel = +b.dataset.k;
      $$('#starts .cbox').forEach((x) => x.classList.toggle('sel', x === b));
    };
  });
  $$('#ends .cbox').forEach((b) => {
    b.onclick = () => {
      if (b.classList.contains('right')) return;
      if (sel < 0) { toast('اختار البداية الأول'); return; }
      if (+b.dataset.k === sel) {
        b.classList.add('right');
        const sb = $('#starts .cbox[data-k="' + sel + '"]');
        if (sb) { sb.classList.remove('sel'); sb.classList.add('right'); }
        sel = -1;
        done++;
        if (done === pairs.length) finish();
      } else {
        errors++;
        b.classList.add('wrong');
        setTimeout(() => b.classList.remove('wrong'), 500);
      }
    };
  });
  function finish() {
    $('#result').innerHTML = '<div class="result pass"><b>' + (errors ? 'أحسنت، وصّلتهم كلهم' : 'ممتاز، من غير ولا غلطة') + '</b><button class="primary" id="again">جولة تانية</button></div>';
    $('#again').onclick = () => go('game', { s, kind: 'connect' }, true);
  }
}

function screenSettings() {
  const p = profile();
  const seg = (id, values, current, fmt) => '<div class="seg" id="' + id + '">' +
    values.map((v) => '<button data-v="' + v + '" class="' + (current === v ? 'on' : '') + '">' + (fmt ? fmt(v) : v) + '</button>').join('') + '</div>';
  app.innerHTML = topBar('الإعدادات', true) + '<main class="wrap">' +
    '<section class="card"><h2>وِرد اليوم (آيات جديدة)</h2>' + seg('goalSeg', GOALS, p.goal) + '</section>' +
    '<section class="card"><h2>عدد مرات الاستماع للمقطع</h2>' + seg('repSeg', REPEATS, p.repeat) + '</section>' +
    '<section class="card"><h2>القارئ</h2>' + RECITERS.map((r) =>
      '<label class="opt"><input type="radio" name="reciter" value="' + r.id + '" ' + (reciterId(p) === r.id ? 'checked' : '') + '> ' + r.name + '</label>').join('') + '</section>' +
    '<section class="card"><h2>ألوان التجويد</h2>' + seg('tjSeg', ['on', 'off'], p.tajweed === false ? 'off' : 'on', (v) => (v === 'on' ? 'ظاهرة' : 'مخفية')) +
    '<div class="legend">' + LEGEND.map(([cls, label]) => '<span><b class="dot" style="background:var(--' + cls + ')"></b>' + label + '</span>').join('') + '</div></section>' +
    '<section class="card"><h2>الوضع</h2>' + seg('modeSeg', ['adult', 'kids'], p.mode, (v) => (v === 'kids' ? 'طفل' : 'كبير')) +
    '<p class="muted small">نسبة النجاح في التسميع: ' + passMark(p) + '%</p></section>' +
    '<section class="card"><h2>مصحح التلاوة</h2><p class="muted small">شغال على الموبايل نفسه من غير إنترنت، وبيتابع قراءتك كلمة بكلمة. بيكتشف الكلمات الغلط والناقصة، ومش بديل عن الشيخ.</p></section>' +
    '<section class="card"><h2>الملف الشخصي</h2><button class="light-btn" id="switch">تغيير الملف</button>' +
    '<button class="danger-btn" id="del">حذف ملف ' + esc(p.name) + '</button></section></main>';
  $$('#goalSeg button').forEach((b) => { b.onclick = () => { p.goal = +b.dataset.v; save(); render(history.state); }; });
  $$('#repSeg button').forEach((b) => { b.onclick = () => { p.repeat = +b.dataset.v; save(); render(history.state); }; });
  $$('#tjSeg button').forEach((b) => { b.onclick = () => { p.tajweed = b.dataset.v === 'on'; save(); render(history.state); }; });
  $$('#modeSeg button').forEach((b) => { b.onclick = () => { p.mode = b.dataset.v; save(); render(history.state); }; });
  $$('input[name=reciter]').forEach((r) => { r.onchange = () => { p.reciter = r.value; save(); toast('تم تغيير القارئ'); }; });
  $('#switch').onclick = () => { db.current = null; save(); go('profiles', {}, true); };
  $('#del').onclick = () => {
    if (!confirm('حذف ملف ' + p.name + ' وكل تقدمه نهائيًا؟')) return;
    db.profiles = db.profiles.filter((x) => x.id !== p.id);
    db.current = null;
    save();
    go('profiles', {}, true);
  };
}

function go(screen, params = {}, replace = false) {
  const state = { screen, params, depth: replace ? curDepth() : curDepth() + 1 };
  if (replace) history.replaceState(state, '');
  else history.pushState(state, '');
  render(state);
}

function render(state) {
  renderSeq++;
  cleanup();
  const p = profile();
  document.body.classList.toggle('kids', !!p && p.mode === 'kids');
  document.body.classList.toggle('no-tj', !!p && p.tajweed === false);
  window.scrollTo(0, 0);
  const screen = state && state.screen;
  const params = (state && state.params) || {};
  if (!p) screenProfiles();
  else {
    switch (screen) {
      case 'profiles': screenProfiles(); break;
      case 'surahs': screenSurahs(); break;
      case 'practice': screenPractice(params); break;
      case 'reviewHub': screenReviewHub(); break;
      case 'review': screenReview(); break;
      case 'activities': screenActivities(); break;
      case 'surahActs': screenSurahActs(params); break;
      case 'game': screenGame(params); break;
      case 'settings': screenSettings(); break;
      default: screenHome();
    }
  }
  document.body.classList.toggle('has-nav', !!app.querySelector('.nav'));
}

async function init() {
  app.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { goBack(); return; }
    const t = e.target.closest('[data-tab]');
    if (t) tab(t.dataset.tab);
  });
  window.addEventListener('popstate', (e) => render(e.state));
  const CapApp = capPlugin('App');
  if (CapApp && CapApp.addListener) {
    try { CapApp.addListener('backButton', () => goBack()); } catch (e) { /* ignore */ }
  }
  try {
    const r = await fetch('data/quran.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    QURAN = await r.json();
  } catch (e) {
    app.innerHTML = '<div class="wrap center"><p>تعذر تحميل بيانات القرآن.</p></div>';
    return;
  }
  const prev = history.state && history.state.screen ? history.state : null;
  const state = prev ? Object.assign({ depth: 0 }, prev) : { screen: profile() ? 'home' : 'profiles', params: {}, depth: 0 };
  history.replaceState(state, '');
  render(state);
}

init();
