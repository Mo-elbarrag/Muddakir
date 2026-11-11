const PHONEMES = ['ء','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي','ا','ۦ','ۥ','َ','ُ','ِ','۪','ـ','ٲ','ڇ','ں','۾','ۜ','ؙ'];
const N_FFT = 400;
const HOP = 160;
const NB = 201;
const N_MELS = 80;
const LEAD = 6400;
const CAP = 16000 * 58;
const KEEP = 16000 * 30;
const BASE = self.location.href.replace(/[^/]*$/, '');

let ortLib = null;
let session = null;
let initP = null;
let queue = Promise.resolve();

const win = new Float32Array(N_FFT);
for (let i = 0; i < N_FFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT);
const cosT = new Float32Array(NB * N_FFT);
const sinT = new Float32Array(NB * N_FFT);
for (let k = 0; k < NB; k++) {
  for (let n = 0; n < N_FFT; n++) {
    const a = (2 * Math.PI * k * n) / N_FFT;
    cosT[k * N_FFT + n] = Math.cos(a);
    sinT[k * N_FFT + n] = Math.sin(a);
  }
}

function hzToMel(f) {
  const fsp = 200 / 3;
  if (f < 1000) return f / fsp;
  return 1000 / fsp + Math.log(f / 1000) / (Math.log(6.4) / 27);
}

function melToHz(m) {
  const fsp = 200 / 3;
  const minLog = 1000 / fsp;
  if (m < minLog) return m * fsp;
  return 1000 * Math.exp((Math.log(6.4) / 27) * (m - minLog));
}

const melFB = (() => {
  const fb = new Float32Array(N_MELS * NB);
  const mMin = hzToMel(0);
  const mMax = hzToMel(8000);
  const pts = new Float32Array(N_MELS + 2);
  for (let i = 0; i < N_MELS + 2; i++) pts[i] = melToHz(mMin + ((mMax - mMin) * i) / (N_MELS + 1));
  for (let m = 0; m < N_MELS; m++) {
    const lo = pts[m];
    const c = pts[m + 1];
    const hi = pts[m + 2];
    const enorm = 2 / (hi - lo);
    for (let k = 0; k < NB; k++) {
      const f = (k * 16000) / N_FFT;
      const w = Math.max(0, Math.min((f - lo) / (c - lo), (hi - f) / (hi - c)));
      fb[m * NB + k] = w * enorm;
    }
  }
  return fb;
})();

const audio = new Float32Array(CAP);
let len = LEAD;
const cache = new Float32Array(Math.ceil(CAP / HOP) * N_MELS);
let cached = 0;
let leftover = new Float32Array(0);
let rsPos = 0;
const frameBuf = new Float32Array(N_FFT);
const powBuf = new Float32Array(NB);

function reset() {
  audio.fill(0, 0, LEAD);
  len = LEAD;
  cached = 0;
  leftover = new Float32Array(0);
  rsPos = 0;
}

function append(samples) {
  if (len + samples.length > CAP) {
    const from = Math.max(LEAD, len - KEEP);
    audio.copyWithin(LEAD, from, len);
    audio.fill(0, 0, LEAD);
    len = LEAD + (len - from);
    cached = 0;
  }
  const n = Math.min(samples.length, CAP - len);
  if (n <= 0) return;
  audio.set(samples.subarray(0, n), len);
  len += n;
}

function pushAudio(data, rate) {
  if (!data || !data.length) return;
  if (Math.abs(rate - 16000) < 1) { append(data); return; }
  const ratio = rate / 16000;
  const inp = new Float32Array(leftover.length + data.length);
  inp.set(leftover, 0);
  inp.set(data, leftover.length);
  const out = new Float32Array(Math.ceil(inp.length / ratio) + 2);
  let o = 0;
  let pos = rsPos;
  while (pos + ratio <= inp.length) {
    const a = Math.floor(pos);
    const b = Math.max(a + 1, Math.floor(pos + ratio));
    let s = 0;
    for (let i = a; i < b; i++) s += inp[i];
    out[o++] = s / (b - a);
    pos += ratio;
  }
  const consumed = Math.floor(pos);
  leftover = inp.slice(consumed);
  rsPos = pos - consumed;
  append(out.subarray(0, o));
}

function melFrame(t, out, off) {
  const c = t * HOP - N_FFT / 2;
  for (let n = 0; n < N_FFT; n++) {
    const idx = c + n;
    frameBuf[n] = (idx >= 0 && idx < len ? audio[idx] : 0) * win[n];
  }
  for (let k = 0; k < NB; k++) {
    let re = 0;
    let im = 0;
    const base = k * N_FFT;
    for (let n = 0; n < N_FFT; n++) {
      const v = frameBuf[n];
      re += v * cosT[base + n];
      im -= v * sinT[base + n];
    }
    powBuf[k] = re * re + im * im;
  }
  for (let m = 0; m < N_MELS; m++) {
    let s = 0;
    const b = m * NB;
    for (let k = 0; k < NB; k++) s += melFB[b + k] * powBuf[k];
    out[off + m] = s;
  }
}

async function init() {
  if (session) return;
  if (!initP) {
    initP = (async () => {
      try { importScripts(BASE + 'vendor/ort/ort.wasm.min.js'); } catch (e) { importScripts(BASE + 'vendor/ort/ort.min.js'); }
      ortLib = self.ort;
      ortLib.env.wasm.numThreads = 1;
      ortLib.env.wasm.wasmPaths = BASE + 'vendor/ort/';
      session = await ortLib.InferenceSession.create(BASE + 'models/tajweed-int8.onnx', { executionProviders: ['wasm'] });
    })();
    initP.catch(() => { initP = null; });
  }
  return initP;
}

