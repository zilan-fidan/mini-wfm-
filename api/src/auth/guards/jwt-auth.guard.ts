import {CanActivate,ExecutionContext,Injectable,UnauthorizedException,} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY,} from '../decorators/public.decorator';
import { JwtPayload } from '../types/jwt-payload.type';
import { CorrelationContextService } from '../../common/correlation/correlation-context.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
constructor(
  private readonly jwtService: JwtService,
  private readonly reflector: Reflector,
  private readonly correlationContext: CorrelationContextService,
) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
  IS_PUBLIC_KEY,
  [context.getHandler(), context.getClass()],
);

if (isPublic) {
  return true;
}
    const request = context.switchToHttp().getRequest<Request>();

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Token bulunamadı');
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Geçersiz token');
    }

    try {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

// Kullanıcı bilgisini HTTP Request'e ekle
(request as Request & { user: JwtPayload }).user = payload;

// Kullanıcı bilgisini AsyncLocalStorage'a ekle
this.correlationContext.setActor({
  id: payload.id,
  username: payload.username,
  role: payload.role,
});

return true;
    } catch {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş token');
    }
  }
}
