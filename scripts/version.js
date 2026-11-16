const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const sh = (c) => { try { return execSync(c, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return ''; } };

module.exports = function writeVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const now = new Date();
  // دقايق من أول 2024: بيزيد مع كل build، من الويندوز أو من GitHub
  const build = Math.floor((now.getTime() - Date.UTC(2024, 0, 1)) / 60000);
  const sha = (process.env.GITHUB_SHA || sh('git rev-parse HEAD')).slice(0, 7);
  const date = now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const info = { version: pkg.version, build, sha, date };
  fs.mkdirSync(path.join(ROOT, 'www'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'www', 'version.json'), JSON.stringify(info));
  const gradle = path.join(ROOT, 'android', 'app', 'build.gradle');
  if (fs.existsSync(gradle)) {
    let g = fs.readFileSync(gradle, 'utf8');
    g = g.replace(/versionCode\s+\d+/, 'versionCode ' + build).replace(/versionName\s+"[^"]*"/, 'versionName "' + pkg.version + '"');
    fs.writeFileSync(gradle, g);
  }
  console.log('version ' + pkg.version + ' build ' + build + ' ' + sha);
  return info;
};

if (require.main === module) module.exports();
