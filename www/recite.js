const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let worker = null;
let seq = 0;
const pending = new Map();
let readyP = null;
let ready = false;
let ctx = null;
let src = null;
let proc = null;
let stream = null;
let active = false;
let token = 0;
let fresh = 0;
let onScript = null;

function getWorker() {
  if (worker) return worker;
  worker = new Worker('tajweed-worker.js');
  worker.onmessage = (e) => {
    const m = e.data || {};
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.type === 'error') p.reject(new Error(m.message || 'error'));
    else p.resolve(m);
  };
  worker.onerror = (e) => {
    for (const [, p] of pending) p.reject(new Error((e && e.message) || 'worker error'));
    pending.clear();
    worker = null;
    readyP = null;
    ready = false;
  };
  return worker;
}

function call(type, payload, transfer) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    try {
      getWorker().postMessage(Object.assign({ id, type }, payload || {}), transfer || []);
    } catch (e) {
      pending.delete(id);
      reject(e);
    }
  });
}

export const isReady = () => ready;

export function initEngine() {
  if (ready) return Promise.resolve();
  if (!readyP) {
    readyP = call('init').then(() => { ready = true; }).catch((e) => { readyP = null; throw e; });
  }
  return readyP;
}

export async function startListening(cb) {
  await initEngine();
  stopListening();
  await call('reset');
  stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const C = window.AudioContext || window.webkitAudioContext;
  ctx = new C();
  try { await ctx.resume(); } catch (e) { /* ignore */ }
  src = ctx.createMediaStreamSource(stream);
  proc = ctx.createScriptProcessor(4096, 1, 1);
  const rate = ctx.sampleRate;
  proc.onaudioprocess = (e) => {
    if (!active) return;
    const d = new Float32Array(e.inputBuffer.getChannelData(0));
    fresh += (d.length * 16000) / rate;
    try { getWorker().postMessage({ type: 'audio', data: d, rate }, [d.buffer]); } catch (err) { /* ignore */ }
  };
  src.connect(proc);
  proc.connect(ctx.destination);
  onScript = cb;
  fresh = 0;
  active = true;
  loop(++token);
}

async function loop(tk) {
  while (active && tk === token) {
    await sleep(150);
    if (!active || tk !== token) return;
    if (fresh < 4800) continue;
    fresh = 0;
    try {
      const r = await call('infer');
      if (active && tk === token && onScript) onScript(r.script || '');
    } catch (e) {
      console.error(e);
      await sleep(500);
    }
  }
}

export function stopListening() {
  active = false;
  token++;
  onScript = null;
  try { if (proc) { proc.onaudioprocess = null; proc.disconnect(); } } catch (e) { /* ignore */ }
  try { if (src) src.disconnect(); } catch (e) { /* ignore */ }
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (ctx) ctx.close().catch(() => {});
  proc = null;
  src = null;
  stream = null;
  ctx = null;
}

export async function inferNow() {
  try {
    const r = await call('infer');
    return r.script || '';
  } catch (e) {
    return '';
  }
}

const collapse = (s) => s.replace(/(.)\1+/g, '$1');

export function refSkeleton(plain) {
  let s = String(plain).replace(/\uFEFF/g, '');
  const fathatan = /\u064B/.test(s);
  const tanween = fathatan || /[\u064C\u064D]/.test(s);
  s = s.replace(/ى([\u064B-\u065F\u06D6-\u06ED]*)\u0670/g, 'ى$1').replace(/\u0670/g, 'ا');
  s = s.replace(/[\u064B-\u065F\u06D6-\u06ED\u0640]/g, '');
  s = s.replace(/^([وفبك]?)ٱل([تثدذرزسشصضطظلن])/, '$1$2').replace(/^([وفبك]?)ٱ/, '$1').replace(/ٱ/g, '');
  if (fathatan) s = s.replace(/[اى]$/, '');
  s = s.replace(/آ/g, 'ا').replace(/[أإء]/g, '').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ى/g, 'ي').replace(/ة/g, 'ت');
  s = s.replace(/وا$/, 'و');
  if (tanween) s += 'ن';
  s = s.replace(/[^\u0621-\u064A]/g, '');
  return collapse(s);
}

