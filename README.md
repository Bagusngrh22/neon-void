# NEON VOID

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Bagusngrh22/neon-void/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Bagusngrh22/neon-void/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**NEON VOID** is an original neon arcade space shooter, built for make.fun's
["Make the best game" bounty](https://make.fun/bounty/best-game-01) ($1,000 in USDC).

You pilot the last neon ship against the void swarm. Blast drifters, sine-wave
weavers, snipers and kamikazes across endless waves — every 5th wave a giant
VOIDBORN boss descends with a fan of bullets and 60 HP. Chain kills into a
combo multiplier (up to x3.25), grab power-ups, and chase the best score.

## Features

- **5 enemy types** — drifter, weaver, shooter, kamikaze, and the VOIDBORN boss every 5th wave
- **Waves with escalating speed and density**, wave-clear bonuses
- **Power-ups** — Spread Shot (S), Rapid Fire (R), Shield (H)
- **Combo multiplier** — kills within 3 seconds stack the score multiplier
- **3 lives**, invulnerability blink after a hit, screen shake and explosion particles
- **Synthesized sound** — WebAudio laser / explosion / power-up effects plus a looping bass + arpeggio track (M to mute, no audio files)
- **Neon vector art** — everything is drawn in code: parallax starfield, drifting grid, glow ships. No external assets, no network requests
- **Title / pause / game-over screens**, best score saved in localStorage
- **Deterministic screenshot scenes** — `?shot=start|play|boss|end&seed=N` stages the same frame every time (seeded mulberry32 RNG)

## How to win / lose

- **Win a wave:** destroy every enemy in the wave; the boss wave is won by destroying the VOIDBORN (+5,000 points).
- **Lose:** your 3 lives run out — colliding with an enemy or its bullets costs one life.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Fly |
| Space / Click | Fire (hold to keep firing) |
| P / Esc | Pause |
| M | Mute / unmute |
| R / Enter | Restart |

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Or just open `game/index.html` in a browser — the game is plain static files
with no build step and no dependencies.

## Project layout

- `game/index.html` — page + canvas
- `game/src/` — the game: `config.js`, `random.js`, `input.js`, `audio.js`, `world.js`, `render.js`, `shots.js`, `main.js`
- `screenshots/` — title, gameplay, game over and boss renders
- `main.ts` / `serve.ts` / `vendor/` — make.fun entry tooling (bundler + static server)

## License

MIT — see [LICENSE](LICENSE).

---
<sub>Entered on [make.fun](https://make.fun/?ref=w43ybwk1&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
