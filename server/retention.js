const fs = require('node:fs/promises');
const path = require('node:path');
const SAMPLE_MINUTES = [1, 5, 10];
const SAMPLE_WINDOW_MS = 60_000;

/** Records active raider chatter in the minute-long window at 1, 5, and 10 minutes. */
class RetentionTracker {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.records = [];
    this.sessions = new Map();
    this.writeQueue = Promise.resolve();
  }

  async load() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.records = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.records = [];
    }
    // A running game cannot be resumed after a process restart. Make that visible
    // in history instead of leaving the dashboard's result column pending forever.
    const recoveredAt = new Date().toISOString();
    let recovered = false;
    for (const record of this.records) {
      if (!record.result || record.result === 'in-progress') {
        record.result = 'interrupted';
        record.reason = 'server-restart';
        record.finishedAt ||= recoveredAt;
        recovered = true;
      }
    }
    if (recovered) await this.persist();
    return this;
  }

  async startRaid({ raid, game }) {
    const startedAt = Date.parse(game.startedAt) || Date.now();
    const record = {
      raidId: game.raidId,
      raiderName: raid.raiderName || 'Unknown raider',
      raiderId: raid.raiderId || null,
      viewerCount: Number(raid.viewers) || 0,
      category: raid.category || 'Unknown category',
      bossName: game.boss.name,
      startedAt: game.startedAt,
      finishedAt: null,
      result: null,
      mvpRaider: null,
      mvpHome: null,
      raidersJoined: 0,
      retention: {
        oneMinute: { distinctChatters: null, sampledAt: null },
        fiveMinutes: { distinctChatters: null, sampledAt: null },
        tenMinutes: { distinctChatters: null, retainedFromOneMinute: null, sampledAt: null },
      },
    };
    this.records.unshift(record);
    this.records = this.records.slice(0, 500);
    const session = { raidId: record.raidId, startedAt, activity: new Map(), firstMinuteIds: new Set(), timers: [] };
    this.sessions.set(record.raidId, session);
    for (const minute of SAMPLE_MINUTES) {
      const timer = setTimeout(() => {
        this.takeSample(record.raidId, minute).catch((error) => console.error(`Retention sample failed: ${error.message}`));
      }, Math.max(0, startedAt + minute * 60_000 - Date.now()));
      timer.unref?.();
      session.timers.push(timer);
    }
    await this.persist();
  }

  async recordChat({ userId, username, timestamp, firstChatAt, teamOverride }) {
    const at = Number(timestamp) || Date.now();
    for (const session of this.sessions.values()) {
      if (at < session.startedAt || at > session.startedAt + 10 * 60_000) continue;
      const isRaider = teamOverride === 'RAIDERS' || (!teamOverride && Number(firstChatAt) >= session.startedAt);
      if (!isRaider || teamOverride === 'HOME') continue;
      let entry = session.activity.get(userId);
      if (!entry) {
        entry = { username, timestamps: [] };
        session.activity.set(userId, entry);
      }
      entry.username = username;
      entry.timestamps.push(at);
    }
  }

  async takeSample(raidId, minute) {
    const session = this.sessions.get(raidId);
    const record = this.records.find((item) => item.raidId === raidId);
    if (!session || !record) return;
    const sampleAt = session.startedAt + minute * 60_000;
    const windowStart = sampleAt - SAMPLE_WINDOW_MS;
    const activeIds = new Set();
    for (const [userId, entry] of session.activity) {
      if (entry.timestamps.some((at) => at >= windowStart && at <= sampleAt)) activeIds.add(userId);
    }

    const sample = { distinctChatters: activeIds.size, sampledAt: new Date(sampleAt).toISOString() };
    if (minute === 1) {
      record.retention.oneMinute = sample;
      session.firstMinuteIds = activeIds;
    } else if (minute === 5) {
      record.retention.fiveMinutes = sample;
    } else {
      const retained = [...activeIds].filter((userId) => session.firstMinuteIds.has(userId)).length;
      record.retention.tenMinutes = { ...sample, retainedFromOneMinute: retained };
      for (const timer of session.timers) clearTimeout(timer);
      this.sessions.delete(raidId);
    }
    await this.persist();
  }

  async recordResult({ game, result }) {
    const record = this.records.find((item) => item.raidId === game.raidId);
    if (!record) return;
    record.finishedAt = game.finishedAt;
    record.result = result.outcome;
    record.reason = result.reason || game.reason || null;
    record.mvpRaider = result.mvpRaider?.username || null;
    record.mvpHome = result.mvpHome?.username || null;
    record.raidersJoined = result.raidersJoined;
    await this.persist();
  }

  summary() {
    const eligible = this.records.filter((record) =>
      Number(record.retention?.oneMinute?.distinctChatters) > 0 &&
      Number.isFinite(record.retention?.tenMinutes?.retainedFromOneMinute));
    const percentages = eligible.map((record) =>
      (record.retention.tenMinutes.retainedFromOneMinute / record.retention.oneMinute.distinctChatters) * 100);
    return {
      totalRaids: this.records.length,
      completedSamples: eligible.length,
      averageTenMinuteRetentionPercent: percentages.length
        ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
        : null,
    };
  }

  history(limit = 50) {
    return this.records.slice(0, limit).map((record) => ({ ...record, retention: { ...record.retention } }));
  }

  persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(this.records, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
      await fs.rename(temporaryPath, this.filePath);
    });
    return this.writeQueue;
  }

  shutdown() {
    for (const session of this.sessions.values()) {
      for (const timer of session.timers) clearTimeout(timer);
    }
    this.sessions.clear();
  }
}

module.exports = { RetentionTracker };
