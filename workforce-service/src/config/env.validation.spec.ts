import { validateEnv } from './env.validation';

const validEnv = {
  DB_HOST: 'localhost',
  DB_PORT: '5433', // .env'den gelen değerler her zaman metindir
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_DATABASE: 'mini_wfm',
  RABBITMQ_URL: 'amqp://wfm:wfm@localhost:5672',
};

describe('workforce-service validateEnv', () => {
  it('geçerli ayarları kabul eder, portları sayıya çevirir ve varsayılanları doldurur', () => {
    const env = validateEnv(validEnv);

    expect(env.DB_PORT).toBe(5433);
    expect(env.PORT).toBe(4001);
    expect(env.NODE_ENV).toBe('development');
    expect(env.RABBITMQ_QUEUE).toBe('notification_events');
    expect(env.RABBITMQ_PUBLISH_TIMEOUT_MS).toBe(3000);
  });

  it('RABBITMQ_URL eksikse veya amqp adresi değilse hata verir', () => {
    const { RABBITMQ_URL: _removed, ...rest } = validEnv;

    expect(() => validateEnv(rest)).toThrow('"RABBITMQ_URL" is required');
    expect(() => validateEnv({ ...validEnv, RABBITMQ_URL: 'localhost' })).toThrow('"RABBITMQ_URL" must be a valid uri');
  });

  it('zorunlu bir değer eksikse hata verir ve değişkenin adını yazar', () => {
    const { DB_PASSWORD: _removed, ...withoutPassword } = validEnv;

    expect(() => validateEnv(withoutPassword)).toThrow('"DB_PASSWORD" is required');
  });

  it('port sayı değilse hata verir', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'abc' })).toThrow('"PORT" must be a number');
  });

  it('port aralık dışındaysa hata verir', () => {
    expect(() => validateEnv({ ...validEnv, DB_PORT: '70000' })).toThrow('"DB_PORT" must be a valid port');
  });

  it('tüm hatalı değerleri tek seferde listeler', () => {
    const { DB_HOST: _host, DB_PASSWORD: _password, ...rest } = validEnv;

    const run = () => validateEnv({ ...rest, PORT: 'abc', NODE_ENV: 'staging' });

    expect(run).toThrow('"DB_HOST" is required');
    expect(run).toThrow('"DB_PASSWORD" is required');
    expect(run).toThrow('"PORT" must be a number');
    expect(run).toThrow('"NODE_ENV" must be one of');
  });
});
