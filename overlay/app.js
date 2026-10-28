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

const query = new URLSearchParams(location.search);
document.body.classList.toggle('full-layout', query.get('layout') === 'full');
document.documentElement.classList.toggle('dark-background', query.get('bg') === 'dark');

const shapeMarkup = {
  'block-golem': '<rect class="fill-two" x="78" y="186" width="48" height="48"/><rect class="fill-two" x="154" y="186" width="48" height="48"/><path class="fill-one" d="M48 91h184v104H48z"/><path class="fill-two" d="M68 22h144v79H68z"/><path class="dark" d="M91 47h35v30H91zm63 0h35v30h-35zm-29 35h30v18h-30z"/><path class="fill-two" d="M19 104h42v79H19zm200 0h42v79h-42z"/><path class="soft-line" d="M88 139h104m-84 22h64"/>',
  'talkshow-titan': '<ellipse class="fill-one" cx="140" cy="78" rx="64" ry="60"/><path class="fill-two" d="M70 130h140l25 91H45z"/><path class="line" d="M102 83h2m70 0h2M120 109q20 16 40 0"/><path class="fill-one" d="M44 153 12 201l30 14 33-48zm192 0 32 48-30 14-33-48z"/><rect class="fill-two" x="202" y="38" width="13" height="94" rx="7" transform="rotate(28 202 38)"/><circle class="fill-one" cx="236" cy="34" r="21"/><path class="soft-line" d="M119 168h42"/>',
  'tactical-mech': '<path class="fill-two" d="M28 103 69 65l31 10 40-44 40 44 31-10 41 38-19 72-39 17H87l-39-17z"/><path class="fill-one" d="m86 55 54-40 54 40 26 57-22 81H82l-22-81z"/><path class="fill-two" d="m105 65 35-25 35 25 17 48-17 48h-70l-17-48z"/><path class="dark" d="m96 88 19-13h50l19 13-8 28h-72z"/><path class="eye" d="M108 96h64l-7 9h-50z"/><path class="fill-one" d="m55 123-37 24 9 39 42-12m156-51 37 24-9 39-42-12M95 188l-9 43h48l6-35m-2-8 6 8 6 35h48l-9-43z"/><path class="line" d="M119 139h42m-34 17h26"/>',
  'storm-beast': '<path class="fill-two" d="M55 166c-25-4-37-24-29-45 6-18 24-29 47-25-1-29 21-51 50-49 15-31 54-42 82-20 13 10 19 24 19 39 29-6 54 14 54 41 23 6 34 25 25 45-7 17-23 25-46 25H76c-8 0-15-4-21-11z"/><path class="fill-one" d="M46 171q24 18 45 0m98 0q23 19 45 0"/><path class="fill-one" d="m146 81-37 69h31l-14 65 63-90h-36l22-44z"/><path class="eye" d="M93 125h24l-7 8H96zm73 0h24l-7 8h-10z"/>',
  'legendary-beast': '<path class="fill-one" d="M44 124 21 63l68 28q48-40 102 0l68-28-24 63q15 63-30 88l-18-28h-91l-18 28q-45-25-34-90z"/><path class="fill-two" d="m117 92 23-53 23 53-23 16z"/><path class="line" d="M92 130h2m92 0h2M116 158q24 16 48 0"/><path class="fill-two" d="m86 173-25 40 44-14zm108 0 25 40-44-14z"/><circle class="eye" cx="105" cy="127" r="8"/><circle class="eye" cx="175" cy="127" r="8"/>',
  'bass-golem': '<path class="fill-one" d="M62 28h156v187H62z"/><path class="fill-two" d="M75 43h130v157H75z"/><circle class="fill-one" cx="111" cy="112" r="49"/><circle class="dark" cx="111" cy="112" r="36"/><circle class="fill-two" cx="111" cy="112" r="24"/><circle class="dark" cx="111" cy="112" r="12"/><circle class="fill-one" cx="169" cy="153" r="33"/><circle class="dark" cx="169" cy="153" r="23"/><circle class="fill-two" cx="169" cy="153" r="13"/><path class="line" d="M86 58h18m17 0h18M89 187h102"/><path class="fill-two" d="M40 94H18v58h22m200-58h22v58h-22z"/>',
  'street-giant': '<path class="fill-two" d="M18 218V126h33V85h31v63h22V39h42v123h18V86h30v51h23V62h45v156z"/><path class="fill-one" d="m84 108 13-51 43-30 43 30 13 51 54 34-13 43H43l-13-43z"/><path class="fill-two" d="M102 102h76v44h-76z"/><path class="dark" d="M115 111h15v20h-15zm37 0h15v20h-15z"/><path class="line" d="M125 157h30m-97-17v19m125-74v20m45 13v21m-160-83v22"/>',
  'lab-experiment': '<path class="fill-two" d="M113 19h54v16h-9v52l70 101c12 18-1 35-22 35H74c-21 0-34-17-22-35l70-101V35h-9z"/><path class="fill-one" d="M83 153h114l37 43q4 12-15 12H61q-19 0-15-12z"/><path class="dark" d="M108 141h64v31h-64z"/><circle class="eye" cx="121" cy="152" r="7"/><circle class="eye" cx="159" cy="152" r="7"/><circle class="fill-two" cx="105" cy="123" r="8"/><circle class="fill-one" cx="182" cy="113" r="11"/><circle class="fill-two" cx="203" cy="97" r="6"/><path class="line" d="M126 176q14 10 28 0"/>',
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
    const comboBadge = document.querySelector('#combo-active-badge');
    comboBadge.hidden = game.doubleDamageSeconds <= 0;
    comboBadge.textContent = game.doubleDamageSeconds > 0 ? `x2 DAMAGE ${game.doubleDamageSeconds}s` : '';
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
        battleHud.hidden = true;
        gameOverlay.hidden = true;
        gameOverlay.classList.remove(...effectClasses);
        readyBadge.classList.remove('fade');
        clearTimeout(readyFadeTimer);
        readyFadeTimer = setTimeout(() => readyBadge.classList.add('fade'), 5000);
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
  const classNames = effect === 'combo'
    ? ['effect-combo', 'effect-hit']
    : [`effect-${effect}`];
  if (!classNames.some((className) => effectClasses.includes(className))) return;
  gameOverlay.classList.remove(...effectClasses);
  void gameOverlay.offsetWidth;
  gameOverlay.classList.add(...classNames);
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
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function validColor(value, fallback) {
  return /^#[\da-f]{6}$/i.test(value || '') ? value : fallback;
}

readyFadeTimer = setTimeout(() => readyBadge.classList.add('fade'), 5000);
connect();
