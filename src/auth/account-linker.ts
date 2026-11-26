import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  OidcAccountResolver,
  type OidcProfile,
} from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';

/** Decides which local user a Google or Microsoft account signs in as. */
@Injectable()
export class AccountLinker extends OidcAccountResolver {
  constructor(
    private readonly users: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('oidc', this);
  }

  async resolveUser(profile: OidcProfile): Promise<User | null> {
    // Returning user: matched by provider + subject, never by email.
    const linked = await this.users.findByIdentity(
      profile.provider,
      profile.subject,
    );
    if (linked) return notAdmin(linked);

    // First visit: only trust an email the provider has verified.
    if (!profile.email || !isEmailVerified(profile)) return null; // 403

    const existing = await this.users.findByEmail(profile.email);
    if (!existing) {
      const user = await this.users.create(profile.email, {
        emailVerified: true,
      });
      await this.users.linkIdentity(user.id, profile.provider, profile.subject);
      return user;
    }

    // An existing account: link it only if its owner verified the email too.
    // Otherwise someone could sign up first with a victim's email and keep
    // access after the victim signs in with Google (account pre-hijacking).
    notAdmin(existing);
    if (!existing.emailVerified) {
      throw new ForbiddenException(
        'Verify your email address first, or sign in with your password',
      );
    }
    await this.users.linkIdentity(
      existing.id,
      profile.provider,
      profile.subject,
    );
    return existing;
  }
}

/** Admins sign in with email and password only. */
function notAdmin(user: User): User {
  if (user.role === 'admin') {
    throw new ForbiddenException('Admins sign in with email and password');
  }
  return user;
}

/**
 * Google sends `email_verified`; Microsoft Entra ID doesn't. Its equivalent
 * is the `xms_edov` optional claim, which you add to the ID token in the app
 * registration's Token configuration.
 */
export function isEmailVerified(profile: OidcProfile): boolean {
  if (profile.emailVerified) return true;
  return profile.provider === 'microsoft' && profile.claims.xms_edov === true;
}
