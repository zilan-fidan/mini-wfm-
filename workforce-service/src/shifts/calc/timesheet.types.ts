// Puantaj: iki algoritmanın (dakika dakika referans ve aralık bölme) ortak veri tipleri ve
// temel takvim yardımcıları. Kategori belirleme mantığı burada DEĞİL, her algoritmanın kendi dosyasındadır.
import { MS_PER_MINUTE } from '../../common/calc/interval';
import { DEFAULT_WORK_RULE_OPTIONS, MS_PER_DAY, ShiftInterval, localWeekStart } from './work-rules';
import { HOLIDAY_CALENDAR_YEARS } from './holidays';

export type TimesheetOptions = {
  utcOffsetMinutes: number;       // Yerel saatin UTC'ye farkı (Türkiye: +180)
  weeklyOvertimeMinutes: number;  // Haftalık bu süreyi AŞAN çalışma fazla mesaidir (45 saat)
};

export const DEFAULT_TIMESHEET_OPTIONS: TimesheetOptions = {
  utcOffsetMinutes: DEFAULT_WORK_RULE_OPTIONS.utcOffsetMinutes,
  weeklyOvertimeMinutes: 45 * 60,
};

export const MS_PER_WEEK = 7 * MS_PER_DAY;

// Bütün süreler DAKİKA cinsindendir ve yuvarlanmaz (saniyeli vardiyalarda kesirli olabilir).
// Gece ve fazla mesai diğer kategorilerle örtüşebilir; tatil ve hafta sonu örtüşmez.
export type CategoryMinutes = {
  total: number;
  night: number;
  holiday: number;
  weekend: number;
  overtime: number;
};

export type TimesheetDay = CategoryMinutes & {
  date: string; // YYYY-MM-DD (yerel)
};

// Haftalık satır. Hafta pazartesi 00.00'da başlar ve ay sınırını aşabilir:
// - total / overtime: TAM haftanın (pazartesi–pazar) değerleri; ay dışındaki günler de dahil.
// - monthTotal / monthOvertime: aynı haftanın yalnızca istenen ay içinde kalan bölümü.
// Fazla mesai her zaman tam haftanın zaman sıralı birikimine göre belirlenir.
export type TimesheetWeek = {
  weekStart: string; // YYYY-MM-DD, yerel pazartesi
  total: number;
  overtime: number;
  monthTotal: number;
  monthOvertime: number;
};

export type TimesheetMonth = {
  month: string; // YYYY-MM
  days: TimesheetDay[];
  weeks: TimesheetWeek[];
  totals: CategoryMinutes; // yalnızca istenen ay içinde kalan süre
};

// Hesaplama dönemi (UTC milisaniye). Aralıklar [başlangıç, bitiş) yarı açıktır.
export type TimesheetPeriod = {
  month: string;
  monthStart: number;
  monthEnd: number;
  weeksStart: number; // ayın ilk gününün haftasının pazartesisi 00.00
  weeksEnd: number;   // ayın son gününün haftasından sonraki pazartesi 00.00
};

export type TimesheetCalculator = (
  shifts: readonly ShiftInterval[],
  month: string,
  options?: TimesheetOptions,
) => TimesheetMonth;

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(month: unknown): month is string {
  return typeof month === 'string' && MONTH_PATTERN.test(month);
}

// Tatil takvimi tanımlı olan aylar (ör. 2026-01 … 2027-12).
export function isSupportedMonth(month: string): boolean {
  return isValidMonth(month) && HOLIDAY_CALENDAR_YEARS.includes(Number(month.slice(0, 4)));
}

// UTC anının yerel takvim günü: YYYY-MM-DD
export function localDateKey(time: number, options: TimesheetOptions): string {
  return new Date(time + options.utcOffsetMinutes * MS_PER_MINUTE).toISOString().slice(0, 10);
}

// "2026-11" → ay ve ayı kapsayan tam haftaların sınırları.
export function resolveTimesheetPeriod(month: string, options: TimesheetOptions = DEFAULT_TIMESHEET_OPTIONS): TimesheetPeriod {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error(`Geçersiz ay: ${month}`);
  const offsetMs = options.utcOffsetMinutes * MS_PER_MINUTE;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const monthStart = Date.UTC(year, monthIndex, 1) - offsetMs;
  const monthEnd = Date.UTC(year, monthIndex + 1, 1) - offsetMs;
  const weekOptions = { ...DEFAULT_WORK_RULE_OPTIONS, utcOffsetMinutes: options.utcOffsetMinutes };
  return {
    month,
    monthStart,
    monthEnd,
    weeksStart: localWeekStart(monthStart, weekOptions),
    weeksEnd: localWeekStart(monthEnd - 1, weekOptions) + MS_PER_WEEK,
  };
}
export const zeroCategories = (): CategoryMinutes => ({ total: 0, night: 0, holiday: 0, weekend: 0, overtime: 0 });
// Vardiyasız günler ve haftalar dahil, sıfırlarla dolu iskelet.
export function createEmptyTimesheet(period: TimesheetPeriod, options: TimesheetOptions = DEFAULT_TIMESHEET_OPTIONS): TimesheetMonth {
  const days: TimesheetDay[] = [];
  for (let day = period.monthStart; day < period.monthEnd; day += MS_PER_DAY) {
    days.push({ date: localDateKey(day, options), ...zeroCategories() });
  }
  const weeks: TimesheetWeek[] = [];
  for (let week = period.weeksStart; week < period.weeksEnd; week += MS_PER_WEEK) {
    weeks.push({ weekStart: localDateKey(week, options), total: 0, overtime: 0, monthTotal: 0, monthOvertime: 0 });
  }
  return { month: period.month, days, weeks, totals: zeroCategories() };
}
