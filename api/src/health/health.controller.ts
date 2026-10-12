import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { WORKFORCE_SERVICE } from '../constants';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(WORKFORCE_SERVICE) private readonly client: ClientProxy,
  ) {}

  @Get()
  @ApiOperation({ summary: 'workforce-service sağlık kontrolü' })
  ping() {
    return firstValueFrom(this.client.send({ cmd: 'health' }, {}));
  }

  // GEÇİCİ: sonra silinecek
  @Get('debug-404')
  debug() {
    return firstValueFrom(this.client.send({ cmd: 'debug.not-found' }, {}));
  }
}