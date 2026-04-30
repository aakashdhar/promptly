import OperationErrorPanel from './OperationErrorPanel.jsx'

function getTranscriptionFix(error) {
  if (!error) return null
  const e = error.toLowerCase()
  if (e.includes('ffmpeg')) return { label: 'Install ffmpeg:', code: 'brew install ffmpeg' }
  if (e.includes('.pt') || (e.includes('no such file') && e.includes('whisper'))) return { label: 'Download the voice model:', code: 'whisper --model base /dev/null' }
  if (e.includes('permission') || e.includes('access denied')) return { label: 'Fix permissions:', code: 'chmod +x $(which whisper)' }
  return null
}

export default function ExpandedErrorContent({
  currentState,
  transcriptionErrorProps,
  transcriptionSlow,
  generationErrorProps,
  generationSlow,
}) {
  if (currentState === 'TRANSCRIPTION_ERROR') {
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
  }

  if (currentState === 'GENERATION_ERROR') {
    const err = generationErrorProps || {}
    const errorType = err.errorType || 'unknown'
    const isUnknown = errorType === 'unknown'
    const isAuth = errorType === 'auth'
    const isTimeout = errorType === 'timeout'
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
  }

  return null
}
