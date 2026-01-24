import logger from "../utils/logger.js";
import whatsappService from "./whatsapp.service.js";
import ticketRepository from '../repositories/ticket.repository.js'
import botAgendaService from './bot-agenda.service.js';

export const initSocket = (io) => {
  io.on("connection", (socket) => {
    logger.info(`Cliente conectado: ${socket.id}`);

    // Evento para entrar em uma sala específica da sessão
    socket.on("join-session", async (sessionName) => {
      // logger.info(`Socket ${socket.id} entrou na sala: ${sessionName}`);
      socket.join(sessionName);

      const session = whatsappService.sessions.get(sessionName);

      if (session && session.qrCode) {
        socket.emit("qrCodeUpdate", {
          session: sessionName,
          qrCode: session.qrCode,
          status: session.status,
        });
      }
    });

    socket.on("leave-session", (sessionName) => {
      socket.leave(sessionName);
      // logger.info(`Socket ${socket.id} saiu da sala: ${sessionName}`);
    });

    socket.on("disconnect", () => {
      logger.info(`Socket desconectado: ${socket.id}`);
    });

    // usado para reconectar o whatsapp
    socket.on("reconnectSession", async (data) => {
      try {
        const { sessionName } = data;
        logger.info(
          `Socket ${socket.id} solicitando reconexão: ${sessionName}`
        );

        const result = await whatsappService.reconnectSession(sessionName);

        socket.emit("sessionReconnected", {
          session: sessionName,
          success: true,
          message: "Sessão reconectada com sucesso",
        });

        socket.to(sessionName).emit("statusUpdate", {
          session: sessionName,
          status: "connecting",
        });
      } catch (error) {
        logger.error(`Erro na reconexão via socket:`, error);
        socket.emit("sessionReconnectError", {
          error: error.message,
          session: data.sessionName,
        });
      }
    });
    socket.on("rescueMessages", async (data) => {
      try {
        const { sessionName, contactNumber } = data;

        if (!contactNumber || !sessionName) {
          logger.warn(`rescueMessages: dados incompletos - session: ${sessionName}, contact: ${contactNumber}`);
          socket.emit("recoveryMessages", { success: false, messages: [], error: 'Dados incompletos' });
          return;
        }

        logger.info(`Socket ${socket.id} solicitando mensagens: ${sessionName} - ${contactNumber}`);

        const result = await whatsappService.syncMessages(sessionName, contactNumber);

        // Verifica se o resultado indica erro
        if (result && result.success === false) {
          logger.warn(`Falha ao recuperar mensagens: ${result.error}`);
          socket.emit("recoveryMessages", result);
          return;
        }

        socket.emit("recoveryMessages", {
          ...result,
        });

      } catch (error) {
        logger.error(`Erro ao recuperar mensagens via socket:`, error);
        socket.emit("recoveryMessages", {
          success: false,
          error: error.message,
          messages: []
        });
      }
    });

    socket.on("sendMessage", async (data) => {
      try {
        const { sessionName, contactNumber, message, ticketId } = data;
        logger.info(
          `Socket ${socket.id} enviando Mensagem: ${sessionName}`
        );

        const result = await whatsappService.sendMessage(sessionName, contactNumber, message);
        if (ticketId) {
          await ticketRepository.updateStatus(ticketId, 'in_progress')
        }
        /*
        socket.emit("sentMessage", {
          ...result,
        });
        */
        socket.emit('rescueMessages', data)

      } catch (error) {
        logger.error(`Erro na reconexão via socket:`, error);
        socket.emit("sessionReconnectError", {
          error: error.message,
          session: data.sessionName,
        });
      }
    });

    socket.on("botMessage", async (data) => {
      try {
        const { sessionName, contactNumber, message, contactId } = data;

        logger.info(`Bot processando mensagem de ${contactNumber}`);

        const result = await botAgendaService.processMessage(
          sessionName,
          contactNumber,
          message,
          contactId
        );

        if (result) {
          // Envia a resposta do bot
          await whatsappService.sendMessage(sessionName, contactNumber, result.message);

          socket.emit("botResponse", {
            session: sessionName,
            contact: contactNumber,
            response: result.message,
            shouldContinue: result.shouldContinue,
            nextStep: result.nextStep,
            appointment: result.appointment,
            ticket: result.ticket
          });

          // Se houver próxima pergunta, envia automaticamente
          if (result.nextStep) {
            let questionMessage = result.nextStep.question;

            // Se houver opções, formata a mensagem
            if (result.nextStep.options && result.nextStep.options.length > 0) {
              questionMessage += '\n\n';
              result.nextStep.options.forEach(opt => {
                questionMessage += `${opt.value} - ${opt.text}\n`;
              });
            }

            await whatsappService.sendMessage(sessionName, contactNumber, questionMessage);
          }
        }

      } catch (error) {
        logger.error(`Erro no bot via socket:`, error);
        socket.emit("botError", {
          error: error.message,
          session: data.sessionName,
          contact: data.contactNumber
        });
      }
    });

    // Log para todos os eventos recebidos
    socket.onAny((eventName, ...args) => {
      console.log(`📡 Evento recebido: ${eventName}`, args);
    });
  });
};
