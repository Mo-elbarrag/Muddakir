import { initEngine, isReady, startListening, stopListening, inferNow } from './recite.js';
import { refSkeleton, heardSkeleton, alignWords } from './words.js';
import { parseAyah, splitChunks, buildStages, meaningSegment, chunksFromCuts, LEGEND } from './quran.js';

const RECITERS = [
  { id: 'husary', name: 'محمود خليل الحصري', ea: 'Husary_128kbps' },
  { id: 'minshawi', name: 'محمد صديق المنشاوي', ea: 'Minshawy_Murattal_128kbps' }
];
const REPEATS = [1, 3, 5, 7, 10];
const GOALS = [1, 3, 5, 10, 20];
const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120];
const STEP_LABEL = { listen: 'استمع', read: 'اقرأ', memory: 'من الذاكرة' };
const PRAISE = ['بارك الله فيك', 'ما شاء الله، أحسنت', 'جزاك الله خيرًا', 'زادك الله علمًا'];
const KEY = 'muddakir-data-v1';
const STAR = 'M880 512L772 619.7L772 772L619.7 772L512 880L404.3 772L252 772L252 619.7L144 512L252 404.3L252 252L404.3 252L512 144L619.7 252L772 252L772 404.3Z';
const STAR8 = 'M12 2l2.9 4.1L20 4l-2.1 5.1L22 12l-4.1 2.9L20 20l-5.1-2.1L12 22l-2.9-4.1L4 20l2.1-5.1L2 12l4.1-2.9L4 4l5.1 2.1z';
const QUIZ = {
  arrange: { title: 'رتّب الكلمات', icon: 'shuffle', desc: 'رتّب كلمات الآية لحد علامة الوقف' },
  complete: { title: 'أكمل الكلمة', icon: 'pencil', desc: 'اختار الكلمة الناقصة' },
  nextWord: { title: 'إيه الكلمة الجاية؟', icon: 'chevronLeft', desc: 'كمّل الآية بالكلمة الصحيحة' },
  nextAyah: { title: 'إيه الآية الجاية؟', icon: 'arrowLeft', desc: 'اختار الآية اللي بعدها' },
  order: { title: 'رتّب الآيات', icon: 'list', desc: 'رتّب الآيات بالترتيب الصحيح' },
  connect: { title: 'وصّل', icon: 'link', desc: 'وصّل بداية كل آية بنهايتها' },
  similar: { title: 'المتشابهات', icon: 'search', desc: 'فرّق بين الآيات اللي بدايتها واحدة' }
};
const MILESTONES = [
  { id: 'ayah1', title: 'أول آية', desc: 'بداية الطريق', test: (s) => s.mem >= 1 },
  { id: 'ayah10', title: '١٠ آيات', desc: 'حفظت ١٠ آيات', test: (s) => s.mem >= 10 },
  { id: 'ayah50', title: '٥٠ آية', desc: 'حفظت ٥٠ آية', test: (s) => s.mem >= 50 },
  { id: 'ayah100', title: '١٠٠ آية', desc: 'حفظت ١٠٠ آية', test: (s) => s.mem >= 100 },
  { id: 'ayah300', title: '٣٠٠ آية', desc: 'حفظت ٣٠٠ آية', test: (s) => s.mem >= 300 },
  { id: 'surah1', title: 'أول سورة', desc: 'أتممت حفظ أول سورة', test: (s) => s.full.length >= 1 },
  { id: 'week', title: 'أسبوع متواصل', desc: '٧ أيام متتالية', test: (s) => s.streak >= 7 },
  { id: 'amma', title: 'جزء عمّ', desc: 'أتممت حفظ جزء عمّ', test: (s) => s.amma }
];
const REMINDER_MSGS = [
  'السلام عليكم ورحمة الله يا {name}، حان موعد وِردك من كتاب الله',
  '﴿وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ﴾ هيا إلى وِردك',
  'قال ﷺ: «خيركم من تعلّم القرآن وعلّمه»، أكمل حفظك بارك الله فيك',
  'قال ﷺ: «الماهر بالقرآن مع السفرة الكرام البررة»',
  'آياتك تنتظر المراجعة، ثبّتك الله على حفظ كتابه',
  'قال ﷺ: «اقرؤوا القرآن فإنه يأتي يوم القيامة شفيعًا لأصحابه»',
  'وِرد قليل دائم خير من كثير منقطع، أعانك الله يا {name}'
];
const PLAN_NAMES = { none: 'من غير خطة', amma: 'جزء عمّ', tabarak: 'جزء تبارك', all: 'القرآن كاملًا' };

const ICONS = {
  home: 'M5 12l-2 0l9 -9l9 9l-2 0 M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7 M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6',
  book: 'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0 M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0 M3 6l0 13 M12 6l0 13 M21 6l0 13',
  refresh: 'M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4 M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4',
  puzzle: 'M4 7h3a1 1 0 0 0 1 -1v-1a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0 -1 1v3a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-1a2 2 0 0 0 -4 0v1a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h1a2 2 0 0 0 0 -4h-1a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1',
  mic: 'M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1 -6 0z M5 10a7 7 0 0 0 14 0 M8 21l8 0 M12 17l0 4',
  pause: 'M6 5h4v14h-4z M14 5h4v14h-4z',
  arrowRight: 'M5 12l14 0 M13 18l6 -6 M13 6l6 6',
  arrowLeft: 'M5 12l14 0 M5 12l6 6 M5 12l6 -6',
  chevronRight: 'M9 6l6 6l-6 6',
  chevronLeft: 'M15 6l-6 6l6 6',
  sliders: 'M4 8h4 M12 8h8 M10 6v4 M4 16h10 M18 16h2 M16 14v4',
  check: 'M5 12l5 5l10 -10',
  play: 'M7 4v16l13 -8z',
  volume: 'M15 8a5 5 0 0 1 0 8 M17.7 5a9 9 0 0 1 0 14 M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5',
  shuffle: 'M4 6h4l8 12h4 M4 18h4l2.5 -3.7 M13.5 9.7l2.5 -3.7h4 M18 4l2 2l-2 2 M18 16l2 2l-2 2',
  pencil: 'M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4 M13.5 6.5l4 4',
  link: 'M9 15l6 -6 M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464 M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463',
  lock: 'M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0 M8 11v-4a4 4 0 1 1 8 0v4',
  bulb: 'M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7 M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3 M9.7 17l4.6 0',
  sparkle: 'M12 3l2 5l5 2l-5 2l-2 5l-2 -5l-5 -2l5 -2z',
  search: 'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M21 21l-6 -6',
  list: 'M9 6l11 0 M9 12l11 0 M9 18l11 0 M5 6l0 .01 M5 12l0 .01 M5 18l0 .01'
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

const medal = (size, on) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR8 + '" fill="' + (on ? '#C7A55A' : 'none') + '" stroke="' + (on ? '#9C7E3A' : '#B9B2A2') + '" stroke-width="1.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="4.2" fill="' + (on ? '#1C2B45' : 'none') + '" stroke="' + (on ? '#E2CB8E' : '#B9B2A2') + '" stroke-width="1"/></svg>';
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
const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };

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

const defaultSettings = () => ({ theme: 'auto', reminder: { on: false, time: '20:00' } });

let QURAN = [];
let db = loadDb();
let renderSeq = 0;
let tafsirData;
let simData;
const skipped = new Set();
const tokenCache = new Map();
const recitCache = {};

function loadDb() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(KEY)); } catch (e) { v = null; }
  if (!v || !Array.isArray(v.profiles)) v = { profiles: [], current: null };
  if (!v.settings) v.settings = defaultSettings();
  if (!v.settings.reminder) v.settings.reminder = defaultSettings().reminder;
  return v;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('تعذر حفظ البيانات'); }
}

const profile = () => db.profiles.find((p) => p.id === db.current) || null;
const key = (s, a) => s + ':' + a;
const passMark = (p) => (p.mode === 'kids' ? 70 : 80);
const reciterId = (p) => (/minsh/i.test((p && p.reciter) || '') ? 'minshawi' : 'husary');
const reciterInfo = (id) => RECITERS.find((r) => r.id === id) || RECITERS[0];

function newProfile(name, mode) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, mode,
    reciter: 'husary',
    repeat: mode === 'kids' ? 5 : 3,
    goal: mode === 'kids' ? 3 : 5,
    tajweed: true,
    plan: 'none',
    daily: { d: '', n: 0 },
    attempts: 0, scoreSum: 0,
    lastPos: null, lastStage: null,
    ayat: {}, mistakes: {}, days: [], awards: {}
  };
}

function ayahTokens(s, a) {
  const k = key(s, a);
  if (!tokenCache.has(k)) tokenCache.set(k, parseAyah(QURAN[s - 1].ayat[a - 1]));
  return tokenCache.get(k);
}

const wordsOf = (s, a) => ayahTokens(s, a).filter((t) => t.c);

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

function lessonsOf(s) {
  const len = QURAN[s - 1].ayat.length;
  const out = [];
  let from = 1;
  let words = 0;
  for (let a = 1; a <= len; a++) {
    const w = wordsOf(s, a).length;
    if (a > from && (words + w > 28 || a - from >= 5)) { out.push({ from, to: a - 1 }); from = a; words = 0; }
    words += w;
  }
  out.push({ from, to: len });
  return out;
}

const lessonOf = (s, a) => lessonsOf(s).find((l) => a >= l.from && a <= l.to) || { from: a, to: a };
const todayCount = (p) => (p.daily && p.daily.d === dayKey() ? p.daily.n : 0);

function streakOf(p) {
  const set = new Set(p.days || []);
  let n = 0;
  let off = set.has(dayKey()) ? 0 : -1;
  while (set.has(dayKey(off))) { n++; off--; }
  return n;
}

function awardStats(p) {
  const mem = Object.values(p.ayat).filter((x) => x.lvl >= 1).length;
  const full = [];
  QURAN.forEach((s) => { if (memCount(s.n) === s.ayat.length) full.push(s.n); });
  return { mem, full, amma: full.filter((n) => n >= 78).length === 37, streak: streakOf(p) };
}

function checkAwards(p) {
  p.awards = p.awards || {};
  const st = awardStats(p);
  const out = [];
  MILESTONES.forEach((m) => {
    if (!p.awards[m.id] && m.test(st)) { p.awards[m.id] = dayKey(); out.push({ title: m.title, desc: m.desc }); }
  });
  st.full.forEach((n) => {
    if (!p.awards['s' + n]) { p.awards['s' + n] = dayKey(); out.push({ title: 'سورة ' + QURAN[n - 1].name, desc: 'أتممت حفظ السورة، ما شاء الله تبارك الله' }); }
  });
  if (out.length) save();
  return out;
}

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
    p.days = p.days || [];
    if (p.days[p.days.length - 1] !== dayKey()) { p.days.push(dayKey()); if (p.days.length > 90) p.days = p.days.slice(-90); }
  } else {
    st.bad++;
    p.mistakes[k] = (p.mistakes[k] || 0) + 1;
    if (review && st.lvl > 0) { st.lvl = 1; st.due = dayKey(1); }
  }
  st.last = dayKey();
  p.ayat[k] = st;
  save();
  const won = checkAwards(p);
  if (won.length) setTimeout(() => celebrate(won), 900);
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
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3500);
}

