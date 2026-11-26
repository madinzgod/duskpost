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
  // Her shadow on the strip: the one state where she sits on a hard
  // surface in full view, and the delivery frame showed her pasted
  // onto the pavement — drawSeaplane draws no shadow in any state.
  // Airborne she needs none (a ground shadow projects below the frame
  // at altitude, proved in V2); on water the spray grounds her. On
  // the strip, a soft pool under the floats stands her on the ground.
  if (plane.onStrip) {
    ctx.save();
    ctx.translate(VIEW_W / 2 + v.shakeX, VIEW_H * 0.665 + 44 * scale);
    ctx.scale(1, 0.16);
    const pool = ctx.createRadialGradient(0, 0, 4, 0, 0, 105);
    pool.addColorStop(0, 'rgba(8,12,10,0.34)');
    pool.addColorStop(1, 'rgba(8,12,10,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(0, 0, 105, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
  // The sun's shoulder: a gradient out to nothing, not a second flat
  // disc — a flat r34 disc at alpha 0.35 over the r27 core left a hard
  // step whose rim read as a ring around the sun.
  const shoulder = ctx.createRadialGradient(sunX, sunY, 24, sunX, sunY, 52);
  shoulder.addColorStop(0, 'rgba(255,190,120,0.32)');
  shoulder.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = shoulder;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
  ctx.fill();

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

  // The storm cell's screen disc, for the clouds that fall inside it:
  // painting is by world z, so a nearer cloud can land inside the
  // cell's silhouette — and a cloud inside a storm's shadow has no lit
  // top to show. drawCloud tests its own centre against this disc and
  // draws belly-only there, instead of pasting a pink lens on the cell.
  let stormDisc = null;
  if (world.storm) {
    const c = project(v, world.storm.x, world.storm.top * 0.45, world.storm.z);
    if (c) stormDisc = { x: c.x, y: c.y, r: world.storm.r * c.s * 1.05 };
  }

  for (const item of items) {
    if (item.kind === 'cloud') drawCloud(ctx, v, item.o, stormDisc);
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
 *  the same hue at full and zero alpha. `squash` is the vertical flattening:
 *  0.72 for the storm's and squall's masses, flatter for a sky cloud's
 *  wide, low puffs. */
function softPuff(ctx, cx, cy, r, inner, outer, squash = 0.72) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, squash);
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
  grad.addColorStop(0, 'rgba(168,182,205,0.23)');
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
  // The blend runs further in V7 (cap 0.74 toward a lighter mauve)
  // and the bellies lay down less alpha: at the cover's range the bank
  // still composited into a dark row behind the hero ring — weather
  // second, smear first — and what was left to change was the colour
  // and weight of the puffs themselves at distance, not the staging.
  const haze = clamp(0.95 - s, 0, 0.74);
  const blend = (r, g, b, a) => `rgba(${Math.round(r + (150 - r) * haze)},${Math.round(g + (102 - g) * haze)},${Math.round(b + (116 - b) * haze)},${a})`;
  for (const [fx, fy, fr] of puffs) {
    softPuff(ctx, base.x + fx * halfW, baseY - bodySpan * fy, fr * halfW * 1.1, blend(38, 34, 56, 0.88), blend(38, 34, 56, 0));
  }
  for (const [fx, fy, fr] of puffs) {
    if (fy < 0.5) continue;
    softPuff(ctx, base.x + fx * halfW - halfW * 0.02, baseY - bodySpan * (fy + 0.05), fr * halfW * 0.66, blend(96, 84, 120, 0.56), blend(96, 84, 120, 0));
  }

  // Rain-light at the sea line: a soft pale band where the curtain
  // meets the water, so the bank hangs into the sea through its own
  // rain instead of ending on the horizon as a dark row — at cover
  // range the bank read as a smear first and weather second largely
  // because nothing connected its base to the water.
  ctx.save();
  ctx.translate(base.x, seaY);
  ctx.scale(1, 0.07);
  const band = ctx.createRadialGradient(0, 0, 4, 0, 0, halfW * 0.94);
  band.addColorStop(0, 'rgba(196,186,205,0.13)');
  band.addColorStop(0.7, 'rgba(196,186,205,0.06)');
  band.addColorStop(1, 'rgba(196,186,205,0)');
  ctx.fillStyle = band;
  ctx.beginPath();
  ctx.arc(0, 0, halfW * 0.94, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

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
  // The shaft's strength survives range: at the storm frame's own
  // distance the factor is 1 and the shaft is as tuned, but a cell two
  // kilometres off — the approach frame's — drew the same alphas
  // against a bright sea gradient and vanished, leaving the mass
  // hanging in the sky with no rain under it.
  const shaftBoost = clamp(1.6 - s * 0.35, 1, 1.9);
  // The shaft hugs the column's foot: at half-width 0.52R–0.62R its
  // slanted layer edges crossed most of the frame at close range and
  // read as diagonal light bands on the sea, not rain under the cell.
  // Narrower, with one more feather layer and finer streaks, it stays
  // under the cloud it falls from. The two widest layers are dimmer
  // again in V7: even narrowed, their straight slanted edges crossed
  // open sea in the storm frame and read as bands — at a third of the
  // core's alpha and pulled inboard, their edges sit under the lit
  // core instead of crossing bare water.
  for (const [shrink, a] of [[-0.10, 0.010], [-0.045, 0.018], [0, 0.045], [0.08, 0.06], [0.16, 0.075], [0.24, 0.09]]) {
    const layerA = a * shaftBoost;
    const grad = ctx.createLinearGradient(0, baseY, 0, seaY);
    grad.addColorStop(0, `rgba(168,182,205,${layerA + 0.10 * shaftBoost})`);
    grad.addColorStop(1, `rgba(168,182,205,${layerA * 0.4})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - R * (0.40 - shrink), baseY);
    ctx.lineTo(cx + R * (0.40 - shrink), baseY);
    ctx.lineTo(cx + R * (0.48 - shrink) + slant, seaY);
    ctx.lineTo(cx - R * (0.48 - shrink) + slant, seaY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = `rgba(190,200,220,${0.15 * shaftBoost})`;
  ctx.lineWidth = Math.max(1, s * 0.35);
  for (let i = 0; i < 15; i += 1) {
    const fx = -0.40 + i * 0.057;
    const drift = ((t * 0.7 + i * 0.37) % 1) * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + fx * R, baseY + (seaY - baseY) * drift * 0.2);
    ctx.lineTo(cx + fx * R + slant * (0.4 + drift), baseY + (seaY - baseY) * (0.55 + drift * 0.4));
    ctx.stroke();
  }

  // Far weather beyond the shoulder: three very large, soft puffs of
  // lighter violet-grey reaching west and up from the anvil, at an
  // alpha the sky keeps — the cell's weather continuing off-frame.
  // Without them the mass ended at its own silhouette and the storm
  // frame's top-left was bare gradient: the smoothest area of the
  // sheet, in the frame whose whole subject is weather. Drawn before
  // the body, so the column overlaps them and they read as distance.
  for (const [fx, fy, fr, a] of [[-1.18, 0.88, 0.52, 0.20], [-1.42, 1.0, 0.62, 0.16], [-0.95, 1.04, 0.5, 0.15]]) {
    softPuff(ctx, cx + fx * R, baseY - (baseY - topY) * fy, fr * R, `rgba(104,80,110,${a})`, 'rgba(104,80,110,0)');
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
  // Shoulder texture: the main passes are a dozen huge soft gradients,
  // and where the anvil's shoulder thins they composite into one smooth
  // dome — the storm frame's upper half was a flat wash with the cell
  // hiding in its bottom corner. A hashed scatter of small puffs along
  // the upper mass, alternating the belly's dark violet with a lit
  // mauve, gives the dome a scalloped grain at any range; a short row
  // of lit puffs along the anvil's top edge is its rim, catching the
  // sun the way the cover clouds' tops do. Hashed from the cell's own
  // position, so the grain is the same every frame.
  const grain = (i, salt) => {
    const h = Math.sin(storm.x * 12.9898 + storm.z * 0.371 + i * 7.77 + salt * 3.1) * 43758.5453;
    return h - Math.floor(h);
  };
  for (let i = 0; i < 16; i += 1) {
    const fx = -1.1 + (i / 15) * 2.0 + (grain(i, 1) - 0.5) * 0.09;
    const fy = 0.80 + grain(i, 2) * 0.20;
    const fr = 0.10 + grain(i, 3) * 0.07;
    const lit = i % 3 === 2;
    softPuff(
      ctx,
      cx + fx * R,
      baseY - bodySpan * fy,
      fr * R,
      lit ? 'rgba(122,96,128,0.34)' : 'rgba(30,26,48,0.40)',
      lit ? 'rgba(122,96,128,0)' : 'rgba(30,26,48,0)',
    );
  }
  // A second grain at a larger scale over the shoulder's outer half:
  // the first pass's puffs are 0.10–0.17R and melt into the dome at
  // screenshot size, so the shoulder thinned to smoothness exactly
  // where it runs off-frame; these run 0.16–0.26R, coarse enough to
  // keep a scalloped structure out to the mass's western edge.
  for (let i = 0; i < 8; i += 1) {
    const fx = -1.15 + (i / 7) * 1.05 + (grain(i, 11) - 0.5) * 0.08;
    const fy = 0.74 + grain(i, 12) * 0.26;
    const fr = 0.16 + grain(i, 13) * 0.10;
    const lit = i % 3 === 1;
    softPuff(
      ctx,
      cx + fx * R,
      baseY - bodySpan * fy,
      fr * R,
      lit ? 'rgba(122,96,128,0.30)' : 'rgba(30,26,48,0.36)',
      lit ? 'rgba(122,96,128,0)' : 'rgba(30,26,48,0)',
    );
  }
  for (let i = 0; i < 6; i += 1) {
    const fx = -0.62 + i * 0.24 + (grain(i, 5) - 0.5) * 0.06;
    softPuff(
      ctx,
      cx + fx * R,
      baseY - bodySpan * (0.97 + grain(i, 6) * 0.03),
      (0.09 + grain(i, 7) * 0.04) * R,
      'rgba(255,150,90,0.16)',
      'rgba(255,150,90,0)',
    );
  }

  // Lightning: a few frames of fire inside the upper cloud, and a bolt
  // standing in the rain shaft from the cloud base to the sea. The period
  // is fixed, so a frozen screenshot either catches it lit or not — never
  // half-drawn.
  const cycle = t % 2.9;
  if (cycle < 0.14) {
    const flash = 1 - cycle / 0.14;
    // The flash lives inside the cloud: at R × 0.9 centred above the
    // frame's top edge it was a centreless lift over the whole upper
    // sky — half the storm frame's flat wash. At R × 0.5 centred in
    // the upper mass it reads as fire in the cell, and the sky keeps
    // its structure around it.
    const glowY = topY + bodySpan * 0.42;
    const glow = ctx.createRadialGradient(cx, glowY, 4, cx, glowY, R * 0.5);
    glow.addColorStop(0, `rgba(255,244,200,${0.55 * flash})`);
    glow.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - R * 0.55, glowY - R * 0.55, R * 1.1, R * 1.1);
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
    // A wide, faint pass under the core — the bolt's body. At the old
    // max(2.4, s × 0.8) the core was a 2–3 px hairline and read as a
    // crack scratched on the cell, with the shadowBlur doing all the
    // work; a strike is a channel of light, thick at its heart.
    ctx.strokeStyle = `rgba(255,240,190,${0.22 * flash})`;
    ctx.lineWidth = Math.max(6, s * 3.0);
    ctx.beginPath();
    ctx.moveTo(nodes[0][0], nodes[0][1]);
    for (let i = 1; i < nodes.length; i += 1) ctx.lineTo(nodes[i][0], nodes[i][1]);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,240,190,${0.9 * flash})`;
    ctx.lineWidth = Math.max(3.2, s * 1.15);
    ctx.beginPath();
    ctx.moveTo(nodes[0][0], nodes[0][1]);
    for (let i = 1; i < nodes.length; i += 1) ctx.lineTo(nodes[i][0], nodes[i][1]);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,240,190,${0.55 * flash})`;
    ctx.lineWidth = Math.max(2.2, s * 0.7);
    ctx.beginPath();
    ctx.moveTo(nodes[2][0], nodes[2][1]);
    ctx.lineTo(nodes[2][0] - R * 0.09, nodes[2][1] + (seaY - baseY) * 0.22);
    ctx.lineTo(nodes[2][0] - R * 0.05, nodes[2][1] + (seaY - baseY) * 0.44);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawCloud(ctx, v, c, stormDisc = null) {
  const p = project(v, c.x, c.y, c.z);
  if (!p) return;
  const w = c.s * p.s * 0.26;
  if (w < 26 || w > 900) return; // too small to hold a shape: a dash, not a cloud — skip it
  // A dusk cloud built like the storm is built: a cluster of soft
  // radial-gradient puffs (see softPuff), bellies in deep violet, tops
  // catching the last light. The old body was two passes of flat solid
  // ellipses — jittered, but every puff still ended on one clean oval
  // edge, so a bank resolved into nested oval contours and a small
  // cloud into a single lens with a stroked glowing top. Gradient puffs
  // have no edge anywhere, at any size: there is nothing left to read
  // as an outline. The lit top is light, not a line — a row of small
  // lit puffs along the upper edge, big clouds only.
  const big = w > 300;
  const spread = Math.min(0.62, 0.34 + Math.max(0, w - 150) / 550);
  const puffs = [[-0.52, 0.10, 0.52], [-0.26, -0.02, 0.68], [0.02, -0.10, 0.85], [0.32, -0.03, 0.66], [0.56, 0.10, 0.48], [0, 0.12, 0.9]];
  // Per-puff jitter hashed from the cloud's own position, so it is the
  // same every frame for a given cloud and different for every other.
  const jit = (i, salt) => {
    const h = Math.sin(c.x * 12.9898 + c.z * 0.371 + i * 7.77 + salt * 3.1) * 43758.5453;
    return h - Math.floor(h);
  };
  // Inside the storm cell's silhouette a cloud is in the cell's shadow:
  // it keeps its belly, darkened, and loses every light pass — a pink
  // top drawn there pasted a clean lens speck onto the weather.
  const shaded = stormDisc
    && Math.hypot(p.x - stormDisc.x, p.y - stormDisc.y) < stormDisc.r;
  const squash = 0.52;
  puffs.forEach(([ox, oy, r], i) => {
    const cxp = p.x + (ox + (jit(i, 1) - 0.5) * 0.09) * w;
    const cyp = p.y + (oy + (jit(i, 2) - 0.5) * 0.07) * w * spread;
    const rr = r * w * 0.62 * (0.86 + jit(i, 3) * 0.3);
    const a = shaded ? 0.34 : 0.5 + jit(i, 4) * 0.14;
    softPuff(ctx, cxp, cyp, rr, `rgba(74,44,86,${a})`, 'rgba(74,44,86,0)', squash);
  });
  if (shaded) return;
  puffs.forEach(([ox, oy, r], i) => {
    const cxp = p.x + (ox + (jit(i, 6) - 0.5) * 0.09) * w;
    const cyp = p.y + (oy - 0.10 + (jit(i, 7) - 0.5) * 0.06) * w * spread;
    const rr = r * w * 0.5 * (0.86 + jit(i, 8) * 0.3);
    softPuff(ctx, cxp, cyp, rr, `rgba(146,84,110,${0.30 + jit(i, 5) * 0.14})`, 'rgba(146,84,110,0)', squash);
  });
  if (big) {
    for (let i = 0; i < 5; i += 1) {
      const fx = -0.44 + i * 0.22 + (jit(i, 21) - 0.5) * 0.07;
      const rr = w * (0.10 + jit(i, 22) * 0.05);
      softPuff(
        ctx,
        p.x + fx * w,
        p.y - w * spread * 0.34 + (jit(i, 23) - 0.5) * w * 0.03,
        rr,
        `rgba(255,166,110,${0.10 + jit(i, 24) * 0.07})`,
        'rgba(255,166,110,0)',
        squash,
      );
    }
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
  // A waterline shadow first: three nested shades just outside the
  // beach — a gradient built from paths, each step too faint to show
  // its own edge. Without it the shore was a clean tan line on uniform
  // teal and the island read pasted onto the sea; with the water
  // darkened against the land, the island stands in it.
  for (const [sc, a] of [[1.36, 0.05], [1.30, 0.08], [1.245, 0.12]]) {
    islandPath(ctx, v, isl, sc, 0);
    ctx.fillStyle = `rgba(8,24,32,${a})`;
    ctx.fill();
  }
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
  // Nine patches now, and the last three form an outer ring: the first
  // six all ringed the island's centre at 0.3–0.62r, so the outer
  // slope — the ground an approach camera actually looks at, and the
  // whole of a mid-range island's silhouette — carried no texture at
  // all and the land read flat at every range. The outer ring stands
  // at its own slope height (the heightAt profile the palms use), so
  // a patch near the beach lies on the beach's slope, not at the
  // plateau's height projected over it.
  for (let i = 0; i < 9; i += 1) {
    const a = i * 2.13 + isl.z * 0.013;
    const outer = i >= 6;
    const rr = outer ? isl.r * (0.58 + 0.13 * (i - 6)) : isl.r * (0.3 + 0.16 * (i % 3));
    const d = rr / (isl.r * 1.0);
    const ph = outer
      ? isl.h * Math.min(1, Math.max(0, (1 - d / 1.25)) * 1.6)
      : isl.h * 0.55;
    const pp = project(v, isl.x + Math.cos(a) * rr, ph, isl.z + Math.sin(a) * rr * 0.8);
    if (!pp) continue;
    const rad = Math.max(6, pp.s * isl.r * 0.3);
    const toneHex = i % 2 === 0 ? toneLand('#5d8a5e', '#2c4a34') : toneLand('#2e5a44', '#142a20');
    const g = ctx.createRadialGradient(pp.x, pp.y, rad * 0.15, pp.x, pp.y, rad);
    g.addColorStop(0, hexA(toneHex, 0.58));
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
  if (isl.strip) drawDepot(ctx, v, isl, tone, toneLand);
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
    { dx: -isl.stripWid / 2 - 38, dz: -52, baseH: 0.62, roof: '#a03d24' },
    { dx: isl.stripWid / 2 + 26, dz: 52, baseH: 0.78, roof: '#7a4a2c' },
  ];
  spots.forEach((spot, i) => {
    // The huts stand on the island's shoulder, not its summit: at their
    // spots the ground (heightAt) is ≈ 0.6–0.9 of isl.h, and a hut planted
    // at the full height floats on the skyline in any ground-level
    // frame — the delivery shot's east hut hung on the horizon with
    // the sea behind it. The east hut also pulls inboard and further
    // along: at dx +48/dz +46 it projected half out of the delivery
    // frame's right edge, cropped by it.
    const base = project(v, isl.x + spot.dx, isl.h * spot.baseH, isl.z + spot.dz);
    if (!base || base.s < 0.35) return;
    const w = 7 * base.s;
    const h = 4.4 * base.s;
    // A contact shadow: a soft dark pool at the hut's feet. A building
    // whose base simply starts reads pasted; the shadow is what stands
    // it on the ground, above all in ground-level frames.
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.scale(1, 0.24);
    const pool = ctx.createRadialGradient(0, 0, 1, 0, 0, w * 0.78);
    pool.addColorStop(0, 'rgba(10,16,12,0.38)');
    pool.addColorStop(1, 'rgba(10,16,12,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

/** The mail depot: the freight corner every strip island keeps east of its
 *  strip — a stack of mail crates, a row of fuel drums and a hand cart,
 *  standing on a worn patch at strip level. The fiction is a mail run and
 *  the HUD weighs the cargo, but until now the only freight in the game
 *  was one crate stack at the west hut; the depot dresses the grass east
 *  of the strip — the emptiest patch in the cover frame — and gives the
 *  delivery somewhere to have come from. Toned with the island's own
 *  haze and light, like everything else on the ground. */
function drawDepot(ctx, v, isl, tone, toneLand) {
  const base = project(v, isl.x + isl.stripWid / 2 + 15, isl.h * 0.98, isl.z + 21);
  if (!base || base.s < 0.4) return;
  const s = base.s;
  // One metre in screen px at the depot, at 0.85 of the strip's own
  // scale: drawn at full scale the crates stood ~55 px in the delivery
  // frame and the cluster ran off its right edge, the frame's second
  // subject after the aircraft. A touch smaller and a step further
  // north, the whole freight corner sits inside the frame and the
  // aircraft keeps it. (dz 16 → 21 is the step north.)
  const u = s * 0.85;
  // The worn patch: bare earth where the freight work happens.
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.scale(1, 0.26);
  const patch = ctx.createRadialGradient(0, 0, 1, 0, 0, 8.6 * u);
  patch.addColorStop(0, hexA(toneLand('#8a6f4d', '#4a3a28'), 0.55));
  patch.addColorStop(1, hexA(toneLand('#8a6f4d', '#4a3a28'), 0));
  ctx.fillStyle = patch;
  ctx.beginPath();
  ctx.arc(0, 0, 8.6 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const crate = (cx, cy, m) => {
    const w = 2.6 * m * u;
    const h = 2.2 * m * u;
    ctx.fillStyle = tone('#a87f4e', '#5f4630');
    ctx.fillRect(cx - w / 2, cy - h, w, h);
    ctx.strokeStyle = 'rgba(60,40,22,0.55)';
    ctx.lineWidth = Math.max(0.8, u * 0.09);
    ctx.strokeRect(cx - w / 2, cy - h, w, h);
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy - h);
    ctx.lineTo(cx + w / 2, cy);
    ctx.moveTo(cx + w / 2, cy - h);
    ctx.lineTo(cx - w / 2, cy);
    ctx.stroke();
    // The mail stencil: a small pale band across the crate's face.
    ctx.fillStyle = 'rgba(243,234,216,0.75)';
    ctx.fillRect(cx - w * 0.3, cy - h * 0.62, w * 0.6, h * 0.2);
  };
  const drum = (cx, cy, hex) => {
    const w = 1.15 * u;
    const h = 2.5 * u;
    ctx.fillStyle = tone(hex, '#3c3630');
    ctx.fillRect(cx - w / 2, cy - h, w, h);
    ctx.fillStyle = 'rgba(20,16,12,0.35)';
    ctx.fillRect(cx - w / 2, cy - h * 0.68, w, h * 0.1);
    ctx.fillRect(cx - w / 2, cy - h * 0.3, w, h * 0.1);
    ctx.fillStyle = 'rgba(255,240,210,0.20)';
    ctx.fillRect(cx - w / 2, cy - h, w, h * 0.08);
  };

  // Drums at the back, crates in front of them, the cart to the side.
  drum(base.x - 3.4 * u, base.y, '#b34a35');
  drum(base.x - 2.1 * u, base.y, '#3e7d86');
  drum(base.x - 0.8 * u, base.y, '#d9a441');
  crate(base.x + 1.6 * u, base.y, 1);
  crate(base.x + 4.3 * u, base.y, 1);
  crate(base.x + 2.9 * u, base.y - 2.2 * u, 0.92);
  // The hand cart: a low bed on two wheels, handles trailing, one crate aboard.
  const cartX = base.x + 7.6 * u;
  const bedY = base.y - 1.05 * u;
  ctx.strokeStyle = '#4c3826';
  ctx.lineWidth = Math.max(1, u * 0.16);
  ctx.beginPath();
  ctx.moveTo(cartX - 2.6 * u, bedY);
  ctx.lineTo(cartX + 2.2 * u, bedY);
  ctx.moveTo(cartX + 2.2 * u, bedY);
  ctx.lineTo(cartX + 3.4 * u, base.y - 0.2 * u);
  ctx.stroke();
  ctx.fillStyle = '#2c2118';
  for (const wx of [-1.7, 1.5]) {
    ctx.beginPath();
    ctx.arc(cartX + wx * u, base.y - 0.55 * u, 0.55 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  crate(cartX - 0.2 * u, bedY, 0.85);
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
  const n = isl.outline.length;
  // When every outline point projects, the shore runs as quadratic
  // curves through the segments' midpoints, each outline point a
  // control: a coast, not a cut-card polygon. Joined with straight
  // lines, each of the 16 segments was 100–300 px of ruler-straight
  // beach at screenshot range. When any point sits behind the camera
  // the polyline below still draws what it can.
  const pts = [];
  let all = true;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const rr = isl.r * isl.outline[i] * scaleR;
    const p = project(v, isl.x + Math.cos(a) * rr, lift, isl.z + Math.sin(a) * rr);
    if (!p) {
      all = false;
      break;
    }
    pts.push(p);
  }
  ctx.beginPath();
  if (all && pts.length >= 4) {
    ctx.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
    for (let i = 0; i < n; i += 1) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
    }
  } else {
    let started = false;
    for (let i = 0; i <= n; i += 1) {
      const idx = i % n;
      const a = (idx / n) * Math.PI * 2;
      const rr = isl.r * isl.outline[idx] * scaleR;
      const p = project(v, isl.x + Math.cos(a) * rr, lift, isl.z + Math.sin(a) * rr);
      if (!p) continue;
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
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
  const tx = base.x + h * 0.3;
  const ty = base.y - h;
  // A crown body under the fronds when the palm is small: five hairline
  // arcs on a stick read as a spider at range — the horizon palms in
  // the delivery frame were bare sticks — so a distant crown keeps a
  // filled mass and lets the fronds silhouette against it.
  if (base.s < 2.5) {
    ctx.fillStyle = '#2c5a3c';
    ctx.beginPath();
    ctx.ellipse(tx, ty + h * 0.05, h * 0.42, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2f6b46';
  ctx.lineWidth = Math.max(1, base.s * 0.085);
  for (let i = 0; i < 7; i += 1) {
    const a = Math.PI * (0.05 + i * 0.155);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * h * 0.5, ty - Math.sin(a) * h * 0.34, tx + Math.cos(a) * h * 0.72, ty + h * 0.24);
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
