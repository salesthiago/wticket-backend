import * as ticketController from '../controller/ticket.controller.js'
import { authenticate } from "../middleware/auth.middleware.js";
import { Router } from 'express';

const router = Router();

router.get('/', authenticate, ticketController.findAll);
//router.post('/', authenticate, ticketController.create);
//router.put('/:id', authenticate, ticketController.update);
router.get('/:id', authenticate, ticketController.findById);
router.delete('/:id/destroy', authenticate, ticketController.destroy);


export default router;