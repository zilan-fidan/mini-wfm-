import { CallHandler, ConflictException, ExecutionContext, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { lastValueFrom, of, throwError } from 'rxjs';
import { CorrelationContextService } from './correlation-context.service';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

describe('HttpLoggingInterceptor', () => {
  let correlation: CorrelationContextService;
  let interceptor: HttpLoggingInterceptor;
  let res: EventEmitter & { statusCode: number };
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const req = {
    method: 'POST',
    originalUrl: '/api/teams',
    headers: { 'x-correlation-id': 'abc-123' },
  };

  const createContext = (type = 'http') =>
    ({
      getType: () => type,
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    }) as unknown as ExecutionContext;

  // Middleware'in kurduğu bağlamı taklit eder; startedAt 100, "şimdi" 145 → süre 45ms
  const intercept = (handler: CallHandler, type?: string) =>
    correlation.run({ correlationId: 'abc-123', startedAt: 100 }, () =>
      interceptor.intercept(createContext(type), handler),
    );

  const allLogCalls = () =>
    logSpy.mock.calls.length + warnSpy.mock.calls.length + errorSpy.mock.calls.length;

  beforeEach(() => {
    correlation = new CorrelationContextService();
    interceptor = new HttpLoggingInterceptor(correlation);
    res = Object.assign(new EventEmitter(), { statusCode: 200 });

    jest.spyOn(performance, 'now').mockReturnValue(145);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('başarılı istekte method, url, statusCode, süre ve correlation id loglanır', async () => {
    const handler = { handle: () => of({ id: 1 }) };

    await expect(lastValueFrom(intercept(handler))).resolves.toEqual({ id: 1 });
    res.statusCode = 201;
    res.emit('finish');

    expect(logSpy).toHaveBeenCalledWith(
      'POST /api/teams statusCode=201 duration=45ms correlationId=abc-123',
    );
  });

  it('hatalı istekte hata aynen iletilir ve filter\'ın belirlediği gerçek kod loglanır', async () => {
    const error = new ConflictException('Bu isimde bir ekip zaten var');
    const handler = { handle: () => throwError(() => error) };

    await expect(lastValueFrom(intercept(handler))).rejects.toBe(error);

    // Hata anında henüz log yok: status hâlâ 200 olduğu için yazılsaydı yanlış olurdu
    expect(allLogCalls()).toBe(0);

    // Exception filter yanıtı 409 ile gönderir
    res.statusCode = 409;
    res.emit('finish');

    expect(warnSpy).toHaveBeenCalledWith(
      'POST /api/teams statusCode=409 duration=45ms correlationId=abc-123',
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('5xx yanıtları error seviyesinde loglanır', async () => {
    await expect(
      lastValueFrom(intercept({ handle: () => throwError(() => new Error('boom')) })),
    ).rejects.toThrow('boom');
    res.statusCode = 500;
    res.emit('finish');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('statusCode=500'));
  });

  it('bir istek için yalnızca bir erişim logu üretilir', async () => {
    await lastValueFrom(intercept({ handle: () => of('ok') }));
    res.emit('finish');
    res.emit('finish');

    expect(allLogCalls()).toBe(1);
  });

  it('store\'u işaretler; middleware fallback logu yazmaz', () => {
    const store = { correlationId: 'abc-123', startedAt: 100 };

    correlation.run(store, () =>
      interceptor.intercept(createContext(), { handle: () => of('ok') }),
    );

    expect(store).toHaveProperty('handledByInterceptor', true);
  });

  it('http dışındaki context\'lere dokunmaz', async () => {
    await lastValueFrom(intercept({ handle: () => of('ok') }, 'rpc'));

    expect(res.listenerCount('finish')).toBe(0);
  });
});
