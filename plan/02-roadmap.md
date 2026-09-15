# Roadmap

## Done — v1.0

- [x] 2D transport solver, 96 × 24, semi-implicit, 23 passing tests
- [x] Web Worker precompute → 360 frames → timeline scrubbing
- [x] 11 regional Turkish styles
- [x] 12 sliders + 4 oven types + 3 baking surfaces
- [x] 4 visual fields (Kesit / Isı / Nem / Yapı) with legends
- [x] Orbit / zoom / pan camera, keyboard accessible
- [x] Katlanabilirlik, harç iç sıcaklığı, su kaybı, yüzey kızarması
- [x] Yanma şiddeti (üst / alt), harç durumu, rule-based narration
- [x] Fork + A/B comparison
- [x] 3 challenge presets, science modal, share link
- [x] Responsive to 400 px, no console errors

## Next

### Model
- [ ] Fat rendering as a distinct phase — kuyruk yağı behaves differently from lean kıyma
- [ ] Dough shrinkage during setting; currently only rise is modelled
- [ ] Turning the lahmacun mid-bake, which is what a real usta does and what the
      model currently punishes hardest (see the Sac preset)
- [ ] Oven humidity; a loaded stone oven is not dry
- [ ] Non-uniform rolling — real dough is thicker at the edge

### Validation
- [ ] Collect real bakes via the "Gerçek bir pişirme bildir" issue template:
      style, oven, temperature, time, photo, weight before/after
- [ ] Weight-loss percentage is the cheapest validation anyone can contribute
      and directly tests the transport model
- [ ] Publish a calibration note once there are ~20 real data points

### Engineering
- [ ] Rust → WASM port behind the existing worker contract (5–10× headroom)
- [ ] Offscreen canvas rendering to keep 60 fps while scrubbing on low-end phones
- [ ] Preset diffing in the URL so share links stay short

### Content
- [ ] More styles: Siirt, Malatya, Şırnak; Suriye/Halep lahmacunu as a comparison
- [ ] A short written piece on why foldability is the right success metric
