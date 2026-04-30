export const REQUIRED = {
  subject:   ['subject', 'setting', 'framing'],
  lighting:  ['timeOfDay', 'lightType'],
  camera:    ['lens', 'aspectRatio'],
  style:     ['visualStyle'],
  technical: ['renderQuality'],
}

export const FIELD_LABELS = {
  subject: 'Subject', setting: 'Setting', emotion: 'Emotion', framing: 'Framing',
  timeOfDay: 'Time of day', lightType: 'Light type', quality: 'Quality', lensFlare: 'Lens flare',
  lens: 'Lens', aperture: 'Aperture', aspectRatio: 'Aspect ratio', angle: 'Camera angle', filmSim: 'Film sim',
  visualStyle: 'Visual style', colorGrade: 'Color grade', filmGrain: 'Film grain', reference: 'Reference',
  resolution: 'Resolution', renderQuality: 'Render quality', stylise: 'Stylise', chaos: 'Chaos', weird: 'Weird', seed: 'Seed',
}

export const SUBJECT_PARAMS = {
  subject:  ['Young woman', 'Man', 'Child', 'Couple', 'Group', 'Animal'],
  setting:  ['Ocean/beach', 'Forest', 'Urban street', 'Studio', 'Desert', 'Mountains', 'Interior'],
  emotion:  ['Serene', 'Joyful', 'Pensive', 'Mysterious', 'Confident', 'Melancholic'],
  framing:  ['Close-up', 'Mid shot', 'Full body', 'Over shoulder', 'Dutch angle'],
}

export const LIGHTING_PARAMS = {
  timeOfDay: ['Golden hour', 'Blue hour', 'Midday', 'Overcast', 'Night', 'Dawn'],
  lightType: ['Directional sun', 'Rembrandt', 'Butterfly', 'Split', 'Rim light', 'Practical', 'Ambient'],
  quality:   ['Warm amber', 'Soft diffused', 'Hard shadows', 'Dappled', 'Backlit', 'Contre-jour'],
  lensFlare: ['None', 'Subtle', 'Anamorphic', 'Strong'],
}

export const CAMERA_PARAMS = {
  lens:        ['24mm wide', '35mm street', '50mm standard', '85mm portrait', '135mm telephoto', 'Macro', 'Fisheye'],
  aperture:    ['f/1.4 shallow', 'f/2.8', 'f/5.6', 'f/11 deep'],
  aspectRatio: ['1:1 square', '4:5 portrait', '2:3', '9:16 vertical', '16:9 wide', '3:2'],
  angle:       ['Eye level', 'Low angle', 'High angle', "Bird's eye", "Worm's eye"],
  filmSim:     ['Kodak Portra 400', 'Fuji Velvia', 'Ilford HP5', 'CineStill 800T', 'Digital clean', 'Lomography', 'Medium format'],
}

export const STYLE_PARAMS = {
  visualStyle: ['Cinematic film still', 'Editorial fashion', 'Documentary', 'Fine art', 'Commercial', 'Conceptual'],
  colorGrade:  ['Warm teal-orange', 'Desaturated', 'Hyper-saturated', 'Monochrome', 'Duotone', 'Cross-processed'],
  filmGrain:   ['35mm grain', 'Medium format', 'Heavy grain', 'Digital clean', 'Lomography'],
  reference:   ['Roger Deakins', 'Emmanuel Lubezki', 'Annie Leibovitz', 'Nan Goldin', 'Gregory Crewdson'],
}

export const TECHNICAL_PARAMS = {
  resolution:    ['Ultra HD 4K', '1080p', 'Medium', 'Standard'],
  renderQuality: ['Photorealistic', 'Hyper-real', 'Stylised', 'Painterly'],
}

export const TECHNICAL_NUMERIC_PARAMS = {
  stylise: [
    { label: '250 subtle', value: 250 },
    { label: '500',        value: 500 },
    { label: '750',        value: 750 },
    { label: '1000 strong',value: 1000 },
  ],
  chaos: [
    { label: '0 precise', value: 0 },
    { label: '20',         value: 20 },
    { label: '50',         value: 50 },
    { label: '100 wild',   value: 100 },
  ],
  weird: [
    { label: '0',   value: 0 },
    { label: '250', value: 250 },
    { label: '500', value: 500 },
    { label: '1000',value: 1000 },
  ],
}

