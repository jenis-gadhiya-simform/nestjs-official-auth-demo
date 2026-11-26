import type { Note } from '../generated/prisma/client.js';
import type { User } from '../users/user.js';
import { NotePolicy } from './note.policy.js';

describe('NotePolicy', () => {
  const policy = new NotePolicy();
  const user = (id: string, role: User['role'] = 'user'): User => ({
    id,
    email: `${id}@notes.test`,
    emailVerified: true,
    role,
  });
  const note = { id: 'n1', ownerId: 'alice' } as Note;

  it('lets admins do everything', () => {
    expect(policy.before(user('admin', 'admin'))).toBe(true);
    expect(policy.before(user('alice'))).toBeUndefined();
  });

  it('lets signed-in users create notes', () => {
    expect(policy.create(user('alice'))).toBe(true);
    expect(policy.create(null)).toBe(false);
  });

  it('lets only the owner view and edit a note', () => {
    expect(policy.view(user('alice'), note)).toBe(true);
    expect(policy.edit(user('alice'), note)).toBe(true);
    expect(policy.view(user('bob'), note)).toBe(false);
    expect(policy.edit(user('bob'), note)).toBe(false);
  });
});
