import { loadModel, isModelLoaded, startRecording, stopRecording, snapshot, cancelRecording, transcribe, compare, comparePartial } from './recite.js';
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
const PRAISE = ['ممتاز! 🌟', 'برافو عليك! 👏', 'ما شاء الله! 🎉'];
const KEY = 'muddakir-data-v1';
const MODEL_FLAG = 'muddakir-model-ok-v2';
const STAR = 'M880 512L772 619.7L772 772L619.7 772L512 880L404.3 772L252 772L252 619.7L144 512L252 404.3L252 252L404.3 252L512 144L619.7 252L772 252L772 404.3Z';

const ICONS = {
  home: 'M5 12l-2 0l9 -9l9 9l-2 0 M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7 M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6',
  book: 'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0 M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0 M3 6l0 13 M12 6l0 13 M21 6l0 13',
  refresh: 'M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4 M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4',
  puzzle: 'M4 7h3a1 1 0 0 0 1 -1v-1a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0 -1 1v3a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-1a2 2 0 0 0 -4 0v1a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h1a2 2 0 0 0 0 -4h-1a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1',
  mic: 'M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1 -6 0z M5 10a7 7 0 0 0 14 0 M8 21l8 0 M12 17l0 4',
  stop: 'M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z',
  volume: 'M15 8a5 5 0 0 1 0 8 M17.7 5a9 9 0 0 1 0 14 M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5',
  arrowRight: 'M5 12l14 0 M13 18l6 -6 M13 6l6 6',
  arrowLeft: 'M5 12l14 0 M5 12l6 6 M5 12l6 -6',
  chevronRight: 'M9 6l6 6l-6 6',
  chevronLeft: 'M15 6l-6 6l6 6',
  sliders: 'M4 8h4 M12 8h8 M10 6v4 M4 16h10 M18 16h2 M16 14v4',
  check: 'M5 12l5 5l10 -10',
  play: 'M7 4v16l13 -8z',
  pause: 'M6 5h4v14h-4z M14 5h4v14h-4z',
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
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 1024 1024" aria-hidden="true"><rect width="1024" height="1024" rx="230" fill="#1B3A33"/>' +
    '<g transform="translate(512 512) scale(0.95) translate(-512 -512)"><path d="' + STAR + '" fill="#234A41" stroke="#D9B26A" stroke-width="26" stroke-linejoin="round"/>' +
    '<path d="M512 640C452 605 385 600 335 615L335 480C385 465 452 470 512 500Z" fill="#F7F3EA"/><path d="M512 640C572 605 639 600 689 615L689 480C639 465 572 470 512 500Z" fill="#EDE3CC"/>' +
    '<path d="M512 500L512 640" stroke="#B8893B" stroke-width="8" stroke-linecap="round"/><g fill="none" stroke="#D9B26A" stroke-width="20" stroke-linecap="round">' +
    '<path d="M487 426.7A50 50 0 0 1 537 426.7"/><path d="M468 393.8A88 88 0 0 1 556 393.8"/><path d="M449 360.9A126 126 0 0 1 575 360.9"/></g></g></svg>';
}

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
let recording = false;
let renderSeq = 0;
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

function showModal(text) {
  document.getElementById('modalText').textContent = text;
  document.getElementById('modalBar').style.width = '0%';
  document.getElementById('modalPct').textContent = '';
  document.getElementById('modal').hidden = false;
}

function setModalProgress(pct) {
  document.getElementById('modalBar').style.width = pct + '%';
  document.getElementById('modalPct').textContent = pct + '%';
}

function hideModal() {
  document.getElementById('modal').hidden = true;
}

function showError(e) {
  console.error(e);
  toast((e && e.message) || 'حصلت مشكلة، جرّب تاني');
}

