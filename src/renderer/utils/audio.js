// Converts MediaRecorder output (webm/opus) into 16 kHz mono 16-bit WAV, the format the
// built-in whisper.cpp engine reads directly. Doing it here means nobody needs ffmpeg.

export const TARGET_SAMPLE_RATE = 16000

// Encodes mono float samples in [-1, 1] as a 16-bit PCM WAV file.
export function encodeWav(samples, sampleRate = TARGET_SAMPLE_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)) }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)          // PCM chunk size
  view.setUint16(20, 1, true)           // PCM format
  view.setUint16(22, 1, true)           // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)           // block align
  view.setUint16(34, 16, true)          // bits per sample
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

// Decodes a recorded blob and resamples it to 16 kHz mono WAV.
export async function blobToWav(blob) {
  const encoded = await blob.arrayBuffer()
  const ctx = new AudioContext()
  let decoded
  try {
    decoded = await ctx.decodeAudioData(encoded)
  } finally {
    ctx.close()
  }
  const length = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, length, TARGET_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return encodeWav(rendered.getChannelData(0), TARGET_SAMPLE_RATE)
}

// What the recording hooks send to main: WAV when the browser can decode the recording,
// otherwise the original bytes (main then reports a clear transcription error).
export async function recordingToWav(blob) {
  try {
    return await blobToWav(blob)
  } catch {
    return blob.arrayBuffer()
  }
}

// Microphone settings for dictation. The browser defaults are tuned for video calls: echo
// cancellation (pointless when nothing is playing back) and noise suppression, which treats a
// soft or distant voice as noise and thins it out. Auto gain stays on to lift quiet speakers.
export const MIC_CONSTRAINTS = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
  video: false,
}

// Rejects if a step hangs, so a stuck decoder can't leave the app waiting forever.
export function withTimeout(promise, ms, message) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) }),
  ]).finally(() => clearTimeout(timer))
}
