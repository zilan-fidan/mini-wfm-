import {CanActivate,ExecutionContext,ForbiddenException,Injectable,} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector,) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Endpoint public mı?
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    // 2. Endpoint için izin verilen rolleri oku
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 3. JWT Guard tarafından eklenen kullanıcıyı al
    const request = context.switchToHttp().getRequest<Request>();

    const user = (
      request as Request & { user?: JwtPayload }
    ).user;

    // 4. Kullanıcının rolünü kontrol et
    // @Roles() yoksa varsayılan olarak sadece ADMIN
    const allowedRoles = requiredRoles ?? [Role.ADMIN];

    if (!user || !allowedRoles.includes(user.role as Role)) {
      throw new ForbiddenException(
        'Bu işlem için yetkiniz yok',
      );
    }

    return true;
  }
}
