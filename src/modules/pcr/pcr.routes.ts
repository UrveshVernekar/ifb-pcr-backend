import { Router } from 'express';
import multer from 'multer';
import { PcrController } from './pcr.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import { Roles } from '../../common/constants/roles';

const router = Router();
const controller = new PcrController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit for larger PCR sheets
  },
});

// Admin-only PCR upload endpoint
router.post(
  '/upload',
  authenticate,
  authorize([Roles.ADMIN]),
  upload.single('file'),
  controller.uploadPCRData
);

export default router;
