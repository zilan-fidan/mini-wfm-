import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { writeAccessLog } from './access-log';
import { CorrelationContextService, CorrelationStore } from './correlation-context.service';
import {CORRELATION_ID_HEADER,CORRELATION_ID_HEADER_LOWER,CORRELATION_ID_MAX_LENGTH,CORRELATION_ID_PATTERN,} from './correlation.constants';

// Geçerli değer aynen kullanılır; geçersizse düzeltilmez, yerine yeni UUID üretilir
export function resolveCorrelationId(value: string | string[] | undefined,): string {
  if (
    typeof value === 'string' &&
    value.length <= CORRELATION_ID_MAX_LENGTH &&
    CORRELATION_ID_PATTERN.test(value)
  ) {
    return value;
  }
  return randomUUID();
}

// Her istekte en önce çalışır: guard'a veya handler'a ulaşmayan yanıtlarda da header bulunur
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('API');

  constructor(private readonly context: CorrelationContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = performance.now(); // süre ölçümü burda başlar 
    const correlationId = resolveCorrelationId(
      req.headers[CORRELATION_ID_HEADER_LOWER],
    );

    // Sonraki katmanlar (ör. exception filter) id'yi aynı yerden okusun
    req.headers[CORRELATION_ID_HEADER_LOWER] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);// header yazılır 

    const store: CorrelationStore = { correlationId, startedAt };

    // Fallback: interceptor'a hiç ulaşmayan istekler (bilinmeyen route, guard reddi) de loglansın.
    // Interceptor çalıştıysa store'u işaretler ve log orada yazılır; böylece her istek için tek log olur.
    res.once('finish', () => {
      if (!store.handledByInterceptor) {
        writeAccessLog(this.logger, req, res, startedAt, correlationId);
      }
    });

    // next() zincirin geri kalanını başlatır; hepsi bu bağlamın içinde çalışır
    this.context.run(store, () => next());
  }
}
