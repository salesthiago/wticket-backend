import { Router } from 'express';
import * as emailConfigController from '../controller/email-config.controller.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/', emailConfigController.getConfig);
router.put('/', emailConfigController.updateConfig);
router.post('/test', emailConfigController.sendTestEmail);
router.get('/templates', emailConfigController.listTemplates);
router.put('/templates/:code', emailConfigController.updateTemplate);

export default router;
