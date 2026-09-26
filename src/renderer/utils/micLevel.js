// The microphone level while recording (0–1), shared without re-rendering React: the recorder's
// meter writes it about 16 times a second and the Ribbon waveform reads it every frame.
let level = 0

export function setMicLevel(value) {
  level = Math.max(0, Math.min(1, Number(value) || 0))
}

export function getMicLevel() {
  return level
}
