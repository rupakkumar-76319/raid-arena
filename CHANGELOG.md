# Changelog

## Unreleased

- Added the optional `?bg=dark` overlay background for browser demos and recordings; it works with either compact or full layout.
- Fixed compact overlay timer stacking above the team strip while keeping the finish card above both; added screenshots and the MIT license.
- Built with Codex: written in one thread, with four test-and-fix rounds across balance, compact overlay, simulation, and category themes.
- Balanced boss attacks to hit every 10 seconds for 12 team HP above half boss health and 8 at or below half; increased healing to 20 HP and made shields last until the next hit or 12 seconds.
- Added last-stand victories when the timer expires with less than 25% boss health, plus advanced boss attack settings.
- Reworked the solo simulation to use a 35-viewer raid, 70 weighted alternating actions over 60 seconds, 14 raider and 10 home identities, and a calibrated 2.4x test-only boss. Added a seeded ten-run headless check with a 10x game clock.
- Made the default overlay compact around the screen edges, kept the full-size layout available with `?layout=full`, and made the finish card fade after eight seconds.
- Marked unfinished saved raids as interrupted after restart and showed pending retention samples with their remaining collection time.
- Added ignore rules for local data JSON files and `Session ID.txt`.
- Updated setup, game rules, streamer settings, overlay usage, and simulation instructions in the README.
- Made the simulator rotate across 14 raider and 10 home chatter identities so the cooldown remains active without rejecting demo actions.
- Increased attack damage to 6-14, extended combo boosts to 12 seconds, and raised default boss strikes to 12/8 HP; old default attack values migrate on load.
- Moved the large countdown and shield status into the compact bottom strip, added an active x2 badge and boss-card hit flash, and refined the theme SVG silhouettes.
- Added explicit success and HTTP status/body failure logs for broadcaster chat messages and automatic shoutouts.
- The ten-run headless simulation check completed with 9 boss kills, 1 last-stand, and 0 fallen rounds.
- Hid the complete battle HUD when the finish overlay returns to idle, and added category overrides plus Simulate/Demo battle controls for theme previews.
- Added the 60-second demo quick start and text architecture diagram to the README.
