// NEON VOID rules and state, no drawing and no browser in it: the player
// ship, bullets, five enemy kinds, waves, power-ups, particles, combo,
// score, lives and screen shake. step() advances one fixed step and returns
// what happened as bit flags, so the caller can react (sound, announcements)
// without the world knowing about screens. Pools are allocated once at boot.

import { BULLET, COMBO_WINDOW, ENEMY, FIELD, LIVES, PLAYER, POWERUP, STEP, WAVE_CLEAR_BONUS } from './config.js';
import { pick, randInt } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_OVER = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_POWERUP = 16;
export const EVENT_ENEMY_SHOT = 32;

export const KIND_DRIFTER = 'drifter';
export const KIND_WEAVER = 'weaver';
export const KIND_SHOOTER = 'shooter';
export const KIND_KAMIKAZE = 'kamikaze';
export const KIND_BOSS = 'boss';

const MAX_ENEMIES = 48;
const MAX_BULLETS = 96;
const MAX_EBULLETS = 64;
const MAX_PARTICLES = 240;
const MAX_POWERUPS = 8;
const MAX_STARS = 110;

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function circleHit(a, ra, b, rb) {
  const r = ra + rb;
  return dist2(a, b) < r * r;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height - 90, vx: 0, vy: 0,
    radius: PLAYER.radius, invulnerable: 0, fireTimer: 0,
    spread: 0, rapid: 0, shield: 0,
  };
  const enemies = [];
  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    enemies.push({ active: false, kind: KIND_DRIFTER, x: 0, y: 0, vx: 0, vy: 0, hp: 1, radius: 16, t: 0, baseX: 0, fireTimer: 0, score: 100 });
  }
  const bullets = [];
  for (let i = 0; i < MAX_BULLETS; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  const ebullets = [];
  for (let i = 0; i < MAX_EBULLETS; i += 1) ebullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  }
  const powerups = [];
  for (let i = 0; i < MAX_POWERUPS; i += 1) powerups.push({ active: false, kind: 'spread', x: 0, y: 0, t: 0 });
  const stars = [];
  for (let i = 0; i < MAX_STARS; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, z: 0.3 + random() * 0.7, size: 0.6 + random() * 1.8 });
  }

  const state = {
    player, enemies, bullets, ebullets, particles, powerups, stars,
    score: 0, lives: LIVES, wave: 1, combo: 0, comboTimer: 0, bestCombo: 0,
    kills: 0, elapsed: 0, shake: 0, spawnQueue: [], spawnTimer: 0,
    waveActive: false, waveCleared: false, bossSpawned: false,
    flash: 0, banner: '', bannerTimer: 0,
  };

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (!p) return;
      const a = random() * Math.PI * 2;
      const s = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.maxLife = 0.4 + random() * 0.5;
      p.life = p.maxLife;
      p.size = 1.5 + random() * 2.5;
      p.color = color;
    }
  }

  function spawnEnemy(kind, x, y) {
    const e = free(enemies);
    if (!e) return null;
    const cfg = ENEMY[kind];
    e.active = true;
    e.kind = kind;
    e.x = x; e.y = y;
    e.hp = cfg.hp;
    e.radius = cfg.radius;
    e.score = cfg.score;
    e.t = random() * Math.PI * 2;
    e.baseX = x;
    e.fireTimer = 1 + random() * 1.5;
    if (kind === KIND_DRIFTER) { e.vx = (random() - 0.5) * 60; e.vy = cfg.speed; }
    else if (kind === KIND_WEAVER) { e.vx = 0; e.vy = cfg.speed; }
    else if (kind === KIND_SHOOTER) { e.vx = (random() - 0.5) * 40; e.vy = cfg.speed; }
    else if (kind === KIND_KAMIKAZE) { e.vx = 0; e.vy = cfg.speed; }
    else { e.vx = 0; e.vy = cfg.speed; } // boss drifts down slowly, then strafes
    return e;
  }

  function buildWave(n) {
    const queue = [];
    const isBoss = n % 5 === 0;
    const count = 6 + n * 2;
    for (let i = 0; i < count; i += 1) {
      let kind = KIND_DRIFTER;
      const roll = random();
      if (n >= 3 && roll < 0.18) kind = KIND_SHOOTER;
      else if (n >= 2 && roll < 0.42) kind = KIND_WEAVER;
      else if (n >= 4 && roll < 0.55) kind = KIND_KAMIKAZE;
      queue.push(kind);
    }
    if (isBoss) queue.push(KIND_BOSS);
    state.spawnQueue = queue;
    state.spawnTimer = 0.8;
    state.waveActive = true;
    state.waveCleared = false;
    state.bossSpawned = false;
    state.banner = isBoss ? `WAVE ${n} — VOIDBORN BOSS` : `WAVE ${n}`;
    state.bannerTimer = 2.2;
  }

  function dropPowerup(x, y) {
    if (random() > 0.16) return; // ~16% of kills drop one
    const p = free(powerups);
    if (!p) return;
    p.active = true;
    p.kind = pick(random, ['spread', 'rapid', 'shield']);
    p.x = x; p.y = y; p.t = 0;
  }

  function killEnemy(e, events) {
    e.active = false;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    const mult = 1 + Math.min(state.combo - 1, 9) * 0.25;
    state.score += Math.round(e.score * mult);
    const color = e.kind === KIND_BOSS ? '#ff206e' : e.kind === KIND_WEAVER ? '#ff9f1c' : e.kind === KIND_SHOOTER ? '#c77dff' : e.kind === KIND_KAMIKAZE ? '#ff2e63' : '#ff4d6d';
    burst(e.x, e.y, color, e.kind === KIND_BOSS ? 60 : 18, e.kind === KIND_BOSS ? 260 : 170);
    burst(e.x, e.y, '#ffffff', 6, 90);
    if (e.kind === KIND_BOSS) {
      state.shake = Math.max(state.shake, 0.6);
      state.flash = 0.35;
    }
    dropPowerup(e.x, e.y);
    return events | EVENT_KILL;
  }

  function firePlayer() {
    const interval = player.rapid > 0 ? PLAYER.fireInterval * 0.55 : PLAYER.fireInterval;
    if (player.fireTimer > 0) return;
    player.fireTimer = interval;
    const angles = player.spread > 0 ? [-0.16, 0, 0.16] : [0];
    for (const a of angles) {
      const b = free(bullets);
      if (!b) break;
      b.active = true;
      b.x = player.x;
      b.y = player.y - player.radius - 4;
      b.vx = Math.sin(a) * BULLET.speed;
      b.vy = -Math.cos(a) * BULLET.speed;
    }
  }

  function fireEnemy(e) {
    const b = free(ebullets);
    if (!b) return false;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 200 + state.wave * 8;
    b.active = true;
    b.x = e.x; b.y = e.y + e.radius;
    b.vx = (dx / len) * speed;
    b.vy = (dy / len) * speed;
    return true;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height - 90;
    player.vx = 0; player.vy = 0;
    player.invulnerable = 0; player.fireTimer = 0;
    player.spread = 0; player.rapid = 0; player.shield = 0;
    for (const pool of [enemies, bullets, ebullets, particles, powerups]) {
      for (const it of pool) it.active = false;
    }
    state.score = 0; state.lives = LIVES; state.wave = 1;
    state.combo = 0; state.comboTimer = 0; state.bestCombo = 0;
    state.kills = 0; state.elapsed = 0; state.shake = 0; state.flash = 0;
    state.banner = ''; state.bannerTimer = 0;
    buildWave(1);
  }

  /**
   * One fixed step. `dir` is {x, y} in -1..1, `firing` true while the fire
   * button is held. With `attract` set (title backdrop) the ship idles and
   * enemies drift harmlessly — nothing scores, nothing dies.
   */
  function step(dt, dir, firing, attract) {
    let events = 0;
    state.elapsed += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    for (const s of stars) {
      s.y += s.z * 42 * dt;
      if (s.y > FIELD.height) { s.y = -2; s.x = random() * FIELD.width; }
    }
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.98; p.vy *= 0.98;
    }

    // --- player ---
    const px = player.x;
    const py = player.y;
    if (attract) {
      player.x = FIELD.width / 2 + Math.sin(state.elapsed * 0.7) * 120;
      player.y = FIELD.height - 90 + Math.sin(state.elapsed * 1.3) * 8;
    } else {
      player.vx += dir.x * PLAYER.accel * dt;
      player.vy += dir.y * PLAYER.accel * dt;
      player.vx *= Math.pow(0.0001, dt); // snappy damping
      player.vy *= Math.pow(0.0001, dt);
      const sp = Math.hypot(player.vx, player.vy);
      if (sp > PLAYER.speed) { player.vx *= PLAYER.speed / sp; player.vy *= PLAYER.speed / sp; }
      player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
      player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius + 40, player.y + player.vy * dt));
      if (player.invulnerable > 0) player.invulnerable -= dt;
      if (player.spread > 0) player.spread -= dt;
      if (player.rapid > 0) player.rapid -= dt;
      if (player.shield > 0) player.shield -= dt;
      if (player.fireTimer > 0) player.fireTimer -= dt;
      if (firing) firePlayer();
    }
    if (player.x !== px || player.y !== py) {
      // engine trail
      const p = free(particles);
      if (p && random() < 0.6) {
        p.active = true;
        p.x = player.x + (random() - 0.5) * 8;
        p.y = player.y + player.radius;
        p.vx = (random() - 0.5) * 20; p.vy = 60 + random() * 60;
        p.maxLife = 0.3; p.life = 0.3; p.size = 2; p.color = '#39f5ff';
      }
    }

    // --- spawning ---
    if (state.waveActive && state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const kind = state.spawnQueue.shift();
        if (kind === KIND_BOSS) {
          spawnEnemy(kind, FIELD.width / 2, -60);
          state.bossSpawned = true;
        } else {
          spawnEnemy(kind, 40 + random() * (FIELD.width - 80), -30);
        }
        state.spawnTimer = Math.max(0.35, 0.9 - state.wave * 0.05);
      }
    }

    // --- enemies ---
    let alive = 0;
    for (const e of enemies) {
      if (!e.active) continue;
      alive += 1;
      e.t += dt;
      if (e.kind === KIND_DRIFTER) {
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.x < e.radius || e.x > FIELD.width - e.radius) e.vx *= -1;
      } else if (e.kind === KIND_WEAVER) {
        e.y += e.vy * dt;
        e.x = e.baseX + Math.sin(e.t * 2.4) * 90;
        if (e.x < e.radius) e.x = e.radius;
        if (e.x > FIELD.width - e.radius) e.x = FIELD.width - e.radius;
      } else if (e.kind === KIND_SHOOTER) {
        e.y += e.vy * dt;
        e.x += e.vx * dt;
        if (e.x < e.radius || e.x > FIELD.width - e.radius) e.vx *= -1;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && e.y > 0 && e.y < FIELD.height * 0.6 && !attract) {
          if (fireEnemy(e)) events |= EVENT_ENEMY_SHOT;
          e.fireTimer = 2.2 - Math.min(1.2, state.wave * 0.08) + random() * 0.8;
        }
      } else if (e.kind === KIND_KAMIKAZE) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const sp = ENEMY.kamikaze.speed + state.wave * 6;
        e.vx += (dx / len) * sp * 2.2 * dt;
        e.vy += (dy / len) * sp * 2.2 * dt;
        const esp = Math.hypot(e.vx, e.vy);
        if (esp > sp) { e.vx *= sp / esp; e.vy *= sp / esp; }
        e.x += e.vx * dt; e.y += e.vy * dt;
      } else { // boss
        if (e.y < 110) { e.y += e.vy * dt; }
        else {
          e.x = FIELD.width / 2 + Math.sin(e.t * 0.9) * 260;
          e.fireTimer -= dt;
          if (e.fireTimer <= 0 && !attract) {
            for (const a of [-0.35, -0.12, 0.12, 0.35]) {
              const b = free(ebullets);
              if (!b) break;
              b.active = true;
              b.x = e.x; b.y = e.y + e.radius;
              b.vx = Math.sin(a) * 240; b.vy = Math.cos(a) * 240;
            }
            events |= EVENT_ENEMY_SHOT;
            e.fireTimer = 1.4 - Math.min(0.6, state.wave * 0.03);
          }
        }
      }
      if (e.y > FIELD.height + 60) e.active = false;
    }

    // --- wave clear ---
    if (!attract && state.waveActive && state.spawnQueue.length === 0 && alive === 0) {
      state.waveActive = false;
      state.waveCleared = true;
      const bonus = WAVE_CLEAR_BONUS + state.wave * 50;
      state.score += bonus;
      state.banner = `WAVE ${state.wave} CLEAR  +${bonus}`;
      state.bannerTimer = 2.0;
      state.wave += 1;
      events |= EVENT_WAVE_CLEAR;
      buildWave(state.wave);
    }

    // --- player bullets ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -20 || b.x < -20 || b.x > FIELD.width + 20) { b.active = false; continue; }
      for (const e of enemies) {
        if (!e.active) continue;
        if (circleHit(b, BULLET.radius, e, e.radius)) {
          b.active = false;
          e.hp -= BULLET.damage;
          burst(b.x, b.y, '#aefcff', 3, 60);
          if (e.hp <= 0) events = killEnemy(e, events);
          break;
        }
      }
    }

    // --- enemy bullets ---
    for (const b of ebullets) {
      if (!b.active) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -20 || b.y > FIELD.height + 20 || b.x < -20 || b.x > FIELD.width + 20) { b.active = false; continue; }
      if (!attract && player.invulnerable <= 0 && circleHit(b, 5, player, player.radius - 3)) {
        b.active = false;
        events |= hurtPlayer();
      }
    }

    // --- enemy / player collision ---
    if (!attract) {
      for (const e of enemies) {
        if (!e.active) continue;
        if (circleHit(e, e.radius - 2, player, player.radius - 2)) {
          events = killEnemy(e, events);
          if (player.invulnerable <= 0) events |= hurtPlayer();
        }
      }
    }

    // --- power-ups ---
    for (const p of powerups) {
      if (!p.active) continue;
      p.t += dt;
      p.y += 55 * dt;
      if (p.y > FIELD.height + 20) { p.active = false; continue; }
      if (!attract && circleHit(p, 14, player, player.radius + 6)) {
        p.active = false;
        if (p.kind === 'spread') player.spread = POWERUP.spread.duration;
        else if (p.kind === 'rapid') player.rapid = POWERUP.rapid.duration;
        else player.shield = POWERUP.shield.duration;
        state.banner = POWERUP[p.kind].label + '!';
        state.bannerTimer = 1.4;
        events |= EVENT_POWERUP;
      }
    }

    return events;

    function hurtPlayer() {
      if (player.shield > 0) {
        player.shield = 0;
        player.invulnerable = 1.0;
        burst(player.x, player.y, '#4da6ff', 20, 180);
        return 0;
      }
      state.lives -= 1;
      state.combo = 0;
      player.invulnerable = PLAYER.invulnerable;
      state.shake = Math.max(state.shake, 0.45);
      burst(player.x, player.y, '#39f5ff', 26, 220);
      if (state.lives <= 0) return EVENT_HIT | EVENT_OVER;
      return EVENT_HIT;
    }
  }

  reset();
  return { state, reset, step, buildWave };
}
