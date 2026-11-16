import os, time, torch
from librosa.core import load
from quran_muaalem import Muaalem
fp32 = 'onnx/muaalem.onnx'
if os.path.exists(fp32):
    print('fp32 already exported, skipping'); raise SystemExit
m = Muaalem(device='cpu', dtype=torch.float32)
net = m.model.eval()
wave, _ = load('audio/002048.mp3', sr=16000, mono=True)
f = m.processor(wave, sampling_rate=16000, return_tensors='pt')
x, mask = f['input_features'][:, :150].contiguous(), f['attention_mask'][:, :150].contiguous()
with torch.no_grad():
    lg = net(input_features=x[:, :50], attention_mask=mask[:, :50], return_dict=True).logits
keys = list(lg.keys()) if isinstance(lg, dict) else []
open('onnx/levels.txt', 'w').write('\n'.join(keys or ['logits']))
class Wrap(torch.nn.Module):
    def __init__(self, net, keys):
        super().__init__(); self.net, self.keys = net, keys
    def forward(self, input_features, attention_mask):
        o = self.net(input_features=input_features, attention_mask=attention_mask, return_dict=True).logits
        return tuple(o[k] for k in self.keys) if self.keys else o
outs = keys or ['logits']
t = time.time()
with torch.no_grad():
    torch.onnx.export(Wrap(net, keys), (x, mask), fp32,
                      input_names=['input_features', 'attention_mask'], output_names=outs,
                      dynamic_axes={'input_features': {0: 'b', 1: 't'}, 'attention_mask': {0: 'b', 1: 't'},
                                    **{k: {0: 'b', 1: 'tt'} for k in outs}},
                      opset_version=17, do_constant_folding=False, dynamo=False)
print(f'exported fp32 in {time.time() - t:.0f}s')
