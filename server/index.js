require('dotenv').config();

const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const { TokenStore } = require('./token-store');
const { SettingsStore } = require('./settings-store');
const { RetentionTracker } = require('./retention');
const { GameManager, TEAM_HOME, TEAM_RAIDERS } = require('./game');
const { TwitchClient } = require('./twitch');

const app = express();
const server = http.createServer(app);
const overlaySockets = new WebSocketServer({ server, path: '/ws/overlay' });
const port = Number(process.env.PORT || 3000);
const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const redirectUri = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000';
const dataDir = path.resolve(process.env.RAID_ARENA_DATA_DIR || path.join(__dirname, 'data'));
const tokenFile = process.env.TOKEN_FILE || path.join(dataDir, 'tokens.json');
const settingsStore = new SettingsStore(path.join(dataDir, 'settings.json'));
const retention = new RetentionTracker(path.join(dataDir, 'raids.json'));
let twitch;
let simulationRunning = false;
let lastShoutoutAt = 0;
const shoutoutTargetTimes = new Map();

if (!clientId || !clientSecret) {
  console.error('Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET. Copy .env.example to .env and fill them in.');
  process.exit(1);
}

const game = new GameManager({
  broadcast: broadcastToOverlays,
  getSettings: () => settingsStore.get(),
  onGameStarted: (context) => retention.startRaid(context),
  onGameFinished: (context) => retention.recordResult(context),
  onChatObserved: (chat) => retention.recordChat(chat),
  sendBotMessage: (message) => twitch.sendChatMessage(message),
});

twitch = new TwitchClient({
  clientId,
  clientSecret,
  redirectUri,
  tokenStore: new TokenStore(tokenFile),
  onRaid: handleIncomingRaid,
  onChatMessage: (event) => {
    game.handleChat({
      userId: event.chatter_user_id,
      username: event.chatter_user_name,
      message: event.message?.text || '',
    }).catch((error) => console.error(`Chat command failed: ${error.message}`));
  },
});

app.use(express.json({ limit: '32kb' }));
app.use('/overlay', express.static(path.join(__dirname, '..', 'overlay')));
app.use('/dashboard', express.static(path.join(__dirname, '..', 'dashboard')));

app.get('/', async (req, res) => {
  if (req.query.code) {
    try {
      if (req.query.error) throw new Error(`Twitch authorization failed: ${req.query.error}`);
      await twitch.completeAuthorization({ code: req.query.code, state: req.query.state });
      return res.redirect('/?connected=1');
    } catch (error) {
      console.error(`Twitch OAuth callback failed: ${error.message}`);
      return res.status(400).send(`<h1>Twitch connection failed</h1><p>${escapeHtml(error.message)}</p><p><a href="/">Return to Raid Arena</a></p>`);
    }
  }
  if (req.query.error) {
    return res.status(400).send(`<h1>Twitch authorization cancelled</h1><p>${escapeHtml(String(req.query.error))}</p><p><a href="/">Return to Raid Arena</a></p>`);
  }
  res.sendFile(path.join(__dirname, '..', 'dashboard', 'index.html'));
});

app.get('/auth/twitch', (req, res) => {
  res.redirect(twitch.createAuthorizationUrl());
});

app.get('/api/status', (req, res) => {
  res.json({
    connected: Boolean(twitch.publicAccount()),
    account: twitch.publicAccount(),
    overlayClients: overlaySockets.clients.size,
    game: game.snapshot(),
    simulationRunning,
  });
});

app.get('/api/settings', (req, res) => res.json(settingsStore.get()));

