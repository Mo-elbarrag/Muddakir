import { normalize } from './quran.js';

const ISTIADHA = ['اعوذ', 'بالله', 'من', 'الشيطان', 'الرجيم'];
const BASMALA = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

let worker = null;
let seq = 0;
const pending = new Map();
let progressCb = null;
let loaded = false;
let loadingP = null;
let recorder = null;
let stream = null;
let chunks = [];

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./asr-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'progress') { if (progressCb) progressCb(m.pct); return; }
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
    loadingP = null;
    loaded = false;
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

export const isModelLoaded = () => loaded;

export function loadModel(onProgress) {
  if (loaded) return Promise.resolve();
  if (onProgress) progressCb = onProgress;
  if (!loadingP) {
    loadingP = call('load').then(() => { loaded = true; }).catch((e) => { loadingP = null; throw e; });
  }
  return loadingP;
}

export async function transcribe(audio) {
  await loadModel();
  const m = await call('transcribe', { audio }, [audio.buffer]);
  return m.text || '';
}

function stopTracks() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

async function decode(blob) {
  const C = window.AudioContext || window.webkitAudioContext;
  const ctx = new C({ sampleRate: 16000 });
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    return buf.getChannelData(0).slice();
  } finally {
    ctx.close().catch(() => {});
  }
}

export async function startRecording() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  recorder.start(300);
}

export async function snapshot() {
  if (!recorder || !chunks.length) return null;
  return decode(new Blob(chunks.slice(), { type: recorder.mimeType || 'audio/webm' }));
}

export function cancelRecording() {
  if (recorder) {
    recorder.onstop = null;
    try { recorder.stop(); } catch (e) { /* ignore */ }
  }
  recorder = null;
  chunks = [];
  stopTracks();
}

export function stopRecording() {
  return new Promise((resolve, reject) => {
    const r = recorder;
    if (!r) { reject(new Error('مفيش تسجيل شغال')); return; }
    r.onstop = async () => {
      stopTracks();
      recorder = null;
      const parts = chunks;
      chunks = [];
      try {
        resolve(await decode(new Blob(parts, { type: r.mimeType || 'audio/webm' })));
      } catch (e) {
        reject(new Error('تعذر قراءة التسجيل، جرّب تاني'));
      }
    };
    try { r.stop(); } catch (e) { stopTracks(); recorder = null; reject(e); }
  });
}

function lev(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function sim(a, b) {
  if (a === b) return 1;
  const L = Math.max(a.length, b.length);
  return L ? 1 - lev(a, b) / L : 0;
}

function startsWith(hyp, phrase) {
  if (hyp.length < phrase.length) return false;
  for (let i = 0; i < phrase.length; i++) if (sim(hyp[i], phrase[i]) < 0.7) return false;
  return true;
}

export function compare(ref, heardText) {
  let hyp = normalize(heardText).split(' ').filter(Boolean);
  if (!(ref.length && sim(ref[0], ISTIADHA[0]) >= 0.8) && startsWith(hyp, ISTIADHA)) hyp = hyp.slice(ISTIADHA.length);
  if (!(ref.length && sim(ref[0], BASMALA[0]) >= 0.8) && startsWith(hyp, BASMALA)) hyp = hyp.slice(BASMALA.length);

  const n = ref.length;
  const m = hyp.length;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const bt = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) { dp[i][0] = i; bt[i][0] = 1; }
  for (let j = 1; j <= m; j++) { dp[0][j] = j; bt[0][j] = 2; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1][j - 1] + (1 - sim(ref[i - 1], hyp[j - 1]));
      const del = dp[i - 1][j] + 1;
      const ins = dp[i][j - 1] + 1;
      if (sub <= del && sub <= ins) { dp[i][j] = sub; bt[i][j] = 0; }
      else if (del <= ins) { dp[i][j] = del; bt[i][j] = 1; }
      else { dp[i][j] = ins; bt[i][j] = 2; }
    }
  }

  const status = new Array(n).fill('miss');
  const pairHyp = new Array(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const b = i > 0 && j > 0 ? bt[i][j] : (i > 0 ? 1 : 2);
    if (b === 0) {
      const s = sim(ref[i - 1], hyp[j - 1]);
      pairHyp[i - 1] = j - 1;
      status[i - 1] = s >= 0.8 ? 'ok' : s >= 0.5 ? 'near' : 'bad';
      i--; j--;
    } else if (b === 1) {
      status[i - 1] = 'miss';
      i--;
    } else {
      j--;
    }
  }

  for (let k = 0; k < n; k++) {
    if (status[k] !== 'miss') continue;
    const before = k > 0 ? pairHyp[k - 1] : -1;
    if (before >= 0 && sim(ref[k - 1] + ref[k], hyp[before]) >= 0.8) { status[k - 1] = 'ok'; status[k] = 'ok'; continue; }
    const after = k < n - 1 ? pairHyp[k + 1] : -1;
    if (after >= 0 && sim(ref[k] + ref[k + 1], hyp[after]) >= 0.8) { status[k] = 'ok'; status[k + 1] = 'ok'; }
  }
  for (let k = 0; k < n; k++) {
    const h = pairHyp[k];
    if (h < 0 || status[k] === 'ok') continue;
    if ((h > 0 && sim(ref[k], hyp[h - 1] + hyp[h]) >= 0.8) || (h + 1 < m && sim(ref[k], hyp[h] + hyp[h + 1]) >= 0.8)) status[k] = 'ok';
  }

  let points = 0;
  status.forEach((s) => { if (s === 'ok') points += 1; else if (s === 'near') points += 0.5; });
  const score = n ? Math.round((points * 100) / n) : 0;
  return { statuses: status, score, heard: hyp.join(' ') };
}

export function comparePartial(ref, text) {
  const r = compare(ref, text);
  let lastI = -1;
  r.statuses.forEach((x, i) => { if (x === 'ok' || x === 'near') lastI = i; });
  return { statuses: r.statuses.map((x, i) => (i > lastI ? 'pending' : x)), score: r.score, heard: r.heard };
}
