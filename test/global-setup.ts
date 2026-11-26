import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './test-env.js';

/** Applies the migrations to the test database (notes_test, created by docker compose) before any test runs. */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  });
}
