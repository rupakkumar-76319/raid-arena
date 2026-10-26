const crypto = require('node:crypto');
const WebSocket = require('ws');

const OAUTH_BASE = 'https://id.twitch.tv/oauth2';
const HELIX_BASE = 'https://api.twitch.tv/helix';
const EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws';
const SCOPES = [
  'moderator:read:followers',
  'channel:read:subscriptions',
  'user:read:chat',
  'user:write:chat',
  'moderator:manage:shoutouts',
];

class TwitchClient {
  constructor({ clientId, clientSecret, redirectUri, tokenStore, onRaid, onChatMessage }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.tokenStore = tokenStore;
    this.onRaid = onRaid;
    this.onChatMessage = onChatMessage;
    this.tokens = null;
    this.oauthStates = new Map();
    this.eventSocket = null;
    this.eventReconnectTimer = null;
    this.eventReconnectDelay = 1000;
    this.stopping = false;
  }

  async initialize() {
    this.tokens = await this.tokenStore.read();
    if (!this.tokens) return;

    try {
      const accessToken = await this.getAccessToken();
      const validation = await this.validateToken(accessToken);
      if (validation.client_id !== this.clientId) {
        throw new Error('The saved Twitch token belongs to a different client ID. Reconnect Twitch.');
      }
      this.tokens.broadcasterId = validation.user_id;
      this.tokens.broadcasterLogin = validation.login;
      this.tokens.scopes = validation.scopes || [];
      await this.tokenStore.write(this.tokens);
      this.connectEventSub();
      console.log(`Loaded Twitch account @${this.tokens.broadcasterLogin}.`);
    } catch (error) {
      console.error(`Could not restore the Twitch session: ${error.message}`);
      if (/invalid refresh token|invalid access token|401/i.test(error.message)) {
        this.tokens = null;
        await this.tokenStore.clear();
        console.error('Saved Twitch tokens were cleared. Reconnect at /auth/twitch.');
      }
    }
  }

