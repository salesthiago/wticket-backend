import AiAgent from '../models/ai-agent.model.js';
import AiConversation from '../models/ai-conversation.model.js';
import aiProvidersService from './ai-providers.service.js';

// Ordem de preferência dos provedores
const PROVIDER_PRIORITY = ['openai', 'claude', 'gemini'];

class AiAgentService {

  async getActiveProvider() {
    for (const p of PROVIDER_PRIORITY) {
      const s = await aiProvidersService.getProvider(p);
      if (s?.value?.token && s?.status === 'enabled') return p;
    }
    // fallback: tenta o legado settings 'gemini'
    const { default: Settings } = await import('../models/settings.model.js');
    const legacy = await Settings.findOne({ name: 'gemini' });
    if (legacy?.value?.token) return 'gemini_legacy';
    throw new Error('Nenhum provedor de IA configurado. Acesse IA > Configurar para adicionar uma chave de API.');
  }

  async callProvider(provider, message, systemPrompt) {
    if (provider === 'gemini_legacy') {
      // usa o serviço original de gemini (legado)
      const { default: Settings } = await import('../models/settings.model.js');
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const s = await Settings.findOne({ name: 'gemini' });
      const genAI = new GoogleGenerativeAI(s.value.token);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const prompt = systemPrompt ? `${systemPrompt}\n\n${message}` : message;
      const result = await model.generateContent(prompt);
      return result.response.text();
    }
    const result = await aiProvidersService.send(provider, message, systemPrompt);
    return result.text;
  }

  async ensureProvider() {
    return this.getActiveProvider();
  }

  // Constrói o system prompt baseado na config do agente
  buildSystemPrompt(agent) {
    const linhas = [];

    linhas.push(`Você é ${agent.nome}.`);

    if (agent.descricao) {
      linhas.push(`Descrição: ${agent.descricao}`);
    }

    linhas.push(`Tom de comunicação: ${agent.tom}`);

    // Instruções por tipo
    switch (agent.tipo) {
      case 'atendimento':
        linhas.push('Seu objetivo é atender clientes de forma eficiente, resolver dúvidas e problemas.');
        linhas.push('Seja prestativo, claro e objetivo. Sempre tente resolver o problema do cliente.');
        break;
      case 'vendas':
        linhas.push('Seu objetivo é conduzir o cliente até a compra.');
        linhas.push('Use gatilhos mentais como: escassez, urgência, prova social, autoridade.');
        linhas.push('Destaque os benefícios do produto, não apenas suas características.');
        linhas.push('Sempre que possível, direcione a conversa para o fechamento da venda.');
        break;
      case 'campanhas':
        linhas.push('Seu objetivo é criar textos de campanhas de marketing altamente eficazes.');
        linhas.push('Crie textos persuasivos, com chamada para ação clara (CTA).');
        linhas.push('Adapte a linguagem para o canal solicitado (WhatsApp, e-mail, anúncio, etc.).');
        linhas.push('Use copywriting avançado: headlines impactantes, storytelling, benefícios claros.');
        break;
      case 'analise_leads':
        linhas.push('Seu objetivo é analisar informações de leads e classificá-los como: QUENTE, MORNO ou FRIO.');
        linhas.push('Avalie: interesse demonstrado, perfil, engajamento e potencial de conversão.');
        linhas.push('Forneça uma classificação clara e sugestões de ação para cada lead.');
        linhas.push('Seja direto: classifique, justifique brevemente e sugira o próximo passo.');
        break;
    }

    // Regras personalizadas
    if (agent.regras && agent.regras.length > 0) {
      linhas.push('\nRegras que você deve seguir:');
      agent.regras.forEach((regra, i) => {
        linhas.push(`${i + 1}. ${regra}`);
      });
    }

    // Dados do produto (para vendas e campanhas)
    if (agent.dados_produto && (agent.tipo === 'vendas' || agent.tipo === 'campanhas')) {
      linhas.push('\nInformações do produto/serviço que você promove:');
      if (agent.dados_produto.nome) linhas.push(`- Nome: ${agent.dados_produto.nome}`);
      if (agent.dados_produto.preco) linhas.push(`- Preço: ${agent.dados_produto.preco}`);
      if (agent.dados_produto.beneficios?.length > 0) {
        linhas.push(`- Benefícios: ${agent.dados_produto.beneficios.join(', ')}`);
      }
    }

    linhas.push('\nResponda sempre em português do Brasil.');

    return linhas.join('\n');
  }

