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

const PARTICLES = new Set(['لا', 'ما', 'من', 'في', 'علي', 'الي', 'عن', 'ان', 'لم', 'لن', 'قد', 'ثم', 'او', 'يا', 'الذي', 'الذين', 'التي', 'بل', 'اذا', 'لو', 'كل', 'اذ', 'لكن', 'حتي', 'ام', 'هل', 'كما', 'مما', 'الا', 'لما', 'ولا', 'وما', 'ومن', 'وفي', 'فلا', 'فما', 'وان', 'فان', 'لقد', 'ولقد', 'انما', 'بما', 'بان', 'لان', 'كان', 'وكان', 'يوم', 'عند', 'بين', 'قل', 'قال', 'قالوا', 'وقال', 'فقال', 'وهو', 'وهم', 'والذين']);
const COMPLEMENTS = new Set(['لنا', 'له', 'لهم', 'لكم', 'لك', 'لي', 'لها', 'به', 'بها', 'بهم', 'بكم', 'فيه', 'فيها', 'فيهم', 'عليه', 'عليها', 'عليهم', 'عليكم', 'علينا', 'منه', 'منها', 'منهم', 'منكم', 'عنه', 'عنهم', 'اليه', 'اليهم', 'اليكم', 'الينا', 'معه', 'معهم', 'معكم']);

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

export function parseAyah(text) {
  const src = String(text).replace(/\uFEFF/g, '');
  const segs = [];
  const re = /\[([a-z])(?::\d+)?\[([^\]]*)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) segs.push({ t: src.slice(last, m.index), cls: '' });
    segs.push({ t: m[2], cls: TJ[m[1]] || '' });
    last = re.lastIndex;
  }
  if (last < src.length) segs.push({ t: src.slice(last), cls: '' });
  const tokens = [];
  let cur = { html: '', plain: '' };
  const flush = () => {
    if (cur.plain) tokens.push({ html: cur.html, plain: cur.plain, c: normalize(cur.plain) });
    cur = { html: '', plain: '' };
  };
  for (const sg of segs) {
    const clean = sg.t.replace(/\[[a-z](?::\d+)?\[/g, '').replace(/[\[\]]/g, '');
    for (const part of clean.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { flush(); continue; }
      cur.plain += part;
      cur.html += sg.cls ? '<span class="' + sg.cls + '">' + escT(part) + '</span>' : escT(part);
    }
  }
  flush();
  return tokens;
}

function dpSplit(tokens, words, pauses, a, b) {
  const W = b - a + 1;
  const cutScore = (k) => {
    const ti = words[k];
    const tn = words[k + 1];
    let s = 0;
    if (tn - ti > 1) s += 10;
    const ps = pauses ? pauses[ti] : null;
    if (ps !== null && ps !== undefined) {
      if (ps >= 400) s += 8;
      else if (ps >= 250) s += 5;
      else if (ps >= 150) s += 2;
    }
    if (PARTICLES.has(tokens[ti].c)) s -= 12;
    if (COMPLEMENTS.has(tokens[tn].c)) s -= 6;
    const f = tokens[tn].c.charAt(0);
    if (f === 'و' || f === 'ف') s += 1;
    return s;
  };
  const sizeCost = (len) => {
    if (len < 2) return 60;
    if (len > 8) return 60 + (len - 8) * 10;
    if (len >= 4 && len <= 6) return 0;
    if (len === 3 || len === 7) return 1;
    return 2.5;
  };
  const best = new Array(W + 1).fill(Infinity);
  const prev = new Array(W + 1).fill(-1);
  best[0] = 0;
  for (let i = 1; i <= W; i++) {
    for (let j = Math.max(0, i - 12); j < i; j++) {
      if (best[j] === Infinity) continue;
      const c = best[j] + sizeCost(i - j) - (i < W ? cutScore(a + i - 1) : 0);
      if (c < best[i]) { best[i] = c; prev[i] = j; }
    }
  }
  const out = [];
  let i = W;
  while (i > 0) {
    const j = prev[i];
    out.unshift([a + j, a + i - 1]);
    i = j;
  }
  return out;
}

export function splitChunks(tokens, pauses) {
  const words = [];
  tokens.forEach((t, i) => { if (t.c) words.push(i); });
  const W = words.length;
  if (W <= 4) return [[0, tokens.length - 1]];
  let groups;
  if (pauses) {
    const cuts = [];
    for (let k = 0; k + 1 < W; k++) {
      const ps = pauses[words[k]];
      const mark = words[k + 1] - words[k] > 1;
      if (ps !== null && ps !== undefined && (ps >= 280 || (mark && ps >= 150))) cuts.push(k);
    }
    groups = [];
    let st = 0;
    for (const k of cuts) { groups.push([st, k]); st = k + 1; }
    groups.push([st, W - 1]);
    let changed = true;
    while (changed && groups.length > 1) {
      changed = false;
      for (let g = 0; g < groups.length; g++) {
        if (groups[g][1] - groups[g][0] + 1 >= 2) continue;
        if (g === 0) groups[1][0] = groups[0][0];
        else if (g === groups.length - 1) groups[g - 1][1] = groups[g][1];
        else {
          const prevLen = groups[g - 1][1] - groups[g - 1][0] + 1;
          const nextLen = groups[g + 1][1] - groups[g + 1][0] + 1;
          if (prevLen <= nextLen) groups[g - 1][1] = groups[g][1];
          else groups[g + 1][0] = groups[g][0];
        }
        groups.splice(g, 1);
        changed = true;
        break;
      }
    }
    const out = [];
    for (const [a, b] of groups) {
      if (b - a + 1 > 12) out.push(...dpSplit(tokens, words, pauses, a, b));
      else out.push([a, b]);
    }
    groups = out;
  } else {
    groups = W <= 5 ? [[0, W - 1]] : dpSplit(tokens, words, null, 0, W - 1);
  }
  return groups.map(([a, b], gi) => [gi === 0 ? 0 : words[a], gi === groups.length - 1 ? tokens.length - 1 : words[b + 1] - 1]);
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
