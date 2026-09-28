// Puts a fake program (one of the Node scripts in this folder) where the app expects a real one.
// The app runs programs by path, so each test gets a small launcher at that path that starts the
// script with the Node running the tests: a shebang script on the Mac, a .cmd on Windows (a .mjs
// isn't directly executable there; the app starts .cmd files through platform.spawnArgs).
import fs from 'fs'
import path from 'path'

const FAKES = import.meta.dirname

// Writes the launcher for fakes/<script>.mjs at `dest` (dest + '.cmd' on Windows) and returns the
// path the app should be given. `fixedArgs` go before whatever the app passes.
export function installFake(script, dest, fixedArgs = []) {
  const target = path.join(FAKES, `${script}.mjs`)
  if (process.platform === 'win32') {
    // cmd reads % as a variable: double it so a path or argument with one survives.
    const q = (s) => `"${String(s).replace(/%/g, '%%')}"`
    const file = `${dest}.cmd`
    fs.writeFileSync(file, `@${[process.execPath, target, ...fixedArgs].map(q).join(' ')} %*\r\n`)
    return file
  }
  // exec, so a cancel's SIGTERM reaches the Node process itself, as it reached the old bash fakes.
  const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`
  fs.writeFileSync(dest, `#!/bin/sh\nexec ${[process.execPath, target, ...fixedArgs].map(q).join(' ')} "$@"\n`, { mode: 0o755 })
  return dest
}
