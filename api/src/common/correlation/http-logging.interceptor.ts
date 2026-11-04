import {CallHandler,ExecutionContext,Injectable,Logger,NestInterceptor,} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { writeAccessLog } from './access-log';
import { CorrelationContextService } from './correlation-context.service';
import { CORRELATION_ID_HEADER_LOWER } from './correlation.constants';

// Her istek için tek erişim logu: method, adres, statusCode, süre, correlationId
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('API');

  constructor(private readonly context: CorrelationContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Listener başka bir async bağlamda çalışabilir; değerler şimdi okunup closure'da tutulur
    const store = this.context.getStore();
    const correlationId =store?.correlationId ?? String(req.headers[CORRELATION_ID_HEADER_LOWER]);
    const startedAt = store?.startedAt ?? performance.now();

    // Bu isteğin logu burada yazılacak; middleware'in fallback logu devre dışı kalır
    if (store) store.handledByInterceptor = true;

    // tap/finalize hatayı filter'dan önce görür (status hâlâ 200); 'finish' anında kod kesinleşmiştir
    res.once('finish', () =>
      writeAccessLog(this.logger, req, res, startedAt, correlationId),
    );

    // Akışa dokunulmaz: hata yutulmaz, exception filter'a aynen ulaşır
    return next.handle();
  }
}
