import Session from '../models/session.model.js';

class SessionRepository {
  async create(sessionData) {
    try {
      const session = new Session(sessionData);
      return await session.save();
    } catch (error) {
      throw new Error(`Erro ao criar sessão: ${error.message}`);
    }
  }

  async findByName(name) {
    try {
      return await Session.findOne({ name });
    } catch (error) {
      throw new Error(`Erro ao buscar sessão: ${error.message}`);
    }
  }

  async findAll() {
    try {
      return await Session.find({});
    } catch (error) {
      throw new Error(`Erro ao buscar sessões: ${error.message}`);
    }
  }

  async updateByName(name, updateData) {
    try {
      return await Session.findOneAndUpdate(
        { name },
        { $set: updateData },
        { new: true, upsert: false }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar sessão: ${error.message}`);
    }
  }

  async updateOrCreate(name, sessionData) {
    try {
      return await Session.findOneAndUpdate(
        { name },
        { $set: sessionData },
        { new: true, upsert: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar/criar sessão: ${error.message}`);
    }
  }

  async deleteByName(name) {
    try {
      return await Session.findOneAndDelete({ name });
    } catch (error) {
      throw new Error(`Erro ao deletar sessão: ${error.message}`);
    }
  }

  async updateStatus(name, status) {
    try {
      return await Session.findOneAndUpdate(
        { name },
        { $set: { status } },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar status: ${error.message}`);
    }
  }

  async updateNumber(name, number) {
    try {
      return await Session.findOneAndUpdate(
        { name },
        { $set: { number } },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar número: ${error.message}`);
    }
  }

  async updateSource(name, source) {
    try {
      return await Session.findOneAndUpdate(
        { name },
        { $set: { source } },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar source: ${error.message}`);
    }
  }
}

export default new SessionRepository();