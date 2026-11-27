import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { MailModule, SmtpTransport } from '@nestjs/mail';
import { AuthModule } from './auth/auth.module.js';
import { oidcProviders } from './auth/oidc-providers.js';
import { validateEnv } from './config/env.js';
import { NotesModule } from './notes/notes.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    MailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: new SmtpTransport({ url: config.getOrThrow('SMTP_URL') }), // Mailpit in development
        from: config.getOrThrow('MAIL_FROM'),
      }),
    }),

    // Authentication first: its guard sets the user that authorization reads.
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const appUrl = config.getOrThrow<string>('APP_URL');
        return {
          accessToken: {
            key: config.getOrThrow('JWT_SECRET'),
            ttl: '15m',
            // Tokens name who issued them and who they are for, and are
            // checked for both, so a token for another app is refused.
            issuer: appUrl,
            audience: appUrl,
          },
          // Pages of your web app that POST the token from the link back to the API.
          emailVerification: { url: `${appUrl}/verify-email` },
          passwordReset: { url: `${appUrl}/reset-password` },
          oidc: {
            callbackUrl: `${appUrl}/auth/oidc/:provider/callback`,
            providers: oidcProviders(config),
          },
        };
      },
    }),
    AuthorizationModule.forRoot(),

    PrismaModule,
    UsersModule,
    AuthModule,
    NotesModule,
  ],
  providers: [
    // Validates every @Body({ schema }) and @Param(..., { schema }).
    { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
  ],
})
export class AppModule {}
