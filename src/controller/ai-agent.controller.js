import logger from '../utils/logger.js';
import AiAgent from '../models/ai-agent.model.js';
import AiConversation from '../models/ai-conversation.model.js';
import aiAgentService from '../services/ai-agent.service.js';

// ─── Agentes CRUD ────────────────────────────────────────────────────────────

export const listAgents = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { tipo, status } = req.query;
    const filter = { companyId };
    if (tipo) filter.tipo = tipo;
    if (status) filter.status = status;

    const agents = await AiAgent.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(agents);
  } catch (err) {
    logger.error('aiAgent listAgents error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAgent = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const agent = await AiAgent.findOne({ _id: req.params.id, companyId });
    if (!agent) return res.status(404).json({ message: 'Agente não encontrado' });
    return res.status(200).json(agent);
  } catch (err) {
    logger.error('aiAgent getAgent error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createAgent = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { nome, descricao, tipo, tom, regras, dados_produto, status } = req.body;

    if (!nome || !tipo) {
      return res.status(400).json({ message: 'Nome e tipo são obrigatórios' });
    }

    const agent = await AiAgent.create({
      companyId,
      nome,
      descricao,
      tipo,
      tom: tom || 'profissional',
      regras: regras || [],
      dados_produto: dados_produto || null,
      status: status || 'ativo'
    });

    return res.status(201).json(agent);
  } catch (err) {
    logger.error('aiAgent createAgent error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateAgent = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { nome, descricao, tipo, tom, regras, dados_produto, status } = req.body;

    const agent = await AiAgent.findOneAndUpdate(
      { _id: req.params.id, companyId },
      { nome, descricao, tipo, tom, regras, dados_produto, status },
      { new: true, runValidators: true }
    );

    if (!agent) return res.status(404).json({ message: 'Agente não encontrado' });
    return res.status(200).json(agent);
  } catch (err) {
    logger.error('aiAgent updateAgent error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteAgent = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const agent = await AiAgent.findOneAndDelete({ _id: req.params.id, companyId });
    if (!agent) return res.status(404).json({ message: 'Agente não encontrado' });
    await AiConversation.deleteMany({ agentId: req.params.id });
    return res.status(204).send();
  } catch (err) {
    logger.error('aiAgent deleteAgent error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Chat ────────────────────────────────────────────────────────────────────

const ensureAgentBelongsToCompany = async (agentId, companyId) => {
  const agent = await AiAgent.findOne({ _id: agentId, companyId });
  return !!agent;
};

export const sendMessage = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { message, conversationId } = req.body;

    if (!message) return res.status(400).json({ message: 'Mensagem é obrigatória' });

    const ok = await ensureAgentBelongsToCompany(req.params.id, companyId);
    if (!ok) return res.status(404).json({ message: 'Agente não encontrado' });

    const result = await aiAgentService.sendMessage(req.params.id, message, conversationId);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('aiAgent sendMessage error >>> ', err);
    const status = err.message?.includes('não encontrado') ? 404 :
                   err.message?.includes('inativo') ? 400 :
                   err.message?.includes('não configurado') ? 400 : 500;
    res.status(status).json({ message: err.message || 'Internal server error' });
  }
};

export const analyzeLead = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { leadData } = req.body;

    if (!leadData) return res.status(400).json({ message: 'Dados do lead são obrigatórios' });

    const ok = await ensureAgentBelongsToCompany(req.params.id, companyId);
    if (!ok) return res.status(404).json({ message: 'Agente não encontrado' });

    const result = await aiAgentService.analyzeLead(req.params.id, leadData);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('aiAgent analyzeLead error >>> ', err);
    const status = err.message?.includes('não encontrado') ? 404 :
                   err.message?.includes('não é do tipo') ? 400 : 500;
    res.status(status).json({ message: err.message || 'Internal server error' });
  }
};

export const generateCampaign = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const params = req.body;
    if (!params || Object.keys(params).length === 0) {
      return res.status(400).json({ message: 'Parâmetros da campanha são obrigatórios' });
    }

    const ok = await ensureAgentBelongsToCompany(req.params.id, companyId);
    if (!ok) return res.status(404).json({ message: 'Agente não encontrado' });

    const result = await aiAgentService.generateCampaign(req.params.id, params);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('aiAgent generateCampaign error >>> ', err);
    const status = err.message?.includes('não encontrado') ? 404 :
                   err.message?.includes('não é do tipo') ? 400 : 500;
    res.status(status).json({ message: err.message || 'Internal server error' });
  }
};

// ─── Conversas ───────────────────────────────────────────────────────────────

export const listConversations = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const ok = await ensureAgentBelongsToCompany(req.params.id, companyId);
    if (!ok) return res.status(404).json({ message: 'Agente não encontrado' });

    const conversations = await AiConversation.find({ agentId: req.params.id })
      .select('titulo messages createdAt updatedAt contactPhone')
      .sort({ updatedAt: -1 })
      .limit(50);
    return res.status(200).json(conversations);
  } catch (err) {
    logger.error('aiAgent listConversations error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getConversation = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const ok = await ensureAgentBelongsToCompany(req.params.id, companyId);
    if (!ok) return res.status(404).json({ message: 'Agente não encontrado' });

    const conversation = await AiConversation.findOne({
      _id: req.params.convId,
      agentId: req.params.id
    });
    if (!conversation) return res.status(404).json({ message: 'Conversa não encontrada' });
    return res.status(200).json(conversation);
  } catch (err) {
    logger.error('aiAgent getConversation error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const ok = await ensureAgentBelongsToCompany(req.params.id, companyId);
    if (!ok) return res.status(404).json({ message: 'Agente não encontrado' });

    const conversation = await AiConversation.findOneAndDelete({
      _id: req.params.convId,
      agentId: req.params.id
    });
    if (!conversation) return res.status(404).json({ message: 'Conversa não encontrada' });
    return res.status(204).send();
  } catch (err) {
    logger.error('aiAgent deleteConversation error >>> ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
