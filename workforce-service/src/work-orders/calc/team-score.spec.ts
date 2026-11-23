import { WorkOrderPriority } from '../enums/work-order-priority.enum';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import {
  MemberInput, NO_CAPACITY_REASON, OpenWorkOrderInput, ScoreCriterion, ShiftInput, TeamInput,
  TeamSuggestion, scoreTeams,
} from './team-score';

// Değerlendirme aralığı: 1 Aralık 00:00 → 3 Aralık 00:00 (48 saat).
const NOW = new Date('2026-12-01T00:00:00Z');
const DUE = new Date('2026-12-03T00:00:00Z');
const PAST = new Date('2026-11-30T00:00:00Z');
const normal = { priority: WorkOrderPriority.MEDIUM, dueAt: DUE };
const urgent = { priority: WorkOrderPriority.URGENT, dueAt: DUE };

const team = (id: number, name: string, isActive = true): TeamInput => ({ id, name, isActive });
const member = (id: number, teamId: number | null, isActive = true): MemberInput => ({ id, teamId, isActive });
// 1 Aralık'tan itibaren saat cinsinden: shift(1, 8, 16) → 08:00–16:00
const shift = (workforceUserId: number, fromHour: number, toHour: number): ShiftInput => ({
  workforceUserId,
  startAt: new Date(NOW.getTime() + fromHour * 3_600_000),
  endAt: new Date(NOW.getTime() + toHour * 3_600_000),
});
const order = (teamId: number | null, dueAt = DUE, status = WorkOrderStatus.ASSIGNED): OpenWorkOrderInput =>
  ({ teamId, status, dueAt });

const lineOf = (suggestion: TeamSuggestion, criterion: ScoreCriterion) =>
  suggestion.breakdown.find((line) => line.criterion === criterion)!;

describe('scoreTeams — elle hesaplanan örnek tablo', () => {
  // A: 2 kişi × 8 saat = 16 saat, 2 açık, 0 geciken
  // B: 3 kişi × 8 saat = 24 saat, 4 açık, 1 geciken
  // C: üyesi var ama vardiyası yok → kapasite 0
  const teams = [team(1, 'A'), team(2, 'B'), team(3, 'C')];
  const members = [member(11, 1), member(12, 1), member(21, 2), member(22, 2), member(23, 2), member(31, 3)];
  const shifts = [shift(11, 8, 16), shift(12, 16, 24), shift(21, 8, 16), shift(22, 16, 24), shift(23, 24, 32)];
  const orders = [
    order(1), order(1, DUE, WorkOrderStatus.IN_PROGRESS),
    order(2), order(2), order(2, DUE, WorkOrderStatus.IN_PROGRESS), order(2, PAST),
  ];

  const summarize = (priority: typeof normal) =>
    scoreTeams(priority, teams, members, shifts, orders, NOW).suggestions.map((s) => [s.teamName, s.totalScore]);

  it('normal öncelik: A 22, B 18 → sıra A, B', () => {
    expect(summarize(normal)).toEqual([['A', 22], ['B', 18]]);
  });

  it('URGENT: A 54, B 66 → sıra B, A', () => {
    expect(summarize(urgent)).toEqual([['B', 66], ['A', 54]]);
  });

  it('C önerilmez, nedeniyle excluded listesinde', () => {
    const { excluded } = scoreTeams(normal, teams, members, shifts, orders, NOW);
    expect(excluded).toEqual([{ teamId: 3, teamName: 'C', reason: NO_CAPACITY_REASON }]);
  });

  it('B dökümü: 24 saat × 2 = 48, 4 açık × −5 = −20, 1 geciken × −10 = −10', () => {
    const b = scoreTeams(normal, teams, members, shifts, orders, NOW).suggestions.find((s) => s.teamName === 'B')!;
    expect(b.breakdown).toEqual([
      { criterion: 'capacityHours', value: 24, weight: 2, points: 48 },
      { criterion: 'openWorkOrders', value: 4, weight: -5, points: -20 },
      { criterion: 'overdueWorkOrders', value: 1, weight: -10, points: -10 },
    ]);
  });
});

// Her ölçüt yalnızca KENDİ satırına bakar: bir ağırlık değişirse yalnızca o testin beklentisi bozulur.
describe('scoreTeams — ölçüt başına ağırlık', () => {
  const teams = [team(1, 'A')];
  const members = [member(11, 1)];

  it('kapasite: 10 saat → +20 puan', () => {
    const [a] = scoreTeams(normal, teams, members, [shift(11, 0, 10)], [], NOW).suggestions;
    expect(lineOf(a, 'capacityHours').points).toBe(20);
  });

  it('açık iş yükü: 3 iş emri → −15 puan', () => {
    const [a] = scoreTeams(normal, teams, members, [shift(11, 0, 1)], [order(1), order(1), order(1)], NOW).suggestions;
    expect(lineOf(a, 'openWorkOrders').points).toBe(-15);
  });

  it('geciken iş: 2 iş emri → −20 puan', () => {
    const [a] = scoreTeams(normal, teams, members, [shift(11, 0, 1)], [order(1, PAST), order(1, PAST)], NOW).suggestions;
    expect(lineOf(a, 'overdueWorkOrders').points).toBe(-20);
  });

  it('aciliyet: URGENT iş emrinde 10 saat → +40 puan', () => {
    const [a] = scoreTeams(urgent, teams, members, [shift(11, 0, 10)], [], NOW).suggestions;
    expect(lineOf(a, 'capacityHours').points).toBe(40);
  });
});

