// Varlıklar (entity) ve yardımcı fonksiyonlar
import { Team } from '../teams/entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { validateShiftPeriod } from './utils/validate-shift-period';

// NestJS, class-validator ve TypeORM bağımlılıkları
import { RpcException } from '@nestjs/microservices';
import { isISO8601 } from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { DEFAULT_WORK_RULE_OPTIONS, MS_PER_DAY, WorkRuleViolation, checkWorkRules } from './calc/work-rules';

// Kural kontrolü için yeni vardiyanın kaç gün öncesi ve sonrası okunur.
// Hafta penceresi, 11 saat dinlenme ve 7 günlük seri bu aralığın dışına taşamaz.
export const RULE_WINDOW_MS = 7 * MS_PER_DAY;

// İhlali TCP/JSON üzerinden taşınabilir, sade bir yapıya çevirir (entity'nin tüm alanları değil).
export function toViolationDetail(violation: WorkRuleViolation) {
  return {
    rule: violation.rule,
    value: violation.value,
    message: violation.message,
    shifts: violation.shifts.map((shift) => ({
      ...(shift.id !== undefined && { id: shift.id }),
      startAt: shift.startAt.toISOString(),
      endAt: shift.endAt.toISOString(),
    })),
  };
}

// Ekibe toplu vardiya atama isteğinin giriş verisi.
export type CreateTeamShiftsPayload = {
  teamId: number;
  startAt: string;
  endAt: string;
  note?: string | null;
};

// Vardiya listeleme filtreleri; personel ve ekip filtresi opsiyoneldir.
export type ListShiftsQuery = {
  from: string;
  to: string;
  workforceUserId?: number;
  teamId?: number;
};

