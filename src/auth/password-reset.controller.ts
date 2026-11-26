import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { PasswordResetService, Public } from '@nestjs/authentication';
import {
  emailSchema,
  resetPasswordSchema,
  type EmailDto,
  type ResetPasswordDto,
} from './auth.schemas.js';

@Public()
@Controller('auth/password')
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  /**
   * Always 202, whether or not the email has an account. No `await`:
   * request() returns before it looks the email up, so timing reveals nothing.
   */
  @Post('forgot')
  @HttpCode(202)
  forgot(@Body({ schema: emailSchema }) body: EmailDto) {
    this.passwordReset.request(body.email);
  }

  /** Sets the new password and signs the user out everywhere. */
  @Post('reset')
  @HttpCode(200)
  async reset(@Body({ schema: resetPasswordSchema }) body: ResetPasswordDto) {
    const result = await this.passwordReset.reset(body.token, body.password);
    if (!result) throw new BadRequestException('Invalid or expired link');
    return { reset: true };
  }
}
