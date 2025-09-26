import * as contactController from '../controller/contact.controller.js'
import { authenticate } from "../middleware/auth.middleware.js";
import { Router } from 'express';

const router = Router();

router.get('/', authenticate, contactController.findAll);
router.post('/', authenticate, contactController.create);
router.put('/:id', authenticate, contactController.update);
router.get('/:id', authenticate, contactController.findById);


export default router;