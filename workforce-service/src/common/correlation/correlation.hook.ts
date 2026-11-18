
import { PreRequestHook } from '@nestjs/common';
import { TcpContext } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { Logger } from '@nestjs/common';
import { CorrelationContextService } from './correlation-context.service';
import type { Actor } from './correlation-context.service';
import {
  CORRELATION_ID_METADATA_KEY,
  resolveCorrelationId,
} from './correlation.constants';

// Metadata'dan gelen actor bilgisinin yapısını kontrol eder
function isActor(value: unknown): value is Actor {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !('username' in value) ||
    !('role' in value)
  ) {
    return false;
  }

  return (
    typeof value.id === 'number' &&
    Number.isInteger(value.id) &&
    value.id > 0 &&
    typeof value.username === 'string' &&
    value.username.length > 0 &&
    (
      value.role === 'ADMIN' ||
      value.role === 'PLANNER' ||
      value.role === 'VIEWER'
    )
  );
}

export function createCorrelationHook(
  context: CorrelationContextService,
): PreRequestHook {
  return (executionContext, next) => {
    // TCP mesajının metadata bilgilerini al
    const metadata = executionContext
      .switchToRpc()
      .getContext<TcpContext>()
      .getMetadata();

    // Gelen actor bilgisini kontrol et
    let incomingActor: unknown;

try {
  incomingActor = metadata?.actor
    ? JSON.parse(metadata.actor)
    : undefined;
} catch {
  incomingActor = undefined;
}
    const store = {
      // Mevcut correlation ID mekanizması
      correlationId: resolveCorrelationId(
        metadata?.[CORRELATION_ID_METADATA_KEY],
      ),

      startedAt: performance.now(),

      // Geçerli actor varsa sakla
      actor: isActor(incomingActor)
        ? {
            id: incomingActor.id,
            username: incomingActor.username,
            role: incomingActor.role,
          }
        : undefined,
    };
    const logger = new Logger('ActorTest');

logger.debug(
  `correlationId=${store.correlationId} actor=${JSON.stringify(store.actor ?? null)}`,
);

    // Her TCP isteği için bağımsız async bağlam oluştur
    return new Observable((subscriber) =>
      context.run(store, () => next().subscribe(subscriber)),
    );
  };
}
