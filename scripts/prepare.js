const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'www', 'data');
const FONTS = path.join(ROOT, 'www', 'fonts');
const TMP = path.join(ROOT, '.tmp');
const RECITERS = ['Minshawy_Murattal_128kbps', 'Husary_64kbps', 'Husary_Muallim_128kbps', 'Alafasy_128kbps'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url, opts = {}, tries = 4) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
      return res;
    } catch (e) {
      last = e;
      console.error('attempt ' + i + ': ' + e.message);
      await sleep(3000 * i);
    }
  }
  throw last;
}

const plainOf = (t) => t.replace(/\[[a-z](?::\d+)?\[/g, '').replace(/[\[\]]/g, '');
const keyNorm = (s) => s.replace(/\uFEFF/g, '').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/\s+/g, ' ').trim();

async function buildQuran() {
  const res = await fetchRetry('https://api.alquran.cloud/v1/quran/quran-tajweed');
  const json = await res.json();
  const surahs = json && json.data && json.data.surahs;
  if (!Array.isArray(surahs) || surahs.length !== 114) throw new Error('unexpected quran data');
  const basmala = keyNorm(plainOf(surahs[0].ayahs[0].text.replace(/\uFEFF/g, '').trim()));
  let total = 0;
  const data = surahs.map((s) => {
    const ayat = s.ayahs.map((a) => {
      let tokens = a.text.replace(/\uFEFF/g, '').trim().split(/\s+/);
      if (s.number !== 1 && s.number !== 9 && a.numberInSurah === 1 && tokens.length > 4 &&
        keyNorm(plainOf(tokens.slice(0, 4).join(' '))) === basmala) tokens = tokens.slice(4);
      return tokens.join(' ');
    });
    total += ayat.length;
    const name = keyNorm(s.name).replace(/^سورة\s+/, '') || s.englishName;
    return { n: s.number, name, type: s.revelationType, ayat };
  });
  if (total !== 6236) throw new Error('unexpected ayah count ' + total);
  fs.writeFileSync(path.join(DATA, 'quran.json'), JSON.stringify(data));
  console.log('quran.json ready');
}

async function buildTafsir() {
  const res = await fetchRetry('https://api.alquran.cloud/v1/quran/ar.muyassar');
  const json = await res.json();
  const surahs = json && json.data && json.data.surahs;
  if (!Array.isArray(surahs) || surahs.length !== 114) throw new Error('unexpected tafsir data');
  const data = surahs.map((s) => s.ayahs.map((a) => String(a.text || '').trim()));
  fs.writeFileSync(path.join(DATA, 'tafsir.json'), JSON.stringify(data));
  console.log('tafsir.json ready');
}

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function convert(entry) {
  const segs = Array.isArray(entry.segments) ? entry.segments : [];
  let n = 0;
  for (const g of segs) {
    if (!Array.isArray(g) || g.length < 4) continue;
    n = Math.max(n, g[1] > g[0] ? g[1] : g[0] + 1);
  }
  if (!n) return null;
  const st = new Array(n).fill(null);
  const en = new Array(n).fill(null);
  for (const g of segs) {
    if (!Array.isArray(g) || g.length < 4) continue;
    const [a, b, s, e] = g;
    const last = b > a ? b - 1 : a;
    for (let w = a; w <= last && w < n; w++) {
      if (w < 0) continue;
      if (st[w] === null || s < st[w]) st[w] = s;
      if (en[w] === null || e > en[w]) en[w] = e;
    }
  }
  for (let w = 0; w < n; w++) if (st[w] === null) st[w] = w > 0 ? st[w - 1] : 0;
  for (let w = 0; w < n; w++) if (en[w] === null) en[w] = w + 1 < n ? st[w + 1] : st[w] + 500;
  return [n].concat(st.map((x) => Math.round(x)), en.map((x) => Math.round(x)));
}

async function buildTimings() {
  const headers = { 'User-Agent': 'muddakir-build', Accept: 'application/vnd.github+json' };
  if (process.env.GH_TOKEN) headers.Authorization = 'Bearer ' + process.env.GH_TOKEN;
  const rel = await (await fetchRetry('https://api.github.com/repos/cpfair/quran-align/releases/latest', { headers })).json();
  const asset = (rel.assets || [])[0];
  if (!asset) throw new Error('no release asset');
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const file = path.join(TMP, asset.name);
  const buf = Buffer.from(await (await fetchRetry(asset.browser_download_url)).arrayBuffer());
  fs.writeFileSync(file, buf);
  const out = path.join(TMP, 'x');
  fs.mkdirSync(out);
  if (/\.zip$/i.test(asset.name)) execSync('unzip -o -q "' + file + '" -d "' + out + '"');
  else if (/\.tar(\.\w+)?$|\.tgz$/i.test(asset.name)) execSync('tar -xf "' + file + '" -C "' + out + '"');
  else throw new Error('unknown asset type ' + asset.name);
  const files = walk(out).filter((f) => /\.json$/i.test(f));
  const dir = path.join(DATA, 'timings');
  fs.mkdirSync(dir, { recursive: true });
  for (const id of RECITERS) {
    const matches = files.filter((f) => path.relative(out, f).includes(id));
    if (!matches.length) { console.warn('no timing file for ' + id); continue; }
    const map = {};
    for (const f of matches) {
      const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!Array.isArray(arr)) continue;
      for (const e of arr) {
        if (!e || !e.surah || !e.ayah) continue;
        const row = convert(e);
        if (row) map[e.surah + ':' + e.ayah] = row;
      }
    }
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(map));
    console.log('timings ' + id + ': ' + Object.keys(map).length + ' ayat');
  }
}

async function buildFont() {
  fs.mkdirSync(FONTS, { recursive: true });
  const sources = [
    ['https://cdn.jsdelivr.net/npm/@fontsource/amiri-quran/files/amiri-quran-arabic-400-normal.woff2', 'quran.woff2'],
    ['https://raw.githubusercontent.com/google/fonts/main/ofl/amiriquran/AmiriQuran-Regular.ttf', 'quran.ttf']
  ];
  for (const [url, name] of sources) {
    try {
      const res = await fetchRetry(url, {}, 2);
      const b = Buffer.from(await res.arrayBuffer());
      if (b.length < 10000) throw new Error('file too small');
      fs.writeFileSync(path.join(FONTS, name), b);
      console.log('font ready from ' + url);
      return;
    } catch (e) {
      console.warn('font source failed: ' + e.message);
    }
  }
  console.warn('WARNING: Quran font not downloaded, the app will use the system font');
}

(async () => {
  fs.mkdirSync(DATA, { recursive: true });
  await buildQuran();
  try { await buildTafsir(); } catch (e) { console.warn('WARNING: tafsir skipped: ' + e.message); }
  try { await buildTimings(); } catch (e) { console.warn('WARNING: word timings skipped: ' + e.message); }
  await buildFont();
  fs.rmSync(TMP, { recursive: true, force: true });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
