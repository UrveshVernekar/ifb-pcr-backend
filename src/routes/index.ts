import { Router } from 'express';
import authRouter from '../modules/auth/auth.routes';
import regionsRouter from '../modules/regions/regions.routes';
import branchesRouter from '../modules/branches/branches.routes';
import franchisesRouter from '../modules/franchises/franchises.routes';

const router = Router();

// Register auth routes
router.use('/auth', authRouter);

// Register master data routes
router.use('/regions', regionsRouter);
router.use('/branches', branchesRouter);
router.use('/franchises', franchisesRouter);

export default router;
