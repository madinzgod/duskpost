// Instruments and HUD: the lit panel a pilot actually flies by — a big ALT / SPD / HDG
// readout the screenshots can read at a glance, a compass ribbon, an attitude indicator
// that rolls and pitches with the plane, altimeter and airspeed dials, throttle, fuel and
// hull bars, the draining light meter, the mission card, and the final-approach guidance
// that appears when a strip is lined up. Amber backlight on deep navy, all canvas.

const AMBER = '#ffc46b';
const CREAM = '#ffe9c9';
const PANEL = 'rgba(12,20,30,0.82)';

export function drawInstruments(ctx, W, H, plane, game, world, t) {
  drawReadout(ctx, plane, world);
  drawCompass(ctx, W, plane);
  drawObjective(ctx, W, plane, game);
  drawScoreAndMission(ctx, W, plane, game);
  drawMeters(ctx, H, plane, game, t);
  drawPanel(ctx, W, H, plane);
  drawApproachGuidance(ctx, W, H, plane, world);
  // The storm speaks on the warning line: the cell's rough shoulder reaches
  // the plane before the cloud does, so the warning reads the same air the
  // physics flies — turbulence where she sits, from the world's own answer.
  const turb = world && world.stormAt ? world.stormAt(plane.x, plane.z).turb : 0;
  drawWarnings(ctx, W, H, plane, game, t, turb);
}

function drawReadout(ctx, plane, world) {
  ctx.save();
  // A translucent panel behind the block, so the cream figures hold against a
  // bright horizon band instead of washing into the sky.
  ctx.fillStyle = 'rgba(10,16,26,0.55)';
  roundRect(ctx, 14, 14, 302, 232, 10);
  ctx.fill();
  ctx.shadowColor = 'rgba(255,160,60,0.65)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = CREAM;
  ctx.font = '700 33px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  const alt = Math.max(0, Math.round(plane.y * 3.281));
  const spd = Math.round(plane.speed * 1.944);
  ctx.fillText(`ALT ${fmt(alt)} FT`, 26, 54);
  ctx.fillText(`SPD ${spd} KT`, 26, 95);
  ctx.fillText(`HDG ${headingText(plane.hdg)}`, 26, 136);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,233,201,0.8)';
  ctx.font = '600 17px ui-monospace, Menlo, monospace';
  const vs = Math.round(plane.vy * 196.85);
  ctx.fillText(`V/S ${vs >= 0 ? '+' : ''}${vs} FPM`, 26, 164);
  ctx.fillText(plane.airborne ? 'AIRBORNE' : plane.onStrip ? `ON STRIP — ${plane.onStrip.name}` : 'ON THE WATER', 26, 188);
  // The evening's wind, read at the plane's own stretch of the course: the
  // direction it blows FROM and its strength — the same air the physics flies.
  if (world && world.windAt) {
    const w = world.windAt(plane.z);
    const fromDeg = ((w.dir * 180 / Math.PI) + 180) % 360;
    ctx.fillText(`WIND ${String(Math.round(fromDeg)).padStart(3, '0')}° / ${Math.round(w.speed * 1.944)} KT`, 26, 212);
  }
  // The load: mail aboard is weight the wing knows about, not just a label.
  ctx.fillStyle = plane.cargoKg > 0 ? AMBER : 'rgba(255,233,201,0.55)';
  ctx.fillText(plane.cargoKg > 0 ? `CARGO ${plane.cargoKg} KG — MAIL` : 'CARGO — EMPTY', 26, 236);
  ctx.restore();
}

/** The persistent objective line: one always-on chip under the compass saying
 *  what the run is doing and how far it is — it never vanishes like a banner. */
function drawObjective(ctx, W, plane, game) {
  const m = game.mission;
  if (!m || game.screen !== 'play') return;
  const dist = Math.round(Math.hypot(m.targetX - plane.x, m.targetZ - plane.z));
  let text;
  if (m.kind === 'mail') text = `DELIVER MAIL → ${m.island ? m.island.name : ''} · ${dist} M`;
  else if (m.kind === 'rings') text = `THREAD THE RINGS — ${m.got || 0} OF ${m.need || 4} · NEXT ${dist} M`;
  else text = `RESCUE — SET DOWN BY THE FLARE · ${dist} M`;
  ctx.save();
  ctx.font = '700 16px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 34;
  const x = W / 2 - w / 2;
  ctx.fillStyle = PANEL;
  roundRect(ctx, x, 62, w, 32, 8);
  ctx.fill();
  ctx.fillStyle = AMBER;
  ctx.fillRect(x + 10, 71, 4, 14);
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 22, 84);
  ctx.restore();
}

