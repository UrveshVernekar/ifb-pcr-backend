import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database Configuration
  DB_CLIENT: z.enum(['pg', 'mysql2', 'mssql']).default('pg'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('ifb_pcr'),
  DB_SCHEMA: z.string().default('public'),

  // Redis Configuration
  REDIS_ENABLED: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean()
  ).default(false),
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),

  // JWT configuration
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters long'),
  JWT_REFRESH_SECRET: z.string().min(8, 'JWT_REFRESH_SECRET must be at least 8 characters long'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),

  // Mail Configuration
  MAIL_HOST: z.string().default('smtp.gmail.com'),
  MAIL_PORT: z.coerce.number().default(587),
  MAIL_USERNAME: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),

  // Captcha Configuration
  ALTCHA_SECRET: z.string().min(8, 'ALTCHA_SECRET must be at least 8 characters long'),

  // Decryption Keys
  PRIVATE_KEY_PATH: z.string().default('./private.pem'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