// Vardiya iş mantığını (oluşturma, listeleme, güncelleme, silme, çakışma kontrolü) yöneten servis.
@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
  ) {}

  // Bir ekibin tüm aktif üyelerine aynı vardiyayı tek transaction içinde atar.
  // Herhangi bir üyede çakışma varsa hiçbir vardiya oluşturulmaz.
  async createTeamShifts(payload: CreateTeamShiftsPayload, createdById: number): Promise<Shift[]> {
    // Girdi doğrulama: ekip ID'si ve tarih aralığı kontrol edilir.
    if (!Number.isInteger(payload.teamId) || payload.teamId <= 0) {
      throw new RpcException({ statusCode: 400, message: 'Geçersiz ekip ID değeri' });
    }
    const startAt = new Date(payload.startAt);
    const endAt = new Date(payload.endAt);
    validateShiftPeriod(startAt, endAt, { checkPast: true });

    // Tüm okumalar ve yazmalar aynı transaction manager üzerinden yapılır.
    return this.shiftRepository.manager.transaction('READ COMMITTED', async (manager) => {
      const teamRepository = manager.getRepository(Team);
      const memberRepository = manager.getRepository(WorkforceUser);
      const shiftRepository = manager.getRepository(Shift);

      // Ekip kilitlenerek okunur; ekip yoksa 404, pasifse 409 döner.
      const team = await teamRepository.findOne({
        where: { id: payload.teamId }, lock: { mode: 'pessimistic_write' },
      });
      if (!team) {
        throw new RpcException({ statusCode: 404, message: 'Ekip bulunamadı' });
      }
      if (!team.isActive) {
        throw new RpcException({ statusCode: 409, message: 'Pasif ekibe vardiya atanamaz' });
      }

      // Ekibin aktif üyeleri ID sırasıyla kilitlenerek getirilir (sıralı kilit deadlock'u önler).
      const members = await memberRepository.createQueryBuilder('person')
        .where('person.teamId = :teamId', { teamId: team.id })
        .andWhere('person.isActive = :isActive', { isActive: true })
        .orderBy('person.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      if (members.length === 0) {
        throw new RpcException({ statusCode: 409, message: 'Ekibin aktif üyesi yok' });
      }

      // Üyelerden hangilerinin bu aralıkta zaten vardiyası var, tek sorguda tespit edilir.
      const overlaps = await shiftRepository.createQueryBuilder('shift')
        .select('shift.workforceUserId', 'workforceUserId')
        .distinct(true)
        .where('shift.workforceUserId IN (:...ids)', { ids: members.map((member) => member.id) })
        .andWhere('shift.startAt < :endAt', { endAt })
        .andWhere('shift.endAt > :startAt', { startAt })
        .getRawMany<{ workforceUserId: number }>();

      // Çakışan personel varsa, kimlerin çakıştığı bilgisiyle birlikte 409 hatası fırlatılır.
      const conflictingIds = new Set(overlaps.map((row) => row.workforceUserId));
      const conflicts = members.filter((member) => conflictingIds.has(member.id));
      if (conflicts.length > 0) {
        throw new RpcException({
          statusCode: 409,
          message: 'Bazı personellerin vardiyaları çakışıyor',
          details: conflicts.map((member) => ({
            workforceUserId: member.id,
            registrationNumber: member.registrationNumber,
            firstname: member.firstname,
            lastname: member.lastname,
          })),
        });
      }

      // Çalışma kuralları: tüm üyelerin ±7 günlük vardiyaları tek sorguda okunur, personele göre gruplanır.
      const nearby = await this.findShiftsForRuleCheck(shiftRepository, members.map((member) => member.id), startAt, endAt);
      const shiftsByPerson = new Map<number, Shift[]>();
      for (const shift of nearby) {
        shiftsByPerson.set(shift.workforceUserId, [...(shiftsByPerson.get(shift.workforceUserId) ?? []), shift]);
      }
      const ruleViolations = members
        .map((member) => ({
          member,
          violations: checkWorkRules(shiftsByPerson.get(member.id) ?? [], [{ startAt, endAt }], DEFAULT_WORK_RULE_OPTIONS),
        }))
        .filter(({ violations }) => violations.length > 0);
      if (ruleViolations.length > 0) {
        throw new RpcException({
          statusCode: 409,
          message: 'Bazı personeller çalışma kurallarını ihlal ediyor',
          details: ruleViolations.map(({ member, violations }) => ({
            workforceUserId: member.id,
            registrationNumber: member.registrationNumber,
            firstname: member.firstname,
            lastname: member.lastname,
            violations: violations.map(toViolationDetail),
          })),
        });
      }

      // Her üye için vardiya oluşturulup kaydedilir.
      const shifts = members.map((member) => shiftRepository.create({
        workforceUserId: member.id, startAt, endAt, note: payload.note ?? null, createdById,
      }));
      // Sonraki bir kayıt hata verirse öncekiler de rollback edilir.
      return shiftRepository.save(shifts);
    });
  }

  // Tarih aralığıyla kesişen vardiyaları listeler; personel ve ekip filtresi opsiyoneldir.
  async findAllShifts(filters: ListShiftsQuery): Promise<Shift[]> {
    // Girdi doğrulama: ISO 8601 formatı, pozitif ve en fazla 31 günlük aralık, geçerli ID'ler.
    const from = new Date(filters.from);
    const to = new Date(filters.to);
    const duration = to.getTime() - from.getTime();
    if (
      !isISO8601(filters.from, { strict: true, strictSeparator: true }) ||
      !isISO8601(filters.to, { strict: true, strictSeparator: true }) ||
      !Number.isFinite(duration) || duration <= 0 || duration > 31 * 86400000 ||
      [filters.workforceUserId, filters.teamId].some(
        (id) => id !== undefined && (!Number.isInteger(id) || id <= 0),
      )
    ) {
      throw new RpcException({ statusCode: 400, message: 'Geçersiz filtre; tarih aralığı pozitif olmalı ve 31 günü aşmamalıdır' });
    }

    // Ana sorgu: personel ve ekip bilgisiyle birlikte, aralıkla kesişen vardiyalar başlangıç zamanına göre sıralı gelir.
    const query = this.shiftRepository.createQueryBuilder('shift')
      .leftJoin('shift.workforceUser', 'person')
      .leftJoin('person.team', 'team')
      .addSelect(['person.id', 'person.firstname', 'person.lastname', 'team.id', 'team.name'])
      .where('shift.startAt < :to', { to })
      .andWhere('shift.endAt > :from', { from })
      .orderBy('shift.startAt', 'ASC')
      .addOrderBy('shift.id', 'ASC');

    // Opsiyonel filtreler sorguya eklenir.
    if (filters.workforceUserId !== undefined) {
      query.andWhere('shift.workforceUserId = :workforceUserId', { workforceUserId: filters.workforceUserId });
    }
    if (filters.teamId !== undefined) {
      query.andWhere('person.teamId = :teamId', { teamId: filters.teamId });
    }
    return query.getMany();
  }

  // Çakışma kontrolü ve kayıt, personel kilidi bırakılmadan tamamlanır.
  async createShift(data: Partial<Shift>): Promise<Shift> {
    return this.shiftRepository.manager.transaction('READ COMMITTED', async (manager) => {
      // Personel kilitlenir, aktif olduğu ve tarih aralığının geçerli olduğu doğrulanır.
      const person = await this.lockPeople(manager, [data.workforceUserId!]);
      this.requireActivePerson(person, data.workforceUserId!);
      validateShiftPeriod(data.startAt!, data.endAt!, { checkPast: true });

      // Çakışma yoksa vardiya kaydedilir.
      const repository = manager.getRepository(Shift);
      await this.assertNoOverlap(repository, data.workforceUserId!, data.startAt!, data.endAt!);
      await this.assertWorkRules(repository, data.workforceUserId!, data.startAt!, data.endAt!);
      return repository.save(repository.create(data));
    });
  }

  // Vardiyayı ID üzerinden bulur.
  async findOneShift(id: number): Promise<Shift | null> {
    return this.shiftRepository.findOne({
      where: { id },
    });
  }

  // İstemcinin/controller'ın eski kopyasını değil, kilitli güncel kaydı kullanır.
  async updateShift(shift: Shift, data: Partial<Shift>): Promise<Shift> {
    return this.shiftRepository.manager.transaction('READ COMMITTED', async (manager) => {
      // Güncellenecek vardiyanın güncel hali kilitli olarak okunur; yoksa 404.
      const repository = manager.getRepository(Shift);
      const current = await repository.findOne({
        where: { id: shift.id }, lock: { mode: 'pessimistic_write' },
      });
      if (!current) {
        throw new RpcException({ statusCode: 404, message: 'Vardiya bulunamadı' });
      }

      // Personel değişirken eski ve yeni personel daima ID sırasıyla kilitlenir.
      const workforceUserId = data.workforceUserId ?? current.workforceUserId;
      const people = await this.lockPeople(manager, [current.workforceUserId, workforceUserId]);
      this.requireActivePerson(people, workforceUserId);

      // Geçmişteki vardiya güncellenemez.
      if (current.startAt.getTime() < Date.now()) {
        throw new RpcException({ statusCode: 409, message: 'Geçmişteki vardiya güncellenemez' });
      }

      // Yeni tarihler doğrulanır, kendisi hariç çakışma kontrolü yapılır ve değişiklikler kaydedilir.
      const startAt = data.startAt ?? current.startAt;
      const endAt = data.endAt ?? current.endAt;
      validateShiftPeriod(startAt, endAt, { checkPast: true });
      await this.assertNoOverlap(repository, workforceUserId, startAt, endAt, current.id);
      // Eski hal sorguda hariç tutulur; id de verilir ki checkWorkRules da onu eleyebilsin.
      await this.assertWorkRules(repository, workforceUserId, startAt, endAt, current.id);
      return repository.save(repository.merge(current, data, { workforceUserId, startAt, endAt }));
    });
  }

  // Personelleri tekrarsız ve ID sırasıyla yazma kilidiyle getirir (sıralı kilit deadlock'u önler).
  private lockPeople(manager: EntityManager, ids: number[]): Promise<WorkforceUser[]> {
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new RpcException({ statusCode: 400, message: 'Geçersiz personel ID değeri' });
    }
    return manager.getRepository(WorkforceUser).createQueryBuilder('person')
      .where('person.id IN (:...ids)', { ids: [...new Set(ids)].sort((a, b) => a - b) })
      .orderBy('person.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
  }

  // İstenen personelin listede bulunduğunu ve aktif olduğunu doğrular; değilse 404/409 fırlatır.
  private requireActivePerson(people: WorkforceUser[], id: number): void {
    const person = people.find((person) => person.id === id);
    if (!person) {
      throw new RpcException({ statusCode: 404, message: 'Personel bulunamadı' });
    }
    if (!person.isActive) {
      throw new RpcException({ statusCode: 409, message: 'Pasif personele vardiya atanamaz' });
    }
  }

  // Personelin aynı aralıkta başka vardiyası varsa 409 fırlatır.
  // excludeShiftId verilirse (güncelleme sırasında) o vardiya kontrol dışı bırakılır.
  private async assertNoOverlap(repository: Repository<Shift>, workforceUserId: number, startAt: Date, endAt: Date, excludeShiftId?: number): Promise<void> {
    const query = repository.createQueryBuilder('shift')
      .where('shift.workforceUserId = :workforceUserId', { workforceUserId })
      .andWhere('shift.startAt < :endAt', { endAt })
      .andWhere('shift.endAt > :startAt', { startAt });
    if (excludeShiftId !== undefined) {
      query.andWhere('shift.id != :excludeShiftId', { excludeShiftId });
    }
    const overlap = await query.getOne();
    if (overlap) {
      throw new RpcException({ statusCode: 409, message: `Vardiya çakışması: ${overlap.startAt.toISOString()} - ${overlap.endAt.toISOString()}` });
    }
  }

  // Personel(ler)in yeni vardiya etrafındaki ±7 günlük vardiyalarını okur; yalnızca kontrol için gereken aralık.
  private findShiftsForRuleCheck(repository: Repository<Shift>, workforceUserIds: number[], startAt: Date, endAt: Date, excludeShiftId?: number): Promise<Shift[]> {
    const query = repository.createQueryBuilder('shift')
      .where('shift.workforceUserId IN (:...workforceUserIds)', { workforceUserIds })
      .andWhere('shift.startAt < :windowEnd', { windowEnd: new Date(endAt.getTime() + RULE_WINDOW_MS) })
      .andWhere('shift.endAt > :windowStart', { windowStart: new Date(startAt.getTime() - RULE_WINDOW_MS) });
    if (excludeShiftId !== undefined) {
      query.andWhere('shift.id != :excludeShiftId', { excludeShiftId });
    }
    return query.getMany();
  }

  // Çalışma kurallarından (REST, WEEKLY_LIMIT, CONSECUTIVE_DAYS) biri ihlal ediliyorsa 409 fırlatır; details ihlalleri listeler.
  private async assertWorkRules(repository: Repository<Shift>, workforceUserId: number, startAt: Date, endAt: Date, shiftId?: number): Promise<void> {
    const existing = await this.findShiftsForRuleCheck(repository, [workforceUserId], startAt, endAt, shiftId);
    const violations = checkWorkRules(
      existing,
      [{ ...(shiftId !== undefined && { id: shiftId }), startAt, endAt }],
      DEFAULT_WORK_RULE_OPTIONS,
    );
    if (violations.length > 0) {
      throw new RpcException({
        statusCode: 409,
        message: `Çalışma kuralı ihlali: ${violations.map((violation) => `${violation.rule} (${violation.message})`).join(', ')}`,
        details: violations.map(toViolationDetail),
      });
    }
  }

  // Vardiyayı veritabanından siler.
  async removeShift(shift: Shift): Promise<void> {
    await this.shiftRepository.remove(shift);
  }


// Personelin verilen aralıkla kesişen bir vardiyası varsa döndürür, yoksa null.
// Transaction/kilit kullanmaz; yalnızca bilgi amaçlı kontrol içindir.
async findOverlappingShift(
  workforceUserId: number,
  startAt: Date,
  endAt: Date,
  excludeShiftId?: number,
): Promise<Shift | null> {
  const query = this.shiftRepository
    .createQueryBuilder('shift')
    .where('shift.workforceUserId = :workforceUserId', {
      workforceUserId,
    })
    .andWhere('shift.startAt < :endAt', { endAt })
    .andWhere('shift.endAt > :startAt', { startAt });

  // Güncelleme sırasında vardiyanın kendisini hariç tut.
  if (excludeShiftId !== undefined) {
    query.andWhere('shift.id != :excludeShiftId', {
      excludeShiftId,
    });
  }

  return query.getOne();
}
// Personelin en az bir vardiyası var mı diye hızlıca kontrol eder.
async hasShiftsForWorkforceUser(
  workforceUserId: number,
): Promise<boolean> {
  return this.shiftRepository.exists({
    where: { workforceUserId },
  });
}
}