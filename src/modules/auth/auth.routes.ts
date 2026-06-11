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
  updateUserSchema,
} from './auth.validation';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import { Roles } from '../../common/constants/roles';

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

// Admin-only User Management Routes
router.get('/users', authenticate, authorize([Roles.ADMIN]), controller.getUsers);
router.put('/users/:id', authenticate, authorize([Roles.ADMIN]), validate(updateUserSchema), controller.updateUser);
router.delete('/users/:id', authenticate, authorize([Roles.ADMIN]), controller.deleteUser);

export default router;
