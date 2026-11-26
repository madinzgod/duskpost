// Flight physics: the seaplane's state and one honest step of it — throttle makes speed,
// bank makes turns, low speed makes sink, and the water and the islands answer back. Hard
// arrivals cost hull; gentle ones are landings. Pure state in, events out, no drawing here.

export function createPlane() {
  return {
    x: 0, y: 0, z: 60, // metres: lateral, altitude over the sea, distance along the course
    hdg: 0, // radians, 0 = straight up the course
    speed: 0, // m/s
    throttle: 0, // 0..1
    bank: 0, // radians, + = right wing down
    vy: 0, // m/s climb rate
    fuel: 100, // percent
    hull: 100, // percent
    cargoKg: 0, // mail aboard, in kg — set by the mission layer; she climbs heavier with it
    airborne: false,
    onWater: true,
    onStrip: null, // island object while parked/rolling on a strip
    propPhase: 0,
    spray: 0, // 0..1 how much water the floats are throwing
  };
}

const MIN_FLY_SPEED = 23; // below this the wing stops holding her up
const MAX_SPEED = 62;

/** One physics step. `input` = {pitch, roll, throttleDelta, brake}. Returns event objects. */
export function stepPlane(p, input, world, dt) {
  const events = [];
  const stallSpeed = MIN_FLY_SPEED + (p.cargoKg > 0 ? 1.2 : 0);

  // Throttle and the speed it drags behind it. No fuel, no thrust: she becomes a glider.
  p.throttle = clamp(p.throttle + input.throttleDelta * dt * 0.55, 0, 1);
  if (p.fuel <= 0) p.throttle = 0;
  const targetSpeed = p.throttle * MAX_SPEED;
  const drag = p.airborne ? 0.55 : 1.5;
  p.speed += clamp(targetSpeed - p.speed, -drag * dt * 6, drag * dt * (p.onWater || p.onStrip ? 4.4 : 2.8));
  if (input.brake && !p.airborne) p.speed = Math.max(0, p.speed - 14 * dt);
  p.fuel = Math.max(0, p.fuel - dt * (0.16 + p.throttle * 0.5));

  // Bank toward the stick, and let the bank swing the nose.
  const bankTarget = input.roll * 0.95;
  p.bank += (bankTarget - p.bank) * Math.min(1, dt * 5);
  if (p.airborne) {
    p.hdg += Math.sin(p.bank) * dt * 1.05 * (30 / Math.max(p.speed, 16));
  } else {
    p.hdg += input.roll * dt * 0.35 * Math.min(1, p.speed / 10);
  }

  // Forward, always forward — and the air itself moves: aloft, the evening wind
  // shoves her sideways and along the course, so holding a line is flying, not
  // pointing. Near the surface the gradient dies away, the way real wind does,
  // so a landing is judged on the descent, not on the weather.
  const prevZ = p.z;
  const prevX = p.x;
  p.x += Math.sin(p.hdg) * p.speed * dt;
  p.z += Math.cos(p.hdg) * p.speed * dt;
  if (p.airborne && world.windAt) {
    const w = world.windAt(p.z);
    const aloft = clamp((p.y - 4) / 46, 0, 1);
    p.x += Math.sin(w.dir) * w.speed * aloft * dt;
    p.z += Math.cos(w.dir) * w.speed * aloft * dt;
  }
  p.x = clamp(p.x, -1400, 1400);
  if (p.z > 6600) p.z = 6600;

  // Climb: the stick pitches her, speed feeds the wing, a stall takes it back.
  // A full mail bag costs climb and raises the speed the wing lets go at — the
  // load is flown, not just labelled.
  if (p.airborne) {
    const lift = clamp(p.speed / stallSpeed, 0, 1.25);
    const wanted = input.pitch * 10.5 * lift * (p.cargoKg > 0 ? 0.86 : 1);
    let stallSink = p.speed < stallSpeed ? (stallSpeed - p.speed) * 0.55 : 0;
    // Ground effect: in the last wingspan of height over a surface the wing
    // holds her up on the cushion of air underneath — the stall sink falls to
    // a quarter, which is what floats a gentle arrival in over the shoreline
    // instead of dropping her onto the slope short of the strip.
    const surface = Math.max(world.heightAt(p.x, p.z), 0);
    if (p.y - surface < 14) stallSink *= 0.25;
    p.vy += (wanted - stallSink - p.vy) * Math.min(1, dt * 2.6);
    p.y += p.vy * dt;
  } else if ((p.onWater || p.onStrip) && p.speed > stallSpeed && input.pitch > 0.25) {
    p.airborne = true;
    p.onWater = false;
    p.onStrip = null;
    p.vy = 2.2;
    p.y += 0.4;
    events.push({ type: 'takeoff' });
  }

  if (p.airborne) {
    const ground = world.heightAt(p.x, p.z);
    const strip = world.stripAt(p.x, p.z);
    const floor = strip ? strip.h : ground;

    if (p.y <= Math.max(floor, 0)) {
      const hard = p.vy < -7.5 || p.speed > 36;
      if (floor > 0.5 && strip) {
        p.y = strip.h;
        if (hard) {
          damage(p, events, p.vy < -9 ? 26 : 16, 'strip');
        } else {
          p.airborne = false;
          p.onStrip = strip;
          p.vy = 0;
          events.push({ type: 'landed', kind: 'strip', island: strip });
        }
      } else if (floor > 0.5) {
        // Island ground with no strip under her: a crash, however she arrived.
        p.y = floor + 1;
        damage(p, events, 34, 'terrain');
        p.vy = Math.abs(p.vy) * 0.35 + 2;
        p.speed *= 0.45;
      } else {
        p.y = 0;
        if (p.vy < -8) {
          damage(p, events, 22, 'water');
          p.vy = 0;
          p.airborne = false;
          p.onWater = true;
        } else {
          p.airborne = false;
          p.onWater = true;
          p.vy = 0;
          events.push({ type: 'landed', kind: 'water' });
        }
      }
    }
  } else {
    // Rolling on a surface: strips end, and running off one at speed is a wreck.
    if (p.onStrip) {
      const still = world.stripAt(p.x, p.z);
      if (!still) {
        const ground = world.heightAt(p.x, p.z);
        if (p.speed > 20 && ground > 0.5) {
          damage(p, events, 20, 'terrain');
          p.speed *= 0.4;
        }
        p.onStrip = null;
        p.onWater = p.y <= 0.2;
        p.y = Math.max(ground, 0);
      } else {
        p.y = p.onStrip.h;
      }
    } else if (p.onWater) {
      p.y = 0;
    }
  }

  // Rings: crossing a ring's plane inside its circle counts, however the nose points.
  for (const ring of world.rings) {
    if (ring.passed) continue;
    if ((prevZ - ring.z) * (p.z - ring.z) <= 0 && prevZ !== p.z) {
      const t = (ring.z - prevZ) / (p.z - prevZ);
      const cx = prevX + (p.x - prevX) * t;
      const cy = p.y; // altitude barely changes inside one step
      const d = Math.hypot(cx - ring.x, cy - ring.y);
      if (d < ring.r) {
        ring.passed = true;
        events.push({ type: 'ring', ring });
      }
    }
  }

  p.spray = (p.onWater && p.speed > 6) || (p.onStrip && p.speed > 10)
    ? Math.min(1, p.spray + dt * 4)
    : Math.max(0, p.spray - dt * 3);
  p.propPhase += dt * (4 + p.throttle * 46);
  return events;
}

function damage(p, events, amount, kind) {
  p.hull = Math.max(0, p.hull - amount);
  events.push({ type: 'crash', kind, amount });
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
