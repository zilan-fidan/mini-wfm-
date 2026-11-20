// PUANTAJ — 2. ALGORİTMA: aralık bölme. Serviste kullanılan sürüm budur.
//
// Vardiyalar kategori değişebilecek her sınırdan parçalanır: hafta/ay sınırları, yerel gece yarısı,
// 06.00, 20.00 ve tatil başlangıç/bitişleri. Parça içinde kategori değişmez; bu yüzden her parçanın
// kategorisi bir kez, başlangıç anından aritmetikle belirlenir ve süresi tek seferde eklenir.
// Haftalık 45 saat bir parçanın içinde doluyorsa parça o noktadan ikiye bölünür.
//
// Kategori mantığı dakika dakika referanstan BAĞIMSIZDIR: tatiller burada UTC aralık listesine
// çevrilir, gün/hafta indeksleri milisaniye aritmetiğiyle bulunur.
import { MS_PER_MINUTE } from '../../common/calc/interval';
import { MS_PER_DAY, MS_PER_HOUR, ShiftInterval } from './work-rules';
import { HALF_DAY_HOLIDAY_START_HOUR, TURKEY_PUBLIC_HOLIDAYS } from './holidays';
import {
  DEFAULT_TIMESHEET_OPTIONS,
  MS_PER_WEEK,
  TimesheetCalculator,
  TimesheetMonth,
  TimesheetOptions,
  createEmptyTimesheet,
  resolveTimesheetPeriod,
} from './timesheet.types';

export const NIGHT_START_HOUR = 20; // gece 20.00'de başlar (dahil)
export const NIGHT_END_HOUR = 6;    // 06.00'da biter (hariç)

type Span = { start: number; end: number };

const mod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

// Tatil tarihlerini UTC [başlangıç, bitiş) aralıklarına çevirir; yarım gün 13.00'te başlar.
function holidaySpans(offsetMs: number): Span[] {
  return TURKEY_PUBLIC_HOLIDAYS.map((holiday) => {
    const dayStart = Date.parse(`${holiday.date}T00:00:00Z`) - offsetMs;
    return {
      start: dayStart + (holiday.halfDay ? HALF_DAY_HOLIDAY_START_HOUR * MS_PER_HOUR : 0),
      end: dayStart + MS_PER_DAY,
    };
  }).sort((a, b) => a.start - b.start);
}

// Vardiyaları [from, to) ile kırpar, sıralar ve çakışanları birleştirir (aynı an bir kez sayılır).
function mergeShifts(shifts: readonly ShiftInterval[], from: number, to: number): Span[] {
  const spans = shifts
    .map((shift) => ({ start: Math.max(shift.startAt.getTime(), from), end: Math.min(shift.endAt.getTime(), to) }))
    .filter((span) => span.end > span.start)
    .sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

export const calculateTimesheetBySplitting: TimesheetCalculator = (
  shifts: readonly ShiftInterval[],
  month: string,
  options: TimesheetOptions = DEFAULT_TIMESHEET_OPTIONS,
): TimesheetMonth => {
  const period = resolveTimesheetPeriod(month, options);
  const result = createEmptyTimesheet(period, options);
  const offsetMs = options.utcOffsetMinutes * MS_PER_MINUTE;
  const holidays = holidaySpans(offsetMs).filter((span) => span.end > period.weeksStart && span.start < period.weeksEnd);
  const dailyCuts = [0, NIGHT_END_HOUR, NIGHT_START_HOUR].map((hour) => hour * MS_PER_HOUR);
  const weeklyWorked = result.weeks.map(() => 0); // hafta indeksi → zaman sırasıyla biriken dakika
  const limit = options.weeklyOvertimeMinutes;

  // Kategorisi sabit bir parçayı ekler. isOvertime, parçanın tamamının 45 saatten sonra olduğunu söyler.
  const addPiece = (start: number, end: number, weekIndex: number, isOvertime: boolean) => {
    const minutes = (end - start) / MS_PER_MINUTE;
    const overtime = isOvertime ? minutes : 0;
    const week = result.weeks[weekIndex];
    week.total += minutes;
    week.overtime += overtime;
    if (start < period.monthStart || start >= period.monthEnd) return;

    const local = start + offsetMs;
    const timeOfDay = mod(local, MS_PER_DAY);
    const daysSinceMonday = mod(Math.floor(local / MS_PER_DAY) + 3, 7); // 1970-01-01 perşembe
    const isNight = timeOfDay >= NIGHT_START_HOUR * MS_PER_HOUR || timeOfDay < NIGHT_END_HOUR * MS_PER_HOUR;
    const isHoliday = holidays.some((span) => span.start <= start && start < span.end);
    const isWeekend = !isHoliday && daysSinceMonday >= 5;

    week.monthTotal += minutes;
    week.monthOvertime += overtime;
    const day = result.days[Math.floor((start - period.monthStart) / MS_PER_DAY)];
    for (const row of [day, result.totals]) {
      row.total += minutes;
      if (isNight) row.night += minutes;
      if (isHoliday) row.holiday += minutes;
      if (isWeekend) row.weekend += minutes;
      row.overtime += overtime;
    }
  };

  for (const span of mergeShifts(shifts, period.weeksStart, period.weeksEnd)) {
    // Parça sınırları: her yerel günün 00.00 / 06.00 / 20.00'ı, tatil sınırları ve ay sınırları.
    // Hafta sınırı her zaman yerel gece yarısıdır, dolayısıyla günlük sınırlarla gelir.
    const cuts = new Set<number>([span.start, span.end]);
    const firstLocalMidnight = Math.floor((span.start + offsetMs) / MS_PER_DAY) * MS_PER_DAY - offsetMs;
    for (let midnight = firstLocalMidnight; midnight < span.end; midnight += MS_PER_DAY) {
      for (const cut of dailyCuts) cuts.add(midnight + cut);
    }
    for (const holiday of holidays) {
      cuts.add(holiday.start);
      cuts.add(holiday.end);
    }
    cuts.add(period.monthStart);
    cuts.add(period.monthEnd);
    const points = [...cuts].filter((point) => point >= span.start && point <= span.end).sort((a, b) => a - b);

    for (let i = 1; i < points.length; i++) {
      const start = points[i - 1];
      const end = points[i];
      const weekIndex = Math.floor((start - period.weeksStart) / MS_PER_WEEK);
      const before = weeklyWorked[weekIndex];
      const minutes = (end - start) / MS_PER_MINUTE;
      weeklyWorked[weekIndex] = before + minutes;

      if (before < limit && before + minutes > limit) {
        // 45 saat bu parçanın içinde doluyor: eşik anı da bölme sınırıdır.
        const threshold = start + (limit - before) * MS_PER_MINUTE;
        addPiece(start, threshold, weekIndex, false);
        addPiece(threshold, end, weekIndex, true);
      } else {
        addPiece(start, end, weekIndex, before >= limit);
      }
    }
  }
  return result;
};
