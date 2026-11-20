import { RotationPlanController, CreateRotationPlanPayload } from './rotation-plan.controller';
import { RotationPlanService } from './rotation-plan.service';
import { CorrelationContextService } from '../common/correlation/correlation-context.service';

describe('RotationPlanController — girdi doğrulaması', () => {
  const slots = [
    { name: 'Gece', startTime: '00:00', endTime: '08:00', required: 1 },
    { name: 'Sabah', startTime: '08:00', endTime: '16:00', required: 1 },
    { name: 'Akşam', startTime: '16:00', endTime: '24:00', required: 1 },
  ];
  // Geçerli bir RPC gövdesi üretir (2099-11-02, 7 gün, 3 kalıp); her test yalnızca bozmak istediği alanı ezer.
  const payload = (overrides: Partial<CreateRotationPlanPayload> = {}): CreateRotationPlanPayload =>
    ({ teamId: 1, startDate: '2099-11-02', days: 7, slots, apply: false, ...overrides });

  const service = { createRotationPlan: jest.fn() };
  const correlationContext = { getActor: jest.fn() };
  const controller = new RotationPlanController(
    service as unknown as RotationPlanService,
    correlationContext as unknown as CorrelationContextService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    correlationContext.getActor.mockReturnValue({ id: 9, username: 'planner', role: 'PLANNER' });
    service.createRotationPlan.mockResolvedValue({ applied: false });
  });

  it('geçerli girdiyi doğrulanmış komut olarak service e iletir', async () => {
    await controller.createRotationPlan(payload({ apply: true }));
    expect(service.createRotationPlan).toHaveBeenCalledWith(
      { teamId: 1, request: { startDate: '2099-11-02', days: 7, slots }, apply: true },
      9,
    );
  });

  it('apply gönderilmezse önizleme kabul edilir', async () => {
    const { apply: _omit, ...withoutApply } = payload();
    await controller.createRotationPlan(withoutApply);
    expect(service.createRotationPlan).toHaveBeenCalledWith(expect.objectContaining({ apply: false }), 9);
  });

  it('hesap doğrulanamazsa 401', () => {
    correlationContext.getActor.mockReturnValue(undefined);
    expect(() => controller.createRotationPlan(payload())).toThrow(
      expect.objectContaining({ error: { statusCode: 401, message: 'İşlemi gerçekleştiren hesap doğrulanamadı' } }),
    );
    expect(service.createRotationPlan).not.toHaveBeenCalled();
  });

  it.each([
    [{ teamId: 0 }, 'Geçersiz ekip ID değeri'],
    [{ teamId: 1.5 }, 'Geçersiz ekip ID değeri'],
    [{ days: 0 }, 'days 1 ile 14'],
    [{ days: 15 }, 'days 1 ile 14'],
    [{ startDate: '2099-02-30' }, 'startDate'],
    [{ slots: [] }, 'En az bir'],
    [{ slots: [slots[0], slots[0]] }, 'tekrar ediyor'],
    [{ slots: [{ ...slots[0], endTime: '24:30' }] }, 'Geçersiz vardiya saati'],
    [{ slots: [{ ...slots[0], required: 0 }] }, 'required'],
    [{ slots: [{ name: 'Uzun', startTime: '06:00', endTime: '19:00', required: 1 }] }, 'Vardiya süresi 1 ile 12 saat'],
  ])('400: %o', (overrides, message) => {
    expect(() => controller.createRotationPlan(payload(overrides))).toThrow(
      expect.objectContaining({ error: { statusCode: 400, message: expect.stringContaining(message) } }),
    );
    expect(service.createRotationPlan).not.toHaveBeenCalled();
  });

  it('kayıtta geçmiş tarih 409; service e gidilmez', () => {
    expect(() => controller.createRotationPlan(payload({ apply: true, startDate: '2020-01-06' }))).toThrow(
      expect.objectContaining({ error: { statusCode: 409, message: 'Geçmişe vardiya oluşturulamaz' } }),
    );
    expect(service.createRotationPlan).not.toHaveBeenCalled();
  });

  it('önizlemede geçmiş tarih serbesttir', async () => {
    await controller.createRotationPlan(payload({ startDate: '2020-01-06' }));
    expect(service.createRotationPlan).toHaveBeenCalledTimes(1);
  });
});
