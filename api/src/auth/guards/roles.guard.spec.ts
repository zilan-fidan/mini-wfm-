
import {ExecutionContext,ForbiddenException,} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role, ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../types/jwt-payload.type';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const request: {
    user?: JwtPayload;
  } = {};

  // Aynı referanslar kullanılmalı
  const mockHandler = jest.fn();
  class TestController {}

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => mockHandler,
    getClass: () => TestController,
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    delete request.user;

    // Metadata anahtarına göre mock yanıtı
    reflector.getAllAndOverride.mockImplementation(
      (key: string) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === ROLES_KEY) return undefined;
        return undefined;
      },
    );

    guard = new RolesGuard(
      reflector as unknown as Reflector,
    );
  });

  // TEST 1
  it('ADMIN, ADMIN endpointine erişebilmeli', () => {
    request.user = {
      id: 1,
      username: 'admin',
      role: 'ADMIN',
    };

    reflector.getAllAndOverride.mockImplementation(
      (key: string) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === ROLES_KEY) return [Role.ADMIN];
      },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  // TEST 2
  it('PLANNER, PLANNER endpointine erişebilmeli', () => {
    request.user = {
      id: 2,
      username: 'planner',
      role: 'PLANNER',
    };

    reflector.getAllAndOverride.mockImplementation(
      (key: string) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === ROLES_KEY) {
          return [Role.ADMIN, Role.PLANNER];
        }
      },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  // TEST 3
  it('VIEWER, görüntüleme endpointine erişebilmeli', () => {
    request.user = {
      id: 3,
      username: 'viewer',
      role: 'VIEWER',
    };

    reflector.getAllAndOverride.mockImplementation(
      (key: string) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === ROLES_KEY) {
          return [Role.ADMIN, Role.PLANNER, Role.VIEWER];
        }
      },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  // TEST 4
  it('VIEWER, ADMIN endpointine erişememeli', () => {
    request.user = {
      id: 3,
      username: 'viewer',
      role: 'VIEWER',
    };

    reflector.getAllAndOverride.mockImplementation(
      (key: string) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === ROLES_KEY) return [Role.ADMIN];
      },
    );

    expect(() => guard.canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  // TEST 5
  it('PLANNER, hesap yönetimine erişememeli', () => {
    request.user = {
      id: 2,
      username: 'planner',
      role: 'PLANNER',
    };

    reflector.getAllAndOverride.mockImplementation(
      (key: string) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === ROLES_KEY) return [Role.ADMIN];
      },
    );

    expect(() => guard.canActivate(context)).toThrow(
      'Bu işlem için yetkiniz yok',
    );
  });

  // TEST 6
  it('@Roles olmayan endpoint sadece ADMINe açık olmalı', () => {
    request.user = {
      id: 1,
      username: 'admin',
      role: 'ADMIN',
    };

    expect(guard.canActivate(context)).toBe(true);
  });

  // TEST 7
  it('@Roles olmayan endpoint VIEWER için 403 dönmeli', () => {
    request.user = {
      id: 3,
      username: 'viewer',
      role: 'VIEWER',
    };

    expect(() => guard.canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  // TEST 8
  it('@Public endpoint token istememeli', () => {
    reflector.getAllAndOverride.mockImplementation(
      (key: string) => {
        if (key === IS_PUBLIC_KEY) return true;
        return undefined;
      },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  // TEST 9
  it('Kullanıcı bilgisi yoksa erişim reddedilmeli', () => {
    expect(() => guard.canActivate(context)).toThrow(
      ForbiddenException,
    );
  });
});