export const PRESET_CATEGORIES = [
  {
    label: 'Photography',
    presets: [
      { name: 'Golden hour portrait', params: { lighting: { timeOfDay: 'Golden hour', lightType: 'Directional sun', quality: 'Warm amber' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Studio editorial',     params: { lighting: { lightType: 'Butterfly', quality: 'Soft diffused' }, camera: { lens: '50mm standard' }, style: { visualStyle: 'Editorial fashion', colorGrade: 'Desaturated' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 0 } } },
      { name: 'Street documentary',   params: { lighting: { timeOfDay: 'Midday', lightType: 'Ambient' }, camera: { lens: '35mm street', aperture: 'f/5.6' }, style: { visualStyle: 'Documentary', colorGrade: 'Desaturated', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 250, chaos: 20 } } },
      { name: 'Fashion beauty',        params: { lighting: { lightType: 'Rembrandt', quality: 'Soft diffused' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow', filmSim: 'Medium format' }, style: { visualStyle: 'Editorial fashion', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Hyper-real', stylise: 750, chaos: 0 } } },
      { name: 'Macro detail',          params: { camera: { lens: 'Macro', aperture: 'f/5.6', angle: 'Eye level' }, lighting: { quality: 'Soft diffused' }, style: { visualStyle: 'Fine art' }, technical: { renderQuality: 'Hyper-real', stylise: 500, chaos: 0 } } },
      { name: 'Architectural',         params: { camera: { lens: '24mm wide', aperture: 'f/11 deep', angle: 'Low angle' }, lighting: { timeOfDay: 'Blue hour', quality: 'Warm amber' }, style: { visualStyle: 'Commercial', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 0 } } },
      { name: 'Environmental portrait',params: { camera: { lens: '35mm street', aperture: 'f/2.8' }, lighting: { timeOfDay: 'Golden hour' }, style: { visualStyle: 'Documentary', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 15 } } },
      { name: 'Night portrait',        params: { lighting: { timeOfDay: 'Night', lightType: 'Practical', quality: 'Hard shadows' }, camera: { lens: '50mm standard', aperture: 'f/1.4 shallow', filmSim: 'CineStill 800T' }, style: { colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
      { name: 'Drone aerial',          params: { camera: { lens: '24mm wide', angle: "Bird's eye", aspectRatio: '16:9 wide' }, lighting: { timeOfDay: 'Golden hour' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Couple romance',        params: { lighting: { timeOfDay: 'Golden hour', quality: 'Backlit', lensFlare: 'Subtle' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
    ],
  },
  {
    label: 'Cinematic',
    presets: [
      { name: 'Film noir',          params: { lighting: { timeOfDay: 'Night', lightType: 'Rembrandt', quality: 'Hard shadows' }, camera: { lens: '35mm street', aperture: 'f/2.8', filmSim: 'Ilford HP5' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Monochrome', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
      { name: 'Wes Anderson',       params: { lighting: { timeOfDay: 'Midday', quality: 'Soft diffused' }, camera: { lens: '35mm street', angle: 'Eye level', aspectRatio: '1:1 square' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Hyper-saturated', filmGrain: '35mm grain' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 0 } } },
      { name: 'Sci-fi blockbuster', params: { lighting: { timeOfDay: 'Night', lightType: 'Practical', lensFlare: 'Anamorphic' }, camera: { lens: '24mm wide', aspectRatio: '16:9 wide' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20, weird: 250 } } },
      { name: 'Indie drama',        params: { lighting: { timeOfDay: 'Overcast', lightType: 'Ambient', quality: 'Soft diffused' }, camera: { lens: '35mm street', aperture: 'f/2.8' }, style: { visualStyle: 'Documentary', colorGrade: 'Desaturated', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 20 } } },
      { name: 'Horror atmospheric', params: { lighting: { timeOfDay: 'Night', lightType: 'Practical', quality: 'Hard shadows' }, camera: { lens: '24mm wide', angle: 'Low angle' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Desaturated', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 30 } } },
      { name: 'Documentary realism',params: { lighting: { timeOfDay: 'Midday', lightType: 'Ambient' }, camera: { lens: '35mm street', aperture: 'f/5.6' }, style: { visualStyle: 'Documentary', colorGrade: 'Desaturated', filmGrain: '35mm grain', reference: 'Nan Goldin' }, technical: { renderQuality: 'Photorealistic', stylise: 250, chaos: 30 } } },
      { name: 'Period drama',       params: { lighting: { timeOfDay: 'Golden hour', lightType: 'Directional sun', quality: 'Warm amber' }, camera: { lens: '50mm standard', filmSim: 'Kodak Portra 400' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'New Wave',           params: { lighting: { timeOfDay: 'Midday', quality: 'Hard shadows' }, camera: { lens: '35mm street', aperture: 'f/5.6', filmSim: 'Ilford HP5' }, style: { visualStyle: 'Documentary', colorGrade: 'Monochrome', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 30 } } },
      { name: 'Road movie',         params: { lighting: { timeOfDay: 'Golden hour', lensFlare: 'Subtle' }, camera: { lens: '35mm street', aspectRatio: '16:9 wide' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Desaturated', filmGrain: '35mm grain', reference: 'Roger Deakins' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
      { name: 'Sci-fi noir',        params: { lighting: { timeOfDay: 'Night', lightType: 'Practical', quality: 'Hard shadows', lensFlare: 'Anamorphic' }, camera: { lens: '24mm wide', filmSim: 'CineStill 800T' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Photorealistic', stylise: 1000, chaos: 20, weird: 250 } } },
    ],
  },
  {
    label: 'Art styles',
    presets: [
      { name: 'Oil painting',  params: { style: { visualStyle: 'Fine art', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Painterly', stylise: 1000, chaos: 20 } } },
      { name: 'Watercolour',   params: { style: { visualStyle: 'Fine art' }, technical: { renderQuality: 'Painterly', stylise: 750, chaos: 30 } } },
      { name: 'Concept art',   params: { style: { visualStyle: 'Conceptual' }, technical: { renderQuality: 'Stylised', stylise: 750, chaos: 30 } } },
      { name: 'Pixel art',     params: { style: { visualStyle: 'Conceptual' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 0 } } },
      { name: 'Comic book',    params: { style: { visualStyle: 'Conceptual', colorGrade: 'Hyper-saturated' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 20 } } },
      { name: 'Anime',         params: { style: { visualStyle: 'Conceptual', colorGrade: 'Hyper-saturated' }, technical: { renderQuality: 'Stylised', stylise: 750, chaos: 20 } } },
      { name: 'Impressionist', params: { style: { visualStyle: 'Fine art', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Painterly', stylise: 750, chaos: 50 } } },
      { name: 'Surrealism',    params: { style: { visualStyle: 'Conceptual', colorGrade: 'Cross-processed' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 50, weird: 500 } } },
      { name: 'Art Nouveau',   params: { style: { visualStyle: 'Fine art', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Painterly', stylise: 1000, chaos: 20 } } },
      { name: 'Retro poster',  params: { style: { visualStyle: 'Conceptual', colorGrade: 'Duotone' }, technical: { renderQuality: 'Stylised', stylise: 750, chaos: 10 } } },
      { name: 'Cyberpunk',     params: { lighting: { timeOfDay: 'Night', lightType: 'Practical' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 30, weird: 250 } } },
      { name: 'Grunge',        params: { style: { visualStyle: 'Documentary', colorGrade: 'Desaturated', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Stylised', stylise: 500, chaos: 50 } } },
    ],
  },
  {
    label: 'Commercial',
    presets: [
      { name: 'Product shot',       params: { lighting: { lightType: 'Butterfly', quality: 'Soft diffused' }, camera: { lens: '85mm portrait', aperture: 'f/11 deep' }, style: { visualStyle: 'Commercial', colorGrade: 'Desaturated' }, technical: { renderQuality: 'Hyper-real', stylise: 500, chaos: 0 } } },
      { name: 'Food photography',   params: { lighting: { lightType: 'Directional sun', quality: 'Warm amber' }, camera: { lens: '50mm standard', angle: 'High angle' }, style: { visualStyle: 'Commercial', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Hyper-real', stylise: 500, chaos: 0 } } },
      { name: 'Real estate',        params: { lighting: { timeOfDay: 'Golden hour', lightType: 'Ambient' }, camera: { lens: '24mm wide', aperture: 'f/11 deep', angle: 'Eye level' }, style: { visualStyle: 'Commercial', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 0 } } },
      { name: 'Corporate portrait', params: { lighting: { lightType: 'Butterfly', quality: 'Soft diffused' }, camera: { lens: '85mm portrait', aperture: 'f/2.8' }, style: { visualStyle: 'Commercial', colorGrade: 'Desaturated' }, technical: { renderQuality: 'Photorealistic', stylise: 250, chaos: 0 } } },
      { name: 'Lifestyle brand',    params: { lighting: { timeOfDay: 'Golden hour', quality: 'Warm amber' }, camera: { lens: '35mm street', aperture: 'f/2.8' }, style: { visualStyle: 'Editorial fashion', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Wedding & event',    params: { lighting: { timeOfDay: 'Golden hour', quality: 'Backlit', lensFlare: 'Subtle' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow', filmSim: 'Kodak Portra 400' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Sports action',      params: { lighting: { timeOfDay: 'Midday', lightType: 'Directional sun', quality: 'Hard shadows' }, camera: { lens: '135mm telephoto', aperture: 'f/2.8' }, style: { visualStyle: 'Documentary' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 20 } } },
      { name: 'Travel & tourism',   params: { lighting: { timeOfDay: 'Golden hour' }, camera: { lens: '24mm wide', aspectRatio: '16:9 wide' }, style: { visualStyle: 'Documentary', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
    ],
  },
  {
    label: 'Mood & atmosphere',
    presets: [
      { name: 'Dark moody',    params: { lighting: { timeOfDay: 'Night', lightType: 'Rembrandt', quality: 'Hard shadows' }, camera: { lens: '50mm standard', aperture: 'f/2.8', filmSim: 'Ilford HP5' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Desaturated', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
      { name: 'Soft dreamy',   params: { lighting: { timeOfDay: 'Golden hour', quality: 'Soft diffused' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow', filmSim: 'Kodak Portra 400' }, style: { visualStyle: 'Fine art', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Gritty urban',  params: { lighting: { timeOfDay: 'Overcast', lightType: 'Ambient' }, camera: { lens: '35mm street', aperture: 'f/5.6' }, style: { visualStyle: 'Documentary', colorGrade: 'Desaturated', filmGrain: 'Heavy grain' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 30 } } },
      { name: 'Ethereal',      params: { lighting: { timeOfDay: 'Dawn', quality: 'Soft diffused', lensFlare: 'Subtle' }, camera: { lens: '85mm portrait', aperture: 'f/1.4 shallow' }, style: { visualStyle: 'Fine art', colorGrade: 'Desaturated', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 10 } } },
      { name: 'Warm cozy',     params: { lighting: { timeOfDay: 'Golden hour', lightType: 'Practical', quality: 'Warm amber' }, camera: { lens: '50mm standard', aperture: 'f/2.8', filmSim: 'Kodak Portra 400' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 10 } } },
      { name: 'High drama',    params: { lighting: { lightType: 'Rembrandt', quality: 'Hard shadows' }, camera: { lens: '50mm standard', angle: 'Low angle' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Desaturated' }, technical: { renderQuality: 'Photorealistic', stylise: 750, chaos: 20 } } },
      { name: 'Nostalgic',     params: { lighting: { timeOfDay: 'Golden hour', quality: 'Warm amber' }, camera: { lens: '50mm standard', filmSim: 'Kodak Portra 400' }, style: { visualStyle: 'Cinematic film still', colorGrade: 'Warm teal-orange', filmGrain: '35mm grain' }, technical: { renderQuality: 'Photorealistic', stylise: 500, chaos: 10 } } },
      { name: 'Otherworldly',  params: { lighting: { timeOfDay: 'Night', lensFlare: 'Strong' }, camera: { lens: '24mm wide', angle: 'Low angle' }, style: { visualStyle: 'Conceptual', colorGrade: 'Cross-processed' }, technical: { renderQuality: 'Stylised', stylise: 1000, chaos: 50, weird: 500 } } },
    ],
  },
]
