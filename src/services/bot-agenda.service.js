import botConfigRepository from '../repositories/bot-config.repository.js';
import autoResponseRepository from '../repositories/auto-response.repository.js';
import appointmentRepository from '../repositories/appointment.repository.js';
import ticketRepository from '../repositories/ticket.repository.js';
import contactRepository from '../repositories/contact.repository.js';
import sessionRepository from '../repositories/session.repository.js';
import logger from '../utils/logger.js';
import { normalizeText } from '../utils/formatter.js';

class BotAgendaService {
  constructor() {
    this.userSessions = new Map(); // Armazena o estado de cada conversa por usuário
  }

  // Inicializa ou recupera a sessão de conversa do usuário
  getOrCreateUserSession(phone) {
    if (!this.userSessions.has(phone)) {
      this.userSessions.set(phone, {
        phone,
        step: 'INITIATION', // INITIATION → NAME → MENU → BOT_ACTIVE → FINISHED
        currentBotId: null,
        botStep: 0,
        data: {},
        startedAt: new Date()
      });
    }
    return this.userSessions.get(phone);
  }

  // Limpa a sessão após finalizar
  clearUserSession(phone) {
    this.userSessions.delete(phone);
  }

  // Processa a mensagem recebida
  async processMessage(sessionName, phone, message, contactId) {
    try {
      // Busca a sessão do WhatsApp no banco
      const whatsappSession = await sessionRepository.findByName(sessionName);

      if (!whatsappSession) {
        logger.error(`Sessão ${sessionName} não encontrada no banco`);
        return null;
      }

      if (!message || typeof message !== 'string') {
        logger.error(`Mensagem inválida recebida: ${typeof message}`, message);
        return null;
      }

      const userSession = this.getOrCreateUserSession(phone);
      const cleanMessage = message.trim();

      logger.debug(`[${phone}] Step atual: ${userSession.step}, Mensagem: ${cleanMessage}`);

      // ETAPA INITIATION: Verifica palavra-chave de iniciação
      if (userSession.step === 'INITIATION') {
        return await this.handleInitiation(whatsappSession, userSession, cleanMessage, phone, sessionName, contactId);
      }

      // ETAPA NAME: Coleta nome do contato
      if (userSession.step === 'NAME') {
        return await this.handleNameCollection(whatsappSession, userSession, cleanMessage, phone, sessionName);
      }

      // ETAPA MENU: Aguarda seleção de bot
      if (userSession.step === 'MENU') {
        return await this.handleBotSelection(whatsappSession, userSession, cleanMessage, phone, sessionName);
      }

      // ETAPA BOT_ACTIVE: Processa respostas dentro do bot ativo
      if (userSession.step === 'BOT_ACTIVE') {
        return await this.handleBotInteraction(userSession, cleanMessage);
      }

      // Estado desconhecido
      logger.warn(`[${phone}] Estado desconhecido: ${userSession.step}`);
      this.clearUserSession(phone);
      return {
        message: 'Ocorreu um erro. Vamos recomeçar. Envie uma nova mensagem.',
        shouldContinue: false
      };

    } catch (error) {
      logger.error('Erro ao processar mensagem do bot:', error);
      throw error;
    }
  }

  // ETAPA 1: INITIATION - Verifica palavra-chave de iniciação
  async handleInitiation(whatsappSession, userSession, message, phone, sessionName, contactId) {
    const keyword = whatsappSession.initiationKeyword || 'PROSSEGUIR';

    // Comparação case-insensitive e sem acentos
    if (normalizeText(message) === normalizeText(keyword)) {
      // Palavra-chave correta, verifica se contato existe
      const contact = await contactRepository.findByNumber(phone.replace(/\D/g, ''));

      if (!contact) {
        // Contato não existe - pedir nome
        logger.info(`[${phone}] Iniciação OK, mas contato não cadastrado - solicitando nome`);
        userSession.step = 'NAME';

        const nameMessage = whatsappSession.initiationMessage
          ? `${whatsappSession.initiationMessage}\n\n📝 Para continuar, por favor, informe seu nome:`
          : '📝 Para continuar, por favor, informe seu nome:';

        return {
          message: nameMessage,
          shouldContinue: true
        };
      } else {
        // Contato existe - mostrar menu de bots
        logger.info(`[${phone}] Iniciação OK, contato encontrado: ${contact.name}`);
        userSession.step = 'MENU';
        userSession.contactName = contact.name;
        userSession.contact = contact;

        return await this.showBotMenu(whatsappSession, userSession, sessionName);
      }
    } else {
      // Palavra-chave incorreta, enviar mensagem de iniciação novamente
      const initiationMsg = whatsappSession.initiationMessage ||
        `👋 Olá! Bem-vindo(a) ao nosso atendimento automático.\n\nPara continuar, por favor digite: ${keyword}`;

      return {
        message: initiationMsg,
        shouldContinue: true
      };
    }
  }

