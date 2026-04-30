import { useState, useEffect } from 'react'
import { getLabelSequence } from '../utils/thinkingLabels.js'

export function useThinkingProgress({ mode, phase, isActive }) {
  const [elapsed, setElapsed] = useState(0)
  const [currentLabel, setCurrentLabel] = useState('')
  const [labelOpacity, setLabelOpacity] = useState(1)

  useEffect(() => {
    if (!isActive) {
      setElapsed(0)
      setCurrentLabel('')
      setLabelOpacity(1)
      return
    }

    const labels = getLabelSequence(mode, phase)
    setCurrentLabel(labels[0])
    setLabelOpacity(1)
    let labelIdx = 0

    const elapsedInterval = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)

    const labelInterval = setInterval(() => {
      if (labelIdx >= labels.length - 1) return
      setLabelOpacity(0)
      setTimeout(() => {
        labelIdx += 1
        setCurrentLabel(labels[labelIdx])
        setLabelOpacity(1)
      }, 150)
    }, 4000)

    return () => {
      clearInterval(elapsedInterval)
      clearInterval(labelInterval)
    }
  }, [isActive, mode, phase])

  return { elapsed, currentLabel, labelOpacity }
}
