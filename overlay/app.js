const readyBadge = document.querySelector('#ready-badge');
const gameOverlay = document.querySelector('#game-overlay');
const battleHud = document.querySelector('#battle-hud');
const finishScreen = document.querySelector('#finish-screen');
const damageFeed = document.querySelector('#damage-feed');
const effectClasses = ['effect-hit', 'effect-shield', 'effect-shield-block', 'effect-heal', 'effect-rally', 'effect-boss-hit', 'effect-combo'];
let retryTimer;
let readyFadeTimer;
let effectTimer;
let finishTimer;
let currentArtKey = '';

document.body.classList.toggle('full-layout', new URLSearchParams(location.search).get('layout') === 'full');

const shapeMarkup = {
  'block-golem': '<rect class="fill-two" x="77" y="192" width="48" height="39" rx="5"/><rect class="fill-two" x="155" y="192" width="48" height="39" rx="5"/><rect class="fill-one" x="56" y="91" width="168" height="114" rx="11"/><rect class="fill-two" x="78" y="22" width="124" height="88" rx="8"/><path class="dark" d="M103 53h22v22h-22zm52 0h22v22h-22zm-30 20h28v25h-28z"/><rect class="fill-two" x="29" y="114" width="38" height="79" rx="9"/><rect class="fill-two" x="213" y="114" width="38" height="79" rx="9"/><path class="soft-line" d="M92 146h96M114 164h52"/>',
  'talkshow-titan': '<ellipse class="fill-one" cx="140" cy="78" rx="64" ry="60"/><path class="fill-two" d="M70 130h140l25 91H45z"/><path class="line" d="M102 83h2m70 0h2M120 109q20 16 40 0"/><path class="fill-one" d="M44 153 12 201l30 14 33-48zm192 0 32 48-30 14-33-48z"/><rect class="fill-two" x="202" y="38" width="13" height="94" rx="7" transform="rotate(28 202 38)"/><circle class="fill-one" cx="236" cy="34" r="21"/><path class="soft-line" d="M119 168h42"/>',
  'tactical-mech': '<path class="fill-one" d="m87 49 53-34 53 34 24 62-24 88H87l-24-88z"/><path class="fill-two" d="m105 61 35-23 35 23 14 48-14 61h-70l-14-61z"/><path class="dark" d="m100 88 30-14v26l-30 15zm80 0-30-14v26l30 15z"/><circle class="eye" cx="113" cy="98" r="8"/><circle class="eye" cx="167" cy="98" r="8"/><path class="fill-one" d="M66 120 25 142v43l42-9zm148 0 41 22v43l-42-9zM93 194l-12 37h45l14-37zm52 0 14 37h45l-12-37z"/><path class="line" d="M121 137h38m-28 18h18"/>',
  'storm-beast': '<path class="fill-two" d="M58 153c-29-48 9-95 54-79 24-50 94-42 104 14 48 1 62 62 20 85H75c-8-4-13-11-17-20z"/><path class="fill-one" d="m93 150 37-8 18 47-38 31zm103-5 43 14-26 36-34-25z"/><path class="fill-one" d="m142 117-20 43h26l-13 43 49-59h-29l19-27z"/><circle class="eye" cx="112" cy="111" r="7"/><circle class="eye" cx="178" cy="111" r="7"/>',
  'legendary-beast': '<path class="fill-one" d="M44 124 21 63l68 28q48-40 102 0l68-28-24 63q15 63-30 88l-18-28h-91l-18 28q-45-25-34-90z"/><path class="fill-two" d="m117 92 23-53 23 53-23 16z"/><path class="line" d="M92 130h2m92 0h2M116 158q24 16 48 0"/><path class="fill-two" d="m86 173-25 40 44-14zm108 0 25 40-44-14z"/><circle class="eye" cx="105" cy="127" r="8"/><circle class="eye" cx="175" cy="127" r="8"/>',
  'bass-golem': '<rect class="fill-one" x="49" y="37" width="182" height="179" rx="23"/><rect class="fill-two" x="65" y="53" width="150" height="148" rx="16"/><circle class="fill-one" cx="140" cy="126" r="58"/><circle class="dark" cx="140" cy="126" r="37"/><circle class="fill-two" cx="140" cy="126" r="18"/><circle class="fill-one" cx="89" cy="76" r="8"/><circle class="fill-one" cx="191" cy="76" r="8"/><path class="line" d="M112 184h56"/><path class="fill-one" d="M30 103H9v45h21m241-45h-21v45h21"/>',
  'street-giant': '<path class="fill-two" d="M29 210V93h43v117zm53 0V47h51v163zm62 0v-91h39v91zm51 0V72h54v138z"/><path class="fill-one" d="M92 79 112 18l20 61 41 45-17 73H83l-17-73z"/><path class="fill-two" d="m80 122-48 22-16 41 32 10 42-38zm89 0 48 22 16 41-32 10-42-38z"/><circle class="eye" cx="101" cy="100" r="7"/><circle class="eye" cx="127" cy="100" r="7"/><path class="soft-line" d="M106 120h18"/><path class="line" d="M43 111v15m82-56v18m95 8v13"/>',
  'lab-experiment': '<path class="fill-two" d="M107 23h66v17h-11v48l54 84c14 23-2 48-30 48H105c-28 0-44-25-30-48l54-84V40h-22z"/><path class="fill-one" d="M91 160h98l24 37q4 10-14 10H81q-18 0-14-10z"/><circle class="eye" cx="113" cy="137" r="8"/><circle class="eye" cx="169" cy="137" r="8"/><path class="soft-line" d="M116 165q25 18 50 0"/><circle class="fill-one" cx="62" cy="83" r="13"/><circle class="fill-two" cx="219" cy="62" r="9"/><circle class="fill-one" cx="207" cy="112" r="6"/>',
  'void-kaiju': '<path class="fill-one" d="M55 114 37 36l66 40q36-40 74 0l66-40-18 78q21 57-20 94l-23-33H98l-23 33q-41-37-20-94z"/><path class="fill-two" d="m103 88 37-59 37 59-19 22h-36z"/><path class="fill-two" d="m59 130-46 46 64-12zm162 0 46 46-64-12z"/><path class="line" d="M94 127h3m86 0h3M117 158q23 13 46 0"/><circle class="eye" cx="107" cy="124" r="8"/><circle class="eye" cx="173" cy="124" r="8"/><path class="soft-line" d="M140 179v24"/>',
};

