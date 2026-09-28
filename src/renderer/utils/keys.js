// Key names for the system Promptly runs on, from main/keys.js via get-platform.
// Starts as the Mac set (identical to main's), so nothing changes on a Mac if the call fails.
export const keys = { os: 'darwin', mod: '⌘', alt: '⌥', ctrl: '⌃', shift: '⇧', enter: '↵' }

// Called once before the first render (main.jsx).
export async function loadKeys() {
  try {
    const platformKeys = await window.electronAPI?.getPlatform?.()
    if (platformKeys) Object.assign(keys, platformKeys)
  } catch { /* keep the Mac set */ }
  return keys
}

// combo(keys.mod, 'T') → '⌘T' on a Mac, 'Ctrl+T' on Windows (same rule as main's formatCombo).
export function combo(...parts) {
  if (keys.os === 'win32') return parts.filter((p, i) => parts.indexOf(p) === i).join('+')
  return parts.map((p, i) => (i > 0 && p.length > 1 ? ` ${p}` : p)).join('')
}
