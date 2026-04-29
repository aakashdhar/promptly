import { useState } from 'react'

export default function WorkflowBuilderState({
  transcript,
  workflowAnalysis,
  filledPlaceholders,
  onFillPlaceholder,
  onAddNode,
  onDeleteNode,
  onConfirm,
  onReiterate,
  onStartOver,
  isExpanded,
}) {
  const [activeInput, setActiveInput] = useState(null) // `${nodeId}-${paramKey}`
  const [inputValues, setInputValues] = useState({})

  const nodes = workflowAnalysis?.nodes || []
  const workflowName = workflowAnalysis?.workflowName || 'Workflow'
  const connections = workflowAnalysis?.connections || ''

  const totalPlaceholders = nodes.reduce((sum, node) => {
    const blanks = (!node.name || !node.type) ? 1 : 0
    return sum + (node.placeholders?.length || 0) + blanks
  }, 0)

  const filledCount = nodes.reduce((sum, node) => {
    const blankFilled = (!node.name || !node.type)
      ? (filledPlaceholders[`${node.id}-__name__`] && filledPlaceholders[`${node.id}-__type__`] ? 1 : 0)
      : 0
    const paramsFilled = (node.placeholders || []).filter(
      pk => filledPlaceholders[`${node.id}-${pk}`]
    ).length
    return sum + paramsFilled + blankFilled
  }, 0)

  const allFilled = totalPlaceholders === 0 || filledCount >= totalPlaceholders

  function handleChipClick(nodeId, paramKey) {
    const key = `${nodeId}-${paramKey}`
    setActiveInput(key)
    setInputValues(prev => ({ ...prev, [key]: filledPlaceholders[key] || '' }))
  }

  function handleInputCommit(nodeId, paramKey) {
    const key = `${nodeId}-${paramKey}`
    const val = (inputValues[key] || '').trim()
    if (val) onFillPlaceholder(nodeId, paramKey, val)
    setActiveInput(null)
  }

  function handleInputKeyDown(e, nodeId, paramKey) {
    if (e.key === 'Enter') handleInputCommit(nodeId, paramKey)
    if (e.key === 'Escape') setActiveInput(null)
  }

  function isExpression(val) {
    return typeof val === 'string' && val.startsWith('={{')
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
    marginBottom: 10,
    flexShrink: 0,
  }

  const titleRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  const workflowIconStyle = {
    width: 18,
    height: 18,
    flexShrink: 0,
  }

  const workflowNameStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
  }

  const placeholderBadgeStyle = {
    fontSize: 10,
    fontWeight: 600,
    color: 'rgba(255,189,46,0.85)',
    background: 'rgba(255,189,46,0.12)',
    border: '0.5px solid rgba(255,189,46,0.25)',
    borderRadius: 5,
    padding: '2px 7px',
    marginLeft: 6,
  }

  const reiterateStyle = {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag',
    background: 'none',
    border: 'none',
    padding: 0,
  }

  const youSaidStyle = {
    marginBottom: 10,
    flexShrink: 0,
  }

  const youSaidLabelStyle = {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'rgba(255,255,255,0.2)',
    marginBottom: 3,
  }

  const transcriptStyle = {
    fontSize: 11,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.38)',
    lineHeight: 1.4,
  }

  const dividerStyle = {
    height: '0.5px',
    background: 'rgba(255,255,255,0.07)',
    marginBottom: 10,
    flexShrink: 0,
  }

  const scrollAreaStyle = {
    flex: 1,
    overflowY: 'auto',
    paddingRight: 4,
  }

  const cardStyle = {
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.03)',
    border: '0.5px solid rgba(255,255,255,0.07)',
    marginBottom: 4,
  }

  const cardHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  }

  const connectorStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 14px',
    marginBottom: 4,
  }

  const addNodeStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 0',
    marginTop: 4,
    border: '0.5px dashed rgba(255,255,255,0.08)',
    borderRadius: 10,
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag',
    background: 'none',
    width: '100%',
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
  }

  const actionRowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    flexShrink: 0,
  }

  const unfilled = totalPlaceholders - filledCount

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <svg style={workflowIconStyle} viewBox="0 0 18 18" fill="none">
            <rect x="1" y="7" width="5" height="4" rx="1.5" fill="rgba(34,197,94,0.6)" />
            <rect x="12" y="2" width="5" height="4" rx="1.5" fill="rgba(100,170,255,0.6)" />
            <rect x="12" y="12" width="5" height="4" rx="1.5" fill="rgba(100,170,255,0.6)" />
            <path d="M6 9h3M9 9V4h3M9 9v5h3" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          </svg>
          <span style={workflowNameStyle}>{workflowName}</span>
          {unfilled > 0 && (
            <span style={placeholderBadgeStyle}>{unfilled} to fill</span>
          )}
        </div>
        <button style={reiterateStyle} onClick={onReiterate}>↺ Reiterate</button>
      </div>

      {/* You said */}
      <div style={youSaidStyle}>
        <div style={youSaidLabelStyle}>YOU SAID</div>
        <div style={transcriptStyle}>{transcript}</div>
      </div>

      <div style={dividerStyle} />

      {/* Scrollable node cards */}
      <div style={scrollAreaStyle}>
        {nodes.map((node, idx) => {
          const isTrigger = idx === 0
          const badgeColor = isTrigger
            ? { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', text: 'rgba(74,222,128,0.9)' }
            : { bg: 'rgba(10,132,255,0.15)', border: 'rgba(10,132,255,0.3)', text: 'rgba(100,170,255,0.9)' }

          const params = node.parameters || {}
          const placeholders = node.placeholders || []

          return (
            <div key={node.id}>
              <div style={cardStyle}>
                {/* Card header */}
                <div style={cardHeaderStyle}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: badgeColor.bg, border: `0.5px solid ${badgeColor.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: badgeColor.text,
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {node.name ? (
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: 1 }}>
                        {node.name}
                      </div>
                    ) : (
                      <input
                        placeholder="Node name"
                        style={{
                          fontSize: 12.5, fontWeight: 500,
                          color: 'rgba(255,255,255,0.75)',
                          background: 'rgba(255,255,255,0.06)',
                          border: '0.5px solid rgba(255,255,255,0.15)',
                          borderRadius: 5, padding: '2px 6px', width: '100%',
                          outline: 'none',
                        }}
                        defaultValue={node.name}
                        onBlur={e => onFillPlaceholder(node.id, '__name__', e.target.value)}
                      />
                    )}
                    {node.type ? (
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.28)' }}>
                        {node.type}
                      </div>
                    ) : (
                      <input
                        placeholder="n8n-nodes-base.nodetype"
                        style={{
                          fontSize: 10, fontFamily: 'monospace',
                          color: 'rgba(255,255,255,0.5)',
                          background: 'rgba(255,255,255,0.06)',
                          border: '0.5px solid rgba(255,255,255,0.15)',
                          borderRadius: 5, padding: '2px 6px', width: '100%',
                          marginTop: 2, outline: 'none',
                        }}
                        defaultValue={node.type}
                        onBlur={e => onFillPlaceholder(node.id, '__type__', e.target.value)}
                      />
                    )}
                  </div>
                  {(node.name || node.type) && (
                    <div style={{
                      fontSize: 9, fontWeight: 600, letterSpacing: '0.05em',
                      padding: '2px 6px', borderRadius: 4,
                      background: isTrigger ? 'rgba(34,197,94,0.12)' : 'rgba(10,132,255,0.12)',
                      color: isTrigger ? 'rgba(74,222,128,0.8)' : 'rgba(100,170,255,0.8)',
                      flexShrink: 0,
                    }}>
                      {isTrigger ? 'Trigger' : 'Action'}
                    </div>
                  )}
                  {nodes.length > 1 && (
                    <button
                      onClick={() => onDeleteNode(node.id)}
                      style={{
                        fontSize: 14, lineHeight: 1,
                        color: 'rgba(255,255,255,0.2)',
                        background: 'none', border: 'none',
                        cursor: 'pointer',
                        WebkitAppRegion: 'no-drag',
                        padding: '0 2px',
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Purpose */}
                {node.purpose && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6, lineHeight: 1.4 }}>
                    {node.purpose}
                  </div>
                )}

                {/* Parameters */}
                {Object.entries(params).map(([key, val]) => {
                  const isPlaceholder = placeholders.includes(key)
                  const filledVal = filledPlaceholders[`${node.id}-${key}`]
                  const inputKey = `${node.id}-${key}`
                  const isActive = activeInput === inputKey

                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', minWidth: 80, paddingTop: 1 }}>
                        {key}
                      </span>
                      {isPlaceholder && !filledVal ? (
                        isActive ? (
                          <input
                            autoFocus
                            value={inputValues[inputKey] || ''}
                            onChange={e => setInputValues(prev => ({ ...prev, [inputKey]: e.target.value }))}
                            onBlur={() => handleInputCommit(node.id, key)}
                            onKeyDown={e => handleInputKeyDown(e, node.id, key)}
                            style={{
                              fontSize: 11,
                              color: 'rgba(255,255,255,0.75)',
                              background: 'rgba(255,255,255,0.06)',
                              border: '0.5px solid rgba(255,189,46,0.4)',
                              borderRadius: 5, padding: '2px 7px',
                              outline: 'none', flex: 1,
                            }}
                          />
                        ) : (
                          <span
                            onClick={() => handleChipClick(node.id, key)}
                            style={{
                              fontSize: 11,
                              color: 'rgba(255,189,46,0.7)',
                              background: 'rgba(255,189,46,0.06)',
                              border: '0.5px solid rgba(255,189,46,0.18)',
                              borderRadius: 5, padding: '2px 7px',
                              cursor: 'pointer',
                              WebkitAppRegion: 'no-drag',
                            }}
                          >
                            {String(val).replace(/_/g, ' ')} ✎
                          </span>
                        )
                      ) : filledVal ? (
                        <span
                          onClick={() => handleChipClick(node.id, key)}
                          style={{
                            fontSize: 11, color: 'rgba(74,222,128,0.8)',
                            background: 'rgba(34,197,94,0.06)',
                            border: '0.5px solid rgba(34,197,94,0.18)',
                            borderRadius: 5, padding: '2px 7px',
                            cursor: 'pointer', WebkitAppRegion: 'no-drag',
                          }}
                        >
                          {filledVal}
                        </span>
                      ) : isExpression(val) ? (
                        <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'rgba(74,222,128,0.65)' }}>
                          {String(val)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                          {String(val)}
                        </span>
                      )}
                    </div>
                  )
                })}

                {/* Credentials */}
                {node.credentialType && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', minWidth: 80 }}>Credentials</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontStyle: 'italic' }}>
                      {node.credentialType} — map in n8n after import
                    </span>
                  </div>
                )}
              </div>

              {/* Connector */}
              {idx < nodes.length - 1 && (
                <div style={connectorStyle}>
                  <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.1)', marginLeft: 9, flexShrink: 0 }} />
                  <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.2)' }}>
                    {nodes.length === 2 ? '↓' : (idx === 0 ? connections || '↓' : '↓')}
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {/* Add node */}
        <button style={addNodeStyle} onClick={onAddNode}>
          + Add another node
        </button>
      </div>

      {/* Action row */}
      <div style={actionRowStyle}>
        <div>
          {unfilled > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(255,189,46,0.5)' }}>
              ⚠ Click the amber values above to fill {unfilled} placeholder{unfilled !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onStartOver}
            style={{
              fontSize: 12, color: 'rgba(255,255,255,0.4)',
              background: 'none', border: '0.5px solid rgba(255,255,255,0.12)',
              borderRadius: 7, padding: '6px 12px', cursor: 'pointer',
              WebkitAppRegion: 'no-drag',
            }}
          >
            Start over
          </button>
          <button
            onClick={onConfirm}
            disabled={!allFilled}
            style={{
              fontSize: 12, fontWeight: 600,
              color: allFilled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
              background: allFilled
                ? 'linear-gradient(135deg, rgba(34,197,94,0.3) 0%, rgba(22,163,74,0.25) 100%)'
                : 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${allFilled ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 7, padding: '6px 14px',
              cursor: allFilled ? 'pointer' : 'not-allowed',
              opacity: allFilled ? 1 : 0.5,
              WebkitAppRegion: 'no-drag',
            }}
          >
            Confirm & generate JSON →
          </button>
        </div>
      </div>
    </div>
  )
}
