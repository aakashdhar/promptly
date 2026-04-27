import { useState, useEffect } from 'react'
import { getHistory } from '../utils/history.js'
import ExpandedTransportBar from './ExpandedTransportBar.jsx'
import ExpandedHistoryList from './ExpandedHistoryList.jsx'
import ExpandedDetailPanel from './ExpandedDetailPanel.jsx'

export default function ExpandedView({
  currentState,
  mode,
  modeLabel,
  duration,
  generatedPrompt,
  thinkTranscript,
  onStart,
  onCollapse,
  onPause,
  onStop,
  onStopIterate,
  onRegenerate,
  onReset,
  onIterate,
  isIterated,
  setGeneratedPrompt,
  isPolishMode,
  polishResult,
  polishTone,
  onPolishToneChange,
  onReuse,
  onOpenSettings,
  onTypingSubmit,
  onSwitchToVoice,
  onTypePrompt,
  imageBuilderProps,
}) {
  const [selected, setSelected] = useState(() => { const h = getHistory(); return h.length > 0 ? h[0] : null })
  const [isViewingHistory, setIsViewingHistory] = useState(false)

  // Return right panel to current state content when active state arrives
  useEffect(() => {
    if (currentState === 'RECORDING' || currentState === 'THINKING' || currentState === 'PROMPT_READY' || currentState === 'TYPING' || currentState === 'IMAGE_BUILDER' || currentState === 'IMAGE_BUILDER_DONE') {
      setIsViewingHistory(false)
    }
  }, [currentState])

  function handleSelect(entry) {
    setSelected(entry)
    if (entry) setIsViewingHistory(true)
    else setIsViewingHistory(false)
  }

  function handleEntryChange(updatedEntry) {
    setSelected(updatedEntry)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'linear-gradient(135deg, #0A0A14 0%, #0D0A18 50%, #0A0A14 100%)', position: 'relative' }}>
      <ExpandedTransportBar
        currentState={currentState}
        duration={duration}
        mode={mode}
        modeLabel={modeLabel}
        onStart={onStart}
        onStop={onStop}
        onStopIterate={onStopIterate}
        onPause={onPause}
        onCollapse={onCollapse}
        onOpenSettings={onOpenSettings}
        onTypePrompt={() => { setIsViewingHistory(false); onTypePrompt() }}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
        <ExpandedHistoryList
          currentState={currentState}
          selected={selected}
          onSelect={handleSelect}
        />
        <ExpandedDetailPanel
          selected={selected}
          isViewingHistory={isViewingHistory}
          currentState={currentState}
          generatedPrompt={generatedPrompt}
          thinkTranscript={thinkTranscript}
          mode={mode}
          onRegenerate={onRegenerate}
          onReset={onReset}
          onIterate={onIterate}
          isIterated={isIterated}
          setGeneratedPrompt={setGeneratedPrompt}
          isPolishMode={isPolishMode}
          polishResult={polishResult}
          polishTone={polishTone}
          onPolishToneChange={onPolishToneChange}
          onReuse={onReuse}
          onEntryChange={handleEntryChange}
          onTypingSubmit={onTypingSubmit}
          onSwitchToVoice={onSwitchToVoice}
          imageBuilderProps={imageBuilderProps}
        />
      </div>
    </div>
  )
}
