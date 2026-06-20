import { Router } from 'express';
import * as planController from '../controller/plan.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Listagem pública — a tela de cadastro (/register, sem login) precisa dos planos.
router.get('/', planController.findAll);

router.get('/:id', authenticate, planController.findById);
router.post('/', authenticate, planController.create);
router.put('/:id', authenticate, planController.update);
router.delete('/:id', authenticate, planController.destroy);

export default router;
