import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { Team } from '../teams/entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { RotationPlanCommand, RotationPlanService } from './rotation-plan.service';
import { RotationRequest } from './calc/rotation';
import { RULE_WINDOW_MS } from './shifts.service';

// Yapı team-shifts.spec.ts ile aynı: TypeORM mock'lanır, servis gerçek planlayıcıyla çalışır.
// Girdi doğrulaması controller'dadır (rotation-plan.controller.spec.ts); burada girdi geçerli kabul edilir.
describe('Rotasyon planı servisi', () => {
  const slots = [
    { name: 'Gece', startTime: '00:00', endTime: '08:00', required: 1 },
    { name: 'Sabah', startTime: '08:00', endTime: '16:00', required: 1 },
    { name: 'Akşam', startTime: '16:00', endTime: '24:00', required: 1 },
  ];
  // Controller'da doğrulanmış komutu üretir; varsayılan 2099-11-02'den 7 günlük önizleme, alanlar ezilebilir.
  const command = ({ apply = false, ...overrides }: Partial<RotationRequest> & { apply?: boolean } = {}): RotationPlanCommand =>
    ({ teamId: 1, request: { startDate: '2099-11-02', days: 7, slots, ...overrides }, apply });
  // Mock üye listesi: id 1..count, sicil S001.., hepsi aktif.
  const people = (count: number) => Array.from({ length: count }, (_, i) => ({
    id: i + 1, registrationNumber: `S00${i + 1}`, firstname: String.fromCharCode(65 + i), lastname: 'Test', isActive: true,
  }));
  // Zincirlenebilir TypeORM QueryBuilder mock'u: her metot kendini döndürür (where().andWhere()...).
  const builder = (methods: string[]) => Object.fromEntries(methods.map((name) => [name, jest.fn().mockReturnThis()]));

  let service: RotationPlanService;
  let teamRepo: { findOne: jest.Mock };
  let membersQuery: Record<string, jest.Mock>;
  let existingQuery: Record<string, jest.Mock>;
  let shiftsRepo: { createQueryBuilder: jest.Mock; create: jest.Mock; save: jest.Mock };
  let transaction: jest.Mock;

  beforeEach(() => {
    teamRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, isActive: true }) };
    membersQuery = builder(['where', 'andWhere', 'orderBy', 'setLock', 'getMany']);
    membersQuery.getMany.mockResolvedValue(people(4));
    existingQuery = builder(['where', 'andWhere', 'orderBy', 'addOrderBy', 'getMany']);
    existingQuery.getMany.mockResolvedValue([]);
    shiftsRepo = {
      createQueryBuilder: jest.fn(() => existingQuery),
      create: jest.fn((data) => data),
      save: jest.fn(async (rows: object[]) => rows.map((row, i) => ({ ...row, id: 100 + i }))),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Team) return teamRepo;
        if (entity === WorkforceUser) return { createQueryBuilder: () => membersQuery };
        if (entity === Shift) return shiftsRepo;
        throw new Error('Beklenmeyen entity');
      }),
      transaction: jest.fn(),
    };
    transaction = manager.transaction.mockImplementation((_isolation: string, callback: (m: EntityManager) => unknown) =>
      callback(manager as unknown as EntityManager));
    service = new RotationPlanService({ manager } as unknown as Repository<Shift>);
  });

  describe('Test 7 — önizleme (apply=false)', () => {
    it('planı döndürür; transaction açılmaz, kilit alınmaz, hiçbir şey yazılmaz', async () => {
      const response = await service.createRotationPlan(command(), 9);

      expect(response).toMatchObject({ teamId: 1, applied: false, unfilled: [], fairnessGapHours: 8 });
      expect(response.assignments).toHaveLength(21);
      expect(response.assignments.every((a) => !('shiftId' in a))).toBe(true);
      expect(transaction).not.toHaveBeenCalled();
      expect(shiftsRepo.create).not.toHaveBeenCalled();
      expect(shiftsRepo.save).not.toHaveBeenCalled();
      expect(membersQuery.setLock).not.toHaveBeenCalled();
      expect(teamRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('eksik plan önizlemede hata değildir: unfilled ile döner', async () => {
      membersQuery.getMany.mockResolvedValue(people(3));
      const response = await service.createRotationPlan(command(), 9);
      expect(response.unfilled.map((u) => u.slotName)).toEqual(['Gece', 'Sabah', 'Akşam']);
      expect(shiftsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Kayıt (apply=true)', () => {
    it('eksiksiz planı tek transaction ve tek save ile kaydeder (Test 8 — birim düzeyi)', async () => {
      const response = await service.createRotationPlan(command({ apply: true }), 9);

      expect(transaction).toHaveBeenCalledWith('READ COMMITTED', expect.any(Function));
      expect(shiftsRepo.save).toHaveBeenCalledTimes(1);
      const rows = shiftsRepo.save.mock.calls[0][0] as Array<Partial<Shift>>;
      expect(rows).toHaveLength(21);
      expect(rows.every((row) => row.createdById === 9)).toBe(true);
      expect(rows[0]).toMatchObject({ workforceUserId: 1, note: 'Rotasyon planı – Gece', startAt: new Date('2099-11-02T00:00:00+03:00') });
      expect(response.applied).toBe(true);
      expect(response.assignments.map((a) => a.shiftId)).toEqual(Array.from({ length: 21 }, (_, i) => 100 + i));
    });

    it('ekip ve üyeler, plan hesaplanmadan ÖNCE kilitlenir (sıra: ekip → üyeler → mevcut vardiyalar → save)', async () => {
      await service.createRotationPlan(command({ apply: true }), 9);
      expect(teamRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 }, lock: { mode: 'pessimistic_write' } });
      expect(membersQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(membersQuery.orderBy).toHaveBeenCalledWith('person.id', 'ASC');
      const order = [teamRepo.findOne, membersQuery.getMany, existingQuery.getMany, shiftsRepo.save]
        .map((mock) => mock.mock.invocationCallOrder[0]);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('Test 9 — unfilled doluyken 409 "Plan tamamlanamadı"; hiçbir kayıt oluşmaz', async () => {
      membersQuery.getMany.mockResolvedValue(people(3));
      await expect(service.createRotationPlan(command({ apply: true }), 9)).rejects.toMatchObject({
        error: {
          statusCode: 409,
          message: 'Plan tamamlanamadı',
          details: ['Gece', 'Sabah', 'Akşam'].map((slotName) => expect.objectContaining({ date: '2099-11-08', slotName, missing: 1 })),
        },
      });
      expect(shiftsRepo.create).not.toHaveBeenCalled();
      expect(shiftsRepo.save).not.toHaveBeenCalled();
    });

    it('Test 10 — birim düzeyi: mevcut vardiyalar aynı planı tekrar kaydettirmez (409)', async () => {
      // İlk kaydın sonucu, ikinci istekte "mevcut vardiya" olarak okunur.
      await service.createRotationPlan(command({ apply: true }), 9);
      const firstRun = (shiftsRepo.save.mock.calls[0][0] as Shift[]).map((row, i) => ({ ...row, id: 100 + i }));
      existingQuery.getMany.mockResolvedValue(firstRun);
      shiftsRepo.save.mockClear();

      await expect(service.createRotationPlan(command({ apply: true }), 9))
        .rejects.toMatchObject({ error: { statusCode: 409, message: 'Plan tamamlanamadı' } });
      expect(shiftsRepo.save).not.toHaveBeenCalled();
    });

    it('veritabanı çakışma kısıtı (23P01) 409 olarak döner', async () => {
      shiftsRepo.save.mockRejectedValue(new QueryFailedError('INSERT', [], Object.assign(new Error('conflict'), { code: '23P01' })));
      await expect(service.createRotationPlan(command({ apply: true }), 9))
        .rejects.toMatchObject({ error: { statusCode: 409, message: 'Plan tamamlanamadı: vardiya çakışması' } });
    });

    it('diğer kayıt hataları olduğu gibi yükselir (transaction rollback eder)', async () => {
      const failure = new Error('bağlantı koptu');
      shiftsRepo.save.mockRejectedValue(failure);
      await expect(service.createRotationPlan(command({ apply: true }), 9)).rejects.toBe(failure);
    });
  });

  describe('Mevcut vardiyalar ve kural penceresi', () => {
    it('plan aralığı ±7 gün okunur; mevcut vardiya planı etkiler', async () => {
      // A'nın plan başlamadan önceki gece 22:00–06:00 vardiyası: 2099-11-02 Gece ile çakışır.
      existingQuery.getMany.mockResolvedValue([{
        id: 50, workforceUserId: 1, startAt: new Date('2099-11-01T22:00:00+03:00'), endAt: new Date('2099-11-02T06:00:00+03:00'),
      }]);
      const response = await service.createRotationPlan(command(), 9);

      expect(response.assignments[0]).toMatchObject({ slotName: 'Gece', registrationNumber: 'S002' });
      expect(existingQuery.andWhere).toHaveBeenCalledWith('shift.startAt < :windowEnd', {
        windowEnd: new Date(new Date('2099-11-09T00:00:00+03:00').getTime() + RULE_WINDOW_MS),
      });
      expect(existingQuery.andWhere).toHaveBeenCalledWith('shift.endAt > :windowStart', {
        windowStart: new Date(new Date('2099-11-02T00:00:00+03:00').getTime() - RULE_WINDOW_MS),
      });
    });
  });

  // Bu kontroller veritabanı durumuna bağlıdır; kilit altında yapılması gerektiği için service'tedir.
  describe('Ekip ve üye durumu', () => {
    it.each([
      [null, 404, 'Ekip bulunamadı'],
      [{ id: 1, isActive: false }, 409, 'Pasif ekibe vardiya atanamaz'],
    ])('ekip %o → %d', async (team, statusCode, message) => {
      teamRepo.findOne.mockResolvedValue(team);
      await expect(service.createRotationPlan(command({ apply: true }), 9)).rejects.toMatchObject({ error: { statusCode, message } });
      expect(shiftsRepo.save).not.toHaveBeenCalled();
    });

    it('aktif üye yoksa 409', async () => {
      membersQuery.getMany.mockResolvedValue([]);
      await expect(service.createRotationPlan(command(), 9))
        .rejects.toMatchObject({ error: { statusCode: 409, message: 'Ekibin aktif üyesi yok' } });
    });
  });
});
