const TJ = {
  h: 'tj-silent', s: 'tj-silent', l: 'tj-silent', u: 'tj-silent', d: 'tj-silent', b: 'tj-silent',
  n: 'tj-madd2', p: 'tj-madd246', o: 'tj-madd45', m: 'tj-madd6', q: 'tj-qalqala',
  c: 'tj-ghunna', f: 'tj-ghunna', w: 'tj-ghunna', i: 'tj-ghunna', a: 'tj-ghunna', g: 'tj-ghunna'
};

export const LEGEND = [
  ['tj-madd6', 'مد لازم 6 حركات'],
  ['tj-madd45', 'مد واجب 4 أو 5'],
  ['tj-madd246', 'مد جائز 2 أو 4 أو 6'],
  ['tj-madd2', 'مد طبيعي حركتين'],
  ['tj-ghunna', 'غنة وإخفاء وإقلاب'],
  ['tj-qalqala', 'قلقلة'],
  ['tj-silent', 'لا يُنطق']
];

const escT = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function normalize(s) {
  return String(s)
    .replace(/\uFEFF/g, '')
    .replace(/ى([\u064B-\u065F\u06D6-\u06ED]*)\u0670/g, 'ى$1')
    .replace(/\u0670/g, 'ا')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ء/g, '')
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseToken(raw) {
  let html = '';
  let plain = '';
  let last = 0;
  let m;
  const re = /\[([a-z])(?::\d+)?\[([^\]]*)\]/g;
  while ((m = re.exec(raw))) {
    const before = raw.slice(last, m.index).replace(/[\[\]]/g, '');
    html += escT(before);
    plain += before;
    const cls = TJ[m[1]];
    html += cls ? '<span class="' + cls + '">' + escT(m[2]) + '</span>' : escT(m[2]);
    plain += m[2];
    last = re.lastIndex;
  }
  const rest = raw.slice(last).replace(/[\[\]]/g, '');
  html += escT(rest);
  plain += rest;
  return { html, plain };
}

export function parseAyah(text) {
  return String(text).split(' ').filter(Boolean).map((raw) => {
    const t = parseToken(raw);
    return { html: t.html, plain: t.plain, c: normalize(t.plain) };
  });
}

export function splitChunks(tokens) {
  const total = tokens.filter((t) => t.c).length;
  if (total <= 7) return [[0, tokens.length - 1]];
  const chunks = [];
  let start = 0;
  let count = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.c) count++;
    const nextMark = i + 1 < tokens.length && !tokens[i + 1].c;
    if ((!t.c && count >= 3) || (t.c && count >= 7 && !nextMark)) {
      chunks.push([start, i, count]);
      start = i + 1;
      count = 0;
    }
  }
  if (start < tokens.length) chunks.push([start, tokens.length - 1, count]);
  if (chunks.length > 1 && chunks[chunks.length - 1][2] < 3) {
    const tail = chunks.pop();
    chunks[chunks.length - 1][1] = tail[1];
    chunks[chunks.length - 1][2] += tail[2];
  }
  return chunks.map((c) => [c[0], c[1]]);
}

export function buildStages(chunks) {
  if (chunks.length === 1) return [{ from: chunks[0][0], to: chunks[0][1], kind: 'learn' }];
  const first = chunks[0][0];
  const lastTo = chunks[chunks.length - 1][1];
  const cumulative = chunks.length <= 4;
  const st = [];
  chunks.forEach((c, i) => {
    st.push({ from: c[0], to: c[1], kind: 'learn' });
    if (i > 0) st.push({ from: cumulative ? first : chunks[i - 1][0], to: c[1], kind: 'link' });
  });
  if (!cumulative) st.push({ from: first, to: lastTo, kind: 'full' });
  return st;
}
