// The eleven styles, and the parameter definitions the control panel is built from.
// Field order is fixed and also used by the share-link encoder, so append, never reorder.

export const FIELDS = [
  'ad', 'yore', 'baslik', 'aciklama',
  'hidrasyon', 'protein', 'mayalanma', 'hamur', 'cap', 'yag',
  'harc', 'harcSu', 'kaplama', 'kiymaYag',
  'ust', 'taban', 'sure', 'firin', 'yuzey',
];

const R = [
['Şanlıurfa Lahmacunu', 'ŞANLIURFA', 'İsotun ve ateşin şehri.',
 'İnce hamur, isotlu harç, çok sıcak taş fırın. İki dakikadan kısa bir kavga.',
 56, 11, 4, 2, 32, 1, 3, 70, 92, 20, 430, 320, 120, 'tas', 'tas'],

['Gaziantep Lahmacunu', 'GAZİANTEP', 'Sarımsak ve kuyruk yağı.',
 'Daha yağlı bir harç. Yağ ısıyı farklı taşır ve yüzeyi daha çabuk kızartır.',
 57, 11.5, 5, 2.5, 30, 1.5, 3.5, 68, 90, 28, 420, 320, 130, 'tas', 'tas'],

['Kilis Lahmacunu', 'KİLİS', 'Büyük olan kazanır.',
 'Geniş çap, bol harç, biraz kalın hamur. Merkez kenardan uzaktır; ısının yolu uzar.',
 58, 11.5, 6, 3, 40, 2, 4, 70, 94, 22, 400, 310, 170, 'tas', 'tas'],

['Adana Lahmacunu', 'ADANA', 'İnce, acı, hızlı.',
 'En ince hamur ve en kısa pişirme. Hata payı burada en dardır.',
 55, 11, 3, 1.8, 30, 1, 2.5, 72, 90, 18, 440, 320, 100, 'tas', 'tas'],

['Hatay Lahmacunu', 'HATAY', 'Nar ekşisi ve zeytinyağı.',
 'Daha yaş bir harç. Fazla su, hamurun kurumasını geciktirir; iyi ya da kötü.',
 58, 11, 5, 2.2, 30, 2.5, 3, 76, 92, 16, 410, 315, 135, 'tas', 'tas'],

['Diyarbakır Lahmacunu', 'DİYARBAKIR', 'Bol maydanoz, dengeli harç.',
 'Orta yol. Karşılaştırma yaparken iyi bir başlangıç noktası.',
 57, 11.5, 5, 2.3, 32, 1, 3.2, 72, 93, 20, 415, 318, 130, 'tas', 'tas'],

['Mardin Lahmacunu', 'MARDİN', 'Baharat ve sabır.',
 'Biraz daha uzun pişen, biraz daha kuru çıkan bir usul.',
 56, 11, 6, 2.4, 30, 1.5, 3.2, 70, 91, 22, 400, 310, 150, 'tas', 'tas'],

['Konya Etli Ekmek', 'KONYA', 'Derinlik her şeyi değiştirir.',
 'Kalın hamur, uzun pişirme. Aslında ovaldir; buradaki kesit ondan bir şerit sayılır.',
 60, 12, 8, 5, 38, 2, 5, 66, 88, 24, 330, 280, 300, 'tas', 'tas'],

['Sac Lahmacun', 'KIRSAL · SAC', 'Üstten ısı yok.',
 'Tamamen taban işi. Sac metaldir: teması taştan çok daha sıkı, üstten ışıma neredeyse sıfır.',
 54, 10.5, 2, 1.5, 28, 1, 2.5, 70, 88, 18, 280, 295, 150, 'sac', 'sac'],

['Ev Fırını Lahmacunu', 'EV MUTFAĞI', 'Ders burada başlıyor.',
 '270 °C ve sekiz dakika. Kızarma gelmeden su biter. Katlanabilirliği izleyin.',
 58, 11, 6, 2.5, 28, 2, 3, 72, 90, 20, 270, 250, 480, 'ev', 'tepsi'],

['Zincir Dükkân', 'KONVEYÖR', 'Tutarlı ama donuk.',
 'Konveyör fırın uzlaşması: her seferinde aynı, hiçbir seferinde çok iyi değil.',
 56, 11, 4, 2.2, 28, 1.5, 2.8, 74, 92, 16, 300, 290, 260, 'konveyor', 'tepsi'],
];

