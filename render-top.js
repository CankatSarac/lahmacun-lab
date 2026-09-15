// Top-down view of the lahmacun.
//
// The solver's per-column arrays are indexed by radius: column 0 is the centre and column
// NX-1 is the outer rim. A round lahmacun seen from above is that same array swept through
// 360 degrees, so this view needs no extra simulation. It reads the identical browning,
// char and coverage the cross-section does, which is why the two can never disagree — and
// why the picture always matches the style named beside it.

import { NX, NZ, OFF_CHAR, OFF_BROWN } from './physics.js';
import { noise, cellColor } from './render.js';
import { charredColor } from './fields.js';

const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

let topBlobs = [], topKey = '';

function buildTopBlobs(p) {
  const key = [p.tarif, p.kaplama, p.cap, p.harc, p.kiymaYag].join(',');
  if (key === topKey) return;
  topKey = key;
  topBlobs = [];
  for (let k = 0; k < 260; k++) {
    topBlobs.push({
      ang: noise(k * 3.7) * Math.PI * 2,
      rf: Math.sqrt(noise(k * 3.7 + 1)),          // sqrt keeps the density uniform per area
      kind: noise(k * 3.7 + 2),
      size: 0.014 + Math.pow(noise(k * 3.7 + 3), 2.4) * 0.052,
      seed: k,
    });
  }
}

/** Wobbly outline. A hand-rolled lahmacun is not a circle, and drawing it as one reads as clip art. */
function lahmacunPath(ctx, cx, cy, R, squash, seed) {
  const N = 84;
  ctx.beginPath();
  for (let k = 0; k <= N; k++) {
    const ang = (k / N) * Math.PI * 2;
    const j = k % N;
    const wob = 1 + (noise(seed + j * 0.73) - 0.5) * 0.055 + Math.sin(ang * 3 + seed) * 0.013;
    const px = cx + Math.cos(ang) * R * wob;
    const py = cy + Math.sin(ang) * R * wob * squash;
    k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Draw the lahmacun from above, coloured by the current frame.
 * @param {HTMLCanvasElement} canvas
 * @param {Float32Array} a current frame
 * @param {object} p recipe parameters
 */
export function drawTop(canvas, a, p) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const SQUASH = 0.50;                       // seen from a shallow angle, not straight down
  const seed = (p.tarif ?? 0) * 7.3 + 1.7;
  // Bigger lahmacuns read as bigger: 18 cm fills less of the card than 40 cm.
  const fill = 0.74 + 0.15 * clamp01(((p.cap ?? 30) - 18) / 22);
  // The wobble adds up to 5.5%, so leave headroom or the rim clips against the card.
  const R = Math.min((w * 0.5) * fill, (h * 0.44) / SQUASH * fill) / 1.06;
  const cx = w / 2, cy = h * 0.44;
  const cov = clamp01((p.kaplama ?? 92) / 100);
  const bare = !(p.harc > 0 && p.kaplama > 0);

  const idx = (f) => Math.max(0, Math.min(NX - 1, Math.round(clamp01(f) * (NX - 1))));
  const surfaceAt = (f) => cellColor(a, idx(f), NZ - 1, 'kesit', p);

  // --- shadow ---
  ctx.save();
  ctx.filter = 'blur(7px)';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  lahmacunPath(ctx, cx, cy + h * 0.055, R * 1.01, SQUASH, seed);
  ctx.fill();
  ctx.restore();

  // --- body, coloured straight from the physics along the radius ---
  ctx.save();
  lahmacunPath(ctx, cx, cy, R, SQUASH, seed);
  ctx.clip();
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  const stops = [0, 0.18, 0.36, 0.52, 0.66, 0.78];
  if (!bare) { stops.push(Math.max(0, cov - 0.012), Math.min(1, cov + 0.012)); }
  stops.push(0.88, 0.95, 1);
  for (const f of [...new Set(stops)].sort((x, y) => x - y)) {
    grad.addColorStop(clamp01(f), rgb(surfaceAt(f)));
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, SQUASH);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = grad;
  ctx.fillRect(cx - R * 1.1, cy - R * 1.1, R * 2.2, R * 2.2);
  ctx.restore();

  // --- surface detail: char spots, blisters and veg flecks, placed by the physics ---
  buildTopBlobs(p);
  for (const b of topBlobs) {
    const i = idx(b.rf);
    const ch = a[OFF_CHAR + (NZ - 1) * NX + i];
    const br = a[OFF_BROWN + i];
    const covered = !bare && b.rf <= cov;
    const px = cx + Math.cos(b.ang) * R * b.rf;
    const py = cy + Math.sin(b.ang) * R * b.rf * SQUASH;
    const rx = b.size * R;
    const ry = rx * (0.55 + noise(b.seed * 9.1) * 0.5) * SQUASH * 1.7;

    let fillStyle = null;
    if (covered && b.kind < 0.30) {
      const t = noise(b.seed * 4.4);
      const base = t > 0.62 ? [88, 112, 60] : t > 0.30 ? [186, 160, 124] : [132, 50, 37];
      // A speck of parsley on a blackened lahmacun is also blackened. Without this the
      // flecks stay bright over a burnt surface and the whole thing reads as a decal.
      const c = charredColor(base, ch, noise(b.seed * 2.2)).map((v) => v | 0);
      fillStyle = `rgba(${c.join(',')},${0.30 + br * 0.22})`;      // maydanoz / soğan / biber
    } else {
      const dark = clamp01(br * 0.34 + ch * 1.05);
      if (dark < 0.05) continue;
      fillStyle = `rgba(28,18,13,${Math.min(0.72, dark * 0.62)})`; // kızarma lekesi / kömür
    }
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(noise(b.seed * 17.3) * Math.PI);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.restore();
  }

  // --- the bare rim catches the light and sits slightly proud of the topping ---
  if (!bare && cov < 0.995) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, SQUASH);
    ctx.translate(-cx, -cy);
    ctx.beginPath();
    ctx.arc(cx, cy, R * cov, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(38,20,13,0.42)';
    ctx.lineWidth = Math.max(1, R * 0.018);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // --- outline and top light ---
  lahmacunPath(ctx, cx, cy, R, SQUASH, seed);
  ctx.strokeStyle = 'rgba(24,14,10,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.save();
  lahmacunPath(ctx, cx, cy, R, SQUASH, seed);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, cy - R * SQUASH, 0, cy + R * SQUASH);
  sheen.addColorStop(0, 'rgba(255,238,206,0.13)');
  sheen.addColorStop(0.45, 'rgba(255,238,206,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.20)');
  ctx.fillStyle = sheen;
  ctx.fillRect(cx - R * 1.1, cy - R, R * 2.2, R * 2);
  ctx.restore();
}
