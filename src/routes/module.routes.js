import { Router } from 'express';
import * as moduleController from '../controller/module.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', moduleController.findAll);
router.get('/:id', authenticate, moduleController.findById);
router.post('/', authenticate, moduleController.create);
router.put('/:id', authenticate, moduleController.update);
router.delete('/:id', authenticate, moduleController.destroy);

export default router;
