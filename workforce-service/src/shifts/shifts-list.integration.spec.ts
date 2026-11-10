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
});
