# LAHMACUN LAB — Project Requirements

**Status:** Draft v1 · 2026-09-15
**Repo:** `CankatSarac/lahmacun-lab`
**Deploy:** GitHub Pages → `cankatsarac.github.io/lahmacun-lab/`
**Language:** Turkish only (UI + content). Source strings are Turkish; no i18n layer.

---

## 1. What this is

An interactive **physics playground for lahmacun**. The user picks a regional style,
edits the dough / topping / oven parameters, fires the oven, and watches a live
cross-section of the bake: heat moving up from the stone, water leaving the meat
layer, the surface browning, and the dough slowly losing the moisture that lets it
fold.

It is **not** a recipe calculator and **not** a doneness or food-safety tool. It is an
argument-starter backed by a real (but uncalibrated) transport model.

The honesty line, kept verbatim in spirit from the reference work:
> **Fizik temelli. Mutfakta doğrulanmamış.**

### 1.1 Provenance and originality

This project is a **conceptual reverse-engineering** of `andreabertoncini.com/pizza-lab/`
(*CORNICIONE*). What we adopt is the **interaction design pattern**:

- precompute the whole bake in a Worker, then scrub a timeline through frames;
- a 2D cross-section canvas with swappable scalar fields;
- preset styles → free parameters → fork-and-compare;
- explicit, repeated admission that the model is illustrative.

What we **do not** take: their HTML, CSS, JS, `physics.wasm` binary, copy, imagery, or
colour tokens. **No file from that site is copied into this repo.** The solver is written
from scratch against standard food-engineering transport equations (§4), the visual
language is our own, and the domain model is re-derived for a flatbread, which has
different governing physics from a Neapolitan pizza (§3).

---

## 2. Element-by-element parity with the reference

Everything the reference has, we keep — mapped onto lahmacun. This is the checklist the
build is measured against.

| # | Reference element | Lahmacun Lab equivalent | Notes |
|---|---|---|---|
| 1 | Brand + "THE DOUGH LAB" | `LAHMACUN LAB` + `HAMUR LABORATUVARI` | |
| 2 | Preset style dropdown (11 styles) | 11 regional Turkish styles (§5) | Şanlıurfa → konveyör |
| 3 | Style photo + region + tagline + description | same, Turkish, per style | |
| 4 | Reset button | `Sıfırla ↺` | |
| 5 | Section 01 dough sliders | 01 / HAMUR — 6 sliders | §6 |
| 6 | Section 02 topping sliders | 02 / İÇ HARÇ — 4 sliders | §6 |
| 7 | Section 03 oven sliders + oven-type buttons | 03 / FIRIN — 2 sliders + 4 oven types | §6 |
| 8 | Geometry select (free / pan) | Pişirme yüzeyi: `taş` / `sac` / `tepsi` | changes floor contact + edge BC |
| 9 | "Fire the oven" primary CTA | `▶ Fırını yak` | |
| 10 | Live cross-section canvas | same; radial slice merkez → kenar | 96×24 grid |
| 11 | 4 visual field tabs (Crumb/Heat/Moisture/Structure) | `Kesit` / `Isı` / `Nem` / `Yapı` | |
| 12 | "2,304 thermal cells" readout | `2.304 ısı hücresi` | identical grid size |
| 13 | Inspect-rim toggle | `Kenarı incele` | zooms the bare outer edge |
| 14 | Orbit camera: drag/zoom/pan + keyboard | same, plus `Görünümü sıfırla` | |
| 15 | Colour legend with stops + note | same, Turkish | |
| 16 | Bake-time input (min + sec) | `Pişirme süresi`, 10 sn – 20 dk | shorter range: lahmacun is fast |
| 17 | Timeline scrubber + play + clock + duration | same | |
| 18 | Speed multiplier 1×/5×/15×/50×/100× | same | |
| 19 | Milestone strip (DOUGH/SPRING/SETTING/CRUST) | `HAMUR` / `BUHAR` / `HARÇ PİŞER` / `KENAR KIZARIR` | re-derived |
| 20 | 4 metric tiles | 4 metric tiles, re-derived (§3.2) | |
| 21 | Char severity top/base | `Yanma şiddeti · Üst / Alt` | |
| 22 | Topping status line | `Harç durumu` line | |
| 23 | "What's happening in there?" insight | `İÇERİDE NE OLUYOR?` | rule-based narration |
| 24 | Fork / pin + A-vs-B comparison | `＋ Bu pişirmeyi çatalla` | |
| 25 | 3 challenge buttons ("pick a fight") | 3 challenge buttons (§8) | |
| 26 | Share experiment (URL state) | `Deneyi paylaş ↗` | URL-encoded params |
| 27 | "The science" modal | `Bilim ↗` modal | model + limits |
| 28 | Feedback / record-a-real-bake | `Gerçek bir pişirme bildir ↗` | GitHub issue link |
| 29 | Random-style link | `← Rastgele` | |
| 30 | Experimental-model badge + disclaimers | `DENEYSEL MODEL` | |
| 31 | Language toggle | **dropped** — Turkish only, by decision | |
| 32 | Compiled WASM solver | **replaced** by original JS solver in a Worker | |

