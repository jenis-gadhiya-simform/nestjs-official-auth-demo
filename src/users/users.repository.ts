import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from './user.js';

// Every query returns these columns only, so the password hash never leaks into a response.
const userColumns = {
  id: true,
  email: true,
  emailVerified: true,
  role: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    email: string,
    data: { passwordHash?: string; emailVerified?: boolean } = {},
  ): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: { email: normalize(email), ...data },
        select: userColumns,
      });
    } catch (error) {
      // The unique index on email
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id }, select: userColumns });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: normalize(email) },
      select: userColumns,
    });
  }

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      select: userColumns,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** The user and their password hash: for sign-in and password reset only. */
  async findCredentials(email: string) {
    const row = await this.prisma.user.findUnique({
      where: { email: normalize(email) },
      select: { ...userColumns, passwordHash: true },
    });
    if (!row) return null;
    const { passwordHash, ...user } = row;
    return { user, passwordHash };
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /** Marks the email verified, but only if it is still the user's email. */
  async markEmailVerified(id: string, email: string): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: { id, email: normalize(email) },
      data: { emailVerified: true },
    });
    return count === 1;
  }

  async findByIdentity(
    provider: string,
    subject: string,
  ): Promise<User | null> {
    const identity = await this.prisma.identity.findUnique({
      where: { provider_subject: { provider, subject } },
      select: { user: { select: userColumns } },
    });
    return identity?.user ?? null;
  }

  async linkIdentity(
    userId: string,
    provider: string,
    subject: string,
  ): Promise<void> {
    await this.prisma.identity.create({ data: { provider, subject, userId } });
  }
}

// The same form the package passes emails in.
const normalize = (email: string) =>
  email.trim().normalize('NFC').toLowerCase();
