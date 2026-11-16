import time, copy
from pathlib import Path
import torch
from librosa.core import load
from quran_transcript import Aya, quran_phonetizer, MoshafAttributes, explain_error, PhoneticSearch
from quran_muaalem import Muaalem

SR = 16000
AUD = Path(__file__).parent / 'audio'
MOSHAF = MoshafAttributes(rewaya='hafs', madd_monfasel_len=4, madd_mottasel_len=4,
                          madd_mottasel_waqf=4, madd_aared_len=4)

def wave_of(ref):
    s, a = map(int, ref.split(':'))
    w, _ = load(str(AUD / f'{s:03d}{a:03d}.mp3'), sr=SR, mono=True)
    return w

def uthmani(ref):
    s, a = map(int, ref.split(':'))
    info = Aya(s, a).get()
    for k in ('uthmani', 'uthmani_script', 'uthmani_text'):
        v = getattr(info, k, None)
        if v:
            return v

def run(model, aud_ref, txt_ref):
    wave = wave_of(aud_ref)
    ref = uthmani(txt_ref)
    ph = quran_phonetizer(ref, MOSHAF, remove_spaces=True)
    t = time.time()
    out = model([wave], [ph], sampling_rate=SR)[0]
    dt = time.time() - t
    errs = explain_error(uthmani_text=ref, ref_ph_text=ph.phonemes,
                         predicted_ph_text=out.phonemes.text, mappings=ph.mappings)
    return out, errs, dt, len(wave) / SR, ref

def counts(errs):
    c = {'normal': 0, 'tashkeel': 0, 'tajweed': 0}
    for e in errs:
        c[e.error_type] = c.get(e.error_type, 0) + 1
    return c

print('loading model...', flush=True)
model = Muaalem(device='cpu', dtype=torch.float32)
model([wave_of('112:1')], [quran_phonetizer(uthmani('112:1'), MOSHAF, remove_spaces=True)], sampling_rate=SR)  # warm-up

print('\n######## 1) TAJWEED DETAILS ON CORRECT RECITATIONS ########')
for r in ['1:2', '2:48', '2:123', '7:19']:
    out, errs, dt, dur, ref = run(model, r, r)
    for e in errs:
        if e.error_type != 'tajweed':
            continue
        words = ref.split(' ')
        idx = ref[:e.uthmani_pos[0]].count(' ')
        rules = ', '.join(x.name.ar for x in (e.ref_tajweed_rules or [])) or '-'
        print(f'{r}  كلمة {idx + 1} ({words[idx] if idx < len(words) else "?"}): {rules}  متوقع={e.expected_len}  اتقال={e.predicted_len}  [{e.expected_ph} -> {e.preditected_ph}]')

print('\n######## 2) WHICH AYAH DID HE ACTUALLY RECITE? ########')
searcher = PhoneticSearch()
for aud_ref, txt_ref in [('2:48', '2:123'), ('2:123', '2:48'), ('7:19', '2:35')]:
    out, errs, dt, dur, ref = run(model, aud_ref, txt_ref)
    heard = out.phonemes.text
    found = []
    for ratio in (0.05, 0.1, 0.15, 0.2):
        try:
            res = searcher.search(heard, error_ratio=ratio)
        except Exception as ex:
            print('  search failed:', repr(ex)[:200]); break
        if res:
            found = [f'{x.start.sura_idx}:{x.start.aya_idx}' for x in res[:5]]
            break
    verdict = 'OK' if aud_ref in found else 'MISS'
    print(f'audio={aud_ref} expected={txt_ref} -> search found: {found} (ratio {ratio})  [{verdict}]')

print('\n######## 3) INT8 QUANTIZED MODEL: SPEED + ACCURACY ########')
qmodel = copy.copy(model)
quantized = []
for name, val in list(vars(model).items()):
    if isinstance(val, torch.nn.Module):
        setattr(qmodel, name, torch.quantization.quantize_dynamic(val, {torch.nn.Linear}, dtype=torch.qint8))
        quantized.append(name)
print('quantized modules:', quantized or 'NONE FOUND')
if quantized:
    for aud_ref, txt_ref in [('2:48', '2:48'), ('7:19', '7:19'), ('2:48', '2:123'), ('7:19', '2:35')]:
        _, e32, t32, dur, _ = run(model, aud_ref, txt_ref)
        _, e8, t8, _, _ = run(qmodel, aud_ref, txt_ref)
        c32, c8 = counts(e32), counts(e8)
        print(f'audio={aud_ref} text={txt_ref} ({dur:.0f}s audio) | fp32 {t32:.1f}s words={c32["normal"]} tashkeel={c32["tashkeel"]} | int8 {t8:.1f}s words={c8["normal"]} tashkeel={c8["tashkeel"]}')
print('\nDONE')
