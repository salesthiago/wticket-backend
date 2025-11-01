import * as botConfigController from '../controller/bot-config.controller.js'
import { authenticate } from "../middleware/auth.middleware.js";
import { Router } from 'express';

const router = Router();

router.get('/', authenticate, botConfigController.findAll);
router.get('/:id', authenticate, botConfigController.findById);
router.put('/:id', authenticate, botConfigController.update);
router.post('/', authenticate, botConfigController.create);


export default router;