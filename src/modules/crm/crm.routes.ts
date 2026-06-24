import { Router } from 'express';
import multer from 'multer';
import { CrmController } from './crm.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import { Roles } from '../../common/constants/roles';

const router = Router();
const controller = new CrmController();

// Configure multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Admin-only CRM upload endpoint
router.post(
  '/upload',
  authenticate,
  authorize([Roles.ADMIN]),
  upload.single('file'),
  controller.uploadCRMData
);

export default router;
