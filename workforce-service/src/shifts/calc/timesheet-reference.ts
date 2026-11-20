// PUANTAJ — 1. ALGORİTMA: dakika dakika referans çözüm.
// YALNIZCA test ve performans karşılaştırması içindir; serviste kullanılmaz.
//
// Her vardiya dakika dilimlerine ayrılır. Her dilim için yerel duvar saati Date alanlarıyla
// (getUTCHours, getUTCDay, tarih metni) yeniden hesaplanır ve kategori o dilim için belirlenir.
// Aralık bölme algoritmasıyla kategori kodu PAYLAŞILMAZ: tatil burada tarih metniyle
// sözlükten bakılır, hafta pazartesinin tarih metniyle anahtarlanır.
import { MS_PER_MINUTE } from '../../common/calc/interval';
import { ShiftInterval, sortByStart } from './work-rules';
import { HALF_DAY_HOLIDAY_START_HOUR, PublicHoliday, TURKEY_PUBLIC_HOLIDAYS } from './holidays';
import { DEFAULT_TIMESHEET_OPTIONS, TimesheetCalculator,TimesheetMonth, TimesheetOptions, createEmptyTimesheet,resolveTimesheetPeriod,} from './timesheet.types';

const NIGHT_FROM_HOUR = 20; // 20.00 dahil
const NIGHT_UNTIL_HOUR = 6; // 06.00 hariç
const holidayByDate = new Map<string, PublicHoliday>(TURKEY_PUBLIC_HOLIDAYS.map((holiday) => [holiday.date, holiday]));

export const calculateTimesheetMinuteByMinute: TimesheetCalculator = (
  shifts: readonly ShiftInterval[],
  month: string,
  options: TimesheetOptions = DEFAULT_TIMESHEET_OPTIONS,
): TimesheetMonth => {
  const period = resolveTimesheetPeriod(month, options);
  const result = createEmptyTimesheet(period, options);
  const dayRows = new Map(result.days.map((row) => [row.date, row]));
  const weekRows = new Map(result.weeks.map((row) => [row.weekStart, row]));
  const workedInWeek = new Map<string, number>(); // hafta pazartesisi → zaman sırasıyla biriken dakika
  const offsetMs = options.utcOffsetMinutes * MS_PER_MINUTE;

  // Çakışan vardiyalarda aynı an bir kez sayılır: önceki vardiyaların kapsadığı an atlanır.
  let coveredUntil = period.weeksStart;

  for (const shift of sortByStart(shifts)) {
    const start = Math.max(shift.startAt.getTime(), coveredUntil);
    const end = Math.min(shift.endAt.getTime(), period.weeksEnd);
    if (end <= start) continue;
    coveredUntil = end;

    // Dakika dilimi: [slot, slot + 1 dk). Saniyeli vardiyada ilk ve son dilim kısmen çalışılır.
    for (let slot = Math.floor(start / MS_PER_MINUTE) * MS_PER_MINUTE; slot < end; slot += MS_PER_MINUTE) {
      const worked = (Math.min(end, slot + MS_PER_MINUTE) - Math.max(start, slot)) / MS_PER_MINUTE;
      if (worked <= 0) continue;

      // Yerel duvar saati (UTC alanları yerel saati gösterecek şekilde kaydırılmış an)
      const wall = new Date(slot + offsetMs);
      const hour = wall.getUTCHours();
      const weekday = wall.getUTCDay(); // 0 = pazar, 6 = cumartesi
      const date = wall.toISOString().slice(0, 10);
      const monday = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() - ((weekday + 6) % 7)))
        .toISOString()
        .slice(0, 10);

      const holiday = holidayByDate.get(date);
      const isHoliday = holiday !== undefined && (!holiday.halfDay || hour >= HALF_DAY_HOLIDAY_START_HOUR);
      const isWeekend = !isHoliday && (weekday === 0 || weekday === 6);
      const isNight = hour >= NIGHT_FROM_HOUR || hour < NIGHT_UNTIL_HOUR;

      // Haftalık birikim: 45 saati aşan kısım fazla mesai (dilim eşiği ortadan geçebilir).
      const before = workedInWeek.get(monday) ?? 0;
      const after = before + worked;
      workedInWeek.set(monday, after);
      const limit = options.weeklyOvertimeMinutes;
      const overtime = Math.max(0, after - limit) - Math.max(0, before - limit);

      const week = weekRows.get(monday)!;
      week.total += worked;
      week.overtime += overtime;

      const day = dayRows.get(date);
      if (!day) continue; // ay dışındaki gün: yalnızca haftalık birikime girer

      week.monthTotal += worked;
      week.monthOvertime += overtime;
      for (const row of [day, result.totals]) {
        row.total += worked;
        if (isNight) row.night += worked;
        if (isHoliday) row.holiday += worked;
        if (isWeekend) row.weekend += worked;
        row.overtime += overtime;
      }
    }
  }
  return result;
};
