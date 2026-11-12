#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

export PATH="$PATH:/c/Program Files/nodejs"
STUDIO_JBR="/c/Program Files/Android/Android Studio/jbr"
if [ -d "$STUDIO_JBR" ]; then
  export JAVA_HOME="$STUDIO_JBR"
  export PATH="$JAVA_HOME/bin:$PATH"
fi
if [ -n "$LOCALAPPDATA" ]; then
  WIN_SDK="$(cygpath -u "$LOCALAPPDATA")/Android/Sdk"
  if [ -d "$WIN_SDK" ]; then
    export ANDROID_HOME="$WIN_SDK"
    export ANDROID_SDK_ROOT="$WIN_SDK"
    export PATH="$WIN_SDK/platform-tools:$PATH"
  fi
fi

command -v node >/dev/null || { echo "❌ Node.js مش موجود"; exit 1; }
command -v java >/dev/null || { echo "❌ Java مش موجود: سطّب Android Studio الأول"; exit 1; }
[ -n "$ANDROID_HOME" ] || { echo "❌ Android SDK مش موجود: افتح Android Studio مرة وخليه يكمّل التسطيب"; exit 1; }

echo "== تحديث المشروع"
git pull --rebase origin main || true
npm install --no-audit --no-fund

if [ "$1" = "--fresh" ] || [ ! -f www/data/quran.json ]; then
  echo "== تجهيز بيانات القرآن"
  node scripts/prepare.js
fi

echo "== توقيتات القرّاء ووقفاتهم"
node scripts/recitations.js

if [ "$1" = "--fresh" ] || [ ! -f www/models/tarteel/encoder.onnx ]; then
  echo "== موديل ترتيل"
  node scripts/tarteel.js
  if command -v py >/dev/null; then
    py -3 -m pip install -q onnxruntime==1.20.1 onnx && py -3 scripts/quantize_tarteel.py || true
  fi
  if [ -f www/models/tarteel/encoder-fp32.onnx ]; then mv -f www/models/tarteel/encoder-fp32.onnx www/models/tarteel/encoder.onnx; fi
  if [ -f www/models/tarteel/decoder-fp32.onnx ]; then mv -f www/models/tarteel/decoder-fp32.onnx www/models/tarteel/decoder.onnx; fi
fi

echo "== بناء التطبيق"
if [ ! -d android ]; then npx cap add android; fi
node scripts/android-setup.js
npx cap sync android
(cd android && ./gradlew assembleDebug --no-daemon)
cp -f android/app/build/outputs/apk/debug/app-debug.apk ./muddakir.apk
echo "✅ الـ APK جاهز: $(pwd)/muddakir.apk"

if command -v adb >/dev/null && [ "$(adb get-state 2>/dev/null)" = "device" ]; then
  adb install -r muddakir.apk && echo "✅ اتسطب على الموبايل"
else
  echo "ℹ️ وصّل الموبايل بالكابل (مع تصحيح أخطاء USB) عشان يتسطب لوحده"
fi
