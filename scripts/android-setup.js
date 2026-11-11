const fs = require('fs');
const path = require('path');

const manifest = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
let xml = fs.readFileSync(manifest, 'utf8');
for (const p of ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS']) {
  if (!xml.includes(p)) {
    xml = xml.replace('<application', '<uses-permission android:name="' + p + '" />\n\n    <application');
  }
}
fs.writeFileSync(manifest, xml);

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
console.log('android setup done');
