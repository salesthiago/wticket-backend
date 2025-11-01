import AutoResponse from '../models/auto-response.model'
import ConversationFlow from './conversationFlow.service'

class MessageProcessor {
  constructor() {
    this.conversationFlow = new ConversationFlow();
  }

  async process(message, companyId) {
    const messageText = message.body.toLowerCase().trim();
    
    // 1. Verificar se está em um fluxo de conversa ativo
    const flowResult = await this.conversationFlow.checkActiveFlow(message.from, messageText);
    if (flowResult.inFlow) {
      return flowResult;
    }

    // 2. Verificar respostas automáticas por palavra-chave
    const autoResponse = await this.checkAutoResponses(messageText, companyId);
    if (autoResponse) {
      return {
        handled: true,
        response: autoResponse.response,
        type: 'auto_response'
      };
    }

    // 3. Verificar intenções de agendamento
    if (this.isSchedulingIntent(messageText)) {
      return await this.conversationFlow.startSchedulingFlow(message.from);
    }

    // 4. Mensagem não reconhecida - não handled
    return {
      handled: false
    };
  }

  async checkAutoResponses(message, companyId) {
    const responses = await AutoResponse.find({ 
      companyId, 
      enabled: true 
    }).sort({ priority: -1 });

    for (const response of responses) {
      if (this.matchesTrigger(message, response)) {
        return response;
      }
    }
    return null;
  }

  matchesTrigger(message, response) {
    switch (response.triggerType) {
      case 'exact_match':
        return message === response.trigger.toLowerCase();
      
      case 'keyword':
        return message.includes(response.trigger.toLowerCase());
      
      case 'regex':
        const regex = new RegExp(response.trigger, 'i');
        return regex.test(message);
      
      default:
        return message.includes(response.trigger.toLowerCase());
    }
  }

  isSchedulingIntent(message) {
    const schedulingKeywords = [
      'agendar', 'marcar', 'agendamento', 'marcação',
      'horario', 'hora', 'data', 'consulta',
      'reunião', 'atendimento'
    ];
    
    return schedulingKeywords.some(keyword => 
      message.includes(keyword)
    );
  }
}

module.exports = MessageProcessor;