function showError(e) {
  console.error(e);
  toast((e && e.message) || 'حصلت مشكلة، حاول مرة أخرى');
}

function confettiHtml(n) {
  const colors = ['#C7A55A', '#E2CB8E', '#1C2B45', '#3D8A6E', '#F6F4EF'];
  let h = '';
  for (let i = 0; i < n; i++) {
    h += '<i class="confetti" style="left:' + Math.round(Math.random() * 100) + '%;background:' + pick(colors) + ';animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's;animation-duration:' + (1.8 + Math.random() * 1.2).toFixed(2) + 's"></i>';
  }
  return h;
}

function confettiBurst() {
  const ov = document.createElement('div');
  ov.className = 'celebrate burst';
  ov.innerHTML = confettiHtml(26);
  document.body.appendChild(ov);
  setTimeout(() => ov.remove(), 3200);
}

function celebrate(items) {
  if (!items || !items.length) return;
  const it = items[0];
  const ov = document.createElement('div');
  ov.className = 'celebrate';
  ov.innerHTML = confettiHtml(34) + '<div class="cel-card">' + medal(72, true) + '<b>' + esc(it.title) + '</b><p>' + esc(it.desc) + '</p>' +
    '<button class="gold-btn">' + (items.length > 1 ? 'التالي' : 'الحمد لله') + '</button></div>';
  document.body.appendChild(ov);
  ov.querySelector('button').onclick = () => { ov.remove(); celebrate(items.slice(1)); };
}

const capPlugin = (name) => {
  const C = window.Capacitor;
  if (!C) return null;
  if (C.Plugins && C.Plugins[name]) return C.Plugins[name];
  try { return C.registerPlugin ? C.registerPlugin(name) : null; } catch (e) { return null; }
};

function isDark() {
  const t = db.settings.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function applyTheme() {
  const dark = isDark();
  document.documentElement.classList.toggle('dark', dark);
  document.body.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0E1626' : '#F6F4EF');
}

let beepCtx = null;
function beep(freq, dur) {
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!beepCtx) beepCtx = new C();
    if (beepCtx.state === 'suspended') beepCtx.resume();
    const o = beepCtx.createOscillator();
    const g = beepCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const t = beepCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(beepCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) { /* ignore */ }
}

async function scheduleReminders(opts = {}) {
  const LN = capPlugin('LocalNotifications');
  const r = db.settings.reminder;
  if (!LN) { if (!opts.silent) toast('الإشعارات غير متاحة على هذا الجهاز'); return false; }
  try {
    if (!opts.test) {
      try { await LN.cancel({ notifications: [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007].map((id) => ({ id })) }); } catch (e) { /* ignore */ }
      if (!r.on) return true;
    }
    const perm = opts.silent ? await LN.checkPermissions() : await LN.requestPermissions();
    if (perm.display !== 'granted') {
      if (!opts.silent) toast('لازم تسمح بالإشعارات للتطبيق من إعدادات الموبايل');
      if (!opts.test && !opts.silent) { r.on = false; save(); }
      return false;
    }
    if (!opts.silent && LN.checkExactNotificationSetting) {
      try {
        const ex = await LN.checkExactNotificationSetting();
        if (ex && ex.exact_alarm && ex.exact_alarm !== 'granted' && LN.changeExactNotificationSetting) {
          toast('فعّل "التنبيهات والتذكيرات" للتطبيق عشان التذكير يوصل في معاده');
          await LN.changeExactNotificationSetting();
        }
      } catch (e) { /* ignore */ }
    }
    const name = (profile() && profile().name) || '';
    if (opts.test) {
      await LN.schedule({ notifications: [{ id: 1999, title: 'مُدَّكِر', body: 'تم تفعيل التذكير بحمد الله، بارك الله فيك', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
      toast('هيوصلك إشعار تجربة بعد ٥ ثواني');
      return true;
    }
    const [h, m] = String(r.time || '20:00').split(':').map(Number);
    await LN.schedule({ notifications: [{ id: 1000, title: 'مُدَّكِر', body: pick(REMINDER_MSGS).replace('{name}', name), schedule: { on: { hour: h, minute: m }, allowWhileIdle: true } }] });
    if (!opts.silent) toast('التذكير اتظبط كل يوم الساعة ' + r.time);
    return true;
  } catch (e) {
    if (!opts.silent) toast('تعذر ظبط التذكير: ' + ((e && e.message) || e));
    return false;
  }
}

async function exportBackup() {
  const data = JSON.stringify({ app: 'muddakir', version: 1, date: new Date().toISOString(), db });
  const name = 'muddakir-backup-' + dayKey() + '.json';
  const FS = capPlugin('Filesystem');
  const SH = capPlugin('Share');
  if (FS && SH) {
    try {
      const w = await FS.writeFile({ path: name, data, directory: 'CACHE', encoding: 'utf8' });
      await SH.share({ title: 'نسخة مُدَّكِر الاحتياطية', text: 'نسخة احتياطية من تقدمك في مُدَّكِر', files: [w.uri], dialogTitle: 'احفظ النسخة الاحتياطية' });
      return;
    } catch (e) {
      if (e && /cancel/i.test(String(e.message || e))) return;
      console.error(e);
    }
  }
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function importBackup(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const j = JSON.parse(fr.result);
      const d = j && j.db;
      if (!d || !Array.isArray(d.profiles)) throw new Error('bad');
      if (!confirm('هيتم استبدال كل التقدم الحالي بالنسخة دي. نكمّل؟')) return;
      db = d;
      if (!db.settings) db.settings = defaultSettings();
      if (!db.settings.reminder) db.settings.reminder = defaultSettings().reminder;
      save();
      toast('تم استرجاع النسخة بحمد الله');
      go('home', {}, true);
    } catch (e) {
      toast('الملف ده مش نسخة احتياطية صحيحة');
    }
  };
  fr.readAsText(file);
}

async function getJsonCached(url) {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch (e) {
    return null;
  }
}

async function getTafsir() {
  if (tafsirData === undefined) tafsirData = await getJsonCached('data/tafsir.json');
  return tafsirData;
}

async function getSimilar() {
  if (simData === undefined) simData = await getJsonCached('data/similar.json');
  return simData;
}

async function getRecit(id) {
  if (recitCache[id] === undefined) recitCache[id] = await getJsonCached('data/recit/' + id + '.json');
  return recitCache[id];
}

const DL_KEY = 'mdk-dl2';
let dlIdx = null;
let dataBase = null;
let dlRunning = false;

function dl() {
  if (!dlIdx) { try { dlIdx = JSON.parse(localStorage.getItem(DL_KEY)) || {}; } catch (e) { dlIdx = {}; } }
  return dlIdx;
}

function dlSave() { try { localStorage.setItem(DL_KEY, JSON.stringify(dl())); } catch (e) { /* ignore */ } }
const isDl = (rec, s) => !!(dl()[rec] && dl()[rec][s]);
const dlPath = (rec, s) => 'audio/' + rec + '/' + pad3(s) + '.mp3';

async function initDataBase() {
  const FS = capPlugin('Filesystem');
  if (!FS || !window.Capacitor || !window.Capacitor.convertFileSrc) return;
  try {
    const r = await FS.getUri({ path: 'audio', directory: 'DATA' });
    dataBase = window.Capacitor.convertFileSrc(r.uri);
  } catch (e) {
    dataBase = null;
  }
}

async function audioFor(s, a) {
  const rec = reciterId(profile());
  const R = await getRecit(rec);
  const su = R && R.s && R.s[s - 1];
  const row = su && su.v ? su.v[a - 1] : null;
  if (su && su.u && row) {
    const url = dataBase && isDl(rec, s) ? dataBase + '/' + rec + '/' + pad3(s) + '.mp3' : su.u;
    return { url, row };
  }
  return { url: 'https://everyayah.com/data/' + reciterInfo(rec).ea + '/' + pad3(s) + pad3(a) + '.mp3', row: null };
}

function wordTimesOf(row, tokens) {
  if (!row || !row[2] || !row[2].length) return null;
  const flat = row[2];
  const n = flat.length / 2;
  const words = [];
  tokens.forEach((t, i) => { if (t.c) words.push(i); });
  const W = words.length;
  const map = (k) => (n === W ? k : Math.min(n - 1, Math.round((k * (n - 1)) / Math.max(1, W - 1))));
  const out = {};
  words.forEach((ti, k) => { const m = map(k); out[ti] = [flat[2 * m] / 1000, flat[2 * m + 1] / 1000]; });
  return out;
}

function rangeFor(row, tokens, from, to) {
  if (!row) return { start: 0, end: Infinity, words: [] };
  const ayFrom = row[0] / 1000;
  const ayTo = row[1] / 1000;
  const wt = wordTimesOf(row, tokens);
  let fw = from;
  while (fw <= to && !tokens[fw].c) fw++;
  let lw = to;
  while (lw >= from && !tokens[lw].c) lw--;
  const firstW = tokens.findIndex((t) => t.c);
  let lastW = -1;
  tokens.forEach((t, i) => { if (t.c) lastW = i; });
  let start = ayFrom;
  let end = ayTo;
  if (wt && fw <= lw) {
    if (fw !== firstW && wt[fw]) start = Math.max(ayFrom, wt[fw][0] - 0.08);
    if (lw !== lastW && wt[lw]) end = Math.min(ayTo, wt[lw][1] + 0.25);
  }
  if (end <= start + 0.2) { start = ayFrom; end = ayTo; }
  const words = wt ? Object.keys(wt).map(Number).filter((i) => i >= from && i <= to).map((i) => ({ i, t: wt[i][0] })).sort((x, y) => x.t - y.t) : [];
  return { start, end, words };
}

let player = null;
let playerUrl = '';
let playToken = 0;
let pendingStop = null;

function getPlayer(url) {
  if (player && playerUrl === url) return player;
  if (player) { try { player.pause(); } catch (e) { /* ignore */ } }
  player = new Audio();
  player.preload = 'auto';
  player.src = url;
  playerUrl = url;
  return player;
}

function stopAudio() {
  playToken++;
  if (pendingStop) { const f = pendingStop; pendingStop = null; f(); }
  if (player) { try { player.pause(); } catch (e) { /* ignore */ } }
}

function playRange(url, rng, onWord, token) {
  return new Promise((resolve) => {
    const au = getPlayer(url);
    let finished = false;
    let raf = 0;
    let started = false;
    const onErr = () => {
      if (token === playToken) toast('تعذر تشغيل الصوت، تأكد من الاتصال بالإنترنت');
      done(false);
    };
    const done = (ok) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      au.removeEventListener('error', onErr);
      try { au.pause(); } catch (e) { /* ignore */ }
      if (pendingStop === stopper) pendingStop = null;
      onWord(-1);
      resolve(ok);
    };
    const stopper = () => done(false);
    pendingStop = stopper;
    au.addEventListener('error', onErr);
    const tick = () => {
      if (finished) return;
      const t = au.currentTime;
      if (rng.words.length) {
        let cur = -1;
        for (const w of rng.words) if (t + 0.05 >= w.t) cur = w.i;
        onWord(cur);
      }
      if (au.ended || (started && t >= rng.end)) { done(true); return; }
      raf = requestAnimationFrame(tick);
    };
    const begin = () => {
      try { au.currentTime = rng.start; } catch (e) { /* ignore */ }
      au.play().then(() => { started = true; raf = requestAnimationFrame(tick); }).catch((e) => {
        console.error(e);
        if (token === playToken) toast('تعذر تشغيل الصوت');
        done(false);
      });
    };
    if (au.readyState >= 1) begin();
    else {
      const onMeta = () => { au.removeEventListener('loadedmetadata', onMeta); if (!finished) begin(); };
      au.addEventListener('loadedmetadata', onMeta);
      if (au.networkState === 0 || au.networkState === 3) au.load();
    }
    setTimeout(() => { if (!finished && !started) { if (token === playToken) toast('الصوت بياخد وقت، تأكد من الاتصال'); done(false); } }, 20000);
  });
}

async function playRepeat(url, rng, times, onWord, onStep) {
  stopAudio();
  const token = playToken;
  for (let i = 1; i <= times; i++) {
    if (token !== playToken) return false;
    onStep(i);
    const ok = await playRange(url, rng, onWord, token);
    if (!ok || token !== playToken) return false;
    if (i < times) await sleep(500);
  }
  return true;
}

function cleanup() {
  stopAudio();
  stopListening();
}

const planActive = (p) => !!(p.plan && p.plan !== 'none');

function planOrder(plan) {
  if (plan === 'amma') return range(78, 114).reverse();
  if (plan === 'tabarak') return range(67, 77);
  if (plan === 'all') return range(1, 114);
  return [];
}

function planNext(p) {
  for (const s of planOrder(p.plan)) {
    if (memCount(s) < QURAN[s - 1].ayat.length) return { s, a: firstUnmemorized(s) };
  }
  return null;
}

function planStats(p) {
  let total = 0;
  let mem = 0;
  planOrder(p.plan).forEach((s) => { total += QURAN[s - 1].ayat.length; mem += memCount(s); });
  const left = total - mem;
  return { total, mem, left, days: Math.ceil(left / Math.max(1, p.goal || 5)) };
}

function topBar(title, back) {
  return '<header class="top">' +
    (back ? '<button class="ibtn" data-back aria-label="رجوع">' + icon('arrowRight') + '</button>' : '<span class="logo">' + brandMark(34) + '</span>') +
    '<div class="ttl' + (back ? ' center' : '') + '"><b>' + esc(title) + '</b></div>' + (back ? brandMark(28) : '') + '</header>';
}

function navBar(active) {
  const items = [['home', 'home', 'الرئيسية'], ['surahs', 'book', 'السور'], ['reviewHub', 'refresh', 'المراجعة'], ['activities', 'puzzle', 'أنشطة']];
  return '<nav class="nav">' + items.map(([id, ic, label]) =>
    '<button data-tab="' + id + '" class="' + (id === active ? 'on' : '') + '" aria-label="' + label + '">' + icon(ic, 20) + '<span>' + label + '</span></button>').join('') + '</nav>';
}

const curDepth = () => (history.state && history.state.depth) || 0;

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
    '<div class="counts"><span class="ok">' + c.ok + ' صحيحة</span>' + (c.near ? '<span class="near">' + c.near + ' قريبة</span>' : '') +
    (c.bad ? '<span class="bad">' + c.bad + ' خطأ</span>' : '') + (c.miss ? '<span class="miss">' + c.miss + ' ناقصة</span>' : '') +
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
  const awardsN = Object.keys(p.awards || {}).length;
  let line;
  if (planActive(p)) {
    const st = planStats(p);
    const nx = planNext(p);
    line = '<b>خطتك: ' + PLAN_NAMES[p.plan] + '</b><p>' + (st.left
      ? 'محفوظ ' + arDigits(st.mem) + ' من ' + arDigits(st.total) + ' · تتمّها بإذن الله خلال ' + arDigits(st.days) + ' يوم' + (nx ? ' · التالي: ' + esc(QURAN[nx.s - 1].name) + ' ' + arDigits(nx.a) : '')
      : 'أتممت الخطة، ما شاء الله تبارك الله') + '</p>';
  } else {
    line = '<b>' + (pos ? 'سورة ' + esc(QURAN[pos.s - 1].name) + ' · من آية ' + arDigits(pos.a) : 'ابدأ وِردك من أي سورة') + '</b>';
  }
  const segs = goal <= 10
    ? '<div class="segs">' + Array.from({ length: goal }, (_, i) => '<i class="' + (i < done ? 'on' : '') + '"></i>').join('') + '</div>'
    : '<div class="segs"><i class="on" style="flex:' + Math.min(done, goal) + '"></i><i style="flex:' + Math.max(0, goal - done) + '"></i></div>';
  app.innerHTML = '<header class="top"><span class="logo">' + brandMark(38) + '</span><div class="hello grow"><small>السلام عليكم</small><b>' + esc(p.name) + '</b></div>' +
    '<button class="ibtn" id="settings" aria-label="الإعدادات">' + icon('sliders') + '</button></header><main class="wrap">' +
    '<section class="wird"><div class="wird-in"><div class="wird-top"><span>وِرد اليوم</span><span>' + arDigits(Math.min(done, goal)) + ' / ' + arDigits(goal) + '</span></div>' +
    line + (done >= goal ? '<p>أتممت وِرد اليوم، تقبّل الله منك</p>' : '') + segs +
    '<button class="gold-btn" id="cont">' + (planActive(p) ? 'كمّل الخطة' : pos ? 'كمّل الحفظ' : 'ابدأ الحفظ') + '</button></div></section>' +
    divider() +
    '<div class="tiles"><button class="tile" id="rev"><b>' + arDigits(due) + '</b><small>للمراجعة</small></button>' +
    '<button class="tile" id="memT"><b>' + arDigits(mem) + '</b><small>آية محفوظة</small></button>' +
    '<button class="tile wide" id="acts">' + icon('puzzle', 20) + '<span>الأنشطة</span>' + icon('chevronLeft', 18) + '</button>' +
    '<button class="tile wide" id="awardsT">' + icon('sparkle', 20) + '<span>إنجازاتي</span>' + (awardsN ? '<small>' + arDigits(awardsN) + '</small>' : '') + icon('chevronLeft', 18) + '</button></div>' +
    '</main>' + navBar('home');
  $('#cont').onclick = () => {
    if (planActive(p)) {
      const nx = planNext(p);
      if (nx) go('practice', { s: nx.s, a: nx.a });
      else toast('أتممت الخطة، ما شاء الله تبارك الله');
      return;
    }
    if (pos) go('practice', { s: pos.s, a: pos.a });
    else tab('surahs');
  };
  $('#rev').onclick = () => tab('reviewHub');
  $('#memT').onclick = () => tab('surahs');
  $('#acts').onclick = () => tab('activities');
  $('#awardsT').onclick = () => go('awards');
  $('#settings').onclick = () => go('settings');
}

function screenAwards() {
  const p = profile();
  p.awards = p.awards || {};
  const st = awardStats(p);
  app.innerHTML = topBar('إنجازاتي', true) + '<main class="wrap"><div class="section-title">المراحل</div><div class="awards">' +
    MILESTONES.map((m) => { const on = !!p.awards[m.id]; return '<div class="award' + (on ? '' : ' off') + '">' + medal(42, on) + '<b>' + m.title + '</b><small>' + m.desc + '</small></div>'; }).join('') +
    '</div>' + divider() + '<div class="section-title">السور اللي أتممت حفظها</div>' +
    (st.full.length
      ? '<div class="awards">' + st.full.map((n) => '<div class="award">' + medal(42, true) + '<b class="qf">' + esc(QURAN[n - 1].name) + '</b><small>' + arDigits(QURAN[n - 1].ayat.length) + ' آية</small></div>').join('') + '</div>'
      : '<div class="card empty muted small">أول ما تتم حفظ سورة، شارتها هتظهر هنا.</div>') +
    '<p class="muted small center">أيام متتالية: ' + arDigits(st.streak) + '</p></main>';
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
    $$('#slist .row').forEach((b) => { b.onclick = () => go('surah', { s: +b.dataset.s }); });
  };
  $$('#chips .chip').forEach((c) => { c.onclick = () => { filter = c.dataset.f; $('#q').value = ''; draw(); }; });
  $('#q').oninput = draw;
  draw();
}

