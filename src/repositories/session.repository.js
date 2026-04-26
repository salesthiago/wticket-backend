import Session from '../models/session.model.js';

class SessionRepository {
  async create(sessionData) {
    if (!sessionData.companyId) throw new Error('companyId is required');
    try {
      const session = new Session(sessionData);
      return await session.save();
    } catch (error) {
      throw new Error(`Erro ao criar sessão: ${error.message}`);
    }
  }

  // companyId optional here because wppconnect callbacks still
  // look up sessions by name only. TODO: tenant-aware services.
  async findByName(name, { companyId } = {}) {
    try {
      const query = { name };
      if (companyId) query.companyId = companyId;
      return await Session.findOne(query);
    } catch (error) {
      throw new Error(`Erro ao buscar sessão: ${error.message}`);
    }
  }

  async findAll({ companyId } = {}) {
    try {
      const query = companyId ? { companyId } : {};
      return await Session.find(query);
    } catch (error) {
      throw new Error(`Erro ao buscar sessões: ${error.message}`);
    }
  }

  async updateByName(name, updateData, { companyId } = {}) {
    try {
      const filter = { name };
      if (companyId) filter.companyId = companyId;
      const patch = { ...updateData };
      delete patch.companyId;
      return await Session.findOneAndUpdate(
        filter,
        { $set: patch },
        { new: true, upsert: false }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar sessão: ${error.message}`);
    }
  }

  async updateOrCreate(name, sessionData) {
    try {
      const filter = { name };
      if (sessionData.companyId) filter.companyId = sessionData.companyId;
      return await Session.findOneAndUpdate(
        filter,
        { $set: sessionData },
        { new: true, upsert: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar/criar sessão: ${error.message}`);
    }
  }

  async deleteByName(name, { companyId } = {}) {
    try {
      const filter = { name };
      if (companyId) filter.companyId = companyId;
      return await Session.findOneAndDelete(filter);
    } catch (error) {
      throw new Error(`Erro ao deletar sessão: ${error.message}`);
    }
  }

  async getProducts(name, { companyId } = {}) {
    try {
      const filter = { name };
      if (companyId) filter.companyId = companyId;
      const session = await Session.findOne(filter).populate('products');
      return session?.products || [];
    } catch (error) {
      throw new Error(`Erro ao buscar produtos da sessão: ${error.message}`);
    }
  }

  async addProduct(name, productId, { companyId } = {}) {
    try {
      const filter = { name };
      if (companyId) filter.companyId = companyId;
      return await Session.findOneAndUpdate(
        filter,
        { $addToSet: { products: productId } },
        { new: true }
      ).populate('products');
    } catch (error) {
      throw new Error(`Erro ao adicionar produto: ${error.message}`);
    }
  }

  async removeProduct(name, productId, { companyId } = {}) {
    try {
      const filter = { name };
      if (companyId) filter.companyId = companyId;
      return await Session.findOneAndUpdate(
        filter,
        { $pull: { products: productId } },
        { new: true }
      ).populate('products');
    } catch (error) {
      throw new Error(`Erro ao remover produto: ${error.message}`);
    }
  }

  async updateStatus(name, status, { companyId } = {}) {
    try {
      const filter = { name };
      if (companyId) filter.companyId = companyId;
      return await Session.findOneAndUpdate(
        filter,
        { $set: { status } },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar status: ${error.message}`);
    }
  }

  async updateNumber(name, number, { companyId } = {}) {
    try {
      const filter = { name };
      if (companyId) filter.companyId = companyId;
      return await Session.findOneAndUpdate(
        filter,
        { $set: { number } },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar número: ${error.message}`);
    }
  }

  async updateSource(name, source, { companyId } = {}) {
    try {
      const filter = { name };
      if (companyId) filter.companyId = companyId;
      return await Session.findOneAndUpdate(
        filter,
        { $set: { source } },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Erro ao atualizar source: ${error.message}`);
    }
  }
}

export default new SessionRepository();
