'use strict';

// The API providers a user can bring their own key for (D-AI-PROVIDERS). All three speak the
// OpenAI chat-completions format, so one client (main/ai-api.js) serves them. Claude Code is not
// here: it stays the default and runs through the CLI (main/llm.js).

const PROVIDERS = {
  openai: {
    id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1',
    keysUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…',
    chat: /^(gpt-|o\d)/i,
    // Reasoning models (o-series, gpt-5) reject max_tokens.
    maxTokensField: 'max_completion_tokens',
  },
  gemini: {
    id: 'gemini', label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keysUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza…',
    chat: /^gemini-/i,
    maxTokensField: 'max_tokens',
  },
  grok: {
    id: 'grok', label: 'Grok', baseUrl: 'https://api.x.ai/v1',
    keysUrl: 'https://console.x.ai', keyHint: 'xai-…',
    chat: /^grok-/i,
    maxTokensField: 'max_tokens',
  },
};

const PROVIDER_IDS = Object.keys(PROVIDERS);

// Not chat models, or not ones that take a plain chat request.
const NOT_CHAT = /(embed|audio|image|tts|realtime|search|transcribe|preview|exp\b|-exp|moderation|dall-e|whisper|codex|research|instruct|davinci|babbage|computer-use|vision)/i;
// The small, quick ones — used for the Dictation clean-up.
// Whole words between dashes: "gemini" contains "mini" but isn't a small model.
const FAST = /(^|[-.])(mini|nano|flash|lite|fast)(?=[-.]|$)/i;

// Gemini lists its models as "models/gemini-…".
function normaliseModelId(id) {
  return String(id || '').replace(/^models\//, '').trim();
}

// Version numbers in an id, ignoring dated snapshots ("-2024-08-06", "-0613", "-002"), so
// "gpt-5.1" outranks "gpt-5" and an alias outranks its own dated copy.
function versionOf(id) {
  const core = id.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-\d{3,4}$/, '');
  return (core.match(/\d+/g) || []).map(Number);
}

function compareIds(a, b) {
  const va = versionOf(a), vb = versionOf(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (vb[i] ?? -1) - (va[i] ?? -1);
    if (d) return d;
  }
  // Same version: the plain alias (shorter id) first.
  return a.length - b.length || a.localeCompare(b);
}

// The provider's chat models, best first, and the two picks: the best general model and the best
// fast one. Model names change often, so this works from the list rather than from known names.
function pickModels(ids, providerId) {
  const provider = PROVIDERS[providerId];
  const all = [...new Set((ids || []).map(normaliseModelId).filter(Boolean))];
  const chat = all.filter((id) => (!provider || provider.chat.test(id)) && !NOT_CHAT.test(id)).sort(compareIds);
  const full = chat.filter((id) => !FAST.test(id));
  const fast = chat.filter((id) => FAST.test(id));
  const model = full[0] || fast[0] || all[0] || '';
  const fastModel = fast[0] || full[0] || all[0] || '';
  return { models: chat.length ? chat : all, model, fastModel };
}

module.exports = { PROVIDERS, PROVIDER_IDS, normaliseModelId, pickModels };