Two deliberate deviations (31, 32) are recorded in §10.

---

## 3. Domain re-derivation: why lahmacun is not a thin pizza

### 3.1 The physics actually differs

| | Neapolitan pizza | Lahmacun |
|---|---|---|
| Dough thickness | 3–25 mm rim, 2–20 mm centre | **1–6 mm, uniform** |
| Leavening | 2–72 h, oven spring is the story | **0–24 h, barely leavened** |
| Rim / cornicione | the defining feature | **does not exist** |
| Topping | cooked/acidic, sits on top | **raw minced meat — must cook through** |
| Topping vs dough mass | topping is secondary | **topping is often thicker and heavier than the dough** |
| Dominant heat path | radiant from dome | **conduction from the stone floor** |
| Bake | 60–1500 s | **60–480 s** |
| Success criterion | open crumb, leopard spotting | **it must roll up without cracking** |

The consequence: *rim height* and *oven spring* are meaningless here and are removed.
The meat layer becomes the dominant thermal mass and moisture reservoir — it is a wet
blanket that both **protects the dough from the top heat** and **feeds it water**. And
the outcome everyone actually judges is **foldability**.

### 3.2 The four headline metrics (replacing the reference's four)

| Tile | Turkish | Replaces | Definition |
|---|---|---|---|
| 1 | **Katlanabilirlik** | Rim height | Signature metric. Can it be rolled without cracking? §4.6 |
| 2 | **Harç iç sıcaklığı** | Rim core | Coldest point of the meat layer, °C |
| 3 | **Su kaybı** | Water lost | % of initial dough+topping mass |
| 4 | **Yüzey kızarması** | Surface browning | Maillard progress, 0–100 % |

Plus secondary readouts: `Harç pişme` (meat doneness), `Hamur kalınlığı`,
`Yanma şiddeti üst/alt`, and a `Harç durumu` line.

**Katlanabilirlik is the point of the tool.** It is the metric that makes the two classic
mistakes visible: bake it too long and it goes to 0 (a cracker); bake it in a home oven
and it never gets high in the first place.

---

## 4. Physics model

2D axisymmetric slice, radius `r ∈ [0, R]` × height `z ∈ [0, H_i]`, on a **96 × 24**
grid (2,304 cells — same resolution as the reference, for the same reason: it is the
largest grid that resolves a 2 mm dough and still solves in about a second).

Per cell we carry four fields: `T` (°C), `W` (water mass fraction of local mass),
`S` (set / structure, 0–1), `G` (gas / porosity, 0–1). Per column we additionally track
surface browning and char.

