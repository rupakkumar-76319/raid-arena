const ACTION_COUNT = 70;
const SIMULATION_DURATION_MS = 60_000;
const BOSS_DIFFICULTY_MULTIPLIER = 2.4;
const SIMULATED_PLAYERS = Object.freeze({
  RAIDERS: [
    ['pixel_panda', 'raider-01'], ['novaRae', 'raider-02'], ['kiwi_knight', 'raider-03'],
    ['mossyboots', 'raider-04'], ['ttv_arlo', 'raider-05'], ['DaniPlays', 'raider-06'],
    ['chai_latte99', 'raider-07'], ['comet_cadet', 'raider-08'], ['LunaLoots', 'raider-09'],
    ['pixelMango', 'raider-10'], ['RogueRin', 'raider-11'], ['heyItsMika', 'raider-12'],
    ['orbit_owl', 'raider-13'], ['snackwizard', 'raider-14'],
  ],
  HOME: [
    ['bytebloom', 'home-01'], ['MellowMira', 'home-02'], ['KodaCrafts', 'home-03'],
    ['ToastyTuna', 'home-04'], ['FernFable', 'home-05'], ['c0zykoala', 'home-06'],
    ['EchoVee', 'home-07'], ['JunoJams', 'home-08'], ['bonbon_bard', 'home-09'],
    ['MapleMode', 'home-10'],
  ],
});
const COMMANDS = [
  ['!attack', 0.60],
  ['!heal', 0.15],
  ['!shield', 0.15],
  ['!rally', 0.10],
];

/** Runs the same weighted, alternating chat sequence for the dashboard and headless checker. */
async function simulateBattle({ startRaid, handleChat, delay = wait, timeScale = 1, random = Math.random, category, raiderName = 'ArenaSimulator' }) {
  await startRaid(raiderName, 35, {
    durationSeconds: 60,
    bossDifficultyMultiplier: BOSS_DIFFICULTY_MULTIPLIER,
    category,
  });

  const actionsByTeam = { RAIDERS: 0, HOME: 0 };
  for (let index = 0; index < ACTION_COUNT; index += 1) {
    if (index > 0) await delay((SIMULATION_DURATION_MS / ACTION_COUNT) / Math.max(1, Number(timeScale) || 1));
    const team = index % 2 === 0 ? 'RAIDERS' : 'HOME';
    const teamActionIndex = actionsByTeam[team]++;
    const [username, stableId] = SIMULATED_PLAYERS[team][teamActionIndex % SIMULATED_PLAYERS[team].length];
    await handleChat({
      userId: `simulation:${stableId}`,
      username,
      teamOverride: team,
      message: chooseCommand(random),
    });
  }

  return { actions: ACTION_COUNT, durationSeconds: 60 };
}

function chooseCommand(random) {
  const roll = random();
  let cumulative = 0;
  for (const [command, weight] of COMMANDS) {
    cumulative += weight;
    if (roll < cumulative) return command;
  }
  return '!attack';
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = { simulateBattle, SIMULATED_PLAYERS };
