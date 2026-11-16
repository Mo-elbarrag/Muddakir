import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ort from 'onnxruntime-node';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const WWW = path.join(ROOT, 'www');

// كود التطبيق نفسه: ننسخه هنا عشان Node يقراه كـ ES module
fs.mkdirSync(path.join(HERE, 'app'), { recursive: true });
for (const f of ['quran.js', 'words.js']) fs.copyFileSync(path.join(WWW, f), path.join(HERE, 'app', f));
const { parseAyah } = await import('./app/quran.js');
const { refSkeleton, heardSkeleton, alignWords } = await import('./app/words.js');

// asr-worker.js زي ما هو، مع بدائل بسيطة لحاجات المتصفح
const src = fs.readFileSync(path.join(WWW, 'asr-worker.js'), 'utf8');
const selfObj = { location: { href: path.join(WWW, 'asr-worker.js') }, postMessage() {} };
const ortShim = {
  Tensor: ort.Tensor,
  env: { wasm: {} },
  InferenceSession: { create: (p) => ort.InferenceSession.create(p, { executionProviders: ['cpu'], intraOpNumThreads: 1 }) },
};
const importScripts = () => { selfObj.ort = ortShim; };
const fetchShim = async (p) => { const t = fs.readFileSync(p, 'utf8'); return { ok: true, json: async () => JSON.parse(t) }; };
const W = new Function('self', 'importScripts', 'fetch',
  src + '\nreturn { init, reset, pushAudio, run: () => transcribe(audio, len, false) };')(selfObj, importScripts, fetchShim);

const QURAN = JSON.parse(fs.readFileSync(path.join(WWW, 'data', 'quran.json'), 'utf8'));
function refWords(refs) {
  const out = [];
  for (const r of refs) {
    const [s, a] = r.split(':').map(Number);
    parseAyah(QURAN[s - 1].ayat[a - 1]).forEach((t) => { if (t.c) out.push({ ref: r, w: t.plain, sk: refSkeleton(t.plain) }); });
  }
  return out;
}

const IKH = ['112:1', '112:2', '112:3', '112:4'];
const FAT = ['1:2', '1:3', '1:4'];
const TESTS = [
  ['mine/1.ogg', 'الإخلاص صح', IKH, 'pass'],
  ['mine/2.ogg', 'الإخلاص: "الصمد" ناقصة و"قم" بدل "قل"', IKH, 'fail'],
  ['mine/3.ogg', 'الفاتحة 2-4 و"الحمدَ" بالفتح (حركة: مش متوقع يمسكها)', FAT, 'pass'],
  ['mine/4.ogg', 'الفاتحة 2-4 صح مع ضوضاء', FAT, 'pass'],
  ['mine/5.ogg', 'الأعراف 19 صح', ['7:19'], 'pass'],
  ['mine/5.ogg', 'الأعراف 19 والمطلوب البقرة 35', ['2:35'], 'fail'],
  ['mine/6.ogg', 'الإخلاص بصوت طفل', IKH, 'pass'],
  ['audio/002048.mp3', 'المنشاوي البقرة 48 صح', ['2:48'], 'pass'],
  ['audio/002048.mp3', 'المنشاوي البقرة 48 والمطلوب 123', ['2:123'], 'fail'],
  ['audio/007019.mp3', 'المنشاوي الأعراف 19 والمطلوب البقرة 35', ['2:35'], 'fail'],
];
const PASS = 80;

console.log('loading tarteel...');
await W.init();
let right = 0, wrong = 0;
for (const [p, title, refs, expect] of TESTS) {
  const f = path.join(HERE, 'raw', p.replace(/\//g, '_') + '.f32');
  if (!fs.existsSync(f)) { console.log('missing:', p); continue; }
  const buf = fs.readFileSync(f);
  const wave = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  W.reset();
  W.pushAudio(wave, 16000);
  const t0 = Date.now();
  const script = await W.run();
  const dt = (Date.now() - t0) / 1000;
  const ref = refWords(refs);
  const res = alignWords(ref.map((x) => x.sk), heardSkeleton(script), true);
  let pts = 0;
  const notes = [];
  ref.forEach((x, k) => {
    const r = res[k].ratio;
    const st = r >= 0.7 ? 'ok' : r >= 0.45 ? 'near' : r > 0 ? 'bad' : 'miss';
    pts += st === 'ok' ? 1 : st === 'near' ? 0.75 : 0;
    if (st !== 'ok') notes.push(`${st.padEnd(4)} ${x.ref} "${x.w}" (${r.toFixed(2)})`);
  });
  const score = Math.round((pts * 100) / ref.length);
  const hard = notes.some((n) => n.startsWith('bad') || n.startsWith('miss'));
  const got = score >= PASS && !hard ? 'pass' : 'fail';
  const okk = got === expect;
  okk ? right++ : wrong++;
  console.log('='.repeat(60));
  console.log(`[${p}] ${title}`);
  console.log(`audio ${(wave.length / 16000).toFixed(1)}s | model ${dt.toFixed(1)}s | score ${score}% -> ${got} (expected ${expect}) ${okk ? '✓' : '✗'}`);
  console.log('  heard:', script);
  for (const n of notes) console.log('   ', n);
}
console.log(`\nCORRECT VERDICT: ${right}   WRONG VERDICT: ${wrong}`);
console.log('DONE');
