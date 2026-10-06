// Project modes (D-PROJECT-MODES): the connected projects as the window knows them. One shared
// list, loaded from main and reloaded whenever main says a project changed (new files, a summary
// written, a project added or removed). A project's mode key is "project:<id>".

const PREFIX = 'project:'
let projects = []
let loaded = false
const listeners = new Set()

export const isProjectMode = (key) => typeof key === 'string' && key.startsWith(PREFIX)
export const projectIdOf = (key) => (isProjectMode(key) ? key.slice(PREFIX.length) : null)
export const projectModeKey = (id) => PREFIX + id

export function getProjects() { return projects }
export function projectsLoaded() { return loaded }

export function projectOf(key) {
  const id = projectIdOf(key)
  return id ? projects.find((p) => p.id === id) || null : null
}

export async function loadProjects() {
  try {
    const list = await window.electronAPI?.listProjects?.()
    if (Array.isArray(list)) {
      projects = list
      loaded = true
      for (const fn of listeners) fn(projects)
    }
  } catch { /* keep the last list */ }
  return projects
}

export function subscribeProjects(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// "#E3B341" → "227,179,65", the form the mode tones use.
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''))
  if (!m) return '227,179,65'
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

export const OUTPUT_LABELS = { email: 'Email', prompt: 'Prompt', polish: 'Polish' }

if (typeof window !== 'undefined') {
  window.electronAPI?.onProjectsChanged?.(() => { loadProjects() })
  loadProjects()
}
