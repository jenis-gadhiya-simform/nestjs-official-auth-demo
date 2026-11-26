import { z } from 'zod';

const email = z.email();
const newPassword = z.string().min(12).max(128);

export const signUpSchema = z.object({ email, password: newPassword });
export type SignUpDto = z.infer<typeof signUpSchema>;

// No length rule at sign-in, so passwords set under older rules still work.
export const signInSchema = z.object({ email, password: z.string().min(1) });
export type SignInDto = z.infer<typeof signInSchema>;

export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

export const tokenSchema = z.object({ token: z.string().min(1) });
export type TokenDto = z.infer<typeof tokenSchema>;

export const emailSchema = z.object({ email });
export type EmailDto = z.infer<typeof emailSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: newPassword,
});
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
