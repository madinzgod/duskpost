// Missions: the run's rotating work. Three kinds, always in rotation — MAIL RUN (land on a
// named island's strip and the mail goes ashore), RING RUN (chain the glowing rings), and
// RESCUE (put down on the water beside the flaring boat). Each completion pays, refuels are
// earned by landing, and the mission card the HUD draws comes from here.

export const POINTS = { mail: 150, ring: 25, ringChainBonus: 40, rescue: 200, landing: 20 };

export function createMissions(world) {
  const stripIslands = world.islands.filter((i) => i.strip && !i.home);
  let queue = [];
  let qi = 0;
  // A fixed rotation with seeded targets: mail, rings, mail, rescue, rings, mail…
  const order = ['mail', 'rings', 'mail', 'rescue', 'rings', 'mail', 'rescue', 'rings'];
  let mailIdx = 0;

  function build(kind) {
    if (kind === 'mail') {
      const isl = stripIslands[mailIdx % stripIslands.length];
      mailIdx += 1;
      return {
        kind,
        title: 'MAIL RUN',
        detail: `Deliver the post to ${isl.name}`,
        targetX: isl.x,
        targetZ: isl.z,
        island: isl,
      };
    }
    if (kind === 'rings') {
      const count = 4;
      return {
        kind,
        title: 'RING RUN',
        detail: `Thread ${count} rings in a row`,
        targetX: 0,
        targetZ: 0,
        need: count,
        got: 0,
      };
    }
    const boat = world.rescueBoat;
    return {
      kind: 'rescue',
      title: 'RESCUE',
      detail: 'Set down beside the flaring boat',
      targetX: boat.x,
      targetZ: boat.z,
      boat,
    };
  }

  function next() {
    if (qi >= queue.length) {
      queue = order.map(build);
      qi = 0;
    }
    const m = queue[qi];
    qi += 1;
    return m;
  }

  return {
    current: next(),
    /**
     * Feed one frame's events in. Returns {points, banner} when the mission completes,
     * or {points} for scoring events short of completion (rings outside a Ring Run).
     */
    update(events, plane) {
      let points = 0;
      let done = null;
      const m = this.current;
      for (const ev of events) {
        if (ev.type === 'ring') {
          points += POINTS.ring;
          if (m.kind === 'rings') {
            m.got += 1;
            m.detail = `Thread the rings — ${m.got} of ${m.need}`;
            if (m.got >= m.need) {
              points += POINTS.ringChainBonus;
              done = `RING RUN COMPLETE +${POINTS.ring + POINTS.ringChainBonus}`;
            }
          }
        }
        if (ev.type === 'landed' && ev.kind === 'strip') {
          points += POINTS.landing;
          if (m.kind === 'mail' && ev.island === m.island) {
            points += POINTS.mail;
            done = `MAIL DELIVERED TO ${m.island.name} +${POINTS.mail + POINTS.landing}`;
          }
        }
        if (ev.type === 'landed' && ev.kind === 'water' && m.kind === 'rescue') {
          const d = Math.hypot(plane.x - m.boat.x, plane.z - m.boat.z);
          if (d < 95) {
            points += POINTS.rescue;
            done = `RESCUE — CREW ABOARD +${POINTS.rescue}`;
          }
        }
      }
      if (done) {
        this.current = next();
        return { points, banner: done };
      }
      return { points, banner: null };
    },
  };
}

/** The world point the HUD's distance readout and the beacon aim at. */
export function missionTarget(m, world, plane) {
  if (!m) return null;
  if (m.kind === 'rings') {
    const ring = world.rings.find((r) => !r.passed && (!plane || r.z > plane.z - 20));
    return ring ? { x: ring.x, z: ring.z } : null;
  }
  return { x: m.targetX, z: m.targetZ };
}
