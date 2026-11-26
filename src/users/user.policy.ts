import { Policy } from '@nestjs/authorization';
import type { User } from './user.js';

@Policy()
export class UserPolicy {
  list(user: User | null) {
    return user?.role === 'admin';
  }
}
