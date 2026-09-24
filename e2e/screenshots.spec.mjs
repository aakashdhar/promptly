// Captures the main screens in light and dark for design review.
// Run with: SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.mjs  (writes to test-results/screens/)
import { test, _electron as electron, expect } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'test-results', 'screens')

test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to capture design screenshots')

function fakeTools(dir) {
  const claude = path.join(dir, 'claude')
  fs.writeFileSync(claude, `#!/bin/bash
if [ "$1" = "--version" ]; then echo "2.1.0 (Claude Code)"; exit 0; fi
if [ "$1" = "auth" ]; then echo '{"loggedIn": true}'; exit 0; fi
cat > /dev/null
printf 'Role:\\nYou are a senior full-stack engineer.\\n\\nTask:\\nBuild a small internal dashboard that pulls support tickets from Zendesk every five minutes, groups them by product area, and highlights anything waiting more than four hours.\\n\\nContext:\\nThe support team lead wants a daily summary email at 9am.\\n\\nConstraints:\\nNext.js, Postgres, deployed on Vercel. Keep the design simple: tables and a couple of counters, no charts.\\n\\nOutput format:\\nA project plan followed by the code for the ticket sync job.\\n'
`, { mode: 0o755 })
  const engine = path.join(dir, 'engine')
  fs.mkdirSync(engine)
  fs.writeFileSync(path.join(engine, 'whisper-cli'), '#!/bin/bash\necho "hello"\n', { mode: 0o755 })
  fs.writeFileSync(path.join(engine, 'ggml-base.en-q5_1.bin'), 'x')
  return { claude, engine }
}

async function launch(theme, setupComplete = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-shots-'))
  const userData = path.join(dir, 'userData')
  fs.mkdirSync(userData)
  const tools = fakeTools(dir)
  fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ setupComplete, theme, claudePath: tools.claude }))
  const app = await electron.launch({
    args: [ROOT], cwd: ROOT,
    env: { ...process.env, PROMPTLY_USER_DATA: userData, PROMPTLY_WHISPER_DIR: tools.engine, TMPDIR: dir },
  })
  return { app, dir }
}

async function mainPage(app) {
  await expect.poll(async () => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some((w) => w.webContents.getURL().includes('dist-renderer') && w.isVisible())
  ), { timeout: 20000 }).toBe(true)
  return app.windows().find((w) => w.url().includes('dist-renderer'))
}

for (const theme of ['dark', 'light']) {
  test(`main screens — ${theme}`, async () => {
    fs.mkdirSync(OUT, { recursive: true })
    const { app, dir } = await launch(theme)
    const page = await mainPage(app)
    // Playwright forces a light colour scheme unless told otherwise.
    await page.emulateMedia({ colorScheme: theme })
    const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: path.join(OUT, `${theme}-${name}.png`) }) }

    await shot('1-idle')
    await page.keyboard.press('Meta+t')
    const box = page.getByPlaceholder('Describe what you want Claude to build, design, or write...')
    await box.fill('internal dashboard for the support team, zendesk tickets, nextjs and postgres')
    await shot('2-typing')
    await box.press('Meta+Enter')
    await expect(page.getByText('Copy prompt')).toBeVisible({ timeout: 15000 })
    await shot('3-prompt-ready')
    await page.keyboard.press('Meta+/')
    await shot('4-settings')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.getByText('Balanced').first().click()
    await shot('5-mode-dropdown')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Expand' }).click()
    await page.waitForTimeout(800)
    await shot('6-expanded')

    await app.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test(`setup wizard — ${theme}`, async () => {
    fs.mkdirSync(OUT, { recursive: true })
    const { app, dir } = await launch(theme, false)
    const setup = await app.waitForEvent('window', { predicate: (w) => w.url().includes('splash.html') })
    await setup.emulateMedia({ colorScheme: theme })
    const shot = async (name) => { await setup.waitForTimeout(400); await setup.screenshot({ path: path.join(OUT, `${theme}-setup-${name}.png`) }) }
    await shot('1-welcome')
    await setup.getByRole('button', { name: 'Set up Promptly' }).click()
    await shot('2-mic')
    await setup.locator('#mic-next').click()
    await expect(setup.getByText('Claude Code is ready.')).toBeVisible({ timeout: 10000 })
    await shot('3-claude')
    await setup.evaluate(() => { document.getElementById('claude-ready').classList.remove('visible'); document.getElementById('claude-not-installed').classList.add('visible') })
    await shot('3b-claude-missing')
    await setup.locator('#claude-next').click()
    await shot('4-done')
    await app.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })
}
