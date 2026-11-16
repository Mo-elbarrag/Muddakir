import time, urllib.request
from pathlib import Path
import torch
from librosa.core import load
from quran_transcript import Aya, quran_phonetizer, MoshafAttributes, explain_error
from quran_muaalem import Muaalem

LAB = Path(__file__).parent
AUD = LAB / 'audio'
AUD.mkdir(exist_ok=True)
SR = 16000
MOSHAF = MoshafAttributes(rewaya='hafs', madd_monfasel_len=4, madd_mottasel_len=4,
                          madd_mottasel_waqf=4, madd_aared_len=4)

def audio(ref):
    s, a = map(int, ref.split(':'))
    f = AUD / f'{s:03d}{a:03d}.mp3'
    if not f.exists():
        urllib.request.urlretrieve(f'https://everyayah.com/data/Minshawy_Murattal_128kbps/{s:03d}{a:03d}.mp3', f)
    wave, _ = load(str(f), sr=SR, mono=True)
    return wave

def uthmani(ref):
    s, a = map(int, ref.split(':'))
    info = Aya(s, a).get()
    for k in ('uthmani', 'uthmani_script', 'uthmani_text'):
        v = getattr(info, k, None)
        if v:
            return v
    raise RuntimeError('no uthmani field in: ' + str(info)[:300])

def word_at(text, pos):
    words = text.split(' ')
    idx = text[:pos].count(' ')
    return idx + 1, words[idx] if idx < len(words) else '?'

TESTS = [
    ('صحيحة', '1:2', '1:2'),
    ('صحيحة', '112:1', '112:1'),
    ('صحيحة', '2:48', '2:48'),
    ('صحيحة', '2:123', '2:123'),
    ('صحيحة', '7:19', '7:19'),
    ('متشابهة', '2:48', '2:123'),
    ('متشابهة', '2:123', '2:48'),
    ('متشابهة', '7:19', '2:35'),
]

print('loading model (first time downloads ~1.3GB)...', flush=True)
t = time.time()
model = Muaalem(device='cpu', dtype=torch.float32)
print(f'model loaded in {time.time() - t:.0f}s\n', flush=True)

for kind, aud_ref, txt_ref in TESTS:
    print('=' * 60)
    print(f'[{kind}] audio={aud_ref}  text={txt_ref}')
    try:
        wave = audio(aud_ref)
        ref = uthmani(txt_ref)
        ph = quran_phonetizer(ref, MOSHAF, remove_spaces=True)
        t = time.time()
        out = model([wave], [ph], sampling_rate=SR)[0]
        dt = time.time() - t
        errs = explain_error(uthmani_text=ref, ref_ph_text=ph.phonemes,
                             predicted_ph_text=out.phonemes.text, mappings=ph.mappings)
        counts = {'normal': 0, 'tashkeel': 0, 'tajweed': 0}
        for e in errs:
            counts[e.error_type] = counts.get(e.error_type, 0) + 1
        print(f'audio {len(wave) / SR:.1f}s  |  inference {dt:.1f}s')
        print(f'errors -> حروف/كلمات: {counts["normal"]}  تشكيل: {counts["tashkeel"]}  تجويد: {counts["tajweed"]}')
        for e in errs:
            if e.error_type == 'tajweed':
                continue
            n, w = word_at(ref, e.uthmani_pos[0])
            print(f'  - كلمة {n} ({w}): {e.error_type}/{e.speech_error_type}  متوقع="{e.expected_ph}"  اتقال="{e.preditected_ph}"')
    except Exception as ex:
        print('  FAILED:', repr(ex)[:400])
    print(flush=True)
print('DONE')
