import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { Shift } from './entities/shift.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { Team } from '../teams/entities/team.entity';
import { Account } from '../account/entities/account.entity';
import { AccountRole } from '../account/entities/account-role.enum';
import { ShiftsService } from './shifts.service';
import { RotationPlanService } from './rotation-plan.service';
import { CreateRotationPlanPayload, RotationPlanController } from './rotation-plan.controller';
import { CorrelationContextService } from '../common/correlation/correlation-context.service';
import { checkWorkRules } from './calc/work-rules';
import { overlapMinutes } from '../common/calc/interval';

// Gerçek PostgreSQL; yalnızca bu test için oluşturulan şema kullanılır (timesheet/shifts-list entegrasyon düzeni).
// Mock testlerin kanıtlayamadığını kanıtlar: gerçek rollback, gerçek kilitler, gerçek eşzamanlılık.
// 2099-11-02 pazartesidir; geçmiş kontrolü kapatılmadan kayıt yapılabilsin diye gelecek seçildi.
describe('Rotasyon planı (PostgreSQL entegrasyon)', () => {
  let db: DataSource;
  let controller: RotationPlanController;
  let shifts: ShiftsService;
  let actorId: number;
  let serial = 0;
  const schema = `rotation_test_${process.pid}_${Date.now()}`;

  const slots = [
    { name: 'Gece', startTime: '00:00', endTime: '08:00', required: 1 },
    { name: 'Sabah', startTime: '08:00', endTime: '16:00', required: 1 },
    { name: 'Akşam', startTime: '16:00', endTime: '24:00', required: 1 },
  ];
  // Verilen ekip için 2099-11-02'den başlayan 7 günlük, Gece/Sabah/Akşam'lı RPC gövdesi.
  const body = (teamId: number, apply: boolean): CreateRotationPlanPayload =>
    ({ teamId, startDate: '2099-11-02', days: 7, slots, apply });

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
    actorId = (await db.getRepository(Account).save({ username: 'rotation-planner', passwordHash: 'test', role: AccountRole.PLANNER })).id;
    const correlation = { getActor: () => ({ id: actorId, username: 'rotation-planner', role: 'PLANNER' as const }) };
    controller = new RotationPlanController(
      new RotationPlanService(db.getRepository(Shift)),
      correlation as unknown as CorrelationContextService,
    );
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
      await db.destroy();
    }
  });

  // `size` aktif + 1 pasif üyeli yeni bir ekip kurar ve aktif üyeleri döndürür.
  // Her test kendi ekibiyle çalışır; testler birbirinin vardiyalarını görmez.
  const createTeam = async (size: number) => {
    serial++;
    const team = await db.getRepository(Team).save({ name: `Rotasyon ekibi ${serial}` });
    const people = db.getRepository(WorkforceUser);
    const members: WorkforceUser[] = [];
    for (let i = 0; i < size; i++) {
      members.push(await people.save({ firstname: `Üye${i}`, lastname: 'Test', registrationNumber: `R${serial}-${i}`, teamId: team.id }));
    }
    // Pasif üye plana dahil edilmez.
    await people.save({ firstname: 'Pasif', lastname: 'Üye', registrationNumber: `R${serial}-P`, teamId: team.id, isActive: false });
    return { team, members };
  };

  // Ekip üyelerinin veritabanındaki tüm vardiyalarını başlangıç ve id sırasıyla okur.
  const shiftsOfTeam = (members: WorkforceUser[]) => db.getRepository(Shift).createQueryBuilder('shift')
    .where('shift.workforceUserId IN (:...ids)', { ids: members.map((member) => member.id) })
    .orderBy('shift.startAt', 'ASC').addOrderBy('shift.id', 'ASC')
    .getMany();

  // Veri bütünlüğü kontrolü: veritabanından okunan her personelin vardiyaları checkWorkRules'tan
  // ihlalsiz geçmeli ve birbiriyle çakışmamalı. Eşzamanlı testlerde "kim kazanırsa kazansın" sonrası kullanılır.
  const expectIntegrity = async (members: WorkforceUser[]) => {
    const rows = await shiftsOfTeam(members);
    for (const member of members) {
      const mine = rows.filter((row) => row.workforceUserId === member.id);
      expect(checkWorkRules([], mine)).toEqual([]);
      mine.forEach((a, i) => mine.slice(i + 1).forEach((b) => expect(overlapMinutes(a, b)).toBe(0)));
    }
  };

  it('Test 7 — önizleme veritabanına hiçbir şey yazmaz', async () => {
    const { team, members } = await createTeam(4);
    const before = await db.getRepository(Shift).count();

    const response = await controller.createRotationPlan(body(team.id, false));

    expect(response).toMatchObject({ applied: false, unfilled: [], fairnessGapHours: 8 });
    expect(response.assignments).toHaveLength(21);
    expect(response.workloads).toHaveLength(4); // pasif üye yok
    expect(await db.getRepository(Shift).count()).toBe(before);
    expect(await shiftsOfTeam(members)).toEqual([]);
  });

  it('Test 8 — eksiksiz plan tek transaction ile tamamen kaydedilir', async () => {
    const { team, members } = await createTeam(4);

    const response = await controller.createRotationPlan(body(team.id, true));
    const rows = await shiftsOfTeam(members);

    expect(response.applied).toBe(true);
    expect(rows).toHaveLength(21);
    // Yanıttaki shiftId'ler veritabanındaki satırlarla birebir eşleşir.
    expect(response.assignments.map((a) => a.shiftId).sort((a, b) => a! - b!)).toEqual(rows.map((row) => row.id).sort((a, b) => a - b));
    for (const assignment of response.assignments) {
      const row = rows.find((r) => r.id === assignment.shiftId)!;
      expect(row).toMatchObject({ workforceUserId: assignment.workforceUserId, createdById: actorId, note: `Rotasyon planı – ${assignment.slotName}` });
      expect(row.startAt.toISOString()).toBe(assignment.startAt);
      expect(row.endAt.toISOString()).toBe(assignment.endAt);
    }
    await expectIntegrity(members);
  });

  it('Test 9 — eksik plan 409 "Plan tamamlanamadı" döner, hiçbir kayıt oluşmaz', async () => {
    const { team, members } = await createTeam(3);
    const before = await db.getRepository(Shift).count();

    await expect(controller.createRotationPlan(body(team.id, true))).rejects.toMatchObject({
      error: { statusCode: 409, message: 'Plan tamamlanamadı', details: expect.arrayContaining([expect.objectContaining({ date: '2099-11-08' })]) },
    });
    expect(await db.getRepository(Shift).count()).toBe(before);
    expect(await shiftsOfTeam(members)).toEqual([]);
  });

  it('Test 10 — aynı plan ikinci kez kaydedilemez (409), ilk kayıt bozulmaz', async () => {
    const { team, members } = await createTeam(4);
    await controller.createRotationPlan(body(team.id, true));
    const firstIds = (await shiftsOfTeam(members)).map((row) => row.id);

    // İkinci istekte ilk kaydın vardiyaları "mevcut" okunur; çakışma kontrolü tüm adayları eler.
    await expect(controller.createRotationPlan(body(team.id, true)))
      .rejects.toMatchObject({ error: { statusCode: 409, message: 'Plan tamamlanamadı' } });
    expect((await shiftsOfTeam(members)).map((row) => row.id)).toEqual(firstIds);
  });

  it('Test 10 — eşzamanlı iki kayıt isteğinde yalnızca biri başarılı olur', async () => {
    const { team, members } = await createTeam(4);

    // Ekip satırı FOR UPDATE ile kilitlendiği için ikinci transaction birincinin commit'ini bekler,
    // sonra planı güncel veriyle yeniden hesaplar ve eksik bulur.
    const results = await Promise.allSettled([
      controller.createRotationPlan(body(team.id, true)),
      controller.createRotationPlan(body(team.id, true)),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ error: { statusCode: 409, message: 'Plan tamamlanamadı' } });
    expect(await shiftsOfTeam(members)).toHaveLength(21);
    await expectIntegrity(members);
  });

  it('eşzamanlı tekil vardiya ve plan kaydı aynı personel kilidini kullanır; veri tutarlı kalır', async () => {
    const { team, members } = await createTeam(4);

    // Tekil oluşturma personeli, plan kaydı ekibi ve üyeleri kilitler: hangisi önce gelirse gelsin
    // diğeri onun sonucunu görür. Plan eksik kalırsa 409 alır; tekil vardiya çakışırsa 409 alır.
    const results = await Promise.allSettled([
      shifts.createShift({ workforceUserId: members[0].id, startAt: new Date('2099-11-02T08:00:00+03:00'), endAt: new Date('2099-11-02T16:00:00+03:00'), createdById: actorId }),
      controller.createRotationPlan(body(team.id, true)),
    ]);

    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
    results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .forEach((result) => expect(result.reason).toMatchObject({ error: { statusCode: 409 } }));
    await expectIntegrity(members);
  });

  it('plan öncesindeki mevcut vardiyalar kurallara dahil edilir', async () => {
    const { team, members } = await createTeam(4);
    // Üye0, pazar 2099-11-01 22:00 – pazartesi 06:00 çalışıyor: pazartesi Gece (00–08) ile çakışır,
    // Sabah (08–16) ise yalnızca 2 saat dinlenme bırakır.
    await shifts.createShift({
      workforceUserId: members[0].id, startAt: new Date('2099-11-01T22:00:00+03:00'), endAt: new Date('2099-11-02T06:00:00+03:00'), createdById: actorId,
    });

    const response = await controller.createRotationPlan(body(team.id, false));
    const firstDay = response.assignments.filter((a) => a.date === '2099-11-02');
    expect(firstDay.filter((a) => a.slotName !== 'Akşam').map((a) => a.workforceUserId)).not.toContain(members[0].id);
  });

  it('Test 11 — kayıt sırasında hata olursa kısmi kayıt kalmaz (rollback)', async () => {
    const { team, members } = await createTeam(4);
    const table = db.getMetadata(Shift).tablePath.split('.').map((part) => `"${part}"`).join('.');
    // Son üyenin satırını reddeden geçici kısıt: ilk satırlar yazılabilir, sonuncusu hata verir.
    await db.query(`ALTER TABLE ${table} ADD CONSTRAINT rotation_test_failure CHECK (workforce_user_id <> ${members[3].id})`);
    const before = await db.getRepository(Shift).count();
    try {
      // 23514 = check_violation: hata gerçekten kayıt sırasında, bizim kısıtımızdan gelir.
      await expect(controller.createRotationPlan(body(team.id, true)))
        .rejects.toMatchObject({ driverError: expect.objectContaining({ code: '23514', constraint: 'rotation_test_failure' }) });
      expect(await db.getRepository(Shift).count()).toBe(before);
      expect(await shiftsOfTeam(members)).toEqual([]);
    } finally {
      await db.query(`ALTER TABLE ${table} DROP CONSTRAINT rotation_test_failure`);
    }

    // Kısıt kalkınca aynı plan sorunsuz kaydedilir: rollback kilit veya yarım veri bırakmamıştır.
    await expect(controller.createRotationPlan(body(team.id, true))).resolves.toMatchObject({ applied: true });
    expect(await shiftsOfTeam(members)).toHaveLength(21);
  });
});
