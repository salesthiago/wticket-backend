import * as homeController from '../controller/home.controller.js';
import { authenticate, requireTenant } from '../middleware/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/dashboard-tickets', authenticate, requireTenant, homeController.ticketDashboard);

export default router;
