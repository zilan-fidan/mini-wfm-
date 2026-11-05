import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CorrelationIdMiddleware } from './common/correlation/correlation-id.middleware';
import { CorrelationModule } from './common/correlation/correlation.module';
import { HttpLoggingInterceptor } from './common/correlation/http-logging.interceptor';
import { ApiEnv, validateEnv } from './config/env.validation';
import { WORKFORCE_SERVICE } from './constants';
import { HealthController } from './health/health.controller';
import { TeamsModule } from './teams/teams.module';
import { WorkforceUsersModule } from './workforce-users/workforce-users.module';
import { AccountsModule } from './accounts/accounts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    CorrelationModule,

    // workforce-service istemcisi bir kez, ayardan kurulur; isGlobal ile tüm modüllerde kullanılır
    ClientsModule.registerAsync({
      isGlobal: true,
      clients: [
        {
          name: WORKFORCE_SERVICE,
          inject: [ConfigService],
          useFactory: (config: ConfigService<ApiEnv, true>) => ({
            transport: Transport.TCP,
            options: {
              host: config.get('WORKFORCE_SERVICE_HOST', { infer: true }),
              port: config.get('WORKFORCE_SERVICE_PORT', { infer: true }),
            },
          }),
        },
      ],
    }),

    TeamsModule,
    WorkforceUsersModule,
    AccountsModule,
  ],
  controllers: [HealthController],
  // APP_INTERCEPTOR: global interceptor DI ile kurulur (useGlobalInterceptors(new ...) servisi inject edemez)
  providers: [{ provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor }],
})
export class AppModule implements NestModule {
  // '{*path}': Nest 12 wildcard yazımı; süslü parantez kök yol dahil tüm yolları kapsar
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*path}');
  }
}
