import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import * as customerController from '../controller/customer.controller.js';

const router = Router();

router.use(authenticate, requireTenant);

// Leitura liberada para 'attendance' também: a seleção de cliente na criação de
// tickets/tarefas depende de listar clientes mesmo sem o módulo de Ordem de Serviço.
router.get('/', requireModule('attendance', 'service_order'), customerController.findAll);
router.get('/:id', requireModule('attendance', 'service_order'), customerController.findById);

// Cadastro/edição/exclusão de clientes continua exclusivo do módulo de Ordem de Serviço.
router.post('/', requireModule('service_order'), customerController.create);
router.put('/:id', requireModule('service_order'), customerController.update);
router.delete('/:id/destroy', requireModule('service_order'), customerController.destroy);

export default router;
