import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(email: string, password: string): Promise<User> {
    const passwordHash = await this.passwordHasher.hash(password);
    return this.users.create(email, { passwordHash });
  }

  /** The user, or `null` when the email or the password is wrong. */
  async verify(email: string, password: string): Promise<User | null> {
    const found = await this.users.findCredentials(email);
    // With no account, verify() checks a dummy hash, so an unknown email
    // takes as long as a wrong password and timing reveals nothing.
    const valid = await this.passwordHasher.verify(
      password,
      found?.passwordHash,
    );
    return valid && found ? found.user : null;
  }
}
