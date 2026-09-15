// Orchestration: presets, controls, the worker round-trip, timeline scrubbing, metrics and
// narration. The bake is precomputed once; everything after that is reading an array.

import { recipes, controls, ovens, surfaces, challenges, FIELDS } from './recipes.js';
import { fields, legendGradient, varsayilanHiz } from './fields.js';
import { drawSection } from './render.js';
import { attachCamera } from './camera.js';
import {
  SUMMARY, S_FOLD, S_MEATCORE, S_WATERLOSS, S_BROWN, S_DONE, S_THICK,
  S_CHARTOP, S_CHARBASE, S_TOPWATER, S_DOUGHCORE, S_SURFTEMP, S_BASETEMP, S_RISE, S_SOGGY, S_EDGECHAR,
} from './physics.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const pct = (v) => `%${Math.round(v * 100)}`;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const saat = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

let p = {};
let frames = [], times = [0], t = 0, playing = false, pinned = null;
let view = 'kesit', focus = false, hazir = false, bayat = true, son = 0;

// ---------------------------------------------------------------- worker
const worker = new Worker('solver-worker.js', { type: 'module' });
let jobId = 0, bekleyen = null;
worker.onmessage = ({ data }) => {
  if (!bekleyen || data.id !== bekleyen.id) return;
  if (data.error) { bekleyen.reject(new Error(data.error)); bekleyen = null; }
  else if (data.frames) { bekleyen.resolve(data); bekleyen = null; }
  else if (data.progress !== undefined) $('#pisir').textContent = `Hesaplanıyor %${Math.round(data.progress * 100)}…`;
};
worker.onerror = () => { if (bekleyen) { bekleyen.reject(new Error('Hesaplama işçisi çöktü')); bekleyen = null; } };
const solve = (params) => new Promise((resolve, reject) => {
  const id = ++jobId;
  bekleyen = { id, resolve, reject };
  worker.postMessage({ id, p: params });
});

// ---------------------------------------------------------------- controls
for (const [id, etiket, min, max, adim, birim, sol, sag, panel] of controls) {
  const div = document.createElement('div');
  div.className = 'control';
  div.innerHTML = `<div class="control-head"><label for="${id}">${etiket}</label><output id="${id}-deger"></output></div>`
    + `<input id="${id}" type="range" min="${min}" max="${max}" step="${adim}">`
    + `<small><span>${sol}</span><span>${sag}</span></small>`;
  $(`#${panel}-kontrol`).append(div);
  $(`#${id}`).oninput = (e) => {
    p[id] = +e.target.value;
    $(`#${id}-deger`).textContent = p[id] + birim;
    invalidate();
  };
}
$('#tarif').innerHTML = recipes.map((r, i) => `<option value="${i}">${String(i + 1).padStart(2, '0')} — ${r.ad}</option>`).join('');
$('#yuzey').innerHTML = surfaces.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
$('#firin-buttons').innerHTML = ovens.map(([v, l]) => `<button data-firin="${v}">${l}</button>`).join('');

function preset(i) {
  const r = recipes[i];
  p = { tarif: i };
  for (const f of FIELDS) if (!['ad', 'yore', 'baslik', 'aciklama'].includes(f)) p[f] = r[f];
  sync();
  $('#hiz').value = varsayilanHiz(p.sure);
  invalidate();
}

function sync() {
  const r = recipes[p.tarif];
  $('#tarif').value = p.tarif;
  $('#yore').textContent = r.yore;
  $('#baslik').textContent = r.baslik;
  $('#tarif-aciklama').textContent = r.aciklama;
  $('#sahne-baslik').innerHTML = `${r.ad} <span>/ ${String(p.tarif + 1).padStart(2, '0')}</span>`;
  for (const [id, , , , , birim] of controls) {
    $(`#${id}`).value = p[id];
    $(`#${id}-deger`).textContent = p[id] + birim;
  }
  $('#yuzey').value = p.yuzey;
  $$('#firin-buttons button').forEach((b) => b.classList.toggle('active', b.dataset.firin === p.firin));
  $('#dakika').value = Math.floor(p.sure / 60);
  $('#saniye').value = Math.round(p.sure % 60);
  $('#sure').textContent = saat(p.sure);
  $('#zaman').max = p.sure;
}

