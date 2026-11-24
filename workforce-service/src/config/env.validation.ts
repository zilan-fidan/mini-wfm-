import * as Joi from 'joi';
import { CronTime } from 'cron';

// Doğrulanmış ayarların tipi: ConfigService<WorkforceEnv, true> ile tipli okunur
export type WorkforceEnv = {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  RABBITMQ_URL: string;
  RABBITMQ_QUEUE: string;
  RABBITMQ_PUBLISH_TIMEOUT_MS: number;
  OVERDUE_CHECK_CRON: string;
};

export const envValidationSchema = Joi.object<WorkforceEnv>({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // workforce-service'in dinlediği TCP portu
  PORT: Joi.number().port().default(4001),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  // ör. amqp://wfm:wfm@localhost:5672 — RabbitMQ kapalı olsa da servis açılır (B23)
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .required(),
  // notification-service'teki RABBITMQ_QUEUE ile aynı olmalı
  RABBITMQ_QUEUE: Joi.string().default('notification_events'),
  // Olay yayını bu süreden uzun sürerse vazgeçilir ve hata loglanır
  RABBITMQ_PUBLISH_TIMEOUT_MS: Joi.number().integer().min(100).max(60000).default(3000),

  // Geciken iş emri kontrolünün aralığı (cron ifadesi). Geliştirmede "* * * * *" = her dakika.
  // Geçersiz ifade servisi açılışta durdurur; ilk tetiklenmede sessizce bozulmaz.
  OVERDUE_CHECK_CRON: Joi.string()
    .trim()
    .default('*/15 * * * *')
    .custom((value: string, helpers) => {
      try {
        new CronTime(value);
        return value;
      } catch (error) {
        return helpers.message({
          custom: `"OVERDUE_CHECK_CRON" geçerli bir cron ifadesi değil: ${(error as Error).message}`,
        });
      }
    }),
});

export function validateEnv(config: Record<string, unknown>): WorkforceEnv {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,   // tüm hataları tek seferde listele
    allowUnknown: true,  // PATH, HOME gibi sistem değişkenlerine izin ver
  });

  if (error) {
    const messages = error.details.map((d) => `  - ${d.message}`).join('\n');
    throw new Error(`Config validation error:\n${messages}`);
  }

  return value;
}