  // Envia mensagem para um agente específico (com histórico de conversa)
  async sendMessage(agentId, message, conversationId = null) {
    const provider = await this.ensureProvider();

    const agent = await AiAgent.findById(agentId);
    if (!agent) throw new Error('Agente não encontrado');
    if (agent.status !== 'ativo') throw new Error('Este agente está inativo');

    const systemPrompt = this.buildSystemPrompt(agent);

    let conversation = null;

    if (conversationId) {
      conversation = await AiConversation.findById(conversationId);
    }

    // Monta mensagem com contexto de histórico simples (últimas 5 trocas)
    let contextMessage = message;
    if (conversation && conversation.messages.length > 0) {
      const recent = conversation.messages.slice(-10);
      const history = recent.map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n');
      contextMessage = `${history}\nUsuário: ${message}`;
    }

    const responseText = await this.callProvider(provider, contextMessage, systemPrompt);

    // Salva ou atualiza conversa
    if (!conversation) {
      conversation = await AiConversation.create({
        agentId: agent._id,
        titulo: message.substring(0, 60),
        messages: [
          { role: 'user', content: message },
          { role: 'assistant', content: responseText }
        ]
      });
    } else {
      conversation.messages.push({ role: 'user', content: message });
      conversation.messages.push({ role: 'assistant', content: responseText });
      await conversation.save();
    }

    // Incrementa contador
    await AiAgent.findByIdAndUpdate(agentId, { $inc: { totalMensagens: 1 } });

    return {
      text: responseText,
      conversationId: conversation._id
    };
  }

  // Analisa um lead (tipo analise_leads)
  async analyzeLead(agentId, leadData) {
    const provider = await this.ensureProvider();

    const agent = await AiAgent.findById(agentId);
    if (!agent) throw new Error('Agente não encontrado');
    if (agent.tipo !== 'analise_leads') throw new Error('Este agente não é do tipo análise de leads');

    const systemPrompt = this.buildSystemPrompt(agent);

    const leadInfo = Object.entries(leadData)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    const prompt = `Analise o seguinte lead:\n${leadInfo}\n\nForneça:\n1. Classificação: QUENTE / MORNO / FRIO\n2. Justificativa (2-3 linhas)\n3. Próximo passo recomendado`;

    const responseText = await this.callProvider(provider, prompt, systemPrompt);

    await AiAgent.findByIdAndUpdate(agentId, { $inc: { totalMensagens: 1 } });

    // Extrai classificação do texto
    let classificacao = 'DESCONHECIDO';
    if (responseText.toUpperCase().includes('QUENTE')) classificacao = 'QUENTE';
    else if (responseText.toUpperCase().includes('MORNO')) classificacao = 'MORNO';
    else if (responseText.toUpperCase().includes('FRIO')) classificacao = 'FRIO';

    return { text: responseText, classificacao };
  }

  // Gera campanha (tipo campanhas)
  async generateCampaign(agentId, params) {
    const provider = await this.ensureProvider();

    const agent = await AiAgent.findById(agentId);
    if (!agent) throw new Error('Agente não encontrado');
    if (agent.tipo !== 'campanhas') throw new Error('Este agente não é do tipo campanhas');

    const systemPrompt = this.buildSystemPrompt(agent);
    const { canal, objetivo, publico, instrucoes } = params;

    const prompt = [
      `Crie ${params.quantidade || 1} variação(ões) de campanha com as seguintes especificações:`,
      canal ? `- Canal: ${canal}` : '',
      objetivo ? `- Objetivo: ${objetivo}` : '',
      publico ? `- Público-alvo: ${publico}` : '',
      instrucoes ? `- Instruções adicionais: ${instrucoes}` : '',
      '\nCrie textos prontos para uso, com emoji quando adequado ao canal.'
    ].filter(Boolean).join('\n');

    const responseText = await this.callProvider(provider, prompt, systemPrompt);

    await AiAgent.findByIdAndUpdate(agentId, { $inc: { totalGeracoes: 1 } });

    return { text: responseText };
  }
}

export default new AiAgentService();
