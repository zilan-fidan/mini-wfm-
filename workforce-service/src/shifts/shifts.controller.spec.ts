
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';

import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { Shift } from './entities/shift.entity';

import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';
import { CorrelationContextService } from '../common/correlation/correlation-context.service';

describe('ShiftsController', () => {
  let controller: ShiftsController;

  const shiftsService = {
    createShift: jest.fn(),
    findOneShift: jest.fn(),
    updateShift: jest.fn(),
    removeShift: jest.fn(),
    findOverlappingShift: jest.fn(),
  };

  const workforceUserRepository = {
    findOne: jest.fn(),
  };

  const correlationContext = {
    getActor: jest.fn(),
  };

  const startAt = '2099-01-01T08:00:00Z';
  const endAt = '2099-01-01T16:00:00Z';

  const createPayload = {
    workforceUserId: 1,
    startAt,
    endAt,
    note: 'Sabah vardiyası',
  };

  const activeUser = {
    id: 1,
    isActive: true,
  } as WorkforceUser;

  const existingShift = {
    id: 5,
    workforceUserId: 1,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    note: 'Sabah vardiyası',
    createdById: 10,
  } as Shift;

  beforeEach(() => {
    jest.resetAllMocks();

    workforceUserRepository.findOne.mockResolvedValue(activeUser);
    shiftsService.findOneShift.mockResolvedValue(existingShift);
    shiftsService.findOverlappingShift.mockResolvedValue(null);
    shiftsService.createShift.mockResolvedValue(existingShift);
    shiftsService.updateShift.mockResolvedValue(existingShift);
    shiftsService.removeShift.mockResolvedValue(undefined);

    correlationContext.getActor.mockReturnValue({
      id: 10,
      username: 'admin',
      role: 'ADMIN',
    });

    controller = new ShiftsController(
      shiftsService as unknown as ShiftsService,
      workforceUserRepository as unknown as Repository<WorkforceUser>,
      correlationContext as unknown as CorrelationContextService,
    );
  });

  describe('createShift', () => {
    it('Personel bulunamazsa 404 vermeli', async () => {
      workforceUserRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.createShift(createPayload),
      ).rejects.toMatchObject({
        error: {
          statusCode: 404,
          message: 'Personel bulunamadı',
        },
      });

      expect(shiftsService.createShift).not.toHaveBeenCalled();
    });

    it('Personel pasifse 409 vermeli', async () => {
      workforceUserRepository.findOne.mockResolvedValue({
        id: 1,
        isActive: false,
      });

      await expect(
        controller.createShift(createPayload),
      ).rejects.toMatchObject({
        error: {
          statusCode: 409,
          message: 'Pasif personele vardiya atanamaz',
        },
      });
    });

    it('Çakışan vardiya varsa 409 vermeli', async () => {
      shiftsService.findOverlappingShift.mockResolvedValue(existingShift);

      await expect(
        controller.createShift(createPayload),
      ).rejects.toMatchObject({
        error: {
          statusCode: 409,
          message: expect.stringContaining(
            'Vardiya çakışması',
          ),
        },
      });

      expect(shiftsService.createShift).not.toHaveBeenCalled();
    });

    it('createdById değerini actor bilgisinden almalı', async () => {
      await controller.createShift(createPayload);

      expect(shiftsService.createShift).toHaveBeenCalledWith({
        workforceUserId: 1,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        note: 'Sabah vardiyası',
        createdById: 10,
      });
    });

    it('Actor bulunamazsa 401 vermeli', async () => {
      correlationContext.getActor.mockReturnValue(undefined);

      await expect(
        controller.createShift(createPayload),
      ).rejects.toMatchObject({
        error: {
          statusCode: 401,
          message: 'İşlemi gerçekleştiren hesap doğrulanamadı',
        },
      });
    });
  });

  describe('findOneShift', () => {
    it('Vardiya bulunamazsa 404 vermeli', async () => {
      shiftsService.findOneShift.mockResolvedValue(null);

      await expect(
        controller.findOneShift(5),
      ).rejects.toMatchObject({
        error: {
          statusCode: 404,
          message: 'Vardiya bulunamadı',
        },
      });
    });
  });

  describe('updateShift', () => {
    it('Geçmişte başlamış vardiyayı güncellememeli', async () => {
      shiftsService.findOneShift.mockResolvedValue({
        ...existingShift,
        startAt: new Date('2020-01-01T08:00:00Z'),
        endAt: new Date('2020-01-01T16:00:00Z'),
      });

      await expect(
        controller.updateShift({
          id: 5,
          data: { note: 'Güncellendi' },
        }),
      ).rejects.toMatchObject({
        error: {
          statusCode: 409,
          message: 'Geçmişteki vardiya güncellenemez',
        },
      });
    });

    it('Güncellemede kendi vardiyasını çakışma dışında tutmalı', async () => {
      await controller.updateShift({
        id: 5,
        data: { note: 'Güncellendi' },
      });

      expect(shiftsService.findOverlappingShift).toHaveBeenCalledWith(
        1,
        new Date(startAt),
        new Date(endAt),
        5,
      );

      expect(shiftsService.updateShift).toHaveBeenCalled();
    });
  });

  describe('removeShift', () => {
    it('Geçmişte başlamış vardiyayı silmemeli', async () => {
      shiftsService.findOneShift.mockResolvedValue({
        ...existingShift,
        startAt: new Date('2020-01-01T08:00:00Z'),
      });

      await expect(
        controller.removeShift(5),
      ).rejects.toMatchObject({
        error: {
          statusCode: 409,
          message: 'Geçmişte başlamış vardiya silinemez',
        },
      });

      expect(shiftsService.removeShift).not.toHaveBeenCalled();
    });

    it('Gelecekteki vardiyayı silebilmeli', async () => {
      await controller.removeShift(5);

      expect(shiftsService.removeShift).toHaveBeenCalledWith(
        existingShift,
      );
    });
  });
});
