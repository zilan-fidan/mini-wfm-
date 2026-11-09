import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { lastValueFrom, of, throwError } from 'rxjs';
import { CorrelationContextService } from './correlation-context.service';
import { RpcLoggingInterceptor } from './rpc-logging.interceptor';

describe('RpcLoggingInterceptor', () => {
  let correlation: CorrelationContextService;
  let interceptor: RpcLoggingInterceptor;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const createContext = (type: string) =>
    ({
      getType: () => type,
      switchToRpc: () => ({
        getContext: () => ({ getPattern: () => 'createTeam' }),
      }),
    }) as unknown as ExecutionContext;

  // Hook'un kurduğu bağlamı taklit eder; startedAt 100, "şimdi" 108 → süre 8ms
  const intercept = (handler: CallHandler, type = 'rpc') =>
    correlation.run({ correlationId: 'abc-123', startedAt: 100 }, () =>
      interceptor.intercept(createContext(type), handler),
    );

  const allLogCalls = () =>
    logSpy.mock.calls.length + warnSpy.mock.calls.length + errorSpy.mock.calls.length;

  beforeEach(() => {
    correlation = new CorrelationContextService();
    interceptor = new RpcLoggingInterceptor(correlation);

    jest.spyOn(performance, 'now').mockReturnValue(108);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('başarılı mesajda pattern, correlation id ve süre loglanır', async () => {
    await expect(lastValueFrom(intercept({ handle: () => of({ id: 1 }) }))).resolves.toEqual({
      id: 1,
    });

    expect(logSpy).toHaveBeenCalledWith('createTeam correlationId=abc-123 duration=8ms');
  });

  it('iş kuralı hatası warn ile statusCode içerecek şekilde loglanır ve aynen iletilir', async () => {
    const error = new RpcException({ statusCode: 409, message: 'Bu isimde bir ekip zaten var' });

    await expect(
      lastValueFrom(intercept({ handle: () => throwError(() => error) })),
    ).rejects.toBe(error);

    expect(warnSpy).toHaveBeenCalledWith(
      'createTeam correlationId=abc-123 duration=8ms statusCode=409',
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('beklenmeyen hata error seviyesinde stack ile loglanır', async () => {
    const error = new Error('db down');

    await expect(
      lastValueFrom(intercept({ handle: () => throwError(() => error) })),
    ).rejects.toBe(error);

    expect(errorSpy).toHaveBeenCalledWith(
      'createTeam correlationId=abc-123 duration=8ms',
      error.stack,
    );
  });

  it('getError string döndüğünde çökmez, statusCode=- yazar', async () => {
    await expect(
      lastValueFrom(intercept({ handle: () => throwError(() => new RpcException('düz metin')) })),
    ).rejects.toBeInstanceOf(RpcException);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('statusCode=-'));
  });

  it('bir mesaj için yalnızca bir log üretilir', async () => {
    await lastValueFrom(intercept({ handle: () => of('ok') }));

    expect(allLogCalls()).toBe(1);
  });

  it('rpc dışındaki context\'lere dokunmaz', async () => {
    await lastValueFrom(intercept({ handle: () => of('ok') }, 'http'));

    expect(allLogCalls()).toBe(0);
  });
});