  // ETAPA 2: NAME - Coleta nome do contato
  async handleNameCollection(whatsappSession, userSession, message, phone, sessionName) {
    const name = message.trim();

    if (name.length < 3) {
      return {
        message: '🤔 Por favor, informe um nome válido com pelo menos 3 caracteres:',
        shouldContinue: true
      };
    }

    // Cria o contato no banco
    try {
      const newContact = await contactRepository.updateOrCreate(phone.replace(/\D/g, ''), {
        name,
        phone: phone.replace(/\D/g, ''),
        sessionName
      });

      logger.info(`✅ Contato criado: ${newContact.name} (${newContact.phone})`);
      userSession.contactName = newContact.name;
      userSession.contact = newContact;
      userSession.step = 'MENU';

      // Mostrar menu de bots
      return await this.showBotMenu(whatsappSession, userSession, sessionName);

    } catch (error) {
      logger.error('Erro ao criar contato:', error);
      return {
        message: '😔 Desculpe, ocorreu um erro ao registrar seu nome. Por favor, tente novamente:',
        shouldContinue: true
      };
    }
  }

  // ETAPA 3: MENU - Mostra menu de bots vinculados à sessão
  async showBotMenu(whatsappSession, userSession, sessionName) {
    // Busca todos os bots ativos vinculados a esta sessão
    const bots = await botConfigRepository.findAll({
      query: {
        sessionId: whatsappSession._id,
        enabled: true,
        isActive: true,
        triggerKeyword: { $exists: true, $ne: null, $ne: '' }
      },
      page: 0,
      rowsPerPage: 100
    });

    if (!bots.items || bots.items.length === 0) {
      logger.warn(`[${sessionName}] Nenhum bot ativo encontrado para esta sessão`);
      return {
        message: '⚠️ Desculpe, não há opções de atendimento disponíveis no momento.\n\nPor favor, entre em contato com um atendente.',
        shouldContinue: false
      };
    }

    // Monta mensagem de menu
    const contactName = userSession.contactName || 'Bem-vindo(a)';
    let menuMessage = `👋 Olá, *${contactName}*! Que bom ter você aqui!\n\n`;
    menuMessage += `📋 *Em qual das opções posso te ajudar?*\n\n`;

    bots.items.forEach(bot => {
      menuMessage += `▪️ Para *${bot.name}*, digite: *${bot.triggerKeyword}*\n`;
    });

    userSession.availableBots = bots.items; // Armazena bots disponíveis

    return {
      message: menuMessage,
      shouldContinue: true
    };
  }

  // ETAPA 4: BOT SELECTION - Processa seleção de bot
  async handleBotSelection(whatsappSession, userSession, message, phone, sessionName) {
    const normalizedMessage = normalizeText(message);

    // Procura bot pela palavra-chave (comparação sem acentos e case-insensitive)
    const selectedBot = userSession.availableBots?.find(
      bot => normalizeText(bot.triggerKeyword || '') === normalizedMessage
    );

    if (!selectedBot) {
      // Palavra-chave não reconhecida, reexibir menu
      logger.warn(`[${phone}] Palavra-chave "${normalizedMessage}" não reconhecida`);
      return await this.showBotMenu(whatsappSession, userSession, sessionName);
    }

    // Bot selecionado, ativar
    logger.info(`[${phone}] Bot selecionado: ${selectedBot.name} (${selectedBot.triggerKeyword})`);
    userSession.step = 'BOT_ACTIVE';
    userSession.currentBotId = selectedBot._id;
    userSession.botStep = 0;

    // Verificar horário de funcionamento
    if (!this.isBusinessHours(selectedBot.businessHours)) {
      this.clearUserSession(phone);
      return {
        message: selectedBot.businessHours.offHoursMessage ||
          'Estamos fora do horário de atendimento. Nosso horário é das 9h às 18h.',
        shouldContinue: false
      };
    }

    // Enviar mensagem de boas-vindas do bot e primeira pergunta
    const welcomeMsg = selectedBot.welcomeMessage || 'Vamos começar!';
    const firstQuestion = await this.getNextQuestion(selectedBot._id, 1);

    if (!firstQuestion) {
      logger.error(`[${phone}] Bot ${selectedBot.name} não possui perguntas configuradas`);
      this.clearUserSession(phone);
      return {
        message: '⚠️ Desculpe, este atendimento ainda não está configurado.\n\nPor favor, escolha outra opção ou entre em contato com um atendente.',
        shouldContinue: false
      };
    }

    userSession.botStep = 1;

    let response = `${welcomeMsg}\n\n${firstQuestion.question}`;

    if (firstQuestion.options?.length > 0) {
      response += '\n\n';
      firstQuestion.options.forEach(opt => {
        response += `${opt.value} - ${opt.text}\n`;
      });
    }

    return {
      message: response,
      shouldContinue: true
    };
  }

