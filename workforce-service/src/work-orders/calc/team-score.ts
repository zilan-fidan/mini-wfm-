import { overlapMinutes, type Interval } from '../../common/calc/interval';
import { WorkOrderPriority } from '../enums/work-order-priority.enum';
import { WorkOrderStatus } from '../enums/work-order-status.enum';

// Bütün ağırlıklar tek yerde. Birini değiştirmek yalnızca o ölçütün puanını değiştirir.
export const TEAM_SCORE_WEIGHTS = {
  capacityPerHour: 2,          // aralığa düşen her vardiya saati
  openWorkOrder: -5,           // ekibe atanmış ASSIGNED / IN_PROGRESS her iş emri
  overdueWorkOrder: -10,       // bunlardan süresi geçmiş her biri (açık cezasına EK olarak)
  urgentCapacityMultiplier: 2, // iş emri URGENT ise kapasite ağırlığı bununla çarpılır
} as const;

export type TeamScoreWeights = { [K in keyof typeof TEAM_SCORE_WEIGHTS]: number };

export const TEAM_SUGGESTION_LIMIT = 3;

// Ekibin iş yükü sayılan durumlar. OPEN iş emri henüz kimseye atanmamıştır.
export const TEAM_WORKLOAD_STATUSES: readonly WorkOrderStatus[] = [WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS];

// Girdi tipleri yapısaldır: entity'lerin yalnızca ihtiyaç duyulan alanları.
// Service entity verir, testler düz nesne verir.
export type ScoredWorkOrder = { priority: WorkOrderPriority; dueAt: Date };
export type TeamInput = { id: number; name: string; isActive: boolean };
export type MemberInput = { id: number; teamId: number | null; isActive: boolean };
export type ShiftInput = { workforceUserId: number; startAt: Date; endAt: Date };
export type OpenWorkOrderInput = { teamId: number | null; status: WorkOrderStatus; dueAt: Date };

export type ScoreCriterion = 'capacityHours' | 'openWorkOrders' | 'overdueWorkOrders';

// Dökümün bir satırı: ölçüt, ham değer, uygulanan ağırlık ve puan (= value × weight).
export type ScoreLine = { criterion: ScoreCriterion; value: number; weight: number; points: number };

export type TeamSuggestion = {
  teamId: number;
  teamName: string;
  totalScore: number;    // = breakdown puanlarının toplamı
  breakdown: ScoreLine[];
};

export type ExcludedTeam = { teamId: number; teamName: string; reason: string };

export type TeamScoreResult = {
  window: Interval;
  suggestions: TeamSuggestion[];
  excluded: ExcludedTeam[];
};

export const NO_CAPACITY_REASON = 'Kapasite yok: değerlendirme aralığında aktif üyelerin vardiyası bulunmuyor';

// Kayan nokta artıklarını (0.1 + 0.2) temizler; saat ve puanlar 2 basamakla döner.
const round2 = (value: number) => Math.round(value * 100) / 100;

type TeamTally = { team: TeamInput; capacityMinutes: number; open: number; overdue: number };

/**
 * İş emri için aktif ekipleri puanlar; kapasitesi olmayanları nedeniyle `excluded` listesine ayırır.
 *
 * Değerlendirme aralığı [now, workOrder.dueAt). Karmaşıklık O(T + M + S + W + T log T):
 * önce Map'ler kurulur (personel → ekip), sonra her vardiya ve her iş emri TEK KEZ dolaşılır.
 * Ekip × vardiya gibi iç içe döngü yoktur.
 *
 * İş emrinin OPEN olduğu kontrolü çağıranın (service) sorumluluğudur.
 */
export function scoreTeams(
  workOrder: ScoredWorkOrder,
  teams: readonly TeamInput[],
  members: readonly MemberInput[],
  shifts: readonly ShiftInput[],
  openWorkOrders: readonly OpenWorkOrderInput[],
  now: Date,
  weights: TeamScoreWeights = TEAM_SCORE_WEIGHTS,
): TeamScoreResult {
  const window: Interval = { startAt: now, endAt: workOrder.dueAt };
  const nowMs = now.getTime();

  // 1) ekip id → sayaç. Yalnızca aktif ekipler; diğer Map'ler buna bakarak süzülür.
  const tallies = new Map<number, TeamTally>();
  for (const team of teams) {
    if (team.isActive) tallies.set(team.id, { team, capacityMinutes: 0, open: 0, overdue: 0 });
  }

  // 2) personel id → sayaç (personel → ekip). Aktif ekibin aktif üyeleri.
  const tallyByMember = new Map<number, TeamTally>();
  for (const member of members) {
    if (!member.isActive || member.teamId === null) continue;
    const tally = tallies.get(member.teamId);
    if (tally) tallyByMember.set(member.id, tally);
  }

  // 3) Her vardiya bir kez: O(1) arama ile ekibini bul, aralığa düşen dakikayı ekle.
  for (const shift of shifts) {
    const tally = tallyByMember.get(shift.workforceUserId);
    if (tally) tally.capacityMinutes += overlapMinutes(shift, window);
  }

  // 4) Her iş emri bir kez: ekibinin açık ve geciken sayısını artır (ekip → açık iş emirleri).
  for (const order of openWorkOrders) {
    if (order.teamId === null || !TEAM_WORKLOAD_STATUSES.includes(order.status)) continue;
    const tally = tallies.get(order.teamId);
    if (!tally) continue;
    tally.open += 1;
    if (order.dueAt.getTime() < nowMs) tally.overdue += 1;
  }

  const capacityWeight = workOrder.priority === WorkOrderPriority.URGENT
    ? weights.capacityPerHour * weights.urgentCapacityMultiplier
    : weights.capacityPerHour;

  const scored: (TeamSuggestion & { open: number })[] = [];
  const excluded: ExcludedTeam[] = [];
  for (const { team, capacityMinutes, open, overdue } of tallies.values()) {
    const capacityHours = round2(capacityMinutes / 60);
    if (capacityHours <= 0) {
      excluded.push({ teamId: team.id, teamName: team.name, reason: NO_CAPACITY_REASON });
      continue;
    }
    const line = (criterion: ScoreCriterion, value: number, weight: number): ScoreLine =>
      ({ criterion, value, weight, points: round2(value * weight) });
    const breakdown = [
      line('capacityHours', capacityHours, capacityWeight),
      line('openWorkOrders', open, weights.openWorkOrder),
      line('overdueWorkOrders', overdue, weights.overdueWorkOrder),
    ];
    // Toplam dökümden türetilir; böylece "döküm toplamı = toplam puan" her zaman doğrudur.
    const totalScore = round2(breakdown.reduce((sum, item) => sum + item.points, 0));
    scored.push({ teamId: team.id, teamName: team.name, totalScore, breakdown, open });
  }

  // Puan azalan → eşitlikte açık iş yükü az olan → ada göre (Türkçe harf sırası).
  scored.sort((a, b) =>
    b.totalScore - a.totalScore || a.open - b.open || a.teamName.localeCompare(b.teamName, 'tr'));
  excluded.sort((a, b) => a.teamName.localeCompare(b.teamName, 'tr'));

  return {
    window,
    suggestions: scored.slice(0, TEAM_SUGGESTION_LIMIT).map(({ open: _open, ...suggestion }) => suggestion),
    excluded,
  };
}

