#!/bin/bash
# Builds whisper.cpp's CLI as a universal (arm64 + x86_64) macOS binary and downloads the
# speech model, into vendor/whisper/. electron-builder ships that folder inside the app, so
# users never install Python, Whisper or ffmpeg. Safe to re-run: skips work already done.
set -euo pipefail

WHISPER_TAG="v1.9.4"
MODEL="ggml-base.en-q5_1.bin"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL}"
MODEL_SHA256="4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f"  # from the repo's Git LFS pointer
# Voice activity detection (Silero): trims silence so pauses can't make Whisper skip speech.
VAD_MODEL="ggml-silero-v5.1.2.bin"
VAD_URL="https://huggingface.co/ggml-org/whisper-vad/resolve/main/${VAD_MODEL}"
VAD_SHA256="29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE="$ROOT_DIR/.cache/whisper-build"
OUT="$ROOT_DIR/vendor/whisper"

ok()   { echo "  ✓ $1"; }
fail() { echo "  ✗ $1" >&2; exit 1; }

mkdir -p "$CACHE" "$OUT"

# ── whisper-cli ───────────────────────────────────────────────────────────────
if [ -x "$OUT/whisper-cli" ] && [ "$(cat "$OUT/VERSION" 2>/dev/null)" = "$WHISPER_TAG" ]; then
  ok "whisper-cli $WHISPER_TAG already built"
else
  # Use cmake from PATH, or install it into a private venv (no system-wide install).
  if command -v cmake >/dev/null 2>&1; then
    CMAKE="$(command -v cmake)"
  else
    if [ ! -x "$ROOT_DIR/.cache/buildtools/bin/cmake" ]; then
      echo "Installing cmake into .cache/buildtools (build-time only)..."
      python3 -m venv "$ROOT_DIR/.cache/buildtools"
      "$ROOT_DIR/.cache/buildtools/bin/pip" install --quiet cmake
    fi
    CMAKE="$ROOT_DIR/.cache/buildtools/bin/cmake"
  fi

  SRC="$CACHE/whisper.cpp-$WHISPER_TAG"
  if [ ! -d "$SRC" ]; then
    git clone --quiet --depth 1 --branch "$WHISPER_TAG" https://github.com/ggml-org/whisper.cpp.git "$SRC"
  fi

  # Some Command Line Tools installs can't find libc++ headers on their own; pointing at the
  # SDK's copy explicitly is harmless when they can.
  SDK="$(xcrun --show-sdk-path)"

  echo "Building whisper-cli $WHISPER_TAG (universal, Metal)..."
  "$CMAKE" -S "$SRC" -B "$SRC/build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
    -DCMAKE_OSX_SYSROOT="$SDK" \
    -DCMAKE_CXX_FLAGS="-isystem $SDK/usr/include/c++/v1" \
    -DBUILD_SHARED_LIBS=OFF \
    -DGGML_NATIVE=OFF \
    -DGGML_METAL=ON \
    -DGGML_METAL_EMBED_LIBRARY=ON \
    -DWHISPER_BUILD_TESTS=OFF \
    -DWHISPER_BUILD_SERVER=OFF \
    -DWHISPER_SDL2=OFF > "$CACHE/cmake-configure.log" 2>&1 || { tail -30 "$CACHE/cmake-configure.log"; fail "cmake configure failed"; }
  "$CMAKE" --build "$SRC/build" --config Release --target whisper-cli -j "$(sysctl -n hw.ncpu)" > "$CACHE/cmake-build.log" 2>&1 \
    || { tail -30 "$CACHE/cmake-build.log"; fail "whisper-cli build failed"; }

  cp "$SRC/build/bin/whisper-cli" "$OUT/whisper-cli"
  echo "$WHISPER_TAG" > "$OUT/VERSION"
  ok "whisper-cli built ($(lipo -archs "$OUT/whisper-cli"))"
fi

# ── Model ─────────────────────────────────────────────────────────────────────
check_model() {
  [ -f "$OUT/$MODEL" ] && [ "$(shasum -a 256 "$OUT/$MODEL" | awk '{print $1}')" = "$MODEL_SHA256" ]
}
if check_model; then
  ok "$MODEL already present"
else
  echo "Downloading $MODEL..."
  curl -fL --progress-bar -o "$OUT/$MODEL.part" "$MODEL_URL"
  mv "$OUT/$MODEL.part" "$OUT/$MODEL"
  check_model || { rm -f "$OUT/$MODEL"; fail "$MODEL checksum mismatch"; }
  ok "$MODEL downloaded and verified"
fi

# ── Voice activity model ──────────────────────────────────────────────────────
check_vad() {
  [ -f "$OUT/$VAD_MODEL" ] && [ "$(shasum -a 256 "$OUT/$VAD_MODEL" | awk '{print $1}')" = "$VAD_SHA256" ]
}
if check_vad; then
  ok "$VAD_MODEL already present"
else
  echo "Downloading $VAD_MODEL..."
  curl -fL --progress-bar -o "$OUT/$VAD_MODEL.part" "$VAD_URL"
  mv "$OUT/$VAD_MODEL.part" "$OUT/$VAD_MODEL"
  check_vad || { rm -f "$OUT/$VAD_MODEL"; fail "$VAD_MODEL checksum mismatch"; }
  ok "$VAD_MODEL downloaded and verified"
fi