function drawCompass(ctx, W, plane) {
  const cx = W / 2;
  ctx.fillStyle = PANEL;
  roundRect(ctx, cx - 190, 14, 380, 34, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 190, 14, 380, 34);
  ctx.clip();
  ctx.font = '700 16px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  const hdgDeg = ((plane.hdg * 180 / Math.PI) % 360 + 360) % 360;
  for (let d = -50; d <= 50; d += 5) {
    const deg = ((Math.round((hdgDeg + d) / 5) * 5) % 360 + 360) % 360;
    const x = cx + (degDiff(deg, hdgDeg)) * 3.1;
    if (deg % 30 === 0) {
      ctx.fillStyle = CREAM;
      const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg / 10).padStart(2, '0');
      ctx.fillText(label, x, 38);
    } else {
      ctx.fillStyle = 'rgba(255,233,201,0.5)';
      ctx.fillRect(x - 1, 30, 2, 8);
    }
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx - 7, 50);
  ctx.lineTo(cx + 7, 50);
  ctx.lineTo(cx, 58);
  ctx.closePath();
  ctx.fill();
}

function drawScoreAndMission(ctx, W, plane, game) {
  ctx.textAlign = 'right';
  ctx.fillStyle = CREAM;
  ctx.font = '700 31px ui-monospace, Menlo, monospace';
  ctx.save();
  ctx.shadowColor = 'rgba(255,160,60,0.65)';
  ctx.shadowBlur = 12;
  ctx.fillText(`SCORE ${String(game.score).padStart(5, '0')}`, W - 26, 52);
  ctx.restore();
  const m = game.mission;
  if (m) {
    const dist = Math.round(Math.hypot(m.targetX - plane.x, m.targetZ - plane.z));
    ctx.fillStyle = PANEL;
    roundRect(ctx, W - 402, 66, 376, 66, 9);
    ctx.fill();
    ctx.fillStyle = AMBER;
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(m.title, W - 42, 90);
    ctx.fillStyle = CREAM;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(`${m.detail} · ${dist} m`, W - 42, 114);
  }
}

function drawMeters(ctx, H, plane, game, t) {
  bar(ctx, 26, H - 118, 218, 17, plane.fuel / 100, plane.fuel < 25 && (t * 2 % 1 < 0.6) ? '#ff5f45' : AMBER, 'FUEL');
  bar(ctx, 26, H - 84, 218, 17, plane.hull / 100, plane.hull < 40 ? '#ff5f45' : '#7fd4c1', 'HULL');
  // The light meter: the sun itself, draining. When it empties, the run is done.
  const frac = clamp(game.lightFrac, 0, 1);
  bar(ctx, 26, H - 50, 218, 17, frac, '#ff9a5c', 'LIGHT');
  const secs = Math.max(0, Math.ceil(game.light));
  ctx.fillStyle = CREAM;
  ctx.font = '700 14px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`TO LAST LIGHT ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, 26, H - 12);
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(8,14,22,0.78)';
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();
  ctx.fillStyle = color;
  if (frac > 0.01) {
    roundRect(ctx, x + 2, y + 2, (w - 4) * clamp(frac, 0, 1), h - 4, 4);
    ctx.fill();
  }
  ctx.fillStyle = CREAM;
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 8, y - 5);
}

