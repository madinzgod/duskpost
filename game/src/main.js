// DUSKPOST — a seaplane mail run at last light. This module wires the game together:
// the loop, the screens (title, play, last light), the particle effects, the mission
// beacon, and the deterministic screenshot scenes behind ?shot=. The flying lives in
// flight-physics.js, the world in archipelago.js, the drawing in render.js and
// instruments.js; this file only conducts.
import { createWorld, homeIsland } from './archipelago.js';
import { createPlane, stepPlane } from './flight-physics.js';
import { createInput } from './input.js';
import { createMissions, missionTarget } from './missions.js';
import { createSound } from './sound.js';
import { makeView, drawScene, project, VIEW_W, VIEW_H } from './render.js';
import { drawInstruments } from './instruments.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') ?? 7) || 7;

const RUN_SECONDS = 240;

let world;
let plane;
let missions;
let game;
let fx = [];
let lastTs = 0;

function newRun(seed) {
  world = createWorld(seed);
  plane = createPlane();
  missions = createMissions(world);
  const home = homeIsland(world);
  plane.x = home.x - 30;
  plane.z = home.z - 430; // a long water run south of the harbour: room to climb clear of it
  fx = [];
  game = {
    screen: 'title',
    score: 0,
    light: RUN_SECONDS,
    lightFrac: 1,
    time: 0,
    mission: missions.current,
    banner: null,
    shakeUntil: 0,
    stats: { rings: 0, deliveries: 0, rescues: 0, crashes: 0 },
  };
}

const input = createInput(canvas);
const sound = createSound();

// A read handle for automated play-tests (and curious pilots in devtools): the live
// plane, game and world objects, exactly as the loop holds them.
window.__duskpost = {
  get plane() { return plane; },
  get game() { return game; },
  get world() { return world; },
};

if (shotName) {
  const staged = stageShot(shotName, shotSeed);
  world = staged.world;
  plane = staged.plane;
  missions = staged.missions;
  game = staged.game;
  const frozenT = { cover: 1.3, approach: 0.7, delivery: 2.1, title: 0.4, storm: 2.93 }[shotName] ?? 1;
  game.time = frozenT;
  world.setTime(frozenT); // the squall stands where the frozen clock puts it
  render(frozenT);
  window.__shotReady = true;
} else {
  newRun((Date.now() % 90000) + 11);
  requestAnimationFrame(loop);
}

function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  game.time += dt;
  const t = game.time;

  if (input.consumeStart()) {
    sound.start();
    if (game.screen !== 'play') {
      const seed = (Date.now() % 90000) + 11;
      const keepScreen = game.screen;
      newRun(seed);
      game.screen = 'play';
      void keepScreen;
    }
  }

  if (game.screen === 'play') {
    const axes = input.axes();
    const events = stepPlane(plane, axes, world, dt);
    handleEvents(events, t);
    const result = missions.update(events, plane);
    game.score += result.points;
    if (result.banner) {
      game.banner = { text: result.banner, until: t + 3.2 };
      if (result.banner.startsWith('RESCUE')) game.stats.rescues += 1;
    }
    game.mission = missions.current;
    // The mail is a load, not a label: while a mail run is current the bag is
    // aboard (240 kg the wing has to carry); delivery — or any other job —
    // leaves her empty.
    plane.cargoKg = missions.current.kind === 'mail' ? 240 : 0;
    // Keep the ring-run card pointed at the next ring.
    const tgt = missionTarget(missions.current, world, plane);
    if (tgt) {
      missions.current.targetX = tgt.x;
      missions.current.targetZ = tgt.z;
    }
    game.light = Math.max(0, game.light - dt);
    game.lightFrac = game.light / RUN_SECONDS;
    world.setTime(t); // the squall drifts on the run's clock
    stepFx(dt);
    sound.update(plane.throttle, plane.speed);
    if (game.light <= 0 || plane.hull <= 0) {
      game.screen = 'over';
      game.banner = null;
    }
  }
  render(t);
}

