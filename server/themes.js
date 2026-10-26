// `shape` selects a self-contained SVG drawing in overlay/app.js; no images are fetched.
const THEMES = {
  minecraft: {
    name: 'Creeper-style Block Golem', colors: ['#68d765', '#469bb7'], shape: 'block-golem', emoji: '🧱',
    intro: 'A square-shouldered golem stomps in, fizzing with unstable green energy.',
  },
  'just chatting': {
    name: 'Talkshow Titan', colors: ['#ffbd55', '#ed6a9b'], shape: 'talkshow-titan', emoji: '🎙️',
    intro: 'The Talkshow Titan takes the stage and demands one more question from chat.',
  },
  valorant: {
    name: 'Tactical Mech', colors: ['#ff665d', '#58c6e8'], shape: 'tactical-mech', emoji: '🤖',
    intro: 'A tactical mech locks on and paints the arena with red targeting lights.',
  },
  'counter-strike': {
    name: 'Tactical Mech', colors: ['#ffb247', '#6ba8dd'], shape: 'tactical-mech', emoji: '🤖',
    intro: 'A tactical mech locks on and paints the arena with amber targeting lights.',
  },
  apex: {
    name: 'Tactical Mech', colors: ['#ef5c62', '#8a87ff'], shape: 'tactical-mech', emoji: '🤖',
    intro: 'A tactical mech drops into the arena with its shields humming.',
  },
  fortnite: {
    name: 'Storm Beast', colors: ['#b283ff', '#4ac7e8'], shape: 'storm-beast', emoji: '🌩️',
    intro: 'The storm curls into a beast, crackling as it sweeps across the arena.',
  },
  pokemon: {
    name: 'Legendary Beast', colors: ['#ffe06b', '#f47a8d'], shape: 'legendary-beast', emoji: '✨',
    intro: 'A legendary beast awakens in a flash of light and a rumble of thunder.',
  },
  music: {
    name: 'Bass Golem', colors: ['#d47cff', '#5de6cf'], shape: 'bass-golem', emoji: '🔊',
    intro: 'A bass-powered golem hits the downbeat hard enough to shake the arena.',
  },
  irl: {
    name: 'Street Giant', colors: ['#ff9b59', '#69d3c3'], shape: 'street-giant', emoji: '🏙️',
    intro: 'A street-sized giant rounds the corner, carrying half the city with it.',
  },
  travel: {
    name: 'Street Giant', colors: ['#74dcae', '#62a9f2'], shape: 'street-giant', emoji: '🧭',
    intro: 'A wandering giant steps off the map and into the middle of the arena.',
  },
  science: {
    name: 'Lab Experiment', colors: ['#7ff1b2', '#a580ff'], shape: 'lab-experiment', emoji: '🧪',
    intro: 'An escaped experiment bubbles over the edge of its containment tank.',
  },
  default: {
    name: 'Void Kaiju', colors: ['#a98aff', '#4c91e8'], shape: 'void-kaiju', emoji: '👾',
    intro: 'A creature from the void tears open the sky above the arena.',
  },
};

function themeForCategory(category = '') {
  const normalized = String(category).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const [substring, theme] of Object.entries(THEMES)) {
    if (substring !== 'default' && normalized.includes(substring)) return { ...theme, colors: [...theme.colors] };
  }
  return { ...THEMES.default, colors: [...THEMES.default.colors] };
}

module.exports = { THEMES, themeForCategory };
