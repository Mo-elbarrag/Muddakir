import inspect, time
from lab_core import *

def units_for(refs):
    bas = uthmani('1:1')
    units = [{'label': 'الاستعاذة', 'ref': '-', 'n': 0, 'variants': whole(ISTIADHA) + [''], 'optional': True},
             {'label': 'البسملة', 'ref': '-', 'n': 0, 'variants': whole(bas) + [''], 'optional': True}]
    texts = [uthmani(r) for r in refs]
    for ri, r in enumerate(refs):
        text = texts[ri]
        words = text.split(' ')
        prev = texts[ri - 1] if ri > 0 else bas
        nxt = texts[ri + 1] if ri + 1 < len(texts) else None
        var = [set() for _ in words]
        for ci in range(len(CONFIGS)):
            full = spans_of(text, ci)
            for k in range(len(words)):
                for sp, idx in ((full, k), (spans_of(' '.join(words[:k + 1]), ci), -1),
                                (spans_of(' '.join(words[k:]), ci), 0), (spans_of(words[k], ci), 0)):
                    if sp:
                        var[k].add(sp[idx])
            pw = len(prev.split(' '))
            sp = spans_of(prev + ' ' + text, ci)
            if len(sp) > pw:
                var[0].add(sp[pw])
            if nxt:
                sp = spans_of(text + ' ' + nxt, ci)
                if len(sp) >= len(words):
                    var[-1].add(sp[len(words) - 1])
        for k, w in enumerate(words):
            vs = sorted(v for v in var[k] if v) or ['']
            units.append({'label': w, 'ref': r, 'n': k + 1, 'variants': vs, 'optional': False})
    return units

def align_pos(units, P, K=4, INS=1.0):
    m, n, INF = len(units), len(P), float('inf')
    dp = [[INF] * (n + 1) for _ in range(m + 1)]
    bp = [[None] * (n + 1) for _ in range(m + 1)]
    dp[0][0] = 0
    for j in range(1, n + 1):
        dp[0][j], bp[0][j] = dp[0][j - 1] + INS, ('ins',)
    for i in range(1, m + 1):
        u = units[i - 1]
        lens = {0}
        for v in u['variants']:
            lens.update(range(max(0, len(v) - K), len(v) + K + 1))
        for j in range(n + 1):
            best, b = INF, None
            if j > 0 and dp[i][j - 1] + INS < best:
                best, b = dp[i][j - 1] + INS, ('ins',)
            for l in lens:
                if l > j or dp[i - 1][j - l] >= best:
                    continue
                seg = P[j - l:j]
                c = 0 if (u['optional'] and l == 0) else min(Levenshtein.distance(v, seg) for v in u['variants'])
                if dp[i - 1][j - l] + c < best:
                    best, b = dp[i - 1][j - l] + c, ('unit', l)
            dp[i][j], bp[i][j] = best, b
    i, j, res = m, n, [None] * m
    while i > 0 or j > 0:
        b = bp[i][j]
        if b is None:
            break
        if b[0] == 'ins':
            j -= 1
        else:
            l = b[1]; seg = P[j - l:j]; u = units[i - 1]
            v = min(u['variants'], key=lambda v: Levenshtein.distance(v, seg))
            d = 0 if (u['optional'] and l == 0) else Levenshtein.distance(v, seg)
            res[i - 1] = (seg, v, d, j - l, j); i -= 1; j -= l
    return res

HIFZ = {'كلمة ناقصة', 'حروف', 'حركات'}
TESTS = [
    ('mine/1.ogg', 'الإخلاص صح', ['112:1', '112:2', '112:3', '112:4']),
    ('mine/2.ogg', 'الإخلاص ناقصة "الصمد"', ['112:1', '112:2', '112:3', '112:4']),
    ('mine/3.ogg', 'الفاتحة 2-4 و"الحمدَ" بالفتح', ['1:2', '1:3', '1:4']),
    ('mine/4.ogg', 'الفاتحة 2-4 صح مع ضوضاء', ['1:2', '1:3', '1:4']),
    ('mine/5.ogg', 'الأعراف 19 والمطلوب البقرة 35', ['2:35']),
    ('mine/6.ogg', 'الإخلاص بصوت طفل', ['112:1', '112:2', '112:3', '112:4']),
]

print('loading model...', flush=True)
model = Muaalem(device='cpu', dtype=torch.float32)

print('\n######## MODEL INTERNALS (for ONNX step) ########')
for name, val in vars(model).items():
    print(f'  {name}: {type(val).__module__}.{type(val).__name__}')
    if isinstance(val, torch.nn.Module):
        try:
            print(f'     forward{inspect.signature(val.forward)}')
            print(f'     params: {sum(p.numel() for p in val.parameters()) / 1e6:.0f}M')
        except Exception as ex:
            print('     ', repr(ex)[:200])
print()

for path, title, refs in TESTS:
    f = LAB / path
    if not f.exists():
        continue
    print('=' * 60)
    print(f'[{path}] {title}  -> {", ".join(refs)}')
    try:
        units = units_for(refs)
        wave, _ = load(str(f), sr=SR, mono=True)
        joined = ' '.join(uthmani(r) for r in refs)
        out = model([wave], [quran_phonetizer(joined, BASE, remove_spaces=True)], sampling_rate=SR)[0]
        pred = out.phonemes.text
        probs = out.phonemes.probs
        probs = probs.tolist() if hasattr(probs, 'tolist') else list(probs)
        per_char = len(probs) == len(pred)
        if path.endswith('1.ogg'):
            print(f'  (probs: {len(probs)} values for {len(pred)} chars -> per_char={per_char})')
        res = align_pos(units, pred)
        hifz, notes, info = [], [], []
        for u, r in zip(units, res):
            if r is None:
                continue
            seg, v, d, a, b = r
            if u['optional']:
                if seg:
                    info.append(u['label'])
                continue
            if d == 0:
                continue
            conf = None
            if per_char and b > a:
                conf = min(probs[a:b])
            k = kind(v, seg)
            (hifz if k in HIFZ else notes).append((u, k, v, seg, conf))
        if info:
            print(f'  بدأ بـ: {" + ".join(info)} (مقبول)')
        print(f'  أخطاء حفظ: {len(hifz)}   ملاحظات تجويد: {len(notes)}')
        for u, k, v, seg, conf in hifz + notes:
            mark = '✗' if k in HIFZ else '•'
            c = f'   ثقة={conf:.2f}' if conf is not None else ''
            print(f'   {mark} {u["ref"]} كلمة {u["n"]} ({u["label"]}): {k}   الصح="{v}"   اتقال="{seg}"{c}')
    except Exception:
        import traceback; traceback.print_exc()
    print(flush=True)
print('DONE')
