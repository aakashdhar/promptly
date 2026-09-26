// End-to-end tests that drive the real Electron app with a fake `claude` CLI.
// Run with: npm run test:e2e (builds the renderer first).
import { test, expect, _electron as electron } from '@playwright/test'
import crypto from 'crypto'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname, '..')

// The fake CLI records its arguments and stdin, waits $FAKE_DIR/delay seconds if that
// file exists, then prints a prompt built from the last line of stdin (the transcript).
function writeFakeTools(dir) {
  const claude = path.join(dir, 'claude')
  fs.writeFileSync(claude, `#!/bin/bash
# Setup checks: version, and sign-in state (signed out while $FAKE_DIR/signed-out exists)
if [ "$1" = "--version" ]; then echo "9.9.9 (Claude Code)"; exit 0; fi
if [ "$1" = "auth" ]; then
  if [ -f "$FAKE_DIR/signed-out" ]; then echo '{"loggedIn": false}'; else echo '{"loggedIn": true}'; fi
  exit 0
fi
n=$(ls "$FAKE_DIR"/call-*.args 2>/dev/null | wc -l | tr -d ' ')
printf '%s\\n' "$@" > "$FAKE_DIR/call-$n.args"
input=$(cat)
printf '%s' "$input" > "$FAKE_DIR/call-$n.stdin"
if [ -f "$FAKE_DIR/fail" ]; then echo "simulated failure" >&2; exit 1; fi
[ -f "$FAKE_DIR/delay" ] && sleep "$(cat "$FAKE_DIR/delay")"
# Image builder phases get the JSON they ask for.
if printf '%s' "$input" | grep -q "Analyse the user's spoken image idea"; then
  printf '%s' '{"subject":{"subject":"Red fox","setting":"Snowy forest","emotion":"Calm","framing":"Close-up","negativePrompts":[]},"lighting":{"timeOfDay":"Golden hour","lightType":"Directional sun","quality":"Warm amber","lensFlare":"None"},"camera":{"lens":"85mm portrait","aperture":"f/1.4 shallow","aspectRatio":"4:5 portrait","angle":"Eye level","filmSim":"Kodak Portra 400"},"style":{"visualStyle":"Cinematic film still","colorGrade":"Warm teal-orange","filmGrain":"35mm grain","reference":"Emmanuel Lubezki"},"technical":{"resolution":"Ultra HD 4K","renderQuality":"Photorealistic","stylise":750,"chaos":20,"weird":0,"seed":null}}'
  exit 0
fi
if printf '%s' "$input" | grep -q "Generate exactly 3 distinct prompt variations"; then
  printf '%s' '{"variations":[{"id":1,"prompt":"A red fox in snow","focus":"natural"},{"id":2,"prompt":"A red fox, dramatic","focus":"editorial"},{"id":3,"prompt":"A red fox, cinematic","focus":"cinematic"}]}'
  exit 0
fi
if printf '%s' "$input" | grep -q "Assemble a final"; then
  [ -f "$FAKE_DIR/assemble-delay" ] && sleep "$(cat "$FAKE_DIR/assemble-delay")"
  printf '%s' '{"prompt":"A calm red fox in a snowy forest at golden hour, vertical 4:5 composition, photorealistic","flags":"--ar 4:5 --stylize 750 --chaos 20"}'
  exit 0
fi
if printf '%s' "$input" | grep -q "write short style notes"; then
  printf '%s' '- Short sentences
- Signs off with "Cheers, Sam"'
  exit 0
fi
# The request: a spoken change (Iterate), or the <transcript> of a prompt mode, or the last line.
tagged() { printf '%s' "$input" | awk -v t="$1" '$0 ~ "</" t ">" {f=0} f {print} $0 ~ "<" t ">" {f=1}' | tail -n 1; }
last=$(tagged requested_change)
[ -z "$last" ] && last=$(tagged transcript)
[ -z "$last" ] && last=$(printf '%s' "$input" | tail -n 1 | tr -d '"')
# Polish and Email answer in their own formats.
if printf '%s' "$input" | grep -q "expert email writer"; then
  node -e 'console.log(JSON.stringify({subject:"About "+process.argv[1],body:"Hi team,\\n\\n"+process.argv[1]+"\\n\\nThanks",toneAnalysis:{recipient:"Team",tone:"Friendly",coreMessage:process.argv[1],approach:"Direct",whyThisTone:"Internal"}}))' "$last"
  exit 0
fi
if printf '%s' "$input" | grep -q "n8n workflow engineer. Analyse"; then cat "$FAKE_DIR/workflow-analysis.json"; exit 0; fi
if printf '%s' "$input" | grep -q "Generate a complete, valid n8n workflow JSON"; then cat "$FAKE_DIR/workflow.json"; exit 0; fi
if printf '%s' "$input" | grep -q "POLISHED:"; then
  out=$(printf 'POLISHED:\\n%s (polished)\\n\\nCHANGES:\\n· Tidied the wording' "$last")
else
  out=$(printf 'Role:\\nYou are a test assistant.\\n\\nTask:\\n%s' "$last")
fi
if [[ " $* " == *" stream-json "* ]]; then
  # Stream in two halves so tests can watch text arrive.
  half=$(( \${#out} / 2 ))
  node -e 'console.log(JSON.stringify({type:"stream_event",event:{type:"content_block_delta",delta:{type:"text_delta",text:process.argv[1]}}}))' "\${out:0:$half}"
  [ -f "$FAKE_DIR/stream-pause" ] && sleep "$(cat "$FAKE_DIR/stream-pause")"
  node -e 'console.log(JSON.stringify({type:"stream_event",event:{type:"content_block_delta",delta:{type:"text_delta",text:process.argv[1]}}}))' "\${out:$half}"
  node -e 'console.log(JSON.stringify({type:"result",is_error:false,result:process.argv[1]}))' "$out"
else
  printf '%s\n' "$out"
fi
touch "$FAKE_DIR/call-$n.done"
`)
  fs.chmodSync(claude, 0o755)
  fs.writeFileSync(path.join(dir, 'workflow-analysis.json'), JSON.stringify({ workflowName: 'Form to Slack', trigger: 'A form is sent', nodes: [{ id: 1, name: 'Webhook', type: 'n8n-nodes-base.webhook', purpose: 'Receives the form', parameters: { path: 'PATH' }, placeholders: ['path'] }, { id: 2, name: 'Post to Slack', type: 'n8n-nodes-base.slack', purpose: 'Tells the team', parameters: { channel: 'CHANNEL' }, placeholders: ['channel'] }], connections: 'linear 1→2', connectionsMap: { Webhook: ['Post to Slack'] } }))
  fs.writeFileSync(path.join(dir, 'workflow.json'), '```json\n' + JSON.stringify({ name: 'Form to Slack', nodes: [{ name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [240, 300], parameters: { path: 'forms' } }], connections: {} }) + '\n```')
  // Fake built-in engine (whisper-cli + model): only accepts WAV, like the real one.
  const engineDir = path.join(dir, 'engine')
  fs.mkdirSync(engineDir)
  fs.writeFileSync(path.join(engineDir, 'whisper-cli'), `#!/bin/bash
f=""; prev=""
for a in "$@"; do [ "$prev" = "-f" ] && f="$a"; prev="$a"; done
[ "$(head -c 4 "$f")" = "RIFF" ] || { echo "expected WAV input" >&2; exit 1; }
[ -f "$FAKE_DIR/whisper-fail" ] && case "$f" in *warmup*) ;; *) echo "engine failed" >&2; exit 1;; esac
cp "$f" "$FAKE_DIR/last-audio.wav"
printf '%s\n' "$*" > "$FAKE_DIR/whisper-args"
if [ -f "$FAKE_DIR/transcript" ]; then cat "$FAKE_DIR/transcript"; else echo "spoken words from the fake mic"; fi
`, { mode: 0o755 })
  fs.writeFileSync(path.join(engineDir, 'ggml-base.en-q5_1.bin'), 'fake model')
  const whisper = path.join(dir, 'whisper')
  fs.writeFileSync(whisper, '#!/bin/bash\nexit 1\n', { mode: 0o755 })
  const ffmpeg = path.join(dir, 'ffmpeg')
  fs.writeFileSync(ffmpeg, '#!/bin/bash\nexit 0\n')
  fs.chmodSync(ffmpeg, 0o755)
  // Fake promptly-helper: Accessibility granted, Terminal in front with some text selected.
  const helper = path.join(dir, 'promptly-helper')
  fs.writeFileSync(helper, `#!/usr/bin/env node
const rl = require('readline').createInterface({ input: process.stdin })
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n')
out({ type: 'ready', trusted: true, tap: true })
rl.on('line', (line) => {
  const m = JSON.parse(line)
  if (m.cmd === 'context') out({ type: 'context', id: m.id, app: { name: 'Terminal', bundleId: 'com.apple.Terminal', pid: 1 }, selectedText: require('fs').existsSync(process.env.FAKE_DIR + '/no-selection') ? null : 'TypeError: cannot read properties of undefined' })
  else if (m.cmd === 'paste') {
    // Records what ⌘V would have pasted: the clipboard at that moment.
    require('fs').writeFileSync(process.env.FAKE_DIR + '/pasted', require('child_process').execFileSync('pbpaste'))
    out({ type: 'pasted', id: m.id, ok: true })
  }
  else out({ type: 'status', id: m.id, trusted: true, tap: true })
})
rl.on('close', () => process.exit(0))
`, { mode: 0o755 })
  return { claude, whisper, ffmpeg: path.join(dir, 'ffmpeg'), engineDir, helper }
}