function reciteRangeCard(len, prefix) {
  const opts = range(1, len).map((x) => '<option value="' + x + '">' + arDigits(x) + '</option>').join('');
  return '<section class="card"><h2>التسميع من الذاكرة</h2><p class="muted small">اختار الآيات اللي هتسمّعها مرة واحدة من غير توقف، أو سمّع السورة كاملة.</p>' +
    '<div class="seg"><label class="opt" style="flex:1;gap:6px">من <select id="' + prefix + 'From" class="time">' + opts + '</select></label>' +
    '<label class="opt" style="flex:1;gap:6px">إلى <select id="' + prefix + 'To" class="time">' + opts + '</select></label></div>' +
    '<button class="primary" id="' + prefix + 'Go">ابدأ التسميع</button><button class="light-btn" id="' + prefix + 'All">سمّع السورة كاملة</button></section>';
}

function bindReciteRange(s, len, prefix) {
  const f = $('#' + prefix + 'From');
  const t = $('#' + prefix + 'To');
  t.value = String(len);
  $('#' + prefix + 'Go').onclick = () => {
    let a = +f.value;
    let b = +t.value;
    if (b < a) { const x = a; a = b; b = x; }
    go('recite', { s, from: a, to: b, purpose: 'surah' });
  };
  $('#' + prefix + 'All').onclick = () => go('recite', { s, from: 1, to: len, purpose: 'surah' });
}

function downloadCard(s) {
  const rec = reciterId(profile());
  const done = isDl(rec, s);
  return '<section class="card"><h2>الاستماع من غير إنترنت</h2><p class="muted small" id="dlStatus">' +
    (done ? 'السورة محمّلة بصوت ' + esc(reciterInfo(rec).name) + '، وبتشتغل من غير إنترنت' : 'حمّل صوت السورة مرة واحدة، وبعدها الاستماع يشتغل من غير إنترنت') + '</p>' +
    (done ? '<button class="light-btn" id="dlDel">حذف التحميل</button>' : '<button class="primary" id="dlBtn">تحميل السورة</button>') + '</section>';
}

function bindDownload(s) {
  const rec = reciterId(profile());
  const b = $('#dlBtn');
  const del = $('#dlDel');
  if (b) {
    b.onclick = async () => {
      const FS = capPlugin('Filesystem');
      if (!FS || !FS.downloadFile) { toast('التحميل متاح على الموبايل بس'); return; }
      if (dlRunning) { toast('فيه تحميل شغال، استنى لما يخلص'); return; }
      const R = await getRecit(rec);
      const su = R && R.s && R.s[s - 1];
      if (!su || !su.u) { toast('صوت السورة مش متاح للتحميل'); return; }
      dlRunning = true;
      b.disabled = true;
      b.textContent = 'جاري التحميل…';
      try {
        await FS.downloadFile({ url: su.u, path: dlPath(rec, s), directory: 'DATA', recursive: true });
        dl()[rec] = dl()[rec] || {};
        dl()[rec][s] = 1;
        dlSave();
        toast('تم تحميل السورة بحمد الله');
      } catch (e) {
        console.error(e);
        toast('تعذر التحميل، تأكد من الاتصال بالإنترنت');
      }
      dlRunning = false;
      if (b.isConnected) render(history.state);
    };
  }
  if (del) {
    del.onclick = async () => {
      if (!confirm('حذف صوت السورة من الموبايل؟')) return;
      const FS = capPlugin('Filesystem');
      try { await FS.deleteFile({ path: dlPath(rec, s), directory: 'DATA' }); } catch (e) { /* ignore */ }
      if (dl()[rec]) delete dl()[rec][s];
      dlSave();
      render(history.state);
    };
  }
}