function drawPanel(ctx, W, H, plane) {
  const pw = 548;
  const ph = 148;
  const x = W / 2 - pw / 2;
  const y = H - ph - 14;
  ctx.fillStyle = PANEL;
  roundRect(ctx, x, y, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,196,107,0.4)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, pw, ph, 14);
  ctx.stroke();

  drawAttitude(ctx, x + 84, y + ph / 2, 56, plane);
  drawDial(ctx, x + 192, y + ph / 2, 45, plane.y * 3.281 / 2000, 'ALT ×1000 FT',
    `${(plane.y * 3.281 / 1000).toFixed(1)}`,
    [{ f: 0, s: '0' }, { f: 0.25, s: '.5' }, { f: 0.5, s: '1' }, { f: 0.75, s: '1.5' }, { f: 1, s: '2' }]);
  drawDial(ctx, x + 288, y + ph / 2, 45, plane.speed * 1.944 / 140, 'AIRSPEED KT',
    `${Math.round(plane.speed * 1.944)}`,
    [{ f: 0, s: '0' }, { f: 0.25, s: '35' }, { f: 0.5, s: '70' }, { f: 0.75, s: '105' }, { f: 1, s: '140' }]);
  drawVsiDial(ctx, x + 384, y + ph / 2, 45, plane);
  // Throttle quadrant.
  const tx = x + 462;
  ctx.fillStyle = 'rgba(255,233,201,0.75)';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THROTTLE', tx + 22, y + 26);
  ctx.fillStyle = 'rgba(255,233,201,0.2)';
  roundRect(ctx, tx + 14, y + 36, 16, 84, 7);
  ctx.fill();
  ctx.fillStyle = AMBER;
  const th = plane.throttle * 78;
  roundRect(ctx, tx + 14, y + 36 + 84 - th - 6, 16, th + 6, 7);
  ctx.fill();
  ctx.fillStyle = '#22333a';
  ctx.beginPath();
  ctx.arc(tx + 22, y + 36 + 84 - th, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.arc(tx + 22, y + 36 + 84 - th, 6.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawAttitude(ctx, cx, cy, r, plane) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.bank);
  const pitchPx = clamp(plane.vy * 2.6, -r * 0.55, r * 0.55);
  ctx.fillStyle = '#7fb2bd';
  ctx.fillRect(-r, -r + pitchPx, r * 2, r * 2);
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(-r, pitchPx, r * 2, r * 2);
  ctx.fillStyle = '#ffe9c9';
  ctx.fillRect(-r, pitchPx - 1.4, r * 2, 2.8);
  for (const off of [-18, 18]) {
    ctx.fillRect(-r * 0.45, pitchPx + off - 1, r * 0.9, 2);
  }
  ctx.restore();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 30, cy);
  ctx.lineTo(cx - 9, cy);
  ctx.lineTo(cx - 9, cy + 7);
  ctx.moveTo(cx + 30, cy);
  ctx.lineTo(cx + 9, cy);
  ctx.lineTo(cx + 9, cy + 7);
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDial(ctx, cx, cy, r, frac, label, value, ticks) {
  ctx.fillStyle = 'rgba(6,12,20,0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,196,107,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Minor ticks, then the numerals a pilot reads the needle against.
  ctx.fillStyle = 'rgba(255,233,201,0.8)';
  for (let i = 0; i <= 10; i += 1) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5), 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = '700 10.5px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  for (const tick of ticks) {
    const a = Math.PI * 0.75 + tick.f * Math.PI * 1.5;
    ctx.fillText(tick.s, cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14) + 3.5);
  }
  needle(ctx, cx, cy, Math.PI * 0.75 + clamp(frac, 0, 1) * Math.PI * 1.5, r);
  ctx.fillStyle = CREAM;
  ctx.font = '700 13px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(value, cx, cy + r * 0.42);
  ctx.fillStyle = 'rgba(255,233,201,0.6)';
  ctx.font = '600 9.5px system-ui, sans-serif';
  ctx.fillText(label, cx, cy + r + 13);
}

/** Vertical-speed dial: zero at the top, climb to the right, sink to the left,
 *  ±1,500 fpm at the stops — the dial an approach is flown by. */
function drawVsiDial(ctx, cx, cy, r, plane) {
  ctx.fillStyle = 'rgba(6,12,20,0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,196,107,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const fpm = plane.vy * 196.85;
  const frac = clamp(fpm / 1500, -1, 1);
  ctx.font = '700 10.5px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,233,201,0.8)';
  for (const tick of [{ f: -1, s: '-1.5' }, { f: 0, s: '0' }, { f: 1, s: '+1.5' }]) {
    const a = -Math.PI / 2 + tick.f * Math.PI * 0.75;
    ctx.fillText(tick.s, cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14) + 3.5);
  }
  needle(ctx, cx, cy, -Math.PI / 2 + frac * Math.PI * 0.75, r);
  ctx.fillStyle = CREAM;
  ctx.font = '700 13px ui-monospace, Menlo, monospace';
  ctx.fillText(`${fpm >= 0 ? '+' : ''}${Math.round(fpm / 100)}`, cx, cy + r * 0.42);
  ctx.fillStyle = 'rgba(255,233,201,0.6)';
  ctx.font = '600 9.5px system-ui, sans-serif';
  ctx.fillText('VERT SPEED ×100', cx, cy + r + 13);
}

