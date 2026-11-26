import type { ConfigService } from '@nestjs/config';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrismaAuthenticationStore } from './prisma-authentication.store.js';

// The package's own contract tests, run against the PostgreSQL from docker compose.
describe('PrismaAuthenticationStore', () => {
  const config = {
    getOrThrow: () => process.env.TEST_DATABASE_URL,
  } as unknown as ConfigService;
  const prisma = new PrismaService(config);
  const store = new PrismaAuthenticationStore(prisma);

  afterAll(() => prisma.$disconnect());

  const cases = authenticationStoreContract(
    () => ({
      sessions: store,
      refreshTokens: store,
      emailTokens: store,
      oidcStates: store,
    }),
    {
      contracts: ['sessions', 'refreshTokens', 'emailTokens', 'oidcStates'],
      concurrent: true,
    },
  );

  for (const testCase of cases) {
    it(testCase.name, () => testCase.run());
  }
});
