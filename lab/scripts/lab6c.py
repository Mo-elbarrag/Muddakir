import os, time
import numpy as np
import onnx
import torch
import onnxruntime as ort
from librosa.core import load
from quran_muaalem import Muaalem

outs = [o.name for o in onnx.load('onnx/muaalem.onnx', load_external_data=False).graph.output]
level = 'phonemes' if 'phonemes' in outs else outs[0]
idx = outs.index(level)
print('onnx outputs:', outs, '| comparing:', level)
m = Muaalem(device='cpu', dtype=torch.float32)
net = m.model.eval()
so = ort.SessionOptions()
so.intra_op_num_threads = os.cpu_count()
sessions = {n: ort.InferenceSession(p, so, providers=['CPUExecutionProvider'])
            for n, p in (('onnx-fp32', 'onnx/muaalem-opt.onnx'), ('onnx-int8', 'onnx/muaalem-int8.onnx'))}
for path in ['audio/002048.mp3', 'audio/007019.mp3', 'mine/1.ogg', 'mine/3.ogg']:
    if not os.path.exists(path):
        continue
    wave, _ = load(path, sr=16000, mono=True)
    f = m.processor(wave, sampling_rate=16000, return_tensors='pt')
    x, mask = f['input_features'], f['attention_mask']
    with torch.no_grad():
        t = time.time()
        o = net(input_features=x, attention_mask=mask, return_dict=True).logits
        t_torch = time.time() - t
    ref = (o[level] if isinstance(o, dict) else o)[0].argmax(-1).numpy()
    line = f'{path} ({len(wave) / 16000:.0f}s) | torch {t_torch:.1f}s'
    first = next(iter(sessions.values()))
    want = {i.name: i.type for i in first.get_inputs()}
    mtype = np.int32 if want.get('attention_mask') == 'tensor(int32)' else np.int64
    feed = {'input_features': x.numpy().astype(np.float32), 'attention_mask': mask.numpy().astype(mtype)}
    for n, sess in sessions.items():
        t = time.time()
        r = sess.run(None, feed)
        dt = time.time() - t
        got = np.argmax(r[idx][0], axis=-1)
        k = min(len(got), len(ref))
        line += f' | {n} {dt:.1f}s match={float((got[:k] == ref[:k]).mean()) * 100:.1f}%'
    print(line, flush=True)
print('DONE')
