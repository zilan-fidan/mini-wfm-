import {ArgumentsHost,Catch,ExceptionFilter, HttpException,HttpStatus,Logger,}from '@nestjs/common';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER_LOWER } from '../correlation/correlation.constants';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    // Durum 3: api'nin kendi HTTP hataları → kod ve mesaj korunur, şema P2'ye uyar
    if (exception instanceof HttpException) {
      return this.send(
        response,
        exception.getStatus(),
        this.extractHttpMessage(exception),
        this.extractDetails(exception.getResponse()),
      );
    }

    // Durum 2: workforce-service'e ulaşılamıyor → 503
    if (this.isConnectionRefused(exception)) {
      return this.send(
        response,
        HttpStatus.SERVICE_UNAVAILABLE,
        'Servise şu anda ulaşılamıyor',
      );
    }

    // Durum 1: workforce-service'ten gelen hata → servisin kodu ve mesajı
    if (this.isServiceError(exception)) {
      return this.send(response, exception.statusCode, exception.message, exception.details);
    }

    // Durum 4: diğer her şey → 500, ayrıntı sadece loga
    // Id'yi CorrelationIdMiddleware isteğe yazar; filter `new` ile kurulduğu için DI yerine buradan okunur
    const correlationId = host
      .switchToHttp()
      .getRequest<Request>()
      .headers[CORRELATION_ID_HEADER_LOWER];
    this.logger.error(
      `Internal Server Error correlationId=${correlationId ?? '-'}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );
    return this.send(
      response,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Beklenmeyen bir hata oluştu',
    );
  }

  // P2: details yalnızca sağlandığında yanıta eklenir.
  private send(response: Response, statusCode: number, message: string, details?: unknown) {
    return response.status(statusCode).json({ statusCode, message, ...(details !== undefined ? { details } : {}) });
  }

  private extractDetails(body: unknown): unknown {
    return typeof body === 'object' && body !== null && 'details' in body
      ? body.details : undefined;
  }

  // HttpException'ın içindeki mesajı tek bir metne çevirir
  private extractHttpMessage(exception: HttpException): string {
    const body = exception.getResponse();

    if (typeof body === 'string') return body;

    const message = (body as { message?: string | string[] }).message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;

    return exception.message;
  }

  private isConnectionRefused(exception: unknown): boolean {
    const err = exception as any;
    if (err?.code === 'ECONNREFUSED') return true;
    // Yeni Node sürümlerinde hata AggregateError içinde gelebilir
    return (
      Array.isArray(err?.errors) &&
      err.errors.some((e: any) => e?.code === 'ECONNREFUSED')
    );
  }

  private isServiceError(
    exception: unknown,
  ): exception is { statusCode: number; message: string; details?: unknown } {
    const err = exception as any;
    return (
      typeof err?.statusCode === 'number' && typeof err?.message === 'string'
    );
  }
}