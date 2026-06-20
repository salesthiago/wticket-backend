import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import * as vehicleController from '../controller/vehicle.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('service_order'));

router.get('/', vehicleController.findAll);
router.post('/', vehicleController.create);
router.get('/customer/:customerId', vehicleController.findByCustomer);
router.get('/:id', vehicleController.findById);
router.put('/:id', vehicleController.update);
router.delete('/:id/destroy', vehicleController.destroy);

export default router;
