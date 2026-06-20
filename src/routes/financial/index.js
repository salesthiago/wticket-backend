import { Router } from 'express';
import receivableRoutes from './receivable.routes.js';

const router = Router();

router.use('/receivables', receivableRoutes);

export default router;
