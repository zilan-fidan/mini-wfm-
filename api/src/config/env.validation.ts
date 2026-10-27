import * as Joi from 'joi';

// Doğrulanmış ayarların tipi: ConfigService<ApiEnv, true> ile tipli okunur
export type ApiEnv = {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  WORKFORCE_SERVICE_HOST: string;
  WORKFORCE_SERVICE_PORT: number;
};

export const envValidationSchema = Joi.object<ApiEnv>({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // api'nin HTTP portu
  PORT: Joi.number().port().default(3000),

  // api'nin bağlandığı workforce-service adresi (zorunlu)
  WORKFORCE_SERVICE_HOST: Joi.string().hostname().required(),
  WORKFORCE_SERVICE_PORT: Joi.number().port().required(),
});

export function validateEnv(config: Record<string, unknown>): ApiEnv {
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
