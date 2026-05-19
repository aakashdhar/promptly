#!/bin/bash
# Pre-release preflight checks — run before every build.
# CHECKs 1-6: non-login shell reachability. CHECKs 7-10: codebase assertions.

set -euo pipefail

ok()   { echo "  ✓ $1"; }
fail() { echo ""; echo "  FAIL: $1"; echo ""; exit 1; }

echo ""
echo "── Preflight checks ──────────────────────────────────────────────────────"
echo ""

# CHECK 1 — node reachable in non-login shell
NODE=$(env -i HOME="$HOME" /bin/sh -c 'command -v node' 2>/dev/null || true)
[ -z "$NODE" ] && fail "node not found in non-login shell PATH.
 Electron child processes will fail with env: node: No such file or directory. Run: export PATH=\$(dirname \$(which node)):\$PATH"
ok "CHECK 1: node found at $NODE"

# CHECK 2 — claude reachable in non-login shell
CLAUDE=$(env -i HOME="$HOME" /bin/sh -c 'command -v claude' 2>/dev/null || true)
[ -z "$CLAUDE" ] && fail "claude not found in non-login shell PATH."
ok "CHECK 2: claude found at $CLAUDE"

# CHECK 3 — claude executes and responds in non-login shell
CLAUDE_OUT=$(timeout 60 env -i HOME="$HOME" /bin/sh -c 'claude -p "respond with READY"' 2>/dev/null || true)
echo "$CLAUDE_OUT" | grep -q "READY" || fail "claude binary found but not executable in non-login shell.
 Likely a symlinked binary whose node is not in PATH."
ok "CHECK 3: claude responds READY in non-login shell"

# CHECK 4 — ffmpeg reachable in non-login shell
FFMPEG=$(env -i HOME="$HOME" /bin/sh -c 'command -v ffmpeg' 2>/dev/null || true)
[ -z "$FFMPEG" ] && fail "ffmpeg not found in non-login shell PATH."
ok "CHECK 4: ffmpeg found at $FFMPEG"

# CHECK 5 — whisper reachable in non-login shell
WHISPER=$(env -i HOME="$HOME" /bin/sh -c 'command -v whisper' 2>/dev/null || true)
[ -z "$WHISPER" ] && fail "whisper not found in non-login shell PATH."
ok "CHECK 5: whisper found at $WHISPER"

# CHECK 6 — whisper executes successfully in non-login shell
env -i HOME="$HOME" /bin/sh -c 'whisper --help' >/dev/null 2>&1 || \
  fail "whisper found but failed to execute. Check Python PATH and SSL certificate environment variables."
ok "CHECK 6: whisper --help exits 0 in non-login shell"

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
