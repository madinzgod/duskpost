// Input: keyboard and mouse folded into one axes object the physics can read — pitch and
// roll in -1..1, a throttle delta, a brake flag, and an edge-triggered "start" for the
// title and game-over screens. Mouse steering: pointer right of centre banks right,
// above centre climbs.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    startPressed: false,
    mouseX: 0.5,
    mouseY: 0.5,
    mouseSeen: false,
  };

  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.key === 'Enter' || e.key === ' ') state.startPressed = true;
    keys.add(e.key.toLowerCase());
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouseX = (e.clientX - r.left) / r.width;
    state.mouseY = (e.clientY - r.top) / r.height;
    state.mouseSeen = true;
  });
  canvas.addEventListener('pointerdown', () => {
    state.startPressed = true;
  });

  function has(...names) {
    return names.some((n) => keys.has(n));
  }

  return {
    /** Current control axes. Keyboard wins; the mouse steers only where no key is held. */
    axes() {
      let pitch = 0;
      let roll = 0;
      if (has('arrowup')) pitch += 1;
      if (has('arrowdown')) pitch -= 1;
      if (has('arrowleft', 'a')) roll -= 1;
      if (has('arrowright', 'd')) roll += 1;
      if (pitch === 0 && roll === 0 && state.mouseSeen) {
        roll = clamp((state.mouseX - 0.5) * 2.2);
        pitch = clamp((0.5 - state.mouseY) * 2.2);
      }
      // Throttle lives on W/S alone: the arrows already own pitch, and doubling W/S
      // across both jobs made every climb a throttle change too.
      let throttleDelta = 0;
      if (has('w')) throttleDelta += 1;
      if (has('s')) throttleDelta -= 1;
      return {
        pitch: clamp(pitch),
        roll: clamp(roll),
        throttleDelta,
        brake: has('b', ' '),
      };
    },
    /** True once per press of Enter / Space / click. */
    consumeStart() {
      const was = state.startPressed;
      state.startPressed = false;
      return was;
    },
  };
}

function clamp(v) {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
