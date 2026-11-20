import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { Team } from '../teams/entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { RULE_WINDOW_MS } from './shifts.service';
import {DEFAULT_ROTATION_OPTIONS, RotationPlan, RotationRequest,buildRotationPlan, planDates, resolveSlotInterval,} from './calc/rotation';
import { RotationPlanResponse, toRotationPlanResponse } from './rotation-plan.response';

// Controller'da doğrulanmış girdi. Service biçim doğrulaması yapmaz;
// yalnızca veritabanı durumuna bağlı kontrolleri (ekip, üyeler, çakışma) kilit altında yapar.
export type RotationPlanCommand = {
  teamId: number;
  request: RotationRequest;
  apply: boolean;
};

// PostgreSQL exclusion constraint ihlali (EX_shift_workforce_user_time).
const EXCLUSION_VIOLATION = '23P01';

// Okunan veri ve üzerinde hesaplanan plan; kayıt adımına aynen aktarılır.
type PlanContext = { team: Team; plan: RotationPlan };

// Rotasyon planının veritabanı tarafı: okuma, kilitleme, transaction, 409.
// Planlama mantığı burada DEĞİL, saf calc/rotation.ts içindedir.
@Injectable()
export class RotationPlanService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
  ) {}

  /**
   * Ekip için rotasyon planı oluşturur; apply=false ise yalnızca önizler, apply=true ise kaydeder.
   *
   * Önizleme: kilit ve transaction olmadan veriyi okur, planı hesaplar, hiçbir şey yazmaz.
   * Kayıt: READ COMMITTED transaction içinde ekip ve üyeleri kilitler, planı KİLİTLİ ve güncel veriyle
   * yeniden hesaplar (önizlemeye güvenmez). Plan eksikse 409 "Plan tamamlanamadı" (details: unfilled) fırlatır;
   * eksiksizse tüm vardiyaları tek save ile yazar; herhangi bir satır hata verirse transaction tamamen geri alınır.
   * Veritabanının çakışma kısıtı (23P01) tetiklenirse 409'a çevrilir.
   *
   * @param command     Controller'da doğrulanmış girdi (teamId, istek, apply).
   * @param createdById Vardiyaları oluşturan hesap (kayıtlarda createdById).
   * @returns Plan yanıtı; kayıtta her atama shiftId içerir.
   */
  async createRotationPlan(command: RotationPlanCommand, createdById: number): Promise<RotationPlanResponse> {
    const { teamId, request, apply } = command;
    const context = { teamId, startDate: request.startDate, days: request.days };

    // Önizleme: kilit ve transaction yok, hiçbir şey yazılmaz.
    if (!apply) {
      const { plan } = await this.loadAndPlan(this.shiftRepository.manager, teamId, request, false);
      return toRotationPlanResponse({ ...context, applied: false }, plan);
    }

    try {
      return await this.shiftRepository.manager.transaction('READ COMMITTED', async (manager) => {
        // Plan, KİLİTLİ veriler üzerinde transaction içinde yeniden hesaplanır;
        // önizlemedeki sonuca güvenilmez, çünkü arada başka kayıtlar oluşmuş olabilir.
        const { plan } = await this.loadAndPlan(manager, teamId, request, true);
        if (plan.unfilled.length > 0) {
          throw new RpcException({
            statusCode: 409,
            message: 'Plan tamamlanamadı',
            details: toRotationPlanResponse({ ...context, applied: false }, plan).unfilled,
          });
        }

        const repository = manager.getRepository(Shift);
        const rows = plan.assignments.map((assignment) => repository.create({
          workforceUserId: assignment.workforceUserId,
          startAt: assignment.startAt,
          endAt: assignment.endAt,
          note: `Rotasyon planı – ${assignment.slotName}`,
          createdById,
        }));
        // Tek save, aynı transaction: herhangi bir satır hata verirse hepsi rollback edilir.
        const saved = await repository.save(rows);
        return toRotationPlanResponse({ ...context, applied: true }, plan, saved.map((shift) => shift.id));
      });
    } catch (error) {
      // Son savunma hattı: kilitlerin dışında kalan bir yazma çakışma oluşturduysa
      // veritabanı kısıtı yakalar; transaction zaten rollback edilmiştir.
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === EXCLUSION_VIOLATION) {
        throw new RpcException({ statusCode: 409, message: 'Plan tamamlanamadı: vardiya çakışması' });
      }
      throw error;
    }
  }

  /**
   * Planın ihtiyaç duyduğu veriyi okur ve saf buildRotationPlan fonksiyonunu çağırır.
   *
   * Sıra: ekip (yoksa 404, pasifse 409) → aktif üyeler id sırasıyla (yoksa 409) → üyelerin
   * [ilk başlangıç − 7 gün, son bitiş + 7 gün] penceresindeki mevcut vardiyaları. Pencere, REST, haftalık limit
   * ve 6 günlük seri kontrollerinin ihtiyaç duyduğu önceki/sonraki vardiyaları kapsar (ShiftsService ile aynı).
   * lock=true iken ekip ve üyeler pessimistic_write ile createTeamShifts'teki sırayla kilitlenir; herkes aynı
   * sırada kilitlediği için deadlock oluşmaz ve eşzamanlı istekler sıraya girer.
   *
   * @param manager Transaction'ın manager'ı (kayıt) veya repository manager'ı (önizleme).
   * @param lock    true: kayıt için kilitli okuma; false: önizleme için kilitsiz okuma.
   */
  private async loadAndPlan(manager: EntityManager, teamId: number, request: RotationRequest, lock: boolean): Promise<PlanContext> {
    // Kilit sırası createTeamShifts ile aynı: önce ekip, sonra üyeler id sırasıyla (deadlock önlenir).
    const team = await manager.getRepository(Team).findOne({
      where: { id: teamId }, ...(lock && { lock: { mode: 'pessimistic_write' as const } }),
    });
    if (!team) {
      throw new RpcException({ statusCode: 404, message: 'Ekip bulunamadı' });
    }
    if (!team.isActive) {
      throw new RpcException({ statusCode: 409, message: 'Pasif ekibe vardiya atanamaz' });
    }

    const membersQuery = manager.getRepository(WorkforceUser).createQueryBuilder('person')
      .where('person.teamId = :teamId', { teamId: team.id })
      .andWhere('person.isActive = :isActive', { isActive: true })
      .orderBy('person.id', 'ASC');
    if (lock) membersQuery.setLock('pessimistic_write');
    const members = await membersQuery.getMany();
    if (members.length === 0) {
      throw new RpcException({ statusCode: 409, message: 'Ekibin aktif üyesi yok' });
    }

    // Planın kapsadığı zaman ± kural penceresi (7 gün): haftalık limit, 11 saat dinlenme ve
    // 7 günlük seri bu pencerenin dışına taşamaz (ShiftsService ile aynı pencere).
    const { start, end } = this.planBounds(request);
    const existing = await manager.getRepository(Shift).createQueryBuilder('shift')
      .where('shift.workforceUserId IN (:...ids)', { ids: members.map((member) => member.id) })
      .andWhere('shift.startAt < :windowEnd', { windowEnd: new Date(end + RULE_WINDOW_MS) })
      .andWhere('shift.endAt > :windowStart', { windowStart: new Date(start - RULE_WINDOW_MS) })
      .orderBy('shift.startAt', 'ASC')
      .addOrderBy('shift.id', 'ASC')
      .getMany();

    return { team, plan: buildRotationPlan(members, existing, request, DEFAULT_ROTATION_OPTIONS) };
  }

  /**
   * Planın zaman sınırlarını hesaplar: ilk gündeki en erken vardiya başlangıcı ve son gündeki en geç
   * vardiya bitişi (UTC ms). Gece yarısını geçen kalıplar (örn. 22:00–06:00) son günün ertesine taşabildiği için
   * bitiş, takvim gününün sonu değil gerçek vardiya bitişidir. Mevcut vardiya okuma penceresinin merkezidir.
   */
  private planBounds(request: RotationRequest): { start: number; end: number } {
    const dates = planDates(request.startDate, request.days);
    const options = DEFAULT_ROTATION_OPTIONS.workRules;
    const first = request.slots.map((slot) => resolveSlotInterval(dates[0], slot, options).startAt.getTime());
    const last = request.slots.map((slot) => resolveSlotInterval(dates.at(-1)!, slot, options).endAt.getTime());
    return { start: Math.min(...first), end: Math.max(...last) };
  }
}
