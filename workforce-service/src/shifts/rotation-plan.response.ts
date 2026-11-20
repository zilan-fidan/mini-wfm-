import { RotationPlan } from './calc/rotation';
import { toHours } from './timesheet.response';

// Yanıtın bağlamı: hangi ekip, hangi aralık, veritabanına yazıldı mı?
export type RotationPlanContext = {
  teamId: number;
  startDate: string;
  days: number;
  applied: boolean;
};

/**
 * Saf planlayıcının sonucunu (RotationPlan) API'nin döneceği JSON yanıtına çevirir.
 *
 * - Hesaplama dakikayla yapılır; saate çevirme yalnızca burada, en son adımda toHours ile yapılır
 *   (timesheet.response ile aynı kural). fairnessGapHours, yuvarlanmış saatlerin farkı değil
 *   ham dakika farkının saate çevrilmişidir; yuvarlama hatası birikmez.
 * - Date alanları TCP/JSON taşıması için açıkça ISO metnine çevrilir (toViolationDetail ile aynı).
 * - shiftIds verilirse (apply=true kaydından sonra) her atamaya aynı sıradaki shiftId eklenir.
 *
 * @param context  Ekip, başlangıç günü, gün sayısı ve kaydın yapılıp yapılmadığı.
 * @param plan     buildRotationPlan sonucu.
 * @param shiftIds Kaydedilen vardiyaların id'leri; assignments ile AYNI sırada olmalıdır.
 * @throws shiftIds sayısı atama sayısıyla eşleşmezse (sessizce yanlış eşleştirmek yerine).
 */
export function toRotationPlanResponse(
  context: RotationPlanContext,
  plan: RotationPlan,
  shiftIds?: readonly number[],
) {
  if (shiftIds && shiftIds.length !== plan.assignments.length) {
    throw new Error(`Kayıt sayısı (${shiftIds.length}) atama sayısıyla (${plan.assignments.length}) eşleşmiyor`);
  }

  return {
    ...context,
    assignments: plan.assignments.map((assignment, i) => ({
      ...(shiftIds && { shiftId: shiftIds[i] }),
      date: assignment.date,
      slotName: assignment.slotName,
      startAt: assignment.startAt.toISOString(),
      endAt: assignment.endAt.toISOString(),
      workforceUserId: assignment.workforceUserId,
      registrationNumber: assignment.registrationNumber,
      firstname: assignment.firstname,
      lastname: assignment.lastname,
    })),
    // Her satır kendi yuvarlanmamış dakikasından saate çevrilir.
    workloads: plan.workloads.map((workload) => ({
      workforceUserId: workload.workforceUserId,
      registrationNumber: workload.registrationNumber,
      firstname: workload.firstname,
      lastname: workload.lastname,
      shiftCount: workload.shiftCount,
      totalHours: toHours(workload.minutes),
    })),
    unfilled: plan.unfilled.map((slot) => ({
      date: slot.date,
      slotName: slot.slotName,
      startAt: slot.startAt.toISOString(),
      endAt: slot.endAt.toISOString(),
      required: slot.required,
      assigned: slot.assigned,
      missing: slot.missing,
    })),
    // Fark, yuvarlanmış saatlerin farkı değil; ham dakika farkının saate çevrilmişidir.
    fairnessGapHours: toHours(plan.fairnessGapMinutes),
  };
}

export type RotationPlanResponse = ReturnType<typeof toRotationPlanResponse>;
