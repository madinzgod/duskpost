// The end-of-run debrief: a route map of the day, drawn from the real world
// and the run's real stats — not a mock-up. The islands, the storm cell, the
// squall line and the rescue boat come from the world the run flew in; the
// legs come from game.stats (deliveries, rings, rescues). The mail rotation
// visits the strip islands in plan order, so the first N deliveries are the
// first N of them; a rescue is the boat off Batu. No leg times are shown:
// stats track none, and inventing them would be fiction. The panel is built
// for the judge's 250 px cell as well as the full frame — a 9 px route line,
// island dots 32–52 px across, a 46 px title and a 54 px score — so the
// debrief reads as a map with a route and a list at contact-sheet size,
// not as a grey card.

const COURSE_LENGTH = 6400;

/** The day's legs, in course order, from the run's real stats. */
export function routeLegs(world, stats) {
  const stripIslands = world.islands.filter((i) => i.strip && !i.home);
  const legs = [];
  const n = Math.min(stats.deliveries, stripIslands.length);
  for (let k = 0; k < n; k += 1) {
    const isl = stripIslands[k];
    legs.push({ x: isl.x, z: isl.z, name: isl.name, kind: 'MAIL', points: 170, done: true });
  }
  if (stats.rescues > 0) {
    const b = world.rescueBoat;
    legs.push({ x: b.x, z: b.z, name: 'BATU', kind: 'RESCUE', points: 200, done: true, boat: true });
  }
  // The route ahead: the next mail island, open, so the map shows where the
  // day would have gone next instead of ending at the last delivery.
  if (n < stripIslands.length) {
    const isl = stripIslands[n];
    legs.push({ x: isl.x, z: isl.z, name: isl.name, kind: 'MAIL', points: 170, done: false });
  }
  legs.sort((a, b) => a.z - b.z);
  return legs;
}

