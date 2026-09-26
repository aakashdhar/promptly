import { describe, it, expect } from 'vitest'
import { parseSections, getModeTagStyle, parseEmailOutput, parseImageAnalysisOutput, parseImageAssemblyOutput, evalScoreColor, evalVerdict, parseWorkflowAnalysis, parseVideoDefaults, buildImagePromptText, readableColor } from '../src/renderer/utils/promptUtils.js'
import { formatTime, pairDictations } from '../src/renderer/utils/history.js'
import { parsePolishOutput } from '../src/renderer/hooks/usePolishMode.js'
import { encodeWav, TARGET_SAMPLE_RATE } from '../src/renderer/utils/audio.js'

describe('parseSections', () => {
  it('returns empty array for empty input', () => {
    expect(parseSections('')).toEqual([])
    expect(parseSections(null)).toEqual([])
  })

  it('wraps unsectioned text in null-label entry', () => {
    const result = parseSections('Just some text')
    expect(result).toHaveLength(1)
    expect(result[0].label).toBeNull()
    expect(result[0].body).toBe('Just some text')
  })

  it('parses sections with labels', () => {
    const text = 'ROLE:\nYou are an expert\nTASK:\nBuild a thing'
    const result = parseSections(text)
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('ROLE')
    expect(result[0].body).toBe('You are an expert')
    expect(result[1].label).toBe('TASK')
    expect(result[1].body).toBe('Build a thing')
  })

  it('handles multiline section bodies', () => {
    const text = 'ROLE:\nLine one\nLine two\n'
    const result = parseSections(text)
    expect(result[0].label).toBe('ROLE')
    expect(result[0].body).toBe('Line one\nLine two')
  })

  it('handles sections with slash in label', () => {
    const text = 'INPUT/OUTPUT:\nSome content'
    const result = parseSections(text)
    expect(result[0].label).toBe('INPUT/OUTPUT')
  })
})

describe('getModeTagStyle', () => {
  it('returns green tones for polish mode', () => {
    const style = getModeTagStyle('polish')
    expect(style.background).toContain('48,209,88')
    expect(style.color).toContain('100,220,130')
  })

  it('returns purple tones for design mode (and Refine, now part of it)', () => {
    const style = getModeTagStyle('refine')
    expect(style.background).toContain('139,92,246')
    expect(style.color).toContain('167,139,250')
  })

  it('returns purple tones for image mode', () => {
    const style = getModeTagStyle('image')
    expect(style.background).toContain('139,92,246')
    expect(style.color).toContain('167,139,250')
  })

  it('returns blue tones for standard prose modes', () => {
    for (const mode of ['prompt', 'code', 'balanced', 'detailed', 'concise', 'chain']) {
      const style = getModeTagStyle(mode)
      expect(style.background).toContain('10,132,255')
      expect(style.color).toContain('100,170,255')
    }
  })

  it('returns green tones for workflow mode', () => {
    const style = getModeTagStyle('workflow')
    expect(style.background).toContain('34,197,94')
    expect(style.color).toContain('74,222,128')
  })

  it('returns blue tones for video mode', () => {
    const style = getModeTagStyle('video')
    expect(style.background).toContain('10,132,255')
  })

  it('returns blue tones for unknown mode', () => {
    const style = getModeTagStyle('unknown')
    expect(style.background).toContain('10,132,255')
  })

  it('returns teal style for email mode', () => {
    const style = getModeTagStyle('email')
    expect(style.background).toBe('rgba(20,184,166,0.1)')
    expect(style.color).toContain('45,212,191')
    expect(style.color).toContain('var(--accent-text-strength)')
  })
})

describe('formatTime', () => {
  it('returns "just now" for timestamps under 60 seconds ago', () => {
    expect(formatTime(new Date(Date.now() - 5000).toISOString())).toBe('just now')
    expect(formatTime(new Date(Date.now() - 59000).toISOString())).toBe('just now')
  })

  it('returns minutes for timestamps within the last hour', () => {
    expect(formatTime(new Date(Date.now() - 5 * 60 * 1000).toISOString())).toBe('5m ago')
    expect(formatTime(new Date(Date.now() - 59 * 60 * 1000).toISOString())).toBe('59m ago')
  })

  it('returns hours for timestamps within the last 24 hours', () => {
    expect(formatTime(new Date(Date.now() - 2 * 3600 * 1000).toISOString())).toBe('2h ago')
    expect(formatTime(new Date(Date.now() - 23 * 3600 * 1000).toISOString())).toBe('23h ago')
  })

  it('returns formatted date for older timestamps', () => {
    const result = formatTime(new Date('2024-01-15T12:00:00.000Z').toISOString())
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/15/)
  })
})