### 4.1 Geometry
Column `i` has normalised radius `r_i = (i + ½)/N_x`. Physical radius is `r_i · Ç/2`,
where `Ç` is the diameter. Stack height `H_i = h_hamur + h_harç · covered_i`, where
`covered_i = [ r_i ≤ kaplama/100 ]` softened over one cell so the topping edge is not a
step function. Vertical cells are `N_z` equal slices of `H_i`, each tagged **dough** or
**topping** by its centre.

### 4.2 Heat
    ρ c ∂T/∂t = (1/r) ∂/∂r ( r k ∂T/∂r ) + ∂/∂z ( k ∂T/∂z ) − L_v · ṁ_evap

with water-dependent properties, linearly blended between wet and dry:

| | ρ (kg/m³) | k wet → dry (W/m·K) | c wet → dry (J/kg·K) |
|---|---|---|---|
| Dough | 1150 | 0.45 → 0.09 | 3000 → 1500 |
| Topping (meat) | 1050 | 0.48 → 0.12 | 3500 → 1900 |

Fat fraction in the topping lowers `c` and raises `k` slightly; it is also what makes a
fatty topping brown faster.

### 4.3 Boundary conditions
- **`r = 0`** — symmetry, zero flux.
- **`z = 0` (floor)** — contact conductance with the baking surface at `T_taban`:
  `q = h_c (T_taban − T)`, with `h_c` = 450 (taş), 900 (sac — metal, much tighter
  contact), 250 (tepsi) W/m²·K.
- **`z = H` (top)** — radiation + convection:
  `q = ε σ φ (T_üst⁴ − T⁴) + h_conv (T_üst − T)`, ε = 0.90, `φ` = oven radiant factor
  (taş 95, konveyör 150, ev 75, sac 25 — a griddle has almost no top heat, which is
  exactly why sac lahmacun is a different food).
- **`r = R` (outer edge)** — exposed on **three** sides. This is why the bare edge
  always burns first, and the model should show that clearly.

### 4.4 Moisture
Internal diffusion `∂W/∂t = ∇·(D ∇W)` with `D ≈ 1.2e-9 m²/s`, scaled by temperature.
Two sinks:
- **Boiling** — above the local boiling point, surplus enthalpy converts to vapour at
  `L_v = 2.26e6 J/kg` instead of raising `T`. This is what pins wet cells near 100 °C.
- **Sub-boiling surface drying** — exposed cells lose water at a rate driven by the
  vapour-pressure gap to the oven air, so a slow home-oven bake dries the dough without
  ever browning it. That asymmetry is the whole "ev fırını" lesson.

Topping water migrating *down* into the dough is modelled explicitly: it is why heavy,
wet topping gives a soggy base.

### 4.5 Browning and char
Maillard on exposed surface cells only, gated on dryness:

    d(brown)/dt = A · exp(−E_a / (R (T+273.15))) · max(0, 1 − W/W_crit)

with `E_a` ≈ 1.1e5 J/mol, `W_crit` = 0.18. Char accumulates once `brown > 0.85` and the
cell is dry, on a steeper Arrhenius term. Char is reported as a **mean severity**, not a
burned area, and is labelled a heuristic in the UI.

### 4.6 Katlanabilirlik (foldability) — the signature model
Per dough column `i`, mean water fraction `w_i`:

    esneklik_i = clamp01( (w_i − W_kırılgan) / (W_esnek − W_kırılgan) ) · (1 − char_i)²

with `W_kırılgan` = 0.06 and `W_esnek` = 0.20. Char is squared because a blackened patch
is brittle no matter how wet its neighbours are.

A lahmacun cracks at its **weakest** point when rolled, so the index is deliberately
pessimistic — a soft minimum rather than a mean:

    Katlanabilirlik = 0.40 · mean(esneklik) + 0.60 · p₁₀(esneklik)

Uncalibrated heuristic; labelled as such in the UI.

### 4.7 Harç pişme (meat doneness)
Smooth time–temperature integral, not a safety test:

    d(pişme)/dt = σ( (T − 62) / 4 ) / 25 s          σ = logistic

Reported as the **minimum over the topping layer**, because the raw spot is the one that
matters.

