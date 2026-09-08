import { Router } from 'express';
import configRoutes from './itau-config.routes.js';
import boletoRoutes from './itau-boleto.routes.js';
import logRoutes from './itau-log.routes.js';

const router = Router();

router.use('/config', configRoutes);
router.use('/boletos', boletoRoutes);
router.use('/logs', logRoutes);

export default router;
