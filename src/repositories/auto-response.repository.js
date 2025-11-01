import AutoResponse from "../models/auto-response.model.js";

class AutoResponseRepository {
  async create(data) {
    try {
      return await AutoResponse.create(data);
    } catch (error) {
      throw new Error(`Erro ao criar AutoResponse: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      return await AutoResponse.findById(id);
    } catch (error) {
      throw new Error(`Erro ao buscar AutoResponse: ${error.message}`);
    }
  }
  async findByBotConfigId(id) {
    try {
      return await AutoResponse.findOne({
        botConfig: id
      });
    } catch (error) {
      throw new Error(`Erro ao buscar AutoResponse - findByBotConfigId: ${error.message}`);
    }
  }

  async findAll({ query, page, rowsPerPage }) {
    try {
      return await AutoResponse.find(query)
        .limit(rowsPerPage)
        .skip(rowsPerPage * page);
    } catch (error) {
      throw new Error(`Erro ao buscar ALL AutoResponse: ${error.message}`);
    }
  }

  async update(id, data) {
    try {
      return await AutoResponse.findOneAndUpdate(
        { _id: id },
        { $set: { ...data } },
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar AutoResponse: ${error.message}`);
    }
  }
  async destroy(id) {
    try {
      return await AutoResponse.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(`Erro ao Deletar AutoResponse: ${error.message}`);
    }
  }
}

export default new AutoResponseRepository();
