import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../common/middleware/validation.middleware';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
} from './auth.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new AuthController();

// Public Routes
router.get('/altcha/challenge', controller.generateChallenge);
router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/verify-otp', validate(verifyOtpSchema), controller.verifyOtp);
router.post('/change-password', validate(changePasswordSchema), controller.changePassword);

// Protected Routes
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);

export default router;
