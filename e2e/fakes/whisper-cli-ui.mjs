// Fake built-in engine (whisper-cli) for ui.spec: whatever it's given, it hears the same
// dictation, filler words and a spoken paragraph break included.
process.stdout.write('Um, so for the support dashboard, we should pull tickets from Zendesk every five minutes and group them by product area. New paragraph. Uh, and highlight anything that has been waiting more than four hours.\n')
