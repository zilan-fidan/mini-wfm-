// Puantaj karşılaştırma testleri ve performans ölçümü için sabit seed'li vardiya üreticisi.
// Aynı seed her çalıştırmada aynı veriyi üretir.
import { ShiftInterval } from '../../src/shifts/calc/work-rules';
import { resolveTimesheetPeriod } from '../../src/shifts/calc/timesheet.types';

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// mulberry32: küçük, hızlı ve deterministik PRNG. [0, 1) döndürür.
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type GeneratedMonth = {
  month: string;
  profile: 'empty' | 'normal' | 'heavy' | 'night';
  shifts: ShiftInterval[];
};

// Tatil takviminin tanımlı olduğu bütün aylar
export const SUPPORTED_MONTHS = [2026, 2027].flatMap((year) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`),
);
// Tatil, ay sınırını aşan hafta ve yıl dönümü açısından ilginç aylar daha sık seçilir.
const FOCUS_MONTHS = ['2026-03', '2026-05', '2026-10', '2026-11', '2026-12', '2027-01', '2027-03', '2027-05'];

const pick = <T>(random: () => number, items: readonly T[]): T => items[Math.floor(random() * items.length)];
const int = (random: () => number, min: number, max: number) => min + Math.floor(random() * (max - min + 1));

// Kategori sınırlarına denk gelen başlangıç saatleri (yerel)
const EDGE_HOURS = [0, 6, 13, 20, 22, 23];

// fixedMonth verilirse ay seçilmez (performans ölçümü: bütün personeller aynı ay).
export function generateMonth(random: () => number, utcOffsetMinutes = 180, fixedMonth?: string): GeneratedMonth {
  const picked = random() < 0.5 ? pick(random, FOCUS_MONTHS) : pick(random, SUPPORTED_MONTHS);
  const month = fixedMonth ?? picked;
  const roll = random();
  const profile: GeneratedMonth['profile'] = roll < 0.05 ? 'empty' : roll < 0.4 ? 'heavy' : roll < 0.6 ? 'night' : 'normal';
  if (profile === 'empty') return { month, profile, shifts: [] };

  const period = resolveTimesheetPeriod(month, { utcOffsetMinutes, weeklyOvertimeMinutes: 45 * 60 });
  const workProbability = profile === 'heavy' ? 0.9 : 0.65;
  const shifts: ShiftInterval[] = [];

  // weeksStart yerel pazartesi 00.00 olduğundan `day` her zaman yerel gece yarısıdır.
  // Hesap aralığından bir gün önce başlanır: önceki pazardan taşan vardiyalar da üretilir.
  for (let day = period.weeksStart - MS_PER_DAY; day < period.weeksEnd; day += MS_PER_DAY) {
    if (random() >= workProbability) continue;

    const startHour = random() < 0.25
      ? pick(random, EDGE_HOURS)
      : profile === 'night' ? int(random, 17, 23) : int(random, 0, 23);
    const startMinute = random() < 0.6 ? 0 : pick(random, [15, 30, 45, int(random, 1, 59)]);
    const durationMinutes = profile === 'heavy' ? int(random, 9, 12) * 60 : int(random, 60, 12 * 60);

    let start = day + startHour * MS_PER_HOUR + startMinute * MS_PER_MINUTE;
    let end = start + durationMinutes * MS_PER_MINUTE;
    // Dakika altı hassasiyet: saniye ve milisaniye içeren vardiyalar
    if (random() < 0.1) {
      start += int(random, 1, 59_999);
      end += int(random, 1, 59_999);
    }
    shifts.push({ startAt: new Date(start), endAt: new Date(end) });

    // Nadiren çakışan ikinci vardiya (veritabanında engellenir ama hesap dayanıklı olmalı)
    if (random() < 0.03) {
      const overlapStart = start + int(random, 0, durationMinutes) * MS_PER_MINUTE;
      shifts.push({ startAt: new Date(overlapStart), endAt: new Date(overlapStart + int(random, 30, 240) * MS_PER_MINUTE) });
    }
  }
  return { month, profile, shifts };
}

export function generateMonths(seed: number, count: number, fixedMonth?: string): GeneratedMonth[] {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => generateMonth(random, 180, fixedMonth));
}
