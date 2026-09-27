// Props that make a styled div or span work like a button from the keyboard too: it can be
// tabbed to, and Enter or Space activates it (a real <button> would bring its own styling).
export function pressable(onActivate, label) {
  return {
    role: 'button',
    tabIndex: 0,
    ...(label && { 'aria-label': label }),
    onClick: onActivate,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(e) }
    },
  }
}
