import os, gc, time
import numpy as np
import torch
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType
from librosa.core import load
from quran_muaalem import Muaalem

SR = 16000
m = Muaalem(device='cpu', dtype=torch.float32)
net = m.model.eval()
proc = m.processor

def feats_of(path):
    wave, _ = load(path, sr=SR, mono=True)
    f = proc(wave, sampling_rate=SR, return_tensors='pt')
    return f['input_features'], f['attention_mask'], len(wave) / SR

x, mask, dur = feats_of('audio/002048.mp3')
print('input_features', tuple(x.shape), '| attention_mask', tuple(mask.shape), flush=True)
with torch.no_grad():
    logits = net(input_features=x[:, :50], attention_mask=mask[:, :50], return_dict=True).logits
keys = list(logits.keys()) if isinstance(logits, dict) else []
print('output levels:', keys or 'single tensor', flush=True)
level = 'phonemes' if 'phonemes' in keys else (keys[0] if keys else None)
del logits; gc.collect()

class Wrap(torch.nn.Module):
    def __init__(self, net, keys):
        super().__init__()
        self.net, self.keys = net, keys
    def forward(self, input_features, attention_mask):
        o = self.net(input_features=input_features, attention_mask=attention_mask, return_dict=True).logits
        return tuple(o[k] for k in self.keys) if self.keys else o

outs = keys or ['logits']
fp32, int8 = 'onnx/muaalem.onnx', 'onnx/muaalem-int8.onnx'
xs, ms = x[:, :150].contiguous(), mask[:, :150].contiguous()
t = time.time()
with torch.no_grad():
    torch.onnx.export(Wrap(net, keys), (xs, ms), fp32,
                      input_names=['input_features', 'attention_mask'], output_names=outs,
                      dynamic_axes={'input_features': {0: 'b', 1: 't'}, 'attention_mask': {0: 'b', 1: 't'},
                                    **{k: {0: 'b', 1: 'tt'} for k in outs}},
                      opset_version=17, do_constant_folding=False, dynamo=False)
print(f'exported fp32 in {time.time() - t:.0f}s', flush=True)
gc.collect()
t = time.time()
quantize_dynamic(fp32, int8, weight_type=QuantType.QInt8)
print(f'quantized int8 in {time.time() - t:.0f}s | int8 file: {os.path.getsize(int8) / 1e6:.0f} MB', flush=True)

so = ort.SessionOptions()
so.intra_op_num_threads = os.cpu_count()
sessions = {name: ort.InferenceSession(p, so, providers=['CPUExecutionProvider'])
            for name, p in (('onnx-fp32', fp32), ('onnx-int8', int8))}
idx = outs.index(level) if level in outs else 0
for path in ['audio/002048.mp3', 'audio/007019.mp3', 'mine/1.ogg', 'mine/3.ogg']:
    if not os.path.exists(path):
        continue
    x, mask, dur = feats_of(path)
    with torch.no_grad():
        t = time.time()
        o = net(input_features=x, attention_mask=mask, return_dict=True).logits
        t_torch = time.time() - t
    ref = (o[level] if keys else o)[0].argmax(-1).numpy()
    line = f'{path} ({dur:.0f}s) | torch {t_torch:.1f}s'
    feed = {'input_features': x.numpy(), 'attention_mask': mask.numpy().astype(np.int64)}
    for name, sess in sessions.items():
        t = time.time()
        r = sess.run(None, feed)
        dt = time.time() - t
        got = np.argmax(r[idx][0], axis=-1)
        n = min(len(got), len(ref))
        line += f' | {name} {dt:.1f}s match={float((got[:n] == ref[:n]).mean()) * 100:.1f}%'
    print(line, flush=True)
print('DONE')
