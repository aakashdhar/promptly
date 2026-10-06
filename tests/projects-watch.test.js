import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { createFolderWatcher, isIgnored, IGNORED_DIRS } = require('../main/projects/watch.js')

const DIR = '/Users/me/Projects/Acme'

// Stands in for fs.watch: records each call and hands back an EventEmitter with close().
function fakeWatch() {
  const calls = []
  const watchers = []
  const impl = vi.fn((dir, opts) => {
    calls.push({ dir, opts })
    const w = new EventEmitter()
    w.close = vi.fn(() => { w.closed = true })
    watchers.push(w)
    return w
  })
  return { impl, calls, watchers, last: () => watchers[watchers.length - 1] }
}

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// Lets a settled onChange promise run its .then before the next timer step.
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('project folder watcher (PRJ-005)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('watches the whole folder recursively, once', () => {
    const fake = fakeWatch()
    const w = createFolderWatcher({ dir: DIR, onChange: vi.fn(), watchImpl: fake.impl })
    expect(fake.calls).toEqual([])
    w.start()
    w.start()
    expect(fake.calls).toEqual([{ dir: DIR, opts: { recursive: true } }])
    expect(w.failed).toBe(false)
    w.stop()
  })

  it('calls onChange once, 2 s after a change by default (inside the ~3 s freshness budget)', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, watchImpl: fake.impl })
    w.start()
    fake.last().emit('change', 'rename', 'emails/2026-10-06 Re budget.eml')
    vi.advanceTimersByTime(1999)
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10000)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('restarts the quiet period on each event, so a burst is one rescan', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 1000, watchImpl: fake.impl })
    w.start()
    for (let i = 0; i < 5; i++) {
      fake.last().emit('change', 'change', `notes/file-${i}.md`)
      vi.advanceTimersByTime(800)
    }
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('ignores churn inside .git and node_modules, at any depth and with either separator', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 100, watchImpl: fake.impl })
    w.start()
    for (const name of ['.git', '.git/index', '.git/objects/ab/cdef', 'node_modules/x/index.js', 'site/node_modules/y.js', 'app\\node_modules\\z.js', 'repo\\.git\\HEAD']) {
      fake.last().emit('change', 'change', name)
    }
    vi.advanceTimersByTime(5000)
    expect(onChange).not.toHaveBeenCalled()
    w.stop()
  })

  it('still counts files that only look like the ignored folders', () => {
    for (const name of ['.gitignore', '.github/workflows/ci.yml', 'docs/node_modules.md', 'my.git/notes.txt', 'Notes.md']) {
      expect(isIgnored(name)).toBe(false)
    }
    expect(isIgnored(Buffer.from('.git/index'))).toBe(true)
  })

  it('treats an event with no filename as a change', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 100, watchImpl: fake.impl })
    w.start()
    fake.last().emit('change', 'rename', null)
    vi.advanceTimersByTime(100)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('poke() goes through the same debounce and merges with watch events', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 500, watchImpl: fake.impl })
    w.start()
    w.poke()
    vi.advanceTimersByTime(300)
    fake.last().emit('change', 'change', 'a.md')
    vi.advanceTimersByTime(300)
    w.poke()
    vi.advanceTimersByTime(499)
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('poke() works without start() (folders that are never watched)', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 100, watchImpl: fake.impl })
    w.poke()
    vi.advanceTimersByTime(100)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(fake.impl).not.toHaveBeenCalled()
  })

  it('never runs onChange twice at once; changes during a rescan give exactly one more, after it settles', async () => {
    const fake = fakeWatch()
    const runs = []
    let active = 0
    let maxActive = 0
    const onChange = vi.fn(() => {
      active++
      maxActive = Math.max(maxActive, active)
      const d = deferred()
      runs.push(d)
      return d.promise.finally(() => { active-- })
    })
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 1000, watchImpl: fake.impl })
    w.start()
    w.poke()
    vi.advanceTimersByTime(1000)
    expect(onChange).toHaveBeenCalledTimes(1)

    // Lots of activity while the first rescan is still running.
    fake.last().emit('change', 'rename', 'new.eml')
    w.poke()
    vi.advanceTimersByTime(5000)
    fake.last().emit('change', 'change', 'other.md')
    w.poke()
    vi.advanceTimersByTime(5000)
    expect(onChange).toHaveBeenCalledTimes(1)

    runs[0].resolve()
    await flush()
    vi.advanceTimersByTime(999)
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(2)

    runs[1].resolve()
    await flush()
    vi.advanceTimersByTime(10000)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(maxActive).toBe(1)
    w.stop()
  })

  it('a rescan with no changes during it is not followed by another', async () => {
    const fake = fakeWatch()
    const d = deferred()
    const onChange = vi.fn(() => d.promise)
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 100, watchImpl: fake.impl })
    w.start()
    w.poke()
    vi.advanceTimersByTime(100)
    d.resolve()
    await flush()
    vi.advanceTimersByTime(10000)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('keeps working after onChange rejects or throws', async () => {
    const fake = fakeWatch()
    const d = deferred()
    const onChange = vi.fn()
      .mockImplementationOnce(() => d.promise)
      .mockImplementationOnce(() => { throw new Error('scan blew up') })
      .mockImplementation(() => undefined)
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 100, watchImpl: fake.impl })
    w.start()
    w.poke()
    vi.advanceTimersByTime(100)
    fake.last().emit('change', 'change', 'b.md')
    d.reject(new Error('extract failed'))
    await flush()
    vi.advanceTimersByTime(100)
    expect(onChange).toHaveBeenCalledTimes(2)
    w.poke()
    vi.advanceTimersByTime(100)
    expect(onChange).toHaveBeenCalledTimes(3)
    w.stop()
  })

  it('a watcher error closes the watcher, sets failed, and poke() still rescans (network drive)', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 100, watchImpl: fake.impl })
    w.start()
    const dead = fake.last()
    expect(() => dead.emit('error', Object.assign(new Error('EIO'), { code: 'EIO' }))).not.toThrow()
    expect(dead.close).toHaveBeenCalledTimes(1)
    expect(w.failed).toBe(true)

    // A dead watcher's late events and errors are harmless.
    dead.emit('change', 'change', 'late.md')
    expect(() => dead.emit('error', new Error('again'))).not.toThrow()
    vi.advanceTimersByTime(1000)
    expect(onChange).not.toHaveBeenCalled()

    w.poke()
    vi.advanceTimersByTime(100)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('a watch that cannot start sets failed without throwing, and poke() still rescans', () => {
    const onChange = vi.fn()
    const watchImpl = vi.fn(() => {
      throw Object.assign(new Error('recursive watch unavailable'), { code: 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM' })
    })
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 100, watchImpl })
    expect(() => w.start()).not.toThrow()
    expect(w.failed).toBe(true)
    w.poke()
    vi.advanceTimersByTime(100)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('start() after a failure tries to watch again', () => {
    const fake = fakeWatch()
    let fail = true
    const watchImpl = vi.fn((dir, opts) => {
      if (fail) throw new Error('ENOENT')
      return fake.impl(dir, opts)
    })
    const w = createFolderWatcher({ dir: DIR, onChange: vi.fn(), watchImpl })
    w.start()
    expect(w.failed).toBe(true)
    fail = false
    w.start()
    expect(w.failed).toBe(false)
    expect(fake.calls).toHaveLength(1)
    w.stop()
    expect(fake.last().close).toHaveBeenCalledTimes(1)
  })

  it('stop() closes the watcher, drops a waiting rescan, and makes later events and pokes no-ops', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 100, watchImpl: fake.impl })
    w.start()
    const watcher = fake.last()
    watcher.emit('change', 'change', 'a.md')
    w.stop()
    expect(watcher.close).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)

    watcher.emit('change', 'change', 'b.md')
    w.poke()
    w.start()
    vi.advanceTimersByTime(10000)
    expect(onChange).not.toHaveBeenCalled()
    expect(fake.impl).toHaveBeenCalledTimes(1)
    w.stop()
    expect(watcher.close).toHaveBeenCalledTimes(1)
  })

  it('stop() during a rescan means no follow-up rescan', async () => {
    const fake = fakeWatch()
    const d = deferred()
    const onChange = vi.fn(() => d.promise)
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 100, watchImpl: fake.impl })
    w.start()
    w.poke()
    vi.advanceTimersByTime(100)
    fake.last().emit('change', 'change', 'c.md')
    w.stop()
    d.resolve()
    await flush()
    vi.advanceTimersByTime(10000)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('a folder that never goes quiet still rescans within 30 s by default', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, watchImpl: fake.impl })
    w.start()
    // A dev-server log at the root, written every 1.5 s: never 2 s of quiet.
    fake.last().emit('change', 'change', 'server.log')
    for (let t = 1500; t < 30000; t += 1500) {
      vi.advanceTimersByTime(1500)
      fake.last().emit('change', 'change', 'server.log')
    }
    vi.advanceTimersByTime(1499)
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('caps every burst at maxWaitMs from its first change, so constant churn rescans steadily', () => {
    const fake = fakeWatch()
    const times = []
    const onChange = vi.fn(() => { times.push(performance.now()) })
    const start = performance.now()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 1000, maxWaitMs: 5000, watchImpl: fake.impl })
    w.start()
    for (let t = 0; t < 60000; t += 999) {
      fake.last().emit('change', 'change', 'sync/state.txt')
      vi.advanceTimersByTime(999)
    }
    expect(times[0] - start).toBe(5000)
    expect(times.length).toBeGreaterThanOrEqual(10)
    // Next burst starts at the first change after a rescan, so gaps are at most maxWait + one event gap.
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeLessThanOrEqual(5000 + 999)
    w.stop()
  })

  it('focus pokes on a churny folder are not starved either', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, watchImpl: fake.impl })
    w.start()
    // Mirrors the review probe: a write every 1.5 s plus a focus poke every 90 s, for 15 minutes.
    for (let t = 0; t < 15 * 60000; t += 1500) {
      fake.last().emit('change', 'change', 'server.log')
      if (t % 90000 === 0) w.poke()
      vi.advanceTimersByTime(1500)
    }
    expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(28)
    w.stop()
  })

  it('maxWaitMs never shortens or delays a normal quiet-period rescan', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 1000, maxWaitMs: 5000, watchImpl: fake.impl })
    w.start()
    fake.last().emit('change', 'change', 'a.md')
    vi.advanceTimersByTime(800)
    fake.last().emit('change', 'change', 'b.md')
    vi.advanceTimersByTime(999)
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    // A later burst gets its own full maxWait, not what was left of the first.
    vi.advanceTimersByTime(10000)
    for (let i = 0; i < 4; i++) {
      fake.last().emit('change', 'change', 'c.md')
      vi.advanceTimersByTime(999)
    }
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(onChange).toHaveBeenCalledTimes(2)
    w.stop()
  })

  it('maxWaitMs: Infinity turns the cap off', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 1000, maxWaitMs: Infinity, watchImpl: fake.impl })
    w.start()
    for (let i = 0; i < 100; i++) {
      fake.last().emit('change', 'change', 'server.log')
      vi.advanceTimersByTime(999)
    }
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('a burst while a rescan runs is timed from when that rescan settles', async () => {
    const fake = fakeWatch()
    const d = deferred()
    const onChange = vi.fn().mockImplementationOnce(() => d.promise).mockImplementation(() => undefined)
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 1000, maxWaitMs: 5000, watchImpl: fake.impl })
    w.start()
    w.poke()
    vi.advanceTimersByTime(1000)
    // A 60 s rescan with changes all through it.
    for (let i = 0; i < 60; i++) {
      fake.last().emit('change', 'change', 'server.log')
      vi.advanceTimersByTime(1000)
    }
    d.resolve()
    await flush()
    vi.advanceTimersByTime(999)
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(2)
    w.stop()
  })

  it('a late error from a replaced watcher leaves the new one alone', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const onError = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, onError, debounceMs: 100, watchImpl: fake.impl })
    w.start()
    const a = fake.last()
    a.emit('error', Object.assign(new Error('EIO'), { code: 'EIO' }))
    expect(w.failed).toBe(true)
    w.start()
    const b = fake.last()
    expect(b).not.toBe(a)
    expect(w.failed).toBe(false)

    a.emit('error', Object.assign(new Error('late'), { code: 'EIO' }))
    expect(b.close).not.toHaveBeenCalled()
    expect(w.failed).toBe(false)
    expect(w.error).toBe(null)
    expect(onError).toHaveBeenCalledTimes(1)

    // The old watcher's late events don't count; the live one's do.
    a.emit('change', 'change', 'late.md')
    vi.advanceTimersByTime(1000)
    expect(onChange).not.toHaveBeenCalled()
    b.emit('change', 'change', 'new.md')
    vi.advanceTimersByTime(100)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
    expect(b.close).toHaveBeenCalledTimes(1)
  })

  it('exposes why watching failed (code + message) and reports it to onError once', () => {
    const fake = fakeWatch()
    const onError = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange: vi.fn(), onError, watchImpl: fake.impl })
    expect(w.error).toBe(null)
    w.start()
    expect(w.error).toBe(null)
    fake.last().emit('error', Object.assign(new Error('EIO: i/o error, watch'), { code: 'EIO' }))
    expect(w.error).toEqual({ code: 'EIO', message: 'EIO: i/o error, watch' })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith({ code: 'EIO', message: 'EIO: i/o error, watch' })
    expect(Object.isFrozen(w.error)).toBe(true)

    // A successful restart clears it.
    w.start()
    expect(w.failed).toBe(false)
    expect(w.error).toBe(null)
    w.stop()
  })

  it('exposes a start failure too, with code null when the error has none', () => {
    const onError = vi.fn()
    const unavailable = createFolderWatcher({
      dir: DIR,
      onChange: vi.fn(),
      onError,
      watchImpl: () => { throw Object.assign(new Error('recursive watch unavailable'), { code: 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM' }) },
    })
    unavailable.start()
    expect(unavailable.error).toEqual({ code: 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM', message: 'recursive watch unavailable' })
    expect(onError).toHaveBeenCalledWith(unavailable.error)

    const noCode = createFolderWatcher({ dir: DIR, onChange: vi.fn(), watchImpl: () => { throw new Error('boom') } })
    noCode.start()
    expect(noCode.failed).toBe(true)
    expect(noCode.error).toEqual({ code: null, message: 'boom' })
  })

  it('an onError that throws does not break the watcher', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const onError = vi.fn(() => { throw new Error('log file gone') })
    const w = createFolderWatcher({ dir: DIR, onChange, onError, debounceMs: 100, watchImpl: fake.impl })
    w.start()
    const dead = fake.last()
    expect(() => dead.emit('error', Object.assign(new Error('EIO'), { code: 'EIO' }))).not.toThrow()
    expect(dead.close).toHaveBeenCalledTimes(1)
    expect(w.failed).toBe(true)
    expect(w.error).toEqual({ code: 'EIO', message: 'EIO' })
    w.poke()
    vi.advanceTimersByTime(100)
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('ignores churn in every folder the scan skips, at any depth and with either separator', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 100, watchImpl: fake.impl })
    w.start()
    for (const name of IGNORED_DIRS) {
      for (const rel of [name, `${name}/out.md`, `web/${name}/deep/x.txt`, `app\\${name}\\y.md`]) {
        expect(isIgnored(rel), rel).toBe(true)
        fake.last().emit('change', 'change', rel)
      }
    }
    vi.advanceTimersByTime(5000)
    expect(onChange).not.toHaveBeenCalled()
    w.stop()
  })

  it('ignores exactly the folders scan.js skips', () => {
    const src = fs.readFileSync(require.resolve('../main/projects/scan.js'), 'utf8')
    const literal = src.match(/const BUILTIN_DIRS = new Set\(\[([^\]]*)\]\)/)
    expect(literal).not.toBe(null)
    const scanDirs = [...literal[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect([...IGNORED_DIRS].sort()).toEqual(scanDirs.sort())
    expect(IGNORED_DIRS).toEqual(new Set(['.git', 'node_modules', 'dist', 'build', 'vendor', 'venv', '.venv', '__pycache__', '.next', '.cache', 'target', 'coverage']))
  })

  it('like the scan, a person\'s capitalised or look-alike folders and files still count', () => {
    for (const name of ['Build/plan.md', 'Dist/notes.md', 'Vendor/contract.eml', 'Coverage/report.txt', 'TARGET/q3.md', 'build.md', 'target-notes.md', 'coverage.txt', 'vendors/acme.eml', 'my-dist/a.md']) {
      expect(isIgnored(name), name).toBe(false)
    }
  })

  it('uses injected timers when given', () => {
    const fake = fakeWatch()
    const onChange = vi.fn()
    const queue = []
    const timers = {
      setTimeout: vi.fn((fn, ms) => { queue.push({ fn, ms }); return queue.length }),
      clearTimeout: vi.fn((id) => { queue[id - 1].cleared = true }),
    }
    const w = createFolderWatcher({ dir: DIR, onChange, debounceMs: 750, watchImpl: fake.impl, timers })
    w.start()
    fake.last().emit('change', 'change', 'a.md')
    fake.last().emit('change', 'change', 'b.md')
    expect(timers.setTimeout).toHaveBeenCalledTimes(2)
    expect(timers.clearTimeout).toHaveBeenCalledWith(1)
    expect(queue.map((t) => t.ms)).toEqual([750, 750])
    queue[1].fn()
    expect(onChange).toHaveBeenCalledTimes(1)
    w.stop()
  })
})

describe('project folder watcher on a real folder', () => {
  let dir
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptly-watch-')) })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('a file added in a subfolder triggers a rescan within ~3 s', async () => {
    const onChange = vi.fn()
    const w = createFolderWatcher({ dir, onChange, debounceMs: 200 })
    try {
      w.start()
      expect(w.failed).toBe(false)
      // macOS can drop a change made before its event stream is up (the app's focus rescan and
      // the sync before every request cover that); this checks a change once watching is live.
      await new Promise((r) => setTimeout(r, 750))
      fs.mkdirSync(path.join(dir, 'emails'))
      fs.writeFileSync(path.join(dir, 'emails', 'Re budget.eml'), 'From: a@b.c\n\nhello')
      // Generous: a busy machine (the full suite runs files in parallel) delays real fs events.
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 10000, interval: 50 })
    } finally {
      w.stop()
    }
  })
})
