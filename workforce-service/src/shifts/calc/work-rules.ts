import { Interval, MS_PER_MINUTE ,overlapMinutes} from '../../common/calc/interval';

// Kontrol edilen vardiya: yeni vardiyanın henüz id'si yoktur.
export type ShiftInterval = Interval & { id?: number };
export type WorkRuleCode = 'REST' | 'WEEKLY_LIMIT' | 'CONSECUTIVE_DAYS';

export type WorkRuleOptions = {
  minRestHours: number;        // REST: iki vardiya arası en az dinlenme
  weeklyLimitHours: number;    // WEEKLY_LIMIT: haftalık en fazla çalışma
  maxConsecutiveDays: number;  // CONSECUTIVE_DAYS: üst üste en fazla gün
  utcOffsetMinutes: number;    // Yerel saatin UTC'ye farkı (Türkiye: +180)
};

export const DEFAULT_WORK_RULE_OPTIONS: WorkRuleOptions = {
  minRestHours: 11,
  weeklyLimitHours: 60,
  maxConsecutiveDays: 6,
  utcOffsetMinutes: 180,
};

export type WorkRuleViolation = {
  rule: WorkRuleCode;
  shifts: ShiftInterval[];  // ihlale karışan vardiyalar
  value: number;            // hesaplanan değer: 6 (saat), 66 (saat), 7 (gün)
  message: string;          // "6 saat dinlenme", "66 saat", "7 gün"
};

// Bir kural fonksiyonunun ortak imzası
export type WorkRule = (
  existingShifts: readonly ShiftInterval[],
  newShifts: readonly ShiftInterval[],
  options: WorkRuleOptions,
) => WorkRuleViolation[];

// ---------- Zaman yardımcıları ----------

export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

// UTC anını yerel "duvar saatine" kaydırır. Sonuç yalnızca gün/hafta hesabı içindir.
const toLocalMs = (time: number, options: WorkRuleOptions) =>
  time + options.utcOffsetMinutes * MS_PER_MINUTE;

// Yerel gün numarası: yerel 1970-01-01 = 0. Ardışık günler ardışık tamsayıdır.
export function localDayNumber(time: number, options: WorkRuleOptions): number {
  return Math.floor(toLocalMs(time, options) / MS_PER_DAY);
}

// Verilen anın düştüğü yerel haftanın pazartesi 00:00'ı (UTC milisaniye olarak).
export function localWeekStart(time: number, options: WorkRuleOptions): number {
  const day = localDayNumber(time, options);
  // 1970-01-01 perşembedir; (day + 3) % 7 pazartesiden bu yana geçen gün sayısını verir.
  const daysSinceMonday = (((day + 3) % 7) + 7) % 7;
  const mondayLocalMs = (day - daysSinceMonday) * MS_PER_DAY;
  return mondayLocalMs - options.utcOffsetMinutes * MS_PER_MINUTE;
}

// 360 → "6 saat", 390 → "6.5 saat"
export function formatHours(minutes: number): string {
  return `${Number((minutes / 60).toFixed(2))} saat`;
}

// Diziyi bozmadan başlangıca göre sıralı bir KOPYA döndürür.
export function sortByStart<T extends ShiftInterval>(shifts: readonly T[]): T[] {
  return [...shifts].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime() || a.endAt.getTime() - b.endAt.getTime(),
  );
}

// İki vardiya arasındaki dinlenmeyi ölçer; yeterliyse null, değilse ihlal döner.
function restViolation(
  previous: ShiftInterval,
  next: ShiftInterval,
  newShifts: ReadonlySet<ShiftInterval>,
  options: WorkRuleOptions,
): WorkRuleViolation | null {
  // Yalnızca en az birinde yeni vardiya olan çiftler raporlanır;
  // mevcut iki vardiya arasındaki eski bir sorun yeni kaydı engellemez.
  if (!newShifts.has(previous) && !newShifts.has(next)) return null;

  const restMinutes = (next.startAt.getTime() - previous.endAt.getTime()) / MS_PER_MINUTE;
  // Tam 11 saat kurala uyar: yalnızca kesin küçükse ihlal.
  if (restMinutes >= options.minRestHours * 60) return null;

  return {
    rule: 'REST',
    shifts: [previous, next],
    value: restMinutes / 60,
    message: `${formatHours(restMinutes)} dinlenme`,
  };
}

// P10 — 1. sürüm: klasik for döngüsü
export const checkRestWithFor: WorkRule = (existingShifts, newShifts, options) => {
  const sorted = sortByStart([...existingShifts, ...newShifts]);
  const isNew = new Set(newShifts);
  const violations: WorkRuleViolation[] = [];

  // Her vardiyayı bir öncekiyle karşılaştır: (0,1), (1,2), (2,3)...
  for (let i = 1; i < sorted.length; i++) {
    const violation = restViolation(sorted[i - 1], sorted[i], isNew, options);
    if (violation) violations.push(violation);
  }
  return violations;
};

// P10 — 2. sürüm: dizi metotları
export const checkRest: WorkRule = (existingShifts, newShifts, options) => {
  const sorted = sortByStart([...existingShifts, ...newShifts]);
  const isNew = new Set(newShifts);

  return sorted
    .slice(1) // ilk elemanın öncesi yok
    .map((next, i) => restViolation(sorted[i], next, isNew, options)) // slice yüzünden sorted[i] bir öncekidir
    .filter((violation): violation is WorkRuleViolation => violation !== null);
};

