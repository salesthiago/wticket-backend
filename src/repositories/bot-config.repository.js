import BotConfig from "../models/bot-config.model.js";

class BotConfigRepository {
  async create(data) {
    try {
      const botConfig = await BotConfig.create(data);
      return botConfig
    } catch (error) {
      throw new Error(`Erro ao criar BotConfig: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      return await BotConfig.findById(id);
    } catch (error) {
      throw new Error(`Erro ao buscar BotConfig: ${error.message}`);
    }
  }

  async findAll({ query, page, rowsPerPage }) {
    try {
      return await BotConfig.find(query)
        .limit(rowsPerPage)
        .skip(rowsPerPage * page);
    } catch (error) {
      throw new Error(`Erro ao buscar ALL BotConfig: ${error.message}`);
    }
  }

  async update(id, data) {
    try {
      return await BotConfig.findOneAndUpdate(
        { _id: id },
        { $set: { ...data } },
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar BotConfig: ${error.message}`);
    }
  }
}

export default new BotConfigRepository();
