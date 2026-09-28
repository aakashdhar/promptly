'use strict';

// Uninstall is handed to scripts/uninstall.sh (shipped as Contents/uninstall.sh) and runs after
// Promptly has exited. Tearing the app down from inside itself froze the Mac: the helper's
// system-wide key and click hook was still active while the running app deleted its own bundle and
// live data, and a dialog then kept it from ever quitting (vibe/bugs/2026-09-28-uninstall-freezes-mac).
//
// Paths go to the script as separate arguments, never inside a command string.
function uninstallCommand({ scriptPath, pid, bundlePath, dataPaths = [] }) {
  return ['/bin/bash', [
    scriptPath,
    '--yes',
    '--wait-pid', String(pid),
    ...(bundlePath ? ['--app', bundlePath] : []),
    ...dataPaths.flatMap((p) => ['--data', p]),
  ]];
}

module.exports = { uninstallCommand };
