// Zaman aralığı: [startAt, endAt) yarı açık kabul edilir.
// Yani endAt anı aralığa dahil değildir; 08:00–16:00 ile 16:00–20:00 kesişmez.
export type Interval = {
  startAt: Date;
  endAt: Date;
};

export const MS_PER_MINUTE = 60 * 1000;

// İki aralığın kesiştiği süreyi dakika olarak döndürür; kesişmiyorsa 0.
export function overlapMinutes(a: Interval, b: Interval): number {
  // Kesişimin başı: iki başlangıçtan geç olanı
  const start = Math.max(a.startAt.getTime(), b.startAt.getTime());
  // Kesişimin sonu: iki bitişten erken olanı
  const end = Math.min(a.endAt.getTime(), b.endAt.getTime());

  // Aralıklar kesişmiyorsa end < start olur; negatif süre yerine 0 döneriz.
  return Math.max(0, end - start) / MS_PER_MINUTE;
}
