const fs = require('fs');
const path = require('path');

const RES = path.join('android', 'app', 'src', 'main', 'res');
const STAR = 'M880 512L772 619.7L772 772L619.7 772L512 880L404.3 772L252 772L252 619.7L144 512L252 404.3L252 252L404.3 252L512 144L619.7 252L772 252L772 404.3Z';

function iconSvg(bg, scale) {
  const back = bg === 'square' ? '<rect width="1024" height="1024" rx="230" fill="#1B3A33"/>'
    : bg === 'circle' ? '<circle cx="512" cy="512" r="512" fill="#1B3A33"/>' : '';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">' + back +
    '<g transform="translate(512 512) scale(' + scale + ') translate(-512 -512)">' +
    '<path d="' + STAR + '" fill="#234A41" stroke="#D9B26A" stroke-width="26" stroke-linejoin="round"/>' +
    '<path d="M512 640C452 605 385 600 335 615L335 480C385 465 452 470 512 500Z" fill="#F7F3EA"/>' +
    '<path d="M512 640C572 605 639 600 689 615L689 480C639 465 572 470 512 500Z" fill="#EDE3CC"/>' +
    '<path d="M512 500L512 640" stroke="#B8893B" stroke-width="8" stroke-linecap="round"/>' +
    '<g fill="none" stroke="#D9B26A" stroke-width="20" stroke-linecap="round">' +
    '<path d="M487 426.7A50 50 0 0 1 537 426.7"/><path d="M468 393.8A88 88 0 0 1 556 393.8"/><path d="M449 360.9A126 126 0 0 1 575 360.9"/>' +
    '</g></g></svg>';
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function setupPermissions() {
  const manifest = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
  let xml = fs.readFileSync(manifest, 'utf8');
  for (const p of ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS']) {
    if (!xml.includes(p)) xml = xml.replace('<application', '<uses-permission android:name="' + p + '" />\n\n    <application');
  }
  fs.writeFileSync(manifest, xml);
}

function setupSigning() {
  const gradle = path.join('android', 'app', 'build.gradle');
  let g = fs.readFileSync(gradle, 'utf8');
  if (!g.includes('appDebugSigning')) {
    g = g.replace(/android\s*\{/, `android {
    // appDebugSigning
    signingConfigs {
        debug {
            storeFile file("../../keystore/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }`);
  }
  fs.writeFileSync(gradle, g);
}

async function setupIcons(sharp) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  const square = Buffer.from(iconSvg('square', 0.95));
  const round = Buffer.from(iconSvg('circle', 0.9));
  const fg = Buffer.from(iconSvg('none', 0.72));
  for (const [d, k] of Object.entries(dens)) {
    const dir = path.join(RES, 'mipmap-' + d);
    fs.mkdirSync(dir, { recursive: true });
    const s48 = Math.round(48 * k);
    const s108 = Math.round(108 * k);
    await sharp(square).resize(s48, s48).png().toFile(path.join(dir, 'ic_launcher.png'));
    await sharp(round).resize(s48, s48).png().toFile(path.join(dir, 'ic_launcher_round.png'));
    await sharp(fg).resize(s108, s108).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
  }
  const anydpi = path.join(RES, 'mipmap-anydpi-v26');
  fs.mkdirSync(anydpi, { recursive: true });
  const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n';
  fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), adaptive);
  fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), adaptive);

  let found = false;
  for (const f of walk(RES)) {
    if (!path.basename(path.dirname(f)).startsWith('values') || !f.endsWith('.xml')) continue;
    let x = fs.readFileSync(f, 'utf8');
    if (x.includes('name="ic_launcher_background"')) {
      x = x.replace(/(<color name="ic_launcher_background">)[^<]*(<\/color>)/, '$1#1B3A33$2');
      fs.writeFileSync(f, x);
      found = true;
    }
  }
  if (!found) {
    fs.mkdirSync(path.join(RES, 'values'), { recursive: true });
    fs.writeFileSync(path.join(RES, 'values', 'ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1B3A33</color>\n</resources>\n');
  }

  for (const f of walk(RES).filter((x) => path.basename(x) === 'splash.png')) {
    const meta = await sharp(f).metadata();
    const w = meta.width;
    const h = meta.height;
    if (!w || !h) continue;
    const size = Math.max(48, Math.round(Math.min(w, h) * 0.32));
    const ic = await sharp(square).resize(size, size).png().toBuffer();
    const tmp = f.replace(/\.png$/, '_new.png');
    await sharp({ create: { width: w, height: h, channels: 4, background: '#F7F3EA' } })
      .composite([{ input: ic, gravity: 'center' }]).png().toFile(tmp);
    fs.renameSync(tmp, f);
  }
  console.log('icons ready');
}

(async () => {
  setupPermissions();
  setupSigning();
  try {
    const sharp = require('sharp');
    await setupIcons(sharp);
  } catch (e) {
    console.warn('WARNING: icon generation skipped: ' + e.message);
  }
  console.log('android setup done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
