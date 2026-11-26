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

  // Distant cloud strata: two long flat banks riding the horizon, so the sky has
  // weather in depth and not just a gradient.
  ctx.fillStyle = 'rgba(70,40,80,0.35)';
  ctx.beginPath();
  ctx.ellipse(VIEW_W * 0.78, v.horizon - 64, 330, 13, 0, 0, Math.PI * 2);
  ctx.ellipse(VIEW_W * 0.86, v.horizon - 58, 210, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(88,48,88,0.28)';
  ctx.beginPath();
  ctx.ellipse(VIEW_W * 0.12, v.horizon - 96, 260, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,150,90,0.20)';
  ctx.beginPath();
  ctx.ellipse(VIEW_W * 0.78, v.horizon - 71, 300, 5, 0, 0, Math.PI * 2);
  ctx.fill();

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

  // Sun glitter: a bright broken path under the sun, plus seeded sparkle everywhere.
  ctx.fillStyle = 'rgba(255,190,110,0.5)';
  for (let i = 0; i < 46; i += 1) {
    const row = i / 46;
    const y = v.horizon + 6 + row * row * (VIEW_H - v.horizon) * 0.92;
    const wob = Math.sin(i * 12.9898) * 26 * row + Math.sin(plane.z * 0.05 + i) * 6;
    const w = 8 + row * 90 * (0.4 + 0.6 * Math.abs(Math.sin(i * 78.233)));
    ctx.globalAlpha = 0.12 + row * 0.4;
    ctx.fillRect(VIEW_W * 0.335 + wob - w / 2, y, w, 1.6 + row * 2.2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(220,245,245,0.35)';
  for (let i = 0; i < 70; i += 1) {
    const wz = plane.z + 40 + ((i * 613.7) % 1500);
    const wx = plane.x + ((i * 389.3) % 900) - 450;
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
  for (const isl of world.islands) items.push({ kind: 'island', o: isl, z: isl.z });
  for (const b of world.boats) items.push({ kind: 'boat', o: b, z: b.z });
  for (const r of world.rings) if (!r.passed) items.push({ kind: 'ring', o: r, z: r.z });
  items.sort((a, b) => b.z - a.z);
  const nextRing = world.rings.find((r) => !r.passed && r.z > plane.z - 20);

  for (const item of items) {
    if (item.kind === 'cloud') drawCloud(ctx, v, item.o);
    else if (item.kind === 'island') drawIsland(ctx, v, item.o, t, light, world);
    else if (item.kind === 'boat') drawBoat(ctx, v, item.o, t);
    else drawRing(ctx, v, item.o, item.o === nextRing, t);
  }
}

function drawCloud(ctx, v, c) {
  const p = project(v, c.x, c.y, c.z);
  if (!p) return;
  const w = c.s * p.s * 0.26;
  if (w < 26 || w > 900) return; // too small to hold a shape: a dash, not a cloud — skip it
  // A dusk cloud built like a cloud: a cluster of overlapping puffs, bellies in
  // deep violet, tops catching the last light, and a lit rim along the sun side.
  const puffs = [[-0.52, 0.10, 0.52], [-0.26, -0.02, 0.68], [0.02, -0.10, 0.85], [0.32, -0.03, 0.66], [0.56, 0.10, 0.48], [0, 0.12, 0.9]];
  ctx.fillStyle = 'rgba(74,44,86,0.62)';
  for (const [ox, oy, r] of puffs) {
    ctx.beginPath();
    ctx.ellipse(p.x + ox * w, p.y + oy * w * 0.34, r * w * 0.55, r * w * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(146,84,110,0.5)';
  for (const [ox, oy, r] of puffs) {
    ctx.beginPath();
    ctx.ellipse(p.x + ox * w, p.y + (oy - 0.045) * w * 0.34, r * w * 0.5, r * w * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,166,110,0.38)';
  ctx.beginPath();
  ctx.ellipse(p.x - w * 0.05, p.y - w * 0.045, w * 0.52, w * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawIsland(ctx, v, isl, t, light, world) {
  const centre = project(v, isl.x, 0, isl.z);
  if (!centre && project(v, isl.x, 0, isl.z + isl.r) === null) return;
  const fwd = centre ? centre.fwd : 2400;
  // Distance haze and the draining light both retint the land: far islands melt
  // toward the dusk mauve of the sky, and as the light meter empties the ground
  // darkens with the sky instead of glowing at noon under a night sky.
  const haze = clamp((fwd - 900) / 2600, 0, 0.45);
  const dark = (1 - clamp(light, 0, 1)) * 0.55;
  const tone = (hex, duskHex) => mixc(mixc(hex, '#8a5570', haze), duskHex, dark);
  // Foam line at the water's edge, then the beach, then the raised land inside it.
  islandPath(ctx, v, isl, 1.23, 0);
  ctx.fillStyle = 'rgba(230,246,244,0.28)';
  ctx.fill();
  islandPath(ctx, v, isl, 1.16, 0);
  ctx.fillStyle = tone('#d9a86c', '#6e5138');
  ctx.fill();
  islandPath(ctx, v, isl, 1.0, 0);
  const land = ctx.createLinearGradient(0, centre ? centre.y - isl.h * centre.s : 0, 0, centre ? centre.y : VIEW_H);
  land.addColorStop(0, tone('#4a7a5c', '#243a2c'));
  land.addColorStop(0.6, tone('#33604a', '#1a2f24'));
  land.addColorStop(1, tone('#274d3d', '#12211a'));
  ctx.fillStyle = land;
  ctx.fill();
  // A lit ridge so the island reads as ground with height, not a flat blob.
  islandPath(ctx, v, isl, 0.55, isl.h * 0.9);
  ctx.fillStyle = tone('#7aa86e', '#33503a');
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  // A tree-line of dark crowns along the ridge, so the top reads as wooded.
  if (centre && centre.s > 0.45) {
    ctx.fillStyle = tone('#2c5a3c', '#16281e');
    for (let i = 0; i < 11; i += 1) {
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
    { dx: -isl.stripWid / 2 - 30, dz: -34, roof: '#a03d24' },
    { dx: isl.stripWid / 2 + 32, dz: 44, roof: '#7a4a2c' },
  ];
  spots.forEach((spot, i) => {
    const base = project(v, isl.x + spot.dx, isl.h, isl.z + spot.dz);
    if (!base || base.s < 0.35) return;
    const w = 9.5 * base.s;
    const h = 5.8 * base.s;
    ctx.fillStyle = '#e6d9bd';
    ctx.fillRect(base.x - w / 2, base.y - h, w, h);
    // A shaded side wall, so the hut is a little building and not a billboard.
    ctx.fillStyle = 'rgba(90,70,50,0.45)';
    ctx.fillRect(base.x + w * 0.18, base.y - h, w * 0.32, h);
    ctx.fillStyle = spot.roof;
    ctx.beginPath();
    ctx.moveTo(base.x - w * 0.62, base.y - h);
    ctx.lineTo(base.x, base.y - h * 1.55);
    ctx.lineTo(base.x + w * 0.62, base.y - h);
    ctx.closePath();
    ctx.fill();
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
  // Centreline dashes and threshold bars.
  ctx.fillStyle = '#ffe9c9';
  for (let d = -hl + 10; d < hl - 6; d += 16) {
    const a = project(v, isl.x, y, isl.z + d);
    const b = project(v, isl.x, y, isl.z + d + 7);
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a.x - a.s * 0.03, a.y);
      ctx.lineTo(a.x + a.s * 0.03, a.y);
      ctx.lineTo(b.x + b.s * 0.03, b.y);
      ctx.lineTo(b.x - b.s * 0.03, b.y);
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
  ctx.globalAlpha = 0.16 + 0.1 * Math.sin(t * 2.2);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.moveTo(base.x, lampY);
  ctx.arc(base.x, lampY, H * 3.4, beamA, beamA + 0.32);
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
  if (!p || p.s < 0.2) return;
  const w = 15 * p.s;
  const h = 4.6 * p.s;
  // Wake.
  ctx.strokeStyle = 'rgba(230,248,248,0.4)';
  ctx.lineWidth = Math.max(1, p.s * 0.08);
  ctx.beginPath();
  ctx.moveTo(p.x - w * 0.5, p.y);
  ctx.lineTo(p.x - w * 1.5, p.y + h * 0.8 + Math.sin(t * 2 + b.z) * 1.4);
  ctx.moveTo(p.x + w * 0.5, p.y);
  ctx.lineTo(p.x + w * 1.3, p.y + h * 0.7);
  ctx.stroke();
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

function drawRing(ctx, v, ring, isNext, t) {
  const p = project(v, ring.x, ring.y, ring.z);
  if (!p) return;
  const rx = ring.r * p.s;
  const ry = rx * 0.94;
  if (rx < 3) return;
  const pulse = isNext ? 1 + Math.sin(t * 4.2) * 0.05 : 1;
  // Far rings fade into the dusk instead of floating at full strength — a lit
  // route receding, not a scatter of bubbles. Every ring carries a bright core
  // light at its centre, the lamp the hoop is hung from.
  const fade = isNext ? 1 : clamp(1.15 - p.fwd / 2400, 0.3, 0.9);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.shadowColor = isNext ? '#ffc46b' : 'rgba(140,230,220,0.8)';
  ctx.shadowBlur = isNext ? 26 : 10;
  ctx.strokeStyle = isNext ? '#ffc46b' : 'rgba(160,235,225,0.75)';
  ctx.lineWidth = clamp(rx * 0.09, 1.6, 9);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = isNext ? '#ffe9a8' : 'rgba(210,250,244,0.9)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, clamp(rx * 0.07, 1.2, 4), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (isNext) {
    ctx.fillStyle = 'rgba(255,196,107,0.10)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
  }
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
