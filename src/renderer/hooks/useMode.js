import { useState, useEffect } from 'react'
import { MODES, DEFAULT_MODE, resolveModeKey, modeLabel as labelOf } from '../utils/modes.js'
import { isProjectMode, projectOf, projectsLoaded } from '../utils/projects.js'
import useProjects from './useProjects.js'

const MODE_LABELS = Object.fromEntries(MODES.map((m) => [m.key, m.label]))

export default function useMode() {
  // A mode saved by an older version may have been merged into another (Balanced → Prompt) or
  // no longer exist at all (e.g. "do" from 2.6.0): use its replacement, or the default. A
  // project mode is kept until the project list says that project is gone.
  const [mode, setModeState] = useState(() => {
    const stored = resolveModeKey(localStorage.getItem('mode'))
    if (isProjectMode(stored)) return stored
    return stored && MODE_LABELS[stored] ? stored : DEFAULT_MODE
  })
  const projects = useProjects()

  useEffect(() => {
    if (isProjectMode(mode) && projectsLoaded() && !projectOf(mode)) {
      localStorage.setItem('mode', DEFAULT_MODE)
      setModeState(DEFAULT_MODE)
    }
  }, [mode, projects])

  const modeLabel = labelOf(mode) || MODE_LABELS[DEFAULT_MODE]

  // The floating pill shows the current mode; main keeps a copy of its label.
  useEffect(() => { window.electronAPI?.reportMode?.(modeLabel) }, [modeLabel])

  function setMode(m) {
    localStorage.setItem('mode', m)
    setModeState(m)
  }

  return { mode, setMode, modeLabel }
}
