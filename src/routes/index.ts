import { Router } from 'express';
import authRouter from '../modules/auth/auth.routes';

const router = Router();

// Register auth routes
router.use('/auth', authRouter);

export default router;