function connect() {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${scheme}//${location.host}/ws/overlay`);
  socket.addEventListener('message', (message) => {
    try {
      const payload = JSON.parse(message.data);
      if (payload.game) renderGame(payload.game, payload.effect);
    } catch (error) {
      console.error('Could not read Raid Arena message.', error);
    }
  });
  socket.addEventListener('close', () => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, 1500);
  });
}

function renderGame(game, effect) {
  clearTimeout(readyFadeTimer);
  readyBadge.classList.add('fade');
  gameOverlay.hidden = false;
  const active = game.status === 'active';
  battleHud.hidden = !active;

  if (active) {
    clearTimeout(finishTimer);
    finishScreen.hidden = true;
    finishScreen.classList.remove('fade');
    document.querySelector('#raider-name').textContent = game.raiderName || 'Incoming raider';
    document.querySelector('#raid-viewers').textContent = `${Number(game.viewerCount || 0).toLocaleString()} VIEWERS`;
    document.querySelector('#boss-name').textContent = game.boss.name;
    document.querySelector('#boss-intro').textContent = game.boss.theme.intro;
    document.querySelector('#raid-category').textContent = game.boss.category;
    const bossPercent = percent(game.boss.hp, game.boss.maxHp);
    document.querySelector('#boss-hp-text').textContent = `${game.boss.hp} / ${game.boss.maxHp}`;
    document.querySelector('#boss-hp-bar').style.width = `${bossPercent}%`;
    document.querySelector('#team-hp-text').textContent = `${game.teamHp} / ${game.maxTeamHp}`;
    document.querySelector('#team-hp-bar').style.width = `${percent(game.teamHp, game.maxTeamHp)}%`;
    document.querySelector('#countdown').textContent = formatTime(game.secondsRemaining);
    document.querySelector('#raiders-joined').textContent = game.raidersJoined;
    document.querySelector('#home-joined').textContent = game.homeJoined;
    document.querySelector('#combo-label').textContent = `${game.comboMeter} / ${game.comboMax}`;
    document.querySelector('#combo-bar').style.width = `${percent(game.comboMeter, game.comboMax)}%`;
    const comboStatus = document.querySelector('#combo-status');
    comboStatus.classList.toggle('active', game.doubleDamageSeconds > 0);
    comboStatus.textContent = game.doubleDamageSeconds > 0
      ? `2× DAMAGE ACTIVE · ${game.doubleDamageSeconds}s`
      : `Alternate team attacks to charge 2× damage${hasRallyCharge(game) ? ' · RALLY CHARGED' : ''}`;
    const shieldStatus = document.querySelector('#shield-status');
    shieldStatus.classList.toggle('active', game.shieldActive);
    shieldStatus.textContent = game.shieldActive ? `SHIELD READY (${game.shieldSeconds}s)` : 'NO SHIELD';
    updateBossArt(game.boss.theme);
    renderFeed(game.feed || []);
  } else if (game.status === 'finished') {
    finishScreen.hidden = false;
    finishScreen.classList.remove('fade');
    renderFinish(game);
    clearTimeout(finishTimer);
    finishTimer = setTimeout(() => {
      finishScreen.classList.add('fade');
      finishTimer = setTimeout(() => {
        finishScreen.hidden = true;
        gameOverlay.hidden = true;
      }, 850);
    }, 7150);
  }

  if (effect) animateEffect(effect);
}