// mode: most tests below are about prompt modes, so they start in Prompt; pass mode: null to
// start the way a fresh install does (Dictation).
async function launch({ setupComplete = true, signedOut = false, withHelper = false, mode = 'prompt', speechModel = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-e2e-'))
  const fakeDir = path.join(dir, 'fake')
  const userData = path.join(dir, 'userData')
  const tmpDir = path.join(dir, 'tmp')
  fs.mkdirSync(fakeDir)
  fs.mkdirSync(userData)
  fs.mkdirSync(tmpDir)
  const tools = writeFakeTools(fakeDir)
  if (signedOut) fs.writeFileSync(path.join(fakeDir, 'signed-out'), '')
  fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({
    setupComplete,
    claudePath: tools.claude,
    whisperPath: tools.whisper,
    ffmpegPath: tools.ffmpeg,
  }))
  const app = await electron.launch({
    args: [ROOT],
    cwd: ROOT,
    env: {
      ...process.env,
      PROMPTLY_USER_DATA: userData,
      PROMPTLY_WHISPER_DIR: tools.engineDir,
      // No helper unless a test asks for one, so the real frontmost app never leaks into tests.
      PROMPTLY_HELPER: withHelper ? tools.helper : path.join(dir, 'no-helper'),
      FAKE_DIR: fakeDir,
      TMPDIR: tmpDir,
      ...(speechModel && { PROMPTLY_SPEECH_MODEL: JSON.stringify(speechModel) }),
    },
  })
  if (!setupComplete) return { app, dir, fakeDir, tmpDir }
  // Setup is complete, so the bar opens directly (no splash).
  await expect.poll(async () => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some((w) => w.webContents.getURL().includes('dist-renderer') && w.isVisible())
  ), { timeout: 20000 }).toBe(true)
  const page = app.windows().find((w) => w.url().includes('dist-renderer'))
  if (mode) {
    await page.evaluate((m) => localStorage.setItem('mode', m), mode)
    await page.reload()
    await expect(page.locator('#mode-pill')).toBeVisible({ timeout: 10000 })
  }
  return { app, page, dir, fakeDir, tmpDir }
}

const mainWindow = (app) => app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes('dist-renderer'))
  return { visible: w.isVisible() }
})
const appState = (app) => app.evaluate(() => globalThis.__promptlyE2E.appState())

// Reads the system clipboard, runs fn, and restores the user's clipboard afterwards.
async function withClipboard(app, fn) {
  const saved = await app.evaluate(({ clipboard }) => clipboard.readText())
  try { return await fn() } finally { await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), saved) }
}
const readClipboard = (app) => app.evaluate(({ clipboard }) => clipboard.readText())

function calls(fakeDir) {
  return fs.readdirSync(fakeDir).filter((f) => f.endsWith('.args')).sort()
}

// What the latest Claude call was given. The fake writes its .args a moment before its .stdin.
async function lastStdin(fakeDir) {
  let file
  await expect.poll(() => { file = path.join(fakeDir, calls(fakeDir).at(-1).replace('.args', '.stdin')); return fs.existsSync(file) }).toBe(true)
  return fs.readFileSync(file, 'utf8')
}

async function typeAndSubmit(page, text) {
  await page.keyboard.press('Meta+t')
  const box = page.getByPlaceholder('Describe what you want Claude to build, design, or write...')
  await expect(box).toBeVisible()
  await box.fill(text)
  await box.press('Meta+Enter')
}

let ctx
test.afterEach(async () => {
  await ctx?.app.close()
  if (ctx?.dir) fs.rmSync(ctx.dir, { recursive: true, force: true })
})

test('typed request becomes a structured prompt via the Claude CLI', async () => {
  ctx = await launch()
  const { page, fakeDir } = ctx
  await typeAndSubmit(page, 'make a todo app with dark mode')

  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('make a todo app with dark mode').first()).toBeVisible()

  const [first] = calls(fakeDir)
  const args = fs.readFileSync(path.join(fakeDir, first), 'utf8').split('\n')
  const stdin = fs.readFileSync(path.join(fakeDir, first.replace('.args', '.stdin')), 'utf8')
  expect(args).toContain('--model')
  expect(args.join(' ')).not.toContain('todo app')
  expect(stdin).toContain('You turn a rough, spoken request into a prompt for Claude')
  expect(stdin).toContain('<transcript>\nmake a todo app with dark mode\n</transcript>')
})

