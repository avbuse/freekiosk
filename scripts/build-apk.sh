#!/usr/bin/env bash
# Build FreeKiosk release APK. See docs/development.md for prerequisites.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
APK_OUT="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"

cd "$ROOT"

if [ ! -d "node_modules" ]; then
  echo "==> Installing npm dependencies..."
  npm install
fi

# Resolve Android SDK
if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
  for candidate in "$HOME/Android/Sdk" "$HOME/android-sdk" "/opt/android-sdk"; do
    if [ -d "$candidate" ]; then
      export ANDROID_HOME="$candidate"
      break
    fi
  done
fi

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$SDK" ] || [ ! -d "$SDK" ]; then
  echo "ERROR: Android SDK not found."
  echo "  Set ANDROID_HOME to your SDK path, or install Android Studio / command-line tools."
  echo "  Example: export ANDROID_HOME=\$HOME/Android/Sdk"
  exit 1
fi

echo "==> Using Android SDK: $SDK"
echo "sdk.dir=$SDK" > "$ANDROID_DIR/local.properties"

# Gradle memory (android/gradle.properties is gitignored; use template if missing)
if [ ! -f "$ANDROID_DIR/gradle.properties" ]; then
  echo "==> Creating gradle.properties from template (4GB heap)..."
  cp "$ANDROID_DIR/gradle.properties.template" "$ANDROID_DIR/gradle.properties"
fi

echo "==> Building release APK (this may take several minutes)..."
cd "$ANDROID_DIR"
./gradlew assembleRelease

if [ -f "$APK_OUT" ]; then
  echo ""
  echo "SUCCESS: $APK_OUT"
  ls -lh "$APK_OUT"
else
  echo "ERROR: APK not found at expected path: $APK_OUT"
  exit 1
fi
