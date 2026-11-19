import {DEFAULT_WORK_RULE_OPTIONS as opts,WorkRuleOptions,checkConsecutiveDays, consecutiveRuns ,checkWeeklyLimit, minutesInWeek ,ShiftInterval,checkRest,checkRestWithFor,checkWorkRules,formatHours,localDayNumber,localWeekStart,} from './work-rules';

// Yerel (+03:00) saatten Date üretir.
const local = (iso: string) => new Date(`${iso}+03:00`);

// 2026-01-05 pazartesi; tablodaki gün adlarını bu haftaya yerleştiriyoruz.
const DAYS = { Pzt: '05', Sal: '06', Çar: '07', Per: '08', Cum: '09', Cmt: '10', Pzr: '11' } as const;
type Day = keyof typeof DAYS;

// shift('Pzt', '08:00', 'Pzt', '16:00') → yerel saatle vardiya
const shift = (startDay: Day, start: string, endDay: Day, end: string, id?: number): ShiftInterval => ({
  ...(id !== undefined && { id }),
  startAt: local(`2026-01-${DAYS[startDay]}T${start}:00`),
  endAt: local(`2026-01-${DAYS[endDay]}T${end}:00`),
});


describe('Zaman yardımcıları', () => {
  it('yerel gece yarısını doğru güne koyar (UTC hâlâ önceki gün)', () => {
    // Pzt 00:30 yerel = Pzr 21:30 UTC
    const mondayEarly = local('2026-01-05T00:30:00').getTime();
    const sundayLate = local('2026-01-04T23:30:00').getTime();
    expect(localDayNumber(mondayEarly, opts) - localDayNumber(sundayLate, opts)).toBe(1);
  });

  it.each([
    ['Pzt 00:00', '2026-01-05T00:00:00', '2026-01-05T00:00:00'],
    ['Çar 10:00', '2026-01-07T10:00:00', '2026-01-05T00:00:00'],
    ['Pzr 23:59', '2026-01-11T23:59:00', '2026-01-05T00:00:00'],
    ['sonraki Pzt 00:00', '2026-01-12T00:00:00', '2026-01-12T00:00:00'],
  ])('%s → haftası yerel pazartesi 00:00 başlar', (_name, at, monday) => {
    expect(localWeekStart(local(at).getTime(), opts)).toBe(local(monday).getTime());
  });

  it.each([
    [360, '6 saat'],
    [390, '6.5 saat'],
    [3960, '66 saat'],
  ])('%d dakika → %s', (minutes, text) => {
    expect(formatHours(minutes)).toBe(text);
  });

  it('kurallar henüz boş: ihlal yok', () => {
    expect(checkWorkRules([], [])).toEqual([]);
  });
});
// P10: iki sürüm aynı testlerden geçmeli
describe.each([
  ['dizi metotları', checkRest],
  ['for döngüsü', checkRestWithFor],
])('REST (%s)', (_name, rule) => {
  it('Pzt 08–16, Pzt 22–Sal 06 → 6 saat dinlenme', () => {
    const violations = rule([shift('Pzt', '08:00', 'Pzt', '16:00')], [shift('Pzt', '22:00', 'Sal', '06:00')], opts);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ rule: 'REST', value: 6, message: '6 saat dinlenme' });
  });

  it('Pzt 08–16, Sal 03–11 → tam 11 saat, ihlal yok', () => {
    expect(rule([shift('Pzt', '08:00', 'Pzt', '16:00')], [shift('Sal', '03:00', 'Sal', '11:00')], opts)).toEqual([]);
  });

  it('yeni vardiya öncekiyle değil sonrakiyle yakınsa da yakalanır', () => {
    const violations = rule([shift('Sal', '02:00', 'Sal', '10:00')], [shift('Pzt', '14:00', 'Pzt', '20:00')], opts);
    expect(violations[0].message).toBe('6 saat dinlenme');
  });

  it('iki mevcut vardiya arasındaki eski sorun raporlanmaz', () => {
    const existing = [shift('Pzt', '08:00', 'Pzt', '16:00'), shift('Pzt', '20:00', 'Sal', '02:00')];
    expect(rule(existing, [shift('Per', '08:00', 'Per', '16:00')], opts)).toEqual([]);
  });
});
describe('WEEKLY_LIMIT', () => {
  const days: Day[] = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  it("Pzt'den Cmt'ye her gün 07:00–18:00 → 66 saat", () => {
    const existing = days.slice(0, 5).map((day) => shift(day, '07:00', day, '18:00')); // Pzt–Cum: 55 saat
    const violations = checkWeeklyLimit(existing, [shift('Cmt', '07:00', 'Cmt', '18:00')], opts);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ rule: 'WEEKLY_LIMIT', value: 66, message: '66 saat' });
    expect(violations[0].shifts).toHaveLength(6);
  });

  it('tam 60 saat kurala uyar', () => {
    const existing = days.slice(0, 4).map((day) => shift(day, '07:00', day, '19:00')); // 4 × 12 = 48
    expect(checkWeeklyLimit(existing, [shift('Cum', '07:00', 'Cum', '19:00')], opts)).toEqual([]); // +12 = 60
  });

  it('Pzr 22:00–Pzt 06:00 → 2 saat önceki haftaya, 6 saat sonraki haftaya sayılır', () => {
    const crossing = { startAt: local('2026-01-11T22:00:00'), endAt: local('2026-01-12T06:00:00') };

    expect(minutesInWeek([crossing], local('2026-01-05T00:00:00').getTime())).toBe(120);
    expect(minutesInWeek([crossing], local('2026-01-12T00:00:00').getTime())).toBe(360);
  });

  it('sınırı aşan vardiyanın yalnızca o haftaya düşen kısmı limite girer', () => {
    // Pzt–Cum 07–18 = 55 saat. Pzr 22–Pzt 06 vardiyası bütün olarak sayılsa 63 saat (ihlal),
    // doğru hesapta bu haftaya yalnızca 2 saati düşer → 57 saat (ihlal yok).
    const existing = days.slice(0, 5).map((day) => shift(day, '07:00', day, '18:00'));
    const crossing = { startAt: local('2026-01-11T22:00:00'), endAt: local('2026-01-12T06:00:00') };

    expect(checkWeeklyLimit(existing, [crossing], opts)).toEqual([]);
  });
});
describe('CONSECUTIVE_DAYS', () => {
  const week: Day[] = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Pzr'];

  it("Pzt'den Pzr'ye her gün 09:00–13:00 → 7 gün", () => {
    const existing = week.slice(0, 6).map((day) => shift(day, '09:00', day, '13:00'));
    const violations = checkConsecutiveDays(existing, [shift('Pzr', '09:00', 'Pzr', '13:00')], opts);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ rule: 'CONSECUTIVE_DAYS', value: 7, message: '7 gün' });
    expect(violations[0].shifts).toHaveLength(7);
  });

  it('6 gün üst üste kurala uyar', () => {
    const existing = week.slice(0, 5).map((day) => shift(day, '09:00', day, '13:00'));
    expect(checkConsecutiveDays(existing, [shift('Cmt', '09:00', 'Cmt', '13:00')], opts)).toEqual([]);
  });

  it('gece yarısını geçen vardiya iki gün sayılır', () => {
    // Pzt–Cum (5 gün) + Cmt 22:00–Pzr 06:00 (Cmt ve Pzr) → 7 gün
    const existing = week.slice(0, 5).map((day) => shift(day, '09:00', day, '13:00'));
    const violations = checkConsecutiveDays(existing, [shift('Cmt', '22:00', 'Pzr', '06:00')], opts);
    expect(violations[0]?.value).toBe(7);
  });

  it('tam 00:00 biten vardiya ertesi güne dokunmaz', () => {
    // Pzt–Cmt (6 gün) + Cmt 18:00–Pzr 00:00 → hâlâ 6 gün
    const existing = week.slice(0, 6).map((day) => shift(day, '09:00', day, '13:00'));
    expect(checkConsecutiveDays(existing, [shift('Cmt', '18:00', 'Pzr', '00:00')], opts)).toEqual([]);
  });

  it('boş gün seriyi böler', () => {
    expect(consecutiveRuns([1, 2, 3, 5, 6])).toEqual([[1, 2, 3], [5, 6]]);
    expect(consecutiveRuns([])).toEqual([]);
  });
});
describe('checkWorkRules: görevdeki örnek tablosu', () => {
  const everyDay = (days: Day[], start: string, end: string) => days.map((day) => shift(day, start, day, end));

  // [açıklama, mevcut vardiyalar, yeni vardiyalar, options, beklenen ihlaller]
  it.each<[string, ShiftInterval[], ShiftInterval[], WorkRuleOptions, { rule: string; message: string }[]]>([
    [
      'Pzt 08:00–16:00, Pzt 22:00–Sal 06:00 → REST: 6 saat',
      [shift('Pzt', '08:00', 'Pzt', '16:00')],
      [shift('Pzt', '22:00', 'Sal', '06:00')],
      opts,
      [{ rule: 'REST', message: '6 saat dinlenme' }],
    ],
    [
      'Pzt 08:00–16:00, Sal 03:00–11:00 → ihlal yok (tam 11 saat)',
      [shift('Pzt', '08:00', 'Pzt', '16:00')],
      [shift('Sal', '03:00', 'Sal', '11:00')],
      opts,
      [],
    ],
    [
      "Pzt'den Cmt'ye her gün 07:00–18:00 → WEEKLY_LIMIT: 66 saat",
      everyDay(['Pzt', 'Sal', 'Çar', 'Per', 'Cum'], '07:00', '18:00'),
      everyDay(['Cmt'], '07:00', '18:00'),
      opts,
      [{ rule: 'WEEKLY_LIMIT', message: '66 saat' }],
    ],
    [
      "Pzt'den Pzr'ye her gün 09:00–13:00 → CONSECUTIVE_DAYS: 7 gün",
      everyDay(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'], '09:00', '13:00'),
      everyDay(['Pzr'], '09:00', '13:00'),
      opts,
      [{ rule: 'CONSECUTIVE_DAYS', message: '7 gün' }],
    ],
    [
      'Pzr 22:00–Pzt 06:00 → 2 saat önceki haftaya, 6 saat sonraki haftaya',
      [],
      // Sonraki haftanın pazartesisine taştığı için shift() yerine doğrudan tarih
      [{ startAt: local('2026-01-11T22:00:00'), endAt: local('2026-01-12T06:00:00') }],
      // Limit 1 saat: iki hafta da aşar ve her ihlalin mesajı o haftaya düşen süreyi gösterir.
      { ...opts, weeklyLimitHours: 1 },
      [{ rule: 'WEEKLY_LIMIT', message: '2 saat' }, { rule: 'WEEKLY_LIMIT', message: '6 saat' }],
    ],
  ])('%s', (_name, existing, newShifts, options, expected) => {
    const violations = checkWorkRules(existing, newShifts, options);
    expect(violations.map(({ rule, message }) => ({ rule, message }))).toEqual(expected);
  });
});

describe('checkWorkRules: kabul kriterleri', () => {
  // Üç kuralı birden tetikleyen hafta:
  // Pzt–Cmt her gün 07–18 (mevcut) + Pzr 07–18 (yeni) → 77 + 1 = 78 saat, 7 gün
  // Pzt 00:00–01:00 (yeni) ile Pzt 07:00 arasında 6 saat dinlenme
  const existing = (['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] as Day[]).map((day, i) => shift(day, '07:00', day, '18:00', i + 1));
  const newShifts = [shift('Pzr', '07:00', 'Pzr', '18:00'), shift('Pzt', '00:00', 'Pzt', '01:00')];

  it('fonksiyona verilen diziler ve içindeki vardiyalar değişmez', () => {
    const existingBefore = structuredClone(existing);
    const newBefore = structuredClone(newShifts);
    // Dondurulmuş diziyi yerinde sıralamaya kalkarsa TypeError fırlatır
    const frozenExisting = Object.freeze([...existing]);
    const frozenNew = Object.freeze([...newShifts]);

    expect(() => checkWorkRules(frozenExisting, frozenNew)).not.toThrow();
    expect(existing).toEqual(existingBefore);
    expect(newShifts).toEqual(newBefore);
  });

  it('vardiyalar sırasız verilse de sonuç aynı', () => {
    const expected = checkWorkRules(existing, newShifts);
    expect(expected.map((v) => v.rule).sort()).toEqual(['CONSECUTIVE_DAYS', 'REST', 'WEEKLY_LIMIT']);

    expect(checkWorkRules([...existing].reverse(), [...newShifts].reverse())).toEqual(expected);
    expect(checkWorkRules([existing[3], existing[0], existing[5], existing[1], existing[4], existing[2]], newShifts)).toEqual(expected);
  });

  it('güncellemede vardiyanın eski hali kendisiyle karşılaştırılmaz', () => {
    const before = shift('Pzt', '08:00', 'Pzt', '16:00', 42);
    // Aynı vardiya (id 42) bir saat ileri alınıyor
    const after = shift('Pzt', '09:00', 'Pzt', '17:00', 42);

    // Eski hal listede kalsa bile ihlal çıkmamalı (aksi halde 08–16 ile 09–17 "-7 saat dinlenme" olurdu)
    expect(checkWorkRules([before], [after])).toEqual([]);
  });
});
