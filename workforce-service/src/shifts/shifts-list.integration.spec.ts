import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { Shift } from './entities/shift.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { Team } from '../teams/entities/team.entity';
import { Account } from '../account/entities/account.entity';
import { AccountRole } from '../account/entities/account-role.enum';
import { ShiftsService } from './shifts.service';

// Gerçek PostgreSQL; yalnızca bu test için oluşturulan şema kullanılır.
describe('Takvim vardiya listesi (PostgreSQL entegrasyon)', () => {
  let db: DataSource;
  let service: ShiftsService;
  let person: WorkforceUser;
  let team: Team;
  let night: Shift;
  const schema = `shift_list_test_${process.pid}_${Date.now()}`;
  const from = '2026-11-13T00:00:00+03:00';
  const to = '2026-11-14T00:00:00+03:00';

  beforeAll(async () => {
    const entities = [Shift, WorkforceUser, Team, Account];
    const tables = getMetadataArgsStorage().tables.filter((table) => entities.includes(table.target as typeof Shift));
    const originalSchemas = tables.map((table) => table.schema);
    tables.forEach((table) => { table.schema = schema; });
    try {
      db = await new DataSource({
        type: 'postgres',
        url: process.env.SHIFTS_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/mini_wfm',
        entities,
        namingStrategy: new SnakeNamingStrategy(),
      }).initialize();
    } finally {
      tables.forEach((table, index) => { table.schema = originalSchemas[index]; });
    }
    // synchronize enum tiplerini şemadan önce kurmaya çalışır; şema önceden açılmalı
    await db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await db.synchronize();
    service = new ShiftsService(db.getRepository(Shift));
    team = await db.getRepository(Team).save({ name: 'Takvim ekibi' });
    person = await db.getRepository(WorkforceUser).save({ firstname: 'Ada', lastname: 'Yılmaz', registrationNumber: 'T001', teamId: team.id });
    const unassigned = await db.getRepository(WorkforceUser).save({ firstname: 'Ali', lastname: 'Demir', registrationNumber: 'T002' });
    const account = await db.getRepository(Account).save({ username: 'planner', passwordHash: 'test', role: AccountRole.ADMIN });
    const save = (startAt: string, endAt: string, workforceUserId = person.id) => db.getRepository(Shift).save({
      workforceUserId, createdById: account.id, startAt: new Date(startAt), endAt: new Date(endAt),
    });
    night = await save('2026-11-12T23:00:00+03:00', '2026-11-13T07:00:00+03:00');
    await save('2026-11-12T20:00:00+03:00', from); // Tam from'da biter: hariç
    await save(to, '2026-11-14T08:00:00+03:00'); // Tam to'da başlar: hariç
    await save(from, '2026-11-13T08:00:00+03:00'); // Tam from'da başlar: dahil
    await save('2026-11-13T20:00:00+03:00', to); // Tam to'da biter: dahil
    await save('2026-11-12T22:00:00+03:00', '2026-11-14T01:00:00+03:00', unassigned.id); // Tüm aralığı kapsar
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });

  it('gece vardiyası her iki günün sorgusunda bulunur', async () => {
    for (const range of [{ from: '2026-11-12T00:00:00+03:00', to: from }, { from, to }]) {
      expect((await service.findAllShifts(range)).map((shift) => shift.id)).toContain(night.id);
    }
  });

  it('sınırları doğru uygular, sıralar ve personel/ekibi tek sorguda getirir', async () => {
    const spy = jest.spyOn(db.logger, 'logQuery');
    try {
      const rows = await service.findAllShifts({ from, to });
      expect(rows).toHaveLength(4);
      expect(rows.map((row) => row.startAt.getTime())).toEqual(rows.map((row) => row.startAt.getTime()).sort((a, b) => a - b));
      expect(rows.find((row) => row.id === night.id)?.workforceUser).toEqual({
        id: person.id, firstname: 'Ada', lastname: 'Yılmaz', team: { id: team.id, name: team.name },
      });
      expect(rows[0].workforceUser.team).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });

  it('filtreler birlikte çalışır ve ekip değişikliği güncel ekibe yansır', async () => {
    expect(await service.findAllShifts({ from, to, workforceUserId: person.id, teamId: team.id })).toHaveLength(3);
    expect(await service.findAllShifts({ from, to, workforceUserId: person.id, teamId: team.id + 100 })).toEqual([]);
    const other = await db.getRepository(Team).save({ name: 'Yeni ekip' });
    await db.getRepository(WorkforceUser).update(person.id, { teamId: other.id });
    expect(await service.findAllShifts({ from, to, teamId: team.id })).toEqual([]);
    expect(await service.findAllShifts({ from, to, workforceUserId: person.id, teamId: other.id })).toHaveLength(3);
  });

  it('40 günlük aralığı 400 ile reddeder, 31 günü kabul eder', async () => {
    await expect(service.findAllShifts({ from: '2026-11-01', to: '2026-12-11' })).rejects.toMatchObject({
      error: expect.objectContaining({ statusCode: 400 }),
    });
    await expect(service.findAllShifts({ from: '2026-11-01', to: '2026-12-02' })).resolves.toBeInstanceOf(Array);
  });
  describe('Ekibe toplu vardiya: transaction', () => {
    const startAt = '2099-01-01T08:00:00Z';
    const endAt = '2099-01-01T16:00:00Z';
    let bulkTeam: Team;
    let active: WorkforceUser[];
    let passive: WorkforceUser;
    let actorId: number;
    let serial = 0;

    beforeEach(async () => {
      serial++;
      bulkTeam = await db.getRepository(Team).save({ name: `Toplu ekip ${serial}` });
      const people = db.getRepository(WorkforceUser);
      active = [];
      for (let i = 0; i < 3; i++) {
        active.push(await people.save({ firstname: `Üye${i}`, lastname: 'Test', registrationNumber: `B${serial}-${i}`, teamId: bulkTeam.id }));
      }
      passive = await people.save({ firstname: 'Pasif', lastname: 'Üye', registrationNumber: `P${serial}`, teamId: bulkTeam.id, isActive: false });
      actorId = (await db.getRepository(Account).findOneByOrFail({ username: 'planner' })).id;
    });

    it('birden fazla çakışan personeli listeler ve diğer üyeye hiçbir kayıt yazmaz', async () => {
      const repo = db.getRepository(Shift);
      await repo.save(active.slice(0, 2).map((member) => repo.create({
        workforceUserId: member.id, createdById: actorId, startAt: new Date(startAt), endAt: new Date(endAt),
      })));
      const before = await repo.count();
      await expect(service.createTeamShifts({ teamId: bulkTeam.id, startAt, endAt }, actorId)).rejects.toMatchObject({
        error: { statusCode: 409, details: active.slice(0, 2).map((member) => ({
          workforceUserId: member.id, registrationNumber: member.registrationNumber, firstname: member.firstname, lastname: member.lastname,
        })) },
      });
      expect(await repo.count()).toBe(before);
      expect(await repo.countBy({ workforceUserId: active[2].id })).toBe(0);
    });

    it('başarılı olduğunda yalnızca aktif üyelerin vardiyalarını döndürür', async () => {
      // Pasif üyenin çakışması toplu işlemi engellemez.
      await db.getRepository(Shift).save({ workforceUserId: passive.id, createdById: actorId, startAt: new Date(startAt), endAt: new Date(endAt) });
      const result = await service.createTeamShifts({ teamId: bulkTeam.id, startAt, endAt, note: 'Toplu' }, actorId);
      expect(result.map((shift) => shift.workforceUserId)).toEqual(active.map((member) => member.id));
      expect(result.every((shift) => shift.note === 'Toplu' && shift.createdById === actorId)).toBe(true);
      expect(await db.getRepository(Shift).countBy({ workforceUserId: passive.id })).toBe(1);
    });

    it('kayıt sırasında veritabanı hatası olursa hiçbir yeni vardiya kalmaz', async () => {
      const table = db.getMetadata(Shift).tablePath.split('.').map((part) => `"${part}"`).join('.');
      await db.query(`ALTER TABLE ${table} ADD CONSTRAINT bulk_test_failure CHECK (workforce_user_id <> ${active[2].id})`);
      const before = await db.getRepository(Shift).count();
      try {
        await expect(service.createTeamShifts({ teamId: bulkTeam.id, startAt, endAt }, actorId)).rejects.toThrow();
        expect(await db.getRepository(Shift).count()).toBe(before);
      } finally {
        await db.query(`ALTER TABLE ${table} DROP CONSTRAINT bulk_test_failure`);
      }
    });

    it('eksik ekip 404; pasif ekip ve aktif üyesiz ekip 409 döndürür', async () => {
      await expect(service.createTeamShifts({ teamId: 2147483647, startAt, endAt }, actorId)).rejects.toMatchObject({ error: { statusCode: 404 } });
      await db.getRepository(Team).update(bulkTeam.id, { isActive: false });
      await expect(service.createTeamShifts({ teamId: bulkTeam.id, startAt, endAt }, actorId)).rejects.toMatchObject({ error: { statusCode: 409 } });
      await db.getRepository(Team).update(bulkTeam.id, { isActive: true });
      await db.getRepository(WorkforceUser).update({ teamId: bulkTeam.id }, { isActive: false });
      await expect(service.createTeamShifts({ teamId: bulkTeam.id, startAt, endAt }, actorId)).rejects.toMatchObject({ error: { statusCode: 409 } });
    });

    const assertOneWinner = (results: PromiseSettledResult<unknown>[]) => {
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ error: { statusCode: 409 } });
    };

    const singleData = () => ({ workforceUserId: active[0].id, startAt: new Date(startAt), endAt: new Date(endAt), createdById: actorId });

    it('iki tekil oluşturma aynı personele çakışan vardiya yazamaz', async () => {
      assertOneWinner(await Promise.allSettled([
        service.createShift(singleData()), service.createShift(singleData()),
      ]));
      expect(await db.getRepository(Shift).countBy({ workforceUserId: active[0].id })).toBe(1);
    });

    it('tekil ve toplu oluşturma aynı personel kilidini kullanır', async () => {
      assertOneWinner(await Promise.allSettled([
        service.createShift(singleData()),
        service.createTeamShifts({ teamId: bulkTeam.id, startAt, endAt }, actorId),
      ]));
      expect(await db.getRepository(Shift).countBy({ workforceUserId: active[0].id })).toBe(1);
    });

    it.each(['single', 'bulk'])('güncelleme ile %s oluşturma çakışan vardiya yazamaz', async (mode) => {
      const existing = await service.createShift({ ...singleData(), startAt: new Date('2099-01-01T18:00:00Z'), endAt: new Date('2099-01-01T20:00:00Z') });
      assertOneWinner(await Promise.allSettled([
        service.updateShift(existing, { startAt: new Date(startAt), endAt: new Date(endAt) }),
        mode === 'single' ? service.createShift(singleData()) : service.createTeamShifts({ teamId: bulkTeam.id, startAt, endAt }, actorId),
      ]));
      const rows = await service.findAllShifts({ from: startAt, to: endAt, workforceUserId: active[0].id });
      expect(rows).toHaveLength(1);
    });

    it('iki farklı vardiya eşzamanlı aynı aralığa taşınamaz', async () => {
      // Kurulum vardiyaları arasında 11 saatten fazla dinlenme olmalı (WFM-35 REST kuralı)
      const first = await service.createShift({ ...singleData(), startAt: new Date('2099-01-03T08:00:00Z'), endAt: new Date('2099-01-03T10:00:00Z') });
      const second = await service.createShift({ ...singleData(), startAt: new Date('2099-01-05T08:00:00Z'), endAt: new Date('2099-01-05T10:00:00Z') });
      assertOneWinner(await Promise.allSettled([
        service.updateShift(first, { startAt: new Date(startAt), endAt: new Date(endAt) }),
        service.updateShift(second, { startAt: new Date(startAt), endAt: new Date(endAt) }),
      ]));
    });

    it('personel değişikliği hedef personele oluşturmayla yarışamaz', async () => {
      const existing = await service.createShift(singleData());
      assertOneWinner(await Promise.allSettled([
        service.updateShift(existing, { workforceUserId: active[1].id }),
        service.createShift({ ...singleData(), workforceUserId: active[1].id }),
      ]));
      expect(await db.getRepository(Shift).countBy({ workforceUserId: active[1].id })).toBe(1);
    });

    it('eşzamanlı iki toplu istekte yalnızca bir işlem başarılı olur', async () => {
      const results = await Promise.allSettled([
        service.createTeamShifts({ teamId: bulkTeam.id, startAt, endAt }, actorId),
        service.createTeamShifts({ teamId: bulkTeam.id, startAt, endAt }, actorId),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    });
  });

  // WFM-35: çalışma kuralları gerçek veritabanıyla (createShift, updateShift, createTeamShifts)
  describe('Çalışma kuralları', () => {
    let ruleTeam: Team;
    let members: WorkforceUser[];
    let actorId: number;
    let serial = 0;
    // 2099-02-02 pazartesi; saatler yerel (+03:00)
    const at = (day: string, time: string) => new Date(`2099-02-${day}T${time}:00+03:00`);

    beforeEach(async () => {
      serial++;
      ruleTeam = await db.getRepository(Team).save({ name: `Kural ekibi ${serial}` });
      members = [];
      for (let i = 0; i < 2; i++) {
        members.push(await db.getRepository(WorkforceUser).save({ firstname: `Kural${i}`, lastname: 'Test', registrationNumber: `R${serial}-${i}`, teamId: ruleTeam.id }));
      }
      actorId = (await db.getRepository(Account).findOneByOrFail({ username: 'planner' })).id;
    });

    const create = (workforceUserId: number, startAt: Date, endAt: Date) =>
      service.createShift({ workforceUserId, startAt, endAt, createdById: actorId });

    it('Pzt 08–16 varken Pzt 22–Sal 06 oluşturmak 409 ve "6 saat" döner, kayıt yazılmaz', async () => {
      await create(members[0].id, at('02', '08:00'), at('02', '16:00'));

      await expect(create(members[0].id, at('02', '22:00'), at('03', '06:00'))).rejects.toMatchObject({
        error: {
          statusCode: 409,
          message: expect.stringContaining('6 saat'),
          details: [expect.objectContaining({ rule: 'REST', value: 6, message: '6 saat dinlenme' })],
        },
      });
      expect(await db.getRepository(Shift).countBy({ workforceUserId: members[0].id })).toBe(1);
    });

    it('tam 11 saat dinlenme kabul edilir', async () => {
      await create(members[0].id, at('02', '08:00'), at('02', '16:00'));
      await expect(create(members[0].id, at('03', '03:00'), at('03', '11:00'))).resolves.toMatchObject({ workforceUserId: members[0].id });
    });

    it('güncellemede vardiya kendi eski haliyle karşılaştırılmaz', async () => {
      const shift = await create(members[0].id, at('02', '08:00'), at('02', '16:00'));
      // Bir saat ileri alınır: eski hal (08–16) hesaba girseydi "dinlenme" negatif olurdu
      await expect(service.updateShift(shift, { startAt: at('02', '09:00'), endAt: at('02', '17:00') }))
        .resolves.toMatchObject({ id: shift.id });
    });

    it('güncellemede başka vardiyaya 11 saatten yakın taşımak 409 döner', async () => {
      await create(members[0].id, at('02', '08:00'), at('02', '16:00'));
      const later = await create(members[0].id, at('04', '08:00'), at('04', '16:00'));
      await expect(service.updateShift(later, { startAt: at('02', '20:00'), endAt: at('02', '23:00') }))
        .rejects.toMatchObject({ error: { statusCode: 409, details: [expect.objectContaining({ rule: 'REST', value: 4 })] } });
    });

    it('toplu vardiyada dinlenmesi yetmeyen üye details içinde listelenir, kimseye yazılmaz', async () => {
      await create(members[1].id, at('02', '08:00'), at('02', '16:00'));
      const before = await db.getRepository(Shift).count();

      await expect(service.createTeamShifts({
        teamId: ruleTeam.id, startAt: at('02', '22:00').toISOString(), endAt: at('03', '06:00').toISOString(),
      }, actorId)).rejects.toMatchObject({
        error: {
          statusCode: 409,
          details: [{
            workforceUserId: members[1].id,
            registrationNumber: members[1].registrationNumber,
            firstname: members[1].firstname,
            lastname: members[1].lastname,
            violations: [expect.objectContaining({ rule: 'REST', message: '6 saat dinlenme' })],
          }],
        },
      });
      expect(await db.getRepository(Shift).count()).toBe(before);
    });

    it('haftalık limit: Pzt–Cum 07–18 varken Cmt 07–18 → 66 saat', async () => {
      for (const day of ['02', '03', '04', '05', '06']) {
        await create(members[0].id, at(day, '07:00'), at(day, '18:00'));
      }
      await expect(create(members[0].id, at('07', '07:00'), at('07', '18:00'))).rejects.toMatchObject({
        error: { statusCode: 409, details: [expect.objectContaining({ rule: 'WEEKLY_LIMIT', message: '66 saat' })] },
      });
    });
  });
});
