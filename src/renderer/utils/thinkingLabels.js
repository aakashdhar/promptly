const sequences = {
  balanced: [
    'Structuring your prompt...',
    'Adding context and constraints...',
    'Refining the output format...',
    'Almost ready...',
    'Taking a moment longer than usual...',
  ],
  refine: [
    'Analysing your prompt...',
    'Identifying improvements...',
    'Refining the structure...',
    'Almost ready...',
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
    'Optimising for Nano Banana...',
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
  workflow_2: [
    'Assembling the workflow JSON...',
    'Validating node connections...',
    'Almost ready...',
  ],
}

const BUILDER_MODES = ['image', 'video', 'workflow']

const ACCENTS = {
  balanced:  'rgba(10,132,255,0.85)',
  detailed:  'rgba(10,132,255,0.85)',
  concise:   'rgba(10,132,255,0.85)',
  chain:     'rgba(10,132,255,0.85)',
  code:      'rgba(10,132,255,0.85)',
  design:    'rgba(10,132,255,0.85)',
  refine:    'rgba(168,85,247,0.85)',
  polish:    'rgba(48,209,88,0.85)',
  email:     'rgba(20,184,166,0.85)',
  image:     'rgba(139,92,246,0.85)',
  video:     'rgba(251,146,60,0.85)',
  workflow:  'rgba(34,197,94,0.85)',
}

export function getLabelSequence(mode, phase = 1) {
  const key = BUILDER_MODES.includes(mode) ? `${mode}_${phase}` : mode
  return sequences[key] || sequences['balanced']
}

export function getModeAccent(mode) {
  return ACCENTS[mode] || ACCENTS['balanced']
}
