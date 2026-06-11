import { z } from 'zod';
import { Roles } from '../../common/constants/roles';

export const registerSchema = z.object({
  body: z.object({
    employee_id: z.string().max(50).optional(),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address').max(150),
    password: z.string().min(6, 'Password must be at least 6 characters').max(1000),
    role: z.nativeEnum(Roles).default(Roles.EMPLOYEE),
    permissions: z.array(z.string()).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    altchaPayload: z.string().optional(),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    employeeCode: z.string().min(1, 'Employee code is required'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().min(1, 'OTP is required'),
    employeeCode: z.string().min(1, 'Employee code is required'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    id: z.string().min(1, 'Employee ID/Code is required'),
    newPassword: z.string().min(1, 'New password is required'),
    company: z.string().min(1, 'Company is required'),
  }),
});