function handleEvents(events, t) {
  for (const ev of events) {
    if (ev.type === 'ring') {
      game.stats.rings += 1;
      sound.chime();
      burst(ev.ring.x, ev.ring.y, ev.ring.z, '#ffc46b', 14, 3.2);
    } else if (ev.type === 'landed') {
      if (ev.kind === 'strip') {
        game.stats.deliveries += missions.current.kind === 'mail' && ev.island === missions.current.island ? 1 : 0;
        plane.fuel = 100;
        sound.jingle();
        game.banner = { text: `DOWN SAFE AT ${ev.island.name} — REFUELLED`, until: t + 2.4 };
      } else {
        sound.splash();
      }
    } else if (ev.type === 'crash') {
      game.stats.crashes += 1;
      sound.thud();
      game.shakeUntil = t + 0.45;
      burst(plane.x, plane.y + 2, plane.z, ev.kind === 'water' ? '#dff4f4' : '#57483c', 20, 4.4);
      game.banner = { text: ev.kind === 'water' ? 'HEAVY SPLASHDOWN — HULL DAMAGED' : 'CRASH — HULL DAMAGED', until: t + 2.4 };
    } else if (ev.type === 'takeoff') {
      game.banner = { text: 'AIRBORNE — THE LIGHT IS SHORT, FLY THE ROUTE', until: t + 2.2 };
    }
  }
  // Rescue completion is a mission result, not a physics event: watch for the banner.
}

function burst(x, y, z, color, n, size) {
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    fx.push({
      x, y, z,
      vx: Math.cos(a) * (4 + (i % 3) * 2),
      vy: 2 + (i % 4),
      vz: Math.sin(a) * (4 + (i % 3) * 2),
      life: 0.9,
      maxLife: 0.9,
      color,
      size,
    });
  }
}

function stepFx(dt) {
  for (const pt of fx) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.z += pt.vz * dt;
    pt.vy -= 2.2 * dt;
    pt.life -= dt;
  }
  fx = fx.filter((pt) => pt.life > 0);
  // Continuous spray/smoke sources while playing.
  if (plane.spray > 0.3 && plane.speed > 8) {
    fx.push({
      x: plane.x - Math.sin(plane.hdg) * 6, y: 0.6, z: plane.z - Math.cos(plane.hdg) * 6,
      vx: -Math.sin(plane.hdg) * 6 + (Math.random() - 0.5) * 3,
      vy: 2.4, vz: -Math.cos(plane.hdg) * 6,
      life: 0.55, maxLife: 0.55, color: '#dff4f4', size: 2.6,
    });
  }
  if (plane.hull < 55 && plane.airborne) {
    fx.push({
      x: plane.x, y: plane.y + 3, z: plane.z,
      vx: 0, vy: 3.4, vz: -3,
      life: 1.1, maxLife: 1.1, color: '#3a3230', size: 3.4,
    });
  }
}

function render(t) {
  const shaking = t < game.shakeUntil;
  // Storm turbulence shakes the camera the way it shakes the plane: the
  // cell's shoulder is felt in the frame before the cloud fills it.
  const turbShake = plane.turb > 0.2
    ? { x: Math.sin(t * 43) * 6 * plane.turb, y: Math.cos(t * 37) * 5 * plane.turb }
    : { x: 0, y: 0 };
  const shake = {
    x: (shaking ? Math.sin(t * 91) * 7 : 0) + turbShake.x,
    y: (shaking ? Math.cos(t * 83) * 5 : 0) + turbShake.y,
  };
  const view = makeView(plane, shake);
  drawScene(ctx, view, world, plane, fx, game, t);
  if (game.screen === 'play' || shotName) {
    drawBeacon(ctx, view, t);
    drawInstruments(ctx, VIEW_W, VIEW_H, plane, game, world, t);
  }
  if (game.screen === 'title') drawTitle(t);
  if (game.screen === 'over') drawOver(t);
}

