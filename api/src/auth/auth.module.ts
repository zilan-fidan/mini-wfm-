import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { CorrelationModule } from '../common/correlation/correlation.module';
import { ApiEnv } from '../config/env.validation';

@Module({
  imports: [
    CorrelationModule,

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<ApiEnv, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    // 1. Önce JWT doğrulanır
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // 2. Ardından rol kontrol edilir
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthModule {}

