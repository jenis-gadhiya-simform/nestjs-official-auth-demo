// Creates the admin account from ADMIN_EMAIL and ADMIN_PASSWORD in .env: npm run db:seed
import { PasswordHasher } from '@nestjs/authentication';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

process.loadEnvFile();
const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD)
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});
const email = ADMIN_EMAIL.trim().normalize('NFC').toLowerCase();
const passwordHash = await new PasswordHasher().hash(ADMIN_PASSWORD);

await prisma.user.upsert({
  where: { email },
  create: { email, passwordHash, emailVerified: true, role: 'admin' },
  update: { passwordHash, role: 'admin' },
});
await prisma.$disconnect();
console.log(`Admin ready: ${email}`);
