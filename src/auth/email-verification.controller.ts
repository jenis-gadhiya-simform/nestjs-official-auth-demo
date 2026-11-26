import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { EmailVerificationService, Public } from '@nestjs/authentication';
import { tokenSchema, type TokenDto } from './auth.schemas.js';

@Public()
@Controller('auth/email')
export class EmailVerificationController {
  constructor(private readonly emailVerification: EmailVerificationService) {}

  /** Called with the token from the emailed link. */
  @Post('verify')
  @HttpCode(200)
  async verify(@Body({ schema: tokenSchema }) body: TokenDto) {
    const verified = await this.emailVerification.verify(body.token);
    if (!verified) throw new BadRequestException('Invalid or expired link');
    return { email: verified.email, emailVerified: true };
  }
}
