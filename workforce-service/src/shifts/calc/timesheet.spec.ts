import { ShiftInterval } from './work-rules';
import { TURKEY_PUBLIC_HOLIDAYS } from './holidays';
import { calculateTimesheetMinuteByMinute } from './timesheet-reference';
import { calculateTimesheetBySplitting } from './timesheet-split';
import { TimesheetCalculator, TimesheetMonth, resolveTimesheetPeriod } from './timesheet.types';
import { generateMonths } from '../../../test/timesheet/timesheet-generator';

// Yerel (+03:00) saatle vardiya: shift('2026-10-28T08:00', '2026-10-28T16:00')
const shift = (start: string, end: string): ShiftInterval => ({
  startAt: new Date(`${start}+03:00`),
  endAt: new Date(`${end}+03:00`),
});
const h = (hours: number) => hours * 60; // saat → dakika
const day = (result: TimesheetMonth, date: string) => result.days.find((row) => row.date === date)!;
const week = (result: TimesheetMonth, weekStart: string) => result.weeks.find((row) => row.weekStart === weekStart)!;

// Zorunlu örnek: Ekim 2026, aynı personel
const OCTOBER_SHIFTS = [
  shift('2026-10-28T08:00:00', '2026-10-28T16:00:00'),
  shift('2026-10-30T18:00:00', '2026-10-31T02:00:00'),
  shift('2026-10-31T22:00:00', '2026-11-01T06:00:00'),
];
// Zorunlu örnek: Kasım 2026, farklı personel (2–7 Kasım her gün 08–16)
const NOVEMBER_SHIFTS = ['02', '03', '04', '05', '06', '07'].map((d) => shift(`2026-11-${d}T08:00:00`, `2026-11-${d}T16:00:00`));

