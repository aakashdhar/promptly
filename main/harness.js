'use strict';

const fs = require('fs');
const path = require('path');
const { loadPrompt, fillTemplate } = require('./prompts');
const { parseJsonOutput } = require('./llm');

// Harness mode: a spoken job becomes a plan (a loop or a pipeline the user can check), then the
// files that run it with Claude Code. Claude writes both; this module builds the requests, checks
// what comes back, and saves the files into a project without clobbering what's there.

const text = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const STOP_KINDS = new Set(['done', 'stuck', 'limit']);

function buildPlanPrompt(transcript, context = '') {
  return fillTemplate(loadPrompt('harness-plan'), { TRANSCRIPT: transcript, CONTEXT: context });
}

function buildFilesPrompt({ transcript, plan, answers = {} }) {
  const lines = (plan.gaps || []).map((g) => `${g.label}: ${text(answers[g.id], 300) || '(no answer)'}`);
  return fillTemplate(loadPrompt('harness-files'), {
    PLAN: JSON.stringify(plan, null, 2),
    ANSWERS: lines.length ? lines.join('\n') : '(the plan had no gaps)',
    TRANSCRIPT: transcript,
  });
}

// Keeps only what the plan view can show; anything malformed is dropped rather than rendered.
function parsePlan(raw) {
  let data;
  try { data = parseJsonOutput(String(raw || '')); } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  const steps = list(data.steps, 6)
    .map((s) => ({
      title: text(s?.title, 40),
      detail: text(s?.detail, 120),
      runs: s?.runs === 'once' ? 'once' : 'each pass',
      parallel: Math.min(8, Math.max(1, Math.round(Number(s?.parallel) || 1))),
    }))
    .filter((s) => s.title);
  if (steps.length < 2) return null;
  const seen = new Set();
  const gaps = list(data.gaps, 4)
    .map((g, i) => ({ id: text(g?.id, 40).replace(/[^\w-]/g, '_') || `gap_${i + 1}`, label: text(g?.label, 40), example: text(g?.example, 80) }))
    .filter((g) => g.label && !seen.has(g.id) && seen.add(g.id));
  return {
    name: text(data.name, 60) || 'Harness',
    shape: data.shape === 'pipeline' ? 'pipeline' : 'loop',
    summary: text(data.summary, 240),
    goal: text(data.goal, 240),
    steps,
    checks: list(data.checks, 6).map((c) => ({ name: text(c?.name, 40), command: text(c?.command, 160) })).filter((c) => c.name),
    stopWhen: list(data.stopWhen, 5).map((s) => ({ kind: STOP_KINDS.has(s?.kind) ? s.kind : 'limit', text: text(s?.text, 120) })).filter((s) => s.text),
    never: list(data.never, 6).map((n) => text(n, 120)).filter(Boolean),
    onFailure: text(data.onFailure, 200),
    roles: list(data.roles, 4).map((r) => ({ name: text(r?.name, 40), job: text(r?.job, 120) })).filter((r) => r.name),
    gaps,
    schedule: text(data.schedule, 80),
  };
}

// A path the harness may write: relative, inside the project, no parent-directory hops.
function safeRelativePath(p) {
  const s = String(p || '').trim().replace(/\\/g, '/');
  if (!s || s.startsWith('/') || s.startsWith('~') || /^[a-z]:/i.test(s)) return null;
  const norm = path.posix.normalize(s);
  if (norm === '.' || norm.startsWith('..') || norm.split('/').includes('..')) return null;
  return norm;
}

// "RUN: …" then "=== FILE path ===", "PURPOSE: …", the body, "=== END ===" for each file.
function parseFiles(raw) {
  const src = String(raw || '').replace(/\r\n/g, '\n');
  const run = (src.match(/^RUN:\s*(.+)$/m) || [])[1]?.trim() || '';
  const files = [];
  const seen = new Set();
  const re = /^=== FILE (.+?) ===\n(?:PURPOSE:\s*(.*)\n)?([\s\S]*?)^=== END ===$/gm;
  let m;
  while ((m = re.exec(src)) && files.length < 16) {
    const filePath = safeRelativePath(m[1]);
    if (!filePath || seen.has(filePath)) continue;
    seen.add(filePath);
    files.push({ path: filePath, purpose: text(m[2] || '', 60), content: m[3].replace(/\n$/, '') + '\n' });
  }
  return files.length ? { run: run.slice(0, 200), files } : null;
}

// While Claude writes: the files finished so far, and the one being written.
function progressText(raw) {
  const src = String(raw || '')
  const started = [...src.matchAll(/^=== FILE (.+?) ===$/gm)].map((m) => m[1].trim())
  const done = (src.match(/^=== END ===$/gm) || []).length
  return started.map((p, i) => (i < done ? `✓ ${p}` : `Writing ${p}…`)).join('\n')
}

// Everything in one block of text, for history and "Copy all".
function bundleFiles({ run, files }) {
  return [run ? `Run it with: ${run}` : '', ...files.map((f) => `=== ${f.path} ===\n${f.content}`)].filter(Boolean).join('\n\n');
}

// Adds the harness's hooks to settings the project already has, instead of replacing them.
function mergeSettings(existingText, incomingText) {
  let existing;
  let incoming;
  try { existing = JSON.parse(existingText); } catch { return null; }
  try { incoming = JSON.parse(incomingText); } catch { return null; }
  if (!existing || typeof existing !== 'object' || !incoming || typeof incoming !== 'object') return null;
  const merged = { ...existing, ...incoming, hooks: { ...(existing.hooks || {}) } };
  for (const [event, entries] of Object.entries(incoming.hooks || {})) {
    merged.hooks[event] = [...(existing.hooks?.[event] || []), ...(Array.isArray(entries) ? entries : [])];
  }
  if (!Object.keys(merged.hooks).length) delete merged.hooks;
  return JSON.stringify(merged, null, 2) + '\n';
}

// What saving would do: files that already exist (to confirm before replacing them).
function existingFiles(dir, files) {
  return files.filter((f) => {
    const target = safeRelativePath(f.path);
    return target && f.path !== '.claude/settings.json' && fs.existsSync(path.join(dir, target));
  }).map((f) => f.path);
}

function writeFiles(dir, files) {
  const written = [];
  for (const f of files) {
    const rel = safeRelativePath(f.path);
    if (!rel) continue;
    const target = path.resolve(dir, rel);
    if (!target.startsWith(path.resolve(dir) + path.sep)) continue;
    let content = String(f.content || '');
    if (rel === '.claude/settings.json' && fs.existsSync(target)) {
      const merged = mergeSettings(fs.readFileSync(target, 'utf8'), content);
      if (!merged) continue; // unreadable settings: leave the user's file alone
      content = merged;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, { mode: /\.sh$/.test(rel) || content.startsWith('#!') ? 0o755 : 0o644 });
    if (/\.sh$/.test(rel) || content.startsWith('#!')) fs.chmodSync(target, 0o755);
    written.push(rel);
  }
  return written;
}

module.exports = { buildPlanPrompt, buildFilesPrompt, parsePlan, parseFiles, progressText, safeRelativePath, bundleFiles, mergeSettings, existingFiles, writeFiles };
