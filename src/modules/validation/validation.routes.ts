import { Router } from 'express';
import { ValidationController } from './validation.controller';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new ValidationController();

router.use(authenticate);
router.get('/history', controller.getHistory);

export default router;
