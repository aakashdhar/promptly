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
    // No key: tagged as an API result, never null, so the window can't show Claude sign-in advice.
    expect(await createApiRunner({ getSettings: () => null }).run('x')).toMatchObject({ success: false, errorType: 'no-key', provider: 'api' })
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

describe('AI providers: keys are stored encrypted', () => {
  const { createSecrets, REFUSED } = require('../main/secrets.js')
  // A stand-in for Electron's safeStorage that visibly changes the bytes.
  const fakeSafeStorage = (ok = true) => ({
    isEncryptionAvailable: () => ok,
    encryptString: (s) => Buffer.from([...Buffer.from(s)].map((b) => b ^ 0x5a)),
    decryptString: (buf) => Buffer.from([...buf].map((b) => b ^ 0x5a)).toString(),
  })

  it('round-trips a key and never stores it in plain text', () => {
    const s = createSecrets({ safeStorage: fakeSafeStorage() })
    const stored = s.encrypt('sk-secret-1234')
    expect(stored).not.toContain('sk-secret')
    expect(Buffer.from(stored, 'base64').toString()).not.toContain('sk-secret')
    expect(s.decrypt(stored)).toBe('sk-secret-1234')
  })

  it('refuses to save when the computer can\'t encrypt, and reads nothing back', () => {
    const s = createSecrets({ safeStorage: fakeSafeStorage(false) })
    expect(s.available()).toBe(false)
    expect(() => s.encrypt('sk-x')).toThrow(REFUSED)
    expect(s.decrypt('abc')).toBeNull()
    expect(createSecrets({ safeStorage: null }).available()).toBe(false)
  })
})

describe('AI providers: who answers each call', () => {
  const { createAiRouter } = require('../main/llm.js')
  const fakeRunner = (name, result = {}) => {
    const calls = []
    return { calls, cancelled: 0, run: async (prompt, opts) => { calls.push({ prompt, opts }); return { success: true, prompt: `${name} answer`, ...result } }, cancelAll() { this.cancelled++ }, version: async () => '1.0' }
  }
  const make = (o = {}) => {
    const claude = fakeRunner('claude', o.claudeResult), api = fakeRunner('api')
    const router = createAiRouter({ claude, api, getMode: () => o.mode ?? 'auto', isClaudeReady: o.isReady ?? (() => o.ready ?? true), hasKey: () => o.key ?? false, apiOptions: o.apiOptions, onClaudeAuthError: o.onAuth, onApiRoute: o.onApiRoute })
    return { router, claude, api }
  }

  it('Automatic: Claude Code when ready, the key when it isn\'t, Claude Code when there is no key', () => {
    expect(make({ ready: true, key: true }).router.active()).toBe('claude')
    expect(make({ ready: false, key: true }).router.active()).toBe('api')
    expect(make({ ready: false, key: false }).router.active()).toBe('claude')
  })

  it('the manual choices win, but "My API key" without a saved key stays on Claude Code', () => {
    expect(make({ mode: 'claude', ready: false, key: true }).router.active()).toBe('claude')
    expect(make({ mode: 'api', ready: true, key: true }).router.active()).toBe('api')
    // Choosing "My API key" and never saving one (or removing it) must not send calls nowhere.
    expect(make({ mode: 'api', ready: true, key: false }).router.active()).toBe('claude')
  })

  it('in Automatic, a Claude sign-in refusal is answered by the key instead of failing', async () => {
    let flagged = 0
    const a = make({ key: true, claudeResult: { success: false, errorType: 'auth', error: 'Please run /login' }, onAuth: () => flagged++ })
    const result = await a.router.run('p', { timeoutMs: 5 })
    expect(result.prompt).toBe('api answer')
    expect(flagged).toBe(1)
    expect(a.api.calls).toHaveLength(1)
    // Without a key, or with "Claude Code" chosen, the Claude error comes back as before.
    expect((await make({ key: false, claudeResult: { success: false, errorType: 'auth' } }).router.run('p')).errorType).toBe('auth')
    expect((await make({ key: true, mode: 'claude', claudeResult: { success: false, errorType: 'auth' } }).router.run('p')).errorType).toBe('auth')
  })

  it('when the key answers in Automatic it asks for a background look at Claude Code, without waiting', async () => {
    let looks = 0
    const a = make({ key: true, ready: false, onApiRoute: () => { looks++; return new Promise(() => {}) } })
    expect((await a.router.run('p')).prompt).toBe('api answer')
    expect(looks).toBe(1)
  })

  it('passes Claude calls through unchanged and API calls with their options', async () => {
    const a = make({ ready: true })
    const opts = { timeoutMs: 1, onDelta: () => {}, thinking: false, slowWarningMs: 2 }
    expect(await a.router.run('p', opts)).toEqual({ success: true, prompt: 'claude answer', provider: 'claude' })
    expect(a.claude.calls[0]).toEqual({ prompt: 'p', opts })
    const b = make({ ready: false, key: true, apiOptions: { fast: true } })
    expect((await b.router.run('p', opts)).prompt).toBe('api answer')
    expect(b.api.calls[0].opts).toEqual({ timeoutMs: 1, onDelta: opts.onDelta, fast: true })
  })

  it('notes a Claude sign-in failure, and a cancel stops both', async () => {
    let flagged = 0
    const { router, claude, api } = make({ claudeResult: { success: false, errorType: 'auth' }, onAuth: () => flagged++ })
    await router.run('p')
    expect(flagged).toBe(1)
    router.cancelAll()
    expect([claude.cancelled, api.cancelled]).toEqual([1, 1])
  })
})