function screenSurah(params) {
  const s = params.s;
  const sura = QURAN[s - 1];
  if (!sura) { go('home', {}, true); return; }
  const lessons = lessonsOf(s);
  const memSet = new Set(memorizedAyat(s));
  const next = firstUnmemorized(s);
  const len = sura.ayat.length;
  app.innerHTML = topBar('سورة ' + sura.name, true) + '<main class="wrap">' +
    '<section class="wird"><div class="wird-in"><div class="wird-top"><span>' + arDigits(lessons.length) + ' دروس</span><span>' + arDigits(memSet.size) + ' / ' + arDigits(len) + '</span></div>' +
    '<b>' + (memSet.size === len ? 'أتممت حفظ السورة، ما شاء الله تبارك الله' : 'أكمل من آية ' + arDigits(next)) + '</b>' +
    '<button class="gold-btn" id="go">' + (memSet.size ? 'كمّل الحفظ' : 'ابدأ أول درس') + '</button></div></section>' +
    divider() + '<div class="lesson-list">' + lessons.map((l, i) => {
      const n = l.to - l.from + 1;
      let m = 0;
      for (let a = l.from; a <= l.to; a++) if (memSet.has(a)) m++;
      const full = m === n;
      return '<button class="row" data-a="' + l.from + '">' + starBadge(arDigits(i + 1), full) + '<div class="grow"><b>الدرس ' + arDigits(i + 1) + '</b><small>' +
        (n === 1 ? 'آية ' + arDigits(l.from) : 'آيات ' + arDigits(l.from) + ' – ' + arDigits(l.to)) + '</small></div>' +
        (full ? '<span class="done">' + icon('check', 18) + '</span>' : '<span class="muted small">' + m + '/' + n + '</span>') + '</button>';
    }).join('') + '</div>' + divider() + reciteRangeCard(len, 'sr') + downloadCard(s) + '</main>';
  $('#go').onclick = () => go('practice', { s, a: next }, true);
  $$('.lesson-list .row').forEach((b) => { b.onclick = () => go('practice', { s, a: +b.dataset.a }); });
  bindReciteRange(s, len, 'sr');
  bindDownload(s);
}

function startQuizChain(s, from, to) {
  const n = to - from + 1;
  const list = n >= 3 ? ['arrange', 'complete', 'nextWord', 'nextAyah', 'connect']
    : n === 2 ? ['arrange', 'complete', 'nextWord', 'nextAyah', 'order']
      : ['arrange', 'complete', 'nextWord', 'complete', 'nextWord'];
  go('quiz', { s, kind: list[0], chain: { list, i: 0, from, to } }, true);
}

function screenPractice(params) {
  const sura = QURAN[params.s - 1];
  if (!sura) { go('home', {}, true); return; }
  const rid = renderSeq;
  const a = Math.min(Math.max(1, params.a || 1), sura.ayat.length);
  app.innerHTML = topBar('سورة ' + sura.name, true) + '<main class="wrap"><p class="muted center">جاري التحضير…</p></main>';
  audioFor(params.s, a).then((au) => {
    if (rid !== renderSeq) return;
    buildPractice(Object.assign({}, params, { a }), au, rid);
    setTimeout(() => { if (rid === renderSeq) initEngine().catch(() => {}); }, 1500);
  });
}

