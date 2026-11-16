// Drawing only: the world's state and the current screen in, pixels out.
// The 960x640 playfield is scaled to fit the window and centred. All art is
// vector neon drawn in code: glow via shadowBlur, starfield, grid, ships,
// particles and panels. No images, no external assets.

import { FIELD, FONT, LIVES, PALETTE } from './config.js';
import { KIND_BOSS, KIND_DRIFTER, KIND_KAMIKAZE, KIND_SHOOTER, KIND_WEAVER } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 30, bottom: 66 };

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight, baseline) {
    const key = `${weight || 400}-${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || 400} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'alphabetic';
    ctx.shadowBlur = 0;
    ctx.fillText(value, x, y);
  }

  function drawBackground(state) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // faint perspective grid, drifting slowly downward
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    const offset = (state.elapsed * 24) % 40;
    ctx.beginPath();
    for (let y = -40 + offset; y < FIELD.height; y += 40) {
      ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y);
    }
    for (let x = 0; x <= FIELD.width; x += 80) {
      ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // stars
    for (const s of state.stars) {
      ctx.globalAlpha = 0.35 + s.z * 0.65;
      ctx.fillStyle = s.z > 0.8 ? '#cfe9ff' : '#7d92c4';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(state) {
    const p = state.player;
    const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
    if (blink) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    glow(ctx, PALETTE.player, 18);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(0, -p.radius - 6);
    ctx.lineTo(p.radius * 0.8, p.radius * 0.7);
    ctx.lineTo(p.radius * 0.35, p.radius * 0.3);
    ctx.lineTo(-p.radius * 0.35, p.radius * 0.3);
    ctx.lineTo(-p.radius * 0.8, p.radius * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.moveTo(0, -p.radius + 2);
    ctx.lineTo(5, p.radius * 0.4);
    ctx.lineTo(-5, p.radius * 0.4);
    ctx.closePath();
    ctx.fill();
    // engine flame (length wobbles deterministically with elapsed time,
    // so a staged screenshot is the same frame for the same seed)
    ctx.fillStyle = '#ffb347';
    glow(ctx, '#ff7b00', 12);
    ctx.beginPath();
    ctx.moveTo(-5, p.radius * 0.6);
    ctx.lineTo(0, p.radius + 10 + Math.sin(state.elapsed * 31) * 3);
    ctx.lineTo(5, p.radius * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (p.shield > 0) {
      ctx.save();
      ctx.strokeStyle = PALETTE.powerShield;
      ctx.lineWidth = 2;
      glow(ctx, PALETTE.powerShield, 14);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  const ENEMY_COLOR = {
    [KIND_DRIFTER]: PALETTE.enemyDrifter,
    [KIND_WEAVER]: PALETTE.enemyWeaver,
    [KIND_SHOOTER]: PALETTE.enemyShooter,
    [KIND_KAMIKAZE]: PALETTE.enemyKamikaze,
    [KIND_BOSS]: PALETTE.enemyBoss,
  };

  function drawEnemy(e) {
    const color = ENEMY_COLOR[e.kind] || '#fff';
    ctx.save();
    ctx.translate(e.x, e.y);
    glow(ctx, color, e.kind === KIND_BOSS ? 26 : 14);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (e.kind === KIND_DRIFTER) {
      ctx.rotate(e.t * 0.8);
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (e.kind === KIND_WEAVER) {
      ctx.beginPath();
      ctx.moveTo(0, e.radius);
      ctx.lineTo(e.radius, -e.radius * 0.6);
      ctx.lineTo(0, -e.radius * 0.2);
      ctx.lineTo(-e.radius, -e.radius * 0.6);
      ctx.closePath();
      ctx.fill();
    } else if (e.kind === KIND_SHOOTER) {
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a0b2e';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === KIND_KAMIKAZE) {
      ctx.rotate(e.t * 3);
      ctx.beginPath();
      ctx.moveTo(0, -e.radius);
      ctx.lineTo(e.radius * 0.8, 0);
      ctx.lineTo(0, e.radius);
      ctx.lineTo(-e.radius * 0.8, 0);
      ctx.closePath();
      ctx.fill();
    } else { // boss
      ctx.rotate(Math.sin(e.t * 0.6) * 0.15);
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? e.radius : e.radius * 0.62;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#2b0213';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (e.kind === KIND_BOSS) {
      // boss health bar, bottom-centre so it never covers the HUD or the boss
      const w = 220;
      const x = FIELD.width / 2 - w / 2;
      ctx.fillStyle = '#2b0213';
      ctx.fillRect(x, 606, w, 10);
      ctx.fillStyle = PALETTE.enemyBoss;
      glow(ctx, PALETTE.enemyBoss, 8);
      ctx.fillRect(x, 606, w * Math.max(0, e.hp / 60), 10);
      ctx.shadowBlur = 0;
      text('VOIDBORN', FIELD.width / 2, 598, 13, PALETTE.enemyBoss, 'center', 700);
    }
  }

  function drawField(state) {
    drawBackground(state);
    for (const p of state.powerups) {
      if (!p.active) continue;
      const color = p.kind === 'spread' ? PALETTE.powerSpread : p.kind === 'rapid' ? PALETTE.powerRapid : PALETTE.powerShield;
      ctx.save();
      ctx.translate(p.x, p.y + Math.sin(p.t * 4) * 3);
      glow(ctx, color, 14);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#06121a';
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'spread' ? 'S' : p.kind === 'rapid' ? 'R' : 'H', 0, 1);
      ctx.restore();
    }
    for (const b of state.bullets) {
      if (!b.active) continue;
      ctx.save();
      glow(ctx, PALETTE.bullet, 10);
      ctx.strokeStyle = PALETTE.bullet;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
    for (const b of state.ebullets) {
      if (!b.active) continue;
      ctx.save();
      glow(ctx, '#ff5c8a', 10);
      ctx.fillStyle = '#ff5c8a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const e of state.enemies) if (e.active) drawEnemy(e);
    for (const p of state.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    drawPlayer(state);
    if (state.flash > 0) {
      ctx.globalAlpha = state.flash * 1.4;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.globalAlpha = 1;
    }
  }

  function drawHud(state, best, muted) {
    ctx.shadowBlur = 0;
    text(`SCORE ${state.score}`, 20, 16, 24, PALETTE.text, 'left', 700, 'top');
    text(`WAVE ${state.wave}`, FIELD.width / 2, 16, 24, PALETTE.text, 'center', 700, 'top');
    const label = `BEST ${Math.max(best, state.score)}`;
    text(label, FIELD.width - 20, 16, 24, PALETTE.muted, 'right', 700, 'top');
    // lives as small ships
    for (let i = 0; i < LIVES; i += 1) {
      const x = FIELD.width - 20 - i * 28;
      ctx.save();
      ctx.translate(x, 62);
      ctx.fillStyle = i < state.lives ? PALETTE.player : '#22304f';
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(6, 6); ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (state.combo >= 2) {
      const mult = (1 + Math.min(state.combo - 1, 9) * 0.25).toFixed(2).replace(/\.?0+$/, '');
      glow(ctx, '#ffe14d', 12);
      text(`COMBO x${mult}  (${state.combo})`, 20, 52, 20, '#ffe14d', 'left', 700);
      ctx.shadowBlur = 0;
    }
    // active power-up timers
    let py = 84;
    const p = state.player;
    const active = [];
    if (p.spread > 0) active.push(['SPREAD', p.spread, PALETTE.powerSpread]);
    if (p.rapid > 0) active.push(['RAPID', p.rapid, PALETTE.powerRapid]);
    if (p.shield > 0) active.push(['SHIELD', p.shield, PALETTE.powerShield]);
    for (const [name, t, color] of active) {
      text(`${name} ${Math.ceil(t)}s`, 20, py, 16, color, 'left', 700);
      py += 22;
    }
    if (muted) text('MUTED (M)', 20, FIELD.height - 30, 14, PALETTE.muted, 'left', 400);
    // wave banner
    if (state.bannerTimer > 0 && state.banner) {
      const a = Math.min(1, state.bannerTimer);
      ctx.globalAlpha = a;
      glow(ctx, '#39f5ff', 18);
      text(state.banner, FIELD.width / 2, 120, 34, '#eaf6ff', 'center', 800);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 34, 0.88)';
    ctx.strokeStyle = accent || PALETTE.player;
    ctx.lineWidth = 2;
    glow(ctx, accent || PALETTE.player, 16);
    ctx.beginPath();
    ctx.rect(x, y, PANEL.width, height);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
    glow(ctx, accent || PALETTE.player, 18);
    text(title, FIELD.width / 2, y + 76, 46, accent || PALETTE.player, 'center', 800);
    ctx.shadowBlur = 0;
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 19, i === 0 ? PALETTE.text : PALETTE.muted, 'center', i === 0 ? 600 : 400);
    }
    text(prompt, FIELD.width / 2, y + height - 34, 20, '#ffe14d', 'center', 700);
  }

  function draw(state, screen, best, muted) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shake = state.shake > 0 ? state.shake * 10 : 0;
    // deterministic shake offsets (seeded by elapsed time, not Math.random)
    const sx = shake ? Math.sin(state.elapsed * 127.1) * shake * 0.5 : 0;
    const sy = shake ? Math.cos(state.elapsed * 149.7) * shake * 0.5 : 0;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'NEON VOID',
        [
          'Blast the void swarm. Survive every wave.',
          'Boss every 5th wave — beat it for +5,000.',
          'WASD / Arrows — fly      Space / Click — fire',
          'P — pause      M — mute      R — restart',
          '3 lives. Grab S / R / H power-ups. Combo kills multiply score.',
          `BEST ${best}`,
        ],
        'Press Space or click to launch',
        PALETTE.player,
      );
      return;
    }
    drawHud(state, best, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The void waits for no one — except now.', ''], 'Press P to resume', PALETTE.muted);
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'GAME OVER',
        [
          `FINAL SCORE  ${state.score}`,
          `BEST  ${Math.max(best, state.score)}     WAVES CLEARED  ${state.wave - 1}     KILLS  ${state.kills}     BEST COMBO  ${state.bestCombo}`,
          'The void claims another pilot.',
        ],
        'Press R or Space to fly again',
        PALETTE.danger,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
