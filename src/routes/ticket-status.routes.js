import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as controller from '../controller/ticket-status.controller.js';

const router = Router();

router.get('/', authenticate, controller.findAll);
router.get('/:id', authenticate, controller.findById);
router.post('/', authenticate, controller.create);
router.put('/:id', authenticate, controller.update);
router.patch('/:id/set-default', authenticate, controller.setDefault);
router.delete('/:id', authenticate, controller.destroy);

export default router;