const MS_PER_WEEK = 7 * MS_PER_DAY;

// Haftanın penceresi: [pazartesi 00:00, sonraki pazartesi 00:00)
const weekWindow = (weekStart: number): Interval => ({
  startAt: new Date(weekStart),
  endAt: new Date(weekStart + MS_PER_WEEK),
});

// Vardiyanın dokunduğu yerel haftaların başlangıçları (çoğu zaman 1, hafta sınırında 2).
export function weeksTouched(shift: ShiftInterval, options: WorkRuleOptions): number[] {
  const weeks: number[] = [];
  for (
    let week = localWeekStart(shift.startAt.getTime(), options);
    week < shift.endAt.getTime();
    week += MS_PER_WEEK
  ) {
    weeks.push(week);
  }
  return weeks;
}

// Verilen haftaya düşen toplam çalışma (dakika). Sınırı aşan vardiyanın yalnızca bu haftadaki kısmı sayılır.
export function minutesInWeek(shifts: readonly ShiftInterval[], weekStart: number): number {
  const window = weekWindow(weekStart);
  return shifts.reduce((total, shift) => total + overlapMinutes(shift, window), 0);
}

export const checkWeeklyLimit: WorkRule = (existingShifts, newShifts, options) => {
  const all = [...existingShifts, ...newShifts];

  // Yalnızca yeni vardiyaların dokunduğu haftalar kontrol edilir (tekrarsız, sıralı).
  const weeks = [...new Set(newShifts.flatMap((shift) => weeksTouched(shift, options)))].sort((a, b) => a - b);

  return weeks.flatMap((weekStart) => {
    const window = weekWindow(weekStart);
    const shiftsInWeek = sortByStart(all.filter((shift) => overlapMinutes(shift, window) > 0));
    const totalMinutes = minutesInWeek(shiftsInWeek, weekStart);

    // "60 saati geçemez": tam 60 saat kurala uyar.
    if (totalMinutes <= options.weeklyLimitHours * 60) return [];

    return [{
      rule: 'WEEKLY_LIMIT' as const,
      shifts: shiftsInWeek,
      value: totalMinutes / 60,
      message: formatHours(totalMinutes),
    }];
  });
};

// Vardiyanın dokunduğu yerel günler. [startAt, endAt) yarı açık:
// tam 00:00'da biten vardiya ertesi güne dokunmaz, bu yüzden son an endAt - 1 ms.
export function daysTouched(shift: ShiftInterval, options: WorkRuleOptions): number[] {
  const first = localDayNumber(shift.startAt.getTime(), options);
  const last = localDayNumber(shift.endAt.getTime() - 1, options);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

// Vardiyaları dokundukları yerel güne göre gruplar: gün numarası → o günün vardiyaları.
export function groupByLocalDay(
  shifts: readonly ShiftInterval[],
  options: WorkRuleOptions,
): Map<number, ShiftInterval[]> {
  const byDay = new Map<number, ShiftInterval[]>();
  for (const shift of shifts) {
    for (const day of daysTouched(shift, options)) {
      byDay.set(day, [...(byDay.get(day) ?? []), shift]);
    }
  }
  return byDay;
}

// Sıralı, tekrarsız gün numaralarını ardışık serilere böler: [1,2,3,5,6] → [[1,2,3],[5,6]]
export function consecutiveRuns(days: readonly number[]): number[][] {
  const runs: number[][] = [];
  for (const day of days) {
    const current = runs.at(-1);
    if (current && day === current.at(-1)! + 1) {
      current.push(day);   // seri devam ediyor
    } else {
      runs.push([day]);    // boşluk var, yeni seri başlar
    }
  }
  return runs;
}

export const checkConsecutiveDays: WorkRule = (existingShifts, newShifts, options) => {
  const byDay = groupByLocalDay([...existingShifts, ...newShifts], options);
  const newDays = new Set(newShifts.flatMap((shift) => daysTouched(shift, options)));
  const workedDays = [...byDay.keys()].sort((a, b) => a - b);

  return consecutiveRuns(workedDays)
    // Limiti aşan ve yeni vardiyanın gününü içeren seriler
    .filter((run) => run.length > options.maxConsecutiveDays && run.some((day) => newDays.has(day)))
    .map((run) => ({
      rule: 'CONSECUTIVE_DAYS' as const,
      // Gece vardiyası iki güne düşer; Set ile aynı vardiya bir kez listelenir.
      shifts: sortByStart([...new Set(run.flatMap((day) => byDay.get(day)!))]),
      value: run.length,
      message: `${run.length} gün`,
    }));
};


// ---------- Birleştirici ----------

export function checkWorkRules(
  existingShifts: readonly ShiftInterval[],
  newShifts: readonly ShiftInterval[],
  options: WorkRuleOptions = DEFAULT_WORK_RULE_OPTIONS,
): WorkRuleViolation[] {
  // Güncellemede vardiyanın eski hali "mevcut" listesinden çıkarılır;
  // yoksa vardiya kendi eski haliyle karşılaştırılır.
  const newIds = new Set(newShifts.map((shift) => shift.id).filter((id) => id !== undefined));
  const others = existingShifts.filter((shift) => shift.id === undefined || !newIds.has(shift.id));

  return [checkRest, checkWeeklyLimit, checkConsecutiveDays].flatMap((rule) =>
    rule(others, newShifts, options),
  );
}
