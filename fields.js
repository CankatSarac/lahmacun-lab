// Colour ramps for the scalar fields. The renderer and the on-screen legend read the same
// stops, so the legend can never drift out of sync with what is drawn.

export const fields = {
  isi: {
    baslik: 'Sıcaklık (°C)',
    stops: [[20, [38, 78, 140]], [100, [52, 167, 181]], [200, [238, 201, 84]],
            [300, [243, 122, 46]], [400, [178, 40, 46]], [520, [255, 219, 212]]],
    etiketler: ['20', '100', '200', '300', '400', '520'],
    not: 'Soğuk mavi → sıcak sarı → turuncu/kırmızı → çok sıcak açık pembe. Hamur ve harç aynı ölçeği kullanır.',
  },
  nem: {
    baslik: 'Su içeriği (anlık kütlenin yüzdesi)',
    stops: [[0, [140, 88, 38]], [0.25, [116, 122, 100]], [0.5, [74, 160, 160]],
            [0.75, [36, 174, 200]], [1, [150, 232, 255]]],
    etiketler: ['%0', '%25', '%50', '%75', '%100'],
    not: 'Kahverengi kuru, mavi ıslak. Su kütlesi, kalan su ile katı maddenin toplamına bölünür.',
  },
  yapi: {
    baslik: 'Yapının oturması (model ilerlemesi)',
    stops: [[0, [70, 84, 56]], [0.5, [144, 136, 94]], [1, [216, 190, 130]]],
    etiketler: ['%0', '%50', '%100'],
    not: 'Koyu yeşil oturmamış hamur, altın rengi oturmuş hamur. Bu bir pişmişlik ya da gıda güvenliği testi değildir.',
  },
};

export const modellenmemisRenk = [117, 117, 117];

export function fieldColor(view, value) {
  const stops = fields[view].stops;
  const v = Math.max(stops[0][0], Math.min(stops.at(-1)[0], value));
  let j = 1;
  while (j < stops.length - 1 && v > stops[j][0]) j++;
  const [lo, a] = stops[j - 1], [hi, b] = stops[j];
  const mix = (v - lo) / (hi - lo);
  return a.map((x, i) => x + (b[i] - x) * mix);
}

export function legendGradient(view) {
  const stops = fields[view].stops;
  const lo = stops[0][0], span = stops.at(-1)[0] - lo;
  return `linear-gradient(to right, ${stops
    .map(([v, c]) => `rgb(${c.join(',')}) ${((v - lo) / span) * 100}%`).join(', ')})`;
}

/**
 * Darken a colour toward charcoal. `pattern` is a per-cell seeded value so the mottling is
 * reproducible: this is illustrative texture, not a prediction of where individual burn
 * spots will land.
 */
export function charredColor(color, severity, pattern = 0.5) {
  const c = Math.max(0, Math.min(1, severity));
  const patch = Math.max(0, Math.min(1, (c - (0.12 + pattern * 0.55)) / 0.3));
  const mix = Math.min(1, c * 0.65 + patch * 0.7);
  return color.map((v, i) => v * (1 - mix) + [20, 16, 14][i] * mix);
}

/** Longer bakes should not be watched in real time. */
export const varsayilanHiz = (sure) => (sure >= 420 ? 50 : sure >= 200 ? 25 : 10);
