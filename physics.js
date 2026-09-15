// Lahmacun Lab — transport solver.
//
// Pure module: no DOM, no Worker globals, no randomness. The same file runs in the
// browser Worker and under `node --test`, which is the point — the physics is the part
// that can be quietly wrong, so it has to be testable in isolation.
//
// Domain: axisymmetric slice of a round flatbread, center (r=0) to outer edge (r=R),
// resolved on NX x NZ cells. Each column carries its own stack height, so the vertical
// coordinate is terrain-following: cell (i, j) spans the same *fraction* of the stack in
// every column. Radial conduction is taken between equal j, which is an approximation
// where the topping edge steps down. Documented, not hidden.
//
// Numerics: operator splitting. Vertical diffusion is implicit (tridiagonal, Thomas),
// which removes the stiff stability limit imposed by a 1 mm dough. Radial diffusion,
// evaporation, browning, char and setting are explicit afterwards.

export const NX = 96;
export const NZ = 24;
export const CELLS = NX * NZ;

// --- state array layout -----------------------------------------------------------
// Planar blocks, so the renderer can walk one field with unit stride.
export const OFF_T = 0;                    // temperature, C
export const OFF_W = CELLS;                // water mass fraction of local mass, 0..1
export const OFF_S = CELLS * 2;            // set / structure, 0..1
export const OFF_G = CELLS * 3;            // gas / porosity, 0..1
export const OFF_CHAR = CELLS * 4;         // char severity per cell, 0..1
export const OFF_HEIGHT = CELLS * 5;       // per column stack height, mm   (NX)
export const OFF_DOUGH = OFF_HEIGHT + NX;  // per column dough height, mm   (NX)
export const OFF_BROWN = OFF_DOUGH + NX;   // per column surface browning   (NX)
export const SUMMARY = OFF_BROWN + NX;     // 16 scalars
export const STATE_LEN = SUMMARY + 16;

export const S_TIME = 0;        // s
export const S_FOLD = 1;        // katlanabilirlik, 0..1
export const S_MEATCORE = 2;    // coldest topping cell, C
export const S_WATERLOSS = 3;   // % of initial dough+topping mass
export const S_BROWN = 4;       // mean surface browning, 0..1
export const S_DONE = 5;        // meat doneness, minimum over topping, 0..1
export const S_THICK = 6;       // mean stack height, mm
export const S_CHARTOP = 7;     // mean top char severity, 0..1
export const S_CHARBASE = 8;    // mean base char severity, 0..1
export const S_TOPWATER = 9;    // fraction of original topping water remaining
export const S_DOUGHCORE = 10;  // coldest dough cell, C
export const S_SURFTEMP = 11;   // mean top surface temperature, C
export const S_BASETEMP = 12;   // mean bottom surface temperature, C
export const S_RISE = 13;       // height / initial height
export const S_SOGGY = 14;      // water fraction of the dough directly under the topping
export const S_EDGECHAR = 15;   // char on the bare outer edge, 0..1

// --- physical constants -----------------------------------------------------------
const SIGMA = 5.670374e-8;   // Stefan-Boltzmann, W/m^2K^4
const EMIS = 0.90;           // surface emissivity of bread/meat
const LV = 2.26e6;           // latent heat of vaporisation, J/kg
const CP_WATER = 4186;       // J/kgK
const CP_DRY_DOUGH = 1600;   // starch + gluten solids, J/kgK
const CP_DRY_MEAT = 1900;    // meat solids, J/kgK
const RHO_DOUGH = 1150;      // bulk wet density, kg/m^3
const RHO_MEAT = 1050;
const K_DOUGH_WET = 0.45, K_DOUGH_DRY = 0.055;  // W/mK; dry crust is a real insulator
const K_MEAT_WET = 0.48, K_MEAT_DRY = 0.070;
// Effective moisture diffusivity. Deliberately an order of magnitude above the liquid
// value: above ~60 C transport through a porous crumb is dominated by vapour moving down
// the pressure gradient (Darcy), not by Fickian liquid diffusion.
const D_WATER = 4.0e-9;      // m^2/s
const T_BOIL = 100;
const H_CONV = 22;           // oven convection coefficient, W/m^2K
const R_GAS = 8.314;

