const crypto = require('node:crypto');
const { themeForCategory } = require('./themes');

const TEAM_RAIDERS = 'RAIDERS';
const TEAM_HOME = 'HOME';
const COMMANDS = new Set(['!attack', '!shield', '!heal', '!rally']);
const ACTION_COOLDOWN_MS = 4_000;
const CHAT_LOOKBACK_MS = 30 * 60_000;
const BOSS_ATTACK_INTERVAL_MS = 8_000;
const BOSS_ATTACK_DAMAGE = 10;
const HEAL_AMOUNT = 15;
const COMBO_MAX = 6;
const COMBO_DURATION_MS = 10_000;

/** Keeps the earliest message still inside the rolling 30-minute channel window. */
class PlayerRegistry {
  constructor() {
    this.messagesByUser = new Map();
  }

  recordChat(userId, timestamp = Date.now()) {
    const cutoff = timestamp - CHAT_LOOKBACK_MS;
    const messages = this.messagesByUser.get(userId) || [];
    while (messages.length && messages[0] < cutoff) messages.shift();
    messages.push(timestamp);
    this.messagesByUser.set(userId, messages);
    return { firstChatAt: messages[0], lastChatAt: timestamp };
  }

  prune(now = Date.now()) {
    for (const [userId, messages] of this.messagesByUser) {
      while (messages.length && messages[0] < now - CHAT_LOOKBACK_MS) messages.shift();
      if (!messages.length) this.messagesByUser.delete(userId);
    }
  }
}

class GameManager {
  constructor({ broadcast, getSettings, onGameStarted, onGameFinished, onChatObserved, sendBotMessage }) {
    this.broadcast = broadcast;
    this.getSettings = getSettings;
    this.onGameStarted = onGameStarted;
    this.onGameFinished = onGameFinished;
    this.onChatObserved = onChatObserved;
    this.sendBotMessage = sendBotMessage;
    this.playerRegistry = new PlayerRegistry();
    this.currentGame = null;
    this.tickTimer = null;
    this.lastRegistryPruneAt = 0;
  }

  get isActive() {
    return this.currentGame?.status === 'active';
  }