const invalidate = () => {
  bayat = true;
  $('#pisir').textContent = '▶   Fırını yak';
  $('#motor').textContent = 'Ayarlar değişti';
  $('#motor').classList.remove('busy');
};

// ---------------------------------------------------------------- bake
async function pisir() {
  if (bekleyen) return;
  playing = false;
  $('#oynat').textContent = '▶';
  $('#pisir').disabled = true;
  $('#motor').textContent = 'Hesaplanıyor…';
  $('#motor').classList.add('busy');
  try {
    const out = await solve({ ...p });
    frames = out.frames; times = out.times;
    hazir = true; bayat = false; t = p.sure;
    $('#motor').textContent = `${frames.length} kare · hazır`;
    $('#motor').classList.remove('busy');
    $('#pisir').textContent = '▶   Yeniden pişir';
    paint();
  } catch (e) {
    $('#motor').textContent = 'Fizik motoru başarısız';
    $('#yorum').textContent = `Hesaplama yapılamadı: ${e.message}. Sayfayı yenileyip tekrar deneyin.`;
  } finally {
    $('#pisir').disabled = false;
  }
}

const frameAt = (time) => {
  if (!frames.length) return null;
  let i = 0;
  while (i < times.length - 1 && times[i + 1] <= time) i++;
  return frames[i];
};

// ---------------------------------------------------------------- paint
const camera = attachCamera($('#hamur-canvas'), () => { paintCanvas(); updateZoom(); });
const updateZoom = () => { $('#zoom-seviye').textContent = `%${Math.round(camera.cam.zoom * 100)}`; };

function paintCanvas() {
  const a = frameAt(t);
  if (!a) return;
  drawSection($('#hamur-canvas'), a, p, view, camera.cam, focus);
}

function paint() {
  const a = frameAt(t);
  if (!a) return;
  paintCanvas();
  const g = (k) => a[SUMMARY + k];
  $('#saat').textContent = saat(t);
  $('#zaman').value = t;

  const fold = g(S_FOLD);
  $('#katlanabilirlik').textContent = pct(fold);
  $('#katlama-not').textContent = fold > 0.7 ? 'RAHAT RULO YAPILIR'
    : fold > 0.4 ? 'KATLANIR AMA ÇATLAR'
    : fold > 0.15 ? 'KIRILGAN' : 'KRAKER OLDU';
  $('#harc-ic').textContent = `${Math.round(g(S_MEATCORE))} °C`;
  $('#su-kaybi').textContent = `%${g(S_WATERLOSS).toFixed(1)}`;
  $('#kizarma').textContent = pct(g(S_BROWN));
  $('#yanma-ust').textContent = pct(g(S_CHARTOP));
  $('#yanma-alt').textContent = pct(g(S_CHARBASE));
  $('#yanma-kenar').textContent = p.kaplama < 100 ? pct(g(S_EDGECHAR)) : '—';

  $('#harc-durum').textContent = p.harc > 0 && p.kaplama > 0
    ? `Harç suyunun %${Math.round(g(S_TOPWATER) * 100)}’i duruyor · harç pişme ${pct(g(S_DONE))} · toplam kalınlık ${g(S_THICK).toFixed(1)} mm · taban ${Math.round(g(S_BASETEMP))} °C · yüzey ${Math.round(g(S_SURFTEMP))} °C`
    : `Çıplak hamur · harç deposu yok · toplam kalınlık ${g(S_THICK).toFixed(1)} mm · taban ${Math.round(g(S_BASETEMP))} °C`;

  const ms = [t > 0, g(S_RISE) > 1.02 || g(S_DOUGHCORE) > 70, g(S_DONE) > 0.5, g(S_BROWN) > 0.25];
  $$('.milestones span').forEach((s, i) => s.classList.toggle('on', ms[i]));

  $('#yorum').textContent = yorum(a, g);
  if (pinned) compare(a);
}

