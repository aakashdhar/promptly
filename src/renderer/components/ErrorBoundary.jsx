import { Component, Fragment } from 'react'

// The one class component: React only catches render errors in a class. Without it, one
// unexpected answer from Claude that a screen can't draw leaves the whole window blank.
// "Start over" remounts the app in its idle state; history and settings are untouched.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false, attempt: 0 }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    window.electronAPI?.log?.('error', `Render failed: ${error?.stack || error}\n${info?.componentStack || ''}`)
  }

  render() {
    if (!this.state.failed) return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
    return (
      <div role="alert" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px', background: 'var(--bg)', color: 'rgba(var(--ink),0.9)', textAlign: 'center' }}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>This screen couldn't be shown</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '360px', lineHeight: 1.5 }}>
          Something in the last result wasn't in the shape Promptly expected. Your history and settings are safe.
        </div>
        <button
          type="button"
          onClick={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))}
          style={{ marginTop: '4px', padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, background: 'rgb(10,132,255)', color: 'var(--on-accent)', WebkitAppRegion: 'no-drag' }}
        >
          Start over
        </button>
      </div>
    )
  }
}
