import * as homeController from '../controller/home.controller.js'
import { authenticate } from "../middleware/auth.middleware.js";
import { Router } from 'express';

const router = Router();

router.get('/profile', authenticate, homeController.myProfile);


export default router;