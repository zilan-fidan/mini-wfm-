import { validateEnv } from './env.validation';

const validEnv = {
  DB_HOST: 'localhost',
  DB_PORT: '5433', // .env'den gelen değerler her zaman metindir
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_DATABASE: 'mini_wfm',
  RABBITMQ_URL: 'amqp://wfm:wfm@localhost:5672',
};

describe('notification-service validateEnv', () => {
  it('geçerli ayarları kabul eder, sayıları çevirir ve varsayılanları doldurur', () => {
    const env = validateEnv(validEnv);

    expect(env.DB_PORT).toBe(5433);
    expect(env.PORT).toBe(4002);
    expect(env.NODE_ENV).toBe('development');
    expect(env.RABBITMQ_QUEUE).toBe('notification_events');
    expect(env.RABBITMQ_PREFETCH).toBe(10);
  });

  it('RABBITMQ_URL eksikse hata verir', () => {
    const { RABBITMQ_URL: _removed, ...rest } = validEnv;

    expect(() => validateEnv(rest)).toThrow('"RABBITMQ_URL" is required');
  });

  it('RABBITMQ_URL amqp adresi değilse hata verir', () => {
    expect(() => validateEnv({ ...validEnv, RABBITMQ_URL: 'http://localhost:5672' })).toThrow(
      '"RABBITMQ_URL" must be a valid uri',
    );
  });

  it('tüm hatalı değerleri tek seferde listeler', () => {
    const { DB_HOST: _host, ...rest } = validEnv;

    const run = () => validateEnv({ ...rest, PORT: 'abc', RABBITMQ_PREFETCH: '0' });

    expect(run).toThrow('"DB_HOST" is required');
    expect(run).toThrow('"PORT" must be a number');
    expect(run).toThrow('"RABBITMQ_PREFETCH" must be greater than or equal to 1');
  });
});
