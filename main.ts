// NEON VOID — entrypoint for make.fun best-game-01.
//
// The game itself lives in game/ as plain static files: index.html plus ES
// modules, no libraries and no network requests. This program is the
// handoff to the grader. It stages those files under the output directory
// the grader reads, stages the screenshots beside them, and writes
// dossier.json — the summary the AI judge reads — using the vendored
// make.fun dossier builder.
//
// It also refuses to hand in a broken entry. Before copying anything it
// checks that the game page and the screenshots are actually there, and
// that the staged game stays inside the scorer's caps, so a local run
// shows the same thing the grader will see instead of a silent failure.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// then serve the staged game with `node serve.ts` and open
// http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Scorer caps from the bounty's reference gate. Checking them here, up
// front, beats discovering a refusal after the entry is already sent.
const DOSSIER_TEXT_MAX_BYTES = 163840;
const SCREENSHOT_MAX = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;
const GAME_PATH_MAX_BYTES = 1000;

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message: string): never {
  throw new Error(`NEON VOID entrypoint: ${message}`);
}

function mustExist(path: string, label: string): void {
  if (!existsSync(path)) fail(`missing ${label} at ${path}`);
}

// Count every file below a directory, following subdirectories, and add
// up their sizes — the staged game has to fit the scorer's caps.
function measureTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      const child = measureTree(path);
      files += child.files;
      bytes += child.bytes;
    } else {
      files += 1;
      bytes += info.size;
    }
  }
  return { files, bytes };
}

function checkScreenshots(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const shots = readdirSync(dir)
    .filter((name) => /\.(png|jpe?g)$/i.test(name))
    .sort();
  if (shots.length > SCREENSHOT_MAX) {
    fail(`too many screenshots: ${shots.length}, at most ${SCREENSHOT_MAX}`);
  }
  for (const name of shots) {
    const size = statSync(join(dir, name)).size;
    if (size > SCREENSHOT_MAX_BYTES) {
      fail(`screenshot ${name} is ${size} bytes, over the ${SCREENSHOT_MAX_BYTES} cap`);
    }
  }
  return shots;
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
mustExist(join(gameDir, 'index.html'), 'game page');
const shots = checkScreenshots(shotsDir);
if (shots.length === 0) fail('no screenshots: the judge needs at least one cover image');
const game = measureTree(gameDir);
if (game.files > GAME_MAX_FILES) fail(`game has ${game.files} files, over the ${GAME_MAX_FILES} cap`);
if (game.bytes > GAME_MAX_BYTES) fail(`game is ${game.bytes} bytes, over the ${GAME_MAX_BYTES} cap`);

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (shots.length > 0) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The dossier builder reads the staged game back and refuses anything
// outside its caps, so this write is the last gate before hand-in.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
    screenshots: { max: SCREENSHOT_MAX, max_bytes: SCREENSHOT_MAX_BYTES },
    game_max_files: GAME_MAX_FILES,
    game_max_bytes: GAME_MAX_BYTES,
    game_path_max_bytes: GAME_PATH_MAX_BYTES,
  }),
);

console.log(
  `NEON VOID staged: ${game.files} game files (${game.bytes} bytes), ` +
    `${shots.length} screenshot(s) -> ${out}`,
);
