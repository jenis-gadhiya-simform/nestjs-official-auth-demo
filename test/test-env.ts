/** Settings for tests. PostgreSQL comes from `docker compose up -d`. */
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://notes:notes@localhost:5434/notes_test';

export const testEnv = {
  APP_URL: 'http://localhost:3000',
  DATABASE_URL: testDatabaseUrl,
  TEST_DATABASE_URL: testDatabaseUrl,
  SMTP_URL: 'smtp://localhost:1026',
  JWT_SECRET: 'test-only-jwt-secret-of-at-least-32-bytes',
  GOOGLE_CLIENT_ID: 'notes.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-only-google-secret',
  MICROSOFT_CLIENT_ID: '00000000-0000-0000-0000-000000000001',
  MICROSOFT_CLIENT_SECRET: 'test-only-microsoft-secret',
  MICROSOFT_TENANT_ID: '00000000-0000-0000-0000-000000000002',
};
