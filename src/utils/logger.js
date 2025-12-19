import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Criar diretório de logs se não existir
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('📁 Diretório de logs criado:', logsDir);
}

// Formatar com cores e informações detalhadas
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

  // Adicionar metadados se existirem
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata, null, 2)}`;
  }

  return msg;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug', // Mudado para debug por padrão
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    customFormat
  ),
  transports: [
    new winston.transports.Console(),
    // Log de erros em arquivo separado
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Log geral em arquivo
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ],
});

export default logger;
