import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
import crypto from 'crypto'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'

const require = createRequire(import.meta.url)
const { segmentsToText, bundledArgs, wavSeconds, looksIncomplete, silentWav, findBundledEngine, createWhisperRunner } = require('../main/whisper.js')
const { createSpeechModels } = require('../main/speech-models.js')
const { formatSymbols, tidyDictation } = require('../main/dictation.js')
const { buildModePrompt } = require('../main/prompts.js')

let tmp
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-speech-')) })
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }) })

describe('transcription output and arguments', () => {
  it('joins timestamped segments and drops non-speech lines', () => {
    const out = [
      '',
      '[00:00:00.000 --> 00:00:04.180]   Number one, I will be late and',
      '[00:00:04.180 --> 00:00:08.200]   I will catch up on the notes.',
      '[00:00:08.200 --> 00:00:09.000]   [BLANK_AUDIO]',
      '[00:00:09.000 --> 00:00:10.000]   (wind blowing)',
      '[00:00:10.000 --> 00:00:14.000]   यार, इस रिपोर्ट को छोटा कर दो',
    ].join('\n')
    expect(segmentsToText(out)).toBe('Number one, I will be late and I will catch up on the notes. यार, इस रिपोर्ट को छोटा कर दो')
    expect(segmentsToText(' plain text without timestamps ')).toBe('plain text without timestamps')
  })

  it('keeps timestamps on, so a pause can never skip the rest of a 30-second window', () => {
    const args = bundledArgs({ model: 'm.bin', audioFile: 'a.wav' })
    expect(args).not.toContain('--no-timestamps')
    expect(args).toEqual(['-m', 'm.bin', '-f', 'a.wav', '-l', 'en', '--no-prints', '--no-gpu'])
  })

  it('adds voice detection, the GPU, the language and the dictionary hint when asked', () => {
    const args = bundledArgs({ model: 'm.bin', vad: 'vad.bin', audioFile: 'a.wav', language: 'hi', useGpu: true, hint: 'Aakash, Figma' })
    expect(args).toEqual(['-m', 'm.bin', '-f', 'a.wav', '-l', 'hi', '--no-prints', '--vad', '-vm', 'vad.bin', '--prompt', 'Aakash, Figma'])
  })

  it('reads a WAV length from its header', () => {
    const file = path.join(tmp, 'three.wav')
    fs.writeFileSync(file, silentWav(3))
    expect(wavSeconds(file)).toBeCloseTo(3)
    fs.writeFileSync(path.join(tmp, 'x.webm'), 'not a wav')
    expect(wavSeconds(path.join(tmp, 'x.webm'))).toBe(0)
    expect(wavSeconds(path.join(tmp, 'missing.wav'))).toBe(0)
  })

  it('flags long recordings with far too few words', () => {
    expect(looksIncomplete('just a few words here', 60)).toBe(true)
    expect(looksIncomplete('word '.repeat(90), 60)).toBe(false)
    expect(looksIncomplete('ok', 5)).toBe(false) // short clips are never second-guessed
  })
})

describe('built-in engine with voice detection and the accurate model', () => {
  let dir
  // Fake whisper-cli: prints its arguments as one timestamped segment. With --vad it "loses"
  // most of the speech when LOSE_WITH_VAD is set, to exercise the second pass.
  beforeAll(() => {
    dir = path.join(tmp, 'engine')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'whisper-cli'), `#!/bin/bash
if [ -n "$LOSE_WITH_VAD" ] && [[ " $* " == *" --vad "* ]]; then echo "[00:00:00.000 --> 00:00:02.000]   only this"; exit 0; fi
echo "[00:00:00.000 --> 00:00:02.000]   ARGS $*"
`, { mode: 0o755 })
    fs.writeFileSync(path.join(dir, 'ggml-base.en-q5_1.bin'), 'model')
    fs.writeFileSync(path.join(dir, 'ggml-silero-v5.1.2.bin'), 'vad')
  })

  it('finds the voice activity model next to the engine', () => {
    expect(findBundledEngine(dir).vad).toBe(path.join(dir, 'ggml-silero-v5.1.2.bin'))
  })

  it('uses voice detection and the built-in English model by default', async () => {
    const audio = path.join(tmp, 'short.wav')
    fs.writeFileSync(audio, silentWav(2))
    const w = createWhisperRunner({ getBundledDir: () => dir, getWhisperPath: () => null, getFfmpegPath: () => null })
    const text = await w.transcribe(audio, { timeoutMs: 5000 })
    expect(text).toContain('--vad -vm ' + path.join(dir, 'ggml-silero-v5.1.2.bin'))
    expect(text).toContain('-m ' + path.join(dir, 'ggml-base.en-q5_1.bin'))
    expect(text).toContain('-l en')
    expect(text).toContain('--no-gpu')
  })

  it('uses the accurate model, its language and the GPU when chosen', async () => {
    const audio = path.join(tmp, 'short.wav')
    fs.writeFileSync(audio, silentWav(2))
    const w = createWhisperRunner({
      getBundledDir: () => dir, getWhisperPath: () => null, getFfmpegPath: () => null,
      getAccurateModel: () => ({ path: '/models/large.bin' }), getLanguage: () => 'hi',
    })
    const text = await w.transcribe(audio, { timeoutMs: 5000 })
    expect(text).toContain('-m /models/large.bin')
    expect(text).toContain('-l hi')
    expect(text).not.toContain('--no-gpu')
  })

  it('runs a second pass without voice detection when too little came back', async () => {
    const audio = path.join(tmp, 'long.wav')
    fs.writeFileSync(audio, silentWav(30))
    process.env.LOSE_WITH_VAD = '1'
    try {
      const w = createWhisperRunner({ getBundledDir: () => dir, getWhisperPath: () => null, getFfmpegPath: () => null })
      const text = await w.transcribe(audio, { timeoutMs: 5000 })
      expect(text).toMatch(/^ARGS /)
      expect(text).not.toContain('--vad')
    } finally {
      delete process.env.LOSE_WITH_VAD
    }
  })
})

