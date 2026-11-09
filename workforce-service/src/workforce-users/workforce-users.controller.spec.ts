import { HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkforceUsersController } from './workforce-users.controller';
import { WorkforceUsersService } from './workforce-users.service';
import { WorkforceUser } from './entities/workforce-user.entity';
import { Team } from '../teams/entities/team.entity';

const team = {
  id: 1,
  name: 'Destek',
  description: 'Müşteri destek ekibi',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} as Team;

const makeUser = (overrides: Partial<WorkforceUser> = {}): WorkforceUser =>
  ({
    id: 10,
    firstname: 'Zilan',
    lastname: 'Fidan',
    registrationNumber: 'S-001',
    phone: null,
    isActive: true,
    teamId: null,
    team: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }) as WorkforceUser;

describe('WorkforceUsersController', () => {
  let controller: WorkforceUsersController;
  let service: jest.Mocked<Pick<WorkforceUsersService, 'findAll' | 'findOne'>>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkforceUsersController],
      providers: [{ provide: WorkforceUsersService, useValue: service }],
    }).compile();

    controller = module.get<WorkforceUsersController>(WorkforceUsersController);
  });

  describe('personel listesi (findAllWorkforceUsers)', () => {
    it('her kayıtta ekip { id, name } ya da null olarak döner', async () => {
      service.findAll.mockResolvedValue({
        data: [makeUser({ id: 10, teamId: 1, team }), makeUser({ id: 11 })],
        total: 2,
        page: 1,
        limit: 10,
      });

      const result = await controller.findAll({ page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.data[0].team).toEqual({ id: 1, name: 'Destek' });
      expect(result.data[1].team).toBeNull();
    });
  });

  describe('personel detayı (findOneWorkforceUser)', () => {
    it('ekip { id, name } olarak döner', async () => {
      service.findOne.mockResolvedValue(makeUser({ teamId: 1, team }));

      const result = await controller.findOne(10);

      expect(result.team).toEqual({ id: 1, name: 'Destek' });
    });

    it('ekipsiz personelde ekip null döner', async () => {
      service.findOne.mockResolvedValue(makeUser());

      const result = await controller.findOne(10);

      expect(result.team).toBeNull();
    });

    it('personel yoksa 404 döner', async () => {
      service.findOne.mockResolvedValue(null);

      const error = await controller.findOne(99).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Personel bulunamadı',
      });
    });
  });
});
