// Solver tests. Two groups:
//   - invariants, which must hold for any parameters at all;
//   - behaviour, which asserts the model reproduces things everyone already knows about
//     lahmacun. The second group is the one that catches a "plausible but wrong" model.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSolver, NX, NZ, CELLS, STATE_LEN, SUMMARY,
  OFF_T, OFF_W, OFF_S, OFF_G, OFF_CHAR,
  S_FOLD, S_MEATCORE, S_WATERLOSS, S_BROWN, S_DONE,
  S_CHARTOP, S_CHARBASE, S_TOPWATER, S_TIME,
} from '../physics.js';
import { recipes, controls } from '../recipes.js';

const BASE = {
  hidrasyon: 56, protein: 11, mayalanma: 4, hamur: 2, cap: 32, yag: 1,
  harc: 3, harcSu: 70, kaplama: 92, kiymaYag: 20,
  ust: 430, taban: 320, sure: 120, firin: 'tas', yuzey: 'tas',
};
const bake = (over = {}, seconds = 120) => {
  const s = createSolver({ ...BASE, ...over });
  s.advance(seconds);
  return s.snapshot();
};
const g = (a, k) => a[SUMMARY + k];

// ---------------------------------------------------------------- invariants

test('grid matches the advertised 2304 thermal cells', () => {
  assert.equal(NX * NZ, 2304);
  assert.equal(CELLS, 2304);
});

test('snapshot has the declared length and no NaN', () => {
  const a = bake();
  assert.equal(a.length, STATE_LEN);
  for (let i = 0; i < a.length; i++) assert.ok(Number.isFinite(a[i]), `index ${i} is ${a[i]}`);
});

test('every field stays inside its physical bounds', () => {
  const a = bake({}, 300);
  for (let c = 0; c < CELLS; c++) {
    assert.ok(a[OFF_T + c] >= -1 && a[OFF_T + c] <= 700, `T ${a[OFF_T + c]}`);
    for (const off of [OFF_W, OFF_S, OFF_G, OFF_CHAR]) {
      assert.ok(a[off + c] >= -1e-6 && a[off + c] <= 1 + 1e-6, `field ${off} = ${a[off + c]}`);
    }
  }
});

test('water is never created', () => {
  let prev = -1;
  const s = createSolver(BASE);
  for (let i = 0; i < 20; i++) {
    s.advance(15);
    const loss = g(s.snapshot(), S_WATERLOSS);
    assert.ok(loss >= prev - 1e-6, `water loss went backwards: ${prev} -> ${loss}`);
    assert.ok(loss >= 0 && loss < 100);
    prev = loss;
  }
});

test('an adiabatic bake at ambient changes nothing', () => {
  // Oven at the dough's own temperature: no gradient, so nothing should move.
  const a = bake({ ust: 20, taban: 20 }, 120);
  assert.ok(Math.abs(g(a, S_WATERLOSS)) < 0.5, `lost ${g(a, S_WATERLOSS)}%`);
  assert.ok(g(a, S_BROWN) < 1e-6);
  for (let c = 0; c < CELLS; c++) assert.ok(Math.abs(a[OFF_T + c] - 20) < 1.0);
});

test('every cell converges toward a uniform boundary temperature', () => {
  // Dry dough, oven held at 90 C: below boiling, so it is a pure conduction problem.
  const a = bake({ ust: 90, taban: 90, harc: 0, kaplama: 0, hidrasyon: 48 }, 600);
  for (let c = 0; c < CELLS; c++) {
    assert.ok(a[OFF_T + c] > 85 && a[OFF_T + c] <= 90.5, `cell ${c} at ${a[OFF_T + c]}`);
  }
});

test('mean temperature rises monotonically in a hot oven', () => {
  const s = createSolver(BASE);
  let prev = -Infinity;
  for (let i = 0; i < 12; i++) {
    s.advance(10);
    const a = s.snapshot();
    let sum = 0;
    for (let c = 0; c < CELLS; c++) sum += a[OFF_T + c];
    const mean = sum / CELLS;
    assert.ok(mean >= prev - 0.5, `mean fell: ${prev} -> ${mean}`);
    prev = mean;
  }
});

test('the solver is deterministic', () => {
  const a = bake({}, 90), b = bake({}, 90);
  for (let i = 0; i < a.length; i++) assert.equal(a[i], b[i], `differs at ${i}`);
});

test('clock advances exactly as requested', () => {
  const s = createSolver(BASE);
  s.advance(37.5);
  assert.ok(Math.abs(g(s.snapshot(), S_TIME) - 37.5) < 1e-6);
});

test('survives both extremes of every slider without NaN', () => {
  for (const [id, , min, max] of controls) {
    for (const v of [min, max]) {
      const a = bake({ [id]: v }, 150);
      for (let i = 0; i < a.length; i++) {
        assert.ok(Number.isFinite(a[i]), `${id}=${v} produced non-finite at ${i}`);
      }
    }
  }
});

test('all eleven presets solve cleanly', () => {
  for (const r of recipes) {
    const s = createSolver(r);
    s.advance(r.sure);
    const a = s.snapshot();
    for (let i = 0; i < a.length; i++) {
      assert.ok(Number.isFinite(a[i]), `${r.ad} produced non-finite at ${i}`);
    }
    assert.ok(g(a, S_WATERLOSS) > 0, `${r.ad} lost no water`);
  }
});