  async startRaid(raid, overrides = {}) {
    if (this.isActive) this.finish('interrupted-by-new-raid');

    const settings = { ...this.getSettings() };
    const startedAtMs = Date.parse(raid.startedAt) || Date.now();
    const durationSeconds = clampInteger(overrides.durationSeconds ?? settings.gameDurationSeconds, 30, 180);
    const viewers = Math.max(0, Number(raid.viewers) || 0);
    const baseHp = clamp(40 + 3 * viewers, 60, 600);
    const bossMaxHp = clamp(Math.round(baseHp * settings.bossDifficultyMultiplier), 60, 600);
    const theme = themeForCategory(raid.category);

    this.currentGame = {
      raidId: raid.raidId || crypto.randomUUID(),
      status: 'active',
      outcome: null,
      reason: null,
      startedAt: new Date(startedAtMs).toISOString(),
      startedAtMs,
      endsAtMs: startedAtMs + durationSeconds * 1000,
      nextBossAttackAtMs: startedAtMs + BOSS_ATTACK_INTERVAL_MS,
      durationSeconds,
      sourceRaid: { ...raid },
      settings,
      boss: { name: theme.name, category: raid.category || 'Unknown category', hp: bossMaxHp, maxHp: bossMaxHp, theme },
      teamHp: 100,
      maxTeamHp: 100,
      secondsRemaining: durationSeconds,
      comboMeter: 0,
      comboMax: COMBO_MAX,
      doubleDamageUntilMs: 0,
      shieldActive: false,
      rallyCharges: { [TEAM_RAIDERS]: 0, [TEAM_HOME]: 0 },
      lastAttackTeam: null,
      lastActionAtByUser: new Map(),
      players: new Map(),
      feed: [],
      result: null,
    };

    clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.tick(), 1000);
    this.broadcast({ type: 'game-start', game: this.snapshot() });
    await this.runCallback(this.onGameStarted, { game: this.snapshot(), raid });
    if (settings.botMessages) this.queueBotMessage('Raid Arena! Type !attack, !shield, !heal, or !rally. Raiders and home chat, work together!');
    return this.snapshot();
  }

  async handleChat(chat) {
    const game = this.currentGame;
    const username = String(chat.username || chat.chatter_user_name || chat.user || 'Chatter').trim().slice(0, 50);
    const userId = String(chat.userId || chat.chatter_user_id || chat.user || username).trim().toLowerCase();
    const now = Number(chat.timestamp) || Date.now();
    const { firstChatAt } = this.playerRegistry.recordChat(userId, now);
    if (now - this.lastRegistryPruneAt > 60_000) {
      this.playerRegistry.prune(now);
      this.lastRegistryPruneAt = now;
    }

    const forcedTeam = normalizeTeam(chat.teamOverride || chat.team);
    const inferredTeam = game && firstChatAt >= game.startedAtMs ? TEAM_RAIDERS : TEAM_HOME;
    const team = forcedTeam || inferredTeam;
    await this.runCallback(this.onChatObserved, {
      userId, username, timestamp: now, firstChatAt, teamOverride: forcedTeam,
    });

    if (game && game.status === 'active') this.getPlayer(game, userId, username, team);
    const message = String(chat.message || chat.text || '').trim();
    const command = message.split(/\s+/, 1)[0].toLowerCase();
    if (!game || game.status !== 'active' || !COMMANDS.has(command)) {
      return { accepted: false, reason: !game || game.status !== 'active' ? 'no-active-game' : 'not-a-command', team };
    }
    if (now >= game.endsAtMs) {
      this.finish('timer-expired');
      return { accepted: false, reason: 'game-ended', team };
    }

    const lastAction = game.lastActionAtByUser.get(userId);
    if (lastAction && now - lastAction < ACTION_COOLDOWN_MS) {
      return { accepted: false, reason: 'cooldown', retryAfterMs: ACTION_COOLDOWN_MS - (now - lastAction), team };
    }
    game.lastActionAtByUser.set(userId, now);
    const player = this.getPlayer(game, userId, username, team);
    const effect = this.performAction(game, player, command, now);
    game.secondsRemaining = Math.max(0, Math.ceil((game.endsAtMs - now) / 1000));
    this.broadcast({ type: 'game-state', game: this.snapshot(), effect });
    if (game.boss.hp <= 0) this.finish('boss-defeated');
    return { accepted: true, command, team, effect };
  }

  getPlayer(game, userId, username, team) {
    let player = game.players.get(userId);
    if (!player) {
      player = { userId, username, team, damage: 0, healing: 0, shields: 0, rallies: 0, score: 0, actions: 0 };
      game.players.set(userId, player);
    } else {
      player.username = username;
    }
    return player;
  }

  performAction(game, player, command, now) {
    player.actions += 1;
    let effect;
    let detail;
    if (command === '!attack') {
      let comboPoints = 0;
      if (game.lastAttackTeam && game.lastAttackTeam !== player.team) {
        comboPoints = 1 + game.rallyCharges[player.team];
        game.comboMeter = Math.min(game.comboMax, game.comboMeter + comboPoints);
        game.rallyCharges[player.team] = 0;
        if (game.comboMeter >= game.comboMax) {
          game.comboMeter = 0;
          game.doubleDamageUntilMs = now + COMBO_DURATION_MS;
          if (game.settings.botMessages) this.queueBotMessage('Combo full! Team attacks deal 2x damage for the next 10 seconds!');
          effect = 'combo';
        }
      } else if (game.lastAttackTeam === player.team) {
        // Consecutive hits from one side break the alternating team combo.
        game.comboMeter = 0;
      }
      game.lastAttackTeam = player.team;

      const rolled = randomInteger(5, 12);
      const multiplier = now < game.doubleDamageUntilMs ? 2 : 1;
      const damage = Math.min(game.boss.hp, rolled * multiplier);
      game.boss.hp = Math.max(0, game.boss.hp - damage);
      player.damage += damage;
      player.score += damage;
      detail = `hit for ${damage} damage${multiplier === 2 ? ' (2×)' : ''}`;
      effect = effect || 'hit';
    } else if (command === '!shield') {
      game.shieldActive = true;
      player.shields += 1;
      player.score += 10;
      detail = 'raised a team shield';
      effect = 'shield';
    } else if (command === '!heal') {
      const restored = Math.min(HEAL_AMOUNT, game.maxTeamHp - game.teamHp);
      game.teamHp += restored;
      player.healing += restored;
      player.score += restored;
      detail = restored ? `healed the team for ${restored} HP` : 'tried to heal a full team';
      effect = 'heal';
    } else if (command === '!rally') {
      const chargeTeam = otherTeam(player.team);
      game.rallyCharges[chargeTeam] = Math.min(3, game.rallyCharges[chargeTeam] + 1);
      player.rallies += 1;
      player.score += 3;
      detail = `rallied for the ${chargeTeam} team`; 
      effect = 'rally';
    }

    this.addFeed(game, {
      username: player.username,
      team: player.team,
      command: command.slice(1),
      detail,
      effect,
      at: new Date(now).toISOString(),
    });
    return effect;
  }

  addFeed(game, action) {
    game.feed.unshift({ id: crypto.randomUUID(), ...action });
    game.feed = game.feed.slice(0, 5);
  }

  tick() {
    const game = this.currentGame;
    if (!game || game.status !== 'active') return;
    const now = Date.now();
    while (game.status === 'active' && now >= game.nextBossAttackAtMs) {
      game.nextBossAttackAtMs += BOSS_ATTACK_INTERVAL_MS;
      let effect;
      if (game.shieldActive) {
        game.shieldActive = false;
        effect = 'shield-block';
      } else {
        game.teamHp = Math.max(0, game.teamHp - BOSS_ATTACK_DAMAGE);
        effect = 'boss-hit';
      }
      this.broadcast({ type: 'game-state', game: this.snapshot(), effect });
      if (game.teamHp <= 0) {
        this.finish('team-defeated');
        return;
      }
    }
    if (now >= game.endsAtMs) {
      this.finish('timer-expired');
      return;
    }
    game.secondsRemaining = Math.max(0, Math.ceil((game.endsAtMs - now) / 1000));
    this.broadcast({ type: 'game-state', game: this.snapshot() });
  }

  finish(reason) {
    const game = this.currentGame;
    if (!game || game.status !== 'active') return;
    clearInterval(this.tickTimer);
    game.status = 'finished';
    game.outcome = reason === 'boss-defeated' ? 'victory' : 'fallen';
    game.reason = reason;
    game.finishedAt = new Date().toISOString();
    game.secondsRemaining = 0;
    const players = [...game.players.values()];
    game.result = {
      outcome: game.outcome,
      reason,
      mvpRaider: topPlayer(players, TEAM_RAIDERS),
      mvpHome: topPlayer(players, TEAM_HOME),
      raidersJoined: players.filter((player) => player.team === TEAM_RAIDERS).length,
      bossHpRemaining: game.boss.hp,
      teamHpRemaining: game.teamHp,
      durationSeconds: Math.min(game.durationSeconds, Math.round((Date.now() - game.startedAtMs) / 1000)),
    };
    const snapshot = this.snapshot();
    this.broadcast({ type: 'game-finish', game: snapshot });
    this.runCallback(this.onGameFinished, { game: snapshot, raid: game.sourceRaid, result: snapshot.result });
    if (game.settings.botMessages) {
      const verdict = game.outcome === 'victory' ? 'RAID VICTORY' : 'RAID FALLEN';
      const raiderMvp = snapshot.result.mvpRaider?.username || '—';
      const homeMvp = snapshot.result.mvpHome?.username || '—';
      this.queueBotMessage(`${verdict}! Raider MVP: ${raiderMvp}. Home MVP: ${homeMvp}. ${snapshot.result.raidersJoined} raiders joined!`);
    }
  }

  snapshot() {
    const game = this.currentGame;
    if (!game) return null;
    const now = Date.now();
    const durationRemaining = game.status === 'active' ? Math.max(0, Math.ceil((game.endsAtMs - now) / 1000)) : 0;
    return {
      raidId: game.raidId,
      raiderName: game.sourceRaid.raiderName,
      viewerCount: game.sourceRaid.viewers,
      status: game.status,
      outcome: game.outcome,
      reason: game.reason,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt || null,
      durationSeconds: game.durationSeconds,
      secondsRemaining: durationRemaining,
      boss: { ...game.boss, hpPercent: Math.round((game.boss.hp / game.boss.maxHp) * 100) },
      teamHp: game.teamHp,
      maxTeamHp: game.maxTeamHp,
      comboMeter: game.comboMeter,
      comboMax: game.comboMax,
      doubleDamageSeconds: Math.max(0, Math.ceil((game.doubleDamageUntilMs - now) / 1000)),
      shieldActive: game.shieldActive,
      rallyCharges: { ...game.rallyCharges },
      raidersJoined: [...game.players.values()].filter((player) => player.team === TEAM_RAIDERS).length,
      homeJoined: [...game.players.values()].filter((player) => player.team === TEAM_HOME).length,
      feed: game.feed.map((item) => ({ ...item })),
      result: game.result ? { ...game.result } : null,
    };
  }

  pushCurrent(socket) {
    const game = this.snapshot();
    if (!game) return;
    const type = game.status === 'active' ? 'game-start' : 'game-finish';
    socket.send(JSON.stringify({ type, game }));
  }

  queueBotMessage(message) {
    this.runCallback(this.sendBotMessage, message);
  }

  async runCallback(callback, value) {
    if (typeof callback !== 'function') return;
    try {
      await callback(value);
    } catch (error) {
      console.error(`Raid Arena callback failed: ${error.message}`);
    }
  }

  shutdown() {
    clearInterval(this.tickTimer);
  }
}

function topPlayer(players, team) {
  const candidates = players.filter((player) => player.team === team && player.actions > 0);
  candidates.sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  if (!candidates.length) return null;
  return { username: candidates[0].username, score: candidates[0].score };
}

function normalizeTeam(team) {
  const normalized = String(team || '').toUpperCase();
  return normalized === TEAM_RAIDERS || normalized === TEAM_HOME ? normalized : null;
}

function otherTeam(team) {
  return team === TEAM_RAIDERS ? TEAM_HOME : TEAM_RAIDERS;
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value, min, max) {
  const integer = Number.parseInt(value, 10);
  return clamp(Number.isInteger(integer) ? integer : min, min, max);
}

module.exports = { GameManager, PlayerRegistry, TEAM_HOME, TEAM_RAIDERS };
