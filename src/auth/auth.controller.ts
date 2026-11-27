import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EmailVerificationService,
  Public,
  SignInService,
  TokenService,
} from '@nestjs/authentication';
import {
  refreshTokenSchema,
  signInSchema,
  signUpSchema,
  type RefreshTokenDto,
  type SignInDto,
  type SignUpDto,
} from './auth.schemas.js';
import { CredentialsService } from './credentials.service.js';

// Every route is closed by default: @Public() opens these.
@Public()
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly credentials: CredentialsService,
    private readonly tokens: TokenService,
    private readonly emailVerification: EmailVerificationService,
    private readonly signInService: SignInService,
  ) {}

  /** Creates a normal user (never an admin) and signs them in. */
  @Post('sign-up')
  async signUp(@Body({ schema: signUpSchema }) body: SignUpDto) {
    const user = await this.credentials.register(body.email, body.password);
    // Not awaited: a mail server outage must not fail a sign-up that already
    // saved the user. They can ask for a new link later.
    this.emailVerification
      .send(user)
      .catch((error: unknown) =>
        this.logger.error('Verification email failed', error),
      );
    const tokens = await this.tokens.issue(user.id);
    return { user, ...tokens };
  }

  /** Email and password sign-in, for admins and users. */
  @Post('token')
  @HttpCode(200)
  async signIn(@Body({ schema: signInSchema }) body: SignInDto) {
    const user = await this.credentials.verify(body.email, body.password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    return this.tokens.issue(user.id); // { accessToken, expiresIn, refreshToken }
  }

  /** Each refresh token works once. Reusing one revokes all tokens of that sign-in. */
  @Post('token/refresh')
  @HttpCode(200)
  refresh(@Body({ schema: refreshTokenSchema }) body: RefreshTokenDto) {
    return this.tokens.refresh(body.refreshToken);
  }

  /** Sign-out for bearer-token clients. */
  @Post('token/revoke')
  @HttpCode(204)
  async revoke(@Body({ schema: refreshTokenSchema }) body: RefreshTokenDto) {
    await this.tokens.revoke(body.refreshToken);
  }

  /**
   * Sign-out for the session cookie that Google and Microsoft sign-in set.
   * It works under @Public(): signOut() reads the cookie from the request
   * itself, and still clears it when the session has already expired.
   */
  @Post('sign-out')
  @HttpCode(204)
  async signOut() {
    await this.signInService.signOut();
  }
}
