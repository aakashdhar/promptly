'use strict';

const fs = require('fs');
const path = require('path');
const MODES = require('../shared/modes.json');

const PROMPTS_DIR = path.join(__dirname, 'prompts');
const cache = new Map();

function loadPrompt(name) {
  if (!cache.has(name)) {
    cache.set(name, fs.readFileSync(path.join(PROMPTS_DIR, `${name}.txt`), 'utf8').replace(/\n$/, ''));
  }
  return cache.get(name);
}

// Fills every {KEY} placeholder in one pass. A function replacer keeps `$&`, `$'` etc.
// in user text literal, and a single pass means text inserted for one key is never
// scanned for another key's placeholder.
function fillTemplate(template, values) {
  const keys = Object.keys(values);
  if (!keys.length) return template;
  const pattern = new RegExp(`\\{(${keys.join('|')})\\}`, 'g');
  return template.replace(pattern, (_match, key) => String(values[key]));
}

function getMode(key) {
  return MODES.modes.find((m) => m.key === key) || MODES.modes.find((m) => m.key === MODES.defaultMode);
}

// Where the prompt will be used, from the app that was in front when recording started.
const DESTINATIONS = [
  {
    key: 'agent',
    label: 'an AI coding agent',
    match: /^(com\.apple\.Terminal|com\.googlecode\.iterm2|dev\.warp\.Warp-Stable|com\.mitchellh\.ghostty|net\.kovidgoyal\.kitty|io\.alacritty|com\.microsoft\.VSCode.*|com\.todesktop\.230313mzl4w4u92|com\.exafunction\.windsurf|dev\.zed\.Zed.*|com\.jetbrains\..*|com\.apple\.dt\.Xcode)$/,
    guidance: 'It will be pasted into an AI coding agent (such as Claude Code) working in a code repository. Frame it as a concrete engineering task with clear acceptance criteria, and keep any files, commands or constraints the user mentioned.',
  },
  {
    key: 'chat',
    label: 'a chat assistant',
    match: /^(com\.apple\.Safari|com\.google\.Chrome.*|company\.thebrowser\.Browser|org\.mozilla\.firefox|com\.brave\.Browser|com\.microsoft\.edgemac|com\.anthropic\.claudefordesktop|com\.openai\.chat)$/,
    guidance: 'It will be pasted into a chat assistant such as claude.ai. Make it self-contained, with all needed context stated up front.',
  },
  {
    key: 'design',
    label: 'a design tool',
    match: /^com\.figma\.Desktop$/,
    guidance: 'It will be used for design work. Emphasise visual intent, layout, states and constraints.',
  },
  {
    key: 'writing',
    label: 'a writing or messaging app',
    match: /^(notion\.id|com\.apple\.Notes|com\.apple\.iWork\.Pages|com\.microsoft\.Word|com\.tinyspeck\.slackmacgap|com\.apple\.mail|md\.obsidian)$/,
    guidance: 'It will be used for writing. Focus on audience, tone and structure.',
  },
];

function destinationFor(bundleId) {
  if (!bundleId) return null;
  return DESTINATIONS.find((d) => d.match.test(bundleId)) || null;
}

// Extra context placed just before the transcript: where the prompt is going (template modes
// only), the user's own notes (how they write, or about them), text they selected, and words
// to spell exactly. Empty when there is none, so
// prompts without context are unchanged.
function buildContextBlock(mode, context = {}) {
  const parts = [];
  const destination = mode.kind === 'template' ? destinationFor(context.bundleId) : null;
  if (destination) parts.push(`Where this prompt will be used: ${destination.guidance}`);
  if (context.voiceNotes) {
    parts.push(`Write it the way this user writes. Their own notes on their style:\n<how_i_write>\n${context.voiceNotes}\n</how_i_write>\nFollow these unless the user asks for something different this time.`);
  }
  if (context.aboutMe) {
    parts.push(`About the user (use what's relevant to this request, ignore the rest):\n<about_me>\n${context.aboutMe}\n</about_me>`);
  }
  if (context.selectedText) {
    const where = context.appName ? ` in ${context.appName}` : '';
    parts.push(`The user has selected this text${where} and is talking about it. Treat it as the material to work on:\n<selected_text>\n${context.selectedText}\n</selected_text>`);
  }
  if (context.otherLanguages) {
    parts.push('The user may speak in Hindi or another language, or mix it with English, so the transcript can be in any script. Understand it fully and write the result in English unless they ask for a different language.');
  }
  const words = (context.dictionary || []).filter(Boolean);
  if (words.length) parts.push(`Spell these names and terms exactly as written: ${words.join(', ')}.`);
  return parts.length ? parts.join('\n\n') + '\n\n' : '';
}

function buildModePrompt(transcript, modeKey, options = {}) {
  const mode = getMode(modeKey);
  const context = buildContextBlock(mode, options.context);
  if (mode.kind === 'standalone') {
    const tone = options.tone || 'formal';
    return fillTemplate(loadPrompt(mode.key), {
      TRANSCRIPT: transcript,
      TONE: tone.charAt(0).toUpperCase() + tone.slice(1),
      CONTEXT: context,
    });
  }
  return fillTemplate(loadPrompt('template'), {
    MODE_NAME: mode.promptName,
    MODE_INSTRUCTION: mode.instruction,
    TRANSCRIPT: transcript,
    CONTEXT: context,
  });
}

// Asks Claude to draft "How you write" notes from writing samples or from the user's edits.
function buildLearnStylePrompt({ current = '', samples = '', edits = '' } = {}) {
  const material = samples
    ? `Things the user wrote:\n<samples>\n${samples}\n</samples>`
    : `Results an assistant wrote for the user, and how the user edited them before using them. The edits show what the user prefers:\n${edits}`;
  return fillTemplate(loadPrompt('learn-style'), {
    CURRENT: current ? `Current notes:\n<current_notes>\n${current}\n</current_notes>\n\n` : '',
    MATERIAL: material,
  });
}

function buildEvalPrompt(transcript, prompt) {
  return fillTemplate(loadPrompt('eval'), { TRANSCRIPT: transcript, PROMPT: prompt });
}

module.exports = { MODES, DESTINATIONS, fillTemplate, getMode, loadPrompt, buildModePrompt, buildEvalPrompt, buildLearnStylePrompt, destinationFor, buildContextBlock };
