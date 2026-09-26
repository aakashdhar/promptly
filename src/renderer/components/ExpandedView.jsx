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
// A finished result: picking a history entry replaces it on the right.
const RESTING_STATES = new Set(['PROMPT_READY', 'EMAIL_READY', 'IMAGE_BUILDER_DONE', 'VIDEO_BUILDER_DONE', 'WORKFLOW_BUILDER_DONE', 'ERROR', 'TRANSCRIPTION_ERROR', 'GENERATION_ERROR'])

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
  resultMode,
  micQuiet,
}) {
  const [selected, setSelected] = useState(null)
  const [isViewingHistory, setIsViewingHistory] = useState(false)

  // History can be hidden (the toolbar button or ⌃⌘S) so the result, and the Ribbon while you
  // talk, use the full width. The choice is remembered.
  const [historyHidden, setHistoryHidden] = useState(false)
  useEffect(() => {
    window.electronAPI?.getPreferences?.().then((p) => { if (p) setHistoryHidden(!!p.historyHidden) }).catch(() => {})
  }, [])
  function setHistoryShown(shown) {
    setHistoryHidden(!shown)
    window.electronAPI?.setPreferences?.({ historyHidden: !shown })
  }
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey && e.metaKey && e.key.toLowerCase() === 's') { e.preventDefault(); setHistoryHidden((h) => { window.electronAPI?.setPreferences?.({ historyHidden: !h }); return !h }) }
    }
    // ⌘H searches history, so it brings the list back if it was hidden.
    const onSearch = () => setHistoryHidden((h) => { if (h) window.electronAPI?.setPreferences?.({ historyHidden: false }); return false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('promptly:search-history', onSearch)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('promptly:search-history', onSearch) }
  }, [])

  function handleSelect(entry) {
    if (entry && selected && entry.id === selected.id) {
      setSelected(null)
      setIsViewingHistory(false)
      return
    }
    setSelected(entry)
    if (entry) setIsViewingHistory(true)
    else setIsViewingHistory(false)
    // A finished result on screen would otherwise keep the right pane, so the pick seemed to do
    // nothing. The result is already in history, so closing it loses nothing. Work in progress
    // (recording, typing, Claude writing) stays put.
    if (entry && RESTING_STATES.has(currentState)) onReset()
  }

  const windowWidth = useWindowWidth()
  const historyShown = !historyHidden && (windowWidth >= ROOMY_WIDTH || !BUILDER_STATES.has(currentState))

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
        generationErrorType={generationErrorProps?.errorType}
        onModeSelect={onModeSelect}
        onShowShortcuts={onShowShortcuts}
        onShowHistory={onShowHistory}
        micQuiet={micQuiet}
        historyHidden={historyHidden}
        onToggleHistory={() => setHistoryShown(historyHidden)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
        {/* The history column slides away when hidden; builders also push it aside in a narrow window. */}
        <div
          inert={historyShown ? undefined : true}
          aria-hidden={historyShown ? undefined : true}
          style={{
            width: historyShown ? '260px' : '0px',
            flexShrink: 0, overflow: 'hidden', display: 'flex',
            transition: 'width 420ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          <ExpandedHistoryList
            currentState={currentState}
            selected={selected}
            onSelect={handleSelect}
          />
        </div>
        <ExpandedDetailPanel
          selected={selected}
          resultMode={resultMode}
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
          onAbort={onAbort}
          thinkingElapsed={thinkingElapsed}
          thinkingCurrentLabel={thinkingCurrentLabel}
          modeLabel={modeLabel}
          micQuiet={micQuiet}
        />
      </div>
      </div>
    </div>
  )
}
