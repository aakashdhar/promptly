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

# CHECK 4 — ffmpeg reachable (non-login PATH, then common locations — mirrors resolveFfmpegPath())
FFMPEG=$(env -i HOME="$HOME" /bin/sh -c 'command -v ffmpeg' 2>/dev/null || true)
if [ -z "$FFMPEG" ]; then
  for p in \
    "/usr/local/bin/ffmpeg" "/opt/homebrew/bin/ffmpeg" \
    "$HOME/.local/bin/ffmpeg" "/usr/bin/ffmpeg"; do
    [ -f "$p" ] && { FFMPEG="$p"; break; }
  done
fi
[ -z "$FFMPEG" ] && fail "ffmpeg not found in non-login shell PATH or any common install location."
ok "CHECK 4: ffmpeg found at $FFMPEG"

# CHECK 5 — whisper reachable (non-login PATH, then common locations — mirrors resolveWhisperPath())
WHISPER=$(env -i HOME="$HOME" /bin/sh -c 'command -v whisper' 2>/dev/null || true)
if [ -z "$WHISPER" ]; then
  for p in \
    "/usr/local/bin/whisper" "/usr/bin/whisper" \
    "$HOME/.pyenv/shims/whisper" "$HOME/.local/bin/whisper" \
    "$HOME/.local/pipx/venvs/openai-whisper/bin/whisper" \
    "$HOME/Library/Python/3.12/bin/whisper" "$HOME/Library/Python/3.11/bin/whisper" \
    "$HOME/Library/Python/3.10/bin/whisper" "$HOME/Library/Python/3.9/bin/whisper" \
    "/opt/homebrew/bin/whisper" "/opt/local/bin/whisper"; do
    [ -f "$p" ] && { WHISPER="$p"; break; }
  done
fi
[ -z "$WHISPER" ] && fail "whisper not found in non-login shell PATH or any common install location."
ok "CHECK 5: whisper found at $WHISPER"

# CHECK 6 — whisper executes (resolve shim → real binary via pyenv if needed, then test --help)
WHISPER_REAL="$WHISPER"
if echo "$WHISPER" | grep -q ".pyenv/shims"; then
  WHISPER_REAL=$(zsh -lc "pyenv which whisper 2>/dev/null" 2>/dev/null || echo "$WHISPER")
fi
"$WHISPER_REAL" --help >/dev/null 2>&1 || \
  fail "whisper found but failed to execute. Check Python PATH and SSL certificate environment variables."
ok "CHECK 6: whisper --help exits 0"

# CHECK 7 — all spawn(claudePath calls use makeClaudeEnv
python3 - <<'PYEOF'
import sys
with open('main.js') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'spawn(claudePath' in line and not line.strip().startswith('//'):
        window = ''.join(lines[max(0,i-2):min(len(lines),i+4)])
        if 'makeClaudeEnv' not in window:
            print(f"FAIL: spawn call at line {i+1} in main.js does not use makeClaudeEnv(). This will break on nvm/non-standard installs.")
            sys.exit(1)
PYEOF
[ $? -ne 0 ] && exit 1
ok "CHECK 7: all spawn(claudePath calls use makeClaudeEnv"

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
