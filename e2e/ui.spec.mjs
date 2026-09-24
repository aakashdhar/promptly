// Walks every screen in light and dark, saves a screenshot of each (test-results/ui/) and runs
// the layout checks in layout-audit.mjs: nothing cut off, nothing pressed against the window
// edge, no controls on top of each other, text large and strong enough to read.
import { test, _electron as electron, expect } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { auditLayout, formatIssues } from './layout-audit.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'test-results', 'ui')

const PROMPT = `Role:
You are a senior full-stack engineer who has shipped internal tools for support teams.

Task:
Build a small internal dashboard that pulls support tickets from Zendesk every five minutes, groups them by product area, and highlights anything waiting more than four hours.

Context:
The support team lead wants a daily summary email at 9am. Tickets live in the Zendesk instance at https://betacraft-support.zendesk.com/api/v2/tickets/recent.json?include=users,organizations and the repo is at ~/Documents/GitHub-personal/support-dashboard/apps/web/src/features/tickets.

Constraints:
- Next.js 15 with the App Router, Postgres through Drizzle, deployed on Vercel.
- Keep the design simple: tables and a couple of counters, no charts.
- Don't store customer email addresses.

Output format:
A short project plan, then the code for the ticket sync job with tests.`

// A stand-in for the Claude CLI that answers each Promptly request with realistic content.
function writeFakeClaude(dir) {
  const answers = {
    prompt: PROMPT,
    polish: 'POLISHED:\nCould you send me the quarterly numbers by Thursday? I want to review them before the board meeting on Friday morning.\n\nCHANGES:\n· Removed filler words\n· Split a run-on sentence\n· Made the request direct',
    email: JSON.stringify({
      subject: 'Release moved to Friday: what it means for the onboarding launch',
      body: 'Hi team,\n\nThe release is moving from Wednesday to Friday so we can finish load testing the new sync service.\n\nNothing changes for the onboarding launch itself: marketing emails still go out Monday, and support has the updated FAQ.\n\nIf Friday causes a problem for anything you own, tell me by tomorrow noon.\n\nThanks,\nAakash',
      toneAnalysis: { recipient: 'Internal team', tone: 'Direct and reassuring', coreMessage: 'The release moved; the launch is unaffected', approach: 'Lead with the change, then what stays the same', whyThisTone: 'The team needs facts quickly without alarm' },
    }),
    imageAnalysis: '{"subject":{"subject":"Red fox","setting":"Snowy forest","emotion":"Calm","framing":"Close-up","negativePrompts":[]},"lighting":{"timeOfDay":"Golden hour","lightType":"Directional sun","quality":"Warm amber","lensFlare":"None"},"camera":{"lens":"85mm portrait","aperture":"f/1.4 shallow","aspectRatio":"4:5 portrait","angle":"Eye level","filmSim":"Kodak Portra 400"},"style":{"visualStyle":"Cinematic film still","colorGrade":"Warm teal-orange","filmGrain":"35mm grain","reference":"Emmanuel Lubezki"},"technical":{"resolution":"Ultra HD 4K","renderQuality":"Photorealistic","stylise":750,"chaos":20,"weird":0,"seed":null}}',
    imageVariations: '{"variations":[{"id":1,"prompt":"A red fox resting in fresh snow among birch trees, soft golden light","focus":"natural"},{"id":2,"prompt":"A red fox in a snowy clearing, dramatic low sun and long shadows","focus":"editorial"},{"id":3,"prompt":"A red fox framed by frosted branches, cinematic teal-orange grade","focus":"cinematic"}]}',
    imageAssembly: '{"prompt":"A calm red fox in a snowy forest at golden hour, eye-level close-up with an 85mm lens at f/1.4, warm amber light, Kodak Portra 400 film look, vertical 4:5 composition, photorealistic","flags":"--ar 4:5 --stylize 750 --chaos 20"}',
    videoDefaults: '{"cameraMovement":["Slow push-in"],"shotType":["Medium"],"aspectRatio":"16:9","resolution":"1080p","cinematicStyle":["Cinematic film"],"lighting":["Golden hour"],"colourGrade":["Teal & orange"],"pacing":["Slow cuts"],"audio":["Ambient sound"],"settingDetail":"A quiet harbour at dawn","useFirstFrame":false,"referenceImages":false}',
    videoPrompt: 'A slow push-in on a fishing boat leaving a quiet harbour at dawn, medium shot, golden-hour light with a teal and orange grade, 16:9 at 1080p, gentle ambient sound of gulls and water.',
    workflowAnalysis: '{"workflowName":"New Typeform response to Slack and Google Sheets","trigger":"A new Typeform response arrives","nodes":[{"id":1,"name":"Typeform Trigger","type":"n8n-nodes-base.typeformTrigger","purpose":"Starts the workflow on each new response","operation":"onFormSubmit","parameters":{"formId":"FORM_ID"},"placeholders":["formId"],"credentialType":"typeformApi"},{"id":2,"name":"Append to Google Sheets","type":"n8n-nodes-base.googleSheets","purpose":"Adds the answers as a new row","operation":"append","parameters":{"spreadsheetId":"SPREADSHEET_ID","sheetName":"SHEET_NAME"},"placeholders":["spreadsheetId","sheetName"],"credentialType":"googleSheetsOAuth2Api"},{"id":3,"name":"Post to Slack","type":"n8n-nodes-base.slack","purpose":"Tells the team a response came in","operation":"postMessage","parameters":{"channel":"CHANNEL"},"placeholders":["channel"],"credentialType":"slackApi"}],"connections":"linear 1→2→3","connectionsMap":{"Typeform Trigger":["Append to Google Sheets"],"Append to Google Sheets":["Post to Slack"]},"credentialsNeeded":["typeformApi","googleSheetsOAuth2Api","slackApi"],"placeholderCount":4}',
    workflowJson: '{"name":"New Typeform response to Slack and Google Sheets","nodes":[{"parameters":{"formId":"abc123"},"name":"Typeform Trigger","type":"n8n-nodes-base.typeformTrigger","typeVersion":1,"position":[250,300]}],"connections":{}}',
  }
  const answersFile = path.join(dir, 'answers.json')
  fs.writeFileSync(answersFile, JSON.stringify(answers))
  const claude = path.join(dir, 'claude')
  fs.writeFileSync(claude, `#!/usr/bin/env node
const fs = require('fs')
const args = process.argv.slice(2)
if (args[0] === '--version') { console.log('2.1.0 (Claude Code)'); process.exit(0) }
if (args[0] === 'auth') { console.log(JSON.stringify({ loggedIn: !fs.existsSync(${JSON.stringify(path.join(dir, 'signed-out'))}) })); process.exit(0) }
const a = JSON.parse(fs.readFileSync(${JSON.stringify(answersFile)}, 'utf8'))
let input = ''
process.stdin.on('data', (d) => { input += d })
process.stdin.on('end', () => {
  const delayFile = ${JSON.stringify(path.join(dir, 'delay'))}
  const delay = fs.existsSync(delayFile) ? Number(fs.readFileSync(delayFile, 'utf8')) * 1000 : 0
  setTimeout(() => {
    if (fs.existsSync(${JSON.stringify(path.join(dir, 'fail'))})) { process.stderr.write('simulated failure'); process.exit(1) }
    const has = (s) => input.includes(s)
    const out =
      has("Analyse the user's spoken image idea") ? a.imageAnalysis
      : has('Generate exactly 3 distinct prompt variations') ? a.imageVariations
      : has('Assemble a final') ? a.imageAssembly
      : has('expert email writer') ? a.email
      : has('POLISHED:') ? a.polish
      : has("Veo 3.1 (Google's") ? a.videoDefaults
      : has('Assemble the following parameters') ? a.videoPrompt
      : has('n8n workflow engineer. Analyse') ? a.workflowAnalysis
      : has('Generate a complete, valid n8n workflow JSON') ? a.workflowJson
      : a.prompt
    if (args.includes('stream-json')) console.log(JSON.stringify({ type: 'result', is_error: false, result: out }))
    else process.stdout.write(out + '\\n')
  }, delay)
})
`, { mode: 0o755 })
  return claude
}

