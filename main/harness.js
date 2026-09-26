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
  const schedule = parseSchedule((src.match(/^SCHEDULE:\s*(.+)$/m) || [])[1]);
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
  return files.length ? { run: run.slice(0, 200), schedule, files } : null;
}

// ── Schedule ──
// A schedule is { every: 'day' | 'weekday' | 'week' | 'hour', time: 'HH:MM', day: 0-6 (Sunday = 0, weeks only) }.
// Claude writes it as one line ("daily 02:00", "weekdays 09:30", "weekly mon 02:00", "hourly :15", "none");
// the user can change it before it's installed.

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EVERY = new Set(['day', 'weekday', 'week', 'hour']);

function cleanTime(t) {
  const m = String(t || '').match(/^(\d{1,2})?:(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1] || 0);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
}

function parseSchedule(line) {
  const words = String(line || '').trim().toLowerCase().split(/\s+/);
  const [kind] = words;
  if (kind === 'daily' || kind === 'weekdays') {
    const time = cleanTime(words[1]);
    return time ? { every: kind === 'daily' ? 'day' : 'weekday', time } : null;
  }
  if (kind === 'weekly') {
    const day = DAYS.indexOf(String(words[1] || '').slice(0, 3));
    const time = cleanTime(words[2]);
    return day >= 0 && time ? { every: 'week', day, time } : null;
  }
  if (kind === 'hourly') return { every: 'hour', time: cleanTime(words[1]) || '00:00' };
  return null;
}

// A schedule from the window, checked again before anything is installed.
function checkSchedule(s) {
  if (!s || !EVERY.has(s.every)) return null;
  const time = cleanTime(s.time);
  if (!time) return null;
  if (s.every === 'week') {
    const day = Number(s.day);
    return Number.isInteger(day) && day >= 0 && day < 7 ? { every: 'week', day, time } : null;
  }
  return { every: s.every, time };
}

function scheduleLabel(s) {
  if (!s) return '';
  if (s.every === 'hour') return s.time.endsWith(':00') ? 'every hour' : `every hour at :${s.time.slice(3)}`;
  if (s.every === 'week') return `every ${DAY_NAMES[s.day]} at ${s.time}`;
  return `${s.every === 'day' ? 'every day' : 'weekdays'} at ${s.time}`;
}

// launchd's StartCalendarInterval entries for a schedule.
function calendarIntervals(s) {
  const [h, m] = s.time.split(':').map(Number);
  if (s.every === 'hour') return [{ Minute: m }];
  if (s.every === 'weekday') return [1, 2, 3, 4, 5].map((d) => ({ Weekday: d, Hour: h, Minute: m }));
  if (s.every === 'week') return [{ Weekday: s.day, Hour: h, Minute: m }];
  return [{ Hour: h, Minute: m }];
}

// One launchd job per project folder, so scheduling again replaces it.
function agentLabel(dir) {
  const slug = path.basename(dir).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project';
  const hash = require('crypto').createHash('sha1').update(path.resolve(dir)).digest('hex').slice(0, 8);
  return `com.promptly.harness.${slug}-${hash}`;
}

const xml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The launchd job: runs the harness's own command from the project folder, output to .harness/schedule.log.
function launchAgentPlist({ label, dir, run, schedule, pathEnv }) {
  const dict = (o) => `<dict>${Object.entries(o).map(([k, v]) => `<key>${k}</key><integer>${v}</integer>`).join('')}</dict>`;
  const log = path.join(dir, '.harness', 'schedule.log');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${xml(label)}</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>-c</string><string>${xml(run)}</string></array>
  <key>WorkingDirectory</key><string>${xml(dir)}</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${xml(pathEnv)}</string></dict>
  <key>StartCalendarInterval</key>
  <array>${calendarIntervals(schedule).map(dict).join('')}</array>
  <key>StandardOutPath</key><string>${xml(log)}</string>
  <key>StandardErrorPath</key><string>${xml(log)}</string>
</dict>
</plist>
`;
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

module.exports = { buildPlanPrompt, buildFilesPrompt, parsePlan, parseFiles, progressText, safeRelativePath, bundleFiles, mergeSettings, existingFiles, writeFiles, parseSchedule, checkSchedule, scheduleLabel, calendarIntervals, agentLabel, launchAgentPlist };
