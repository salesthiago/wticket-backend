import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as ctrl from '../controller/ai-agent.controller.js';

const router = Router();

// ─── Agentes CRUD ────────────────────────────────────────────────────────────
router.get('/', authenticate, ctrl.listAgents);
router.post('/', authenticate, ctrl.createAgent);
router.get('/:id', authenticate, ctrl.getAgent);
router.put('/:id', authenticate, ctrl.updateAgent);
router.delete('/:id', authenticate, ctrl.deleteAgent);

// ─── Chat (atendimento / vendas) ──────────────────────────────────────────────
router.post('/:id/chat', authenticate, ctrl.sendMessage);

// ─── Análise de Lead ─────────────────────────────────────────────────────────
router.post('/:id/analyze-lead', authenticate, ctrl.analyzeLead);

// ─── Geração de Campanha ──────────────────────────────────────────────────────
router.post('/:id/generate-campaign', authenticate, ctrl.generateCampaign);

// ─── Conversas ───────────────────────────────────────────────────────────────
router.get('/:id/conversations', authenticate, ctrl.listConversations);
router.get('/:id/conversations/:convId', authenticate, ctrl.getConversation);
router.delete('/:id/conversations/:convId', authenticate, ctrl.deleteConversation);

export default router;
