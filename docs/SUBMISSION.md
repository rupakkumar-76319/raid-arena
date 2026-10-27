# Raid Arena — Devpost submission kit

Deadline: **Nov 2, 2026, 2:00 PM PT** (Nov 3, 2:30 AM IST). Submit by Nov 2 evening IST.

## Devpost form fields

**Project name:** Raid Arena

**Tagline:** Turn every Twitch raid into a 90-second co-op boss fight, so raiders stay.

**Repository:** https://github.com/<your-user>/raid-arena (public)

**Codex session ID:** see `Session ID.txt` (01a1796e-5b7e-7301-99ad-9a26a9d1db5a)

**Video:** YouTube link (unlisted or public, under 3 minutes)

## Project description (paste into Devpost)

### Inspiration
Raids are how small Twitch streamers grow: a bigger streamer sends their whole audience over at the end of a stream. The problem is that most raiders leave within a few minutes, and Twitch gives streamers no tool to welcome them or to see whether they stayed. Raid Arena was built to fix that moment.

### What it does
When a raid arrives (detected through EventSub `channel.raid`), Raid Arena:

1. **Looks up the raiding streamer's category** through the Helix API and spawns a themed boss on the stream overlay — a Block Golem for Minecraft raids, a Tactical Mech for Valorant, a Talkshow Titan for Just Chatting, and so on.
2. **Starts a 90-second co-op battle** that raiders and the home chat fight together using chat commands: `!attack`, `!shield`, `!heal`, `!rally`. Chat messages arrive through EventSub `channel.chat.message`. Viewers are tagged as RAIDERS or HOME based on when they first chatted, and the combo meter only charges when the two teams alternate attacks — cooperation is required to win.
3. **Sends an automatic shoutout** for the raider (Helix Shoutout API) and posts short bot messages in chat as the broadcaster at battle start, on a full combo, and with the result and MVPs.
4. **Tracks raider retention**: distinct raider chatters at 1, 5 and 10 minutes after each raid, saved locally and shown on a streamer dashboard with raid history, MVPs and an average "still chatting at 10 minutes" score — a metric Twitch does not provide today.

The overlay is a transparent browser source for OBS with a stream-safe compact layout that keeps the centre of the screen clear, plus victory and fallen screens with MVPs. The dashboard lets streamers tune game length, boss difficulty, shoutouts and bot messages, and includes a one-click simulated battle with a chosen category for testing without a real raid.

### How we built it
Node.js + Express server, EventSub over WebSocket, Helix API with OAuth and token refresh, a WebSocket channel to a plain HTML/CSS/JS overlay (all boss art is inline SVG and CSS), and a dashboard page. Game state lives in `server/game.js`, retention sampling in `server/retention.js`, themes in `server/themes.js`. A headless check script (`scripts/sim-check.js`) runs the simulation at 10× speed to verify balance.

### How we used Codex
The whole project was built in one Codex thread. Codex scaffolded the OAuth and EventSub plumbing from the Twitch docs, built the game engine, overlay, dashboard and retention tracking, wrote the simulation and the headless balance checker, and iterated on test feedback across four rounds: fixing an unwinnable balance (boss attack cadence, heal and shield values, last-stand victory), redesigning the overlay into a stream-safe compact layout, making the simulation realistic (24 distinct fake chatters, 9/10 boss kills in headless runs), and adding category-themed bosses and structured logging for the Helix chat and shoutout calls. Every change was verified with `node --check`, the sim-check script and live tests on a real Twitch channel.

### Challenges
Balancing a fight so that it is winnable by cooperating chat but not trivial, without a real audience to test on — solved with the 10× headless simulation. Keeping the overlay readable on stream without hiding gameplay. Distinguishing raiders from regulars with only chat data.

### What's next
Per-raider "welcome" mini-rounds for small raids, a season leaderboard across raids, and channel-point power-ups.

## Video shot list (under 3 minutes)

