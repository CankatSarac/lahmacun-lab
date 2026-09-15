// Cross-section renderer.
//
// The slice runs from the centre of the lahmacun (left) to its outer edge (right), drawn
// as a shallow 2.5D slab: a top surface, a cut face, and an outer side. The vertical scale
// is deliberately exaggerated, because an honest 2 mm-in-320 mm aspect ratio would be a
// line. The canvas says so, out loud.
//
// Pores are seeded decoration, not a prediction of where individual bubbles land. Same
// seed for the same recipe, so A/B comparisons differ only where the physics differs.

import { NX, NZ, OFF_T, OFF_W, OFF_S, OFF_G, OFF_CHAR, OFF_HEIGHT, OFF_DOUGH, OFF_BROWN } from './physics.js';
import { fieldColor, charredColor, modellenmemisRenk } from './fields.js';

/** Deterministic hash noise in [0,1). No Math.random anywhere in this file. */
export function noise(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Two-dimensional hash. A 1D hash of the flat index j*NX+i correlates strongly along rows
 * and shows up as vertical banding once the cells are only a few pixels wide.
 */
export function noise2(i, j) {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const HAM_CIG = [206, 193, 166];   // unset dough
const HAM_PISMIS = [237, 214, 159]; // set dough
const HAM_KIZARMIS = [146, 88, 38]; // browned crust
const HARC_CIG = [168, 72, 60];     // raw meat paste
const HARC_PISMIS = [104, 58, 42];  // cooked meat

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

let pores = [], poreKey = '';
let flecks = [], fleckKey = '';

/** Seeded parsley / onion / pepper specks scattered through the meat band. */
function buildFlecks(p, start, end) {
  const key = [p.harc, p.kaplama, p.kiymaYag, start, end].join(',');
  if (key === fleckKey) return;
  fleckKey = key;
  flecks = [];
  const n = Math.round(420 * clamp01(p.harc / 5));
  for (let k = 0; k < n; k++) {
    const r = start + noise(k * 13.1) * (end - start);
    const v = 0.06 + noise(k * 13.1 + 1) * 0.88;   // fraction of the topping band
    const t = noise(k * 13.1 + 2);
    flecks.push({
      r, v, seed: k,
      size: 0.11 + Math.pow(noise(k * 13.1 + 3), 1.8) * 0.34,
      col: t > 0.64 ? [88, 112, 62] : t > 0.32 ? [204, 180, 144] : [136, 52, 38],
    });
  }
}

/** Seeded, non-overlapping pores confined to the dough band of each column. */
function buildPores(p, start, end, doughAt) {
  const key = [p.hamur, p.mayalanma, p.hidrasyon, p.protein, p.harc, p.kaplama, start, end].join(',');
  if (key === poreKey) return;
  poreKey = key;
  pores = [];
  const target = Math.round(150 + 190 * clamp01(p.mayalanma / 24));
  const candidates = [];
  for (let n = 0; n < 1800; n++) {
    const r = start + noise(n * 7) * (end - start);
    const h = doughAt(r);
    if (h <= 0) continue;
    const v = 0.14 + noise(n * 7 + 1) * 0.72;             // fraction of dough height
    const size = (0.05 + Math.pow(noise(n * 7 + 2), 2.6) * 0.30) * (0.5 + p.mayalanma / 26);
    candidates.push({ r, v, size, seed: n });
  }
  candidates.sort((a, b) => b.size - a.size);
  for (const c of candidates) {
    if (pores.length >= target) break;
    let ok = true;
    for (const o of pores) {
      if (Math.abs(c.r - o.r) < (c.size + o.size) * 0.06 && Math.abs(c.v - o.v) < (c.size + o.size) * 0.6) { ok = false; break; }
    }
    if (ok) pores.push(c);
  }
}

export function cellColor(a, i, j, view, p) {
  const c = j * NX + i;
  const T = a[OFF_T + c], W = a[OFF_W + c], S = a[OFF_S + c], G = a[OFF_G + c];
  const doughMm = a[OFF_DOUGH + i], H = a[OFF_HEIGHT + i];
  const zMid = ((j + 0.5) / NZ) * H;
  const meat = zMid > doughMm && H - doughMm > 0.02;

  let col;
  if (view === 'isi') col = fieldColor('isi', T);
  else if (view === 'nem') col = fieldColor('nem', W);
  else if (view === 'yapi') col = meat ? modellenmemisRenk.slice() : fieldColor('yapi', S);
  else {
    // Crust is not a separate material: it is simply dough that has gone dry. Deriving the
    // colour from the cell's own water content makes the evaporation front visible, and
    // keeps a dried-but-never-browned home-oven bake looking pale instead of fake-golden.
    const brown = a[OFF_BROWN + i];
    if (meat) {
      col = lerp(HARC_CIG, HARC_PISMIS, clamp01(S));
      col = lerp(col, [70, 40, 27], clamp01(1 - W / 0.55) * 0.65);
      col = lerp(col, [0, 0, 0], (noise2(i * 3.1, j * 2.3) - 0.5) * 0.11);
    } else {
      col = lerp(HAM_CIG, HAM_PISMIS, clamp01(S));
      const crust = clamp01(1 - W / 0.22);
      col = lerp(col, HAM_KIZARMIS, crust * (0.22 + 0.78 * clamp01(brown)));
      col = lerp(col, [255, 255, 255], clamp01(G) * 0.09);
      col = lerp(col, [0, 0, 0], (noise2(i * 2.7, j * 4.1) - 0.5) * 0.07);
    }
  }
  return charredColor(col, a[OFF_CHAR + c], noise2(i * 1.7, j * 5.9));
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Float32Array} a current frame
 * @param {object} p recipe parameters
 * @param {string} view one of kesit | isi | nem | yapi
 * @param {object} cam { yaw, zoom, px, py }
 * @param {boolean} focus zoom into the bare outer edge
 */
export function drawSection(canvas, a, p, view, cam, focus) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const start = focus ? 0.66 : 0;
  const end = 1;
  const i0 = Math.floor(start * NX), i1 = NX;
  const nCols = i1 - i0;

  let maxH = 0;
  for (let i = i0; i < i1; i++) maxH = Math.max(maxH, a[OFF_HEIGHT + i]);
  maxH = Math.max(maxH, 1);

  const padX = 30, padTop = 46, padBottom = 54;
  const depthX = cam.yaw * 62, depthY = -30;
  const usableW = w - padX * 2 - Math.abs(depthX);
  const usableH = h - padTop - padBottom + depthY;
  const colW = (usableW / nCols) * cam.zoom;
  const vScale = (usableH / maxH) * cam.zoom;
  const originX = padX + Math.max(0, -depthX) + cam.px + (usableW * (1 - cam.zoom)) / 2;
  const baseY = h - padBottom + cam.py;

  const x = (i) => originX + (i - i0) * colW;
  const yOf = (mm) => baseY - mm * vScale;

  // --- top surface, drawn as an extruded band so the slab reads as solid ---
  for (let i = i0; i < i1; i++) {
    const H = a[OFF_HEIGHT + i];
    const col = cellColor(a, i, NZ - 1, view, p);
    const shade = lerp(col, [255, 255, 255], 0.16);
    ctx.fillStyle = rgb(shade);
    ctx.beginPath();
    ctx.moveTo(x(i), yOf(H));
    ctx.lineTo(x(i + 1) + 0.6, yOf(H));
    ctx.lineTo(x(i + 1) + depthX + 0.6, yOf(H) + depthY);
    ctx.lineTo(x(i) + depthX, yOf(H) + depthY);
    ctx.closePath();
    ctx.fill();
  }

  // --- step walls where the topping edge drops away ---
  // Without these the extruded top band of a covered column and the much lower band of the
  // bare rim next to it leave a floating fragment with background showing between them.
  for (let i = i0; i < i1 - 1; i++) {
    const hi = a[OFF_HEIGHT + i], lo = a[OFF_HEIGHT + i + 1];
    if (hi - lo < 0.12) continue;
    ctx.fillStyle = rgb(lerp(cellColor(a, i, NZ - 1, view, p), [0, 0, 0], 0.30));
    ctx.beginPath();
    ctx.moveTo(x(i + 1), yOf(hi));
    ctx.lineTo(x(i + 1) + depthX, yOf(hi) + depthY);
    ctx.lineTo(x(i + 1) + depthX, yOf(lo) + depthY);
    ctx.lineTo(x(i + 1), yOf(lo));
    ctx.closePath();
    ctx.fill();
  }

  // --- the cut face ---
  for (let i = i0; i < i1; i++) {
    const H = a[OFF_HEIGHT + i];
    const cell = H / NZ;
    for (let j = 0; j < NZ; j++) {
      ctx.fillStyle = rgb(cellColor(a, i, j, view, p));
      const yTop = yOf((j + 1) * cell), yBot = yOf(j * cell);
      ctx.fillRect(x(i), yTop, colW + 0.7, yBot - yTop + 0.7);
    }
  }

  // --- pores, only in the crumb view, clipped to the dough band ---
  if (view === 'kesit') {
    const doughAt = (r) => {
      const f = clamp01(r) * (NX - 1);
      const i = Math.min(NX - 2, Math.floor(f));
      return a[OFF_DOUGH + i] + (a[OFF_DOUGH + i + 1] - a[OFF_DOUGH + i]) * (f - i);
    };
    buildPores(p, start, end, doughAt);
    ctx.save();
    ctx.beginPath();
    ctx.rect(originX, 0, nCols * colW, h);
    ctx.clip();
    for (const pore of pores) {
      if (pore.r < start) continue;
      const dh = doughAt(pore.r);
      if (dh < 0.3) continue;
      const cx = x(i0) + (pore.r - start) / (end - start) * nCols * colW;
      const cy = yOf(dh * pore.v);
      const rx = Math.max(0.7, Math.min(pore.size * colW * 3.2, colW * 2.6));
      const ry = Math.max(0.7, Math.min(pore.size * vScale * 0.55, dh * vScale * 0.16));
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const ang = (k / 16) * Math.PI * 2;
        const rough = 0.78 + 0.34 * noise(pore.seed * 29 + k);
        const px = cx + Math.cos(ang) * rx * rough;
        const py = cy + Math.sin(ang) * ry * rough;
        k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(26,19,14,${0.34 + noise(pore.seed * 11) * 0.30})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,238,205,0.13)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- flecks in the meat: drawn as shapes so they do not snap to the cell grid ---
  if (view === 'kesit' && p.harc > 0 && p.kaplama > 0) {
    buildFlecks(p, start, end);
    const at = (r, off) => {
      const f = clamp01(r) * (NX - 1);
      const i = Math.min(NX - 2, Math.floor(f));
      return a[off + i] + (a[off + i + 1] - a[off + i]) * (f - i);
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(originX, 0, nCols * colW, h);
    ctx.clip();
    for (const f of flecks) {
      if (f.r < start) continue;
      const d = at(f.r, OFF_DOUGH), H = at(f.r, OFF_HEIGHT);
      if (H - d < 0.1) continue;
      const cx = x(i0) + ((f.r - start) / (end - start)) * nCols * colW;
      const cy = yOf(d + (H - d) * f.v);
      // Capped relative to the cell, so zooming in does not turn specks into confetti.
      const rx = Math.max(0.5, Math.min(f.size * colW * 1.3, colW * 1.5));
      const ry = Math.max(0.5, Math.min(f.size * vScale * 0.11, (H - d) * vScale * 0.055));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((noise(f.seed * 17) - 0.5) * 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${f.col.join(',')},0.58)`;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // --- the dough / topping interface, where the harc gives its water back ---
  if (view === 'kesit' || view === 'nem') {
    ctx.strokeStyle = 'rgba(60,32,22,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (let i = i0; i < i1; i++) {
      const d = a[OFF_DOUGH + i];
      if (a[OFF_HEIGHT + i] - d < 0.05) { started = false; continue; }
      const px = x(i) + colW / 2, py = yOf(d);
      started ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      started = true;
    }
    ctx.stroke();
  }

  // --- outer side face, the bare edge everyone burns ---
  const iLast = NX - 1;
  const Hl = a[OFF_HEIGHT + iLast];
  const cellL = Hl / NZ;
  for (let j = 0; j < NZ; j++) {
    const col = lerp(cellColor(a, iLast, j, view, p), [0, 0, 0], 0.18);
    ctx.fillStyle = rgb(col);
    ctx.beginPath();
    ctx.moveTo(x(iLast + 1), yOf(j * cellL));
    ctx.lineTo(x(iLast + 1), yOf((j + 1) * cellL));
    ctx.lineTo(x(iLast + 1) + depthX, yOf((j + 1) * cellL) + depthY);
    ctx.lineTo(x(iLast + 1) + depthX, yOf(j * cellL) + depthY);
    ctx.closePath();
    ctx.fill();
  }

  // --- the baking surface underneath ---
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(originX, baseY, nCols * colW, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.moveTo(originX, baseY + 3);
  ctx.lineTo(originX + nCols * colW, baseY + 3);
  ctx.lineTo(originX + nCols * colW + depthX, baseY + 3 + depthY);
  ctx.lineTo(originX + depthX, baseY + 3 + depthY);
  ctx.closePath();
  ctx.fill();
}