describe('AI providers: is Claude Code ready?', () => {
  const { createClaudeReadiness } = require('../main/llm.js')
  const setup = (o = {}) => {
    let clock = 1000, statusCalls = 0, claudePath = 'path' in o ? o.path : '/bin/claude'
    const r = createClaudeReadiness({
      getClaudePath: () => claudePath,
      setClaudePath: (p) => { claudePath = p },
      resolvePath: async () => o.resolved ?? null,
      getStatus: async () => { statusCalls++; return o.status ?? { installed: true, loggedIn: true } },
      recheckMs: 30000,
      missingRecheckMs: 300000,
      authCooldownMs: 60000,
      now: () => clock,
    })
    return { r, tick: (ms) => { clock += ms }, statusCalls: () => statusCalls, path: () => claudePath }
  }

  it('counts as ready before the first check when Claude Code was found', () => {
    expect(setup().r.isReady()).toBe(true)
    expect(setup({ path: null }).r.isReady()).toBe(false)
  })

  it('after a sign-in refusal the key answers for a minute, then Claude Code gets another try', async () => {
    // `claude auth status` can say "signed in" for a token Claude rejects, so it isn't asked here.
    const t = setup({ status: { installed: true, loggedIn: true } })
    t.r.authFailed()
    expect(t.r.isReady()).toBe(false)
    await t.r.recheckIfStale()
    expect(t.statusCalls()).toBe(0)
    t.tick(59000)
    expect(t.r.isReady()).toBe(false)
    t.tick(1000)
    expect(t.r.isReady()).toBe(true)
  })

  it('looks again in the background when Claude Code was not signed in, every 30 s', async () => {
    const status = { installed: true, loggedIn: false }
    const t = setup({ status })
    t.r.note(status)
    expect(t.r.isReady()).toBe(false)
    await t.r.recheckIfStale()
    expect(t.statusCalls()).toBe(0)
    status.loggedIn = true
    t.tick(30000)
    await t.r.recheckIfStale()
    expect(t.statusCalls()).toBe(1)
    expect(t.r.isReady()).toBe(true)
  })

  it('finds Claude Code installed while Promptly was open, looking only every 5 minutes', async () => {
    const t = setup({ path: null, resolved: '/opt/claude' })
    t.r.note({ installed: false, loggedIn: false })
    t.tick(60000)
    await t.r.recheckIfStale()
    expect(t.path()).toBe(null)
    t.tick(240000)
    await t.r.recheckIfStale()
    expect(t.path()).toBe('/opt/claude')
    expect(t.r.isReady()).toBe(true)
  })

  it('a broken Claude Code is not ready until a check says otherwise', async () => {
    const t = setup()
    t.r.notReady()
    expect(t.r.isReady()).toBe(false)
    t.r.working()
    expect(t.r.isReady()).toBe(true)
  })

  it('checks nothing while Claude Code is ready, and runs one check for calls that arrive together', async () => {
    const t = setup({ status: { installed: true, loggedIn: false } })
    await t.r.recheckIfStale()
    expect(t.statusCalls()).toBe(0)
    t.r.note({ installed: false })
    t.tick(30000)
    await Promise.all([t.r.recheckIfStale(), t.r.recheckIfStale(), t.r.recheckIfStale()])
    expect(t.statusCalls()).toBe(1)
  })
})