### 4.8 Numerics
Explicit forward-Euler in time, second-order central in space. Time step from the
diffusion stability limit with a 0.35 safety factor:
`dt ≤ 0.35 · min(dz², dr²) / (4 α_max)` — roughly 10 ms for a 2 mm dough. A 180 s bake is
about 18,000 steps × 2,304 cells ≈ 41 M cell-updates, which is ~1 s of JS.

The Worker snapshots **~360 frames** regardless of duration and transfers them back as
`Float32Array`s (zero-copy). The main thread then only scrubs. Same trick as the
reference, and the reason playback feels instant.

---

## 5. The eleven styles

Schema: `[ad, yöre, başlık, açıklama, hidrasyon, protein, mayalanma_s, hamur_mm,
çap_cm, yağ%, harç_mm, harçSu%, kaplama%, kıymaYağ%, üst°C, taban°C, süre_sn, fırın]`

| # | Ad | Yöre | Karakter |
|---|---|---|---|
| 01 | Şanlıurfa Lahmacunu | ŞANLIURFA | İsotlu, çok ince, çok sıcak taş fırın. 100 sn. |
| 02 | Gaziantep Lahmacunu | GAZİANTEP | Sarımsaklı, kuyruk yağlı, daha yağlı harç. |
| 03 | Kilis Lahmacunu | KİLİS | Büyük çap, bol harç, biraz daha kalın hamur. |
| 04 | Adana Lahmacunu | ADANA | İnce hamur, acı harç, kısa pişirme. |
| 05 | Hatay Lahmacunu | HATAY | Nar ekşisi ve zeytinyağı; daha yaş harç. |
| 06 | Diyarbakır Lahmacunu | DİYARBAKIR | Bol maydanozlu, orta kalınlık. |
| 07 | Mardin Lahmacunu | MARDİN | Baharatlı, biraz daha uzun pişen. |
| 08 | Konya Etli Ekmek | KONYA | Kalın ve uzun; kesit burada bir şeridi temsil eder. |
| 09 | Sac Lahmacun | KIRSAL / SAC | Üstten ısı neredeyse yok. Tamamen taban işi. |
| 10 | Ev Fırını Lahmacunu | EV MUTFAĞI | 270 °C, 8 dk. Kurur, kızarmaz. Ders burada. |
| 11 | Zincir Dükkân | KONVEYÖR | Konveyör fırın uzlaşması. Tutarlı ama donuk. |

Style 08 (Konya etli ekmek) is oval and 09 (sac) is cooked on metal — both are flagged in
their description as approximations, following the reference's habit of naming its own
simplifications rather than hiding them.

---

## 6. Controls

### 01 / HAMUR
| id | Etiket | Aralık | Adım | Birim | Uçlar |
|---|---|---|---|---|---|
| `hidrasyon` | Hidrasyon | 48–72 | 1 | % | Sıkı · Yumuşak |
| `protein` | Un proteini | 9–14 | 0.5 | % | Yumuşak · Kuvvetli |
| `mayalanma` | Mayalanma · 23 °C | 0–24 | 1 | sa | Mayasız · Dinlenmiş |
| `hamur` | Hamur kalınlığı | 1–6 | 0.5 | mm | Yufka gibi · Kalın |
| `cap` | Çap | 18–40 | 1 | cm | Küçük · Kilis usulü |
| `yag` | Hamurda yağ | 0–6 | 0.5 | % | Yağsız · Yağlı |

### 02 / İÇ HARÇ
| id | Etiket | Aralık | Adım | Birim | Uçlar |
|---|---|---|---|---|---|
| `kaplama` | Harç kaplama | 0–100 | 1 | % | Çıplak · Kenara kadar |
| `harc` | Harç kalınlığı | 0–8 | 0.5 | mm | Çıplak hamur · Bol harç |
| `harcSu` | Harç su oranı | 40–85 | 1 | % | Kuru · Sulu |
| `kiymaYag` | Kıyma yağ oranı | 5–35 | 1 | % | Yağsız · Kuyruk yağlı |

