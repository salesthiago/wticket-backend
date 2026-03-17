import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as ctrl from '../controller/ai-providers.controller.js';

const router = Router();

router.get('/', authenticate, ctrl.getAll);
router.get('/:provider', authenticate, ctrl.getProvider);
router.post('/:provider', authenticate, ctrl.saveProvider);
router.put('/:provider', authenticate, ctrl.saveProvider);
router.delete('/:provider', authenticate, ctrl.deleteProvider);
router.post('/:provider/test', authenticate, ctrl.testProvider);

export default router;
