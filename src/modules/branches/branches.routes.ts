import { Router } from 'express';
import { BranchesController } from './branches.controller';
import { validate } from '../../common/middleware/validation.middleware';
import { createBranchSchema, updateBranchSchema } from './branches.validation';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import { Roles } from '../../common/constants/roles';

const router = Router();
const controller = new BranchesController();

// All branches endpoints are protected by authentication
router.use(authenticate);

// Public/Shared read endpoints
router.get('/', controller.getBranches);
router.get('/:id', controller.getBranchById);

// Admin and Regional Head write endpoints
router.post('/', authorize([Roles.ADMIN, Roles.REGION_HEAD]), validate(createBranchSchema), controller.createBranch);
router.put('/:id', authorize([Roles.ADMIN, Roles.REGION_HEAD]), validate(updateBranchSchema), controller.updateBranch);
router.delete('/:id', authorize([Roles.ADMIN, Roles.REGION_HEAD]), controller.deleteBranch);

export default router;
