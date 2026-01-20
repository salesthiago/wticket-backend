import * as geminiController from '../controller/gemini.controller.js';
import { authenticate } from "../middleware/auth.middleware.js";
import { Router } from 'express';

const router = Router();

// GET - Listar configuração do Gemini (se existe retorna, senão retorna estrutura vazia)
router.get('/', authenticate, geminiController.getSettings);

// POST - Criar ou atualizar configuração
router.post('/', authenticate, geminiController.saveSettings);

// PUT - Atualizar configuração
router.put('/', authenticate, geminiController.updateSettings);

// DELETE - Deletar configuração
router.delete('/', authenticate, geminiController.deleteSettings);

// POST - Enviar mensagem para o Gemini (para testes)
router.post('/send', authenticate, geminiController.sendMessage);

export default router;
