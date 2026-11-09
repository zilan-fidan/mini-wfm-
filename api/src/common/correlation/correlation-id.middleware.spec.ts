import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import { lastValueFrom, of } from 'rxjs';
import { CorrelationContextService } from './correlation-context.service';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import {
  CorrelationIdMiddleware,
  resolveCorrelationId,
} from './correlation-id.middleware';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveCorrelationId', () => {
  it('geçerli değeri aynen döndürür', () => {
    expect(resolveCorrelationId('test-correlation-123')).toBe(
      'test-correlation-123',
    );
  });

  it('değer yoksa UUID üretir', () => {
    expect(resolveCorrelationId(undefined)).toMatch(UUID_PATTERN);
  });

  it.each([
    ['boş', ''],
    ['129 karakter', 'a'.repeat(129)],
    ['satır sonu içeren', 'abc\nsahte-log'],
    ['birleştirilmiş tekrar header', 'a, b'],
    ['dizi', ['a', 'b']],
  ])('%s değeri kullanmaz, UUID üretir', (_, value) => {
    expect(resolveCorrelationId(value)).toMatch(UUID_PATTERN);
  });

  it('tam 128 karakteri kabul eder', () => {
    const value = 'a'.repeat(128);
    expect(resolveCorrelationId(value)).toBe(value);
  });
});

describe('CorrelationIdMiddleware', () => {
  let context: CorrelationContextService;
  let middleware: CorrelationIdMiddleware;
  let res: EventEmitter & { setHeader: jest.Mock; statusCode: number };
  let idInsideNext: string | undefined;
  let next: jest.Mock;

  const createRequest = (headers: Record<string, string> = {}) =>
    ({ method: 'GET', originalUrl: '/api/olmayan', headers }) as unknown as Request;

  const run = (req: Request) =>
    middleware.use(req, res as unknown as Response, next as NextFunction);

  beforeEach(() => {
    context = new CorrelationContextService();
    middleware = new CorrelationIdMiddleware(context);
    res = Object.assign(new EventEmitter(), { setHeader: jest.fn(), statusCode: 200 });
    idInsideNext = undefined;
    // next içinde ALS'den okunan değer, bağlamın gerçekten açıldığını gösterir
    next = jest.fn(() => {
      idInsideNext = context.getCorrelationId();
    });
  });

  it('header yoksa UUID üretir, yanıta ve isteğe yazar, bağlamı başlatır', () => {
    const req = createRequest();

    run(req);

    const [name, id] = res.setHeader.mock.calls[0];
    expect(name).toBe('X-Correlation-Id');
    expect(id).toMatch(UUID_PATTERN);
    expect(req.headers['x-correlation-id']).toBe(id);
    expect(idInsideNext).toBe(id);
  });

  it('header varsa aynı değeri kullanır, yeni id üretmez', () => {
    const req = createRequest({ 'x-correlation-id': 'test-correlation-123' });

    run(req);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Correlation-Id',
      'test-correlation-123',
    );
    expect(req.headers['x-correlation-id']).toBe('test-correlation-123');
    expect(idInsideNext).toBe('test-correlation-123');
  });

  it('geçersiz header gelirse onun yerine UUID yazar', () => {
    const req = createRequest({ 'x-correlation-id': 'abc\nsahte-log' });

    run(req);

    const [, id] = res.setHeader.mock.calls[0];
    expect(id).toMatch(UUID_PATTERN);
    expect(req.headers['x-correlation-id']).toBe(id);
  });

  it('next tam olarak bir kez çağrılır ve bağlam sonra kapanır', () => {
    run(createRequest());

    expect(next).toHaveBeenCalledTimes(1);
    expect(context.getCorrelationId()).toBeUndefined();
  });

  describe('erişim logu fallback', () => {
    let logSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    const allLogCalls = () =>
      logSpy.mock.calls.length + warnSpy.mock.calls.length + errorSpy.mock.calls.length;

    beforeEach(() => {
      logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('interceptor\'a ulaşmayan istek (bilinmeyen route) middleware tarafından loglanır', () => {
      run(createRequest({ 'x-correlation-id': 'abc-123' }));
      res.statusCode = 404;
      res.emit('finish');

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /^GET \/api\/olmayan statusCode=404 duration=\d+ms correlationId=abc-123$/,
        ),
      );
    });

    it('interceptor çalıştıysa middleware log yazmaz; istek başına tek log', async () => {
      const interceptor = new HttpLoggingInterceptor(context);
      const req = createRequest({ 'x-correlation-id': 'abc-123' });
      const executionContext = {
        getType: () => 'http',
        switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      } as unknown as ExecutionContext;
      const handler: CallHandler = { handle: () => of('ok') };

      // Gerçek akış: middleware next() ile interceptor'ı kendi bağlamının içinde çalıştırır
      let result: Promise<unknown> = Promise.resolve();
      next.mockImplementation(() => {
        result = lastValueFrom(interceptor.intercept(executionContext, handler));
      });

      run(req);
      await result;
      res.emit('finish');

      expect(allLogCalls()).toBe(1);
    });
  });
});
