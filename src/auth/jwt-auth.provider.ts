import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import type { User } from '../users/user.js';
import { UsersRepository } from '../users/users.repository.js';

/** Signs in requests that carry `Authorization: Bearer <access token>`. */
@Injectable()
export class JwtAuth extends JwtBearerProvider<User> {
  constructor(
    private readonly users: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this, { order: 1 });
  }

  // Loads the user on every request, so a deleted user or changed role applies at once.
  validate({ sub }: JwtClaims) {
    return sub ? this.users.findById(sub) : null;
  }
}
