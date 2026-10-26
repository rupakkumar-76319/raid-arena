// Run five seeded, headless copies of the dashboard's simulation.
// timeScale speeds the shared action schedule, game clock, and boss ticks 10x.
const { GameManager } = require('../server/game');
const { DEFAULT_SETTINGS } = require('../server/settings-store');
const { simulateBattle } = require('../server/simulation');

const RUNS = Number.parseInt(process.argv[2], 10) || 5;
const TIME_SCALE = 10;

async function runSimulation(runNumber) {
  const random = seededRandom(0xA11CE + runNumber * 7919);
  let result = null;
  const manager = new GameManager({
    broadcast() {},
    getSettings: () => ({ ...DEFAULT_SETTINGS, botMessages: false, autoShoutout: false }),
    onGameFinished: (context) => { result = context.result; },
    timeScale: TIME_SCALE,
    random,
  });

  try {
    await simulateBattle({
      startRaid: (raiderName, viewers, options) => manager.startRaid({
        raidId: `sim-check-${runNumber}`,
        raiderId: null,
        raiderName,
        viewers,
        category: 'Minecraft',
        startedAt: new Date().toISOString(),
        isTest: true,
      }, options),
      handleChat: (chat) => manager.handleChat(chat),
      timeScale: TIME_SCALE,
      random,
    });

    while (!result && manager.currentGame?.status === 'active') await delay(100);
    return result || { outcome: manager.currentGame?.outcome || 'no-result' };
  } finally {
    manager.shutdown();
  }
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

(async () => {
  let wins = 0;
  for (let run = 1; run <= RUNS; run += 1) {
    const result = await runSimulation(run);
    if (result.outcome === 'victory') wins += 1;
    console.log(`Run ${run}: ${result.outcome} (${result.reason || 'no reason'}, boss ${result.bossHpRemaining ?? '?'} HP, team ${result.teamHpRemaining ?? '?'} HP)`);
  }
  console.log(`Simulated win rate: ${wins}/${RUNS} (${Math.round(wins / RUNS * 100)}%)`);
})().catch((error) => {
  console.error(`Simulation check failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
