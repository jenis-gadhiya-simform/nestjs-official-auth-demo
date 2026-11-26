import { Policy, type PolicyBefore } from '@nestjs/authorization';
import type { Note } from '../generated/prisma/client.js';
import type { User } from '../users/user.js';

/** Who may do what with a note. Each method is an ability. */
@Policy()
export class NotePolicy implements PolicyBefore<User> {
  // Runs before every ability: admins can do everything.
  before(user: User | null) {
    if (user?.role === 'admin') return true;
  }

  create(user: User | null) {
    return !!user;
  }

  view(user: User, note: Note) {
    return note.ownerId === user.id;
  }

  edit(user: User, note: Note) {
    return note.ownerId === user.id;
  }
}
