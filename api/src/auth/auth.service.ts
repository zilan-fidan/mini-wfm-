import {Injectable,Inject,UnauthorizedException,} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { WORKFORCE_SERVICE } from '../constants';
import { ApiEnv } from '../config/env.validation';
import { LoginDto } from './dto/login.dto';

export interface AuthUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'PLANNER' | 'VIEWER';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<ApiEnv, true>,

    @Inject(WORKFORCE_SERVICE)
    private readonly workforceClient: ClientProxy,
  ) {}

  // 1. Kullanıcı bilgilerini doğrulama
  async validateUser(dto: LoginDto): Promise<AuthUser> {
    try {
      const account = await firstValueFrom(
        this.workforceClient.send<AuthUser>(
          'validateCredentials',
          {
            username: dto.username,
            password: dto.password,
          },
        ),
      );
      // Yalnızca gerekli kullanıcı bilgilerini döndür
      return {
        id: account.id,
        username: account.username,
        role: account.role,
      };
    } catch (error: unknown) {
      // Kullanıcı adı, şifre veya pasif hesap hatası
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        error.statusCode === 401
      ) {
        throw new UnauthorizedException(
          'Kullanıcı adı veya şifre hatalı',
        );
      }
      // Diğer hataları olduğu gibi ilet
      throw error;
    }
  }

  // 2. Giriş yapma ve JWT oluşturma
  async login(dto: LoginDto) {
    // Önce kullanıcı adı ve şifreyi doğrula
    const user = await this.validateUser(dto);

    // JWT içine yalnızca gerekli bilgileri koy
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    // Token süresini ortam değişkeninden al
    const expiresIn = this.configService.get(
      'JWT_EXPIRES_IN',
      { infer: true },
    );

    // JWT oluştur
    const accessToken = await this.jwtService.signAsync(
      payload,
      {
        expiresIn: expiresIn as '15m' | '30m' | '1h' | '2h' | '12h' | '1d',
      },
    );

    // Geçerlilik süresini saniyeye çevir
    const expirationSeconds: Record<string, number> = {
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '12h': 43200,
      '1d': 86400,
    };

    return {
      accessToken,
      expiresIn: expirationSeconds[expiresIn],
      user,
    };
  }
}