/** A pillar of light over the mission target, with its name — findable from anywhere. */
function drawBeacon(ctx, view, t) {
  const m = game.mission;
  if (!m) return;
  const tgt = missionTarget(m, world, plane);
  if (!tgt) return;
  const base = project(view, tgt.x, 0, tgt.z);
  if (!base) return;
  const pulse = 0.55 + 0.3 * Math.sin(t * 3.1);
  // The pillar's height scales with the target's own projected scale, the
  // way its width does: a fixed 320 screen px at every range left a far
  // island's name hanging at cloud height, hundreds of pixels above a
  // silhouette a few dozen tall, attached to nothing the eye could
  // follow. Near targets keep a tall pillar; far names hug their islands.
  const pillarH = clamp(base.s * 34, 40, 200);
  const grad = ctx.createLinearGradient(0, base.y - pillarH, 0, base.y);
  grad.addColorStop(0, 'rgba(255,196,107,0)');
  grad.addColorStop(1, `rgba(255,196,107,${0.4 * pulse})`);
  ctx.fillStyle = grad;
  // The pillar is a real thing in the world — about 6 m of light — so its
  // width comes from the projection like everything else: a fixed ~3 px at
  // every range made it invisible and left the name label floating alone.
  const wdt = clamp(base.s * 6, 2, 30);
  ctx.fillRect(base.x - wdt / 2, base.y - pillarH, wdt, pillarH);
  ctx.strokeStyle = `rgba(255,196,107,${0.75 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, wdt * 1.5, wdt * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (base.s > 0.35) {
    const fontPx = clamp(base.s * 3, 11, 24);
    ctx.font = `700 ${fontPx}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const label = m.kind === 'rings' ? 'NEXT RING' : m.kind === 'rescue' ? 'RESCUE — FLARE' : m.island ? m.island.name : '';
    if (label) {
      // A dark backing pill, like the HUD's other labels carry: drawn
      // bare, the name fought whatever terrain projected behind it —
      // on approach it stacked unreadably over the island against the
      // guidance ladder's own FINAL line naming the same island.
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(10,14,22,0.38)';
      ctx.beginPath();
      ctx.roundRect(base.x - tw / 2 - 8, base.y - pillarH - 10 - fontPx - 5, tw + 16, fontPx + 9, 6);
      ctx.fill();
      ctx.fillStyle = '#ffe9c9';
      ctx.fillText(label, base.x, base.y - pillarH - 10);
    }
  }
}

function drawTitle(t) {
  ctx.fillStyle = 'rgba(10,10,26,0.34)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9c9';
  ctx.save();
  ctx.shadowColor = 'rgba(255,150,60,0.8)';
  ctx.shadowBlur = 26;
  ctx.font = '800 96px system-ui, sans-serif';
  ctx.fillText('D U S K P O S T', VIEW_W / 2, 218);
  ctx.restore();
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillStyle = '#ffc46b';
  ctx.fillText('a seaplane mail run at last light', VIEW_W / 2, 262);
  ctx.font = '500 19px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,233,201,0.92)';
  ctx.fillText('Carry the post up the archipelago before the sun goes. Thread the rings,', VIEW_W / 2, 316);
  ctx.fillText('land the strips to deliver and refuel, and set down by the flare when a boat calls.', VIEW_W / 2, 344);
  ctx.font = '600 18px ui-monospace, Menlo, monospace';
  ctx.fillStyle = 'rgba(255,233,201,0.85)';
  ctx.fillText('W / S — THROTTLE      ↑ / ↓ — PITCH      ← / → — BANK      SPACE — BRAKE', VIEW_W / 2, 402);
  ctx.fillText('mouse steers too · land gently: the hull remembers', VIEW_W / 2, 432);
  if (t * 1.4 % 1 < 0.68) {
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText('PRESS ENTER — TAKE OFF', VIEW_W / 2, 508);
  }
}

function drawOver(t) {
  ctx.fillStyle = 'rgba(8,8,22,0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9c9';
  ctx.font = '800 58px system-ui, sans-serif';
  ctx.fillText(plane.hull <= 0 ? 'SHE WILL NOT FLY AGAIN' : 'LAST LIGHT', VIEW_W / 2, 240);
  ctx.font = '600 23px system-ui, sans-serif';
  ctx.fillStyle = '#ffc46b';
  ctx.fillText(plane.hull <= 0 ? 'The hull gave out over the archipelago.' : 'The run ends with the sun. The post you carried is counted.', VIEW_W / 2, 282);
  ctx.font = '600 22px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#ffe9c9';
  const s = game.stats;
  ctx.fillText(`SCORE ${game.score}`, VIEW_W / 2, 348);
  ctx.font = '500 19px ui-monospace, Menlo, monospace';
  ctx.fillText(`mail delivered ${s.deliveries} · rings threaded ${s.rings} · rescues ${s.rescues} · hard arrivals ${s.crashes}`, VIEW_W / 2, 386);
  if (t * 1.4 % 1 < 0.68) {
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText('PRESS ENTER — FLY AGAIN', VIEW_W / 2, 462);
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