| Time | Shot | Audio |
|---|---|---|
| 0:00–0:15 | Twitch raid arriving on a real stream, raiders leaving after a minute (text overlay: "Most raiders leave within minutes") | "Raids are how small streamers grow — and most raiders leave." |
| 0:15–0:30 | Dashboard: connected account, settings, category picker | "Raid Arena turns every raid into a 90-second co-op boss fight." |
| 0:30–1:30 | OBS stream view: real raid from the second account (or Demo battle with Minecraft category), chat typing !attack / !shield, combo filling, boss defeated, RAID VICTORY with MVPs, bot messages in chat | Explain teams, combo, shoutout |
| 1:30–1:50 | Dashboard: raid history, retention 1/5/10 min | "Streamers finally see whether raiders stayed." |
| 1:50–2:35 | Codex terminal: scrolling the thread — first prompt, files created, sim-check output "9 boss kills", a fix round | "Built entirely in one Codex thread, iterating on live test results." |
| 2:35–2:50 | Victory screen + repo README | "Raid Arena — open source, ready for any channel." |

Rules: no copyrighted music (YouTube Audio Library only), no other streamers' footage without permission, show the project running on Twitch AND Codex building it.

## Pre-submit checklist
- [ ] Push repo to GitHub (public), confirm `.env`, `server/data/*.json`, `Session ID.txt` are NOT in it
- [ ] README setup works from a clean clone (`npm install`, `.env`, `npm start`)
- [ ] Video uploaded, under 3:00, visible to anyone with the link
- [ ] Session ID pasted into the form
- [ ] Click **Submit** (a saved draft is not a submission), check "My projects" shows Submitted

## Video narration script (word for word, ~2:45 at a calm pace)

Record screen with OBS or Windows Game Bar (Win+G). Speak over it, or paste these lines as on-screen captions if you prefer not to speak. Keep each scene roughly to the times below.

**Scene 1 — 0:00 to 0:15. Your Twitch channel page or a raid notification.**
"Raids are how small streamers grow. A bigger streamer sends their whole audience over. But most raiders leave within a couple of minutes, and Twitch gives you no tool to welcome them, and no way to see if they stayed."

**Scene 2 — 0:15 to 0:30. Dashboard at http://localhost:3000, show Connected status and the category dropdown.**
"This is Raid Arena. It connects to your Twitch channel, and turns every raid into a ninety-second co-op boss fight on your stream."

**Scene 3 — 0:30 to 1:30. OBS or the overlay at http://localhost:3000/overlay, with Twitch chat visible. Start a Demo battle with Minecraft selected, or receive the real raid.**
"A raid comes in. Raid Arena looks up the raiding streamer's category on Twitch, and spawns a matching boss. Minecraft raid, Block Golem."
"Everyone fights with chat commands. Attack, shield, heal, rally. Raiders are one team, your regulars are the other."
"The combo meter only charges when the two teams alternate. Nobody can win alone. When it fills, double damage."
"The boss hits back, so shields and heals matter."
"Boss down. Raid victory, and the MVPs from each team are called out on screen and in chat. The raider also gets an automatic shoutout."

**Scene 4 — 1:30 to 1:50. Dashboard raid history and retention columns.**
"After the fight, Raid Arena keeps watching. It records how many raiders are still chatting at one, five and ten minutes. For the first time, a streamer can see whether a raid actually stuck."

**Scene 5 — 1:50 to 2:35. Codex terminal. Scroll from the first prompt down to the sim-check output.**
"The whole project was built in one Codex thread. Codex wrote the Twitch OAuth and EventSub code, the game engine, the overlay and the dashboard."
"Then we iterated on real test results. The first version was unwinnable, so Codex rebalanced the boss and wrote a headless simulator that runs ten battles at ten times speed. Now nine out of ten end in a real kill."
"It redesigned the overlay to keep the centre of the screen clear for gameplay, and added themed bosses per category."

**Scene 6 — 2:35 to 2:50. Victory screen, then the README on GitHub.**
"Raid Arena. Open source, runs on any channel, and gives every raid a reason to stay."

Captions you can type on screen: "Most raiders leave within minutes" (scene 1), "Built in one Codex thread" (scene 5), "9 of 10 simulated battles end in a boss kill" (scene 5).

### Recording checklist
- Browser zoom 100%, 1920×1080, close other tabs.
- Dashboard: run one Demo battle before recording so the history table is not empty.
- Codex terminal: scroll to the top of the thread first so the first prompt is on screen.
- No music, or YouTube Audio Library only.
- Trim to under 3:00, upload to YouTube as Unlisted, copy the link into the Devpost form.
