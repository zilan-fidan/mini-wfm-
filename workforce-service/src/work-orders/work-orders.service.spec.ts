import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderStatus } from './enums/work-order-status.enum';
import { WorkOrderStatusHistory } from './entities/work-order-status-history.entity';


describe('WorkOrdersService - Durum Geçişleri', () => {
  let service: WorkOrdersService;
  let mockWorkOrder: Partial<WorkOrder>;

  const mockQueryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  // Sürüm koşullu UPDATE zinciri: update().set().where().andWhere().execute()
  const mockUpdateBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockManager = {
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(mockQueryBuilder),
    }),
    createQueryBuilder: jest.fn().mockReturnValue(mockUpdateBuilder),
    findOneByOrFail: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(
      async (callback: (manager: any) => Promise<any>) => {
        return callback(mockManager);
      },
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockWorkOrder = {
      id: 1,
      status: WorkOrderStatus.OPEN,
      teamId: null,
      version: 1,
    };

    mockQueryBuilder.getOne.mockImplementation(
      async () => mockWorkOrder,
    );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          WorkOrdersService,
          {
            provide: getRepositoryToken(WorkOrder),
            useValue: {},
          },
          {
            provide: DataSource,
            useValue: mockDataSource,
          },
        ],
      }).compile();

    service = module.get<WorkOrdersService>(
      WorkOrdersService,
    );
  });

  // TEST 1
  it('OPEN -> COMPLETED geçişinde 409 dönmeli', async () => {
    await expect(
      service.changeWorkOrderStatus(
        1,
        WorkOrderStatus.COMPLETED,
        null,
        null,
        1,
        'ADMIN',
        1,
      ),
    ).rejects.toMatchObject({
      error: {
        statusCode: 409,
        message:
          'İş emri Açık durumundan Tamamlandı durumuna alınamaz',
      },
    });

    expect(mockManager.save).not.toHaveBeenCalled();
  });

  // TEST 2
  it('COMPLETED -> OPEN geçişinde 409 dönmeli', async () => {
    mockWorkOrder.status = WorkOrderStatus.COMPLETED;

    await expect(
      service.changeWorkOrderStatus(
        1,
        WorkOrderStatus.OPEN,
        null,
        null,
        1,
        'ADMIN',
        1,
      ),
    ).rejects.toMatchObject({
      error: {
        statusCode: 409,
      },
    });

    expect(mockManager.save).not.toHaveBeenCalled();
  });

  // TEST 3
  it('PLANNER, IN_PROGRESS -> CANCELLED yaparsa 403 dönmeli', async () => {
    mockWorkOrder.status = WorkOrderStatus.IN_PROGRESS;

    await expect(
      service.changeWorkOrderStatus(
        1,
        WorkOrderStatus.CANCELLED,
        null,
        'İş emrinin iptal edilmesi gerekiyor',
        2,
        'PLANNER',
        1,
      ),
    ).rejects.toMatchObject({
      error: {
        statusCode: 403,
      },
    });

    expect(mockManager.save).not.toHaveBeenCalled();
  });

  // TEST 4
  it('İptal nedeni belirtilmezse 400 dönmeli', async () => {
    await expect(
      service.changeWorkOrderStatus(
        1,
        WorkOrderStatus.CANCELLED,
        null,
        null,
        1,
        'ADMIN',
        1,
      ),
    ).rejects.toMatchObject({
      error: {
        statusCode: 400,
        message: 'İptal nedeni zorunludur',
      },
    });

    expect(mockManager.save).not.toHaveBeenCalled();
  });

  // TEST
  it('version güncel değilse 409 dönmeli ve hiçbir şey yazılmamalı', async () => {
    mockWorkOrder.version = 2; // başka biri bizden önce güncellemiş

    await expect(
      service.changeWorkOrderStatus(1, WorkOrderStatus.CANCELLED, null, 'iptal', 10, 'PLANNER', 1),
    ).rejects.toMatchObject({
      error: { statusCode: 409, message: 'Kayıt siz düzenlerken değişti, sayfayı yenileyin' },
    });

    expect(mockUpdateBuilder.execute).not.toHaveBeenCalled();
    expect(mockManager.save).not.toHaveBeenCalled();
  });

