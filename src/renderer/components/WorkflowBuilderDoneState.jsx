export default function WorkflowBuilderDoneState({
  workflowAnalysis,
  workflowJson,
  onEdit,
  onStartOver,
  onSave,
  isSaved,
  onCopy,
  isCopied,
  isExpanded,
}) {
  const nodes = workflowAnalysis?.nodes || []
  const workflowName = workflowAnalysis?.workflowName || 'Workflow'

  function renderHighlightedJson(json) {
    if (!json) return null
    const lines = json.split('\n')
    return lines.map((line, i) => {
      const parts = []
      let rest = line
      let key = `line-${i}`

      // Match key: "value" pattern
      const keyMatch = rest.match(/^(\s*)("[\w\s]+")(:\s*)(.*)$/)
      if (keyMatch) {
        const [, indent, k, colon, valueStr] = keyMatch
        parts.push(<span key="indent">{indent}</span>)
        parts.push(<span key="key" style={{ color: 'rgba(100,170,255,0.8)' }}>{k}</span>)
        parts.push(<span key="colon">{colon}</span>)
        if (valueStr !== undefined) {
          parts.push(renderValue(valueStr, 'val'))
        }
      } else {
        parts.push(renderValue(rest, 'bare'))
      }

      return (
        <div key={key} style={{ minHeight: '1.4em' }}>
          {parts}
        </div>
      )
    })
  }

  function renderValue(str, k) {
    const trimmed = str.trim()
    if (trimmed.startsWith('"') && (trimmed.endsWith('"') || trimmed.endsWith('",') || trimmed.endsWith('"}'))) {
      return <span key={k} style={{ color: 'rgba(74,222,128,0.8)' }}>{str}</span>
    }
    if (/^-?\d+[\d.,]*[,}]?$/.test(trimmed) || /^-?\d+$/.test(trimmed)) {
      return <span key={k} style={{ color: 'rgba(251,146,60,0.8)' }}>{str}</span>
    }
    if (/^(true|false|null)[,}]?$/.test(trimmed)) {
      return <span key={k} style={{ color: 'rgba(255,255,255,0.4)' }}>{str}</span>
    }
    return <span key={k}>{str}</span>
  }

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    padding: isExpanded ? '16px 20px' : '12px 14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
  }

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexShrink: 0,
  }

  const headerLeftStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  const headerRightStyle = {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  }

  const linkBtnStyle = {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    WebkitAppRegion: 'no-drag',
  }

  const twoColStyle = {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 0,
    overflow: 'hidden',
    minHeight: 0,
  }

  const colStyle = {
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }

  const colLabelStyle = {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.2)',
    marginBottom: 10,
    flexShrink: 0,
  }

  const scrollStyle = {
    flex: 1,
    overflowY: 'auto',
  }

  const actionRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    flexShrink: 0,
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'rgba(34,197,94,0.9)', flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
            {workflowName}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: 'rgba(100,170,255,0.7)',
            background: 'rgba(10,132,255,0.12)',
            border: '0.5px solid rgba(10,132,255,0.25)',
            borderRadius: 5, padding: '2px 7px',
          }}>
            {nodes.length} node{nodes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={headerRightStyle}>
          <button style={linkBtnStyle} onClick={onEdit}>← Edit nodes</button>
          <button style={linkBtnStyle} onClick={onStartOver}>Start over</button>
        </div>
      </div>

      {/* Two-column body */}
      <div style={twoColStyle}>
        {/* Left — How it works */}
        <div style={{ ...colStyle, paddingRight: 16 }}>
          <div style={colLabelStyle}>HOW IT WORKS</div>
          <div style={scrollStyle}>
            {nodes.map((node, idx) => {
              const isTrigger = idx === 0
              return (
                <div key={node.id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      background: isTrigger ? 'rgba(34,197,94,0.15)' : 'rgba(10,132,255,0.15)',
                      border: `0.5px solid ${isTrigger ? 'rgba(34,197,94,0.3)' : 'rgba(10,132,255,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                      color: isTrigger ? 'rgba(74,222,128,0.9)' : 'rgba(100,170,255,0.9)',
                    }}>
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 1 }}>
                        {node.name || node.type}
                      </div>
                      {node.purpose && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                          {node.purpose}
                        </div>
                      )}
                    </div>
                  </div>
                  {idx < nodes.length - 1 && (
                    <div style={{ marginLeft: 10, width: 1, height: 12, background: 'rgba(255,255,255,0.08)', marginBottom: 4 }} />
                  )}
                </div>
              )
            })}

            {/* Import instructions */}
            <div style={{
              marginTop: 14,
              background: 'rgba(34,197,94,0.04)',
              border: '0.5px solid rgba(34,197,94,0.1)',
              borderRadius: 9, padding: '10px 12px',
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                color: 'rgba(34,197,94,0.6)', marginBottom: 8,
              }}>
                HOW TO IMPORT
              </div>
              {[
                'Copy the JSON →',
                'Open n8n → New workflow',
                '⌘A to select all → Delete',
                '⌘V to paste JSON',
                'Map your credentials in each node',
                'Fill placeholder values',
                'Activate workflow ✓',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, color: 'rgba(34,197,94,0.5)', minWidth: 14, fontWeight: 600 }}>
                    {i + 1}.
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — JSON preview */}
        <div style={{ ...colStyle, paddingLeft: 16, borderLeft: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={colLabelStyle}>N8N WORKFLOW JSON</div>
          <div style={{
            ...scrollStyle,
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <pre style={{
              margin: 0,
              fontFamily: 'monospace',
              fontSize: 10.5,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.65)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {renderHighlightedJson(workflowJson)}
            </pre>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div style={actionRowStyle}>
        <button
          onClick={onSave}
          style={{
            fontSize: 12,
            color: isSaved ? 'rgba(74,222,128,0.8)' : 'rgba(255,255,255,0.45)',
            background: 'none',
            border: '0.5px solid rgba(255,255,255,0.12)',
            borderRadius: 7, padding: '6px 14px',
            cursor: 'pointer',
            WebkitAppRegion: 'no-drag',
          }}
        >
          {isSaved ? 'Saved ✓' : 'Save'}
        </button>
        <button
          onClick={onCopy}
          style={{
            fontSize: 12, fontWeight: 600,
            color: isCopied ? 'rgba(74,222,128,0.9)' : 'rgba(255,255,255,0.9)',
            background: isCopied
              ? 'rgba(34,197,94,0.15)'
              : 'linear-gradient(135deg, rgba(34,197,94,0.3) 0%, rgba(22,163,74,0.25) 100%)',
            border: '0.5px solid rgba(34,197,94,0.3)',
            borderRadius: 7, padding: '6px 16px',
            cursor: 'pointer',
            WebkitAppRegion: 'no-drag',
          }}
        >
          {isCopied ? 'Copied!' : 'Copy JSON'}
        </button>
      </div>
    </div>
  )
}
