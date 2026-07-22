import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import * as controller from '../controller/project-status.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('attendance'));

router.get('/', controller.findAll);
router.get('/:id', controller.findById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/set-default', controller.setDefault);
router.delete('/:id', controller.destroy);

export default router;
