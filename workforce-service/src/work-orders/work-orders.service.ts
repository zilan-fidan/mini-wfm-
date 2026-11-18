import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkOrder } from './entities/work-order.entity';
import { In } from 'typeorm';
import { WorkOrderStatus } from './enums/work-order-status.enum';

@Injectable()
export class WorkOrdersService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
  ) {}

  // 1. Yeni iş emri oluşturma
  async createWorkOrder(data: Partial<WorkOrder>,): Promise<WorkOrder> {
    const workOrder = this.workOrderRepository.create(data);
    return this.workOrderRepository.save(workOrder);
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

}
