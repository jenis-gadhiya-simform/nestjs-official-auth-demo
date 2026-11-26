import { z } from 'zod';

// Empty values in .env count as "not set".
const optional = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  APP_URL: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.url(),
  // HS256 needs at least 32 bytes: openssl rand -base64 32
  JWT_SECRET: z.string().min(32),
  SMTP_URL: z.url(),
  MAIL_FROM: z.string().default('Notes <no-reply@example.com>'),

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  MICROSOFT_CLIENT_ID: optional,
  MICROSOFT_CLIENT_SECRET: optional,
  MICROSOFT_TENANT_ID: optional,
});

export type Env = z.infer<typeof envSchema>;

/** Stops the app at startup when a variable is missing or malformed. */
export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
