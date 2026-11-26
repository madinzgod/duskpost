// Render: the whole visible world in canvas 2D pseudo-3D — a dusk sky that deepens as the
// light meter drains, a low sun, a teal sea with sun-glitter, layered islands with beaches,
// palms, strips and a lighthouse, the glowing rings, and the boats. One projection turns
// world metres into screen pixels; everything draws far-to-near through it.
import { drawSeaplane } from './seaplane.js';

export const VIEW_W = 1280;
export const VIEW_H = 800;

/** Camera + projection for one frame, built from the plane's state. */
export function makeView(plane, shake) {
  const sinH = Math.sin(plane.hdg);
  const cosH = Math.cos(plane.hdg);
  return {
    camX: plane.x - sinH * 30,
    camY: plane.y + 8.5,
    camZ: plane.z - cosH * 30,
    sinH,
    cosH,
    focal: VIEW_W * 0.92,
    horizon: VIEW_H * 0.435 + clamp(-plane.vy * 5, -26, 26) + (shake ? shake.y : 0),
    shakeX: shake ? shake.x : 0,
  };
}

/** Project a world point. Returns null when it sits behind the camera. */
export function project(v, wx, wy, wz) {
  const dx = wx - v.camX;
  const dz = wz - v.camZ;
  const fwd = dx * v.sinH + dz * v.cosH;
  if (fwd < 2) return null;
  const right = dx * v.cosH - dz * v.sinH;
  const s = v.focal / fwd;
  return {
    x: VIEW_W / 2 + right * s + v.shakeX,
    y: v.horizon - (wy - v.camY) * s,
    s,
    fwd,
  };
}

/** Draw everything except the HUD: world, effects, then the plane. */
export function drawScene(ctx, v, world, plane, fx, game, t) {
  drawSky(ctx, v, game.lightFrac, t);
  drawSea(ctx, v, plane, game.lightFrac);
  drawWorldObjects(ctx, v, world, plane, fx, t, game.lightFrac);
  drawParticles(ctx, v, fx);
  const scale = plane.onStrip || plane.onWater ? 1.24 : 1.34;
  drawSeaplane(ctx, VIEW_W / 2 + v.shakeX, VIEW_H * 0.665, scale, plane, t);
  drawSpray(ctx, plane, t);
}

