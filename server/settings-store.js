const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({
  gameDurationSeconds: 90,
  bossDifficultyMultiplier: 1,
  autoShoutout: true,
  botMessages: true,
});

class SettingsStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.settings = { ...DEFAULT_SETTINGS };
  }

  async load() {
    try {
      const saved = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.settings = validateSettings({ ...DEFAULT_SETTINGS, ...saved });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.save();
    }
    return this.get();
  }

  get() {
    return { ...this.settings };
  }

  async update(values) {
    this.settings = validateSettings({ ...this.settings, ...values });
    await this.save();
    return this.get();
  }

  async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(this.settings, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await fs.rename(temporaryPath, this.filePath);
  }
}

function validateSettings(values) {
  const duration = Number(values.gameDurationSeconds);
  const difficulty = Number(values.bossDifficultyMultiplier);
  if (!Number.isInteger(duration) || duration < 30 || duration > 180) {
    throw new Error('Game duration must be a whole number from 30 to 180 seconds.');
  }
  if (!Number.isFinite(difficulty) || difficulty < 0.5 || difficulty > 3) {
    throw new Error('Boss difficulty must be between 0.5 and 3.0.');
  }
  if (typeof values.autoShoutout !== 'boolean' || typeof values.botMessages !== 'boolean') {
    throw new Error('Auto-shoutout and bot messages must be on or off.');
  }
  return {
    gameDurationSeconds: duration,
    bossDifficultyMultiplier: Math.round(difficulty * 10) / 10,
    autoShoutout: values.autoShoutout,
    botMessages: values.botMessages,
  };
}

module.exports = { DEFAULT_SETTINGS, SettingsStore };
