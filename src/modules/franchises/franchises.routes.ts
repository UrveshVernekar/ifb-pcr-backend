import { Router } from 'express';
import { FranchisesController } from './franchises.controller';
import { validate } from '../../common/middleware/validation.middleware';
import { createFranchiseSchema, updateFranchiseSchema } from './franchises.validation';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import { Roles } from '../../common/constants/roles';

const router = Router();
const controller = new FranchisesController();

// All franchises endpoints are protected by authentication
router.use(authenticate);

// Public/Shared read endpoints
router.get('/', controller.getFranchises);
router.get('/:id', controller.getFranchiseById);

// Admin-only write endpoints
router.post('/', authorize([Roles.ADMIN]), validate(createFranchiseSchema), controller.createFranchise);
router.put('/:id', authorize([Roles.ADMIN]), validate(updateFranchiseSchema), controller.updateFranchise);
router.delete('/:id', authorize([Roles.ADMIN]), controller.deleteFranchise);

export default router;
