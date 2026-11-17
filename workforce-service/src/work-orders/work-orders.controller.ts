import { Controller, HttpStatus } from '@nestjs/common';
import {MessagePattern,RpcException,} from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrderPriority } from './enums/work-order-priority.enum';
import { Team } from '../teams/entities/team.entity';
import { CorrelationContextService } from '../common/correlation/correlation-context.service';
import { WorkOrderStatus } from './enums/work-order-status.enum';
import {WORK_ORDER_TRANSITIONS,WORK_ORDER_STATUS_LABELS,} from './constants/work-order-transitions';
import { Payload } from '@nestjs/microservices';


type CreateWorkOrderPayload = {
  title: string;
  description?: string | null;
  priority?: WorkOrderPriority;
  teamId?: number | null;
  dueAt: string;
};
type UpdateWorkOrderPayload = {
  id: number;
  data: {
    title?: string;
    description?: string | null;
    priority?: WorkOrderPriority;
    dueAt?: string;
    status?: unknown;
    teamId?: unknown;
  };
};

@Controller()
export class WorkOrdersController {
  constructor(
    private readonly workOrdersService: WorkOrdersService,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    private readonly correlationContext: CorrelationContextService,
  ) {}

  @MessagePattern('createWorkOrder')
  async createWorkOrder(payload: CreateWorkOrderPayload) {
    // 1. Başlık doğrulaması
    if (
      typeof payload.title !== 'string' ||
      !payload.title.trim() ||
      payload.title.length > 200
    ) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'İş emri başlığı 1 ile 200 karakter arasında olmalıdır',
      });
    }

    // 2. Bitiş tarihi doğrulaması
    const dueAt = new Date(payload.dueAt);

    if (!Number.isFinite(dueAt.getTime())) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Geçersiz bitiş tarihi',
      });
    }

    if (dueAt.getTime() < Date.now()) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'İş emrinin bitiş tarihi geçmişte olamaz',
      });
    }

    // 3. Öncelik doğrulaması
    const priority = payload.priority ?? WorkOrderPriority.MEDIUM;

    if (!Object.values(WorkOrderPriority).includes(priority)) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Geçersiz iş emri önceliği',
      });
    }

    // 4. Açıklama doğrulaması
    if (
      payload.description !== undefined &&
      payload.description !== null &&
      typeof payload.description !== 'string'
    ) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Açıklama metin olmalıdır',
      });
    }

    // 5. Ekip kontrolü
    const teamId = payload.teamId ?? null;

    if (teamId !== null) {
      if (!Number.isInteger(teamId) || teamId <= 0) {
        throw new RpcException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Geçersiz ekip ID değeri',
        });
      }

      const team = await this.teamRepository.findOne({
        where: { id: teamId },
      });

      if (!team) {
        throw new RpcException({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Ekip bulunamadı',
        });
      }
    }

    // 6. Actor bilgisi
    const actor = this.correlationContext.getActor();

    if (!actor) {
      throw new RpcException({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'İşlemi gerçekleştiren hesap doğrulanamadı',
      });
    }

    // 7. İş emrini oluştur
    return this.workOrdersService.createWorkOrder({
      title: payload.title.trim(),
      description: payload.description ?? null,
      priority,
      status: WorkOrderStatus.OPEN,
      teamId,
      dueAt,
      createdById: actor.id,
      version: 1,
    });
  }

@MessagePattern('findOneWorkOrder')
async findOneWorkOrder(id: number) {
  // 1. ID değerini doğrula
  if (!Number.isInteger(id) || id <= 0) {
    throw new RpcException({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Geçerli bir iş emri ID değeri girilmelidir',
    });
  }

  // 2. Veritabanından iş emrini getir
  const workOrder =
    await this.workOrdersService.findOneWorkOrder(id);

  // 3. İş emri bulunamadıysa 404 döndür
  if (!workOrder) {
    throw new RpcException({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'İş emri bulunamadı',
    });
  }

  // 4. Bulunan iş emrini döndür
  return workOrder;
}

