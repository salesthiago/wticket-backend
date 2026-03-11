import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as leadController from '../controller/lead.controller.js';

const router = Router();

router.get('/', authenticate, leadController.findAll);
router.post('/', authenticate, leadController.create);
router.get('/:id', authenticate, leadController.findById);
router.put('/:id', authenticate, leadController.update);
router.post('/:id/convert', authenticate, leadController.convertToCustomer);
router.delete('/:id/destroy', authenticate, leadController.destroy);

export default router;
