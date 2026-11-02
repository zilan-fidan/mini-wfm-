import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { HealthController } from './health/health.controller';
import { TeamsModule } from './teams/teams.module';
import { WorkforceUsersModule } from './workforce-users/workforce-users.module';
import { WorkforceEnv, validateEnv } from './config/env.validation';


@Module({
  imports: [
   ConfigModule.forRoot({
  isGlobal: true,
  validate: validateEnv,
}),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<WorkforceEnv, true>) => ({
        type: 'postgres',

        // Değerler şemadan geçmiştir: DB_PORT zaten sayıdır
        host: configService.get('DB_HOST', { infer: true }),
        port: configService.get('DB_PORT', { infer: true }),

        username: configService.get('DB_USERNAME', { infer: true }),
        password: configService.get('DB_PASSWORD', { infer: true }),
        database: configService.get('DB_DATABASE', { infer: true }),

        autoLoadEntities: true,

        synchronize: false,

        namingStrategy: new SnakeNamingStrategy(),

        migrations: [__dirname + '/migrations/*{.ts,.js}'],

        migrationsRun: true,
      }),
    }),

    TeamsModule,
    WorkforceUsersModule,
  ],


  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