function buildPractice(params, au, rid) {
  const s = params.s;
  const a = params.a;
  const sura = QURAN[s - 1];
  const mode = params.mode || 'learn';
  const p = profile();
  const kids = p.mode === 'kids';
  const alive = () => rid === renderSeq;
  const tokens = ayahTokens(s, a);
  const skel = tokens.map((t) => (t.c ? refSkeleton(t.plain) : ''));
  const row = au.row;
  const st0 = p.ayat[key(s, a)];
  const last = a === sura.ayat.length;
  const L = lessonOf(s, a);
  const chunks = row ? chunksFromCuts(tokens, row[3] || []) : splitChunks(tokens);
  const stages = mode === 'learn' ? buildStages(chunks) : [{ from: 0, to: tokens.length - 1, kind: 'review' }];
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
  const times = p.repeat || 3;
  if (mode === 'learn') { p.lastPos = { s, a }; save(); }
  const remaining = mode === 'review' ? dueList().filter((x) => !skipped.has(x.k)).length : 0;
  const title = mode === 'review' ? 'المراجعة' : 'سورة ' + sura.name;

  app.innerHTML = '<header class="top"><button class="ibtn" data-back aria-label="رجوع">' + icon('arrowRight') + '</button>' +
    '<div class="ttl center"><b class="qf">' + esc(title) + '</b><small id="sub"></small></div>' + brandMark(28) + '</header>' +
    '<main class="wrap">' + (stages.length > 1 ? '<div class="stagebar" id="stagebar">' + stages.map((x, k) => '<i data-si="' + k + '"></i>').join('') + '</div>' : '') +
    '<div class="frame"><div class="frame-in q" id="ayah"></div></div>' +
    '<div class="steps" id="steps"></div><div class="stage-nav" id="stageNav"></div><p class="status-line" id="statusLine"></p>' +
    '<div class="ctrls" id="ctrls"></div><div id="result"></div>' +
    '<details class="tafsir"><summary>' + icon('book', 16) + ' التفسير الميسر</summary><p id="tafsirText">جاري التحميل…</p></details>' +
    '<details class="tafsir" id="simBox" hidden><summary>' + icon('link', 16) + ' آيات متشابهة</summary><div id="simText"></div></details></main>';

  getTafsir().then((tf) => {
    const el = $('#tafsirText');
    if (!el || !alive()) return;
    const txt = tf && tf[s - 1] && tf[s - 1][a - 1];
    el.textContent = txt || 'التفسير غير متاح في هذه النسخة';
  });
  getSimilar().then((sd) => {
    const box = $('#simBox');
    if (!box || !alive()) return;
    const l = (sd && sd[s + ':' + a]) || [];
    if (!l.length) return;
    box.hidden = false;
    $('#simText').innerHTML = '<p class="muted small">آيات قريبة في ألفاظها، انتبه للفرق بينها:</p>' + l.map(([s2, a2]) => {
      const ws = wordsOf(s2, a2);
      return '<div class="sim-row"><b class="qf">' + esc(QURAN[s2 - 1].name) + ' · ' + arDigits(a2) + '</b><p class="q sim-q">' + ws.slice(0, 14).map((w) => w.html).join(' ') + (ws.length > 14 ? ' …' : '') + '</p></div>';
    }).join('');
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
    if (mode === 'learn') {
      const ln = L.to > L.from ? 'درس ' + arDigits(L.from) + '–' + arDigits(L.to) + ' · ' : '';
      sub = ln + 'آية ' + arDigits(a) + (stages.length > 1 ? ' · المرحلة ' + arDigits(si + 1) + ' من ' + arDigits(stages.length) + (stg.kind === 'link' ? ' · ربط' : stg.kind === 'full' ? ' · كاملة' : '') : '');
    } else sub = 'سورة ' + sura.name + ' · آية ' + arDigits(a) + ' · باقي ' + arDigits(remaining);
    $('#sub').textContent = sub;
    const bar = $('#stagebar');
    if (bar) Array.from(bar.children).forEach((x, i) => { x.className = i < si ? 'd' : i === si ? 'c' : ''; });
    const steps = stepsOf(stg);
    const idx = steps.indexOf(step);
    $('#steps').innerHTML = steps.length > 1 ? steps.map((x, i) => '<button data-step="' + x + '" class="' + (i === idx ? 'on' : i < idx ? 'ok' : '') + '">' + STEP_LABEL[x] + (i < idx ? ' ✓' : '') + '</button>').join('') : '';
    $$('#steps button').forEach((b) => { b.onclick = () => { if (busy) return; setStep(b.dataset.step, true); }; });
    const sn = $('#stageNav');
    sn.innerHTML = stages.length > 1 ? '<button id="stPrev"' + (si === 0 ? ' disabled' : '') + '>' + icon('chevronRight', 16) + ' المرحلة السابقة</button><button id="stNext"' + (si === stages.length - 1 ? ' disabled' : '') + '>المرحلة التالية ' + icon('chevronLeft', 16) + '</button>' : '';
    const sp = $('#stPrev'); if (sp) sp.onclick = () => goStage(si - 1);
    const sx = $('#stNext'); if (sx) sx.onclick = () => goStage(si + 1);
    $$('#stagebar i').forEach((x) => { x.onclick = () => goStage(+x.dataset.si); });
  }

  function defaultStatus() {
    if (step === 'listen') return 'استمع لـ' + unit() + ' ' + ayatTimes(listenTimes()) + '، أو دوس سمّع لو جاهز';
    if (step === 'read') return 'اقرأ ' + unit() + ' وانت شايف الكلمات';
    return 'اقرأ من الذاكرة، والكلمة هتظهر لما تقولها';
  }

  const btn = (id, ic, label, cls, dis) => '<div class="bt ' + (cls || '') + '"><button id="' + id + '" aria-label="' + label + '"' + (dis ? ' disabled' : '') + '>' + icon(ic, 19) + '</button><small id="' + id + 'Lbl">' + label + '</small></div>';

  function drawControls() {
    let html = '';
    if (mode === 'review') html += btn('play', 'volume', 'استمع', 'play');
    else html += btn('prevA', 'chevronRight', 'السابقة', '', a === 1) + btn('play', 'play', 'استمع', 'play');
    html += btn('mic', listening ? 'pause' : 'mic', listening ? 'بسمعك' : 'سمّع', 'mic' + (listening ? ' listening' : ''));
    if (step === 'memory' || step === 'read') html += btn('hint', 'bulb', 'مساعدة', 'hint');
    html += mode === 'review' ? btn('nextA', 'chevronLeft', finished ? 'التالي' : 'تخطي') : btn('nextA', 'chevronLeft', last ? 'إنهاء' : 'التالية');
    $('#ctrls').innerHTML = html;
    $('#play').onclick = onListen;
    $('#mic').onclick = onMic;
    const prev = $('#prevA'); if (prev) prev.onclick = () => go('practice', { s, a: a - 1, mode }, true);
    $('#nextA').onclick = onNext;
    const hint = $('#hint'); if (hint) hint.onclick = onHint;
  }

  function drawMic() {
    const m = $('#mic');
    if (!m) return;
    m.parentElement.classList.toggle('listening', listening);
    m.innerHTML = icon(listening ? 'pause' : 'mic', 19);
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

  function goStage(k) {
    if (busy || k < 0 || k >= stages.length) return;
    stopListen(false);
    stopAudio();
    si = k;
    p.lastStage = { s, a, si };
    save();
    setStep(stepsOf(stage())[0]);
  }

  function onNext() {
    stopListen(false);
    if (mode === 'review') { if (!finished) skipped.add(key(s, a)); go('review', {}, true); return; }
    if (!last) go('practice', { s, a: a + 1, mode }, true);
    else { toast('ما شاء الله تبارك الله، أتممت سورة ' + sura.name); goBack(); }
  }

  function onHint() {
    const ref = refIdx();
    const ti = ref.find((i) => !statuses[i] || statuses[i] === 'pending');
    if (ti === undefined) return;
    statuses[ti] = 'hint';
    drawAyah();
    if (ref.every((i) => statuses[i] && statuses[i] !== 'pending')) { stopListen(false); hintedEnd(); return; }
    checkComplete();
  }

  function hintedEnd() {
    if (mode !== 'learn') { evaluate(); return; }
    const ref = refIdx();
    let pts = 0;
    ref.forEach((ti) => { const x = statuses[ti]; pts += x === 'ok' ? 1 : x === 'near' ? 0.75 : x === 'hint' ? 0.5 : 0; });
    const score = ref.length ? Math.round((pts * 100) / ref.length) : 0;
    if (score >= passMark(p)) { evaluate(); return; }
    const lastStage = si === stages.length - 1;
    $('#result').innerHTML = resultCard(false, score, statuses, ref,
      '<button class="primary" id="hintNext">' + (lastStage ? 'إنهاء الآية' : 'انتقل للمرحلة التالية') + '</button><button class="light-btn" id="hintRetry">حاول بدون مساعدة</button>');
    setStatus('اكتملت المرحلة بالمساعدة، تقدر تكمّل أو تحاول مرة أخرى');
    $('#hintRetry').onclick = () => { statuses = {}; $('#result').innerHTML = ''; drawAyah(); startListen(); };
    $('#hintNext').onclick = () => {
      if (!lastStage) {
        goStage(si + 1);
        if (stepsOf(stage())[0] === 'listen') setTimeout(() => { if (alive() && step === 'listen') onListen(); }, 400);
        else startListen();
        return;
      }
      p.lastStage = null;
      applyResult(s, a, score, false);
      showComplete(score);
    };
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
    const rng = rangeFor(row, tokens, stg.from, stg.to);
    const ok = await playRepeat(au.url, rng, n, highlight, (k) => { const l = $('#playLbl'); if (l) l.textContent = n > 1 ? arDigits(k) + ' من ' + arDigits(n) : 'بيشتغل'; });
    playing = false;
    if (!b.isConnected) return;
    highlight(-1);
    b.classList.remove('playing');
    b.innerHTML = icon(mode === 'review' ? 'volume' : 'play', 19);
    const l = $('#playLbl'); if (l) l.textContent = 'استمع';
    if (ok && wasListen && step === 'listen') {
      const steps = stepsOf(stage());
      const nx = steps[steps.indexOf('listen') + 1];
      if (nx) setTimeout(() => { if (alive() && step === 'listen' && !playing) { setStep(nx); startListen(); } }, 500);
    } else if (resume && step !== 'listen' && !finished) {
      startListen();
    }
  }

  function onMic() {
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
    if (!isReady()) setStatus('بجهّز المصحح… أول مرة بتاخد ثواني');
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
    beep(880, 0.12);
    await sleep(180);
    try {
      await startListening(onScript);
    } catch (e) {
      console.error(e);
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
      if (!r.done && !(k === ref.length - 1 && r.ratio >= 0.6)) return;
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
        '<button class="primary" id="again">حاول مرة أخرى</button>' + (canListen ? '<button class="light-btn" id="hear">اسمع ' + unit() + ' مرة أخرى</button>' : ''));
      $('#again').onclick = () => { $('#result').innerHTML = ''; startListen(); };
      const hr = $('#hear'); if (hr) hr.onclick = () => setStep('listen');
      setStatus('راجع الكلمات الملونة وحاول مرة أخرى، وفقك الله');
      return;
    }
    applyResult(s, a, score, mode === 'review' || !!(st0 && st0.lvl >= 1));
    finished = true;
    $('#result').innerHTML = resultCard(pass, score, statuses, ref, pass ? '' : '<button class="primary" id="again">حاول مرة أخرى</button>');
    const ag = $('#again'); if (ag) ag.onclick = () => { $('#result').innerHTML = ''; finished = false; drawControls(); startListen(); };
    drawControls();
    setStatus(pass ? pick(PRAISE) : 'راجع الكلمات الملونة، وفقك الله');
    if (pass) setTimeout(() => { if (alive() && finished) onNext(); }, 1500);
  }

  function stepPassed(score) {
    const steps = stepsOf(stage());
    const idx = steps.indexOf(step);
    setStatus(pick(PRAISE));
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
    confettiBurst();
    let mainLabel;
    let mainAct;
    if (a < L.to) {
      if (a > L.from) {
        mainLabel = 'اربط الآيات من ' + arDigits(L.from) + ' لـ ' + arDigits(a);
        mainAct = () => go('recite', { s, from: L.from, to: a, purpose: 'link', nextA: a + 1 }, true);
      } else {
        mainLabel = 'الآية التالية';
        mainAct = () => go('practice', { s, a: a + 1 }, true);
      }
    } else if (L.to > L.from) {
      mainLabel = 'سمّع الدرس كامل';
      mainAct = () => go('recite', { s, from: L.from, to: L.to, purpose: 'lesson' }, true);
    } else {
      mainLabel = 'يلا على الاختبارات';
      mainAct = () => startQuizChain(s, L.from, L.to);
    }
    $('#result').innerHTML = '<div class="result pass"><div class="score">' + score + '%</div><b>ما شاء الله تبارك الله، حفظت الآية</b>' +
      '<small>ستعود إليك للمراجعة غدًا بإذن الله</small><button class="primary" id="mainAct">' + mainLabel + '</button>' +
      (a > 1 ? '<button class="link-btn" id="prevAy">الآية السابقة</button>' : '') + '</div>';
    $('#mainAct').onclick = mainAct;
    const pv = $('#prevAy'); if (pv) pv.onclick = () => go('practice', { s, a: a - 1, mode }, true);
    void kids;
  }

  drawAll();
  if (mode !== 'learn') setTimeout(() => { if (alive()) startListen(); }, 600);
}

function screenRecite(params) {
  const s = params.s;
  const sura = QURAN[s - 1];
  if (!sura) { go('home', {}, true); return; }
  const rid = renderSeq;
  const alive = () => rid === renderSeq;
  const from = params.from;
  const to = params.to;
  const purpose = params.purpose;
  const p = profile();
  const items = [];
  const gIdx = {};
  for (let a = from; a <= to; a++) {
    gIdx[a] = {};
    ayahTokens(s, a).forEach((t, i) => { if (t.c) { gIdx[a][i] = items.length; items.push({ a, i, sk: refSkeleton(t.plain) }); } });
  }
  const status = new Array(items.length).fill(null);
  let anchor = 0;
  let listening = false;
  let busy = false;
  let lastScript = '';
  let done = false;
  const title = purpose === 'surah' ? 'تسميع سورة ' + sura.name : purpose === 'link' ? 'ربط الآيات' : 'سمّع الدرس كامل';
  app.innerHTML = '<header class="top"><button class="ibtn" data-back aria-label="رجوع">' + icon('arrowRight') + '</button>' +
    '<div class="ttl center"><b class="qf">' + esc(title) + '</b><small>' + (from === to ? 'آية ' + arDigits(from) : 'آيات ' + arDigits(from) + ' – ' + arDigits(to)) + '</small></div>' + brandMark(28) + '</header>' +
    '<main class="wrap"><div class="stagebar"><i id="rbar" class="c" style="flex:0"></i><i style="flex:1" id="rrest"></i></div>' +
    '<div class="frame"><div class="frame-in q rec-text" id="rtext"></div></div>' +
    '<p class="status-line" id="statusLine"></p><div class="ctrls" id="ctrls"></div><div id="result"></div></main>';
  const setStatus = (t, live) => { const el = $('#statusLine'); if (el) { el.textContent = t; el.classList.toggle('live', !!live); } };
  const firstOpen = () => { const k = status.findIndex((x) => !x); return k < 0 ? items.length : k; };

  function draw() {
    const cur = Math.min(items.length - 1, Math.max(0, anchor));
    const curA = items.length ? items[cur].a : from;
    const showFrom = Math.max(from, curA - 1);
    const showTo = Math.min(to, curA + 3);
    let h = '';
    for (let a = showFrom; a <= showTo; a++) {
      h += ayahTokens(s, a).map((t, i) => {
        if (!t.c) return '<span class="mark">' + esc(t.plain) + '</span>';
        const st = status[gIdx[a][i]];
        if (st) return '<span class="w ' + st + '">' + esc(t.plain) + '</span>';
        const width = Math.min(5, Math.max(1.4, t.c.length * 0.5));
        return '<span class="w"><span class="blank" style="width:' + width + 'em"></span></span>';
      }).join(' ') + ' <span class="anum">﴿' + arDigits(a) + '﴾</span> ';
    }
    $('#rtext').innerHTML = h;
    const doneN = status.filter(Boolean).length;
    $('#rbar').style.flex = String(doneN);
    $('#rrest').style.flex = String(Math.max(0, items.length - doneN));
  }

  const btn = (id, ic, label, cls) => '<div class="bt ' + (cls || '') + '"><button id="' + id + '" aria-label="' + label + '">' + icon(ic, 19) + '</button><small>' + label + '</small></div>';
  function drawControls() {
    if (done) { $('#ctrls').innerHTML = ''; return; }
    $('#ctrls').innerHTML = btn('mic', listening ? 'pause' : 'mic', listening ? 'بسمعك' : 'سمّع', 'mic' + (listening ? ' listening' : '')) + btn('hint', 'bulb', 'مساعدة', 'hint');
    $('#mic').onclick = () => { if (busy) return; if (listening) finish(false); else start(); };
    $('#hint').onclick = () => {
      const k = firstOpen();
      if (k >= items.length) return;
      status[k] = 'hint';
      anchor = Math.max(anchor, k + 1);
      draw();
      if (status.every(Boolean)) finish(true);
    };
  }

  async function start() {
    if (listening || busy || done || !alive()) return;
    busy = true;
    if (!isReady()) setStatus('بجهّز المصحح… أول مرة بتاخد ثواني');
    try { await initEngine(); } catch (e) { busy = false; setStatus('تعذر تشغيل المصحح على الموبايل ده'); showError(e); return; }
    busy = false;
    if (!alive()) return;
    beep(880, 0.12);
    await sleep(180);
    try { await startListening(onScript); } catch (e) { console.error(e); toast('محتاجين إذن المايك عشان نسمع التلاوة'); return; }
    if (!alive()) { stopListening(); return; }
    listening = true;
    drawControls();
    setStatus('اقرأ من الذاكرة من غير ما توقف، والكلمات هتظهر وانت بتقرأ', true);
  }

  function onScript(script) {
    if (!listening || !alive()) return;
    lastScript = script;
    const lo = Math.max(0, anchor - 8);
    const hi = Math.min(items.length, anchor + 40);
    const res = alignWords(items.slice(lo, hi).map((x) => x.sk), heardSkeleton(script), false);
    let changed = false;
    res.forEach((r, k) => {
      const g = lo + k;
      if (!r.done && !(g === items.length - 1 && r.ratio >= 0.6)) return;
      const st = r.ratio >= 0.7 ? 'ok' : r.ratio >= 0.5 ? 'near' : null;
      if (st && status[g] !== 'ok' && status[g] !== 'hint' && status[g] !== st) { status[g] = st; changed = true; anchor = Math.max(anchor, g + 1); }
    });
    if (changed) draw();
    if (status.every(Boolean)) finish(true);
  }

  async function finish(complete) {
    if (done) return;
    if (listening) { listening = false; stopListening(); }
    if (!complete) {
      busy = true;
      setStatus('لحظة…');
      const sc = await inferNow();
      busy = false;
      if (!alive()) return;
      if (sc) lastScript = sc;
      const lo = Math.max(0, anchor - 8);
      const hi = Math.min(items.length, anchor + 40);
      const res = alignWords(items.slice(lo, hi).map((x) => x.sk), heardSkeleton(lastScript), false);
      res.forEach((r, k) => { const g = lo + k; if ((r.done || r.ratio >= 0.6) && r.ratio >= 0.7 && !status[g]) status[g] = 'ok'; });
    }
    done = true;
    for (let g = 0; g < items.length; g++) if (!status[g]) status[g] = 'miss';
    const per = {};
    items.forEach((it, g) => {
      per[it.a] = per[it.a] || { pts: 0, n: 0 };
      const x = status[g];
      per[it.a].n++;
      per[it.a].pts += x === 'ok' ? 1 : x === 'near' ? 0.75 : x === 'hint' ? 0.5 : 0;
    });
    let tp = 0;
    let tn = 0;
    const weak = [];
    Object.keys(per).forEach((a) => {
      const sc = Math.round((per[a].pts * 100) / per[a].n);
      tp += per[a].pts;
      tn += per[a].n;
      if (sc < passMark(p)) weak.push({ a: +a, sc });
      if (purpose === 'surah') {
        const st = p.ayat[key(s, +a)];
        if (st && st.lvl >= 1) applyResult(s, +a, sc, true);
      }
    });
    const score = tn ? Math.round((tp * 100) / tn) : 0;
    const pass = score >= passMark(p);
    $('#rtext').innerHTML = range(from, to).map((a) => ayahTokens(s, a).map((t, i) => {
      if (!t.c) return '<span class="mark">' + esc(t.plain) + '</span>';
      return '<span class="w ' + status[gIdx[a][i]] + '">' + esc(t.plain) + '</span>';
    }).join(' ') + ' <span class="anum">﴿' + arDigits(a) + '﴾</span>').join(' ');
    drawControls();
    setStatus('');
    if (pass) confettiBurst();
    let btns;
    if (purpose === 'link') btns = pass ? '<button class="primary" id="cont">كمّل: الآية ' + arDigits(params.nextA) + '</button>' : '<button class="primary" id="retry">حاول مرة أخرى</button><button class="light-btn" id="cont">كمّل على أي حال</button>';
    else if (purpose === 'lesson') btns = pass ? '<button class="primary" id="cont">يلا على الاختبارات</button>' : '<button class="primary" id="retry">حاول مرة أخرى</button><button class="light-btn" id="cont">كمّل على الاختبارات</button>';
    else btns = '<button class="primary" id="retry">سمّع مرة أخرى</button><button class="light-btn" data-back>رجوع</button>';
    $('#result').innerHTML = '<div class="result ' + (pass ? 'pass' : 'fail') + '"><div class="score">' + score + '%</div><b>' + (pass ? 'ما شاء الله تبارك الله' : 'تحتاج إلى مراجعة، أعانك الله') + '</b>' +
      (weak.length ? '<div class="card" style="margin-top:10px;text-align:start">' + weak.map((w) => '<div class="mini-row"><span>آية ' + arDigits(w.a) + '</span><span class="near">' + w.sc + '%</span></div>').join('') + '</div>' : '') + btns + '</div>';
    const c = $('#cont');
    if (c) c.onclick = () => { if (purpose === 'link') go('practice', { s, a: params.nextA }, true); else startQuizChain(s, from, to); };
    const r = $('#retry'); if (r) r.onclick = () => render(history.state);
  }

  draw();
  drawControls();
  setStatus('دوس سمّع واقرأ من الذاكرة من غير ما توقف');
  setTimeout(() => { if (alive()) start(); }, 500);
}

function distractors(s, exclude, count, nearLen) {
  const pool = new Map();
  const add = (ss) => {
    const len = QURAN[ss - 1].ayat.length;
    for (let ai = 1; ai <= len; ai++) wordsOf(ss, ai).forEach((w) => { if (w.c.length >= 2 && !exclude.has(w.c) && !pool.has(w.c)) pool.set(w.c, w); });
  };
  add(s);
  if (pool.size < count + 3) add(s === 114 ? 113 : s + 1);
  if (pool.size < count + 3) add(1);
  let arr = Array.from(pool.values());
  if (nearLen) { const near = arr.filter((w) => Math.abs(w.c.length - nearLen) <= 1); if (near.length >= count) arr = near; }
  return shuffle(arr).slice(0, count);
}

function poolOf(params) {
  if (params.chain) return range(params.chain.from, params.chain.to);
  return memorizedAyat(params.s);
}

function commonPrefix(s1, a1, s2, a2) {
  const x = wordsOf(s1, a1).map((w) => w.c);
  const y = wordsOf(s2, a2).map((w) => w.c);
  let k = 0;
  while (k < x.length && k < y.length && x[k] === y[k]) k++;
  return k;
}

function similarPairs(pool, s) {
  const out = [];
  if (!simData) return out;
  pool.forEach((a) => {
    (simData[s + ':' + a] || []).forEach(([s2, a2]) => {
      const k = commonPrefix(s, a, s2, a2);
      if (k >= 2 && k < wordsOf(s, a).length && k < wordsOf(s2, a2).length) out.push({ a, s2, a2, k });
    });
  });
  return out;
}

function quizAvailable(kind, pool, s) {
  if (!pool.length) return false;
  const set = new Set(pool);
  const len = QURAN[s - 1].ayat.length;
  if (kind === 'nextAyah' || kind === 'order') return pool.some((a) => a < len && set.has(a + 1));
  if (kind === 'connect') return pool.filter((a) => wordsOf(s, a).length >= 2).length >= 3;
  if (kind === 'similar') return similarPairs(pool, s).length > 0;
  return true;
}

function quizShell(params, title) {
  const sura = QURAN[params.s - 1];
  const ch = params.chain;
  app.innerHTML = topBar(title, true) + '<main class="wrap"><p class="muted small center">سورة ' + esc(sura.name) +
    (ch ? ' · اختبار ' + arDigits(ch.i + 1) + ' من ' + arDigits(ch.list.length) : ' · سؤال ' + arDigits(params.round || 1) + ' من ٥') + '</p><div id="qbody"></div><div id="result"></div></main>';
}

function nextInChain(params) {
  const ch = params.chain;
  const nx = ch.i + 1;
  if (nx < ch.list.length) go('quiz', { s: params.s, kind: ch.list[nx], chain: Object.assign({}, ch, { i: nx }) }, true);
  else go('lessonDone', { s: params.s, from: ch.from, to: ch.to }, true);
}

function quizDone(params, right, msg) {
  if (right) confettiBurst();
  const ch = params.chain;
  const round = params.round || 1;
  const correct = (params.correct || 0) + (right ? 1 : 0);
  let label;
  if (ch) label = ch.i + 1 < ch.list.length ? 'التالي (' + arDigits(ch.i + 2) + ' من ' + arDigits(ch.list.length) + ')' : 'إتمام الدرس';
  else label = round < 5 ? 'السؤال التالي (' + arDigits(round + 1) + ' من ٥)' : 'عرض النتيجة';
  $('#result').innerHTML = '<div class="result ' + (right ? 'pass' : 'fail') + '"><b>' + msg + '</b><button class="primary" id="qnext">' + label + '</button></div>';
  $('#qnext').onclick = () => {
    if (ch) nextInChain(params);
    else if (round < 5) go('quiz', { s: params.s, kind: params.kind, round: round + 1, correct }, true);
    else go('quizEnd', { s: params.s, kind: params.kind, correct }, true);
  };
}

function screenQuiz(params) {
  const s = params.s;
  if (!QURAN[s - 1]) { go('home', {}, true); return; }
  const pool = poolOf(params);
  const kind = QUIZ[params.kind] ? params.kind : 'arrange';
  if (!quizAvailable(kind, pool, s)) {
    if (params.chain) { nextInChain(params); return; }
    lockedScreen(QUIZ[kind].title, 'احفظ آيات أكتر من السورة عشان النشاط ده يتفتح');
    return;
  }
  const fn = { arrange: qArrange, complete: qComplete, nextWord: qNextWord, nextAyah: qNextAyah, order: qOrder, connect: qConnect, similar: qSimilar }[kind];
  fn(Object.assign({}, params, { kind }), pool);
}

function qArrange(params, pool) {
  const s = params.s;
  const a = pick(pool);
  const tokens = ayahTokens(s, a);
  const [f, t] = meaningSegment(tokens);
  const target = [];
  for (let i = f; i <= t; i++) if (tokens[i].c) target.push(tokens[i]);
  const chips = shuffle(target);
  let pos = 0;
  let errors = 0;
  quizShell(params, QUIZ.arrange.title);
  $('#qbody').innerHTML = '<p class="center small muted">آية ' + arDigits(a) + (f > 0 || t < tokens.length - 1 ? ' · لحد علامة الوقف' : '') + '</p>' +
    '<div class="frame"><div class="frame-in q answer" id="answer"></div></div><div class="wchips">' +
    chips.map((w, j) => '<button class="wchip" data-j="' + j + '">' + w.html + '</button>').join('') + '</div>';
  $$('.wchip').forEach((b) => {
    b.onclick = () => {
      if (pos >= target.length) return;
      const w = chips[+b.dataset.j];
      if (w.c === target[pos].c) {
        b.disabled = true;
        b.classList.add('used');
        $('#answer').insertAdjacentHTML('beforeend', '<span class="w">' + w.html + '</span> ');
        pos++;
        if (pos === target.length) quizDone(params, errors <= 1, errors ? 'أحسنت، بارك الله فيك' : 'إجابة صحيحة كاملة، بارك الله فيك');
      } else {
        errors++;
        b.classList.add('wrong');
        setTimeout(() => b.classList.remove('wrong'), 500);
      }
    };
  });
}

function optionsQuiz(params, title, bodyHtml, options, isRight, revealHtml, wide) {
  quizShell(params, title);
  $('#qbody').innerHTML = bodyHtml + '<div class="opts">' + options.map((o, i) => '<button class="opt-btn' + (wide ? ' ayah' : '') + '" data-i="' + i + '"' + (wide ? ' style="grid-column:span 2"' : '') + '>' + o.html + '</button>').join('') + '</div>';
  let answered = false;
  $$('.opt-btn').forEach((b) => {
    b.onclick = () => {
      if (answered) return;
      answered = true;
      const right = isRight(options[+b.dataset.i]);
      $$('.opt-btn').forEach((x) => { if (isRight(options[+x.dataset.i])) x.classList.add('right'); });
      if (!right) b.classList.add('wrong');
      if (revealHtml) { const fr = $('#qframe'); if (fr) fr.innerHTML = revealHtml; }
      quizDone(params, right, right ? 'إجابة صحيحة، بارك الله فيك' : 'لا بأس، الإجابة الصحيحة باللون الأخضر');
    };
  });
}

function qComplete(params, pool) {
  const s = params.s;
  const a = pick(pool);
  const ws = wordsOf(s, a);
  const cand = ws.map((w, i) => i).filter((i) => ws[i].c.length >= 2);
  const mi = cand.length ? pick(cand) : 0;
  const ans = ws[mi];
  const opts = shuffle([ans].concat(distractors(s, new Set([ans.c]), 3, ans.c.length)));
  const body = '<p class="center small muted">آية ' + arDigits(a) + '</p><div class="frame"><div class="frame-in q answer" id="qframe">' +
    ws.map((w, i) => (i === mi ? '<span class="blank" style="width:3em"></span>' : '<span class="w">' + w.html + '</span>')).join(' ') + '</div></div>';
  const reveal = ws.map((w, i) => '<span class="w' + (i === mi ? ' ok' : '') + '">' + (i === mi ? esc(w.plain) : w.html) + '</span>').join(' ');
  optionsQuiz(params, QUIZ.complete.title, body, opts, (o) => o.c === ans.c, reveal);
}

function qNextWord(params, pool) {
  const s = params.s;
  let cands = pool.filter((a) => wordsOf(s, a).length >= 3);
  if (!cands.length) cands = pool;
  const a = pick(cands);
  const ws = wordsOf(s, a);
  const k = ws.length >= 2 ? 1 + Math.floor(Math.random() * (ws.length - 1)) : 0;
  const ans = ws[k];
  const opts = shuffle([ans].concat(distractors(s, new Set([ans.c]), 3, ans.c.length)));
  const body = '<p class="qtitle">إيه الكلمة الجاية؟</p><div class="frame"><div class="frame-in q answer" id="qframe">' +
    ws.slice(0, k).map((w) => '<span class="w">' + w.html + '</span>').join(' ') + ' <span class="blank" style="width:2.6em"></span></div></div>';
  const reveal = ws.slice(0, k + 1).map((w, i) => '<span class="w' + (i === k ? ' ok' : '') + '">' + (i === k ? esc(w.plain) : w.html) + '</span>').join(' ') + ' …';
  optionsQuiz(params, QUIZ.nextWord.title, body, opts, (o) => o.c === ans.c, reveal);
}

function startOf(s, a) {
  const ws = wordsOf(s, a);
  return ws.slice(0, 5).map((w) => w.plain).join(' ') + (ws.length > 5 ? ' …' : '');
}

function qNextAyah(params, pool) {
  const s = params.s;
  const set = new Set(pool);
  const len = QURAN[s - 1].ayat.length;
  const a = pick(pool.filter((x) => x < len && set.has(x + 1)));
  const others = shuffle(range(1, len).filter((x) => x !== a + 1 && x !== a)).slice(0, 3);
  const opts = shuffle([a + 1].concat(others)).map((x) => ({ x, html: esc(startOf(s, x)) }));
  const body = '<p class="center small muted">آية ' + arDigits(a) + '</p><div class="frame"><div class="frame-in q answer">' +
    ayahTokens(s, a).map((t) => (t.c ? '<span class="w">' + t.html + '</span>' : '<span class="mark">' + esc(t.plain) + '</span>')).join(' ') +
    '</div></div><p class="qtitle">إيه الآية اللي بعدها؟</p>';
  optionsQuiz(params, QUIZ.nextAyah.title, body, opts, (o) => o.x === a + 1, null, true);
}

function qOrder(params, pool) {
  const s = params.s;
  const sorted = pool.slice().sort((x, y) => x - y);
  const runs = [];
  let cur = [];
  sorted.forEach((a) => { if (cur.length && a === cur[cur.length - 1] + 1) cur.push(a); else { if (cur.length >= 2) runs.push(cur); cur = [a]; } });
  if (cur.length >= 2) runs.push(cur);
  const run = pick(runs);
  const st = Math.floor(Math.random() * Math.max(1, run.length - 3));
  const seq = run.slice(st, st + 4);
  const items = shuffle(seq);
  let pos = 0;
  let errors = 0;
  quizShell(params, QUIZ.order.title);
  $('#qbody').innerHTML = '<p class="qtitle">دوس على الآيات بالترتيب</p><div class="frame"><div class="frame-in q answer" id="answer"></div></div>' +
    '<div class="col" style="margin-top:12px">' + items.map((a, j) => '<button class="cbox" data-j="' + j + '">' + esc(startOf(s, a)) + '</button>').join('') + '</div>';
  $$('.cbox').forEach((b) => {
    b.onclick = () => {
      if (b.classList.contains('right')) return;
      const a = items[+b.dataset.j];
      if (a === seq[pos]) {
        b.classList.add('right');
        $('#answer').insertAdjacentHTML('beforeend', '<div style="font-size:.8em">' + esc(startOf(s, a)) + ' <span class="anum">﴿' + arDigits(a) + '﴾</span></div>');
        pos++;
        if (pos === seq.length) quizDone(params, errors <= 1, errors ? 'أحسنت، بارك الله فيك' : 'إجابة صحيحة كاملة، بارك الله فيك');
      } else {
        errors++;
        b.classList.add('wrong');
        setTimeout(() => b.classList.remove('wrong'), 500);
      }
    };
  });
}

function qConnect(params, pool) {
  const s = params.s;
  const elig = pool.filter((a) => wordsOf(s, a).length >= 2);
  const chosen = shuffle(elig).slice(0, 4).sort((x, y) => x - y);
  const pairs = chosen.map((a, k) => {
    const tokens = ayahTokens(s, a);
    const ws = wordsOf(s, a);
    let cutW = Math.ceil(ws.length / 2);
    const marks = [];
    let wc = 0;
    tokens.forEach((t) => { if (t.c) wc++; else if (/[\u06D6\u06D7\u06D8\u06DA\u06DB]/.test(t.plain) && wc > 0 && wc < ws.length) marks.push(wc); });
    if (marks.length) cutW = marks.reduce((b, m) => (Math.abs(m - ws.length / 2) < Math.abs(b - ws.length / 2) ? m : b), marks[0]);
    const start = ws.slice(0, cutW).slice(0, 6).map((t) => t.plain).join(' ') + (cutW > 6 ? ' …' : '');
    const rest = ws.slice(cutW);
    const end = (rest.length > 6 ? '… ' : '') + rest.slice(-6).map((t) => t.plain).join(' ');
    return { k, start, end };
  });
  const ends = shuffle(pairs);
  let sel = -1;
  let done = 0;
  let errors = 0;
  quizShell(params, QUIZ.connect.title);
  $('#qbody').innerHTML = '<p class="qtitle">اختار بداية الآية، وبعدين نهايتها</p><div class="connect"><div class="col" id="starts">' +
    pairs.map((x) => '<button class="cbox" data-k="' + x.k + '">' + esc(x.start) + '</button>').join('') + '</div><div class="col" id="ends">' +
    ends.map((x) => '<button class="cbox" data-k="' + x.k + '">' + esc(x.end) + '</button>').join('') + '</div></div>';
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
        if (done === pairs.length) quizDone(params, errors <= 1, errors ? 'أحسنت، بارك الله فيك' : 'إجابة صحيحة كاملة، بارك الله فيك');
      } else {
        errors++;
        b.classList.add('wrong');
        setTimeout(() => b.classList.remove('wrong'), 500);
      }
    };
  });
}

