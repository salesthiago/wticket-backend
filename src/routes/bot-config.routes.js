import * as botConfigController from '../controller/bot-config.controller.js'
import { authenticate } from "../middleware/auth.middleware.js";
import { Router } from 'express';

const router = Router();

router.get('/', authenticate, botConfigController.findAll);
router.get('/:id', authenticate, botConfigController.findById);
router.put('/:id', authenticate, botConfigController.update);
router.post('/', authenticate, botConfigController.create);
router.delete('/:id', authenticate, botConfigController.remove);
router.post('/:id/auto-response', authenticate, botConfigController.insertAutoResponse);
router.put('/:bot/auto-response/:id', authenticate, botConfigController.updateAutoResponse);
router.delete('/:bot/auto-response/:id', authenticate, botConfigController.deleteAutoResponse);


export default router;