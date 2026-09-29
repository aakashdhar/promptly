import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
import http from 'http'

const require = createRequire(import.meta.url)
const { PROVIDERS, pickModels, normaliseModelId } = require('../main/ai-providers.js')
const { createApiRunner, listModels } = require('../main/ai-api.js')

// A local stand-in for the providers' OpenAI-compatible API. The request path picks the behaviour.
let server, base, lastRequest
beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (d) => { body += d })
    req.on('end', () => {
      lastRequest = { url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null }
      const model = lastRequest.body?.model || ''
      if (req.url.endsWith('/models')) {
        if (req.headers.authorization !== 'Bearer good-key') { res.writeHead(401, { 'content-type': 'application/json' }); res.end('{"error":{"message":"bad key"}}'); return }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ data: [{ id: 'gpt-5' }, { id: 'gpt-5-mini' }, { id: 'text-embedding-3-large' }] }))
        return
      }
      if (model === 'refused') { res.writeHead(401, { 'content-type': 'application/json' }); res.end('{"error":{"message":"invalid key"}}'); return }
      if (model === 'limited') { res.writeHead(429, { 'content-type': 'application/json' }); res.end('{"error":{"message":"slow down"}}'); return }
      if (model === 'slow') return // never answers
      if (lastRequest.body.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        for (const piece of ['Hello', ', ', 'world']) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`)
        res.end('data: [DONE]\n\n')
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message: { content: '  Hello, world  ' } }] }))
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(() => { server.closeAllConnections?.(); server.close() })

// Sends each provider's requests to the local server instead.
const localFetch = (url, opts) => fetch(Object.values(PROVIDERS).reduce((u, p) => u.replace(p.baseUrl, base), url), opts)
const runner = (settings) => createApiRunner({ getSettings: () => settings, fetchImpl: localFetch })

describe('AI providers: picking models from the provider\'s list', () => {
  it('picks the newest full model and the newest fast one, from chat models only', () => {
    const openai = pickModels(['gpt-4o', 'gpt-4o-2024-08-06', 'gpt-5', 'gpt-5.1', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini', 'text-embedding-3-large', 'gpt-4o-mini-tts', 'gpt-realtime', 'dall-e-3', 'gpt-5-codex'], 'openai')
    expect(openai.model).toBe('gpt-5.1')
    expect(openai.fastModel).toBe('gpt-5-mini')
    expect(openai.models).not.toContain('text-embedding-3-large')
    expect(openai.models).not.toContain('gpt-5-codex')

    const gemini = pickModels(['models/gemini-1.5-pro-002', 'models/gemini-2.5-pro', 'models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/text-embedding-004', 'models/gemini-2.0-flash-exp'], 'gemini')
    expect(gemini.model).toBe('gemini-2.5-pro')
    expect(gemini.fastModel).toBe('gemini-2.5-flash')

    const grok = pickModels(['grok-3', 'grok-3-mini', 'grok-4', 'grok-4-fast-reasoning', 'grok-2-image'], 'grok')
    expect(grok.model).toBe('grok-4')
    expect(grok.fastModel).toBe('grok-4-fast-reasoning')
  })

  it('falls back sensibly when a list has only one kind', () => {
    expect(pickModels(['gpt-5-mini'], 'openai')).toMatchObject({ model: 'gpt-5-mini', fastModel: 'gpt-5-mini' })
    expect(pickModels(['grok-4'], 'grok')).toMatchObject({ model: 'grok-4', fastModel: 'grok-4' })
    expect(normaliseModelId('models/gemini-2.5-pro')).toBe('gemini-2.5-pro')
  })
})

describe('AI providers: the API client', () => {
  const settings = { provider: 'openai', key: 'good-key', model: 'gpt-5', fastModel: 'gpt-5-mini' }

  it('sends the prompt with the key and returns the answer', async () => {
    const result = await runner(settings).run('Write a prompt')
    expect(result).toMatchObject({ success: true, prompt: 'Hello, world', provider: 'openai', model: 'gpt-5' })
    expect(lastRequest.headers.authorization).toBe('Bearer good-key')
    expect(lastRequest.body.messages.at(-1)).toEqual({ role: 'user', content: 'Write a prompt' })
    expect(lastRequest.body.max_completion_tokens).toBeGreaterThan(0)
    expect(lastRequest.body.stream).toBeUndefined()
  })

  it('streams the answer as it is written', async () => {
    const seen = []
    const result = await runner(settings).run('Write a prompt', { onDelta: (t) => seen.push(t) })
    expect(result.prompt).toBe('Hello, world')
    expect(seen).toEqual(['Hello', 'Hello, ', 'Hello, world'])
  })

  it('uses the fast model when asked, and max_tokens for providers other than OpenAI', async () => {
    await runner(settings).run('x', { fast: true })
    expect(lastRequest.body.model).toBe('gpt-5-mini')
    await runner({ provider: 'grok', key: 'k', model: 'grok-4' }).run('x')
    expect(lastRequest.body.max_tokens).toBeGreaterThan(0)
  })

  it('names the provider in errors', async () => {
    expect(await runner({ ...settings, model: 'refused' }).run('x')).toMatchObject({ success: false, errorType: 'auth', error: 'Your OpenAI key was refused. Check it in Settings › AI.' })
    expect(await runner({ ...settings, provider: 'gemini', model: 'limited' }).run('x')).toMatchObject({ errorType: 'rate', error: "Gemini says you've hit a rate or usage limit. Try again in a minute." })
    const offline = createApiRunner({ getSettings: () => settings, fetchImpl: () => Promise.reject(new TypeError('fetch failed')) })
    expect(await offline.run('x')).toMatchObject({ errorType: 'offline', error: "Couldn't reach OpenAI. Check your connection." })
    expect(await createApiRunner({ getSettings: () => null }).run('x')).toMatchObject({ success: false, errorType: 'auth' })
  })

  it('times out, and a cancel stops the request', async () => {
    expect(await runner({ ...settings, model: 'slow' }).run('x', { timeoutMs: 200 })).toMatchObject({ errorType: 'timeout', timedOut: true })
    const r = runner({ ...settings, model: 'slow' })
    const pending = r.run('x', { timeoutMs: 5000 })
    setTimeout(() => r.cancelAll(), 50)
    expect(await pending).toMatchObject({ errorType: 'cancelled', cancelled: true })
  })

  it('checks a key by listing its models', async () => {
    expect(await listModels('openai', 'good-key', { fetchImpl: localFetch })).toEqual({ ok: true, models: ['gpt-5', 'gpt-5-mini', 'text-embedding-3-large'] })
    expect(await listModels('openai', 'bad-key', { fetchImpl: localFetch })).toMatchObject({ ok: false, errorType: 'auth' })
    expect(await listModels('openai', '', { fetchImpl: localFetch })).toMatchObject({ ok: false, errorType: 'auth' })
  })
})
