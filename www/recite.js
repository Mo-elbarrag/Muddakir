let worker = null;
let ready = false;
let initP = null;
let msgId = 0;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker('asr-worker.js');
    worker.onmessage = (e) => {
      const m = e.data || {};
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.type === 'error') p.reject(new Error(m.message));
      else p.resolve(m);
    };
    worker.onerror = (e) => {
      pending.forEach((p) => p.reject(new Error((e && e.message) || 'worker error')));
      pending.clear();
    };
  }
  return worker;
}

function call(type, extra) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage(Object.assign({ id, type }, extra || {}));
  });
}

export function isReady() {
  return ready;
}

export async function initEngine() {
  if (ready) return;
  if (!initP) {
    initP = call('init').then(() => { ready = true; });
    initP.catch(() => { initP = null; });
  }
  return initP;
}

let stream = null;
let ctx = null;
let node = null;
let src = null;
let loopToken = 0;
let listeningNow = false;

export async function startListening(onScript) {
  await initEngine();
  stopListening();
  await call('reset');
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const C = window.AudioContext || window.webkitAudioContext;
  ctx = new C();
  if (ctx.state === 'suspended') await ctx.resume();
  src = ctx.createMediaStreamSource(stream);
  node = ctx.createScriptProcessor(4096, 1, 1);
  const rate = ctx.sampleRate;
  node.onaudioprocess = (e) => {
    if (!listeningNow) return;
    const d = new Float32Array(e.inputBuffer.getChannelData(0));
    getWorker().postMessage({ type: 'audio', data: d, rate }, [d.buffer]);
  };
  src.connect(node);
  node.connect(ctx.destination);
  listeningNow = true;
  const token = ++loopToken;
  (async () => {
    await new Promise((r) => setTimeout(r, 900));
    while (token === loopToken && listeningNow) {
      try {
        const m = await call('infer');
        if (token !== loopToken || !listeningNow) break;
        onScript(m.script || '');
      } catch (e) {
        console.error(e);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  })();
}

export function stopListening() {
  listeningNow = false;
  loopToken++;
  try { if (node) { node.onaudioprocess = null; node.disconnect(); } } catch (e) { /* ignore */ }
  try { if (src) src.disconnect(); } catch (e) { /* ignore */ }
  try { if (ctx) ctx.close(); } catch (e) { /* ignore */ }
  try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ }
  node = null;
  src = null;
  ctx = null;
  stream = null;
}

export async function inferNow() {
  try {
    const m = await call('infer');
    return m.script || '';
  } catch (e) {
    return '';
  }
}
