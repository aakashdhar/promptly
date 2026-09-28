// Fake built-in engine (whisper-cli) for app.spec. Like the real one it only accepts WAV (the
// file after -f). It keeps a copy of the audio as $FAKE_DIR/last-audio.wav and its arguments in
// $FAKE_DIR/whisper-args, then prints $FAKE_DIR/transcript (or a stock sentence). While
// $FAKE_DIR/whisper-fail exists every run except the warm-up fails.
import fs from 'fs'
import path from 'path'

const DIR = process.env.FAKE_DIR
const args = process.argv.slice(2)
let file = ''
args.forEach((a, i) => { if (args[i - 1] === '-f') file = a })

function run() {
  let head = ''
  try { head = fs.readFileSync(file).subarray(0, 4).toString('latin1') } catch { /* no such file: not WAV */ }
  if (head !== 'RIFF') { process.stderr.write('expected WAV input\n'); return 1 }
  if (fs.existsSync(path.join(DIR, 'whisper-fail')) && !file.includes('warmup')) { process.stderr.write('engine failed\n'); return 1 }
  fs.copyFileSync(file, path.join(DIR, 'last-audio.wav'))
  fs.writeFileSync(path.join(DIR, 'whisper-args'), args.join(' ') + '\n')
  const transcript = path.join(DIR, 'transcript')
  process.stdout.write(fs.existsSync(transcript) ? fs.readFileSync(transcript) : 'spoken words from the fake mic\n')
  return 0
}

// exitCode rather than exit(): stdout to a pipe is asynchronous on macOS.
process.exitCode = run()
