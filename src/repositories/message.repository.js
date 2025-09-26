import Message from '../models/message.model.js';

class MessageRepository {
  async create(messageData) {
    try {
      const message = new Message(messageData);
      return await message.save();
    } catch (error) {
      throw new Error(`Erro ao criar mensagem: ${error.message}`);
    }
  }

  async findByTicket(ticketId, filters = {}) {
    try {
      const query = { ticketId, ...filters };
      return await Message.find(query).sort({ timestamp: 1 });
    } catch (error) {
      throw new Error(`Erro ao buscar mensagens: ${error.message}`);
    }
  }

  async findByMessageId(messageId) {
    try {
      return await Message.findOne({ messageId });
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

  async getLastMessage(ticketId) {
    try {
      return await Message.findOne({ ticketId })
        .sort({ timestamp: -1 })
        .limit(1);
    } catch (error) {
      throw new Error(`Erro ao buscar última mensagem: ${error.message}`);
    }
  }

  async deleteByTicket(ticketId) {
    try {
      return await Message.deleteMany({ ticketId });
    } catch (error) {
      throw new Error(`Erro ao deletar mensagens: ${error.message}`);
    }
  }
}

export default new MessageRepository();