test('⌘T opens the typing box from Settings too, but never interrupts a recording', async () => {
  ctx = await launch()
  const { app, page } = ctx
  await page.keyboard.press('Meta+/')
  await expect(page.getByText('Settings', { exact: true })).toBeVisible()
  await page.keyboard.press('Meta+t')
  await expect(page.getByPlaceholder('Describe what you want Claude to build, design, or write...')).toBeVisible()
  await page.keyboard.press('Escape')
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => appState(app)).toBe('RECORDING')
  await page.keyboard.press('Meta+t')
  await page.waitForTimeout(300)
  expect(await appState(app)).toBe('RECORDING')
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
})

test('picking an older prompt in history shows it, even with the latest result on screen', async () => {
  ctx = await launch()
  const { page } = ctx
  await typeAndSubmit(page, 'first request about invoices')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  // ⌘T starts a new request straight from the result, no Reset needed.
  await typeAndSubmit(page, 'second request about sprints')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('second request about sprints').first()).toBeVisible()

  await page.locator('[data-history-entry]', { hasText: 'first request about invoices' }).first().click()
  // The older entry replaces the latest result on the right.
  await expect(page.getByText(/You said/)).toBeVisible()
  await expect(page.locator('[data-history-entry]', { hasText: 'first request' }).first()).toBeVisible()
  const right = await page.evaluate(() => document.body.innerText)
  expect(right).toContain('first request about invoices')
  expect(await appState(ctx.app)).toBe('IDLE')
})

test('aborting while thinking cancels Claude and the next request still shows', async () => {
  ctx = await launch()
  const { page, fakeDir } = ctx
  fs.writeFileSync(path.join(fakeDir, 'delay'), '4')
  await typeAndSubmit(page, 'first request that gets aborted')
  await expect.poll(() => calls(fakeDir).length, { timeout: 10000 }).toBe(1)

  // Cancel, in the working header, stops Claude.
  await page.getByRole('button', { name: 'Cancel' }).click()
  fs.rmSync(path.join(fakeDir, 'delay'))

  await typeAndSubmit(page, 'second request after abort')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('second request after abort').first()).toBeVisible()

  // Long enough for the aborted call to have finished had it not been killed.
  await page.waitForTimeout(4500)
  await expect(page.getByText('second request after abort').first()).toBeVisible()
  await expect(page.getByText('first request that gets aborted')).toHaveCount(0)
  expect(fs.existsSync(path.join(fakeDir, 'call-0.done'))).toBe(false)
})

test('the mode dropdown lists every mode from the shared registry', async () => {
  ctx = await launch()
  const modes = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/modes.json'), 'utf8')).modes
  const { page } = ctx
  await page.locator('#mode-pill').click()
  const menu = page.getByRole('dialog', { name: 'Mode' })
  // The two ways to talk, then every prompt style and specialist mode as a chip.
  await expect(menu.getByRole('tab', { name: 'Dictation' })).toBeVisible()
  await expect(menu.getByRole('tab', { name: 'Craft a prompt' })).toHaveAttribute('aria-selected', 'true')
  for (const m of modes.filter((x) => x.kind !== 'dictation')) await expect(menu.getByRole('button', { name: m.label, exact: true })).toBeVisible()
  // One line describes the hovered mode.
  await menu.getByRole('button', { name: 'Code', exact: true }).hover()
  await expect(menu.getByText(modes.find((m) => m.key === 'code').desc)).toBeVisible()
  // Picking a chip switches mode and closes the menu.
  await menu.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(page.locator('#mode-pill')).toHaveText('Code')
  await expect(menu).toHaveCount(0)
})

test('a prompt made from another app stays out of your way: copied, with Open in the pill', async () => {
  ctx = await launch()
  const { app, page, fakeDir, tmpDir } = ctx
  await typeAndSubmit(page, 'first prompt')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()))
  expect((await mainWindow(app)).visible).toBe(false)

  await withClipboard(app, async () => {
    // Tap to start (from the prompt screen): the bar stays hidden and the pill shows instead.
    await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
    await expect.poll(() => appState(app)).toBe('RECORDING')
    expect((await mainWindow(app)).visible).toBe(false)
    await expect.poll(() => app.evaluate(() => globalThis.__promptlyE2E.pillState()?.state)).toBe('recording')
    // Option+P is claimed only while recording.
    expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Alt+P'))).toBe(true)

    await page.waitForTimeout(1200)
    await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
    // You stay in your app: the prompt is on the clipboard and the pill offers to open it.
    await expect.poll(() => readClipboard(app)).toContain('spoken words from the fake mic')
    expect(await app.evaluate(() => globalThis.__promptlyE2E.pillState()?.state)).toBe('copied')
    expect((await mainWindow(app)).visible).toBe(false)
    const pill = app.windows().find((w) => w.url().includes('pill.html'))
    await pill.getByRole('button', { name: 'Open' }).click()
    await expect.poll(() => mainWindow(app).then((w) => w.visible)).toBe(true)
    await expect(page.locator('#prompt-output')).toContainText('spoken words from the fake mic')
  })
  expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Alt+P'))).toBe(false)

  // The recording reached the engine as 16 kHz mono WAV (converted in the renderer, no ffmpeg).
  const wav = fs.readFileSync(path.join(fakeDir, 'last-audio.wav'))
  expect(wav.subarray(0, 4).toString()).toBe('RIFF')
  expect(wav.readUInt32LE(24)).toBe(16000)
  expect(wav.readUInt16LE(22)).toBe(1)
  // The recording is deleted once it has been transcribed.
  expect(fs.readdirSync(path.join(tmpDir, 'promptly-audio'))).toEqual([])
})

test('the window is a normal window: it stays open when you switch apps', async () => {
  ctx = await launch()
  const { app, page } = ctx
  const blur = () => app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes('dist-renderer')).emit('blur')
  })
  await typeAndSubmit(page, 'something to paste elsewhere')
  await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
  await blur()
  expect((await mainWindow(app)).visible).toBe(true)
  const win = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes('dist-renderer'))
    return { alwaysOnTop: w.isAlwaysOnTop(), resizable: w.isResizable(), size: w.getSize() }
  })
  expect(win).toMatchObject({ alwaysOnTop: false, resizable: true, size: [940, 600] })
})

test('retrying a failed generation keeps the original mode and tone', async () => {
  ctx = await launch()
  const { page, fakeDir } = ctx
  fs.writeFileSync(path.join(fakeDir, 'fail'), '')
  const failed = await page.evaluate(() => window.electronAPI.generatePrompt('um so like fix this', 'polish', { tone: 'casual' }))
  expect(failed.success).toBe(false)
  fs.rmSync(path.join(fakeDir, 'fail'))

  const retried = await page.evaluate(() => window.electronAPI.retryGeneration())
  expect(retried.success).toBe(true)
  const stdins = calls(fakeDir).map((f) => fs.readFileSync(path.join(fakeDir, f.replace('.args', '.stdin')), 'utf8'))
  expect(stdins.at(-1)).toContain('Tone: Casual')
  expect(stdins.at(-1)).toContain('"um so like fix this"')
})

