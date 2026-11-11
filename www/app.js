import { loadModel, isModelLoaded, startRecording, stopRecording, cancelRecording, transcribe, compare, normalize } from './recite.js';

const RECITERS = [
  { id: 'Minshawy_Murattal_128kbps', name: 'محمد صديق المنشاوي' },
  { id: 'Husary_128kbps', name: 'محمود خليل الحصري' },
  { id: 'Alafasy_128kbps', name: 'مشاري العفاسي' }
];
const REPEATS = [1, 3, 5, 7, 10];
const GOALS = [1, 3, 5, 10, 20];
const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120];
const HIDE_LABELS = ['ظاهرة', 'نصها', 'أول حرف', 'مخفية'];
const KEY = 'muddakir-data-v1';
const MODEL_FLAG = 'muddakir-model-ok';

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
  shuffle: 'M4 6h4l8 12h4 M4 18h4l2.5 -3.7 M13.5 9.7l2.5 -3.7h4 M18 4l2 2l-2 2 M18 16l2 2l-2 2',
  pencil: 'M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4 M13.5 6.5l4 4',
  notes: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z M9 7l6 0 M9 11l6 0 M9 15l4 0',
  sparkle: 'M12 3l2 5l5 2l-5 2l-2 5l-2 -5l-5 -2l5 -2z'
};

function icon(name, size = 22) {
  return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ICONS[name] + '"/></svg>';
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
const skipped = new Set();
const wordCache = new Map();

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

function newProfile(name, mode) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, mode,
    reciter: RECITERS[0].id,
    repeat: mode === 'kids' ? 5 : 3,
    goal: mode === 'kids' ? 3 : 5,
    daily: { d: '', n: 0 },
    attempts: 0, scoreSum: 0,
    lastPos: null,
    ayat: {}, mistakes: {}
  };
}

function ayahWords(s, a) {
  const k = key(s, a);
  if (!wordCache.has(k)) {
    wordCache.set(k, QURAN[s - 1].ayat[a - 1].split(' ').filter(Boolean).map((d) => ({ d, c: normalize(d) })));
  }
  return wordCache.get(k);
}

const firstLetter = (d) => d.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').charAt(0);

function memCount(s) {
  const p = profile();
  let n = 0;
  const len = QURAN[s - 1].ayat.length;
  for (let a = 1; a <= len; a++) {
    const st = p.ayat[key(s, a)];
    if (st && st.lvl >= 1) n++;
  }
  return n;
}

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
  return 'https://everyayah.com/data/' + profile().reciter + '/' + pad3(s) + pad3(a) + '.mp3';
}

function playOnce(url, token) {
  return new Promise((resolve) => {
    const au = new Audio(url);
    player = au;
    let finished = false;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      au.onended = null;
      au.onerror = null;
      if (pendingStop === stopper) pendingStop = null;
      resolve(ok);
    };
    const stopper = () => done(false);
    pendingStop = stopper;
    au.onended = () => done(true);
    au.onerror = () => {
      if (token === playToken) toast('تعذر تشغيل الصوت، اتأكد من الإنترنت');
      done(false);
    };
    au.play().catch(() => done(false));
  });
}

