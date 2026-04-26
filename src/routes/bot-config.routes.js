import * as botConfigController from '../controller/bot-config.controller.js';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(authenticate, requireTenant, requireModule('auto_attendance'));

router.get('/', botConfigController.findAll);
router.get('/:id', botConfigController.findById);
router.put('/:id', botConfigController.update);
router.post('/', botConfigController.create);
router.delete('/:id', botConfigController.remove);
router.post('/:id/auto-response', botConfigController.insertAutoResponse);
router.put('/:bot/auto-response/:id', botConfigController.updateAutoResponse);
router.delete('/:bot/auto-response/:id', botConfigController.deleteAutoResponse);

export default router;