test('a 180 s bake solves in under two seconds', () => {
  const t0 = Date.now();
  bake({}, 180);
  const ms = Date.now() - t0;
  assert.ok(ms < 2000, `took ${ms} ms`);
});

// ---------------------------------------------------------------- behaviour

test('the reference bake lands in the good window', () => {
  const a = bake({}, 120);
  assert.ok(g(a, S_FOLD) > 0.6, `foldability ${g(a, S_FOLD)}`);
  assert.ok(g(a, S_DONE) > 0.9, `doneness ${g(a, S_DONE)}`);
  assert.ok(g(a, S_WATERLOSS) > 15 && g(a, S_WATERLOSS) < 30, `loss ${g(a, S_WATERLOSS)}%`);
  assert.ok(g(a, S_CHARTOP) < 0.3 && g(a, S_CHARBASE) < 0.4, 'should not be burnt yet');
});

test('overbaking turns it into a cracker', () => {
  const good = bake({}, 120), ruined = bake({}, 400);
  assert.ok(g(good, S_FOLD) > 0.6);
  assert.ok(g(ruined, S_FOLD) < 0.15, `still foldable at 400 s: ${g(ruined, S_FOLD)}`);
  assert.ok(g(ruined, S_WATERLOSS) > g(good, S_WATERLOSS));
});

test('foldability decreases monotonically once the bake is under way', () => {
  const s = createSolver(BASE);
  s.advance(45);
  let prev = g(s.snapshot(), S_FOLD);
  for (let i = 0; i < 10; i++) {
    s.advance(30);
    const now = g(s.snapshot(), S_FOLD);
    assert.ok(now <= prev + 1e-3, `foldability rose: ${prev} -> ${now}`);
    prev = now;
  }
});

test('a home oven dries it out without browning it', () => {
  const home = bake({ ust: 270, taban: 250, firin: 'ev', yuzey: 'tepsi' }, 480);
  const stone = bake({}, 150);
  assert.ok(g(home, S_WATERLOSS) > g(stone, S_WATERLOSS), 'home oven should dry it more');
  assert.ok(g(home, S_BROWN) < g(stone, S_BROWN) + 0.35, 'home oven should not brown better');
  assert.ok(g(home, S_FOLD) < g(stone, S_FOLD), 'home oven should cost foldability');
});

test('a griddle chars the base far more than the top', () => {
  const a = bake({ ust: 300, taban: 330, firin: 'sac', yuzey: 'sac' }, 220);
  assert.ok(g(a, S_CHARBASE) > g(a, S_CHARTOP), `base ${g(a, S_CHARBASE)} vs top ${g(a, S_CHARTOP)}`);
});

test('thicker topping leaves a colder meat core', () => {
  const thin = bake({ harc: 2 }, 120);
  const thick = bake({ harc: 7 }, 120);
  assert.ok(g(thick, S_MEATCORE) < g(thin, S_MEATCORE) - 1,
    `thin ${g(thin, S_MEATCORE)} vs thick ${g(thick, S_MEATCORE)}`);
});

test('wetter topping holds more of its water and slows drying', () => {
  const dry = bake({ harcSu: 45 }, 120);
  const wet = bake({ harcSu: 85 }, 120);
  assert.ok(g(wet, S_WATERLOSS) < g(dry, S_WATERLOSS) + 1e-9 || g(wet, S_TOPWATER) > g(dry, S_TOPWATER),
    'wet topping should not dry out faster in relative terms');
  assert.ok(g(wet, S_BROWN) <= g(dry, S_BROWN) + 1e-6, 'wet topping should not brown sooner');
});

test('the bare edge chars before the covered centre', () => {
  const a = bake({ kaplama: 70 }, 150);
  const edgeCol = NX - 1, midCol = 20;
  const edge = Math.max(a[OFF_CHAR + (NZ - 1) * NX + edgeCol], a[OFF_CHAR + edgeCol]);
  const mid = Math.max(a[OFF_CHAR + (NZ - 1) * NX + midCol], a[OFF_CHAR + midCol]);
  assert.ok(edge > mid, `edge ${edge} should exceed centre ${mid}`);
});

test('a hotter oven browns sooner', () => {
  const cool = bake({ ust: 300, taban: 280 }, 150);
  const hot = bake({ ust: 500, taban: 380 }, 150);
  assert.ok(g(hot, S_BROWN) > g(cool, S_BROWN), `${g(hot, S_BROWN)} vs ${g(cool, S_BROWN)}`);
});

test('a thicker dough heats through more slowly', () => {
  const thin = bake({ hamur: 1.5 }, 90);
  const thick = bake({ hamur: 6 }, 90);
  let sThin = 0, sThick = 0;
  for (let c = 0; c < CELLS; c++) { sThin += thin[OFF_T + c]; sThick += thick[OFF_T + c]; }
  assert.ok(sThick < sThin, 'thick dough should lag');
});

test('bare dough is reported as done rather than raw', () => {
  const a = bake({ harc: 0, kaplama: 0 }, 120);
  assert.equal(g(a, S_DONE), 1);
});
