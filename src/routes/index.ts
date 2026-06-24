import { Router } from 'express';
import authRouter from '../modules/auth/auth.routes';
import regionsRouter from '../modules/regions/regions.routes';
import branchesRouter from '../modules/branches/branches.routes';
import franchisesRouter from '../modules/franchises/franchises.routes';
import validationRouter from '../modules/validation/validation.routes';
import crmRouter from '../modules/crm/crm.routes';
import pcrRouter from '../modules/pcr/pcr.routes';

const router = Router();

// Register auth routes
router.use('/auth', authRouter);

// Register master data routes
router.use('/regions', regionsRouter);
router.use('/branches', branchesRouter);
router.use('/franchises', franchisesRouter);

// Register validation routes
router.use('/validation', validationRouter);

// Register CRM data routes
router.use('/crm-data', crmRouter);

// Register PCR data routes
router.use('/pcr-data', pcrRouter);

export default router;


