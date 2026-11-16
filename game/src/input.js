// Keyboard + mouse input. Held keys give a steering vector and a fire flag;
// one-shot presses (start/restart, pause, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const FIRE = new Set(['Space']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(canvas) {
  const keys = { left: false, right: false, up: false, down: false, fire: false };
  let actions = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    // Independent checks, not else-if: Space is both FIRE and CONFIRM, so
    // it must start the game on the title screen AND hold to shoot in play.
    let handled = false;
    if (LEFT.has(event.code)) { keys.left = true; handled = true; }
    if (RIGHT.has(event.code)) { keys.right = true; handled = true; }
    if (UP.has(event.code)) { keys.up = true; handled = true; }
    if (DOWN.has(event.code)) { keys.down = true; handled = true; }
    if (FIRE.has(event.code)) { keys.fire = true; handled = true; }
    if (CONFIRM.has(event.code) && !event.repeat) { actions |= ACTION_CONFIRM; handled = true; }
    if (PAUSE.has(event.code) && !event.repeat) { actions |= ACTION_PAUSE; handled = true; }
    if (MUTE.has(event.code) && !event.repeat) { actions |= ACTION_MUTE; handled = true; }
    if (RESTART.has(event.code) && !event.repeat) { actions |= ACTION_RESTART; handled = true; }
    if (handled) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (FIRE.has(event.code)) keys.fire = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.left = keys.right = keys.up = keys.down = keys.fire = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointerdown', () => {
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => { mouseDown = false; });
  canvas.addEventListener('pointerleave', () => { mouseDown = false; });

  return {
    /** -1/0/1 on each axis (both keys cancel out). */
    direction() {
      return {
        x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
        y: (keys.down ? 1 : 0) - (keys.up ? 1 : 0),
      };
    },
    firing() {
      return keys.fire || mouseDown;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
