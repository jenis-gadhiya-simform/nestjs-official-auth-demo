import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AccountLinker } from './account-linker.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { EmailVerificationController } from './email-verification.controller.js';
import { EmailVerificationMailer } from './email-verification.mailer.js';
import { JwtAuth } from './jwt-auth.provider.js';
import { OidcController } from './oidc.controller.js';
import { PasswordResetController } from './password-reset.controller.js';
import { PasswordResetMailer } from './password-reset.mailer.js';
import { PrismaAuthenticationStore } from './prisma-authentication.store.js';
import { SessionAuth } from './session-auth.provider.js';
import './auth-types.js';

@Module({
  imports: [UsersModule],
  controllers: [
    AuthController,
    EmailVerificationController,
    PasswordResetController,
    OidcController,
  ],
  providers: [
    SessionAuth, // session cookie (Google, Microsoft)
    JwtAuth, // bearer token (email and password)
    EmailVerificationMailer,
    PasswordResetMailer,
    AccountLinker,
    PrismaAuthenticationStore,
    CredentialsService,
  ],
})
export class AuthModule {}
