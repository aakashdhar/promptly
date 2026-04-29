import { useState } from 'react'
import { bookmarkHistoryItem, rateHistoryItem, formatTime } from '../utils/history.js'
import ExpandedTypingContent from './ExpandedTypingContent.jsx'
import ExpandedPromptReadyContent from './ExpandedPromptReadyContent.jsx'
import PromptSections from './PromptSections.jsx'
import ImageBuilderState from './ImageBuilderState.jsx'
import ImageBuilderDoneState from './ImageBuilderDoneState.jsx'
import VideoBuilderState from './VideoBuilderState.jsx'
import VideoBuilderDoneState from './VideoBuilderDoneState.jsx'
import WorkflowBuilderState from './WorkflowBuilderState.jsx'
import WorkflowBuilderDoneState from './WorkflowBuilderDoneState.jsx'
import OperationErrorPanel from './OperationErrorPanel.jsx'

const POSITIVE_TAGS = ['Perfect', 'Clear', 'Detailed']
const ALL_TAGS = ['Perfect', 'Clear', 'Detailed', 'Too long']

function getTranscriptionFix(error) {
  if (!error) return null
  const e = error.toLowerCase()
  if (e.includes('ffmpeg')) return { label: 'Install ffmpeg:', code: 'brew install ffmpeg' }
  if (e.includes('.pt') || (e.includes('no such file') && e.includes('whisper'))) return { label: 'Download the voice model:', code: 'whisper --model base /dev/null' }
  if (e.includes('permission') || e.includes('access denied')) return { label: 'Fix permissions:', code: 'chmod +x $(which whisper)' }
  return null
}

