import { Router } from 'express';
import * as appointmentController from '../controller/appointment.controller.js';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('attendance'));

router.get('/', appointmentController.findAll);
router.post('/', appointmentController.create);
router.put('/:id', appointmentController.update);
router.get('/:id', appointmentController.findById);
router.delete('/:id', appointmentController.destroy);
router.patch('/:id/cancel', appointmentController.cancel);

export default router;
