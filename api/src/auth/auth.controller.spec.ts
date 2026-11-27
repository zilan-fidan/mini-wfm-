import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role, ROLES_KEY } from './decorators/roles.decorator';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { login: jest.fn() } }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('/auth/me her role açık olmalı (varsayılan ADMIN kısıtına takılmamalı)', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AuthController.prototype.getMe) as Role[];
    expect(roles).toEqual(expect.arrayContaining([Role.ADMIN, Role.PLANNER, Role.VIEWER]));
  });
});