  // ETAPA 5: BOT INTERACTION - Processa respostas dentro do bot
  async handleBotInteraction(userSession, message) {
    const botConfig = await botConfigRepository.findById(userSession.currentBotId);

    if (!botConfig) {
      logger.error(`Bot ${userSession.currentBotId} não encontrado`);
      this.clearUserSession(userSession.phone);
      return {
        message: '⚠️ Ocorreu um erro. Por favor, reinicie o atendimento.',
        shouldContinue: false
      };
    }

    // Verificar comandos de saída
    const lowerMessage = message.toLowerCase().trim();
    const exitCommands = ['sair', 'cancelar', 'atendente', 'humano', 'falar com atendente', 'operador'];

    if (exitCommands.some(cmd => lowerMessage.includes(cmd))) {
      this.clearUserSession(userSession.phone);
      logger.info(`👤 Cliente ${userSession.phone} solicitou atendimento humano`);

      return {
        message: '👤 Entendi! Vou transferir você para um atendente humano.\n\nPor favor, aguarde que alguém irá te atender em breve.',
        shouldContinue: false,
        transferToHuman: true
      };
    }

    // Processar step atual
    return await this.processStep(botConfig, userSession, message);
  }

  // Processa cada etapa da conversa dentro do bot
  async processStep(botConfig, userSession, message) {
    const autoResponses = await autoResponseRepository.findByBotConfig(botConfig._id);
    const currentResponse = autoResponses.find(ar => ar.priority === userSession.botStep);

    if (!currentResponse) {
      this.clearUserSession(userSession.phone);
      return {
        message: 'Desculpe, ocorreu um erro. O atendimento foi encerrado.',
        shouldContinue: false,
        error: true
      };
    }

    // Valida e armazena a resposta
    const validation = this.validateResponse(currentResponse, message);

    if (!validation.valid) {
      return {
        message: validation.error,
        shouldContinue: true,
        retryStep: true
      };
    }

    // Armazena a resposta
    userSession.data[currentResponse.action] = validation.value;

    // Verificar se a opção selecionada tem ação especial
    if (validation.option) {
      const optionAction = validation.option.action || 'nextStep';

      // Ação: FINISH - Finalizar atendimento
      if (optionAction === 'finish') {
        return await this.finalizeBotInteraction(userSession, botConfig, currentResponse.answer);
      }

      // Ação: CALL_BOT - Chamar outro bot
      if (optionAction === 'callBot' && validation.option.targetBotId) {
        return await this.switchToBot(userSession, validation.option.targetBotId, currentResponse.answer);
      }

      // Ação: NEXT_STEP - Continuar para próximo step (padrão)
    }

    // Verifica se é a última etapa do bot
    const nextResponse = autoResponses.find(ar => ar.priority === userSession.botStep + 1);

    if (!nextResponse) {
      // Finaliza e cria o agendamento/registro
      return await this.finalizeAppointment(userSession, botConfig);
    }

    // Avança para próxima etapa
    userSession.botStep++;

    let responseMessage = currentResponse.answer;
    if (nextResponse.question) {
      responseMessage += `\n\n${nextResponse.question}`;
    }

    if (nextResponse.options?.length > 0) {
      responseMessage += '\n\n';
      nextResponse.options.forEach(opt => {
        responseMessage += `${opt.value} - ${opt.text}\n`;
      });
    }

    return {
      message: responseMessage,
      shouldContinue: true
    };
  }

