import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderPriority } from './enums/work-order-priority.enum';
import { WorkOrderStatus } from './enums/work-order-status.enum';
import { workOrderNotFound } from './constants/work-order-errors';
import { Team } from '../teams/entities/team.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { ExcludedTeam, TEAM_WORKLOAD_STATUSES, TeamSuggestion, scoreTeams } from './calc/team-score';

export type TeamSuggestionsResponse = {
  workOrderId: number;
  priority: WorkOrderPriority;
  window: { from: Date; to: Date };
  suggestions: TeamSuggestion[];
  excluded: ExcludedTeam[];
};

@Injectable()
export class TeamSuggestionsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * OPEN iş emri için en uygun 3 ekibi önerir.
   * Sorgular: (1) iş emri → (2) aktif ekipler + aktif üyeleri (tek join) →
   * (3) bu üyelerin [now, dueAt) ile kesişen vardiyaları → (4) ekiplere atanmış ASSIGNED/IN_PROGRESS iş emirleri.
   */
  async suggestTeams(workOrderId: number, now: Date = new Date()): Promise<TeamSuggestionsResponse> {
    const workOrder = await this.dataSource.getRepository(WorkOrder).findOne({
      where: { id: workOrderId },
      select: { id: true, status: true, priority: true, dueAt: true },
    });
    if (!workOrder) throw workOrderNotFound();
    if (workOrder.status !== WorkOrderStatus.OPEN) {
      throw new RpcException({ statusCode: 409, message: 'Ekip önerisi yalnızca OPEN durumdaki iş emri için yapılabilir' });
    }

    //  Üyesi olmayan aktif ekip de gelmeli (leftJoin) ki "kapasite yok" olarak listelensin.
    const teams = await this.dataSource.getRepository(Team).createQueryBuilder('team')
      .leftJoin('team.members', 'member', 'member.isActive = :active', { active: true })
      .select(['team.id', 'team.name', 'team.isActive', 'member.id', 'member.teamId', 'member.isActive'])
      .where('team.isActive = :active', { active: true })
      .getMany();
    const members = teams.flatMap((team) => team.members);

    // Süzme veritabanında: yalnızca aktif ekipteki aktif personelin aralıkla kesişen vardiyaları, 3 kolon.
    const hasWindow = workOrder.dueAt.getTime() > now.getTime();
    const shifts = hasWindow && members.length > 0
      ? await this.dataSource.getRepository(Shift).createQueryBuilder('shift')
        .innerJoin('shift.workforceUser', 'person', 'person.isActive = :active', { active: true })
        .innerJoin('person.team', 'team', 'team.isActive = :active', { active: true })
        .select(['shift.id', 'shift.workforceUserId', 'shift.startAt', 'shift.endAt'])
        .where('shift.startAt < :dueAt', { dueAt: workOrder.dueAt })
        .andWhere('shift.endAt > :now', { now })
        .getMany()
      : [];

    const openWorkOrders = await this.dataSource.getRepository(WorkOrder).find({
      where: { status: In([...TEAM_WORKLOAD_STATUSES]), teamId: Not(IsNull()) },
      select: { id: true, teamId: true, status: true, dueAt: true },
    });

    const result = scoreTeams(workOrder, teams, members, shifts, openWorkOrders, now);
    return {
      workOrderId: workOrder.id,
      priority: workOrder.priority,
      window: { from: result.window.startAt, to: result.window.endAt },
      suggestions: result.suggestions,
      excluded: result.excluded,
    };
  }
}