function qSimilar(params, pool) {
  const s = params.s;
  const pairs = similarPairs(pool, s);
  const pr = pick(pairs);
  const ws = wordsOf(s, pr.a);
  const cont = (ss, aa, k) => { const all = wordsOf(ss, aa); return all.slice(k, k + 4).map((x) => x.plain).join(' ') + (all.length > k + 4 ? ' …' : ''); };
  const options = [{ right: true, html: esc(cont(s, pr.a, pr.k)) }];
  const seen = new Set([options[0].html]);
  pairs.filter((x) => x.a === pr.a).forEach((x) => { const h = esc(cont(x.s2, x.a2, x.k)); if (h && !seen.has(h)) { seen.add(h); options.push({ right: false, html: h }); } });
  let guard = 0;
  while (options.length < 3 && guard++ < 50) {
    const rs = 1 + Math.floor(Math.random() * 114);
    const ra = 1 + Math.floor(Math.random() * QURAN[rs - 1].ayat.length);
    const h = esc(cont(rs, ra, Math.min(pr.k, Math.max(0, wordsOf(rs, ra).length - 1))));
    if (h && !seen.has(h)) { seen.add(h); options.push({ right: false, html: h }); }
  }
  const body = '<p class="qtitle">كمّل الآية دي من سورة ' + esc(QURAN[s - 1].name) + ' (آية ' + arDigits(pr.a) + ')</p>' +
    '<div class="frame"><div class="frame-in q answer" id="qframe">' + ws.slice(0, pr.k).map((w) => '<span class="w">' + w.html + '</span>').join(' ') + ' …</div></div>' +
    '<p class="muted small center">البداية دي موجودة كمان في سورة ' + esc(QURAN[pr.s2 - 1].name) + '، فانتبه للتكملة</p>';
  const reveal = ws.slice(0, pr.k + 4).map((w, i) => '<span class="w' + (i >= pr.k ? ' ok' : '') + '">' + (i >= pr.k ? esc(w.plain) : w.html) + '</span>').join(' ') + (ws.length > pr.k + 4 ? ' …' : '');
  optionsQuiz(params, QUIZ.similar.title, body, shuffle(options), (o) => o.right, reveal, true);
}