export const recipes = R.map((row) => Object.fromEntries(FIELDS.map((f, i) => [f, row[i]])));

/** Slider definitions: [id, etiket, min, max, adım, birim, sol uç, sağ uç, panel] */
export const controls = [
  ['hidrasyon',  'Hidrasyon',          48, 72, 1,   '%',  'Sıkı',        'Yumuşak',      'hamur'],
  ['protein',    'Un proteini',         9, 14, 0.5, '%',  'Yumuşak',     'Kuvvetli',     'hamur'],
  ['mayalanma',  'Mayalanma · 23 °C',   0, 24, 1,   ' sa','Mayasız',     'Dinlenmiş',    'hamur'],
  ['hamur',      'Hamur kalınlığı',     1,  6, 0.5, ' mm','Yufka gibi',  'Kalın',        'hamur'],
  ['cap',        'Çap',                18, 40, 1,   ' cm','Küçük',       'Kilis usulü',  'hamur'],
  ['yag',        'Hamurda yağ',         0,  6, 0.5, '%',  'Yağsız',      'Yağlı',        'hamur'],
  ['kaplama',    'Harç kaplama',        0,100, 1,   '%',  'Çıplak',      'Kenara kadar', 'harc'],
  ['harc',       'Harç kalınlığı',      0,  8, 0.5, ' mm','Çıplak hamur','Bol harç',     'harc'],
  ['harcSu',     'Harç su oranı',      40, 85, 1,   '%',  'Kuru',        'Sulu',         'harc'],
  ['kiymaYag',   'Kıyma yağ oranı',     5, 35, 1,   '%',  'Yağsız',      'Kuyruk yağlı', 'harc'],
  ['ust',        'Üst ısı',           180,520, 5,   ' °C','Ilımlı',      'Cehennem',     'firin'],
  ['taban',      'Taban ısı',         150,500, 5,   ' °C','Ilımlı',      'Cehennem',     'firin'],
];

export const ovens = [
  ['tas',       'Taş fırın'],
  ['konveyor',  'Konveyör'],
  ['ev',        'Ev fırını'],
  ['sac',       'Sac'],
];

export const surfaces = [
  ['tas',   'Taş'],
  ['sac',   'Sac'],
  ['tepsi', 'Tepsi'],
];

/** Challenge presets for the "bir iddiayla kavga et" buttons. */
export const challenges = {
  harc: { recipe: 0, over: { harc: 7, harcSu: 80 },
    iddia: '"Daha çok harç, daha lezzetli."',
    ders: 'Harç kalınlığını 3 mm’den 7 mm’ye çıkardık. Harcın iç sıcaklığına ve hamurun ıslaklığına bakın: kalın harç kendi suyunu hamura verir ve merkezi soğuk tutar.' },
  isi: { recipe: 0, over: { ust: 520, taban: 480, sure: 120 },
    iddia: '"Fırını iyice kızdır, bir dakikada çıksın."',
    ders: 'Üst ısıyı 520 °C’ye çıkardık. Çıplak kenar kömürleşirken harcın merkezi hâlâ yetişmiyor. Isı bir hızlandırıcı değil, bir dengedir.' },
  ev: { recipe: 9, over: {},
    iddia: '"Ev fırınında da olur."',
    ders: '270 °C’de sekiz dakika. Su kaybı yüksek, kızarma düşük: lahmacun pişmez, kurur. Katlanabilirliğin nasıl çöktüğüne bakın.' },
};
