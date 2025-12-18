import BotConfig from '../models/bot-config.model.js';

class BotConfigRepository {
  async findAll({ query = {}, page = 0, rowsPerPage = 10 }) {
    const skip = page * rowsPerPage;
    const items = await BotConfig.find(query)
      .populate('autoResponses')
      .skip(skip)
      .limit(rowsPerPage)
      .sort({ createdAt: -1 });

    const total = await BotConfig.countDocuments(query);

    return {
      items,
      total,
      page: page + 1,
      rowsPerPage,
      totalPages: Math.ceil(total / rowsPerPage)
    };
  }

  async findByName(name) {
    return await BotConfig.findOne({ name }).populate('autoResponses');
  }

  async findById(id) {
    return await BotConfig.findById(id).populate('autoResponses');
  }

  async findEnabled() {
    return await BotConfig.find({ enabled: true }).populate('autoResponses');
  }

  async create(data) {
    return await BotConfig.create(data);
  }

  async update(id, data) {
    return await BotConfig.findByIdAndUpdate(id, data, { new: true });
  }

  async destroy(id) {
    return await BotConfig.findByIdAndDelete(id);
  }
}

export default new BotConfigRepository();