import { Global, Module } from '@nestjs/common';
import { CorrelationContextService } from './correlation-context.service';

// Global: middleware, interceptor ve TCP serializer aynı servisi (aynı ALS'yi) kullanır
@Global()
@Module({
  providers: [CorrelationContextService],
  exports: [CorrelationContextService],
})
export class CorrelationModule {}
