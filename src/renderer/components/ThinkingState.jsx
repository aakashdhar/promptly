import MorphCanvas from './MorphCanvas.jsx'

export default function ThinkingState({ transcript }) {
  return (
    <div id="panel-thinking">
      <div className="traf" />
      <div className="cr-think">
        <div className="status-badge">
          <div className="status-dot" />
          Processing
        </div>
        <div className="think-title">Building your prompt</div>
      </div>
      <div className="morph-wrap">
        <MorphCanvas />
      </div>
      <div className="div-line" />
      <span className="ys-label-s">You said</span>
      <div className="ys-text-s" id="think-transcript">{transcript}</div>
    </div>
  )
}
