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
    // Project modes: the folder map, facts per file (tagged the way the prompt asks), the summary.
    const projectFacts = () => [...input.matchAll(/<path>([^<]+)<\/path>\n<tag>([^<]+)<\/tag>/g)]
      .map(([, rel, tag]) => `## ${rel}\n- Aparna Rao (client) asked for a copyable link under the button in the access email. ${tag}`).join('\n')
    const projectSummary = () => {
      const tag = (input.match(/\[source: [^\]]+\]/) || [''])[0]
      return ['## The project', `- Video learning platform for the client's field staff; phase 2 (analytics and access emails) is in build, go-live 31 Oct. ${tag}`,
        '## People', `- **Aparna Rao**, client product owner; approves scope changes in writing. ${tag}`,
        '## How they like to be written to', `- Short emails, first names, a clear yes or no up front. ${tag}`,
        '## Agreed', `- Phase 2 covers analytics, SSO and email fixes. ${tag}`,
        '## Open right now', `- Outlook users can't click the button in the access email; a copyable link was asked for. ${tag}`,
        '## Latest activity', '## Words', `- Infer360, SSO ${tag}`].join('\n')
    }
    const out =
      has('Return ONLY this JSON') && has('"folders"') ? JSON.stringify({ folders: [{ rel: 'comms', kind: 'conversations' }, { rel: 'contracts', kind: 'agreements' }, { rel: 'shared', kind: 'unsure', question: 'Is this reference material or work in progress?' }] })
      : has('<documents>') ? projectFacts()
      : has('You write the summary of one project') ? projectSummary()
      : has("Analyse the user's spoken image idea") ? a.imageAnalysis
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
