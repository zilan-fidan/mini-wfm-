import { CategoryMinutes, TimesheetMonth } from './calc/timesheet.types';

// Dakika → saat, bir ondalık. Yalnızca API yanıtında, en son adımda uygulanır.
export const toHours = (minutes: number) => Math.round(minutes / 6) / 10;

const categoryHours = (row: CategoryMinutes) => ({
  totalHours: toHours(row.total),
  nightHours: toHours(row.night),
  holidayHours: toHours(row.holiday),
  weekendHours: toHours(row.weekend),
  overtimeHours: toHours(row.overtime),
});

// Her satır kendi yuvarlanmamış dakikasından yuvarlanır; günlük yuvarlanmış değerler toplanmaz.
export function toTimesheetResponse(workforceUserId: number, result: TimesheetMonth) {
  return {
    workforceUserId,
    month: result.month,
    days: result.days.map((day) => ({ date: day.date, ...categoryHours(day) })),
    // totalHours/overtimeHours: TAM hafta (pazartesi–pazar, ay dışı günler dahil).
    // monthTotalHours/monthOvertimeHours: haftanın istenen ay içinde kalan bölümü.
    weeks: result.weeks.map((week) => ({
      weekStart: week.weekStart,
      totalHours: toHours(week.total),
      overtimeHours: toHours(week.overtime),
      monthTotalHours: toHours(week.monthTotal),
      monthOvertimeHours: toHours(week.monthOvertime),
    })),
    totals: categoryHours(result.totals),
  };
}

export type TimesheetResponse = ReturnType<typeof toTimesheetResponse>;
