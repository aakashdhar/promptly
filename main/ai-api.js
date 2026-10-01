'use strict';

// Runs a prompt on the user's own API key (D-AI-PROVIDERS): OpenAI, Gemini or Grok, all through
// the OpenAI chat-completions format with the global fetch — no SDKs. Results have the same shape
// as the Claude runner's ({ success, prompt, error, errorType, … }) plus `provider`, so callers
// don't care which one answered. The key is only ever read here and never logged.

const { PROVIDERS } = require('./ai-providers');

// The same instruction the Claude runner gives Claude Code in place of its agent prompt.
const SYSTEM_PROMPT = "Follow the user's instructions exactly and output only what they ask for.";
const MAX_TOKENS = 16384;

function providerLabel(id) {
  return PROVIDERS[id]?.label || 'The AI provider';
}

function errorFor(providerId, status, detail = '') {
  const p = providerLabel(providerId);
  if (status === 401 || status === 403) return { errorType: 'auth', error: `Your ${p} key was refused. Check it in Settings › AI.` };
  if (status === 429) return { errorType: 'rate', error: `${p} says you've hit a rate or usage limit. Try again in a minute.` };
  if (status === 404) return { errorType: 'unknown', error: `${p} doesn't know that model. Pick another in Settings › AI.` };
  return { errorType: 'unknown', error: `${p} returned an error${status ? ` (${status})` : ''}${detail ? `: ${detail}` : ''}` };
}

async function readError(res) {
  try {
    const body = await res.json();
    const e = Array.isArray(body) ? body[0]?.error : body?.error;
    return String(e?.message || body?.message || '').slice(0, 200);
  } catch { return ''; }
}

// Reads a text/event-stream body: "data: {json}" lines, ending with "data: [DONE]".
async function readStream(res, onDelta) {
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  const handle = (line) => {
    const m = /^data:\s?(.*)$/.exec(line.trim());
    if (!m || m[1] === '[DONE]') return;
    let event;
    try { event = JSON.parse(m[1]); } catch { return; }
    const delta = event.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) {
      text += delta;
      onDelta(text);
    }
  };
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      handle(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) handle(buffer);
  return text;
}

function messageText(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => c?.text || '').join('');
  return '';
}

// getSettings() → { provider, key, model, fastModel } or null when no key is saved.
function createApiRunner({ getSettings, fetchImpl }) {
  fetchImpl = fetchImpl || ((...a) => globalThis.fetch(...a));
  const controllers = new Set();
  const cancelledByUs = new WeakSet();

  async function run(prompt, { timeoutMs = 45000, onDelta, fast = false } = {}) {
    const settings = getSettings();
    // Tagged as an API result (never null), so the window never shows Claude sign-in advice for it.
    if (!settings || !settings.key) return { success: false, error: 'No API key saved. Add one in Settings › AI, or choose Claude Code there.', errorType: 'no-key', provider: settings?.provider || 'api' };
    const { provider: providerId, key } = settings;
    const provider = PROVIDERS[providerId];
    if (!provider) return { success: false, error: 'Unknown AI provider. Pick one in Settings › AI.', errorType: 'unknown', provider: providerId };
    const model = (fast && settings.fastModel) || settings.model;
    if (!model) return { success: false, error: `Pick a ${provider.label} model in Settings › AI.`, errorType: 'unknown', provider: providerId };

    const streaming = typeof onDelta === 'function';
    const controller = new AbortController();
    controllers.add(controller);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const done = (result) => { clearTimeout(timer); controllers.delete(controller); return { ...result, provider: providerId, model }; };

    try {
      const res = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
          [provider.maxTokensField]: MAX_TOKENS,
          ...(streaming && { stream: true }),
        }),
        signal: controller.signal,
      });
      if (!res.ok) return done({ success: false, ...errorFor(providerId, res.status, await readError(res)) });
      const isStream = streaming && /event-stream/i.test(res.headers.get('content-type') || '');
      const text = (isStream ? await readStream(res, onDelta) : messageText(await res.json())).trim();
      if (!text) return done({ success: false, error: `${provider.label} returned an empty response — try again`, errorType: 'empty' });
      return done({ success: true, prompt: text });
    } catch (err) {
      if (timedOut) return done({ success: false, error: `${provider.label} took too long — try again`, timedOut: true, errorType: 'timeout' });
      if (cancelledByUs.has(controller) || err?.name === 'AbortError') return done({ success: false, error: 'Cancelled', errorType: 'cancelled', cancelled: true });
      return done({ success: false, error: `Couldn't reach ${provider.label}. Check your connection.`, errorType: 'offline' });
    }
  }

  function cancelAll() {
    for (const c of controllers) { cancelledByUs.add(c); c.abort(); }
    controllers.clear();
  }

  return { run, cancelAll };
}

// The provider's model ids, checking the key at the same time.
async function listModels(providerId, key, { fetchImpl, timeoutMs = 15000 } = {}) {
  fetchImpl = fetchImpl || ((...a) => globalThis.fetch(...a));
  const provider = PROVIDERS[providerId];
  if (!provider) return { ok: false, error: 'Unknown AI provider.', errorType: 'unknown' };
  if (!key) return { ok: false, error: `Paste your ${provider.label} key first.`, errorType: 'auth' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${provider.baseUrl}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: controller.signal });
    if (!res.ok) return { ok: false, ...errorFor(providerId, res.status, await readError(res)) };
    const body = await res.json();
    const models = (body?.data || body?.models || []).map((m) => (typeof m === 'string' ? m : m?.id || m?.name)).filter(Boolean);
    return { ok: true, models };
  } catch {
    return { ok: false, error: `Couldn't reach ${provider.label}. Check your connection.`, errorType: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { createApiRunner, listModels, errorFor, SYSTEM_PROMPT };
