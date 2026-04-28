import { useState } from 'react'
import { bookmarkHistoryItem, rateHistoryItem, formatTime } from '../utils/history.js'
import ExpandedTypingContent from './ExpandedTypingContent.jsx'
import ExpandedPromptReadyContent from './ExpandedPromptReadyContent.jsx'
import PromptSections from './PromptSections.jsx'
import ImageBuilderState from './ImageBuilderState.jsx'
import ImageBuilderDoneState from './ImageBuilderDoneState.jsx'
import VideoBuilderState from './VideoBuilderState.jsx'
import VideoBuilderDoneState from './VideoBuilderDoneState.jsx'

const POSITIVE_TAGS = ['Perfect', 'Clear', 'Detailed']
const ALL_TAGS = ['Perfect', 'Clear', 'Detailed', 'Too long']

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
}) {
  const [entryCopied, setEntryCopied] = useState(false)

  const isRefine = mode === 'refine'
  const labelColor = isRefine ? 'rgba(168,85,247,0.85)' : 'rgba(100,170,255,0.55)'

  // ── entry detail handlers ──

  function handleEntryCopy() {
    if (!selected) return
    if (window.electronAPI) window.electronAPI.copyToClipboard(selected.prompt)
    setEntryCopied(true)
    setTimeout(() => setEntryCopied(false), 1800)
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

  const showEntryDetail = (currentState === 'IDLE' || isViewingHistory) && selected !== null

  return (
    <div style={{ flex: 1, minWidth: 0, background: 'transparent', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* History entry detail */}
      {showEntryDetail && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '22px 28px 14px', flexShrink: 0 }}>
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

      {/* IDLE — no history */}
      {currentState === 'IDLE' && !selected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <div style={{
            width: '68px', height: '68px', borderRadius: '50%',
            background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="22" viewBox="0 0 12 16" fill="none">
              <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(100,170,255,0.7)" strokeWidth="1" />
              <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(100,170,255,0.7)" strokeWidth="1" strokeLinecap="round" />
              <line x1="6" y1="13.5" x2="6" y2="15.5" stroke="rgba(100,170,255,0.7)" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 500, color: 'rgba(255,255,255,0.65)', letterSpacing: '-0.01em' }}>
            Speak your prompt
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>
            Press ⌥ Space or click the mic to start
          </div>
        </div>
      )}

      {currentState === 'RECORDING' && !isViewingHistory && (
        <div style={{ padding: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '8px' }}>Listening...</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>Speak now. Recording will stop when you tap the square.</div>
        </div>
      )}

      {currentState === 'PAUSED' && !isViewingHistory && (
        <div style={{ padding: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,189,46,0.75)', marginBottom: '8px' }}>Paused</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>Tap resume to continue recording.</div>
        </div>
      )}

      {currentState === 'ITERATING' && !isViewingHistory && (
        <div style={{ padding: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(10,132,255,0.8)', marginBottom: '8px' }}>Iterating...</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>Speak your refinement. Stop when done.</div>
        </div>
      )}

      {currentState === 'TYPING' && !isViewingHistory && (
        <ExpandedTypingContent
          mode={mode}
          onTypingSubmit={onTypingSubmit}
          onSwitchToVoice={onSwitchToVoice}
        />
      )}

      {currentState === 'THINKING' && !isViewingHistory && (
        <div style={{ padding: '24px 15%' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: thinkingAccentColor || 'rgba(255,255,255,0.75)', marginBottom: '16px' }}>{thinkingLabel || 'Generating prompt...'}</div>
          {thinkTranscript && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '20px', fontStyle: 'italic', lineHeight: 1.5 }}>
              &ldquo;{thinkTranscript}&rdquo;
            </div>
          )}
          {[
            { bars: ['88%', '72%'] },
            { bars: ['94%', '65%'] },
            { bars: ['80%', '55%'] },
          ].map((section, si) => (
            <div key={si}>
              <div style={{
                height: '8px', width: '30%', borderRadius: '4px',
                background: 'rgba(100,170,255,0.08)',
                marginBottom: '8px', marginTop: si === 0 ? 0 : '16px',
                animation: 'skeleton-pulse 1.8s ease-in-out infinite',
              }} />
              {section.bars.map((w, bi) => (
                <div key={bi} style={{
                  height: '10px', borderRadius: '5px',
                  background: 'rgba(255,255,255,0.05)', width: w,
                  marginBottom: '10px',
                  animation: `skeleton-pulse ${1.4 + (si * 2 + bi) * 0.15}s ease-in-out infinite`,
                }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {currentState === 'PROMPT_READY' && !isViewingHistory && (
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

      {currentState === 'IMAGE_BUILDER' && !isViewingHistory && imageBuilderProps && (
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

      {currentState === 'IMAGE_BUILDER_DONE' && !isViewingHistory && imageBuilderProps && (
        <ImageBuilderDoneState
          prompt={imageBuilderProps.imageBuiltPrompt}
          answers={imageBuilderProps.imageAnswers}
          transcript={imageBuilderProps.transcript}
          onEditAnswers={imageBuilderProps.onEditAnswers}
          onStartOver={imageBuilderProps.onStartOver}
          isExpanded={true}
        />
      )}

      {currentState === 'VIDEO_BUILDER' && !isViewingHistory && videoBuilderProps && (
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

      {currentState === 'VIDEO_BUILDER_DONE' && !isViewingHistory && videoBuilderProps && (
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
    </div>
  )
}
