import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PasswordHasher } from '@nestjs/authentication';
import { InMemoryMailTransport, MailTransport } from '@nestjs/mail';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { VerifyEmailMail } from '../src/auth/email-verification.mailer.js';
import { PasswordResetMail } from '../src/auth/password-reset.mailer.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Boots the real AppModule on the notes_test database (docker compose up -d).
// Mail goes to an in-memory mailbox, and scrypt runs at a cheap cost.
describe('Notes API (e2e)', () => {
  const mailbox = new InMemoryMailTransport();
  // Cheap scrypt for tests only: the default cost is ~0.3 s and 128 MiB per hash.
  const hasher = new PasswordHasher({ logN: 10 });
  let app: INestApplication<App>;
  let http: () => ReturnType<typeof request>;

  const admin = { email: 'admin@notes.test', password: 'admin-test-password' };
  const alice = { email: 'alice@notes.test', password: 'alice-test-password' };
  const bob = { email: 'bob@notes.test', password: 'bob-test-password' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailTransport)
      .useValue(mailbox)
      .overrideProvider(PasswordHasher)
      .useValue(hasher)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    http = () => request(app.getHttpServer());

    // A clean database, and the seeded admin.
    const prisma = app.get(PrismaService);
    await prisma.$executeRaw`TRUNCATE users, identities, notes, auth_sessions, auth_refresh_tokens,
      auth_revoked_token_families, auth_email_tokens, auth_oidc_states CASCADE`;
    await prisma.user.create({
      data: {
        email: admin.email,
        passwordHash: await hasher.hash(admin.password),
        emailVerified: true,
        role: 'admin',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const signIn = async (credentials: { email: string; password: string }) => {
    const res = await http().post('/auth/token').send(credentials).expect(200);
    return res.body as {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
  };
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('closed by default', () => {
    it('answers 401 to anonymous requests', async () => {
      await http().get('/me').expect(401);
      await http().get('/notes').expect(401);
      await http().get('/admin/users').expect(401);
    });
  });

  describe('sign-up and email verification', () => {
    it('signs a user up with tokens, and verifies the address from the emailed link', async () => {
      const res = await http().post('/auth/sign-up').send(alice).expect(201);
      expect(res.body.user).toMatchObject({
        email: alice.email,
        role: 'user',
        emailVerified: false,
      });
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));

      const token = mailbox
        .assertSent({ to: alice.email, mail: VerifyEmailMail })
        .link('/verify-email')
        .searchParams.get('token');
      await http().post('/auth/email/verify').send({ token }).expect(200);
      // A link works once.
      await http().post('/auth/email/verify').send({ token }).expect(400);

      const me = await http()
        .get('/me')
        .set(bearer(res.body.accessToken))
        .expect(200);
      expect(me.body).toEqual({
        id: res.body.user.id,
        email: alice.email,
        emailVerified: true,
        role: 'user',
      });
    });

    it('refuses a taken address, a short password and a malformed body', async () => {
      await http()
        .post('/auth/sign-up')
        .send({ ...alice, password: 'another-long-password' })
        .expect(409);
      await http()
        .post('/auth/sign-up')
        .send({ email: 'short@notes.test', password: 'short' })
        .expect(400);
      await http()
        .post('/auth/sign-up')
        .send({ email: 'not-an-email', password: 'long-enough-password' })
        .expect(400);
    });
  });

  describe('password sign-in and tokens', () => {
    it('answers a wrong password and an unknown email the same way', async () => {
      const wrong = await http()
        .post('/auth/token')
        .send({ ...alice, password: 'not-the-password' })
        .expect(401);
      const unknown = await http()
        .post('/auth/token')
        .send({ email: 'nobody@notes.test', password: 'whatever-password' })
        .expect(401);
      expect(wrong.body).toEqual(unknown.body);
    });

    it('rotates refresh tokens, and revokes the family when a spent one comes back', async () => {
      const first = await signIn(alice);
      const second = (
        await http()
          .post('/auth/token/refresh')
          .send({ refreshToken: first.refreshToken })
          .expect(200)
      ).body;
      await http().get('/me').set(bearer(second.accessToken)).expect(200);

      // The spent token again: theft. Both it and its successor stop working.
      await http()
        .post('/auth/token/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(401);
      await http()
        .post('/auth/token/refresh')
        .send({ refreshToken: second.refreshToken })
        .expect(401);
    });

    it('signs out by revoking the refresh token', async () => {
      const tokens = await signIn(alice);
      await http()
        .post('/auth/token/revoke')
        .send({ refreshToken: tokens.refreshToken })
        .expect(204);
      await http()
        .post('/auth/token/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });

    it('rejects a forged access token', async () => {
      await http()
        .get('/me')
        .set(bearer('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forged'))
        .expect(401);
    });
  });

  describe('notes and ownership', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;
    let aliceNoteId: string;

    beforeAll(async () => {
      await http().post('/auth/sign-up').send(bob).expect(201);
      aliceToken = (await signIn(alice)).accessToken;
      bobToken = (await signIn(bob)).accessToken;
      adminToken = (await signIn(admin)).accessToken;
    });

    it('lets a user create, read, edit and list their own notes', async () => {
      const created = await http()
        .post('/notes')
        .set(bearer(aliceToken))
        .send({ title: 'Groceries', content: 'Milk' })
        .expect(201);
      aliceNoteId = created.body.id;

      await http()
        .get(`/notes/${aliceNoteId}`)
        .set(bearer(aliceToken))
        .expect(200);
      const edited = await http()
        .patch(`/notes/${aliceNoteId}`)
        .set(bearer(aliceToken))
        .send({ content: 'Milk, eggs' })
        .expect(200);
      expect(edited.body).toMatchObject({
        title: 'Groceries',
        content: 'Milk, eggs',
      });

      const list = await http()
        .get('/notes')
        .set(bearer(aliceToken))
        .expect(200);
      expect(list.body.map((note: { id: string }) => note.id)).toEqual([
        aliceNoteId,
      ]);
    });

    it("answers 404 for someone else's note, so its existence stays secret", async () => {
      await http()
        .get(`/notes/${aliceNoteId}`)
        .set(bearer(bobToken))
        .expect(404);
      await http()
        .patch(`/notes/${aliceNoteId}`)
        .set(bearer(bobToken))
        .send({ title: 'Mine now' })
        .expect(404);
      await http()
        .delete(`/notes/${aliceNoteId}`)
        .set(bearer(bobToken))
        .expect(404);
      expect(
        (await http().get('/notes').set(bearer(bobToken)).expect(200)).body,
      ).toEqual([]);
    });

    it('validates the body and the id', async () => {
      await http()
        .post('/notes')
        .set(bearer(aliceToken))
        .send({ content: 'no title' })
        .expect(400);
      await http()
        .patch(`/notes/${aliceNoteId}`)
        .set(bearer(aliceToken))
        .send({})
        .expect(400);
      // A partial update leaves the other fields alone.
      const renamed = await http()
        .patch(`/notes/${aliceNoteId}`)
        .set(bearer(aliceToken))
        .send({ title: 'Shopping' })
        .expect(200);
      expect(renamed.body).toMatchObject({
        title: 'Shopping',
        content: 'Milk, eggs',
      });
      await http().get('/notes/not-a-uuid').set(bearer(aliceToken)).expect(400);
    });

    it('lets the admin see and edit every note, through the policy before()', async () => {
      const list = await http()
        .get('/notes')
        .set(bearer(adminToken))
        .expect(200);
      expect(list.body.map((note: { id: string }) => note.id)).toContain(
        aliceNoteId,
      );
      await http()
        .patch(`/notes/${aliceNoteId}`)
        .set(bearer(adminToken))
        .send({ title: 'Moderated' })
        .expect(200);
      await http()
        .delete(`/notes/${aliceNoteId}`)
        .set(bearer(adminToken))
        .expect(204);
      await http()
        .get(`/notes/${aliceNoteId}`)
        .set(bearer(aliceToken))
        .expect(404);
    });

    it('keeps the user list for admins: 403 for a signed-in user', async () => {
      await http().get('/admin/users').set(bearer(bobToken)).expect(403);
      const users = await http()
        .get('/admin/users')
        .set(bearer(adminToken))
        .expect(200);
      expect(users.body.map((user: { email: string }) => user.email)).toEqual(
        expect.arrayContaining([admin.email, alice.email, bob.email]),
      );
      // Password hashes never leave the repository.
      expect(JSON.stringify(users.body)).not.toContain('passwordHash');
    });
  });

  describe('forgot and reset password', () => {
    it('answers 202 whether or not the address has an account', async () => {
      await http()
        .post('/auth/password/forgot')
        .send({ email: 'nobody-here@notes.test' })
        .expect(202);
    });

    it('resets the password from the emailed link, and signs out every token', async () => {
      const before = await signIn(bob);

      await http()
        .post('/auth/password/forgot')
        .send({ email: bob.email })
        .expect(202);
      // The email goes out after the response, which doesn't wait for it.
      const mail = await vi.waitFor(() =>
        mailbox.assertSent({ to: bob.email, mail: PasswordResetMail }),
      );
      const token = mail.link('/reset-password').searchParams.get('token');

      await http()
        .post('/auth/password/reset')
        .send({ token, password: 'too-short' })
        .expect(400);
      await http()
        .post('/auth/password/reset')
        .send({ token, password: 'bobs-brand-new-passphrase' })
        .expect(200);
      // A link works once.
      await http()
        .post('/auth/password/reset')
        .send({ token, password: 'bobs-other-passphrase' })
        .expect(400);

      // Whoever knew the old password is signed out.
      await http()
        .post('/auth/token/refresh')
        .send({ refreshToken: before.refreshToken })
        .expect(401);
      await http().post('/auth/token').send(bob).expect(401);
      await signIn({ email: bob.email, password: 'bobs-brand-new-passphrase' });
    });
  });
});