describe('parseEmailOutput', () => {
  const payload = { subject: 'Hello', body: 'Hi there', toneAnalysis: [] }

  it('parses raw JSON without fences', () => {
    const result = parseEmailOutput(JSON.stringify(payload))
    expect(result.subject).toBe('Hello')
    expect(result.body).toBe('Hi there')
  })

  it('strips ```json fences before parsing', () => {
    const raw = '```json\n' + JSON.stringify(payload) + '\n```'
    const result = parseEmailOutput(raw)
    expect(result.subject).toBe('Hello')
    expect(result.body).toBe('Hi there')
  })

  it('strips plain ``` fences before parsing', () => {
    const raw = '```\n' + JSON.stringify(payload) + '\n```'
    const result = parseEmailOutput(raw)
    expect(result.subject).toBe('Hello')
  })

  it('handles preamble text before ```json fence', () => {
    const raw = 'Here is the email:\n\n```json\n' + JSON.stringify(payload) + '\n```'
    const result = parseEmailOutput(raw)
    expect(result.subject).toBe('Hello')
  })

  it('handles preamble text before plain JSON (no fences)', () => {
    const raw = 'Sure, here you go:\n\n' + JSON.stringify(payload)
    const result = parseEmailOutput(raw)
    expect(result.subject).toBe('Hello')
  })

  it('throws on genuinely invalid JSON', () => {
    expect(() => parseEmailOutput('not json')).toThrow()
  })
})

describe('parseImageAnalysisOutput', () => {
  const payload = {
    subject: { subject: 'Young woman', setting: 'Ocean/beach', emotion: 'Serene', framing: 'Close-up', negativePrompts: [] },
    lighting: { timeOfDay: 'Golden hour', lightType: 'Directional sun', quality: 'Warm amber', lensFlare: 'None' },
    camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow', aspectRatio: '4:5 portrait', angle: 'Eye level', filmSim: 'Kodak Portra 400' },
    style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain', reference: 'Emmanuel Lubezki' },
    technical: { resolution: 'Ultra HD 4K', renderQuality: 'Photorealistic', stylise: 750, chaos: 20, weird: 0, seed: null },
  }

  it('parses raw JSON without fences', () => {
    const result = parseImageAnalysisOutput(JSON.stringify(payload))
    expect(result.subject.subject).toBe('Young woman')
    expect(result.technical.stylise).toBe(750)
  })

  it('strips ```json fences before parsing', () => {
    const raw = '```json\n' + JSON.stringify(payload) + '\n```'
    const result = parseImageAnalysisOutput(raw)
    expect(result.subject.setting).toBe('Ocean/beach')
    expect(result.camera.lens).toBe('85mm portrait')
  })

  it('returns null on malformed JSON', () => {
    expect(parseImageAnalysisOutput('not json at all')).toBeNull()
    expect(parseImageAnalysisOutput('')).toBeNull()
    expect(parseImageAnalysisOutput(null)).toBeNull()
  })
})

describe('parseImageAssemblyOutput', () => {
  const payload = { prompt: 'A young woman at golden hour', flags: '--ar 4:5 --stylize 750 --chaos 20' }

  it('parses raw JSON without fences', () => {
    const result = parseImageAssemblyOutput(JSON.stringify(payload))
    expect(result.prompt).toBe('A young woman at golden hour')
    expect(result.flags).toBe('--ar 4:5 --stylize 750 --chaos 20')
  })

  it('strips ```json fences before parsing', () => {
    const raw = '```json\n' + JSON.stringify(payload) + '\n```'
    const result = parseImageAssemblyOutput(raw)
    expect(result.prompt).toBe('A young woman at golden hour')
    expect(result.flags).toBe('--ar 4:5 --stylize 750 --chaos 20')
  })

  it('returns null on malformed JSON', () => {
    expect(parseImageAssemblyOutput('not json')).toBeNull()
    expect(parseImageAssemblyOutput('')).toBeNull()
    expect(parseImageAssemblyOutput(null)).toBeNull()
  })
})