  // Finalizar interação do bot manualmente (antes do último step)
  async finalizeBotInteraction(userSession, botConfig, finalMessage) {
    this.clearUserSession(userSession.phone);

    return {
      message: finalMessage || 'Atendimento finalizado. Obrigado!',
      shouldContinue: false,
      finishedByUser: true
    };
  }

  // Trocar para outro bot
  async switchToBot(userSession, targetBotId, transitionMessage) {
    const targetBot = await botConfigRepository.findById(targetBotId);

    if (!targetBot || !targetBot.enabled) {
      this.clearUserSession(userSession.phone);
      return {
        message: '⚠️ Desculpe, este serviço não está disponível no momento.',
        shouldContinue: false,
        error: true
      };
    }

    logger.info(`[${userSession.phone}] Trocando de bot para: ${targetBot.name}`);

    // Reset bot state
    userSession.currentBotId = targetBotId;
    userSession.botStep = 1;
    userSession.data = {}; // Limpar dados anteriores

    const firstQuestion = await this.getNextQuestion(targetBotId, 1);

    if (!firstQuestion) {
      this.clearUserSession(userSession.phone);
      return {
        message: '⚠️ Desculpe, este atendimento ainda não está configurado.',
        shouldContinue: false,
        error: true
      };
    }

    let response = transitionMessage ? `${transitionMessage}\n\n` : '';
    response += `${targetBot.welcomeMessage}\n\n${firstQuestion.question}`;

    if (firstQuestion.options?.length > 0) {
      response += '\n\n';
      firstQuestion.options.forEach(opt => {
        response += `${opt.value} - ${opt.text}\n`;
      });
    }

    return {
      message: response,
      shouldContinue: true,
      botSwitch: true
    };
  }
 normalizeDate(value) {
    if (!value) return null;

    // Já é Date
    if (value instanceof Date && !isNaN(value)) {
      return value;
    }

    // String no formato DD/MM/YYYY
    if (typeof value === 'string') {
      const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (match) {
        const [, day, month, year] = match;
        const date = new Date(year, month - 1, day);
        return isNaN(date.getTime()) ? null : date;
      }
    }

    return null;
  }

  // Finaliza e cria o agendamento/registro
  async finalizeAppointment(userSession, botConfig) {
    try {
      const scheduledDate = this.normalizeDate(userSession.data.scheduledDate || userSession.data.date)
      // Prepara os dados do agendamento/registro
      const appointmentData = {
        contactId: userSession.contact?._id,
        phone: userSession.phone,
        scheduledDate: scheduledDate,
        scheduledTime: userSession.data.scheduledTime || userSession.data.time || '09:00',
        description: userSession.data.description,
        service: userSession.data.service_type || userSession.data.service || botConfig.name,
        status: 'scheduled',
        reminderSent: false,
        botData: userSession.data
      };

      // Cria o agendamento
      const appointment = await appointmentRepository.create(appointmentData);

      // Limpa a sessão
      this.clearUserSession(userSession.phone);

      // Monta mensagem de confirmação
      let confirmationMessage = `✅ *${botConfig.confirmationMessage || 'Registro confirmado!'}*\n\n`;

      if (appointment.scheduledDate) {
        confirmationMessage += `📅 *Data:* ${appointment.scheduledDate.toLocaleDateString('pt-BR')}\n`;
      }
      if (appointment.scheduledTime) {
        confirmationMessage += `🕐 *Horário:* ${appointment.scheduledTime}\n`;
      }
      if (appointment.service) {
        confirmationMessage += `📋 *Serviço:* ${appointment.service}\n`;
      }
      if (appointment.description) {
        confirmationMessage += `📝 *Detalhes:* ${appointment.description}\n`;
      }

      confirmationMessage += `\n✅ Agendamento realizado com sucesso!\n`;
      confirmationMessage += `Você receberá um lembrete antes do horário agendado.\n\n`;
      confirmationMessage += `Obrigado! 😊`;

      return {
        message: confirmationMessage,
        shouldContinue: false,
        appointment,
        completed: true
      };

    } catch (error) {
      logger.error('Erro ao finalizar agendamento:', error);
      this.clearUserSession(userSession.phone);

      return {
        message: 'Desculpe, ocorreu um erro ao processar seu agendamento. Por favor, tente novamente mais tarde.',
        shouldContinue: false,
        error: true
      };
    }
  }