function yorum(a, g) {
  const fold = g(S_FOLD), brown = g(S_BROWN), done = g(S_DONE);
  const char = Math.max(g(S_CHARTOP), g(S_CHARBASE));
  if (t === 0) {
    return (p.kaplama > 0 && p.harc > 0
      ? `Harç kendi suyunu ve kendi ısı kütlesini taşıyor: ${p.harc} mm kalınlıkta, ağırlıkça %${p.harcSu} su. Hamurun üstündeki ıslak battaniye hem koruyor hem ıslatıyor. `
      : 'Çıplak hamur: fırın ısısı doğrudan yüzeye çarpıyor, emecek hiçbir su yok. ')
      + `Çıplak kenar üç yüzeyden birden ısınıyor; orada her zaman ilk yanan yer orasıdır.`;
  }
  if (p.kaplama < 99 && g(S_EDGECHAR) > 0.85 && char < 0.5) {
    return `Çıplak kenar %${Math.round(g(S_EDGECHAR) * 100)} kömürleşti, oysa üst yüzey daha ${pct(g(S_CHARTOP))}. Harçsız kenar üç yüzeyden birden ısınır ve arkasında ısıyı emecek su yoktur: her zaman ilk orası gider. Kaplamayı artırın ya da ısıyı düşürün.`;
  }
  if (char > 0.6) return `Kömürleşme ilerledi (üst ${pct(g(S_CHARTOP))}, alt ${pct(g(S_CHARBASE))}). Kurumuş bölgeler artık yanıyor. Yanma, yanan alanı değil ortalama şiddeti gösteren, kalibre edilmemiş bir göstergedir.`;
  if (fold < 0.2) return `Katlanabilirlik ${pct(fold)}. Hamurun suyu bitti; matris camsılaştı. Bu lahmacun artık rulo yapılırken kırılır. Su kaybı %${g(S_WATERLOSS).toFixed(1)}.`;
  if (done < 0.6) return `Harcın en soğuk noktası ${Math.round(g(S_MEATCORE))} °C ve pişme ${pct(done)}. Kalın ya da sulu harç, ısının içeri girmesini geciktirir: suyun buharlaşması ısıyı yutar.`;
  if (g(S_SOGGY) > 0.32) return `Harcın altındaki hamur hâlâ %${Math.round(g(S_SOGGY) * 100)} su içeriyor. Harç suyunu aşağı veriyor. Bu ıslaklık katlanabilirliği ayakta tutar ama tabanın çıtırlaşmasını engeller.`;
  if (brown > 0.65) return `Yüzey kızarması ${pct(brown)}, harcın iç sıcaklığı ${Math.round(g(S_MEATCORE))} °C. Yüzeydeki renk içerideki durumu ölçmez; kızarma kuruyan bir yüzeyin işidir.`;
  if (brown < 0.15 && g(S_WATERLOSS) > 25) return `Su kaybı %${g(S_WATERLOSS).toFixed(1)} ama kızarma daha ${pct(brown)}. Klasik ev fırını tuzağı: lahmacun pişmiyor, kuruyor.`;
  return `Katlanabilirlik ${pct(fold)}, harç ${Math.round(g(S_MEATCORE))} °C, su kaybı %${g(S_WATERLOSS).toFixed(1)}. Isı tabandan yukarı çıkıyor; ıslak bölgeler 100 °C’de çakılı kalır, çünkü gelen ısı sıcaklığı değil buharı besler.`;
}

function compare(a) {
  const old = frameAt.call(null, Math.min(t, pinned.sure)) && pinned.frames
    ? (() => { let i = 0; const tt = Math.min(t, pinned.sure);
        while (i < pinned.times.length - 1 && pinned.times[i + 1] <= tt) i++;
        return pinned.frames[i]; })()
    : null;
  if (!old) return;
  const d = (k) => a[SUMMARY + k] - old[SUMMARY + k];
  const sign = (v, n = 1) => (v >= 0 ? '+' : '') + v.toFixed(n);
  $('#karsilastirma').hidden = false;
  $('#karsilastirma').innerHTML =
    `<strong>A · ${recipes[pinned.tarif].ad} ↔ B · şimdiki pişirme</strong><br>`
    + `${saat(t)}${t > pinned.sure ? ' (A kendi sonunda tutuldu)' : ''}: `
    + `katlanabilirlik ${sign(d(S_FOLD) * 100, 0)} puan · harç içi ${sign(d(S_MEATCORE), 1)} °C · `
    + `su kaybı ${sign(d(S_WATERLOSS), 1)} puan · kızarma ${sign(d(S_BROWN) * 100, 0)} puan<br>`
    + `<span class="muted">Aynı gözenek tohumu. Senaryoları karşılaştırın, mutfak garantisi değil.</span>`;
}

