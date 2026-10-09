import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WORKFORCE_SERVICE } from './constants';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: WORKFORCE_SERVICE,
        transport: Transport.TCP,
        options: { host: 'localhost', port: 4001 },
      },
    ]),
  ],
  controllers: [HealthController],
})
export class AppModule {}