'use strict';

// Scheduled harnesses behind one interface, so main.js never knows which system it's on:
//   labelFor(dir)                                  the job's stable name for a project folder
//   install({ label, dir, run, schedule, pathEnv }) → { ok, error?, refused? }  (replaces the old job)
//   remove(label)                                  → { ok, error?, refused? }  (a missing job counts as removed)
//   has(label)                                     → Promise<boolean>
//   list()                                         → Promise<[{ label }]>  every harness job, for uninstall
// `refused` means the system itself said no (launchctl / schtasks), so the caller can say
// "macOS didn't accept…" rather than showing a file error.
//
// macOS: today's launchd plist (harness.launchAgentPlist) in LaunchAgents, loaded with launchctl
// through darwin.js — unchanged. Windows: a Task Scheduler task created with schtasks, every value
// its own execFile argument (never a shell string).

const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const posixPath = require('path');
const winPath = require('path').win32;

// ── macOS: launchd ──

function launchdScheduler({ agentsDir, dryRun = false, launchd, fsImpl = fs, harness = require('../harness') }) {
  const plistPath = (label) => posixPath.join(agentsDir, `${label}.plist`);
  return {
    systemName: 'macOS',
    labelFor: (dir) => harness.agentLabel(dir),
    async install({ label, dir, run, schedule, pathEnv }) {
      const file = plistPath(label);
      try {
        fsImpl.mkdirSync(posixPath.dirname(file), { recursive: true });
        // launchd won't create the log's folder, and without it every scheduled run's output is lost.
        fsImpl.mkdirSync(posixPath.join(dir, '.harness'), { recursive: true });
        fsImpl.writeFileSync(file, harness.launchAgentPlist({ label, dir, run, schedule, pathEnv }));
      } catch (err) {
        return { ok: false, error: err.message };
      }
      // Tests keep the plist in their throwaway profile and never load it.
      const loaded = dryRun ? { ok: true } : await launchd.loadLaunchAgent(file, label);
      return loaded.ok ? { ok: true } : { ok: false, error: loaded.error, refused: true };
    },
    async remove(label) {
      const unloaded = dryRun ? { ok: true } : await launchd.unloadLaunchAgent(label);
      // Keep the plist while the job may still be loaded, so a retry can find and stop it.
      if (!unloaded.ok) return { ok: false, error: unloaded.error, refused: true };
      try { fsImpl.rmSync(plistPath(label), { force: true }); } catch (err) { return { ok: false, error: err.message }; }
      return { ok: true };
    },
    async has(label) {
      return fsImpl.existsSync(plistPath(label));
    },
    async list() {
      return launchd.harnessLaunchAgents(null, agentsDir).map(({ label }) => ({ label }));
    },
  };
}

// ── Windows: Task Scheduler ──

// Task names stay ASCII: schtasks prints its task list in the console's code page, so a name with
// "—" or "ë" in it would come back mangled from /Query and uninstall couldn't find it to delete.
const TASK_PREFIX = 'Promptly Harness - ';
const TASK_NAME = /^\\?(Promptly Harness - .* \([0-9a-f]{8}\))$/;
// schtasks refuses a /TR longer than this.
const MAX_TASK_RUN = 261;
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// One task per project folder (so scheduling again replaces it): the folder's name for people,
// a hash of its full path so two folders with the same name don't collide. Windows paths ignore
// case, so the hash does too.
function taskName(dir) {
  const full = winPath.resolve(dir);
  const folder = winPath.basename(full).replace(/[^A-Za-z0-9 ._-]+/g, '_').trim().slice(0, 40).trim() || 'project';
  const hash = crypto.createHash('sha1').update(full.toLowerCase()).digest('hex').slice(0, 8);
  return `${TASK_PREFIX}${folder} (${hash})`;
}

// One argument as Windows programs read their command line (the C runtime's rules, which
// powershell.exe follows): quoted when it has a space or quote, backslashes doubled only where
// they come before a quote. Apostrophes and letters like ë need nothing here — -File takes the
// path literally, never through the PowerShell parser.
function quoteArg(arg) {
  const s = String(arg);
  if (s && !/[\s"]/.test(s)) return s;
  return `"${s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
}

// /TR is necessarily one command-line string: Task Scheduler splits it into program and arguments
// itself. It only ever holds fixed flags and the runner script's path, each quoted by quoteArg.
function taskRunLine(script) {
  return ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script]
    .map(quoteArg).join(' ');
}

// The schedule's trigger flags. Mac shapes: every day, weekdays, one day a week, every hour at :MM.
function triggerArgs(schedule) {
  const { every, time } = schedule;
  if (every === 'hour') return ['/SC', 'HOURLY', '/MO', '1', '/ST', time];
  if (every === 'weekday') return ['/SC', 'WEEKLY', '/D', 'MON,TUE,WED,THU,FRI', '/ST', time];
  if (every === 'week') return ['/SC', 'WEEKLY', '/D', WEEKDAYS[schedule.day], '/ST', time];
  return ['/SC', 'DAILY', '/ST', time];
}

// /F replaces a task with the same name, which is what makes rescheduling a replace.
function createArgs({ name, script, schedule }) {
  const tr = taskRunLine(script);
  if (tr.length > MAX_TASK_RUN) return null;
  return ['/Create', '/F', '/TN', name, '/TR', tr, ...triggerArgs(schedule)];
}

const deleteArgs = (name) => ['/Delete', '/F', '/TN', name];
const queryArgs = (name) => ['/Query', '/TN', name];
// CSV rather than /XML: the first column is the task's path in every language, one line per task,
// where /XML would print every task's whole definition. /NH drops the header lines, which are
// translated.
const LIST_ARGS = ['/Query', '/FO', 'CSV', '/NH'];

// The Promptly harness tasks in `schtasks /Query /FO CSV /NH` output, without the leading "\".
function parseTaskList(stdout) {
  const names = new Set();
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const m = line.match(/^"((?:[^"]|"")*)"/);
    const name = m && m[1].replace(/""/g, '"').match(TASK_NAME);
    if (name) names.add(name[1]);
  }
  return [...names];
}

// A PowerShell single-quoted string. PowerShell also reads the curly quotes ‘ ’ ‚ ‛ as single
// quotes, so those are doubled as well.
const psString = (s) => `'${String(s).replace(/['\u2018\u2019\u201A\u201B]/g, '$&$&')}'`;

