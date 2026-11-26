import { ForbiddenException } from '@nestjs/common';
import type {
  AuthenticationRegistry,
  OidcProfile,
} from '@nestjs/authentication';
import type { User } from '../users/user.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AccountLinker, isEmailVerified } from './account-linker.js';

describe('AccountLinker', () => {
  const ada: User = {
    id: 'u1',
    email: 'ada@notes.test',
    emailVerified: true,
    role: 'user',
  };
  const admin: User = {
    id: 'a1',
    email: 'admin@notes.test',
    emailVerified: true,
    role: 'admin',
  };
  const googleProfile: OidcProfile = {
    provider: 'google',
    subject: 'google-sub-1',
    email: 'ada@notes.test',
    emailVerified: true,
    claims: {},
  };

  const users = {
    findByIdentity: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    linkIdentity: vi.fn(),
  };
  const registry = {
    registerHandler: vi.fn(),
  } as unknown as AuthenticationRegistry;
  const linker = new AccountLinker(
    users as unknown as UsersRepository,
    registry,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    users.findByIdentity.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(ada);
  });

  it('signs a returning Google account in as its linked user', async () => {
    users.findByIdentity.mockResolvedValue(ada);
    await expect(linker.resolveUser(googleProfile)).resolves.toBe(ada);
  });

  it('creates and links a user on the first visit', async () => {
    await expect(linker.resolveUser(googleProfile)).resolves.toBe(ada);
    expect(users.create).toHaveBeenCalledWith('ada@notes.test', {
      emailVerified: true,
    });
    expect(users.linkIdentity).toHaveBeenCalledWith(
      'u1',
      'google',
      'google-sub-1',
    );
  });

  it('refuses an email the provider did not verify', async () => {
    await expect(
      linker.resolveUser({ ...googleProfile, emailVerified: false }),
    ).resolves.toBeNull();
    expect(users.create).not.toHaveBeenCalled();
  });

  it('links an existing account only when its email is verified', async () => {
    users.findByEmail.mockResolvedValue(ada);
    await expect(linker.resolveUser(googleProfile)).resolves.toBe(ada);

    users.findByEmail.mockResolvedValue({ ...ada, emailVerified: false });
    await expect(linker.resolveUser(googleProfile)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('never signs an admin in through Google or Microsoft', async () => {
    users.findByIdentity.mockResolvedValue(admin);
    await expect(linker.resolveUser(googleProfile)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    users.findByIdentity.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(admin);
    await expect(
      linker.resolveUser({ ...googleProfile, email: admin.email }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.linkIdentity).not.toHaveBeenCalled();
  });

  it("accepts Microsoft's xms_edov claim as a verified email", () => {
    const microsoftProfile = {
      ...googleProfile,
      provider: 'microsoft',
      emailVerified: false,
    };
    expect(isEmailVerified(microsoftProfile)).toBe(false);
    expect(
      isEmailVerified({ ...microsoftProfile, claims: { xms_edov: true } }),
    ).toBe(true);
  });
});