function screenQuizEnd(params) {
  const s = params.s;
  const q = QUIZ[params.kind] || { title: 'النشاط' };
  const c = params.correct || 0;
  if (c >= 4) confettiBurst();
  const msg = c === 5 ? 'إجابات صحيحة كلها، بارك الله فيك وزادك علمًا' : c >= 3 ? 'أحسنت، بارك الله فيك' : 'لا بأس، راجع الآيات وحاول مرة أخرى، وفقك الله';
  app.innerHTML = topBar(q.title, true) + '<main class="wrap"><div class="card empty">' + medal(76, c >= 3) +
    '<b style="font-size:22px;margin-top:8px">' + arDigits(c) + ' من ٥</b><p class="muted">' + msg + '</p>' +
    '<button class="primary" id="again">أعد النشاط</button><button class="light-btn" id="backActs">رجوع للأنشطة</button></div></main>';
  $('#again').onclick = () => go('quiz', { s, kind: params.kind }, true);
  $('#backActs').onclick = () => goBack();
}

function screenLessonDone(params) {
  const s = params.s;
  const sura = QURAN[s - 1];
  const lessons = lessonsOf(s);
  const idx = lessons.findIndex((l) => l.from === params.from);
  const nextL = lessons[idx + 1];
  confettiBurst();
  app.innerHTML = topBar('سورة ' + sura.name, true) + '<main class="wrap"><div class="card empty">' + medal(80, true) +
    '<b style="font-size:20px;margin-top:8px">أتممت الدرس، ما شاء الله تبارك الله</b><p class="muted">' + (params.from === params.to ? 'آية ' + arDigits(params.from) : 'آيات ' + arDigits(params.from) + ' – ' + arDigits(params.to)) + ' بقت في محفوظك</p>' +
    (nextL ? '<button class="primary" id="nextL">الدرس التالي</button>' : '<p class="gold">أتممت كل دروس السورة</p><button class="primary" id="reciteAll">سمّع السورة كاملة</button>') +
    '<button class="light-btn" id="toSurah">رجوع للسورة</button></div></main>';
  const nl = $('#nextL'); if (nl) nl.onclick = () => go('practice', { s, a: nextL.from }, true);
  const ra = $('#reciteAll'); if (ra) ra.onclick = () => go('recite', { s, from: 1, to: sura.ayat.length, purpose: 'surah' }, true);
  $('#toSurah').onclick = () => go('surah', { s }, true);
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
        const words = wordsOf(s, a).slice(0, 5).map((t) => t.plain).join(' ');
        return '<button class="row" data-s="' + s + '" data-a="' + a + '"><span class="count">' + c + '</span><div class="grow"><b class="qf">' + esc(QURAN[s - 1].name) + ' · آية ' + arDigits(a) +
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
      (hadSkips ? 'خلّصت المراجعة المتاحة' : 'أتممت مراجعة اليوم، تقبّل الله منك') +
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
  const card = (kind) => {
    const q = QUIZ[kind];
    const ok = quizAvailable(kind, mem, s);
    return '<button class="row' + (ok ? '' : ' locked') + '" data-kind="' + kind + '"' + (ok ? '' : ' data-locked="1"') + '><span class="act-ic">' +
      icon(ok ? q.icon : 'lock', 22) + '</span><div class="grow"><b>' + q.title + '</b><small>' + q.desc + '</small></div>' + icon('chevronLeft', 18) + '</button>';
  };
  app.innerHTML = topBar('أنشطة سورة ' + sura.name, true) + '<main class="wrap"><p class="muted small">محفوظ ' + mem.length + ' من ' + sura.ayat.length + ' آية</p>' +
    Object.keys(QUIZ).map(card).join('') + divider() + reciteRangeCard(sura.ayat.length, 'ac') + '</main>';
  $$('[data-kind]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.locked) { toast('احفظ آيات أكتر من السورة عشان النشاط ده يتفتح'); return; }
      go('quiz', { s, kind: b.dataset.kind });
    };
  });
  bindReciteRange(s, sura.ayat.length, 'ac');
}

