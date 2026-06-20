import AutoResponse from '../models/auto-response.model.js';

class AutoResponseRepository {
  async findByBotConfig(botConfigId, { companyId } = {}) {
    const query = { botConfig: botConfigId, enabled: true };
    if (companyId) query.companyId = companyId;
    return await AutoResponse.find(query).sort({ priority: 1 });
  }

  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    return await AutoResponse.create(data);
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    return await AutoResponse.findOneAndUpdate(
      { _id: id, companyId },
      patch,
      { new: true }
    );
  }

  async delete(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await AutoResponse.findOneAndDelete({ _id: id, companyId });
  }

  async destroy(companyId, id) {
    return await this.delete(companyId, id);
  }

  async destroyByBotConfig(companyId, botConfigId) {
    if (!companyId) throw new Error('companyId is required');
    return await AutoResponse.deleteMany({ companyId, botConfig: botConfigId });
  }
}

export default new AutoResponseRepository();