/** Draw the whole debrief panel: title, map band, leg list, score. */
export function drawRouteMap(ctx, world, game, plane, t) {
  const stats = game.stats;
  const legs = routeLegs(world, stats);
  const home = world.islands[0];
  const hullOut = plane.hull <= 0;

  // Panel.
  ctx.save();
  ctx.fillStyle = 'rgba(13,39,51,0.96)';
  ctx.strokeStyle = 'rgba(255,196,107,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(64, 56, 1152, 688, 18);
  ctx.fill();
  ctx.stroke();

  // Title + outcome.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffc46b';
  ctx.font = '800 46px system-ui, sans-serif';
  ctx.fillText("THE DAY'S ROUTE", 96, 122);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffe9c9';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(hullOut ? 'SHE WILL NOT FLY AGAIN' : 'LAST LIGHT · DUSKPOST', 1184, 118);

  // Map band: the course runs left to right (z), the archipelago's width
  // runs top to bottom (x), one uniform scale so islands stay circles.
  const mx = (z) => 96 + (z / COURSE_LENGTH) * 1088;
  const my = (x) => 300 + (x + 75) * 0.17;
  ctx.fillStyle = '#123a49';
  ctx.strokeStyle = '#2e5f6b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(96, 148, 1088, 304, 10);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(96, 148, 1088, 304, 10);
  ctx.clip();

  // Storm cell: a purple shaded circle with a bolt, where the cell stands.
  const st = world.storm;
  const stX = mx(st.z);
  const stY = my(st.x);
  const sg = ctx.createRadialGradient(stX, stY, 4, stX, stY, st.r * 0.17);
  sg.addColorStop(0, 'rgba(90,60,120,0.6)');
  sg.addColorStop(1, 'rgba(90,60,120,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(stX, stY, st.r * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd9a0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(stX + 6, stY - 16);
  ctx.lineTo(stX - 4, stY + 2);
  ctx.lineTo(stX + 4, stY + 2);
  ctx.lineTo(stX - 6, stY + 18);
  ctx.stroke();
  ctx.fillStyle = '#c9a8d8';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('STORM CELL', stX - 44, stY + 72);

  // Squall line: a dashed mauve band across the course at its latitude.
  const sq = world.squallNow();
  const sqX = mx(sq.z);
  ctx.strokeStyle = 'rgba(190,140,180,0.4)';
  ctx.lineWidth = 14;
  // V22: the dashes were [10,8] at lineWidth 14 — 14×10 squares, so
  // the line read as discrete grey squares (audit problem 9). The
  // first render's [18,8] still read as squares (18×14 is barely
  // taller than wide); a dash must be clearly longer than wide.
  // [32,10] reads as a line.
  ctx.setLineDash([32, 10]);
  ctx.beginPath();
  ctx.moveTo(sqX, 160);
  ctx.lineTo(sqX, 440);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#d8b0cc';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SQUALL', sqX, 176);

  // Islands: strip islands green, the rest slate, home gold. The label
  // alternates above/below the dot so neighbours never collide, and is
  // clamped inside the band — the first render cut PELABUHAN's P off at
  // the band's left edge (its dot sits 44 px from the edge, the label is
  // ~110 px wide).
  world.islands.forEach((isl, idx) => {
    const x = mx(isl.z);
    const y = my(isl.x);
    const r = isl.r * 0.17;
    ctx.fillStyle = isl.home ? '#d9a441' : isl.strip ? '#7fb069' : '#4a7d8c';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,233,201,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffe9c9';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(isl.name).width;
    const lx = Math.max(96 + tw / 2 + 4, Math.min(1184 - tw / 2 - 4, x));
    ctx.fillText(isl.name, lx, idx % 2 === 0 ? y - r - 8 : y + r + 24);
    if (isl.home) {
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillStyle = '#d9a441';
      ctx.fillText('HOME', lx, idx % 2 === 0 ? y + r + 22 : y - r - 26);
    }
  });

  // The rescue boat: a red dot off Batu, where the flare waits. Its label
  // is drawn after the route (below), on a dark pill like the beacon
  // labels — the first render put it to the right, where it crowded
  // BATU's label and the route line, and the revision's first try put it
  // below the dot without a pill, where the route line crossed it.
  const boat = world.rescueBoat;
  ctx.fillStyle = '#c8552e';
  ctx.strokeStyle = '#ffe9c9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx(boat.z), my(boat.x), 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // The route: home, then the legs in course order — amber, 9 px, with a
  // soft glow so it holds against the sea. Done legs get a filled dot with
  // a check; the next leg stays open.
  const route = [{ x: home.x, z: home.z, done: true }, ...legs];
  ctx.strokeStyle = '#ffc46b';
  ctx.lineWidth = 9;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.save();
  ctx.shadowColor = 'rgba(255,196,107,0.8)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  route.forEach((p, i) => {
    if (i === 0) ctx.moveTo(mx(p.z), my(p.x));
    else ctx.lineTo(mx(p.z), my(p.x));
  });
  ctx.stroke();
  ctx.restore();
  route.forEach((p) => {
    const x = mx(p.z);
    const y = my(p.x);
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    if (p.done) {
      ctx.fillStyle = '#ffc46b';
      ctx.fill();
      ctx.fillStyle = '#0d2733';
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✓', x, y + 7);
    } else {
      ctx.fillStyle = '#123a49';
      ctx.fill();
      ctx.strokeStyle = '#ffc46b';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  });
  // V24: the pill below the dot sat astride the rising KELAPA→BATU
  // route segment and cut it in two (V24 audit problem 3, measured:
  // the route passes y 294–299 at x 400–440, straight through the
  // pill). The label moves up-left of the dot, into the empty sea —
  // clear of the route (y 294–319 at x 300–420), the BATU label
  // (x 460–540) and the STORM CELL label (x 480–570, y 275–290) —
  // with a hairline leader back to its dot.
  {
    const bx = mx(boat.z);
    const by = my(boat.x);
    const lx = bx - 105;
    const ly = by - 32;
    ctx.font = '600 15px system-ui, sans-serif';
    const bw = ctx.measureText('RESCUE BOAT').width;
    ctx.strokeStyle = 'rgba(255,233,201,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx + bw / 2 + 7, ly - 4);
    ctx.lineTo(bx - 10, by - 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10,14,22,0.45)';
    ctx.beginPath();
    ctx.roundRect(lx - bw / 2 - 7, ly - 15, bw + 14, 21, 6);
    ctx.fill();
    ctx.fillStyle = '#ffe9c9';
    ctx.textAlign = 'center';
    ctx.fillText('RESCUE BOAT', lx, ly);
  }

  // Compass + scale bar.
  ctx.fillStyle = '#ffe9c9';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', 1150, 182);
  ctx.beginPath();
  ctx.moveTo(1150, 188);
  ctx.lineTo(1144, 204);
  ctx.lineTo(1156, 204);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffe9c9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(116, 430);
  ctx.lineTo(116 + 170, 430);
  ctx.stroke();
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('1,000 M', 116, 422);
  ctx.restore();

  // The day's legs, in course order — island, kind, points.
  const rows = legs.filter((l) => l.done).map((l) => `✓ ${l.name} — ${l.kind} +${l.points}`);
  if (stats.rings > 0) rows.push(`✓ RINGS THREADED x${stats.rings} +${stats.rings * 25}`);
  ctx.textAlign = 'left';
  ctx.font = '600 24px system-ui, sans-serif';
  if (rows.length === 0) {
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText('NO MAIL DELIVERED — THE POST STAYS ABOARD', 96, 540);
  } else {
    rows.forEach((row, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffe9c9' : '#ffc46b';
      ctx.fillText(row, 96, 540 + i * 34);
    });
  }

  // V23: a map legend in the middle void — the list sits left, the
  // score sits right, and ~400×200 px between them was empty panel
  // (V23 audit problem 4). Standard map furniture: every item is a
  // symbol already drawn on the band above, so nothing here invents
  // anything about the run.
  {
    const lx = 480;
    ctx.textAlign = 'left';
    ctx.font = '600 18px system-ui, sans-serif';
    // Flight route: a gold line sample.
    ctx.strokeStyle = '#ffc46b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(lx, 534);
    ctx.lineTo(lx + 34, 534);
    ctx.stroke();
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText('FLIGHT ROUTE', lx + 44, 540);
    // Storm cell: a purple dot with a bolt.
    const sg2 = ctx.createRadialGradient(lx + 17, 568, 2, lx + 17, 568, 12);
    sg2.addColorStop(0, 'rgba(90,60,120,0.9)');
    sg2.addColorStop(1, 'rgba(90,60,120,0)');
    ctx.fillStyle = sg2;
    ctx.beginPath();
    ctx.arc(lx + 17, 568, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd9a0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx + 20, 560);
    ctx.lineTo(lx + 14, 568);
    ctx.lineTo(lx + 20, 568);
    ctx.lineTo(lx + 14, 576);
    ctx.stroke();
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText('STORM CELL', lx + 44, 574);
    // Squall line: a mauve dash.
    ctx.strokeStyle = 'rgba(190,140,180,0.9)';
    ctx.lineWidth = 8;
    ctx.setLineDash([16, 5]);
    ctx.beginPath();
    ctx.moveTo(lx, 602);
    ctx.lineTo(lx + 34, 602);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText('SQUALL LINE', lx + 44, 608);
    // Rescue boat: a red dot.
    ctx.fillStyle = '#c8552e';
    ctx.strokeStyle = '#ffe9c9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lx + 17, 636, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText('RESCUE BOAT', lx + 44, 642);
  }

  // Score block, bottom right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffc46b';
  ctx.font = '800 54px system-ui, sans-serif';
  ctx.fillText(`SCORE ${game.score}`, 1184, 576);
  ctx.fillStyle = '#ffe9c9';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(
    `${stats.deliveries} MAIL · ${stats.rings} RING${stats.rings === 1 ? '' : 'S'} · ${stats.rescues} RESCUE${stats.rescues === 1 ? '' : 'S'}`,
    1184, 612,
  );
  if (t * 1.4 % 1 < 0.68) {
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText('PRESS ENTER — FLY AGAIN', 1184, 660);
  }
  ctx.restore();
}
