import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  PasswordResetHandler,
  type PasswordResetLink,
} from '@nestjs/authentication';
import { html, Mailer, type Mailable } from '@nestjs/mail';
import { UsersRepository } from '../users/users.repository.js';

@Injectable()
export class PasswordResetMail implements Mailable<PasswordResetLink> {
  render({ url }: PasswordResetLink) {
    return {
      subject: 'Reset your password',
      html: html`<p>
          Someone asked to reset the password of your Notes account.
        </p>
        <p><a href="${url}">Choose a new password</a></p>
        <p>If it wasn't you, ignore this email.</p>`,
    };
  }
}

/** The package creates and checks the reset links; this finds users, sends emails and saves passwords. */
@Injectable()
export class PasswordResetMailer extends PasswordResetHandler {
  constructor(
    private readonly users: UsersRepository,
    private readonly mailer: Mailer,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('passwordReset', this);
  }

  async findUser(email: string) {
    const found = await this.users.findCredentials(email);
    return (
      found && {
        id: found.user.id,
        email: found.user.email,
        passwordHash: found.passwordHash,
      }
    );
  }

  async send(link: PasswordResetLink) {
    await this.mailer.send(PasswordResetMail, { to: link.email, data: link });
  }

  updatePassword(userId: string, passwordHash: string) {
    return this.users.updatePasswordHash(userId, passwordHash);
  }
}
