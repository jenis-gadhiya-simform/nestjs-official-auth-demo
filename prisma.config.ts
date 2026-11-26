import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 doesn't read .env by itself. On a fresh clone there's no .env yet.
if (existsSync('.env')) process.loadEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  // Not env('DATABASE_URL'): it throws, and `prisma generate` runs on npm install before .env exists.
  datasource: { url: process.env.DATABASE_URL },
});
