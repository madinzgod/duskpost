// Screenshot scenes: deterministic stagings of the real game behind ?shot=<name>&seed=<n>.
// Each scene builds the seeded world, puts the plane in a true flight state (the same
// state the physics holds in play), advances the mission rotation through the real
// mission machinery where a scene needs it, and lets the normal renderer draw the frame —
// so a screenshot is the game itself, never a mock-up. Scenes: cover, approach, delivery,
// title, storm.
import { createWorld } from './archipelago.js';
import { createPlane } from './flight-physics.js';
import { createMissions } from './missions.js';
import { makeView, project } from './render.js';

export const SHOT_NAMES = ['cover', 'approach', 'delivery', 'title', 'storm', 'rescue', 'map'];

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
    // The rotation's first mission is already the Kelapa mail run. Staged a
    // touch higher and longer than a real final (300 m, isl.h + 26) so the
    // whole strip — the frame's subject — shows inside the ladder instead
    // of hiding behind it and the aircraft; still inside the guidance
    // envelope, which arms below 85 m.
    const isl = world.islands[1];
    plane.x = isl.x + 4;
    plane.z = isl.z - 300;
    plane.y = isl.h + 26;
    plane.hdg = 0;
    plane.speed = 25;
    plane.throttle = 0.38;
    plane.vy = -2.6;
    plane.bank = -0.05;
    plane.airborne = true;
    plane.onWater = false;
    plane.fuel = 62;
    plane.cargoKg = 240; // the Kelapa mail is aboard on this final
    // The seeded slalom leaves this run's next ring sitting on the sun's
    // disc (the sun hangs at a fixed 0.335 across the frame); re-hang it
    // in the flight path to the right, the same staging the cover uses,
    // so the ring reads as a target and not as the sun's halo.
    for (const r of world.rings) if (r.z < plane.z) r.passed = true;
    const nextRing = world.rings.find((r) => !r.passed && r.z > plane.z);
    if (nextRing) {
      nextRing.x = plane.x + 55;
      nextRing.y = isl.h + 52;
      nextRing.z = plane.z + 205;
    }
    game.score = 475;
    game.lightFrac = 0.55;
    game.light = 132;
  } else if (name === 'storm') {
    // In the storm cell's rough air with Cahaya's mail aboard: close enough
    // that the turbulence is real (stormAt ≈ 0.8 here, so the warning reads
    // ROUGH AIR) and the whole cell — column, anvil, rain shaft, lightning —
    // stands in the left of the frame, while the next ring hangs in the
    // clear air east of it: the routing decision in one frame. The heading
    // is swung a touch west of north so the cell's mass fills the frame's
    // left half; headed due north its centre projected off the frame's
    // edge and the shot was a flat wash of shoulder and empty sky.
    const isl = world.islands[3]; // CAHAYA, the mail's destination
    plane.x = -470;
    plane.z = 2680;
    plane.y = 95;
    plane.hdg = -0.09;
    plane.speed = 38;
    plane.throttle = 0.66;
    plane.vy = 0.4;
    plane.bank = -0.16;
    plane.airborne = true;
    plane.onWater = false;
    plane.fuel = 71;
    plane.cargoKg = 240;
    for (const r of world.rings) if (r.z < plane.z) r.passed = true;
    const ring = world.rings.find((r) => !r.passed && r.z > plane.z);
    if (ring) {
      // +120, not the +210 the north-heading staging used: swung west,
      // the wider offset projects the ring off the frame's right edge
      // and the frame loses its "clear air east" half.
      ring.x = plane.x + 120;
      ring.y = 90;
      ring.z = plane.z + 380;
    }
    missions.current.island = isl;
    missions.current.targetX = isl.x;
    missions.current.targetZ = isl.z;
    missions.current.detail = `Deliver the post to ${isl.name}`;
    game.score = 905;
    game.lightFrac = 0.62;
    game.light = 149;
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
    // One seeded far ring hangs just off this shot's left edge — a
    // cyan arc sliced by the border, a clipped circle rather than a
    // target (V12 audit problem 10: the ring at (−157, 45, 1730)
    // projects to screen x −5). Re-hang it inboard, the same staging
    // the cover and approach use: shift it east until its centre
    // projects inside the frame with its whole rim showing. Only a
    // ring whose rim already crosses the border is re-hung — a ring
    // fully off-frame stays off-frame, so no target is invented
    // where the shot had none.
    {
      const v = makeView(plane, null);
      for (const r of world.rings) {
        if (r.passed || r.z <= plane.z) continue;
        const p = project(v, r.x, r.y, r.z);
        if (!p) continue;
        const rx = r.r * p.s;
        if (p.x < 100 && p.x > -rx) r.x += (100 - p.x) / p.s;
        else if (p.x > 1180 && p.x < 1280 + rx) r.x -= (p.x - 1180) / p.s;
      }
    }
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
  } else if (name === 'rescue') {
    // Floating beside the rescue boat off Batu, flare lit, the crew
    // waiting: the mission the set has never shown. The plane sits on
    // the water ~90 m north of the boat and looks south toward it, so
    // the boat hangs ahead-right with Batu's palms beyond it and the
    // flare's light on the sea — a second water scene, a different
    // verb from the cover's takeoff. Speed 0, so no spray: she floats.
    const boat = world.rescueBoat;
    plane.x = boat.x + 40;
    plane.z = boat.z + 90;
    plane.y = 0;
    plane.hdg = Math.PI + 0.1;
    plane.speed = 0;
    plane.throttle = 0;
    plane.vy = 0;
    plane.bank = 0;
    plane.airborne = false;
    plane.onWater = true;
    plane.spray = 0;
    plane.fuel = 64;
    plane.cargoKg = 0; // a rescue carries no mail
    // The rescue mission, in the real shape the game uses — the same
    // staging the cover already does for the mail mission.
    missions.current = {
      kind: 'rescue',
      title: 'RESCUE',
      detail: 'Set down beside the flaring boat',
      targetX: boat.x,
      targetZ: boat.z,
      boat,
    };
    game.score = 1460;
    game.lightFrac = 0.35;
    game.light = 84;
    // REVISION (first render: the banner's top edge met the beacon
    // label's bottom edge — two dark pills stacked as a collision):
    // no banner on the rescue shot. Its big plain-words text is the
    // beacon's own RESCUE — FLARE label, 24 px in a dark pill, plus
    // the objective chip and the mission card.
    game.stats.rescues = 1; // one rescue already done; this is the second
    game.stats.deliveries = 2;
    game.stats.rings = 3;
  } else if (name === 'map') {
    // The end-of-run debrief: the route map over the home harbour at last
    // light. The plane sits on the water where the run started (the map
    // panel covers her — the backdrop is the harbour at dusk, dimmed);
    // the stats are a full day's work, and the score is the rows' own sum
    // (3 mail × 170 + rescue 200 + 5 rings × 25 = 835), so the panel's
    // list and its score agree. The debrief is a real screen (drawOver),
    // staged here the same way every other shot stages its screen.
    const home = world.islands[0];
    plane.x = home.x - 30;
    plane.z = home.z - 430;
    plane.y = 0;
    plane.hdg = 0.12;
    plane.speed = 0;
    plane.throttle = 0;
    plane.onWater = true;
    plane.fuel = 41;
    game.screen = 'over';
    game.score = 835;
    game.lightFrac = 0.25;
    game.light = 60;
    game.stats = { rings: 5, deliveries: 3, rescues: 1, crashes: 0 };
  } else {
    // cover: WATER TAKEOFF south of Cahaya — on the step, spray flying,
    // the next ring low over the water ahead-right, Cahaya's strip and
    // lighthouse ahead, its mail aboard. The seaplane's defining verb
    // in the large slot: no other cover in the field shows water ops.
    // Staged on the water south of the island (the same water the old
    // cruise cover flew over), so the sky keeps the hero clouds and
    // the squall bank — only the plane's state and the ring change.
    const isl = world.islands[3]; // CAHAYA
    plane.x = isl.x - 74;
    plane.z = isl.z - 430;
    plane.y = 0;
    plane.hdg = 0.07;
    plane.speed = 30;
    plane.throttle = 1.0;
    plane.vy = 0;
    plane.bank = -0.12;
    plane.airborne = false;
    plane.onWater = true;
    plane.spray = 1; // on the step: the floats are throwing water
    plane.fuel = 78;
    plane.cargoKg = 240; // Cahaya's mail is in the back
    // Rings south of here are already threaded on this run; the next
    // one hangs low over the water ahead-right, big in the frame — a
    // gate to climb through off the water, not a halo dead centre.
    for (const r of world.rings) if (r.z < plane.z) r.passed = true;
    const ring = world.rings.find((r) => !r.passed && r.z > plane.z) || world.rings[3];
    ring.x = plane.x + 30;
    ring.y = 18;
    ring.z = plane.z + 130;
    // V22: two far rings overlap into a bubble Venn mid-frame
    // (audit problem 5). Separate any pair whose projected rims
    // overlap, shifting the later ring sideways in world x just
    // enough to clear — only rings that already overlap move, the
    // next (gold) ring is never touched, and only in-frame rings are
    // considered, so no ring is invented where the shot had none.
    // X-only shifts cannot change any ring's next/far status
    // (render.js keys on z). Two passes settle chains.
    for (let pass = 0; pass < 2; pass += 1) {
      const v = makeView(plane, null);
      const far = world.rings.filter((r) => !r.passed && r.z > plane.z && r !== ring);
      const proj = far.map((r) => ({ r, p: project(v, r.x, r.y, r.z) }))
        .filter((o) => o.p && o.p.x > 0 && o.p.x < 1280 && o.p.y > 0 && o.p.y < 800);
      for (let i = 0; i < proj.length; i += 1) {
        for (let j = i + 1; j < proj.length; j += 1) {
          const a = proj[i];
          const b = proj[j];
          const ra = 11 * a.p.s;
          const rb = 11 * b.p.s;
          const dx = b.p.x - a.p.x;
          const dy = b.p.y - a.p.y;
          const d = Math.hypot(dx, dy);
          const need = ra + rb + 8;
          if (d >= need || d === 0) continue;
          const shift = (need - d) / b.p.s + 4;
          b.r.x += (dx >= 0 ? 1 : -1) * shift;
          b.p = project(v, b.r.x, b.r.y, b.r.z);
        }
      }
    }
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
