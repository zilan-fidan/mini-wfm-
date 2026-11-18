import { EntityManager, Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { ShiftsService } from './shifts.service';

describe('Vardiya yazmalarında ortak kilitleme', () => {
  const startAt = new Date('2099-01-01T08:00:00Z');
  const endAt = new Date('2099-01-01T16:00:00Z');
  let people: Record<string, jest.Mock>;
  let overlap: Record<string, jest.Mock>;
  let repository: { findOne: jest.Mock; createQueryBuilder: jest.Mock; create: jest.Mock; merge: jest.Mock; save: jest.Mock };
  let transaction: jest.Mock;
  let service: ShiftsService;
  const current = () => ({ id: 10, workforceUserId: 3, startAt, endAt, note: 'Güncel not', createdById: 1 });
  const builder = (names: string[]) => Object.fromEntries(names.map((name) => [name, jest.fn().mockReturnThis()]));

  beforeEach(() => {
    people = builder(['where', 'orderBy', 'setLock', 'getMany']);
    people.getMany.mockResolvedValue([{ id: 3, isActive: true }, { id: 1, isActive: true }]);
    overlap = builder(['where', 'andWhere', 'getOne']);
    overlap.getOne.mockResolvedValue(null);
    repository = {
      findOne: jest.fn().mockResolvedValue(current()),
      createQueryBuilder: jest.fn(() => overlap),
      create: jest.fn((data) => data),
      merge: jest.fn((...values) => Object.assign({}, ...values)),
      save: jest.fn(async (data) => data),
    };
    const manager = { getRepository: (entity: unknown) => {
      if (entity === WorkforceUser) return { createQueryBuilder: () => people };
      if (entity === Shift) return repository;
      throw new Error('Beklenmeyen repository');
    } };
    transaction = jest.fn((_isolation: string, callback: (manager: EntityManager) => unknown) => callback(manager as unknown as EntityManager));
    service = new ShiftsService({ manager: { transaction } } as unknown as Repository<Shift>);
  });

  it('oluşturmada önce personeli kilitler, sonra çakışmayı sorgulayıp kaydeder', async () => {
    await service.createShift({ workforceUserId: 3, startAt, endAt, createdById: 1 });
    expect(transaction).toHaveBeenCalledWith('READ COMMITTED', expect.any(Function));
    expect(people.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(people.getMany.mock.invocationCallOrder[0]).toBeLessThan(overlap.getOne.mock.invocationCallOrder[0]);
    expect(overlap.getOne.mock.invocationCallOrder[0]).toBeLessThan(repository.save.mock.invocationCallOrder[0]);
  });

  it.each(['create', 'update'])('%s çakışmada kaydetmez', async (mode) => {
    overlap.getOne.mockResolvedValue({ startAt, endAt });
    const action = mode === 'create'
      ? service.createShift({ workforceUserId: 3, startAt, endAt })
      : service.updateShift(current() as Shift, { note: 'Yeni' });
    await expect(action).rejects.toMatchObject({ error: { statusCode: 409 } });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('güncellemede eski kopya yerine kilitli güncel veriyi kullanır', async () => {
    const stale = { ...current(), workforceUserId: 99, note: 'Eski not' } as Shift;
    const result = await service.updateShift(stale, { workforceUserId: 1 });
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 10 }, lock: { mode: 'pessimistic_write' } });
    expect(people.where).toHaveBeenCalledWith('person.id IN (:...ids)', { ids: [1, 3] });
    expect(people.orderBy).toHaveBeenCalledWith('person.id', 'ASC');
    expect(people.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(result.note).toBe('Güncel not');
    expect(result.workforceUserId).toBe(1);
    expect(overlap.andWhere).toHaveBeenCalledWith('shift.id != :excludeShiftId', { excludeShiftId: 10 });
  });

  it.each([{ rows: [] }, { rows: [{ id: 3, isActive: false }] }])('kilitli personel eksik/pasifse kaydetmez: %j', async ({ rows }) => {
    people.getMany.mockResolvedValue(rows);
    await expect(service.createShift({ workforceUserId: 3, startAt, endAt })).rejects.toMatchObject({ error: { statusCode: rows.length ? 409 : 404 } });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('beklerken silinmiş vardiyayı yeniden oluşturmaz', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.updateShift(current() as Shift, { note: 'Yeni' })).rejects.toMatchObject({ error: { statusCode: 404 } });
    expect(repository.save).not.toHaveBeenCalled();
  });
});
