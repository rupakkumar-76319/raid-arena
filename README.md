# Raid Arena

Raid Arena turns incoming Twitch raids into a cooperative boss battle for an OBS browser-source overlay. Raiders and the channel's existing chat work together for a configurable game round. The boss art uses inline SVG and CSS; no image assets are fetched.

## Requirements

- Windows 10 or newer
- Node.js 20 or newer (npm is included)
- A Twitch broadcaster account and a Twitch Developer application

## 1. Create a Twitch app

1. Sign in at [dev.twitch.tv/console](https://dev.twitch.tv/console) and select **Register Your Application**.
2. Name it (for example, `Raid Arena`) and choose **Application Integration**.
3. Set **OAuth Redirect URLs** to exactly `http://localhost:3000`.
4. Create the app, open **Manage**, and copy the Client ID and Client Secret.

Raid Arena requests these broadcaster scopes:

- `moderator:read:followers`
- `channel:read:subscriptions`
- `user:read:chat`
- `user:write:chat`
- `moderator:manage:shoutouts`

The chat scopes support reading EventSub chat messages and sending the game's short chat updates. The shoutout scope is used by auto-shoutout. Twitch requires a user access token with `moderator:manage:shoutouts` for its Send a Shoutout endpoint and enforces a two-minute broadcaster cooldown plus a one-hour same-target cooldown. ([Twitch API reference](https://dev.twitch.tv/docs/api/reference))

## 2. Configure and start

Open PowerShell in `M:\raid-arena`:

```powershell
Copy-Item .env.example .env
notepad .env
```

Enter your app credentials and keep these local values:

```dotenv
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000
PORT=3000
TOKEN_FILE=server/data/tokens.json
```

Then install and start:

```powershell
npm.cmd install
npm.cmd start
```

Open [http://localhost:3000](http://localhost:3000), click **Connect Twitch**, and authorize the broadcaster account. OAuth tokens, streamer settings, and raid records are stored under `server/data/`. Those files and `.env` are ignored by Git.

## 3. Overlay

In OBS, add a **Browser Source** and set its URL to `http://localhost:3000/overlay`. Set its size to your canvas (1920 × 1080 is a good fit). Keep the server running while the source is in use. You can preview the transparent overlay in a regular browser at the same URL.

The idle overlay shows only a small `Raid Arena ready` badge, which fades away after five seconds. A raid brings in the boss HUD and game effects.

## Game rules

- Boss HP is `40 + 3 × raid viewers`, clamped to 60–600, then adjusted by the saved difficulty multiplier and clamped again to 60–600.
- Bosses attack every 8 seconds for 10 shared team HP. The team starts at 100 HP. One `!shield` blocks the next boss attack.
- The default round lasts 90 seconds. If the boss is alive when time expires or team HP reaches zero, the team loses.
- Each user can use one game command every 4 seconds.
- `!attack` deals a random 5–12 damage. Attacks by alternating teams fill the combo meter; a full meter doubles attack damage for 10 seconds. Consecutive attacks from the same team break the current combo.
- `!rally` charges the other team: its next alternating attack adds extra combo progress. `!heal` restores 15 shared team HP, up to 100.
- A user's first chat message in the rolling 30-minute channel history determines their team for a raid. A first message after the raid makes them a **RAIDER**; everyone with an earlier message is **HOME**.
- The finish screen shows the result, each team's MVP, and distinct raiders who joined the battle.

Boss themes are selected by category substring (Minecraft, Just Chatting, tactical shooters, Fortnite, Pokemon, Music, IRL/Travel, Science, or a Void Kaiju fallback). The server sends the selected theme and the overlay draws it with inline SVG.

## Streamer tools

The dashboard settings are saved to `server/data/settings.json` and apply to the next raid:

- **Game duration:** 30–180 seconds; default 90.
- **Boss difficulty:** 0.5×–3.0× HP; default 1.0×.
- **Auto-shoutout:** enabled by default. The server honors Twitch's cooldowns and logs failures without stopping the battle.
- **Bot messages:** enabled by default. The broadcaster posts a short command guide at raid start, a message when combo fills, and the result at the end.

Each raid is recorded in `server/data/raids.json`. Raider retention samples count distinct raider users who chatted in the 60-second window at 1, 5, and 10 minutes after the raid. The summary compares the 10-minute active users from the first-minute cohort against that first-minute count, averaged across raids with completed samples.

## Test without a real raid

1. Open `/overlay` in a browser tab or add it to OBS.
2. On the dashboard, use **Start test raid** to start one synthetic raid.
3. Use **Simulate battle** to start a 32-second test round. It injects 40 randomized `!attack`, `!shield`, `!heal`, and `!rally` messages from fake Raider and Home users over 30 seconds. The first seven attacks alternate teams to demonstrate a full combo. The simulation uses a synthetic 250-viewer raid to leave time to see the full chat feed and skips shoutouts.

You can inject an individual fake chat message while a game is running:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/test/chat `
  -ContentType 'application/json' `
  -Body '{"user":"NewRaider","message":"!attack","team":"RAIDERS"}'
```

The `team` field is optional; for test messages it can be `RAIDERS` or `HOME`. Without it, the normal 30-minute chat-history classification is used. A non-command message is still useful for adding a participant and retention activity.

The original test-raid endpoint is also available directly:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/test/raid `
  -ContentType 'application/json' `
  -Body '{"raiderName":"sample_raider","viewerCount":42}'
```

The dashboard updates raid history and retention samples as they are recorded. Retention values appear after their 1-, 5-, and 10-minute sample times.

## Project layout

```text
server/       Express routes, Twitch OAuth/Helix, game state, themes, retention, settings
overlay/      Transparent OBS HUD and CSS/SVG boss art
dashboard/    Streamer settings, test tools, raid history, retention summary
```