test('speech-to-text is built in, so setup never asks for Whisper or ffmpeg', async () => {
  ctx = await launch()
  const result = await ctx.page.evaluate(() => window.electronAPI.splashCheckWhisper())
  expect(result).toMatchObject({ ok: true, builtIn: true })
  const paths = await ctx.page.evaluate(() => window.electronAPI.getStoredPaths())
  expect(paths.speechBuiltIn).toBe(true)
})

test('first-run setup: microphone, then Claude Code sign-in is picked up on its own', async () => {
  ctx = await launch({ setupComplete: false, signedOut: true })
  const { app, fakeDir } = ctx
  const setup = await app.waitForEvent('window', { predicate: (w) => w.url().includes('splash.html') })
  await setup.getByRole('button', { name: 'Set up Promptly' }).click()

  await expect(setup.getByText('Microphone access is on.')).toBeVisible()
  await setup.locator('#mic-next').click()

  await expect(setup.getByText('Claude Code is installed, but not signed in.')).toBeVisible({ timeout: 10000 })
  await expect(setup.locator('#claude-next')).toBeDisabled()
  // Signing in happens in Terminal; the wizard should notice without any click.
  fs.rmSync(path.join(fakeDir, 'signed-out'))
  await expect(setup.getByText('Claude Code is ready.')).toBeVisible({ timeout: 10000 })
  await setup.locator('#claude-next').click()

  await expect(setup.getByText("You're set")).toBeVisible()
  await setup.getByRole('button', { name: 'Start using Promptly' }).click()
  await expect.poll(async () => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some((w) => w.webContents.getURL().includes('dist-renderer') && w.isVisible())
  ), { timeout: 10000 }).toBe(true)
  const config = JSON.parse(fs.readFileSync(path.join(ctx.dir, 'userData', 'config.json'), 'utf8'))
  expect(config.setupComplete).toBe(true)
})

test('a missing Claude Code offers the installer', async () => {
  ctx = await launch({ setupComplete: false })
  const { app } = ctx
  const setup = await app.waitForEvent('window', { predicate: (w) => w.url().includes('splash.html') })
  await setup.evaluate(() => window.electronAPI.savePaths({ claudePath: '/nonexistent/claude' }))
  await setup.getByRole('button', { name: 'Set up Promptly' }).click()
  await setup.locator('#mic-next').click()
  await expect(setup.getByText("Claude Code isn't installed yet.")).toBeVisible({ timeout: 10000 })
  await expect(setup.getByRole('button', { name: 'Install Claude Code' })).toBeVisible()
  await expect(setup.locator('#install-cmd')).toHaveText('curl -fsSL https://claude.ai/install.sh | bash')
  await expect(setup.locator('#claude-next')).toBeDisabled()
})


test('fix-06: reopening the setup wizard keeps a single menu bar icon', async () => {
  ctx = await launch()
  const { app, page } = ctx
  await expect.poll(() => app.evaluate(() => globalThis.__promptlyE2E.trayIconsCreated())).toBe(1)
  const wizard = app.waitForEvent('window', { predicate: (w) => w.url().includes('splash.html') })
  await page.evaluate(() => window.electronAPI.reopenWizard())
  const setup = await wizard
  await setup.getByRole('button', { name: 'Set up Promptly' }).click()
  await setup.locator('#mic-next').click()
  await expect(setup.getByText('Claude Code is ready.')).toBeVisible({ timeout: 10000 })
  await setup.locator('#claude-next').click()
  await setup.getByRole('button', { name: 'Start using Promptly' }).click()
  await expect.poll(() => mainWindow(app).then((w) => w.visible), { timeout: 10000 }).toBe(true)
  expect(await app.evaluate(() => globalThis.__promptlyE2E.trayIconsCreated())).toBe(1)
})

test('fix-12: Cmd+C copies the selection when there is one, the whole prompt otherwise', async () => {
  ctx = await launch()
  const { app, page } = ctx
  await typeAndSubmit(page, 'make a todo app with dark mode')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  await withClipboard(app, async () => {
    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode()) && !node.textContent.includes('You are a test assistant.'));
      const start = node.textContent.indexOf('test assistant')
      const range = document.createRange()
      range.setStart(node, start)
      range.setEnd(node, start + 4)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    })
    // The generated prompt must be selectable (the rest of the UI is not).
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('test')
    await page.keyboard.press('Meta+c')
    await expect.poll(() => readClipboard(app)).toBe('test')

    await page.evaluate(() => window.getSelection().removeAllRanges())
    await page.keyboard.press('Meta+c')
    await expect.poll(() => readClipboard(app)).toContain('Role:\nYou are a test assistant.')
  })
})

test('fix-11 + fix-15: image builder shows the assembly labels and copies the prompt without flags', async () => {
  ctx = await launch()
  const { app, page, fakeDir } = ctx
  await page.evaluate(() => localStorage.setItem('mode', 'image'))
  await page.reload()
  await expect.poll(() => appState(app), { timeout: 10000 }).toBe('IDLE')
  await typeAndSubmit(page, 'a calm red fox in a snowy forest')

  const confirm = page.getByText('Confirm & assemble prompt')
  await expect(confirm).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: /Confirm & assemble prompt/ })).toBeEnabled({ timeout: 10000 })
  fs.writeFileSync(path.join(fakeDir, 'assemble-delay'), '3')
  await confirm.click()

  // Phase 2 labels (these were never shown before the fix; phase 1 labels appeared instead).
  await expect(page.getByText('Assembling your prompt...')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Analysing your idea...')).toHaveCount(0)

  await expect(page.getByText('Midjourney flags (optional)')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('--ar 4:5 --stylize 750 --chaos 20')).toBeVisible()
  await withClipboard(app, async () => {
    await page.getByRole('button', { name: 'Copy prompt', exact: true }).click()
    await expect.poll(() => readClipboard(app)).toBe('A calm red fox in a snowy forest at golden hour, vertical 4:5 composition, photorealistic')
    await page.getByRole('button', { name: 'Copy prompt with flags for Midjourney' }).click()
    await expect.poll(() => readClipboard(app)).toBe('A calm red fox in a snowy forest at golden hour, vertical 4:5 composition, photorealistic\n\n--ar 4:5 --stylize 750 --chaos 20')
  })
})

test('the app menu keeps the Edit commands macOS needs for copy and paste', async () => {
  ctx = await launch()
  const roles = await ctx.app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu().items.flatMap((m) => m.submenu ? m.submenu.items.map((i) => i.role).filter(Boolean) : []))
  for (const role of ['copy', 'paste', 'cut', 'selectall', 'undo']) expect(roles).toContain(role)
  expect(roles).not.toContain('hide')
  expect(roles).not.toContain('reload')
  expect(roles).not.toContain('toggledevtools')
})