function writeFakeHelper(dir, trusted) {
  const helper = path.join(dir, 'promptly-helper')
  fs.writeFileSync(helper, `#!/usr/bin/env node
const rl = require('readline').createInterface({ input: process.stdin })
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n')
out({ type: 'ready', trusted: ${trusted}, tap: ${trusted} })
rl.on('line', (line) => {
  const m = JSON.parse(line)
  if (m.cmd === 'context') out({ type: 'context', id: m.id, app: { name: 'Visual Studio Code', bundleId: 'com.microsoft.VSCode', pid: 1 }, selectedText: 'TypeError: cannot read properties of undefined' })
  else out({ type: 'status', id: m.id, trusted: ${trusted}, tap: ${trusted} })
})
rl.on('close', () => process.exit(0))
`, { mode: 0o755 })
  return helper
}

async function launch(theme, { setupComplete = true, helper = null, config = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-ui-'))
  const userData = path.join(dir, 'userData')
  fs.mkdirSync(userData)
  const claude = writeFakeClaude(dir)
  const engine = path.join(dir, 'engine')
  fs.mkdirSync(engine)
  fs.writeFileSync(path.join(engine, 'whisper-cli'), '#!/bin/bash\necho "internal dashboard for the support team, zendesk tickets, nextjs and postgres"\n', { mode: 0o755 })
  fs.writeFileSync(path.join(engine, 'ggml-base.en-q5_1.bin'), 'x')
  fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ setupComplete, theme, claudePath: claude, ...config }))
  const app = await electron.launch({
    args: [ROOT], cwd: ROOT,
    env: {
      ...process.env,
      PROMPTLY_USER_DATA: userData,
      PROMPTLY_WHISPER_DIR: engine,
      PROMPTLY_HELPER: helper === null ? path.join(dir, 'no-helper') : writeFakeHelper(dir, helper),
      TMPDIR: dir,
    },
  })
  return { app, dir }
}

