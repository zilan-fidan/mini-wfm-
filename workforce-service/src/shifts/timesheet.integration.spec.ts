import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { Shift } from './entities/shift.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { Team } from '../teams/entities/team.entity';
import { Account } from '../account/entities/account.entity';
import { AccountRole } from '../account/entities/account-role.enum';
import { ShiftsService } from './shifts.service';
import { TimesheetService } from './timesheet.service';
import { TimesheetController } from './timesheet.controller';
import { TimesheetResponse } from './timesheet.response';

// Gerçek PostgreSQL; yalnızca bu test için oluşturulan şema kullanılır (shifts-list.integration.spec.ts ile aynı düzen).
describe('Aylık puantaj (PostgreSQL entegrasyon)', () => {
  let db: DataSource;
  let shifts: ShiftsService;
  let timesheet: TimesheetController;
  let octoberPerson: WorkforceUser;
  let novemberPerson: WorkforceUser;
  let crossingPerson: WorkforceUser;
  const schema = `timesheet_test_${process.pid}_${Date.now()}`;
  const local = (iso: string) => new Date(`${iso}+03:00`);

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
    await db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await db.synchronize();
    shifts = new ShiftsService(db.getRepository(Shift));
    timesheet = new TimesheetController(new TimesheetService(db.getRepository(Shift), db.getRepository(WorkforceUser)));

    const people = db.getRepository(WorkforceUser);
    octoberPerson = await people.save({ firstname: 'Ekim', lastname: 'Örnek', registrationNumber: 'TS001' });
    novemberPerson = await people.save({ firstname: 'Kasım', lastname: 'Örnek', registrationNumber: 'TS002' });
    crossingPerson = await people.save({ firstname: 'Pazar', lastname: 'Geçiş', registrationNumber: 'TS003' });
    const account = await db.getRepository(Account).save({ username: 'timesheet-planner', passwordHash: 'test', role: AccountRole.ADMIN });

    // Vardiyalar normal oluşturma yolundan yazılır: çakışma, 1–12 saat, REST, WEEKLY_LIMIT ve
    // CONSECUTIVE_DAYS kontrolleri çalışır. Örnek tarihler bugüne göre geçmişte kaldığından yalnızca
    // "şimdi" anı 1 Ekim 2026'ya sabitlenir; geçmiş kontrolü de dahil hiçbir kural kapatılmaz.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(local('2026-10-01T00:00:00').getTime());
    try {
      const create = (workforceUserId: number, start: string, end: string) =>
        shifts.createShift({ workforceUserId, startAt: local(start), endAt: local(end), createdById: account.id });

      await create(octoberPerson.id, '2026-10-28T08:00:00', '2026-10-28T16:00:00');
      await create(octoberPerson.id, '2026-10-30T18:00:00', '2026-10-31T02:00:00');
      await create(octoberPerson.id, '2026-10-31T22:00:00', '2026-11-01T06:00:00');

      for (const day of ['02', '03', '04', '05', '06', '07']) {
        await create(novemberPerson.id, `2026-11-${day}T08:00:00`, `2026-11-${day}T16:00:00`);
      }

      // Kasım haftalarının başlangıcından (26 Ekim pzt 00.00) ÖNCE başlayıp içine taşan vardiya
      await create(crossingPerson.id, '2026-10-25T22:00:00', '2026-10-26T06:00:00');
    } finally {
      nowSpy.mockRestore();
    }
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });

  const day = (result: TimesheetResponse, date: string) => result.days.find((row) => row.date === date);
  const week = (result: TimesheetResponse, weekStart: string) => result.weeks.find((row) => row.weekStart === weekStart);

  it('Ekim 2026: günlük satırlar ve ay toplamları', async () => {
    const result = await timesheet.getTimesheet({ workforceUserId: octoberPerson.id, month: '2026-10' });
    expect(result.days).toHaveLength(31);
    expect(day(result, '2026-10-28')).toEqual({ date: '2026-10-28', totalHours: 8, nightHours: 0, holidayHours: 3, weekendHours: 0, overtimeHours: 0 });
    expect(day(result, '2026-10-30')).toEqual({ date: '2026-10-30', totalHours: 6, nightHours: 4, holidayHours: 0, weekendHours: 0, overtimeHours: 0 });
    // 31 Ekim: 30→31 vardiyasından 2 saat + 31→1 vardiyasından 2 saat
    expect(day(result, '2026-10-31')).toEqual({ date: '2026-10-31', totalHours: 4, nightHours: 4, holidayHours: 0, weekendHours: 4, overtimeHours: 0 });
    expect(day(result, '2026-10-01')).toEqual({ date: '2026-10-01', totalHours: 0, nightHours: 0, holidayHours: 0, weekendHours: 0, overtimeHours: 0 });
    expect(result.totals).toEqual({ totalHours: 18, nightHours: 8, weekendHours: 4, holidayHours: 3, overtimeHours: 0 });
    expect(week(result, '2026-10-26')).toEqual({ weekStart: '2026-10-26', totalHours: 24, overtimeHours: 0, monthTotalHours: 18, monthOvertimeHours: 0 });
  });

  it('Ekim personelinin kalan 6 saati Kasım\'a aittir', async () => {
    const result = await timesheet.getTimesheet({ workforceUserId: octoberPerson.id, month: '2026-11' });
    expect(day(result, '2026-11-01')).toMatchObject({ totalHours: 6, nightHours: 6, weekendHours: 6 });
    expect(result.totals.totalHours).toBe(6);
  });

  it('Kasım 2026: haftalık 48 saat, 7 Kasım 13.00–16.00 arası 3 saat fazla mesai', async () => {
    const result = await timesheet.getTimesheet({ workforceUserId: novemberPerson.id, month: '2026-11' });
    expect(week(result, '2026-11-02')).toEqual({ weekStart: '2026-11-02', totalHours: 48, overtimeHours: 3, monthTotalHours: 48, monthOvertimeHours: 3 });
    expect(day(result, '2026-11-07')).toEqual({ date: '2026-11-07', totalHours: 8, nightHours: 0, holidayHours: 0, weekendHours: 8, overtimeHours: 3 });
    expect(day(result, '2026-11-06')?.overtimeHours).toBe(0);
    expect(result.totals).toEqual({ totalHours: 48, nightHours: 0, holidayHours: 0, weekendHours: 8, overtimeHours: 3 });
  });

  it('hafta aralığından önce başlayıp içine taşan vardiya da sorgulanır', async () => {
    const result = await timesheet.getTimesheet({ workforceUserId: crossingPerson.id, month: '2026-11' });
    expect(week(result, '2026-10-26')).toMatchObject({ totalHours: 6, monthTotalHours: 0 });
    expect(result.totals.totalHours).toBe(0);
  });

  it('örnek veriler çalışma kuralları açıkken yazıldı: 7. ardışık gün reddedilir', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(local('2026-10-01T00:00:00').getTime());
    try {
      const account = await db.getRepository(Account).findOneByOrFail({ username: 'timesheet-planner' });
      await expect(shifts.createShift({
        workforceUserId: novemberPerson.id, startAt: local('2026-11-08T08:00:00'), endAt: local('2026-11-08T16:00:00'), createdById: account.id,
      })).rejects.toMatchObject({ error: { statusCode: 409, details: [expect.objectContaining({ rule: 'CONSECUTIVE_DAYS' })] } });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('olmayan personel 404, geçersiz ay ve ID 400', async () => {
    await expect(timesheet.getTimesheet({ workforceUserId: 2147483647, month: '2026-11' })).rejects.toMatchObject({ error: { statusCode: 404 } });
    for (const query of [
      { workforceUserId: octoberPerson.id, month: '2026-13' },
      { workforceUserId: octoberPerson.id, month: '2026-1' },
      { workforceUserId: octoberPerson.id, month: '2028-01' },
      { workforceUserId: 0, month: '2026-11' },
    ]) {
      await expect(timesheet.getTimesheet(query)).rejects.toMatchObject({ error: { statusCode: 400 } });
    }
  });
});
