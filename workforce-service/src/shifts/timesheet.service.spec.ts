import { Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { TimesheetService } from './timesheet.service';
import { TimesheetController } from './timesheet.controller';
import { toHours } from './timesheet.response';

describe('TimesheetService (veritabanı erişimi)', () => {
  it('aralıkla KESİŞEN vardiyaları sorgular (yalnızca başlayanları değil)', async () => {
    const query = Object.fromEntries(['select', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'getMany'].map((name) => [name, jest.fn().mockReturnThis()]));
    query.getMany.mockResolvedValue([]);
    const service = new TimesheetService(
      { createQueryBuilder: jest.fn(() => query) } as unknown as Repository<Shift>,
      {} as Repository<WorkforceUser>,
    );
    const from = new Date('2026-10-25T21:00:00Z');
    const to = new Date('2026-12-06T21:00:00Z');
    await service.findShiftsInRange(7, from, to);
    expect(query.where).toHaveBeenCalledWith('shift.workforceUserId = :workforceUserId', { workforceUserId: 7 });
    expect(query.andWhere).toHaveBeenCalledWith('shift.startAt < :to', { to });
    expect(query.andWhere).toHaveBeenCalledWith('shift.endAt > :from', { from });
  });

  it('personel varlığını id ile kontrol eder', async () => {
    const exists = jest.fn().mockResolvedValue(true);
    const service = new TimesheetService({} as Repository<Shift>, { exists } as unknown as Repository<WorkforceUser>);
    await expect(service.workforceUserExists(3)).resolves.toBe(true);
    expect(exists).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});

describe('TimesheetController', () => {
  let service: { workforceUserExists: jest.Mock; findShiftsInRange: jest.Mock };
  let controller: TimesheetController;

  beforeEach(() => {
    service = { workforceUserExists: jest.fn().mockResolvedValue(true), findShiftsInRange: jest.fn().mockResolvedValue([]) };
    controller = new TimesheetController(service as unknown as TimesheetService);
  });

  it.each([
    [{ workforceUserId: 0, month: '2026-11' }],
    [{ workforceUserId: 1.5, month: '2026-11' }],
    [{ workforceUserId: 1, month: '2026-11-01' }],
    [{ workforceUserId: 1, month: '26-11' }],
    [{ workforceUserId: 1, month: '2026-00' }],
    [{ workforceUserId: 1, month: '2025-12' }],
    [{ workforceUserId: 1, month: undefined as unknown as string }],
  ])('geçersiz istek 400: %j', async (payload) => {
    await expect(controller.getTimesheet(payload)).rejects.toMatchObject({ error: { statusCode: 400 } });
    expect(service.workforceUserExists).not.toHaveBeenCalled();
  });

  it('personel yoksa 404, vardiya sorgulanmaz', async () => {
    service.workforceUserExists.mockResolvedValue(false);
    await expect(controller.getTimesheet({ workforceUserId: 7, month: '2026-11' })).rejects.toMatchObject({ error: { statusCode: 404 } });
    expect(service.findShiftsInRange).not.toHaveBeenCalled();
  });

  it('ayı kapsayan tam haftaların aralığını servise verir', async () => {
    const result = await controller.getTimesheet({ workforceUserId: 7, month: '2026-11' });
    expect(service.findShiftsInRange).toHaveBeenCalledWith(7, new Date('2026-10-25T21:00:00Z'), new Date('2026-12-06T21:00:00Z'));
    expect(result).toMatchObject({ workforceUserId: 7, month: '2026-11' });
    expect(result.days).toHaveLength(30);
    expect(result.weeks).toHaveLength(6);
  });

  it('saat bir ondalığa yalnızca yanıtta yuvarlanır', async () => {
    // 3 × 20 dakika: her gün 0.3 saat, ay toplamı yuvarlanmış günlerden değil 60 dakikadan → 1 saat
    service.findShiftsInRange.mockResolvedValue(['10', '11', '12'].map((d) => ({
      startAt: new Date(`2026-11-${d}T08:00:00+03:00`), endAt: new Date(`2026-11-${d}T08:20:00+03:00`),
    })));
    const result = await controller.getTimesheet({ workforceUserId: 7, month: '2026-11' });
    expect(result.days.filter((row) => row.totalHours > 0).map((row) => row.totalHours)).toEqual([0.3, 0.3, 0.3]);
    expect(result.totals.totalHours).toBe(1);
    expect([toHours(0), toHours(3), toHours(2.99), toHours(90), toHours(1.25)]).toEqual([0, 0.1, 0, 1.5, 0]);
  });
});