test('hold to talk from Terminal: destination, selection and dictionary shape the prompt', async () => {
  ctx = await launch({ withHelper: true })
  const { app, page, fakeDir } = ctx
  await page.evaluate(() => window.electronAPI.setPreferences({ dictionary: 'Supabase, Promptly' }))
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()))
  fs.writeFileSync(path.join(fakeDir, 'transcript'), 'fix this error in the upload job')

  await withClipboard(app, async () => {
    await app.evaluate(() => globalThis.__promptlyE2E.hotkey('down'))
    await expect.poll(() => appState(app)).toBe('RECORDING')
    await expect.poll(() => app.evaluate(() => globalThis.__promptlyE2E.pillState()?.context?.appName)).toBe('Terminal')
    await page.waitForTimeout(1000)
    await app.evaluate(() => globalThis.__promptlyE2E.hotkey('up'))
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
  })

  const stdin = fs.readFileSync(path.join(fakeDir, calls(fakeDir).at(-1).replace('.args', '.stdin')), 'utf8')
  expect(stdin).toContain('AI coding agent')
  expect(stdin).toContain('<selected_text>\nTypeError: cannot read properties of undefined\n</selected_text>')
  expect(stdin).toContain('Spell these names and terms exactly as written: Supabase, Promptly.')
  expect(stdin).toContain('<transcript>\nfix this error in the upload job\n</transcript>')
  // The dictionary also biases transcription.
  expect(fs.readFileSync(path.join(fakeDir, 'whisper-args'), 'utf8')).toContain('--prompt Supabase, Promptly')
})

test('a quick tap then another tap works as toggle with the helper too', async () => {
  ctx = await launch({ withHelper: true })
  const { app } = ctx
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()))
  await withClipboard(app, async () => {
    await app.evaluate(() => { globalThis.__promptlyE2E.hotkey('down'); globalThis.__promptlyE2E.hotkey('up') })
    await expect.poll(() => appState(app)).toBe('RECORDING')
    await ctx.page.waitForTimeout(800)
    expect(await appState(app)).toBe('RECORDING')
    await app.evaluate(() => { globalThis.__promptlyE2E.hotkey('down'); globalThis.__promptlyE2E.hotkey('up') })
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
  })
})

test('saying a mode first switches to it', async () => {
  ctx = await launch()
  const { app, page, fakeDir } = ctx
  fs.writeFileSync(path.join(fakeDir, 'transcript'), 'Code mode, add retries to the upload job')
  await withClipboard(app, async () => {
    await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
    await expect.poll(() => appState(app)).toBe('RECORDING')
    await page.waitForTimeout(800)
    await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
  })
  const stdin = fs.readFileSync(path.join(fakeDir, calls(fakeDir).at(-1).replace('.args', '.stdin')), 'utf8')
  expect(stdin).toContain('task brief for an AI coding agent')
  expect(stdin).toContain('<transcript>\nAdd retries to the upload job\n</transcript>')
  expect(await page.evaluate(() => localStorage.getItem('mode'))).toBe('code')
})

test('the prompt streams in while Claude writes it', async () => {
  ctx = await launch()
  const { page, fakeDir } = ctx
  fs.writeFileSync(path.join(fakeDir, 'stream-pause'), '2')
  await typeAndSubmit(page, 'stream this please')
  // First half is on screen before the answer is complete.
  await expect(page.locator('#think-stream')).toContainText('Role:', { timeout: 10000 })
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
})

test('preferences are saved', async () => {
  ctx = await launch()
  const { page } = ctx
  const before = await page.evaluate(() => window.electronAPI.getPreferences())
  expect(before).toMatchObject({ hotkey: 'double-control', autoCopy: true, dictionary: '' })
  expect(before.hotkeyOptions.map((o) => o.value)).toContain('fn')
  await page.evaluate(() => window.electronAPI.setPreferences({ hotkey: 'right-option', autoCopy: false, dictionary: 'Kubernetes' }))
  const after = await page.evaluate(() => window.electronAPI.getPreferences())
  expect(after).toMatchObject({ hotkey: 'right-option', autoCopy: false, dictionary: 'Kubernetes' })
})

test('setup offers hold to talk when the helper is available, and notices when it is allowed', async () => {
  ctx = await launch({ setupComplete: false, withHelper: true })
  const { app } = ctx
  const setup = await app.waitForEvent('window', { predicate: (w) => w.url().includes('splash.html') })
  await setup.getByRole('button', { name: 'Set up Promptly' }).click()
  await setup.locator('#mic-next').click()
  await expect(setup.getByText('Claude Code is ready.')).toBeVisible({ timeout: 10000 })
  await setup.locator('#claude-next').click()
  // The fake helper reports Accessibility as granted.
  await expect(setup.getByText('Talking from any app is on.')).toBeVisible({ timeout: 5000 })
  await setup.locator('#hold-next').click()
  await expect(setup.getByText('Double-tap this anywhere on your Mac and talk.', { exact: false })).toBeVisible({ timeout: 5000 })
  await expect(setup.locator('#key-space')).toHaveText('control')
})

test('your notes shape results: "About you" for prompts, "How you write" for Polish', async () => {
  ctx = await launch()
  const { page, fakeDir } = ctx
  await page.evaluate(() => window.electronAPI.setPreferences({ voiceNotes: '- Short sentences', aboutMe: 'PM at a fintech; TypeScript and Postgres' }))
  await typeAndSubmit(page, 'a dashboard for failed payments')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  let stdin = fs.readFileSync(path.join(fakeDir, calls(fakeDir).at(-1).replace('.args', '.stdin')), 'utf8')
  expect(stdin).toContain('<about_me>\nPM at a fintech; TypeScript and Postgres\n</about_me>')
  expect(stdin).not.toContain('how_i_write')

  await page.evaluate(() => localStorage.setItem('mode', 'polish'))
  await page.reload()
  await expect(page.locator('#mode-pill')).toHaveText('Polish', { timeout: 10000 })
  await typeAndSubmit(page, 'so um can you send me the numbers')
  await expect.poll(() => calls(fakeDir).length).toBe(2)
  await expect.poll(() => fs.existsSync(path.join(fakeDir, 'call-1.done'))).toBe(true)
  stdin = fs.readFileSync(path.join(fakeDir, 'call-1.stdin'), 'utf8')
  expect(stdin).toContain('<how_i_write>\n- Short sentences\n</how_i_write>')
  expect(stdin).not.toContain('about_me')
})

test('edits you make are remembered, and Settings drafts your style notes from them', async () => {
  ctx = await launch()
  const { app, page, fakeDir } = ctx
  await typeAndSubmit(page, 'a note to the team about friday')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: 'Edit' }).click()
  await page.locator('#prompt-output [contenteditable]').evaluate((el) => { el.textContent = 'Role:\nYou are my editor.\n\nTask:\nKeep it short.' })
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await page.evaluate(() => window.electronAPI.getPreferences())).editCount).toBe(1)

  await page.keyboard.press('Escape')
  await expect.poll(() => appState(app)).toBe('IDLE')
  await page.keyboard.press('Meta+/')
  await page.getByRole('tab', { name: 'You' }).click()
  await page.getByRole('button', { name: 'Suggest from my 1 edit' }).click()
  await expect(page.getByText('Suggested notes')).toBeVisible({ timeout: 15000 })
  const stdin = fs.readFileSync(path.join(fakeDir, calls(fakeDir).at(-1).replace('.args', '.stdin')), 'utf8')
  expect(stdin).toContain('<after>\nRole:\nYou are my editor.')

  await page.getByRole('button', { name: 'Use these' }).click()
  await expect(page.locator('#settings-voice')).toHaveValue('- Short sentences\n- Signs off with "Cheers, Sam"')
  expect((await page.evaluate(() => window.electronAPI.getPreferences())).voiceNotes).toContain('Cheers, Sam')

  await page.getByRole('button', { name: 'Forget my edits' }).click()
  await expect(page.getByRole('button', { name: /Suggest from my/ })).toHaveCount(0)
})