async function mainPage(app) {
  await expect.poll(async () => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some((w) => w.webContents.getURL().includes('dist-renderer') && w.isVisible())
  ), { timeout: 20000 }).toBe(true)
  return app.windows().find((w) => w.url().includes('dist-renderer'))
}

const appState = (app) => app.evaluate(() => globalThis.__promptlyE2E.appState())

// Screenshot + layout audit for one screen. Issues are collected, not thrown, so a single run
// reports every problem at once.
function recorder(theme, found) {
  return async (page, name, opts) => {
    const issues = await auditLayout(page, opts)
    await page.screenshot({ path: path.join(OUT, `${theme}-${name}.png`) })
    if (issues.length) found.push(formatIssues(`${theme}/${name}`, issues))
  }
}

async function typeAndSubmit(page, text) {
  await page.keyboard.press('Meta+t')
  const box = page.getByPlaceholder('Describe what you want Claude to build, design, or write...')
  await expect(box).toBeVisible()
  await box.fill(text)
  await box.press('Meta+Enter')
}

async function switchMode(app, page, mode) {
  await page.evaluate((m) => localStorage.setItem('mode', m), mode)
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await page.emulateMedia({ colorScheme: page.__theme })
  await page.waitForTimeout(900)
  await sizeExpanded(app, 1280, 800)
}

// The expanded window normally fills the screen; review it at a common laptop size and at a
// small one.
async function sizeExpanded(app, width, height) {
  await app.evaluate(({ BrowserWindow }, [w, h]) => {
    const win = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes('dist-renderer'))
    if (win.getSize()[0] > 520) { win.unmaximize(); win.setBounds({ x: 40, y: 40, width: w, height: h }) }
  }, [width, height])
}