### 03 / FIRIN
| id | Etiket | Aralık | Adım | Birim |
|---|---|---|---|---|
| `ust` | Üst ısı | 180–520 | 5 | °C |
| `taban` | Taban ısı | 150–500 | 5 | °C |

Oven type buttons: **Taş fırın · Konveyör · Ev fırını · Sac**
(radiant factor 95 / 150 / 75 / 25).
Baking surface select: **Taş · Sac · Tepsi** (contact conductance 450 / 900 / 250).

---

## 7. Screen layout

    ┌ header ─ LAHMACUN LAB · HAMUR LABORATUVARI  │ ← Rastgele · Bilim ↗ · Deneyi paylaş ↗ ┐
    ├ intro ── "Hamurun içine gir."  · DENEYSEL MODEL ──────────────────────────────────────┤
    │ ┌ controls ────────┐ ┌ stage ──────────────────────────────────────────────────────┐ │
    │ │ 01 / HAMUR       │ │ CANLI HAMUR KESİTİ      Şanlıurfa / 01      [motor durumu]  │ │
    │ │  [style select]  │ │ [Kesit][Isı][Nem][Yapı]        2.304 ısı hücresi · Kenarı.. │ │
    │ │  [photo/region]  │ │ ┌───────── canvas: MERKEZ ────────────── KENAR ──────────┐ │ │
    │ │  6 sliders       │ │ │  radial slice, vertical scale enlarged                 │ │ │
    │ │ 02 / İÇ HARÇ     │ │ └────────────────────────────────────────────────────────┘ │ │
    │ │  4 sliders       │ │ [legend] · [süre] · ▶ [────timeline────] 1:40 · [15×]      │ │
    │ │ 03 / FIRIN       │ │ HAMUR · BUHAR · HARÇ PİŞER · KENAR KIZARIR                  │ │
    │ │  oven buttons    │ │ ┌Katlanabilirlik┐┌Harç iç ısı┐┌Su kaybı┐┌Yüzey kızarması┐   │ │
    │ │  2 sliders       │ │ Yanma şiddeti · Üst 12% · Alt 31%                           │ │
    │ │ ▶ Fırını yak     │ │ ✳ İÇERİDE NE OLUYOR? …                                      │ │
    │ └──────────────────┘ │ Bir değişiklik. Başka bir lahmacun.  ＋ Bu pişirmeyi çatalla │ │
    ├ below ── "ON BİR USUL. SIFIR KUTSAL İNEK."  3 challenge buttons ─────────────────────┤
    └ footer ── Fizik temelli. Mutfakta doğrulanmamış. ────────────────────────────────────┘

Responsive: single column below 980 px, canvas keeps a 16:9 min-height.

---

## 8. Challenges ("Bir iddiayla kavga et")

| İddia | Test | Beklenen ders |
|---|---|---|
| "Daha çok harç, daha lezzetli." | Harç 2 → 7 mm | Hamur ıslak kalır, harç iç sıcaklığı düşer, katlanabilirlik yükselir ama alt pişmez |
| "Fırını iyice kızdır, 1 dakikada çıksın." | Üst 400 → 520 °C | Çıplak kenar yanar, harç merkezi hâlâ çiğ |
| "Ev fırınında da olur." | Ev fırını preset | Kızarma gelmeden su biter → katlanabilirlik çöker |

---

## 9. Technical stack

- **Vanilla ES modules. No framework, no bundler, no build step.** Deployable by copying
  the folder — same property that makes the reference robust.
- `node:test` + `node:assert` for the solver. No test dependency either.
- GitHub Actions → GitHub Pages.
- Zero runtime dependencies. `package.json` exists only for `npm test`.

