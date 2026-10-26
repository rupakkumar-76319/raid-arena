# Changelog

## Unreleased

- Balanced boss attacks to hit every 10 seconds for 10 team HP above half boss health and 6 at or below half; increased healing to 20 HP and made shields last until the next hit or 12 seconds.
- Added last-stand victories when the timer expires with less than 25% boss health, plus advanced boss attack settings.
- Reworked the solo simulation to use a 35-viewer raid, 70 weighted alternating actions over 60 seconds, and a calibrated 1.15x test-only boss. Added a seeded headless check with a 10x game clock.
- Made the default overlay compact around the screen edges, kept the full-size layout available with `?layout=full`, and made the finish card fade after eight seconds.
- Marked unfinished saved raids as interrupted after restart and showed pending retention samples with their remaining collection time.
- Added ignore rules for local data JSON files and `Session ID.txt`.
- Updated setup, game rules, streamer settings, overlay usage, and simulation instructions in the README.
