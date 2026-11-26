import { Injectable, Optional } from '@nestjs/common';
import {
  AuthenticationStorage,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
  type OidcStateStore,
  type OidcTransaction,
  type RefreshTokenRecord,
  type RefreshTokenStore,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Keeps the package's state in PostgreSQL instead of memory: sessions,
 * refresh tokens, emailed links and Google/Microsoft logins in progress.
 *
 * Single-use operations are one SQL statement each (a conditional UPDATE or
 * DELETE ... RETURNING), so two requests with the same token can't both win.
 * The package's contract tests check this in prisma-authentication.store.spec.ts.
 */
@Injectable()
export class PrismaAuthenticationStore
  implements SessionStore, RefreshTokenStore, EmailTokenStore, OidcStateStore
{
  constructor(
    private readonly prisma: PrismaService,
    @Optional() storage?: AuthenticationStorage,
  ) {
    storage?.registerSource({
      sessions: this,
      refreshTokens: this,
      emailTokens: this,
      oidcStates: this,
    });
  }

  // Sessions (Google and Microsoft sign-in)

  async getSession(id: string) {
    const row = await this.prisma.authSession.findUnique({ where: { id } });
    return row ? (withoutNulls(row) as SessionRecord) : undefined;
  }

  async createSession({ metadata, ...session }: SessionRecord) {
    await this.prisma.authSession.create({
      data: { ...session, metadata: json(metadata) },
    });
    await this.prisma.authSession.deleteMany({
      where: { expiresAt: { lte: session.createdAt } },
    });
  }

  async touchSession(id: string, lastActiveAt: Date) {
    await this.prisma.authSession.updateMany({
      where: { id, lastActiveAt: { lt: lastActiveAt } },
      data: { lastActiveAt },
    });
  }

  async deleteSession(id: string) {
    const { count } = await this.prisma.authSession.deleteMany({
      where: { id },
    });
    return count === 1;
  }

  async listUserSessions(userId: string) {
    const rows = await this.prisma.authSession.findMany({ where: { userId } });
    return rows.map((row) => withoutNulls(row) as SessionRecord);
  }

  async deleteUserSessions(userId: string) {
    await this.prisma.authSession.deleteMany({ where: { userId } });
  }

  // Refresh tokens

  async getRefreshToken(id: string) {
    const row = await this.prisma.authRefreshToken.findUnique({
      where: { id },
    });
    return row ? (withoutNulls(row) as RefreshTokenRecord) : undefined;
  }

  async saveRefreshToken({ claims, ...token }: RefreshTokenRecord) {
    await this.prisma.authRefreshToken.create({
      data: { ...token, claims: json(claims) },
    });
    await this.prisma.authRefreshToken.deleteMany({
      where: { familyExpiresAt: { lte: token.createdAt } },
    });
  }

  /** Of two refreshes with the same token, exactly one gets `true`; the other is a reuse. */
  async markRefreshTokenUsed(id: string, at: Date) {
    const { count } = await this.prisma.authRefreshToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: at },
    });
    return count === 1;
  }

  async revokeRefreshTokenFamily(familyId: string) {
    await this.prisma.authRevokedTokenFamily.createMany({
      data: { familyId },
      skipDuplicates: true,
    });
  }

  async isRefreshTokenFamilyRevoked(familyId: string) {
    return (
      (await this.prisma.authRevokedTokenFamily.count({
        where: { familyId },
      })) > 0
    );
  }

  async revokeUserRefreshTokens(userId: string) {
    await this.prisma.$executeRaw`
      INSERT INTO auth_revoked_token_families (family_id)
      SELECT DISTINCT family_id FROM auth_refresh_tokens WHERE user_id = ${userId}
      ON CONFLICT DO NOTHING`;
  }

  // Email verification and password reset links

  async saveEmailToken(token: EmailTokenRecord) {
    await this.prisma.authEmailToken.create({ data: token });
    await this.prisma.authEmailToken.deleteMany({
      where: { expiresAt: { lte: token.createdAt } },
    });
  }

  /** Get and delete in one statement: a link works once. */
  async consumeEmailToken(id: string, purpose: EmailTokenPurpose) {
    const [row] = await this.prisma.$queryRaw<EmailTokenRecord[]>`
      DELETE FROM auth_email_tokens WHERE id = ${id} AND purpose = ${purpose}
      RETURNING id, purpose, user_id AS "userId", email, fingerprint,
                created_at AS "createdAt", expires_at AS "expiresAt"`;
    return row ? (withoutNulls(row) as EmailTokenRecord) : undefined;
  }

  async deleteUserEmailTokens(userId: string, purpose: EmailTokenPurpose) {
    await this.prisma.authEmailToken.deleteMany({ where: { userId, purpose } });
  }

  // Google and Microsoft logins in progress

  async saveOidcState({ link, ...login }: OidcTransaction) {
    await this.prisma.authOidcState.create({
      data: {
        ...login,
        linkUserId: link?.userId,
        linkSessionId: link?.sessionId,
      },
    });
    await this.prisma.authOidcState.deleteMany({
      where: { expiresAt: { lte: login.createdAt } },
    });
  }

  /** Get and delete in one statement: a callback is accepted once. */
  async consumeOidcState(state: string) {
    const [row] = await this.prisma.$queryRaw<OidcStateRow[]>`
      DELETE FROM auth_oidc_states WHERE state = ${state}
      RETURNING state, provider, nonce, code_verifier AS "codeVerifier", redirect_to AS "redirectTo",
                created_at AS "createdAt", expires_at AS "expiresAt",
                link_user_id AS "linkUserId", link_session_id AS "linkSessionId"`;
    if (!row) return undefined;
    const { linkUserId, linkSessionId, ...login } = withoutNulls(row);
    const link =
      linkUserId && linkSessionId
        ? { userId: linkUserId, sessionId: linkSessionId }
        : undefined;
    return { ...login, ...(link && { link }) } as OidcTransaction;
  }
}

type OidcStateRow = Omit<OidcTransaction, 'link'> & {
  linkUserId: string | null;
  linkSessionId: string | null;
};

/** Stores an optional JSON value; `undefined` becomes SQL NULL. */
const json = (value: Record<string, unknown> | undefined) =>
  (value as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull;

/** The package expects missing optional fields to be absent, not `null`. */
function withoutNulls<T extends object>(row: T) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== null),
  ) as {
    [K in keyof T]: Exclude<T[K], null>;
  };
}
