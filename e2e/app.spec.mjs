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
last=$(printf '%s' "$input" | tail -n 1 | tr -d '"')
printf 'Role:\\nYou are a test assistant.\\n\\nTask:\\n%s\\n' "$last"
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
echo "spoken words from the fake mic"
`, { mode: 0o755 })
  fs.writeFileSync(path.join(engineDir, 'ggml-base.en-q5_1.bin'), 'fake model')
  const whisper = path.join(dir, 'whisper')
  fs.writeFileSync(whisper, '#!/bin/bash\nexit 1\n', { mode: 0o755 })
  const ffmpeg = path.join(dir, 'ffmpeg')
  fs.writeFileSync(ffmpeg, '#!/bin/bash\nexit 0\n')
  fs.chmodSync(ffmpeg, 0o755)
  return { claude, whisper, ffmpeg: path.join(dir, 'ffmpeg'), engineDir }
}

async function launch({ setupComplete = true, signedOut = false } = {}) {
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
    env: { ...process.env, PROMPTLY_USER_DATA: userData, PROMPTLY_WHISPER_DIR: tools.engineDir, FAKE_DIR: fakeDir, TMPDIR: tmpDir },
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

test('hotkey brings a hidden bar back and records from the prompt screen', async () => {
  ctx = await launch()
  const { app, page, fakeDir, tmpDir } = ctx
  await typeAndSubmit(page, 'first prompt')
  await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()))
  expect((await mainWindow(app)).visible).toBe(false)

  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect.poll(() => appState(app)).toBe('RECORDING')
  expect((await mainWindow(app)).visible).toBe(true)
  // Option+P is claimed only while recording.
  expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Alt+P'))).toBe(true)

  await page.waitForTimeout(1200)
  await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
  await expect(page.getByText('spoken words from the fake mic').first()).toBeVisible({ timeout: 15000 })
  await expect.poll(() => appState(app)).toBe('PROMPT_READY')
  expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Alt+P'))).toBe(false)

  // The recording reached the engine as 16 kHz mono WAV (converted in the renderer, no ffmpeg).
  const wav = fs.readFileSync(path.join(fakeDir, 'last-audio.wav'))
  expect(wav.subarray(0, 4).toString()).toBe('RIFF')
  expect(wav.readUInt32LE(24)).toBe(16000)
  expect(wav.readUInt16LE(22)).toBe(1)
  // The recording is deleted once it has been transcribed.
  expect(fs.readdirSync(path.join(tmpDir, 'promptly-audio'))).toEqual([])
  const last = calls(fakeDir).at(-1)
  expect(fs.readFileSync(path.join(fakeDir, last.replace('.args', '.stdin')), 'utf8')).toContain('spoken words from the fake mic')
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
