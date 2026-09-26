'use strict';

// Notices when someone is talking but faintly (far from the mic, or a soft voice) so the pill
// can say "speak up" while there's still time, instead of the transcript coming back wrong.
// Levels are the recorder's meter values (RMS × 5, 0–1), about 16 a second.

const WINDOW = 40;             // ~2.5 s of levels
const MIN_SPEECH = 0.02;       // below this it's room noise, whatever the noise floor
const SPEECH_OVER_FLOOR = 2.5; // talking lifts the loud end well above the quietest moments
const QUIET_BELOW = 0.12;      // speech that peaks under this is often misheard
const LOUD_ENOUGH = 0.15;      // clears the hint; a little above QUIET_BELOW so it doesn't flicker
const QUIET_FOR = 16;          // ~1 s of faint talking (after the first window) before saying so

function createQuietDetector() {
  let levels = [];
  let floor = Infinity;
  let quietCount = 0;
  let quiet = false;

  // Adds one level; returns whether the speaker currently seems too quiet.
  function push(level) {
    levels.push(Math.max(0, Math.min(1, Number(level) || 0)));
    if (levels.length > WINDOW) levels.shift();
    if (levels.length < WINDOW) return quiet;
    const sorted = [...levels].sort((a, b) => a - b);
    const low = sorted[Math.floor(WINDOW * 0.2)];
    const loud = sorted[Math.floor(WINDOW * 0.9)];
    floor = Math.min(floor, Math.max(low, 0.002));
    const talking = loud >= MIN_SPEECH && loud >= floor * SPEECH_OVER_FLOOR;
    if (loud >= LOUD_ENOUGH) {
      quietCount = 0;
      quiet = false;
    } else if (talking && loud < QUIET_BELOW) {
      quietCount += 1;
      if (quietCount >= QUIET_FOR) quiet = true;
    }
    // Pauses (not talking) change nothing: the hint stays until they're heard clearly.
    return quiet;
  }

  function reset() {
    levels = [];
    floor = Infinity;
    quietCount = 0;
    quiet = false;
  }

  return { push, reset, isQuiet: () => quiet };
}

module.exports = { createQuietDetector };
