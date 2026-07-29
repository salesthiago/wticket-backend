import { Router } from 'express';
import { authenticate, blockCustomerScope } from '../middleware/auth.middleware.js';
import * as controller from '../controller/ticket-status.controller.js';

const router = Router();

// Leitura liberada para login de cliente (usada para exibir o status do
// ticket); gestão (criar/editar/excluir/definir padrão) fica restrita à equipe interna.
router.get('/', authenticate, controller.findAll);
router.get('/:id', authenticate, controller.findById);
router.post('/', authenticate, blockCustomerScope, controller.create);
router.put('/:id', authenticate, blockCustomerScope, controller.update);
router.patch('/:id/set-default', authenticate, blockCustomerScope, controller.setDefault);
router.delete('/:id', authenticate, blockCustomerScope, controller.destroy);

export default router;
