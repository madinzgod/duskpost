// The archipelago: a seeded chain of dusk islands along a 6 km mail course — which island sits
// where, which of them carry a landing strip, where the flight rings hang, where the boats
// drift, and the two questions the physics asks every step: how high is the ground here, and
// am I over a strip?
import { rngTools } from './random.js';

export const COURSE_LENGTH = 6400;

/** Island names, west to east along the run. Original places, invented for this game. */
const ISLAND_PLAN = [
  { name: 'PELABUHAN', x: -40, z: 260, r: 150, h: 7, strip: true, home: true },
  { name: 'KELAPA', x: 150, z: 1150, r: 120, h: 9, strip: true },
  { name: 'BATU', x: -190, z: 2050, r: 105, h: 14, strip: false },
  { name: 'CAHAYA', x: 210, z: 2900, r: 130, h: 11, strip: true, lighthouse: true },
  { name: 'TANJUNG', x: -120, z: 3850, r: 140, h: 8, strip: true },
  { name: 'MUTIARA', x: 170, z: 4750, r: 100, h: 16, strip: false },
  { name: 'SIRIP', x: -210, z: 5450, r: 95, h: 9, strip: false },
  { name: 'PELANGI', x: 30, z: 6100, r: 135, h: 10, strip: true },
];

/**
 * Build the whole world from a seed. Islands follow the fixed plan (so missions can name
 * them) with seeded jitter in position and outline; rings, boats and clouds are seeded too.
 */
export function createWorld(seed) {
  const rng = rngTools(seed);

  const islands = ISLAND_PLAN.map((plan) => {
    const outline = [];
    const points = 16;
    for (let i = 0; i < points; i += 1) outline.push(0.78 + rng.next() * 0.4);
    return {
      ...plan,
      x: plan.x + rng.range(-24, 24),
      z: plan.z + rng.range(-40, 40),
      outline,
      stripLen: 120,
      stripWid: 17,
      palms: Array.from({ length: 9 }, () => ({
        a: rng.next() * Math.PI * 2,
        d: 0.35 + rng.next() * 0.5,
        s: 0.8 + rng.next() * 0.6,
      })),
    };
  });

  // Rings hang along the course in loose slalom lines, dipping toward the water and
  // climbing over the islands, so a Ring Run is a route to fly, not a straight line.
  const rings = [];
  for (let z = 620, i = 0; z < COURSE_LENGTH - 260; z += rng.range(300, 420), i += 1) {
    rings.push({
      x: Math.sin(i * 1.7) * 150 + rng.range(-40, 40),
      y: 34 + Math.sin(i * 2.3) * 20 + rng.range(-6, 10),
      z,
      r: 11,
      passed: false,
      index: i,
    });
  }

  const boats = [];
  for (let i = 0; i < 7; i += 1) {
    boats.push({
      x: rng.range(-330, 330),
      z: rng.range(500, COURSE_LENGTH - 300),
      hdg: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.6),
      hue: rng.pick(['#e8e2d4', '#c8552e', '#3e7d86', '#d9a441']),
      rescue: false,
    });
  }
  // The rescue boat sits off Batu island, flare lit, waiting for the mail plane.
  const rescueBoat = {
    x: -330, z: 2380, hdg: 0.8, speed: 0.4, hue: '#e8e2d4', rescue: true,
  };
  boats.push(rescueBoat);

  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: rng.range(-900, 900),
      y: rng.range(120, 230),
      z: rng.range(200, COURSE_LENGTH),
      s: rng.range(60, 170),
    });
  }

  // The evening wind: one seeded flow for the whole run, biased along the course (a
  // headwind or a tailwind with a crosswise lean, never a full beam gale), breathing
  // in strength and veering a little as the course runs north. windAt answers for
  // any point along the course so physics, the windsocks and the HUD all read the
  // same air.
  const wind = {
    dir: rng.range(-0.55, 0.55) + (rng.next() < 0.5 ? 0 : Math.PI), // toward, radians as hdg
    speed: rng.range(1.7, 2.6), // m/s at full strength, aloft
    veer: rng.range(0.5, 1.1),
    gustPhase: rng.range(0, Math.PI * 2),
  };

  function windAt(z) {
    const dir = wind.dir + Math.sin(z * 0.0006) * 0.3 * wind.veer;
    const speed = wind.speed * (0.78 + 0.34 * (0.5 + 0.5 * Math.sin(z * 0.004 + wind.gustPhase)));
    return { dir, speed };
  }

  /** Height of the island ground at (x, z); 0 over open water. Smooth shoulders, flat top. */
  function heightAt(x, z) {
    let top = 0;
    for (const isl of islands) {
      const dx = x - isl.x;
      const dz = z - isl.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < isl.r * 1.25) {
        const t = Math.max(0, 1 - d / (isl.r * 1.25));
        const h = isl.h * Math.min(1, t * 1.6);
        if (h > top) top = h;
      }
    }
    return top;
  }

  /**
   * The island whose runway surface the point is over, or null. The surface is the
   * painted strip plus its graded shelf — the flattened shoulders at both ends a real
   * island strip is built with — so an approach that touches the shelf rolls onto the
   * strip instead of meeting the island's hillside. Strips run along the course (z).
   */
  function stripAt(x, z) {
    for (const isl of islands) {
      if (!isl.strip) continue;
      if (Math.abs(x - isl.x) <= isl.stripWid / 2 + 6 && Math.abs(z - isl.z) <= isl.stripLen / 2 + 30) {
        return isl;
      }
    }
    return null;
  }

  return { islands, rings, boats, rescueBoat, clouds, heightAt, stripAt, seed, wind, windAt };
}

/** The home harbour island the run starts from. */
export function homeIsland(world) {
  return world.islands[0];
}