// ---------------------------------------------------------------- legend
function legend() {
  const wrap = $('#legend');
  if (view === 'kesit') { wrap.hidden = true; return; }
  const f = fields[view];
  wrap.hidden = false;
  $('#legend-baslik').textContent = f.baslik;
  $('#legend-bar').style.background = legendGradient(view);
  $('#legend-ticks').innerHTML = f.etiketler.map((l) => `<span>${l}</span>`).join('');
  $('#legend-not').textContent = f.not;
}

// ---------------------------------------------------------------- playback
let lastFrame = 0;
function tick(now) {
  requestAnimationFrame(tick);
  if (!playing || !frames.length) { lastFrame = now; return; }
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  t = Math.min(p.sure, t + dt * +$('#hiz').value);
  if (t >= p.sure) { playing = false; $('#oynat').textContent = '▶'; }
  paint();
}
requestAnimationFrame(tick);

// ---------------------------------------------------------------- events
$('#tarif').onchange = (e) => preset(+e.target.value);
$('#yuzey').onchange = (e) => { p.yuzey = e.target.value; invalidate(); };
$('#sifirla').onclick = () => preset(p.tarif);
$('#pisir').onclick = pisir;
$('#rastgele').onclick = () => { preset(Math.floor(Math.random() * recipes.length)); pisir(); };
$$('#firin-buttons button').forEach((b) => { b.onclick = () => {
  p.firin = b.dataset.firin;
  $$('#firin-buttons button').forEach((o) => o.classList.toggle('active', o === b));
  invalidate();
}; });
$$('.view-buttons button').forEach((b) => { b.onclick = () => {
  view = b.dataset.view;
  $$('.view-buttons button').forEach((o) => o.classList.toggle('active', o === b));
  legend(); paintCanvas();
}; });
$('#kenar-odak').onclick = (e) => {
  focus = !focus;
  e.currentTarget.setAttribute('aria-pressed', String(focus));
  paintCanvas();
};
$('#yakinlas').onclick = () => camera.zoomBy(1.15);
$('#uzaklas').onclick = () => camera.zoomBy(1 / 1.15);
$('#gorunum-sifirla').onclick = () => camera.reset();
$('#oynat').onclick = () => {
  if (!frames.length) return pisir();
  if (t >= p.sure) t = 0;
  playing = !playing;
  $('#oynat').textContent = playing ? '❚❚' : '▶';
};
$('#zaman').oninput = (e) => { playing = false; $('#oynat').textContent = '▶'; t = +e.target.value; paint(); };
const sureChange = () => {
  p.sure = clamp((+$('#dakika').value || 0) * 60 + (+$('#saniye').value || 0), 10, 1200);
  $('#sure').textContent = saat(p.sure);
  $('#zaman').max = p.sure;
  t = Math.min(t, p.sure);
  invalidate();
};
$('#dakika').onchange = sureChange;
$('#saniye').onchange = sureChange;
$('#catalla').onclick = () => {
  if (!frames.length) return toast('Önce fırını yakın');
  pinned = { frames, times, sure: p.sure, tarif: p.tarif };
  toast('Pişirme sabitlendi · şimdi bir değişken değiştirin');
  paint();
};
$$('.challenge-buttons button').forEach((b) => { b.onclick = async () => {
  const c = challenges[b.dataset.challenge];
  preset(c.recipe);
  Object.assign(p, c.over);
  sync();
  await pisir();
  modal(`<h3>${c.iddia}</h3><p>${c.ders}</p><h4>NE YAPILDI</h4><p>${
    Object.entries(c.over).map(([k, v]) => `<code>${k}</code> → ${v}`).join(' · ') || 'Hazır bir usul yüklendi.'
  }</p>`);
}; });

