// End-to-end tests that drive the real Electron app with a fake `claude` CLI.
// Run with: npm run test:e2e (builds the renderer first).
import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'fs'
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
last=$(printf '%s' "$input" | tail -n 1 | tr -d '"')
out=$(printf 'Role:\\nYou are a test assistant.\\n\\nTask:\\n%s' "$last")
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
  // Fake built-in engine (whisper-cli + model): only accepts WAV, like the real one.
  const engineDir = path.join(dir, 'engine')
  fs.mkdirSync(engineDir)
  fs.writeFileSync(path.join(engineDir, 'whisper-cli'), `#!/bin/bash
f=""; prev=""
for a in "$@"; do [ "$prev" = "-f" ] && f="$a"; prev="$a"; done
[ "$(head -c 4 "$f")" = "RIFF" ] || { echo "expected WAV input" >&2; exit 1; }
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
  if (m.cmd === 'context') out({ type: 'context', id: m.id, app: { name: 'Terminal', bundleId: 'com.apple.Terminal', pid: 1 }, selectedText: 'TypeError: cannot read properties of undefined' })
  else out({ type: 'status', id: m.id, trusted: true, tap: true })
})
rl.on('close', () => process.exit(0))
`, { mode: 0o755 })
  return { claude, whisper, ffmpeg: path.join(dir, 'ffmpeg'), engineDir, helper }
}

async function launch({ setupComplete = true, signedOut = false, withHelper = false } = {}) {
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
    },
  })
  if (!setupComplete) return { app, dir, fakeDir, tmpDir }
  // Setup is complete, so the bar opens directly (no splash).
  await expect.poll(async () => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some((w) => w.webContents.getURL().includes('dist-renderer') && w.isVisible())
  ), { timeout: 20000 }).toBe(true)
  const page = app.windows().find((w) => w.url().includes('dist-renderer'))
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
  expect(stdin).toContain('Mode: Balanced')
  expect(stdin).toContain('"make a todo app with dark mode"')
})

test('aborting while thinking cancels Claude and the next request still shows', async () => {
  ctx = await launch()
  const { page, fakeDir } = ctx
  fs.writeFileSync(path.join(fakeDir, 'delay'), '4')
  await typeAndSubmit(page, 'first request that gets aborted')
  await expect.poll(() => calls(fakeDir).length, { timeout: 10000 }).toBe(1)

  await page.getByTitle('Reset to start').click()
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
  await page.getByText('Balanced').first().click()
  for (const m of modes) await expect(page.getByText(m.desc)).toBeVisible()
})

test('hotkey from another app records in the pill, then shows the prompt and copies it', async () => {
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
    // The result opens the window, the pill says it was copied, and the clipboard has the prompt.
    await expect.poll(() => mainWindow(app).then((w) => w.visible)).toBe(true)
    expect(await app.evaluate(() => globalThis.__promptlyE2E.pillState()?.state)).toBe('copied')
    await expect.poll(() => readClipboard(app)).toContain('spoken words from the fake mic')
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

test('the bar stays up while typing and hides from the prompt screen', async () => {
  ctx = await launch()
  const { app, page } = ctx
  const blur = () => app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes('dist-renderer')).emit('blur')
  })
  await page.keyboard.press('Meta+t')
  await expect.poll(() => appState(app)).toBe('TYPING')
  await blur()
  expect((await mainWindow(app)).visible).toBe(true)

  const box = page.getByPlaceholder('Describe what you want Claude to build, design, or write...')
  await box.fill('something to paste elsewhere')
  await box.press('Meta+Enter')
  await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
  await blur()
  expect((await mainWindow(app)).visible).toBe(false)
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
  expect(stdin).toContain('"fix this error in the upload job"')
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
  expect(stdin).toContain('Mode: Code')
  expect(stdin).toContain('"Add retries to the upload job"')
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
  expect(before).toMatchObject({ hotkey: 'option-space', autoCopy: true, dictionary: '' })
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
  await expect(setup.getByText('Hold to talk is on.')).toBeVisible({ timeout: 5000 })
  await setup.locator('#hold-next').click()
  await expect(setup.getByText('Hold this anywhere on your Mac and talk.', { exact: false })).toBeVisible({ timeout: 5000 })
})
