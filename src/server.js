import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import { connectWithRetry } from "./config/database.js";
import logger from "./utils/logger.js";
import { Server } from "socket.io";
import { verifyToken } from "./middleware/auth.middleware.js";
import { initSocket } from "./services/socket.service.js";
import whatsappService from "./services/whatsapp.service.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

connectWithRetry();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

// middleware to authenticate socket connections using token in query or auth headers
io.use((socket, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log("✅ Conexão Socket.io permitida (modo desenvolvimento)");
    return next();
  }
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    console.log("❌ Token de autenticação necessário");
    return next(new Error("Authentication token required"));
  }

  try {
    const payload = verifyToken(token);
    if (!payload) {
      console.log("❌ Token inválido");
      return next(new Error("Invalid token"));
    }
    socket.user = payload;
    console.log('payload ', payload)
    console.log("✅ Usuário autenticado via Socket.io:", payload.sub);
    next();
  } catch (error) {
    console.log("❌ Erro na verificação do token:", error.message);
    return next(new Error("Token verification failed"));
  }
});

whatsappService.setSocketIO(io);
whatsappService.initializeFromDatabase();

initSocket(io);

server.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
