import {CallHandler,ExecutionContext,Injectable,Logger,NestInterceptor,} from '@nestjs/common';
import { RpcException, TcpContext } from '@nestjs/microservices';
import { Observable, tap } from 'rxjs';
import { CorrelationContextService } from './correlation-context.service';

// Her TCP mesajı için tek log: pattern, correlationId, süre (hatada statusCode)
@Injectable()
export class RpcLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('WorkforceService');

  constructor(private readonly correlation: CorrelationContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'rpc') return next.handle();

    // getHandler().name yerine pattern: teams ve workforce-users'ta aynı adlı metodlar var
    const pattern = context.switchToRpc().getContext<TcpContext>().getPattern();
    const store = this.correlation.getStore();
    const startedAt = store?.startedAt ?? performance.now();
    const prefix = `${pattern} correlationId=${store?.correlationId ?? '-'}`;
    const summary = () =>
      `${prefix} duration=${Math.round(performance.now() - startedAt)}ms`;

    // HTTP'nin aksine kod hatanın içindedir (RpcException.getError()), bu yüzden tap yeterli.
    // tap hatayı yutmaz; api'ye aynen ulaşır.
    return next.handle().pipe(
      tap({
        complete: () => this.logger.log(summary()),
        error: (error: unknown) => {
          if (error instanceof RpcException) {
            this.logger.warn(`${summary()} statusCode=${this.statusCodeOf(error)}`);
            return;
          }
          this.logger.error(
            summary(),
            error instanceof Error ? error.stack : String(error),
          );
        },
      }),
    );
  }

  private statusCodeOf(error: RpcException): unknown {
    const body = error.getError();
    if (typeof body === 'object' && body !== null && 'statusCode' in body) {
      return body.statusCode;
    }
    return '-';
  }
}
