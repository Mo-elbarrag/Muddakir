const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
const MODELS = ['iqbalaesthetic/Basira', 'aaqibhabib/whisper-base-ar-quran-onnx'];
let asr = null;
let loading = null;

function load() {
  if (asr) return Promise.resolve(asr);
  if (!loading) {
    loading = (async () => {
      const T = await import(CDN);
      T.env.allowLocalModels = false;
      T.env.useBrowserCache = true;
      if (T.env.backends && T.env.backends.onnx && T.env.backends.onnx.wasm) T.env.backends.onnx.wasm.numThreads = 1;
      const files = {};
      const progress = (e) => {
        if (!e || e.status !== 'progress' || !e.file) return;
        files[e.file] = { l: e.loaded || 0, t: e.total || 0 };
        let l = 0;
        let t = 0;
        for (const f of Object.values(files)) { l += f.l; t += f.t; }
        if (t > 0) self.postMessage({ type: 'progress', pct: Math.min(100, Math.round((l * 100) / t)) });
      };
      let lastError;
      for (const id of MODELS) {
        try {
          asr = await T.pipeline('automatic-speech-recognition', id, { dtype: 'q8', device: 'wasm', progress_callback: progress });
          return asr;
        } catch (e) {
          lastError = e;
        }
      }
      throw lastError || new Error('model failed');
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  try {
    if (msg.type === 'load') {
      await load();
      self.postMessage({ id: msg.id, type: 'done' });
      return;
    }
    if (msg.type === 'transcribe') {
      const model = await load();
      let out;
      try {
        out = await model(msg.audio, { language: 'arabic', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
      } catch (err) {
        out = await model(msg.audio, { chunk_length_s: 30, stride_length_s: 5 });
      }
      const text = Array.isArray(out) ? out.map((o) => o.text || '').join(' ') : (out && out.text) || '';
      self.postMessage({ id: msg.id, type: 'done', text });
    }
  } catch (err) {
    self.postMessage({ id: msg.id, type: 'error', message: String((err && err.message) || err) });
  }
};