describe('parsePolishOutput', () => {
  it('extracts polished text and changes from well-formed output', () => {
    const raw = 'POLISHED:\nThis is the polished text\n\nCHANGES:\nFixed grammar\nImproved clarity'
    const result = parsePolishOutput(raw)
    expect(result.polished).toBe('This is the polished text')
    expect(result.changes).toEqual(['Fixed grammar', 'Improved clarity'])
  })

  it('falls back to raw text when no POLISHED marker', () => {
    const raw = 'Just some text without markers'
    const result = parsePolishOutput(raw)
    expect(result.polished).toBe('Just some text without markers')
    expect(result.changes).toEqual([])
  })

  it('handles output with no CHANGES section', () => {
    const raw = 'POLISHED:\nJust the polished text'
    const result = parsePolishOutput(raw)
    expect(result.polished).toBe('Just the polished text')
    expect(result.changes).toEqual([])
  })

  it('filters empty lines from changes', () => {
    const raw = 'POLISHED:\nText\n\nCHANGES:\nFix 1\n\nFix 2'
    const result = parsePolishOutput(raw)
    expect(result.changes).toEqual(['Fix 1', 'Fix 2'])
  })

  it('trims whitespace from polished output', () => {
    const raw = 'POLISHED:\n  Has leading/trailing whitespace  \n\nCHANGES:\n'
    const result = parsePolishOutput(raw)
    expect(result.polished).toBe('Has leading/trailing whitespace')
  })
})

describe('evalScoreColor', () => {
  it('always returns green for promptly', () => {
    expect(evalScoreColor(30, true)).toBe('rgba(48,209,88,0.85)')
    expect(evalScoreColor(0, true)).toBe('rgba(48,209,88,0.85)')
  })
  it('returns green for raw score >= 80', () => {
    expect(evalScoreColor(80, false)).toBe('rgba(48,209,88,0.85)')
    expect(evalScoreColor(100, false)).toBe('rgba(48,209,88,0.85)')
  })
  it('returns muted green for raw score 60–79', () => {
    expect(evalScoreColor(60, false)).toBe('rgba(48,209,88,0.55)')
    expect(evalScoreColor(79, false)).toBe('rgba(48,209,88,0.55)')
  })
  it('returns amber for raw score 40–59', () => {
    expect(evalScoreColor(40, false)).toBe('rgba(255,159,10,0.85)')
    expect(evalScoreColor(59, false)).toBe('rgba(255,159,10,0.85)')
  })
  it('returns red for raw score < 40', () => {
    expect(evalScoreColor(39, false)).toBe('rgba(255,69,58,0.85)')
    expect(evalScoreColor(0, false)).toBe('rgba(255,69,58,0.85)')
  })
})

describe('evalVerdict', () => {
  it('returns big upgrade for delta >= 30', () => {
    expect(evalVerdict(30)).toBe('⇑ Big upgrade')
    expect(evalVerdict(50)).toBe('⇑ Big upgrade')
  })
  it('returns clear improvement for delta 15–29', () => {
    expect(evalVerdict(15)).toBe('↑ Clear improvement')
    expect(evalVerdict(29)).toBe('↑ Clear improvement')
  })
  it('returns modest improvement for delta 5–14', () => {
    expect(evalVerdict(5)).toBe('↗ Modest improvement')
    expect(evalVerdict(14)).toBe('↗ Modest improvement')
  })
  it('returns minimal difference for delta -4 to 4', () => {
    expect(evalVerdict(0)).toBe('→ Minimal difference')
    expect(evalVerdict(-4)).toBe('→ Minimal difference')
    expect(evalVerdict(4)).toBe('→ Minimal difference')
  })
  it('returns raw was clearer for delta <= -5', () => {
    expect(evalVerdict(-5)).toBe('↓ Raw was clearer')
    expect(evalVerdict(-20)).toBe('↓ Raw was clearer')
  })
})

