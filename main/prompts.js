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

function buildModePrompt(transcript, modeKey, options = {}) {
  const mode = getMode(modeKey);
  if (mode.kind === 'standalone') {
    const tone = options.tone || 'formal';
    return fillTemplate(loadPrompt(mode.key), {
      TRANSCRIPT: transcript,
      TONE: tone.charAt(0).toUpperCase() + tone.slice(1),
    });
  }
  return fillTemplate(loadPrompt('template'), {
    MODE_NAME: mode.promptName,
    MODE_INSTRUCTION: mode.instruction,
    TRANSCRIPT: transcript,
  });
}

function buildEvalPrompt(transcript, prompt) {
  return fillTemplate(loadPrompt('eval'), { TRANSCRIPT: transcript, PROMPT: prompt });
}

module.exports = { MODES, fillTemplate, getMode, loadPrompt, buildModePrompt, buildEvalPrompt };