test('Settings drafts your style notes from pasted writing', async () => {
  ctx = await launch()
  const { page, fakeDir } = ctx
  await page.keyboard.press('Meta+/')
  await page.getByRole('tab', { name: 'You' }).click()
  await page.getByRole('button', { name: 'Learn from my writing' }).click()
  await page.locator('#settings-samples').fill('Hi all, quick one: the release moves to Friday. Nothing else changes. Cheers, Sam')
  await page.getByRole('button', { name: 'Draft my notes' }).click()
  await expect(page.getByText('Suggested notes')).toBeVisible({ timeout: 15000 })
  const stdin = fs.readFileSync(path.join(fakeDir, calls(fakeDir).at(-1).replace('.args', '.stdin')), 'utf8')
  expect(stdin).toContain('<samples>\nHi all, quick one')
  await page.getByRole('button', { name: 'Dismiss' }).click()
  expect((await page.evaluate(() => window.electronAPI.getPreferences())).voiceNotes).toBe('')
})

// ── Dictation ──

async function dictateFromAnotherApp(app, page, fakeDir, transcript) {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()))
  fs.writeFileSync(path.join(fakeDir, 'transcript'), transcript)
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => appState(app)).toBe('RECORDING')
  await page.waitForTimeout(1000)
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
}

test('Dictation (the default) types what you said into your app, and gives your clipboard back', async () => {
  ctx = await launch({ withHelper: true, mode: null })
  const { app, page, fakeDir } = ctx
  await expect(page.locator('#mode-pill')).toHaveText('Dictation')
  fs.writeFileSync(path.join(fakeDir, 'no-selection'), '')
  await withClipboard(app, async () => {
    await app.evaluate(({ clipboard }) => clipboard.writeText('what I copied earlier'))
    await dictateFromAnotherApp(app, page, fakeDir, 'Um, so ship it on Friday. New paragraph. Thanks, uh, everyone.')

    // Typed via ⌘V with exactly what was said, minus um/uh, with the paragraph break.
    await expect.poll(() => fs.existsSync(path.join(fakeDir, 'pasted'))).toBe(true)
    expect(fs.readFileSync(path.join(fakeDir, 'pasted'), 'utf8')).toBe('So ship it on Friday.\n\nThanks everyone.')
    // No Claude call, the window stays out of the way, and the clipboard is yours again.
    expect(calls(fakeDir)).toEqual([])
    expect((await mainWindow(app)).visible).toBe(false)
    expect(await app.evaluate(() => globalThis.__promptlyE2E.pillState())).toMatchObject({ state: 'dictated', typed: true })
    await expect.poll(() => readClipboard(app)).toBe('what I copied earlier')
  })
})

test('"Make it a prompt" from the pill turns the dictation into a prompt, and back', async () => {
  ctx = await launch({ withHelper: true, mode: null })
  const { app, page, fakeDir } = ctx
  fs.writeFileSync(path.join(fakeDir, 'no-selection'), '')
  await withClipboard(app, async () => {
    await dictateFromAnotherApp(app, page, fakeDir, 'a script that renames my screenshots by date')
    const pill = app.windows().find((w) => w.url().includes('pill.html'))
    await pill.getByRole('button', { name: 'Make it a prompt' }).click()

    await expect.poll(() => mainWindow(app).then((w) => w.visible)).toBe(true)
    await expect(page.getByRole('tab', { name: 'As a prompt' })).toHaveAttribute('aria-selected', 'true', { timeout: 15000 })
    const stdin = fs.readFileSync(path.join(fakeDir, calls(fakeDir).at(-1).replace('.args', '.stdin')), 'utf8')
    expect(stdin).toContain('You turn a rough, spoken request into a prompt for Claude')
    expect(stdin).toContain('<transcript>\na script that renames my screenshots by date\n</transcript>')
    await expect.poll(() => readClipboard(app)).toContain('Task:')

    // Back to the words as spoken, and to the prompt again, without asking Claude twice.
    await page.getByRole('tab', { name: 'As I said it' }).click()
    await expect(page.locator('#prompt-output')).toHaveText('a script that renames my screenshots by date')
    await page.getByRole('tab', { name: 'As a prompt' }).click()
    await expect(page.locator('#prompt-output')).toContainText('You are a test assistant.')
    expect(calls(fakeDir)).toHaveLength(1)
  })
})

test('without Accessibility, dictation is left on the clipboard for ⌘V', async () => {
  ctx = await launch({ mode: null })
  const { app, page, fakeDir } = ctx
  await withClipboard(app, async () => {
    await dictateFromAnotherApp(app, page, fakeDir, 'Remember to call the bank.')
    expect(await app.evaluate(() => globalThis.__promptlyE2E.pillState())).toMatchObject({ state: 'dictated', typed: false })
    await expect.poll(() => readClipboard(app)).toBe('Remember to call the bank.')
  })
})

test('typing in Dictation mode makes a prompt in the style chosen in Settings', async () => {
  ctx = await launch({ mode: null })
  const { page, fakeDir } = ctx
  await page.evaluate(() => window.electronAPI.setPreferences({ promptStyle: 'code' }))
  await typeAndSubmit(page, 'retry failed uploads three times')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  const stdin = fs.readFileSync(path.join(fakeDir, calls(fakeDir).at(-1).replace('.args', '.stdin')), 'utf8')
  expect(stdin).toContain('task brief for an AI coding agent')
})

test('a prompt made from a dictation can be regenerated, in the style it was made in', async () => {
  ctx = await launch({ mode: null })
  const { page, fakeDir } = ctx
  await page.evaluate(() => window.electronAPI.setPreferences({ promptStyle: 'code' }))
  await typeAndSubmit(page, 'retry failed uploads three times')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  const before = calls(fakeDir).length
  await page.getByRole('button', { name: 'Regenerate' }).click()
  await expect.poll(() => calls(fakeDir).length, { timeout: 15000 }).toBe(before + 1)
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  const stdin = await lastStdin(fakeDir)
  expect(stdin).toContain('task brief for an AI coding agent')
  await expect(page.getByRole('button', { name: '↻ Iterate' })).toBeVisible()
})

