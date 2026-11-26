import type { User } from '../users/user.js';

// Types @CurrentUser(), AuthenticationContext and the providers with our User.
declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
  }
}
