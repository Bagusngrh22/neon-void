// NEON VOID — tuning numbers and palette in one place.
// Logical playfield is 960x640; the renderer scales it to fit the window,
// so no rule below depends on the screen size.

export const FIELD = { width: 960, height: 640 };

/** Fixed simulation step: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 340,
  fireInterval: 0.16,
  invulnerable: 2.0,
  accel: 2600,
};

export const LIVES = 3;

export const BULLET = { speed: 620, radius: 4, damage: 1 };

export const ENEMY = {
  drifter: { hp: 1, radius: 16, speed: 70, score: 100 },
  weaver: { hp: 2, radius: 15, speed: 95, score: 150 },
  shooter: { hp: 2, radius: 16, speed: 55, score: 200 },
  kamikaze: { hp: 1, radius: 13, speed: 150, score: 150 },
  boss: { hp: 60, radius: 46, speed: 40, score: 5000 },
};

export const POWERUP = {
  spread: { duration: 12, label: 'SPREAD SHOT' },
  rapid: { duration: 10, label: 'RAPID FIRE' },
  shield: { duration: 8, label: 'SHIELD' },
};

export const COMBO_WINDOW = 3.0; // seconds to keep the combo alive between kills
export const WAVE_CLEAR_BONUS = 250;
export const BEST_KEY = 'neon-void.best';

export const PALETTE = {
  backdrop: '#05060f',
  deep: '#0a0d24',
  grid: '#141a3d',
  player: '#39f5ff',
  playerCore: '#e8feff',
  bullet: '#aefcff',
  enemyDrifter: '#ff4d6d',
  enemyWeaver: '#ff9f1c',
  enemyShooter: '#c77dff',
  enemyKamikaze: '#ff2e63',
  enemyBoss: '#ff206e',
  powerSpread: '#39ff6a',
  powerRapid: '#ffe14d',
  powerShield: '#4da6ff',
  text: '#eaf6ff',
  muted: '#8fa3c8',
  danger: '#ff4d6d',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
