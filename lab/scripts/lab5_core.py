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

