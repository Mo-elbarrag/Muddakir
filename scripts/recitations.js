const fs = require('fs');
const path = require('path');

const RECITERS = [{ id: 'husary', qdc: 6 }, { id: 'minshawi', qdc: 9 }];
const DATA = path.join('www', 'data');
const OUT = path.join(DATA, 'recit');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isStop = (p) => /[\u06D6\u06D7\u06D8\u06DA\u06DB]/.test(p) && !/\u06D9/.test(p);

function norm(s) {
  return String(s)
    .replace(/\uFEFF/g, '')
    .replace(/ى([\u064B-\u065F\u06D6-\u06ED]*)\u0670/g, 'ى$1')
    .replace(/\u0670/g, 'ا')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه').replace(/ء/g, '')
    .replace(/[^\u0621-\u064A\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokensOf(text) {
  const clean = String(text).replace(/\uFEFF/g, '').replace(/\[[a-z](?::\d+)?\[/g, '').replace(/[\[\]]/g, '');
  return clean.split(/\s+/).filter(Boolean).map((p) => ({ p, c: norm(p) }));
}

async function getJson(url) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (r.ok) return await r.json();
      if (r.status === 429) { await sleep(3000 * (i + 1)); continue; }
      throw new Error('HTTP ' + r.status);
    } catch (e) {
      if (i === 4) throw e;
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}

function markAfter(tokens, words, k) {
  for (let i = words[k] + 1; i < words[k + 1]; i++) if (!tokens[i].c && isStop(tokens[i].p)) return true;
  return false;
}

function chunkAyah(tokens, segs) {
  const words = [];
  tokens.forEach((t, i) => { if (t.c) words.push(i); });
  const W = words.length;
  if (W <= 4 || !segs || segs.length < 2) return [];
  const n = segs.length;
  const map = (k) => (n === W ? k : Math.min(n - 1, Math.round((k * (n - 1)) / Math.max(1, W - 1))));
  const rates = [];
  for (let k = 0; k < W; k++) {
    const sg = segs[map(k)];
    const d = sg[1] - sg[0];
    if (d > 0) rates.push(d / Math.max(1, tokens[words[k]].c.length));
  }
  rates.sort((a, b) => a - b);
  const rate = rates.length ? rates[Math.floor(rates.length / 2)] : 80;
  const cuts = [];
  for (let k = 0; k + 1 < W; k++) {
    if (map(k) === map(k + 1)) continue;
    const a = segs[map(k)];
    const b = segs[map(k + 1)];
    const gap = Math.max(0, b[0] - a[1]);
    const mark = markAfter(tokens, words, k);
    if (gap >= 250 || (mark && gap >= 80)) cuts.push(k);
  }
  let groups = [];
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
        const pl = groups[g - 1][1] - groups[g - 1][0] + 1;
        const nl = groups[g + 1][1] - groups[g + 1][0] + 1;
        if (pl <= nl) groups[g - 1][1] = groups[g][1];
        else groups[g + 1][0] = groups[g][0];
      }
      groups.splice(g, 1);
      changed = true;
      break;
    }
  }
  const out = [];
  for (const [a, b] of groups) {
    let s0 = a;
    while (b - s0 + 1 > 14) {
      let cut = s0 + 7;
      for (let k = s0 + 4; k <= s0 + 10 && k < b; k++) { if (markAfter(tokens, words, k)) { cut = k; break; } }
      out.push([s0, cut]);
      s0 = cut + 1;
    }
    out.push([s0, b]);
  }
  return out.slice(0, -1).map((g) => g[1]);
}

(async () => {
  const quran = JSON.parse(fs.readFileSync(path.join(DATA, 'quran.json'), 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  for (const r of RECITERS) {
    const out = { id: r.id, s: [] };
    let match = 0;
    let mismatch = 0;
    let noSeg = 0;
    for (let ch = 1; ch <= 114; ch++) {
      const j = await getJson('https://api.quran.com/api/v4/chapter_recitations/' + r.qdc + '/' + ch + '?segments=true');
      const af = (j && j.audio_file) || {};
      const ts = af.timestamps || [];
      const byKey = {};
      ts.forEach((t) => { byKey[t.verse_key] = t; });
      const v = quran[ch - 1].ayat.map((text, i) => {
        const t = byKey[ch + ':' + (i + 1)];
        if (!t) return null;
        const segs = (t.segments || []).filter((sg) => Array.isArray(sg) && sg.length >= 3)
          .sort((x, y) => x[0] - y[0]).map((sg) => [sg[1], sg[2]]);
        const tokens = tokensOf(text);
        const W = tokens.filter((x) => x.c).length;
        if (!segs.length) noSeg++;
        else if (segs.length === W) match++;
        else mismatch++;
        return [t.timestamp_from, t.timestamp_to, segs.flat(), chunkAyah(tokens, segs)];
      });
      out.s[ch - 1] = { u: af.audio_url || '', v };
      await sleep(120);
    }
    fs.writeFileSync(path.join(OUT, r.id + '.json'), JSON.stringify(out));
    console.log(r.id + ': word timing match ' + match + ', mismatch ' + mismatch + ', missing ' + noSeg);
    for (const k of ['60:1', '60:7', '60:8', '60:9', '60:10']) {
      const [s, a] = k.split(':').map(Number);
      const row = out.s[s - 1].v[a - 1];
      const words = tokensOf(quran[s - 1].ayat[a - 1]).filter((x) => x.c).map((x) => x.p);
      let txt = '';
      let st = 0;
      ((row && row[3]) || []).forEach((c) => { txt += words.slice(st, c + 1).join(' ') + '  ||  '; st = c + 1; });
      txt += words.slice(st).join(' ');
      console.log('  ' + r.id + ' ' + k + ': ' + txt);
      const sf = (row && row[2]) || [];
      const gl = [];
      for (let w = 0; w + 1 < words.length && 2 * w + 2 < sf.length; w++) gl.push(words[w] + ' (' + (sf[2 * w + 2] - sf[2 * w + 1]) + ')');
      console.log('    gaps: ' + gl.join(' · '));
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