async function playRepeat(s, a, times, onStep) {
  stopAudio();
  const token = playToken;
  for (let i = 1; i <= times; i++) {
    if (token !== playToken) return false;
    onStep(i);
    const ok = await playOnce(audioUrl(s, a), token);
    if (!ok || token !== playToken) return false;
    if (i < times) await sleep(600);
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

function renderWords(ws, hide, statuses, a) {
  let si = 0;
  const body = ws.map((w) => {
    if (!w.c) return '<span class="mark">' + esc(w.d) + '</span>';
    const idx = si++;
    if (statuses) return '<span class="w ' + (statuses[idx] || '') + '">' + esc(w.d) + '</span>';
    if (hide === 3 || (hide === 1 && idx % 2 === 1)) {
      const width = Math.min(6, Math.max(1.4, w.c.length * 0.55));
      return '<span class="w"><span class="blank" style="width:' + width + 'em"></span></span>';
    }
    if (hide === 2) return '<span class="w">' + esc(firstLetter(w.d)) + '…</span>';
    return '<span class="w">' + esc(w.d) + '</span>';
  }).join(' ');
  return body + ' <span class="anum">﴿' + arDigits(a) + '﴾</span>';
}

function screenProfiles() {
  app.innerHTML = '<main class="wrap"><div class="hero-brand"><span class="brand">مُدَّكِر</span><small>﴿فَهَلْ مِن مُّدَّكِرٍ﴾</small></div>' +
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

function screenSurahs(params) {
  const p = profile();
  const forGame = params.for === 'game';
  let filter = p.mode === 'kids' ? 'amma' : 'all';
  const base = p.mode === 'kids' ? QURAN.slice().reverse() : QURAN;
  app.innerHTML = topBar(forGame ? 'اختار سورة للنشاط' : 'السور', forGame) + '<main class="wrap">' +
    '<div class="chips" id="chips"><button class="chip" data-f="amma">جزء عمّ</button><button class="chip" data-f="tabarak">جزء تبارك</button><button class="chip" data-f="all">الكل</button></div>' +
    '<input class="field" id="q" placeholder="ابحث عن سورة"><div id="slist"></div></main>' + (forGame ? '' : navBar('surahs'));
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
    $$('#slist .row-card').forEach((b) => {
      b.onclick = () => {
        const s = +b.dataset.s;
        if (forGame) go('game', { s, kind: params.kind });
        else go('practice', { s, a: firstUnmemorized(s) });
      };
    });
  };
  $$('#chips .chip').forEach((c) => { c.onclick = () => { filter = c.dataset.f; $('#q').value = ''; draw(); }; });
  $('#q').oninput = draw;
  draw();
}

function screenPractice(params) {
  const s = params.s;
  const sura = QURAN[s - 1];
  if (!sura) { go('home', {}, true); return; }
  const review = !!params.review;
  const a = Math.min(Math.max(1, params.a || 1), sura.ayat.length);
  const p = profile();
  const kids = p.mode === 'kids';
  const ws = ayahWords(s, a);
  const scored = ws.filter((w) => w.c).map((w) => w.c);
  const st = p.ayat[key(s, a)];
  const last = a === sura.ayat.length;
  const times = review ? 1 : p.repeat;
  let hide = review ? 3 : 0;
  let statuses = null;
  let resulted = false;
  if (!review) { p.lastPos = { s, a }; save(); }
  const remaining = review ? dueList().filter((x) => !skipped.has(x.k)).length : 0;
  const showDots = kids && !review;

  app.innerHTML = '<header class="top"><button class="ibtn" data-back aria-label="رجوع">' + icon('arrowRight') + '</button><div class="ttl"><b class="qf">' +
    (review ? 'المراجعة' : 'سورة ' + esc(sura.name)) + '</b><small>' +
    (review ? 'سورة ' + esc(sura.name) + ' · آية ' + a + ' · باقي ' + remaining : 'آية ' + a + ' من ' + sura.ayat.length) +
    '</small></div><button class="ibtn" id="opt" aria-label="الإعدادات">' + icon('sliders') + '</button></header><main class="wrap">' +
    '<div class="meta">' + (!review && a > 1 ? '<button class="link" id="prevA">' + icon('chevronRight', 16) + 'السابقة</button>' : '<span></span>') +
    (st && st.lvl >= 1 ? '<span class="done">' + icon('check', 16) + 'محفوظة</span>' : '') + '</div>' +
    '<div class="frame"><div class="frame-in ayah" id="ayah"></div></div>' +
    '<div class="pills" id="hideSeg">' + HIDE_LABELS.map((t, i) => '<button data-h="' + i + '" class="' + (i === hide ? 'on' : '') + '">' + t + '</button>').join('') + '</div>' +
    (showDots ? '<div class="dots" id="dots">' + Array.from({ length: times }, () => '<i></i>').join('') + '</div><div class="dots-lbl" id="dotsLbl">اسمع الآية ' + ayatTimes(times) + '</div>' : '') +
    '<div class="ctrls">' +
    '<div class="cbtn"><button class="circle listen" id="listen" aria-label="استمع">' + icon('volume') + '</button><small id="listenLbl">' + (review ? 'تلميح' : '×' + times) + '</small></div>' +
    '<div class="cbtn"><button class="circle mic" id="rec" aria-label="سمّع">' + icon('mic', 30) + '</button><small id="recLbl">سمّع</small></div>' +
    '<div class="cbtn"><button class="circle" id="next" aria-label="التالية">' + icon('arrowLeft') + '</button><small id="nextLbl">' + (review ? 'تخطي' : last ? 'إنهاء' : 'التالية') + '</small></div>' +
    '</div><div id="result"></div></main>';

  const draw = () => { $('#ayah').innerHTML = renderWords(ws, hide, statuses, a); };
  draw();

  const nextAyah = () => {
    if (!last) go('practice', { s, a: a + 1 }, true);
    else { toast('ما شاء الله، خلّصت سورة ' + sura.name); history.back(); }
  };

  $('#opt').onclick = () => go('settings');
  const prev = $('#prevA');
  if (prev) prev.onclick = () => go('practice', { s, a: a - 1 }, true);
  $('#next').onclick = () => {
    if (!review) { nextAyah(); return; }
    if (!resulted) skipped.add(key(s, a));
    go('review', {}, true);
  };

  $$('#hideSeg button').forEach((b) => {
    b.onclick = () => {
      hide = +b.dataset.h;
      statuses = null;
      $$('#hideSeg button').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    };
  });

  const listenBtn = $('#listen');
  const listenLbl = $('#listenLbl');
  let playing = false;
  const setDots = (n, playingNow) => {
    if (!showDots) return;
    $$('#dots i').forEach((d, i) => d.classList.toggle('on', i < n));
    $('#dotsLbl').textContent = playingNow ? 'بتسمعها مرة ' + n + ' من ' + times : 'سمعتها ' + ayatTimes(n) + '، جرّب تسمّع';
  };
  listenBtn.onclick = async () => {
    if (playing) { stopAudio(); return; }
    playing = true;
    listenBtn.classList.add('playing');
    let reached = 0;
    await playRepeat(s, a, times, (i) => {
      reached = i;
      listenLbl.textContent = 'إيقاف';
      setDots(i, true);
    });
    playing = false;
    if (!listenBtn.isConnected) return;
    listenBtn.classList.remove('playing');
    listenLbl.textContent = review ? 'تلميح' : '×' + times;
    if (reached) setDots(reached, false);
  };

  const recBtn = $('#rec');
  const recLbl = $('#recLbl');
  recBtn.onclick = async () => {
    if (recBtn.disabled) return;
    if (!recording) {
      try { await ensureModel(); } catch (e) { if (!e.cancel) showError(e); return; }
      if (!recBtn.isConnected) return;
      stopAudio();
      try { await startRecording(); } catch (e) { toast('محتاجين إذن المايك عشان نسمع التلاوة'); return; }
      recording = true;
      recBtn.classList.add('on');
      recBtn.innerHTML = icon('stop', 28);
      recLbl.textContent = 'خلصت';
      $('#result').innerHTML = '<p class="muted center">اقرأ الآية دلوقتي، ولما تخلص دوس خلصت</p>';
      return;
    }
    recording = false;
    recBtn.classList.remove('on');
    recBtn.innerHTML = icon('mic', 30);
    recBtn.disabled = true;
    recLbl.textContent = 'بنراجع…';
    $('#result').innerHTML = '<p class="muted center">بنراجع تلاوتك…</p>';
    try {
      const audio = await stopRecording();
      if (audio.length < 8000) { $('#result').innerHTML = '<p class="center">التسجيل قصير، جرّب تاني</p>'; return; }
      await sleep(60);
      const text = await transcribe(audio);
      if (!recBtn.isConnected) return;
      const res = compare(scored, text);
      statuses = res.statuses;
      draw();
      showResult(res);
    } catch (e) {
      showError(e);
      if (recBtn.isConnected) $('#result').innerHTML = '';
    } finally {
      if (recBtn.isConnected) { recBtn.disabled = false; recLbl.textContent = 'سمّع تاني'; }
    }
  };

  function showResult(res) {
    applyResult(s, a, res.score, review);
    resulted = true;
    const c = { ok: 0, near: 0, bad: 0, miss: 0 };
    res.statuses.forEach((x) => { c[x]++; });
    const pass = res.score >= passMark(p);
    const msg = pass
      ? (kids ? pick(['ممتاز! 🌟', 'برافو عليك! 👏', 'ما شاء الله! 🎉']) : 'أحسنت، الآية متقنة')
      : (kids ? 'قربت! جرّب تاني 💪' : 'راجع الكلمات الملونة وجرّب تاني');
    $('#result').innerHTML = '<div class="result ' + (pass ? 'pass' : 'fail') + '"><div class="score">' + res.score + '%</div><b>' + msg + '</b>' +
      '<div class="counts"><span class="ok">' + c.ok + ' صح</span>' + (c.near ? '<span class="near">' + c.near + ' قريبة</span>' : '') +
      (c.bad ? '<span class="bad">' + c.bad + ' غلط</span>' : '') + (c.miss ? '<span class="miss">' + c.miss + ' ناقصة</span>' : '') + '</div>' +
      '<details><summary>اللي اتسمع</summary><p>' + esc(res.heard || '—') + '</p></details></div>';
    if (review) $('#nextLbl').textContent = 'التالي';
    else if (pass) $('#next').classList.add('glow');
  }
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
        return '<button class="card row-card" data-s="' + s + '" data-a="' + a + '"><span class="count">' + c + '</span><div class="grow"><b class="qf">' + esc(sura.name) + ' · آية ' + a +
          '</b><small>' + esc(sura.ayat[a - 1].split(' ').slice(0, 6).join(' ')) + '…</small></div>' + icon('chevronLeft', 18) + '</button>';
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
  screenPractice({ s: list[0].s, a: list[0].a, review: true });
}

function screenActivities() {
  app.innerHTML = topBar('أنشطة', false) + '<main class="wrap">' +
    '<button class="card row-card" data-kind="arrange"><span class="act-ic">' + icon('shuffle', 24) + '</span><div class="grow"><b>رتّب الآية</b><small>كلمات الآية متلخبطة، رتّبها بالترتيب الصح</small></div>' + icon('chevronLeft', 18) + '</button>' +
    '<button class="card row-card" data-kind="complete"><span class="act-ic">' + icon('pencil', 24) + '</span><div class="grow"><b>أكمل الكلمة</b><small>اختار الكلمة الناقصة من الآية</small></div>' + icon('chevronLeft', 18) + '</button>' +
    '<p class="muted small center">النشاط بيختار من الآيات اللي حفظتها في السورة، ولو مفيش بيختار من السورة كلها.</p></main>' + navBar('activities');
  $$('[data-kind]').forEach((b) => { b.onclick = () => go('surahs', { for: 'game', kind: b.dataset.kind }); });
}

function pickAyah(s) {
  const sura = QURAN[s - 1];
  const p = profile();
  const mem = [];
  for (let a = 1; a <= sura.ayat.length; a++) {
    const st = p.ayat[key(s, a)];
    if (st && st.lvl >= 1) mem.push(a);
  }
  return pick(mem.length ? mem : Array.from({ length: sura.ayat.length }, (_, i) => i + 1));
}

function screenGame(params) {
  const s = params.s;
  const sura = QURAN[s - 1];
  if (!sura) { go('home', {}, true); return; }
  const a = pickAyah(s);
  const ws = ayahWords(s, a).filter((w) => w.c);
  if (params.kind === 'complete') gameComplete(sura, s, a, ws);
  else gameArrange(sura, s, a, ws);
}

function gameArrange(sura, s, a, ws) {
  let target = ws;
  if (ws.length > 9) {
    const start = Math.floor(Math.random() * (ws.length - 8));
    target = ws.slice(start, start + 8);
  }
  const chips = shuffle(target);
  let pos = 0;
  let errors = 0;
  app.innerHTML = topBar('رتّب الآية', true) + '<main class="wrap"><div class="meta"><span class="qf">سورة ' + esc(sura.name) + ' · آية ' + a + '</span>' +
    (target.length < ws.length ? '<span class="muted small">جزء من الآية</span>' : '') + '</div>' +
    '<div class="frame"><div class="frame-in answer" id="answer"></div></div><div class="wchips">' +
    chips.map((w, j) => '<button class="wchip" data-j="' + j + '">' + esc(w.d) + '</button>').join('') +
    '</div><div id="result"></div><button class="light-btn" id="hint">اسمع الآية</button></main>';
  $$('.wchip').forEach((b) => {
    b.onclick = () => {
      if (pos >= target.length) return;
      const w = chips[+b.dataset.j];
      if (w.c === target[pos].c) {
        b.disabled = true;
        b.classList.add('used');
        $('#answer').insertAdjacentHTML('beforeend', '<span class="w ok">' + esc(w.d) + '</span> ');
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
      '<button class="primary" id="again">آية تانية</button></div>';
    $('#again').onclick = () => go('game', { s, kind: 'arrange' }, true);
  }
  $('#hint').onclick = () => { playRepeat(s, a, 1, () => {}); };
}

function gameComplete(sura, s, a, ws) {
  const cand = ws.map((w, i) => i).filter((i) => ws[i].c.length >= 2);
  const mi = cand.length ? pick(cand) : 0;
  const answer = ws[mi];
  const pool = new Map();
  const addFrom = (ss) => {
    const len = QURAN[ss - 1].ayat.length;
    for (let ai = 1; ai <= len; ai++) {
      ayahWords(ss, ai).forEach((w) => {
        if (w.c && w.c.length >= 2 && w.c !== answer.c && !pool.has(w.c)) pool.set(w.c, w.d);
      });
    }
  };
  addFrom(s);
  if (pool.size < 3) addFrom(s === 114 ? 113 : s + 1);
  if (pool.size < 3) addFrom(1);
  const options = shuffle([answer.d].concat(shuffle(Array.from(pool.values())).slice(0, 3)));
  app.innerHTML = topBar('أكمل الكلمة', true) + '<main class="wrap"><div class="meta"><span class="qf">سورة ' + esc(sura.name) + ' · آية ' + a + '</span></div>' +
    '<div class="frame"><div class="frame-in answer">' + ws.map((w, i) => (i === mi ? '<span class="blank" style="width:3em"></span>' : esc(w.d))).join(' ') + '</div></div>' +
    '<div class="opts">' + options.map((o, i) => '<button class="opt-btn" data-i="' + i + '">' + esc(o) + '</button>').join('') + '</div>' +
    '<div id="result"></div></main>';
  let answered = false;
  $$('.opt-btn').forEach((b) => {
    b.onclick = () => {
      if (answered) return;
      answered = true;
      const right = options[+b.dataset.i] === answer.d;
      $$('.opt-btn').forEach((x) => { if (options[+x.dataset.i] === answer.d) x.classList.add('right'); });
      if (!right) b.classList.add('wrong');
      $('#result').innerHTML = '<div class="result ' + (right ? 'pass' : 'fail') + '"><b>' + (right ? 'إجابة صح' : 'الإجابة الصح باللون الأخضر') + '</b>' +
        '<button class="primary" id="again">سؤال تاني</button></div>';
      $('#again').onclick = () => go('game', { s, kind: 'complete' }, true);
    };
  });
}

function screenSettings() {
  const p = profile();
  const ready = !!localStorage.getItem(MODEL_FLAG);
  const seg = (id, values, current, fmt) => '<div class="seg" id="' + id + '">' +
    values.map((v) => '<button data-v="' + v + '" class="' + (current === v ? 'on' : '') + '">' + (fmt ? fmt(v) : v) + '</button>').join('') + '</div>';
  app.innerHTML = topBar('الإعدادات', true) + '<main class="wrap">' +
    '<section class="card"><h2>وِرد اليوم (آيات جديدة)</h2>' + seg('goalSeg', GOALS, p.goal) + '</section>' +
    '<section class="card"><h2>عدد مرات الاستماع</h2>' + seg('repSeg', REPEATS, p.repeat) + '</section>' +
    '<section class="card"><h2>القارئ</h2>' + RECITERS.map((r) =>
      '<label class="opt"><input type="radio" name="reciter" value="' + r.id + '" ' + (p.reciter === r.id ? 'checked' : '') + '> ' + r.name + '</label>').join('') + '</section>' +
    '<section class="card"><h2>الوضع</h2>' + seg('modeSeg', ['adult', 'kids'], p.mode, (v) => (v === 'kids' ? 'طفل' : 'كبير')) +
    '<p class="muted small">نسبة النجاح في التسميع: ' + passMark(p) + '%</p></section>' +
    '<section class="card"><h2>مصحح التلاوة</h2><p class="muted small">' + (ready ? 'متحمّل على الجهاز' : 'لسه ما اتحملش (حوالي 100 ميجا مرة واحدة)') + '</p>' +
    '<button class="light-btn" id="mload">' + (ready ? 'اختبار المصحح' : 'تحميل الآن') + '</button>' +
    '<p class="muted small">المصحح بيكتشف الكلمات الغلط والناقصة، لكنه مش بيحكم على أحكام التجويد زي المد والغنة.</p></section>' +
    '<section class="card"><h2>الملف الشخصي</h2><button class="light-btn" id="switch">تغيير الملف</button>' +
    '<button class="danger-btn" id="del">حذف ملف ' + esc(p.name) + '</button></section></main>';
  $$('#goalSeg button').forEach((b) => { b.onclick = () => { p.goal = +b.dataset.v; save(); render(history.state); }; });
  $$('#repSeg button').forEach((b) => { b.onclick = () => { p.repeat = +b.dataset.v; save(); render(history.state); }; });
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
  cleanup();
  const p = profile();
  document.body.classList.toggle('kids', !!p && p.mode === 'kids');
  window.scrollTo(0, 0);
  const screen = state && state.screen;
  const params = (state && state.params) || {};
  if (!p) screenProfiles();
  else {
    switch (screen) {
      case 'profiles': screenProfiles(); break;
      case 'surahs': screenSurahs(params); break;
      case 'practice': screenPractice(params); break;
      case 'reviewHub': screenReviewHub(); break;
      case 'review': screenReview(); break;
      case 'activities': screenActivities(); break;
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
