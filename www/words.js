import { normalize } from './quran.js';

const noAlif = (w) => w.replace(/ا/g, '');
const simCache = new Map();

export function refSkeleton(text) {
  return normalize(text).replace(/\s+/g, '');
}

export function heardSkeleton(script) {
  return normalize(script).split(' ').filter(Boolean);
}

function lev(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    const t = prev; prev = cur; cur = t;
  }
  return prev[n];
}

function sim(a, b) {
  if (!a || !b) return 0;
  const k = a + '|' + b;
  if (simCache.has(k)) return simCache.get(k);
  const s1 = 1 - lev(a, b) / Math.max(a.length, b.length);
  const na = noAlif(a);
  const nb = noAlif(b);
  const s2 = na && nb ? 1 - lev(na, nb) / Math.max(na.length, nb.length) : 0;
  const v = Math.max(s1, s2);
  if (simCache.size > 20000) simCache.clear();
  simCache.set(k, v);
  return v;
}

export function alignWords(ref, heard, final) {
  const R = ref.length;
  const H = heard.length;
  const out = ref.map(() => ({ ratio: 0, done: false }));
  if (!R || !H) return out;
  const W = H + 1;
  const INF = 1e9;
  const dp = new Float64Array((R + 1) * W).fill(INF);
  const bt = new Int8Array((R + 1) * W);
  dp[0] = 0;
  for (let j = 1; j <= H; j++) { dp[j] = dp[j - 1] + 0.3; bt[j] = 2; }
  for (let i = 1; i <= R; i++) { dp[i * W] = dp[(i - 1) * W] + 1; bt[i * W] = 1; }
  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= H; j++) {
      let best = dp[(i - 1) * W + j - 1] + (1 - sim(ref[i - 1], heard[j - 1])) * 1.2;
      let b = 0;
      const del = dp[(i - 1) * W + j] + 1;
      if (del < best) { best = del; b = 1; }
      const ins = dp[i * W + j - 1] + 0.7;
      if (ins < best) { best = ins; b = 2; }
      if (j >= 2) {
        const m2 = dp[(i - 1) * W + j - 2] + (1 - sim(ref[i - 1], heard[j - 2] + heard[j - 1])) * 1.2 + 0.1;
        if (m2 < best) { best = m2; b = 3; }
      }
      if (i >= 2) {
        const s2 = dp[(i - 2) * W + j - 1] + (1 - sim(ref[i - 2] + ref[i - 1], heard[j - 1])) * 1.2 + 0.1;
        if (s2 < best) { best = s2; b = 4; }
      }
      dp[i * W + j] = best;
      bt[i * W + j] = b;
    }
  }
  let iEnd = R;
  let jEnd = H;
  if (final) {
    let bv = INF;
    for (let j = 0; j <= H; j++) { const v = dp[R * W + j] + 0.7 * (H - j); if (v < bv) { bv = v; jEnd = j; } }
  } else {
    let bv = INF;
    for (let i = 0; i <= R; i++) { const v = dp[i * W + H] - 0.9 * i; if (v < bv) { bv = v; iEnd = i; } }
  }
  let i = iEnd;
  let j = jEnd;
  while (i > 0 && j > 0) {
    const b = bt[i * W + j];
    if (b === 0) { out[i - 1].ratio = sim(ref[i - 1], heard[j - 1]); i--; j--; }
    else if (b === 1) i--;
    else if (b === 2) j--;
    else if (b === 3) { out[i - 1].ratio = sim(ref[i - 1], heard[j - 2] + heard[j - 1]); i--; j -= 2; }
    else { const r = sim(ref[i - 2] + ref[i - 1], heard[j - 1]); out[i - 1].ratio = r; out[i - 2].ratio = r; i -= 2; j--; }
  }
  for (let k = 0; k < R; k++) out[k].done = final ? true : k < iEnd;
  return out;
}
