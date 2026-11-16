import { ArgumentsHost, ConflictException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let errorSpy: jest.SpyInstance;

  const createHost = (headers: Record<string, string> = {}) =>
    ({
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    response = { status: jest.fn(), json: jest.fn() };
    response.status.mockReturnValue(response);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('beklenmeyen hatada 500 döner ve logda correlation id ile stack bulunur', () => {
    const error = new Error('boom');

    filter.catch(error, createHost({ 'x-correlation-id': 'abc-123' }));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Beklenmeyen bir hata oluştu',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Internal Server Error correlationId=abc-123',
      error.stack,
    );
  });

  it('correlation id yoksa log yine yazılır', () => {
    filter.catch(new Error('boom'), createHost());

    expect(errorSpy).toHaveBeenCalledWith(
      'Internal Server Error correlationId=-',
      expect.any(String),
    );
  });

  it('beklenen iş kuralı hatası (409) kodunu korur ve hata logu yazmaz', () => {
    filter.catch(
      { statusCode: 409, message: 'Bu isimde bir ekip zaten var' },
      createHost({ 'x-correlation-id': 'abc-123' }),
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('HttpException kodunu korur ve hata logu yazmaz', () => {
    filter.catch(new ConflictException('Çakışma'), createHost());

    expect(response.status).toHaveBeenCalledWith(409);
    expect(errorSpy).not.toHaveBeenCalled();
  });
  it('servisten gelen tüm çakışma detaylarını korur', () => {
    const details = [
      { registrationNumber: '001', firstname: 'Ada', lastname: 'Yılmaz' },
      { registrationNumber: '002', firstname: 'Ali', lastname: 'Demir' },
    ];
    filter.catch({ statusCode: 409, message: 'Vardiya çakışması', details }, createHost());
    expect(response.json).toHaveBeenCalledWith({ statusCode: 409, message: 'Vardiya çakışması', details });
  });

  it('HTTP hatasının opsiyonel details alanını korur', () => {
    filter.catch(new ConflictException({ message: 'Çakışma', details: [] }), createHost());
    expect(response.json).toHaveBeenCalledWith({ statusCode: 409, message: 'Çakışma', details: [] });
  });

});
