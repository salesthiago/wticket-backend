import * as homeController from '../controller/home.controller.js'
import { authenticate } from "../middleware/auth.middleware.js";
import { Router } from 'express';

const router = Router();

router.get('/dashboard-tickets', authenticate, homeController.ticketDashboard);


export default router;