export default function ErrorState({ message, onDismiss }) {
  return (
    <div id="panel-error">
      <div className="traf" />
      <div className="cr-error" id="error-area" onClick={onDismiss}>
        <div className="error-badge" style={{ WebkitAppRegion: 'no-drag' }}>⚠</div>
        <div className="ready-text" style={{ marginLeft: '14px', WebkitAppRegion: 'no-drag' }}>
          <div className="ready-title" id="error-message">{message || 'Something went wrong'}</div>
          <div className="ready-sub">Tap to retry</div>
        </div>
      </div>
    </div>
  )
}
