import time, difflib
from pathlib import Path
import torch
from librosa.core import load
from quran_transcript import Aya, quran_phonetizer, MoshafAttributes, PhoneticSearch
from quran_muaalem import Muaalem

SR = 16000
MINE = Path(__file__).parent / 'mine'
MOSHAF = MoshafAttributes(rewaya='hafs', madd_monfasel_len=4, madd_mottasel_len=4,
                          madd_mottasel_waqf=4, madd_aared_len=2)
VOWELS = set('\u064e\u064f\u0650\u06ea\u0640')
MADD = set('\u0627\u06e6\u06e5')

def uthmani(ref):
    s, a = map(int, ref.split(':'))
    info = Aya(s, a).get()
    for k in ('uthmani', 'uthmani_script', 'uthmani_text'):
        v = getattr(info, k, None)
        if v:
            return v

def build_ref(refs):
    ph_all, table = '', []
    for r in refs:
        u = uthmani(r)
        ph = quran_phonetizer(u, MOSHAF, remove_spaces=True)
        words = u.split(' ')
        wmap = [None] * len(ph.phonemes)
        for ci, m in enumerate(ph.mappings):
            if m is None or getattr(m, 'deleted', False):
                continue
            w = u[:ci].count(' ')
            for p in range(m.pos[0], min(m.pos[1], len(wmap))):
                wmap[p] = w
        last = 0
        for i in range(len(wmap)):
            if wmap[i] is None:
                wmap[i] = last
            else:
                last = wmap[i]
        for i in range(len(ph.phonemes)):
            table.append((r, wmap[i] + 1, words[wmap[i]]))
        ph_all += ph.phonemes
    return ph_all, table

def kind_of(exp, heard):
    strip = lambda s: ''.join(c for c in s if c not in VOWELS and c not in MADD)
    if strip(exp) == strip(heard):
        only_madd = all(c in MADD for c in exp + heard)
        return 'مد' if only_madd else 'حركات'
    return 'حروف'

def compare(ref_ph, table, pred):
    issues = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ref_ph, pred, autojunk=False).get_opcodes():
        if op == 'equal':
            continue
        at = min(i1, len(table) - 1)
        r, wn, w = table[at]
        issues.append((r, wn, w, ref_ph[i1:i2], pred[j1:j2], kind_of(ref_ph[i1:i2], pred[j1:j2])))
    return issues

TESTS = [
    ('1.ogg', 'الإخلاص صح', ['112:1', '112:2', '112:3', '112:4']),
    ('2.ogg', 'الإخلاص ناقصة "الصمد"', ['112:1', '112:2', '112:3', '112:4']),
    ('3.ogg', 'الفاتحة 2-4 و"الحمدَ" بالفتح', ['1:2', '1:3', '1:4']),
    ('4.ogg', 'الفاتحة 2-4 صح مع ضوضاء', ['1:2', '1:3', '1:4']),
    ('5.ogg', 'الأعراف 19 مقارنة بالنص الصح', ['7:19']),
    ('5.ogg', 'الأعراف 19 والمطلوب البقرة 35', ['2:35']),
    ('6.ogg', 'الإخلاص بصوت طفل', ['112:1', '112:2', '112:3', '112:4']),
]

print('loading model...', flush=True)
model = Muaalem(device='cpu', dtype=torch.float32)
searcher = PhoneticSearch()

for fname, title, refs in TESTS:
    f = MINE / fname
    if not f.exists():
        continue
    print('=' * 60)
    print(f'[{fname}] {title}  -> النص: {", ".join(refs)}')
    try:
        wave, _ = load(str(f), sr=SR, mono=True)
        ref_ph, table = build_ref(refs)
        joined = ' '.join(uthmani(r) for r in refs)
        t = time.time()
        out = model([wave], [quran_phonetizer(joined, MOSHAF, remove_spaces=True)], sampling_rate=SR)[0]
        dt = time.time() - t
        pred = out.phonemes.text
        issues = compare(ref_ph, table, pred)
        c = {'حروف': 0, 'حركات': 0, 'مد': 0}
        for x in issues:
            c[x[5]] += 1
        print(f'audio {len(wave) / SR:.1f}s | inference {dt:.1f}s')
        print(f'issues -> حروف: {c["حروف"]}  حركات: {c["حركات"]}  مد: {c["مد"]}')
        for r, wn, w, exp, heard, k in issues:
            print(f'  - {r} كلمة {wn} ({w}): {k}  متوقع="{exp}"  اتقال="{heard}"')
        if len(refs) == 1:
            for ratio in (0.05, 0.1, 0.15, 0.2):
                res = searcher.search(pred, error_ratio=ratio)
                if res:
                    print(f'  search -> قريت: {[f"{x.start.sura_idx}:{x.start.aya_idx}" for x in res[:5]]} (ratio {ratio})')
                    break
            else:
                print('  search -> مالقاش آية مطابقة')
    except Exception as ex:
        print('  FAILED:', repr(ex)[:400])
    print(flush=True)
print('DONE')
