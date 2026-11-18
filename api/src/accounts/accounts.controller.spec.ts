import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { WORKFORCE_SERVICE } from '../constants';

describe('AccountsController', () => {
  let controller: AccountsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      // Gerçek TCP istemcisi yerine sahte istemci
      providers: [{ provide: WORKFORCE_SERVICE, useValue: { send: jest.fn() } }],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