export function heardSkeleton(script) {
  const s = String(script)
    .replace(/[\u064E\u064F\u0650\u06EA\u0640\u06DC\u0619\u0687]/g, '')
    .replace(/\u06E6/g, 'ي').replace(/\u06E5/g, 'و').replace(/\u0672/g, 'ا')
    .replace(/\u06BA/g, 'ن').replace(/\u06FE/g, 'م').replace(/ء/g, '')
    .replace(/[^\u0621-\u064A]/g, '');
  return collapse(s);
}

const VOWELS = 'اوي';
const gapCost = (c) => (VOWELS.includes(c) ? 0.5 : 1);
function subCost(a, b) {
  if (a === b) return 0;
  if ((a === 'ت' && b === 'ه') || (a === 'ه' && b === 'ت')) return 0.3;
  if (VOWELS.includes(a) && VOWELS.includes(b)) return 0.5;
  return 1;
}

export function alignWords(words, heard, final) {
  const ref = [];
  words.forEach((w, wi) => { for (const ch of w) ref.push({ c: ch, w: wi, m: false }); });
  const out = words.map((w) => ({ ratio: w.length ? 0 : 1, done: false }));
  const R = ref.length;
  const H = heard.length;
  if (!R) { out.forEach((o) => { o.done = true; }); return out; }
  if (!H) { if (final) out.forEach((o) => { o.done = true; }); return out; }
  const W = H + 1;
  const dp = new Float32Array((R + 1) * W);
  const bt = new Uint8Array((R + 1) * W);
  for (let j = 1; j <= H; j++) { dp[j] = dp[j - 1] + 0.35; bt[j] = 2; }
  for (let i = 1; i <= R; i++) { dp[i * W] = dp[(i - 1) * W] + gapCost(ref[i - 1].c); bt[i * W] = 1; }
  for (let i = 1; i <= R; i++) {
    const rc = ref[i - 1].c;
    for (let j = 1; j <= H; j++) {
      const hc = heard[j - 1];
      const sub = dp[(i - 1) * W + j - 1] + subCost(rc, hc);
      const del = dp[(i - 1) * W + j] + gapCost(rc);
      const ins = dp[i * W + j - 1] + gapCost(hc);
      let best = sub;
      let b = 0;
      if (del < best) { best = del; b = 1; }
      if (ins < best) { best = ins; b = 2; }
      dp[i * W + j] = best;
      bt[i * W + j] = b;
    }
  }
  let iEnd = R;
  let jEnd = H;
  if (final) {
    let bv = Infinity;
    for (let j = 0; j <= H; j++) {
      const v = dp[R * W + j] + 0.35 * (H - j);
      if (v < bv) { bv = v; jEnd = j; }
    }
  } else {
    let bv = Infinity;
    for (let i = 0; i <= R; i++) {
      const v = dp[i * W + H] - 0.6 * i;
      if (v < bv) { bv = v; iEnd = i; }
    }
  }
  let i = iEnd;
  let j = jEnd;
  while (i > 0 && j > 0) {
    const b = bt[i * W + j];
    if (b === 0) {
      if (subCost(ref[i - 1].c, heard[j - 1]) < 0.6) ref[i - 1].m = true;
      i--; j--;
    } else if (b === 1) {
      i--;
    } else {
      j--;
    }
  }
  const tot = words.map(() => 0);
  const hit = words.map(() => 0);
  const lastIdx = words.map(() => -1);
  ref.forEach((r, idx) => { tot[r.w]++; if (r.m) hit[r.w]++; lastIdx[r.w] = idx; });
  words.forEach((w, wi) => {
    if (!tot[wi]) { out[wi].ratio = 1; out[wi].done = final || (wi === 0 ? iEnd > 0 : lastIdx[wi - 1] < iEnd); return; }
    out[wi].ratio = hit[wi] / tot[wi];
    out[wi].done = final || lastIdx[wi] < iEnd;
  });
  return out;
}
