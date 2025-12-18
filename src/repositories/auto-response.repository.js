import AutoResponse from '../models/auto-response.model.js';

class AutoResponseRepository {
  async findByBotConfig(botConfigId) {
    return await AutoResponse.find({ 
      botConfig: botConfigId,
      enabled: true 
    }).sort({ priority: 1 });
  }

  async create(data) {
    return await AutoResponse.create(data);
  }

  async update(id, data) {
    return await AutoResponse.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return await AutoResponse.findByIdAndDelete(id);
  }

  async destroy(id) {
    return await AutoResponse.findByIdAndDelete(id);
  }

  async destroyByBotConfig(botConfigId) {
    return await AutoResponse.deleteMany({ botConfig: botConfigId });
  }
}

export default new AutoResponseRepository();