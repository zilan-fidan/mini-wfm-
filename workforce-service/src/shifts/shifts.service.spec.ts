
import { Repository, SelectQueryBuilder } from 'typeorm';

import { ShiftsService } from './shifts.service';
import { Shift } from './entities/shift.entity';

describe('ShiftsService - findOverlappingShift', () => {
  let service: ShiftsService;

  let repository: jest.Mocked<
    Pick<Repository<Shift>, 'createQueryBuilder'>
  >;

  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getOne: jest.Mock;
  };

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<Shift>,
      ),
    };

    service = new ShiftsService(
      repository as unknown as Repository<Shift>,
    );
  });

  const startAt = new Date('2099-01-01T08:00:00Z');
  const endAt = new Date('2099-01-01T16:00:00Z');

  it('Çakışan vardiya varsa onu döndürmeli', async () => {
    const overlappingShift = {
      id: 5,
      workforceUserId: 1,
      startAt: new Date('2099-01-01T12:00:00Z'),
      endAt: new Date('2099-01-01T20:00:00Z'),
    } as Shift;

    queryBuilder.getOne.mockResolvedValue(overlappingShift);

    const result = await service.findOverlappingShift(
      1,
      startAt,
      endAt,
    );

    expect(result).toEqual(overlappingShift);
  });

  it('Çakışan vardiya yoksa null dönmeli', async () => {
    queryBuilder.getOne.mockResolvedValue(null);

    const result = await service.findOverlappingShift(
      1,
      startAt,
      endAt,
    );

    expect(result).toBeNull();
  });

  it('Güncellemede vardiyanın kendisini hariç tutmalı', async () => {
    queryBuilder.getOne.mockResolvedValue(null);

    await service.findOverlappingShift(
      1,
      startAt,
      endAt,
      5,
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'shift.id != :excludeShiftId',
      { excludeShiftId: 5 },
    );
  });

  it('Oluşturmada ID hariç tutma filtresi eklememeli', async () => {
    queryBuilder.getOne.mockResolvedValue(null);

    await service.findOverlappingShift(
      1,
      startAt,
      endAt,
    );

    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'shift.id != :excludeShiftId',
      expect.anything(),
    );
  });

  it('Aynı personel için arama yapmalı', async () => {
    queryBuilder.getOne.mockResolvedValue(null);

    await service.findOverlappingShift(
      3,
      startAt,
      endAt,
    );

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'shift.workforceUserId = :workforceUserId',
      { workforceUserId: 3 },
    );
  });

  it('Doğru zaman karşılaştırmalarını kullanmalı', async () => {
    queryBuilder.getOne.mockResolvedValue(null);

    await service.findOverlappingShift(
      1,
      startAt,
      endAt,
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'shift.startAt < :endAt',
      { endAt },
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'shift.endAt > :startAt',
      { startAt },
    );
  });
});
