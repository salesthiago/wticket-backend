import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../../middleware/auth.middleware.js';
import * as ibgeController from '../../controller/nfse/ibge.controller.js';

const router = Router();

// Tabela auxiliar IBGE — exige autenticação + módulo NFS-e
router.use(authenticate, requireTenant, requireModule('nfse'));

router.get('/search', ibgeController.search);            // ?q=...&uf=GO
router.get('/resolve', ibgeController.resolve);          // ?city=...&uf=...
router.get('/:cMun', ibgeController.getByCMun);

export default router;
