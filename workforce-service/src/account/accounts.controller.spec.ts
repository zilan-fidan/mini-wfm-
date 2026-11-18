
import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.services';

describe('AccountsController', () => {
  let controller: AccountsController;

  const accountsService = {
    findByUsername: jest.fn(),
    createAccount: jest.fn(),
    findAllAccounts: jest.fn(),
    findByUsernameWithPassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        {
          provide: AccountsService,
          useValue: accountsService,
        },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
  });

  it('Hatalı kullanıcı adında 401 dönmeli', async () => {
    accountsService.findByUsernameWithPassword.mockResolvedValue(null);

    await expect(
      controller.validateCredentials({
        username: 'olmayan',
        password: 'Test12345',
      }),
    ).rejects.toMatchObject({
      error: {
        statusCode: 401,
        message: 'Kullanıcı adı veya şifre hatalı',
      },
    });
  });

  it('Hatalı şifrede aynı 401 mesajını dönmeli', async () => {
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash('DogruSifre123!', 10);

    accountsService.findByUsernameWithPassword.mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    });

    await expect(
      controller.validateCredentials({
        username: 'admin',
        password: 'YanlisSifre123!',
      }),
    ).rejects.toMatchObject({
      error: {
        statusCode: 401,
        message: 'Kullanıcı adı veya şifre hatalı',
      },
    });
  });
});
