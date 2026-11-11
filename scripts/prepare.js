const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'www', 'data');
const SOURCE = 'https://api.alquran.cloud/v1/quran/quran-simple';

function normalize(s) {
  return s.replace(/\uFEFF/g, '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

async function download() {
  let lastError;
  for (let i = 1; i <= 4; i++) {
    try {
      const res = await fetch(SOURCE);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json.data || !Array.isArray(json.data.surahs) || json.data.surahs.length !== 114) throw new Error('unexpected data');
      return json.data.surahs;
    } catch (e) {
      lastError = e;
      console.error('attempt ' + i + ' failed: ' + e.message);
      await new Promise((r) => setTimeout(r, 4000 * i));
    }
  }
  throw lastError;
}

function clean(text) {
  return text.replace(/\uFEFF/g, '').replace(/\s+/g, ' ').trim();
}

function dropBasmala(text, surah, ayah) {
  if (surah === 1 || surah === 9 || ayah !== 1) return text;
  const words = text.split(' ');
  if (words.length > 4 && normalize(words.slice(0, 4).join(' ')) === 'بسم الله الرحمن الرحيم') {
    return words.slice(4).join(' ');
  }
  return text;
}

(async () => {
  const surahs = await download();
  let total = 0;
  const data = surahs.map((s) => {
    const ayat = s.ayahs.map((a) => dropBasmala(clean(a.text), s.number, a.numberInSurah));
    total += ayat.length;
    const name = normalize(s.name).replace(/^سورة\s+/, '') || s.englishName;
    return { n: s.number, name, type: s.revelationType, ayat };
  });
  if (total !== 6236) throw new Error('unexpected ayah count: ' + total);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'quran.json'), JSON.stringify(data));
  console.log('quran.json ready: ' + total + ' ayat');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
