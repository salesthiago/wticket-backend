import Plan from '../models/plan.model.js';

class PlanRepository {
  async create(data) {
    const created = new Plan(data);
    return await created.save();
  }

  async findAll({ query = {} } = {}) {
    return await Plan.find(query).sort({ price: 1, name: 1 });
  }

  async findActive() {
    return await Plan.find({ isActive: true }).sort({ price: 1, name: 1 });
  }

  async findById(id) {
    return await Plan.findById(id);
  }

  async findByName(name) {
    return await Plan.findOne({ name });
  }

  async update(id, data) {
    return await Plan.findByIdAndUpdate(id, { $set: { ...data } }, { new: true });
  }

  async destroy(id) {
    return await Plan.findByIdAndDelete(id);
  }
}

export default new PlanRepository();