// ---------------------------------------------------------------- share, science, toast
$('#paylas').onclick = async () => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) q.set(k, v);
  const url = `${location.origin}${location.pathname}?${q}`;
  try { await navigator.clipboard.writeText(url); toast('Bağlantı kopyalandı'); }
  catch { history.replaceState(null, '', `?${q}`); toast('Bağlantı adres çubuğunda'); }
};
$('#bilim').onclick = () => modal(`
  <h3>Model ne yapıyor, ne yapmıyor</h3>
  <p>Merkezden kenara alınmış eksenel simetrik bir kesit, <code>96 × 24 = 2.304</code> hücrede çözülüyor.
  Her hücre sıcaklık, su, yapı ve gaz taşıyor.</p>
  <h4>SAYISAL YÖNTEM</h4>
  <p>Dikey difüzyon örtük (tridiagonal Thomas), yatay difüzyon açık. Buharlaşma, kızarma, yanma ve
  oturma operatör ayrıştırmasıyla ardından uygulanıyor. 1 mm hamurda tamamen açık bir şema
  yaklaşık 1 ms adım gerektirirdi; örtük dikey çözüm bunu 50 ms’ye çıkarıyor.</p>
  <h4>ÜÇ BELİRLEYİCİ KARAR</h4>
  <p><b>Kabuk kapısı.</b> Su, 120 °C üzerindeki bir hücreye geri giremez. Düz bir difüzyon suyu
  kuru kabuğa doğru çeker ve kabuk hiç oluşmaz; gerçekte aşırı ısınmış bölge daha yüksek buhar
  basıncındadır ve akış dışarı doğrudur. Buharlaşma cephesi böyle oluşuyor.</p>
  <p><b>Yüzey sıcaklığına göre kalibrasyon.</b> Islak iç 100 °C’de çakılı kaldığı için, 430 °C’lik
  bir fırında yüzey 150–200 °C civarındadır. Maillard sabitleri fırın sıcaklığına göre ayarlanırsa
  kızarma matematiksel olarak imkânsız hâle gelir.</p>
  <p><b>Katlanabilirlik.</b> Hamur sütunundaki ortalama su oranından ve kömürleşmiş kalınlık
  oranından türetiliyor; rulo en zayıf noktasından çatladığı için düşük kuyruk yarı ağırlık taşıyor.
  Kalibre edilmemiş, sezgisel bir göstergedir.</p>
  <h4>MODELLENMEYENLER</h4>
  <p>Baharat kimyası, gluten reolojisi, yağın göç etmesi, kıymanın büzülmesi, fırının nem profili,
  gerçek üç boyutlu şekil ve pişirme sırasında lahmacunun çevrilmesi. Konya etli ekmek ovaldir;
  buradaki kesit ondan bir şerit sayılır.</p>
  <p><b>Fizik temelli. Mutfakta doğrulanmamış.</b> Bu bir tarif hesaplayıcısı ya da gıda güvenliği
  aracı değildir.</p>`);

function modal(html) {
  $('#modal-icerik').innerHTML = html;
  $('#modal').showModal();
}
$('#modal .close').onclick = () => $('#modal').close();
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').close(); });

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2400);
}

// ---------------------------------------------------------------- boot
function boot() {
  const q = new URLSearchParams(location.search);
  const i = clamp(+(q.get('tarif') ?? 0) || 0, 0, recipes.length - 1);
  preset(i);
  for (const [id] of controls) if (q.has(id)) p[id] = +q.get(id);
  for (const k of ['firin', 'yuzey']) if (q.has(k)) p[k] = q.get(k);
  if (q.has('sure')) p.sure = clamp(+q.get('sure'), 10, 1200);
  sync();
  legend();
  updateZoom();
  addEventListener('resize', paintCanvas);
  pisir();
}
boot();
