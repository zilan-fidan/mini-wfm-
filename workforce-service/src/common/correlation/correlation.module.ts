import { Global, Module } from '@nestjs/common';
import { CorrelationContextService } from './correlation-context.service';

// Global: pre-request hook ve RPC interceptor aynı servisi (aynı ALS'yi) kullanır
@Global()
@Module({
  providers: [CorrelationContextService],
  exports: [CorrelationContextService],
})
export class CorrelationModule {}