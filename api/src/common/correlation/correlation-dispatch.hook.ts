import { ReadPacket } from '@nestjs/microservices';
import { CorrelationContextService } from './correlation-context.service';
import { CORRELATION_ID_METADATA_KEY } from './correlation.constants';

// ClientProxy her giden paketi transport'a vermeden önce bu hook'tan geçirir.
// Id payload'a değil paketin metadata alanına yazılır: iş verisi ve @Payload() handler'lar değişmez.
export function createCorrelationDispatchHook(correlation: CorrelationContextService,){
  return (packet: ReadPacket) => {
    // Hook client.send'e subscribe edilen async zincirde çalışır; ALS isteğin id'sini verir
    const correlationId = correlation.getCorrelationId();
    if (!correlationId) return;

    // Nest kuralı: hook pattern ve data'yı değiştirmemeli, sadece metadata atamalı
    packet.metadata = {
      ...packet.metadata,
      [CORRELATION_ID_METADATA_KEY]: correlationId,
    };
  };
}