/** A needle with a counterweight tail and a hub — drawn thick enough to read. */
function needle(ctx, cx, cy, a, r) {
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(a) * (r * 0.28), cy - Math.sin(a) * (r * 0.28));
  ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawApproachGuidance(ctx, W, H, plane, world) {
  if (!plane.airborne) return;
  const strip = nearestStripAhead(plane, world);
  if (!strip) return;
  const dz = strip.z - plane.z;
  const dx = strip.x - plane.x;
  // Glide-slope bars: centred when the descent and the line-up are both right.
  const idealVy = -(plane.y - strip.h) / Math.max(dz / Math.max(plane.speed, 1), 0.001);
  const slopeErr = clamp((plane.vy - idealVy) * 0.5, -1, 1);
  const lineErr = clamp(dx / 30, -1, 1);
  const gx = W / 2;
  const gy = H * 0.56;
  ctx.save();
  ctx.fillStyle = 'rgba(10,18,26,0.30)';
  roundRect(ctx, gx - 74, gy - 30, 148, 60, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,233,201,0.65)';
  ctx.lineWidth = 2;
  roundRect(ctx, gx - 74, gy - 30, 148, 60, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gx - 74, gy);
  ctx.lineTo(gx + 74, gy);
  ctx.moveTo(gx, gy - 30);
  ctx.lineTo(gx, gy + 30);
  ctx.stroke();
  ctx.fillStyle = '#3eff7a';
  ctx.beginPath();
  ctx.arc(gx - lineErr * 62, gy + slopeErr * 24, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText(`FINAL — ${strip.name} STRIP · ${Math.round(dz)} m`, gx, gy - 44);
  ctx.restore();
}

function nearestStripAhead(plane, world) {
  let best = null;
  let bestDz = Infinity;
  for (const isl of world.islands) {
    if (!isl.strip) continue;
    const dz = isl.z - plane.z;
    if (dz > 30 && dz < 850 && dz < bestDz && Math.abs(isl.x - plane.x) < 190 && plane.y < 85) {
      best = isl;
      bestDz = dz;
    }
  }
  return best;
}

function drawWarnings(ctx, W, H, plane, game, t, turb = 0) {
  const notes = [];
  // The storm first while she is in it or on its shoulder: it is the one
  // warning that changes the route, not just the flying.
  if (plane.airborne && turb > 0.55) notes.push('STORM CELL — ROUGH AIR, KEEP EAST');
  else if (plane.airborne && turb > 0.18) notes.push('STORM CELL AHEAD — KEEP EAST');
  if (plane.airborne && plane.speed < 24 && plane.y > 3) notes.push('STALL — NOSE DOWN, ADD POWER');
  if (plane.fuel < 18) notes.push('LOW FUEL — LAND AND REFUEL');
  if (plane.hull < 35) notes.push('HULL CRITICAL');
  if (game.light < 30) notes.push('LAST LIGHT — HEAD HOME');
  if (notes.length && t * 1.6 % 1 < 0.72) {
    ctx.fillStyle = '#ff5f45';
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(notes[0], W / 2, 196);
  }
  if (game.banner && t < game.banner.until) {
    ctx.save();
    ctx.globalAlpha = clamp((game.banner.until - t) * 1.6, 0, 1);
    ctx.fillStyle = 'rgba(12,20,30,0.85)';
    const w = ctx.measureText(game.banner.text).width;
    roundRect(ctx, W / 2 - 330, 218, 660, 58, 12);
    ctx.fill();
    ctx.fillStyle = AMBER;
    ctx.font = '700 25px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.banner.text, W / 2, 256);
    void w;
    ctx.restore();
  }
}

export function headingText(hdg) {
  const deg = ((hdg * 180 / Math.PI) % 360 + 360) % 360;
  return `${String(Math.round(deg)).padStart(3, '0')}°`;
}

function degDiff(a, b) {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function fmt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
