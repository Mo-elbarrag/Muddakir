import os, time, traceback
from types import SimpleNamespace
import numpy as np
import onnx
import onnxruntime as ort
from lab5_core import *

HIFZ = {'كلمة ناقصة', 'حروف', 'حركات'}
OUTS = [o.name for o in onnx.load('onnx/muaalem.onnx', load_external_data=False).graph.output]

class OrtNet(torch.nn.Module):
    def __init__(self, path):
        super().__init__()
        so = ort.SessionOptions()
        so.intra_op_num_threads = os.cpu_count()
        self.sess = ort.InferenceSession(path, so, providers=['CPUExecutionProvider'])
        types = {i.name: i.type for i in self.sess.get_inputs()}
        self.mtype = np.int32 if types.get('attention_mask') == 'tensor(int32)' else np.int64
        self.anchor = torch.nn.Parameter(torch.zeros(1), requires_grad=False)
    @property
    def dtype(self):
        return torch.float32
    @property
    def device(self):
        return torch.device('cpu')
    def forward(self, input_features=None, attention_mask=None, *args, **kw):
        r = self.sess.run(None, {'input_features': input_features.float().cpu().numpy(),
                                 'attention_mask': attention_mask.cpu().numpy().astype(self.mtype)})
        return SimpleNamespace(logits={k: torch.from_numpy(v) for k, v in zip(OUTS, r)})

def analyze(model, path, refs):
    units = units_for(refs)
    wave, _ = load(str(LAB / path), sr=SR, mono=True)
    joined = ' '.join(uthmani(r) for r in refs)
    t = time.time()
    out = model([wave], [quran_phonetizer(joined, BASE, remove_spaces=True)], sampling_rate=SR)[0]
    dt = time.time() - t
    pred = out.phonemes.text
    res = align_pos(units, pred)
    errs = []
    for u, r in zip(units, res):
        if r is None or u['optional']:
            continue
        seg, v, d, a, b = r
        if d:
            k = kind(v, seg)
            if k in HIFZ:
                errs.append(f'{u["ref"]}#{u["n"]} {u["label"]}:{k}')
    return errs, dt

TESTS = [
    ('mine/1.ogg', ['112:1', '112:2', '112:3', '112:4']),
    ('mine/2.ogg', ['112:1', '112:2', '112:3', '112:4']),
    ('mine/3.ogg', ['1:2', '1:3', '1:4']),
    ('mine/4.ogg', ['1:2', '1:3', '1:4']),
    ('mine/5.ogg', ['7:19']),
    ('mine/5.ogg', ['2:35']),
    ('audio/002048.mp3', ['2:48']),
    ('audio/002048.mp3', ['2:123']),
    ('audio/007019.mp3', ['2:35']),
]

print('loading models...', flush=True)
ref_model = Muaalem(device='cpu', dtype=torch.float32)
q_model = Muaalem(device='cpu', dtype=torch.float32)
q_model.model = OrtNet('onnx/muaalem-int8.onnx')

same_all = True
for path, refs in TESTS:
    if not (LAB / path).exists():
        continue
    try:
        e1, t1 = analyze(ref_model, path, refs)
        e2, t2 = analyze(q_model, path, refs)
        same = e1 == e2
        same_all &= same
        print('=' * 60)
        print(f'{path} -> {",".join(refs)} | torch {t1:.1f}s | int8 {t2:.1f}s | {"SAME ✓" if same else "DIFFERENT ✗"}')
        print('  torch:', e1 or 'no errors')
        if not same:
            print('  int8 :', e2 or 'no errors')
    except Exception:
        traceback.print_exc()
print('\nALL SAME' if same_all else '\nSOME DIFFERENT')
print('DONE')