describe('scoreTeams — veri kuralları', () => {
  it('vardiyanın yalnızca [now, dueAt) içine düşen kısmı sayılır', () => {
    // −4..+4: 4 saat içeride; 44..52: 4 saat içeride; 60..70: tamamen dışarıda
    const shifts = [shift(11, -4, 4), shift(11, 44, 52), shift(11, 60, 70)];
    const [a] = scoreTeams(normal, [team(1, 'A')], [member(11, 1)], shifts, [], NOW).suggestions;
    expect(lineOf(a, 'capacityHours').value).toBe(8);
  });

  it('kesirli saat: 90 dakika → 1.5 saat, 3 puan', () => {
    const [a] = scoreTeams(normal, [team(1, 'A')], [member(11, 1)], [shift(11, 0, 1.5)], [], NOW).suggestions;
    expect(lineOf(a, 'capacityHours')).toEqual({ criterion: 'capacityHours', value: 1.5, weight: 2, points: 3 });
  });

  it('pasif ekip ne önerilir ne excluded listesinde yer alır', () => {
    const result = scoreTeams(normal, [team(1, 'A', false)], [member(11, 1)], [shift(11, 0, 8)], [], NOW);
    expect(result).toMatchObject({ suggestions: [], excluded: [] });
  });

  it('pasif üyenin ve ekipsiz personelin vardiyası kapasiteye eklenmez', () => {
    const members = [member(11, 1), member(12, 1, false), member(13, null)];
    const shifts = [shift(11, 0, 2), shift(12, 0, 8), shift(13, 0, 8)];
    const [a] = scoreTeams(normal, [team(1, 'A')], members, shifts, [], NOW).suggestions;
    expect(lineOf(a, 'capacityHours').value).toBe(2);
  });

  it('yalnızca ASSIGNED ve IN_PROGRESS iş yükü sayılır', () => {
    const orders = (Object.values(WorkOrderStatus) as WorkOrderStatus[]).map((status) => order(1, PAST, status));
    const [a] = scoreTeams(normal, [team(1, 'A')], [member(11, 1)], [shift(11, 0, 1)], orders, NOW).suggestions;
    expect([lineOf(a, 'openWorkOrders').value, lineOf(a, 'overdueWorkOrders').value]).toEqual([2, 2]);
  });

  it('dueAt geçmişteyse aralık boştur; bütün ekipler kapasitesiz', () => {
    const result = scoreTeams({ ...normal, dueAt: PAST }, [team(1, 'A')], [member(11, 1)], [shift(11, -30, 30)], [], NOW);
    expect(result.suggestions).toEqual([]);
    expect(result.excluded.map((e) => e.teamName)).toEqual(['A']);
  });
});

describe('scoreTeams — sıralama ve sınır', () => {
  // Her ekip id'si ile aynı id'li tek üyeye sahip; puanı vardiya ve iş yüküyle ayarlanır.
  const build = (specs: { id: number; name: string; hours: number; open: number }[]) => ({
    teams: specs.map((s) => team(s.id, s.name)),
    members: specs.map((s) => member(s.id, s.id)),
    shifts: specs.map((s) => shift(s.id, 0, s.hours)),
    orders: specs.flatMap((s) => Array.from({ length: s.open }, () => order(s.id))),
  });
  const run = (specs: Parameters<typeof build>[0]) => {
    const { teams, members, shifts, orders } = build(specs);
    return scoreTeams(normal, teams, members, shifts, orders, NOW).suggestions.map((s) => s.teamName);
  };

  it('eşit puanda açık iş yükü az olan önce gelir', () => {
    // X: 10 saat, 0 açık = 20; Y: 12.5 saat, 1 açık = 25 − 5 = 20
    expect(run([{ id: 1, name: 'Y', hours: 12.5, open: 1 }, { id: 2, name: 'X', hours: 10, open: 0 }])).toEqual(['X', 'Y']);
  });

  it('puan ve iş yükü eşitse ada göre (Türkçe sıra: Ç, C\'den sonra)', () => {
    expect(run([
      { id: 1, name: 'Çorum', hours: 5, open: 0 },
      { id: 2, name: 'Dicle', hours: 5, open: 0 },
      { id: 3, name: 'Ceyhan', hours: 5, open: 0 },
    ])).toEqual(['Ceyhan', 'Çorum', 'Dicle']);
  });

  it('en fazla 3 ekip döner', () => {
    const specs = [1, 2, 3, 4, 5].map((id) => ({ id, name: `T${id}`, hours: id, open: 0 }));
    expect(run(specs)).toEqual(['T5', 'T4', 'T3']);
  });
});

describe('scoreTeams — döküm tutarlılığı', () => {
  it('her öneride döküm puanlarının toplamı = toplam puan; puan = değer × ağırlık', () => {
    // Kesirli saatler ve karışık iş yükü: kayan nokta toplamı da tutarlı kalmalı
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const teams = Array.from({ length: 20 }, (_, i) => team(i + 1, `T${i + 1}`));
    const members = Array.from({ length: 100 }, (_, i) => member(i + 1, (i % 20) + 1));
    const shifts = Array.from({ length: 300 }, () => {
      const from = rand() * 50 - 5;
      return shift(Math.ceil(rand() * 100), from, from + 1 + rand() * 11);
    });
    const orders = Array.from({ length: 60 }, () => order(Math.ceil(rand() * 20), rand() < 0.3 ? PAST : DUE));

    for (const priority of [normal, urgent]) {
      const { suggestions } = scoreTeams(priority, teams, members, shifts, orders, new Date(NOW.getTime() + 37_123));
      expect(suggestions).toHaveLength(3);
      for (const s of suggestions) {
        const sum = s.breakdown.reduce((acc, line) => acc + line.points, 0);
        expect(s.totalScore).toBeCloseTo(sum, 10);
        for (const line of s.breakdown) expect(line.points).toBeCloseTo(line.value * line.weight, 2);
      }
    }
  });
});