test('an older prompt reopened from history can be regenerated in its own mode, whatever mode is selected now', async () => {
  ctx = await launch()
  const { page, fakeDir } = ctx
  await page.evaluate(() => localStorage.setItem('mode', 'code'))
  await page.reload()
  await expect(page.locator('#mode-pill')).toHaveText('Code', { timeout: 10000 })
  await typeAndSubmit(page, 'add pagination to the orders api')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  // Switch to Dictation, then go back to the Code prompt in history.
  await page.evaluate(() => localStorage.setItem('mode', 'dictate'))
  await page.reload()
  await expect(page.locator('#mode-pill')).toContainText('Dictation', { timeout: 10000 })
  await page.locator('[data-history-entry]', { hasText: 'add pagination' }).first().click()
  await page.getByRole('button', { name: 'Open to refine' }).click()
  await expect(page.getByRole('button', { name: '↻ Iterate' })).toBeVisible()
  const before = calls(fakeDir).length
  await page.getByRole('button', { name: 'Regenerate' }).click()
  await expect.poll(() => calls(fakeDir).length, { timeout: 15000 }).toBe(before + 1)
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
  const stdin = await lastStdin(fakeDir)
  expect(stdin).toContain('task brief for an AI coding agent')
  expect(stdin).toContain('add pagination to the orders api')
})

test('a faint speaker is asked to speak up while recording', async () => {
  ctx = await launch({ mode: null })
  const { app, page } = ctx
  await page.locator('#mode-pill').waitFor()
  // Record what the app asks the microphone for.
  await page.evaluate(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = (c) => { window.__micAsk = c; return real(c) }
  })
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => appState(app)).toBe('RECORDING')
  // Call-style processing off (it thins out soft voices), auto gain on.
  expect(await page.evaluate(() => window.__micAsk.audio)).toMatchObject({ echoCancellation: false, noiseSuppression: false, autoGainControl: true })
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('mic-quiet', true)))
  await expect(page.getByText('Speak up or move closer to the mic')).toBeVisible()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('mic-quiet', false)))
  await expect(page.getByText('Tap stop when done')).toBeVisible()
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
})

test('if the microphone drops out mid-recording, what was said is still transcribed and Control still works', async () => {
  ctx = await launch({ mode: null })
  const { app, page, fakeDir } = ctx
  await page.locator('#mode-pill').waitFor()
  // Keep hold of the microphone stream so the test can end it, like AirPods disconnecting.
  await page.evaluate(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (c) => { const s = await real(c); window.__micStream = s; return s }
  })
  fs.writeFileSync(path.join(fakeDir, 'transcript'), 'everything I said before the mic dropped')
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => appState(app)).toBe('RECORDING')
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__micStream.getTracks().forEach((t) => { t.stop(); t.dispatchEvent(new Event('ended')) }))
  await page.waitForTimeout(500)
  // Control (the hotkey) must still finish the recording rather than do nothing.
  if (await appState(app) === 'RECORDING') await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
  await expect(page.getByText('everything I said before the mic dropped').first()).toBeVisible()
})

test('cancelling a recording throws it away instead of transcribing it', async () => {
  ctx = await launch({ mode: null })
  const { app, page, fakeDir } = ctx
  await page.locator('#mode-pill').waitFor()
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => appState(app)).toBe('RECORDING')
  await page.waitForTimeout(800)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('hotkey-cancel')))
  await expect.poll(() => appState(app)).toBe('IDLE')
  await page.waitForTimeout(1500)
  expect(await appState(app)).toBe('IDLE')
  // The engine runs once at startup on silence (warmup.wav); a recording would be promptly-*.wav.
  const args = fs.existsSync(path.join(fakeDir, 'whisper-args')) ? fs.readFileSync(path.join(fakeDir, 'whisper-args'), 'utf8') : ''
  expect(args).not.toMatch(/promptly-\d+\.wav/)
})

test('the pill: its cancel button throws the recording away, and an error stays in the pill with Open', async () => {
  ctx = await launch({ mode: null })
  const { app, page, fakeDir } = ctx
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()))
  const pillWin = () => app.windows().find((w) => w.url().includes('pill.html'))

  // Cancel from the pill (the × shown on hover).
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => appState(app)).toBe('RECORDING')
  await pillWin().locator('#pill').hover()
  await pillWin().getByRole('button', { name: 'Cancel recording' }).click()
  await expect.poll(() => appState(app)).toBe('IDLE')
  expect((await mainWindow(app)).visible).toBe(false)

  // Transcription fails: the pill says so and offers the window, which stays out of the way until asked.
  fs.writeFileSync(path.join(fakeDir, 'whisper-fail'), '')
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => appState(app)).toBe('RECORDING')
  await page.waitForTimeout(800)
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => app.evaluate(() => globalThis.__promptlyE2E.pillState()?.state), { timeout: 15000 }).toBe('error')
  expect((await mainWindow(app)).visible).toBe(false)
  await pillWin().getByRole('button', { name: 'Open' }).click()
  await expect.poll(() => mainWindow(app).then((w) => w.visible)).toBe(true)
})

test('history can be hidden and stays hidden; a dictation and the prompt made from it are one row', async () => {
  ctx = await launch({ mode: null })
  const { app, page } = ctx
  // Hide with the toolbar button: the column slides away and the choice is remembered.
  await page.getByRole('button', { name: 'Hide history' }).click()
  await expect.poll(() => app.evaluate(() => globalThis.__promptlyE2E.config().historyHidden)).toBe(true)
  await expect(page.getByRole('button', { name: 'Show history' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show history' })).toBeVisible({ timeout: 10000 })
  // ⌃⌘S brings it back.
  await page.keyboard.press('Control+Meta+s')
  await expect(page.getByRole('button', { name: 'Hide history' })).toBeVisible()

  // Typing in Dictation makes a prompt; saving a dictation first and then making it a prompt pairs them.
  await page.evaluate(() => {
    const now = Date.now()
    localStorage.setItem('promptly_history', JSON.stringify([
      { id: 'p1', timestamp: now, transcript: 'plan the launch email', prompt: 'Role: …', mode: 'balanced' },
      { id: 'd1', timestamp: now - 1000, transcript: 'plan the launch email', prompt: 'plan the launch email', mode: 'dictate' },
      { id: 'd0', timestamp: now - 5000, transcript: 'note for Deepak', prompt: 'note for Deepak', mode: 'dictate' },
    ]))
  })
  await page.reload()
  const rows = page.locator('[data-history-entry]')
  await expect(rows).toHaveCount(2, { timeout: 10000 })
  await expect(rows.first()).toContainText('plan the launch email')
  await expect(rows.first().getByLabel('Made from a dictation')).toBeVisible()
})

test('the pill can be dragged out of the way, and comes back where you left it', async () => {
  ctx = await launch({ mode: null })
  const { app, fakeDir } = ctx
  const pillBounds = () => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('pill.html')).getBounds())

  await withClipboard(app, async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()))
    await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
    await expect.poll(() => appState(app)).toBe('RECORDING')
    const before = await pillBounds()

    // Drag it 300 px up (what pill.html sends while the pointer moves).
    const pill = app.windows().find((w) => w.url().includes('pill.html'))
    await pill.evaluate(() => {
      window.electronAPI.pillDrag({ phase: 'start' })
      window.electronAPI.pillDrag({ phase: 'move', dx: 0, dy: -300 })
      window.electronAPI.pillDrag({ phase: 'end' })
    })
    await expect.poll(() => pillBounds().then((b) => b.y)).toBe(before.y - 300)
    const saved = (await app.evaluate(() => globalThis.__promptlyE2E.config())).pillPosition
    expect(saved.fy).toBeLessThan(1)

    // The pill shows short labels (working, typed), never your words.
    fs.writeFileSync(path.join(fakeDir, 'transcript'), 'hello there')
    await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
    expect(await pill.locator('#pill').innerText()).not.toContain('hello there')

    // Next time it appears, it's where it was dropped.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()))
    await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
    await expect.poll(() => appState(app)).toBe('RECORDING')
    expect((await pillBounds()).y).toBe(before.y - 300)
  })
})

