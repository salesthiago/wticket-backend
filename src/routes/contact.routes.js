import * as contactController from '../controller/contact.controller.js';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(authenticate, requireTenant, requireModule('attendance'));

router.get('/', contactController.findAll);
router.post('/', contactController.create);
router.put('/:id', contactController.update);
router.get('/:id', contactController.findById);
router.delete('/:id', contactController.destroy);

export default router;
