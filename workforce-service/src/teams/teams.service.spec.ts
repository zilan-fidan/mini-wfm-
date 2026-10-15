import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { ILike } from 'typeorm';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';

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

  const expectRpcError = async (
    promise: Promise<unknown>,
    statusCode: number,
    message: string,
  ) => {
    await expect(promise).rejects.toBeInstanceOf(RpcException);
    await promise.catch((e: RpcException) => {
      expect(e.getError()).toEqual({ statusCode, message });
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: getRepositoryToken(Team), useValue: repository },
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

    it('aynı isimde ekip varsa 409 fırlatır ve kaydetmez', async () => {
      repository.findOne.mockResolvedValue(makeTeam());

      await expectRpcError(
        service.create({ name: 'Backend Ekibi' }),
        409,
        'Bu isimde bir ekip zaten var',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('ekip varsa ekibi döner', async () => {
      const team = makeTeam();
      repository.findOne.mockResolvedValue(team);

      await expect(service.findOne(1)).resolves.toEqual(team);
    });

    it('ekip yoksa 404 fırlatır', async () => {
      repository.findOne.mockResolvedValue(null);

      await expectRpcError(service.findOne(999), 404, 'Ekip bulunamadı');
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
      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 10 });
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

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(15);
    });
  });

  describe('update', () => {
    it('yalnızca gönderilen alanları günceller', async () => {
      const team = makeTeam({ name: 'A Ekibi', description: 'Eski' });
      repository.findOne.mockResolvedValue(team);
      repository.save.mockImplementation(async (t: Team) => t);

      const result = await service.update(1, { description: 'Yeni' });

      expect(result.name).toBe('A Ekibi');
      expect(result.description).toBe('Yeni');
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('ekip kendi adıyla güncellenirse hata vermez ve çakışma kontrolü yapmaz', async () => {
      const team = makeTeam({ name: 'A Ekibi' });
      repository.findOne.mockResolvedValue(team);
      repository.save.mockImplementation(async (t: Team) => t);

      await expect(
        service.update(1, { name: 'A Ekibi' }),
      ).resolves.toBeDefined();
      // yalnızca ekibi bulmak için 1 kez çağrıldı, çakışma araması yapılmadı
      expect(repository.findOne).toHaveBeenCalledTimes(1);
    });

    it('isActive false ile ekibi pasife alır', async () => {
      repository.findOne.mockResolvedValue(makeTeam());
      repository.save.mockImplementation(async (t: Team) => t);

      const result = await service.update(1, { isActive: false });

      expect(result.isActive).toBe(false);
    });

    it('ekip yoksa 404 fırlatır ve kaydetmez', async () => {
      repository.findOne.mockResolvedValue(null);

      await expectRpcError(
        service.update(999, { description: 'x' }),
        404,
        'Ekip bulunamadı',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('ad başka bir ekipte varsa 409 fırlatır ve kaydetmez', async () => {
      const team = makeTeam({ id: 1, name: 'A Ekibi' });
      const other = makeTeam({ id: 2, name: 'B Ekibi' });
      repository.findOne
        .mockResolvedValueOnce(team) // ekibi bulma
        .mockResolvedValueOnce(other); // ad çakışması araması

      await expectRpcError(
        service.update(1, { name: 'B Ekibi' }),
        409,
        'Bu isimde bir ekip zaten var',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('ekip varsa siler', async () => {
      const team = makeTeam();
      repository.findOne.mockResolvedValue(team);
      repository.remove.mockResolvedValue(team);

      await service.remove(1);

      expect(repository.remove).toHaveBeenCalledWith(team);
    });

    it('ekip yoksa 404 fırlatır ve silmez', async () => {
      repository.findOne.mockResolvedValue(null);

      await expectRpcError(service.remove(999), 404, 'Ekip bulunamadı');
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});