export default function ExpandedDetailPanel({
  selected,
  isViewingHistory,
  currentState,
  generatedPrompt,
  thinkTranscript,
  mode,
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
  onEntryChange,
  onTypingSubmit,
  onSwitchToVoice,
  thinkingLabel,
  thinkingAccentColor,
  imageBuilderProps,
  videoBuilderProps,
  workflowBuilderProps,
  transcriptionErrorProps,
  transcriptionSlow,
  generationErrorProps,
  generationSlow,
}) {
  const [entryCopied, setEntryCopied] = useState(false)
  const [entryExported, setEntryExported] = useState(false)

  const isRefine = mode === 'refine'
  const labelColor = isRefine ? 'rgba(168,85,247,0.85)' : 'rgba(100,170,255,0.55)'

  const isContentState = currentState === 'TYPING' || currentState === 'PROMPT_READY'
    || currentState === 'IMAGE_BUILDER' || currentState === 'IMAGE_BUILDER_DONE'
    || currentState === 'VIDEO_BUILDER' || currentState === 'VIDEO_BUILDER_DONE'
    || currentState === 'WORKFLOW_BUILDER' || currentState === 'WORKFLOW_BUILDER_DONE'
    || currentState === 'TRANSCRIPTION_ERROR'
    || currentState === 'GENERATION_ERROR'

  const showEntryDetail = !isContentState && selected !== null
  const showEmpty = !isContentState && !selected

  // ── entry detail handlers ──

  function handleEntryCopy() {
    if (!selected) return
    if (window.electronAPI) window.electronAPI.copyToClipboard(selected.prompt)
    setEntryCopied(true)
    setTimeout(() => setEntryCopied(false), 1800)
  }

  function handleEntryExport() {
    if (!selected) return
    const text = [
      `Transcript: ${selected.transcript}`,
      '',
      `Prompt:\n${selected.prompt}`,
    ].join('\n')
    if (window.electronAPI) window.electronAPI.copyToClipboard(text)
    setEntryExported(true)
    setTimeout(() => setEntryExported(false), 1800)
  }

  function handleEntryReuse() {
    if (!selected || !onReuse) return
    onReuse(selected)
  }

  function handleBookmark() {
    if (!selected) return
    const newBookmarked = bookmarkHistoryItem(selected.id)
    onEntryChange({ ...selected, bookmarked: newBookmarked })
  }

  function handleRate(rating) {
    if (!selected) return
    const newRating = selected.rating === rating ? null : rating
    rateHistoryItem(selected.id, newRating, null)
    onEntryChange({ ...selected, rating: newRating, ratingTag: null })
  }

  function handleTag(tag) {
    if (!selected || !selected.rating) return
    const newTag = selected.ratingTag === tag ? null : tag
    rateHistoryItem(selected.id, selected.rating, newTag)
    onEntryChange({ ...selected, ratingTag: newTag })
  }

  return (
    <div style={{ flex: 1, minWidth: 0, background: 'transparent', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Always-visible panel header — hidden during content states */}
      {!isContentState && (
        <div style={{
          padding: '12px 20px 10px', flexShrink: 0,
          borderBottom: '0.5px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{
            fontSize: '12px', color: 'rgba(255,255,255,0.35)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            letterSpacing: '0.01em',
          }}>
            {selected
              ? (selected.title || selected.transcript.slice(0, 48))
              : 'Session details'}
          </span>
          {showEntryDetail && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={handleEntryCopy}
                title="Copy prompt"
                style={{
                  height: '24px', padding: '0 8px', borderRadius: '5px',
                  fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer',
                  background: entryCopied ? 'rgba(48,209,88,0.1)' : 'rgba(255,255,255,0.05)',
                  border: entryCopied ? '0.5px solid rgba(48,209,88,0.25)' : '0.5px solid rgba(255,255,255,0.1)',
                  color: entryCopied ? 'rgba(48,209,88,0.8)' : 'rgba(255,255,255,0.4)',
                  transition: 'all 150ms',
                }}
              >
                {entryCopied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleEntryExport}
                title="Export as text"
                style={{
                  height: '24px', padding: '0 8px', borderRadius: '5px',
                  fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer',
                  background: entryExported ? 'rgba(48,209,88,0.1)' : 'rgba(255,255,255,0.05)',
                  border: entryExported ? '0.5px solid rgba(48,209,88,0.25)' : '0.5px solid rgba(255,255,255,0.1)',
                  color: entryExported ? 'rgba(48,209,88,0.8)' : 'rgba(255,255,255,0.4)',
                  transition: 'all 150ms',
                }}
              >
                {entryExported ? 'Exported' : 'Export'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clock empty state */}
      {showEmpty && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '14px',
          minHeight: '200px',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2"/>
            <path d="M12 7v5l3 3" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: '16px', fontWeight: 400, color: 'rgba(255,255,255,0.3)', letterSpacing: '-0.01em' }}>
            Select a session to view details
          </span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.16)' }}>
            Your generated prompts appear here
          </span>
        </div>
      )}

      {/* History entry detail */}
      {showEntryDetail && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
          <div style={{ padding: '16px 28px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
              }}>
                You said · {formatTime(selected.timestamp)}
              </div>
              <button
                onClick={handleBookmark}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '3px 8px', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: selected.bookmarked ? 'rgba(255,189,46,0.10)' : 'rgba(255,255,255,0.04)',
                  border: `0.5px solid ${selected.bookmarked ? 'rgba(255,189,46,0.25)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <svg width="9" height="11" viewBox="0 0 10 13" fill="none">
                  <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z"
                    fill={selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'none'}
                    stroke={selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'rgba(255,255,255,0.3)'}
                    strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                <span style={{
                  fontSize: '10px',
                  fontWeight: selected.bookmarked ? 500 : 400,
                  color: selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'rgba(255,255,255,0.35)',
                }}>
                  {selected.bookmarked ? 'Saved' : 'Save'}
                </span>
              </button>
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              {selected.transcript}
            </div>
          </div>

          <div style={{ height: '0.5px', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', margin: '0 28px', flexShrink: 0 }} />

          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px', minHeight: 0 }}>
            <PromptSections prompt={selected.prompt} labelColor={labelColor} textSize="14px" textColor="rgba(255,255,255,0.82)" />
            {selected.polishChanges && selected.polishChanges.length > 0 && (
              <div style={{ marginTop: '14px', padding: '10px 12px', background: 'rgba(48,209,88,0.04)', border: '0.5px solid rgba(48,209,88,0.12)', borderRadius: '8px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(48,209,88,0.5)', marginBottom: '6px' }}>Changes made</div>
                {selected.polishChanges.map((note, i) => (
                  <div key={i} style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{note}</div>
                ))}
              </div>
            )}
          </div>

          {/* Rating section */}
          <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '12px 28px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: selected.rating ? '10px' : 0 }}>
              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>
                Rate this prompt
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['up', 'down'].map(r => (
                  <button key={r} onClick={() => handleRate(r)} style={{
                    width: '28px', height: '28px', borderRadius: '7px',
                    fontSize: '13px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'inherit', transition: 'all 150ms',
                    background: selected.rating === r
                      ? (r === 'up' ? 'rgba(48,209,88,0.15)' : 'rgba(255,59,48,0.15)')
                      : 'rgba(255,255,255,0.04)',
                    border: `0.5px solid ${selected.rating === r
                      ? (r === 'up' ? 'rgba(48,209,88,0.35)' : 'rgba(255,59,48,0.35)')
                      : 'rgba(255,255,255,0.1)'}`,
                  }}>
                    {r === 'up' ? '👍' : '👎'}
                  </button>
                ))}
              </div>
            </div>
            {selected.rating && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ALL_TAGS.map(tag => {
                  const isActiveTag = selected.ratingTag === tag
                  const isPositive = POSITIVE_TAGS.includes(tag)
                  const activeStyle = isPositive
                    ? { bg: 'rgba(48,209,88,0.12)', border: 'rgba(48,209,88,0.3)', text: 'rgba(100,220,130,0.85)' }
                    : { bg: 'rgba(255,59,48,0.10)', border: 'rgba(255,59,48,0.3)', text: 'rgba(255,100,90,0.85)' }
                  const inactiveStyle = { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.35)' }
                  const s = isActiveTag ? activeStyle : inactiveStyle
                  return (
                    <span key={tag} onClick={() => handleTag(tag)} style={{
                      padding: '3px 10px', borderRadius: '6px',
                      fontSize: '10px', fontWeight: isActiveTag ? 500 : 400,
                      cursor: 'pointer', transition: 'all 150ms',
                      background: s.bg, border: `0.5px solid ${s.border}`, color: s.text,
                    }}>
                      {tag}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Entry action buttons */}
          <div style={{ display: 'flex', gap: '10px', padding: '14px 24px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <button
              onClick={handleEntryCopy}
              style={{
                flex: 1, height: '40px', borderRadius: '9px',
                fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
                background: entryCopied ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.06)',
                border: entryCopied ? '0.5px solid rgba(48,209,88,0.3)' : '0.5px solid rgba(255,255,255,0.12)',
                color: entryCopied ? 'rgba(48,209,88,0.9)' : 'rgba(255,255,255,0.72)',
                transition: 'all 200ms',
              }}
            >
              {entryCopied ? 'Copied ✓' : 'Copy prompt'}
            </button>
            <button
              onClick={handleEntryReuse}
              style={{
                flex: 1, height: '40px', borderRadius: '9px',
                fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                background: 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))',
                border: 'none', color: 'white',
                boxShadow: '0 2px 14px rgba(10,132,255,0.35)',
              }}
            >
              Reuse
            </button>
          </div>
        </div>
      )}

      {/* Content states — delegated to dedicated components */}
      {currentState === 'TYPING' && (
        <ExpandedTypingContent
          mode={mode}
          onTypingSubmit={onTypingSubmit}
          onSwitchToVoice={onSwitchToVoice}
        />
      )}

      {currentState === 'PROMPT_READY' && (
        <ExpandedPromptReadyContent
          generatedPrompt={generatedPrompt}
          setGeneratedPrompt={setGeneratedPrompt}
          isPolishMode={isPolishMode}
          polishResult={polishResult}
          mode={mode}
          onIterate={onIterate}
          onRegenerate={onRegenerate}
          onReset={onReset}
          isIterated={isIterated}
        />
      )}

      {currentState === 'IMAGE_BUILDER' && imageBuilderProps && (
        <ImageBuilderState
          transcript={imageBuilderProps.transcript}
          imageDefaults={imageBuilderProps.imageDefaults}
          imageAnswers={imageBuilderProps.imageAnswers}
          showAdvanced={imageBuilderProps.showAdvanced}
          activePickerParam={imageBuilderProps.activePickerParam}
          onChipRemove={imageBuilderProps.onChipRemove}
          onChipAdd={imageBuilderProps.onChipAdd}
          onParamChange={imageBuilderProps.onParamChange}
          onToggleAdvanced={imageBuilderProps.onToggleAdvanced}
          onOpenPicker={imageBuilderProps.onOpenPicker}
          onClosePicker={imageBuilderProps.onClosePicker}
          onConfirm={imageBuilderProps.onConfirm}
          onCopyNow={imageBuilderProps.onCopyNow}
          onReiterate={imageBuilderProps.onReiterate}
          isExpanded={true}
        />
      )}

      {currentState === 'IMAGE_BUILDER_DONE' && imageBuilderProps && (
        <ImageBuilderDoneState
          prompt={imageBuilderProps.imageBuiltPrompt}
          answers={imageBuilderProps.imageAnswers}
          transcript={imageBuilderProps.transcript}
          onEditAnswers={imageBuilderProps.onEditAnswers}
          onStartOver={imageBuilderProps.onStartOver}
          isExpanded={true}
        />
      )}

      {currentState === 'VIDEO_BUILDER' && videoBuilderProps && (
        <VideoBuilderState
          transcript={videoBuilderProps.transcript}
          videoDefaults={videoBuilderProps.videoDefaults}
          videoAnswers={videoBuilderProps.videoAnswers}
          showAdvanced={videoBuilderProps.showAdvanced}
          activePickerParam={videoBuilderProps.activePickerParam}
          dialogueText={videoBuilderProps.dialogueText}
          settingDetail={videoBuilderProps.settingDetail}
          onChipRemove={videoBuilderProps.onChipRemove}
          onChipAdd={videoBuilderProps.onChipAdd}
          onParamChange={videoBuilderProps.onParamChange}
          onToggleAdvanced={videoBuilderProps.onToggleAdvanced}
          onOpenPicker={videoBuilderProps.onOpenPicker}
          onClosePicker={videoBuilderProps.onClosePicker}
          onDialogueChange={videoBuilderProps.onDialogueChange}
          onSettingChange={videoBuilderProps.onSettingChange}
          onConfirm={videoBuilderProps.onConfirm}
          onCopyNow={videoBuilderProps.onCopyNow}
          onReiterate={videoBuilderProps.onReiterate}
        />
      )}

      {currentState === 'VIDEO_BUILDER_DONE' && videoBuilderProps && (
        <VideoBuilderDoneState
          prompt={videoBuilderProps.videoBuiltPrompt}
          videoAnswers={videoBuilderProps.videoAnswers}
          transcript={videoBuilderProps.transcript}
          onCopy={videoBuilderProps.onCopyPrompt}
          onEdit={videoBuilderProps.onEditAnswers}
          onStartOver={videoBuilderProps.onStartOver}
          isSaved={videoBuilderProps.isSaved}
          onSave={videoBuilderProps.onSave}
        />
      )}
      {currentState === 'WORKFLOW_BUILDER' && workflowBuilderProps && (
        <WorkflowBuilderState
          transcript={workflowBuilderProps.transcript}
          workflowAnalysis={workflowBuilderProps.workflowAnalysis}
          filledPlaceholders={workflowBuilderProps.filledPlaceholders}
          onFillPlaceholder={workflowBuilderProps.onFillPlaceholder}
          onAddNode={workflowBuilderProps.onAddNode}
          onDeleteNode={workflowBuilderProps.onDeleteNode}
          onConfirm={workflowBuilderProps.onConfirm}
          onReiterate={workflowBuilderProps.onReiterate}
          onStartOver={workflowBuilderProps.onStartOver}
          isExpanded
        />
      )}
      {currentState === 'TRANSCRIPTION_ERROR' && (() => {
        const err = transcriptionErrorProps || {}
        const fix = getTranscriptionFix(err.error)
        return (
          <OperationErrorPanel
            icon="error"
            title="Transcription failed"
            body={err.timedOut ? 'Whisper timed out after 30 seconds.' : "Whisper couldn't process the audio."}
            errorDetails={err.error}
            slowWarning={transcriptionSlow ? 'Taking longer than expected... Whisper may still be processing.' : null}
            fixLabel={fix ? fix.label : null}
            fixCode={fix ? fix.code : null}
            onRetry={err.onRetry}
            onOpenSettings={err.onOpenSettings}
          />
        )
      })()}

      {currentState === 'GENERATION_ERROR' && (() => {
        const err = generationErrorProps || {}
        const errorType = err.errorType || 'unknown'
        const isAuth = errorType === 'auth'
        const isTimeout = errorType === 'timeout'
        const isEmpty = errorType === 'empty'
        const isUnknown = errorType === 'unknown'
        const iconMap = { auth: 'lock', timeout: 'clock', empty: 'warning', unknown: 'error' }
        const titleMap = { auth: 'Claude is not logged in', timeout: 'Claude took too long to respond', empty: 'Claude returned an empty response', unknown: 'Generation failed' }
        const bodyMap = { auth: "Your session expired or you haven't logged in yet.", timeout: 'This can happen with slow connections or if Claude CLI needs updating.', empty: 'The CLI ran successfully but returned nothing. This may be a Claude CLI version issue.', unknown: null }
        const fixMap = { auth: { label: 'Log in to Claude:', code: 'claude login', note: 'This opens a browser to authenticate' }, timeout: { label: 'Update Claude CLI:', code: 'claude update' }, empty: { label: 'Update Claude CLI:', code: 'claude update' }, unknown: { label: 'Test manually in Terminal:', code: 'claude -p "hello"' } }
        const fix = fixMap[errorType] || fixMap.unknown
        return (
          <OperationErrorPanel
            icon={iconMap[errorType] || 'error'}
            title={titleMap[errorType] || 'Generation failed'}
            body={bodyMap[errorType] || null}
            errorDetails={isUnknown ? err.error : null}
            slowWarning={generationSlow ? 'Claude is taking longer than usual...' : null}
            fixLabel={fix.label}
            fixCode={fix.code}
            fixNote={fix.note}
            fixPreNote={isTimeout ? 'Check your internet connection, then:' : null}
            retryLabel={isAuth ? "I've logged in — Try again ↺" : 'Try again ↺'}
            onRetry={err.onRetry}
            onOpenSettings={isUnknown ? err.onOpenSettings : null}
          />
        )
      })()}

      {currentState === 'WORKFLOW_BUILDER_DONE' && workflowBuilderProps && (
        <WorkflowBuilderDoneState
          workflowAnalysis={workflowBuilderProps.workflowAnalysis}
          workflowJson={workflowBuilderProps.workflowJson}
          onEdit={workflowBuilderProps.onEdit}
          onStartOver={workflowBuilderProps.onStartOver}
          onSave={workflowBuilderProps.onSave}
          isSaved={workflowBuilderProps.isSaved}
          onCopy={workflowBuilderProps.onCopy}
          isCopied={workflowBuilderProps.isCopied}
          isExpanded
        />
      )}
    </div>
  )
}
