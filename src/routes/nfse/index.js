import { Router } from 'express';
import nfseConfigRoutes from './nfse-config.routes.js';
import nfseServiceCodeRoutes from './nfse-service-code.routes.js';
import nfseRoutes from './nfse.routes.js';
import ibgeRoutes from './ibge.routes.js';

const router = Router();

router.use('/config', nfseConfigRoutes);
router.use('/service-codes', nfseServiceCodeRoutes);
router.use('/ibge', ibgeRoutes);
router.use('/', nfseRoutes); // operações de emissão (POST /api/nfse, GET /api/nfse, etc.)

export default router;
