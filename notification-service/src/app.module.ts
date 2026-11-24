import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { NOTIFICATION_MIGRATIONS_TABLE } from './config/database.constants';
import { NotificationEnv, validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<NotificationEnv, true>) => ({
        type: 'postgres',
        host: config.get('DB_HOST', { infer: true }),
        port: config.get('DB_PORT', { infer: true }),
        username: config.get('DB_USERNAME', { infer: true }),
        password: config.get('DB_PASSWORD', { infer: true }),
        database: config.get('DB_DATABASE', { infer: true }),

        autoLoadEntities: true,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy(),

        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsTableName: NOTIFICATION_MIGRATIONS_TABLE,
        migrationsRun: true,
      }),
    }),

    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
