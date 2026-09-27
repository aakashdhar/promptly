import { resolveModeKey, modeTone, isBuilderMode } from './modes.js'

const sequences = {
  prompt: [
    'Working out what you need...',
    'Writing the requirements...',
    'Adding success criteria...',
    'Almost ready...',
    'Taking a moment longer than usual...',
  ],
  code: [
    'Reading your task...',
    'Writing the brief...',
    'Adding how to verify it...',
    'Almost ready...',
    'Taking a moment longer than usual...',
  ],
  design: [
    'Reading your design idea...',
    'Writing the brief...',
    'Checking what stays the same...',
    'Almost ready...',
    'Taking a moment longer than usual...',
  ],
  polish: [
    'Reading your draft...',
    'Polishing the language...',
    'Finalising the tone...',
    'Almost ready...',
  ],
  email: [
    'Reading your situation...',
    'Drafting the email...',
    'Choosing the right tone...',
    'Almost ready...',
  ],
  image_1: [
    'Analysing your idea...',
    'Identifying visual parameters...',
    'Preparing the builder...',
  ],
  image_2: [
    'Assembling your prompt...',
    'Optimising for Nano Banana and ChatGPT...',
    'Almost ready...',
  ],
  video_1: [
    'Analysing your idea...',
    'Mapping camera and style...',
    'Preparing the builder...',
  ],
  video_2: [
    'Assembling your video prompt...',
    'Optimising for Veo 3.1...',
    'Almost ready...',
  ],
  workflow_1: [
    'Mapping your workflow...',
    'Identifying nodes and connections...',
    'Preparing the builder...',
  ],
  harness_1: [
    'Mapping your harness...',
    'Working out the checks and stop conditions...',
    'Finding what it needs from you...',
  ],
  harness_2: [
    'Writing the files...',
    'Wiring up the checks...',
    'Adding the guardrails...',
    'Almost ready...',
  ],
  workflow_2: [
    'Assembling the workflow JSON...',
    'Validating node connections...',
    'Almost ready...',
  ],
}


export function getLabelSequence(mode, phase = 1) {
  const m = resolveModeKey(mode)
  const key = isBuilderMode(m) ? `${m}_${phase}` : m
  return sequences[key] || sequences.prompt
}

export function getModeAccent(mode) {
  return `rgba(${modeTone(mode).rgb},0.85)`
}
