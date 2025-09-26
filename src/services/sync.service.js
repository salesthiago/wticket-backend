import contactRepository from "../repositories/contact.repository.js";
import ticketRepository from "../repositories/ticket.repository.js";
import messageRepository from "../repositories/message.repository.js";
import logger from "../utils/logger.js";

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

      // Busca todos os contatos do WhatsApp
      const contacts = await client.getAllContacts();
      logger.info(`Encontrados ${contacts.length} contatos para sincronizar`);

      let syncedCount = 0;
      let errorCount = 0;

      for (const contact of contacts) {
        console.log(contact, "<<<<< contact");
        try {
          const contactData = {
            name: contact.name || contact.pushname || contact.shortName,
            sessionName: sessionName,
          };

          await contactRepository.updateOrCreate(contact.id.user, contactData);
          syncedCount++;
          /*
          await this.createAutoTicket(
            sessionName,
            contact.id.user,
            contactData.name
          );
          */
        } catch (error) {
          logger.error(
            `Erro ao sincronizar contato ${contact.id.user}:`,
            error
          );
          errorCount++;
        }
      }

      logger.info(
        `Sincronização concluída: ${syncedCount} contatos sincronizados, ${errorCount} erros`
      );

      return {
        success: true,
        syncedCount,
        errorCount,
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
