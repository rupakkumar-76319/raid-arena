const ACTION_COUNT = 70;
const SIMULATION_DURATION_MS = 60_000;
const BOSS_DIFFICULTY_MULTIPLIER = 1.15;
const COMMANDS = [
  ['!attack', 0.60],
  ['!heal', 0.15],
  ['!shield', 0.15],
  ['!rally', 0.10],
];

/** Runs the same weighted, alternating chat sequence for the dashboard and headless checker. */
async function simulateBattle({ startRaid, handleChat, delay = wait, timeScale = 1, random = Math.random }) {
  await startRaid('ArenaSimulator', 35, {
    durationSeconds: 60,
    bossDifficultyMultiplier: BOSS_DIFFICULTY_MULTIPLIER,
  });

  for (let index = 0; index < ACTION_COUNT; index += 1) {
    if (index > 0) await delay((SIMULATION_DURATION_MS / ACTION_COUNT) / Math.max(1, Number(timeScale) || 1));
    const team = index % 2 === 0 ? 'RAIDERS' : 'HOME';
    await handleChat({
      userId: `simulation:${team.toLowerCase()}`,
      username: team === 'RAIDERS' ? 'SimRaider' : 'SimHome',
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

module.exports = { simulateBattle };
