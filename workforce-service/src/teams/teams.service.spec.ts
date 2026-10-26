import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike } from 'typeorm';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';

describe('TeamsService', () => {
  let service: TeamsService;

  const repository = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const makeTeam = (overrides: Partial<Team> = {}): Team =>
    ({
      id: 1,
      name: 'Backend Ekibi',
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Team;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: getRepositoryToken(Team), useValue: repository },
        { provide: getRepositoryToken(WorkforceUser), useValue: {} },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  describe('create', () => {
    it('aynı isimde ekip yoksa ekibi oluşturup döner', async () => {
      const dto = { name: 'Yeni Ekip', description: 'Açıklama' };
      const created = makeTeam({ name: 'Yeni Ekip' });
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(created);
      repository.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(repository.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });
  });

  describe('findOne', () => {
    it('ekip varsa ekibi döner', async () => {
      const team = makeTeam();
      repository.findOne.mockResolvedValue(team);

      await expect(service.findOne(1)).resolves.toEqual(team);
    });

    it('ekip yoksa null döner', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).resolves.toBeNull();
    });
  });

  describe('findAll', () => {
    it('parametre yoksa varsayılan sayfa 1 ve limit 10 kullanılır', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10 });
    });

    it('3. sayfa ve limit 5 için 10 kayıt atlar, 5 kayıt alır', async () => {
      repository.findAndCount.mockResolvedValue([[], 15]);

      await service.findAll({ page: 3, limit: 5 });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('kayıtları en yeniden eskiye sıralar', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC', id: 'DESC' },
        }),
      );
    });

    it('arama verilirse ad üzerinde büyük/küçük harf duyarsız filtre uygular', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'back' });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: ILike('%back%') } }),
      );
    });

    it('isActive false gönderilince de filtre uygulanır', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ isActive: false });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });

    it('arama ve isActive birlikte uygulanır', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'back', isActive: true });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: ILike('%back%'), isActive: true },
        }),
      );
    });

    it('total, sayfadaki kayıt sayısını değil filtreye uyan toplamı döner', async () => {
      const items = [makeTeam({ id: 1 }), makeTeam({ id: 2 })];
      repository.findAndCount.mockResolvedValue([items, 15]);

      const result = await service.findAll({ page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(15);
    });
  });

  describe('update', () => {
    it('yalnızca gönderilen alanları günceller', async () => {
      const team = makeTeam({ name: 'A Ekibi', description: 'Eski' });
      repository.save.mockImplementation(async (t: Team) => t);

      const result = await service.update(team, { description: 'Yeni' });

      expect(result.name).toBe('A Ekibi');
      expect(result.description).toBe('Yeni');
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('isActive false ile ekibi pasife alır', async () => {
      repository.save.mockImplementation(async (t: Team) => t);

      const result = await service.update(makeTeam(), { isActive: false });

      expect(result.isActive).toBe(false);
    });
  });

  describe('remove', () => {
    it('verilen ekibi siler', async () => {
      const team = makeTeam();
      repository.remove.mockResolvedValue(team);

      await service.remove(team);

      expect(repository.remove).toHaveBeenCalledWith(team);
    });
  });
});
