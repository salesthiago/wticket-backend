import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../../middleware/auth.middleware.js';
import * as serviceCodeController from '../../controller/nfse/nfse-service-code.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('nfse'));

router.get('/', serviceCodeController.findAll);
router.post('/', serviceCodeController.create);
router.get('/:id', serviceCodeController.findById);
router.put('/:id', serviceCodeController.update);
router.delete('/:id/destroy', serviceCodeController.destroy);

export default router;
