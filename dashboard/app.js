const connectionStatus = document.querySelector('#connection-status');
const accountName = document.querySelector('#account-name');
const connectLink = document.querySelector('#connect-link');
const overlayStatus = document.querySelector('#overlay-status');
const gameStatus = document.querySelector('#game-status');
const testResult = document.querySelector('#test-result');
const simulationResult = document.querySelector('#simulate-result');
const simulateButton = document.querySelector('#simulate-button');
const settingsResult = document.querySelector('#settings-result');

async function refreshStatus() {
  try {
    const response = await fetch('/api/status');
    const status = await response.json();
    connectionStatus.textContent = status.connected ? 'Connected' : 'Not connected';
    accountName.textContent = status.account ? `@${status.account.login}` : 'Connect the channel broadcaster to enable live raids, chat, and Helix tools.';
    connectLink.textContent = status.connected ? 'Reconnect Twitch' : 'Connect Twitch';
    overlayStatus.textContent = status.overlayClients === 1
      ? '1 overlay connected'
      : `${status.overlayClients} overlays connected`;
    simulateButton.disabled = status.simulationRunning || status.game?.status === 'active';
    if (status.simulationRunning) simulationResult.textContent = 'Simulation running: 70 fake chat actions are arriving for 60 seconds.';
    else if (status.game?.status === 'active') gameStatus.textContent = `Battle live · ${status.game.secondsRemaining}s remaining`;
    else if (status.game?.status === 'finished') gameStatus.textContent = `Last battle: ${status.game.outcome === 'victory' ? 'victory' : 'fallen'}`;
    else gameStatus.textContent = 'Waiting for a raid';
  } catch {
    connectionStatus.textContent = 'Server unavailable';
  }
}

async function loadSettings() {
  const response = await fetch('/api/settings');
  const settings = await response.json();
  document.querySelector('#game-duration').value = settings.gameDurationSeconds;
  document.querySelector('#boss-difficulty').value = settings.bossDifficultyMultiplier;
  document.querySelector('#auto-shoutout').checked = settings.autoShoutout;
  document.querySelector('#bot-messages').checked = settings.botMessages;
}

async function refreshHistory() {
  try {
    const response = await fetch('/api/raids');
    const data = await response.json();
    const average = data.summary.averageTenMinuteRetentionPercent;
    document.querySelector('#retention-average').textContent = average === null ? '—' : `${average}%`;
    document.querySelector('#sample-count').textContent = data.summary.completedSamples;
    renderHistory(data.raids);
  } catch (error) {
    console.error('Could not load raid history.', error);
  }
}

function renderHistory(raids) {
  const body = document.querySelector('#raid-history');
  body.replaceChildren();
  if (!raids.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'empty-cell';
    cell.textContent = 'No raids recorded yet.';
    row.append(cell);
    body.append(row);
    return;
  }

  for (const raid of raids) {
    const row = document.createElement('tr');
    addCell(row, `${formatDate(raid.startedAt)} · ${raid.raiderName}`);
    addCell(row, Number(raid.viewerCount).toLocaleString());
    addCell(row, raid.bossName || '—');
    const result = addCell(row, raid.result ? raid.result.toUpperCase() : 'IN PROGRESS');
    result.className = `result-cell ${raid.result || 'pending'}`;
    addCell(row, raid.mvpRaider || '—');
    addCell(row, raid.mvpHome || '—');
    addCell(row, `${sampleValue(raid, 'oneMinute', 1)} / ${sampleValue(raid, 'fiveMinutes', 5)} / ${sampleValue(raid, 'tenMinutes', 10)}`);
    body.append(row);
  }
}

function addCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.append(cell);
  return cell;
}

function sampleValue(raid, key, minute) {
  const value = raid.retention?.[key]?.distinctChatters;
  if (value !== null && value !== undefined) return String(value);
  if (raid.result === 'interrupted') return 'interrupted';
  const sampleAt = Date.parse(raid.startedAt) + minute * 60_000;
  const remaining = sampleAt - Date.now();
  if (Number.isFinite(sampleAt) && remaining > 0) {
    const seconds = Math.ceil(remaining / 1000);
    return `pending (${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')})`;
  }
  return '—';
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

document.querySelector('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  settingsResult.textContent = 'Saving…';
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameDurationSeconds: Number(document.querySelector('#game-duration').value),
        bossDifficultyMultiplier: Number(document.querySelector('#boss-difficulty').value),
        autoShoutout: document.querySelector('#auto-shoutout').checked,
        botMessages: document.querySelector('#bot-messages').checked,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save settings.');
    settingsResult.textContent = 'Saved. New settings apply to the next raid.';
  } catch (error) {
    settingsResult.textContent = error.message;
  }
});

document.querySelector('#raid-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  testResult.textContent = 'Starting test raid…';
  try {
    const response = await fetch('/test/raid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raiderName: form.get('raiderName'), viewerCount: Number(form.get('viewerCount')) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not start the test raid.');
    testResult.textContent = result.message;
    refreshHistory();
  } catch (error) {
    testResult.textContent = error.message;
  }
});

simulateButton.addEventListener('click', async () => {
  simulateButton.disabled = true;
  simulationResult.textContent = 'Starting simulation…';
  try {
    const response = await fetch('/test/simulate', { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not start the simulation.');
    simulationResult.textContent = result.message;
    refreshHistory();
  } catch (error) {
    simulationResult.textContent = error.message;
  } finally {
    refreshStatus();
  }
});

document.querySelector('#refresh-history').addEventListener('click', refreshHistory);

loadSettings().catch((error) => { settingsResult.textContent = error.message; });
refreshStatus();
refreshHistory();
setInterval(refreshStatus, 3000);
setInterval(refreshHistory, 10_000);
