import { HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { WorkforceUser } from '../workforce-users/entities/workforce-user.entity';

const makeTeam = (overrides: Partial<Team> = {}): Team =>
  ({
    id: 1,
    name: 'Destek',
    description: 'Müşteri destek ekibi',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }) as Team;

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

// Hatanın RpcException olduğunu ve kod + mesajın beklenen olduğunu doğrular
const expectRpcError = async (
  promise: Promise<unknown>,
  statusCode: HttpStatus,
  message: string,
) => {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(RpcException);
  expect((error as RpcException).getError()).toEqual({ statusCode, message });
};

describe('TeamsController', () => {
  let controller: TeamsController;
  let service: jest.Mocked<
    Pick<
      TeamsService,
      | 'create'
      | 'findAll'
      | 'findByName'
      | 'update'
      | 'findOne'
      | 'findOneWithMembers'
      | 'remove'
      | 'countMembers'
      | 'findWorkforceUserWithTeam'
      | 'addMember'
      | 'removeMember'
    >
  >;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByName: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      findOneWithMembers: jest.fn(),
      remove: jest.fn(),
      countMembers: jest.fn(),
      findWorkforceUserWithTeam: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [{ provide: TeamsService, useValue: service }],
    }).compile();

    controller = module.get<TeamsController>(TeamsController);
  });

  describe('ekip oluşturma (createTeam)', () => {
    it('aynı isimde ekip varsa 409 döner ve oluşturmaz', async () => {
      service.findByName.mockResolvedValue(makeTeam());

      await expectRpcError(
        controller.create({ name: 'Destek' }),
        HttpStatus.CONFLICT,
        'Bu isimde bir ekip zaten var',
      );
      expect(service.create).not.toHaveBeenCalled();
    });

    it('aynı isimde ekip yoksa ekibi oluşturur', async () => {
      const dto = { name: 'Yeni Ekip', description: 'Açıklama' };
      const created = makeTeam({ id: 2, name: 'Yeni Ekip' });
      service.findByName.mockResolvedValue(null);
      service.create.mockResolvedValue(created);

      await expect(controller.create(dto)).resolves.toEqual(created);
      expect(service.findByName).toHaveBeenCalledWith('Yeni Ekip');
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('ekip listeleme (findAllTeams)', () => {
    it('sorguyu service e iletir ve sonucu döner', async () => {
      const query = { page: 2, limit: 5, search: 'des' };
      const response = { data: [makeTeam()], total: 6, page: 2, limit: 5 };
      service.findAll.mockResolvedValue(response);

      await expect(controller.findAll(query)).resolves.toEqual(response);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('ekip güncelleme (updateTeam)', () => {
    it('ekip yoksa 404 döner ve güncellemez', async () => {
      service.findOne.mockResolvedValue(null);

      await expectRpcError(
        controller.update({ id: 99, data: { description: 'x' } }),
        HttpStatus.NOT_FOUND,
        'Ekip bulunamadı',
      );
      expect(service.update).not.toHaveBeenCalled();
    });

    it('ad başka bir ekipte varsa 409 döner ve güncellemez', async () => {
      service.findOne.mockResolvedValue(makeTeam({ id: 1, name: 'Destek' }));
      service.findByName.mockResolvedValue(makeTeam({ id: 2, name: 'Satış' }));

      await expectRpcError(
        controller.update({ id: 1, data: { name: 'Satış' } }),
        HttpStatus.CONFLICT,
        'Bu isimde bir ekip zaten var',
      );
      expect(service.update).not.toHaveBeenCalled();
    });

    it('ekip kendi adıyla güncellenirse çakışma kontrolü yapmaz', async () => {
      const team = makeTeam({ name: 'Destek' });
      service.findOne.mockResolvedValue(team);
      service.update.mockResolvedValue(team);

      await controller.update({ id: 1, data: { name: 'Destek' } });

      expect(service.findByName).not.toHaveBeenCalled();
      expect(service.update).toHaveBeenCalledWith(team, { name: 'Destek' });
    });

    it('ad gönderilmezse çakışma kontrolü yapmadan günceller', async () => {
      const team = makeTeam();
      const updated = makeTeam({ isActive: false });
      service.findOne.mockResolvedValue(team);
      service.update.mockResolvedValue(updated);

      await expect(
        controller.update({ id: 1, data: { isActive: false } }),
      ).resolves.toEqual(updated);
      expect(service.findByName).not.toHaveBeenCalled();
      expect(service.update).toHaveBeenCalledWith(team, { isActive: false });
    });
  });

  describe('ekip detayı (findOneTeam)', () => {
    it('ekip yoksa 404 döner', async () => {
      service.findOneWithMembers.mockResolvedValue(null);

      await expectRpcError(controller.findOne(99), HttpStatus.NOT_FOUND, 'Ekip bulunamadı');
    });

    it('ekibi üyeleriyle birlikte döner', async () => {
      const members = [makeUser({ id: 10, teamId: 1 }), makeUser({ id: 11, teamId: 1 })];
      service.findOneWithMembers.mockResolvedValue(makeTeam({ members }));

      const result = await controller.findOne(1);

      expect(service.findOneWithMembers).toHaveBeenCalledWith(1);
      expect(result.members).toHaveLength(2);
      expect(result.members.map((m) => m.id)).toEqual([10, 11]);
    });
  });

  describe('ekip silme (removeTeam)', () => {
    it('ekip yoksa 404 döner', async () => {
      service.findOne.mockResolvedValue(null);

      await expectRpcError(controller.remove(99), HttpStatus.NOT_FOUND, 'Ekip bulunamadı');
      expect(service.remove).not.toHaveBeenCalled();
    });

    it('üyesi olan ekip silinemez: 409', async () => {
      service.findOne.mockResolvedValue(makeTeam());
      service.countMembers.mockResolvedValue(2);

      await expectRpcError(
        controller.remove(1),
        HttpStatus.CONFLICT,
        'Ekipte 2 personel var. Silmeden önce personelleri ekipten çıkarın',
      );
      expect(service.remove).not.toHaveBeenCalled();
    });

    it('üyesi olmayan ekip silinir', async () => {
      const team = makeTeam();
      service.findOne.mockResolvedValue(team);
      service.countMembers.mockResolvedValue(0);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(team);
    });
  });

  describe('ekibe personel ekleme (addTeamMember)', () => {
    const payload = { teamId: 1, workforceUserId: 10 };

    it('ekip yoksa 404 döner', async () => {
      service.findOne.mockResolvedValue(null);
      service.findWorkforceUserWithTeam.mockResolvedValue(makeUser());

      await expectRpcError(controller.addMember(payload), HttpStatus.NOT_FOUND, 'Ekip bulunamadı');
      expect(service.addMember).not.toHaveBeenCalled();
    });

    it('personel yoksa 404 döner', async () => {
      service.findOne.mockResolvedValue(makeTeam());
      service.findWorkforceUserWithTeam.mockResolvedValue(null);

      await expectRpcError(controller.addMember(payload), HttpStatus.NOT_FOUND, 'Personel bulunamadı');
      expect(service.addMember).not.toHaveBeenCalled();
    });

    it('ekip pasifse 409 döner', async () => {
      service.findOne.mockResolvedValue(makeTeam({ isActive: false }));
      service.findWorkforceUserWithTeam.mockResolvedValue(makeUser());

      await expectRpcError(
        controller.addMember(payload),
        HttpStatus.CONFLICT,
        'Pasif bir ekibe personel eklenemez',
      );
      expect(service.addMember).not.toHaveBeenCalled();
    });

    it('personel pasifse 409 döner', async () => {
      service.findOne.mockResolvedValue(makeTeam());
      service.findWorkforceUserWithTeam.mockResolvedValue(makeUser({ isActive: false }));

      await expectRpcError(
        controller.addMember(payload),
        HttpStatus.CONFLICT,
        'Pasif bir personel ekibe eklenemez',
      );
      expect(service.addMember).not.toHaveBeenCalled();
    });

    it('personel zaten bir ekipteyse 409 döner ve mesajda ekip adı yazar', async () => {
      const otherTeam = makeTeam({ id: 2, name: 'Satış' });
      service.findOne.mockResolvedValue(makeTeam());
      service.findWorkforceUserWithTeam.mockResolvedValue(
        makeUser({ teamId: 2, team: otherTeam }),
      );

      await expectRpcError(
        controller.addMember(payload),
        HttpStatus.CONFLICT,
        'Personel zaten "Satış" ekibinde',
      );
      expect(service.addMember).not.toHaveBeenCalled();
    });

    it('kontrolden sonra başka istek personeli atadıysa yine 409 döner', async () => {
      const otherTeam = makeTeam({ id: 3, name: 'Operasyon' });
      service.findOne.mockResolvedValue(makeTeam());
      service.findWorkforceUserWithTeam
        .mockResolvedValueOnce(makeUser()) // kontrol anında ekipsiz
        .mockResolvedValueOnce(makeUser({ teamId: 3, team: otherTeam })); // güncellemede kaybetti
      service.addMember.mockResolvedValue(false);

      await expectRpcError(
        controller.addMember(payload),
        HttpStatus.CONFLICT,
        'Personel zaten "Operasyon" ekibinde',
      );
    });

    it('personeli ekibe ekler ve ekibi { id, name } olarak döner', async () => {
      const team = makeTeam();
      service.findOne.mockResolvedValue(team);
      service.findWorkforceUserWithTeam
        .mockResolvedValueOnce(makeUser())
        .mockResolvedValueOnce(makeUser({ teamId: 1, team }));
      service.addMember.mockResolvedValue(true);

      const result = await controller.addMember(payload);

      expect(service.addMember).toHaveBeenCalledWith(1, 10);
      expect(result.teamId).toBe(1);
      expect(result.team).toEqual({ id: 1, name: 'Destek' });
    });
  });

  describe('ekipten personel çıkarma (removeTeamMember)', () => {
    const payload = { teamId: 1, workforceUserId: 10 };

    it('ekip yoksa 404 döner', async () => {
      service.findOne.mockResolvedValue(null);

      await expectRpcError(controller.removeMember(payload), HttpStatus.NOT_FOUND, 'Ekip bulunamadı');
      expect(service.removeMember).not.toHaveBeenCalled();
    });

    it('personel yoksa 404 döner', async () => {
      service.findOne.mockResolvedValue(makeTeam());
      service.findWorkforceUserWithTeam.mockResolvedValue(null);

      await expectRpcError(
        controller.removeMember(payload),
        HttpStatus.NOT_FOUND,
        'Personel bulunamadı',
      );
      expect(service.removeMember).not.toHaveBeenCalled();
    });

    it('personel başka bir ekipteyse 404 döner', async () => {
      service.findOne.mockResolvedValue(makeTeam());
      service.findWorkforceUserWithTeam.mockResolvedValue(
        makeUser({ teamId: 2, team: makeTeam({ id: 2, name: 'Satış' }) }),
      );

      await expectRpcError(
        controller.removeMember(payload),
        HttpStatus.NOT_FOUND,
        'Personel bu ekipte değil',
      );
      expect(service.removeMember).not.toHaveBeenCalled();
    });

    it('personel hiçbir ekipte değilse 404 döner', async () => {
      service.findOne.mockResolvedValue(makeTeam());
      service.findWorkforceUserWithTeam.mockResolvedValue(makeUser());

      await expectRpcError(
        controller.removeMember(payload),
        HttpStatus.NOT_FOUND,
        'Personel bu ekipte değil',
      );
      expect(service.removeMember).not.toHaveBeenCalled();
    });

    it('personeli ekipten çıkarır', async () => {
      const team = makeTeam();
      service.findOne.mockResolvedValue(team);
      service.findWorkforceUserWithTeam.mockResolvedValue(makeUser({ teamId: 1, team }));

      await controller.removeMember(payload);

      expect(service.removeMember).toHaveBeenCalledWith(1, 10);
    });
  });
});