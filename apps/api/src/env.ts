import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().default('./data/prod.db'),

  // Email transport (real Resend if both set; console stub otherwise).
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Public origin used to build magic-link URLs.
  BASE_URL: z.string().url().default('http://localhost:3000'),

  // Session signing (REQUIRED in production; sane dev default).
  SESSION_SECRET: z.string().min(32).default('local-dev-session-secret-32-bytes-min'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

if (env.NODE_ENV === 'production') {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.warn(
      '[env] WARNING: NODE_ENV=production but RESEND_API_KEY/EMAIL_FROM not set. ' +
      'Magic-link emails will not be sent.'
    );
  }
}