test('on a fresh start the window names double-tap Control and, without Accessibility, says what it needs', async () => {
  // The window's first requests (preferences, shortcut) must reach main: its handlers are
  // registered before any window loads.
  ctx = await launch({ mode: null })
  const { page } = ctx
  await expect(page.getByText('Double-tap Control and talk')).toBeVisible()
  await expect(page.getByText('Double-tap Control needs Accessibility: Settings (⌘/) → Allow. Until then, press ⌥ Space to start and stop.')).toBeVisible()
  await expect(page.getByText('Press ⌥ Space or click mic to start')).toBeVisible()
})

// ── Speech recognition ──

test('"Best accuracy" downloads once, is used for transcription, and takes the language you speak', async () => {
  const payload = Buffer.from('stand-in speech model '.repeat(5000))
  const server = http.createServer((req, res) => {
    if (req.url !== '/model.bin') { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Length': payload.length })
    res.end(payload)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  try {
    ctx = await launch({
      mode: null,
      speechModel: {
        file: 'accurate.bin',
        url: `http://127.0.0.1:${server.address().port}/model.bin`,
        sha256: crypto.createHash('sha256').update(payload).digest('hex'),
        bytes: payload.length,
      },
    })
    const { app, page, fakeDir } = ctx
    await page.keyboard.press('Meta+/')
    await page.getByRole('tab', { name: 'Speech' }).click()
    await page.getByRole('button', { name: /^Download \(/ }).click()
    // Downloading switches to it and offers the language.
    await expect(page.getByRole('radio', { name: /Best accuracy/ })).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })
    await page.locator('#settings-speechLanguage').selectOption('hi')
    expect((await page.evaluate(() => window.electronAPI.getPreferences())).speech).toMatchObject({ model: 'accurate', language: 'hi', installed: true })
    await page.getByRole('button', { name: 'Done' }).click()

    await dictateFromAnotherApp(app, page, fakeDir, 'यार, इस रिपोर्ट को छोटा कर दो')
    const args = fs.readFileSync(path.join(fakeDir, 'whisper-args'), 'utf8')
    expect(args).toMatch(/-m \S*accurate\.bin/)
    expect(args).toContain('-l hi')
    expect(args).not.toContain('--no-timestamps')

    // Removing it goes back to the built-in model.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('dist-renderer')).show())
    await page.keyboard.press('Meta+/')
    await page.getByRole('tab', { name: 'Speech' }).click()
    await page.getByRole('button', { name: /Remove the download/ }).click()
    await expect(page.getByRole('radio', { name: /Standard/ })).toHaveAttribute('aria-checked', 'true')
    expect((await page.evaluate(() => window.electronAPI.getPreferences())).speech).toMatchObject({ model: 'standard', installed: false })
  } finally {
    server.close()
  }
})


test('Polish: the tone switch redoes it, and Iterate shows the new text (not the old one)', async () => {
  ctx = await launch({ mode: 'polish' })
  const { app, page, fakeDir } = ctx
  await typeAndSubmit(page, 'so we ship it on friday')
  await expect(page.locator('#prompt-output')).toHaveText('so we ship it on friday (polished)', { timeout: 15000 })
  await expect(page.getByText('Tidied the wording')).toBeVisible()

  await page.getByRole('radio', { name: 'Casual' }).click()
  await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
  expect(await lastStdin(fakeDir)).toContain('Tone: Casual')

  fs.writeFileSync(path.join(fakeDir, 'transcript'), 'make it warmer')
  await page.getByRole('button', { name: '↻ Iterate' }).click()
  await expect.poll(() => appState(app)).toBe('ITERATING')
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.locator('#prompt-output')).toHaveText('make it warmer (polished)', { timeout: 15000 })
  const stdin = await lastStdin(fakeDir)
  expect(stdin).toContain('<polished_text>\nso we ship it on friday (polished)\n</polished_text>')
  expect(stdin).toContain('Tone: Casual')
})

test('Email: a tone chip revises the draft with your writing notes, and the revision is kept in history', async () => {
  ctx = await launch({ mode: 'email' })
  const { app, page, fakeDir } = ctx
  await page.evaluate(() => window.electronAPI.setPreferences({ voiceNotes: 'Sign off with Cheers, Sam' }))
  await typeAndSubmit(page, 'the release moves to friday')
  await expect.poll(() => appState(app), { timeout: 15000 }).toBe('EMAIL_READY')

  await page.getByRole('button', { name: 'More formal' }).click()
  await page.getByRole('button', { name: /Apply adjustment/ }).click()
  await expect.poll(() => calls(fakeDir).length, { timeout: 15000 }).toBe(2)
  await expect.poll(() => appState(app), { timeout: 15000 }).toBe('EMAIL_READY')
  await expect(page.getByText('About More formal').first()).toBeVisible()
  const stdin = await lastStdin(fakeDir)
  expect(stdin).toContain('<requested_change>\nMore formal\n</requested_change>')
  expect(stdin).toContain('Subject: About the release moves to friday')
  expect(stdin).toContain('Sign off with Cheers, Sam')
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('promptly_history') || '[]'))
  expect(history.filter((h) => h.mode === 'email')).toHaveLength(2)
  expect(history[0].prompt).toContain('About More formal')
})

test('Workflow: the n8n JSON is kept in history and copied, not just a summary line', async () => {
  ctx = await launch({ mode: 'workflow' })
  const { app, page } = ctx
  await withClipboard(app, async () => {
    await typeAndSubmit(page, 'when a form is sent post it in slack')
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('WORKFLOW_BUILDER')
    await page.getByRole('button', { name: /Confirm & generate JSON/ }).click()
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('WORKFLOW_BUILDER_DONE')
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem('promptly_history') || '[]'))
    const saved = JSON.parse(history[0].prompt)
    expect(saved).toMatchObject({ name: 'Form to Slack', nodes: [{ type: 'n8n-nodes-base.webhook' }] })
    await expect.poll(() => readClipboard(app)).toContain('"name": "Form to Slack"')
  })
})

test('Esc while a builder is working cancels it for good', async () => {
  ctx = await launch({ mode: 'workflow' })
  const { app, page, fakeDir } = ctx
  fs.writeFileSync(path.join(fakeDir, 'delay'), '3')
  await typeAndSubmit(page, 'when a form is sent post it in slack')
  await expect.poll(() => appState(app), { timeout: 15000 }).toBe('THINKING')
  await expect.poll(() => calls(fakeDir).length).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect.poll(() => appState(app)).toBe('IDLE')
  await page.waitForTimeout(3500)
  expect(await appState(app)).toBe('IDLE')
})
