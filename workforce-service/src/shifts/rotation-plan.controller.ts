import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { CorrelationContextService } from '../common/correlation/correlation-context.service';
import { RotationPlanService } from './rotation-plan.service';
import { RotationPlanResponse } from './rotation-plan.response';
import { validateShiftPeriod } from './utils/validate-shift-period';
import { DEFAULT_ROTATION_OPTIONS, RotationRequest, RotationSlot, resolveSlotInterval, validateRotationRequest,} from './calc/rotation';

// api → workforce-service RPC gövdesi.
export type CreateRotationPlanPayload = {
  teamId: number;
  startDate: string;
  days: number;
  slots: RotationSlot[];
  apply?: boolean;
};

@Controller()
export class RotationPlanController {
  constructor(
    private readonly rotationPlanService: RotationPlanService,
    private readonly correlationContext: CorrelationContextService,
  ) {}

  /**
   * api'den gelen 'createRotationPlan' RPC mesajını karşılar; doğrulanmış komutu service'e iletir.
   * Sıra: işlemi yapan hesap (yoksa 401) → teamId (400) → validateRotationRequest ile tarih, gün sayısı,
   * saatler, tekrar eden kalıp adı ve required (400) → validateShiftPeriod ile kalıp süresi 1–12 saat (400) ve
   * yalnızca apply=true iken geçmiş tarih (409). Her kalıbın en erken örneği ilk gün olduğundan bu son iki
   * kontrol yalnızca ilk gün için yapılır. apply gönderilmezse güvenli varsayılan olan önizleme çalışır.
   * Ekip ve üye durumu burada değil service'te, kilit altında kontrol edilir.
   */
  @MessagePattern('createRotationPlan')
  createRotationPlan(@Payload() payload: CreateRotationPlanPayload): Promise<RotationPlanResponse> {
    // createTeamShifts ile aynı: işlemi yapan hesap bilinmeden plan oluşturulmaz.
    const actor = this.correlationContext.getActor();
    if (!actor) {
      throw new RpcException({ statusCode: 401, message: 'İşlemi gerçekleştiren hesap doğrulanamadı' });
    }

    // Girdi doğrulaması
    if (!Number.isInteger(payload.teamId) || payload.teamId <= 0) {
      throw new RpcException({ statusCode: 400, message: 'Geçersiz ekip ID değeri' });
    }
    const apply = payload.apply === true;
    const request: RotationRequest = { startDate: payload.startDate, days: payload.days, slots: payload.slots ?? [] };
    const error = validateRotationRequest(request);
    if (error) {
      throw new RpcException({ statusCode: 400, message: error });
    }
    // Her kalıbın en erken örneği ilk gündedir: süre (1–12 saat) ve geçmiş kontrolü orada yapılır.
    // Mevcut vardiya kuralı (validateShiftPeriod) aynen uygulanır; geçmiş yalnızca kayıtta yasaktır.
    for (const slot of request.slots) {
      const { startAt, endAt } = resolveSlotInterval(request.startDate, slot, DEFAULT_ROTATION_OPTIONS.workRules);
      validateShiftPeriod(startAt, endAt, { checkPast: apply });
    }

    return this.rotationPlanService.createRotationPlan({ teamId: payload.teamId, request, apply }, actor.id);
  }
}
