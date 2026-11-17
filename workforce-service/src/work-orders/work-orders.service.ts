import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WorkOrder } from './entities/work-order.entity';
import { DataSource, In, Repository } from 'typeorm';
import { WorkOrderStatusHistory } from './entities/work-order-status-history.entity';
import { WorkOrderStatus } from './enums/work-order-status.enum';
import { RpcException } from '@nestjs/microservices';
import {WORK_ORDER_TRANSITIONS,WORK_ORDER_STATUS_LABELS,} from './constants/work-order-transitions';
import { Team } from '../teams/entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';



@Injectable()
export class WorkOrdersService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    private readonly dataSource: DataSource,
  ) {}

  // 1. Yeni iş emri oluşturma
  
async createWorkOrder(
  data: Partial<WorkOrder>,
): Promise<WorkOrder> {
  return this.dataSource.transaction(async (manager) => {

    // 1. Yeni iş emrini oluştur
    const workOrder = manager.create(WorkOrder, {
      ...data,
      status: WorkOrderStatus.OPEN,
      version: 1,
    });

    // 2. İş emrini veritabanına kaydet
    const savedWorkOrder = await manager.save(
      WorkOrder,
      workOrder,
    );

    // 3. İlk geçmiş kaydını oluştur
    const history = manager.create(
      WorkOrderStatusHistory,
      {
        workOrderId: savedWorkOrder.id,
        fromStatus: null,
        toStatus: WorkOrderStatus.OPEN,
        teamId: savedWorkOrder.teamId ?? null,
        reason: null,
        changedById: savedWorkOrder.createdById,
      },
    );

    // 4. İlk geçmiş kaydını kaydet
    await manager.save(WorkOrderStatusHistory, history);

    // 5. Oluşturulan iş emrini döndür
    return savedWorkOrder;
  });
}

  // 2. ID ile iş emri bulma
  async findOneWorkOrder(id: number, ): Promise<WorkOrder | null> {
    return this.workOrderRepository.findOne({ where: { id },});
  }

  // 3. İş emri güncelleme
  async updateWorkOrder(workOrder: WorkOrder, data: Partial<WorkOrder>,): Promise<WorkOrder> {
    const updatedWorkOrder = this.workOrderRepository.merge(workOrder, data,);
    return this.workOrderRepository.save(updatedWorkOrder);
  }

 async hasOpenWorkOrdersForTeam(teamId: number,): Promise<boolean> {
  return this.workOrderRepository.exists({
    where: {
      teamId,
      status: In([
        WorkOrderStatus.OPEN,
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.IN_PROGRESS,
      ]),
    },
  });
  
}

 
async changeWorkOrderStatus(
  workOrderId: number,
  toStatus: WorkOrderStatus,
  teamId: number | null | undefined,
  reason: string | null | undefined,
  changedById: number,
  actorRole: string,
): Promise<WorkOrder> {
  return this.dataSource.transaction(async (manager) => {
    // 1. İş emrini kilitleyerek getir
    const workOrder = await manager
      .getRepository(WorkOrder)
      .createQueryBuilder('wo')
      .setLock('pessimistic_write')
      .where('wo.id = :id', { id: workOrderId })
      .getOne();

    if (!workOrder) {
      throw new RpcException({
        statusCode: 404,
        message: 'İş emri bulunamadı',
      });
    }

    const fromStatus = workOrder.status;

    // 2. B19: Geçiş tablosunu kontrol et
    const allowed = WORK_ORDER_TRANSITIONS[fromStatus];

    if (!allowed.includes(toStatus)) {
      throw new RpcException({
        statusCode: 409,
        message:
          `İş emri ${WORK_ORDER_STATUS_LABELS[fromStatus]} ` +
          `durumundan ${WORK_ORDER_STATUS_LABELS[toStatus]} ` +
          `durumuna alınamaz`,
      });
    }

    // 3. Reason kontrolü
    if (
      reason != null &&
      (typeof reason !== 'string' || reason.length > 500)
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'Reason en fazla 500 karakter olabilir',
      });
    }

    const normalizedReason = reason?.trim() || null;

    // 4. CANCELLED için reason zorunlu
    if (
      toStatus === WorkOrderStatus.CANCELLED &&
      !normalizedReason
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'İptal nedeni zorunludur',
      });
    }

    // 5. IN_PROGRESS -> CANCELLED yalnızca ADMIN
    if (
      fromStatus === WorkOrderStatus.IN_PROGRESS &&
      toStatus === WorkOrderStatus.CANCELLED &&
      actorRole !== 'ADMIN'
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'Bu iş emrini yalnızca ADMIN iptal edebilir',
      });
    }

    // 6. OPEN -> ASSIGNED
    if (
      fromStatus === WorkOrderStatus.OPEN &&
      toStatus === WorkOrderStatus.ASSIGNED
    ) {
      if (!Number.isInteger(teamId) || (teamId ?? 0) <= 0) {
        throw new RpcException({
          statusCode: 400,
          message: 'Atama için geçerli bir teamId zorunludur',
        });
      }

      const assignedTeamId = teamId as number;
      const team = await manager.getRepository(Team).findOne({
        where: { id: assignedTeamId },
      });

      if (!team) {
        throw new RpcException({
          statusCode: 404,
          message: 'Ekip bulunamadı',
        });
      }

      if (!team.isActive) {
        throw new RpcException({
          statusCode: 409,
          message: 'Pasif ekibe iş emri atanamaz',
        });
      }

      const activeMemberCount = await manager
        .getRepository(WorkforceUser)
        .count({
          where: {
            teamId: assignedTeamId,
            isActive: true,
          },
        });

      if (activeMemberCount === 0) {
        throw new RpcException({
          statusCode: 409,
          message: 'Aktif üyesi olmayan ekibe iş emri atanamaz',
        });
      }

      workOrder.teamId = assignedTeamId;
    }

    // 7. ASSIGNED -> OPEN: atamayı geri al
    if (
      fromStatus === WorkOrderStatus.ASSIGNED &&
      toStatus === WorkOrderStatus.OPEN
    ) {
      workOrder.teamId = null;
    }

    // 8. İş emrinin durumunu değiştir
    workOrder.status = toStatus;

    await manager.save(WorkOrder, workOrder);

    // 9. Aynı transaction içinde geçmiş kaydı oluştur
    const history = manager.create(WorkOrderStatusHistory, {
      workOrderId: workOrder.id,
      fromStatus,
      toStatus,
      teamId: workOrder.teamId,
      reason: normalizedReason,
      changedById,
    });

    await manager.save(WorkOrderStatusHistory, history);

    return workOrder;
  });
}

async findWorkOrderHistory(workOrderId: number) {
  return this.dataSource
    .getRepository(WorkOrderStatusHistory)
    .createQueryBuilder('history')
    .innerJoin('history.changedBy', 'account')
    .select([
      'history.id AS id',
      'history.workOrderId AS "workOrderId"',
      'history.fromStatus AS "fromStatus"',
      'history.toStatus AS "toStatus"',
      'history.teamId AS "teamId"',
      'history.reason AS reason',
      'history.changedById AS "changedById"',
      'account.username AS "changedByUsername"',
      'history.changedAt AS "changedAt"',
    ])
    .where('history.workOrderId = :workOrderId', {
      workOrderId,
    })
    .orderBy('history.changedAt', 'ASC')
    .addOrderBy('history.id', 'ASC')
    .getRawMany();
}


}
