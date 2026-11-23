import { performance } from 'node:perf_hooks';
import { WorkOrderPriority } from '../enums/work-order-priority.enum';
import { WorkOrderStatus } from '../enums/work-order-status.enum';
import { MemberInput, OpenWorkOrderInput, ShiftInput, TeamInput, scoreTeams } from './team-score';

// Performans: 50 ekip, 1.000 personel, 10.000 vardiya (+ 2.000 açık iş emri), sabit seed.
// Veri üretimi ölçüm DIŞINDADIR. Isınma sonrası medyan süre 50 ms'nin altında olmalı.
const SEED = 20261123;
const TEAMS = 50;
const PEOPLE = 1000;
const SHIFTS = 10_000;
const OPEN_ORDERS = 2_000;
const BUDGET_MS = 50;
const HOUR = 3_600_000;

// Park–Miller: her koşuda aynı veri
function random(seed: number) {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

function generate() {
  const rand = random(SEED);
  const now = new Date('2026-12-01T00:00:00Z');
  const dueAt = new Date(now.getTime() + 14 * 24 * HOUR); // 2 haftalık aralık
  const teams: TeamInput[] = Array.from({ length: TEAMS }, (_, i) => ({ id: i + 1, name: `Ekip ${i + 1}`, isActive: i % 10 !== 9 }));
  const members: MemberInput[] = Array.from({ length: PEOPLE }, (_, i) => ({
    id: i + 1,
    teamId: rand() < 0.05 ? null : Math.ceil(rand() * TEAMS),
    isActive: rand() > 0.1,
  }));
  // Vardiyalar aralığın 3 gün öncesinden 3 gün sonrasına yayılır: bir kısmı kırpılır, bir kısmı tamamen dışarıda
  const shifts: ShiftInput[] = Array.from({ length: SHIFTS }, () => {
    const start = now.getTime() + (rand() * 20 - 3) * 24 * HOUR;
    return { workforceUserId: Math.ceil(rand() * PEOPLE), startAt: new Date(start), endAt: new Date(start + (4 + rand() * 8) * HOUR) };
  });
  const statuses = Object.values(WorkOrderStatus);
  const openWorkOrders: OpenWorkOrderInput[] = Array.from({ length: OPEN_ORDERS }, () => ({
    teamId: Math.ceil(rand() * TEAMS),
    status: statuses[Math.floor(rand() * statuses.length)],
    dueAt: new Date(now.getTime() + (rand() * 20 - 10) * 24 * HOUR),
  }));
  return { workOrder: { priority: WorkOrderPriority.URGENT, dueAt }, teams, members, shifts, openWorkOrders, now };
}

describe('scoreTeams — performans', () => {
  it(`${TEAMS} ekip, ${PEOPLE} personel, ${SHIFTS} vardiya: medyan < ${BUDGET_MS} ms`, () => {
    const { workOrder, teams, members, shifts, openWorkOrders, now } = generate();
    const run = () => scoreTeams(workOrder, teams, members, shifts, openWorkOrders, now);

    // Sonucun anlamlı olduğunu da kontrol et: ölçülen şey boş bir iş değil
    const result = run();
    expect(result.suggestions).toHaveLength(3);

    for (let i = 0; i < 3; i++) run(); // JIT ısınması
    const times = Array.from({ length: 15 }, () => {
      const started = performance.now();
      run();
      return performance.now() - started;
    }).sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];

    console.log(`scoreTeams: medyan ${median.toFixed(2)} ms, en kötü ${times.at(-1)!.toFixed(2)} ms`);
    expect(median).toBeLessThan(BUDGET_MS);
  });
});
