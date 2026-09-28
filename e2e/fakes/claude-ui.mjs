/* eslint-disable no-console -- a stand-in CLI: printing its answer is its job */
// Fake `claude` CLI for ui.spec: answers each Promptly request with realistic content from
// <dir>/answers.json. Its first argument (fixed by the launcher) is that folder, which also holds
// the switches: signed-out, delay (seconds), fail.
import fs from 'fs'
import path from 'path'

const [dir, ...args] = process.argv.slice(2)
const at = (name) => path.join(dir, name)
if (args[0] === '--version') { console.log('2.1.0 (Claude Code)'); process.exit(0) }
if (args[0] === 'auth') { console.log(JSON.stringify({ loggedIn: !fs.existsSync(at('signed-out')) })); process.exit(0) }
const a = JSON.parse(fs.readFileSync(at('answers.json'), 'utf8'))
let input = ''
process.stdin.on('data', (d) => { input += d })
process.stdin.on('end', () => {
  const delay = fs.existsSync(at('delay')) ? Number(fs.readFileSync(at('delay'), 'utf8')) * 1000 : 0
  setTimeout(() => {
    if (fs.existsSync(at('fail'))) { process.stderr.write('simulated failure'); process.exit(1) }
    const has = (s) => input.includes(s)
    const out =
      has("Analyse the user's spoken image idea") ? a.imageAnalysis
      : has('Generate exactly 3 distinct prompt variations') ? a.imageVariations
      : has('Assemble a final') ? a.imageAssembly
      : has('expert email writer') ? a.email
      : has('POLISHED:') ? a.polish
      : has('write short style notes') ? a.styleNotes
      : has("Veo 3.1 (Google's") ? a.videoDefaults
      : has('Assemble the following parameters') ? a.videoPrompt
      : has('n8n workflow engineer. Analyse') ? a.workflowAnalysis
      : has('Generate a complete, valid n8n workflow JSON') ? a.workflowJson
      : has('You judge how well a request would work') ? a.eval
      : has('You design harnesses') ? (has('TypeScript') ? a.harnessPipeline : a.harnessLoop)
      : has('You write harnesses for Claude Code') ? a.harnessFiles
      : a.prompt
    if (args.includes('stream-json')) console.log(JSON.stringify({ type: 'result', is_error: false, result: out }))
    else process.stdout.write(out + '\n')
  }, delay)
})