```
lahmacun-lab/
├── index.html          semantic markup, all Turkish copy
├── style.css           hand-written, dark, no framework
├── app.js              orchestration: state, presets, controls, metrics, narration
├── recipes.js          the 11 styles + control definitions
├── physics.js          THE SOLVER — pure, isolated, Node-testable
├── solver-worker.js    Worker wrapper: init → advance → snapshot frames
├── render.js           canvas cross-section renderer + seeded pore geometry
├── camera.js           orbit / zoom / pan
├── fields.js           colour ramps + legends
├── test/physics.test.mjs
├── plan/               these documents
└── .github/workflows/pages.yml
```

`physics.js` is deliberately free of DOM and Worker globals so the same file runs under
`node --test`. That is the single most important structural decision in the repo: the
physics is the part that can be wrong in subtle ways, so it must be testable.

---

## 10. Deliberate deviations from the reference

1. **No language toggle.** Turkish only, by decision. Removes `i18n.js` entirely.
2. **No WASM.** An original JS solver in a Worker, behind the identical
   `init / advance / state_ptr`-shaped boundary. A Rust→WASM port stays viable as a
   drop-in later; §9's worker contract is the seam.
3. **Rim mechanics removed.** Replaced by foldability + meat doneness (§3).
4. **Four oven types instead of three**, because `sac` genuinely has no top heat.
5. **Diameter is a parameter.** Kilis vs Adana is partly a geometry story.

---

## 11. Acceptance criteria — verified

**Physics** — `npm test`, 23 tests, all passing
- [x] Water is never created; loss is monotone and bounded
- [x] Equilibrium: held at a uniform boundary temperature, every cell converges to it
- [x] Adiabatic: oven at ambient changes nothing
- [x] Monotone: mean temperature non-decreasing in a hot oven
- [x] Bounds: `T ∈ [0, 700]`, all normalised fields in `[0, 1]` at every step
- [x] Stability: no NaN/Inf at both extremes of all 12 sliders, and for all 11 presets
- [x] Determinism: identical inputs give bit-identical frames
- [x] Clock advances exactly as requested
- [x] A 180 s bake solves well under 2 s (measured ~200 ms for 120 s)

**Behavioural** — the model reproduces known lahmacun outcomes
- [x] Reference bake at 120 s: 73 % foldability, 22.4 % water loss, not yet burnt
- [x] Same bake at 400 s: foldability < 15 % — a cracker
- [x] Foldability is monotone decreasing once the bake is under way
- [x] Home oven dries more, browns less, and costs foldability versus a stone
- [x] Griddle chars the base far more than the top
- [x] Thicker topping leaves a colder meat core (87 °C vs 100 °C)
- [x] Wetter topping holds its water and browns later
- [x] The bare edge chars before the covered centre
- [x] A hotter oven browns sooner; a thicker dough heats through more slowly

**UI** — verified headless against the live deployment
- [x] All reference elements present per §2, minus the two declared drops
- [x] Every string Turkish and correctly encoded (ı İ ş ğ ü ö ç ç)
- [x] Works at 400 px; no horizontal overflow
- [x] Keyboard: canvas focusable, arrows rotate, ± zoom, Home resets
- [x] URL round-trips full state via `Deneyi paylaş`
- [x] No console errors, no page errors, no failed requests
- [x] All four field views, legend toggling, timeline scrubbing, preset switching,
      science modal, fork/compare and all three challenges exercised end to end

**Calibration**
- [x] 22.4 % water loss at the target bake, against a real-world 20–25 %. Not tuned for
      directly; it fell out of the transport model. See `01-physics-model.md` §5.

---

## 12. Known limitations

1. The rim is bare dough exposed on three faces and chars to ~95 % at the reference bake.
   Real bakers turn the lahmacun; the model does not, so it punishes long bakes harder
   than a competent usta would. Listed in the roadmap.
2. Radial conduction is taken between equal `j`, which is approximate where the topping
   edge steps down.
3. Konya etli ekmek is oval and Sac lahmacun is cooked on metal; both are approximated and
   say so in their own descriptions.
4. Maillard, char and the foldability thresholds are tuned calibration knobs, not measured
   kinetics. The site says so in three separate places.
