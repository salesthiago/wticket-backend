import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import { connectWithRetry } from "./config/database.js";
import logger from "./utils/logger.js";
import pendingDebtNotifierJob from "./jobs/pending-debt-notifier.job.js";
import trialExpirationJob from "./jobs/trial-expiration.job.js";
// import { Server } from "socket.io";
// import { verifyToken } from "./middleware/auth.middleware.js";
// import { initSocket } from "./services/socket.service.js";
// import whatsappService from "./services/whatsapp.service.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

connectWithRetry();

const server = http.createServer(app);

// --- Socket.IO desabilitado temporariamente (será um serviço separado no futuro) ---
// const io = new Server(server, {
//   cors: {
//     origin: "*",
//   }
// });
//
// io.use((socket, next) => {
//   if (process.env.NODE_ENV === "development") {
//     console.log("✅ Conexão Socket.io permitida (modo desenvolvimento)");
//     return next();
//   }
//   const token = socket.handshake.auth?.token || socket.handshake.query?.token;
//
//   if (!token) {
//     console.log("❌ Token de autenticação necessário");
//     return next(new Error("Authentication token required"));
//   }
//
//   try {
//     const payload = verifyToken(token);
//     if (!payload) {
//       console.log("❌ Token inválido");
//       return next(new Error("Invalid token"));
//     }
//     socket.user = payload;
//     console.log('payload ', payload);
//     console.log("✅ Usuário autenticado via Socket.io:", payload.sub);
//     next();
//   } catch (error) {
//     console.log("❌ Erro na verificação do token:", error.message);
//     return next(new Error("Token verification failed"));
//   }
// });

logger.info("════════════════════════════════════════════════════════════");
logger.info("🚀 INICIANDO SERVIDOR WTICKET");
logger.info("════════════════════════════════════════════════════════════");
logger.info(`📊 Porta: ${PORT}`);
logger.info(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
logger.info(`📝 Nível de log: ${process.env.LOG_LEVEL || 'debug'}`);
logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
logger.info("════════════════════════════════════════════════════════════\n");

// --- WhatsApp Service desabilitado temporariamente (será um serviço separado no futuro) ---
// logger.info("🔌 Configurando Socket.IO no WhatsApp Service...");
// whatsappService.setSocketIO(io);
//
// logger.info("📦 Inicializando sessões do banco de dados...");
// whatsappService.initializeFromDatabase();
//
// logger.info("🔌 Inicializando Socket.IO handlers...");
// initSocket(io);

pendingDebtNotifierJob.start();
trialExpirationJob.start();

server.listen(PORT, () => {
  logger.info("\n════════════════════════════════════════════════════════════");
  logger.info(`✅ SERVIDOR RODANDO NA PORTA ${PORT}`);
  logger.info("════════════════════════════════════════════════════════════\n");
});
