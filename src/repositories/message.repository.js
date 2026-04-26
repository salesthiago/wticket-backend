import Message from '../models/message.model.js';

// Messages are mostly created by services (whatsapp ingestion), so companyId
// is optional here. TODO: enforce after services are tenant-aware.
class MessageRepository {
  async create(messageData) {
    try {
      const message = new Message(messageData);
      return await message.save();
    } catch (error) {
      throw new Error(`Erro ao criar mensagem: ${error.message}`);
    }
  }

  async findByTicket(ticketId, filters = {}, { companyId } = {}) {
    try {
      const query = { ticketId, ...filters };
      if (companyId) query.companyId = companyId;
      return await Message.find(query).sort({ timestamp: 1 });
    } catch (error) {
      throw new Error(`Erro ao buscar mensagens: ${error.message}`);
    }
  }

  async findByMessageId(messageId, { companyId } = {}) {
    try {
      const query = { messageId };
      if (companyId) query.companyId = companyId;
      return await Message.findOne(query);
    } catch (error) {
      throw new Error(`Erro ao buscar mensagem: ${error.message}`);
    }
  }

  async updateStatus(messageId, status) {
    try {
      return await Message.findOneAndUpdate(
        { messageId },
        { $set: { status } },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar status: ${error.message}`);
    }
  }

  async getLastMessage(ticketId, { companyId } = {}) {
    try {
      const query = { ticketId };
      if (companyId) query.companyId = companyId;
      return await Message.findOne(query)
        .sort({ timestamp: -1 })
        .limit(1);
    } catch (error) {
      throw new Error(`Erro ao buscar última mensagem: ${error.message}`);
    }
  }

  async deleteByTicket(ticketId, { companyId } = {}) {
    try {
      const query = { ticketId };
      if (companyId) query.companyId = companyId;
      return await Message.deleteMany(query);
    } catch (error) {
      throw new Error(`Erro ao deletar mensagens: ${error.message}`);
    }
  }
}

export default new MessageRepository();
