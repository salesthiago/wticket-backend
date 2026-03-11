import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as customerController from '../controller/customer.controller.js';

const router = Router();

router.get('/', authenticate, customerController.findAll);
router.post('/', authenticate, customerController.create);
router.get('/:id', authenticate, customerController.findById);
router.put('/:id', authenticate, customerController.update);
router.delete('/:id/destroy', authenticate, customerController.destroy);

export default router;
