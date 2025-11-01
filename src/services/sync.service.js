import contactRepository from "../repositories/contact.repository.js";
import ticketRepository from "../repositories/ticket.repository.js";
import messageRepository from "../repositories/message.repository.js";
import logger from "../utils/logger.js";
import { onlyNumbers } from "../utils/formatter.js";

class SyncService {
  constructor() {
    this.isSyncing = false;
  }

  async syncContacts(sessionName, client) {
  try {
    if (this.isSyncing) {
      logger.warn(
        `Sincronização já em andamento para sessão: ${sessionName}`
      );
      return;
    }

    this.isSyncing = true;
    logger.info(
      `Iniciando sincronização de contatos para sessão: ${sessionName}`
    );

    const contacts = await client.getAllContacts();
    logger.info(`Encontrados ${contacts.length} contatos para sincronizar`);

    let syncedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const contact of contacts) {
      try {
        
        if (!contact.id || contact.id?.server !== "c.us") {
          logger.debug(
            `Ignorando contato não-usuário: ${contact.id?._serialized || 'ID não disponível'}`
          );
          skippedCount++;
          continue;
        }
        logger.info('verificando contato ', contact)
        // Validação do número - CRÍTICO
        const number = contact.id.user;
        if (!number || typeof number !== 'string' || number.trim() === '') {
          logger.warn(
            `Número inválido ou vazio para contato: ${contact.id?._serialized || 'ID não disponível'}`
          );
          skippedCount++;
          continue;
        }

        // Remove caracteres não numéricos e valida se tem comprimento mínimo
        const cleanNumber = number.replace(/\D/g, '');
        if (cleanNumber.length < 10) {
          logger.warn(
            `Número muito curto: ${cleanNumber} (original: ${number})`
          );
          skippedCount++;
          continue;
        }

        console.log('number validado:', cleanNumber);
        const name =
          contact.name || contact.pushname || contact.formattedName || cleanNumber;

        // Avatar
        let avatar = null;

        if (contact.profilePicThumbObj) {
          if (typeof contact.profilePicThumbObj.imgFull === "string") {
            avatar = contact.profilePicThumbObj.imgFull;
          } else if (typeof contact.profilePicThumbObj.img === "string") {
            avatar = contact.profilePicThumbObj.img;
          } else if (typeof contact.profilePicThumbObj.eurl === "string") {
            avatar = contact.profilePicThumbObj.eurl;
          }
        }

        // Se não encontrou nada, tenta pegar do servidor
        if (!avatar) {
          try {
            const picUrl = await client.getProfilePicFromServer(
              contact.id._serialized
            );
            if (typeof picUrl === "string") {
              avatar = picUrl;
            }
          } catch (err) {
            logger.debug(`Sem avatar disponível para ${cleanNumber}`);
          }
        }

        const contactData = {
          sessionName,
          phone: cleanNumber,
          name,
          avatar,
        };

        await contactRepository.updateOrCreate(cleanNumber, contactData);
        syncedCount++;

      } catch (error) {
        logger.error(
          `Erro ao sincronizar contato ${contact.id?.user}:`,
          error
        );
        errorCount++;
      }
    }

    logger.info(
      `Sincronização concluída: ${syncedCount} contatos sincronizados, ${errorCount} erros, ${skippedCount} ignorados`
    );

    return {
      success: true,
      syncedCount,
      errorCount,
      skippedCount,
      total: contacts.length,
    };
  } catch (error) {
    logger.error(`Erro na sincronização de contatos:`, error);
    throw error;
  } finally {
    this.isSyncing = false;
  }
}

  async createAutoTicket(
    sessionName,
    contactNumber,
    contactName,
    messages = []
  ) {
    try {
      // Verifica se já existe um ticket aberto para este contato
      const existingTickets = await ticketRepository.findAll(sessionName, {
        contactNumber,
        status: { $in: ["opened", "in_progress"] },
      });

      if (existingTickets.length === 0) {
        // Cria um novo ticket apenas se não existir um aberto
        const ticketData = {
          contactNumber,
          contactName: contactName || contactNumber,
          sessionName,
          messages: messages,
          subject: "Atendimento Iniciado",
          status: "opened",
          priority: "medium",
        };

        await ticketRepository.create(ticketData);
        logger.info(`Ticket criado automaticamente para: ${contactNumber}`);
      }
    } catch (error) {
      logger.error(`Erro ao criar ticket automático:`, error);
    }
  }

  async syncMessages(sessionName, client, contactNumber = null) {
    try {
      if (contactNumber) {
        const chatId = contactNumber.includes("@c.us")
          ? contactNumber
          : `${contactNumber}@c.us`;

        let messages = [];

        // Tentar diferentes métodos disponíveis
        if (typeof client.getAllMessagesInChat === "function") {
          messages = await client.getAllMessagesInChat(chatId, true);
        } else if (typeof client.loadAllEarlierMessages === "function") {
          await client.loadAllEarlierMessages(chatId);
          messages = await client.getMessages(chatId, { count: 100 });
        } else if (typeof client.getMessages === "function") {
          messages = await client.getMessages(chatId, { count: 100 });
        } else {
          throw new Error("Nenhum método de busca de mensagens disponível");
        }

        // Usar processMessagesBatch se existir, senão processar individualmente
        if (typeof this.processMessagesBatch === "function") {
          await this.processMessagesBatch(sessionName, messages);
        } else {
          for (const message of messages) {
            await this.processMessage(sessionName, message);
          }
        }

        return messages;
      } else {
        // Sincronizar todas as conversas (implementação existente)
        const chats = await client.getAllChats();

        for (const chat of chats) {
          if (chat.unreadCount > 0) {
            let chatMessages = [];

            if (typeof client.getAllMessagesInChat === "function") {
              chatMessages = await client.getAllMessagesInChat(chat.id, true);
            } else if (typeof client.getMessages === "function") {
              chatMessages = await client.getMessages(chat.id, {
                count: chat.unreadCount,
              });
            }

            for (const message of chatMessages) {
              await this.processMessage(sessionName, message);
            }
          }
        }

        return { success: true, message: "Mensagens sincronizadas" };
      }
    } catch (error) {
      logger.error(`Erro no syncMessages:`, error);
      throw error;
    }
  }

  async getSyncStatus(sessionName) {
    try {
      const contactsStats = await contactRepository.getContactsStats(
        sessionName
      );
      const ticketsStats = await ticketRepository.getTicketsStats(sessionName);

      return {
        contacts: contactsStats[0] || { totalContacts: 0, totalMessages: 0 },
        tickets: ticketsStats.reduce(
          (acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          },
          { opened: 0, in_progress: 0, finished: 0, canceled: 0 }
        ),
      };
    } catch (error) {
      logger.error(`Erro ao obter status de sincronização:`, error);
      throw error;
    }
  }

  async processMessage(sessionName, message) {
    try {
      // 🔥 MESMOS FILTROS DO WHATSAPP.SERVICE.JS
      const shouldIgnoreMessage =
        message.from.includes("status@broadcast") ||
        message.from.includes("@g.us") ||
        message.fromMe ||
        message.broadcast ||
        (message.from.includes("@broadcast") &&
          !message.from.includes("@c.us"));

      if (shouldIgnoreMessage) {
        logger.info(
          `🚫 [Sync] Ignorando mensagem de grupo/canal: ${message.from}`
        );
        return;
      }

      const contactNumber = message.from.replace("@c.us", "");
      const contactName =
        message.sender?.name || message.sender?.pushname || contactNumber;

      // Cria ou atualiza ticket
      await ticketRepository.updateOrCreate(sessionName, contactNumber, {
        contactName: contactName,
        unreadMessages: { $inc: 1 },
        lastMessage: new Date(),
        status: "open",
      });

      logger.info(`Ticket atualizado para ${contactNumber}`);
    } catch (error) {
      logger.error("Erro ao processar mensagem:", error);
    }
  }

  async processMessagesBatch(sessionName, messages) {
    try {
      logger.info(
        `Processando lote de ${messages.length} mensagens para ${sessionName}`
      );

      for (const message of messages) {
        await this.processMessage(sessionName, message);
      }

      logger.info(
        `Lote de ${messages.length} mensagens processado com sucesso`
      );
    } catch (error) {
      logger.error(`Erro ao processar lote de mensagens:`, error);
      throw error;
    }
  }
}

export default new SyncService();
