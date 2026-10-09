import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class HealthController {
  @MessagePattern('ping')
  ping(): string {
    return 'pong';
  }
}