# Physics model — as built

Companion to `00-project-requirements.md`. That document says what the model should do;
this one records what it actually does and, more usefully, **which wrong versions it went
through**. Every constant below was moved at least once because a test or a trace said so.

---

## 1. Discretisation

Axisymmetric slice, centre → outer edge, on **96 × 24 = 2,304 cells**.
Per cell: `T` (°C), `water` (kg/m² of horizontal area), `solid` (kg/m², invariant),
`S` (set), `G` (gas), `char`. Per column: stack height, dough height, top browning,
base browning, rise.

Vertical coordinate is **terrain-following**: cell `(i, j)` always spans the same fraction
of column `i`'s stack, so `dz` varies by column. Radial conduction is taken between equal
`j`, which is an approximation where the topping edge steps down. Named, not hidden.

### Why water mass and not water fraction
Diffusing the mass *fraction* requires a mass weighting on every face, and the scheme
stops conserving exactly. Diffusing **mass** with a symmetric face coefficient conserves
water to machine precision — which means `test: water is never created` can actually
assert something instead of allowing a tolerance.

---

## 2. Time stepping

Operator splitting:

| Operator | Scheme | Why |
|---|---|---|
| Vertical diffusion (heat) | **implicit**, Thomas/TDMA | `dz ≈ 42 µm` at 1 mm dough; explicit needs `dt ≲ 1 ms` |
| Radial diffusion (heat) | explicit | `dr ≈ 1.5 mm`, stability limit ≈ 4.9 s — nowhere near binding |
| Vertical moisture | **implicit**, Thomas | same stiffness problem as heat |
| Radial moisture | explicit, conservative face fluxes | as above |
| Evaporation, Maillard, char, setting, rise | explicit, after diffusion | cheap, and needs the post-diffusion temperature |

`dt` is set from the radial limit with a 0.35 safety factor and capped at 0.25 s. In
practice it runs at the cap. A 120 s bake is ~500 steps and solves in ~200 ms.

**This was the single biggest engineering decision.** Fully explicit, the same bake needs
120,000 steps.

---

## 3. The five defects that shaped the model

Recorded because each one looked plausible while being wrong.

### 3.1 A clamp hiding an instability
`D_WATER = 1.8e-8` over a 42 µm cell gives `D/dz² ≈ 2.5 s⁻¹`. At `dt = 0.25 s` the explicit
moisture step was far past its stability limit (~0.1 s), oscillated negative, and
`Math.max(0, …)` silently **destroyed water**. The symptom was water loss pinned at 54.7 %
regardless of bake time — a suspiciously round constant. Fixed by going implicit in `z`.

> A clamp that hides an instability is the worst kind of bug, because the output still
> looks like physics.

### 3.2 Diffusion ran the wrong way
Plain Fickian diffusion moves water **toward** whatever is driest — so the hot dry crust
continuously sucked moisture back out of the crumb and no crust ever formed. Real baking is
the opposite: a superheated dry zone sits at a **higher** vapour pressure than the crumb,
so net flux is outward.

Fix: a directional gate. Water may always leave a cell, but may only enter one still below
about 120 °C.

    gate(c) = clamp01((105 − T_c) / 20)

This one line is what produces an evaporation front, a crust, and therefore browning.

### 3.3 The underside is not a free surface
Exposed faces are vapour sinks and must not be resupplied at the interior rate, or no
surface crust forms. But the **underside is pressed against stone** — its steam has nowhere
to go but back into the crumb. Treating it as exposed dried the base in under ten seconds
and charred every single bake to 100 %.

Only the top face and the outer side get the 0.15 resupply factor.

### 3.4 Kinetics calibrated against the wrong temperature
A trace of the top cell in a 400 °C oven:

    t= 10s  T=65 C   W=0.700
    t= 30s  T=100 C  W=0.688
    t= 60s  T=100 C  W=0.329
    t=100s  T=133 C  W=0.000

The surface reaches **133 °C**, not 400 °C, because the wet crumb beneath it is pinned at
100 °C and conducts heat away faster than radiation delivers it. Constants tuned for 400 °C
gave `k ≈ 10⁻⁶ s⁻¹` at the real surface temperature: browning was mathematically impossible.

Recalibrated against 150–200 °C, where bread actually browns. Dry-crust conductivity was
also dropped from 0.09 to 0.055 W/m·K, which is what a real bread crust measures.

### 3.5 Foldability depended on the grid
Using `max(charTop, charBase)` meant one 0.2 mm charred cell zeroed a 2 mm lahmacun — and
the answer changed if you changed `NZ`. Replaced by the **charred fraction of the dough's
thickness**, which is both physically meaningful and resolution-independent.

---

## 4. Constants

| Symbol | Value | Source |
|---|---|---|
| `LV` | 2.26e6 J/kg | standard |
| `CP_WATER` | 4186 J/kg·K | standard |
| `CP_DRY_DOUGH` / `CP_DRY_MEAT` | 1600 / 1900 J/kg·K | typical solids |
| `RHO_DOUGH` / `RHO_MEAT` | 1150 / 1050 kg/m³ | typical bulk |
| `K_DOUGH` wet→dry | 0.45 → 0.055 W/m·K | crumb → crust |
| `K_MEAT` wet→dry | 0.48 → 0.070 W/m·K | |
| `D_WATER` | 4.0e-9 m²/s, ×(1+5·f(T)) | effective, includes vapour transport |
| `MAILLARD_A / EA` | 2.92e3 / 5.00e4 | **tuned**, surface-temperature anchored |
| `CHAR_A / EA` | 1.00e3 / 5.49e4 | **tuned** |
| `W_MAILLARD` dough / meat | 0.18 / 0.40 | meat browns at higher water activity |
| `W_BRITTLE` / `W_PLIABLE` | 0.04 / 0.24 | **tuned** to the foldability cliff |
| contact `taş / sac / tepsi` | 150 / 380 / 120 W/m²·K | hearth contact resistance is real |
| radiant `taş / konveyör / ev / sac` | 95 / 150 / 75 / 25 | a griddle has no top heat |

Anything marked **tuned** is a calibration knob, not a measured kinetic constant. The site
says so out loud, in three places.

---

## 5. Calibrated reference

Şanlıurfa preset, 430 / 320 °C:

| Süre | Katlanabilirlik | Su kaybı | Kızarma | Alt yanma | Sonuç |
|---|---|---|---|---|---|
| 60 s | 0.97 | 10.1 % | 0.04 | 0.00 | çiğ, soluk |
| **120 s** | **0.73** | **22.4 %** | **0.30** | **0.19** | **hedef** |
| 150 s | 0.60 | 27.5 % | 0.78 | 0.35 | iyi pişmiş |
| 300 s | 0.05 | 47.4 % | 1.00 | 1.00 | kraker |

**22.4 % water loss at the target** is the number that matters: real lahmacun loses 20–25 %.
That figure was not tuned for directly — it fell out of the transport model once the four
defects above were fixed, which is the closest thing to validation this project has.
