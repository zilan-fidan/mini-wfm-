import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ApiEnv, validateEnv } from './config/env.validation';
import { WORKFORCE_SERVICE } from './constants';
import { HealthController } from './health/health.controller';
import { TeamsModule } from './teams/teams.module';
import { WorkforceUsersModule } from './workforce-users/workforce-users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
