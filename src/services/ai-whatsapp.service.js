import logger from '../utils/logger.js';
import AiAgent from '../models/ai-agent.model.js';
import AiConversation from '../models/ai-conversation.model.js';
import aiAgentService from './ai-agent.service.js';

// Palavras-chave que transferem para humano
const HUMAN_KEYWORDS = ['atendente', 'humano', 'pessoa', 'falar com alguém', 'transferir', 'suporte humano'];
// Palavras-chave que finalizam o atendimento
const FINISH_KEYWORDS = ['sair', 'encerrar', 'finalizar', 'tchau', 'obrigado tchau', 'obrigada tchau'];

class AiWhatsappService {

  /**
   * Processa uma mensagem recebida via WhatsApp usando um agente de IA.
   * @returns { message, transferToHuman, finishedByUser, shouldContinue, error }
   */
  async processMessage(sessionName, session, contactNumber, contactName, messageBody) {
    try {
      const agent = await AiAgent.findById(session.aiAgentId);

      if (!agent || agent.status !== 'ativo') {
        logger.warn(`[AI] Agente ${session.aiAgentId} não encontrado ou inativo para sessão ${sessionName}`);
        return null;
      }

      const msgLower = messageBody.trim().toLowerCase();

      // Verifica pedido de atendimento humano
      if (HUMAN_KEYWORDS.some(kw => msgLower.includes(kw))) {
        logger.info(`[AI] Contato ${contactNumber} solicitou atendimento humano`);
        return {
          message: '👤 Transferindo para um atendente humano. Aguarde um momento.',
          transferToHuman: true,
          shouldContinue: false
        };
      }

      // Verifica pedido de encerramento
      if (FINISH_KEYWORDS.some(kw => msgLower === kw)) {
        logger.info(`[AI] Contato ${contactNumber} finalizou o atendimento`);
        return {
          message: '✅ Atendimento encerrado. Obrigado pelo contato!',
          finishedByUser: true,
          shouldContinue: false
        };
      }

      // Busca ou cria conversa para este contato
      let conversation = await AiConversation.findOne({
        agentId: agent._id,
        contactPhone: contactNumber
      }).sort({ updatedAt: -1 });

      // Monta contexto com histórico (últimas 10 mensagens)
      let contextMessage = messageBody;
      if (conversation && conversation.messages.length > 0) {
        const recent = conversation.messages.slice(-10);
        const history = recent
          .map(m => `${m.role === 'user' ? contactName || 'Cliente' : agent.nome}: ${m.content}`)
          .join('\n');
        contextMessage = `${history}\n${contactName || 'Cliente'}: ${messageBody}`;
      }

      // Constrói system prompt
      const systemPrompt = this._buildWhatsappSystemPrompt(agent, contactName, sessionName);

      // Chama o provedor de IA
      const provider = await aiAgentService.ensureProvider();
      const responseText = await aiAgentService.callProvider(provider, contextMessage, systemPrompt);

      // Salva/atualiza conversa
      if (!conversation) {
        conversation = await AiConversation.create({
          agentId: agent._id,
          contactPhone: contactNumber,
          titulo: messageBody.substring(0, 60),
          messages: [
            { role: 'user', content: messageBody },
            { role: 'assistant', content: responseText }
          ],
          metadata: { sessionName, contactName }
        });
      } else {
        conversation.messages.push({ role: 'user', content: messageBody });
        conversation.messages.push({ role: 'assistant', content: responseText });
        await conversation.save();
      }

      // Incrementa uso do agente
      await AiAgent.findByIdAndUpdate(agent._id, { $inc: { totalMensagens: 1 } });

      logger.info(`[AI] Agente "${agent.nome}" respondeu para ${contactNumber} na sessão ${sessionName}`);

      return {
        message: responseText,
        transferToHuman: false,
        finishedByUser: false,
        shouldContinue: true
      };

    } catch (error) {
      logger.error(`[AI] Erro ao processar mensagem para ${contactNumber}:`, error);
      return {
        message: '⚠️ Desculpe, ocorreu um erro no atendimento automático. Um atendente irá auxiliá-lo.',
        transferToHuman: true,
        shouldContinue: false,
        error: error.message
      };
    }
  }

  _buildWhatsappSystemPrompt(agent, contactName, sessionName) {
    const base = aiAgentService.buildSystemPrompt(agent);

    const extra = [
      `\nContexto de atendimento via WhatsApp:`,
      `- Canal: WhatsApp`,
      `- Nome do contato: ${contactName || 'não identificado'}`,
      `- Sessão: ${sessionName}`,
      `\nInstruções importantes para WhatsApp:`,
      `- Seja conciso: respostas longas não funcionam bem no WhatsApp`,
      `- Use emojis com moderação para tornar a conversa mais amigável`,
      `- Se o cliente precisar de ajuda humana, oriente-o a digitar "atendente"`,
      `- Não envie blocos de código ou markdown complexo`
    ].join('\n');

    return base + extra;
  }

  /**
   * Limpa o histórico de conversa de um contato com um agente.
   * Útil quando o ticket é finalizado.
   */
  async clearConversation(agentId, contactPhone) {
    try {
      await AiConversation.deleteMany({ agentId, contactPhone });
      logger.info(`[AI] Histórico limpo para contato ${contactPhone} no agente ${agentId}`);
    } catch (error) {
      logger.error(`[AI] Erro ao limpar histórico:`, error);
    }
  }
}

export default new AiWhatsappService();
