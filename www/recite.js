const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
const MODELS = ['iqbalaesthetic/Basira', 'aaqibhabib/whisper-base-ar-quran-onnx'];
const ISTIADHA = ['اعوذ', 'بالله', 'من', 'الشيطان', 'الرجيم'];
const BASMALA = ['بسم', 'الله', 'الرحمن', 'الرحيم'];

let asr = null;
let loading = null;
let recorder = null;
let stream = null;
let chunks = [];

export const isModelLoaded = () => !!asr;

export function normalize(s) {
  return String(s)
    .replace(/\uFEFF/g, '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ء/g, '')
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function loadModel(onProgress) {
  if (asr) return Promise.resolve(asr);
  if (loading) return loading;
  loading = (async () => {
    const T = await import(CDN);
    T.env.allowLocalModels = false;
    T.env.useBrowserCache = true;
    if (T.env.backends && T.env.backends.onnx && T.env.backends.onnx.wasm) {
      T.env.backends.onnx.wasm.numThreads = 1;
    }
    const files = {};
    const progress = (e) => {
      if (!onProgress || !e || e.status !== 'progress' || !e.file) return;
      files[e.file] = { loaded: e.loaded || 0, total: e.total || 0 };
      let l = 0;
      let t = 0;
      for (const f of Object.values(files)) { l += f.loaded; t += f.total; }
      if (t > 0) onProgress(Math.min(100, Math.round((l * 100) / t)));
    };
    let lastError;
    for (const id of MODELS) {
      try {
        asr = await T.pipeline('automatic-speech-recognition', id, { dtype: 'q8', device: 'wasm', progress_callback: progress });
        return asr;
      } catch (e) {
        lastError = e;
        console.error('model failed', id, e);
      }
    }
    throw lastError || new Error('model failed');
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

export async function transcribe(audio) {
  const model = await loadModel();
  let out;
  try {
    out = await model(audio, { language: 'arabic', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
  } catch (e) {
    console.warn('retry without language', e);
    out = await model(audio, { chunk_length_s: 30, stride_length_s: 5 });
  }
  if (Array.isArray(out)) return out.map((o) => o.text || '').join(' ');
  return (out && out.text) || '';
}

function stopTracks() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

export async function startRecording() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  recorder.start();
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
      try {
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        chunks = [];
        const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        try {
          const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
          resolve(buf.getChannelData(0).slice());
        } finally {
          ctx.close().catch(() => {});
        }
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

  let points = 0;
  status.forEach((s) => { if (s === 'ok') points += 1; else if (s === 'near') points += 0.5; });
  const score = n ? Math.round((points * 100) / n) : 0;
  return { statuses: status, score, heard: hyp.join(' ') };
}
