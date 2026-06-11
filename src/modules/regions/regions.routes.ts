import { Router } from 'express';
import { RegionsController } from './regions.controller';
import { validate } from '../../common/middleware/validation.middleware';
import { createRegionSchema, updateRegionSchema } from './regions.validation';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import { Roles } from '../../common/constants/roles';

const router = Router();
const controller = new RegionsController();

// All regions endpoints are protected by authentication
router.use(authenticate);

// Public/Shared read endpoints
router.get('/', controller.getRegions);
router.get('/:id', controller.getRegionById);

// Admin-only write endpoints
router.post('/', authorize([Roles.ADMIN]), validate(createRegionSchema), controller.createRegion);
router.put('/:id', authorize([Roles.ADMIN]), validate(updateRegionSchema), controller.updateRegion);
router.delete('/:id', authorize([Roles.ADMIN]), controller.deleteRegion);

export default router;