describe('Resmî tatil takvimi', () => {
  it('her tarih bir kez geçer, sıralıdır ve 2026–2027 içindedir', () => {
    const dates = TURKEY_PUBLIC_HOLIDAYS.map((holiday) => holiday.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
    expect(dates.every((date) => /^202[67]-\d{2}-\d{2}$/.test(date))).toBe(true);
  });

  it('arifeler ve 28 Ekim yarım gündür', () => {
    const halfDays = TURKEY_PUBLIC_HOLIDAYS.filter((holiday) => holiday.halfDay).map((holiday) => holiday.date);
    expect(halfDays).toEqual(['2026-03-19', '2026-05-26', '2026-10-28', '2027-03-08', '2027-05-15', '2027-10-28']);
  });
});

describe('Puantaj dönemi', () => {
  it('Kasım 2026: ayı kapsayan tam haftalar 26 Ekim pazartesi – 7 Aralık pazartesi', () => {
    const period = resolveTimesheetPeriod('2026-11');
    expect(new Date(period.monthStart).toISOString()).toBe('2026-10-31T21:00:00.000Z');
    expect(new Date(period.weeksStart).toISOString()).toBe('2026-10-25T21:00:00.000Z');
    expect(new Date(period.weeksEnd).toISOString()).toBe('2026-12-06T21:00:00.000Z');
  });
});

describe.each<[string, TimesheetCalculator]>([
  ['dakika dakika (referans)', calculateTimesheetMinuteByMinute],
  ['aralık bölme', calculateTimesheetBySplitting],
])('Puantaj — %s', (_name, calculate) => {
  describe('zorunlu örnek: Ekim 2026', () => {
    const result = calculate(OCTOBER_SHIFTS, '2026-10');

    it('28 Ekim 08–16: toplam 8, tatil 3 (yarım gün 13.00)', () => {
      expect(day(result, '2026-10-28')).toMatchObject({ total: h(8), holiday: h(3), night: 0, weekend: 0, overtime: 0 });
    });

    it('30 Ekim: toplam 6, gece 4', () => {
      expect(day(result, '2026-10-30')).toMatchObject({ total: h(6), night: h(4), holiday: 0, weekend: 0 });
    });

    it('31 Ekim: iki vardiyadan 2+2 saat; toplam 4, gece 4, hafta sonu 4', () => {
      expect(day(result, '2026-10-31')).toMatchObject({ total: h(4), night: h(4), weekend: h(4), holiday: 0 });
    });

    it('ay toplamı: 18 / gece 8 / hafta sonu 4 / tatil 3 / fazla mesai 0', () => {
      expect(result.totals).toEqual({ total: h(18), night: h(8), weekend: h(4), holiday: h(3), overtime: 0 });
    });

    it('vardiyasız günler sıfırla üretilir', () => {
      expect(result.days).toHaveLength(31);
      expect(day(result, '2026-10-01')).toEqual({ date: '2026-10-01', total: 0, night: 0, holiday: 0, weekend: 0, overtime: 0 });
    });

    it('1 Kasım\'daki 6 saat Ekim\'e girmez ama tam hafta toplamındadır', () => {
      expect(week(result, '2026-10-26')).toEqual({ weekStart: '2026-10-26', total: h(24), overtime: 0, monthTotal: h(18), monthOvertime: 0 });
    });

    it('Kasım hesabında kalan 6 saat 1 Kasım pazar gününe yazılır', () => {
      const november = calculate(OCTOBER_SHIFTS, '2026-11');
      expect(day(november, '2026-11-01')).toMatchObject({ total: h(6), night: h(6), weekend: h(6) });
      expect(november.totals.total).toBe(h(6));
    });
  });

  describe('zorunlu örnek: Kasım 2026', () => {
    const result = calculate(NOVEMBER_SHIFTS, '2026-11');

    it('haftalık toplam 48, fazla mesai 3', () => {
      expect(week(result, '2026-11-02')).toEqual({ weekStart: '2026-11-02', total: h(48), overtime: h(3), monthTotal: h(48), monthOvertime: h(3) });
    });

    it('fazla mesai 7 Kasım 13.00–16.00 arasındadır', () => {
      expect(day(result, '2026-11-06').overtime).toBe(0);
      expect(day(result, '2026-11-07')).toMatchObject({ total: h(8), weekend: h(8), overtime: h(3) });
      expect(result.totals.overtime).toBe(h(3));
    });
  });

  describe('sınır durumları', () => {
    it('pazar → pazartesi geçişi: pazar kısmı önceki haftanın fazla mesaisine, pazartesi yeni haftaya', () => {
      const result = calculate([...NOVEMBER_SHIFTS, shift('2026-11-08T22:00:00', '2026-11-09T06:00:00')], '2026-11');
      expect(day(result, '2026-11-08')).toMatchObject({ total: h(2), night: h(2), weekend: h(2), overtime: h(2) });
      expect(day(result, '2026-11-09')).toMatchObject({ total: h(6), night: h(6), weekend: 0, overtime: 0 });
      expect(week(result, '2026-11-02')).toMatchObject({ total: h(50), overtime: h(5) });
      expect(week(result, '2026-11-09')).toMatchObject({ total: h(6), overtime: 0 });
    });

    it('ayı aşan hafta: fazla mesai tam haftaya göre, aya yalnızca ay içindeki kısım', () => {
      const shifts = [
        ...['26', '27', '28', '29', '30'].map((d) => shift(`2026-10-${d}T08:00:00`, `2026-10-${d}T17:00:00`)), // 45 saat
        shift('2026-11-01T08:00:00', '2026-11-01T12:00:00'),
      ];
      const november = calculate(shifts, '2026-11');
      expect(day(november, '2026-11-01')).toMatchObject({ total: h(4), weekend: h(4), overtime: h(4) });
      expect(week(november, '2026-10-26')).toEqual({ weekStart: '2026-10-26', total: h(49), overtime: h(4), monthTotal: h(4), monthOvertime: h(4) });
      const october = calculate(shifts, '2026-10');
      expect(october.totals.overtime).toBe(0);
      expect(week(october, '2026-10-26')).toEqual({ weekStart: '2026-10-26', total: h(49), overtime: h(4), monthTotal: h(45), monthOvertime: 0 });
    });

    it('tam 45 saat fazla mesai değildir; 1 dakika fazlası 1 dakikadır', () => {
      const base = ['09', '10', '11', '12', '13'].map((d) => shift(`2026-11-${d}T08:00:00`, `2026-11-${d}T17:00:00`));
      expect(calculate(base, '2026-11').totals.overtime).toBe(0);
      expect(calculate([...base, shift('2026-11-14T08:00:00', '2026-11-14T08:01:00')], '2026-11').totals.overtime).toBe(1);
    });

    it('dakika altı hassasiyet: 19:59:30–20:00:45 → toplam 1.25, gece 0.75 dakika', () => {
      const result = calculate([shift('2026-11-10T19:59:30', '2026-11-10T20:00:45')], '2026-11');
      expect(result.totals.total).toBeCloseTo(1.25, 9);
      expect(result.totals.night).toBeCloseTo(0.75, 9);
    });

    it('yarım gün arife (19 Mart 2026): 12.00–14.30 → tatil 1.5 saat', () => {
      expect(calculate([shift('2026-03-19T12:00:00', '2026-03-19T14:30:00')], '2026-03').totals).toMatchObject({ total: h(2.5), holiday: h(1.5) });
    });

    it('cumartesiye denk gelen tam gün tatil (30 Mayıs 2026) hafta sonuna eklenmez', () => {
      expect(calculate([shift('2026-05-30T10:00:00', '2026-05-30T12:00:00')], '2026-05').totals).toMatchObject({ holiday: h(2), weekend: 0 });
    });

    it('arifeden bayrama geçen gece vardiyası tamamen tatil ve gecedir', () => {
      expect(calculate([shift('2026-10-28T22:00:00', '2026-10-29T06:00:00')], '2026-10').totals).toMatchObject({ total: h(8), holiday: h(8), night: h(8) });
    });

    it('yılbaşı gecesi: Aralık\'a 2 saat (tatil değil), Ocak\'a 4 saat tatil', () => {
      const shifts = [shift('2026-12-31T22:00:00', '2027-01-01T04:00:00')];
      expect(calculate(shifts, '2026-12').totals).toMatchObject({ total: h(2), night: h(2), holiday: 0 });
      expect(calculate(shifts, '2027-01').totals).toMatchObject({ total: h(4), night: h(4), holiday: h(4) });
      expect(week(calculate(shifts, '2027-01'), '2026-12-28')).toMatchObject({ total: h(6), monthTotal: h(4) });
    });

    it('çakışan vardiyalarda aynı an bir kez sayılır', () => {
      const result = calculate([shift('2026-11-10T08:00:00', '2026-11-10T16:00:00'), shift('2026-11-10T12:00:00', '2026-11-10T18:00:00')], '2026-11');
      expect(result.totals.total).toBe(h(10));
    });

    it('vardiyasız ay: bütün günler ve haftalar sıfır', () => {
      const result = calculate([], '2026-11');
      expect(result.days).toHaveLength(30);
      expect(result.weeks.map((row) => row.weekStart)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
      expect([...result.days, ...result.weeks, result.totals].every((row) => Object.values(row).every((value) => typeof value === 'string' || value === 0))).toBe(true);
    });
  });
});

// ---------- İki algoritmanın karşılaştırılması (yuvarlama öncesi dakika değerleri) ----------

const TOLERANCE_MINUTES = 1e-6; // kesirli dakikalarda kayan nokta toplama sırası farkı

function differences(expected: TimesheetMonth, actual: TimesheetMonth): string[] {
  const out: string[] = [];
  const compare = (label: string, a: Record<string, unknown>, b: Record<string, unknown>) => {
    for (const key of Object.keys(a)) {
      const x = a[key];
      const y = b[key];
      const same = typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) <= TOLERANCE_MINUTES : x === y;
      if (!same) out.push(`${label}.${key}: referans=${String(x)} bölme=${String(y)}`);
    }
  };
  if (expected.days.length !== actual.days.length || expected.weeks.length !== actual.weeks.length) {
    return ['satır sayıları farklı'];
  }
  expected.days.forEach((row, i) => compare(`gün ${row.date}`, row, actual.days[i]));
  expected.weeks.forEach((row, i) => compare(`hafta ${row.weekStart}`, row, actual.weeks[i]));
  compare('ay', expected.totals, actual.totals);
  return out;
}

describe('Karşılaştırma: dakika dakika referans = aralık bölme', () => {
  const SEED = 20261119;
  const months = generateMonths(SEED, 200);

  it('üretilen veri istenen durumları kapsar', () => {
    const results = months.map(({ shifts, month }) => calculateTimesheetMinuteByMinute(shifts, month));
    const crossesMonth = months.some(({ shifts, month }) => {
      const period = resolveTimesheetPeriod(month);
      return shifts.some((s) => s.startAt.getTime() < period.monthStart && s.endAt.getTime() > period.monthStart);
    });
    const crossesWeek = months.some(({ shifts }) => shifts.some((s) => {
      const startDay = new Date(s.startAt.getTime() + 3 * 3_600_000).getUTCDay();
      const endDay = new Date(s.endAt.getTime() - 1 + 3 * 3_600_000).getUTCDay();
      return startDay === 0 && endDay === 1;
    }));
    const subMinute = months.some(({ shifts }) => shifts.some((s) => s.startAt.getTime() % 60_000 !== 0));
    const halfDayMonths = new Set(TURKEY_PUBLIC_HOLIDAYS.filter((x) => x.halfDay).map((x) => x.date.slice(0, 7)));

    expect(months.filter(({ shifts }) => shifts.length === 0).length).toBeGreaterThan(0);
    expect(results.filter((r) => r.totals.overtime > 0).length).toBeGreaterThan(20);
    expect(results.filter((r) => r.totals.holiday > 0).length).toBeGreaterThan(20);
    expect(results.filter((r) => r.totals.holiday > 0 && halfDayMonths.has(r.month)).length).toBeGreaterThan(5);
    expect(results.filter((r) => r.weeks.some((w) => w.overtime !== w.monthOvertime)).length).toBeGreaterThan(5);
    expect(results.filter((r) => r.totals.night > 0).length).toBeGreaterThan(100);
    expect(crossesMonth).toBe(true);
    expect(crossesWeek).toBe(true);
    expect(subMinute).toBe(true);
  });

  it.each(months.map((generated, index) => [index, generated.month, generated.profile, generated] as const))(
    'liste #%d (%s, %s): günlük, haftalık ve aylık sonuçlar aynı',
    (_index, month, _profile, generated) => {
      const reference = calculateTimesheetMinuteByMinute(generated.shifts, month);
      const split = calculateTimesheetBySplitting(generated.shifts, month);
      expect(differences(reference, split).slice(0, 10)).toEqual([]);
    },
  );

  it.each([
    ['Ekim örneği', OCTOBER_SHIFTS, '2026-10'],
    ['Kasım örneği', NOVEMBER_SHIFTS, '2026-11'],
    ['vardiyasız ay', [], '2027-02'],
  ] as const)('sabit liste: %s', (_name, shifts, month) => {
    expect(differences(calculateTimesheetMinuteByMinute(shifts, month), calculateTimesheetBySplitting(shifts, month))).toEqual([]);
  });
});
