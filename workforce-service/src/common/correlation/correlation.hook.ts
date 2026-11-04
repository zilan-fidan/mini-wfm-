import { PreRequestHook } from '@nestjs/common';
import { TcpContext } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { CorrelationContextService } from './correlation-context.service';
import {CORRELATION_ID_METADATA_KEY, resolveCorrelationId} from './correlation.constants';

// api'deki ALS bu sürece taşınmaz: her TCP mesajı için id paketin metadata'sından okunup yeni bağlam açılır.
// Hook bir class olmadığı için servisi DI yerine parametre olarak alır.
export function createCorrelationHook(context: CorrelationContextService,): PreRequestHook {
  return (executionContext, next) => {
    // Metadata payload'dan ayrı taşınır; @Payload() handler'lar yalnızca iş verisini görür
    const metadata = executionContext
      .switchToRpc()
      .getContext<TcpContext>()
      .getMetadata();
    const store = {
      // Metadata yoksa veya değer geçersizse yeni UUID üretilir
      correlationId: resolveCorrelationId(metadata?.[CORRELATION_ID_METADATA_KEY]),
      startedAt: performance.now(),
    };

    // next() cold bir Observable döner; subscribe run'ın içinde olmalı ki handler bağlamı görsün
    return new Observable((subscriber) =>
      context.run(store, () => next().subscribe(subscriber)),
    );
  };
}
