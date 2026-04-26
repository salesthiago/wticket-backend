import BotConfig from '../models/bot-config.model.js';

class BotConfigRepository {
  async findAll(companyId, { query = {}, page = 0, rowsPerPage = 10 } = {}) {
    if (!companyId) throw new Error('companyId is required');
    const finalQuery = { ...query, companyId };
    const skip = page * rowsPerPage;
    const items = await BotConfig.find(finalQuery)
      .populate('autoResponses')
      .skip(skip)
      .limit(rowsPerPage)
      .sort({ createdAt: -1 });

    const total = await BotConfig.countDocuments(finalQuery);

    return {
      items,
      total,
      page: page + 1,
      rowsPerPage,
      totalPages: Math.ceil(total / rowsPerPage)
    };
  }

  async findByName(companyId, name) {
    if (!companyId) throw new Error('companyId is required');
    return await BotConfig.findOne({ companyId, name }).populate('autoResponses');
  }

  async findById(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await BotConfig.findOne({ _id: id, companyId }).populate('autoResponses');
  }

  // Used by services — keeps companyId optional but recommended.
  async findEnabled({ companyId } = {}) {
    const query = { enabled: true };
    if (companyId) query.companyId = companyId;
    return await BotConfig.find(query).populate('autoResponses');
  }

  async findBySessionId(sessionId, { companyId } = {}) {
    const query = { sessionId, enabled: true };
    if (companyId) query.companyId = companyId;
    return await BotConfig.findOne(query).populate('autoResponses');
  }

  async create(data) {
    if (!data.companyId) throw new Error('companyId is required');
    return await BotConfig.create(data);
  }

  async update(companyId, id, data) {
    if (!companyId) throw new Error('companyId is required');
    const patch = { ...data };
    delete patch.companyId;
    return await BotConfig.findOneAndUpdate(
      { _id: id, companyId },
      patch,
      { new: true }
    );
  }

  async destroy(companyId, id) {
    if (!companyId) throw new Error('companyId is required');
    return await BotConfig.findOneAndDelete({ _id: id, companyId });
  }
}

export default new BotConfigRepository();