describe('Best accuracy model download', () => {
  const payload = Buffer.from('pretend this is a speech model '.repeat(2000))
  const sha256 = crypto.createHash('sha256').update(payload).digest('hex')
  let server
  let base
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/redirect') { res.writeHead(302, { Location: '/model.bin' }); res.end(); return }
      if (req.url === '/model.bin') { res.writeHead(200, { 'Content-Length': payload.length }); res.end(payload); return }
      if (req.url === '/slow.bin') { res.writeHead(200, { 'Content-Length': payload.length }); res.write(payload.subarray(0, 100)); return }
      res.writeHead(404); res.end()
    })
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${server.address().port}`
  })
  afterAll(() => { server.closeAllConnections?.(); server.close() })

  const model = (url, sum = sha256) => ({ file: 'model.bin', url: base + url, sha256: sum, bytes: payload.length })

  it('downloads through a redirect, verifies it and reports progress', async () => {
    const dir = path.join(tmp, 'models-ok')
    const m = createSpeechModels({ dir, model: model('/redirect') })
    expect(m.installedPath()).toBeNull()
    const seen = []
    const result = await m.download((p) => seen.push(p))
    expect(result).toEqual({ success: true })
    expect(m.installedPath()).toBe(path.join(dir, 'model.bin'))
    expect(seen.at(-1).percent).toBe(100)
    expect(fs.existsSync(path.join(dir, 'model.bin.part'))).toBe(false)
    m.remove()
    expect(m.installedPath()).toBeNull()
  })

  it('throws away a damaged download', async () => {
    const dir = path.join(tmp, 'models-bad')
    const m = createSpeechModels({ dir, model: model('/model.bin', 'f'.repeat(64)) })
    const result = await m.download()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/damaged/)
    expect(fs.readdirSync(dir)).toEqual([])
  })

  it('reports a missing file clearly', async () => {
    const m = createSpeechModels({ dir: path.join(tmp, 'models-404'), model: model('/nope.bin') })
    expect(await m.download()).toEqual({ success: false, error: 'Download failed (HTTP 404)' })
  })

  it('can be cancelled part-way', async () => {
    const dir = path.join(tmp, 'models-cancel')
    const m = createSpeechModels({ dir, model: model('/slow.bin') })
    const pending = m.download()
    await new Promise((r) => setTimeout(r, 100))
    expect(m.isDownloading()).toBe(true)
    expect(m.cancel()).toBe(true)
    expect(await pending).toEqual({ success: false, cancelled: true })
    expect(m.isDownloading()).toBe(false)
    expect(fs.existsSync(path.join(dir, 'model.bin.part'))).toBe(false)
  })
})

describe('dictation symbols', () => {
  it('turns spoken money and percentages into symbols', () => {
    expect(formatSymbols('The invoice for 12,450 rupees is due')).toBe('The invoice for ₹12,450 is due')
    expect(formatSymbols('Rs. 500 and Rs 1,200.50 today')).toBe('₹500 and ₹1,200.50 today')
    expect(formatSymbols('25 percent off, 3.5 per cent')).toBe('25% off, 3.5%')
    expect(formatSymbols('it costs 40 dollars and 1 dollar')).toBe('it costs $40 and $1')
    expect(formatSymbols('10 euros')).toBe('€10')
  })

  it('leaves everything else as said', () => {
    expect(formatSymbols('two rupees')).toBe('two rupees')
    expect(formatSymbols('I bought 3 pounds of apples')).toBe('I bought 3 pounds of apples')
    expect(formatSymbols('The reference number is 4729.')).toBe('The reference number is 4729.')
    expect(formatSymbols('It cost 12 rs.')).toBe('It cost ₹12.')
  })

  it('is on by default in dictation and can be turned off', () => {
    expect(tidyDictation('That is 12,450 rupees.').text).toBe('That is ₹12,450.')
    expect(tidyDictation('That is 12,450 rupees.', { symbols: false }).text).toBe('That is 12,450 rupees.')
  })
})

describe('other languages', () => {
  it('tells Claude the user may speak Hindi and asks for English', () => {
    const prompt = buildModePrompt('इस रिपोर्ट को छोटा कर दो', 'balanced', { context: { otherLanguages: true } })
    expect(prompt).toMatch(/Hindi/)
    expect(prompt).toMatch(/write the result in English/)
    expect(buildModePrompt('shorten this report', 'balanced', { context: {} })).not.toMatch(/Hindi/)
  })
})
