import { EntityManager, Repository } from 'typeorm';
import { ShiftsService } from './shifts.service';
import { Shift } from './entities/shift.entity';
import { Team } from '../teams/entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';

describe('Ekibe vardiya oluşturma', () => {
  const payload = { teamId: 1, startAt: '2099-01-01T08:00:00Z', endAt: '2099-01-01T16:00:00Z', note: 'Toplu' };
  let service: ShiftsService;
  let membersQuery: Record<string, jest.Mock>;
  let overlapsQuery: Record<string, jest.Mock>;
  let teamRepo: { findOne: jest.Mock };
  let shiftsRepo: { createQueryBuilder: jest.Mock; create: jest.Mock; save: jest.Mock };
  const members = [1, 2, 3].map((id) => ({ id, registrationNumber: `S${id}`, firstname: `Ad${id}`, lastname: 'Soyad' }));
  const builder = (methods: string[]) => Object.fromEntries(methods.map((name) => [name, jest.fn().mockReturnThis()]));

  beforeEach(() => {
    membersQuery = builder(['where', 'andWhere', 'orderBy', 'setLock', 'getMany']);
    membersQuery.getMany.mockResolvedValue(members);
    overlapsQuery = builder(['select', 'distinct', 'where', 'andWhere', 'getRawMany', 'getMany']);
    overlapsQuery.getRawMany.mockResolvedValue([]);
    // Çalışma kuralı kontrolü için okunan çevredeki vardiyalar
    overlapsQuery.getMany.mockResolvedValue([]);
    teamRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, isActive: true }) };
    shiftsRepo = { createQueryBuilder: jest.fn(() => overlapsQuery), create: jest.fn((data) => data), save: jest.fn(async (rows) => rows) };
    const manager = { getRepository: jest.fn((entity) => {
      if (entity === Team) return teamRepo;
      if (entity === WorkforceUser) return { createQueryBuilder: () => membersQuery };
      if (entity === Shift) return shiftsRepo;
      throw new Error('Beklenmeyen entity');
    }) };
    service = new ShiftsService({ manager: { transaction: (_isolation: string, callback: (manager: EntityManager) => unknown) => callback(manager as unknown as EntityManager) } } as unknown as Repository<Shift>);
  });

  it('tüm çakışan üyeleri döndürür, save çağırmaz', async () => {
    overlapsQuery.getRawMany.mockResolvedValue([{ workforceUserId: 1 }, { workforceUserId: 3 }]);
    await expect(service.createTeamShifts(payload, 9)).rejects.toMatchObject({ error: {
      statusCode: 409, details: [members[0], members[2]].map(({ id, ...member }) => ({ workforceUserId: id, ...member })),
    } });
    expect(shiftsRepo.save).not.toHaveBeenCalled();
  });

  it('transaction repository ile tüm aktif üyeleri kaydeder', async () => {
    const rows = await service.createTeamShifts(payload, 9);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.workforceUserId)).toEqual([1, 2, 3]);
    expect(rows.every((row) => row.createdById === 9 && row.note === 'Toplu')).toBe(true);
    expect(membersQuery.andWhere).toHaveBeenCalledWith('person.isActive = :isActive', { isActive: true });
    expect(teamRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 }, lock: { mode: 'pessimistic_write' } });
  });

  it.each([null, { id: 1, isActive: false }])('eksik veya pasif ekipte yazmaz', async (team) => {
    teamRepo.findOne.mockResolvedValue(team);
    await expect(service.createTeamShifts(payload, 9)).rejects.toMatchObject({ error: { statusCode: team ? 409 : 404 } });
    expect(shiftsRepo.save).not.toHaveBeenCalled();
  });

  it('aktif üye yoksa yazmaz', async () => {
    membersQuery.getMany.mockResolvedValue([]);
    await expect(service.createTeamShifts(payload, 9)).rejects.toMatchObject({ error: { statusCode: 409 } });
    expect(shiftsRepo.save).not.toHaveBeenCalled();
  });
});
