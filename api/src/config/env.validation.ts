
import * as Joi from 'joi';

// Doğrulanmış ortam değişkenlerinin tipleri
export type ApiEnv = {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  WORKFORCE_SERVICE_HOST: string;
  WORKFORCE_SERVICE_PORT: number;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
};

export const envValidationSchema = Joi.object<ApiEnv>({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  WORKFORCE_SERVICE_HOST: Joi.string()
    .hostname()
    .required(),

  WORKFORCE_SERVICE_PORT: Joi.number()
    .port()
    .required(),

  // JWT imzalama anahtarı
  JWT_SECRET: Joi.string()
    .min(32)
    .required(),

  // JWT geçerlilik süresi
  JWT_EXPIRES_IN: Joi.string()
    .valid('15m', '30m', '1h', '2h', '12h', '1d')
    .default('1h'),
});

export function validateEnv(config: Record<string, unknown>): ApiEnv {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    const messages = error.details
      .map((d) => `  - ${d.message}`)
      .join('\n');

    throw new Error(`Config validation error:\n${messages}`);
  }

  return value;
}
