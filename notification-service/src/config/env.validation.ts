import * as Joi from 'joi';

// Doğrulanmış ayarların tipi: ConfigService<NotificationEnv, true> ile tipli okunur
export type NotificationEnv = {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  RABBITMQ_URL: string;
  RABBITMQ_QUEUE: string;
  RABBITMQ_PREFETCH: number;
};

export const envValidationSchema = Joi.object<NotificationEnv>({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Bildirim okuma için TCP portu; HTTP portu açılmaz
  PORT: Joi.number().port().default(4002),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  // ör. amqp://wfm:wfm@localhost:5672
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  // workforce-service'teki RABBITMQ_QUEUE ile aynı olmalı
  RABBITMQ_QUEUE: Joi.string().default('notification_events'),
  // Ack'lenmemiş en fazla kaç mesaj aynı anda bu servise verilir
  RABBITMQ_PREFETCH: Joi.number().integer().min(1).max(1000).default(10),
});

export function validateEnv(config: Record<string, unknown>): NotificationEnv {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false, // tüm hataları tek seferde listele
    allowUnknown: true, // PATH, HOME gibi sistem değişkenlerine izin ver
  });

  if (error) {
    const messages = error.details.map((d) => `  - ${d.message}`).join('\n');
    throw new Error(`Config validation error:\n${messages}`);
  }

  return value;
}
