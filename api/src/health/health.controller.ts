import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { WORKFORCE_SERVICE } from '../constants';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(WORKFORCE_SERVICE) private readonly client: ClientProxy,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'workforce-service yanıtı', type: String })
  async check(): Promise<string> {
    return firstValueFrom(this.client.send<string>('ping', {}));
  }
}