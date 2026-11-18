
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';

import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrder } from './entities/work-order.entity';

import { WorkOrderPriority } from './enums/work-order-priority.enum';
import { WorkOrderStatus } from './enums/work-order-status.enum';

import { Team } from '../teams/entities/team.entity';
import { CorrelationContextService } from '../common/correlation/correlation-context.service';

describe('WorkOrdersController', () => {
  let controller: WorkOrdersController;

  const workOrdersService = {
    createWorkOrder: jest.fn(),
    findOneWorkOrder: jest.fn(),
    updateWorkOrder: jest.fn(),
  };

  const teamRepository = {
    findOne: jest.fn(),
  };

  const correlationContext = {
    getActor: jest.fn(),
  };

  const makeWorkOrder = (
    overrides: Partial<WorkOrder> = {},
  ): WorkOrder =>
    ({
      id: 1,
      code: 'IE-2099-00001',
      title: 'Trafo kontrolü',
      description: null,
      priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.OPEN,
      teamId: null,
      dueAt: new Date('2099-01-20T15:00:00Z'),
      version: 1,
      createdById: 10,
      ...overrides,
    }) as WorkOrder;

  beforeEach(() => {
    jest.resetAllMocks();

    workOrdersService.findOneWorkOrder.mockResolvedValue(
      makeWorkOrder(),
    );

    workOrdersService.updateWorkOrder.mockImplementation(
      async (
        workOrder: WorkOrder,
        data: Partial<WorkOrder>,
      ) => ({
        ...workOrder,
        ...data,
      }),
    );

    correlationContext.getActor.mockReturnValue({
      id: 10,
      username: 'admin',
      role: 'ADMIN',
    });

    controller = new WorkOrdersController(
      workOrdersService as unknown as WorkOrdersService,
      teamRepository as unknown as Repository<Team>,
      correlationContext as unknown as CorrelationContextService,
    );
  });

  describe('updateWorkOrder', () => {
    it('COMPLETED iş emri güncellenememeli', async () => {
      workOrdersService.findOneWorkOrder.mockResolvedValue(
        makeWorkOrder({
          status: WorkOrderStatus.COMPLETED,
        }),
      );

      await expect(
        controller.updateWorkOrder({
          id: 1,
          data: { title: 'Yeni başlık' },
        }),
      ).rejects.toMatchObject({
        error: {
          statusCode: 409,
        },
      });

      expect(
        workOrdersService.updateWorkOrder,
      ).not.toHaveBeenCalled();
    });

    it('CANCELLED iş emri güncellenememeli', async () => {
      workOrdersService.findOneWorkOrder.mockResolvedValue(
        makeWorkOrder({
          status: WorkOrderStatus.CANCELLED,
        }),
      );

      await expect(
        controller.updateWorkOrder({
          id: 1,
          data: { title: 'Yeni başlık' },
        }),
      ).rejects.toMatchObject({
        error: {
          statusCode: 409,
        },
      });
    });

    it('Geçmiş dueAt değeri 400 vermeli', async () => {
      await expect(
        controller.updateWorkOrder({
          id: 1,
          data: {
            dueAt: '2020-01-01T08:00:00Z',
          },
        }),
      ).rejects.toMatchObject({
        error: {
          statusCode: 400,
        },
      });
    });

    it('status ve teamId alanlarını yok saymalı', async () => {
      const result = await controller.updateWorkOrder({
        id: 1,
        data: {
          title: 'Güncellenmiş trafo kontrolü',
          status: WorkOrderStatus.COMPLETED,
          teamId: 5,
        },
      });

      expect(
        workOrdersService.updateWorkOrder,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
        }),
        {
          title: 'Güncellenmiş trafo kontrolü',
        },
      );

      expect(result.status).toBe(WorkOrderStatus.OPEN);
      expect(result.teamId).toBeNull();
    });

    it('Geçerli iş emrini güncelleyebilmeli', async () => {
      const result = await controller.updateWorkOrder({
        id: 1,
        data: {
          title: 'Trafo bakımı',
          priority: WorkOrderPriority.HIGH,
        },
      });

      expect(result.title).toBe('Trafo bakımı');
      expect(result.priority).toBe(WorkOrderPriority.HIGH);

      expect(
        workOrdersService.updateWorkOrder,
      ).toHaveBeenCalledTimes(1);
    });

    it('İş emri bulunamazsa 404 vermeli', async () => {
      workOrdersService.findOneWorkOrder.mockResolvedValue(
        null,
      );

      await expect(
        controller.updateWorkOrder({
          id: 99,
          data: { title: 'Yeni başlık' },
        }),
      ).rejects.toMatchObject({
        error: {
          statusCode: 404,
          message: 'İş emri bulunamadı',
        },
      });
    });
  });
});


