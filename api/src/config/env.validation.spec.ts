import { validateEnv } from './env.validation';

const validEnv = {
  WORKFORCE_SERVICE_HOST: 'localhost',
  WORKFORCE_SERVICE_PORT: '4001', // .env'den gelen değerler her zaman metindir
};

describe('api validateEnv', () => {
  it('geçerli ayarları kabul eder, portları sayıya çevirir ve varsayılanları doldurur', () => {
    const env = validateEnv(validEnv);

    expect(env.WORKFORCE_SERVICE_PORT).toBe(4001);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('workforce-service adresi eksikse hata verir ve değişkenin adını yazar', () => {
    const { WORKFORCE_SERVICE_HOST: _removed, ...rest } = validEnv;

    expect(() => validateEnv(rest)).toThrow('"WORKFORCE_SERVICE_HOST" is required');
  });

  it('port sayı değilse hata verir', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'abc' })).toThrow('"PORT" must be a number');
  });

  it('tüm hatalı değerleri tek seferde listeler', () => {
    const run = () => validateEnv({ PORT: 'abc', WORKFORCE_SERVICE_PORT: 'xyz' });

    expect(run).toThrow('"PORT" must be a number');
    expect(run).toThrow('"WORKFORCE_SERVICE_HOST" is required');
    expect(run).toThrow('"WORKFORCE_SERVICE_PORT" must be a number');
  });
});