  // Valida a resposta do usuário
  validateResponse(autoResponse, message) {
    let result = { valid: true, value: message };

    // Validação por tipo
    switch (autoResponse.triggerType) {
      case 'text':
        if (!message || message.trim().length < 3) {
          return {
            valid: false,
            error: 'Por favor, forneça uma resposta válida com pelo menos 3 caracteres.'
          };
        }
        result.value = message.trim();
        break;

      case 'date':
        const dateMatch = message.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (!dateMatch) {
          return {
            valid: false,
            error: 'Por favor, use o formato DD/MM/AAAA (ex: 15/12/2024)'
          };
        }

        const [, day, month, year] = dateMatch;
        const date = new Date(year, month - 1, day);

        if (isNaN(date.getTime())) {
          return {
            valid: false,
            error: 'Data inválida. Por favor, verifique os valores.'
          };
        }

        result.value = date;
        break;

      case 'time':
        const timeMatch = message.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
        if (!timeMatch) {
          return {
            valid: false,
            error: 'Por favor, use o formato HH:mm (ex: 14:30)'
          };
        }
        result.value = message;
        break;

      case 'option':
        const normalizedMsg = normalizeText(message);
        const option = autoResponse.options.find(
          opt => normalizeText(opt.value) === normalizedMsg || normalizeText(opt.text) === normalizedMsg
        );

        if (!option) {
          const optionsList = autoResponse.options.map(o => `${o.value} - ${o.text}`).join('\n');
          return {
            valid: false,
            error: `Por favor, escolha uma das opções:\n${optionsList}`
          };
        }

        result.value = option.value;
        result.option = option;
        break;

      case 'phone':
        const phoneMatch = message.match(/^(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}$/);
        if (!phoneMatch) {
          return {
            valid: false,
            error: 'Por favor, forneça um telefone válido (ex: (11) 98765-4321)'
          };
        }
        result.value = message.replace(/\D/g, '');
        break;

      case 'email':
        const emailMatch = message.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (!emailMatch) {
          return {
            valid: false,
            error: 'Por favor, forneça um e-mail válido'
          };
        }
        result.value = message.toLowerCase().trim();
        break;

      case 'number':
        const num = parseFloat(message);
        if (isNaN(num)) {
          return {
            valid: false,
            error: 'Por favor, forneça um número válido'
          };
        }
        result.value = num;
        break;

      default:
        result.value = message;
    }

    // Validações customizadas
    if (autoResponse.validations && autoResponse.validations.length > 0) {
      for (const validation of autoResponse.validations) {
        const customValidation = this.applyCustomValidation(validation, result.value, autoResponse.triggerType);
        if (!customValidation.valid) {
          return customValidation;
        }
      }
    }

    return result;
  }

  // Aplica validações customizadas
  applyCustomValidation(validation, value, triggerType) {
    switch (validation.type) {
      case 'minLength':
        if (typeof value === 'string' && value.length < validation.value) {
          return {
            valid: false,
            error: validation.errorMessage || `Mínimo de ${validation.value} caracteres`
          };
        }
        break;

      case 'maxLength':
        if (typeof value === 'string' && value.length > validation.value) {
          return {
            valid: false,
            error: validation.errorMessage || `Máximo de ${validation.value} caracteres`
          };
        }
        break;

      case 'futureDate':
        if (value instanceof Date) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (value < today) {
            return {
              valid: false,
              error: validation.errorMessage || 'A data deve ser futura'
            };
          }
        }
        break;

      case 'businessDays':
        if (value instanceof Date) {
          const dayOfWeek = value.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            return {
              valid: false,
              error: validation.errorMessage || 'Por favor, escolha um dia útil (segunda a sexta)'
            };
          }
        }
        break;
    }

    return { valid: true, value };
  }

  // Obtém a próxima pergunta
  async getNextQuestion(botId, step) {
    const autoResponses = await autoResponseRepository.findByBotConfig(botId);
    const nextResponse = autoResponses.find(ar => ar.priority === step);

    if (!nextResponse) return null;

    return {
      question: nextResponse.question,
      triggerType: nextResponse.triggerType,
      options: nextResponse.options
    };
  }

  // Verifica horário comercial
  isBusinessHours(businessHours) {
    if (!businessHours || !businessHours.enabled) {
      return true;
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return currentTime >= businessHours.startTime && currentTime <= businessHours.endTime;
  }
  
}

export default new BotAgendaService();
