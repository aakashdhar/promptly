import { describe, it, expect } from 'vitest'
import { parseSections, getModeTagStyle, parseEmailOutput, parseImageAnalysisOutput, parseImageAssemblyOutput } from '../src/renderer/utils/promptUtils.js'
import { formatTime } from '../src/renderer/utils/history.js'
import { parsePolishOutput } from '../src/renderer/hooks/usePolishMode.js'

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

  it('returns purple tones for refine mode', () => {
    const style = getModeTagStyle('refine')
    expect(style.background).toContain('139,92,246')
    expect(style.color).toContain('167,139,250')
  })

  it('returns purple tones for image mode', () => {
    const style = getModeTagStyle('image')
    expect(style.background).toContain('139,92,246')
    expect(style.color).toContain('167,139,250')
  })

  it('returns blue tones for design mode', () => {
    const style = getModeTagStyle('design')
    expect(style.background).toContain('10,132,255')
    expect(style.color).toContain('100,170,255')
  })

  it('returns blue tones for standard prose modes', () => {
    for (const mode of ['balanced', 'code', 'detailed', 'concise', 'chain']) {
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
    expect(style.color).toBe('rgba(45,212,191,0.65)')
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
