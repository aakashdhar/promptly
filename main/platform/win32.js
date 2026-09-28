'use strict';

// Everything that knows where Windows keeps things — the same exports as darwin.js.
// Placeholders for now: binary lookup lands in WIN-002, uninstall in WIN-024 and
// scheduled harnesses in phase 2. Each one answers "nothing here" so callers take the
// same paths they take on a Mac that's missing a tool.

const NOT_YET = { ok: false, error: 'Not on Windows yet' };

const PATH_DELIMITER = ';';
const DEFAULT_PATH = '';

function binaryCandidates() {
  return [];
}

function nodeVersionBinDirs() {
  return [];
}

function isShim() {
  return false;
}

async function shellWhich() {
  return null;
}

async function resolveShim(_name, shimPath) {
  return shimPath;
}

async function hasPythonWhisperModule() {
  return false;
}

function whisperPathDirs() {
  return [];
}

// Windows Python uses the system certificate store; nothing to point it at.
const SSL_ENV = {};

function whisperModelCacheDirs() {
  return [];
}

function uninstallDataPaths() {
  return [];
}

async function resetMicrophonePermission() {
  return { ok: false };
}

function appBundlePath() {
  return null;
}

function uninstallScriptPath() {
  return null;
}

async function removeInstalledApp() {
  return NOT_YET;
}

// Settings pages Promptly sends people to. Windows has no Accessibility permission.
const PRIVACY_SETTINGS = {
  accessibility: null,
  microphone: 'ms-settings:privacy-microphone',
};

// ── Scheduled harnesses (Task Scheduler, phase 2) ──

const SCHEDULE_PATH = '';

function launchAgentsDir() {
  return null;
}

async function loadLaunchAgent() {
  return NOT_YET;
}

// Nothing was scheduled, so there's nothing to stop.
async function unloadLaunchAgent() {
  return { ok: true };
}

function harnessLaunchAgents() {
  return [];
}

module.exports = {
  PRIVACY_SETTINGS,
  SCHEDULE_PATH,
  launchAgentsDir,
  loadLaunchAgent,
  unloadLaunchAgent,
  harnessLaunchAgents,
  PATH_DELIMITER,
  DEFAULT_PATH,
  SSL_ENV,
  binaryCandidates,
  nodeVersionBinDirs,
  isShim,
  shellWhich,
  resolveShim,
  hasPythonWhisperModule,
  whisperPathDirs,
  whisperModelCacheDirs,
  uninstallDataPaths,
  resetMicrophonePermission,
  appBundlePath,
  uninstallScriptPath,
  removeInstalledApp,
};
