# LAHMACUN LAB — Hamurun içine gir

İnteraktif bir **lahmacun pişirme fiziği** oyun alanı. Bir yöresel usul seçin, hamuru,
harcı ve fırını değiştirin, fırını yakın; ısının taştan yukarı çıkışını, suyun harçtan
ayrılışını, yüzeyin kızarışını ve hamurun katlanabilirliğini yitirişini canlı kesitte
izleyin.

**Fizik temelli. Mutfakta doğrulanmamış.** Bu bir tarif hesaplayıcısı ya da gıda güvenliği
aracı değildir; tartışma başlatmak için yapılmış bir modeldir.

🔗 **[cankatsarac.github.io/lahmacun-lab](https://cankatsarac.github.io/lahmacun-lab/)**

---

## Ne yapıyor

Merkezden kenara alınmış eksenel simetrik bir kesit, **96 × 24 = 2.304 hücrede** çözülüyor.
Her hücre sıcaklık, su, yapı ve gaz taşıyor. Tüm pişirme bir Web Worker içinde önceden
hesaplanıp 360 kareye dönüştürülüyor; sonrasında zaman çizelgesinde gezinmek anlık.

### Ölçülenler

| Gösterge | Ne söyler |
|---|---|
| **Katlanabilirlik** | Rulo yapılırken kırılır mı? Bu aracın asıl sorusu. |
| Harç iç sıcaklığı | Harcın en soğuk noktası — çiğ kalan yer orasıdır |
| Su kaybı | Hamur + harç kütlesinin yüzdesi. Gerçek lahmacun %20–25 kaybeder |
| Yüzey kızarması | Maillard ilerlemesi; kuruyan bir yüzeyin işidir |
| Yanma şiddeti | Üst ve alt, ayrı ayrı |

Lahmacun pizza değildir: kenarı yoktur, hamuru 2 mm’dir, harcı çiğdir ve hamurdan ağır
olabilir, ısı ağırlıklı olarak **tabandan** gelir. Bu yüzden model, pizza için anlamlı olan
*kenar yüksekliği* ve *fırın sıçraması* yerine **katlanabilirlik** ve **harç pişme**
üzerine kuruldu.

## On bir usul

Şanlıurfa · Gaziantep · Kilis · Adana · Hatay · Diyarbakır · Mardin ·
Konya Etli Ekmek · Sac Lahmacun · Ev Fırını · Zincir Dükkân

## Çalıştırma

```bash
git clone https://github.com/CankatSarac/lahmacun-lab.git
cd lahmacun-lab
npm test          # 23 fizik testi, hiçbir bağımlılık gerekmez
npm run serve     # http://localhost:8080
```

Derleme adımı yok, paket yok, bağımlılık yok. Klasörü kopyalayın, çalışır.

## Yapı

```
index.html   app.js         arayüz orkestrasyonu
physics.js   çözücü — DOM’suz, Node’da test edilebilir
solver-worker.js            Worker sınırı: init → advance → snapshot
render.js    camera.js      kesit çizimi ve kamera
recipes.js   fields.js      usuller ve renk ölçekleri
plan/                       gereksinimler, fizik modeli, yol haritası
```

`physics.js` bilerek DOM ve Worker global’lerinden arındırıldı: aynı dosya tarayıcıda ve
`node --test` altında çalışıyor. Sessizce yanlış olabilecek kısım fizik olduğu için, o
kısmın yalıtılmış hâlde test edilebilmesi gerekiyordu.

## Katkı

En değerli katkı **gerçek bir pişirme**: usul, fırın, sıcaklık, süre, pişirme öncesi ve
sonrası ağırlık. Ağırlık kaybı yüzdesi, taşıma modelini doğrudan sınayan en ucuz veridir.
[Bir kayıt açın](https://github.com/CankatSarac/lahmacun-lab/issues/new).

---

## English

An interactive **lahmacun baking physics** playground. Pick a regional style, change the
dough, topping and oven, then fire it and watch a live cross-section: heat climbing from
the stone, water leaving the meat layer, the surface browning, and the dough losing the
moisture that lets it fold.

It is a conceptual reverse-engineering of the interaction design of
[CORNICIONE / Pizza Lab](https://andreabertoncini.com/pizza-lab/) — precompute in a worker,
scrub a timeline, swap scalar fields, fork and compare, and say plainly that the model is
illustrative. **No code, asset or binary from that project is used here.** The solver is
written from scratch against standard transport equations, and the domain model is
re-derived for a flatbread, whose governing physics genuinely differ from a Neapolitan
pizza: no rim, a 2 mm dough, a raw meat topping that often outweighs it, and floor-dominated
heating. The success criterion is not an open crumb — it is whether the thing rolls up
without cracking.

Method, calibration, and the five modelling defects that shaped the result are documented
in [`plan/01-physics-model.md`](plan/01-physics-model.md).

MIT licensed.