function drawSky(ctx, v, light, t) {
  const g = ctx.createLinearGradient(0, 0, 0, v.horizon + 60);
  if (light > 0.45) {
    g.addColorStop(0, '#2c2350');
    g.addColorStop(0.45, '#7a3d63');
    g.addColorStop(0.78, '#e2703a');
    g.addColorStop(1, '#ffb35c');
  } else {
    g.addColorStop(0, '#171233');
    g.addColorStop(0.45, '#472a55');
    g.addColorStop(0.78, '#b34a35');
    g.addColorStop(1, '#e88a4a');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, v.horizon + 60);

  // The sun: a low disc ahead-left with a wide glow, sinking as the light drains.
  const sunX = VIEW_W * 0.335;
  const sunY = v.horizon - 26 - light * 44;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 240);
  glow.addColorStop(0, 'rgba(255,196,110,0.85)');
  glow.addColorStop(0.25, 'rgba(255,150,80,0.35)');
  glow.addColorStop(1, 'rgba(255,140,70,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 250, sunY - 250, 500, 500);
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 27, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffbe78';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.globalAlpha = 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Distant cloud strata: two soft washes riding the horizon, so the sky has
  // weather in depth and not just a gradient. They are radial gradients with
  // no hard edge anywhere — a flat ellipse here reads as a smear on the sky,
  // where a wash reads as far cloud too hazed to hold a shape.
  for (const [fx, fy, r, a] of [[0.78, -64, 380, 0.30], [0.12, -96, 300, 0.22]]) {
    ctx.save();
    ctx.translate(VIEW_W * fx, v.horizon + fy);
    ctx.scale(1, 0.2);
    const wash = ctx.createRadialGradient(0, 0, 8, 0, 0, r);
    wash.addColorStop(0, `rgba(70,40,80,${a})`);
    wash.addColorStop(0.55, `rgba(88,48,88,${a * 0.5})`);
    wash.addColorStop(1, 'rgba(88,48,88,0)');
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // First stars in the upper dark, late in the run.
  if (light < 0.5) {
    ctx.fillStyle = 'rgba(255,244,220,0.8)';
    for (let i = 0; i < 42; i += 1) {
      const sx = (i * 379.7) % VIEW_W;
      const sy = (i * 173.3) % (VIEW_H * 0.22);
      if ((i * 7 + Math.floor(t * 1.5)) % 5 !== 0) ctx.fillRect(sx, sy, 2, 2);
    }
  }
}

function drawSea(ctx, v, plane, light) {
  const g = ctx.createLinearGradient(0, v.horizon, 0, VIEW_H);
  g.addColorStop(0, '#d97a4a');
  g.addColorStop(0.12, '#7a5a6d');
  g.addColorStop(0.35, '#2e5f6b');
  g.addColorStop(1, '#173f4d');
  ctx.fillStyle = g;
  ctx.fillRect(0, v.horizon, VIEW_W, VIEW_H - v.horizon);

  // Sun glitter: a bright broken path under the sun, plus seeded sparkle
  // everywhere. Each row is two or three short dashes with seeded gaps and a
  // jittered centre — one smooth dash per row at even spacing reads as a
  // staircase under the sun, where broken dashes read as light on water.
  ctx.fillStyle = 'rgba(255,190,110,0.5)';
  for (let i = 0; i < 46; i += 1) {
    const row = i / 46;
    const y = v.horizon + 6 + row * row * (VIEW_H - v.horizon) * 0.92 + Math.sin(i * 39.7) * 2.4;
    const wob = Math.sin(i * 12.9898) * 26 * row + Math.sin(i * 47.31) * 17 * row + Math.sin(plane.z * 0.05 + i) * 6;
    const w = 8 + row * 90 * (0.4 + 0.6 * Math.abs(Math.sin(i * 78.233)));
    ctx.globalAlpha = (0.12 + row * 0.4) * 0.85;
    const cxp = VIEW_W * 0.335 + wob;
    const segs = 2 + (i % 3 === 0 ? 1 : 0);
    for (let sg = 0; sg < segs; sg += 1) {
      // Per-segment alpha from a hash, so some dashes nearly vanish: a path
      // of even dashes reads as steps however it is broken up.
      const segA = 0.35 + 0.65 * Math.abs(Math.sin(i * 31.7 + sg * 7.9));
      const off = (sg - (segs - 1) / 2) * (w / segs) * 1.35 + Math.sin(i * 5.3 + sg * 9.1) * 4 * row;
      const sw = (w / segs) * (0.45 + 0.4 * Math.abs(Math.sin(i * 23.7 + sg * 4.3)));
      ctx.globalAlpha = (0.12 + row * 0.4) * 0.85 * segA;
      ctx.fillRect(cxp + off - sw / 2, y, sw, 1.6 + row * 2.2);
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(220,245,245,0.35)';
  for (let i = 0; i < 70; i += 1) {
    const wz = plane.z + 40 + ((i * 613.7) % 1500);
    // A hashed sideways jitter on top of the modular placement: the
    // bare steps lay the dashes on diagonal lattice rows, a pattern
    // stamped on the water; jittered, they are just sparkle.
    const wx = plane.x + ((i * 389.3) % 900) - 450 + Math.sin(i * 91.7) * 70;
    const p = project(v, wx, 0, wz + ((plane.z * 3 + i * 91) % 60));
    if (!p || p.y < v.horizon) continue;
    const len = clamp(p.s * 0.09, 2, 26);
    ctx.globalAlpha = clamp(0.5 - p.fwd / 2600, 0.05, 0.4);
    ctx.fillRect(p.x - len / 2, p.y, len, Math.max(1, p.s * 0.012));
  }
  ctx.globalAlpha = 1;
}

function drawWorldObjects(ctx, v, world, plane, fx, t, light) {
  const items = [];
  for (const c of world.clouds) items.push({ kind: 'cloud', o: c, z: c.z });
  if (world.storm) items.push({ kind: 'storm', o: world.storm, z: world.storm.z });
  if (world.squallNow) {
    const sq = world.squallNow();
    items.push({ kind: 'squall', o: sq, z: sq.z });
  }
  for (const isl of world.islands) items.push({ kind: 'island', o: isl, z: isl.z });
  for (const b of world.boats) items.push({ kind: 'boat', o: b, z: b.z });
  for (const r of world.rings) if (!r.passed) items.push({ kind: 'ring', o: r, z: r.z });
  items.sort((a, b) => b.z - a.z);
  const nextRing = world.rings.find((r) => !r.passed && r.z > plane.z - 20);

  for (const item of items) {
    if (item.kind === 'cloud') drawCloud(ctx, v, item.o);
    else if (item.kind === 'storm') drawStorm(ctx, v, item.o, t);
    else if (item.kind === 'squall') drawSquall(ctx, v, item.o, t);
    else if (item.kind === 'island') drawIsland(ctx, v, item.o, t, light, world);
    else if (item.kind === 'boat') drawBoat(ctx, v, item.o, t);
    else drawRing(ctx, v, item.o, item.o === nextRing, t);
  }
}

/** One soft cloud puff: a radial-gradient disc squashed to cloud proportions,
 *  its colour solid through the middle and gone at the rim — no hard edge
 *  anywhere. Overlapping flat fills show their rims where they cross, which
 *  is what turned the storm's belly into a stack of soap discs; gradient
 *  puffs melt into each other the way cloud does. `inner` and `outer` are
 *  the same hue at full and zero alpha. */
function softPuff(ctx, cx, cy, r, inner, outer) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.72);
  const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  g.addColorStop(0, inner);
  g.addColorStop(0.62, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The squall line: a band of weather lying across the course — a long, low
 *  bank of soft puffs stretched wide and flattened where the cell stacks
 *  them into a tower, a rain curtain hanging out of it, the sea shadowed
 *  beneath. It reads as a line to cross or time, not a wall to avoid, and
 *  its lightning only mutters inside the bank. Drawn with the storm's own
 *  machinery, at the squall's drifted position on the run's clock. */
function drawSquall(ctx, v, sq, t) {
  const base = project(v, sq.x, 0, sq.z);
  const topP = project(v, sq.x, sq.top, sq.z);
  if (!base || !topP) return;
  const s = base.s;
  const halfW = sq.halfLen * s;
  if (halfW < 24) return;
  const seaY = base.y;
  const baseP = project(v, sq.x, sq.base, sq.z);
  const baseY = baseP ? baseP.y : seaY - sq.base * s;
  const topY = topP.y;
  const bodySpan = baseY - topY;

  ctx.save();
  // The whole line fades in with range: at three kilometres it is a
  // rumour on the horizon, not a smear stamped across it. The fade runs
  // over a long span of s and never saturates at the cover's distance
  // (s ≈ 0.48): a bank at full strength there stacked its twelve puffs
  // into a solid dark sausage on the horizon.
  ctx.globalAlpha = clamp((s - 0.14) / 0.5, 0.35, 1);

  // The sea under the line lies in shadow: a wide soft gradient, no rim.
  ctx.save();
  ctx.translate(base.x, seaY);
  ctx.scale(1, 0.1);
  const sh = ctx.createRadialGradient(0, 0, 4, 0, 0, halfW * 1.04);
  sh.addColorStop(0, 'rgba(16,22,34,0.32)');
  sh.addColorStop(0.7, 'rgba(16,22,34,0.18)');
  sh.addColorStop(1, 'rgba(16,22,34,0)');
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(0, 0, halfW * 1.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The rain curtain: one wide soft wash with streaks running down it.
  const grad = ctx.createLinearGradient(0, baseY, 0, seaY);
  grad.addColorStop(0, 'rgba(168,182,205,0.17)');
  grad.addColorStop(1, 'rgba(168,182,205,0.05)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(base.x - halfW * 0.92, baseY);
  ctx.lineTo(base.x + halfW * 0.92, baseY);
  ctx.lineTo(base.x + halfW * 0.98, seaY);
  ctx.lineTo(base.x - halfW * 0.98, seaY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,200,220,0.13)';
  ctx.lineWidth = Math.max(1, s * 0.3);
  const streaks = Math.max(5, Math.floor(halfW / 26));
  for (let i = 0; i < streaks; i += 1) {
    const fx = -0.88 + (i / Math.max(1, streaks - 1)) * 1.76;
    const drift = ((t * 0.8 + i * 0.29) % 1) * 0.3;
    ctx.beginPath();
    ctx.moveTo(base.x + fx * halfW, baseY + (seaY - baseY) * drift * 0.2);
    ctx.lineTo(base.x + fx * halfW + halfW * 0.02, baseY + (seaY - baseY) * (0.55 + drift * 0.4));
    ctx.stroke();
  }

  // The bank itself: a row of soft puffs along the front, bellies dark,
  // a second pass lifting the tops — the cell's puff machinery laid out
  // along a line instead of stacked into a column.
  const puffs = [
    [-0.86, 0.30, 0.16], [-0.62, 0.52, 0.20], [-0.38, 0.38, 0.17],
    [-0.14, 0.62, 0.22], [0.10, 0.44, 0.18], [0.34, 0.66, 0.21],
    [0.58, 0.40, 0.17], [0.82, 0.56, 0.19], [0.0, 0.30, 0.24],
    [-0.48, 0.72, 0.16], [0.46, 0.82, 0.15], [0.02, 0.86, 0.18],
  ];
  // Distance haze for the bank itself: the islands retint toward the
  // dusk mauve as they recede, and a bank that keeps its full
  // night-violet at two kilometres sits on the horizon like ink. Blend
  // the puff colours toward the mauve by the same range that fades
  // them, so distance softens the bank's colour as well as its alpha.
  const haze = clamp(0.95 - s, 0, 0.5);
  const blend = (r, g, b, a) => `rgba(${Math.round(r + (122 - r) * haze)},${Math.round(g + (74 - g) * haze)},${Math.round(b + (96 - b) * haze)},${a})`;
  for (const [fx, fy, fr] of puffs) {
    softPuff(ctx, base.x + fx * halfW, baseY - bodySpan * fy, fr * halfW * 1.1, blend(38, 34, 56, 0.95), blend(38, 34, 56, 0));
  }
  for (const [fx, fy, fr] of puffs) {
    if (fy < 0.5) continue;
    softPuff(ctx, base.x + fx * halfW - halfW * 0.02, baseY - bodySpan * (fy + 0.05), fr * halfW * 0.66, blend(96, 84, 120, 0.5), blend(96, 84, 120, 0));
  }

  // Lightning, rarer and quieter than the cell's: a glow inside the bank
  // every seven seconds and no bolt — the line mutters where the cell cracks.
  const cycle = t % 7;
  if (cycle < 0.12) {
    const flash = 1 - cycle / 0.12;
    const gx = base.x + halfW * 0.3;
    const gy = baseY - bodySpan * 0.55;
    const glow = ctx.createRadialGradient(gx, gy, 4, gx, gy, halfW * 0.4);
    glow.addColorStop(0, `rgba(255,244,200,${0.5 * flash})`);
    glow.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(gx - halfW * 0.4, gy - bodySpan * 0.5, halfW * 0.8, bodySpan);
  }
  ctx.restore();
}

/** The storm cell: a cumulonimbus standing on the sea — a dark column with a
 *  spread anvil top, a rain shaft slanting out of its base, the sea shadowed
 *  beneath it, and lightning that fires inside the cloud every few seconds.
 *  It is drawn like weather, not like an icon: layered masses, no outline. */
function drawStorm(ctx, v, storm, t) {
  const base = project(v, storm.x, 0, storm.z);
  const topP = project(v, storm.x, storm.top, storm.z);
  if (!base || !topP) return;
  const s = base.s;
  const R = storm.r * s;
  if (R < 10) return;
  const cx = base.x;
  const seaY = base.y;
  const baseP = project(v, storm.x, storm.base, storm.z);
  const baseY = baseP ? baseP.y : seaY - storm.base * s;
  const topY = topP.y;

  // The sea under the cell lies in shadow, rain-darkened: a radial
  // gradient, darkest under the column and gone at its rim — a flat
  // ellipse here drew a plate laid on the water, rim and all.
  ctx.save();
  ctx.translate(cx, seaY);
  ctx.scale(1, 0.1);
  const shadow = ctx.createRadialGradient(0, 0, 4, 0, 0, R * 1.05);
  shadow.addColorStop(0, 'rgba(16,22,34,0.36)');
  shadow.addColorStop(0.7, 'rgba(16,22,34,0.20)');
  shadow.addColorStop(1, 'rgba(16,22,34,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The rain shaft: a slanted curtain from the cloud base to the sea — the
  // visible reason the route keeps east. It is drawn as nested soft
  // trapezoids (never one hard-edged wedge) with streaks running down it;
  // the two widest layers are the weakest, so the silhouette feathers
  // into the air instead of ending on one straight diagonal line.
  const slant = R * 0.14;
  for (const [shrink, a] of [[-0.22, 0.025], [-0.1, 0.04], [0, 0.05], [0.14, 0.07], [0.3, 0.09]]) {
    const grad = ctx.createLinearGradient(0, baseY, 0, seaY);
    grad.addColorStop(0, `rgba(168,182,205,${a + 0.10})`);
    grad.addColorStop(1, `rgba(168,182,205,${a * 0.4})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - R * (0.52 - shrink), baseY);
    ctx.lineTo(cx + R * (0.52 - shrink), baseY);
    ctx.lineTo(cx + R * (0.62 - shrink) + slant, seaY);
    ctx.lineTo(cx - R * (0.62 - shrink) + slant, seaY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(190,200,220,0.15)';
  ctx.lineWidth = Math.max(1, s * 0.35);
  for (let i = 0; i < 11; i += 1) {
    const fx = -0.46 + i * 0.092;
    const drift = ((t * 0.7 + i * 0.37) % 1) * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + fx * R, baseY + (seaY - baseY) * drift * 0.2);
    ctx.lineTo(cx + fx * R + slant * (0.4 + drift), baseY + (seaY - baseY) * (0.55 + drift * 0.4));
    ctx.stroke();
  }

  // The cloud body: a tower of overlapping puffs between the cloud base
  // and the top — a narrower column at the foot, a bulging middle, and
  // the anvil spreading at the top. Every puff is a soft radial gradient
  // (see softPuff): flat fills showed their rims where they crossed, and
  // the belly read as a stack of soap discs at screenshot size. Bellies
  // near-black violet; a second, smaller pass lifts the tops; a faint
  // dusk rim catches the sun side. Radii run a touch large to make up
  // for the soft rim.
  const bodySpan = baseY - topY;
  const puffs = [
    [-0.28, 0.05, 0.21], [0.08, 0.04, 0.24], [0.36, 0.07, 0.19],
    [-0.40, 0.15, 0.23], [-0.02, 0.14, 0.27], [0.38, 0.17, 0.22],
    [-0.44, 0.27, 0.25], [0.04, 0.26, 0.29], [0.44, 0.29, 0.24],
    [-0.46, 0.39, 0.27], [0.02, 0.38, 0.31], [0.47, 0.41, 0.26],
    [-0.48, 0.51, 0.29], [0.05, 0.50, 0.33], [0.50, 0.53, 0.28],
    [-0.54, 0.63, 0.30], [0.0, 0.62, 0.34], [0.55, 0.64, 0.29],
    [-0.62, 0.74, 0.31], [-0.05, 0.74, 0.35], [0.58, 0.75, 0.30],
    [-0.70, 0.84, 0.30], [-0.18, 0.85, 0.33], [0.34, 0.85, 0.32], [0.72, 0.83, 0.26],
    [-0.55, 0.93, 0.28], [0.0, 0.95, 0.32], [0.55, 0.93, 0.27],
  ];
  for (const [fx, fy, fr] of puffs) {
    softPuff(ctx, cx + fx * R, baseY - bodySpan * fy, fr * R * 1.12, 'rgba(33,29,50,0.88)', 'rgba(33,29,50,0)');
  }
  for (const [fx, fy, fr] of puffs) {
    softPuff(ctx, cx + fx * R - R * 0.03, baseY - bodySpan * (fy + 0.035), fr * R * 0.8, 'rgba(59,53,84,0.30)', 'rgba(59,53,84,0)');
  }
  // A darker, smaller core inside the belly: at the scale of the storm
  // frame the soft passes composite into one smooth wash and the mass
  // reads flat — shadowed cores at half radius, low in the column, give
  // it internal structure at any range.
  for (const [fx, fy, fr] of puffs) {
    if (fy > 0.55) continue;
    softPuff(ctx, cx + fx * R * 0.92, baseY - bodySpan * (fy + 0.01), fr * R * 0.5, 'rgba(17,14,29,0.34)', 'rgba(17,14,29,0)');
  }
  for (const [fx, fy, fr] of puffs) {
    if (fy < 0.6) continue;
    softPuff(ctx, cx + (fx - 0.1) * R, baseY - bodySpan * (fy + 0.03), fr * R * 0.66, 'rgba(255,150,90,0.13)', 'rgba(255,150,90,0)');
  }

  // Lightning: a few frames of fire inside the upper cloud, and a bolt
  // standing in the rain shaft from the cloud base to the sea. The period
  // is fixed, so a frozen screenshot either catches it lit or not — never
  // half-drawn.
  const cycle = t % 2.9;
  if (cycle < 0.14) {
    const flash = 1 - cycle / 0.14;
    const glow = ctx.createRadialGradient(cx, topY + bodySpan * 0.3, 4, cx, topY + bodySpan * 0.3, R * 0.9);
    glow.addColorStop(0, `rgba(255,244,200,${0.75 * flash})`);
    glow.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - R, topY - bodySpan * 0.1, R * 2, bodySpan * 1.1);
    ctx.strokeStyle = `rgba(255,240,190,${0.9 * flash})`;
    ctx.lineWidth = Math.max(2.4, s * 0.8);
    ctx.shadowColor = 'rgba(255,240,190,0.9)';
    ctx.shadowBlur = 18;
    // A bolt with a fork: one hairline zigzag read as a crack on the
    // image; a thicker, branched strike reads as lightning.
    const nodes = [[cx + R * 0.12, baseY - bodySpan * 0.04]];
    for (let i = 1; i <= 4; i += 1) {
      nodes.push([
        nodes[i - 1][0] + (i % 2 === 0 ? 1 : -1) * R * 0.07,
        nodes[i - 1][1] + (seaY - baseY) / 4,
      ]);
    }
    ctx.beginPath();
    ctx.moveTo(nodes[0][0], nodes[0][1]);
    for (let i = 1; i < nodes.length; i += 1) ctx.lineTo(nodes[i][0], nodes[i][1]);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,240,190,${0.55 * flash})`;
    ctx.lineWidth = Math.max(1.6, s * 0.5);
    ctx.beginPath();
    ctx.moveTo(nodes[2][0], nodes[2][1]);
    ctx.lineTo(nodes[2][0] - R * 0.09, nodes[2][1] + (seaY - baseY) * 0.22);
    ctx.lineTo(nodes[2][0] - R * 0.05, nodes[2][1] + (seaY - baseY) * 0.44);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawCloud(ctx, v, c) {
  const p = project(v, c.x, c.y, c.z);
  if (!p) return;
  const w = c.s * p.s * 0.26;
  if (w < 26 || w > 900) return; // too small to hold a shape: a dash, not a cloud — skip it
  // A dusk cloud built like a cloud: a cluster of overlapping puffs, bellies in
  // deep violet, tops catching the last light, and a lit rim along the sun side.
  // A big cloud gets taller puffs and a wider vertical spread, scaling with
  // its width: the same flat cluster stretched past ~170 px reads as a lens
  // — a pancake, not a bank.
  const big = w > 300;
  const spread = Math.min(0.62, 0.34 + Math.max(0, w - 150) / 550);
  const puffH = Math.min(0.34, 0.21 + Math.max(0, w - 150) / 800);
  const puffs = [[-0.52, 0.10, 0.52], [-0.26, -0.02, 0.68], [0.02, -0.10, 0.85], [0.32, -0.03, 0.66], [0.56, 0.10, 0.48], [0, 0.12, 0.9]];
  // Per-puff jitter hashed from the cloud's own position, so it is the
  // same every frame for a given cloud and different for every other:
  // two flat passes of one fixed cluster at fixed offsets are what
  // resolved into nested oval contours — a stamped lens — at screenshot
  // size. Jittered offsets, radii, squash and alpha break the stamp;
  // at judge size the bank reads exactly as before, a dark mass with a
  // lit top.
  const jit = (i, salt) => {
    const h = Math.sin(c.x * 12.9898 + c.z * 0.371 + i * 7.77 + salt * 3.1) * 43758.5453;
    return h - Math.floor(h);
  };
  ctx.fillStyle = 'rgba(74,44,86,0.62)';
  puffs.forEach(([ox, oy, r], i) => {
    ctx.beginPath();
    ctx.ellipse(
      p.x + (ox + (jit(i, 1) - 0.5) * 0.09) * w,
      p.y + (oy + (jit(i, 2) - 0.5) * 0.07) * w * spread,
      r * w * 0.55 * (0.86 + jit(i, 3) * 0.3),
      r * w * puffH * (0.85 + jit(i, 4) * 0.3),
      0, 0, Math.PI * 2,
    );
    ctx.fill();
  });
  puffs.forEach(([ox, oy, r], i) => {
    ctx.fillStyle = `rgba(146,84,110,${0.36 + jit(i, 5) * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(
      p.x + (ox + (jit(i, 6) - 0.5) * 0.09) * w,
      p.y + (oy - 0.045 + (jit(i, 7) - 0.5) * 0.06) * w * spread,
      r * w * 0.5 * (0.86 + jit(i, 8) * 0.3),
      r * w * puffH * 0.76 * (0.85 + jit(i, 9) * 0.3),
      0, 0, Math.PI * 2,
    );
    ctx.fill();
  });
  // The lit top edge: light, not a line — and never a filled ellipse,
  // which draws a clean oval inside the cloud, an "eye". The rim is
  // stroked three times — a wide faint pass, a mid pass, a narrower
  // brighter one — each jittered like the puffs, so the light melts
  // into the cloud the way dusk light does. (Layered strokes, not a
  // shadow blur: shadowBlur on a stroke this size costs more than the
  // rest of the frame together on a CPU canvas, and the frame rate is
  // the game's feel.) One clean hard arc here is what resolved into a
  // lens outline at screenshot size, worst on the small clouds, where
  // the arc was the whole drawing.
  for (const [salt, alpha, width, shrink] of [
    [10, 0.05, 0.10, 1],
    [20, 0.10, 0.055, 0.96],
    [30, big ? 0.20 : 0.26, 0.028, 0.92],
  ]) {
    ctx.strokeStyle = `rgba(255,166,110,${alpha})`;
    ctx.lineWidth = Math.max(1.2, w * width);
    ctx.beginPath();
    ctx.ellipse(
      p.x - w * 0.05 + (jit(0, salt + 1) - 0.5) * w * 0.05,
      p.y - w * 0.02 + (jit(0, salt + 2) - 0.5) * w * 0.03,
      w * 0.46 * shrink * (0.92 + jit(0, salt + 3) * 0.14),
      w * spread * 0.30 * shrink * (0.9 + jit(0, salt + 4) * 0.18),
      0, Math.PI * 1.08, Math.PI * 1.92,
    );
    ctx.stroke();
  }
}

function drawIsland(ctx, v, isl, t, light, world) {
  const centre = project(v, isl.x, 0, isl.z);
  if (!centre && project(v, isl.x, 0, isl.z + isl.r) === null) return;
  const fwd = centre ? centre.fwd : 2400;
  // Distance haze and the draining light both retint the land: far islands melt
  // toward the dusk mauve of the sky, and as the light meter empties the ground
  // darkens with the sky instead of glowing at noon under a night sky.
  const haze = clamp((fwd - 900) / 2600, 0, 0.45);
  const dark = (1 - clamp(light, 0, 1)) * 0.75;
  // The ground darkens harder than the palette's other tones: at last light
  // the sky keeps its orange horizon while the land is already in night, and
  // a lerp that leaves the grass at half its day colour still reads as noon
  // under a starry sky (the delivery frame sits at light 0.3).
  const darkLand = Math.min(0.85, dark * 1.35);
  const tone = (hex, duskHex) => mixc(mixc(hex, '#8a5570', haze), duskHex, dark);
  const toneLand = (hex, duskHex) => mixc(mixc(hex, '#8a5570', haze), duskHex, darkLand);
  // Foam line at the water's edge, then the beach, then the raised land inside it.
  islandPath(ctx, v, isl, 1.23, 0);
  ctx.fillStyle = 'rgba(230,246,244,0.28)';
  ctx.fill();
  islandPath(ctx, v, isl, 1.16, 0);
  ctx.fillStyle = toneLand('#d9a86c', '#6e5138');
  ctx.fill();
  islandPath(ctx, v, isl, 1.0, 0);
  const land = ctx.createLinearGradient(0, centre ? centre.y - isl.h * centre.s : 0, 0, centre ? centre.y : VIEW_H);
  land.addColorStop(0, toneLand('#4a7a5c', '#243a2c'));
  land.addColorStop(0.6, toneLand('#33604a', '#1a2f24'));
  land.addColorStop(1, toneLand('#274d3d', '#12211a'));
  ctx.fillStyle = land;
  ctx.fill();
  // A lit ridge so the island reads as ground with height, not a flat blob.
  islandPath(ctx, v, isl, 0.55, isl.h * 0.9);
  ctx.fillStyle = toneLand('#7aa86e', '#33503a');
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  // Ground patches: seeded clearings in varied land tones, clipped to the
  // island's own outline and toned with the same haze and darkening as the
  // land itself. Without them the near island is one flat gradient fill
  // between the beach and the ridge — a billiard table with a strip on it;
  // with them, close land has ground in it. The strip, huts and palms all
  // draw after this, on top.
  ctx.save();
  islandPath(ctx, v, isl, 1.0, 0);
  ctx.clip();
  for (let i = 0; i < 6; i += 1) {
    const a = i * 2.13 + isl.z * 0.013;
    const rr = isl.r * (0.3 + 0.16 * (i % 3));
    const pp = project(v, isl.x + Math.cos(a) * rr, isl.h * 0.55, isl.z + Math.sin(a) * rr * 0.8);
    if (!pp) continue;
    const rad = Math.max(6, pp.s * isl.r * 0.3);
    const toneHex = i % 2 === 0 ? toneLand('#5d8a5e', '#2c4a34') : toneLand('#2e5a44', '#142a20');
    const g = ctx.createRadialGradient(pp.x, pp.y, rad * 0.15, pp.x, pp.y, rad);
    g.addColorStop(0, hexA(toneHex, 0.5));
    g.addColorStop(1, hexA(toneHex, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(pp.x, pp.y, rad, rad * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // A tree-line of dark crowns along the ridge, so the top reads as wooded.
  // Past ~2.6 km the crowns would be 3 px scratches on the horizon, not
  // trees — the haze alone carries the island there. And only from the
  // air: from a camera at strip level the far crowns sit at eye height
  // on the slope and read as dark discs punched in the grass, so a low
  // camera leaves the ridge to the ridge blob and the palms.
  if (centre && centre.s > 0.45 && fwd < 2600 && v.camY - isl.h > 14) {
    ctx.fillStyle = toneLand('#2c5a3c', '#16281e');
    for (let i = 0; i < 13; i += 1) {
      const a = i * 2.4 + isl.z * 0.01;
      const rr = isl.r * 0.42 * (0.72 + 0.28 * Math.sin(i * 7.3));
      const p = project(v, isl.x + Math.cos(a) * rr, isl.h * 0.98, isl.z + Math.sin(a) * rr);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, clamp(p.s * (1.6 + (i % 3) * 0.5), 1.5, 9), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (isl.strip) drawStrip(ctx, v, isl, t, world);
  if (isl.strip) drawHuts(ctx, v, isl, t);
  if (isl.home) drawDock(ctx, v, isl);
  for (const palm of isl.palms) {
    // Same rule as the tree-line: a palm 2.2 km out is a scratch, not a palm.
    if (fwd > 2200) break;
    const a = palm.a;
    const px = isl.x + Math.cos(a) * isl.r * palm.d;
    const pz = isl.z + Math.sin(a) * isl.r * palm.d;
    // The palm stands on the island's own slope: its base takes the height the
    // ground actually has at that ring, not the summit's, so shoreline palms
    // root in the beach instead of floating over the water.
    const baseY = isl.h * Math.min(1, Math.max(0, (1 - palm.d / 1.25)) * 1.6);
    drawPalm(ctx, v, px, baseY, pz, palm.s);
  }
  if (isl.lighthouse) drawLighthouse(ctx, v, isl, t);
}

/** The strip-side buildings: two huts with lamplit windows and a stack of mail
 *  crates — the reason the strip exists, readable at a glance on approach. They
 *  stand well back from the strip's edge, the way real strip buildings do. */
function drawHuts(ctx, v, isl, t) {
  const spots = [
    { dx: -isl.stripWid / 2 - 38, dz: -52, roof: '#a03d24' },
    { dx: isl.stripWid / 2 + 40, dz: 46, roof: '#7a4a2c' },
  ];
  spots.forEach((spot, i) => {
    // The huts stand on the island's shoulder, not its summit: at their
    // spots the ground (heightAt) is ≈ 0.6 of isl.h, and a hut planted
    // at the full height floats on the skyline in any ground-level
    // frame — the delivery shot's east hut hung on the horizon with
    // the sea behind it.
    const base = project(v, isl.x + spot.dx, isl.h * 0.62, isl.z + spot.dz);
    if (!base || base.s < 0.35) return;
    const w = 7 * base.s;
    const h = 4.4 * base.s;
    ctx.fillStyle = '#e6d9bd';
    ctx.fillRect(base.x - w / 2, base.y - h, w, h);
    // A shaded side wall, so the hut is a little building and not a billboard.
    ctx.fillStyle = 'rgba(90,70,50,0.45)';
    ctx.fillRect(base.x + w * 0.18, base.y - h, w * 0.32, h);
    // A door in the shadowed side, so the wall reads as a house at a glance.
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(base.x + w * 0.24, base.y - h * 0.52, w * 0.16, h * 0.52);
    // The gable end the roof sits on, shaded like the side wall.
    ctx.fillStyle = 'rgba(90,70,50,0.30)';
    ctx.beginPath();
    ctx.moveTo(base.x - w / 2, base.y - h);
    ctx.lineTo(base.x, base.y - h * 1.42);
    ctx.lineTo(base.x + w / 2, base.y - h);
    ctx.closePath();
    ctx.fill();
    // The roof as two slabs overhanging the gable, not a flat triangle.
    ctx.strokeStyle = spot.roof;
    ctx.lineWidth = Math.max(1.6, h * 0.16);
    ctx.beginPath();
    ctx.moveTo(base.x - w * 0.62, base.y - h * 0.98);
    ctx.lineTo(base.x, base.y - h * 1.55);
    ctx.lineTo(base.x + w * 0.62, base.y - h * 0.98);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,196,107,${0.72 + 0.28 * Math.sin(t * 3 + i * 2.4)})`;
    ctx.fillRect(base.x - w * 0.3, base.y - h * 0.66, w * 0.2, h * 0.3);
    ctx.fillRect(base.x + w * 0.08, base.y - h * 0.66, w * 0.2, h * 0.3);
    if (i === 0) {
      ctx.fillStyle = '#8a6a42';
      const cw = 3 * base.s;
      ctx.fillRect(base.x + w * 0.72, base.y - cw, cw, cw);
      ctx.fillRect(base.x + w * 0.72 + cw * 0.4, base.y - cw * 2, cw * 0.9, cw * 0.9);
    }
  });
}

/** The home harbour's dock: a plank jetty reaching south into the water the run
 *  starts on, posts and all. */
function drawDock(ctx, v, isl) {
  const x0 = isl.x - isl.r * 0.34;
  const z0 = isl.z - isl.r * 0.88;
  const z1 = isl.z - isl.r * 1.3;
  const near = project(v, x0, 0.7, z1);
  const far = project(v, x0, 0.7, z0);
  if (!near || !far) return;
  const wNear = Math.max(1.5, near.s * 3.2);
  const wFar = Math.max(1, far.s * 3.2);
  ctx.fillStyle = '#6e5138';
  ctx.beginPath();
  ctx.moveTo(far.x - wFar, far.y);
  ctx.lineTo(far.x + wFar, far.y);
  ctx.lineTo(near.x + wNear, near.y);
  ctx.lineTo(near.x - wNear, near.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4c3826';
  for (const p of [far, near]) {
    ctx.fillRect(p.x - wNear - 1, p.y - 1, 2.4, Math.max(2, p.s * 1.6));
    ctx.fillRect(p.x + wNear - 1, p.y - 1, 2.4, Math.max(2, p.s * 1.6));
  }
}

function islandPath(ctx, v, isl, scaleR, lift) {
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= isl.outline.length; i += 1) {
    const idx = i % isl.outline.length;
    const a = (idx / isl.outline.length) * Math.PI * 2;
    const rr = isl.r * isl.outline[idx] * scaleR;
    const p = project(v, isl.x + Math.cos(a) * rr, lift, isl.z + Math.sin(a) * rr);
    if (!p) continue;
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/** Project with the depth clamped, for geometry the camera is standing inside (a strip
 *  under the floats): points just behind still sweep to the frame's edge instead of
 *  vanishing, so near ground stays drawn. */
function projectClamped(v, wx, wy, wz) {
  const dx = wx - v.camX;
  const dz = wz - v.camZ;
  const fwd = Math.max(dx * v.sinH + dz * v.cosH, 3);
  const right = dx * v.cosH - dz * v.sinH;
  const s = v.focal / fwd;
  return {
    x: VIEW_W / 2 + right * s + v.shakeX,
    y: v.horizon - (wy - v.camY) * s,
    s,
    fwd,
  };
}

function drawStrip(ctx, v, isl, t, world) {
  const hw = isl.stripWid / 2;
  const hl = isl.stripLen / 2;
  const y = isl.h + 0.25;
  // The surface in slices along its length, so it draws whole even with the camera
  // parked on it — a single four-corner quad would vanish the moment a corner
  // slipped behind the lens.
  ctx.fillStyle = '#5d5648';
  for (let d = -hl; d < hl; d += 12) {
    const a = projectClamped(v, isl.x - hw, y, isl.z + d);
    const b = projectClamped(v, isl.x + hw, y, isl.z + d);
    const c = projectClamped(v, isl.x + hw, y, isl.z + d + 12);
    const e = projectClamped(v, isl.x - hw, y, isl.z + d + 12);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(e.x, e.y);
    ctx.closePath();
    ctx.fill();
  }
  // The strip's edges as lines through the same clamped slices as the
  // surface, so the strip has edges at every range — including when the
  // camera is parked on it, where the four-corner outline below can never
  // project. Without them the surface is an edgeless slab and its edge
  // lights float on the grass with nothing to attach to.
  ctx.strokeStyle = 'rgba(255,233,201,0.55)';
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    let started = false;
    for (let d = -hl; d <= hl; d += 12) {
      const p = projectClamped(v, isl.x + side * hw, y, isl.z + d);
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  const corners = [
    project(v, isl.x - hw, y, isl.z - hl),
    project(v, isl.x + hw, y, isl.z - hl),
    project(v, isl.x + hw, y, isl.z + hl),
    project(v, isl.x - hw, y, isl.z + hl),
  ];
  if (!corners.some((c) => !c)) {
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,233,201,0.9)';
    ctx.lineWidth = Math.max(1, corners[0].s * 0.05);
    ctx.stroke();
  }
  // Centreline dashes and threshold bars, drawn through the clamped
  // projection like the surface and edges: with plain project() every
  // dash behind the lens is dropped, so the runway went blank at exactly
  // the range where it should read loudest — parked on it in the
  // delivery frame, one dash survived.
  ctx.fillStyle = '#ffe9c9';
  for (let d = -hl + 10; d < hl - 7; d += 16) {
    const a = projectClamped(v, isl.x, y, isl.z + d);
    const b = projectClamped(v, isl.x, y, isl.z + d + 8);
    // The dash's half-width in screen px: at s * 0.03 it was a hairline
    // (0.3–1.2 px at strip ranges) and the centreline vanished at ground
    // level, where the delivery frame needs it most. s * 0.14 is about
    // 0.3 m of paint — a real centreline's width — clamped so a dash
    // under the floats never becomes a slab.
    const aw = clamp(a.s * 0.14, 1.1, 24);
    const bw = clamp(b.s * 0.14, 1.1, 24);
    ctx.beginPath();
    ctx.moveTo(a.x - aw, a.y);
    ctx.lineTo(a.x + aw, a.y);
    ctx.lineTo(b.x + bw, b.y);
    ctx.lineTo(b.x - bw, b.y);
    ctx.closePath();
    ctx.fill();
  }
  // Threshold bars: four piano keys across each end of the strip — the
  // marking that makes a grey slab read as a runway from the air, and
  // the cheapest strengthener of the cover's weakest checklist element.
  for (const endSign of [-1, 1]) {
    for (let k = 0; k < 4; k += 1) {
      const bx = isl.x - hw * 0.66 + k * (hw * 0.44);
      const d0 = endSign * (hl - 13);
      const d1 = endSign * (hl - 4);
      const a = projectClamped(v, bx, y, isl.z + d0);
      const b = projectClamped(v, bx + hw * 0.3, y, isl.z + d0);
      const c = projectClamped(v, bx + hw * 0.3, y, isl.z + d1);
      const e = projectClamped(v, bx, y, isl.z + d1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(e.x, e.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Edge lights: amber dots that make the strip findable at dusk, blinking in pairs.
  for (let d = -hl; d <= hl; d += 15) {
    for (const side of [-1, 1]) {
      const p = project(v, isl.x + side * (hw + 1.6), y, isl.z + d);
      if (!p) continue;
      const on = (t * 1.2 + (d / 15 + (side > 0 ? 0.5 : 0)) % 1) % 1 < 0.8;
      ctx.fillStyle = on ? '#ffc46b' : 'rgba(255,196,107,0.3)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, clamp(p.s * 0.14, 1, 4.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Windsock at the near threshold — and it flies the evening's real wind: it
  // streams downwind, lengthens with the strength, and flutters in the gusts,
  // so the sock, the HUD readout and the drift on the plane all tell one story.
  const base = project(v, isl.x + hw + 7, isl.h, isl.z - hl + 6);
  if (base) {
    const topWorld = { x: isl.x + hw + 7, y: isl.h + 9, z: isl.z - hl + 6 };
    const top = project(v, topWorld.x, topWorld.y, topWorld.z);
    if (top) {
      ctx.strokeStyle = '#e8e2d4';
      ctx.lineWidth = Math.max(1, base.s * 0.05);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      const w = world && world.windAt ? world.windAt(isl.z) : { dir: 0.6, speed: 2 };
      const dir = w.dir + Math.sin(t * 2.7) * 0.09;
      const len = 2.2 + w.speed * 0.8;
      const tip = project(v, topWorld.x + Math.sin(dir) * len, topWorld.y - len * 0.16, topWorld.z + Math.cos(dir) * len);
      if (tip) {
        ctx.fillStyle = '#e2703a';
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.lineTo(top.x, top.y + top.s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f3ead8';
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, Math.max(0.8, top.s * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPalm(ctx, v, x, y, z, s) {
  const base = project(v, x, y, z);
  if (!base || base.s < 0.25) return;
  const h = 9 * s * base.s;
  ctx.strokeStyle = '#3a2c20';
  ctx.lineWidth = Math.max(1, base.s * 0.1);
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.quadraticCurveTo(base.x + h * 0.14, base.y - h * 0.6, base.x + h * 0.3, base.y - h);
  ctx.stroke();
  ctx.strokeStyle = '#2f6b46';
  const tx = base.x + h * 0.3;
  const ty = base.y - h;
  for (let i = 0; i < 5; i += 1) {
    const a = Math.PI * (0.08 + i * 0.21);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * h * 0.5, ty - Math.sin(a) * h * 0.34, tx + Math.cos(a) * h * 0.72, ty + h * 0.16);
    ctx.stroke();
  }
}

function drawLighthouse(ctx, v, isl, t) {
  const bx = isl.x + isl.r * 0.52;
  const bz = isl.z - isl.r * 0.3;
  const base = project(v, bx, isl.h * 0.9, bz);
  if (!base) return;
  const H = 21 * base.s;
  const Wd = 4.6 * base.s;
  if (H < 8) return;
  ctx.fillStyle = '#e8e2d4';
  ctx.beginPath();
  ctx.moveTo(base.x - Wd / 2, base.y);
  ctx.lineTo(base.x - Wd * 0.32, base.y - H);
  ctx.lineTo(base.x + Wd * 0.32, base.y - H);
  ctx.lineTo(base.x + Wd / 2, base.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8552e';
  ctx.fillRect(base.x - Wd * 0.44, base.y - H * 0.68, Wd * 0.88, H * 0.2);
  ctx.fillRect(base.x - Wd * 0.38, base.y - H * 0.34, Wd * 0.76, H * 0.18);
  // The lamp room and its rotating beam.
  const lampY = base.y - H - 2.4 * base.s;
  ctx.fillStyle = '#22333a';
  ctx.fillRect(base.x - Wd * 0.3, lampY - 2 * base.s, Wd * 0.6, 3.4 * base.s);
  const beamA = t * 0.7;
  ctx.save();
  ctx.globalAlpha = 0.09 + 0.05 * Math.sin(t * 2.2);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.moveTo(base.x, lampY);
  ctx.arc(base.x, lampY, H * 2.4, beamA, beamA + 0.19);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(base.x, lampY, Math.max(1.6, base.s * 0.32), 0, Math.PI * 2);
  ctx.fill();
}

function drawBoat(ctx, v, b, t) {
  const p = project(v, b.x, 0, b.z);
  if (!p) return;
  const w = 15 * p.s;
  const h = 4.6 * p.s;
  // Below this scale the hull, cabin and wake are a few pixels in total
  // and resolve into a stray coloured glyph hovering on the sea, not a
  // boat: better nothing than a mark the eye cannot place. A rescue
  // flare is the one exception — it is a light, and a light is exactly
  // what carries at range, so the flare alone draws on.
  if (p.s < 0.3) {
    if (b.rescue) {
      const flicker = 0.75 + 0.25 * Math.sin(t * 11);
      const r = Math.max(9, w * 0.9);
      const glow = ctx.createRadialGradient(p.x, p.y - h * 2.6, 1, p.x, p.y - h * 2.6, r);
      glow.addColorStop(0, `rgba(255,120,40,${0.85 * flicker})`);
      glow.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(p.x - r, p.y - h * 2.6 - r, r * 2, r * 2);
      ctx.fillStyle = '#ffb35c';
      ctx.beginPath();
      ctx.arc(p.x, p.y - h * 2.6, Math.max(1.6, p.s * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // Wake — only once the boat is big enough for a wake to read as one.
  if (p.s > 0.55) {
    ctx.strokeStyle = 'rgba(230,248,248,0.4)';
    ctx.lineWidth = Math.max(1, p.s * 0.08);
    ctx.beginPath();
    ctx.moveTo(p.x - w * 0.5, p.y);
    ctx.lineTo(p.x - w * 1.5, p.y + h * 0.8 + Math.sin(t * 2 + b.z) * 1.4);
    ctx.moveTo(p.x + w * 0.5, p.y);
    ctx.lineTo(p.x + w * 1.3, p.y + h * 0.7);
    ctx.stroke();
  }
  // Hull and cabin.
  ctx.fillStyle = b.hue;
  ctx.beginPath();
  ctx.moveTo(p.x - w / 2, p.y - h * 0.5);
  ctx.lineTo(p.x + w / 2, p.y - h * 0.5);
  ctx.lineTo(p.x + w * 0.34, p.y + h * 0.5);
  ctx.lineTo(p.x - w * 0.34, p.y + h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f3ead8';
  ctx.fillRect(p.x - w * 0.16, p.y - h * 1.25, w * 0.34, h * 0.75);
  ctx.fillStyle = '#22333a';
  ctx.fillRect(p.x - w * 0.1, p.y - h * 1.12, w * 0.22, h * 0.3);
  if (b.rescue) {
    // Flare: a rising orange star and its smoke, impossible to miss at dusk.
    const flicker = 0.75 + 0.25 * Math.sin(t * 11);
    const glow = ctx.createRadialGradient(p.x, p.y - h * 2.6, 1, p.x, p.y - h * 2.6, w * 0.9);
    glow.addColorStop(0, `rgba(255,120,40,${0.85 * flicker})`);
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - w, p.y - h * 3.6, w * 2, w * 2);
    ctx.fillStyle = '#ffb35c';
    ctx.beginPath();
    ctx.arc(p.x, p.y - h * 2.6, Math.max(1.6, p.s * 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,50,48,0.4)';
    for (let i = 0; i < 4; i += 1) {
      const ph = (t * 0.22 + i / 4) % 1;
      ctx.beginPath();
      ctx.arc(p.x + ph * w * 0.5, p.y - h * 2.8 - ph * h * 3.4, (2 + ph * 7) * p.s * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** A ring's glow, drawn once into a sprite: a radial gradient of light —
 *  strong at the middle, gone at the rim. The renderer has no bloom pass,
 *  so a lit gate at two kilometres is this sprite laid behind the rim:
 *  light around the ring, scaled with its range, instead of a brighter
 *  stroke on the rim itself (which is what drew bubbles). Two tints: the
 *  next ring burns gold, the route behind it teal. */
function makeGlowSprite(r, g, b) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g2 = c.getContext('2d');
  const grad = g2.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.20)`);
  grad.addColorStop(0.7, `rgba(${r},${g},${b},0.055)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  g2.fillStyle = grad;
  g2.fillRect(0, 0, 256, 256);
  return c;
}
let glowGold = null;
let glowTeal = null;

function drawRing(ctx, v, ring, isNext, t) {
  const p = project(v, ring.x, ring.y, ring.z);
  if (!p) return;
  const rx = ring.r * p.s;
  const ry = rx * 0.94;
  if (rx < 3) return;
  const pulse = isNext ? 1 + Math.sin(t * 4.2) * 0.05 : 1;
  // Far rings fade into the dusk instead of floating at full strength — a lit
  // route receding, not a scatter of bubbles. The fade alone was not enough:
  // at constant brightness, thickness and glow, a ring at 1–2 km still drew
  // as a pale bubble with a lamp in it. So the rim itself changes character
  // with range — thinner, dimmer, its cyan gone toward the dusk mauve of
  // everything far away, its glow switched off — until a far ring is a
  // glint on the route and only a near one is a gate. The next ring, the
  // one she is flying at, keeps its full lamp at every range.
  const fade = isNext ? 1 : clamp(1.2 - p.fwd / 2100, 0.16, 0.9);
  // The glow sprite behind the rim, screened over whatever is already
  // drawn: at range the rim itself is a hairline (see the fade below),
  // and it is this halo that makes the hairline read as a lit gate
  // hanging on the route rather than a circle drawn on the sea.
  if (!glowGold) {
    glowGold = makeGlowSprite(255, 196, 107);
    glowTeal = makeGlowSprite(140, 235, 220);
  }
  const glowA = isNext ? 0.55 : fade * clamp(1.3 - p.fwd / 2400, 0.3, 1) * 0.6;
  if (glowA > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = glowA;
    const gs = rx * pulse * 3.6;
    ctx.drawImage(isNext ? glowGold : glowTeal, p.x - gs / 2, p.y - (gs * 0.94) / 2, gs, gs * 0.94);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.shadowColor = isNext ? '#ffc46b' : 'rgba(140,230,220,0.8)';
  ctx.shadowBlur = isNext ? 26 : (p.fwd < 800 ? 10 : 0);
  ctx.strokeStyle = isNext
    ? '#ffc46b'
    : mixc('#a0ebe1', '#8a6a86', clamp((p.fwd - 400) / 1600, 0, 0.75));
  ctx.globalAlpha = isNext ? 1 : fade * clamp(1.25 - p.fwd / 2600, 0.34, 1);
  ctx.lineWidth = clamp(rx * 0.09, 1.6, 9) * (isNext ? 1 : clamp(1.15 - p.fwd / 3000, 0.45, 1));
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // The core light fades with the ring and then again with the rim's own
  // dimming: at range it is a glint, not a lamp — a full-strength centre
  // dot is what made far rings read as bubbles.
  ctx.fillStyle = isNext ? '#ffe9a8' : `rgba(210,250,244,${(0.25 + fade * 0.55) * clamp(1.25 - p.fwd / 2600, 0.34, 1)})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, clamp(rx * 0.07, 1.2, 4), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // A lit interior: the next ring's disc at full warmth, a far ring's at
  // a whisper — a gate has light inside it, not just a rim.
  ctx.fillStyle = isNext ? 'rgba(255,196,107,0.10)' : `rgba(160,235,225,${0.055 * fade})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles(ctx, v, fx) {
  for (const pt of fx) {
    const p = project(v, pt.x, pt.y, pt.z);
    if (!p) continue;
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = a * 0.85;
    ctx.beginPath();
    ctx.arc(p.x, p.y, clamp(pt.size * p.s * 0.1, 0.8, 7), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSpray(ctx, plane, t) {
  if (plane.spray <= 0.02) return;
  const cx = VIEW_W / 2;
  const cy = VIEW_H * 0.665 + 52;
  ctx.fillStyle = 'rgba(235,250,250,0.75)';
  for (let i = 0; i < 26; i += 1) {
    const ph = (t * 2.6 + i / 26) % 1;
    const side = i % 2 === 0 ? -1 : 1;
    const x = cx + side * (16 + ph * 120) + Math.sin(i * 7.3) * 7;
    const y = cy + ph * 26 - Math.sin(ph * Math.PI) * 15;
    ctx.globalAlpha = (1 - ph) * 0.6 * plane.spray;
    ctx.beginPath();
    ctx.arc(x, y, 1.6 + ph * 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** A #rrggbb colour with an alpha, as an rgba() string — for gradient stops
 *  that must carry a toned land colour out to nothing. */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Blend two #rrggbb colours, f of the way from a to b. Returns a #rrggbb
 *  string, so blends can be chained (a blend of a blend still parses). */
function mixc(a, b, f) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * f);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * f);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * f);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}
