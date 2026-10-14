import { Controller, HttpStatus } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { BusinessRuleException } from '../common/business-rule.exception';

@Controller()
export class HealthController {
  @MessagePattern({ cmd: 'health' })
  health() {
    return 'pong';
  }

  // GEÇİCİ: MWFM-5 denemesi, sonra silinecek
  @MessagePattern({ cmd: 'debug.not-found' })
  debugNotFound() {
    throw new BusinessRuleException('Kayıt bulunamadı', HttpStatus.NOT_FOUND);
  }
}