# Notes API: NestJS official authentication and authorization

A small Notes API built with NestJS 12's first-party [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication) and [`@nestjs/authorization`](https://docs.nestjs.com/security/authorization), Prisma and PostgreSQL.

- **Admin**: seeded, signs in with email and password only. Can manage every note and list users.
- **Users**: sign up and sign in with email and password, or with Google or Microsoft. They can only see and change their own notes.
- Email verification, forgot and reset password, JWT access tokens with rotating refresh tokens.

## Run it

Requirements: Node.js 22+ and Docker.

```bash
cp .env.example .env          # then set JWT_SECRET: openssl rand -base64 32
npm install
docker compose up -d          # PostgreSQL on :5434, Mailpit on :1026 (SMTP) and :8026 (inbox)
npx prisma migrate deploy     # create the tables
npm run db:seed               # create the admin from ADMIN_EMAIL and ADMIN_PASSWORD
npm run start:dev
```

Verification and password reset emails land in Mailpit: http://localhost:8026.

## Try it

```bash
# Sign up: returns the user, an access token and a refresh token
curl -X POST localhost:3000/auth/sign-up -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","password":"correct horse battery"}'

# Sign in (admins and users)
TOKEN=$(curl -s -X POST localhost:3000/auth/token -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","password":"correct horse battery"}' | jq -r .accessToken)

curl localhost:3000/me -H "authorization: Bearer $TOKEN"
curl -X POST localhost:3000/notes -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"title":"First note","content":"Hello"}'
```

## Endpoints

| Method and path | Who | What |
| --- | --- | --- |
| `POST /auth/sign-up` | public | Creates a user, emails a verification link, returns tokens |
| `POST /auth/token` | public | Email and password sign-in |
| `POST /auth/token/refresh` | public | New tokens; a reused refresh token revokes the whole sign-in |
| `POST /auth/token/revoke` | public | Sign-out for token clients |
| `POST /auth/email/verify` | public | Verifies the email with the token from the link |
| `POST /auth/password/forgot` | public | Always 202; emails a reset link if the account exists |
| `POST /auth/password/reset` | public | Sets a new password and signs out everywhere |
| `GET /auth/oidc/:provider/login` | public | Starts Google (`google`) or Microsoft (`microsoft`) sign-in |
| `GET /auth/oidc/:provider/callback` | public | Where the provider redirects back; sets a session cookie |
| `POST /auth/sign-out` | public | Sign-out for the session cookie |
| `GET /me` | signed in | The current user |
| `POST /notes`, `GET /notes`, `GET/PATCH/DELETE /notes/:id` | signed in | Own notes (admins: all). Others' notes answer 404 |
| `GET /admin/users` | admin | Every user |

The emailed links point to `APP_URL/verify-email?token=...` and `APP_URL/reset-password?token=...`, pages of your web app that POST the token to the API. Without a web app, copy the token from the email in Mailpit and POST it yourself.

## Google and Microsoft

Each provider is enabled only when its variables are set in `.env`.

**Google**: create an OAuth client ID of type *Web application* in the Google Cloud console, with the redirect URI `http://localhost:3000/auth/oidc/google/callback`. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**Microsoft (Entra ID)**: register an app in your tenant with the web redirect URI `http://localhost:3000/auth/oidc/microsoft/callback`, and create a client secret. Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and `MICROSOFT_TENANT_ID` (the directory ID, a GUID). Then, under *Token configuration*, add the optional claim **`xms_edov`** to the ID token: Microsoft doesn't send `email_verified`, and without it new Microsoft users are refused.

Then open `http://localhost:3000/auth/oidc/google/login` in a browser.

## Tests

The tests use the Docker PostgreSQL (`docker compose up -d`), on a separate `notes_test` database.

```bash
npm test          # unit tests, and the package's contract tests for the Prisma store
npm run test:e2e  # the API end to end
```

## Where things are

```
prisma/schema.prisma                      tables
prisma/seed.ts                            the admin account
src/app.module.ts                         config, mail, authentication, authorization
src/auth/                                 sign-up, sign-in, tokens, emails, Google/Microsoft
src/auth/account-linker.ts                which user a Google/Microsoft account signs in as
src/auth/prisma-authentication.store.ts   sessions and tokens in PostgreSQL
src/notes/note.policy.ts                  who may do what with a note
src/users/                                /me, /admin/users, the users repository
```