function updateBossArt(theme) {
  const colors = Array.isArray(theme.colors) ? theme.colors : ['#a98aff', '#4c91e8'];
  const colorOne = validColor(colors[0], '#a98aff');
  const colorTwo = validColor(colors[1], '#4c91e8');
  const shape = shapeMarkup[theme.shape] ? theme.shape : 'void-kaiju';
  const artKey = `${shape}:${colorOne}:${colorTwo}`;
  if (artKey === currentArtKey) return;
  currentArtKey = artKey;
  document.querySelector('.boss-panel').style.setProperty('--boss-color', colorOne);
  document.querySelector('.boss-panel').style.setProperty('--boss-color-two', colorTwo);
  const art = document.querySelector('#boss-art');
  art.innerHTML = `<svg viewBox="0 0 280 240" role="img" style="--boss-color:${colorOne};--boss-color-two:${colorTwo}">${shapeMarkup[shape]}</svg>`;
}

function renderFeed(actions) {
  damageFeed.replaceChildren();
  if (!actions.length) {
    const empty = document.createElement('li');
    empty.className = 'feed-empty';
    empty.textContent = 'Waiting for chat to join…';
    damageFeed.append(empty);
    return;
  }
  for (const action of actions.slice(0, 5)) {
    const row = document.createElement('li');
    const badge = document.createElement('span');
    badge.className = `team-badge ${action.team === 'RAIDERS' ? 'raiders' : 'home'}`;
    badge.textContent = action.team;
    const username = document.createElement('span');
    username.className = 'feed-user';
    username.textContent = action.username;
    const detail = document.createElement('span');
    detail.className = 'feed-detail';
    detail.textContent = action.detail;
    row.append(badge, username, detail);
    damageFeed.append(row);
  }
}

function renderFinish(game) {
  const result = game.result || {};
  const victory = result.outcome === 'victory';
  const lastStand = result.reason === 'last-stand';
  finishScreen.classList.toggle('victory', victory);
  finishScreen.classList.toggle('fallen', !victory);
  document.querySelector('#finish-eyebrow').textContent = lastStand
    ? 'LAST STAND · THE TEAM HELD ON'
    : victory ? 'THE TEAM BROUGHT IT DOWN' : 'THE ARENA HAS FALLEN';
  document.querySelector('#finish-title').textContent = victory ? 'RAID VICTORY' : 'RAID FALLEN';
  document.querySelector('#finish-boss').textContent = lastStand
    ? `${game.boss.name} was still standing, but the team held out for the victory.`
    : victory ? `${game.boss.name} was defeated.`
    : `${game.boss.name} survived the encounter.`;
  document.querySelector('#mvp-raider').textContent = result.mvpRaider?.username || '—';
  document.querySelector('#mvp-home').textContent = result.mvpHome?.username || '—';
  document.querySelector('#finish-raiders').textContent = result.raidersJoined || 0;
  document.querySelector('#countdown').textContent = 'DONE';
}

function animateEffect(effect) {
  const className = `effect-${effect}`;
  if (!effectClasses.includes(className)) return;
  gameOverlay.classList.remove(...effectClasses);
  void gameOverlay.offsetWidth;
  gameOverlay.classList.add(className);
  clearTimeout(effectTimer);
  effectTimer = setTimeout(() => gameOverlay.classList.remove(className), 900);
}

function hasRallyCharge(game) {
  return Object.values(game.rallyCharges || {}).some((count) => count > 0);
}

function percent(value, max) {
  return max ? Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100)) : 0;
}

function formatTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function validColor(value, fallback) {
  return /^#[\da-f]{6}$/i.test(value || '') ? value : fallback;
}

readyFadeTimer = setTimeout(() => readyBadge.classList.add('fade'), 5000);
connect();
