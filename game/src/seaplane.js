// The seaplane herself, drawn from behind in chase view: a high-wing twin-float mail plane
// in cream and teal with a burnt-orange cheatline, DUSKPOST on the tail. She banks with the
// stick, her prop is a spinning blur disc, her floats throw spray on the water, and when the
// hull is hurt she trails smoke. Drawn, not imaged: every line is canvas, every flight.

export function drawSeaplane(ctx, sx, sy, scale, plane, t) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(plane.bank * 0.85);
  ctx.scale(scale, scale);

  const W = 120; // wingspan in drawing units
  const bob = plane.airborne ? Math.sin(t * 2.1) * 1.6 : 0;
  ctx.translate(0, bob);

  // Wing: one long high wing across the top, slight dihedral, nav lights at the tips.
  ctx.beginPath();
  ctx.moveTo(-W / 2, -26);
  ctx.quadraticCurveTo(0, -33, W / 2, -26);
  ctx.lineTo(W / 2 - 6, -19);
  ctx.quadraticCurveTo(0, -25, -W / 2 + 6, -19);
  ctx.closePath();
  ctx.fillStyle = '#f3ead8';
  ctx.fill();
  ctx.fillStyle = '#c8552e';
  ctx.fillRect(-W / 2, -24.5, 9, 4.5);
  ctx.fillRect(W / 2 - 9, -24.5, 9, 4.5);
  blinkLight(ctx, -W / 2 + 2, -22, '#ff4b3e', t, 0);
  blinkLight(ctx, W / 2 - 2, -22, '#3eff7a', t, 0);

  // Engine nacelle and the prop: a translucent blur disc with two blade ghosts.
  ctx.fillStyle = '#2d4a52';
  ctx.beginPath();
  ctx.ellipse(0, -22, 10, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#ffe9c9';
  ctx.beginPath();
  ctx.ellipse(0, -22, 4.5, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(0, -22);
  ctx.rotate(plane.propPhase);
  ctx.fillStyle = 'rgba(40,30,20,0.55)';
  ctx.fillRect(-1.6, -20, 3.2, 40);
  ctx.restore();

  // Fuselage: a rounded teardrop seen from behind, cream over teal, orange cheatline.
  const body = ctx.createLinearGradient(0, -30, 0, 26);
  body.addColorStop(0, '#f7efdd');
  body.addColorStop(0.55, '#e9dfc8');
  body.addColorStop(0.78, '#c8552e');
  body.addColorStop(0.82, '#3e7d86');
  body.addColorStop(1, '#2d4a52');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.quadraticCurveTo(17, -30, 18, -8);
  ctx.quadraticCurveTo(18.5, 14, 11, 24);
  ctx.quadraticCurveTo(0, 29, -11, 24);
  ctx.quadraticCurveTo(-18.5, 14, -18, -8);
  ctx.quadraticCurveTo(-17, -30, 0, -34);
  ctx.fill();

  // Cockpit glass catching the last of the sun.
  const glass = ctx.createLinearGradient(-8, -32, 8, -14);
  glass.addColorStop(0, '#ffd9a0');
  glass.addColorStop(0.5, '#7fb2bd');
  glass.addColorStop(1, '#33555f');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(0, -33);
  ctx.quadraticCurveTo(10, -31, 10.5, -20);
  ctx.quadraticCurveTo(0, -15.5, -10.5, -20);
  ctx.quadraticCurveTo(-10, -31, 0, -33);
  ctx.fill();

  // Tail fin in teal, and the stabilizers. The airline's name rides the wing
  // underside, where a chase camera (and a following pilot) would read it.
  ctx.fillStyle = '#3e7d86';
  ctx.beginPath();
  ctx.moveTo(-3.5, -34);
  ctx.lineTo(0, -52);
  ctx.lineTo(3.5, -34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(45,74,82,0.85)';
  ctx.font = '700 8.6px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('D U S K P O S T', 0, -13.5);
  ctx.fillStyle = '#e9dfc8';
  ctx.beginPath();
  ctx.moveTo(-30, 6);
  ctx.lineTo(30, 6);
  ctx.lineTo(26, 11);
  ctx.lineTo(-26, 11);
  ctx.closePath();
  ctx.fill();

  // Struts and the twin floats she stands on.
  ctx.strokeStyle = '#22333a';
  ctx.lineWidth = 2.4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 8, 16);
    ctx.lineTo(side * 15, 30);
    ctx.moveTo(side * 13, 12);
    ctx.lineTo(side * 15, 30);
    ctx.stroke();
    ctx.fillStyle = '#c8552e';
    ctx.beginPath();
    ctx.moveTo(side * 15 - 13, 33);
    ctx.quadraticCurveTo(side * 15, 27.5, side * 15 + 13, 33);
    ctx.quadraticCurveTo(side * 15, 37, side * 15 - 13, 33);
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
