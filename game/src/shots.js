// Screenshot scenes: deterministic stagings of the real game behind ?shot=<name>&seed=<n>.
// Each scene builds the seeded world, puts the plane in a true flight state (the same
// state the physics holds in play), advances the mission rotation through the real
// mission machinery where a scene needs it, and lets the normal renderer draw the frame —
// so a screenshot is the game itself, never a mock-up. Scenes: cover, approach, delivery,
// title.
import { createWorld } from './archipelago.js';
import { createPlane } from './flight-physics.js';
import { createMissions } from './missions.js';

export const SHOT_NAMES = ['cover', 'approach', 'delivery', 'title'];

export function stageShot(name, seed) {
  const world = createWorld(seed);
  const plane = createPlane();
  const missions = createMissions(world);
  const game = {
    screen: 'play',
    score: 0,
    light: 240,
    lightFrac: 0.85,
    time: 0,
    mission: missions.current,
    banner: null,
    stats: { rings: 0, deliveries: 0, rescues: 0, crashes: 0 },
  };

  if (name === 'approach') {
    // On final for Kelapa: low, slow, lined up on the strip, guidance ladder lit.
    // The rotation's first mission is already the Kelapa mail run.
    const isl = world.islands[1];
    plane.x = isl.x + 4;
    plane.z = isl.z - 260;
    plane.y = isl.h + 21;
    plane.hdg = 0;
    plane.speed = 25;
    plane.throttle = 0.38;
    plane.vy = -2.6;
    plane.bank = -0.05;
    plane.airborne = true;
    plane.onWater = false;
    plane.fuel = 62;
    plane.cargoKg = 240; // the Kelapa mail is aboard on this final
    game.score = 475;
    game.lightFrac = 0.55;
    game.light = 132;
  } else if (name === 'delivery') {
    // Just touched down on the Kelapa strip: run the real landing event through the
    // mission machinery so the card honestly shows the next job, then raise the banner.
    const isl = world.islands[1];
    plane.x = isl.x;
    plane.z = isl.z - 18;
    plane.y = isl.h;
    plane.hdg = 0;
    plane.speed = 0;
    plane.throttle = 0;
    plane.airborne = false;
    plane.onWater = false;
    plane.onStrip = isl;
    plane.fuel = 96;
    plane.hull = 88;
    missions.update([{ type: 'landed', kind: 'strip', island: isl }], plane);
    game.score = 1240;
    game.lightFrac = 0.3;
    game.light = 71;
    game.banner = { text: `MAIL DELIVERED TO ${isl.name} +170 · REFUELLED`, until: 1e9 };
    game.stats.deliveries = 2;
  } else if (name === 'title') {
    // Floating at the home harbour before the run, the course and its lighthouse ahead.
    const home = world.islands[0];
    plane.x = home.x - 30;
    plane.z = home.z - 430;
    plane.y = 0;
    plane.hdg = 0.12;
    plane.speed = 0;
    plane.throttle = 0;
    plane.onWater = true;
    game.screen = 'title';
    game.lightFrac = 0.9;
    game.light = 216;
  } else {
    // cover: mid-flight, banked toward the next glowing ring, Cahaya's strip and
    // lighthouse ahead, its mail mission on the card — the whole game in one frame.
    // Staged closer than V1 and a little lower, so the island and its strip fill
    // more of the frame and the runway reads at a glance instead of as a dash —
    // but kept above the approach guidance's envelope (it arms below 85 m), so
    // the cover stays a cruise frame with no landing overlay on it.
    const isl = world.islands[3]; // CAHAYA
    plane.x = isl.x - 74;
    plane.z = isl.z - 430;
    plane.y = 88;
    plane.hdg = 0.07;
    plane.speed = 39;
    plane.throttle = 0.68;
    plane.vy = 0.8;
    plane.bank = -0.34;
    plane.airborne = true;
    plane.onWater = false;
    plane.fuel = 78;
    plane.cargoKg = 240; // Cahaya's mail is in the back
    // Rings south of here are already threaded on this run; the next one hangs
    // right in the flight path, big in the frame.
    for (const r of world.rings) if (r.z < plane.z) r.passed = true;
    const ring = world.rings.find((r) => !r.passed && r.z > plane.z) || world.rings[3];
    ring.x = plane.x + 16;
    ring.y = 80;
    ring.z = plane.z + 175;
    // The card shows this island's run: describe the current mission as Cahaya's.
    missions.current.island = isl;
    missions.current.targetX = isl.x;
    missions.current.targetZ = isl.z;
    missions.current.detail = `Deliver the post to ${isl.name}`;
    game.score = 640;
    game.lightFrac = 0.8;
    game.light = 192;
  }

  game.mission = missions.current;
  return { world, plane, game, missions };
}
