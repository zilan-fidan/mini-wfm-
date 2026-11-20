import { overlapMinutes } from '../../common/calc/interval';
import { DEFAULT_WORK_RULE_OPTIONS as opts, ShiftInterval, checkWorkRules, daysTouched, localDayNumber } from './work-rules';
import {
  DEFAULT_ROTATION_OPTIONS, ExistingShift, RotationMember, RotationPlan, RotationRequest, RotationSlot,
  buildRotationPlan, isValidLocalDate, parseTimeOfDay, planDates, resolveSlotInterval, slotMinutes, validateRotationRequest,
} from './rotation';

// Test için tek kişilik vardiya kalıbı üretir: slot('Gece', '00:00', '08:00').
const slot = (name: string, startTime: string, endTime: string): RotationSlot => ({ name, startTime, endTime, required: 1 });
const GECE = slot('Gece', '00:00', '08:00');
const SABAH = slot('Sabah', '08:00', '16:00');
const AKSAM = slot('Akşam', '16:00', '24:00');

describe('Rotasyon — tarih/saat yardımcıları', () => {
  it.each([
    ['2026-11-02', true],
    ['2028-02-29', true],   // artık yıl
    ['2026-02-29', false],  // 2026 artık yıl değil
    ['2026-02-30', false],  // Date.UTC taşmasını yakalar
    ['2026-11-2', false],
    ['2026-13-01', false],
  ])('isValidLocalDate(%s) → %s', (date, expected) => {
    expect(isValidLocalDate(date)).toBe(expected);
  });

  it.each([
    ['00:00', false, 0],
    ['08:30', false, 510],
    ['23:59', false, 1439],
    ['24:00', false, null], // başlangıç olarak geçersiz
    ['24:00', true, 1440],  // bitiş olarak günün sonu
    ['24:01', true, null],
    ['08:60', false, null],
    ['8:00', false, null],
  ])('parseTimeOfDay(%s, bitiş=%s) → %s', (time, allowEndOfDay, expected) => {
    expect(parseTimeOfDay(time, { allowEndOfDay })).toBe(expected);
  });

  it('plan günleri ay ve yıl sınırını kronolojik geçer', () => {
    expect(planDates('2026-12-30', 4)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('kalıp dakikaları: 24:00 günün sonu, bitiş ≤ başlangıç ertesi güne taşar', () => {
    expect(slotMinutes(AKSAM)).toEqual({ start: 960, end: 1440 });
    expect(slotMinutes(slot('Uzun gece', '22:00', '06:00'))).toEqual({ start: 1320, end: 1800 });
    expect(() => slotMinutes(slot('Hatalı', '24:00', '08:00'))).toThrow('Geçersiz vardiya saati');
  });

  it('kalıpları yerel güne yerleştirir (+03:00)', () => {
    expect(resolveSlotInterval('2026-11-02', GECE, opts)).toEqual({
      startAt: new Date('2026-11-02T00:00:00+03:00'),
      endAt: new Date('2026-11-02T08:00:00+03:00'),
    });
    expect(resolveSlotInterval('2026-11-02', AKSAM, opts)).toEqual({
      startAt: new Date('2026-11-02T16:00:00+03:00'),
      endAt: new Date('2026-11-03T00:00:00+03:00'),
    });
  });

  // Tarih mantığı MWFM-35 ile aynı günü görmeli; yoksa CONSECUTIVE_DAYS yanlış sayar.
  it('MWFM-35 gün hesabıyla uyumlu: Gece/Akşam o güne, 22–06 iki güne dokunur', () => {
    const day = localDayNumber(new Date('2026-11-02T12:00:00+03:00').getTime(), opts);
    expect(daysTouched(resolveSlotInterval('2026-11-02', GECE, opts), opts)).toEqual([day]);
    expect(daysTouched(resolveSlotInterval('2026-11-02', SABAH, opts), opts)).toEqual([day]);
    // 24:00'te biten vardiya ertesi güne dokunmaz ([start, end) yarı açık).
    expect(daysTouched(resolveSlotInterval('2026-11-02', AKSAM, opts), opts)).toEqual([day]);
    expect(daysTouched(resolveSlotInterval('2026-11-02', slot('Uzun gece', '22:00', '06:00'), opts), opts)).toEqual([day, day + 1]);
  });
});

// ---------- Planlayıcı ----------

// 2026-11-02 pazartesi. Sicil numaraları üyelerin sırasını belirler: A < B < C ...
const member = (i: number): RotationMember => ({
  id: i + 1, registrationNumber: `S00${i + 1}`, firstname: String.fromCharCode(65 + i), lastname: 'Test',
});
// İlk `size` üyeden oluşan ekip; sicil sırası A, B, C... ile aynıdır.
const team = (size: number) => Array.from({ length: size }, (_, i) => member(i));
const WEEK: RotationRequest = { startDate: '2026-11-02', days: 7, slots: [GECE, SABAH, AKSAM] };
const UNSORTED: RotationRequest = { ...WEEK, slots: [SABAH, AKSAM, GECE] };
const NO_SORT = { ...DEFAULT_ROTATION_OPTIONS, sortSlotsByStart: false };

// Plandan bir personelin atanmış vardiyalarını checkWorkRules'un beklediği biçimde çıkarır.
const shiftsOf = (plan: RotationPlan, id: number): ShiftInterval[] =>
  plan.assignments.filter((a) => a.workforceUserId === id).map(({ startAt, endAt }) => ({ startAt, endAt }));
// Vardiya dağılımını okunur metne çevirir: 'A=6 B=5 C=5 D=5'.
const countsOf = (plan: RotationPlan) => plan.workloads.map((w) => `${w.firstname}=${w.shiftCount}`).join(' ');
// Planı gün gün tabloya çevirir: ['Gece:A Sabah:B Akşam:C', ...]; rotasyonu tek bakışta karşılaştırmak için.
const grid = (plan: RotationPlan) =>
  planDates(WEEK.startDate, WEEK.days).map((date) =>
    plan.assignments.filter((a) => a.date === date).map((a) => `${a.slotName}:${a.firstname}`).join(' '));

describe('validateRotationRequest', () => {
  it.each([
    [{ ...WEEK, startDate: '2026-02-30' }, 'startDate'],
    [{ ...WEEK, days: 0 }, 'days'],
    [{ ...WEEK, days: 15 }, 'days'],
    [{ ...WEEK, slots: [] }, 'En az bir'],
    [{ ...WEEK, slots: [GECE, GECE] }, 'tekrar ediyor'],
    [{ ...WEEK, slots: [{ ...GECE, required: 0 }] }, 'required'],
    [{ ...WEEK, slots: [slot('X', '24:00', '08:00')] }, 'saati'],
  ])('geçersiz isteği reddeder (%#)', (request, fragment) => {
    expect(validateRotationRequest(request)).toContain(fragment);
    expect(() => buildRotationPlan(team(1), [], request)).toThrow(fragment);
  });

  it('geçerli istekte null döner', () => {
    expect(validateRotationRequest(WEEK)).toBeNull();
  });
});

describe('Test 1 — 4 personel, 7 gün', () => {
  const plan = buildRotationPlan(team(4), [], WEEK);

  it('21 atama, eksik yok; bir kişi 6, üç kişi 5 vardiya; adalet farkı 8 saat', () => {
    expect(plan.assignments).toHaveLength(21);
    expect(plan.unfilled).toEqual([]);
    expect(countsOf(plan)).toBe('A=6 B=5 C=5 D=5');
    expect(plan.workloads.map((w) => w.minutes)).toEqual([2880, 2400, 2400, 2400]);
    expect(plan.fairnessGapMinutes).toBe(480);
  });

  it('kalıplar gün içinde başlangıç saatine göre işlenir ve döngüsel bir rotasyon oluşur', () => {
    expect(grid(plan)).toEqual([
      'Gece:A Sabah:B Akşam:C',
      'Gece:D Sabah:A Akşam:B',
      'Gece:C Sabah:D Akşam:A',
      'Gece:B Sabah:C Akşam:D',
      'Gece:A Sabah:B Akşam:C',
      'Gece:D Sabah:A Akşam:B',
      'Gece:C Sabah:D Akşam:A',
    ]);
  });
});

describe('Test 2 — 3 personel, 7 gün', () => {
  const plan = buildRotationPlan(team(3), [], WEEK);

  it('ilk 6 gün herkes her gün çalışır, 7. gün üç vardiya da boş kalır', () => {
    expect(grid(plan)).toEqual([...Array(6).fill('Gece:A Sabah:B Akşam:C'), '']);
    expect(countsOf(plan)).toBe('A=6 B=6 C=6');
    expect(plan.fairnessGapMinutes).toBe(0);
    expect(plan.unfilled.map(({ date, slotName, required, assigned, missing }) => ({ date, slotName, required, assigned, missing })))
      .toEqual(['Gece', 'Sabah', 'Akşam'].map((slotName) => ({ date: '2026-11-08', slotName, required: 1, assigned: 0, missing: 1 })));
  });

  it('7. günün nedeni CONSECUTIVE_DAYS: her kişi kendi vardiyasına 7. gün olarak alınamaz', () => {
    // 11 saat dinlenme yüzünden herkes kendi kalıbına kilitlenmiştir (Akşam 24:00 → Gece 00:00 = 0 saat).
    // Kendi kalıbında REST sorunu yok; tek engel 7 ardışık gün.
    plan.workloads.forEach((w, i) => {
      const own = resolveSlotInterval('2026-11-08', WEEK.slots[i], opts);
      expect(checkWorkRules(shiftsOf(plan, w.workforceUserId), [own], opts).map((v) => v.rule)).toEqual(['CONSECUTIVE_DAYS']);
    });
  });
});

describe('Test 3 — vardiya sıralamasının önemi', () => {
  it.each([4, 5])('%d personel: sıralı plan eksiksiz, sırasız planda 7. gün Gece boş kalır', (size) => {
    const sorted = buildRotationPlan(team(size), [], WEEK);
    const unsorted = buildRotationPlan(team(size), [], UNSORTED, NO_SORT);

    expect(sorted.unfilled).toEqual([]);
    expect(unsorted.unfilled.map((u) => `${u.date} ${u.slotName}`)).toEqual(['2026-11-08 Gece']);
    // Sırasız planda Gece her gün aynı kişiye (C) düşer; adalet de bozulur.
    expect(unsorted.workloads.find((w) => w.firstname === 'C')!.shiftCount).toBe(6);
    expect(unsorted.fairnessGapMinutes).toBeGreaterThan(sorted.fairnessGapMinutes);
  });

  it('sırasız planda 7. gün Gece: her aday bir kural yüzünden elenir', () => {
    const plan = buildRotationPlan(team(4), [], UNSORTED, NO_SORT);
    const night = resolveSlotInterval('2026-11-08', GECE, opts);
    const reasons = Object.fromEntries(plan.workloads.map((w) => [
      w.firstname,
      checkWorkRules(shiftsOf(plan, w.workforceUserId), [night], opts).map((v) => v.rule),
    ]));
    // A: aynı gün 08:00 Sabah'ı zaten aldı (0 saat dinlenme).
    // B: iki yandan sıkışır — önceki gün Sabah 16:00'da bitti ve aynı gün Akşam 16:00'da başlıyor (2 × 8 saat).
    // D: önceki gün Akşam'ı 24:00'te bitti (0 saat).
    // C: 1–6. günlerin Gece'sini aldı; 7. gün 7 ardışık gün olur.
    expect(reasons).toEqual({ A: ['REST'], B: ['REST', 'REST'], C: ['CONSECUTIVE_DAYS'], D: ['REST'] });
  });

  // Greedy neden takılır? Gece 00:00'da başlar ama gün içinde EN SON planlanır. O ana kadar
  // aynı günün Sabah/Akşam'ı verilmiş, önceki günün Akşam'ı 24:00'te bitmiştir; bu üç kişi
  // dinlenme yüzünden elenir ve Gece her gün "kalan tek kişiye" düşer. Greedy önceki
  // seçimlerini geri almadığı için 7. gün bu kişinin seri sınırına takılır. Oysa aynı ekiple
  // eksiksiz bir plan VARDIR (sıralı plan): sorun kapasite değil, karar sırasıdır.
  it('sırasız plan çıkmaza girse de geçerli bir tam plan mevcuttur', () => {
    const sorted = buildRotationPlan(team(4), [], WEEK);
    sorted.workloads.forEach((w) => expect(checkWorkRules([], shiftsOf(sorted, w.workforceUserId), opts)).toEqual([]));
  });
});

describe('Test 4 — REST', () => {
  // Personel A'nın planda olmayan, 08:00'de biten mevcut Gece vardiyası var.
  const existingNight: ExistingShift = { workforceUserId: 1, ...resolveSlotInterval('2026-11-02', GECE, opts) };
  const morningOnly: RotationRequest = { startDate: '2026-11-02', days: 1, slots: [SABAH] };

  it('08:00 de biten Gece sonrası aynı gün 08:00 Sabah verilmez; sıradaki uygun kişi seçilir', () => {
    const plan = buildRotationPlan(team(2), [existingNight], morningOnly);
    expect(plan.assignments.map((a) => a.firstname)).toEqual(['B']);
    expect(checkWorkRules([existingNight], [resolveSlotInterval('2026-11-02', SABAH, opts)], opts)[0])
      .toMatchObject({ rule: 'REST', value: 0 });
  });

  it('başka aday yoksa vardiya unfilled olur', () => {
    const plan = buildRotationPlan([member(0)], [existingNight], morningOnly);
    expect(plan.assignments).toEqual([]);
    expect(plan.unfilled).toMatchObject([{ slotName: 'Sabah', missing: 1 }]);
  });

  it('plan öncesindeki 6 günlük seri de sayılır (CONSECUTIVE_DAYS)', () => {
    const previous = planDates('2026-10-27', 6).map((date): ExistingShift => ({ workforceUserId: 1, ...resolveSlotInterval(date, SABAH, opts) }));
    const plan = buildRotationPlan(team(2), previous, morningOnly);
    expect(plan.assignments.map((a) => a.firstname)).toEqual(['B']);
  });
});

describe('Test 5 — deterministik sonuç', () => {
  it('aynı girdi iki kez → birebir aynı sonuç', () => {
    expect(buildRotationPlan(team(4), [], WEEK)).toEqual(buildRotationPlan(team(4), [], WEEK));
  });

  it('üye ve kalıp girdi sırası sonucu değiştirmez', () => {
    const shuffled = [member(2), member(0), member(3), member(1)];
    const reordered = { ...WEEK, slots: [AKSAM, GECE, SABAH] };
    expect(buildRotationPlan(shuffled, [], reordered)).toEqual(buildRotationPlan(team(4), [], WEEK));
  });

  it('girdiler değiştirilmez (dondurulmuş nesnelerle çalışır)', () => {
    const existing: ExistingShift[] = [{ workforceUserId: 1, ...resolveSlotInterval('2026-11-01', AKSAM, opts) }];
    const members = team(4);
    const snapshot = structuredClone({ members, existing, WEEK });
    // Diziyi ve içindeki her nesneyi dondurur; fonksiyon girdiye yazmaya çalışırsa hata verir.
    const freeze = <T>(items: T[]) => Object.freeze(items.map((item) => Object.freeze({ ...item })));
    buildRotationPlan(freeze(members), freeze(existing), Object.freeze({ ...WEEK, slots: freeze([...WEEK.slots]) }));
    expect({ members, existing, WEEK }).toEqual(snapshot);
  });
});

describe('Test 6 — üretilen her plan çalışma kurallarına uyar', () => {
  const LONG_DAY = slot('Uzun gündüz', '07:00', '19:00');
  const LONG_NIGHT = slot('Uzun gece', '19:00', '07:00'); // gece yarısını geçer
  const scenarios: Array<[string, RotationMember[], ExistingShift[], RotationRequest, typeof DEFAULT_ROTATION_OPTIONS]> = [
    ['4 kişi, 7 gün', team(4), [], WEEK, DEFAULT_ROTATION_OPTIONS],
    ['3 kişi, 7 gün', team(3), [], WEEK, DEFAULT_ROTATION_OPTIONS],
    ['5 kişi, sırasız', team(5), [], UNSORTED, NO_SORT],
    ['6 kişi, 14 gün, 2’şer kişi', team(6), [], { ...WEEK, days: 14, slots: WEEK.slots.map((s) => ({ ...s, required: 2 })) }, DEFAULT_ROTATION_OPTIONS],
    ['4 kişi, 12 saatlik vardiyalar, 14 gün (haftalık 60 saat sınırı)', team(4), [], { startDate: '2026-11-04', days: 14, slots: [LONG_DAY, LONG_NIGHT] }, DEFAULT_ROTATION_OPTIONS],
    ['mevcut vardiyalarla', team(4), [
      { workforceUserId: 1, ...resolveSlotInterval('2026-11-01', AKSAM, opts) },
      { workforceUserId: 2, ...resolveSlotInterval('2026-11-04', SABAH, opts) },
      ...planDates('2026-10-27', 6).map((date) => ({ workforceUserId: 3, ...resolveSlotInterval(date, GECE, opts) })),
    ], WEEK, DEFAULT_ROTATION_OPTIONS],
  ];

  it.each(scenarios)('%s', (_name, members, existing, request, options) => {
    const plan = buildRotationPlan(members, existing, request, options);
    expect(plan.assignments.length).toBeGreaterThan(0);

    for (const w of plan.workloads) {
      const mine = existing.filter((s) => s.workforceUserId === w.workforceUserId);
      const planned = shiftsOf(plan, w.workforceUserId);
      // Tüm plan tek seferde "yeni" verilir: plan içi çiftler de kontrol edilir.
      expect(checkWorkRules(mine, planned, opts)).toEqual([]);
      // Aynı saatte iki vardiya yok (plan içi ve mevcutla).
      const all = [...mine, ...planned];
      all.forEach((a, i) => all.slice(i + 1).forEach((b) => expect(overlapMinutes(a, b)).toBe(0)));
    }
    // Atama + eksik = istenen toplam
    const demand = request.days * request.slots.reduce((sum, s) => sum + s.required, 0);
    expect(plan.assignments.length + plan.unfilled.reduce((sum, u) => sum + u.missing, 0)).toBe(demand);
  });
});
