import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

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
      return this.send(response, exception.statusCode, exception.message);
    }

    // Durum 4: diğer her şey → 500, ayrıntı sadece loga
    this.logger.error(
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );
    return this.send(
      response,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Beklenmeyen bir hata oluştu',
    );
  }

  // P2: hata yanıtı her zaman { statusCode, message }
  private send(response: Response, statusCode: number, message: string) {
    return response.status(statusCode).json({ statusCode, message });
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
  ): exception is { statusCode: number; message: string } {
    const err = exception as any;
    return (
      typeof err?.statusCode === 'number' && typeof err?.message === 'string'
    );
  }
}