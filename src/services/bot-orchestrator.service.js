// services/BotOrchestrator.js
import BotConfig from '../models/bot-config.model'
import MessageProcessor from './messageProcessor.service'
import AppointmentService from './appointment.service';

class BotOrchestrator {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
    this.messageProcessor = new MessageProcessor();
    this.appointmentService = new AppointmentService(whatsappService);
  }

  async handleIncomingMessage(message, companyId) {
    try {
      // Verificar se o bot está habilitado para esta empresa
      const botConfig = await BotConfig.findOne({ companyId });
      
      if (!botConfig || !botConfig.enabled) {
        return { 
          shouldCreateTicket: true,
          botResponded: false 
        };
      }

      // Processar a mensagem através do pipeline
      const processingResult = await this.messageProcessor.process(
        message, 
        companyId
      );

      // Se o bot conseguiu responder, não criar ticket
      if (processingResult.handled) {
        await this.whatsappService.sendText(
          message.from, 
          processingResult.response
        );
        
        return { 
          shouldCreateTicket: false,
          botResponded: true,
          processingResult 
        };
      }

      // Se não foi handled, criar ticket
      return { 
        shouldCreateTicket: true,
        botResponded: false 
      };

    } catch (error) {
      console.error('Erro no BotOrchestrator:', error);
      // Em caso de erro, criar ticket para atendimento humano
      return { 
        shouldCreateTicket: true,
        botResponded: false,
        error: error.message 
      };
    }
  }

  // Método para agendamentos externos (via API)
  async createAppointment(appointmentData) {
    return await this.appointmentService.create(appointmentData);
  }
}

module.exports = BotOrchestrator;