import { create, Whatsapp } from "@wppconnect-team/wppconnect";
import logger from "../utils/logger.js";
import sessionRepository from "../repositories/session.repository.js";
import ticketRepository from "../repositories/ticket.repository.js";
import syncService from "../services/sync.service.js";
import botConfigRepository from "../repositories/bot-config.repository.js";
import botAgendaService from "./bot-agenda.service.js";
import fs from "fs";
import path from "path";

class WhatsAppService {
  constructor() {
    this.sessions = new Map();
    this.io = null;
    this.clients = new Map();
    this.healthCheckInterval = null;
  }

  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // Verificar a cada 30 segundos

    logger.info("Health Check iniciado");
  }

  setSocketIO(io) {
    this.io = io;
    console.log("setSocketIO iniciado com sucesso");
  }

   async performHealthCheck() {
    try {
      const dbSessions = await sessionRepository.findAll();
      
      for (const dbSession of dbSessions) {
        if (dbSession.status === "connected") {
          const client = this.clients.get(dbSession.name);
          
          // Verificar se o cliente existe e está conectado
          if (!client) {
            logger.warn(`Cliente ausente para sessão conectada: ${dbSession.name}`);
            await this.reconnectSession(dbSession.name);
            continue;
          }

          // Verificar conexão real
          const isConnected = await this.checkClientConnection(client);
          if (!isConnected) {
            logger.warn(`Cliente desconectado: ${dbSession.name}`);
            await sessionRepository.updateStatus(dbSession.name, "disconnected");
            await this.reconnectSession(dbSession.name);
          }
        }
      }
    } catch (error) {
      logger.error("Erro no Health Check:", error);
    }
  }

  async checkClientConnection(client) {
    try {
      // Tentar buscar informações do host
      const hostDevice = await client.getHostDevice();
      return !!hostDevice;
    } catch (error) {
      return false;
    }
  }

  // ✅ MODIFICAR initializeFromDatabase
  async initializeFromDatabase() {
    try {
      logger.info("════════════════════════════════════════════════════════════");
      logger.info("🚀 INICIALIZANDO SESSÕES DO BANCO DE DADOS");
      logger.info("════════════════════════════════════════════════════════════");

      const dbSessions = await sessionRepository.findAll();
      logger.info(`📊 Encontradas ${dbSessions.length} sessão(ões) no banco de dados`);

      if (dbSessions.length === 0) {
        logger.info("ℹ️ Nenhuma sessão encontrada no banco de dados");
      }

      for (const dbSession of dbSessions) {
        logger.info(`\n📋 Processando sessão: ${dbSession.name}`);
        logger.info(`   Status atual: ${dbSession.status}`);
        logger.info(`   Última atividade: ${dbSession.lastActivity}`);

        if (dbSession.status === "connected") {
          logger.info(`🔄 Restaurando sessão conectada: ${dbSession.name}`);
          try {
            // ✅ USAR NOME REAL
            const client = await this.createSession(dbSession.name, false);

            if (client) {
              this.clients.set(dbSession.name, client);
              logger.info(`✅ Sessão ${dbSession.name} restaurada com sucesso`);

              logger.info(`📥 Sincronizando mensagens não lidas...`);
              await this.syncUnreadMessages(dbSession.name, client);
            } else {
              logger.warn(`⚠️ Cliente não foi criado para ${dbSession.name}`);
            }
          } catch (error) {
            logger.error(`❌ Erro ao restaurar sessão ${dbSession.name}:`, error);
            await sessionRepository.updateStatus(dbSession.name, "failed");
          }
        } else {
          logger.debug(`⏭️ Ignorando sessão ${dbSession.name} (status: ${dbSession.status})`);
        }
      }

      logger.info("\n════════════════════════════════════════════════════════════");
      logger.info("✅ INICIALIZAÇÃO CONCLUÍDA");
      logger.info("════════════════════════════════════════════════════════════\n");

      // ✅ INICIAR MONITORAMENTO
      this.startHealthCheck();

    } catch (error) {
      logger.error("❌ ERRO CRÍTICO AO INICIALIZAR DO BANCO:", error);
    }
  }

  async createSession(sessionName, isReconnect = false) {
    try {
      logger.info(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );
      logger.info(
        `🚀 ${isReconnect ? "RECONECTANDO" : "CRIANDO"} SESSÃO: ${sessionName}`
      );
      logger.info(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );

      // ✅ SEMPRE usar o nome real
      logger.debug(`[${sessionName}] Atualizando status no banco de dados para 'initializing'`);
      await sessionRepository.updateOrCreate(sessionName, {
        name: sessionName,
        status: "initializing",
        lastActivity: new Date(),
      });
      logger.debug(`[${sessionName}] Status atualizado no banco de dados com sucesso`);

      logger.debug(`[${sessionName}] Adicionando sessão ao mapa de memória`);
      this.sessions.set(sessionName, {
        client: null,
        status: "initializing",
        qrCode: null,
      });
      logger.debug(`[${sessionName}] Sessão adicionada ao mapa de memória`);

      const tokensPath = path.join(process.cwd(), "tokens", sessionName);
      logger.info(`[${sessionName}] 📁 Diretório de tokens: ${tokensPath}`);
      logger.info(`[${sessionName}] 🔧 Configurações wppconnect:`);
      logger.info(`[${sessionName}]    - autoClose: 60000ms`);
      logger.info(`[${sessionName}]    - createPathFileToken: true`);
      logger.info(`[${sessionName}]    - waitForLogin: true`);

      logger.info(`[${sessionName}] ⏳ Iniciando create() do wppconnect...`);
      const startTime = Date.now();

      // Detectar sistema operacional
      const isWindows = process.platform === 'win32';
      const isLinux = process.platform === 'linux';
      logger.info(`[${sessionName}] 💻 Sistema operacional: ${process.platform}`);

      // Configurações específicas por plataforma
      const browserArgsConfig = isWindows ? [
        // Windows: configurações mais permissivas
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--disable-breakpad',
        '--password-store=basic',
        '--use-mock-keychain',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--disable-features=site-per-process',
        '--window-size=1920,1080'
      ] : [
        // Linux: configurações otimizadas para servidor
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--single-process' // Importante para Amazon Linux
      ];

      logger.debug(`[${sessionName}] 🔧 Args do browser: ${browserArgsConfig.length} argumentos configurados`);

      // Timeout mais longo - 180 segundos (3 minutos)
      const timeoutMs = 180000;
      logger.info(`[${sessionName}] ⏱️ Timeout configurado: ${timeoutMs / 1000}s`);

      // Timeout de segurança para detectar travamentos
      const timeoutId = setTimeout(() => {
        logger.warn(`[${sessionName}] ⏰ AVISO: create() está demorando mais de ${timeoutMs / 1000} segundos!`);
        logger.warn(`[${sessionName}] Possível travamento no processo de inicialização`);
      }, timeoutMs);

      // Verificar se já existe token salvo
      const hasExistingToken = fs.existsSync(tokensPath) &&
                               fs.existsSync(path.join(tokensPath, 'Default')) &&
                               fs.readdirSync(tokensPath).length > 2; // Mais de 2 arquivos/pastas

      logger.info(`[${sessionName}] 🔍 Sessão existente: ${hasExistingToken ? 'SIM' : 'NÃO'}`);

      const client = await create({
        session: sessionName,
        userDataDir: tokensPath,

        // CRÍTICO: Configurações de timeout e comportamento
        autoClose: hasExistingToken ? 0 : timeoutMs, // Sem timeout para sessões existentes
        createPathFileToken: true,
        waitForLogin: true,
        logQR: false,
        disableSpins: true, // Desabilitar animações que podem travar
        disableWelcome: true, // Desabilitar tela de boas-vindas

        // Configurações de Puppeteer
        puppeteerOptions: {
          headless: true,
          devtools: false,
          args: browserArgsConfig,
          executablePath: process.env.CHROME_PATH || undefined,
          // Configurações adicionais para evitar travamentos
          defaultViewport: {
            width: 1920,
            height: 1080
          },
          ignoreHTTPSErrors: true,
          timeout: timeoutMs,
        },

        // Callbacks de progresso
        statusFind: (statusSession) => {
          logger.info(`[${sessionName}] 🔍 Status Find: ${statusSession}`);

          // Emitir progresso via Socket.IO
          if (statusSession === 'inChat' || statusSession === 'isLogged') {
            logger.info(`[${sessionName}] ✅ Status positivo: ${statusSession}`);
          }

          if (statusSession === 'notLogged') {
            logger.info(`[${sessionName}] ℹ️ Aguardando QR Code...`);
          }
        },

        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
          logger.info(`[${sessionName}] 📱 QR CODE RECEBIDO (tentativa ${attempts})`);
          logger.debug(`[${sessionName}] QR Code URL: ${urlCode}`);
          logger.debug(`[${sessionName}] QR Code ASCII length: ${asciiQR?.length || 0}`);
          logger.debug(`[${sessionName}] QR Code base64 length: ${base64Qr?.length || 0}`);

          sessionRepository.updateOrCreate(sessionName, {
            qrCode: base64Qr,
            status: "awaiting_qr",
          }).then(() => {
            logger.debug(`[${sessionName}] QR Code salvo no banco de dados`);
          }).catch((err) => {
            logger.error(`[${sessionName}] Erro ao salvar QR Code no banco:`, err);
          });

          this.emitQRCode(sessionName, base64Qr);
          logger.debug(`[${sessionName}] QR Code emitido via Socket.IO`);
        },

        // Callback de progresso de carregamento
        onLoadingScreen: (percent, message) => {
          logger.info(`[${sessionName}] ⏳ Carregando: ${percent}% - ${message}`);
          this.emitLoading(sessionName, percent, message);
        },
      });

      clearTimeout(timeoutId); // Limpar timeout de segurança

      const elapsedTime = Date.now() - startTime;
      logger.info(`[${sessionName}] ✅ create() finalizado em ${elapsedTime}ms`);

      // ✅ ADICIONAR TRATAMENTO DE DESCONEXÃO
      logger.info(`[${sessionName}] 🎯 Registrando listener de mudança de estado (onStateChange)`);
      client.onStateChange(async (state) => {
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.info(`[${sessionName}] 🔄 MUDANÇA DE ESTADO: ${state}`);
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        if (state === "CONFLICT" || state === "UNLAUNCHED") {
          logger.warn(`[${sessionName}] ⚠️ Estado ${state} detectado - executando useHere()`);
          try {
            await client.useHere();
            logger.info(`[${sessionName}] ✅ useHere() executado com sucesso`);
          } catch (err) {
            logger.error(`[${sessionName}] ❌ Erro ao executar useHere():`, err);
          }
        }

        if (state === "CONNECTED") {
          logger.info(`[${sessionName}] 🎉 SESSÃO CONECTADA COM SUCESSO!`);
          logger.debug(`[${sessionName}] Adicionando cliente ao mapa de clients`);
          this.clients.set(sessionName, client);

          logger.debug(`[${sessionName}] Atualizando status no banco para 'connected'`);
          await sessionRepository.updateOrCreate(sessionName, {
            status: "connected",
            lastActivity: new Date(),
            qrCode: null,
          });
          logger.debug(`[${sessionName}] Status atualizado no banco de dados`);

          this.emitSuccess(sessionName, "Sessão conectada!");
          logger.debug(`[${sessionName}] Evento de sucesso emitido via Socket.IO`);

          // Buscar informações do dispositivo conectado
          try {
            const hostDevice = await client.getHostDevice();
            logger.info(`[${sessionName}] 📱 Dispositivo conectado:`, {
              phone: hostDevice?.phone,
              platform: hostDevice?.platform,
              manufacturer: hostDevice?.manufacturer
            });
          } catch (err) {
            logger.debug(`[${sessionName}] Não foi possível obter informações do dispositivo:`, err.message);
          }
        }

        // ✅ TRATAR DESCONEXÕES
        if (state === "DISCONNECTED" || state === "TIMEOUT") {
          logger.warn(`[${sessionName}] ⚠️ SESSÃO DESCONECTADA - Estado: ${state}`);
          logger.debug(`[${sessionName}] Atualizando status no banco para 'disconnected'`);
          await sessionRepository.updateStatus(sessionName, "disconnected");

          logger.debug(`[${sessionName}] Removendo cliente do mapa de clients`);
          this.clients.delete(sessionName);

          // Tentar reconectar após 5 segundos
          logger.info(`[${sessionName}] ⏰ Agendando reconexão em 5 segundos...`);
          setTimeout(() => {
            logger.info(`[${sessionName}] 🔄 Iniciando tentativa de reconexão...`);
            this.reconnectSession(sessionName);
          }, 5000);
        }
      });

      // ✨ LISTENER DE MENSAGENS RECEBIDAS - Processa automaticamente por bot se vinculado
      logger.info(`[${sessionName}] 📨 Registrando listener de mensagens (onMessage)`);
      client.onMessage(async (message) => {
        logger.debug(`[${sessionName}] 📩 Nova mensagem recebida de: ${message.from}`);
        await this.handleIncomingMessage(sessionName, client, message);
      });

      // Adicionar listener para erros do cliente
      logger.info(`[${sessionName}] ⚠️ Registrando listener de erros`);
      client.onIncomingCall(async (call) => {
        logger.info(`[${sessionName}] 📞 Chamada recebida de: ${call.peerJid}`);
      });

      logger.info(`[${sessionName}] ✅ Todos os listeners registrados com sucesso`);
      logger.info(`[${sessionName}] 🎯 Cliente criado e pronto para uso`);

      return client;
    } catch (error) {
      logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.error(`[${sessionName}] ❌ ERRO CRÍTICO AO CRIAR SESSÃO`);
      logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.error(`[${sessionName}] Tipo do erro: ${error.name}`);
      logger.error(`[${sessionName}] Mensagem: ${error.message}`);
      logger.error(`[${sessionName}] Stack trace:`, error.stack);

      // Atualizar status para failed
      try {
        await sessionRepository.updateStatus(sessionName, "failed");
        logger.debug(`[${sessionName}] Status atualizado para 'failed' no banco de dados`);
      } catch (dbError) {
        logger.error(`[${sessionName}] Erro ao atualizar status no banco:`, dbError);
      }

      // Emitir erro via Socket.IO
      this.emitError(sessionName, error.message);

      throw error;
    }
  }

  async handleIncomingMessage(sessionName, client, message) {
    try {
      // Ignora mensagens próprias, grupos, broadcasts, status
      const shouldIgnore =
        message.from.includes('status@broadcast') ||
        message.from.includes('@g.us') ||
        message.fromMe ||
        message.broadcast ||
        (message.from.includes('@broadcast') && !message.from.includes('@c.us'));

      if (shouldIgnore) {
        logger.info(`🚫 Ignorando mensagem de: ${message.from}`);
        return;
      }

      const contactNumber = message.from.replace('@c.us', '');
      const contactName = message.sender?.name || message.sender?.pushname || contactNumber;

      // Busca a sessão no banco para pegar o ID
      const session = await sessionRepository.findByName(sessionName);

      if (!session) {
        logger.warn(`Sessão ${sessionName} não encontrada no banco`);
        return;
      }

      // CHAVE: Verifica se existe bot ativo vinculado a esta sessão
      const botConfig = await botConfigRepository.findBySessionId(session._id);

      if (botConfig) {
        logger.info(`🤖 Bot "${botConfig.name}" vinculado à sessão ${sessionName} - processando automaticamente`);

        // Busca ou cria ticket
        let ticket = await ticketRepository.findByContact(sessionName, contactNumber);

        if (!ticket) {
          // Cria novo ticket com status in_progress (bot está atendendo)
          ticket = await ticketRepository.create({
            contactNumber,
            contactName,
            sessionName,
            status: 'in_progress',
            subject: `Atendimento via Bot - ${botConfig.name}`,
            priority: 'medium',
            botHandled: true
          });
          logger.info(`📋 Ticket criado: ${ticket._id} - Status: in_progress (bot atendendo)`);
        } else if (ticket.status === 'opened') {
          // Atualiza para in_progress se estava aberto
          await ticketRepository.updateStatus(ticket._id, 'in_progress');
          logger.info(`📋 Ticket ${ticket._id} atualizado para: in_progress (bot assumiu)`);
        }

        // Processa mensagem pelo bot
        const botResponse = await botAgendaService.processMessage(
          sessionName,
          contactNumber,
          message.body,
          ticket.contactId || contactNumber
        );

        if (botResponse) {
          // Envia resposta do bot
          await this.sendMessage(sessionName, contactNumber, botResponse.message);

          // Se usuário pediu para falar com atendente
          if (botResponse.transferToHuman) {
            await ticketRepository.updateStatus(ticket._id, 'opened', {
              notes: 'Cliente solicitou atendimento humano durante bot'
            });
            logger.info(`📋 Ticket ${ticket._id} transferido para humano`);
          }

          // Se bot finalizou com sucesso, fecha o ticket
          if (!botResponse.shouldContinue && botResponse.appointment && !botResponse.error) {
            await ticketRepository.updateStatus(ticket._id, 'finished', {
              resolvedAt: new Date(),
              closedAt: new Date(),
              closedBy: 'bot',
              appointmentId: botResponse.appointment._id,
              resolution: `Agendamento criado via bot para ${botResponse.appointment.scheduledDate?.toLocaleDateString('pt-BR')} às ${botResponse.appointment.scheduledTime}`
            });
            logger.info(`✅ Ticket ${ticket._id} finalizado com sucesso pelo bot`);
          }

          // Se houver próxima pergunta, envia
          if (botResponse.nextStep) {
            let questionMessage = botResponse.nextStep.question;

            if (botResponse.nextStep.options?.length > 0) {
              questionMessage += '\n\n';
              botResponse.nextStep.options.forEach(opt => {
                questionMessage += `${opt.value} - ${opt.text}\n`;
              });
            }

            await this.sendMessage(sessionName, contactNumber, questionMessage);
          }
        }

        return; // Bot processou, não precisa criar ticket novamente
      }

      // Não tem bot vinculado - comportamento padrão
      logger.info(`📝 Sem bot vinculado - criando ticket padrão para ${sessionName}`);
      await syncService.processMessage(sessionName, message);

    } catch (error) {
      logger.error('❌ Erro ao processar mensagem entrante:', error);
    }
  }

  async syncUnreadMessages(sessionName, client) {
    try {
      logger.info(
        `🔍 Sincronizando mensagens não lidas para a sessão: ${sessionName}`
      );

      const unreadMessages = await client.getAllUnreadMessages();
      logger.info(
        `📥 Encontradas ${unreadMessages.length} mensagens não lidas.`
      );

      for (const message of unreadMessages) {
        await syncService.processMessage(sessionName, message);
      }
      logger.info(
        `✅ Sincronização de mensagens não lidas concluída para: ${sessionName}`
      );
    } catch (error) {
      logger.error(
        `❌ Erro ao sincronizar mensagens não lidas para ${sessionName}:`,
        error
      );
    }
  }

  renameSessionFolder(oldName, newName) {
    try {
      const tokensDir = path.join(process.cwd(), "tokens");
      const oldPath = path.join(tokensDir, oldName);
      const newPath = path.join(tokensDir, newName);

      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        logger.info(`Pasta da sessão renomeada de ${oldName} para ${newName}`);
      }
    } catch (error) {
      logger.warn(
        'Não foi possível renomear pasta da sessão: ' + error.message
      );
    }
  }

  async syncContacts(sessionName) {
    try {
      console.log(`🔍 Procurando cliente para sessão: ${sessionName}`);
      console.log(
        `🔍 Chaves no mapa de clients:`,
        Array.from(this.clients.keys())
      );

      const client = this.clients.get(sessionName);
      if (!client) {
        console.log(`❌ Cliente não encontrado para: ${sessionName}`);
        throw new Error("Sessão não encontrada ou não conectada");
      }

      console.log(`✅ Cliente encontrado, conectado: ${client.isConnected()}`);
      return await syncService.syncContacts(sessionName, client);
    } catch (error) {
      logger.error(`Erro ao sincronizar contatos:`, error);
      throw error;
    }
  }

  async syncMessages(sessionName, contactNumber = null) {
    try {
      const client = this.clients.get(sessionName);
      if (!client || !client.isConnected()) {
        logger.warn(
          `Não foi possível sincronizar mensagens para ${sessionName}: cliente não conectado.`
        );
        // Lança um erro ou retorna um objeto que indica a falha
        throw new Error("Sessão não encontrada ou não conectada");
      }
      logger.info(
        `seguindo para sincronizar mensagens da sessao ${sessionName}.`
      );
      if (typeof client.isConnected === "function" && !client.isConnected()) {
        logger.warn(
          `Cliente ${sessionName} não está conectado. Tentando reconectar...`
        );
        await this.reconnectSession(sessionName);
        return await this.syncMessages(sessionName, contactNumber);
      }

      logger.info(
        `Seguindo para sincronizar mensagens da sessão ${sessionName}.`
      );
      return await syncService.syncMessages(sessionName, client, contactNumber);
    } catch (error) {
      logger.error(`Erro ao sincronizar mensagens:`, error);

      // Se for erro de método não encontrado, tenta abordagem alternativa
      if (error.message.includes("is not a function")) {
        logger.warn(`Método não disponível, tentando abordagem alternativa...`);
        return await this.syncMessagesAlternative(sessionName, contactNumber);
      }

      throw error;
    }
  }

  async syncMessagesAlternative(sessionName, contactNumber = null) {
    try {
      const client = this.clients.get(sessionName);
      if (!client) {
        throw new Error("Sessão não encontrada");
      }

      logger.info(`Usando método alternativo para sincronizar mensagens...`);

      if (contactNumber) {
        // Sincronizar mensagens de um contato específico
        const chatId = contactNumber.includes("@c.us")
          ? contactNumber
          : `${contactNumber}@c.us`;

        // Tentar diferentes métodos disponíveis
        let messages = [];

        if (typeof client.getAllMessagesInChat === "function") {
          messages = await client.getAllMessagesInChat(chatId, true);
        } else if (typeof client.loadAllEarlierMessages === "function") {
          await client.loadAllEarlierMessages(chatId);
          // Buscar mensagens de outra forma...
        }

        await syncService.processMessagesBatch(sessionName, messages);
        return { success: true, messageCount: messages.length };
      } else {
        // Sincronizar todas as mensagens não lidas
        const unreadMessages = await client.getAllUnreadMessages();
        await syncService.processMessagesBatch(sessionName, unreadMessages);
        return { success: true, messageCount: unreadMessages.length };
      }
    } catch (error) {
      logger.error(`Erro no método alternativo de sincronização:`, error);
      throw error;
    }
  }

  async getSyncStatus(sessionName) {
    try {
      return await syncService.getSyncStatus(sessionName);
    } catch (error) {
      logger.error(`Erro ao obter status de sincronização:`, error);
      throw error;
    }
  }

  emitQRCode(sessionName, qrCode) {
    console.log("chamei emitQRCode");
    const session = this.sessions.get(sessionName);
    if (session) {
      console.log("possui session ", session);
      session.qrCode = qrCode;
      session.status = "awaiting_qr";

      if (this.io) {
        console.log("possui this.io ");
        this.io.to(sessionName).emit("qrCodeUpdate", {
          session: sessionName,
          qrCode: qrCode,
          status: "awaiting_qr",
        });
      }
    }
  }

  emitStatus(sessionName, status) {
    const session = this.sessions.get(sessionName);
    if (session) {
      session.status = status;

      if (this.io) {
        this.io.to(sessionName).emit("statusUpdate", {
          session: sessionName,
          status: status,
        });
      }
    }
  }

  emitStateChange(sessionName, state) {
    console.log("emitStateChange");
    if (this.io) {
      this.io.to(sessionName).emit("stateChange", {
        session: sessionName,
        state: state,
      });
    }
  }

  emitLoading(sessionName, percent, message) {
    if (this.io) {
      this.io.to(sessionName).emit("loadingUpdate", {
        session: sessionName,
        percent: percent,
        message: message,
      });
    }
  }

  emitSuccess(sessionName, message) {
    if (this.io) {
      this.io.to(sessionName).emit("success", {
        session: sessionName,
        message: message,
      });
    }
  }

  emitError(sessionName, error) {
    if (this.io) {
      this.io.to(sessionName).emit("error", {
        session: sessionName,
        error: error,
      });
    }
  }

  emitMessage(sessionName, message) {
    if (this.io) {
      this.io.to(sessionName).emit("newMessage", {
        session: sessionName,
        message: message,
      });
    }
  }

  async closeSession(sessionName) {
    try {
      const session = this.sessions.get(sessionName);
      if (session && session.client) {
        await session.client.close();
        this.sessions.delete(sessionName);
        this.clients.delete(sessionName);

        // Atualiza status no banco
        await sessionRepository.updateStatus(sessionName, "disconnected");

        logger.info(`Sessão ${sessionName} fechada com sucesso`);
      }
    } catch (error) {
      logger.error(`Erro ao fechar sessão ${sessionName}:`, error);
      throw error;
    }
  }

  async sendMessage(sessionName, number, message) {
    try {
      const client = this.clients.get(sessionName);
      if (!client) {
        throw new Error("Sessão não encontrada ou não conectada");
      }

      const formattedNumber = number.includes("@c.us")
        ? number
        : `${number}@c.us`;

      const result = await client.sendText(formattedNumber, message);

      // Atualiza última atividade
      await sessionRepository.updateOrCreate(sessionName, {
        lastActivity: new Date(),
      });

      logger.info(`Mensagem enviada para ${formattedNumber}: ${message}`);
      return result;
    } catch (error) {
      logger.error(`Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  getSessionStatus(sessionName) {
    const session = this.sessions.get(sessionName);
    return session ? session.status : "not_found";
  }

  async getAllSessions() {
    try {
      console.log("buscando sessoes...");
      // Busca tanto do banco quanto da memória
      const dbSessions = await sessionRepository.findAll();
      const sessions = [];

      for (const dbSession of dbSessions) {
        const client = this.clients.get(dbSession.name);
        // Verificar conexão real do cliente
        if (client) {
          await this.syncUnreadMessages(dbSession.name, client);
        } else {
          console.log("nao possui client..");
        }
        const isReallyConnected = client && client.isConnected();

        sessions.push({
          name: dbSession.name,
          status: isReallyConnected ? "connected" : dbSession.status,
          number: dbSession.number,
          lastActivity: dbSession.lastActivity,
          //hasClient: !!client,
          isConnected: isReallyConnected,
          qrCode: dbSession?.qrCode || null,
          source: dbSession.source,
        });
      }

      return sessions;
    } catch (error) {
      logger.error("Erro ao obter sessões:", error);
      throw error;
    }
  }

  async getSessionInfo(sessionName) {
    try {
      const dbSession = await sessionRepository.findByName(sessionName);
      const memorySession = this.sessions.get(sessionName);

      if (!dbSession && !memorySession) {
        return null;
      }

      return {
        name: sessionName,
        status: memorySession?.status || dbSession?.status,
        number: dbSession?.number,
        lastActivity: dbSession?.lastActivity,
        hasClient: this.clients.has(sessionName),
        qrCode: memorySession?.qrCode || dbSession?.qrCode,
        source: dbSession?.source,
      };
    } catch (error) {
      logger.error(
        `Erro ao obter informações da sessão ${sessionName}:`,
        error
      );
      throw error;
    }
  }

  async deleteSession(sessionName, force = false) {
    try {
      logger.info(
        `Iniciando exclusão da sessão: ${sessionName}${
          force ? " (forçada)" : ""
        }`
      );

      // Verificar se a sessão existe
      const sessionExists =
        this.sessions.has(sessionName) || this.clients.has(sessionName);

      if (!sessionExists) {
        logger.warn(
          `Sessão ${sessionName} não encontrada na memória, verificando banco...`
        );
      }

      // 1. Obter o cliente da sessão
      const client = this.clients.get(sessionName);

      // 2. Desconectar e destruir o cliente se existir
      if (client) {
        try {
          logger.info(`Desconectando cliente da sessão: ${sessionName}`);

          if (client.isConnected()) {
            // Se forçado, tenta logout mais agressivo
            if (force) {
              try {
                await client.logout();
                logger.info(`Logout forçado realizado: ${sessionName}`);
              } catch (logoutError) {
                logger.warn(`Erro no logout forçado:`, logoutError);
              }
            }

            // Fechar o cliente
            await client.close();
          }

          // Destruir o cliente
          await client.destroy();
          logger.info(`Cliente destruído com sucesso: ${sessionName}`);
        } catch (error) {
          logger.warn(
            `Erro ao desconectar/destruir cliente ${sessionName}:`,
            error
          );

          if (force) {
            // Se forçado, apenas remove da memória mesmo com erro
            logger.warn(
              `Forçando remoção do cliente ${sessionName} da memória`
            );
          } else {
            throw new Error(`Falha ao desconectar cliente: ${error.message}`);
          }
        } finally {
          // Remove do mapa de clients
          this.clients.delete(sessionName);
        }
      }

      // 3. Remover do mapa de sessões
      if (this.sessions.has(sessionName)) {
        this.sessions.delete(sessionName);
      }

      // 4. Excluir do banco de dados
      const dbDeleteResult = await sessionRepository.deleteByName(sessionName);

      if (dbDeleteResult) {
        logger.info(`Sessão ${sessionName} excluída do banco de dados`);
      } else {
        logger.warn(`Sessão ${sessionName} não encontrada no banco de dados`);
      }

      // 5. Limpar quaisquer eventos relacionados à sessão
      this.removeSessionListeners(sessionName);

      // 6. Emitir evento de sessão deletada
      this.emitSessionDeleted(sessionName);

      logger.info(`Sessão ${sessionName} deletada com sucesso`);
      return {
        success: true,
        message: `Sessão ${sessionName} deletada com sucesso`,
        clientDisconnected: !!client,
        databaseRemoved: !!dbDeleteResult,
      };
    } catch (error) {
      logger.error(`Erro ao deletar sessão ${sessionName}:`, error);

      // Emitir evento de erro
      this.emitError(sessionName, `Erro ao deletar sessão: ${error.message}`);

      // Se for modo forçado, tenta limpar pelo menos da memória
      if (force) {
        logger.warn(`Modo forçado: limpando sessão ${sessionName} da memória`);
        this.clients.delete(sessionName);
        this.sessions.delete(sessionName);

        return {
          success: true,
          message: `Sessão ${sessionName} removida da memória (modo forçado)`,
          forced: true,
        };
      }

      throw error;
    }
  }

  // Função auxiliar para remover listeners (se necessário)
  removeSessionListeners(sessionName) {
    // Implemente esta função se você tiver listeners específicos para remover
    logger.info(`Listeners da sessão ${sessionName} limpos`);
  }

  // Função para emitir evento de sessão deletada
  emitSessionDeleted(sessionName) {
    logger.info(`Evento de sessão deletada emitido: ${sessionName}`);
  }

  async createAutoTicket(sessionName, contactNumber, contactName, messages) {
    try {
      logger.info(`Criando ticket automático para: ${contactNumber}`);

      const ticketData = {
        sessionName: sessionName,
        contactNumber: contactNumber,
        contactName: contactName || contactNumber,
        status: "open",
        messages: messages,
        unreadMessages: 1,
        lastMessage: new Date(),
        createdAt: new Date(),
      };

      await ticketRepository.create(ticketData);

      logger.info(`Ticket criado para ${contactNumber}`);
    } catch (error) {
      logger.error(`Erro ao criar ticket automático:`, error);
    }
  }

  emitRedirect(sessionName, route) {
    console.log(
      `🔥 Tentando emitir redirect para sessão: ${sessionName}, rota: ${route}`
    );
    console.log(`🔥 IO disponível: ${!!this.io}`);

    if (this.io) {
      console.log(`🔥 Salas disponíveis:`, this.io.sockets.adapter.rooms);
      console.log(
        `🔥 Clientes na sala ${sessionName}:`,
        this.io.sockets.adapter.rooms.get(sessionName)
      );

      this.io.to(sessionName).emit("redirect", {
        session: sessionName,
        route: route,
      });
      console.log(`✅ Evento redirect emitido para ${sessionName}`);
    } else {
      console.log("❌ IO não disponível para emitir redirect");
    }
  }

  async reconnectSession(sessionName) {
    try {
      logger.info(`Reconectando sessão: ${sessionName}`);

      const dbSession = await sessionRepository.findByName(sessionName);
      if (!dbSession) {
        throw new Error(`Sessão ${sessionName} não encontrada`);
      }

      // Limpar cliente existente
      const existingClient = this.clients.get(sessionName);
      if (existingClient) {
        try {
          await existingClient.close();
        } catch (error) {
          logger.warn(`Erro ao fechar cliente:`, error);
        }
        this.clients.delete(sessionName);
      }

      this.sessions.delete(sessionName);

      // Aguardar para garantir limpeza
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // ✅ Criar sessão COM O NOME REAL
      const client = await this.createSession(sessionName, true);

      logger.info(`Sessão ${sessionName} reconectada!`);
      return client;
    } catch (error) {
      logger.error(`Erro ao reconectar ${sessionName}:`, error);
      await sessionRepository.updateStatus(sessionName, "failed");
      throw error;
    }
  }

  async killChromeProcesses(sessionName) {
    try {
      const { exec } = require("child_process");

      if (process.platform === "win32") {
        // Windows
        exec("taskkill /f /im chrome.exe /im chromedriver.exe /im browser.exe");
      } else {
        // Linux/Mac - mais agressivo para garantir
        exec('pkill -f "(chrome|chromium|chromedriver|puppeteer|browser)"');
      }

      logger.info(`Processos do Chrome finalizados para: ${sessionName}`);
    } catch (error) {
      logger.warn(`Não foi possível finalizar processos: ${error.message}`);
    }
  }

  async forceKillChromeProcesses(sessionName) {
    try {
      const { execSync } = require("child_process");

      if (process.platform === "win32") {
        // Windows - mais agressivo
        execSync(
          "taskkill /f /im chrome.exe /im chromedriver.exe /im browser.exe /t 2>/nul",
          { stdio: "ignore" }
        );
      } else {
        // Linux/Mac - mais agressivo
        try {
          execSync(
            'pkill -9 -f "(chrome|chromium|chromedriver|puppeteer)" 2>/dev/null',
            { stdio: "ignore" }
          );
        } catch (e) {} // Ignorar erros de processo não encontrado
      }

      logger.info(
        `Processos do Chrome finalizados forçadamente para: ${sessionName}`
      );
    } catch (error) {
      logger.warn(`Erro na finalização forçada: ${error.message}`);
    }
  }

  checkSessionHealth() {
    logger.info("🔍 Verificando saúde das sessões...");
    console.log("📋 Sessões na memória:", Array.from(this.sessions.keys()));
    console.log("📋 Clientes conectados:", Array.from(this.clients.keys()));

    // Verificar se os clientes estão realmente conectados
    for (const [sessionName, client] of this.clients.entries()) {
      console.log(
        `✅ ${sessionName}: ${
          client.isConnected() ? "Conectado" : "Desconectado"
        }`
      );
    }
  }

  emitAck(sessionName, status, message) {
    if (this.io) {
      this.io.to(sessionName).emit("messageAck", {
        session: sessionName,
        status, // sent, delivered, read, played
        message,
      });
    }
  }

  emitMessageReplied(sessionName, message) {
    if (this.io) {
      this.io.to(sessionName).emit("messageReplied", {
        session: sessionName,
        message,
      });
    }
  }
}

export default new WhatsAppService();
