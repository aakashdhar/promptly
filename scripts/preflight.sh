#!/bin/bash
# Pre-release preflight checks — run before every build.
# CHECKs 1-6: non-login shell reachability. CHECKs 7-10: codebase assertions.

set -euo pipefail

ok()   { echo "  ✓ $1"; }
fail() { echo ""; echo "  FAIL: $1"; echo ""; exit 1; }

echo ""
echo "── Preflight checks ──────────────────────────────────────────────────────"
echo ""

# CHECK 1 — node reachable in non-login shell (or via nvm, matching makeClaudeEnv's scan)
NODE=$(env -i HOME="$HOME" /bin/sh -c 'command -v node' 2>/dev/null || true)
if [ -z "$NODE" ]; then
  NODE=$(ls "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1 || true)
  [ -z "$NODE" ] && fail "node not found in non-login shell PATH.
 Electron child processes will fail with env: node: No such file or directory. Run: export PATH=\$(dirname \$(which node)):\$PATH"
  ok "CHECK 1: node found via nvm at $NODE (makeClaudeEnv injects this path — OK)"
else
  ok "CHECK 1: node found at $NODE"
fi

# CHECK 2 — claude reachable (non-login PATH, then common install locations — mirrors resolveClaudePath())
CLAUDE=$(env -i HOME="$HOME" /bin/sh -c 'command -v claude' 2>/dev/null || true)
if [ -z "$CLAUDE" ]; then
  for p in \
    "/usr/local/bin/claude" "/usr/bin/claude" \
    "$HOME/.local/bin/claude" "$HOME/.npm-global/bin/claude" \
    "/opt/homebrew/bin/claude" "/opt/local/bin/claude" \
    "$HOME/.volta/bin/claude" "$HOME/n/bin/claude"; do
    [ -f "$p" ] && { CLAUDE="$p"; break; }
  done
fi
if [ -z "$CLAUDE" ]; then
  CLAUDE=$(ls "$HOME"/.nvm/versions/node/*/bin/claude 2>/dev/null | sort -V | tail -1 || true)
fi
[ -z "$CLAUDE" ] && fail "claude not found in non-login shell PATH or any common install location."
ok "CHECK 2: claude found at $CLAUDE"

# CHECK 3 — claude executes and responds (env like makeClaudeEnv: inject dirname + auth vars)
CLAUDE_DIR=$(dirname "$CLAUDE")
CLAUDE_OUT=$(perl -e 'alarm(60); exec @ARGV' -- \
  env -i HOME="$HOME" USER="${USER:-$(id -un)}" TMPDIR="${TMPDIR:-/tmp}" \
  PATH="$CLAUDE_DIR:/usr/local/bin:/usr/bin:/bin" \
  "$CLAUDE" -p "respond with READY" 2>/dev/null || true)
echo "$CLAUDE_OUT" | grep -q "READY" || fail "claude binary found but not executable in non-login shell.
 Likely a symlinked binary whose node is not in PATH."
ok "CHECK 3: claude responds READY in non-login shell"

# CHECK 4 — built-in speech engine is built (users no longer install Whisper, Python or ffmpeg)
WHISPER_DIR="vendor/whisper"
[ -x "$WHISPER_DIR/whisper-cli" ] || fail "Built-in speech engine missing. Run: bash scripts/fetch-whisper.sh"
ARCHS=$(lipo -archs "$WHISPER_DIR/whisper-cli" 2>/dev/null)
echo "$ARCHS" | grep -q arm64 && echo "$ARCHS" | grep -q x86_64 \
  || fail "whisper-cli is not universal (has: $ARCHS). Rebuild with scripts/fetch-whisper.sh"
ok "CHECK 4: whisper-cli built ($ARCHS)"

# CHECK 5 — speech model present and matches the pinned checksum
MODEL_SHA=$(grep '^MODEL_SHA256=' scripts/fetch-whisper.sh | sed -E 's/MODEL_SHA256="([0-9a-f]+)".*/\1/')
MODEL_FILE="$WHISPER_DIR/$(grep '^MODEL=' scripts/fetch-whisper.sh | sed -E 's/MODEL="(.+)"/\1/')"
[ -f "$MODEL_FILE" ] || fail "Speech model missing. Run: bash scripts/fetch-whisper.sh"
[ "$(shasum -a 256 "$MODEL_FILE" | awk '{print $1}')" = "$MODEL_SHA" ] || fail "Speech model checksum mismatch: $MODEL_FILE"
ok "CHECK 5: speech model verified ($(basename "$MODEL_FILE"))"
VAD_SHA=$(grep '^VAD_SHA256=' scripts/fetch-whisper.sh | sed -E 's/VAD_SHA256="([0-9a-f]+)".*/\1/')
VAD_FILE="$WHISPER_DIR/$(grep '^VAD_MODEL=' scripts/fetch-whisper.sh | sed -E 's/VAD_MODEL="(.+)"/\1/')"
[ -f "$VAD_FILE" ] || fail "Voice activity model missing. Run: bash scripts/fetch-whisper.sh"
[ "$(shasum -a 256 "$VAD_FILE" | awk '{print $1}')" = "$VAD_SHA" ] || fail "Voice activity model checksum mismatch: $VAD_FILE"
ok "CHECK 5b: voice activity model verified ($(basename "$VAD_FILE"))"

# CHECK 6 — the engine actually runs (1 s of silence, CPU only, minimal environment)
SILENCE=$(mktemp -t promptly-silence).wav
python3 -c "import wave; w=wave.open('$SILENCE','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b'\x00\x00'*16000); w.close()"
env -i HOME="$HOME" "$WHISPER_DIR/whisper-cli" -m "$MODEL_FILE" -f "$SILENCE" -l en --no-prints --no-gpu --vad -vm "$VAD_FILE" >/dev/null 2>&1 \
  || { rm -f "$SILENCE"; fail "whisper-cli failed to transcribe a test file"; }
rm -f "$SILENCE"
ok "CHECK 6: whisper-cli transcribes"

# CHECK 6b — hold-to-talk helper builds and answers
bash scripts/build-helper.sh >/dev/null || fail "promptly-helper failed to build"
# Waits up to 5 s for the reply: a freshly built binary can be slow to launch the first time.
python3 - <<'PYHELPER' || fail "promptly-helper did not answer a status request"
import json, subprocess, sys, threading, time
p = subprocess.Popen(['vendor/helper/promptly-helper'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
threading.Timer(5, p.kill).start()   # a silent helper can't hang the check
p.stdin.write(json.dumps({'cmd': 'status', 'id': 1}) + '\n'); p.stdin.flush()
deadline = time.time() + 5
ok = False
while time.time() < deadline:
    line = p.stdout.readline()
    if not line:
        break
    if json.loads(line).get('type') == 'status':
        ok = True
        break
p.stdin.close(); p.kill()
sys.exit(0 if ok else 1)
PYHELPER
ok "CHECK 6b: promptly-helper built ($(lipo -archs vendor/helper/promptly-helper)) and answers"

# CHECK 7 — every Claude process (main.js + main/) uses makeClaudeEnv
python3 - <<'PYEOF'
import sys, glob
files = ['main.js'] + sorted(glob.glob('main/**/*.js', recursive=True))
for path in files:
    with open(path) as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith('//'):
            continue
        if ('spawn' in s or 'execFile' in s) and '(claudePath' in s.replace(' ', ''):
            window = ''.join(lines[max(0,i-2):min(len(lines),i+4)])
            if 'makeClaudeEnv' not in window:
                print(f"FAIL: Claude process at {path}:{i+1} does not use makeClaudeEnv(). This will break on nvm/non-standard installs.")
                sys.exit(1)
PYEOF
[ $? -ne 0 ] && exit 1
ok "CHECK 7: every Claude process uses makeClaudeEnv"

# CHECK 8 — settings button present in ExpandedTransportBar
count=$(grep -c "onOpenSettings" src/renderer/components/ExpandedTransportBar.jsx 2>/dev/null || echo 0)
[ "$count" -lt 1 ] && fail "Settings button not found in ExpandedTransportBar.jsx. Users cannot open settings."
ok "CHECK 8: settings button present in ExpandedTransportBar"

# CHECK 9 — all 3 path fields present in SettingsPanel
settings_file="src/renderer/components/SettingsPanel.jsx"
for field in claudeVal whisperVal ffmpegVal; do
  grep -q "$field" "$settings_file" || fail "$field not configurable in SettingsPanel.jsx. Users cannot override this path after install."
done
ok "CHECK 9: all 3 path fields present in SettingsPanel"

# CHECK 10 — ffmpegPath wired in all 3 path IPC handlers
for handler in "save-paths" "get-stored-paths" "recheck-paths"; do
  block=$(grep -A 15 "'${handler}'" main.js)
  echo "$block" | grep -q "ffmpegPath" || fail "ffmpegPath not wired in ${handler} IPC handler."
done
ok "CHECK 10: ffmpegPath wired in all 3 path IPC handlers"

echo ""
echo "  All preflight checks passed."
echo ""
