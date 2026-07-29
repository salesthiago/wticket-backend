import { Router } from 'express';
import { authenticate, requireTenant, requireModule, blockCustomerScope } from '../middleware/auth.middleware.js';
import * as controller from '../controller/project-status.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('attendance'));

// Leitura liberada para login de cliente (usada para exibir o status do
// projeto); gestão (criar/editar/excluir/definir padrão) fica restrita à equipe interna.
router.get('/', controller.findAll);
router.get('/:id', controller.findById);
router.post('/', blockCustomerScope, controller.create);
router.put('/:id', blockCustomerScope, controller.update);
router.patch('/:id/set-default', blockCustomerScope, controller.setDefault);
router.delete('/:id', blockCustomerScope, controller.destroy);

export default router;
