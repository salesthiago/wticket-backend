import logger from "../utils/logger.js";
import whatsappService from "./whatsapp.service.js";

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
        logger.info(
          `Socket ${socket.id} solicitando reconexão: ${sessionName}`
        );

        const result = await whatsappService.syncMessages(sessionName, contactNumber);

        socket.emit("recoveryMessages", {
          ...result,
        });

       
      } catch (error) {
        logger.error(`Erro na reconexão via socket:`, error);
        socket.emit("sessionReconnectError", {
          error: error.message,
          session: data.sessionName,
        });
      }
    });

    // Log para todos os eventos recebidos
    socket.onAny((eventName, ...args) => {
      console.log(`📡 Evento recebido: ${eventName}`, args);
    });
  });
};