  createAuthorizationUrl() {
    const state = crypto.randomBytes(24).toString('hex');
    this.oauthStates.set(state, Date.now() + 10 * 60 * 1000);
    // Bound outstanding states in case the local app is left open for a long time.
    for (const [key, expiry] of this.oauthStates) {
      if (expiry < Date.now()) this.oauthStates.delete(key);
    }
    while (this.oauthStates.size > 10) this.oauthStates.delete(this.oauthStates.keys().next().value);

    const url = new URL(`${OAUTH_BASE}/authorize`);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: SCOPES.join(' '),
      state,
    }).toString();
    return url.toString();
  }

  async completeAuthorization({ code, state }) {
    const expiresAt = this.oauthStates.get(state);
    this.oauthStates.delete(state);
    if (!expiresAt || expiresAt < Date.now()) {
      throw new Error('OAuth state was missing or expired. Start again from /auth/twitch.');
    }

    const form = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
    });
    const response = await fetch(`${OAUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const tokenData = await readJsonResponse(response, 'Twitch OAuth token exchange');
    const validation = await this.validateToken(tokenData.access_token);
    if (validation.client_id !== this.clientId) throw new Error('Twitch returned a token for a different client ID.');

    this.tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      scopes: validation.scopes || tokenData.scope || [],
      broadcasterId: validation.user_id,
      broadcasterLogin: validation.login,
    };
    await this.tokenStore.write(this.tokens);
    this.connectEventSub();
    return this.publicAccount();
  }

  publicAccount() {
    if (!this.tokens) return null;
    return {
      id: this.tokens.broadcasterId,
      login: this.tokens.broadcasterLogin,
      scopes: this.tokens.scopes,
    };
  }

  async validateToken(accessToken) {
    const response = await fetch(`${OAUTH_BASE}/validate`, {
      headers: { Authorization: `OAuth ${accessToken}` },
    });
    return readJsonResponse(response, 'Twitch token validation');
  }

  async getAccessToken(forceRefresh = false) {
    if (!this.tokens) throw new Error('Connect a broadcaster at /auth/twitch first.');
    if (!forceRefresh && this.tokens.expiresAt - Date.now() > 60_000) return this.tokens.accessToken;
    if (!this.tokens.refreshToken) throw new Error('No refresh token is saved. Reconnect Twitch.');

    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const response = await fetch(`${OAUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const refreshed = await readJsonResponse(response, 'Twitch token refresh');
    this.tokens = {
      ...this.tokens,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || this.tokens.refreshToken,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      scopes: refreshed.scope || this.tokens.scopes,
    };
    await this.tokenStore.write(this.tokens);
    return this.tokens.accessToken;
  }

  async helix(path, options = {}, retry = true) {
    const accessToken = await this.getAccessToken();
    const response = await fetch(`${HELIX_BASE}${path}`, {
      ...options,
      headers: {
        'Client-Id': this.clientId,
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    if (response.status === 401 && retry) {
      await this.getAccessToken(true);
      return this.helix(path, options, false);
    }
    return readJsonResponse(response, `Twitch Helix ${path}`);
  }

  async findUserByLogin(login) {
    const data = await this.helix(`/users?login=${encodeURIComponent(login)}`);
    return data.data?.[0] || null;
  }

  async getChannelCategory(broadcasterId) {
    const data = await this.helix(`/channels?broadcaster_id=${encodeURIComponent(broadcasterId)}`);
    return data.data?.[0]?.game_name || 'No category listed';
  }

  async sendChatMessage(message) {
    const broadcasterId = this.tokens?.broadcasterId;
    if (!broadcasterId) throw new Error('Connect the channel broadcaster before sending chat messages.');
    const result = await this.helix('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({
        broadcaster_id: broadcasterId,
        sender_id: broadcasterId,
        message: String(message).slice(0, 500),
      }),
    });
    const sent = result.data?.[0];
    if (!sent?.is_sent) {
      throw new Error(sent?.drop_reason?.message || 'Twitch did not send the chat message.');
    }
    return sent;
  }

  async sendShoutout(toBroadcasterId) {
    const fromBroadcasterId = this.tokens?.broadcasterId;
    if (!fromBroadcasterId) throw new Error('Connect the channel broadcaster before sending shoutouts.');
    const query = new URLSearchParams({
      from_broadcaster_id: fromBroadcasterId,
      to_broadcaster_id: toBroadcasterId,
      moderator_id: fromBroadcasterId,
    });
    return this.helix(`/chat/shoutouts?${query}`, { method: 'POST' });
  }

  async createEventSubscription(type, condition, sessionId) {
    const result = await this.helix('/eventsub/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        type,
        version: '1',
        condition,
        transport: { method: 'websocket', session_id: sessionId },
      }),
    });
    console.log(`EventSub ${type} subscription: ${result.data?.[0]?.status || 'created'}.`);
  }

  connectEventSub(url = EVENTSUB_URL, inheritedSubscriptions = false) {
    if (this.stopping) return;
    clearTimeout(this.eventReconnectTimer);
    const socket = new WebSocket(url);
    const previousSocket = this.eventSocket;
    this.eventSocket = socket;
    let welcomed = false;
    let keepaliveTimer;
    let keepaliveTimeoutSeconds;

    socket.on('open', () => console.log('Connected to Twitch EventSub WebSocket.'));
    socket.on('message', async (raw) => {
      if (keepaliveTimer) clearTimeout(keepaliveTimer);
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch (error) {
        console.error(`Ignoring invalid EventSub message: ${error.message}`);
        return;
      }
      const messageType = message.metadata?.message_type;
      const session = message.payload?.session;

      if (messageType === 'session_welcome') {
        welcomed = true;
        keepaliveTimeoutSeconds = session?.keepalive_timeout_seconds;
        this.eventReconnectDelay = 1000;
        if (previousSocket && previousSocket !== socket && previousSocket.readyState === WebSocket.OPEN) {
          previousSocket.close(1000, 'EventSub session resumed');
        }
        if (inheritedSubscriptions) {
          console.log('EventSub session resumed; subscriptions carried over.');
        } else {
          try {
            await this.createEventSubscription('channel.raid', {
              to_broadcaster_user_id: this.tokens.broadcasterId,
            }, session.id);
            await this.createEventSubscription('channel.chat.message', {
              broadcaster_user_id: this.tokens.broadcasterId,
              user_id: this.tokens.broadcasterId,
            }, session.id);
          } catch (error) {
            console.error(`Could not subscribe to EventSub: ${error.message}`);
            socket.close(1011, 'Subscription setup failed');
          }
        }
      } else if (messageType === 'session_reconnect') {
        console.log('Twitch requested an EventSub session reconnect.');
        this.connectEventSub(session.reconnect_url, true);
      } else if (messageType === 'notification') {
        const { subscription, event } = message.payload || {};
        if (subscription?.type === 'channel.raid') {
          await this.handleRaid({
            raiderId: event.from_broadcaster_user_id,
            raiderName: event.from_broadcaster_user_name,
            viewers: event.viewers,
            isTest: false,
          });
        } else if (subscription?.type === 'channel.chat.message' && this.onChatMessage) {
          this.onChatMessage(event);
        }
      } else if (messageType === 'revocation') {
        console.error(`EventSub subscription revoked: ${message.payload?.subscription?.status || 'unknown reason'}.`);
      }

      if (keepaliveTimeoutSeconds && socket === this.eventSocket && socket.readyState === WebSocket.OPEN) {
        keepaliveTimer = setTimeout(() => {
          console.error('EventSub keepalive timed out; reconnecting.');
          socket.terminate();
        }, (keepaliveTimeoutSeconds + 2) * 1000);
      }
    });

    socket.on('error', (error) => console.error(`EventSub WebSocket error: ${error.message}`));
    socket.on('close', () => {
      if (keepaliveTimer) clearTimeout(keepaliveTimer);
      if (socket !== this.eventSocket || this.stopping) return;
      if (!welcomed && inheritedSubscriptions) {
        console.warn('EventSub resume did not complete; will reconnect and recreate subscriptions.');
      }
      const delay = this.eventReconnectDelay;
      this.eventReconnectDelay = Math.min(this.eventReconnectDelay * 2, 30_000);
      this.eventReconnectTimer = setTimeout(() => this.connectEventSub(EVENTSUB_URL), delay);
      console.log(`EventSub reconnect scheduled in ${delay / 1000}s.`);
    });
  }

  async handleRaid({ raiderId, raiderName, viewers, isTest = false, durationSeconds }) {
    let category = 'Unknown category';
    if (raiderId) {
      try {
        category = await this.getChannelCategory(raiderId);
      } catch (error) {
        console.error(`Could not look up category for ${raiderName}: ${error.message}`);
      }
    }
    await this.onRaid({
      type: 'raid',
      raidId: crypto.randomUUID(),
      raiderId: raiderId || null,
      raiderName: raiderName || 'Unknown raider',
      viewers: Number(viewers) || 0,
      category,
      startedAt: new Date().toISOString(),
      isTest,
      durationSeconds,
    });
  }

  async handleTestRaid(raiderName, viewers, options = {}) {
    let raiderId;
    if (this.tokens) {
      const login = raiderName.replace(/^@/, '').trim();
      try {
        const user = await this.findUserByLogin(login);
        if (user) raiderId = user.id;
      } catch (error) {
        // The synthetic raid should still be useful while Twitch's API is unavailable.
        console.error(`Could not resolve test raider ${login}: ${error.message}`);
      }
    }
    await this.handleRaid({
      raiderId,
      raiderName: raiderName.replace(/^@/, '').trim(),
      viewers,
      isTest: true,
      durationSeconds: options.durationSeconds,
    });
  }

  async shutdown() {
    this.stopping = true;
    clearTimeout(this.eventReconnectTimer);
    if (this.eventSocket && this.eventSocket.readyState < WebSocket.CLOSING) {
      this.eventSocket.close(1000, 'Server shutdown');
    }
  }
}

async function readJsonResponse(response, context) {
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    const detail = payload.message || payload.error || response.statusText;
    throw new Error(`${context} failed (${response.status}): ${detail}`);
  }
  return payload;
}

module.exports = { SCOPES, TwitchClient };
