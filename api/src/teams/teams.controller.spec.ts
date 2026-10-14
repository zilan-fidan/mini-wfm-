import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { WORKFORCE_SERVICE } from '../constants';
import { TeamsController } from './teams.controller';

describe('TeamsController', () => {
  let controller: TeamsController;
  const client = { send: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [{ provide: WORKFORCE_SERVICE, useValue: client }],
    }).compile();

    controller = module.get<TeamsController>(TeamsController);
  });

  it('create: createTeam mesajını DTO ile gönderir ve sonucu döner', async () => {
    const dto = { name: 'Backend Ekibi', description: 'Açıklama' };
    const team = { id: 1, ...dto };
    client.send.mockReturnValue(of(team));

    const result = await firstValueFrom(controller.create(dto));

    expect(client.send).toHaveBeenCalledWith('createTeam', dto);
    expect(result).toEqual(team);
  });

  it('findAll: findAllTeams mesajını query ile gönderir', async () => {
    const query = { page: 2, limit: 5, search: 'back', isActive: true };
    const response = { items: [], total: 0, page: 2, limit: 5 };
    client.send.mockReturnValue(of(response));

    const result = await firstValueFrom(controller.findAll(query));

    expect(client.send).toHaveBeenCalledWith('findAllTeams', query);
    expect(result).toEqual(response);
  });

  it('findOne: findOneTeam mesajını id ile gönderir', async () => {
    const team = { id: 5, name: 'Backend Ekibi' };
    client.send.mockReturnValue(of(team));

    const result = await firstValueFrom(controller.findOne(5));

    expect(client.send).toHaveBeenCalledWith('findOneTeam', 5);
    expect(result).toEqual(team);
  });

  it('update: updateTeam mesajını { id, data } şeklinde gönderir', async () => {
    const dto = { description: 'Yeni' };
    client.send.mockReturnValue(of({ id: 5, ...dto }));

    await firstValueFrom(controller.update(5, dto));

    expect(client.send).toHaveBeenCalledWith('updateTeam', {
      id: 5,
      data: dto,
    });
  });

  it('remove: removeTeam mesajını id ile gönderir', async () => {
    client.send.mockReturnValue(of(undefined));

    await firstValueFrom(controller.remove(5));

    expect(client.send).toHaveBeenCalledWith('removeTeam', 5);
  });
});
