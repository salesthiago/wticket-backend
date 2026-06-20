import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import * as ctrl from '../controller/ai-providers.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('auto_attendance'));

router.get('/', ctrl.getAll);
router.get('/:provider', ctrl.getProvider);
router.post('/:provider', ctrl.saveProvider);
router.put('/:provider', ctrl.saveProvider);
router.delete('/:provider', ctrl.deleteProvider);
router.post('/:provider/test', ctrl.testProvider);

export default router;