@MessagePattern('updateWorkOrder')
async updateWorkOrder(payload: UpdateWorkOrderPayload) {
  const { id, data } = payload;

  // 1. ID doğrulaması
  if (!Number.isInteger(id) || id <= 0) {
    throw new RpcException({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Geçerli bir iş emri ID değeri girilmelidir',
    });
  }

  // 2. İş emrini veritabanından bul
  const workOrder =
    await this.workOrdersService.findOneWorkOrder(id);

  if (!workOrder) {
    throw new RpcException({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'İş emri bulunamadı',
    });
  }

  // 3. Kapanmış iş emirleri güncellenemez
  if (
    workOrder.status === WorkOrderStatus.COMPLETED ||
    workOrder.status === WorkOrderStatus.CANCELLED
  ) {
    throw new RpcException({
      statusCode: HttpStatus.CONFLICT,
      message: 'Tamamlanmış veya iptal edilmiş iş emri güncellenemez',
    });
  }

  // 4. Yalnızca izin verilen alanları topla
  const updateData: {
    title?: string;
    description?: string | null;
    priority?: WorkOrderPriority;
    dueAt?: Date;
  } = {};

  // 5. Başlık kontrolü
  if (data.title !== undefined) {
    if (
      typeof data.title !== 'string' ||
      !data.title.trim() ||
      data.title.length > 200
    ) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'İş emri başlığı 1 ile 200 karakter arasında olmalıdır',
      });
    }

    updateData.title = data.title.trim();
  }

  // 6. Açıklama kontrolü
  if (data.description !== undefined) {
    if (
      data.description !== null &&
      typeof data.description !== 'string'
    ) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Açıklama metin olmalıdır',
      });
    }

    updateData.description = data.description;
  }

  // 7. Öncelik kontrolü
  if (data.priority !== undefined) {
    if (
      !Object.values(WorkOrderPriority).includes(data.priority)
    ) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Geçersiz iş emri önceliği',
      });
    }

    updateData.priority = data.priority;
  }

  // 8. Bitiş tarihi kontrolü
  if (data.dueAt !== undefined) {
    const dueAt = new Date(data.dueAt);

    if (!Number.isFinite(dueAt.getTime())) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Geçersiz bitiş tarihi',
      });
    }

    if (dueAt.getTime() < Date.now()) {
      throw new RpcException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'İş emrinin bitiş tarihi geçmişte olamaz',
      });
    }

    updateData.dueAt = dueAt;
  }

  // 9. Güncelleme işlemi
  return this.workOrdersService.updateWorkOrder(
    workOrder,
    updateData,
  );
}
  
@MessagePattern('changeWorkOrderStatus')
async changeWorkOrderStatus(payload: {
  id: number;
  status: WorkOrderStatus;
  teamId?: number | null;
  reason?: string | null;
}) {
  const { id, status, teamId, reason } = payload;

  // 1. ID kontrolü
  if (!Number.isInteger(id) || id <= 0) {
    throw new RpcException({
      statusCode: 400,
      message: 'Geçersiz iş emri ID',
    });
  }

  // 2. Yeni durum geçerli mi?
  if (!Object.values(WorkOrderStatus).includes(status)) {
    throw new RpcException({
      statusCode: 400,
      message: 'Geçersiz iş emri durumu',
    });
  }

  // 3. İş emrini getir
  const workOrder =
    await this.workOrdersService.findOneWorkOrder(id);

  if (!workOrder) {
    throw new RpcException({
      statusCode: 404,
      message: 'İş emri bulunamadı',
    });
  }

  // 4. B19: İzin verilen geçişleri kontrol et
  const allowedStatuses =
    WORK_ORDER_TRANSITIONS[workOrder.status];

  if (!allowedStatuses.includes(status)) {
    throw new RpcException({
      statusCode: 409,
      message:
        `İş emri ${WORK_ORDER_STATUS_LABELS[workOrder.status]} ` +
        `durumundan ${WORK_ORDER_STATUS_LABELS[status]} ` +
        `durumuna alınamaz`,
    });
  }

  // 5. Reason kontrolü
  if (reason !== undefined && reason !== null) {
    if (typeof reason !== 'string' || reason.length > 500) {
      throw new RpcException({
        statusCode: 400,
        message: 'Reason en fazla 500 karakter olabilir',
      });
    }
  }

  // 6. İşlemi yapan kullanıcıyı al
  const actor = this.correlationContext.getActor();

  if (!actor) {
    throw new RpcException({
      statusCode: 401,
      message: 'Kullanıcı bilgisi bulunamadı',
    });
  }

return this.workOrdersService.changeWorkOrderStatus(
  id,
  status,
  teamId,
  reason,
  actor.id,
  actor.role,
);
}

@MessagePattern('findWorkOrderHistory')
async findWorkOrderHistory(@Payload() id: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new RpcException({
      statusCode: 400,
      message: 'Geçersiz iş emri ID',
    });
  }

  const workOrder =
    await this.workOrdersService.findOneWorkOrder(id);

  if (!workOrder) {
    throw new RpcException({
      statusCode: 404,
      message: 'İş emri bulunamadı',
    });
  }

  return this.workOrdersService.findWorkOrderHistory(id);
}

}
