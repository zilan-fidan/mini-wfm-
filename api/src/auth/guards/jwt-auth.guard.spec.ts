
import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { JwtAuthGuard } from './jwt-auth.guard';
import { CorrelationContextService } from '../../common/correlation/correlation-context.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  // Gerçek servisler yerine mock kullanıyoruz
  const jwtService = {
    verifyAsync: jest.fn(),
  };

  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const correlationContext = {
    setActor: jest.fn(),
  };

  // HTTP Request nesnesinin taklidi
  const request: {
    headers: { authorization?: string };
    user?: {
      id: number;
      username: string;
      role: string;
    };
  } = {
    headers: {},
  };

  // Her çağrıda aynı referansları kullan
  const mockHandler = jest.fn();

  class TestController {}

  // ExecutionContext nesnesinin taklidi
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => mockHandler,
    getClass: () => TestController,
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();

    // Her test öncesi request temizlenir
    request.headers = {};
    delete request.user;

    // Varsayılan olarak endpoint korumalıdır
    reflector.getAllAndOverride.mockReturnValue(false);

    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      reflector as unknown as Reflector,
      correlationContext as unknown as CorrelationContextService,
    );
  });

  // TEST 1
  it('Token yoksa 401 dönmeli', async () => {
    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // TEST 2
  it('Bearer formatı yanlışsa 401 dönmeli', async () => {
    request.headers.authorization = 'Basic abc123';

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // TEST 3
  it('Bozuk token varsa 401 dönmeli', async () => {
    request.headers.authorization = 'Bearer bozuk-token';

    jwtService.verifyAsync.mockRejectedValue(
      new Error('invalid signature'),
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // TEST 4
  it('Süresi dolmuş token varsa 401 dönmeli', async () => {
    request.headers.authorization = 'Bearer eski-token';

    jwtService.verifyAsync.mockRejectedValue(
      new Error('jwt expired'),
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // TEST 5
  it('Geçerli token varsa isteğe izin vermeli', async () => {
    const payload = {
      id: 1,
      username: 'admin',
      role: 'ADMIN' as const,
    };

    request.headers.authorization = 'Bearer gecerli-token';

    jwtService.verifyAsync.mockResolvedValue(payload);

    await expect(
      guard.canActivate(context),
    ).resolves.toBe(true);

    expect(request.user).toEqual(payload);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith(
      'gecerli-token',
    );
  });

  // TEST 6
  it('Geçerli token actor bilgisini kaydetmeli', async () => {
    const payload = {
      id: 1,
      username: 'admin',
      role: 'ADMIN' as const,
    };

    request.headers.authorization = 'Bearer gecerli-token';

    jwtService.verifyAsync.mockResolvedValue(payload);

    await guard.canActivate(context);

    expect(correlationContext.setActor).toHaveBeenCalledWith({
      id: 1,
      username: 'admin',
      role: 'ADMIN',
    });
  });

  // TEST 7
  it('@Public() endpoint token istememeli', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(
      guard.canActivate(context),
    ).resolves.toBe(true);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      [mockHandler, TestController],
    );

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();

    expect(correlationContext.setActor).not.toHaveBeenCalled();
  });
});
