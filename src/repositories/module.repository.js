import Module from '../models/module.model.js';

class ModuleRepository {
  async create(data) {
    const created = new Module(data);
    return await created.save();
  }

  async findAll({ query = {}, page = 0, rowsPerPage = 50 } = {}) {
    return await Module.find(query)
      .sort({ name: 1 })
      .limit(rowsPerPage)
      .skip(rowsPerPage * page);
  }

  async findActive() {
    return await Module.find({ isActive: true }).sort({ name: 1 });
  }

  async findById(id) {
    return await Module.findById(id);
  }

  async findByCode(code) {
    return await Module.findOne({ code });
  }

  async findByCodes(codes) {
    return await Module.find({ code: { $in: codes } });
  }

  async update(id, data) {
    return await Module.findOneAndUpdate(
      { _id: id },
      { $set: { ...data } },
      { new: true }
    );
  }

  async destroy(id) {
    return await Module.findByIdAndDelete(id);
  }
}

export default new ModuleRepository();
