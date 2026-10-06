import { useEffect, useState } from 'react'
import { getProjects, subscribeProjects, loadProjects } from '../utils/projects.js'

// The connected projects, kept current: re-renders when main reports a change.
export default function useProjects() {
  const [list, setList] = useState(getProjects)
  useEffect(() => {
    const off = subscribeProjects(setList)
    loadProjects()
    return off
  }, [])
  return list
}
