import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as dashboardController from '../controller/dashboard.controller.js';

const router = Router();

router.get('/attendance',    authenticate, dashboardController.attendance);
router.get('/service-order', authenticate, dashboardController.serviceOrder);
router.get('/platform',      authenticate, dashboardController.platform);

export default router;