describe('structured output validation', () => {
  it('rejects emails without a subject or body', () => {
    expect(() => parseEmailOutput('{"subject":"Hi"}')).toThrow()
    expect(() => parseEmailOutput('{"subject":"","body":"x"}')).toThrow()
    expect(() => parseEmailOutput('[1,2]')).toThrow()
  })

  it('keeps only string tone fields', () => {
    const r = parseEmailOutput(JSON.stringify({ subject: 'S', body: 'B', toneAnalysis: { tone: 'Friendly', recipient: 5, extra: 'x' } }))
    expect(r).toEqual({ subject: 'S', body: 'B', toneAnalysis: { tone: 'Friendly' } })
  })

  it('accepts usable workflow nodes and drops malformed ones', () => {
    const raw = '```json\n' + JSON.stringify({ name: 'wf', nodes: [{ id: 1, name: 'Webhook', placeholders: ['url', 3] }, 'junk', { id: 2 }] }) + '\n```'
    const r = parseWorkflowAnalysis(raw)
    // A placeholder without a parameter row gets one, so it can be filled in.
    expect(r.nodes).toEqual([{ id: 1, name: 'Webhook', placeholders: ['url'], parameters: { url: 'URL' } }])
  })

  it('returns null for workflows with no usable nodes', () => {
    expect(parseWorkflowAnalysis('{"nodes":"oops"}')).toBeNull()
    expect(parseWorkflowAnalysis('{"nodes":[]}')).toBeNull()
    expect(parseWorkflowAnalysis('not json')).toBeNull()
  })

  it('keeps video fields with the right types only', () => {
    const empty = { shotType: [], aspectRatio: '16:9', useFirstFrame: false }
    const r = parseVideoDefaults(JSON.stringify({ shotType: ['Wide', 7], aspectRatio: 9, useFirstFrame: true, rogue: 'x', settingDetail: 'beach' }), empty)
    expect(r).toEqual({ defaults: { shotType: ['Wide'], aspectRatio: '16:9', useFirstFrame: true }, settingDetail: 'beach' })
    expect(parseVideoDefaults('garbage', empty)).toEqual({ defaults: empty, settingDetail: '' })
  })

  it('builds image prompt text with or without Midjourney flags', () => {
    expect(buildImagePromptText('{"prompt":"A cat","flags":"--ar 1:1"}')).toBe('A cat\n\n--ar 1:1')
    expect(buildImagePromptText('{"prompt":"A cat","flags":""}')).toBe('A cat')
    expect(buildImagePromptText('plain text prompt')).toBe('plain text prompt')
  })
})

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM WAV header and clamps samples', () => {
    const buf = encodeWav(new Float32Array([0, 1, -1, 2]), TARGET_SAMPLE_RATE)
    const view = new DataView(buf)
    const text = (o, n) => String.fromCharCode(...new Uint8Array(buf, o, n))
    expect(text(0, 4)).toBe('RIFF')
    expect(text(8, 4)).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint32(40, true)).toBe(8)
    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true), view.getInt16(50, true)]).toEqual([0, 32767, -32768, 32767])
  })
})

describe('detectSpokenMode', () => {
  it('switches mode from a spoken prefix', async () => {
    const { detectSpokenMode } = await import('../src/renderer/utils/spokenMode.js')
    expect(detectSpokenMode('Code mode, add retries to the upload job')).toEqual({ mode: 'code', text: 'Add retries to the upload job' })
    expect(detectSpokenMode('email mode: tell the team the release moved')).toEqual({ mode: 'email', text: 'Tell the team the release moved' })
    // Retired names still work, and land in the mode that replaced them.
    expect(detectSpokenMode('Chain of thought mode. Why is the build slow?')).toEqual({ mode: 'prompt', text: 'Why is the build slow?' })
    expect(detectSpokenMode('Prompt mode, plan the offsite')).toEqual({ mode: 'prompt', text: 'Plan the offsite' })
    expect(detectSpokenMode('switch to polish mode we are going to ship friday')).toEqual({ mode: 'polish', text: 'We are going to ship friday' })
  })

  it('leaves ordinary sentences alone', async () => {
    const { detectSpokenMode } = await import('../src/renderer/utils/spokenMode.js')
    expect(detectSpokenMode('the code mode of the app is broken')).toBeNull()
    expect(detectSpokenMode('Design a landing page')).toBeNull()
    expect(detectSpokenMode('code mode')).toBeNull()
  })
})

describe('readableColor', () => {
  it('mixes a mode colour toward ink and drops its alpha so it stays readable', () => {
    expect(readableColor('rgba(139,92,246,0.5)')).toBe('color-mix(in oklab, rgb(139,92,246) var(--accent-text-strength), rgb(var(--ink)))')
    expect(readableColor('rgb(48,209,88)')).toBe('color-mix(in oklab, rgb(48,209,88) var(--accent-text-strength), rgb(var(--ink)))')
  })
  it('leaves tokens and keywords alone', () => {
    expect(readableColor('var(--text-secondary)')).toBe('var(--text-secondary)')
    expect(readableColor('inherit')).toBe('inherit')
  })
})

describe('pairDictations', () => {
  const d = (id, text) => ({ id, mode: 'dictate', transcript: text, prompt: text })
  const p = (id, transcript, mode = 'balanced') => ({ id, mode, transcript, prompt: 'Role: …' })

  it('shows a prompt made from a dictation as one row, marked as spoken', () => {
    const rows = pairDictations([p('p1', 'plan the launch'), d('d1', 'plan the launch'), d('d0', 'note for Deepak')])
    expect(rows.map((r) => r.id)).toEqual(['p1', 'd0'])
    expect(rows[0].fromDictation).toBe('d1')
  })

  it('leaves unrelated neighbours apart', () => {
    const rows = pairDictations([p('p1', 'something else'), d('d1', 'plan the launch'), p('p0', 'typed request')])
    expect(rows.map((r) => r.id)).toEqual(['p1', 'd1', 'p0'])
    expect(rows.every((r) => !r.fromDictation)).toBe(true)
  })
})

