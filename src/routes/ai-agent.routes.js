import { Router } from 'express';
import { authenticate, requireTenant, requireModule } from '../middleware/auth.middleware.js';
import * as ctrl from '../controller/ai-agent.controller.js';

const router = Router();

router.use(authenticate, requireTenant, requireModule('auto_attendance'));

router.get('/', ctrl.listAgents);
router.post('/', ctrl.createAgent);
router.get('/:id', ctrl.getAgent);
router.put('/:id', ctrl.updateAgent);
router.delete('/:id', ctrl.deleteAgent);

router.post('/:id/chat', ctrl.sendMessage);
router.post('/:id/analyze-lead', ctrl.analyzeLead);
router.post('/:id/generate-campaign', ctrl.generateCampaign);

router.get('/:id/conversations', ctrl.listConversations);
router.get('/:id/conversations/:convId', ctrl.getConversation);
router.delete('/:id/conversations/:convId', ctrl.deleteConversation);

export default router;
