import ConversationState from '../models/conversation-state.model'

class ConversationFlow {
  constructor() {
    this.flows = new Map();
  }

  async checkActiveFlow(contactId, message) {
    const state = await ConversationState.findOne({ contactId });
    
    if (!state || !state.activeFlow) {
      return { inFlow: false };
    }

    // Continuar fluxo existente
    return await this.continueFlow(contactId, message, state);
  }

  async startSchedulingFlow(contactId) {
    await ConversationState.findOneAndUpdate(
      { contactId },
      { 
        activeFlow: 'scheduling',
        flowStep: 'ask_date',
        flowData: {}
      },
      { upsert: true, new: true }
    );

    const response = `📅 *Sistema de Agendamento*
    
Por favor, informe a data e hora desejada para o atendimento:

Exemplos:
- "Amanhã às 14h"
- "25/12 às 10:30"
- "Próxima segunda-feira às 15h"`;

    return {
      handled: true,
      response: response,
      type: 'scheduling_flow',
      inFlow: true
    };
  }

  async continueFlow(contactId, message, state) {
    switch (state.activeFlow) {
      case 'scheduling':
        return await this.processSchedulingFlow(contactId, message, state);
      
      default:
        await this.clearFlow(contactId);
        return { inFlow: false };
    }
  }

  async processSchedulingFlow(contactId, message, state) {
    try {
      switch (state.flowStep) {
        case 'ask_date':
          return await this.handleDateInput(contactId, message, state);
        
        case 'ask_description':
          return await this.handleDescriptionInput(contactId, message, state);
        
        default:
          await this.clearFlow(contactId);
          return { inFlow: false };
      }
    } catch (error) {
      await this.clearFlow(contactId);
      return {
        handled: true,
        response: 'Desculpe, ocorreu um erro no agendamento. Por favor, entre em contato com um atendente.',
        type: 'flow_error'
      };
    }
  }

  async handleDateInput(contactId, message, state) {
    // Aqui você pode integrar com uma biblioteca de NLP como chrono-node
    // para parsing de datas naturais
    const parsedDate = this.parseDate(message);
    
    if (!parsedDate) {
      return {
        handled: true,
        response: 'Não consegui entender a data. Por favor, informe novamente:\nEx: "amanhã às 14h" ou "25/12 às 10:30"',
        inFlow: true
      };
    }

    // Atualizar estado com a data
    state.flowData.scheduledDate = parsedDate;
    state.flowStep = 'ask_description';
    await state.save();

    return {
      handled: true,
      response: 'Ótimo! Agora por favor, descreva brevemente o assunto do atendimento:',
      inFlow: true
    };
  }

  async handleDescriptionInput(contactId, message, state) {
    // Finalizar o agendamento
    const appointmentData = {
      contactId,
      phone: contactId, // Ajustar conforme sua estrutura
      companyId: state.companyId, // Você precisa armazenar isso no state
      scheduledDate: state.flowData.scheduledDate,
      description: message
    };

    // Criar agendamento no banco
    const appointment = await this.appointmentService.create(appointmentData);
    
    // Limpar fluxo
    await this.clearFlow(contactId);

    return {
      handled: true,
      response: `✅ Agendamento realizado com sucesso!\n\n📅 Data: ${new Date(appointment.scheduledDate).toLocaleString('pt-BR')}\n📝 Assunto: ${appointment.description}\n\nVocê receberá um lembrete 1 hora antes.`,
      type: 'scheduling_complete',
      inFlow: false,
      appointmentId: appointment._id
    };
  }

  parseDate(message) {
    // Implementação simplificada - considere usar chrono-node para parsing mais robusto
    try {
      // Exemplo básico - expandir conforme necessidade
      if (message.includes('amanhã') || message.includes('amanha')) {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        
        // Extrair hora (ex: "amanhã às 14h")
        const hourMatch = message.match(/(\d{1,2})h?/);
        if (hourMatch) {
          date.setHours(parseInt(hourMatch[1]), 0, 0, 0);
        }
        
        return date;
      }
      
      // Adicionar mais patterns de data...
      return new Date(); // Fallback
    } catch (error) {
      return null;
    }
  }

  async clearFlow(contactId) {
    await ConversationState.findOneAndDelete({ contactId });
  }
}

module.exports = ConversationFlow;