// Maillard and pyrolysis, as lumped apparent Arrhenius pairs.
//
// Calibrated against SURFACE temperature, not oven temperature. This distinction is the
// whole game: a wet crumb pinned at 100 C conducts heat away faster than radiation
// delivers it, so the surface of a lahmacun in a 400 C oven sits nearer 150-200 C until a
// dry crust forms. Tuning these constants against 400 C makes browning physically
// impossible. Targets used here: browning in ~200 s at 180 C, ~5 s at 350 C; charring in
// ~300 s at 250 C, ~40 s at 350 C, and effectively never below 180 C.
const MAILLARD_A = 2.92e3, MAILLARD_EA = 5.00e4;
const CHAR_A = 1.00e3, CHAR_EA = 5.49e4;
// Local water fraction above which browning stalls. Meat browns at a higher water
// activity than dough: it carries far more free amino acids and reducing sugars.
const W_MAILLARD_DOUGH = 0.18;
const W_MAILLARD_MEAT = 0.40;

// Foldability thresholds, see plan/00-project-requirements.md 4.6
const W_BRITTLE = 0.04, W_PLIABLE = 0.24;

// Contact conductance of the baking surface, W/m^2K. Values are low on purpose: dough
// on a hearth has real contact resistance from trapped steam, flour dust and roughness.
export const SURFACE_CONTACT = { tas: 150, sac: 380, tepsi: 120 };
// Top-side radiant scaling. A griddle has essentially no radiant top heat.
export const OVEN_RADIANT = { tas: 95, konveyor: 150, ev: 75, sac: 25 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => clamp(v, 0, 1);
const logistic = (x) => 1 / (1 + Math.exp(-x));

/**
 * Build a solver for one bake.
 * @param {object} p parameters, see plan/00-project-requirements.md section 6
 */
export function createSolver(p) {
  const doughMm = clamp(p.hamur ?? 2, 0.5, 8);
  const toppingMm = clamp(p.harc ?? 3, 0, 10);
  const radiusM = (clamp(p.cap ?? 30, 10, 60) / 100) / 2;
  const coverage = clamp01((p.kaplama ?? 92) / 100);
  const hydration = clamp(p.hidrasyon ?? 58, 30, 90);
  const protein = clamp(p.protein ?? 11.5, 8, 16);
  const proof = clamp(p.mayalanma ?? 6, 0, 48);
  const doughOil = clamp01((p.yag ?? 1) / 100);
  const meatFat = clamp01((p.kiymaYag ?? 18) / 100);
  const tTop = clamp(p.ust ?? 400, 20, 700);
  const tFloor = clamp(p.taban ?? 380, 20, 700);
  const radiant = OVEN_RADIANT[p.firin] ?? OVEN_RADIANT.tas;
  const contact = SURFACE_CONTACT[p.yuzey] ?? SURFACE_CONTACT.tas;

  const dr = radiusM / NX;
  // Initial water fractions of local mass.
  const wDough0 = hydration / (100 + hydration);
  const wMeat0 = clamp01((p.harcSu ?? 70) / 100);

  // Steam + yeast puff. A lahmacun lifts a little; it does not spring like a cornicione.
  const riseMax = 1 + 0.10 + 0.22 * Math.sqrt(proof / 24) * (0.6 + 0.4 * (protein - 9) / 5);

  // Per-column geometry. A soft topping edge over one cell avoids a discontinuity.
  const cover = new Float64Array(NX);
  const doughH = new Float64Array(NX);   // mm, grows with rise
  const toppingH = new Float64Array(NX); // mm
  const rMid = new Float64Array(NX);
  for (let i = 0; i < NX; i++) {
    const rn = (i + 0.5) / NX;
    rMid[i] = rn * radiusM;
    cover[i] = clamp01((coverage - rn) * NX + 0.5);
    doughH[i] = doughMm;
    toppingH[i] = toppingMm * cover[i];
  }

  const T = new Float64Array(CELLS);
  const water = new Float64Array(CELLS);   // kg/m^2 of horizontal area
  const solid = new Float64Array(CELLS);   // kg/m^2, invariant
  const setF = new Float64Array(CELLS);
  const gas = new Float64Array(CELLS);
  const charF = new Float64Array(CELLS);
  const isMeat = new Uint8Array(CELLS);
  const brown = new Float64Array(NX);      // top surface
  const brownBase = new Float64Array(NX);  // underside against the stone
  const rise = new Float64Array(NX).fill(1);

  // Tridiagonal scratch.
  const ta = new Float64Array(NZ), tb = new Float64Array(NZ);
  const tc = new Float64Array(NZ), td = new Float64Array(NZ);
  const cp = new Float64Array(NZ), dp = new Float64Array(NZ);

  let toppingWater0 = 0, mass0 = 0, time = 0;

  // --- initial condition ----------------------------------------------------------
  for (let i = 0; i < NX; i++) {
    const H = doughH[i] + toppingH[i];
    const dz = (H / NZ) / 1000; // m
    for (let j = 0; j < NZ; j++) {
      const c = j * NX + i;
      const zMid = (j + 0.5) * H / NZ;              // mm from the stone
      const meat = zMid > doughH[i] && toppingH[i] > 0.02;
      isMeat[c] = meat ? 1 : 0;
      const rho = meat ? RHO_MEAT : RHO_DOUGH;
      const w0 = meat ? wMeat0 : wDough0;
      const m = rho * dz;                            // kg/m^2
      water[c] = m * w0;
      solid[c] = m * (1 - w0);
      T[c] = 20;
      setF[c] = 0;
      gas[c] = meat ? 0 : clamp01(0.10 + 0.35 * Math.sqrt(proof / 24));
      charF[c] = 0;
      mass0 += m;
      if (meat) toppingWater0 += water[c];
    }
  }
  if (toppingWater0 <= 0) toppingWater0 = 1e-9;

  const heatCap = (c) => solid[c] * (isMeat[c] ? CP_DRY_MEAT : CP_DRY_DOUGH) * (isMeat[c] ? 1 - 0.30 * meatFat : 1 - 0.30 * doughOil) + water[c] * CP_WATER;
  const wetness = (c) => {
    const m = water[c] + solid[c];
    return m > 0 ? water[c] / m : 0;
  };
  const conduct = (c) => {
    const u = clamp01(wetness(c) / (isMeat[c] ? 0.75 : 0.42));
    const kw = isMeat[c] ? K_MEAT_WET : K_DOUGH_WET;
    const kd = isMeat[c] ? K_MEAT_DRY : K_DOUGH_DRY;
    // Gas pockets insulate: an open crumb conducts worse than a dense one.
    return (kd + (kw - kd) * u) * (1 - 0.45 * gas[c]);
  };

  /** Largest stable explicit step for the radial operator, with a safety factor. */
  function maxStep() {
    let alphaMax = 1e-9;
    for (let c = 0; c < CELLS; c++) {
      const C = heatCap(c);
      if (C <= 0) continue;
      const dz = stackH(c % NX) / NZ / 1000;
      alphaMax = Math.max(alphaMax, conduct(c) * dz / C);
    }
    return clamp(0.35 * dr * dr / (4 * alphaMax), 0.005, 0.25);
  }
  const stackH = (i) => doughH[i] * rise[i] + toppingH[i];

  /** One split step of dt seconds. */
  function step(dt) {
    // 1. implicit vertical diffusion, column by column
    for (let i = 0; i < NX; i++) {
      const H = stackH(i);
      const dz = (H / NZ) / 1000;
      const topExposed = 1;
      for (let j = 0; j < NZ; j++) {
        const c = j * NX + i;
        const C = heatCap(c) / dt;
        let lo = 0, hi = 0, src = 0;
        if (j === 0) {
          lo = contact;                                  // stone contact
          src += lo * tFloor;
        } else {
          const cb = c - NX;
          lo = 2 * conduct(c) * conduct(cb) / (conduct(c) + conduct(cb)) / dz;
        }
        if (j === NZ - 1) {
          const Tk = T[c] + 273.15, Ok = tTop + 273.15;
          const hRad = EMIS * SIGMA * (radiant / 95) * (Ok * Ok + Tk * Tk) * (Ok + Tk);
          hi = (hRad + H_CONV) * topExposed;
          src += hi * tTop;
        } else {
          const ca = c + NX;
          hi = 2 * conduct(c) * conduct(ca) / (conduct(c) + conduct(ca)) / dz;
        }
        ta[j] = j === 0 ? 0 : -lo;
        tc[j] = j === NZ - 1 ? 0 : -hi;
        tb[j] = C + lo + hi;
        td[j] = C * T[c] + src + radialFlux(i, j) + edgeFlux(i, j, dz);
      }
      // Thomas
      cp[0] = tc[0] / tb[0];
      dp[0] = td[0] / tb[0];
      for (let j = 1; j < NZ; j++) {
        const m = tb[j] - ta[j] * cp[j - 1];
        cp[j] = tc[j] / m;
        dp[j] = (td[j] - ta[j] * dp[j - 1]) / m;
      }
      T[(NZ - 1) * NX + i] = dp[NZ - 1];
      for (let j = NZ - 2; j >= 0; j--) T[j * NX + i] = dp[j] - cp[j] * T[(j + 1) * NX + i];
    }

    // 2. explicit radial moisture diffusion + vertical moisture diffusion
    diffuseWater(dt);

    // 3. phase change, browning, setting, char
    react(dt);

    time += dt;
  }

  /** Cylindrical radial conduction as a source term, W/m^2 of horizontal area. */
  function radialFlux(i, j) {
    const c = j * NX + i;
    const dz = stackH(i) / NZ / 1000;
    const k = conduct(c);
    let q = 0;
    if (i > 0) {
      const cl = c - 1;
      const kf = 2 * k * conduct(cl) / (k + conduct(cl));
      q += kf * (T[cl] - T[c]) * ((rMid[i] - dr / 2) / rMid[i]);
    }
    if (i < NX - 1) {
      const cr = c + 1;
      const kf = 2 * k * conduct(cr) / (k + conduct(cr));
      q += kf * (T[cr] - T[c]) * ((rMid[i] + dr / 2) / rMid[i]);
    }
    return q / (dr * dr) * dz;
  }

  /**
   * The outer rim is exposed on its side as well as its top. Its area-to-volume ratio is
   * what makes a bare lahmacun edge blacken before the covered centre is warm.
   */
  function edgeFlux(i, j, dz) {
    if (i !== NX - 1) return 0;
    const c = j * NX + i;
    const Tk = T[c] + 273.15, Ok = tTop + 273.15;
    const hRad = EMIS * SIGMA * (radiant / 95) * (Ok * Ok + Tk * Tk) * (Ok + Tk);
    return (hRad + H_CONV) * (tTop - T[c]) * dz / dr;
  }

  /**
   * Moisture transport: implicit in z, explicit in r, with a directional crust gate.
   *
   * Two decisions matter here.
   *
   * 1. The diffused quantity is water MASS per area, not mass fraction. Diffusing the
   *    fraction needs a mass weighting that breaks exact conservation; diffusing the mass
   *    with a symmetric face coefficient conserves water to machine precision, which is
   *    something a test can actually assert.
   *
   * 2. The z direction is solved implicitly. An explicit step over a 42 um cell is stable
   *    only below about 0.1 s, and quietly goes negative above that. Clamping the result
   *    to zero would destroy water while looking perfectly plausible.
   *
   * The gate is the physics: a plain diffusion moves water toward whatever is driest, so
   * the hot dry crust would keep sucking moisture out of the crumb and never set. Real
   * baking runs the other way. A superheated dry zone sits at a higher vapour pressure
   * than the crumb, so net flux is outward and an evaporation front recedes inward. Water
   * may always leave a cell, but may only enter one still below roughly 120 C.
   */
  function diffuseWater(dt) {
    // A free surface is a vapour sink: the steam it generates leaves the bread instead of
    // wicking back in. Interior cells are resupplied freely; exposed cells are not, which
    // is what lets a surface crust form while the crumb underneath is still at 100 C.
    // The underside is deliberately NOT in this set. It is pressed against the stone, so
    // its steam has nowhere to go but back into the crumb, and it stays resupplied. Treating
    // it as a free surface dries the base in seconds and chars every bake.
    const exposed = (c) => (c >= CELLS - NX || (c % NX) === NX - 1 ? 0.15 : 1);
    const gateOf = (c) => clamp01((T_BOIL + 5 - T[c]) / 20) * exposed(c);
    const Dof = (c) => D_WATER * (1 + 5 * clamp01((T[c] - 40) / 60));

    // --- explicit radial pass, conservative face fluxes ---
    const delta = new Float64Array(CELLS);
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const c = j * NX + i, n = c + 1;
        const D = 0.5 * (Dof(c) + Dof(n));
        const diff = water[n] - water[c];
        const gate = diff > 0 ? gateOf(c) : gateOf(n);   // gate the receiving side
        const f = D * gate * diff / (dr * dr) * dt;
        delta[c] += f;
        delta[n] -= f;
      }
    }
    for (let c = 0; c < CELLS; c++) water[c] = Math.max(0, water[c] + delta[c]);

    // --- implicit vertical pass, column by column ---
    for (let i = 0; i < NX; i++) {
      const dz = stackH(i) / NZ / 1000;
      const inv = 1 / (dz * dz);
      for (let j = 0; j < NZ; j++) {
        const c = j * NX + i;
        let lo = 0, hi = 0;
        if (j > 0) {
          const n = c - NX, D = 0.5 * (Dof(c) + Dof(n));
          lo = D * (water[n] - water[c] > 0 ? gateOf(c) : gateOf(n)) * inv;
        }
        if (j < NZ - 1) {
          const n = c + NX, D = 0.5 * (Dof(c) + Dof(n));
          hi = D * (water[n] - water[c] > 0 ? gateOf(c) : gateOf(n)) * inv;
        }
        ta[j] = -lo;
        tc[j] = -hi;
        tb[j] = 1 / dt + lo + hi;
        td[j] = water[c] / dt;
      }
      cp[0] = tc[0] / tb[0];
      dp[0] = td[0] / tb[0];
      for (let j = 1; j < NZ; j++) {
        const m = tb[j] - ta[j] * cp[j - 1];
        cp[j] = tc[j] / m;
        dp[j] = (td[j] - ta[j] * dp[j - 1]) / m;
      }
      water[(NZ - 1) * NX + i] = Math.max(0, dp[NZ - 1]);
      for (let j = NZ - 2; j >= 0; j--) {
        const c = j * NX + i;
        water[c] = Math.max(0, dp[j] - cp[j] * water[c + NX]);
      }
    }
  }

  function react(dt) {
    for (let i = 0; i < NX; i++) {
      const dz = stackH(i) / NZ / 1000;
      const bare = toppingH[i] < 0.02;
      for (let j = 0; j < NZ; j++) {
        const c = j * NX + i;
        const C = heatCap(c);
        const w = wetness(c);

        // Boiling: surplus enthalpy above 100 C becomes vapour instead of temperature.
        if (T[c] > T_BOIL && water[c] > 1e-9) {
          const surplus = (T[c] - T_BOIL) * C;
          const evap = Math.min(water[c], surplus / LV);
          water[c] -= evap;
          T[c] -= evap * LV / Math.max(C, 1e-6);
        }

        // Sub-boiling surface drying. Only exposed faces. This is the mechanism that
        // lets a home oven dry a lahmacun to a cracker without ever browning it.
        const exposedTop = j === NZ - 1;
        const exposedSide = i === NX - 1;
        if ((exposedTop || exposedSide) && water[c] > 1e-9 && T[c] > 40) {
          const aw = w / (w + 0.12);                   // water activity, crude
          const faces = (exposedTop ? 1 : 0) + (exposedSide ? dz / dr : 0);
          const rate = 3.1e-6 * aw * (T[c] - 40) * faces;   // kg/m^2 s
          const evap = Math.min(water[c], rate * dt);
          water[c] -= evap;
          T[c] -= evap * LV / Math.max(C, 1e-6);
        }

        // Structural setting: gelatinisation and coagulation.
        if (setF[c] < 1) setF[c] = clamp01(setF[c] + logistic((T[c] - 72) / 6) * dt / 8);

        // Gas: steam inflates the crumb until the matrix sets, then it is frozen in.
        if (!isMeat[c]) {
          const drive = logistic((T[c] - 78) / 8) * (1 - setF[c]);
          gas[c] = clamp01(gas[c] + drive * dt / 22);
        }

        // Maillard, then char. Surface cells only; both gated on dryness. The top and
        // the underside keep separate browning accounts, because on a stone they are two
        // completely different thermal histories.
        const onSurface = exposedTop || exposedSide || j === 0;
        if (onSurface) {
          const Tk = T[c] + 273.15;
          const wCrit = isMeat[c] ? W_MAILLARD_MEAT : W_MAILLARD_DOUGH;
          const dry = Math.max(0, 1 - w / wCrit);
          if (dry > 0 && T[c] > 100) {
            const kM = MAILLARD_A * Math.exp(-MAILLARD_EA / (R_GAS * Tk)) * dry;
            let b;
            if (j === 0) b = brownBase[i] = clamp01(brownBase[i] + kM * dt);
            else b = brown[i] = clamp01(brown[i] + kM * dt);
            if (b > 0.85) {
              const kC = CHAR_A * Math.exp(-CHAR_EA / (R_GAS * Tk)) * dry;
              charF[c] = clamp01(charF[c] + kC * dt);
            }
          }
        }
      }
      // Rise: steam lift, locked once the dough has set. Bare dough puffs more freely
      // than dough weighed down by a wet meat layer.
      const mid = Math.floor(NZ * 0.35) * NX + i;
      const load = bare ? 1 : clamp01(1 - toppingH[i] / 12);
      const target = 1 + (riseMax - 1) * clamp01(gas[mid] / 0.5) * load;
      rise[i] += (target - rise[i]) * clamp01(dt / 6) * (1 - setF[mid]);
    }
  }

  // --- diagnostics ----------------------------------------------------------------
  function summarise(out) {
    let meatCore = Infinity, doughCore = Infinity, done = Infinity;
    let waterNow = 0, toppingWaterNow = 0, solidNow = 0;
    let brownSum = 0, charTop = 0, charBase = 0, hSum = 0, h0Sum = 0;
    let surfT = 0, baseT = 0, soggy = 0, soggyN = 0, edgeChar = 0, edgeN = 0;
    let foldSum = 0;
    const pliability = new Float64Array(NX);

    for (let i = 0; i < NX; i++) {
      const H = stackH(i);
      hSum += H;
      h0Sum += doughH[i] + toppingH[i];
      brownSum += brown[i];
      charTop += charF[(NZ - 1) * NX + i];
      charBase += charF[i];
      surfT += T[(NZ - 1) * NX + i];
      baseT += T[i];
      if (toppingH[i] < 0.02) { edgeChar += Math.max(charF[(NZ - 1) * NX + i], charF[i]); edgeN++; }

      let wDough = 0, nDough = 0, charDough = 0;
      for (let j = 0; j < NZ; j++) {
        const c = j * NX + i;
        waterNow += water[c];
        solidNow += solid[c];
        if (isMeat[c]) {
          toppingWaterNow += water[c];
          if (T[c] < meatCore) meatCore = T[c];
          const d = clamp01(setF[c]);
          if (d < done) done = d;
        } else {
          if (T[c] < doughCore) doughCore = T[c];
          wDough += wetness(c); charDough += charF[c]; nDough++;
          if (j === NZ - 1 || (j + 1 < NZ && isMeat[c + NX])) { soggy += wetness(c); soggyN++; }
        }
      }
      const wMean = nDough ? wDough / nDough : 0;
      // What fraction of the dough's THICKNESS is charred. Using the worst single surface
      // cell instead would let one 0.2 mm blackened layer zero out a 2 mm lahmacun, and
      // would make the answer depend on the grid resolution rather than on the bread.
      const ch = nDough ? charDough / nDough : 0;
      pliability[i] = clamp01((wMean - W_BRITTLE) / (W_PLIABLE - W_BRITTLE)) * (1 - ch) * (1 - ch);
      foldSum += pliability[i];
    }

    // A roll cracks at its weakest point, so the low tail carries half the weight.
    const sorted = Array.from(pliability).sort((a, b) => a - b);
    const p10 = sorted[Math.floor(NX * 0.1)];
    const fold = 0.50 * (foldSum / NX) + 0.50 * p10;

    out[SUMMARY + S_TIME] = time;
    out[SUMMARY + S_FOLD] = clamp01(fold);
    out[SUMMARY + S_MEATCORE] = Number.isFinite(meatCore) ? meatCore : doughCore;
    out[SUMMARY + S_WATERLOSS] = mass0 > 0 ? (1 - (waterNow + solidNow) / mass0) * 100 : 0;
    out[SUMMARY + S_BROWN] = brownSum / NX;
    out[SUMMARY + S_DONE] = Number.isFinite(done) ? done : 1; // no topping: nothing to undercook
    out[SUMMARY + S_THICK] = hSum / NX;
    out[SUMMARY + S_CHARTOP] = charTop / NX;
    out[SUMMARY + S_CHARBASE] = charBase / NX;
    out[SUMMARY + S_TOPWATER] = clamp01(toppingWaterNow / toppingWater0);
    out[SUMMARY + S_DOUGHCORE] = doughCore;
    out[SUMMARY + S_SURFTEMP] = surfT / NX;
    out[SUMMARY + S_BASETEMP] = baseT / NX;
    out[SUMMARY + S_RISE] = h0Sum > 0 ? hSum / h0Sum : 1;
    out[SUMMARY + S_SOGGY] = soggyN ? soggy / soggyN : 0;
    out[SUMMARY + S_EDGECHAR] = edgeN ? edgeChar / edgeN : 0;
  }

  function snapshot() {
    const out = new Float32Array(STATE_LEN);
    for (let c = 0; c < CELLS; c++) {
      out[OFF_T + c] = T[c];
      out[OFF_W + c] = wetness(c);
      out[OFF_S + c] = setF[c];
      out[OFF_G + c] = gas[c];
      out[OFF_CHAR + c] = charF[c];
    }
    for (let i = 0; i < NX; i++) {
      out[OFF_HEIGHT + i] = stackH(i);
      out[OFF_DOUGH + i] = doughH[i] * rise[i];
      out[OFF_BROWN + i] = brown[i];
    }
    summarise(out);
    return out;
  }

  /** Advance the bake by `seconds`, sub-stepping at the stable rate. */
  function advance(seconds) {
    let left = seconds;
    let guard = 0;
    while (left > 1e-9 && guard++ < 200000) {
      const dt = Math.min(maxStep(), left);
      step(dt);
      left -= dt;
    }
  }

  return { advance, snapshot, get time() { return time; } };
}