function screenFamily() {
  const t = dayKey();
  const days = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const week = range(0, 6).map((i) => { const d = new Date(); d.setDate(d.getDate() + i - 6); return { k: dayKey(i - 6), n: days[d.getDay()] }; });
  app.innerHTML = topBar('لوحة المتابعة', true) + '<main class="wrap">' + db.profiles.map((pp) => {
    const vals = Object.values(pp.ayat || {});
    const mem = vals.filter((x) => x.lvl >= 1).length;
    const due = vals.filter((x) => x.lvl >= 1 && x.due && x.due <= t).length;
    const acc = pp.attempts ? Math.round(pp.scoreSum / pp.attempts) + '%' : '—';
    const set = new Set(pp.days || []);
    const mistakes = Object.entries(pp.mistakes || {}).sort((x, y) => y[1] - x[1]).slice(0, 3);
    return '<section class="card"><div class="row-h"><span class="initial">' + esc(pp.name.charAt(0)) + '</span><div class="grow"><b>' + esc(pp.name) + '</b><small class="muted">' +
      (pp.mode === 'kids' ? 'وضع الطفل' : 'وضع الكبار') + (planActive(pp) ? ' · خطة ' + PLAN_NAMES[pp.plan] : '') + '</small></div></div>' +
      '<div class="stats4"><div><b>' + arDigits(mem) + '</b><small>محفوظ</small></div><div><b>' + arDigits(due) + '</b><small>للمراجعة</small></div>' +
      '<div><b>' + acc + '</b><small>الدقة</small></div><div><b>' + arDigits(streakOf(pp)) + '</b><small>أيام متتالية</small></div></div>' +
      '<div class="week">' + week.map((w) => '<span><i class="' + (set.has(w.k) ? 'on' : '') + '"></i><small>' + w.n + '</small></span>').join('') + '</div>' +
      (mistakes.length ? '<p class="muted small">أكتر آيات محتاجة تركيز: ' + mistakes.map(([k]) => { const [ss, aa] = k.split(':').map(Number); return esc(QURAN[ss - 1].name) + ' ' + arDigits(aa); }).join('، ') + '</p>' : '') +
      '</section>';
  }).join('') + '</main>';
}

function screenSettings() {
  const p = profile();
  const st = db.settings;
  const seg = (id, values, current, fmt) => '<div class="seg" id="' + id + '">' +
    values.map((v) => '<button data-v="' + v + '" class="' + (String(current) === String(v) ? 'on' : '') + '">' + (fmt ? fmt(v) : v) + '</button>').join('') + '</div>';
  app.innerHTML = topBar('الإعدادات', true) + '<main class="wrap">' +
    '<section class="card"><h2>المظهر</h2>' + seg('themeSeg', ['auto', 'light', 'dark'], st.theme, (v) => ({ auto: 'تلقائي', light: 'نهاري', dark: 'ليلي' }[v])) + '</section>' +
    '<section class="card"><h2>القارئ</h2>' + RECITERS.map((r) =>
      '<label class="opt"><input type="radio" name="reciter" value="' + r.id + '" ' + (reciterId(p) === r.id ? 'checked' : '') + '> ' + r.name + '</label>').join('') + '</section>' +
    '<section class="card"><h2>وِرد اليوم (آيات جديدة)</h2>' + seg('goalSeg', GOALS, p.goal) + '</section>' +
    '<section class="card"><h2>خطة الحفظ</h2>' + seg('planSeg', ['none', 'amma', 'tabarak', 'all'], p.plan || 'none', (v) => PLAN_NAMES[v]) + '<p class="muted small">الخطة بتختارلك الآية الجاية لوحدها، وبتحسب هتتمّها إمتى على حسب وِردك اليومي.</p></section>' +
    '<section class="card"><h2>عدد مرات الاستماع للمقطع</h2>' + seg('repSeg', REPEATS, p.repeat) + '</section>' +
    '<section class="card"><h2>التذكير اليومي</h2>' + seg('remSeg', ['on', 'off'], st.reminder.on ? 'on' : 'off', (v) => (v === 'on' ? 'شغّال' : 'مقفول')) +
    '<label class="opt"><span>الوقت</span><input type="time" id="remTime" class="time" value="' + esc(st.reminder.time) + '"></label>' +
    '<button class="light-btn" id="remTest">جرّب الإشعار دلوقتي</button></section>' +
    '<section class="card"><h2>ألوان التجويد</h2>' + seg('tjSeg', ['on', 'off'], p.tajweed === false ? 'off' : 'on', (v) => (v === 'on' ? 'ظاهرة' : 'مخفية')) +
    '<div class="legend">' + LEGEND.map(([cls, label]) => '<span><b class="dot" style="background:var(--' + cls + ')"></b>' + label + '</span>').join('') + '</div></section>' +
    '<section class="card"><h2>الوضع</h2>' + seg('modeSeg', ['adult', 'kids'], p.mode, (v) => (v === 'kids' ? 'طفل' : 'كبير')) +
    '<p class="muted small">نسبة النجاح في التسميع: ' + passMark(p) + '%</p></section>' +
    '<section class="card"><h2>لوحة المتابعة</h2><p class="muted small">تقدّم كل أفراد العيلة في مكان واحد.</p><button class="light-btn" id="family">افتح لوحة المتابعة</button></section>' +
    '<section class="card"><h2>النسخة الاحتياطية</h2><p class="muted small">احفظ تقدمك كله في ملف، وتقدر ترجّعه على أي موبايل.</p>' +
    '<button class="light-btn" id="exp">حفظ نسخة احتياطية</button><button class="light-btn" id="imp">استرجاع نسخة</button>' +
    '<input type="file" id="impFile" accept=".json,application/json" hidden></section>' +
    '<section class="card"><h2>مصحح التلاوة</h2><p class="muted small">موديل ترتيل للتعرف على التلاوة، شغال على الموبايل نفسه من غير إنترنت. بيكتشف الكلمات الخطأ والناقصة، ومش بديل عن الشيخ.</p></section>' +
    '<section class="card"><h2>الملف الشخصي</h2><button class="light-btn" id="switch">تغيير الملف</button>' +
    '<button class="danger-btn" id="del">حذف ملف ' + esc(p.name) + '</button></section></main>';
  $$('#themeSeg button').forEach((b) => { b.onclick = () => { st.theme = b.dataset.v; save(); render(history.state); }; });
  $$('input[name=reciter]').forEach((r) => { r.onchange = () => { p.reciter = r.value; save(); stopAudio(); toast('تم تغيير القارئ'); }; });
  $$('#goalSeg button').forEach((b) => { b.onclick = () => { p.goal = +b.dataset.v; save(); render(history.state); }; });
  $$('#planSeg button').forEach((b) => { b.onclick = () => { p.plan = b.dataset.v; save(); render(history.state); }; });
  $$('#repSeg button').forEach((b) => { b.onclick = () => { p.repeat = +b.dataset.v; save(); render(history.state); }; });
  $$('#remSeg button').forEach((b) => {
    b.onclick = async () => {
      st.reminder.on = b.dataset.v === 'on';
      save();
      await scheduleReminders();
      render(history.state);
    };
  });
  $('#remTime').onchange = (e) => {
    st.reminder.time = e.target.value || '20:00';
    save();
    if (st.reminder.on) scheduleReminders();
  };
  $('#remTest').onclick = () => scheduleReminders({ test: true });
  $$('#tjSeg button').forEach((b) => { b.onclick = () => { p.tajweed = b.dataset.v === 'on'; save(); render(history.state); }; });
  $$('#modeSeg button').forEach((b) => { b.onclick = () => { p.mode = b.dataset.v; save(); render(history.state); }; });
  $('#family').onclick = () => go('family');
  $('#exp').onclick = () => exportBackup();
  $('#imp').onclick = () => $('#impFile').click();
  $('#impFile').onchange = (e) => importBackup(e.target.files && e.target.files[0]);
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
  applyTheme();
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
      case 'surah': screenSurah(params); break;
      case 'practice': screenPractice(params); break;
      case 'recite': screenRecite(params); break;
      case 'quiz': screenQuiz(params); break;
      case 'quizEnd': screenQuizEnd(params); break;
      case 'lessonDone': screenLessonDone(params); break;
      case 'reviewHub': screenReviewHub(); break;
      case 'review': screenReview(); break;
      case 'activities': screenActivities(); break;
      case 'surahActs': screenSurahActs(params); break;
      case 'awards': screenAwards(); break;
      case 'family': screenFamily(); break;
      case 'settings': screenSettings(); break;
      default: screenHome();
    }
  }
  document.body.classList.toggle('has-nav', !!app.querySelector('.nav'));
}

async function init() {
  applyTheme();
  initDataBase();
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (db.settings.theme === 'auto') applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
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
  getSimilar();
  const prev = history.state && history.state.screen ? history.state : null;
  const state = prev ? Object.assign({ depth: 0 }, prev) : { screen: profile() ? 'home' : 'profiles', params: {}, depth: 0 };
  history.replaceState(state, '');
  render(state);
  if (db.settings.reminder.on) scheduleReminders({ silent: true });
}

init();
