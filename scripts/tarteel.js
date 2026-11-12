const fs = require('fs');
const path = require('path');

const REPO = 'omartariq612/tarteel-ai-whisper-tiny-ar-quran-onnx';
const OUT = path.join('www', 'models', 'tarteel');

async function dl(file, dest) {
  const r = await fetch('https://huggingface.co/' + REPO + '/resolve/main/' + file);
  if (!r.ok) throw new Error(file + ': HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log('downloaded ' + file + ' (' + (buf.length / 1e6).toFixed(1) + ' MB)');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = await (await fetch('https://huggingface.co/api/models/' + REPO)).json();
  const files = (meta.siblings || []).map((s) => s.rfilename);
  console.log('repo files: ' + files.join(', '));
  const has = (f) => files.includes(f);
  for (const f of ['config.json', 'tokenizer.json']) await dl(f, path.join(OUT, f));
  if (has('onnx/encoder_model.onnx')) await dl('onnx/encoder_model.onnx', path.join(OUT, 'encoder-fp32.onnx'));
  else throw new Error('encoder_model.onnx not found');
  if (has('onnx/decoder_model_merged_quantized.onnx')) await dl('onnx/decoder_model_merged_quantized.onnx', path.join(OUT, 'decoder.onnx'));
  else if (has('onnx/decoder_model_merged.onnx')) await dl('onnx/decoder_model_merged.onnx', path.join(OUT, 'decoder-fp32.onnx'));
  else throw new Error('decoder_model_merged not found');
  for (const f of fs.readdirSync(path.join('www', 'models'))) {
    if (/^tajweed-/.test(f)) fs.unlinkSync(path.join('www', 'models', f));
  }
  console.log('tarteel model ready');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