async function scrollAll(page, selector = '[data-scroll-region], .overflow-y-auto, .overflow-auto') {
  await page.evaluate((sel) => document.querySelectorAll(sel).forEach((el) => { el.scrollTop = el.scrollHeight }), selector)
}

for (const theme of ['dark', 'light']) {
  test(`main window — ${theme}`, async () => {
    test.setTimeout(240000)
    fs.mkdirSync(OUT, { recursive: true })
    const found = []
    const check = recorder(theme, found)
    const { app, dir } = await launch(theme)
    const page = await mainPage(app)
    page.__theme = theme
    // Playwright forces a light colour scheme unless told otherwise.
    await page.emulateMedia({ colorScheme: theme })

    await check(page, 'idle', { settle: 800 })
    await page.getByText('Balanced').first().click()
    await check(page, 'mode-menu')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Meta+?')
    await check(page, 'shortcuts')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Meta+/')
    await check(page, 'settings')
    await scrollAll(page)
    await check(page, 'settings-bottom')
    await page.keyboard.press('Escape')

    await page.keyboard.press('Meta+t')
    await check(page, 'typing-empty')
    const box = page.getByPlaceholder('Describe what you want Claude to build, design, or write...')
    await box.fill('internal dashboard for the support team, zendesk tickets, nextjs and postgres. it should highlight anything waiting more than four hours and send a summary to the team lead every morning')
    await check(page, 'typing-filled')
    fs.writeFileSync(path.join(dir, 'delay'), '4')
    await box.press('Meta+Enter')
    await expect.poll(() => appState(app)).toBe('THINKING')
    await check(page, 'thinking', { settle: 1200 })
    await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
    fs.rmSync(path.join(dir, 'delay'))
    await check(page, 'prompt-ready', { settle: 800 })
    await scrollAll(page)
    await check(page, 'prompt-ready-bottom')

    await page.keyboard.press('Meta+h')
    await check(page, 'history')
    await page.keyboard.press('Escape')
    await expect.poll(() => appState(app)).not.toBe('HISTORY')

    // A failed request.
    await page.keyboard.press('Escape')
    await expect.poll(() => appState(app)).toBe('IDLE')
    fs.writeFileSync(path.join(dir, 'fail'), '')
    await typeAndSubmit(page, 'this one fails')
    await expect.poll(() => appState(app), { timeout: 15000 }).toMatch(/ERROR/)
    await check(page, 'generation-error', { settle: 800 })
    fs.rmSync(path.join(dir, 'fail'))

    // Polish
    await switchMode(app, page, 'polish')
    await check(page, 'polish-idle')
    await typeAndSubmit(page, 'so um can you send me the quarterly numbers by thursday i want to review them before the board meeting friday morning')
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')
    await check(page, 'polish-ready', { settle: 800 })

    // Email (opens expanded)
    await switchMode(app, page, 'email')
    await check(page, 'email-idle', { settle: 800 })
    await typeAndSubmit(page, 'tell the team the release moved to friday but the onboarding launch is unaffected')
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('EMAIL_READY')
    await check(page, 'email-ready', { settle: 800 })

    // Image builder
    await switchMode(app, page, 'image')
    await typeAndSubmit(page, 'a calm red fox in a snowy forest')
    await expect(page.getByRole('button', { name: /Confirm & assemble prompt/ })).toBeEnabled({ timeout: 15000 })
    await check(page, 'image-builder', { settle: 800 })
    await sizeExpanded(app, 960, 680)
    await check(page, 'image-builder-small', { settle: 600 })
    await sizeExpanded(app, 1280, 800)
    await page.getByRole('button', { name: /Confirm & assemble prompt/ }).click()
    await expect(page.getByText('Midjourney flags (optional)')).toBeVisible({ timeout: 15000 })
    await check(page, 'image-done', { settle: 800 })

    // Video builder
    await switchMode(app, page, 'video')
    await typeAndSubmit(page, 'a fishing boat leaving a quiet harbour at dawn')
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('VIDEO_BUILDER')
    await check(page, 'video-builder', { settle: 800 })

    // Workflow builder
    await switchMode(app, page, 'workflow')
    await typeAndSubmit(page, 'when someone fills in the typeform add a row to google sheets and post in slack')
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('WORKFLOW_BUILDER')
    await check(page, 'workflow-builder', { settle: 800 })

    // Expanded view with history and a selected entry.
    await switchMode(app, page, 'balanced')
    await page.getByRole('button', { name: 'Expand' }).click()
    await page.waitForTimeout(500)
    await sizeExpanded(app, 1280, 800)
    await check(page, 'expanded', { settle: 900 })
    await page.locator('[data-history-entry]').last().click()
    await check(page, 'expanded-entry', { settle: 600 })
    await page.getByRole('button', { name: 'Collapse' }).click().catch(() => {})

    // Recording in the window.
    await page.keyboard.press('Escape')
    await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
    await expect.poll(() => appState(app)).toBe('RECORDING')
    await check(page, 'recording', { settle: 900 })
    await app.evaluate(() => globalThis.__promptlyE2E.pressHotkey())
    await expect.poll(() => appState(app), { timeout: 15000 }).toBe('PROMPT_READY')

    // The floating pill.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.hide()))
    const pill = app.windows().find((w) => w.url().includes('pill.html'))
    await pill.emulateMedia({ colorScheme: theme })
    const pillState = (state) => app.evaluate(({ BrowserWindow }, s) => {
      const p = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('pill.html'))
      p.showInactive()
      p.webContents.send('pill-state', s)
      if (s.state === 'recording') for (let n = 0; n < 20; n++) p.webContents.send('audio-level', Math.abs(Math.sin(n / 2)) * 0.8)
    }, state)
    await pillState({ state: 'recording', mode: 'Balanced', context: { appName: 'Visual Studio Code', selectedText: 'x' } })
    await check(pill, 'pill-recording')
    await pillState({ state: 'thinking', text: 'Role: You are a senior full-stack engineer. Task: Fix the TypeError in the upload job' })
    await check(pill, 'pill-thinking')
    await pillState({ state: 'copied' })
    await check(pill, 'pill-copied')

    await app.close()
    fs.rmSync(dir, { recursive: true, force: true })
    fs.writeFileSync(path.join(OUT, `${theme}-main-issues.txt`), found.join('\n'))
    expect(found, `layout problems:\n${found.join('\n')}`).toEqual([])
  })

  test(`setup wizard — ${theme}`, async () => {
    fs.mkdirSync(OUT, { recursive: true })
    const found = []
    const check = recorder(theme, found)
    const { app, dir } = await launch(theme, { setupComplete: false, helper: false })
    const setup = await app.waitForEvent('window', { predicate: (w) => w.url().includes('splash.html') })
    await setup.emulateMedia({ colorScheme: theme })
    await check(setup, 'setup-welcome')
    await setup.getByRole('button', { name: 'Set up Promptly' }).click()
    await check(setup, 'setup-mic')
    await setup.locator('#mic-next').click()
    await expect(setup.getByText('Claude Code is ready.')).toBeVisible({ timeout: 10000 })
    await check(setup, 'setup-claude-ready')
    await setup.evaluate(() => { document.getElementById('claude-ready').classList.remove('visible'); document.getElementById('claude-not-installed').classList.add('visible') })
    await check(setup, 'setup-claude-missing')
    await setup.locator('details').first().evaluate((d) => { d.open = true }).catch(() => {})
    await check(setup, 'setup-claude-manual')
    await setup.locator('#claude-next').click()
    await check(setup, 'setup-hold')
    await setup.evaluate(() => document.getElementById('hold-next').click())
    await check(setup, 'setup-done')
    await app.close()
    fs.rmSync(dir, { recursive: true, force: true })
    fs.writeFileSync(path.join(OUT, `${theme}-setup-issues.txt`), found.join('\n'))
    expect(found, `layout problems:\n${found.join('\n')}`).toEqual([])
  })
}