async function infer() {
  await init();
  const total = len + LEAD;
  const F = Math.floor(total / HOP);
  const cacheable = Math.max(0, Math.floor((len - N_FFT / 2) / HOP) + 1);
  const upto = Math.min(cacheable, F);
  while (cached < upto) { melFrame(cached, cache, cached * N_MELS); cached++; }
  let start = F > 3000 ? F - 3000 : 0;
  let n = F - start;
  if (n % 2) { start++; n--; }
  if (n < 20) return '';
  const mel = new Float32Array(N_MELS * n);
  const tmp = new Float32Array(N_MELS);
  let maxv = -Infinity;
  for (let f = 0; f < n; f++) {
    const t = start + f;
    let src = cache;
    let off = t * N_MELS;
    if (t >= cached) { melFrame(t, tmp, 0); src = tmp; off = 0; }
    for (let m = 0; m < N_MELS; m++) {
      const v = Math.log10(Math.max(src[off + m], 1e-10));
      mel[m * n + f] = v;
      if (v > maxv) maxv = v;
    }
  }
  const floor = maxv - 8;
  for (let i = 0; i < mel.length; i++) {
    const v = mel[i] < floor ? floor : mel[i];
    mel[i] = (v + 4) / 4;
  }
  const feeds = {
    mel: new ortLib.Tensor('float32', mel, [1, N_MELS, n]),
    riwaya: new ortLib.Tensor('int64', BigInt64Array.from([0n]), [1])
  };
  const out = await session.run(feeds);
  const lp = out.logprobs || out[Object.keys(out)[0]];
  const T = lp.dims[1];
  const V = lp.dims[2];
  const d = lp.data;
  let prev = 0;
  let s = '';
  for (let t = 0; t < T; t++) {
    let best = 0;
    let bv = -Infinity;
    const b = t * V;
    for (let v = 0; v < V; v++) {
      if (d[b + v] > bv) { bv = d[b + v]; best = v; }
    }
    if (best !== prev && best !== 0) s += PHONEMES[best - 1] || '';
    prev = best;
  }
  return s;
}

function melFrameSrc(src, srcLen, t, out, off) {
  const c = t * HOP - N_FFT / 2;
  for (let n = 0; n < N_FFT; n++) {
    const idx = c + n;
    frameBuf[n] = (idx >= 0 && idx < srcLen ? src[idx] : 0) * win[n];
  }
  for (let k = 0; k < NB; k++) {
    let re = 0;
    let im = 0;
    const base = k * N_FFT;
    for (let n = 0; n < N_FFT; n++) {
      const v = frameBuf[n];
      re += v * cosT[base + n];
      im -= v * sinT[base + n];
    }
    powBuf[k] = re * re + im * im;
  }
  for (let m = 0; m < N_MELS; m++) {
    let sum = 0;
    const b = m * NB;
    for (let k = 0; k < NB; k++) sum += melFB[b + k] * powBuf[k];
    out[off + m] = sum;
  }
}

async function scriptOfPcm(pcm) {
  await init();
  const L = LEAD + pcm.length + LEAD;
  const src = new Float32Array(L);
  src.set(pcm, LEAD);
  const F = Math.floor(L / HOP);
  let start = F > 3000 ? F - 3000 : 0;
  let n = F - start;
  if (n % 2) { start++; n--; }
  if (n < 20) return '';
  const mel = new Float32Array(N_MELS * n);
  const tmp = new Float32Array(N_MELS);
  let maxv = -Infinity;
  for (let fr = 0; fr < n; fr++) {
    melFrameSrc(src, L, start + fr, tmp, 0);
    for (let m = 0; m < N_MELS; m++) {
      const v = Math.log10(Math.max(tmp[m], 1e-10));
      mel[m * n + fr] = v;
      if (v > maxv) maxv = v;
    }
  }
  const floor = maxv - 8;
  for (let i = 0; i < mel.length; i++) {
    const v = mel[i] < floor ? floor : mel[i];
    mel[i] = (v + 4) / 4;
  }
  const out = await session.run({
    mel: new ortLib.Tensor('float32', mel, [1, N_MELS, n]),
    riwaya: new ortLib.Tensor('int64', BigInt64Array.from([0n]), [1])
  });
  const lp = out.logprobs || out[Object.keys(out)[0]];
  const T = lp.dims[1];
  const V = lp.dims[2];
  const d = lp.data;
  let prev = 0;
  let res = '';
  for (let t = 0; t < T; t++) {
    let best = 0;
    let bv = -Infinity;
    const b = t * V;
    for (let v = 0; v < V; v++) { if (d[b + v] > bv) { bv = d[b + v]; best = v; } }
    if (best !== prev && best !== 0) res += PHONEMES[best - 1] || '';
    prev = best;
  }
  return res;
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'audio') { pushAudio(msg.data, msg.rate); return; }
  if (msg.type === 'reset') { reset(); self.postMessage({ id: msg.id, type: 'done' }); return; }
  if (msg.type === 'init') {
    init().then(() => self.postMessage({ id: msg.id, type: 'done' }))
      .catch((err) => self.postMessage({ id: msg.id, type: 'error', message: String((err && err.message) || err) }));
    return;
  }
  if (msg.type === 'analyze') {
    queue = queue.then(() => scriptOfPcm(msg.audio))
      .then((script) => self.postMessage({ id: msg.id, type: 'done', script }))
      .catch((err) => self.postMessage({ id: msg.id, type: 'error', message: String((err && err.message) || err) }));
    return;
  }
  if (msg.type === 'infer') {
    queue = queue.then(() => infer())
      .then((script) => self.postMessage({ id: msg.id, type: 'done', script }))
      .catch((err) => self.postMessage({ id: msg.id, type: 'error', message: String((err && err.message) || err) }));
  }
};
