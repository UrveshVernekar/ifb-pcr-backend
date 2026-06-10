import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
} from './auth.validation';

export type RegisterDto = z.infer<typeof registerSchema>['body'];
export type LoginDto = z.infer<typeof loginSchema>['body'];
export type RefreshTokenDto = z.infer<typeof refreshSchema>['body'];
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>['body'];
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>['body'];
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>['body'];
