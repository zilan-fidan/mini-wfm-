
import type { ReadPacket } from '@nestjs/microservices';
import { CorrelationContextService } from './correlation-context.service';
import { CORRELATION_ID_METADATA_KEY } from './correlation.constants';

// API'den workforce-service'e giden mesajları düzenler
export function createCorrelationDispatchHook(
  correlation: CorrelationContextService,
) {
  return (packet: ReadPacket) => {
    // Aktif isteğin bilgilerini al
    const correlationId = correlation.getCorrelationId();
    const actor = correlation.getActor();

    // Ne correlation ID ne de actor varsa işlem yapma
    if (!correlationId && !actor) return;

    // Mevcut metadata'yı koruyarak yeni bilgileri ekle
    packet.metadata = {
      ...packet.metadata,

      ...(correlationId
        ? { [CORRELATION_ID_METADATA_KEY]: correlationId }
        : {}),

      ...(actor ? { actor: JSON.stringify(actor) } : {}),
    };
  };
}
