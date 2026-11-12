const N_FFT = 400;
const HOP = 160;
const NB = 201;
const N_MELS = 80;
const CAP = 16000 * 58;
const KEEP = 16000 * 26;
const WIN = 480000;
const NF = 3000;
const BASE = self.location.href.replace(/[^/]*$/, '');
const MDIR = BASE + 'models/tarteel/';

let ortLib = null;
let enc = null;
let dec = null;
let cfg = null;
let idToTok = null;
let byteDec = null;
let PROMPT = null;
let EOT = 50257;
let initP = null;
let queue = Promise.resolve();
let waiting = null;

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
let len = 0;
const cache = new Float32Array(Math.ceil(CAP / HOP) * N_MELS);
let cached = 0;
let leftover = new Float32Array(0);
let rsPos = 0;
const frameBuf = new Float32Array(N_FFT);
const powBuf = new Float32Array(NB);

function reset() {
  len = 0;
  cached = 0;
  leftover = new Float32Array(0);
  rsPos = 0;
}

function append(samples) {
  if (len + samples.length > CAP) {
    audio.copyWithin(0, len - KEEP, len);
    len = KEEP;
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

function melFrame(src, srcLen, t, out, off) {
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

function features(src, srcLen, useCache) {
  const f0 = srcLen > WIN ? Math.ceil((srcLen - WIN) / HOP) : 0;
  if (useCache) {
    const cacheable = srcLen >= N_FFT / 2 ? Math.floor((srcLen - N_FFT / 2) / HOP) + 1 : 0;
    while (cached < cacheable) { melFrame(src, srcLen, cached, cache, cached * N_MELS); cached++; }
  }
  const feats = new Float32Array(N_MELS * NF);
  const tmp = new Float32Array(N_MELS);
  let maxv = -Infinity;
  for (let f = 0; f < NF; f++) {
    const t = f0 + f;
    if (t * HOP - N_FFT / 2 >= srcLen) {
      for (let m = 0; m < N_MELS; m++) feats[m * NF + f] = -10;
      if (maxv < -10) maxv = -10;
      continue;
    }
    let arr = tmp;
    let off = 0;
    if (useCache && t < cached) { arr = cache; off = t * N_MELS; } else melFrame(src, srcLen, t, tmp, 0);
    for (let m = 0; m < N_MELS; m++) {
      const v = Math.log10(Math.max(arr[off + m], 1e-10));
      feats[m * NF + f] = v;
      if (v > maxv) maxv = v;
    }
  }
  const floor = maxv - 8;
  for (let i = 0; i < feats.length; i++) {
    const v = feats[i] < floor ? floor : feats[i];
    feats[i] = (v + 4) / 4;
  }
  return feats;
}

function bytesToUnicode() {
  const bs = [];
  for (let i = 33; i <= 126; i++) bs.push(i);
  for (let i = 161; i <= 172; i++) bs.push(i);
  for (let i = 174; i <= 255; i++) bs.push(i);
  const cs = bs.slice();
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
  }
  const m = {};
  bs.forEach((b, i) => { m[String.fromCharCode(cs[i])] = b; });
  return m;
}

function decodeIds(ids) {
  const bytes = [];
  for (const id of ids) {
    if (id >= EOT) continue;
    const t = idToTok[id];
    if (!t) continue;
    for (const ch of t) { const b = byteDec[ch]; if (b !== undefined) bytes.push(b); }
  }
  return new TextDecoder().decode(new Uint8Array(bytes)).trim();
}

async function init() {
  if (enc && dec) return;
  if (!initP) {
    initP = (async () => {
      try { importScripts(BASE + 'vendor/ort/ort.wasm.min.js'); } catch (e) { importScripts(BASE + 'vendor/ort/ort.min.js'); }
      ortLib = self.ort;
      ortLib.env.wasm.numThreads = 1;
      ortLib.env.wasm.wasmPaths = BASE + 'vendor/ort/';
      cfg = await (await fetch(MDIR + 'config.json')).json();
      const tj = await (await fetch(MDIR + 'tokenizer.json')).json();
      idToTok = [];
      for (const [t, id] of Object.entries(tj.model.vocab)) idToTok[id] = t;
      const special = {};
      (tj.added_tokens || []).forEach((a) => { special[a.content] = a.id; idToTok[a.id] = null; });
      EOT = special['<|endoftext|>'] !== undefined ? special['<|endoftext|>'] : 50257;
      const sp = (k, d) => (special[k] !== undefined ? special[k] : d);
      PROMPT = [sp('<|startoftranscript|>', 50258), sp('<|ar|>', 50272), sp('<|transcribe|>', 50359), sp('<|notimestamps|>', 50363)];
      byteDec = bytesToUnicode();
      enc = await ortLib.InferenceSession.create(MDIR + 'encoder.onnx', { executionProviders: ['wasm'] });
      dec = await ortLib.InferenceSession.create(MDIR + 'decoder.onnx', { executionProviders: ['wasm'] });
    })();
    initP.catch(() => { initP = null; });
  }
  return initP;
}

async function greedy(encOut, maxTokens) {
  const names = dec.inputNames;
  const merged = names.includes('use_cache_branch');
  const encName = names.find((n) => n.includes('encoder_hidden_states')) || 'encoder_hidden_states';
  const H = cfg.decoder_attention_heads || 6;
  const Dh = (cfg.d_model || 384) / H;
  const ids = PROMPT.slice();
  const out = [];
  let past = null;
  for (let step = 0; step < maxTokens; step++) {
    const useCache = merged && past;
    const toks = useCache ? [ids[ids.length - 1]] : ids;
    const feeds = {};
    feeds.input_ids = new ortLib.Tensor('int64', BigInt64Array.from(toks.map((x) => BigInt(x))), [1, toks.length]);
    feeds[encName] = encOut;
    if (merged) {
      feeds.use_cache_branch = new ortLib.Tensor('bool', [!!past], [1]);
      for (const n of names) {
        if (!n.startsWith('past_key_values')) continue;
        feeds[n] = past ? past[n] : new ortLib.Tensor('float32', new Float32Array(0), [1, H, 0, Dh]);
      }
    }
    const res = await dec.run(feeds);
    const logits = res.logits || res[dec.outputNames[0]];
    const V = logits.dims[2];
    const T = logits.dims[1];
    const base = (T - 1) * V;
    const d = logits.data;
    let best = 0;
    let bv = -Infinity;
    for (let v = 0; v <= EOT && v < V; v++) { if (d[base + v] > bv) { bv = d[base + v]; best = v; } }
    if (merged) {
      const next = {};
      for (const n of names) {
        if (!n.startsWith('past_key_values')) continue;
        if (past && n.includes('.encoder.')) next[n] = past[n];
        else next[n] = res[n.replace('past_key_values', 'present')];
      }
      past = next;
    }
    if (best === EOT) break;
    ids.push(best);
    out.push(best);
    if (out.length >= 16 && out.slice(-8).join(',') === out.slice(-16, -8).join(',')) break;
  }
  return out;
}

function peak(src, from, to) {
  let m = 0;
  for (let i = from; i < to; i++) { const v = Math.abs(src[i]); if (v > m) m = v; }
  return m;
}

async function transcribe(src, srcLen, useCache) {
  await init();
  if (srcLen < 8000) return '';
  if (peak(src, Math.max(0, srcLen - WIN), srcLen) < 0.02) return '';
  const feats = features(src, srcLen, useCache);
  const eo = await enc.run({ [enc.inputNames[0]]: new ortLib.Tensor('float32', feats, [1, N_MELS, NF]) });
  const encOut = eo[enc.outputNames[0]];
  const secs = Math.min(30, srcLen / 16000);
  const ids = await greedy(encOut, Math.min(160, Math.ceil(secs * 6) + 10));
  return decodeIds(ids);
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
    queue = queue.then(() => transcribe(msg.audio, msg.audio.length, false))
      .then((script) => self.postMessage({ id: msg.id, type: 'done', script }))
      .catch((err) => self.postMessage({ id: msg.id, type: 'error', message: String((err && err.message) || err) }));
    return;
  }
  if (msg.type === 'infer') {
    if (waiting) { waiting.push(msg.id); return; }
    waiting = [msg.id];
    queue = queue.then(async () => {
      const ids = waiting;
      waiting = null;
      try {
        const script = await transcribe(audio, len, true);
        ids.forEach((id) => self.postMessage({ id, type: 'done', script }));
      } catch (err) {
        ids.forEach((id) => self.postMessage({ id, type: 'error', message: String((err && err.message) || err) }));
      }
    });
  }
};
