import { Router } from 'express';
import receivableRoutes from './receivable.routes.js';
import itauRoutes from './itau/index.js';

const router = Router();

router.use('/receivables', receivableRoutes);
router.use('/itau', itauRoutes);

export default router;
