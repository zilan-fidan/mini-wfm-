import { RotationMember, RotationPlan, RotationRequest, buildRotationPlan } from './calc/rotation';
import { toRotationPlanResponse } from './rotation-plan.response';

const members: RotationMember[] = [1, 2, 3, 4].map((id) => ({
  id, registrationNumber: `S00${id}`, firstname: String.fromCharCode(64 + id), lastname: 'Test',
}));
const request: RotationRequest = {
  startDate: '2026-11-02',
  days: 7,
  slots: [
    { name: 'Gece', startTime: '00:00', endTime: '08:00', required: 1 },
    { name: 'Sabah', startTime: '08:00', endTime: '16:00', required: 1 },
    { name: 'Akşam', startTime: '16:00', endTime: '24:00', required: 1 },
  ],
};
const context = { teamId: 7, startDate: request.startDate, days: request.days, applied: false };

describe('Rotasyon planı yanıtı', () => {
  it('dakikaları saate çevirir; adalet farkı 8 saat', () => {
    const response = toRotationPlanResponse(context, buildRotationPlan(members, [], request));

    expect(response).toMatchObject({ teamId: 7, startDate: '2026-11-02', days: 7, applied: false, unfilled: [] });
    expect(response.workloads.map((w) => [w.registrationNumber, w.shiftCount, w.totalHours]))
      .toEqual([['S001', 6, 48], ['S002', 5, 40], ['S003', 5, 40], ['S004', 5, 40]]);
    expect(response.fairnessGapHours).toBe(8);
  });

  it('atamaları tarih, kalıp ve personel bilgisiyle ISO metin olarak döndürür; önizlemede shiftId yok', () => {
    const [first] = toRotationPlanResponse(context, buildRotationPlan(members, [], request)).assignments;
    expect(first).toEqual({
      date: '2026-11-02',
      slotName: 'Gece',
      startAt: '2026-11-01T21:00:00.000Z', // yerel 00:00 (+03:00)
      endAt: '2026-11-02T05:00:00.000Z',
      workforceUserId: 1,
      registrationNumber: 'S001',
      firstname: 'A',
      lastname: 'Test',
    });
  });

  it('24:00 bitişi ertesi günün yerel 00:00 anı olarak gösterilir', () => {
    const response = toRotationPlanResponse(context, buildRotationPlan(members, [], request));
    expect(response.assignments.find((a) => a.slotName === 'Akşam')).toMatchObject({
      date: '2026-11-02', startAt: '2026-11-02T13:00:00.000Z', endAt: '2026-11-02T21:00:00.000Z',
    });
  });

  it('eksik vardiyaları gösterir; hiç vardiya almayan üye 0 saatle adalet hesabına girer', () => {
    const plan = buildRotationPlan(members.slice(0, 3), [], request);
    const response = toRotationPlanResponse(context, plan);
    expect(response.unfilled).toHaveLength(3);
    expect(response.unfilled[0]).toEqual({
      date: '2026-11-08', slotName: 'Gece',
      startAt: '2026-11-07T21:00:00.000Z', endAt: '2026-11-08T05:00:00.000Z',
      required: 1, assigned: 0, missing: 1,
    });

    // Tek kalıp, tek gün, iki üye: biri 8 saat, diğeri 0 saat → fark 8 saat.
    const single = buildRotationPlan(members.slice(0, 2), [], { ...request, days: 1, slots: [request.slots[1]] });
    expect(toRotationPlanResponse(context, single).workloads.map((w) => w.totalHours)).toEqual([8, 0]);
    expect(toRotationPlanResponse(context, single).fairnessGapHours).toBe(8);
  });

  it('kesirli süre: 7 saat 30 dakika → 7.5', () => {
    const plan = buildRotationPlan(members.slice(0, 1), [], {
      ...request, days: 1, slots: [{ name: 'Kısa', startTime: '08:00', endTime: '15:30', required: 1 }],
    });
    expect(toRotationPlanResponse(context, plan).workloads[0].totalHours).toBe(7.5);
  });

  it('kayıttan sonra shiftId atamalarla aynı sırada eklenir; sayı tutmazsa hata', () => {
    const plan: RotationPlan = buildRotationPlan(members, [], { ...request, days: 1 });
    const response = toRotationPlanResponse({ ...context, applied: true }, plan, [101, 102, 103]);
    expect(response.applied).toBe(true);
    expect(response.assignments.map((a) => a.shiftId)).toEqual([101, 102, 103]);
    expect(() => toRotationPlanResponse(context, plan, [101])).toThrow('eşleşmiyor');
  });
});
