import * as Joi from 'joi';

// Doğrulanmış ayarların tipi: ConfigService<WorkforceEnv, true> ile tipli okunur
export type WorkforceEnv = {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
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