async function ensureModel() {
  if (isModelLoaded()) return;
  const first = !localStorage.getItem(MODEL_FLAG);
  if (first && !confirm('أول مرة هيتحمل مصحح التلاوة (حوالي 100 ميجا) مرة واحدة بس، ومحتاج إنترنت. يُفضّل تكون على Wi-Fi.\n\nنبدأ التحميل؟')) {
    const err = new Error('cancel');
    err.cancel = true;
    throw err;
  }
  showModal(first ? 'بنحمّل مصحح التلاوة...' : 'بنجهّز مصحح التلاوة...');
  try {
    await loadModel(setModalProgress);
    localStorage.setItem(MODEL_FLAG, '1');
  } catch (e) {
    console.error(e);
    throw new Error(navigator.onLine ? 'تعذر تجهيز المصحح، جرّب تاني' : 'محتاج إنترنت عشان تحمّل المصحح أول مرة');
  } finally {
    hideModal();
  }
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

async function clipFor(s, a, tokens, from, to) {
  const T = await getTimings(reciterId(profile()));
  const row = T && T[s + ':' + a];
  const full = from === 0 && to === tokens.length - 1;
  if (row) {
    const n = row[0];
    const starts = row.slice(1, 1 + n);
    const end = row[1 + n];
    const map = (i) => (n === tokens.length ? i : Math.min(n - 1, Math.round((i * n) / tokens.length)));
    const words = [];
    for (let i = from; i <= to; i++) if (tokens[i].c) words.push({ i, t: starts[map(i)] / 1000 });
    const ei = map(to);
    const startS = full ? 0 : Math.max(0, starts[map(from)] / 1000 - 0.05);
    const endS = (ei + 1 < n && !full ? starts[ei + 1] : end) / 1000 + 0.15;
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
  if (recording) { cancelRecording(); recording = false; }
}

function topBar(title, back) {
  return '<header class="top">' + (back ? '<button class="ibtn" data-back aria-label="رجوع">' + icon('arrowRight') + '</button>' : '') +
    '<h1>' + esc(title) + '</h1></header>';
}

function navBar(active) {
  const items = [['home', 'home', 'الرئيسية'], ['surahs', 'book', 'السور'], ['reviewHub', 'refresh', 'المراجعة'], ['activities', 'puzzle', 'أنشطة']];
  return '<nav class="nav">' + items.map(([id, ic, label]) =>
    '<button data-tab="' + id + '" class="' + (id === active ? 'on' : '') + '">' + icon(ic) + label + '</button>').join('') + '</nav>';
}

function tab(target) {
  const cur = (history.state && history.state.screen) || 'home';
  if (target === cur) return;
  if (target === 'home') { history.back(); return; }
  go(target, {}, cur !== 'home');
}

function ctl(id, ic, label, disabled) {
  return '<div class="cbtn"><button class="circle" id="' + id + '" ' + (disabled ? 'disabled' : '') + ' aria-label="' + label + '">' + icon(ic) + '</button><small>' + label + '</small></div>';
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

function resultCard(pass, score, statuses, ref, heard, extra) {
  const c = { ok: 0, near: 0, bad: 0, miss: 0, hint: 0 };
  ref.forEach((ti) => { const x = statuses[ti]; if (c[x] !== undefined) c[x]++; });
  return '<div class="result ' + (pass ? 'pass' : 'fail') + '"><div class="score">' + score + '%</div>' +
    '<div class="counts"><span class="ok">' + c.ok + ' صح</span>' + (c.near ? '<span class="near">' + c.near + ' قريبة</span>' : '') +
    (c.bad ? '<span class="bad">' + c.bad + ' غلط</span>' : '') + (c.miss ? '<span class="miss">' + c.miss + ' ناقصة</span>' : '') +
    (c.hint ? '<span class="gold">' + c.hint + ' مساعدة</span>' : '') + '</div>' +
    (heard ? '<details><summary>اللي اتسمع</summary><p>' + esc(heard) + '</p></details>' : '') + (extra || '') + '</div>';
}

function lockedScreen(title, msg) {
  app.innerHTML = topBar(title, true) + '<main class="wrap"><div class="card center empty">' + icon('lock', 36) + '<b>' + esc(msg) + '</b>' +
    '<button class="primary" data-back>رجوع</button></div></main>';
}

function screenProfiles() {
  app.innerHTML = '<main class="wrap"><div class="hero-brand">' + brandMark(84) + '<span class="brand">مُدَّكِر</span><small>﴿فَهَلْ مِن مُّدَّكِرٍ﴾</small></div>' +
    (db.profiles.length ? '<div class="profiles">' + db.profiles.map((p) =>
      '<button class="card prof" data-id="' + p.id + '"><span class="initial' + (p.mode === 'kids' ? ' kid' : '') + '">' + esc(p.name.charAt(0)) + '</span><b>' + esc(p.name) +
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
  const ratio = Math.min(1, done / goal);
  const C = 150.8;
  const left = goal - done;
  const pos = p.lastPos && QURAN[p.lastPos.s - 1] ? p.lastPos : null;
  const accuracy = p.attempts ? Math.round(p.scoreSum / p.attempts) + '%' : '—';
  const hello = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  app.innerHTML = '<header class="top"><div class="hello grow"><small>' + hello + '</small><b>' + esc(p.name) + '</b></div>' +
    '<span class="brand">مُدَّكِر</span><button class="ibtn" id="settings" aria-label="الإعدادات">' + icon('sliders') + '</button></header><main class="wrap">' +
    '<button class="card goal row-card" id="goal"><svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true"><circle class="ring-bg" cx="31" cy="31" r="24" fill="none" stroke-width="5"/>' +
    '<circle class="ring-fg" cx="31" cy="31" r="24" fill="none" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - ratio)).toFixed(1) + '" transform="rotate(-90 31 31)"/>' +
    '<text class="ring-txt" x="31" y="36" text-anchor="middle">' + Math.min(done, goal) + '/' + goal + '</text></svg>' +
    '<div class="grow"><small>وِرد اليوم</small><b class="qf">' + (pos ? 'سورة ' + esc(QURAN[pos.s - 1].name) : 'ابدأ وِردك') + '</b><span>' +
    (left > 0 ? 'باقي ' + ayatWord(left) + ' على هدفك' : 'خلّصت وِرد النهارده، ما شاء الله') + '</span></div></button>' +
    '<button class="card row-card" id="cont"><span class="gold">' + icon('play') + '</span><div class="grow"><b>' + (pos ? 'كمّل الحفظ' : 'ابدأ الحفظ') + '</b><small>' +
    (pos ? esc(QURAN[pos.s - 1].name) + ' · آية ' + pos.a : 'اختار سورة وابدأ') + '</small></div>' + icon('chevronLeft', 18) + '</button>' +
    '<button class="card row-card" id="rev"><span class="gold">' + icon('refresh') + '</span><div class="grow"><b>مراجعة اليوم</b><small>' +
    (due ? ayatWord(due) + ' مستحقة' : 'مفيش مراجعة النهارده') + '</small></div>' + icon('chevronLeft', 18) + '</button>' +
    '<div class="stats"><div class="card stat"><b>' + mem + '</b><small>آية محفوظة</small></div><div class="card stat"><b>' + accuracy + '</b><small>دقة التسميع</small></div></div>' +
    '</main>' + navBar('home');
  const cont = () => { if (pos) go('practice', { s: pos.s, a: pos.a }); else tab('surahs'); };
  $('#goal').onclick = cont;
  $('#cont').onclick = cont;
  $('#rev').onclick = () => tab('reviewHub');
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
      return '<button class="card row-card" data-s="' + s.n + '"><span class="badge' + (full ? ' full' : '') + '"><span>' + s.n + '</span></span><div class="grow"><span class="qf sname">' + esc(s.name) +
        '</span><div class="track"><i class="' + (full ? 'full' : '') + '" style="width:' + Math.round((m * 100) / total) + '%"></i></div></div>' +
        (full ? '<span class="done">' + icon('check', 18) + '</span>' : '<span class="muted small">' + m + '/' + total + '</span>') + '</button>';
    }).join('');
    $$('#slist .row-card').forEach((b) => { b.onclick = () => { const s = +b.dataset.s; go('practice', { s, a: firstUnmemorized(s) }); }; });
  };
  $$('#chips .chip').forEach((c) => { c.onclick = () => { filter = c.dataset.f; $('#q').value = ''; draw(); }; });
  $('#q').oninput = draw;
  draw();
}

function screenPractice(params) {
  const s = params.s;
  const sura = QURAN[s - 1];
  if (!sura) { go('home', {}, true); return; }
  const mode = params.mode || 'learn';
  const a = Math.min(Math.max(1, params.a || 1), sura.ayat.length);
  const p = profile();
  const kids = p.mode === 'kids';
  const rid = renderSeq;
  const alive = () => rid === renderSeq;
  const tokens = ayahTokens(s, a);
  const st0 = p.ayat[key(s, a)];
  const last = a === sura.ayat.length;
  const stages = mode === 'learn' ? buildStages(splitChunks(tokens)) : [{ from: 0, to: tokens.length - 1, kind: 'review' }];
  const stepsOf = (stg) => (stg.kind === 'learn' ? ['listen', 'read', 'memory'] : stg.kind === 'link' ? ['listen', 'memory'] : ['memory']);
  let si = 0;
  if (mode === 'learn' && p.lastStage && p.lastStage.s === s && p.lastStage.a === a) si = Math.min(p.lastStage.si || 0, stages.length - 1);
  let step = stepsOf(stages[si])[0];
  let statuses = {};
  let busy = false;
  let playing = false;
  let finished = false;
  let recToken = 0;
  const times = p.repeat;
  if (mode === 'learn') { p.lastPos = { s, a }; save(); }
  getTimings(reciterId(p));
  const remaining = mode === 'review' ? dueList().filter((x) => !skipped.has(x.k)).length : 0;
  const title = mode === 'review' ? 'المراجعة' : 'سورة ' + sura.name;
  const sub = mode === 'review' ? 'سورة ' + sura.name + ' · آية ' + a + ' · باقي ' + remaining : 'آية ' + a + ' من ' + sura.ayat.length;

  app.innerHTML = '<header class="top"><button class="ibtn" data-back aria-label="رجوع">' + icon('arrowRight') + '</button><div class="ttl"><b class="qf">' + esc(title) +
    '</b><small>' + esc(sub) + '</small></div><button class="ibtn" id="opt" aria-label="الإعدادات">' + icon('sliders') + '</button></header>' +
    '<main class="wrap"><div class="meta" id="meta"></div>' +
    (stages.length > 1 ? '<div class="stagebar" id="stagebar">' + stages.map(() => '<i></i>').join('') + '</div>' : '') +
    '<div class="frame"><div class="frame-in q" id="ayah"></div></div>' +
    '<div class="steps" id="steps"></div><p class="status-line" id="statusLine"></p>' +
    '<div class="ctrls" id="ctrls"></div><div id="extra"></div><div id="result"></div></main>';
  $('#opt').onclick = () => go('settings');

  const stage = () => stages[si];
  const unit = () => (stages.length > 1 && stage().kind !== 'review' && !(stage().from === 0 && stage().to === tokens.length - 1) ? 'المقطع' : 'الآية');
  const listenTimes = () => (stage().kind === 'learn' ? times : Math.max(1, Math.ceil(times / 2)));
  const refIdx = () => { const r = []; for (let i = stage().from; i <= stage().to; i++) if (tokens[i].c) r.push(i); return r; };
  const setStatus = (t) => { const el = $('#statusLine'); if (el) el.textContent = t; };
  const setLbl = (t) => { const el = $('#mainLbl'); if (el) el.textContent = t; };
  const drawAyah = () => { $('#ayah').innerHTML = renderAyah(tokens, { from: stage().from, to: stage().to, hidden: step === 'memory', statuses, a }); };

  function highlight(i) {
    $$('#ayah .w.cur').forEach((x) => x.classList.remove('cur'));
    if (i >= 0) { const el = $('#ayah [data-i="' + i + '"]'); if (el) el.classList.add('cur'); }
  }

  function drawMeta() {
    const stg = stage();
    let label;
    if (mode === 'learn') label = stages.length > 1 ? 'المرحلة ' + (si + 1) + ' من ' + stages.length + ' · ' + (stg.kind === 'learn' ? 'مقطع جديد' : stg.kind === 'link' ? 'ربط المقاطع' : 'الآية كاملة') : 'الآية كاملة';
    else label = mode === 'review' ? 'سمّع من الذاكرة' : 'تسميع السورة';
    $('#meta').innerHTML = '<span class="muted">' + label + '</span>' + (st0 && st0.lvl >= 1 ? '<span class="done">' + icon('check', 16) + 'محفوظة</span>' : '');
    const bar = $('#stagebar');
    if (bar) Array.from(bar.children).forEach((x, i) => { x.className = i < si ? 'd' : i === si ? 'c' : ''; });
    const steps = stepsOf(stg);
    const idx = steps.indexOf(step);
    $('#steps').innerHTML = steps.length > 1 ? steps.map((x, i) => '<button data-step="' + x + '" class="' + (i === idx ? 'on' : i < idx ? 'ok' : '') + '">' + arDigits(i + 1) + ' ' + STEP_LABEL[x] + '</button>').join('') : '';
    $$('#steps button').forEach((b) => { b.onclick = () => { if (recording || busy) return; setStep(b.dataset.step); }; });
  }

  function defaultStatus() {
    if (step === 'listen') return 'استمع لـ' + unit() + ' ' + ayatTimes(listenTimes()) + ' وركّز في الكلمات';
    if (step === 'read') return 'اقرأ ' + unit() + ' وانت شايف الكلمات';
    return 'اقرأ من الذاكرة، والكلمة هتظهر لما تقولها';
  }

  function drawControls() {
    const isListen = step === 'listen';
    const left = mode === 'review' ? ctl('aux', 'volume', 'اسمع', false) : ctl('prevA', 'chevronRight', 'السابقة', a === 1);
    const right = mode === 'review' ? ctl('nextA', 'arrowLeft', finished ? 'التالي' : 'تخطي', false) : ctl('nextA', 'chevronLeft', last ? 'إنهاء' : 'التالية', false);
    const center = '<div class="cbtn"><button class="circle ' + (isListen ? 'play' : 'mic') + '" id="main" aria-label="' + (isListen ? 'استمع' : 'سمّع') + '">' + icon(isListen ? 'play' : 'mic', 30) +
      '</button><small id="mainLbl">' + (isListen ? 'استمع ×' + listenTimes() : step === 'read' ? 'اقرأ' : 'سمّع') + '</small></div>';
    $('#ctrls').innerHTML = left + center + right;
    $('#extra').innerHTML = step === 'memory' ? '<button class="hint-btn" id="hint">' + icon('bulb', 16) + 'كلمة مساعدة</button>' : '';
    $('#main').onclick = isListen ? onListen : onMic;
    const prev = $('#prevA');
    if (prev) prev.onclick = () => go('practice', { s, a: a - 1, mode }, true);
    $('#nextA').onclick = onNext;
    const aux = $('#aux');
    if (aux) aux.onclick = onAux;
    const hint = $('#hint');
    if (hint) hint.onclick = onHint;
  }

  function drawAll() { drawMeta(); drawAyah(); drawControls(); setStatus(defaultStatus()); }

  function setStep(x) {
    stopAudio();
    statuses = {};
    step = x;
    finished = false;
    $('#result').innerHTML = '';
    drawAll();
  }

  function onNext() {
    if (recording) cancelAndReset();
    if (mode === 'review') { if (!finished) skipped.add(key(s, a)); go('review', {}, true); return; }
    if (!last) go('practice', { s, a: a + 1, mode }, true);
    else { toast('ما شاء الله، خلّصت سورة ' + sura.name); history.back(); }
  }

  function cancelAndReset() {
    cancelRecording();
    recording = false;
    recToken++;
  }

  async function onAux() {
    if (recording || busy) return;
    const clip = await clipFor(s, a, tokens, 0, tokens.length - 1);
    await playRepeat(s, a, clip, 1, highlight, () => {});
    highlight(-1);
  }

  function onHint() {
    const ti = refIdx().find((i) => !statuses[i] || statuses[i] === 'pending');
    if (ti === undefined) return;
    statuses[ti] = 'hint';
    drawAyah();
  }

  async function onListen() {
    const btn = $('#main');
    if (playing) { stopAudio(); return; }
    playing = true;
    btn.classList.add('playing');
    btn.innerHTML = icon('pause', 30);
    const stg = stage();
    const n = listenTimes();
    const clip = await clipFor(s, a, tokens, stg.from, stg.to);
    const ok = await playRepeat(s, a, clip, n, highlight, (k) => setLbl('مرة ' + k + ' من ' + n));
    playing = false;
    if (!btn.isConnected) return;
    highlight(-1);
    btn.classList.remove('playing');
    btn.innerHTML = icon('play', 30);
    setLbl('استمع ×' + n);
    if (ok) {
      const steps = stepsOf(stage());
      const nx = steps[steps.indexOf('listen') + 1];
      if (nx) {
        setStatus(nx === 'read' ? 'دلوقتي اقرأ ' + unit() : 'دلوقتي سمّعه من الذاكرة');
        setTimeout(() => { if (alive() && step === 'listen' && !playing) setStep(nx); }, 700);
      }
    }
  }

  async function onMic() {
    if (busy) return;
    if (recording) { finishRecording(false); return; }
    try { await ensureModel(); } catch (e) { if (!e.cancel) showError(e); return; }
    if (!alive()) return;
    stopAudio();
    try { await startRecording(); } catch (e) { toast('محتاجين إذن المايك عشان نسمع التلاوة'); return; }
    if (!alive()) { cancelRecording(); return; }
    recording = true;
    statuses = {};
    finished = false;
    $('#result').innerHTML = '';
    drawAyah();
    const btn = $('#main');
    btn.classList.add('on');
    btn.innerHTML = icon('stop', 28);
    setLbl('خلصت');
    setStatus(step === 'read' ? 'اقرأ دلوقتي، والكلمات هتنوّر وانت بتقرأ' : 'سمّع دلوقتي، والكلمة هتظهر لما تقولها');
    live(++recToken);
  }

  async function live(tk) {
    const ref = refIdx();
    const refC = ref.map((i) => tokens[i].c);
    const started = Date.now();
    while (recording && tk === recToken && alive()) {
      await sleep(300);
      if (!recording || tk !== recToken || !alive()) return;
      if (Date.now() - started > 120000) { finishRecording(false); return; }
      let audio = null;
      try { audio = await snapshot(); } catch (e) { audio = null; }
      if (!audio || audio.length < 12000) continue;
      let text = '';
      try { text = await transcribe(audio); } catch (e) { continue; }
      if (!recording || tk !== recToken || !alive()) return;
      const r = comparePartial(refC, text);
      let changed = false;
      ref.forEach((ti, k) => {
        const x = r.statuses[k];
        if ((x === 'ok' || x === 'near') && statuses[ti] !== 'ok' && statuses[ti] !== 'hint' && statuses[ti] !== x) { statuses[ti] = x; changed = true; }
      });
      if (changed) drawAyah();
      if (ref.every((ti) => statuses[ti])) { finishRecording(true); return; }
    }
  }

  async function finishRecording(auto) {
    if (!recording) return;
    recording = false;
    recToken++;
    busy = true;
    const btn = $('#main');
    if (btn) { btn.classList.remove('on'); btn.innerHTML = icon('mic', 30); btn.disabled = true; }
    setLbl('بنراجع…');
    let heard = '';
    let ok = true;
    try {
      if (auto) {
        try { await stopRecording(); } catch (e) { /* ignore */ }
      } else {
        const audio = await stopRecording();
        if (!audio || audio.length < 8000) {
          ok = false;
          setStatus('التسجيل قصير، جرّب تاني');
        } else {
          setStatus('بنراجع تلاوتك…');
          const text = await transcribe(audio);
          const ref = refIdx();
          const r = compare(ref.map((i) => tokens[i].c), text);
          heard = r.heard;
          ref.forEach((ti, k) => { if (statuses[ti] === 'ok' || statuses[ti] === 'hint') return; statuses[ti] = r.statuses[k]; });
        }
      }
    } catch (e) {
      ok = false;
      showError(e);
    }
    busy = false;
    if (!alive()) return;
    const b = $('#main');
    if (b) b.disabled = false;
    setLbl(step === 'read' ? 'اقرأ تاني' : 'سمّع تاني');
    if (ok) evaluate(heard);
  }

  function evaluate(heard) {
    const ref = refIdx();
    let pts = 0;
    ref.forEach((ti) => {
      const x = statuses[ti];
      if (x === 'ok') pts += 1;
      else if (x === 'near' || x === 'hint') pts += 0.5;
      else if (!x || x === 'pending') statuses[ti] = 'miss';
    });
    const score = ref.length ? Math.round((pts * 100) / ref.length) : 0;
    const pass = score >= passMark(p);
    drawAyah();
    if (mode === 'learn') {
      if (pass) { stepPassed(score); return; }
      const canListen = stepsOf(stage()).includes('listen');
      $('#result').innerHTML = resultCard(false, score, statuses, ref, heard, canListen ? '<button class="light-btn" id="again">اسمع ' + unit() + ' تاني</button>' : '');
      const ag = $('#again');
      if (ag) ag.onclick = () => setStep('listen');
      setStatus(kids ? 'قربت! جرّب تاني 💪' : 'راجع الكلمات الملونة وجرّب تاني');
      return;
    }
    applyResult(s, a, score, mode === 'review' || !!(st0 && st0.lvl >= 1));
    finished = true;
    $('#result').innerHTML = resultCard(pass, score, statuses, ref, heard, '');
    drawControls();
    setStatus(pass ? (kids ? pick(PRAISE) : 'أحسنت') : (kids ? 'قربت! 💪' : 'راجع الكلمات الملونة'));
    if (mode === 'recite' && pass) setTimeout(() => { if (alive() && !recording) onNext(); }, 1400);
  }

  function stepPassed(score) {
    const steps = stepsOf(stage());
    const idx = steps.indexOf(step);
    setStatus(kids ? pick(PRAISE) : 'أحسنت');
    if (idx < steps.length - 1) {
      setTimeout(() => { if (alive() && !recording) setStep(steps[idx + 1]); }, 900);
      return;
    }
    if (si < stages.length - 1) {
      setTimeout(() => {
        if (!alive() || recording) return;
        si++;
        p.lastStage = { s, a, si };
        save();
        setStep(stepsOf(stage())[0]);
        toast(stage().kind === 'learn' ? 'المقطع التالي' : stage().kind === 'link' ? 'نربط المقاطع مع بعض' : 'دلوقتي الآية كاملة');
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
    si = stages.length - 1;
    $('#ayah').innerHTML = renderAyah(tokens, { from: 0, to: tokens.length - 1, hidden: false, statuses, a });
    const bar = $('#stagebar');
    if (bar) Array.from(bar.children).forEach((x) => { x.className = 'd'; });
    $('#steps').innerHTML = '';
    $('#extra').innerHTML = '';
    $('#ctrls').innerHTML = '';
    $('#meta').innerHTML = '<span class="done">' + icon('check', 16) + 'محفوظة</span>';
    setStatus('');
    $('#result').innerHTML = '<div class="result pass"><div class="score">' + score + '%</div><b>' + (kids ? 'ما شاء الله! حفظت الآية 🎉' : 'حفظت الآية كاملة') + '</b>' +
      '<small>هترجعلك للمراجعة بكرة</small><button class="primary" id="acts">أنشطة على الآية</button>' +
      '<button class="light-btn" id="nextAy">' + (last ? 'خلّصت السورة' : 'الآية التالية') + '</button>' +
      (a > 1 ? '<button class="center-link" id="prevAy">الآية السابقة</button>' : '') + '</div>';
    $('#acts').onclick = () => go('game', { s, a, kind: 'arrange', chain: true });
    $('#nextAy').onclick = onNext;
    const pv = $('#prevAy');
    if (pv) pv.onclick = () => go('practice', { s, a: a - 1, mode }, true);
  }

  drawAll();
}

function screenReviewHub() {
  const p = profile();
  const due = dueList().length;
  const mistakes = Object.entries(p.mistakes).sort((x, y) => y[1] - x[1]).slice(0, 30);
  app.innerHTML = topBar('المراجعة', false) + '<main class="wrap">' +
    (due
      ? '<section class="card goal row-card"><span>' + icon('refresh', 30) + '</span><div class="grow"><small>مراجعة اليوم</small><b>' + ayatWord(due) + ' مستحقة</b><span>كل آية بترجعلك في وقتها قبل ما تنساها</span></div></section><button class="primary" id="start">ابدأ المراجعة</button>'
      : '<div class="card center empty">' + icon('sparkle', 36) + '<b>مفيش مراجعة النهارده</b><p class="muted small">الآيات اللي بتحفظها بترجعلك هنا بعد يوم، ثم 3، ثم أسبوع، وهكذا.</p></div>') +
    '<div class="section-title">أخطائي</div>' +
    (mistakes.length
      ? mistakes.map(([k, c]) => {
        const [s, a] = k.split(':').map(Number);
        const sura = QURAN[s - 1];
        const words = ayahTokens(s, a).filter((t) => t.c).slice(0, 5).map((t) => t.plain).join(' ');
        return '<button class="card row-card" data-s="' + s + '" data-a="' + a + '"><span class="count">' + c + '</span><div class="grow"><b class="qf">' + esc(sura.name) + ' · آية ' + a +
          '</b><small>' + esc(words) + '…</small></div>' + icon('chevronLeft', 18) + '</button>';
      }).join('') + '<button class="light-btn" id="clearM">مسح سجل الأخطاء</button>'
      : '<div class="card center muted small">الآيات اللي بتغلط فيها هتظهر هنا عشان تركّز عليها.</div>') +
    '</main>' + navBar('reviewHub');
  const start = $('#start');
  if (start) start.onclick = () => { skipped.clear(); go('review'); };
  $$('[data-s]').forEach((b) => { b.onclick = () => go('practice', { s: +b.dataset.s, a: +b.dataset.a }); });
  const clear = $('#clearM');
  if (clear) clear.onclick = () => { if (confirm('مسح سجل الأخطاء؟')) { p.mistakes = {}; save(); render(history.state); } };
}

function screenReview() {
  const list = dueList().filter((x) => !skipped.has(x.k));
  if (!list.length) {
    const hadSkips = skipped.size > 0;
    skipped.clear();
    app.innerHTML = topBar('المراجعة', true) + '<main class="wrap"><div class="card center empty">' + icon('sparkle', 40) + '<b>' +
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
      ? list.map((x) => '<button class="card row-card" data-s="' + x.s.n + '"><span class="badge"><span>' + x.s.n + '</span></span><div class="grow"><span class="qf sname">' + esc(x.s.name) +
        '</span><small>محفوظ ' + x.m + ' من ' + x.s.ayat.length + '</small></div>' + icon('chevronLeft', 18) + '</button>').join('')
      : '<div class="card center empty">' + icon('lock', 36) + '<b>لسه مفيش أنشطة مفتوحة</b><p class="muted small">احفظ أول آية، والأنشطة هتتفتح عليها.</p><button class="primary" id="goSurahs">ابدأ الحفظ</button></div>') +
    '</main>' + navBar('activities');
  $$('[data-s]').forEach((b) => { b.onclick = () => go('surahActs', { s: +b.dataset.s }); });
  const gs = $('#goSurahs');
  if (gs) gs.onclick = () => tab('surahs');
}

function screenSurahActs(params) {
  const s = params.s;
  const sura = QURAN[s - 1];
  if (!sura) { go('home', {}, true); return; }
  const mem = memorizedAyat(s);
  const connectOk = mem.filter((a) => ayahTokens(s, a).filter((t) => t.c).length >= 2).length >= 3;
  const card = (kind, ic, title, sub, locked) => '<button class="card row-card' + (locked ? ' locked' : '') + '" data-kind="' + kind + '"' + (locked ? ' data-locked="1"' : '') + '><span class="act-ic">' +
    icon(locked ? 'lock' : ic, 24) + '</span><div class="grow"><b>' + title + '</b><small>' + sub + '</small></div>' + icon('chevronLeft', 18) + '</button>';
  app.innerHTML = topBar('أنشطة سورة ' + sura.name, true) + '<main class="wrap"><p class="muted small">محفوظ ' + mem.length + ' من ' + sura.ayat.length + ' آية</p>' +
    card('arrange', 'shuffle', 'رتّب الآية', 'كلمات آية من محفوظك متلخبطة، رتّبها', !mem.length) +
    card('complete', 'pencil', 'أكمل الكلمة', 'اختار الكلمة الناقصة من الآية', !mem.length) +
    card('connect', 'link', 'وصّل', connectOk ? 'وصّل بداية كل آية بنهايتها' : 'محتاج 3 آيات محفوظة على الأقل', !connectOk) +
    card('recite', 'mic', 'سمّع السورة من الذاكرة', 'الكلمات بتظهر وانت بتسمّع آية ورا آية', false) +
    '</main>';
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
  app.innerHTML = topBar('رتّب الآية', true) + '<main class="wrap"><div class="meta"><span class="qf">سورة ' + esc(sura.name) + ' · آية ' + a + '</span>' +
    (chain ? '<span class="muted small">نشاط ١ من ٢</span>' : target.length < ws.length ? '<span class="muted small">جزء من الآية</span>' : '') + '</div>' +
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
    const nx = $('#nx');
    if (nx) nx.onclick = () => go('game', { s, a, kind: 'complete', chain: true }, true);
    const again = $('#again');
    if (again) again.onclick = () => go('game', { s, kind: 'arrange' }, true);
  }
  $('#hint').onclick = async () => {
    const tokens = ayahTokens(s, a);
    const clip = await clipFor(s, a, tokens, 0, tokens.length - 1);
    playRepeat(s, a, clip, 1, () => {}, () => {});
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
  app.innerHTML = topBar('أكمل الكلمة', true) + '<main class="wrap"><div class="meta"><span class="qf">سورة ' + esc(sura.name) + ' · آية ' + a + '</span>' +
    (chain ? '<span class="muted small">نشاط ٢ من ٢</span>' : '') + '</div>' +
    '<div class="frame"><div class="frame-in q answer">' + ws.map((w, i) => (i === mi ? '<span class="blank" style="width:3em"></span>' : '<span class="w">' + w.html + '</span>')).join(' ') + '</div></div>' +
    '<div class="opts">' + options.map((o, i) => '<button class="opt-btn" data-i="' + i + '">' + o.html + '</button>').join('') + '</div>' +
    '<div id="result"></div></main>';
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
      if (nx) nx.onclick = () => { if (lastAyah) { toast('ما شاء الله، خلّصت سورة ' + sura.name); history.back(); } else go('practice', { s, a: a + 1 }, true); };
      const again = $('#again');
      if (again) again.onclick = () => go('game', { s, kind: 'complete' }, true);
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
  const ready = !!localStorage.getItem(MODEL_FLAG);
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
    '<section class="card"><h2>مصحح التلاوة</h2><p class="muted small">' + (ready ? 'متحمّل على الجهاز' : 'لسه ما اتحملش (حوالي 100 ميجا مرة واحدة)') + '</p>' +
    '<button class="light-btn" id="mload">' + (ready ? 'اختبار المصحح' : 'تحميل الآن') + '</button>' +
    '<p class="muted small">المصحح بيكتشف الكلمات الغلط والناقصة، لكنه مش بيحكم على أحكام التجويد زي المد والغنة.</p></section>' +
    '<section class="card"><h2>الملف الشخصي</h2><button class="light-btn" id="switch">تغيير الملف</button>' +
    '<button class="danger-btn" id="del">حذف ملف ' + esc(p.name) + '</button></section></main>';
  $$('#goalSeg button').forEach((b) => { b.onclick = () => { p.goal = +b.dataset.v; save(); render(history.state); }; });
  $$('#repSeg button').forEach((b) => { b.onclick = () => { p.repeat = +b.dataset.v; save(); render(history.state); }; });
  $$('#tjSeg button').forEach((b) => { b.onclick = () => { p.tajweed = b.dataset.v === 'on'; save(); render(history.state); }; });
  $$('#modeSeg button').forEach((b) => { b.onclick = () => { p.mode = b.dataset.v; save(); render(history.state); }; });
  $$('input[name=reciter]').forEach((r) => { r.onchange = () => { p.reciter = r.value; save(); toast('تم تغيير القارئ'); }; });
  $('#mload').onclick = async () => {
    try { await ensureModel(); toast('المصحح جاهز'); render(history.state); } catch (e) { if (!e.cancel) showError(e); }
  };
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
  const state = { screen, params };
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
    if (e.target.closest('[data-back]')) { history.back(); return; }
    const t = e.target.closest('[data-tab]');
    if (t) tab(t.dataset.tab);
  });
  window.addEventListener('popstate', (e) => render(e.state));
  try {
    const r = await fetch('data/quran.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    QURAN = await r.json();
  } catch (e) {
    app.innerHTML = '<div class="wrap center"><p>تعذر تحميل بيانات القرآن.</p></div>';
    return;
  }
  const state = history.state && history.state.screen ? history.state : { screen: profile() ? 'home' : 'profiles', params: {} };
  history.replaceState(state, '');
  render(state);
}

init();