describe('WorkOrdersService - İzinli Durum Geçişleri', () => {
  let service: WorkOrdersService;

  const mockQueryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
  };

  const mockUpdateBuilder = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    execute: jest.fn(),
  };

  const mockManager = {
    getRepository: jest.fn(),
    createQueryBuilder: jest.fn(),
    findOneByOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    mockQueryBuilder.setLock.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();

    mockRepository.createQueryBuilder.mockReturnValue(
      mockQueryBuilder,
    );

    // Ekip aktif
    mockRepository.findOne.mockResolvedValue({
      id: 3,
      isActive: true,
    });

    // Ekipte bir aktif personel var
    mockRepository.count.mockResolvedValue(1);

    mockManager.getRepository.mockReturnValue(mockRepository);

    mockManager.create.mockImplementation(
      (_entity, data) => ({ ...data }),
    );

    mockManager.save.mockImplementation(
      async (_entity, data) => data,
    );

    // resetAllMocks implementasyonları da sildiği için zinciri yeniden kur
    mockUpdateBuilder.update.mockReturnThis();
    mockUpdateBuilder.set.mockReturnThis();
    mockUpdateBuilder.where.mockReturnThis();
    mockUpdateBuilder.andWhere.mockReturnThis();
    mockUpdateBuilder.execute.mockResolvedValue({ affected: 1 });
    mockManager.createQueryBuilder.mockReturnValue(mockUpdateBuilder);

    mockDataSource.transaction.mockImplementation(
      async (callback) => callback(mockManager),
    );

    const module = await Test.createTestingModule({
      providers: [
        WorkOrdersService,
        {
          provide: getRepositoryToken(WorkOrder),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get(WorkOrdersService);
  });

  const transitions = [
    {
      from: WorkOrderStatus.OPEN,
      to: WorkOrderStatus.ASSIGNED,
      teamId: 3,
      expectedTeamId: 3,
      role: 'PLANNER',
      reason: null,
    },
    {
      from: WorkOrderStatus.OPEN,
      to: WorkOrderStatus.CANCELLED,
      teamId: null,
      expectedTeamId: null,
      role: 'PLANNER',
      reason: 'İş emri iptal edildi',
    },
    {
      from: WorkOrderStatus.ASSIGNED,
      to: WorkOrderStatus.IN_PROGRESS,
      teamId: undefined,
      expectedTeamId: 3,
      role: 'PLANNER',
      reason: null,
    },
    {
      from: WorkOrderStatus.ASSIGNED,
      to: WorkOrderStatus.OPEN,
      teamId: undefined,
      expectedTeamId: null,
      role: 'PLANNER',
      reason: null,
    },
    {
      from: WorkOrderStatus.ASSIGNED,
      to: WorkOrderStatus.CANCELLED,
      teamId: undefined,
      expectedTeamId: 3,
      role: 'PLANNER',
      reason: 'Atanan iş iptal edildi',
    },
    {
      from: WorkOrderStatus.IN_PROGRESS,
      to: WorkOrderStatus.COMPLETED,
      teamId: undefined,
      expectedTeamId: 3,
      role: 'PLANNER',
      reason: null,
    },
    {
      from: WorkOrderStatus.IN_PROGRESS,
      to: WorkOrderStatus.CANCELLED,
      teamId: undefined,
      expectedTeamId: 3,
      role: 'ADMIN',
      reason: 'Çalışma durduruldu',
    },
  ];

  it.each(transitions)(
    '$from -> $to geçişinde durum ve geçmiş kaydedilmeli',
    async ({
      from,
      to,
      teamId,
      expectedTeamId,
      role,
      reason,
    }) => {
      // Mevcut iş emrini taklit et
      const workOrder = {
        id: 1,
        status: from,
        teamId:
          from === WorkOrderStatus.OPEN ? null : 3,
        version: 1,
      } as WorkOrder;

      mockQueryBuilder.getOne.mockResolvedValue(workOrder);

      // UPDATE sonrası DB'den okunan kayıt: sürüm bir artmış
      mockManager.findOneByOrFail.mockImplementation(async () => ({ ...workOrder, version: 2 }));

      // Durum değiştirme metodunu çalıştır
      const result = await service.changeWorkOrderStatus(
        1,
        to,
        teamId,
        reason,
        10,
        role,
        1,
      );

      // İş emrinin durumu değişmiş olmalı
      expect(result.status).toBe(to);

      // Ekip bilgisi doğru olmalı
      expect(result.teamId).toBe(expectedTeamId);

      // İş emri sürüm koşullu UPDATE ile yazılmalı
      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({ status: to, teamId: expectedTeamId });
      expect(mockUpdateBuilder.andWhere).toHaveBeenCalledWith('version = :expectedVersion', { expectedVersion: 1 });

      // Yanıt artmış sürümü içermeli
      expect(result.version).toBe(2);

      // save yalnızca history için çağrılmalı
      expect(mockManager.save).toHaveBeenCalledTimes(1);

      // History kaydedilmiş olmalı
      expect(mockManager.save).toHaveBeenNthCalledWith(
        1,
        WorkOrderStatusHistory,
        expect.objectContaining({
          workOrderId: 1,
          fromStatus: from,
          toStatus: to,
          teamId: expectedTeamId,
          reason,
          changedById: 10,
        }),
      );

      // İşlemler transaction içerisinde yürütülmeli
      expect(
        mockDataSource.transaction,
      ).toHaveBeenCalledTimes(1);
    },
  );
});

});
