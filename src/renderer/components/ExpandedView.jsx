import { useEffect, useState } from 'react'
import ExpandedTransportBar from './ExpandedTransportBar.jsx'
import ExpandedHistoryList from './ExpandedHistoryList.jsx'
import ExpandedDetailPanel from './ExpandedDetailPanel.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import ShortcutsPanel from './ShortcutsPanel.jsx'

// Builders lay out two columns of their own; below this width the history list would squeeze
// them, so it steps aside (⌘H still opens history).
const BUILDER_STATES = new Set(['IMAGE_BUILDER', 'VIDEO_BUILDER', 'WORKFLOW_BUILDER', 'IMAGE_BUILDER_DONE', 'VIDEO_BUILDER_DONE', 'WORKFLOW_BUILDER_DONE', 'EMAIL_READY'])
const ROOMY_WIDTH = 1180

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

export default function ExpandedView({
  currentState,
  mode,
  modeLabel,
  duration,
  generatedPrompt,
  thinkTranscript,
  onStart,
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
  onCloseSettings,
  onTypingSubmit,
  onSwitchToVoice,
  onTypePrompt,
  thinkingLabel,
  thinkingAccentColor,
  imageBuilderProps,
  videoBuilderProps,
  workflowBuilderProps,
  emailOutput,
  emailSaved,
  onEmailSave,
  onEmailIterate,
  onToneAdjust,
  onAbort,
  thinkingElapsed,
  thinkingCurrentLabel,
  thinkingLabelOpacity,
  transcriptionErrorProps,
  transcriptionSlow,
  generationErrorProps,
  generationSlow,
  onModeSelect,
  onShowShortcuts,
  onShowHistory,
  errorMessage,
  streamText,
  recordingContext,
  dictation,
  resultView,
  promptStyle,
  onShowDictation,
  onMakePrompt,
  onCloseShortcuts,
}) {
  const [selected, setSelected] = useState(null)
  const [isViewingHistory, setIsViewingHistory] = useState(false)

  function handleSelect(entry) {
    if (entry && selected && entry.id === selected.id) {
      setSelected(null)
      setIsViewingHistory(false)
      return
    }
    setSelected(entry)
    if (entry) setIsViewingHistory(true)
    else setIsViewingHistory(false)
  }

  const windowWidth = useWindowWidth()

  function handleEntryChange(updatedEntry) {
    setSelected(updatedEntry)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', position: 'relative' }}>
      {currentState === 'SHORTCUTS' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ height: '36px', WebkitAppRegion: 'drag', flexShrink: 0 }} />
          <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <ShortcutsPanel onClose={onCloseShortcuts} />
          </div>
        </div>
      )}
      {currentState === 'SETTINGS' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'var(--bg)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ height: '36px', WebkitAppRegion: 'drag', flexShrink: 0 }} />
          <div style={{ width: '100%', maxWidth: '640px', margin: '0 auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <SettingsPanel onClose={onCloseSettings} />
          </div>
        </div>
      )}
      {/* While Settings or Shortcuts cover the window, what's behind them can't be reached by
          Tab or a screen reader. */}
      <div inert={currentState === 'SETTINGS' || currentState === 'SHORTCUTS' ? true : undefined} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ExpandedTransportBar
        currentState={currentState}
        duration={duration}
        mode={mode}
        modeLabel={modeLabel}
        onStart={onStart}
        onStop={onStop}
        onStopIterate={onStopIterate}
        onPause={onPause}
        onOpenSettings={onOpenSettings}
        onTypePrompt={() => { setIsViewingHistory(false); onTypePrompt() }}
        onAbort={onAbort}
        generationErrorType={generationErrorProps?.errorType}
        thinkingElapsed={thinkingElapsed}
        thinkingCurrentLabel={thinkingCurrentLabel}
        thinkingLabelOpacity={thinkingLabelOpacity}
        onModeSelect={onModeSelect}
        onShowShortcuts={onShowShortcuts}
        onShowHistory={onShowHistory}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
        {(windowWidth >= ROOMY_WIDTH || !BUILDER_STATES.has(currentState)) && (
          <ExpandedHistoryList
            currentState={currentState}
            selected={selected}
            onSelect={handleSelect}
          />
        )}
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
          thinkingLabel={thinkingLabel}
          thinkingAccentColor={thinkingAccentColor}
          imageBuilderProps={imageBuilderProps}
          videoBuilderProps={videoBuilderProps}
          workflowBuilderProps={workflowBuilderProps}
          emailOutput={emailOutput}
          emailSaved={emailSaved}
          onEmailSave={onEmailSave}
          onEmailIterate={onEmailIterate}
          onToneAdjust={onToneAdjust}
          transcriptionErrorProps={transcriptionErrorProps}
          transcriptionSlow={transcriptionSlow}
          generationErrorProps={generationErrorProps}
          generationSlow={generationSlow}
          errorMessage={errorMessage}
          streamText={streamText}
          recordingContext={recordingContext}
          dictation={dictation}
          resultView={resultView}
          promptStyle={promptStyle}
          onShowDictation={onShowDictation}
          onMakePrompt={onMakePrompt}
        />
      </div>
      </div>
    </div>
  )
}