// The script the task runs, saved as .harness\schedule.ps1: from the project folder, with Claude's
// folder on PATH, it runs the harness's own command and appends everything to .harness\schedule.log.
// The command stays a quoted string until Invoke-Expression, so nothing in it can change the
// script around it. UTF-8 with a BOM, because Windows PowerShell 5.1 reads a file without one in
// the ANSI code page and would mangle a path like C:\Users\Zoë.
function runnerScript({ run, pathEnv }) {
  return '\uFEFF' + [
    '# Written by Promptly when this harness was scheduled; Task Scheduler runs it. Scheduling again rewrites it.',
    "$ErrorActionPreference = 'Continue'",
    'Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)',
    pathEnv ? `$env:Path = ${psString(pathEnv)} + ';' + $env:Path` : '',
    "$log = Join-Path $PSScriptRoot 'schedule.log'",
    '"=== $(Get-Date -Format s) ===" | Out-File -LiteralPath $log -Append -Encoding utf8',
    `Invoke-Expression ${psString(run)} *>&1 | Out-File -LiteralPath $log -Append -Encoding utf8`,
    'exit $LASTEXITCODE',
  ].filter(Boolean).join('\r\n') + '\r\n';
}

function taskScheduler({ dryRun = false, run = execFile, fsImpl = fs }) {
  const schtasks = (args) => new Promise((resolve) => {
    run('schtasks.exe', args, { timeout: 15000, windowsHide: true }, (err, stdout, stderr) => {
      resolve(err ? { ok: false, error: String(stderr || err.message).trim() } : { ok: true, stdout: String(stdout || '') });
    });
  });
  const has = async (label) => (dryRun ? false : (await schtasks(queryArgs(label))).ok);
  return {
    systemName: 'Windows',
    labelFor: taskName,
    async install({ label, dir, run: command, schedule, pathEnv }) {
      const script = winPath.join(dir, '.harness', 'schedule.ps1');
      const args = createArgs({ name: label, script, schedule });
      if (!args) return { ok: false, error: 'The project folder’s path is too long for Task Scheduler. Save the harness to a folder with a shorter path.' };
      try {
        fsImpl.mkdirSync(winPath.dirname(script), { recursive: true });
        fsImpl.writeFileSync(script, runnerScript({ run: command, pathEnv }));
      } catch (err) {
        return { ok: false, error: err.message };
      }
      if (dryRun) return { ok: true };
      const created = await schtasks(args);
      return created.ok ? { ok: true } : { ok: false, error: created.error, refused: true };
    },
    // schtasks' "not found" message is translated, so ask first instead of reading the error.
    async remove(label) {
      if (!(await has(label))) return { ok: true };
      const deleted = await schtasks(deleteArgs(label));
      return deleted.ok ? { ok: true } : { ok: false, error: deleted.error, refused: true };
    },
    has,
    async list() {
      if (dryRun) return [];
      const listed = await schtasks(LIST_ARGS);
      return listed.ok ? parseTaskList(listed.stdout).map((label) => ({ label })) : [];
    },
  };
}

// kind is the platform module's HARNESS_SCHEDULER. agentsDir is where launchd plists go (tests
// point it into their profile); dryRun (tests) writes files but never loads or registers a job.
function createScheduler({ kind, agentsDir, dryRun = false, launchd = require('./darwin'), run = execFile, fsImpl = fs, harness } = {}) {
  if (kind === 'task-scheduler') return taskScheduler({ dryRun, run, fsImpl });
  return launchdScheduler({ agentsDir, dryRun, launchd, fsImpl, harness });
}

module.exports = {
  createScheduler,
  taskName,
  quoteArg,
  taskRunLine,
  createArgs,
  deleteArgs,
  queryArgs,
  LIST_ARGS,
  parseTaskList,
  runnerScript,
  MAX_TASK_RUN,
};
