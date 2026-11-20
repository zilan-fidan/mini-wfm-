// Türkiye resmî tatilleri (2026–2027). Tarihler yerel (Türkiye) takvim günüdür.
//
// Kaynaklar:
// - Sabit tatiller ve yarım gün kuralı: 2429 sayılı Ulusal Bayram ve Genel Tatiller Hakkında Kanun
//   (Cumhuriyet Bayramı 28 Ekim saat 13.00'ten; Ramazan ve Kurban bayramı arifeleri saat 13.00'ten başlar).
//   https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=2429&MevzuatTur=1&MevzuatTertip=5
// - 2027 dinî bayramlar: Diyanet İşleri Başkanlığı, 2027 Dini Günler Listesi
//   https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154
// - 2026 dinî bayramlar: Diyanet'in 2026 sayfası doğrulama sırasında boş/erişilemez döndü;
//   birbirini tutan ikincil kaynaklar kullanıldı:
//   https://www.cnnturk.com/guncel/2026da-hangi-gunler-resmi-tatil-liste-liste-resmi-tatil-gunleri-2026-2362840
//   https://www.ntv.com.tr/turkiye/galeri-arefe-gunu-yarim-gun-mu-resmi-tatil-mi-2026-ramazan-bayrami-tatil-takvimi-1715311
//   https://www.isbank.com.tr/blog/2026-resmi-tatiller-takvimi
//
// Not: İdari izin kararları (köprü günleri) resmî tatil değildir, listeye eklenmez.

export type PublicHoliday = {
  date: string;      // YYYY-MM-DD, yerel takvim günü
  name: string;
  halfDay: boolean;  // true ise tatil o gün 13.00'te başlar ve gün sonuna kadar sürer
};

// Yarım gün tatillerin başladığı yerel saat.
export const HALF_DAY_HOLIDAY_START_HOUR = 13;

// Tatil takviminin tanımlı olduğu yıllar; puantaj yalnızca bu yılların ayları için hesaplanır.
export const HOLIDAY_CALENDAR_YEARS: readonly number[] = [2026, 2027];

// Aynı güne düşen iki tatil (ör. 19 Mayıs 2027) tek kayıtta birleştirilir: her tarih bir kez geçer.
export const TURKEY_PUBLIC_HOLIDAYS: readonly PublicHoliday[] = [
  // ---------- 2026 ----------
  { date: '2026-01-01', name: 'Yılbaşı', halfDay: false },
  { date: '2026-03-19', name: 'Ramazan Bayramı Arifesi', halfDay: true },
  { date: '2026-03-20', name: 'Ramazan Bayramı 1. Gün', halfDay: false },
  { date: '2026-03-21', name: 'Ramazan Bayramı 2. Gün', halfDay: false },
  { date: '2026-03-22', name: 'Ramazan Bayramı 3. Gün', halfDay: false },
  { date: '2026-04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı', halfDay: false },
  { date: '2026-05-01', name: 'Emek ve Dayanışma Günü', halfDay: false },
  { date: '2026-05-19', name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", halfDay: false },
  { date: '2026-05-26', name: 'Kurban Bayramı Arifesi', halfDay: true },
  { date: '2026-05-27', name: 'Kurban Bayramı 1. Gün', halfDay: false },
  { date: '2026-05-28', name: 'Kurban Bayramı 2. Gün', halfDay: false },
  { date: '2026-05-29', name: 'Kurban Bayramı 3. Gün', halfDay: false },
  { date: '2026-05-30', name: 'Kurban Bayramı 4. Gün', halfDay: false },
  { date: '2026-07-15', name: 'Demokrasi ve Millî Birlik Günü', halfDay: false },
  { date: '2026-08-30', name: 'Zafer Bayramı', halfDay: false },
  { date: '2026-10-28', name: 'Cumhuriyet Bayramı Arifesi', halfDay: true },
  { date: '2026-10-29', name: 'Cumhuriyet Bayramı', halfDay: false },

  // ---------- 2027 ----------
  { date: '2027-01-01', name: 'Yılbaşı', halfDay: false },
  { date: '2027-03-08', name: 'Ramazan Bayramı Arifesi', halfDay: true },
  { date: '2027-03-09', name: 'Ramazan Bayramı 1. Gün', halfDay: false },
  { date: '2027-03-10', name: 'Ramazan Bayramı 2. Gün', halfDay: false },
  { date: '2027-03-11', name: 'Ramazan Bayramı 3. Gün', halfDay: false },
  { date: '2027-04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı', halfDay: false },
  { date: '2027-05-01', name: 'Emek ve Dayanışma Günü', halfDay: false },
  { date: '2027-05-15', name: 'Kurban Bayramı Arifesi', halfDay: true },
  { date: '2027-05-16', name: 'Kurban Bayramı 1. Gün', halfDay: false },
  { date: '2027-05-17', name: 'Kurban Bayramı 2. Gün', halfDay: false },
  { date: '2027-05-18', name: 'Kurban Bayramı 3. Gün', halfDay: false },
  { date: '2027-05-19', name: "Kurban Bayramı 4. Gün; Atatürk'ü Anma, Gençlik ve Spor Bayramı", halfDay: false },
  { date: '2027-07-15', name: 'Demokrasi ve Millî Birlik Günü', halfDay: false },
  { date: '2027-08-30', name: 'Zafer Bayramı', halfDay: false },
  { date: '2027-10-28', name: 'Cumhuriyet Bayramı Arifesi', halfDay: true },
  { date: '2027-10-29', name: 'Cumhuriyet Bayramı', halfDay: false },
];
