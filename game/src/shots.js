// The screenshot scenes behind ?shot=start|play|end (plus boss). Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot: dodge the nearest threat, drift
// toward the safest lane, and fire constantly. The same seed always gives
// the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 600;

/** Autopilot: pick the horizontal move that keeps the ship clear of enemy
 *  bullets and kamikazes for the next `horizon` seconds, preferring the
 *  centre lane; the end scene uses a short horizon so it gets caught out. */
function autopilot(state, horizon) {
  const p = state.player;
  const options = [-1, 0, 1];
  let bestDir = 0;
  let bestScore = -Infinity;
  for (const dir of options) {
    let danger = 0;
    const nx = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + dir * 200 * horizon));
    for (const b of state.ebullets) {
      if (!b.active) continue;
      const bx = b.x + b.vx * horizon;
      const by = b.y + b.vy * horizon;
      if (Math.abs(bx - nx) < 46 && by > p.y - 180 && by < p.y + 30) danger += 3;
    }
    for (const e of state.enemies) {
      if (!e.active) continue;
      const ex = e.x + (e.vx || 0) * horizon;
      const ey = e.y + (e.vy || 0) * horizon;
      if (Math.abs(ex - nx) < 52 && ey > p.y - 200 && ey < p.y + 30) danger += e.kind === 'kamikaze' ? 4 : 2;
    }
    const centrePull = -Math.abs(nx - FIELD.width / 2) / 480;
    const score = centrePull - danger;
    if (score > bestScore) { bestScore = score; bestDir = dir; }
  }
  return bestDir;
}

function runSteps(world, seconds, horizon, stopOnOver) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const dir = autopilot(world.state, horizon);
    const events = world.step(STEP, { x: dir, y: 0 }, true, false);
    if (stopOnOver && (events & EVENT_OVER)) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw and the best
 * score to show. Unknown names behave like start.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    runSteps(world, PLAY_SECONDS, 0.7, false);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    // Fast-forward through waves 1-4 by clearing them, then fight the boss
    // wave until the boss is on screen and exchanging fire — freeze there.
    for (let wave = 1; wave <= 4; wave += 1) {
      world.state.spawnQueue = [];
      for (const e of world.state.enemies) e.active = false;
      world.state.waveActive = false;
      world.state.wave += 1;
      world.buildWave(world.state.wave);
    }
    // Fresh ship for the boss fight frame (the skip itself may have cost lives).
    world.state.lives = 3;
    world.state.player.invulnerable = 0;
    const maxSteps = Math.floor(60 / STEP);
    for (let i = 0; i < maxSteps; i += 1) {
      const dir = autopilot(world.state, 0.7);
      world.step(STEP, { x: dir, y: 0 }, true, false);
      const boss = world.state.enemies.find((e) => e.active && e.kind === 'boss');
      if (boss && boss.y > 100) break;
    }
    // Freeze with a live ship for the frame (the staging fight may have cost lives).
    world.state.lives = 3;
    world.state.player.invulnerable = 1;
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    runSteps(world, END_LIMIT_SECONDS, 0.18, true);
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // start: title backdrop, a few seconds of drifting enemies
  for (let i = 0; i < Math.floor(START_SECONDS / STEP); i += 1) {
    world.step(STEP, { x: 0, y: 0 }, false, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