app.post('/api/settings', async (req, res) => {
  try {
    const settings = await settingsStore.update(req.body || {});
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/raids', (req, res) => {
  res.json({ summary: retention.summary(), raids: retention.history(50) });
});

app.post('/test/raid', async (req, res) => {
  const raiderName = typeof req.body.raiderName === 'string' ? req.body.raiderName.trim() : '';
  const viewers = Number(req.body.viewerCount);
  if (!raiderName || raiderName.length > 25 || /[\r\n<>]/.test(raiderName)) {
    return res.status(400).json({ error: 'raiderName is required and must be 1–25 characters.' });
  }
  if (!Number.isInteger(viewers) || viewers < 0 || viewers > 1_000_000) {
    return res.status(400).json({ error: 'viewerCount must be a whole number from 0 to 1,000,000.' });
  }

  try {
    await twitch.handleTestRaid(raiderName, viewers);
    return res.json({ ok: true, message: 'Test raid started and sent to connected overlay clients.' });
  } catch (error) {
    console.error(`Test raid failed: ${error.message}`);
    return res.status(502).json({ error: error.message });
  }
});

app.post('/test/chat', async (req, res) => {
  const username = typeof req.body.user === 'string' ? req.body.user.trim() : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  const requestedTeam = req.body.team;
  const team = requestedTeam === undefined ? undefined : String(requestedTeam).toUpperCase();
  if (!username || username.length > 50 || /[\r\n<>]/.test(username)) {
    return res.status(400).json({ error: 'user is required and must be 1–50 characters.' });
  }
  if (!message || message.length > 500) {
    return res.status(400).json({ error: 'message is required and must be 1–500 characters.' });
  }
  if (team !== undefined && team !== TEAM_RAIDERS && team !== TEAM_HOME) {
    return res.status(400).json({ error: 'team must be RAIDERS or HOME.' });
  }
  const result = await game.handleChat({
    userId: `test:${username.toLowerCase()}`,
    username,
    message,
    teamOverride: team,
  });
  res.json({ ok: true, ...result });
});

app.post('/test/simulate', (req, res) => {
  if (simulationRunning) return res.status(409).json({ error: 'A simulated battle is already running.' });
  if (game.isActive) return res.status(409).json({ error: 'A battle is already in progress.' });
  simulationRunning = true;
  simulateBattle().catch((error) => console.error(`Battle simulation failed: ${error.message}`))
    .finally(() => { simulationRunning = false; });
  res.status(202).json({ ok: true, message: 'Simulation started: 40 fake chat actions over 30 seconds.' });
});

overlaySockets.on('connection', (socket) => {
  console.log(`Overlay connected (${overlaySockets.clients.size} client(s)).`);
  game.pushCurrent(socket);
  socket.on('close', () => console.log(`Overlay disconnected (${overlaySockets.clients.size} client(s)).`));
});

async function handleIncomingRaid(raid) {
  if (!raid.isTest && raid.raiderId && settingsStore.get().autoShoutout) {
    sendAutoShoutout(raid.raiderId, raid.raiderName);
  }
  return game.startRaid(raid, { durationSeconds: raid.durationSeconds });
}

async function sendAutoShoutout(raiderId, raiderName) {
  const now = Date.now();
  const targetLastSent = shoutoutTargetTimes.get(raiderId) || 0;
  if (now - lastShoutoutAt < 120_000) {
    console.log(`Auto-shoutout skipped for ${raiderName}: broadcaster two-minute cooldown is active.`);
    return;
  }
  if (now - targetLastSent < 60 * 60_000) {
    console.log(`Auto-shoutout skipped for ${raiderName}: same-channel one-hour target cooldown is active.`);
    return;
  }
  try {
    await twitch.sendShoutout(raiderId);
    lastShoutoutAt = Date.now();
    shoutoutTargetTimes.set(raiderId, lastShoutoutAt);
    console.log(`Sent automatic shoutout to ${raiderName}.`);
  } catch (error) {
    if (/429|rate limit/i.test(error.message)) lastShoutoutAt = Date.now();
    console.error(`Automatic shoutout to ${raiderName} failed: ${error.message}`);
  }
}

async function simulateBattle() {
  await twitch.handleTestRaid('ArenaSimulator', 250, { durationSeconds: 32 });
  const commands = [
    ['!attack', 0.45], ['!shield', 0.17], ['!heal', 0.20], ['!rally', 0.18],
  ];
  const raiderNames = Array.from({ length: 40 }, (_, index) => `RaidCrew${String(index + 1).padStart(2, '0')}`);
  const homeNames = Array.from({ length: 40 }, (_, index) => `HomeCrew${String(index + 1).padStart(2, '0')}`);
  let raiderIndex = 0;
  let homeIndex = 0;
  let alternatingAttackCount = 0;

  for (let index = 0; index < 40; index += 1) {
    if (index > 0) await delay(750);
    const message = chooseCommand(commands);
    let team = Math.random() < 0.5 ? TEAM_RAIDERS : TEAM_HOME;
    // Give the simulation a clear co-op combo moment while keeping the command roll random.
    if (message === '!attack' && alternatingAttackCount < 7) {
      team = alternatingAttackCount % 2 === 0 ? TEAM_RAIDERS : TEAM_HOME;
      alternatingAttackCount += 1;
    }
    const names = team === TEAM_RAIDERS ? raiderNames : homeNames;
    const username = team === TEAM_RAIDERS ? names[raiderIndex++] : names[homeIndex++];
    await game.handleChat({
      userId: `simulation:${team.toLowerCase()}:${index}`,
      username,
      message,
      teamOverride: team,
    });
  }
  console.log('Battle simulation injected 40 fake chat commands.');
}

function chooseCommand(weightedCommands) {
  const roll = Math.random();
  let cumulative = 0;
  for (const [command, weight] of weightedCommands) {
    cumulative += weight;
    if (roll < cumulative) return command;
  }
  return '!attack';
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function broadcastToOverlays(message) {
  const serialized = JSON.stringify(message);
  for (const socket of overlaySockets.clients) {
    if (socket.readyState === WebSocket.OPEN) socket.send(serialized);
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function start() {
  await Promise.all([settingsStore.load(), retention.load()]);
  await twitch.initialize();
  server.listen(port, 'localhost', () => console.log(`Raid Arena is ready at http://localhost:${port}`));
}

start().catch((error) => {
  console.error(`Could not start Raid Arena: ${error.message}`);
  process.exit(1);
});

async function stop() {
  game.shutdown();
  retention.shutdown();
  await twitch.shutdown();
  overlaySockets.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
