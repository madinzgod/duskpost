// The seaplane herself, drawn from behind in chase view: a high-wing twin-float mail plane
// in cream and teal with a burnt-orange cheatline, DUSKPOST lettered along the wing. She
// banks with the stick, her prop is a spinning blur disc, her floats throw spray on the
// water, and when the hull is hurt she trails smoke. Drawn, not imaged: every line is
// canvas, every flight.

export function drawSeaplane(ctx, sx, sy, scale, plane, t) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(plane.bank * 0.85);
  ctx.scale(scale, scale);

  const W = 124; // wingspan in drawing units
  const bob = plane.airborne ? Math.sin(t * 2.1) * 1.6 : 0;
  ctx.translate(0, bob);

  // Wing: one long high wing across the top, slight dihedral, panel seams and
  // aileron lines so it reads as built, nav lights at the tips, and the airline's
  // name lettered along the underside where a chase camera reads it.
  ctx.beginPath();
  ctx.moveTo(-W / 2, -32);
  ctx.quadraticCurveTo(0, -39.5, W / 2, -32);
  ctx.lineTo(W / 2 - 6, -25);
  ctx.quadraticCurveTo(0, -31.5, -W / 2 + 6, -25);
  ctx.closePath();
  ctx.fillStyle = '#f3ead8';
  ctx.fill();
  ctx.strokeStyle = 'rgba(45,74,82,0.20)';
  ctx.lineWidth = 1;
  for (const seam of [-0.62, -0.3, 0.3, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(seam * W, -34.5 + Math.abs(seam) * 4);
    ctx.lineTo(seam * W * 0.96, -27 + Math.abs(seam) * 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#c8552e';
  ctx.fillRect(-W / 2, -30.5, 9, 4.5);
  ctx.fillRect(W / 2 - 9, -30.5, 9, 4.5);
  ctx.fillStyle = 'rgba(45,74,82,0.88)';
  ctx.font = '700 7px system-ui, sans-serif';
  ctx.textAlign = 'center';
  // V13: the name was one centred string, and the engine nacelle
  // (drawn next, at (0,−28)) covered its middle letters, so every
  // frame read "DU…ST" (V13 audit problem 1). The name now sits as
  // two halves, each centred on its own wing half — and far enough
  // outboard (±38) that the inner letters clear the prop disc's
  // ±19 wash as well as the nacelle: the first attempt at ±31 left
  // the K and P washed out by the disc's rim, still reading "DU…ST"
  // in the render.
  ctx.fillText('D U S K', -38, -29.8);
  ctx.fillText('P O S T', 38, -29.8);
  blinkLight(ctx, -W / 2 + 2, -28, '#ff4b3e', t, 0);
  blinkLight(ctx, W / 2 - 2, -28, '#3eff7a', t, 0);

  // Wing struts down to the fuselage shoulders.
  ctx.strokeStyle = 'rgba(34,51,58,0.75)';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 27, -27.5);
    ctx.lineTo(side * 10.5, 0);
    ctx.stroke();
  }

  // Engine nacelle and the prop: a true circular blur disc with two blade ghosts
  // sweeping through it — a spinning propeller seen from behind the wing.
  ctx.fillStyle = '#2d4a52';
  ctx.beginPath();
  ctx.ellipse(0, -28, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const disc = ctx.createRadialGradient(0, -28, 2, 0, -28, 19);
  disc.addColorStop(0, 'rgba(255,233,201,0.05)');
  disc.addColorStop(0.75, 'rgba(255,233,201,0.16)');
  disc.addColorStop(0.95, 'rgba(255,233,201,0.30)');
  disc.addColorStop(1, 'rgba(255,233,201,0)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, -28, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(0, -28);
  ctx.rotate(plane.propPhase);
  ctx.fillStyle = 'rgba(40,30,20,0.20)';
  ctx.beginPath();
  ctx.ellipse(0, -9.5, 2.6, 9.5, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 9.5, 2.6, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e8e2d4';
  ctx.beginPath();
  ctx.arc(0, -28, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Fuselage: a long tapered body seen from behind — broad shoulders under the
  // wing, a waist, and a keel that narrows to the step the floats hang from.
  // Cream over teal, the orange cheatline between, panel seams down the sides.
  const body = ctx.createLinearGradient(0, -40, 0, 34);
  body.addColorStop(0, '#f7efdd');
  body.addColorStop(0.5, '#e9dfc8');
  body.addColorStop(0.7, '#c8552e');
  body.addColorStop(0.75, '#3e7d86');
  body.addColorStop(1, '#274b54');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -41);
  ctx.quadraticCurveTo(13, -38, 15.5, -18);
  ctx.quadraticCurveTo(16.5, 0, 13.5, 14);
  ctx.quadraticCurveTo(11, 26, 6.5, 31);
  ctx.quadraticCurveTo(0, 34, -6.5, 31);
  ctx.quadraticCurveTo(-11, 26, -13.5, 14);
  ctx.quadraticCurveTo(-16.5, 0, -15.5, -18);
  ctx.quadraticCurveTo(-13, -38, 0, -41);
  ctx.fill();
  ctx.strokeStyle = 'rgba(45,74,82,0.13)';
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 8.5, -34);
    ctx.quadraticCurveTo(side * 11.5, -8, side * 9, 20);
    ctx.stroke();
  }
  // Exhaust stacks, low on the cheeks.
  ctx.fillStyle = '#22333a';
  for (const side of [-1, 1]) ctx.fillRect(side * 9 - 1.6, 17, 3.2, 6);

  // Cockpit glass catching the last of the sun.
  const glass = ctx.createLinearGradient(-8, -38, 8, -18);
  glass.addColorStop(0, '#ffd9a0');
  glass.addColorStop(0.5, '#7fb2bd');
  glass.addColorStop(1, '#33555f');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(0, -39.5);
  ctx.quadraticCurveTo(9.5, -37, 10, -24);
  ctx.quadraticCurveTo(0, -19.5, -10, -24);
  ctx.quadraticCurveTo(-9.5, -37, 0, -39.5);
  ctx.fill();

  // Tail fin in teal — taller now, with a cream tip and the anti-collision beacon —
  // and the stabilizers, tipped in orange like the wing.
  ctx.fillStyle = '#3e7d86';
  ctx.beginPath();
  ctx.moveTo(-4, -40);
  ctx.quadraticCurveTo(-2.5, -52, 0, -59);
  ctx.quadraticCurveTo(2.5, -52, 4.5, -40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f3ead8';
  ctx.beginPath();
  ctx.moveTo(-2.2, -52);
  ctx.quadraticCurveTo(-1.2, -56.5, 0, -59);
  ctx.quadraticCurveTo(1.4, -56.5, 2.4, -52);
  ctx.closePath();
  ctx.fill();
  blinkLight(ctx, 0, -57.5, '#ff4b3e', t, 0.35);
  ctx.fillStyle = '#e9dfc8';
  ctx.beginPath();
  ctx.moveTo(-33, 3);
  ctx.lineTo(33, 3);
  ctx.lineTo(28.5, 8.5);
  ctx.lineTo(-28.5, 8.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8552e';
  ctx.fillRect(-33, 3.8, 6, 4);
  ctx.fillRect(27, 3.8, 6, 4);

  // Struts, spreader bars and the twin floats she stands on — longer, wider-set,
  // with a planing step and a dark waterline each.
  ctx.strokeStyle = '#22333a';
  ctx.lineWidth = 2.4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 7, 22);
    ctx.lineTo(side * 19, 36);
    ctx.moveTo(side * 12, 16);
    ctx.lineTo(side * 19, 36);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-19, 38);
  ctx.lineTo(19, 38);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#c8552e';
    ctx.beginPath();
    ctx.moveTo(side * 19 - 16, 39);
    ctx.quadraticCurveTo(side * 19, 32.5, side * 19 + 16, 39);
    ctx.quadraticCurveTo(side * 19 + 9, 44.5, side * 19, 44.5);
    ctx.quadraticCurveTo(side * 19 - 9, 44.5, side * 19 - 16, 39);
    ctx.fill();
    ctx.fillStyle = 'rgba(34,51,58,0.55)';
    ctx.beginPath();
    ctx.ellipse(side * 19, 43.6, 12.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Damage smoke is drawn unrotated, above the airframe, so it reads as a trail.
  if (plane.hull < 72) {
    const puffs = plane.hull < 35 ? 7 : 4;
    for (let i = 0; i < puffs; i += 1) {
      const ph = (t * 0.9 + i / puffs) % 1;
      const px = sx + Math.sin(ph * 9 + i) * 8 * ph;
      const py = sy - 30 * scale - ph * 66 * scale;
      const r = (5 + ph * 17) * scale;
      ctx.fillStyle = `rgba(38,32,30,${0.34 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function blinkLight(ctx, x, y, color, t, phase) {
  const on = (t * 1.4 + phase) % 1 < 0.55;
  ctx.fillStyle = on ? color : 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(x, y, 2.4, 0, Math.PI * 2);
  ctx.fill();
}
