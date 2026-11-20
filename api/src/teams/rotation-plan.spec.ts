import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { TeamsController } from './teams.controller';
import { CreateRotationPlanDto } from './dto/create-rotation-plan.dto';
import { ROLES_KEY, Role } from '../auth/decorators/roles.decorator';

describe('Rotasyon planı API', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const slots = [
    { name: 'Sabah', startTime: '08:00', endTime: '16:00', required: 1 },
    { name: 'Akşam', startTime: '16:00', endTime: '24:00', required: 1 },
    { name: 'Gece', startTime: '00:00', endTime: '08:00', required: 1 },
  ];
  const body = { startDate: '2026-11-02', days: 7, slots, apply: false };
  // Gövdeyi uygulamadaki ValidationPipe ayarlarıyla CreateRotationPlanDto'ya dönüştürür; hatalıysa BadRequestException.
  const validate = (value: unknown) => pipe.transform(value, { type: 'body', metatype: CreateRotationPlanDto });

  it('gövdeyi ekip ID ile createRotationPlan RPC desenine gönderir', async () => {
    const dto = await validate(body);
    const send = jest.fn(() => of({}));
    new TeamsController({ send } as unknown as ClientProxy).createRotationPlan(7, dto);
    expect(send).toHaveBeenCalledWith('createRotationPlan', { teamId: 7, ...body });
  });

  it('iç içe slotlar sınıf örneğine dönüşür; whitelist bilinmeyen alanları atar', async () => {
    const dto = await validate({ ...body, extra: 'x', slots: [{ ...slots[0], color: 'red' }] });
    expect(dto).not.toHaveProperty('extra');
    expect(dto.slots[0]).toEqual(slots[0]);
  });

  it.each([
    ['apply gönderilmeyebilir', { startDate: '2026-11-02', days: 1, slots }],
    ['24:00 bitiş', { ...body, slots: [slots[1]] }],
    ['gece yarısını geçen kalıp (22:00–06:00)', { ...body, slots: [{ name: 'Uzun gece', startTime: '22:00', endTime: '06:00', required: 2 }] }],
    ['14 gün', { ...body, days: 14 }],
  ])('kabul eder: %s', async (_name, value) => {
    await expect(validate(value)).resolves.toBeInstanceOf(CreateRotationPlanDto);
  });

  it.each<[string, Record<string, unknown>]>([
    ['startDate eksik', { ...body, startDate: undefined }],
    ['startDate saatli', { ...body, startDate: '2026-11-02T00:00:00Z' }],
    ['startDate kısa biçim', { ...body, startDate: '2026-11-2' }],
    ['startDate olmayan gün', { ...body, startDate: '2026-02-30' }],
    ['days 0', { ...body, days: 0 }],
    ['days 15', { ...body, days: 15 }],
    ['days kesirli', { ...body, days: 1.5 }],
    ['days metin', { ...body, days: '7' }],
    ['slots boş', { ...body, slots: [] }],
    ['slots dizi değil', { ...body, slots: slots[0] }],
    ['slot adı boş', { ...body, slots: [{ ...slots[0], name: '' }] }],
    ['başlangıç 24:00', { ...body, slots: [{ ...slots[0], startTime: '24:00' }] }],
    ['bitiş 24:30', { ...body, slots: [{ ...slots[0], endTime: '24:30' }] }],
    ['saat 8:00', { ...body, slots: [{ ...slots[0], startTime: '8:00' }] }],
    ['dakika 60', { ...body, slots: [{ ...slots[0], endTime: '16:60' }] }],
    ['required 0', { ...body, slots: [{ ...slots[0], required: 0 }] }],
    ['required eksik', { ...body, slots: [{ name: 'X', startTime: '08:00', endTime: '16:00' }] }],
    ['apply metin', { ...body, apply: 'true' }],
  ])('400: %s', async (_name, value) => {
    await expect(validate(value)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('yalnızca ADMIN ve PLANNER çağırabilir', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TeamsController.prototype.createRotationPlan);
    expect(roles).toEqual([Role.ADMIN, Role.PLANNER]);
  });
});
