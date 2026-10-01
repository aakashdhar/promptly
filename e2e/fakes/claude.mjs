// Fake `claude` CLI for app.spec. It records its arguments and stdin as $FAKE_DIR/call-N.args and
// call-N.stdin, waits $FAKE_DIR/delay seconds if that file exists, then answers: builder steps get
// the JSON they ask for, prompt modes get a prompt built from the request (the <requested_change>,
// the <transcript>, or the last line of stdin). $FAKE_DIR/call-N.done marks a finished answer.
// Other switches in $FAKE_DIR: signed-out, fail, assemble-delay, stream-pause.
import fs from 'fs'
import path from 'path'

const DIR = process.env.FAKE_DIR
const at = (name) => path.join(DIR, name)
const has = (name) => fs.existsSync(at(name))
const read = (name) => fs.readFileSync(at(name), 'utf8')
const sleep = (name) => new Promise((resolve) => setTimeout(resolve, parseFloat(read(name)) * 1000))
// Shell command substitution drops trailing newlines; answers keep that shape.
const chomp = (s) => s.replace(/\n+$/, '')
const say = (s) => process.stdout.write(s)

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

// The lines between <tag> and </tag>; the last of them (the request is its last line).
function tagged(input, tag) {
  const lines = []
  let inside = false
  for (const line of input.split('\n')) {
    if (line.includes(`</${tag}>`)) inside = false
    if (inside) lines.push(line)
    if (line.includes(`<${tag}>`)) inside = true
  }
  return lines.at(-1) ?? ''
}

const delta = (text) => JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } })

async function main(args) {
  // Setup checks: version, and sign-in state (signed out while $FAKE_DIR/signed-out exists).
  if (args[0] === '--version') { say('9.9.9 (Claude Code)\n'); return 0 }
  if (args[0] === 'auth') { say(has('signed-out') ? '{"loggedIn": false}\n' : '{"loggedIn": true}\n'); return 0 }

  const n = fs.readdirSync(DIR).filter((f) => f.startsWith('call-') && f.endsWith('.args')).length
  fs.writeFileSync(at(`call-${n}.args`), (args.length ? args : ['']).map((a) => a + '\n').join(''))
  const input = chomp(await readStdin())
  fs.writeFileSync(at(`call-${n}.stdin`), input)
  if (has('fail')) { process.stderr.write('simulated failure\n'); return 1 }
  if (has('delay')) await sleep('delay')

  const asks = (s) => input.includes(s)
  // Image builder phases get the JSON they ask for.
  if (asks("Analyse the user's spoken image idea")) {
    say('{"subject":{"subject":"Red fox","setting":"Snowy forest","emotion":"Calm","framing":"Close-up","negativePrompts":[]},"lighting":{"timeOfDay":"Golden hour","lightType":"Directional sun","quality":"Warm amber","lensFlare":"None"},"camera":{"lens":"85mm portrait","aperture":"f/1.4 shallow","aspectRatio":"4:5 portrait","angle":"Eye level","filmSim":"Kodak Portra 400"},"style":{"visualStyle":"Cinematic film still","colorGrade":"Warm teal-orange","filmGrain":"35mm grain","reference":"Emmanuel Lubezki"},"technical":{"resolution":"Ultra HD 4K","renderQuality":"Photorealistic","stylise":750,"chaos":20,"weird":0,"seed":null}}')
    return 0
  }
  if (asks('Generate exactly 3 distinct prompt variations')) {
    say('{"variations":[{"id":1,"prompt":"A red fox in snow","focus":"natural"},{"id":2,"prompt":"A red fox, dramatic","focus":"editorial"},{"id":3,"prompt":"A red fox, cinematic","focus":"cinematic"}]}')
    return 0
  }
  if (asks('Assemble a final')) {
    if (has('assemble-delay')) await sleep('assemble-delay')
    say('{"prompt":"A calm red fox in a snowy forest at golden hour, vertical 4:5 composition, photorealistic","flags":"--ar 4:5 --stylize 750 --chaos 20"}')
    return 0
  }
  // Dictation clean-up: hands the transcript back as it came, or with FAKE_DIR/cleanup's text.
  if (asks('You fix speech-to-text mistakes')) { say(has('cleanup') ? read('cleanup') : (input.match(/<transcript>\n([\s\S]*)\n<\/transcript>/) || [])[1] || ''); return 0 }
  if (asks('You design harnesses')) { say(read('harness-plan.json')); return 0 }
  // A finished prompt rewritten for another AI: says which AI, and keeps the original's first line.
  if (asks('so it works as well as possible in ')) {
    const target = (input.match(/so it works as well as possible in (\w+)/) || [])[1]
    const first = (tagged(input, 'original') || '').split('\n')[0]
    say(`## Task for ${target}\n${first}\n\n## Output format\nAs asked.`)
    return 0
  }
  if (asks('write short style notes')) { say('- Short sentences\n- Signs off with "Cheers, Sam"'); return 0 }

  // The request: a spoken change (Iterate), or the <transcript> of a prompt mode, or the last line.
  let last = tagged(input, 'requested_change')
  if (!last) last = tagged(input, 'transcript')
  if (!last) last = input.split('\n').at(-1).replace(/"/g, '')

  // Polish and Email answer in their own formats.
  if (asks('expert email writer')) {
    say(JSON.stringify({ subject: 'About ' + last, body: 'Hi team,\n\n' + last + '\n\nThanks', toneAnalysis: { recipient: 'Team', tone: 'Friendly', coreMessage: last, approach: 'Direct', whyThisTone: 'Internal' } }) + '\n')
    return 0
  }
  if (asks('n8n workflow engineer. Analyse')) { say(read('workflow-analysis.json')); return 0 }
  if (asks('Generate a complete, valid n8n workflow JSON')) { say(read('workflow.json')); return 0 }

  let out
  if (asks('You write harnesses for Claude Code')) out = read('harness-files.txt')
  else if (asks('POLISHED:')) out = `POLISHED:\n${last} (polished)\n\nCHANGES:\n· Tidied the wording`
  else out = `Role:\nYou are a test assistant.\n\nTask:\n${last}`
  out = chomp(out)

  if (args.includes('stream-json')) {
    // Stream in two halves so tests can watch text arrive.
    const chars = Array.from(out)
    const half = Math.floor(chars.length / 2)
    say(delta(chars.slice(0, half).join('')) + '\n')
    if (has('stream-pause')) await sleep('stream-pause')
    say(delta(chars.slice(half).join('')) + '\n')
    say(JSON.stringify({ type: 'result', is_error: false, result: out }) + '\n')
  } else {
    say(out + '\n')
  }
  fs.writeFileSync(at(`call-${n}.done`), '')
  return 0
}

// exitCode rather than exit(): stdout to a pipe is asynchronous on macOS, and exit() could cut
// the answer short.
process.exitCode = await main(process.argv.slice(2))
